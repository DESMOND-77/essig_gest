# backend/rh_paie/tests/test_salaire_administration_service.py
from django.test import TestCase
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from rh_paie.services import SalaireAdministrationService
from rh_paie.models import SalaireAdministration, PersonnelAdministratif
from tresorerie.models import Compte, CategorieMouvement, Mouvement
from referentiel.models import AnneeScolaire, Ecole
import datetime

User = get_user_model()


class SalaireAdministrationServiceTest(TestCase):
    """Test cases for SalaireAdministrationService"""

    def setUp(self):
        """Set up test data"""
        # Créer un utilisateur de test
        self.user = User.objects.create_user(
            login='testuser',
            password='testpass123',
            email='test@example.com'
        )

        # Créer une école de test
        self.ecole = Ecole.objects.create(
            nom='École Test',
            sigle='ET',
        )

        # Créer une année scolaire de test
        self.annee_scolaire = AnneeScolaire.objects.create(
            libelle='2025-2026',
            date_debut='2025-09-01',
            date_fin='2026-06-30'
        )

        # Créer un personnel administratif de test
        self.personnel = PersonnelAdministratif.objects.create(
            nom='DURAND',
            prenom='Jean',
            poste='Comptable',
            ecole=self.ecole,
            email='jean.durand@example.com',
            salaire_base=400000
        )

        # Créer un compte de test pour le paiement
        self.compte = Compte.objects.create(
            code='PAYEADM001',
            libelle='Compte de Paiement Administration Test',
            type=Compte.Type.BANQUE,
            solde_initial=1500000,  # 1,500,000 FCFA
            actif=True,
            cree_par=self.user
        )

        # Créer une catégorie de mouvement pour les salaires
        self.categorie_salaire = CategorieMouvement.objects.create(
            code='SALAIRE',
            libelle='Paiement de salaire',
            sens=CategorieMouvement.Sens.SORTIE,  # Débit pour payer un salaire
            cree_par=self.user
        )

    def test_payer_salaire_administration_success(self):
        """Test du paiement réussi d'un salaire administratif"""
        # Créer un salaire administratif en brouillon
        salaire = SalaireAdministration.objects.create(
            personnel_administratif=self.personnel,
            annee_scolaire=self.annee_scolaire,
            mois='SEPT',
            date_paiement=datetime.date(2025, 9, 25),
            montant_du=400000,  # 400,000 FCFA
            montant_paye=0,  # Rien encore versé
            compte=self.compte,
            statut='BROUILLON',
            mouvement=0,  # Temporarily set to 0, will be updated after payment
            cree_par=self.user
        )

        # Valider le salaire d'abord (nécessaire avant paiement)
        salaire.statut = 'VALIDÉ'
        salaire.save()

        # Effectuer le paiement (intégral : montant == montant_du)
        result = SalaireAdministrationService.payer_salaire_administration(
            salaire_id=salaire.id,
            compte_debiteur_id=self.compte.id,
            montant=salaire.montant_du,
            categorie_mouvement_id=self.categorie_salaire.id,
            libelle=f"Paiement salaire {self.personnel.nom} {self.personnel.prenom} - {salaire.get_mois_display()} {salaire.annee_scolaire}",
            ecole_id=self.ecole.id,
            annee_scolaire_id=self.annee_scolaire.id,
            cree_par_id=self.user.id
        )

        # Vérifier le résultat
        self.assertIsNotNone(result)
        self.assertIn('mouvement', result)
        self.assertIn('salaire', result)
        self.assertIn('message', result)

        # Vérifier que le mouvement a été créé correctement
        mouvement = result['mouvement']
        self.assertIsInstance(mouvement, Mouvement)
        self.assertEqual(mouvement.montant, salaire.montant_du)
        self.assertEqual(mouvement.sens, Mouvement.Sens.DEBIT)
        self.assertEqual(mouvement.compte, self.compte)
        self.assertEqual(mouvement.categorie_mouvement, self.categorie_salaire)

        # Vérifier que le salaire a été mis à jour
        salaire_rafraichi = SalaireAdministration.objects.get(id=salaire.id)
        self.assertEqual(salaire_rafraichi.statut, 'PAYÉ')
        self.assertEqual(salaire_rafraichi.mouvement, mouvement.id)

    def test_payer_salaire_administration_non_valide(self):
        """Test que le paiement échoue pour un salaire non validé"""
        # Créer un salaire administratif en brouillon (non validé)
        salaire = SalaireAdministration.objects.create(
            personnel_administratif=self.personnel,
            annee_scolaire=self.annee_scolaire,
            mois='SEPT',
            date_paiement=datetime.date(2025, 9, 25),
            montant_du=400000,
            montant_paye=0,
            compte=self.compte,
            statut='BROUILLON',  # Toujours en brouillon
            cree_par=self.user
        )

        # Tenter de payer le salaire sans validation préalable
        with self.assertRaises(Exception) as context:
            SalaireAdministrationService.payer_salaire_administration(
                salaire_id=salaire.id,
                compte_debiteur_id=self.compte.id,
                montant=salaire.montant_du,
                categorie_mouvement_id=self.categorie_salaire.id,
                libelle="Test paiement salaire non validé",
                ecole_id=self.ecole.id,
                annee_scolaire_id=self.annee_scolaire.id,
                cree_par_id=self.user.id
            )

        # Vérifier que l'erreur concerne le statut du salaire
        self.assertIn('statut', str(context.exception).lower())
        self.assertIn('validé', str(context.exception).lower())

    def test_payer_salaire_administration_deja_paye(self):
        """Test que le paiement échoue pour un salaire déjà payé (idempotence)"""
        # Créer un salaire administratif
        salaire = SalaireAdministration.objects.create(
            personnel_administratif=self.personnel,
            annee_scolaire=self.annee_scolaire,
            mois='SEPT',
            date_paiement=datetime.date(2025, 9, 25),
            montant_du=400000,
            montant_paye=0,
            compte=self.compte,
            statut='BROUILLON',
            cree_par=self.user
        )

        # Valider le salaire
        salaire.statut = 'VALIDÉ'
        salaire.save()

        # Effectuer le premier paiement (intégral)
        result1 = SalaireAdministrationService.payer_salaire_administration(
            salaire_id=salaire.id,
            compte_debiteur_id=self.compte.id,
            montant=salaire.montant_du,
            categorie_mouvement_id=self.categorie_salaire.id,
            libelle="Premier paiement",
            ecole_id=self.ecole.id,
            annee_scolaire_id=self.annee_scolaire.id,
            cree_par_id=self.user.id
        )

        # Vérifier que le premier paiement a réussi
        self.assertIsNotNone(result1)
        mouvement_id_1 = result1['mouvement'].id

        # Tenter un deuxième paiement pour le même salaire (déjà entièrement payé : idempotence)
        result2 = SalaireAdministrationService.payer_salaire_administration(
            salaire_id=salaire.id,
            compte_debiteur_id=self.compte.id,
            montant=salaire.montant_du,
            categorie_mouvement_id=self.categorie_salaire.id,
            libelle="Deuxième paiement",
            ecole_id=self.ecole.id,
            annee_scolaire_id=self.annee_scolaire.id,
            cree_par_id=self.user.id
        )

        # Vérifier que le deuxième paiement retourne le même mouvement (idempotence)
        self.assertIsNotNone(result2)
        mouvement_id_2 = result2['mouvement'].id
        self.assertEqual(mouvement_id_1, mouvement_id_2)

        # Vérifier qu'il n'y a toujours qu'un seul mouvement associé au salaire
        salaire_rafraichi = SalaireAdministration.objects.get(id=salaire.id)
        self.assertEqual(salaire_rafraichi.mouvement, mouvement_id_1)

    def test_payer_salaire_administration_solde_insuffisant(self):
        """Test que le paiement échoue lorsque le solde est insuffisant"""
        # Créer un compte avec solde insuffisant
        compte_peu_fond = Compte.objects.create(
            code='PEUFONDADM',
            libelle='Compte Administration Peu de Fonds',
            type=Compte.Type.BANQUE,
            solde_initial=100000,  # Seulement 100,000 FCFA
            actif=True,
            cree_par=self.user
        )

        # Créer un salaire administratif
        salaire = SalaireAdministration.objects.create(
            personnel_administratif=self.personnel,
            annee_scolaire=self.annee_scolaire,
            mois='SEPT',
            date_paiement=datetime.date(2025, 9, 25),
            montant_du=400000,  # 400,000 FCFA (plus que le solde disponible)
            montant_paye=0,
            compte=self.compte,  # Note: on utilise quand même le bon compte pour le champ compte du salaire
            statut='BROUILLON',
            mouvement=0,  # Temporarily set to 0, will be updated after payment
            cree_par=self.user
        )

        # Valider le salaire
        salaire.statut = 'VALIDÉ'
        salaire.save()

        # Tenter de payer avec un compte ayant des fonds insuffisants
        with self.assertRaises(Exception) as context:
            SalaireAdministrationService.payer_salaire_administration(
                salaire_id=salaire.id,
                compte_debiteur_id=compte_peu_fond.id,  # Compte avec peu de fonds
                montant=salaire.montant_du,
                categorie_mouvement_id=self.categorie_salaire.id,
                libelle="Test paiement solde insuffisant",
                ecole_id=self.ecole.id,
                annee_scolaire_id=self.annee_scolaire.id,
                cree_par_id=self.user.id
            )

        # Vérifier que l'erreur concerne le solde insuffisant
        self.assertIn('solde', str(context.exception).lower())
        self.assertIn('insuffisant', str(context.exception).lower())
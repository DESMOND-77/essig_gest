# backend/rh_paie/tests/test_salaire_enseignant_service.py
from django.test import TestCase
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from rh_paie.services import SalaireEnseignantService
from rh_paie.models import SalaireEnseignant, Enseignant
from tresorerie.models import Compte, CategorieMouvement, Mouvement
from referentiel.models import AnneeScolaire, Ecole
import datetime

User = get_user_model()


class SalaireEnseignantServiceTest(TestCase):
    """Test cases for SalaireEnseignantService"""

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

        # Créer un enseignant de test
        self.enseignant = Enseignant.objects.create(
            nom='DUPONT',
            prenom='Marie',
            email='marie.dupont@example.com'
        )

        # Créer un compte de test pour le paiement
        self.compte = Compte.objects.create(
            code='PAYE001',
            libelle='Compte de Paiement Test',
            type=Compte.Type.BANQUE,
            solde_initial=1000000,  # 1,000,000 FCFA
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

    def test_payer_salaire_enseignant_success(self):
        """Test du paiement réussi d'un salaire enseignant"""
        # Créer un salaire enseignant en brouillon
        salaire = SalaireEnseignant.objects.create(
            enseignant=self.enseignant,
            annee_scolaire=self.annee_scolaire,
            mois='SEPT',
            date_paiement=datetime.date(2025, 9, 25),
            montant=300000,  # 300,000 FCFA
            compte=self.compte,
            statut='BROUILLON',
            mouvement=0,  # Temporarily set to 0, will be updated after payment
            cree_par=self.user
        )

        # Valider le salaire d'abord (nécessaire avant paiement)
        salaire.statut = 'VALIDÉ'
        salaire.save()

        # Effectuer le paiement
        result = SalaireEnseignantService.payer_salaire_enseignant(
            salaire_id=salaire.id,
            compte_debiteur_id=self.compte.id,
            montant=salaire.montant,
            categorie_mouvement_id=self.categorie_salaire.id,
            libelle=f"Paiement salaire {self.enseignant.nom} {self.enseignant.prenom} - {salaire.get_mois_display()} {salaire.annee_scolaire}",
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
        self.assertEqual(mouvement.montant, salaire.montant)
        self.assertEqual(mouvement.sens, Mouvement.Sens.DEBIT)
        self.assertEqual(mouvement.compte, self.compte)
        self.assertEqual(mouvement.categorie_mouvement, self.categorie_salaire)

        # Vérifier que le salaire a été mis à jour
        salaire_rafraichi = SalaireEnseignant.objects.get(id=salaire.id)
        self.assertEqual(salaire_rafraichi.statut, 'PAYÉ')
        self.assertEqual(salaire_rafraichi.mouvement, mouvement.id)

    def test_payer_salaire_enseignant_non_valide(self):
        """Test que le paiement échoue pour un salaire non validé"""
        # Créer un salaire enseignant en brouillon (non validé)
        salaire = SalaireEnseignant.objects.create(
            enseignant=self.enseignant,
            annee_scolaire=self.annee_scolaire,
            mois='SEPT',
            date_paiement=datetime.date(2025, 9, 25),
            montant=300000,
            compte=self.compte,
            statut='BROUILLON',  # Toujours en brouillon
            mouvement=0,  # Temporarily set to 0, will be updated after payment
            cree_par=self.user
        )

        # Tenter de payer le salaire sans validation préalable
        with self.assertRaises(Exception) as context:
            SalaireEnseignantService.payer_salaire_enseignant(
                salaire_id=salaire.id,
                compte_debiteur_id=self.compte.id,
                montant=salaire.montant,
                categorie_mouvement_id=self.categorie_salaire.id,
                libelle="Test paiement salaire non validé",
                ecole_id=self.ecole.id,
                annee_scolaire_id=self.annee_scolaire.id,
                cree_par_id=self.user.id
            )

        # Vérifier que l'erreur concerne le statut du salaire
        self.assertIn('statut', str(context.exception).lower())
        self.assertIn('validé', str(context.exception).lower())

    def test_payer_salaire_enseignant_deja_paye(self):
        """Test que le paiement échoue pour un salaire déjà payé (idempotence)"""
        # Créer un salaire enseignant
        salaire = SalaireEnseignant.objects.create(
            enseignant=self.enseignant,
            annee_scolaire=self.annee_scolaire,
            mois='SEPT',
            date_paiement=datetime.date(2025, 9, 25),
            montant=300000,
            compte=self.compte,
            statut='BROUILLON',
            cree_par=self.user
        )

        # Valider le salaire
        salaire.statut = 'VALIDÉ'
        salaire.save()

        # Effectuer le premier paiement
        result1 = SalaireEnseignantService.payer_salaire_enseignant(
            salaire_id=salaire.id,
            compte_debiteur_id=self.compte.id,
            montant=salaire.montant,
            categorie_mouvement_id=self.categorie_salaire.id,
            libelle="Premier paiement",
            ecole_id=self.ecole.id,
            annee_scolaire_id=self.annee_scolaire.id,
            cree_par_id=self.user.id
        )

        # Vérifier que le premier paiement a réussi
        self.assertIsNotNone(result1)
        mouvement_id_1 = result1['mouvement'].id

        # Tenter un deuxième paiement pour le même salaire
        result2 = SalaireEnseignantService.payer_salaire_enseignant(
            salaire_id=salaire.id,
            compte_debiteur_id=self.compte.id,
            montant=salaire.montant,
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
        salaire_rafraichi = SalaireEnseignant.objects.get(id=salaire.id)
        self.assertEqual(salaire_rafraichi.mouvement, mouvement_id_1)

    def test_payer_salaire_enseignant_solde_insuffisant(self):
        """Test que le paiement échoue lorsque le solde est insuffisant"""
        # Créer un compte avec solde insuffisant
        compte_peu_fond = Compte.objects.create(
            code='PEUFOND',
            libelle='Compte Peu de Fonds',
            type=Compte.Type.BANQUE,
            solde_initial=50000,  # Seulement 50,000 FCFA
            actif=True,
            cree_par=self.user
        )

        # Créer un salaire enseignant
        salaire = SalaireEnseignant.objects.create(
            enseignant=self.enseignant,
            annee_scolaire=self.annee_scolaire,
            mois='SEPT',
            date_paiement=datetime.date(2025, 9, 25),
            montant=300000,  # 300,000 FCFA (plus que le solde disponible)
            compte=self.compte,  # Note: on utilise quand même le bon compte pour le champ compte du salaire
            statut='BROUILLON',
            cree_par=self.user
        )

        # Valider le salaire
        salaire.statut = 'VALIDÉ'
        salaire.save()

        # Tenter de payer avec un compte ayant des fonds insuffisants
        with self.assertRaises(Exception) as context:
            SalaireEnseignantService.payer_salaire_enseignant(
                salaire_id=salaire.id,
                compte_debiteur_id=compte_peu_fond.id,  # Compte avec peu de fonds
                montant=salaire.montant,
                categorie_mouvement_id=self.categorie_salaire.id,
                libelle="Test paiement solde insuffisant",
                ecole_id=self.ecole.id,
                annee_scolaire_id=self.annee_scolaire.id,
                cree_par_id=self.user.id
            )

        # Vérifier que l'erreur concerne le solde insuffisant
        self.assertIn('solde', str(context.exception).lower())
        self.assertIn('insuffisant', str(context.exception).lower())
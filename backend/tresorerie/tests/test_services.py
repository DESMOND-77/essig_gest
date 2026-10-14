# backend/tresorerie/tests/test_services.py
from django.test import TestCase
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from tresorerie.services import compte_service, categorie_mouvement_service, mouvement_service
from tresorerie.services import virement_service, encaissement_service, imputation_encaissement_service
from tresorerie.services import depense_service, arrete_caisse_service, dashboard_service
from tresorerie.models import (
    Compte, CategorieMouvement, Virement, Mouvement, Encaissement,
    ImputationEncaissement, Depense, ArreteCaisse, Billetage
)
from personnes.models import Inscription, Etudiant
from scolarite.models import Echeance, FraisInscription
from referentiel.models import Ecole, AnneeScolaire, Niveau

User = get_user_model()


class TresorerieServicesTestCase(TestCase):
    """Test cases for trésorerie services"""

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
            date_fin='2026-08-31',
            est_courante=True
        )

        # Créer un niveau de test
        self.niveau = Niveau.objects.create(
            code='6EME',
            libelle='6ème',
            ordre=1,
            ecole=self.ecole
        )

        # Créer une filière de test
        from referentiel.models import Filiere
        self.filiere = Filiere.objects.create(
            nom='Générale',
            sigle='GEN',
            ecole=self.ecole
        )

        # Créer une option de filière de test
        from referentiel.models import OptionFiliere
        self.option_filiere = OptionFiliere.objects.create(
            filiere=self.filiere,
            nom='Option Générale',
            sigle='OPTGEN'
        )

        # Créer une modalité de formation de test
        from referentiel.models import ModaliteFormation
        self.modalite_formation = ModaliteFormation.objects.create(
            code='FI',
            libelle='Formation initiale'
        )

        # Créer une classe de test
        from referentiel.models import Classe
        self.classe = Classe.objects.create(
            annee_scolaire=self.annee_scolaire,
            niveau=self.niveau,
            option_filiere=self.option_filiere,
            modalite_formation=self.modalite_formation,
            libelle_auto='6EME GEN 1'
        )

        # Créer un étudiant de test
        self.etudiant = Etudiant.objects.create(
            matricule='TEST001',
            nom='DOE',
            prenoms='John',
            sexe='M',
            date_naissance='2010-01-01'
        )

        # Créer un enseignant de test
        from rh_paie.models import Enseignant
        self.enseignant = Enseignant.objects.create(
            nom='DUPONT',
            prenom='Marie',
            email='marie.dupont@example.com'
        )

        # Date de paiement de test
        from datetime import date
        self.date_paiement = date(2025, 9, 25)

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

        # Créer un personnel administratif de test
        from rh_paie.models import PersonnelAdministratif
        self.personnel = PersonnelAdministratif.objects.create(
            nom='DURAND',
            prenom='Jean',
            poste='Comptable',
            ecole=self.ecole,
            email='jean.durand@example.com',
            salaire_base=400000,
            actif=True
        )

        # Créer une inscription de test
        self.inscription = Inscription.objects.create(
            etudiant=self.etudiant,
            classe=self.classe,
            ecole=self.ecole,
            annee_scolaire=self.annee_scolaire,
            numero_ordre=1,
            type='INSCRIPTION',
            statut='ANCIEN',
            etat='ACTIVE',
            date_inscription='2025-09-01'
        )

        # Créer une échéance de test
        self.echeance = Echeance.objects.create(
            inscription=self.inscription,
            numero=1,
            montant=100000,
            date_echeance='2025-10-31'
        )

        # Créer un frais d'inscription de test
        self.frais_inscription = FraisInscription.objects.create(
            niveau=self.niveau,
            annee_scolaire=self.annee_scolaire,
            montant=50000
        )

    def test_compte_service_creer_solde(self):
        """Test du service de calcul de solde de compte"""
        compte = Compte.objects.create(
            code='SOLDE001',
            libelle='Compte Solde Test',
            type=Compte.Type.BANQUE,
            solde_initial=100000,
            actif=True,
            cree_par=self.user
        )

        # Créer une catégorie de mouvement pour les tests
        categorie_entree = CategorieMouvement.objects.create(
            code='SOLDE_ENT',
            libelle='Solde Entrée',
            sens=CategorieMouvement.Sens.ENTREE,
            cree_par=self.user
        )

        categorie_sortie = CategorieMouvement.objects.create(
            code='SOLDE_SORT',
            libelle='Solde Sortie',
            sens=CategorieMouvement.Sens.SORTIE,
            cree_par=self.user
        )

        # Créer quelques mouvements
        Mouvement.objects.create(
            compte=compte,
            date_operation='2025-09-10',
            sens=Mouvement.Sens.CREDIT,
            montant=50000,
            categorie_mouvement=categorie_entree,
            libelle='Crédit test',
            annee_scolaire=self.annee_scolaire,
            cree_par=self.user
        )

        Mouvement.objects.create(
            compte=compte,
            date_operation='2025-09-15',
            sens=Mouvement.Sens.DEBIT,
            montant=20000,
            categorie_mouvement=categorie_sortie,
            libelle='Débit test',
            annee_scolaire=self.annee_scolaire,
            cree_par=self.user
        )

        # Calculer le solde
        solde = compte_service.calculer_solde_compte(compte.id)
        solde_attendu = 100000 + 50000 - 20000  # solde_initial + crédits - débits

        self.assertEqual(solde, solde_attendu)
        self.assertEqual(solde, 130000)

    def test_categorie_mouvement_service(self):
        """Test du service de catégorie de mouvement"""
        categorie = categorie_mouvement_service.creer_categorie_mouvement(
            code='TESTCAT',
            libelle='Test Catégorie',
            sens=CategorieMouvement.Sens.ENTREE,
            cree_par_id=self.user.id
        )

        self.assertEqual(categorie.code, 'TESTCAT')
        self.assertEqual(categorie.libelle, 'Test Catégorie')
        self.assertEqual(categorie.sens, CategorieMouvement.Sens.ENTREE)

        # Test de mise à jour
        categorie_mise_a_jour = categorie_mouvement_service.mettre_a_jour_categorie_mouvement(
            categorie_id=categorie.id,
            libelle='Test Catégorie Modifiée'
        )

        self.assertEqual(categorie_mise_a_jour.libelle, 'Test Catégorie Modifiée')

    def test_virement_service_executer_virement(self):
        """Test du service d'exécution de virement"""
        # Créer deux comptes avec suffisamment de fonds
        compte_source = Compte.objects.create(
            code='VIR_SOURCE',
            libelle='Compte Source Virement',
            type=Compte.Type.BANQUE,
            solde_initial=500000,
            actif=True,
            cree_par=self.user
        )

        compte_destination = Compte.objects.create(
            code='VIR_DEST',
            libelle='Compte Destination Virement',
            type=Compte.Type.BANQUE,
            solde_initial=300000,
            actif=True,
            cree_par=self.user
        )

        # Créer une catégorie de sortie pour le virement
        categorie_sortie = CategorieMouvement.objects.create(
            code='VIR_SORT',
            libelle='Virement Sortie',
            sens=CategorieMouvement.Sens.SORTIE,
            cree_par=self.user
        )

        # Créer une catégorie d'entrée pour le virement
        categorie_entree = CategorieMouvement.objects.create(
            code='VIR_ENT',
            libelle='Virement Entrée',
            sens=CategorieMouvement.Sens.ENTREE,
            cree_par=self.user
        )

        # Exécuter le virement
        virement = virement_service.executer_virement(
            compte_source_id=compte_source.id,
            compte_destination_id=compte_destination.id,
            montant=100000,
            motif='Virement de test service',
            cree_par_id=self.user.id
        )

        self.assertIsNotNone(virement)
        self.assertEqual(virement.montant, 100000)
        self.assertEqual(virement.compte_source, compte_source)
        self.assertEqual(virement.compte_destination, compte_destination)
        self.assertEqual(virement.statut, Virement.Statut.VALIDE)

        # Vérifier que les mouvements ont été créés
        mouvements = Mouvement.objects.filter(virement=virement)
        self.assertEqual(mouvements.count(), 2)

        # Vérifier les soldes des comptes après virement
        solde_source = compte_service.calculer_solde_compte(compte_source.id)
        solde_destination = compte_service.calculer_solde_compte(compte_destination.id)

        # Source: 500000 - 100000 = 400000
        # Destination: 300000 + 100000 = 400000
        self.assertEqual(solde_source, 400000)
        self.assertEqual(solde_destination, 400000)

    def test_encaissement_service_creer_encaissement(self):
        """Test du service de création d'encaissement"""
        compte = Compte.objects.create(
            code='ENC_SERV',
            libelle='Compte Encaissement Service',
            type=Compte.Type.BANQUE,
            solde_initial=1000000,
            actif=True,
            cree_par=self.user
        )

        encaissement = encaissement_service.creer_encaissement(
            inscription_id=self.inscription.id,
            montant_total=75000,
            mode=Encaissement.Mode.ESPECES,
            compte_id=compte.id,
            cree_par_id=self.user.id
        )

        self.assertIsNotNone(encaissement)
        self.assertEqual(encaissement.montant_total, 75000)
        self.assertEqual(encaissement.mode, Encaissement.Mode.ESPECES)
        self.assertEqual(encaissement.compte, compte)
        self.assertEqual(encaissement.recu_numero[:3], 'ETB')  # Format ETB-YYYY-NNNNN
        self.assertEqual(encaissement.statut, Encaissement.Statut.EN_COURS)

        # Vérifier que le mouvement associé a été créé
        self.assertIsNotNone(encaissement.mouvement)
        self.assertEqual(encaissement.mouvement.sens, Mouvement.Sens.CREDIT)
        self.assertEqual(encaissement.mouvement.montant, 75000)
        self.assertEqual(encaissement.mouvement.compte, compte)

    def test_depense_service_creer_depense(self):
        """Test du service de création de dépense"""
        compte = Compte.objects.create(
            code='DEP_SERV',
            libelle='Compte Dépense Service',
            type=Compte.Type.BANQUE,
            solde_initial=1000000,
            actif=True,
            cree_par=self.user
        )

        categorie_sortie = CategorieMouvement.objects.create(
            code='DEP_SERV_SORT',
            libelle='Dépense Service Sortie',
            sens=CategorieMouvement.Sens.SORTIE,
            cree_par=self.user
        )

        depense = depense_service.creer_depense(
            date='2025-09-15',
            categorie_mouvement_id=categorie_sortie.id,
            beneficiaire='Fournisseur Service Test',
            designation='Test de création de dépense via service',
            montant=60000,
            compte_id=compte.id,
            ecole_id=self.ecole.id,
            annee_scolaire_id=self.annee_scolaire.id,
            cree_par_id=self.user.id
        )

        self.assertIsNotNone(depense)
        self.assertEqual(depense.montant, 60000)
        self.assertEqual(depense.beneficiaire, 'Fournisseur Service Test')
        self.assertEqual(depense.designation, 'Test de création de dépense via service')
        self.assertEqual(depense.compte, compte)
        self.assertEqual(depense.statut, Depense.Statut.ENGAGEE)

        # Vérifier que le mouvement associé a été créé
        self.assertIsNotNone(depense.mouvement)
        self.assertEqual(depense.mouvement.sens, Mouvement.Sens.DEBIT)
        self.assertEqual(depense.mouvement.montant, 60000)
        self.assertEqual(depense.mouvement.compte, compte)

    def test_arrete_caisse_service_creer_arrete(self):
        """Test du service de création d'arrêté de caisse"""
        compte_caisse = Compte.objects.create(
            code='ARC_SERV',
            libelle='Compte Arrêté Service',
            type=Compte.Type.CAISSE,
            solde_initial=100000,
            actif=True,
            cree_par=self.user
        )

        # Créer quelques mouvements pour avoir un solde théorique
        categorie_entree = CategorieMouvement.objects.create(
            code='ARC_ENT',
            libelle='Arrêté Entrée',
            sens=CategorieMouvement.Sens.ENTREE,
            cree_par=self.user
        )

        Mouvement.objects.create(
            compte=compte_caisse,
            date_operation='2025-09-01',
            sens=Mouvement.Sens.CREDIT,
            montant=50000,
            categorie_mouvement=categorie_entree,
            libelle='Solde initial service',
            annee_scolaire=self.annee_scolaire,
            cree_par=self.user
        )

        arrete_caisse = arrete_caisse_service.creer_arrete_caisse(
            compte_id=compte_caisse.id,
            date='2025-09-30',
            solde_physique=48000,
            fait_par_id=self.user.id,
            cree_par_id=self.user.id
        )

        self.assertIsNotNone(arrete_caisse)
        self.assertEqual(arrete_caisse.compte, compte_caisse)
        self.assertEqual(arrete_caisse.date, '2025-09-30')
        self.assertEqual(arrete_caisse.solde_physique, 48000)
        # Le solde théorique devrait être calculé comme: 100000 (initial) + 50000 (crédit) = 150000
        self.assertEqual(arrete_caisse.solde_theorique, 150000)
        self.assertEqual(arrete_caisse.ecart, -102000)  # 48000 - 150000
        self.assertEqual(arrete_caisse.statut, ArreteCaisse.Statut.EN_COURS)

    def test_dashboard_service_get_solde_par_type(self):
        """Test du service de dashboard pour obtenir les soldes par type de compte"""
        # Créer quelques comptes de différents types
        compte_banque = Compte.objects.create(
            code='DASH_BANQ',
            libelle='Compte Banque Dashboard',
            type=Compte.Type.BANQUE,
            solde_initial=500000,
            actif=True,
            cree_par=self.user
        )

        compte_caisse = Compte.objects.create(
            code='DASH_CAIS',
            libelle='Compte Caisse Dashboard',
            type=Compte.Type.CAISSE,
            solde_initial=100000,
            actif=True,
            cree_par=self.user
        )

        # Créer un mouvement pour avoir un solde non nul
        categorie_entree = CategorieMouvement.objects.create(
            code='DASH_ENT',
            libelle='Dashboard Entrée',
            sens=CategorieMouvement.Sens.ENTREE,
            cree_par=self.user
        )

        Mouvement.objects.create(
            compte=compte_banque,
            date_operation='2025-09-15',
            sens=Mouvement.Sens.CREDIT,
            montant=100000,
            categorie_mouvement=categorie_entree,
            libelle='Crédit dashboard',
            annee_scolaire=self.annee_scolaire,
            cree_par=self.user
        )

        # Tester le service de dashboard
        soldes_par_type = dashboard_service.get_solde_par_type_de_compte()

        # Vérifier que nous avons des entrées pour les types de compte
        self.assertIn('Banque', soldes_par_type)
        self.assertIn('Caisse', soldes_par_type)

        # Vérifier les valeurs (approximatives car il peut y avoir d'autres comptes)
        solde_banque = soldes_par_type['Banque']
        solde_caisse = soldes_par_type['Caisse']

        # Banque devrait avoir environ 600000 (500000 initial + 100000 crédit)
        # Caisse devrait avoir environ 100000 (seulement le solde initial)
        self.assertGreaterEqual(solde_banque, 500000)
        self.assertGreaterEqual(solde_caisse, 100000)

    def test_effectuer_paiement_salaire_administration_valide(self):
        """Test 1: Paiement réussi d'un salaire administratif validé"""
        # Créer un salaire administratif en brouillon
        from rh_paie.models import SalaireAdministration, PersonnelAdministratif
        salaire = SalaireAdministration.objects.create(
            personnel_administratif=self.personnel,
            annee_scolaire=self.annee_scolaire,
            mois='SEPT',
            date_paiement=self.date_paiement,
            montant_du=400000,  # 400,000 FCFA
            montant_paye=0,     # Rien payé encore
            compte=self.compte,
            statut='BROUILLON',
            cree_par=self.user
        )

        # Valider le salaire d'abord (nécessaire avant paiement)
        salaire.statut = 'VALIDÉ'
        salaire.save()

        # Effectuer le paiement via le service de trésorerie
        from tresorerie.services import tresorerie_service
        result = tresorerie_service.effectuer_paiement_salaire(
            compte_debiteur_id=self.compte.id,
            salaire_id=salaire.id,
            type_salaire='administration',
            montant=400000,  # Montant complet
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
        self.assertEqual(mouvement.montant, 400000)
        self.assertEqual(mouvement.sens, Mouvement.Sens.DEBIT)
        self.assertEqual(mouvement.compte, self.compte)
        self.assertEqual(mouvement.categorie_mouvement, self.categorie_salaire)
        self.assertEqual(mouvement.ecole_id, self.ecole.id)
        self.assertEqual(mouvement.annee_scolaire_id, self.annee_scolaire.id)

        # Vérifier que le salaire a été mis à jour
        salaire_rafraichi = SalaireAdministration.objects.get(id=salaire.id)
        self.assertEqual(salaire_rafraichi.statut, 'PAYÉ')
        self.assertEqual(salaire_rafraichi.mouvement, mouvement.id)
        self.assertEqual(salaire_rafraichi.montant_paye, 400000)  # Maintenant entièrement payé

        # Vérifier le message de retour
        self.assertIn("effectué avec succès", result['message'])

    def test_effectuer_paiement_salaire_enseignant_valide(self):
        """Test: Paiement réussi d'un salaire enseignant validé"""
        # Créer un salaire enseignant en brouillon (sans affectation obligatoire)
        from rh_paie.models import SalaireEnseignant
        salaire = SalaireEnseignant.objects.create(
            enseignant=self.enseignant,
            annee_scolaire=self.annee_scolaire,
            mois='SEPT',
            date_paiement=self.date_paiement,
            montant=360000,  # 360,000 FCFA
            compte=self.compte,
            statut='BROUILLON',
            cree_par=self.user
        )

        # Valider le salaire d'abord (nécessaire avant paiement)
        salaire.statut = 'VALIDÉ'
        salaire.save()

        # Effectuer le paiement via le service de trésorerie
        from tresorerie.services import tresorerie_service
        result = tresorerie_service.effectuer_paiement_salaire(
            compte_debiteur_id=self.compte.id,
            salaire_id=salaire.id,
            type_salaire='enseignant',
            montant=360000,  # Montant complet
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
        self.assertEqual(mouvement.montant, 360000)
        self.assertEqual(mouvement.sens, Mouvement.Sens.DEBIT)
        self.assertEqual(mouvement.compte, self.compte)
        self.assertEqual(mouvement.categorie_mouvement, self.categorie_salaire)

        # Vérifier que le salaire a été mis à jour
        salaire_rafraichi = SalaireEnseignant.objects.get(id=salaire.id)
        self.assertEqual(salaire_rafraichi.statut, 'PAYÉ')
        self.assertEqual(salaire_rafraichi.mouvement, mouvement.id)

        # Vérifier le message de retour
        self.assertIn("effectué avec succès", result['message'])

    def test_effectuer_paiement_salaire_non_valide_refuse(self):
        """Test 2: Refus de paiement pour salaire non validé"""
        # Créer un salaire administratif en brouillon (non validé)
        from rh_paie.models import SalaireAdministration
        salaire = SalaireAdministration.objects.create(
            personnel_administratif=self.personnel,
            annee_scolaire=self.annee_scolaire,
            mois='SEPT',
            date_paiement=self.date_paiement,
            montant_du=400000,
            montant_paye=0,
            compte=self.compte,
            statut='BROUILLON',  # Toujours en brouillon
            cree_par=self.user
        )

        # Tenter de payer le salaire sans validation préalable
        from tresorerie.services import tresorerie_service
        from django.core.exceptions import ValidationError
        with self.assertRaises(ValidationError) as context:
            tresorerie_service.effectuer_paiement_salaire(
                compte_debiteur_id=self.compte.id,
                salaire_id=salaire.id,
                type_salaire='administration',
                montant=400000,
                categorie_mouvement_id=self.categorie_salaire.id,
                libelle="Test paiement salaire non validé",
                ecole_id=self.ecole.id,
                annee_scolaire_id=self.annee_scolaire.id,
                cree_par_id=self.user.id
            )

        # Vérifier que l'erreur concerne le statut du salaire
        error_message = str(context.exception)
        self.assertIn("validé", error_message.lower())
        self.assertIn("statut", error_message.lower())

    def test_effectuer_paiement_salaire_montant_nul_negatif_refuse(self):
        """Test 3: Refus pour montant nul ou négatif"""
        # Créer et valider un salaire administratif
        from rh_paie.models import SalaireAdministration
        salaire = SalaireAdministration.objects.create(
            personnel_administratif=self.personnel,
            annee_scolaire=self.annee_scolaire,
            mois='SEPT',
            date_paiement=self.date_paiement,
            montant_du=400000,
            montant_paye=0,
            compte=self.compte,
            statut='VALIDÉ',  # Déjà validé
            cree_par=self.user
        )

        from tresorerie.services import tresorerie_service
        from django.core.exceptions import ValidationError

        # Test avec montant nul
        with self.assertRaises(ValidationError) as context:
            tresorerie_service.effectuer_paiement_salaire(
                compte_debiteur_id=self.compte.id,
                salaire_id=salaire.id,
                type_salaire='administration',
                montant=0,  # Montant nul
                categorie_mouvement_id=self.categorie_salaire.id,
                libelle="Test paiement montant nul",
                ecole_id=self.ecole.id,
                annee_scolaire_id=self.annee_scolaire.id,
                cree_par_id=self.user.id
            )
        self.assertIn("strictement positif", str(context.exception))

        # Test avec montant négatif
        with self.assertRaises(ValidationError) as context:
            tresorerie_service.effectuer_paiement_salaire(
                compte_debiteur_id=self.compte.id,
                salaire_id=salaire.id,
                type_salaire='administration',
                montant=-10000,  # Montant négatif
                categorie_mouvement_id=self.categorie_salaire.id,
                libelle="Test paiement montant négatif",
                ecole_id=self.ecole.id,
                annee_scolaire_id=self.annee_scolaire.id,
                cree_par_id=self.user.id
            )
        self.assertIn("strictement positif", str(context.exception))

    def test_effectuer_paiement_salaire_montant_incompatible_refuse(self):
        """Test 3 (suite): Refus pour montant incompatible avec le salaire"""
        # Créer et valider un salaire administratif avec paiement partiel
        from rh_paie.models import SalaireAdministration
        salaire = SalaireAdministration.objects.create(
            personnel_administratif=self.personnel,
            annee_scolaire=self.annee_scolaire,
            mois='SEPT',
            date_paiement=self.date_paiement,
            montant_du=400000,  # Total dû
            montant_paye=100000,  # Déjà payé: 100,000 FCFA
            compte=self.compte,
            statut='VALIDÉ',  # Déjà validé
            cree_par=self.user
        )

        from tresorerie.services import tresorerie_service
        from django.core.exceptions import ValidationError

        # Test avec montant inférieur au restant à payer
        with self.assertRaises(ValidationError) as context:
            tresorerie_service.effectuer_paiement_salaire(
                compte_debiteur_id=self.compte.id,
                salaire_id=salaire.id,
                type_salaire='administration',
                montant=200000,  # Moins que les 300,000 restant à payer
                categorie_mouvement_id=self.categorie_salaire.id,
                libelle="Test paiement montant insuffisant",
                ecole_id=self.ecole.id,
                annee_scolaire_id=self.annee_scolaire.id,
                cree_par_id=self.user.id
            )
        self.assertIn("doit correspondre au montant restant à payer", str(context.exception))

        # Test avec montant supérieur au restant à payer
        with self.assertRaises(ValidationError) as context:
            tresorerie_service.effectuer_paiement_salaire(
                compte_debiteur_id=self.compte.id,
                salaire_id=salaire.id,
                type_salaire='administration',
                montant=400000,  # Plus que les 300,000 restant à payer
                categorie_mouvement_id=self.categorie_salaire.id,
                libelle="Test paiement montant excessif",
                ecole_id=self.ecole.id,
                annee_scolaire_id=self.annee_scolaire.id,
                cree_par_id=self.user.id
            )
        self.assertIn("doit correspondre au montant restant à payer", str(context.exception))

        # Test pour salaire enseignant avec montant incompatible
        from rh_paie.models import Enseignant, SalaireEnseignant
        from referentiel.models import Matiere as RefMatiere

        # Créer un salaire enseignant en brouillon (sans affectation obligatoire)
        salaire_enseignant = SalaireEnseignant.objects.create(
            enseignant=self.enseignant,
            annee_scolaire=self.annee_scolaire,
            mois='SEPT',
            date_paiement=self.date_paiement,
            montant=300000,  # Montant fixe pour enseignant
            compte=self.compte,
            statut='BROUILLON',
            cree_par=self.user
        )

        # Valider le salaire d'abord
        salaire_enseignant.statut = 'VALIDÉ'
        salaire_enseignant.save()

        # Test avec montant différent du salaire enseignant
        with self.assertRaises(ValidationError) as context:
            tresorerie_service.effectuer_paiement_salaire(
                compte_debiteur_id=self.compte.id,
                salaire_id=salaire_enseignant.id,
                type_salaire='enseignant',
                montant=250000,  # Différent des 300,000 prévus
                categorie_mouvement_id=self.categorie_salaire.id,
                libelle="Test paiement montant incompatible enseignant",
                ecole_id=self.ecole.id,
                annee_scolaire_id=self.annee_scolaire.id,
                cree_par_id=self.user.id
            )
        self.assertIn("doit correspondre au montant du salaire", str(context.exception))

    def test_effectuer_paiement_salaire_compte_invalide_refuse(self):
        """Test 4: Refus pour compte invalide ou inexistant"""
        # Créer et valider un salaire administratif
        from rh_paie.models import SalaireAdministration
        salaire = SalaireAdministration.objects.create(
            personnel_administratif=self.personnel,
            annee_scolaire=self.annee_scolaire,
            mois='SEPT',
            date_paiement=self.date_paiement,
            montant_du=400000,
            montant_paye=0,
            compte=self.compte,
            statut='VALIDÉ',
            cree_par=self.user
        )

        from tresorerie.services import tresorerie_service
        from django.core.exceptions import ValidationError

        # Test avec compte inexistant
        with self.assertRaises(ValidationError) as context:
            tresorerie_service.effectuer_paiement_salaire(
                compte_debiteur_id=99999,  # ID inexistant
                salaire_id=salaire.id,
                type_salaire='administration',
                montant=400000,
                categorie_mouvement_id=self.categorie_salaire.id,
                libelle="Test paiement compte inexistant",
                ecole_id=self.ecole.id,
                annee_scolaire_id=self.annee_scolaire.id,
                cree_par_id=self.user.id
            )
        self.assertIn("introuvable", str(context.exception))

    def test_effectuer_paiement_salaire_double_paiement_refuse(self):
        """Test 5: Refus pour double paiement (idempotence)"""
        # Créer et valider un salaire administratif
        from rh_paie.models import SalaireAdministration
        salaire = SalaireAdministration.objects.create(
            personnel_administratif=self.personnel,
            annee_scolaire=self.annee_scolaire,
            mois='SEPT',
            date_paiement=self.date_paiement,
            montant_du=400000,
            montant_paye=0,
            compte=self.compte,
            statut='VALIDÉ',
            cree_par=self.user
        )

        from tresorerie.services import tresorerie_service

        # Effectuer le premier paiement
        result1 = tresorerie_service.effectuer_paiement_salaire(
            compte_debiteur_id=self.compte.id,
            salaire_id=salaire.id,
            type_salaire='administration',
            montant=400000,
            categorie_mouvement_id=self.categorie_salaire.id,
            libelle="Premier paiement",
            ecole_id=self.ecole.id,
            annee_scolaire_id=self.annee_scolaire.id,
            cree_par_id=self.user.id
        )

        # Vérifier que le premier paiement a réussi
        self.assertIsNotNone(result1)
        mouvement_id_1 = result1['mouvement'].id

        # Tenter un deuxième paiement pour le même salaire (devrait retourner le même mouvement grâce à l'idempotence)
        result2 = tresorerie_service.effectuer_paiement_salaire(
            compte_debiteur_id=self.compte.id,
            salaire_id=salaire.id,
            type_salaire='administration',
            montant=400000,
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

        # Vérifier le message d'idempotence
        self.assertIn("idempotence", result2['message'].lower())

    def test_effectuer_paiement_salaire_verification_lien_mouvement(self):
        """Test 6: Vérification du lien entre salaire et mouvement de trésorerie"""
        # Créer et valider un salaire administratif
        from rh_paie.models import SalaireAdministration
        salaire = SalaireAdministration.objects.create(
            personnel_administratif=self.personnel,
            annee_scolaire=self.annee_scolaire,
            mois='SEPT',
            date_paiement=self.date_paiement,
            montant_du=400000,
            montant_paye=0,
            compte=self.compte,
            statut='VALIDÉ',
            cree_par=self.user
        )

        from tresorerie.services import tresorerie_service

        # Effectuer le paiement
        result = tresorerie_service.effectuer_paiement_salaire(
            compte_debiteur_id=self.compte.id,
            salaire_id=salaire.id,
            type_salaire='administration',
            montant=400000,
            categorie_mouvement_id=self.categorie_salaire.id,
            libelle="Test lien salaire-mouvement",
            ecole_id=self.ecole.id,
            annee_scolaire_id=self.annee_scolaire.id,
            cree_par_id=self.user.id
        )

        # Vérifier que le mouvement a été créé
        mouvement = result['mouvement']
        self.assertIsInstance(mouvement, Mouvement)

        # Vérifier que le salaire référence bien le mouvement
        salaire_rafraichi = SalaireAdministration.objects.get(id=salaire.id)
        self.assertEqual(salaire_rafraichi.mouvement, mouvement.id)

        # Vérifier que le mouvement référence bien le compte et la catégorie corrects
        self.assertEqual(mouvement.compte, self.compte)
        self.assertEqual(mouvement.categorie_mouvement, self.categorie_salaire)
        self.assertEqual(mouvement.montant, 400000)
        self.assertEqual(mouvement.sens, Mouvement.Sens.DEBIT)

        # Vérifier que les champs liés à la scolarité sont correctement propagés
        self.assertEqual(mouvement.ecole_id, self.ecole.id)
        self.assertEqual(mouvement.annee_scolaire_id, self.annee_scolaire.id)

    def test_effectuer_paiement_salaire_absence_mouvement_orphelin_echec(self):
        """Test 7: Absence de mouvement orphelin en cas d'échec"""
        from tresorerie.services import tresorerie_service
        from django.core.exceptions import ValidationError

        # Compter les mouvements avant les tests
        mouvement_count_initial = Mouvement.objects.count()

        # Test d'échec avec compte inexistant (devrait lever une exception sans créer de mouvement)
        try:
            tresorerie_service.effectuer_paiement_salaire(
                compte_debiteur_id=99999,  # ID inexistant
                salaire_id=99999,         # ID inexistant aussi pour être sûr
                type_salaire='administration',
                montant=400000,
                categorie_mouvement_id=self.categorie_salaire.id,
                libelle="Test échec compte inexistant",
                ecole_id=self.ecole.id,
                annee_scolaire_id=self.annee_scolaire.id,
                cree_par_id=self.user.id
            )
        except ValidationError:
            pass  # Exception attendue

        # Vérifier qu'aucun mouvement supplémentaire n'a été créé
        mouvement_count_apres_echec = Mouvement.objects.count()
        self.assertEqual(mouvement_count_initial, mouvement_count_apres_echec,
                         "Aucun mouvement orphelin ne devrait être créé en cas d'échec")

        # Test d'échec avec salaire non validé
        from rh_paie.models import SalaireAdministration
        salaire_brouillon = SalaireAdministration.objects.create(
            personnel_administratif=self.personnel,
            annee_scolaire=self.annee_scolaire,
            mois='SEPT',
            date_paiement=self.date_paiement,
            montant_du=400000,
            montant_paye=0,
            compte=self.compte,
            statut='BROUILLON',  # Non validé
            cree_par=self.user
        )

        # Compter les mouvements avant ce test
        mouvement_count_avant_test2 = Mouvement.objects.count()

        try:
            tresorerie_service.effectuer_paiement_salaire(
                compte_debiteur_id=self.compte.id,
                salaire_id=salaire_brouillon.id,
                type_salaire='administration',
                montant=400000,
                categorie_mouvement_id=self.categorie_salaire.id,
                libelle="Test échec salaire non validé",
                ecole_id=self.ecole.id,
                annee_scolaire_id=self.annee_scolaire.id,
                cree_par_id=self.user.id
            )
        except ValidationError:
            pass  # Exception attendue

        # Vérifier qu'aucun mouvement supplémentaire n'a été créé
        mouvement_count_apres_test2 = Mouvement.objects.count()
        self.assertEqual(mouvement_count_avant_test2, mouvement_count_apres_test2,
                         "Aucun mouvement orphelin ne devrait être créé en cas d'échec")

    def test_effectuer_paiement_salaire_comportement_requetes_repetition_concurrent(self):
        """Test 8: Comportement sous requêtes répétées/concurrentes"""
        from rh_paie.models import SalaireAdministration
        from tresorerie.services import tresorerie_service

        # Créer et valider un salaire administratif
        salaire = SalaireAdministration.objects.create(
            personnel_administratif=self.personnel,
            annee_scolaire=self.annee_scolaire,
            mois='SEPT',
            date_paiement=self.date_paiement,
            montant_du=400000,
            montant_paye=0,
            compte=self.compte,
            statut='VALIDÉ',
            cree_par=self.user
        )

        # Effectuer le premier paiement
        result1 = tresorerie_service.effectuer_paiement_salaire(
            compte_debiteur_id=self.compte.id,
            salaire_id=salaire.id,
            type_salaire='administration',
            montant=400000,
            categorie_mouvement_id=self.categorie_salaire.id,
            libelle="Paiement initial",
            ecole_id=self.ecole.id,
            annee_scolaire_id=self.annee_scolaire.id,
            cree_par_id=self.user.id
        )

        mouvement_id_1 = result1['mouvement'].id

        # Effectuer plusieurs paiements répétés (devraient tous retourner le même mouvement grâce à l'idempotence)
        for i in range(2, 6):  # 2ème à 5ème tentative
            result_i = tresorerie_service.effectuer_paiement_salaire(
                compte_debiteur_id=self.compte.id,
                salaire_id=salaire.id,
                type_salaire='administration',
                montant=400000,
                categorie_mouvement_id=self.categorie_salaire.id,
                libelle=f"Paiement répété #{i}",
                ecole_id=self.ecole.id,
                annee_scolaire_id=self.annee_scolaire.id,
                cree_par_id=self.user.id
            )

            # Chaque appel devrait retourner le même mouvement
            self.assertEqual(result_i['mouvement'].id, mouvement_id_1,
                             f"Le paiement répété #{i} devrait retourner le même mouvement")

        # Vérifier qu'il n'y a toujours qu'un seul mouvement associé au salaire
        salaire_rafraichi = SalaireAdministration.objects.get(id=salaire.id)
        self.assertEqual(salaire_rafraichi.mouvement, mouvement_id_1)

        # Vérifier qu'il n'y a qu'un seul mouvement au total pour ce salaire (pas de doublons)
        mouvements_associes = Mouvement.objects.filter(id=salaire_rafraichi.mouvement)
        self.assertEqual(mouvements_associes.count(), 1)

    def test_effectuer_paiement_salaire_verification_permissions_audit(self):
        """Test 9: Vérification des permissions et de l'audit"""
        from rh_paie.models import SalaireAdministration
        from tresorerie.services import tresorerie_service
        from django.contrib.auth import get_user_model

        User = get_user_model()

        # Créer un deuxième utilisateur pour tester les champs d'audit
        user2 = User.objects.create_user(
            login='audituser',
            password='auditpass123',
            email='audit@example.com'
        )

        # Créer et valider un salaire administratif
        salaire = SalaireAdministration.objects.create(
            personnel_administratif=self.personnel,
            annee_scolaire=self.annee_scolaire,
            mois='SEPT',
            date_paiement=self.date_paiement,
            montant_du=400000,
            montant_paye=0,
            compte=self.compte,
            statut='VALIDÉ',
            cree_par=self.user  # Créé par le premier utilisateur
        )

        # Effectuer le paiement avec le deuxième utilisateur
        result = tresorerie_service.effectuer_paiement_salaire(
            compte_debiteur_id=self.compte.id,
            salaire_id=salaire.id,
            type_salaire='administration',
            montant=400000,
            categorie_mouvement_id=self.categorie_salaire.id,
            libelle="Test audit et permissions",
            ecole_id=self.ecole.id,
            annee_scolaire_id=self.annee_scolaire.id,
            cree_par_id=user2.id  # Paiement effectué par le deuxième utilisateur
        )

        # Vérifier que le paiement a réussi
        self.assertIsNotNone(result)
        mouvement = result['mouvement']

        # Vérifier que le mouvement a été créé par le bon utilisateur (audit)
        self.assertEqual(mouvement.cree_par_id, user2.id)

        # Vérifier que les champs de timestamp sont présents sur le mouvement
        self.assertIsNotNone(mouvement.cree_le)
        # Note: Lors de l'appel direct au service (pas via l'API), les champs d'audit du salaire
        # (modifie_par, modifie_le) ne sont pas remplis car ils le sont uniquement par
        # le AuditableSerializerMixin dans les sérialiseurs, pas par save() direct

    def test_effectuer_paiement_salaire_coherence_solde_compte(self):
        """Test 10: Cohérence des soldes de compte par rapport à la fonctionnalité trésorerie"""
        from rh_paie.models import SalaireAdministration
        from tresorerie.services import tresorerie_service, compte_service

        # Créer un compte avec un solde initial connu
        solde_initial = 1000000  # 1,000,000 FCFA
        compte_test = Compte.objects.create(
            code='SOLDE_TEST',
            libelle='Compte Test Solde',
            type=Compte.Type.BANQUE,
            solde_initial=solde_initial,
            actif=True,
            cree_par=self.user
        )

        # Créer une catégorie de mouvement pour les salaires
        categorie_salaire_test = CategorieMouvement.objects.create(
            code='SALAIRE_TEST',
            libelle='Paiement de salaire test',
            sens=CategorieMouvement.Sens.SORTIE,
            cree_par=self.user
        )

        # Créer et valider un salaire administratif
        salaire = SalaireAdministration.objects.create(
            personnel_administratif=self.personnel,
            annee_scolaire=self.annee_scolaire,
            mois='SEPT',
            date_paiement=self.date_paiement,
            montant_du=250000,  # 250,000 FCFA à payer
            montant_paye=0,
            compte=compte_test,  # Le salaire pointe vers ce compte
            statut='VALIDÉ',
            cree_par=self.user
        )

        # Vérifier le solde initial du compte
        solde_avant_paiement = compte_service.calculer_solde_compte(compte_test.id)
        self.assertEqual(solde_avant_paiement, solde_initial)

        # Effectuer le paiement
        result = tresorerie_service.effectuer_paiement_salaire(
            compte_debiteur_id=compte_test.id,
            salaire_id=salaire.id,
            type_salaire='administration',
            montant=250000,
            categorie_mouvement_id=categorie_salaire_test.id,
            libelle="Test cohérence solde",
            ecole_id=self.ecole.id,
            annee_scolaire_id=self.annee_scolaire.id,
            cree_par_id=self.user.id
        )

        # Vérifier que le paiement a réussi
        self.assertIsNotNone(result)
        mouvement = result['mouvement']

        # Vérifier le solde après le paiement
        solde_apres_paiement = compte_service.calculer_solde_compte(compte_test.id)
        solde_expected = solde_initial - 250000  # Solde initial moins le paiement
        self.assertEqual(solde_apres_paiement, solde_expected)

        # Vérifier que le mouvement de débit a été correctement enregistré
        self.assertEqual(mouvement.montant, 250000)
        self.assertEqual(mouvement.sens, Mouvement.Sens.DEBIT)
        self.assertEqual(mouvement.compte, compte_test)

        # Test supplémentaire: créer un crédit sur le même compte et vérifier le solde final
        categorie_credit = CategorieMouvement.objects.create(
            code='CREDIT_TEST',
            libelle='Crédit de test',
            sens=CategorieMouvement.Sens.ENTREE,
            cree_par=self.user
        )

        Mouvement.objects.create(
            compte=compte_test,
            date_operation=self.date_paiement,
            sens=Mouvement.Sens.CREDIT,
            montant=50000,  # Crédit de 50,000 FCFA
            categorie_mouvement=categorie_credit,
            libelle='Crédit de test',
            ecole_id=self.ecole.id,
            annee_scolaire_id=self.annee_scolaire.id,
            cree_par=self.user
        )

        # Le solde devrait maintenant être: initial - débit + crédit
        solde_final_expected = solde_initial - 250000 + 50000  # 800,000 FCFA
        solde_apres_credit = compte_service.calculer_solde_compte(compte_test.id)
        self.assertEqual(solde_apres_credit, solde_final_expected)
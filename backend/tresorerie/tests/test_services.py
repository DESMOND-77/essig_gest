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
from referentiel.models import GroupeScolaire, Ecole, AnneeScolaire, Niveau

User = get_user_model()


class TresorerieServicesTestCase(TestCase):
    """Test cases for trésorerie services"""

    def setUp(self):
        """Set up test data"""
        # Créer un utilisateur de test
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123',
            email='test@example.com'
        )

        # Créer un groupe scolaire de test
        self.groupe_scolaire = GroupeScolaire.objects.create(
            nom='Groupe Scolaire Test',
            sigle='GST'
        )

        # Créer une école de test
        self.ecole = Ecole.objects.create(
            nom='École Test',
            sigle='ET',
            groupe_scolaire=self.groupe_scolaire
        )

        # Créer une année scolaire de test
        self.annee_scolaire = AnneeScolaire.create(
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

        # Créer un étudiant de test
        self.etudiant = Etudiant.objects.create(
            matricule='TEST001',
            nom='DOE',
            prenoms='John',
            sexe='M',
            date_naissance='2010-01-01'
        )

        # Créer une inscription de test
        self.inscription = Inscription.objects.create(
            etudiant=self.etudiant,
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
            groupe_scolaire=self.groupe_scolaire,
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
            groupe_scolaire=self.groupe_scolaire,
            code='VIR_SOURCE',
            libelle='Compte Source Virement',
            type=Compte.Type.BANQUE,
            solde_initial=500000,
            actif=True,
            cree_par=self.user
        )

        compte_destination = Compte.objects.create(
            groupe_scolaire=self.groupe_scolaire,
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
            groupe_scolaire=self.groupe_scolaire,
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
            groupe_scolaire=self.groupe_scolaire,
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
            groupe_scolaire=self.groupe_scolaire,
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
            groupe_scolaire=self.groupe_scolaire,
            code='DASH_BANQ',
            libelle='Compte Banque Dashboard',
            type=Compte.Type.BANQUE,
            solde_initial=500000,
            actif=True,
            cree_par=self.user
        )

        compte_caisse = Compte.objects.create(
            groupe_scolaire=self.groupe_scolaire,
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
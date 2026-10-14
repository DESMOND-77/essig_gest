# backend/tresorerie/tests/test_models.py
from django.test import TestCase
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from tresorerie.models import (
    Compte, CategorieMouvement, Virement, Mouvement, Encaissement,
    ImputationEncaissement, Depense, ArreteCaisse, Billetage
)
from personnes.models import Inscription, Etudiant
from scolarite.models import Echeance, FraisInscription
from referentiel.models import Ecole, AnneeScolaire, Niveau

User = get_user_model()


class TresorerieModelsTestCase(TestCase):
    """Test cases for trésorerie models"""

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

    def test_compte_creation(self):
        """Test de création d'un compte"""
        compte = Compte.objects.create(
            code='TEST001',
            libelle='Compte de Test',
            type=Compte.Type.BANQUE,
            solde_initial=1000000,
            actif=True,
            cree_par=self.user
        )

        self.assertEqual(compte.code, 'TEST001')
        self.assertEqual(compte.libelle, 'Compte de Test')
        self.assertEqual(compte.type, Compte.Type.BANQUE)
        self.assertEqual(compte.solde_initial, 1000000)
        self.assertTrue(compte.actif)
        self.assertEqual(str(compte), 'TEST001 - Compte de Test')

    def test_categorie_mouvement_creation(self):
        """Test de création d'une catégorie de mouvement"""
        categorie_entree = CategorieMouvement.objects.create(
            code='TEST_ENTREE',
            libelle='Test Entrée',
            sens=CategorieMouvement.Sens.ENTREE,
            cree_par=self.user
        )

        categorie_sortie = CategorieMouvement.objects.create(
            code='TEST_SORTIE',
            libelle='Test Sortie',
            sens=CategorieMouvement.Sens.SORTIE,
            cree_par=self.user
        )

        self.assertEqual(categorie_entree.sens, CategorieMouvement.Sens.ENTREE)
        self.assertEqual(categorie_sortie.sens, CategorieMouvement.Sens.SORTIE)
        self.assertEqual(str(categorie_entree), 'TEST_ENTREE - Test Entrée')

    def test_virement_creation(self):
        """Test de création d'un virement"""
        # Créer deux comptes
        compte_source = Compte.objects.create(
            code='SOURCE001',
            libelle='Compte Source',
            type=Compte.Type.BANQUE,
            solde_initial=500000,
            actif=True,
            cree_par=self.user
        )

        compte_destination = Compte.objects.create(
            code='DEST001',
            libelle='Compte Destination',
            type=Compte.Type.BANQUE,
            solde_initial=300000,
            actif=True,
            cree_par=self.user
        )

        virement = Virement.objects.create(
            compte_source=compte_source,
            compte_destination=compte_destination,
            montant=100000,
            date='2025-09-15',
            motif='Virement de test',
            cree_par=self.user
        )

        self.assertEqual(virement.montant, 100000)
        self.assertEqual(virement.compte_source, compte_source)
        self.assertEqual(virement.compte_destination, compte_destination)
        self.assertEqual(virement.statut, Virement.Statut.BROUILLON)
        self.assertIn('Virement', str(virement))

    def test_mouvement_creation(self):
        """Test de création d'un mouvement"""
        compte = Compte.objects.create(
            code='MOUV001',
            libelle='Compte Mouvement',
            type=Compte.Type.BANQUE,
            solde_initial=1000000,
            actif=True,
            cree_par=self.user
        )

        categorie = CategorieMouvement.objects.create(
            code='MOUV_TEST',
            libelle='Mouvement Test',
            sens=CategorieMouvement.Sens.ENTREE,
            cree_par=self.user
        )

        mouvement = Mouvement.objects.create(
            compte=compte,
            date_operation='2025-09-15',
            sens=Mouvement.Sens.CREDIT,
            montant=50000,
            categorie_mouvement=categorie,
            libelle='Mouvement de test',
            annee_scolaire=self.annee_scolaire,
            cree_par=self.user
        )

        self.assertEqual(mouvement.montant, 50000)
        self.assertEqual(mouvement.sens, Mouvement.Sens.CREDIT)
        self.assertEqual(mouvement.compte, compte)
        self.assertTrue(mouvement.valide)
        self.assertIn('50000', str(mouvement))

    def test_encaissement_creation(self):
        """Test de création d'un encaissement"""
        compte = Compte.objects.create(
            code='ENC001',
            libelle='Compte Encaissement',
            type=Compte.Type.BANQUE,
            solde_initial=1000000,
            actif=True,
            cree_par=self.user
        )

        encaissement = Encaissement.objects.create(
            inscription=self.inscription,
            date='2025-09-15',
            montant_total=75000,
            mode=Encaissement.Mode.ESPECES,
            compte=compte,
            recu_numero='REC000001',
            cree_par=self.user
        )

        self.assertEqual(encaissement.montant_total, 75000)
        self.assertEqual(encaissement.mode, Encaissement.Mode.ESPECES)
        self.assertEqual(encaissement.compte, compte)
        self.assertEqual(encaissement.recu_numero, 'REC000001')
        self.assertEqual(encaissement.statut, Encaissement.Statut.EN_COURS)
        self.assertIn('REC000001', str(encaissement))

    def test_imputation_encaissement_creation(self):
        """Test de création d'une imputation d'encaissement"""
        compte = Compte.objects.create(
            code='IMP001',
            libelle='Compte Imputation',
            type=Compte.Type.BANQUE,
            solde_initial=1000000,
            actif=True,
            cree_par=self.user
        )

        encaissement = Encaissement.objects.create(
            inscription=self.inscription,
            date='2025-09-15',
            montant_total=100000,
            mode=Encaissement.Mode.ESPECES,
            compte=compte,
            recu_numero='REC000002',
            cree_par=self.user
        )

        # Test d'imputation sur échéance
        imputation_echeance = ImputationEncaissement.objects.create(
            encaissement=encaissement,
            cible=ImputationEncaissement.Cible.ECHEANCE,
            echeance=self.echeance,
            montant=60000,
            cree_par=self.user
        )

        self.assertEqual(imputation_echeance.montant, 60000)
        self.assertEqual(imputation_echeance.cible, ImputationEncaissement.Cible.ECHEANCE)
        self.assertEqual(imputation_echeance.echeance, self.echeance)
        self.assertIsNull(imputation_echeance.frais_inscription)

        # Test d'imputation sur frais d'inscription
        imputation_frais = ImputationEncaissement.objects.create(
            encaissement=encaissement,
            cible=ImputationEncaissement.Cible.FRAIS,
            frais_inscription=self.frais_inscription,
            montant=40000,
            cree_par=self.user
        )

        self.assertEqual(imputation_frais.montant, 40000)
        self.assertEqual(imputation_frais.cible, ImputationEncaissement.Cible.FRAIS)
        self.assertEqual(imputation_frais.frais_inscription, self.frais_inscription)
        self.assertIsNull(imputation_frais.echeance)

    def test_depense_creation(self):
        """Test de création d'une dépense"""
        compte = Compte.objects.create(
            code='DEP001',
            libelle='Compte Dépense',
            type=Compte.Type.BANQUE,
            solde_initial=1000000,
            actif=True,
            cree_par=self.user
        )

        categorie_sortie = CategorieMouvement.objects.create(
            code='DEP_TEST',
            libelle='Dépense Test',
            sens=CategorieMouvement.Sens.SORTIE,
            cree_par=self.user
        )

        depense = Depense.objects.create(
            date='2025-09-15',
            categorie_mouvement=categorie_sortie,
            beneficiaire='Fournisseur Test',
            designation='Achat de fournitures de test',
            montant=75000,
            compte=compte,
            cree_par=self.user
        )

        self.assertEqual(depense.montant, 75000)
        self.assertEqual(depense.beneficiaire, 'Fournisseur Test')
        self.assertEqual(depense.designation, 'Achat de fournitures de test')
        self.assertEqual(depense.compte, compte)
        self.assertEqual(depense.statut, Depense.Statut.ENGAGEE)
        self.assertIn('Fournisseur Test', str(depense))

    def test_arrete_caisse_creation(self):
        """Test de création d'un arrêté de caisse"""
        compte_caisse = Compte.objects.create(
            code='CAISSE001',
            libelle='Compte Caisse',
            type=Compte.Type.CAISSE,
            solde_initial=100000,
            actif=True,
            cree_par=self.user
        )

        # Créer quelques mouvements pour avoir un solde théorique
        categorie_entree = CategorieMouvement.objects.create(
            code='CAISSE_ENT',
            libelle='Entrée Caisse',
            sens=CategorieMouvement.Sens.ENTREE,
            cree_par=self.user
        )

        Mouvement.objects.create(
            compte=compte_caisse,
            date_operation='2025-09-01',
            sens=Mouvement.Sens.CREDIT,
            montant=50000,
            categorie_mouvement=categorie_entree,
            libelle='Solde initial',
            annee_scolaire=self.annee_scolaire,
            cree_par=self.user
        )

        arrete_caisse = ArreteCaisse.objects.create(
            compte=compte_caisse,
            date='2025-09-30',
            solde_theorique=150000,  # Cela serait calculé automatiquement en pratique
            solde_physique=145000,
            fait_par=self.user,
            cree_par=self.user
        )

        self.assertEqual(arrete_caisse.compte, compte_caisse)
        self.assertEqual(arrete_caisse.date, '2025-09-30')
        self.assertEqual(arrete_caisse.solde_theorique, 150000)
        self.assertEqual(arrete_caisse.solde_physique, 145000)
        self.assertEqual(arrete_caisse.ecart, -5000)  # physique - théorique
        self.assertEqual(arrete_caisse.statut, ArreteCaisse.Statut.EN_COURS)
        self.assertIn('CAISSE001', str(arrete_caisse))

    def test_billetage_creation(self):
        """Test de création d'une ligne de billetage"""
        compte_caisse = Compte.objects.create(
            code='BIL001',
            libelle='Compte Billetage',
            type=Compte.Type.CAISSE,
            solde_initial=100000,
            actif=True,
            cree_par=self.user
        )

        arrete_caisse = ArreteCaisse.objects.create(
            compte=compte_caisse,
            date='2025-09-30',
            solde_theorique=50000,
            solde_physique=50000,
            fait_par=self.user,
            cree_par=self.user
        )

        billetage = Billetage.objects.create(
            arrete_caisse=arrete_caisse,
            denomination=1000,
            quantite=50
        )

        self.assertEqual(billetage.denomination, 1000)
        self.assertEqual(billetage.quantite, 50)
        self.assertEqual(billetage.montant, 50000)  # 1000 * 50
        self.assertEqual(billetage.arrete_caisse, arrete_caisse)
        self.assertIn('1000', str(billetage))
        self.assertIn('50', str(billetage))
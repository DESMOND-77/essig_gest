# backend/scolarite/tests/test_services.py
import datetime
import decimal
from django.test import TestCase
from django.db import transaction
from ..models import ModalitePaiement, TypeFrais, FraisInscription, Echeance, Bourse
from referentiel.models import Niveau, AnneeScolaire, Ecole, Classe, GroupeScolaire, OptionFiliere, ModaliteFormation, Filiere
from personnes.models import Etudiant, Inscription
from ..services import (
    generer_echeancier_inscription,
    imputer_encaissement,
    appliquer_bourse_etudiant,
    calculer_reste_a_payer_inscription,
    preparer_donnees_fiche_scolarite
)

class ScolariteServicesTest(TestCase):
    def setUp(self):
        # Setup referentiel data
        groupe_scolaire = GroupeScolaire.objects.create(nom="Groupe Test")
        ecole = Ecole.objects.create(
            nom="Ecole Test",
            groupe_scolaire=groupe_scolaire,
            pole="ESSIG",
            regime="LMD"
        )
        self.niveau = Niveau.objects.create(
            ecole=ecole,
            code="L1",
            libelle="Licence 1",
            ordre=1,
            credits_requis=60
        )
        self.annee = AnneeScolaire.objects.create(
            libelle="2025-2026",
            est_courante=True,
            date_debut=datetime.date(2025, 9, 1),
            date_fin=datetime.date(2026, 8, 31)
        )

        # Setup scolarite data
        self.modalite_paiement = ModalitePaiement.objects.create(
            niveau=self.niveau,
            annee_scolaire=self.annee,
            montant=150000  # 150,000 FCFA par échéance
        )

        self.frais_inscription = FraisInscription.objects.create(
            niveau=self.niveau,
            annee_scolaire=self.annee,
            montant=100000  # 100,000 FCFA frais d'inscription
        )

        self.frais_scolarite = TypeFrais.objects.create(
            libelle="Frais de scolarité",
            code="SCOL",
            description="Frais de scolarité mensuelle"
        )

        # Setup personne data
        self.etudiant = Etudiant.objects.create(
            nom="Doe",
            prenoms="John",
            date_naissance="2000-01-01",
            email="john.doe@example.com",
            matricule="ETUD001"  # Required field
        )

        # Create required related objects for Inscription
        self.ecole = Ecole.objects.create(
            nom="Ecole Test",
            groupe_scolaire=GroupeScolaire.objects.create(nom="Groupe Test"),
            pole="ESSIG",
            regime="LMD"
        )

        self.filiere = Filiere.objects.create(
            ecole=self.ecole,
            nom="Filiere Test",
            sigle="FT"
        )

        self.option_filiere = OptionFiliere.objects.create(
            filiere=self.filiere,
            nom="Option Test",
            sigle="OT"
        )

        self.modalite_formation = ModaliteFormation.objects.create(
            code="FI",
            libelle="Formation Initiale"
        )

        self.classe = Classe.objects.create(
            annee_scolaire=self.annee,
            niveau=self.niveau,
            option_filiere=self.option_filiere,
            modalite_formation=self.modalite_formation
        )

        # Create inscription
        self.inscription = Inscription.objects.create(
            etudiant=self.etudiant,
            classe=self.classe,
            ecole=self.ecole,
            annee_scolaire=self.annee,
            numero_ordre=1,
            date_inscription="2025-09-01",
            statut="validee"
        )

    def test_generer_echeancier_inscription(self):
        """Test génération d'échéancier à partir d'une inscription"""
        # Before generation
        self.assertEqual(Echeance.objects.filter(inscription=self.inscription).count(), 0)

        # Generate échéancier
        with transaction.atomic():
            generer_echeancier_inscription(self.inscription.id)

        # After generation: should have échéance 0 (inscription) + échéances 1..N selon grille
        echeances = Echeance.objects.filter(inscription=self.inscription).order_by('numero')
        self.assertEqual(echeances.count(), 2)  # 0 + 1 échéance de scolarité pour cet exemple

        # Échéance 0 = frais d'inscription
        echeance_0 = echeances.get(numero=0)
        self.assertEqual(echeance_0.montant, 100000)  # Frais d'inscription seulement
        self.assertEqual(echeance_0.statut, 'à payer')

        # Échéance 1 = première échéance de scolarité
        echeance_1 = echeances.get(numero=1)
        self.assertEqual(echeance_1.montant, 150000)  # Montant de la grille tarifaire
        self.assertEqual(echeance_1.statut, 'à payer')

    def test_imputer_encaissement_fifo(self):
        """Test imputation d'encaissement selon règle FIFO"""
        # First generate échéancier
        with transaction.atomic():
            generer_echeancier_inscription(self.inscription.id)

        # Get initial state
        echeances = list(Echeance.objects.filter(inscription=self.inscription).order_by('numero'))
        initial_total_du = sum(e.montant for e in echeances)
        initial_total_paye = sum(e.montant_paye for e in echeances)

        # Make a partial payment (50% of first échéance)
        paiement_partiel = 75000  # 50% of 150000

        with transaction.atomic():
            imputer_encaissement(
                inscription_id=self.inscription.id,
                montant=paiement_partiel,
                date_paiement="2025-10-15"
            )

        # Check results
        echeance_0 = Echeance.objects.get(inscription=self.inscription, numero=0)
        echeance_1 = Echeance.objects.get(inscription=self.inscription, numero=1)

        # Échéance 0 (frais d'inscription) devrait être payée en priorité (FIFO)
        # Mais dans notre cas, on a généré seulement 2 échéances: 0=frais insc, 1=scolarité
        # Donc le paiement devrait d'abord aller sur l'échéance 0
        self.assertEqual(echeance_0.montant_paye, 75000)  # Partiellement payée
        self.assertEqual(echeance_0.statut, 'partiellement payé')
        self.assertEqual(echeance_1.montant_paye, 0)      # Non touchée
        self.assertEqual(echeance_1.statut, 'à payer')

        # Verify totals
        reste_a_payer = calculer_reste_a_payer_inscription(self.inscription.id)
        expected_reste = initial_total_du - paiement_partiel
        self.assertEqual(reste_a_payer, expected_reste)

    def test_appliquer_bourse_etudiant(self):
        """Test application d'une bourse à un étudiant"""
        # First generate échéancier
        with transaction.atomic():
            generer_echeancier_inscription(self.inscription.id)

        # Get initial total due
        initial_total_du = sum(e.montant for e in Echeance.objects.filter(inscription=self.inscription))

        # Apply 50% scholarship
        bourse = Bourse.objects.create(
            etudiant=self.etudiant,
            annee_scolaire=self.annee,
            pourcentage=50.00,
            type="PARTIELLE",
            date_attribution="2025-09-01"
        )

        with transaction.atomic():
            appliquer_bourse_etudiant(self.etudiant.id, self.annee.id)

        # Check that remaining balance is reduced by 50%
        reste_a_payer_apres = calculer_reste_a_payer_inscription(self.inscription.id)
        expected_reste = initial_total_du * decimal.Decimal('0.5')  # 50% reduction
        self.assertAlmostEqual(float(reste_a_payer_apres), float(expected_reste), places=0)

        # Test with fixed amount bourse
        Bourse.objects.filter(etudiant=self.etudiant).delete()  # Remove previous
        # Reset échéance payments to initial state for clean test
        Echeance.objects.filter(inscription=self.inscription).update(
            montant_paye=0,
            statut='à payer'
        )
        bourse_fixe = Bourse.objects.create(
            etudiant=self.etudiant,
            annee_scolaire=self.annee,
            montant_fixe=75000,  # 75,000 FCFA fixed amount
            type="TOTAL",
            date_attribution="2025-09-01"
        )

        with transaction.atomic():
            appliquer_bourse_etudiant(self.etudiant.id, self.annee.id)

        reste_a_payer_apres_fixe = calculer_reste_a_payer_inscription(self.inscription.id)
        expected_reste_fixe = initial_total_du - 75000
        self.assertAlmostEqual(float(reste_a_payer_apres_fixe), float(expected_reste_fixe), places=0)

    def test_calculer_reste_a_payer_inscription(self):
        """Test calcul du reste à payer pour une inscription"""
        # Generate échéancier
        with transaction.atomic():
            generer_echeancier_inscription(self.inscription.id)

        # Initial state: all échéances à payer
        reste_initial = calculer_reste_a_payer_inscription(self.inscription.id)
        total_du_initial = sum(e.montant for e in Echeance.objects.filter(inscription=self.inscription))
        self.assertEqual(reste_initial, total_du_initial)

        # Make a full payment on first échéance
        echeance_0 = Echeance.objects.get(inscription=self.inscription, numero=0)
        echeance_0.montant_paye = echeance_0.montant
        echeance_0.statut = 'payé'
        echeance_0.save()

        # Reste à payer devrait être réduit du montant de la première échéance
        reste_apres_paiement = calculer_reste_a_payer_inscription(self.inscription.id)
        expected_reste = total_du_initial - echeance_0.montant
        self.assertEqual(reste_apres_paiement, expected_reste)

        # Make a partial payment on second échéance
        echeance_1 = Echeance.objects.get(inscription=self.inscription, numero=1)
        echeance_1.montant_paye = 50000  # Partial payment
        echeance_1.statut = 'partiellement payé'
        echeance_1.save()

        reste_apres_paiement_partiel = calculer_reste_a_payer_inscription(self.inscription.id)
        expected_reste_partiel = total_du_initial - echeance_0.montant - 50000
        self.assertEqual(reste_apres_paiement_partiel, expected_reste_partiel)

    def test_preparer_donnees_fiche_scolarite(self):
        """Test préparation des données pour une fiche scolarité"""
        # Generate some baseline data
        with transaction.atomic():
            generer_echeancier_inscription(self.inscription.id)

        # Prepare données fiche scolarité
        donnees = preparer_donnees_fiche_scolarite(self.inscription.id)

        # Should contain expected fields
        self.assertIn('etudiant', donnees)
        self.assertIn('inscription', donnees)
        self.assertIn('informations_academiques', donnees)
        self.assertIn('situation_financiere', donnees)
        self.assertIn('activites', donnees)

        # Check etudiant data
        self.assertEqual(donnees['etudiant']['nom'], "Doe")
        self.assertEqual(donnees['etudiant']['prenoms'], "John")

        # Check situation financière
        self.assertIn('total_du', donnees['situation_financiere'])
        self.assertIn('total_paye', donnees['situation_financiere'])
        self.assertIn('reste_a_payer', donnees['situation_financiere'])
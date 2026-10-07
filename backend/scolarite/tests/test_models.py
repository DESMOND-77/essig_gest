# backend/scolarite/tests/test_models.py
from django.test import TestCase
from ..models import ModalitePaiement, TypeFrais, FraisInscription, Echeance, Bourse
from referentiel.models import Niveau, AnneeScolaire, Ecole, GroupeScolaire
from personnes.models import Etudiant

class ScolariteModelsTest(TestCase):
    def setUp(self):
        # Create an Ecole first since Niveau.ecole is required
        groupe_scolaire = GroupeScolaire.objects.create(nom="Groupe Scolaire de Test")
        ecole = Ecole.objects.create(
            nom="École de Test",
            groupe_scolaire=groupe_scolaire,
            pole="ESSIG",
            regime="LMD"
        )
        self.niveau = Niveau.objects.create(
            ecole=ecole,
            code="L1",
            libelle="Licence 1",
            ordre=1
        )
        self.annee = AnneeScolaire.objects.create(
            libelle="2025T26",
            date_debut="2025-09-01",
            date_fin="2026-08-31"
        )
        self.etudiant = Etudiant.objects.create(
            nom="Doe", prenoms="John", sexe="M", matricule="ETD000001", date_naissance="2000-01-01"
        )

    def test_modalite_paiement_creation(self):
        mp = ModalitePaiement.objects.create(
            niveau=self.niveau,
            annee_scolaire=self.annee,
            montant=150000
        )
        self.assertEqual(mp.montant, 150000)
        self.assertEqual(str(mp), f"L1 - {self.annee.libelle}: 150000 FCFA")

    def test_type_frais_creation(self):
        tf = TypeFrais.objects.create(
            libelle="Frais de scolarité Test",
            code="SCOL",
            description="Frais de scolarité annuelle"
        )
        self.assertEqual(tf.libelle, "Frais de scolarité Test")

    def test_frais_inscription_creation(self):
        fi = FraisInscription.objects.create(
            niveau=self.niveau,
            annee_scolaire=self.annee,
            montant=100000
        )
        self.assertEqual(fi.montant, 100000)

    def test_echeance_creation(self):
        # First create an inscription (would come from personnes app)
        # For now, we'll test the model structure
        echeance = Echeance(
            montant=150000,
            numero=1,
            date_echeance="2025-12-31"
        )
        self.assertEqual(echeance.montant, 150000)
        self.assertEqual(echeance.numero, 1)

    def test_bourse_creation_pourcentage(self):
        bourse = Bourse.objects.create(
            etudiant=self.etudiant,
            annee_scolaire=self.annee,
            pourcentage=50.00,
            type="PARTIELLE",
            date_attribution="2025-09-01"
        )
        self.assertEqual(bourse.pourcentage, 50.00)
        self.assertEqual(bourse.type, "PARTIELLE")

    def test_bourse_creation_montant_fixe(self):
        bourse = Bourse.objects.create(
            etudiant=self.etudiant,
            annee_scolaire=self.annee,
            montant_fixe=75000,
            type="TOTAL",
            date_attribution="2025-09-01"
        )
        self.assertEqual(bourse.montant_fixe, 75000)
        self.assertEqual(bourse.type, "TOTAL")
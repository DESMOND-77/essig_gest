from django.test import TestCase
from django.core.exceptions import ValidationError
from rh_paie.models import Enseignant, PersonnelAdministratif, AffectationEnseignement
from rh_paie.services import EnseignantService, PersonnelAdministratifService, AffectationEnseignementService
from referentiel.models import Ecole, Matiere, Classe, Filiere, OptionFiliere, Niveau, ModaliteFormation, AnneeScolaire


class EnseignantServiceTest(TestCase):
    def setUp(self):
        self.enseignant_data = {
            'nom': 'DOE',
            'prenom': 'John',
            'email': 'john.doe@example.com',
            'statut': 'PERMANENT'
        }

    def test_create_enseignant_success(self):
        enseignant = EnseignantService.create_enseignant(**self.enseignant_data)
        self.assertEqual(enseignant.nom, 'DOE')
        self.assertEqual(enseignant.email, 'john.doe@example.com')

    def test_create_enseignant_duplicate_email(self):
        EnseignantService.create_enseignant(**self.enseignant_data)
        with self.assertRaises(ValidationError):
            EnseignantService.create_enseignant(**self.enseignant_data)

    def test_get_enseignant_by_email(self):
        EnseignantService.create_enseignant(**self.enseignant_data)
        retrieved = EnseignantService.get_enseignant_by_email('john.doe@example.com')
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.nom, 'DOE')


class PersonnelAdministratifServiceTest(TestCase):
    def setUp(self):
        # Create the dependency chain for Ecole
        self.ecole = Ecole.objects.create(
            nom="Ecole Test",
            regime="LMD"
        )

        self.personnel_data = {
            'nom': 'SMITH',
            'prenom': 'Jane',
            'poste': 'Comptable',
            'ecole': self.ecole,
            'email': 'jane.smith@example.com',
            'salaire_base': 300000
        }

    def test_create_personnel_administratif_success(self):
        personnel = PersonnelAdministratifService.create_personnel_administratif(**self.personnel_data)
        self.assertEqual(personnel.nom, 'SMITH')
        self.assertEqual(personnel.email, 'jane.smith@example.com')

    def test_create_personnel_administratif_duplicate_email(self):
        PersonnelAdministratifService.create_personnel_administratif(**self.personnel_data)
        with self.assertRaises(ValidationError):
            PersonnelAdministratifService.create_personnel_administratif(**self.personnel_data)

    def test_list_personnels_by_ecole(self):
        PersonnelAdministratifService.create_personnel_administratif(**self.personnel_data)
        personnels = PersonnelAdministratifService.list_personnels_administratifs(ecole_id=self.ecole.id)
        self.assertEqual(personnels.count(), 1)


class AffectationEnseignementServiceTest(TestCase):
    def setUp(self):
        # Create the full dependency chain
        self.ecole = Ecole.objects.create(
            nom="Ecole Test",
            regime="LMD"
        )

        # Create Filiere and OptionFiliere for Matiere and Classe
        self.filiere = Filiere.objects.create(
            nom="Filiere Test",
            ecole=self.ecole
        )
        self.option_filiere = OptionFiliere.objects.create(
            nom="Option Test",
            filiere=self.filiere
        )

        # Create Niveau for Matiere and Classe
        self.niveau = Niveau.objects.create(
            ecole=self.ecole,
            code="NIV001",
            libelle="Niveau Test",
            ordre=1
        )

        # Create ModaliteFormation for Classe
        self.modalite_formation = ModaliteFormation.objects.create(
            code="FI"  # Formation initiale
        )

        # Create AnneeScolaire (from referentiel)
        self.annee_scolaire = AnneeScolaire.objects.create(
            libelle="2025-2026",
            date_debut="2025-09-01",
            date_fin="2026-06-30"
        )

        # Create Matiere
        self.matiere = Matiere.objects.create(
            niveau=self.niveau,
            option_filiere=self.option_filiere,
            semestre="S1",
            nom="Mathématiques",
            code="MATH001",
            coefficient=3,
            volume_horaire=60
        )

        # Create Classe
        self.classe = Classe.objects.create(
            annee_scolaire=self.annee_scolaire,
            niveau=self.niveau,
            option_filiere=self.option_filiere,
            modalite_formation=self.modalite_formation,
            libelle_auto="6A Test",
            effectif_max=30
        )

        # Create Enseignant
        self.enseignant = Enseignant.objects.create(
            nom="DUPONT",
            prenom="Marie",
            email="marie.dupont@example.com"
        )

        self.affectation_data = {
            'enseignant': self.enseignant,
            'matiere': self.matiere,
            'classe': self.classe,
            'annee_scolaire': self.annee_scolaire,
            'volume_horaire_prevu': 45,
            'taux_horaire': 8000
        }

    def test_create_affectation_success(self):
        affectation = AffectationEnseignementService.create_affectation(**self.affectation_data)
        self.assertEqual(affectation.volume_horaire_prevu, 45)
        self.assertEqual(affectation.taux_horaire, 8000)
        self.assertEqual(affectation.montant_prevu, 360000)  # 45 * 8000

    def test_create_affectation_duplicate_matiere_classe(self):
        # Create first affectation
        AffectationEnseignementService.create_affectation(**self.affectation_data)

        # Try to create another with same matiere and classe
        with self.assertRaises(ValidationError):
            AffectationEnseignementService.create_affectation(
                enseignant=self.enseignant,
                matiere=self.matiere,
                classe=self.classe,
                annee_scolaire=self.annee_scolaire,
                volume_horaire_prevu=10,
                taux_horaire=8000
            )

    def test_get_affectations_for_enseignant(self):
        AffectationEnseignementService.create_affectation(**self.affectation_data)
        affectations = AffectationEnseignementService.get_affectations_for_enseignant(self.enseignant)
        self.assertEqual(affectations.count(), 1)
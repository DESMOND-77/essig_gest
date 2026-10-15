# backend/scolarite/tests/test_admin.py
from django.test import TestCase
from django.contrib.admin.sites import AdminSite
from ..models import ModalitePaiement, TypeFrais, FraisInscription, Echeance, Bourse
from ..admin import ModalitePaiementAdmin, TypeFraisAdmin, FraisInscriptionAdmin, EcheanceAdmin, BourseAdmin
from referentiel.models import Niveau, AnneeScolaire, Ecole
from personnes.models import Etudiant

class ScolariteAdminTest(TestCase):
    def setUp(self):
        # Create prerequisite objects
        ecole = Ecole.objects.create(
            nom="École de Test",
            regime="LMD"
        )
        self.niveau = Niveau.objects.create(
            ecole=ecole,
            code="L1",
            libelle="Licence 1",
            ordre=1
        )
        self.annee = AnneeScolaire.objects.create(
            libelle="2025-2026",
            date_debut="2025-09-01",
            date_fin="2026-08-31"
        )
        self.etudiant = Etudiant.objects.create(
            nom="Doe", prenoms="John", sexe="M", matricule="ETD000001", date_naissance="2000-01-01"
        )
        self.site = AdminSite()

    def test_modalite_paiement_admin_list_display(self):
        ma = ModalitePaiementAdmin(ModalitePaiement, self.site)
        self.assertIn('niveau', ma.list_display)
        self.assertIn('annee_scolaire', ma.list_display)
        self.assertIn('montant_total', ma.list_display)

    def test_type_frais_admin_search_fields(self):
        ta = TypeFraisAdmin(TypeFrais, self.site)
        self.assertIn('libelle', ta.search_fields)
        self.assertIn('code', ta.search_fields)

    def test_frais_inscription_admin_list_filter(self):
        fia = FraisInscriptionAdmin(FraisInscription, self.site)
        self.assertIn('type_frais', fia.list_filter)
        self.assertIn('exonere', fia.list_filter)

    def test_echeance_admin_list_filter(self):
        eac = EcheanceAdmin(Echeance, self.site)
        self.assertIn('statut', eac.list_filter)
        self.assertIn('date_echeance', eac.list_filter)
        self.assertIn('inscription__etudiant__nom', eac.search_fields)

    def test_bourse_admin_list_filter(self):
        ba = BourseAdmin(Bourse, self.site)
        self.assertIn('type', ba.list_filter)
        self.assertIn('annee_scolaire', ba.list_filter)
        self.assertIn('etudiant__nom', ba.search_fields)
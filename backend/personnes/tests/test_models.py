import pytest
from django.db import IntegrityError

from personnes import models
from personnes.tests import factories as f

pytestmark = pytest.mark.django_db


def test_db_tables_sont_les_noms_cibles():
    attendus = {
        models.Etudiant: "etudiant",
        models.Affiliation: "affiliation",
        models.SituationBac: "situation_bac",
        models.TypePiece: "type_piece",
        models.CompteurMatricule: "compteur_matricule",
    }
    for modele, table in attendus.items():
        assert modele._meta.db_table == table


def test_matricule_unique():
    f.EtudiantFactory(matricule="ESSIG-FCVGUDE1")
    with pytest.raises(IntegrityError):
        f.EtudiantFactory(matricule="ESSIG-FCVGUDE1")


def test_affiliation_unicite_etudiant_type():
    e = f.EtudiantFactory()
    f.AffiliationFactory(etudiant=e, type=models.Affiliation.Type.PERE)
    with pytest.raises(IntegrityError):
        f.AffiliationFactory(etudiant=e, type=models.Affiliation.Type.PERE)


def test_affiliation_cascade_a_la_suppression_etudiant():
    e = f.EtudiantFactory()
    f.AffiliationFactory(etudiant=e, type=models.Affiliation.Type.PERE)
    f.AffiliationFactory(etudiant=e, type=models.Affiliation.Type.MERE)
    e.delete()
    assert models.Affiliation.objects.filter(etudiant_id=e.pk).count() == 0


def test_situation_bac_une_seule_par_etudiant():
    e = f.EtudiantFactory()
    f.SituationBacFactory(etudiant=e)
    with pytest.raises(IntegrityError):
        f.SituationBacFactory(etudiant=e)


def test_situation_bac_cascade_a_la_suppression_etudiant():
    e = f.EtudiantFactory()
    f.SituationBacFactory(etudiant=e)
    e.delete()
    assert not models.SituationBac.objects.filter(etudiant_id=e.pk).exists()


def test_type_piece_code_unique():
    f.TypePieceFactory(code="ACTE_NAISSANCE")
    with pytest.raises(IntegrityError):
        f.TypePieceFactory(code="ACTE_NAISSANCE")


def test_index_nom_present():
    noms = {i.name for i in models.Etudiant._meta.indexes}
    assert "idx_etudiant_nom" in noms

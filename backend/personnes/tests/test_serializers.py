import pytest

from personnes import models
from personnes.serializers import EtudiantListSerializer, EtudiantSerializer
from personnes.tests import factories as f

pytestmark = pytest.mark.django_db

_BASE = {"nom": "Gumapi clos", "prenoms": "desmond junior", "sexe": "F"}


def test_create_exige_pole_et_genere_le_matricule():
    s = EtudiantSerializer(data={**_BASE, "pole": "ESSIG"})
    assert s.is_valid(), s.errors
    etu = s.save()
    assert etu.matricule == "ESSIG-FCVGUDE1"


def test_create_sans_pole_est_invalide():
    s = EtudiantSerializer(data=_BASE)
    assert not s.is_valid()
    assert "pole" in s.errors


def test_matricule_en_entree_est_ignore():
    s = EtudiantSerializer(data={**_BASE, "pole": "ESSIG", "matricule": "PIRATE"})
    assert s.is_valid(), s.errors
    etu = s.save()
    assert etu.matricule != "PIRATE"


def test_update_ne_touche_ni_pole_ni_matricule():
    etu = f.EtudiantFactory(matricule="ESSIG-FCVGUDE7", nom="Ancien")
    s = EtudiantSerializer(
        etu, data={"nom": "Nouveau", "pole": "UPSS"}, partial=True
    )
    assert s.is_valid(), s.errors
    etu = s.save()
    etu.refresh_from_db()
    assert etu.nom == "Nouveau"
    assert etu.matricule == "ESSIG-FCVGUDE7"


def test_detail_imbrique_affiliations_et_bac_en_lecture_seule():
    etu = f.EtudiantFactory()
    f.AffiliationFactory(etudiant=etu, type=models.Affiliation.Type.PERE)
    f.SituationBacFactory(etudiant=etu)
    data = EtudiantSerializer(etu).data
    assert len(data["affiliations"]) == 1
    assert data["situation_bac"]["a_le_bac"] is True


def test_list_serializer_n_imbrique_pas():
    assert "affiliations" not in EtudiantListSerializer().fields

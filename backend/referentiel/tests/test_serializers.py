import pytest

from referentiel.serializers import ClasseSerializer, NiveauSerializer
from referentiel.tests import factories as f

pytestmark = pytest.mark.django_db


def test_niveau_serializer_expose_ecole_libelle():
    n = f.NiveauFactory()
    data = NiveauSerializer(n).data
    assert data["ecole"] == n.ecole_id
    assert data["ecole_libelle"] == str(n.ecole)


def test_classe_serializer_calcule_libelle_auto_a_la_creation():
    e = f.EcoleFactory()
    niveau = f.NiveauFactory(ecole=e, code="L1")
    filiere = f.FiliereFactory(ecole=e, sigle="GACO")
    option = f.OptionFiliereFactory(filiere=filiere, sigle="CI")
    modalite = f.ModaliteFormationFactory(code="FI")
    annee = f.AnneeScolaireFactory(libelle="2025-2026")
    s = ClasseSerializer(
        data={
            "annee_scolaire": annee.pk,
            "niveau": niveau.pk,
            "option_filiere": option.pk,
            "modalite_formation": modalite.pk,
        }
    )
    assert s.is_valid(), s.errors
    classe = s.save()
    assert classe.libelle_auto == "L1 GACO/CI FI 2025-2026"


def test_classe_serializer_ignore_libelle_auto_poste():
    e = f.EcoleFactory()
    s = ClasseSerializer(
        data={
            "annee_scolaire": f.AnneeScolaireFactory(libelle="2030-2031").pk,
            "niveau": f.NiveauFactory(ecole=e, code="L2").pk,
            "option_filiere": f.OptionFiliereFactory().pk,
            "modalite_formation": f.ModaliteFormationFactory(code="FC").pk,
            "libelle_auto": "PIRATÉ",
        }
    )
    assert s.is_valid(), s.errors
    assert s.save().libelle_auto != "PIRATÉ"


def test_annee_serializer_bascule_courante():
    from referentiel.serializers import AnneeScolaireSerializer
    a1 = f.AnneeScolaireFactory(libelle="2024-2025", est_courante=True)
    s = AnneeScolaireSerializer(
        data={"libelle": "2025-2026", "date_debut": "2025-10-01",
              "date_fin": "2026-08-31", "est_courante": True}
    )
    assert s.is_valid(), s.errors
    a2 = s.save()
    a1.refresh_from_db()
    assert a2.est_courante is True
    assert a1.est_courante is False


def test_annee_serializer_non_courante_ne_bascule_rien():
    from referentiel.serializers import AnneeScolaireSerializer
    a1 = f.AnneeScolaireFactory(libelle="2024-2025", est_courante=True)
    s = AnneeScolaireSerializer(
        data={"libelle": "2026-2027", "date_debut": "2026-10-01",
              "date_fin": "2027-08-31", "est_courante": False}
    )
    assert s.is_valid(), s.errors
    s.save()
    a1.refresh_from_db()
    assert a1.est_courante is True

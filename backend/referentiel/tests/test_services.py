import pytest

from referentiel import models, services
from referentiel.tests import factories as f

pytestmark = pytest.mark.django_db


def _classe_parts(option_sigle="CI"):
    e = f.EcoleFactory()
    niveau = f.NiveauFactory(ecole=e, code="L1")
    filiere = f.FiliereFactory(ecole=e, sigle="GACO")
    option = f.OptionFiliereFactory(filiere=filiere, sigle=option_sigle)
    modalite = f.ModaliteFormationFactory(code="FI")
    annee = f.AnneeScolaireFactory(libelle="2025-2026")
    return dict(
        niveau=niveau,
        option_filiere=option,
        modalite_formation=modalite,
        annee_scolaire=annee,
    )


def test_libelle_classe_complet():
    assert (
        services.libelle_classe(**_classe_parts("CI"))
        == "L1 GACO/CI FI 2025-2026"
    )


def test_libelle_classe_sans_sigle_option():
    assert (
        services.libelle_classe(**_classe_parts(""))
        == "L1 GACO FI 2025-2026"
    )


def test_definir_annee_courante_bascule_les_autres():
    a1 = f.AnneeScolaireFactory(est_courante=True)
    a2 = f.AnneeScolaireFactory(est_courante=False)
    services.definir_annee_courante(a2)
    a1.refresh_from_db()
    a2.refresh_from_db()
    assert a2.est_courante is True
    assert a1.est_courante is False
    assert models.AnneeScolaire.objects.filter(est_courante=True).count() == 1

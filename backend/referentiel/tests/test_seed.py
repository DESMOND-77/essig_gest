import pytest
from django.core.management import call_command

from referentiel import models

pytestmark = pytest.mark.django_db


def _compter():
    return {
        modele.__name__: modele.objects.count()
        for modele in (
            models.Ecole,
            models.ModaliteFormation,
            models.Niveau,
            models.Filiere,
            models.OptionFiliere,
            models.Periode,
            models.SessionExamen,
        )
    }


def test_seed_cree_le_socle_et_est_idempotent():
    call_command("seed_referentiel", "--annee", "2026-2027")
    premier_passage = _compter()
    assert premier_passage["ModaliteFormation"] == 4
    assert premier_passage["Periode"] == 2
    assert premier_passage["SessionExamen"] == 2
    assert models.AnneeScolaire.objects.get(libelle="2026-2027").est_courante is True

    call_command("seed_referentiel", "--annee", "2026-2027")
    assert _compter() == premier_passage


def test_seed_cree_les_trois_etablissements_des_affiches():
    call_command("seed_referentiel", "--annee", "2026-2027")

    regimes = dict(models.Ecole.objects.values_list("sigle", "regime"))
    assert regimes == {"ESSIG": "LMD", "ESSS": "LMD", "CFPA": "CLASSIQUE"}


def test_seed_cree_les_niveaux_de_chaque_etablissement_dans_l_ordre():
    call_command("seed_referentiel", "--annee", "2026-2027")

    def niveaux(sigle):
        return list(
            models.Niveau.objects.filter(ecole__sigle=sigle)
            .order_by("ordre")
            .values_list("code", flat=True)
        )

    assert niveaux("ESSIG") == ["L1", "L2", "L3", "M1", "M2"]
    assert niveaux("ESSS") == ["L1", "L2", "L3", "MP"]
    assert niveaux("CFPA") == ["A1", "A2"]


def test_seed_cree_les_filieres_et_leurs_options_de_chaque_etablissement():
    call_command("seed_referentiel", "--annee", "2026-2027")

    options_par_filiere = {
        ecole.sigle: {f.sigle: f.options.count() for f in ecole.filieres.all()}
        for ecole in models.Ecole.objects.all()
    }

    assert options_par_filiere == {
        "ESSIG": {"AELM": 3, "GACO": 5, "GEA": 7, "IC": 6, "DF": 5, "RGI": 3, "QHSE": 4},
        "ESSS": {"SANTE": 3},
        "CFPA": {"FP": 10},
    }

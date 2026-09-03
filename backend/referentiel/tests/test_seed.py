import pytest
from django.core.management import call_command

from referentiel import models

pytestmark = pytest.mark.django_db


def test_seed_cree_le_socle_et_est_idempotent():
    call_command("seed_referentiel", "--annee", "2025-2026")
    assert models.Ecole.objects.count() == 4
    assert models.ModaliteFormation.objects.count() == 4
    assert models.Periode.objects.count() == 2
    assert models.SessionExamen.objects.count() == 2
    assert models.AnneeScolaire.objects.get(libelle="2025-2026").est_courante is True

    call_command("seed_referentiel", "--annee", "2025-2026")
    assert models.Ecole.objects.count() == 4
    assert models.ModaliteFormation.objects.count() == 4
    assert models.Periode.objects.count() == 2

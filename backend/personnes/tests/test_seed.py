import pytest
from django.core.management import call_command

from personnes.models import TypePiece

pytestmark = pytest.mark.django_db


def test_seed_personnes_idempotent():
    call_command("seed_personnes")
    call_command("seed_personnes")
    assert TypePiece.objects.count() == 5
    assert set(TypePiece.objects.values_list("code", flat=True)) == {
        "ACTE_NAISSANCE",
        "RELEVE_BAC",
        "PHOTOS",
        "LETTRE_MOTIVATION",
        "CERTIF_SCOLARITE",
    }

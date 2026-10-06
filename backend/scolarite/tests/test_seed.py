import pytest
from django.core.management import call_command

from scolarite.models import TypeFrais

pytestmark = pytest.mark.django_db


def test_seed_scolarite_idempotent():
    call_command("seed_scolarite")
    call_command("seed_scolarite")
    assert TypeFrais.objects.count() == 7
    assert set(TypeFrais.objects.values_list("code", flat=True)) == {
        "TENUE",
        "PHOTOCOPIE",
        "MUTUELLE",
        "JOURNEE_INTEGRATION",
        "SOUTENANCE",
        "EXAMEN",
        "MATIERE_OEUVRE",
    }

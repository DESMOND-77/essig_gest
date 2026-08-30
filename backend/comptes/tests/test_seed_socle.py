import pytest
from django.core.management import call_command

from comptes.models import Role, Utilisateur

pytestmark = pytest.mark.django_db


def test_seed_cree_les_cinq_roles_et_est_idempotent():
    call_command("seed_socle")
    assert Role.objects.count() == 5
    call_command("seed_socle")
    assert Role.objects.count() == 5


def test_seed_cree_un_admin_optionnel():
    call_command("seed_socle", admin_login="root", admin_password="motdepasse42")
    admin = Utilisateur.objects.get(login="root")
    assert admin.is_superuser

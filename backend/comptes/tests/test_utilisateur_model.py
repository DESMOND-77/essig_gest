import pytest
from django.db import IntegrityError

from comptes.models import Utilisateur

pytestmark = pytest.mark.django_db


def test_creer_utilisateur_hache_le_mot_de_passe():
    u = Utilisateur.objects.creer_utilisateur("jdupont", "j@ex.ga", "motdepasse42")
    assert u.login == "jdupont"
    assert u.password != "motdepasse42"
    assert u.check_password("motdepasse42")
    assert u.actif is True
    assert u.is_active is True


def test_login_est_unique():
    Utilisateur.objects.creer_utilisateur("jdupont", "j@ex.ga", "motdepasse42")
    with pytest.raises(IntegrityError):
        Utilisateur.objects.creer_utilisateur("jdupont", "autre@ex.ga", "motdepasse42")


def test_superutilisateur():
    su = Utilisateur.objects.creer_superutilisateur("admin", "a@ex.ga", "motdepasse42")
    assert su.is_staff and su.is_superuser


def test_desactivation_via_actif():
    u = Utilisateur.objects.creer_utilisateur("x", "x@ex.ga", "motdepasse42")
    u.actif = False
    u.save()
    assert u.is_active is False

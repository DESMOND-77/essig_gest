import pytest
from django.contrib.auth.models import AnonymousUser
from rest_framework.test import APIRequestFactory

from comptes.models import Role, UtilisateurRole
from comptes.permissions import ARole, EcritureInterditeEnLecture
from comptes.tests.factories import UtilisateurFactory

pytestmark = pytest.mark.django_db
rf = APIRequestFactory()


def _req(method, user):
    r = getattr(rf, method)("/x/")
    r.user = user
    return r


def test_arole_autorise_le_bon_code():
    u = UtilisateurFactory()
    role = Role.objects.create(code="COMPTABLE", libelle="Comptable")
    UtilisateurRole.objects.create(utilisateur=u, role=role, ecole_id=None)
    perm = ARole("COMPTABLE", "DAF")()
    assert perm.has_permission(_req("get", u), view=None) is True


def test_arole_refuse_sans_role():
    u = UtilisateurFactory()
    perm = ARole("COMPTABLE")()
    assert perm.has_permission(_req("get", u), view=None) is False


def test_arole_superuser_passe_toujours():
    u = UtilisateurFactory(is_superuser=True)
    perm = ARole("COMPTABLE")()
    assert perm.has_permission(_req("get", u), view=None) is True


def test_lecture_seule_bloque_lecriture():
    u = UtilisateurFactory()
    role = Role.objects.create(code="LECTURE", libelle="Lecture")
    UtilisateurRole.objects.create(utilisateur=u, role=role, ecole_id=None)
    perm = EcritureInterditeEnLecture()
    assert perm.has_permission(_req("get", u), view=None) is True
    assert perm.has_permission(_req("post", u), view=None) is False


def test_arole_refuse_lanonyme():
    perm = ARole("COMPTABLE")()
    assert perm.has_permission(_req("get", AnonymousUser()), view=None) is False


def test_ecriture_refuse_lanonyme():
    perm = EcritureInterditeEnLecture()
    assert perm.has_permission(_req("post", AnonymousUser()), view=None) is False


def test_ecriture_autorisee_si_lecture_plus_autre_role():
    u = UtilisateurFactory()
    for code in ("LECTURE", "SCOLARITE"):
        role = Role.objects.create(code=code, libelle=code)
        UtilisateurRole.objects.create(utilisateur=u, role=role, ecole_id=None)
    perm = EcritureInterditeEnLecture()
    assert perm.has_permission(_req("post", u), view=None) is True


def test_ecriture_refusee_sans_aucun_role():
    u = UtilisateurFactory()
    perm = EcritureInterditeEnLecture()
    assert perm.has_permission(_req("get", u), view=None) is True
    assert perm.has_permission(_req("post", u), view=None) is False

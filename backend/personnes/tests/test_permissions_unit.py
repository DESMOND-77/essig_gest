import pytest
from django.contrib.auth.models import AnonymousUser
from rest_framework.test import APIRequestFactory

from comptes.models import Role, UtilisateurRole
from comptes.tests.factories import UtilisateurFactory
from personnes.permissions import PeutEcrirePersonnes

pytestmark = pytest.mark.django_db
_rf = APIRequestFactory()


def _user_avec(*codes):
    u = UtilisateurFactory()
    for c in codes:
        r, _ = Role.objects.get_or_create(code=c, defaults={"libelle": c})
        UtilisateurRole.objects.create(utilisateur=u, role=r)
    return u


@pytest.mark.parametrize(
    "code,attendu",
    [("DIRECTION", True), ("SCOLARITE", True), ("COMPTABLE", False), ("LECTURE", False)],
)
def test_ecriture_reservee_direction_scolarite(code, attendu):
    req = _rf.post("/x")
    req.user = _user_avec(code)
    assert PeutEcrirePersonnes().has_permission(req, None) is attendu


def test_lecture_ouverte_a_tout_authentifie():
    req = _rf.get("/x")
    req.user = _user_avec("LECTURE")
    assert PeutEcrirePersonnes().has_permission(req, None) is True


def test_ecriture_refusee_a_lanonyme():
    req = _rf.post("/x")
    req.user = AnonymousUser()
    assert PeutEcrirePersonnes().has_permission(req, None) is False

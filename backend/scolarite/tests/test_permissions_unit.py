import pytest
from rest_framework.test import APIRequestFactory

from comptes.models import Role, UtilisateurRole
from comptes.tests.factories import UtilisateurFactory
from scolarite.permissions import PeutEcrireFraisEleve, PeutEcrireTarifs

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
    [("DIRECTION", True), ("DAF", False), ("COMPTABLE", False), ("SCOLARITE", False)],
)
def test_tarifs_direction_seule(code, attendu):
    req = _rf.post("/x")
    req.user = _user_avec(code)
    assert PeutEcrireTarifs().has_permission(req, None) is attendu


@pytest.mark.parametrize(
    "code,attendu",
    [("DIRECTION", True), ("DAF", True), ("COMPTABLE", True), ("SCOLARITE", False)],
)
def test_frais_eleve(code, attendu):
    req = _rf.post("/x")
    req.user = _user_avec(code)
    assert PeutEcrireFraisEleve().has_permission(req, None) is attendu


def test_lecture_ouverte():
    req = _rf.get("/x")
    req.user = _user_avec("LECTURE")
    assert PeutEcrireTarifs().has_permission(req, None) is True
    assert PeutEcrireFraisEleve().has_permission(req, None) is True

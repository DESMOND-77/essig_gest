import pytest
from rest_framework.test import APIRequestFactory

from comptes.models import Role, UtilisateurRole
from comptes.tests.factories import UtilisateurFactory
from referentiel.permissions import PeutEcrirePedagogique, PeutEcrireReferentiel

pytestmark = pytest.mark.django_db
rf = APIRequestFactory()


def _user_avec(code):
    u = UtilisateurFactory()
    r, _ = Role.objects.get_or_create(code=code, defaults={"libelle": code})
    UtilisateurRole.objects.create(utilisateur=u, role=r)
    return u


def test_lecture_ouverte_a_tout_authentifie():
    req = rf.get("/x")
    req.user = _user_avec(Role.Code.LECTURE)
    assert PeutEcrireReferentiel().has_permission(req, None) is True


def test_ecriture_referentiel_reservee_direction():
    for code, attendu in [
        (Role.Code.DIRECTION, True),
        (Role.Code.SCOLARITE, False),
        (Role.Code.LECTURE, False),
    ]:
        req = rf.post("/x")
        req.user = _user_avec(code)
        assert PeutEcrireReferentiel().has_permission(req, None) is attendu


def test_ecriture_pedagogique_direction_ou_scolarite():
    for code, attendu in [
        (Role.Code.DIRECTION, True),
        (Role.Code.SCOLARITE, True),
        (Role.Code.COMPTABLE, False),
    ]:
        req = rf.post("/x")
        req.user = _user_avec(code)
        assert PeutEcrirePedagogique().has_permission(req, None) is attendu

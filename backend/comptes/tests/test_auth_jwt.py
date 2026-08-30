import pytest
from rest_framework.test import APIClient

from comptes.tests.factories import UtilisateurFactory

pytestmark = pytest.mark.django_db
REFRESH_COOKIE = "refresh_token"


@pytest.fixture
def utilisateur():
    return UtilisateurFactory(login="compta", password="motdepasse42")


def test_login_retourne_access_et_pose_cookie_refresh(utilisateur):
    c = APIClient()
    r = c.post("/api/v1/auth/login/", {"login": "compta", "password": "motdepasse42"},
               format="json")
    assert r.status_code == 200
    assert "access" in r.data
    assert REFRESH_COOKIE in r.cookies
    cookie = r.cookies[REFRESH_COOKIE]
    assert cookie["httponly"]
    assert cookie["samesite"] == "Strict"
    assert "access" not in r.cookies  # l'access n'est jamais en cookie


def test_login_mauvais_mot_de_passe(utilisateur):
    c = APIClient()
    r = c.post("/api/v1/auth/login/", {"login": "compta", "password": "faux"},
               format="json")
    assert r.status_code == 401


def test_refresh_utilise_le_cookie(utilisateur):
    c = APIClient()
    login = c.post("/api/v1/auth/login/", {"login": "compta", "password": "motdepasse42"},
                   format="json")
    c.cookies[REFRESH_COOKIE] = login.cookies[REFRESH_COOKIE].value
    r = c.post("/api/v1/auth/refresh/")
    assert r.status_code == 200
    assert "access" in r.data


def test_refresh_sans_cookie_401():
    r = APIClient().post("/api/v1/auth/refresh/")
    assert r.status_code == 401


def test_moi_expose_le_profil(utilisateur):
    c = APIClient()
    login = c.post("/api/v1/auth/login/", {"login": "compta", "password": "motdepasse42"},
                   format="json")
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
    r = c.get("/api/v1/auth/moi/")
    assert r.status_code == 200
    assert r.data["login"] == "compta"
    assert r.data["roles"] == []


def test_logout_blackliste_le_refresh(utilisateur):
    c = APIClient()
    login = c.post("/api/v1/auth/login/", {"login": "compta", "password": "motdepasse42"},
                   format="json")
    c.cookies[REFRESH_COOKIE] = login.cookies[REFRESH_COOKIE].value
    out = c.post("/api/v1/auth/logout/")
    assert out.status_code == 205
    c.cookies[REFRESH_COOKIE] = login.cookies[REFRESH_COOKIE].value
    again = c.post("/api/v1/auth/refresh/")
    assert again.status_code == 401


def test_refresh_refuse_si_compte_desactive(utilisateur):
    c = APIClient()
    login = c.post("/api/v1/auth/login/", {"login": "compta", "password": "motdepasse42"},
                   format="json")
    c.cookies[REFRESH_COOKIE] = login.cookies[REFRESH_COOKIE].value
    utilisateur.actif = False
    utilisateur.save()
    r = c.post("/api/v1/auth/refresh/")
    assert r.status_code == 403

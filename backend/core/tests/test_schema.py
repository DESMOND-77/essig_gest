import pytest

pytestmark = pytest.mark.django_db


def test_schema_expose_les_routes_publiques(client):
    r = client.get("/api/v1/schema/?format=json")
    assert r.status_code == 200
    paths = r.json()["paths"]
    assert "/api/v1/auth/login/" in paths
    assert "/api/v1/auth/moi/" in paths
    assert "/api/v1/healthz/" in paths


def test_docs_ui_repond(client):
    assert client.get("/api/v1/docs/").status_code == 200


def test_schema_expose_les_composants_auth(client):
    schema = client.get("/api/v1/schema/?format=json").json()
    noms = set(schema.get("components", {}).get("schemas", {}))
    assert "Moi" in noms
    assert {"LoginRequete", "AccessToken"} & noms  # noms exacts selon spectacular

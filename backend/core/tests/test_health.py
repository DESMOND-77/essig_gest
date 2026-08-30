import pytest

pytestmark = pytest.mark.django_db


def test_healthz_ok(client):
    resp = client.get("/api/v1/healthz/")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "db": "ok"}

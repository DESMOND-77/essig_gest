import importlib


def test_base_expose_les_entetes_de_securite():
    from config.settings import base

    assert base.SECURE_CONTENT_TYPE_NOSNIFF is True
    assert base.X_FRAME_OPTIONS == "DENY"
    assert base.SECURE_BROWSER_XSS_FILTER is True


def test_prod_active_hsts_preload():
    prod = importlib.import_module("config.settings.prod")

    assert prod.SECURE_HSTS_PRELOAD is True
    assert prod.SECURE_HSTS_SECONDS >= 31536000
    assert prod.SECURE_SSL_REDIRECT is True


def test_database_url_est_pris_en_compte_si_defini(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite:///tmp-e1.sqlite3")
    import config.settings.base as base

    importlib.reload(base)
    assert base.DATABASES["default"]["ENGINE"] == "django.db.backends.sqlite3"
    monkeypatch.delenv("DATABASE_URL", raising=False)
    importlib.reload(base)

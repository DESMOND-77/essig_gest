# Socle applicatif SIS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettre en place le socle exécutable et déployable du SIS : monorepo, API Django/DRF avec authentification JWT et RBAC, module transverse `comptes` (utilisateurs / rôles / audit), amorce de la SPA React, conteneurisation Docker Compose et CI.

**Architecture:** API REST Django 5.2 LTS + DRF servie par Gunicorn, base MySQL 8.4, SPA React/Vite servie par Caddy (reverse-proxy + HTTPS + statiques). Authentification par JWT (`simplejwt`) : access token en mémoire côté SPA, refresh token en cookie `httpOnly`. Contrôle d'accès basé sur les rôles, appliqué exclusivement côté serveur via des classes de permission DRF. Journal d'audit alimenté par un mixin de ViewSet. Monorepo : `backend/`, `frontend/`, `infra/`.

**Tech Stack:** Python 3.13, Django 5.2 LTS, djangorestframework 3.16, djangorestframework-simplejwt, drf-spectacular, django-cors-headers, django-environ, argon2-cffi, mysqlclient, gunicorn, pytest + pytest-django + factory_boy, ruff ; React 19 + TypeScript + Vite, Tailwind CSS v4, shadcn/ui, React Router 7, TanStack Query 5, React Hook Form + Zod, openapi-typescript, Vitest + Testing Library ; MySQL 8.4, Caddy 2, Docker Compose, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-30-choix-technologies-sis-design.md` (choix techno) ; modèle de données : `docs/superpowers/specs/2026-08-29-modele-donnees-gestion-groupe-scolaire-design.md`.

## Global Constraints

- **Python 3.13** dans les conteneurs et la CI (le dev local peut utiliser 3.13+).
- **Django épinglé sur la série 5.2 LTS** (`Django>=5.2,<5.3`).
- **Base de données MySQL 8.4** exclusivement ; charset `utf8mb4`, collation `utf8mb4_unicode_ci`.
- **Préfixe d'API `/api/v1/`** pour toutes les routes.
- **Contrôle d'accès uniquement côté serveur** (classes de permission DRF) — jamais de règle de sécurité dans le front.
- **Nommage français** : `snake_case`, singulier, sans accent, pour les modèles, tables, champs (design données §D21).
- **Montants** : `DECIMAL(12,0)` (FCFA entiers) — pas utilisé dans ce plan, mais la convention est fixée.
- **Configuration par `django-environ` + fichiers `.env`** ; `.env` non versionné, `.env.example` à jour.
- **Devise** : `XAF` ; **année scolaire par défaut** : `2025-2026` (cf. `.env.example` existant).
- **Un commit par étape « Commit »** ; messages en français, préfixe Conventional Commits (`feat:`, `chore:`, `test:`, `docs:`, `build:`).
- **TDD** : test qui échoue → implémentation minimale → test qui passe → commit.

---

## File Structure

```text
backend/
  pyproject.toml            # deps + config ruff + pytest
  manage.py
  .env.example              # variables backend (copie enrichie de la racine)
  config/
    __init__.py
    settings/
      __init__.py
      base.py               # settings communs, lecture env
      dev.py                # DEBUG, hôtes locaux
      prod.py               # sécurité, hôtes prod
    urls.py                 # racine : /api/v1/ + schema
    wsgi.py
    asgi.py
  comptes/
    __init__.py
    apps.py
    models.py               # Utilisateur, Role, UtilisateurRole, JournalAudit
    managers.py             # UtilisateurManager
    permissions.py          # ARole, EstLecteur, ...
    audit.py                # AuditLogMixin
    serializers.py          # UtilisateurSerializer, ...
    views.py                # LoginView, RefreshView, LogoutView, MoiView, UtilisateurViewSet
    urls.py                 # routes du module
    admin.py
    migrations/
    tests/
      __init__.py
      factories.py          # factory_boy
      test_utilisateur_model.py
      test_auth_jwt.py
      test_permissions.py
      test_audit.py
  core/
    __init__.py
    views.py                # HealthView
    urls.py
    tests/
      test_health.py
frontend/
  package.json
  vite.config.ts
  tsconfig.json
  index.html
  .env.example
  src/
    main.tsx
    App.tsx
    index.css               # @import "tailwindcss"
    api/
      client.ts             # fetch wrapper + refresh silencieux
      client.test.ts
      schema.d.ts           # généré par openapi-typescript (non édité à la main)
    auth/
      AuthContext.tsx
      AuthContext.test.tsx
      LoginPage.tsx
      LoginPage.test.tsx
      RequireAuth.tsx
    components/ui/           # shadcn (généré)
    lib/utils.ts            # shadcn
    routes.tsx
  vitest.config.ts
  vitest.setup.ts
infra/
  docker-compose.yml
  caddy.Dockerfile          # multi-stage : build front + image Caddy
  Caddyfile
  backup.sh                 # mysqldump chiffré + rclone (documenté, non planifié ici)
.github/
  workflows/
    ci.yml
```

---

## Task 1: Squelette monorepo + outillage backend

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/.env.example`
- Create: `backend/README.md`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: rien.
- Produces: layout `backend/`, commandes `ruff check backend`, `pytest` (config présente), dépendances déclarées dans `backend/pyproject.toml`.

- [ ] **Step 1: Créer `backend/pyproject.toml`**

```toml
[project]
name = "mlamine-backend"
version = "0.1.0"
description = "API du système de gestion du groupe scolaire mlamine"
requires-python = ">=3.13"
dependencies = [
    "Django>=5.2,<5.3",
    "djangorestframework>=3.16,<3.17",
    "djangorestframework-simplejwt>=5.3,<6",
    "drf-spectacular>=0.28,<0.29",
    "django-cors-headers>=4.4,<5",
    "django-environ>=0.12,<0.13",
    "django-filter>=25,<26",
    "argon2-cffi>=23,<24",
    "mysqlclient>=2.2,<3",
    "gunicorn>=23,<24",
    "django-storages>=1.14,<2",
]

[project.optional-dependencies]
dev = [
    "pytest>=8,<9",
    "pytest-django>=4.9,<5",
    "factory-boy>=3.3,<4",
    "ruff>=0.7,<1",
]

[tool.ruff]
target-version = "py313"
line-length = 100
extend-exclude = ["*/migrations/*"]

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "DJ"]

[tool.pytest.ini_options]
DJANGO_SETTINGS_MODULE = "config.settings.dev"
python_files = ["test_*.py"]
addopts = "-ra"
```

- [ ] **Step 2: Créer `backend/.env.example`**

```dotenv
# Backend — copier en backend/.env pour le dev local
DJANGO_SETTINGS_MODULE=config.settings.dev
DJANGO_SECRET_KEY=dev-only-change-me
DJANGO_DEBUG=true
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

# Base MySQL 8.4
DB_NAME=mlamine
DB_USER=mlamine
DB_PASSWORD=mlamine
DB_HOST=127.0.0.1
DB_PORT=3306

# CORS : origine de la SPA en dev
CORS_ALLOWED_ORIGINS=http://localhost:5173

# JWT
JWT_ACCESS_MINUTES=15
JWT_REFRESH_DAYS=7
JWT_REFRESH_COOKIE_SECURE=false

# Constantes métier (cf. .env.example racine)
APP_CURRENCY=XAF
APP_ANNEE_SCOLAIRE=2025-2026
```

- [ ] **Step 3: Créer `backend/README.md`**

```markdown
# Backend `mlamine`

API Django 5.2 LTS + DRF. Base MySQL 8.4.

## Dev local

    python -m venv .venv && source .venv/bin/activate
    pip install -e ".[dev]"
    cp .env.example .env          # ajuster DB_*
    python manage.py migrate
    python manage.py runserver

## Tests

    pytest

## Lint

    ruff check .
```

- [ ] **Step 4: Ajouter les exclusions au `.gitignore` racine**

Ajouter à la fin de `.gitignore` :

```gitignore
# --- backend ---
backend/.env
backend/.venv/
__pycache__/
*.pyc
.pytest_cache/
# --- frontend ---
frontend/node_modules/
frontend/dist/
frontend/.env
```

- [ ] **Step 5: Commit**

```bash
git add backend/pyproject.toml backend/.env.example backend/README.md .gitignore
git commit -m "chore: squelette backend et outillage (pyproject, ruff, pytest)"
```

---

## Task 2: Projet Django, settings scindés, connexion MySQL, endpoint santé

**Files:**
- Create: `backend/manage.py`, `backend/config/__init__.py`, `backend/config/settings/__init__.py`, `backend/config/settings/base.py`, `backend/config/settings/dev.py`, `backend/config/settings/prod.py`, `backend/config/urls.py`, `backend/config/wsgi.py`, `backend/config/asgi.py`
- Create: `backend/core/__init__.py`, `backend/core/apps.py`, `backend/core/views.py`, `backend/core/urls.py`
- Test: `backend/core/tests/__init__.py`, `backend/core/tests/test_health.py`

**Interfaces:**
- Consumes: dépendances de Task 1.
- Produces:
  - settings importables : `config.settings.dev`, `config.settings.prod`
  - route `GET /api/v1/healthz/` → `200 {"status": "ok", "db": "ok"}` ; `503` si la base est injoignable
  - `REST_FRAMEWORK` configuré (auth JWT par défaut, `IsAuthenticated` par défaut)

- [ ] **Step 1: Générer le projet Django**

Run :
```bash
cd backend && django-admin startproject config . && cd ..
```
Puis déplacer les settings : créer `backend/config/settings/` et y répartir le contenu (voir steps suivants). Supprimer `backend/config/settings.py`.

- [ ] **Step 2: Écrire `backend/config/settings/base.py`**

```python
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("DJANGO_SECRET_KEY")
DEBUG = env.bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=[])

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "drf_spectacular",
    "django_filters",
    "core",
    "comptes",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": env("DB_NAME"),
        "USER": env("DB_USER"),
        "PASSWORD": env("DB_PASSWORD"),
        "HOST": env("DB_HOST", default="127.0.0.1"),
        "PORT": env("DB_PORT", default="3306"),
        "OPTIONS": {
            "charset": "utf8mb4",
            "sql_mode": "STRICT_TRANS_TABLES",
        },
    }
}

AUTH_USER_MODEL = "comptes.Utilisateur"

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
]

LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "Africa/Libreville"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_FILTER_BACKENDS": ("django_filters.rest_framework.DjangoFilterBackend",),
    "DEFAULT_THROTTLE_RATES": {"auth": "10/min"},
}

from datetime import timedelta  # noqa: E402

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env.int("JWT_ACCESS_MINUTES", default=15)),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env.int("JWT_REFRESH_DAYS", default=7)),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_SECURE = env.bool("JWT_REFRESH_COOKIE_SECURE", default=True)
REFRESH_COOKIE_SAMESITE = "Strict"
REFRESH_COOKIE_PATH = "/api/v1/auth/"

SPECTACULAR_SETTINGS = {
    "TITLE": "API mlamine",
    "DESCRIPTION": "Système de gestion du groupe scolaire",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])
CORS_ALLOW_CREDENTIALS = True
```

- [ ] **Step 3: Écrire `dev.py` et `prod.py`**

`backend/config/settings/dev.py` :
```python
from .base import *  # noqa: F401,F403

DEBUG = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "testserver"]
```

`backend/config/settings/prod.py` :
```python
from .base import *  # noqa: F401,F403

DEBUG = False
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
```

- [ ] **Step 4: Écrire l'endpoint santé (test d'abord)**

`backend/core/tests/test_health.py` :
```python
import pytest

pytestmark = pytest.mark.django_db


def test_healthz_ok(client):
    resp = client.get("/api/v1/healthz/")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "db": "ok"}
```

- [ ] **Step 5: Lancer le test — il échoue**

Run : `cd backend && pytest core/tests/test_health.py -v`
Expected : FAIL (404 — route absente).

- [ ] **Step 6: Implémenter `core`**

`backend/core/apps.py` :
```python
from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "core"
```

`backend/core/views.py` :
```python
from django.db import connection
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []

    def get(self, request):
        try:
            with connection.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
        except Exception:
            return Response({"status": "ok", "db": "down"}, status=503)
        return Response({"status": "ok", "db": "ok"})
```

`backend/core/urls.py` :
```python
from django.urls import path

from .views import HealthView

urlpatterns = [path("healthz/", HealthView.as_view(), name="healthz")]
```

- [ ] **Step 7: Câbler `config/urls.py`**

```python
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

api_v1 = [
    path("", include("core.urls")),
    path("auth/", include("comptes.urls")),
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    path("docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include((api_v1, "v1"))),
]
```

> Note : `comptes.urls` est créé en Task 4. Jusque-là, commenter la ligne `auth/` ou créer `backend/comptes/urls.py` avec `urlpatterns = []`.

- [ ] **Step 8: Lancer le test — il passe**

Run : `cd backend && pytest core/tests/test_health.py -v`
Expected : PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/config backend/core backend/manage.py
git commit -m "feat: projet Django, settings scindés, connexion MySQL, endpoint /healthz"
```

---

## Task 3: Modèle `Utilisateur` personnalisé + manager + migration

**Files:**
- Create: `backend/comptes/__init__.py`, `backend/comptes/apps.py`, `backend/comptes/managers.py`, `backend/comptes/models.py`, `backend/comptes/admin.py`
- Create: `backend/comptes/tests/__init__.py`, `backend/comptes/tests/factories.py`, `backend/comptes/tests/test_utilisateur_model.py`
- Create: `backend/comptes/migrations/__init__.py` (+ `0001_initial` généré)

**Interfaces:**
- Consumes: `AUTH_USER_MODEL = "comptes.Utilisateur"` (Task 2).
- Produces:
  - modèle `comptes.Utilisateur(AbstractBaseUser, PermissionsMixin)` — `USERNAME_FIELD = "login"`, champs : `login` (unique, `VARCHAR(60)`), `email` (`VARCHAR(120)`), `password` (`db_column="mot_de_passe_hash"`), `actif` (bool, défaut `True`), `derniere_connexion` (datetime null), `date_creation` (auto). `is_active` est une property mappée sur `actif`.
  - `UtilisateurManager` : `creer_utilisateur(login, email, password=None, **extra)`, `creer_superutilisateur(login, email, password)`
  - `UtilisateurFactory` (factory_boy) pour les tests

- [ ] **Step 1: `apps.py` + `managers.py`**

`backend/comptes/apps.py` :
```python
from django.apps import AppConfig


class ComptesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "comptes"
```

`backend/comptes/managers.py` :
```python
from django.contrib.auth.base_user import BaseUserManager


class UtilisateurManager(BaseUserManager):
    use_in_migrations = True

    def creer_utilisateur(self, login, email, password=None, **extra):
        if not login:
            raise ValueError("Le login est obligatoire.")
        email = self.normalize_email(email)
        utilisateur = self.model(login=login, email=email, **extra)
        utilisateur.set_password(password)
        utilisateur.save(using=self._db)
        return utilisateur

    def creer_superutilisateur(self, login, email, password):
        return self.creer_utilisateur(
            login, email, password, is_staff=True, is_superuser=True
        )
```

- [ ] **Step 2: Écrire le test du modèle (échoue)**

`backend/comptes/tests/test_utilisateur_model.py` :
```python
import pytest

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
    with pytest.raises(Exception):
        Utilisateur.objects.creer_utilisateur("jdupont", "autre@ex.ga", "motdepasse42")


def test_superutilisateur():
    su = Utilisateur.objects.creer_superutilisateur("admin", "a@ex.ga", "motdepasse42")
    assert su.is_staff and su.is_superuser


def test_desactivation_via_actif():
    u = Utilisateur.objects.creer_utilisateur("x", "x@ex.ga", "motdepasse42")
    u.actif = False
    u.save()
    assert u.is_active is False
```

- [ ] **Step 3: Lancer — échoue**

Run : `cd backend && pytest comptes/tests/test_utilisateur_model.py -v`
Expected : FAIL (`comptes.models` inexistant / table absente).

- [ ] **Step 4: Écrire `models.py`**

```python
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models

from .managers import UtilisateurManager


class Utilisateur(AbstractBaseUser, PermissionsMixin):
    login = models.CharField(max_length=60, unique=True)
    email = models.CharField(max_length=120)
    password = models.CharField(max_length=255, db_column="mot_de_passe_hash")
    actif = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    derniere_connexion = models.DateTimeField(null=True, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    objects = UtilisateurManager()

    USERNAME_FIELD = "login"
    REQUIRED_FIELDS = ["email"]

    class Meta:
        db_table = "utilisateur"

    def __str__(self):
        return self.login

    @property
    def is_active(self):
        return self.actif

    @is_active.setter
    def is_active(self, value):
        self.actif = value
```

`backend/comptes/admin.py` :
```python
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Utilisateur

admin.site.register(Utilisateur, UserAdmin)
```

- [ ] **Step 5: Factory**

`backend/comptes/tests/factories.py` :
```python
import factory

from comptes.models import Utilisateur


class UtilisateurFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Utilisateur
        skip_postgeneration_save = True

    login = factory.Sequence(lambda n: f"user{n}")
    email = factory.LazyAttribute(lambda o: f"{o.login}@ex.ga")

    @factory.post_generation
    def password(obj, create, extracted, **kwargs):
        obj.set_password(extracted or "motdepasse42")
        if create:
            obj.save()
```

- [ ] **Step 6: Générer et appliquer la migration**

Run :
```bash
cd backend && python manage.py makemigrations comptes && python manage.py migrate
```
Expected : `comptes/migrations/0001_initial.py` créé ; `migrate` OK.

- [ ] **Step 7: Lancer les tests — passent**

Run : `cd backend && pytest comptes/tests/test_utilisateur_model.py -v`
Expected : PASS (4 tests).

- [ ] **Step 8: Commit**

```bash
git add backend/comptes
git commit -m "feat: modèle Utilisateur personnalisé (login, Argon2) + manager + migration"
```

---

## Task 4: Authentification JWT avec refresh token en cookie httpOnly

**Files:**
- Create: `backend/comptes/serializers.py`, `backend/comptes/views.py`, `backend/comptes/urls.py`
- Test: `backend/comptes/tests/test_auth_jwt.py`

**Interfaces:**
- Consumes: `Utilisateur` (Task 3), `SIMPLE_JWT` + `REFRESH_COOKIE_*` (Task 2).
- Produces (routes sous `/api/v1/auth/`) :
  - `POST login/` — corps `{"login", "password"}` → `200 {"access": "<jwt>"}` + `Set-Cookie: refresh_token=<jwt>; HttpOnly; Path=/api/v1/auth/; SameSite=Strict`. `401` si identifiants invalides.
  - `POST refresh/` — lit le cookie `refresh_token` → `200 {"access": "<jwt>"}` + rotation du cookie. `401` si cookie absent/invalide.
  - `POST logout/` — blacklist le refresh courant, supprime le cookie → `205`.
  - `GET moi/` — `200 {"id", "login", "email", "roles": [...]}` pour l'utilisateur authentifié.

- [ ] **Step 1: Écrire les tests (échouent)**

`backend/comptes/tests/test_auth_jwt.py` :
```python
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
```

- [ ] **Step 2: Lancer — échoue**

Run : `cd backend && pytest comptes/tests/test_auth_jwt.py -v`
Expected : FAIL (routes absentes).

- [ ] **Step 3: Serializers**

`backend/comptes/serializers.py` :
```python
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class LoginSerializer(TokenObtainPairSerializer):
    username_field = "login"


class MoiSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    login = serializers.CharField(read_only=True)
    email = serializers.CharField(read_only=True)
    roles = serializers.SerializerMethodField()

    def get_roles(self, obj):
        return [
            {"code": ur.role.code, "ecole_id": ur.ecole_id}
            for ur in obj.roles.select_related("role").all()
        ]
```

> `obj.roles` est le related_name défini en Task 5 (`UtilisateurRole.utilisateur`). Jusqu'à Task 5, `get_roles` renvoie `[]` via `getattr(obj, "roles", None)` — remplacer par le code ci-dessus une fois Task 5 faite. Pour livrer Task 4 seule, utiliser :
> ```python
>     def get_roles(self, obj):
>         mgr = getattr(obj, "roles", None)
>         if mgr is None:
>             return []
>         return [{"code": ur.role.code, "ecole_id": ur.ecole_id}
>                 for ur in mgr.select_related("role").all()]
> ```

- [ ] **Step 4: Vues**

`backend/comptes/views.py` :
```python
from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import LoginSerializer, MoiSerializer


def _pose_cookie_refresh(response, refresh_value):
    response.set_cookie(
        settings.REFRESH_COOKIE_NAME,
        str(refresh_value),
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
        path=settings.REFRESH_COOKIE_PATH,
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
    )


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except Exception:
            return Response({"detail": "Identifiants invalides."},
                            status=status.HTTP_401_UNAUTHORIZED)
        data = serializer.validated_data
        resp = Response({"access": data["access"]})
        _pose_cookie_refresh(resp, data["refresh"])
        return resp


class RefreshView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        raw = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if not raw:
            return Response({"detail": "Refresh absent."},
                            status=status.HTTP_401_UNAUTHORIZED)
        try:
            token = RefreshToken(raw)
            access = str(token.access_token)
            if settings.SIMPLE_JWT["ROTATE_REFRESH_TOKENS"]:
                token.blacklist()
                new_refresh = RefreshToken.for_user(
                    _user_from_token(token)
                )
            else:
                new_refresh = token
        except TokenError:
            return Response({"detail": "Refresh invalide."},
                            status=status.HTTP_401_UNAUTHORIZED)
        resp = Response({"access": access})
        _pose_cookie_refresh(resp, new_refresh)
        return resp


def _user_from_token(token):
    from django.contrib.auth import get_user_model

    return get_user_model().objects.get(pk=token["user_id"])


class LogoutView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []

    def post(self, request):
        raw = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if raw:
            try:
                RefreshToken(raw).blacklist()
            except TokenError:
                pass
        resp = Response(status=status.HTTP_205_RESET_CONTENT)
        resp.delete_cookie(settings.REFRESH_COOKIE_NAME, path=settings.REFRESH_COOKIE_PATH)
        return resp


class MoiView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(MoiSerializer(request.user).data)
```

- [ ] **Step 5: Routes**

`backend/comptes/urls.py` :
```python
from django.urls import path

from .views import LoginView, LogoutView, MoiView, RefreshView

urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    path("refresh/", RefreshView.as_view(), name="refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("moi/", MoiView.as_view(), name="moi"),
]
```

- [ ] **Step 6: Lancer les tests — passent**

Run : `cd backend && pytest comptes/tests/test_auth_jwt.py -v`
Expected : PASS (6 tests).

- [ ] **Step 7: Commit**

```bash
git add backend/comptes/serializers.py backend/comptes/views.py backend/comptes/urls.py backend/comptes/tests/test_auth_jwt.py backend/config/urls.py
git commit -m "feat: auth JWT (login/refresh/logout/moi), refresh token en cookie httpOnly"
```

---

## Task 5: Rôles, affectations scopées, classes de permission DRF

**Files:**
- Modify: `backend/comptes/models.py` (ajout `Role`, `UtilisateurRole`)
- Create: `backend/comptes/permissions.py`
- Modify: `backend/comptes/serializers.py` (`get_roles` définitif)
- Test: `backend/comptes/tests/test_permissions.py`
- Migration : `backend/comptes/migrations/0002_role_utilisateurrole.py`

**Interfaces:**
- Consumes: `Utilisateur` (Task 3).
- Produces:
  - `Role(code)` — `code` parmi `COMPTABLE, DAF, DIRECTION, SCOLARITE, LECTURE` (`CharField` + `choices`), `libelle`. `db_table = "role"`.
  - `UtilisateurRole(utilisateur, role, ecole_id)` — `ecole_id` = `PositiveIntegerField(null=True)` (FK réelle vers `ecole` ajoutée en Phase 2 ; ici entier nullable = portée groupe si `NULL`). `related_name="roles"` sur `utilisateur`. `unique_together = (utilisateur, role, ecole_id)`. `db_table = "utilisateur_role"`.
  - `comptes.permissions.ARole(*codes)` — factory retournant une classe de permission DRF : accès autorisé si `request.user` porte l'un des `codes` (à n'importe quelle portée) ou `is_superuser`.
  - `comptes.permissions.EcritureInterditeEnLecture` — permission : méthodes sûres autorisées pour tout authentifié ; méthodes d'écriture refusées si le seul rôle est `LECTURE`.

- [ ] **Step 1: Écrire les tests (échouent)**

`backend/comptes/tests/test_permissions.py` :
```python
import pytest
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
```

- [ ] **Step 2: Lancer — échoue**

Run : `cd backend && pytest comptes/tests/test_permissions.py -v`
Expected : FAIL (modèles / module `permissions` absents).

- [ ] **Step 3: Ajouter les modèles**

Ajouter à `backend/comptes/models.py` :
```python
class Role(models.Model):
    class Code(models.TextChoices):
        COMPTABLE = "COMPTABLE", "Comptable"
        DAF = "DAF", "Directeur administratif et financier"
        DIRECTION = "DIRECTION", "Direction"
        SCOLARITE = "SCOLARITE", "Scolarité"
        LECTURE = "LECTURE", "Lecture seule"

    code = models.CharField(max_length=20, choices=Code.choices, unique=True)
    libelle = models.CharField(max_length=80)

    class Meta:
        db_table = "role"

    def __str__(self):
        return self.code


class UtilisateurRole(models.Model):
    utilisateur = models.ForeignKey(
        "comptes.Utilisateur", on_delete=models.CASCADE, related_name="roles"
    )
    role = models.ForeignKey(Role, on_delete=models.RESTRICT)
    ecole_id = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        db_table = "utilisateur_role"
        constraints = [
            models.UniqueConstraint(
                fields=["utilisateur", "role", "ecole_id"],
                name="uniq_utilisateur_role_ecole",
            )
        ]
```

- [ ] **Step 4: `permissions.py`**

```python
from rest_framework.permissions import SAFE_METHODS, BasePermission


def _codes(user):
    if not user or not user.is_authenticated:
        return set()
    return {ur.role.code for ur in user.roles.select_related("role").all()}


def ARole(*codes):
    autorises = set(codes)

    class _ARole(BasePermission):
        message = "Rôle insuffisant."

        def has_permission(self, request, view):
            u = request.user
            if u and u.is_superuser:
                return True
            return bool(autorises & _codes(u))

    return _ARole


class EcritureInterditeEnLecture(BasePermission):
    message = "Compte en lecture seule."

    def has_permission(self, request, view):
        u = request.user
        if not u or not u.is_authenticated:
            return False
        if request.method in SAFE_METHODS or u.is_superuser:
            return True
        codes = _codes(u)
        return codes != {"LECTURE"} and len(codes) > 0
```

- [ ] **Step 5: `get_roles` définitif dans `serializers.py`**

Remplacer le corps provisoire par :
```python
    def get_roles(self, obj):
        return [
            {"code": ur.role.code, "ecole_id": ur.ecole_id}
            for ur in obj.roles.select_related("role").all()
        ]
```

- [ ] **Step 6: Migration**

Run : `cd backend && python manage.py makemigrations comptes && python manage.py migrate`
Expected : `0002_...` créée et appliquée.

- [ ] **Step 7: Lancer les tests — passent**

Run : `cd backend && pytest comptes/tests/ -v`
Expected : PASS (tous : modèle + auth + permissions).

- [ ] **Step 8: Commit**

```bash
git add backend/comptes
git commit -m "feat: rôles scopés par école + classes de permission DRF (RBAC serveur)"
```

---

## Task 6: Journal d'audit + mixin de ViewSet

**Files:**
- Modify: `backend/comptes/models.py` (ajout `JournalAudit`)
- Create: `backend/comptes/audit.py`
- Test: `backend/comptes/tests/test_audit.py`
- Migration : `0003_journalaudit`

**Interfaces:**
- Consumes: `Utilisateur` (Task 3).
- Produces:
  - `JournalAudit(utilisateur, action, table_cible, ligne_id, valeurs_avant, valeurs_apres, date, ip)` — `action` ∈ `CREATION, MODIFICATION, SUPPRESSION` ; `valeurs_avant`/`valeurs_apres` = `models.JSONField(null=True)` ; `db_table = "journal_audit"` ; index `(table_cible, ligne_id)` et `(utilisateur, date)`.
  - `comptes.audit.AuditLogMixin` — mixin pour `ModelViewSet` : surcharge `perform_create` / `perform_update` / `perform_destroy` pour écrire une ligne `JournalAudit`. `table_cible = self.get_queryset().model._meta.db_table`. Snapshot via `model_to_dict` sérialisé JSON-safe (`json.loads(json.dumps(..., default=str))`).

- [ ] **Step 1: Écrire le test (échoue)**

`backend/comptes/tests/test_audit.py` :
```python
import pytest
from django.db import models
from rest_framework import viewsets
from rest_framework.routers import SimpleRouter
from rest_framework.test import APIClient

from comptes.audit import AuditLogMixin
from comptes.models import JournalAudit, Role
from comptes.serializers import serializers
from comptes.tests.factories import UtilisateurFactory

pytestmark = pytest.mark.django_db


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["id", "code", "libelle"]


class RoleViewSet(AuditLogMixin, viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes: list = []


router = SimpleRouter()
router.register("roles-test", RoleViewSet, basename="roles-test")


@pytest.fixture
def urlconf(settings):
    module = type("m", (), {"urlpatterns": router.urls})
    settings.ROOT_URLCONF = module
    return module


def test_creation_ecrit_une_ligne_audit(urlconf):
    c = APIClient()
    c.force_authenticate(UtilisateurFactory())
    r = c.post("/roles-test/", {"code": "DAF", "libelle": "DAF"}, format="json")
    assert r.status_code == 201
    ligne = JournalAudit.objects.get()
    assert ligne.action == "CREATION"
    assert ligne.table_cible == "role"
    assert ligne.valeurs_apres["code"] == "DAF"
    assert ligne.valeurs_avant is None


def test_suppression_ecrit_avant(urlconf):
    role = Role.objects.create(code="DAF", libelle="DAF")
    c = APIClient()
    c.force_authenticate(UtilisateurFactory())
    r = c.delete(f"/roles-test/{role.pk}/")
    assert r.status_code == 204
    ligne = JournalAudit.objects.get(action="SUPPRESSION")
    assert ligne.valeurs_avant["code"] == "DAF"
    assert ligne.valeurs_apres is None
```

- [ ] **Step 2: Lancer — échoue**

Run : `cd backend && pytest comptes/tests/test_audit.py -v`
Expected : FAIL (`comptes.audit` absent).

- [ ] **Step 3: Modèle `JournalAudit`**

Ajouter à `backend/comptes/models.py` :
```python
class JournalAudit(models.Model):
    class Action(models.TextChoices):
        CREATION = "CREATION"
        MODIFICATION = "MODIFICATION"
        SUPPRESSION = "SUPPRESSION"

    utilisateur = models.ForeignKey(
        "comptes.Utilisateur", on_delete=models.SET_NULL, null=True
    )
    action = models.CharField(max_length=20, choices=Action.choices)
    table_cible = models.CharField(max_length=60)
    ligne_id = models.BigIntegerField()
    valeurs_avant = models.JSONField(null=True)
    valeurs_apres = models.JSONField(null=True)
    date = models.DateTimeField(auto_now_add=True)
    ip = models.CharField(max_length=45, null=True, blank=True)

    class Meta:
        db_table = "journal_audit"
        indexes = [
            models.Index(fields=["table_cible", "ligne_id"]),
            models.Index(fields=["utilisateur", "date"]),
        ]
```

- [ ] **Step 4: `audit.py`**

```python
import json

from django.forms.models import model_to_dict

from .models import JournalAudit


def _snapshot(instance):
    brut = model_to_dict(instance)
    brut["id"] = instance.pk
    return json.loads(json.dumps(brut, default=str))


def _ip(request):
    fwd = request.META.get("HTTP_X_FORWARDED_FOR")
    return fwd.split(",")[0].strip() if fwd else request.META.get("REMOTE_ADDR")


class AuditLogMixin:
    def _ecrire_audit(self, action, instance, avant=None, apres=None):
        JournalAudit.objects.create(
            utilisateur=self.request.user if self.request.user.is_authenticated else None,
            action=action,
            table_cible=self.get_queryset().model._meta.db_table,
            ligne_id=instance.pk,
            valeurs_avant=avant,
            valeurs_apres=apres,
            ip=_ip(self.request),
        )

    def perform_create(self, serializer):
        instance = serializer.save()
        self._ecrire_audit("CREATION", instance, apres=_snapshot(instance))

    def perform_update(self, serializer):
        avant = _snapshot(serializer.instance)
        instance = serializer.save()
        self._ecrire_audit("MODIFICATION", instance, avant=avant, apres=_snapshot(instance))

    def perform_destroy(self, instance):
        avant = _snapshot(instance)
        pk = instance.pk
        instance.delete()
        instance.pk = pk
        self._ecrire_audit("SUPPRESSION", instance, avant=avant)
```

- [ ] **Step 5: Migration + tests**

Run :
```bash
cd backend && python manage.py makemigrations comptes && python manage.py migrate
pytest comptes/tests/test_audit.py -v
```
Expected : migration OK ; 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/comptes
git commit -m "feat: journal d'audit + AuditLogMixin (avant/après JSON, IP)"
```

---

## Task 7: Schéma OpenAPI + Swagger UI + test de contrat

**Files:**
- Test: `backend/core/tests/test_schema.py`
- Modify: `backend/config/urls.py` (déjà câblé en Task 2 — vérifier)

**Interfaces:**
- Consumes: routes des Tasks 4–6, `drf-spectacular` (Task 2).
- Produces : `GET /api/v1/schema/` → `200`, `content-type: application/vnd.oai.openapi` ou `application/yaml`, corps OpenAPI 3 listant `/api/v1/auth/login/`, `/api/v1/auth/moi/`, `/api/v1/healthz/`. `GET /api/v1/docs/` → `200` (HTML Swagger).

- [ ] **Step 1: Test (échoue si régression)**

`backend/core/tests/test_schema.py` :
```python
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
```

- [ ] **Step 2: Lancer**

Run : `cd backend && pytest core/tests/test_schema.py -v`
Expected : PASS si Task 2 a bien câblé `schema/` + `docs/` ; sinon compléter `config/urls.py` (voir Task 2 Step 7) puis relancer.

- [ ] **Step 3: Vérifier l'absence d'avertissements bloquants**

Run : `cd backend && python manage.py spectacular --file /tmp/schema.yml`
Expected : fichier généré ; les warnings `drf-spectacular` sont acceptables à ce stade (endpoints APIView simples). Aucun `Error`.

- [ ] **Step 4: Commit**

```bash
git add backend/core/tests/test_schema.py backend/config/urls.py
git commit -m "test: contrat OpenAPI expose auth + healthz ; Swagger UI accessible"
```

---

## Task 8: Conteneurisation — Docker Compose (db, web, caddy)

**Files:**
- Create: `backend/Dockerfile`, `backend/.dockerignore`
- Create: `infra/docker-compose.yml`, `infra/caddy.Dockerfile`, `infra/Caddyfile`, `infra/backup.sh`
- Create: `infra/README.md`
- Modify: `.env.example` (racine) — ajouter les variables compose

**Interfaces:**
- Consumes: backend Tasks 2–7, frontend Task 9 (build via `caddy.Dockerfile`).
- Produces :
  - `docker compose -f infra/docker-compose.yml up -d` démarre `db` (MySQL 8.4), `web` (Gunicorn, `config.settings.prod`), `caddy` (sert le build React + proxie `/api` et `/admin` vers `web:8000`).
  - `curl -k https://localhost/api/v1/healthz/` → `200`.
  - Migrations jouées au démarrage de `web` (entrypoint).

- [ ] **Step 1: `backend/Dockerfile`**

```dockerfile
FROM python:3.13-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential default-libmysqlclient-dev pkg-config \
      libpango-1.0-0 libpangocairo-1.0-0 libcairo2 \
    && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml .
RUN pip install --no-cache-dir ".[dev]"
COPY . .
RUN python -c "import compileall; compileall.compile_dir('.', quiet=1)"
EXPOSE 8000
CMD ["sh", "-c", "python manage.py migrate --noinput && \
     python manage.py collectstatic --noinput && \
     gunicorn config.wsgi:application -b 0.0.0.0:8000 -w 3"]
```

- [ ] **Step 2: `backend/.dockerignore`**

```gitignore
.venv/
__pycache__/
*.pyc
.pytest_cache/
.env
staticfiles/
```

- [ ] **Step 3: `infra/caddy.Dockerfile`** (contexte de build = racine du dépôt)

```dockerfile
FROM node:22-slim AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM caddy:2
COPY --from=build /app/dist /srv
COPY infra/Caddyfile /etc/caddy/Caddyfile
```

- [ ] **Step 4: `infra/Caddyfile`**

```caddyfile
{$SITE_ADDRESS:localhost} {
	encode gzip

	handle_path /api/* {
		reverse_proxy web:8000
	}
	handle /admin/* {
		reverse_proxy web:8000
	}
	handle /static/* {
		reverse_proxy web:8000
	}

	handle {
		root * /srv
		try_files {path} /index.html
		file_server
	}
}
```

- [ ] **Step 5: `infra/docker-compose.yml`**

```yaml
name: mlamine

services:
  db:
    image: mysql:8.4
    environment:
      MYSQL_DATABASE: ${DB_NAME}
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASSWORD}
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
    command: ["--character-set-server=utf8mb4", "--collation-server=utf8mb4_unicode_ci"]
    volumes:
      - db_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-p${DB_ROOT_PASSWORD}"]
      interval: 5s
      timeout: 5s
      retries: 20

  web:
    build:
      context: ../backend
    environment:
      DJANGO_SETTINGS_MODULE: config.settings.prod
      DJANGO_SECRET_KEY: ${DJANGO_SECRET_KEY}
      DJANGO_DEBUG: "false"
      DJANGO_ALLOWED_HOSTS: ${DJANGO_ALLOWED_HOSTS}
      DB_NAME: ${DB_NAME}
      DB_USER: ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}
      DB_HOST: db
      DB_PORT: "3306"
      CORS_ALLOWED_ORIGINS: ${CORS_ALLOWED_ORIGINS}
      JWT_REFRESH_COOKIE_SECURE: "true"
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - media:/app/media
      - static:/app/staticfiles

  caddy:
    build:
      context: ..
      dockerfile: infra/caddy.Dockerfile
    environment:
      SITE_ADDRESS: ${SITE_ADDRESS}
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - web
    volumes:
      - static:/srv/static
      - caddy_data:/data
      - caddy_config:/config

volumes:
  db_data:
  media:
  static:
  caddy_data:
  caddy_config:
```

- [ ] **Step 6: Ajouter les variables au `.env.example` racine**

Ajouter :
```dotenv
# --- Déploiement Docker Compose (infra/docker-compose.yml) ---
SITE_ADDRESS=localhost
DJANGO_SECRET_KEY=change-me-en-prod
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
DB_NAME=mlamine
DB_USER=mlamine
DB_PASSWORD=change-me
DB_ROOT_PASSWORD=change-me-root
CORS_ALLOWED_ORIGINS=https://localhost
```

- [ ] **Step 7: `infra/backup.sh`** (script de sauvegarde, exécuté par cron hôte — non planifié ici)

```bash
#!/usr/bin/env sh
set -eu
# Sauvegarde chiffrée de la base + envoi hors-site.
# Prérequis hôte : age, rclone (remote "offsite" configuré).
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="/tmp/mlamine-${STAMP}.sql.gz.age"
docker compose -f "$(dirname "$0")/docker-compose.yml" exec -T db \
  sh -c 'exec mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines "$MYSQL_DATABASE"' \
  | gzip | age -r "$AGE_RECIPIENT" -o "$OUT"
rclone copy "$OUT" offsite:mlamine-backups/
find /tmp -name 'mlamine-*.sql.gz.age' -mtime +2 -delete
echo "Sauvegarde $OUT poussée."
```

- [ ] **Step 8: `infra/README.md`**

```markdown
# Déploiement

## Premier démarrage (VPS)

    cp ../.env.example ../.env      # renseigner secrets + SITE_ADDRESS (domaine réel)
    docker compose -f docker-compose.yml up -d --build
    docker compose exec web python manage.py createsuperuser

`SITE_ADDRESS` = domaine public → Caddy obtient un certificat Let's Encrypt automatiquement.
En local, garder `localhost` (certificat interne, utiliser `curl -k`).

## Mise à jour

    git pull
    docker compose -f docker-compose.yml up -d --build

Les migrations sont jouées automatiquement au démarrage du service `web`.

## Sauvegardes

`backup.sh` (cron hôte, quotidien). Restauration : voir en tête du script + tester
mensuellement sur une base jetable.
```

- [ ] **Step 9: Vérifier le démarrage de bout en bout**

Run :
```bash
cp .env.example .env
docker compose -f infra/docker-compose.yml up -d --build
sleep 20
curl -sk https://localhost/api/v1/healthz/
```
Expected : `{"status": "ok", "db": "ok"}`.
Puis : `docker compose -f infra/docker-compose.yml down`.

- [ ] **Step 10: Commit**

```bash
git add backend/Dockerfile backend/.dockerignore infra/ .env.example
git commit -m "build: conteneurisation Docker Compose (MySQL 8.4, Gunicorn, Caddy)"
```

---

## Task 9: Amorce SPA — Vite + Tailwind + auth + page de connexion

**Files:**
- Create: `frontend/` (projet Vite complet — voir File Structure)
- Test: `frontend/src/api/client.test.ts`, `frontend/src/auth/AuthContext.test.tsx`, `frontend/src/auth/LoginPage.test.tsx`

**Interfaces:**
- Consumes: API `/api/v1/auth/*` (Task 4).
- Produces :
  - `frontend/src/api/client.ts` : `apiFetch(path, init?)` — préfixe `/api/v1`, ajoute `Authorization: Bearer <access>` si présent, `credentials: "include"`. Sur `401`, tente **une** fois `POST /auth/refresh/`, rejoue la requête, sinon vide le token et rejette.
  - `setAccessToken(t: string | null)` / `getAccessToken()` : stockage **en mémoire** (module-level).
  - `AuthProvider` + `useAuth()` : `{ utilisateur, connexion(login, mdp), deconnexion(), chargement }`.
  - `LoginPage` : formulaire RHF + Zod (`login` requis, `password` min 10), appelle `connexion`, affiche l'erreur `401`.
  - `RequireAuth` : redirige vers `/connexion` si non authentifié.
  - Routes : `/connexion` (publique), `/` (protégée, placeholder « Tableau de bord »).

- [ ] **Step 1: Scaffolder le projet**

Run :
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install
npm install react-router-dom @tanstack/react-query react-hook-form zod @hookform/resolvers
npm install -D tailwindcss @tailwindcss/vite vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom openapi-typescript
```

- [ ] **Step 2: Configurer Tailwind v4 + Vitest**

`frontend/vite.config.ts` :
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { "/api": "http://localhost:8000" } },
});
```

`frontend/src/index.css` :
```css
@import "tailwindcss";
```

`frontend/vitest.config.ts` :
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", setupFiles: ["./vitest.setup.ts"], globals: true },
});
```

`frontend/vitest.setup.ts` :
```ts
import "@testing-library/jest-dom/vitest";
```

Ajouter à `frontend/package.json` (`scripts`) :
```json
"test": "vitest run",
"typecheck": "tsc --noEmit",
"gen:api": "openapi-typescript http://localhost:8000/api/v1/schema/?format=json -o src/api/schema.d.ts"
```

- [ ] **Step 3: Test du client API (échoue)**

`frontend/src/api/client.test.ts` :
```ts
import { afterEach, expect, test, vi } from "vitest";
import { apiFetch, setAccessToken } from "./client";

afterEach(() => { setAccessToken(null); vi.restoreAllMocks(); });

test("ajoute le bearer quand un token est présent", async () => {
  setAccessToken("abc");
  const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  await apiFetch("/auth/moi/");
  const [, init] = fetchMock.mock.calls[0];
  expect((init.headers as Headers).get("Authorization")).toBe("Bearer abc");
});

test("rafraîchit une fois sur 401 puis rejoue", async () => {
  setAccessToken("vieux");
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response("{}", { status: 401 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ access: "neuf" }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  const r = await apiFetch("/auth/moi/");
  expect(await r.json()).toEqual({ ok: true });
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(fetchMock.mock.calls[1][0]).toContain("/auth/refresh/");
});
```

- [ ] **Step 4: Lancer — échoue**

Run : `cd frontend && npm test`
Expected : FAIL (`./client` absent).

- [ ] **Step 5: `frontend/src/api/client.ts`**

```ts
const BASE = "/api/v1";
let accessToken: string | null = null;

export function setAccessToken(t: string | null) { accessToken = t; }
export function getAccessToken() { return accessToken; }

async function raw(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(`${BASE}${path}`, { ...init, headers, credentials: "include" });
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  let resp = await raw(path, init);
  if (resp.status !== 401 || path.startsWith("/auth/")) return resp;

  const refresh = await fetch(`${BASE}/auth/refresh/`, { method: "POST", credentials: "include" });
  if (!refresh.ok) { accessToken = null; return resp; }
  accessToken = (await refresh.json()).access;
  resp = await raw(path, init);
  return resp;
}
```

- [ ] **Step 6: `AuthContext` + test**

`frontend/src/auth/AuthContext.tsx` :
```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch, setAccessToken } from "../api/client";

type Utilisateur = { id: number; login: string; email: string; roles: { code: string }[] };
type Ctx = {
  utilisateur: Utilisateur | null;
  chargement: boolean;
  connexion: (login: string, mdp: string) => Promise<void>;
  deconnexion: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);
  const [chargement, setChargement] = useState(true);

  async function chargerMoi() {
    const r = await apiFetch("/auth/moi/");
    setUtilisateur(r.ok ? await r.json() : null);
  }

  useEffect(() => { chargerMoi().finally(() => setChargement(false)); }, []);

  async function connexion(login: string, mdp: string) {
    const r = await fetch("/api/v1/auth/login/", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password: mdp }),
    });
    if (!r.ok) throw new Error("Identifiants invalides.");
    setAccessToken((await r.json()).access);
    await chargerMoi();
  }

  async function deconnexion() {
    await fetch("/api/v1/auth/logout/", { method: "POST", credentials: "include" });
    setAccessToken(null);
    setUtilisateur(null);
  }

  return (
    <AuthCtx.Provider value={{ utilisateur, chargement, connexion, deconnexion }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth hors AuthProvider");
  return c;
}
```

`frontend/src/auth/AuthContext.test.tsx` :
```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";

afterEach(() => vi.restoreAllMocks());

function Sonde() {
  const { utilisateur, connexion } = useAuth();
  return (
    <div>
      <span>utilisateur:{utilisateur?.login ?? "aucun"}</span>
      <button onClick={() => connexion("compta", "motdepasse42")}>go</button>
    </div>
  );
}

test("connexion renseigne l'utilisateur", async () => {
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url.endsWith("/auth/moi/"))
      return Promise.resolve(new Response(JSON.stringify(
        { id: 1, login: "compta", email: "c@ex.ga", roles: [] }), { status: 200 }));
    if (url.endsWith("/auth/login/"))
      return Promise.resolve(new Response(JSON.stringify({ access: "x" }), { status: 200 }));
    return Promise.resolve(new Response("{}", { status: 200 }));
  }));
  render(<AuthProvider><Sonde /></AuthProvider>);
  await userEvent.click(await screen.findByText("go"));
  await waitFor(() => screen.getByText("utilisateur:compta"));
});
```

- [ ] **Step 7: `LoginPage` + `RequireAuth` + routes + test**

`frontend/src/auth/LoginPage.tsx` :
```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "./AuthContext";

const schema = z.object({
  login: z.string().min(1, "Login requis"),
  password: z.string().min(10, "Au moins 10 caractères"),
});
type Champs = z.infer<typeof schema>;

export function LoginPage() {
  const { connexion } = useAuth();
  const nav = useNavigate();
  const [erreur, setErreur] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<Champs>({ resolver: zodResolver(schema) });

  async function onSubmit(v: Champs) {
    setErreur("");
    try { await connexion(v.login, v.password); nav("/"); }
    catch { setErreur("Identifiants invalides."); }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto mt-24 max-w-sm space-y-4">
      <h1 className="text-xl font-semibold">Connexion</h1>
      <label className="block">
        <span className="text-sm">Login</span>
        <input className="mt-1 w-full rounded border p-2" {...register("login")} />
        {errors.login && <em className="text-sm text-red-600">{errors.login.message}</em>}
      </label>
      <label className="block">
        <span className="text-sm">Mot de passe</span>
        <input type="password" className="mt-1 w-full rounded border p-2" {...register("password")} />
        {errors.password && <em className="text-sm text-red-600">{errors.password.message}</em>}
      </label>
      {erreur && <p role="alert" className="text-sm text-red-600">{erreur}</p>}
      <button disabled={isSubmitting}
              className="w-full rounded bg-black p-2 text-white disabled:opacity-50">
        Se connecter
      </button>
    </form>
  );
}
```

`frontend/src/auth/RequireAuth.tsx` :
```tsx
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { utilisateur, chargement } = useAuth();
  if (chargement) return <p className="p-8">Chargement…</p>;
  if (!utilisateur) return <Navigate to="/connexion" replace />;
  return <>{children}</>;
}
```

`frontend/src/routes.tsx` :
```tsx
import { createBrowserRouter } from "react-router-dom";
import { LoginPage } from "./auth/LoginPage";
import { RequireAuth } from "./auth/RequireAuth";

export const router = createBrowserRouter([
  { path: "/connexion", element: <LoginPage /> },
  {
    path: "/",
    element: (
      <RequireAuth>
        <main className="p-8">
          <h1 className="text-2xl font-bold">Tableau de bord</h1>
          <p className="text-gray-600">Socle en place. Modules à venir.</p>
        </main>
      </RequireAuth>
    ),
  },
]);
```

`frontend/src/main.tsx` :
```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import "./index.css";
import { router } from "./routes";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
```

`frontend/src/auth/LoginPage.test.tsx` :
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, test, vi } from "vitest";
import { AuthProvider } from "./AuthContext";
import { LoginPage } from "./LoginPage";

function monter() {
  vi.stubGlobal("fetch", vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify({ roles: [] }), { status: 200 }))));
  return render(
    <MemoryRouter><AuthProvider><LoginPage /></AuthProvider></MemoryRouter>,
  );
}

test("valide la longueur du mot de passe", async () => {
  monter();
  await userEvent.type(screen.getByLabelText("Login"), "compta");
  await userEvent.type(screen.getByLabelText("Mot de passe"), "court");
  await userEvent.click(screen.getByRole("button", { name: "Se connecter" }));
  expect(await screen.findByText("Au moins 10 caractères")).toBeInTheDocument();
});
```

- [ ] **Step 8: Lancer tous les tests front — passent**

Run : `cd frontend && npm test && npm run typecheck`
Expected : PASS (client + AuthContext + LoginPage) ; `tsc` sans erreur.

- [ ] **Step 9: Commit**

```bash
git add frontend
git commit -m "feat: amorce SPA React (Vite, Tailwind v4, auth JWT, page de connexion)"
```

---

## Task 10: Génération des types d'API + intégration shadcn/ui

**Files:**
- Create: `frontend/src/api/schema.d.ts` (généré), `frontend/src/api/types.ts`
- Create: `frontend/components.json`, `frontend/src/lib/utils.ts`, `frontend/src/components/ui/button.tsx`
- Modify: `frontend/src/auth/LoginPage.tsx` (utiliser `<Button>`)
- Modify: `frontend/tsconfig.json` (alias `@/*`)

**Interfaces:**
- Consumes: schéma OpenAPI de Task 7 (backend lancé), client de Task 9.
- Produces :
  - `frontend/src/api/types.ts` : ré-exporte `paths` / `components` depuis `schema.d.ts` ; alias `type MoiReponse = components["schemas"]["Moi"]` (nom exact à ajuster selon le schéma généré).
  - `@/components/ui/button` : composant `Button` shadcn.
  - alias TypeScript `@/*` → `src/*`.

- [ ] **Step 1: Alias `@/*`**

`frontend/tsconfig.json` — ajouter dans `compilerOptions` :
```json
"baseUrl": ".",
"paths": { "@/*": ["src/*"] }
```
`frontend/vite.config.ts` — ajouter :
```ts
import { resolve } from "node:path";
// dans defineConfig:
resolve: { alias: { "@": resolve(__dirname, "src") } },
```

- [ ] **Step 2: Générer les types depuis le backend**

Run (backend démarré sur `:8000`) :
```bash
cd backend && python manage.py runserver &  # ou docker compose up web
cd frontend && npm run gen:api
```
Expected : `frontend/src/api/schema.d.ts` créé. L'ajouter au dépôt (pas d'édition manuelle — en-tête de fichier généré).

- [ ] **Step 3: `frontend/src/api/types.ts`**

```ts
import type { components, paths } from "./schema";

export type { components, paths };
// Ajuster le nom du schéma selon le fichier généré (cf. components["schemas"]).
export type MoiReponse =
  paths["/api/v1/auth/moi/"]["get"]["responses"]["200"]["content"]["application/json"];
```

- [ ] **Step 4: Test de non-régression du contrat**

`frontend/src/api/types.test-d.ts` (types uniquement, vérifié par `tsc`) :
```ts
import type { MoiReponse } from "./types";

// doit compiler : la réponse expose au moins login + roles
const _exemple: MoiReponse = { id: 1, login: "x", email: "y", roles: [] } as MoiReponse;
void _exemple;
```

- [ ] **Step 5: Initialiser shadcn/ui**

Run :
```bash
cd frontend && npx shadcn@latest init -d && npx shadcn@latest add button
```
Expected : `components.json`, `src/lib/utils.ts`, `src/components/ui/button.tsx` créés.

- [ ] **Step 6: Utiliser `<Button>` dans `LoginPage`**

Remplacer le `<button>` de soumission par :
```tsx
import { Button } from "@/components/ui/button";
// ...
<Button type="submit" disabled={isSubmitting} className="w-full">Se connecter</Button>
```

- [ ] **Step 7: Vérifier build + tests + types**

Run : `cd frontend && npm run typecheck && npm test && npm run build`
Expected : tout PASS ; `dist/` généré.

- [ ] **Step 8: Commit**

```bash
git add frontend
git commit -m "feat: types d'API générés (openapi-typescript) + intégration shadcn/ui"
```

---

## Task 11: Intégration continue GitHub Actions

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `backend/pyproject.toml`, `frontend/package.json`, tous les tests des tâches précédentes.
- Produces : workflow `CI` sur `push` et `pull_request` — job `backend` (MySQL 8.4 en service, `ruff`, `pytest`) et job `frontend` (`tsc`, `vitest`, `build`). Rouge si un test échoue.

- [ ] **Step 1: Écrire `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: ["**"]
  pull_request:

jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mysql:8.4
        env:
          MYSQL_DATABASE: mlamine
          MYSQL_USER: mlamine
          MYSQL_PASSWORD: mlamine
          MYSQL_ROOT_PASSWORD: root
        ports: ["3306:3306"]
        options: >-
          --health-cmd="mysqladmin ping -h localhost -proot"
          --health-interval=5s --health-timeout=5s --health-retries=20
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.13" }
      - run: sudo apt-get update && sudo apt-get install -y default-libmysqlclient-dev pkg-config build-essential libpango-1.0-0 libpangocairo-1.0-0
      - run: pip install -e ".[dev]"
      - run: ruff check .
      - run: pytest
        env:
          DJANGO_SETTINGS_MODULE: config.settings.dev
          DJANGO_SECRET_KEY: ci-secret
          DJANGO_DEBUG: "true"
          DB_NAME: mlamine
          DB_USER: mlamine
          DB_PASSWORD: mlamine
          DB_HOST: 127.0.0.1
          DB_PORT: "3306"

  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "22", cache: "npm", cache-dependency-path: frontend/package-lock.json }
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

- [ ] **Step 2: Vérifier localement les commandes de CI**

Run :
```bash
cd backend && ruff check . && DJANGO_SECRET_KEY=x DJANGO_DEBUG=true pytest
cd ../frontend && npm run typecheck && npm test && npm run build
```
Expected : tout PASS (mêmes commandes que la CI).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: workflow GitHub Actions (backend pytest+ruff, frontend tsc+vitest+build)"
```

---

## Task 12: Fixtures d'amorçage + commande `seed_socle`

**Files:**
- Create: `backend/comptes/management/__init__.py`, `backend/comptes/management/commands/__init__.py`, `backend/comptes/management/commands/seed_socle.py`
- Test: `backend/comptes/tests/test_seed_socle.py`

**Interfaces:**
- Consumes: `Role` (Task 5).
- Produces : `python manage.py seed_socle` — crée les 5 rôles (`COMPTABLE, DAF, DIRECTION, SCOLARITE, LECTURE`) s'ils n'existent pas (idempotent) ; option `--admin-login` / `--admin-password` pour créer un superutilisateur. Sortie : nombre de rôles créés.

- [ ] **Step 1: Test (échoue)**

`backend/comptes/tests/test_seed_socle.py` :
```python
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
```

- [ ] **Step 2: Lancer — échoue**

Run : `cd backend && pytest comptes/tests/test_seed_socle.py -v`
Expected : FAIL (`Unknown command: 'seed_socle'`).

- [ ] **Step 3: Implémenter la commande**

`backend/comptes/management/commands/seed_socle.py` :
```python
from django.core.management.base import BaseCommand

from comptes.models import Role, Utilisateur


class Command(BaseCommand):
    help = "Amorce le socle : rôles et, optionnellement, un superutilisateur."

    def add_arguments(self, parser):
        parser.add_argument("--admin-login")
        parser.add_argument("--admin-password")

    def handle(self, *args, **options):
        crees = 0
        for code, libelle in Role.Code.choices:
            _, cree = Role.objects.get_or_create(code=code, defaults={"libelle": libelle})
            crees += int(cree)
        self.stdout.write(f"Rôles créés : {crees}")

        login = options.get("admin_login")
        mdp = options.get("admin_password")
        if login and mdp and not Utilisateur.objects.filter(login=login).exists():
            Utilisateur.objects.creer_superutilisateur(login, f"{login}@local", mdp)
            self.stdout.write(f"Superutilisateur {login} créé.")
```

- [ ] **Step 4: Lancer — passe**

Run : `cd backend && pytest comptes/tests/test_seed_socle.py -v`
Expected : PASS (2 tests).

- [ ] **Step 5: Documenter dans `infra/README.md`**

Ajouter sous « Premier démarrage » :
```markdown
    docker compose exec web python manage.py seed_socle --admin-login <login> --admin-password <mdp>
```

- [ ] **Step 6: Commit**

```bash
git add backend/comptes/management backend/comptes/tests/test_seed_socle.py infra/README.md
git commit -m "feat: commande seed_socle (5 rôles idempotents + admin optionnel)"
```

---

## Self-Review

**1. Spec coverage** (spec `2026-08-30-choix-technologies-sis-design.md`) :

| Décision spec | Couverte par |
|---|---|
| T1 monorepo `backend/`+`frontend/` | Task 1, 9 ; `infra/` Task 8 |
| T2 MySQL 8.4 conservée | Task 2 (`DATABASES`), Task 8 (`mysql:8.4`), Task 11 (service CI) |
| T3 source de vérité = ORM Django | Task 3, 5, 6 (`makemigrations`/`migrate`) ; portage des tests `db/tests/` = **hors socle**, à traiter dans les plans des modules métier (noté ci-dessous) |
| T4 Django 5.2 LTS + DRF 3.16 | Task 1 (`pyproject.toml`), Global Constraints |
| T5 JWT access 15 min + refresh rotatif cookie httpOnly | Task 2 (`SIMPLE_JWT`, `REFRESH_COOKIE_*`), Task 4 (vues + tests) |
| T6 RBAC modèle `utilisateur`/`role`/`utilisateur_role` scopé école, serveur uniquement | Task 3, 5 ; `ecole_id` entier nullable (FK réelle en Phase 2) |
| T7 stack front (Vite, Query, RHF+Zod, Tailwind, shadcn) | Task 9, 10 |
| T8 OpenAPI → types TS | Task 7 (schéma), Task 10 (`openapi-typescript`) |
| T9 français seul, chaînes centralisées | Task 9 (UI en français, pas de lib i18n) |
| T10 WeasyPrint | dépendance installée (Task 1, libs système Task 8/11) ; usage = plans modules |
| T11 import Excel `openpyxl` | **hors socle** — plan du module `personnes` / reprise de données |
| T12 pas d'async au départ | aucun Celery/Redis dans ce plan |
| T13 Docker Compose `caddy`/`web`/`db` | Task 8 |
| T14 Caddy HTTPS auto + statiques | Task 8 (`Caddyfile`) |
| T15 Gunicorn workers sync | Task 8 (`Dockerfile` CMD) |
| T16 `django-storages` | dépendance Task 1 ; `MEDIA`/S3 config = plan ultérieur (volume `media` prévu Task 8) |
| T17 sauvegardes mysqldump chiffrées | Task 8 (`backup.sh` + doc) — planification cron = exploitation, hors code |
| T18 CI un workflow back+front | Task 11 |
| T19 pytest/vitest ; Playwright optionnel | Task 3–12 ; Playwright non inclus (marqué optionnel v1) |
| T20 HTTPS/HSTS, throttling auth, Argon2, audit | Task 2 (`prod.py`, `PASSWORD_HASHERS`, throttle rate), Task 4 (`ScopedRateThrottle`), Task 6 (audit) |
| T21 conformité (organisationnel) | hors code |
| T22 `django-environ` + `.env` | Task 1, 2, 8 |
| §11 évolutivité (API stateless, conteneurs séparés) | Task 4 (JWT stateless), Task 8 (services séparés) |

Écarts assumés, renvoyés aux plans des modules métier : portage des assertions `db/tests/*.sql` en tests d'intégrité pytest (T3) ; import Excel (T11) ; configuration stockage objet (T16). Ces points **n'appartiennent pas au socle** et dépendent des modèles métier (Modules 1–6) non couverts ici.

**2. Placeholder scan :** un provisoire explicite et justifié subsiste — `get_roles` dans Task 4 Step 3, avec le code de repli **et** le code définitif fournis, remplacé en Task 5 Step 5. `ecole_id` en entier nullable est une décision (FK en Phase 2), pas un placeholder. Aucun « TODO », « à compléter », ni step sans code.

**3. Type consistency :**
- `setAccessToken` / `getAccessToken` / `apiFetch` : signatures identiques entre Task 9 (définition) et Task 10 (usage).
- `useAuth()` renvoie `{ utilisateur, chargement, connexion, deconnexion }` — mêmes noms dans `RequireAuth`, `LoginPage`, tests (Task 9).
- `Role.Code.choices` : utilisé en Task 5 (permissions/tests) et Task 12 (`seed_socle`) — même source.
- `UtilisateurRole.utilisateur` a `related_name="roles"` (Task 5) — consommé par `_codes()` (Task 5) et `MoiSerializer.get_roles` (Task 4 définitif / Task 5 Step 5).
- `AuditLogMixin` : `perform_create/update/destroy` — signatures DRF standard ; `table_cible` dérivé de `_meta.db_table`, cohérent avec les `db_table` français des modèles.
- `REFRESH_COOKIE_NAME` / `REFRESH_COOKIE_SECURE` / `REFRESH_COOKIE_SAMESITE` / `REFRESH_COOKIE_PATH` : définis Task 2, consommés Task 4.

---

## Ordre d'exécution et dépendances

```text
1 ─▶ 2 ─▶ 3 ─▶ 4 ─▶ 5 ─▶ 6 ─▶ 7 ─▶ 11
                    └──────────────▶ 12
2 ─▶ 8 (a besoin de 3–7 pour un déploiement complet ; le Dockerfile se teste dès 2)
9 ─▶ 10   (indépendants du backend pour les tests unitaires ; 10 a besoin de 7 lancé pour gen:api)
8, 10 ─▶ 11 (la CI verte suppose tout en place)
```

Séquence recommandée : **1 → 2 → 3 → 4 → 5 → 6 → 7 → 9 → 10 → 8 → 12 → 11**.

---

## Execution Handoff

Voir la section correspondante après validation.

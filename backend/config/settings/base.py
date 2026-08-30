from pathlib import Path

import dj_database_url
import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("DJANGO_SECRET_KEY")
# `env.bool(...)` est indispensable : `env("DJANGO_DEBUG")` renvoie la chaîne
# "False", tronquée en booléen -> True, ce qui activerait silencieusement le
# mode debug en production.
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

# Base de données : `DATABASE_URL` (base managée, déploiement) prioritaire ;
# sinon variables `DB_*` discrètes (MySQL 8.4 local / CI).
DATABASE_URL = env("DATABASE_URL", default="")
if DATABASE_URL:
    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL, conn_max_age=600, ssl_require=not DEBUG
        )
    }
else:
    # Branche `DB_*` : `CONN_MAX_AGE` par défaut de Django (= 0, connexions
    # non persistantes), alors que la branche `DATABASE_URL` mutualise à 600 s —
    # volontaire pour le local / CI.
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

# En-têtes de sécurité HTTP — toujours actifs (aucun impact en dev), servis par
# SecurityMiddleware / XFrameOptionsMiddleware déjà présents.
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = "DENY"

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

# --- Journalisation -------------------------------------------------------
LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{asctime}] {levelname} {name} {funcName}:{lineno} — {message}",
            "style": "{",
        },
        "simple": {"format": "[{levelname}] {name}: {message}", "style": "{"},
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "simple",
        },
        "fichier": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": str(LOG_DIR / "mlamine.log"),
            "maxBytes": 5 * 1024 * 1024,
            "backupCount": 5,
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"] if DEBUG else ["console", "fichier"],
        "level": "INFO",
    },
    "loggers": {
        "django.request": {"level": "WARNING"},
        "comptes": {"level": "INFO"},
        "core": {"level": "INFO"},
    },
}

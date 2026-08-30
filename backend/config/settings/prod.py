from .base import *  # noqa: F401,F403
from .base import env

DEBUG = False
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
# Redirection HTTPS désactivable : derrière Caddy (qui force déjà TLS au bord)
# le conteneur `web` n'est jamais exposé directement -> `DJANGO_SECURE_SSL_REDIRECT=false`.
SECURE_SSL_REDIRECT = env.bool("DJANGO_SECURE_SSL_REDIRECT", default=True)
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

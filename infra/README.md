# Déploiement

Pile Docker Compose : `db` (MySQL 8.4), `web` (Gunicorn / `config.settings.prod`),
`caddy` (build React + reverse-proxy TLS).

## Premier démarrage (VPS)

    cp ../.env.example ../.env      # renseigner secrets + SITE_ADDRESS (domaine réel)
    docker compose -f docker-compose.yml up -d --build
    docker compose -f docker-compose.yml exec web python manage.py createsuperuser

`SITE_ADDRESS` = domaine public → Caddy obtient un certificat Let's Encrypt
automatiquement. En local, garder `localhost` (certificat interne, utiliser
`curl -k`).

Variables `.env` utilisées par la pile :

| Variable                | Rôle                                             |
|-------------------------|--------------------------------------------------|
| `SITE_ADDRESS`          | Domaine servi par Caddy (`localhost` en local)   |
| `DJANGO_SECRET_KEY`     | Clé secrète Django (≥ 50 caractères)             |
| `DJANGO_ALLOWED_HOSTS`  | Hôtes autorisés, séparés par des virgules        |
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` | Compte applicatif MySQL             |
| `DB_ROOT_PASSWORD`      | Mot de passe root MySQL (init + sauvegardes)     |
| `CORS_ALLOWED_ORIGINS`  | Origines autorisées pour l'API                   |

`DJANGO_SECURE_SSL_REDIRECT` est forcé à `false` dans le service `web` : Caddy
force déjà HTTPS au bord et le conteneur `web` n'est jamais exposé directement.

## Mise à jour

    git pull
    docker compose -f docker-compose.yml up -d --build

Les migrations et le `collectstatic` sont joués automatiquement au démarrage du
service `web` (voir `backend/entrypoint.sh`).

## Vérification

    curl -sk https://localhost/api/v1/healthz/
    # -> {"status": "ok", "db": "ok"}

## Sauvegardes

`backup.sh` (cron hôte, quotidien) : `mysqldump` → gzip → chiffrement `age` →
envoi `rclone` vers le remote `offsite`. Prérequis hôte : `age`, `rclone`, et la
variable `AGE_RECIPIENT`. Restauration : voir l'en-tête du script ; tester
mensuellement sur une base jetable.

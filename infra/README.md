# Déploiement

Pile Docker Compose : `db` (MySQL 8.4), `web` (Gunicorn / `config.settings.prod`),
`caddy` (build React + reverse-proxy TLS).

> **Toutes les commandes se lancent depuis la racine du dépôt**, avec un fichier
> d'environnement explicite : `docker compose --env-file .env -f infra/docker-compose.yml …`.
> Compose lit `.env` dans le répertoire courant : le lancer depuis `infra/` avec
> un `.env` à la racine résoudrait toutes les variables `${…}` à vide et MySQL
> refuserait de démarrer.

## Premier démarrage (VPS)

    cp .env.example .env      # renseigner secrets + SITE_ADDRESS (domaine réel)
    docker compose --env-file .env -f infra/docker-compose.yml up -d --build
    docker compose --env-file .env -f infra/docker-compose.yml exec web \
        python manage.py createsuperuser

`SITE_ADDRESS` = domaine public → Caddy obtient un certificat Let's Encrypt
automatiquement. En local, garder `localhost` (certificat interne, utiliser
`curl -k`).

Variables `.env` utilisées par la pile :

| Variable                | Rôle                                                  |
|-------------------------|------------------------------------------------------|
| `SITE_ADDRESS`          | Domaine servi par Caddy (`localhost` en local)        |
| `DJANGO_SECRET_KEY`     | Clé secrète Django (≥ 50 caractères)                  |
| `DJANGO_ALLOWED_HOSTS`  | Hôtes autorisés, séparés par des virgules             |
| `DB_PASSWORD`           | Mot de passe du compte applicatif MySQL `mlamine`     |
| `DB_ROOT_PASSWORD`      | Mot de passe root MySQL (init + sauvegardes)          |
| `CORS_ALLOWED_ORIGINS`  | Origines autorisées pour l'API                        |

Le **nom de base** et l'**utilisateur** MySQL (`mlamine` dans les deux cas) sont
figés dans `infra/docker-compose.yml`, pas dans `.env` : cela évite un doublon
avec `DB_NAME=mlamine_test` de la section « harnais SQL » de `.env.example`.

`DJANGO_SECURE_SSL_REDIRECT` est forcé à `false` dans le service `web` : Caddy
force déjà HTTPS au bord et le conteneur `web` n'est jamais exposé directement.

### Points d'attention

- **`DJANGO_ALLOWED_HOSTS` doit contenir `localhost`** : le `HEALTHCHECK` du
  conteneur `web` interroge `http://localhost:8000/api/v1/healthz/` ; sans
  `localhost` dans la liste, Django répond `400` et le conteneur reste
  `unhealthy` (donc `caddy` ne démarre jamais).
- **Connexion à l'admin sur un vrai domaine** : ajouter
  `DJANGO_CSRF_TRUSTED_ORIGINS=https://<domaine>` à l'environnement du service
  `web` (lu par `prod.py` via `CSRF_TRUSTED_ORIGINS`), sinon la soumission du
  formulaire de login renvoie une erreur CSRF.

## Mise à jour

    git pull
    docker compose --env-file .env -f infra/docker-compose.yml up -d --build

Les migrations et le `collectstatic` sont joués automatiquement au démarrage du
service `web` (voir `backend/entrypoint.sh`).

## Vérification

    docker compose --env-file .env -f infra/docker-compose.yml config   # variables résolues
    curl -sk https://localhost/api/v1/healthz/
    # -> {"status": "ok", "db": "ok"}

Arrêt : `docker compose --env-file .env -f infra/docker-compose.yml down`.

## Sauvegardes

`infra/backup.sh` (cron hôte, quotidien) : `mysqldump` → gzip → chiffrement `age`
→ envoi `rclone` vers le remote `offsite`. Prérequis hôte : `age`, `rclone`, et
la variable `AGE_RECIPIENT`. Restauration : voir l'en-tête du script ; tester
mensuellement sur une base jetable.

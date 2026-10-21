# Backend `mlamine`

API Django 5.2 LTS + DRF. Base MySQL 8.4.

## Dev local

    python -m venv .venv && source .venv/bin/activate
    pip install -e ".[dev]"
    cp .env.example .env          # ajuster DB_*
    python manage.py migrate
    python manage.py runserver

## Amorçage de la base

    python manage.py seed_initial --admin-login <login> --admin-password <mdp>

Enchaîne rôles, référentiel (écoles, niveaux, filières, options), grilles tarifaires, frais
annexes et pièces, puis importe `Enseignants.xlsx` et `test 2026.xlsx` (racine du dépôt,
ignorés par git ; `--enseignants` / `--classeur` pour d'autres chemins). Idempotent ;
`--annee` (défaut 2026-2027). Pour repartir d'une base vide : `python manage.py flush` avant.

## Tests

    pytest

## Lint

    ruff check .

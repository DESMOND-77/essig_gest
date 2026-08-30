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

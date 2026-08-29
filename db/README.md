# Base de données `mlamine`

Schéma cible du système de gestion du groupe scolaire, en migrations SQL MySQL 8.4.

## Exécuter les migrations + tests

```bash
db/run.sh                     # via Docker (mysql:8.4)
DB_HOST=127.0.0.1 DB_USER=root DB_PASS=secret db/run.sh   # sur un MySQL existant
```

`run.sh` recrée une base jetable, applique `migrations/*.sql` dans l'ordre, puis
exécute `tests/helpers`, `tests/fixtures`, `tests/test_*`. Code de sortie non nul si une
assertion échoue.

## Ajouter une migration

Fichier `migrations/NNN_<module>.sql`, NNN strictement croissant. Rejouable sur base fraîche.
Voir `docs/superpowers/plans/2026-08-29-schema-sql-gestion-groupe-scolaire.md`.

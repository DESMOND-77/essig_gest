# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Database schema design for **`mlamine`**, a multi-school administration system (students, fees,
payroll, cash accounting). This directory is a data-modeling workspace, not an application — there
is no build, no test suite, no application code. Everything is French-language (table/column names,
enums, domain terms) and should stay that way.

Files:
- `scheme.dbs` — **source of truth**. DbSchema GUI project (XML) holding the model plus diagram
  layout. Edit the schema here, in the DbSchema app.
- `scheme.dbs.bak` — DbSchema's automatic previous-version backup. Do not edit.
- `mlamine.sql` — **generated artifact**: a phpMyAdmin dump of the DDL (structure only, no data).
  Regenerate it from the database or DbSchema after model changes; don't treat hand-edits here as
  authoritative.
- `test 2026.xlsx` — the legacy spreadsheet system this schema replaces. One sheet per school
  (`ESSIG`, `ESSS`/UPSS, `CFPA`) plus `BILAN *`, `DEPENSES`, `VERSEMENTS`, fee sheets. Use it to
  understand real-world domain rules and expected reports.
- `Enseignants.xlsx`, `test 2026.xlsx`, `inscription pdf.pdf` — sample/reference data and the
  student registration form.

## Working with the schema

```sh
# Load the DDL into a local MySQL 8.4 instance
mysql -u root -p mlamine < mlamine.sql

# Regenerate mlamine.sql from a live database (structure only)
mysqldump -u root -p --no-data --skip-comments mlamine > mlamine.sql
```

DbSchema itself is a desktop GUI (`.dbs` files); there is no CLI for it here. When asked to change
"the schema", change `mlamine.sql` and describe the equivalent DbSchema edit — the two must be kept
in sync manually.

## Model architecture

**Tenant boundary is `ecole`.** Almost every domain table carries `id_ecole`. `ecole` also holds
school-wide default fee amounts (`frais_photocopie`, `frais_mutelle`, `frais_matiere_oeuvre`,
`frais_journee_integration`).

**Academic hierarchy** (two partly parallel structures):
- `ecole` → `formation`, `ecole` → `niveaux`
- `niveaux` → `filieres` → `options` → `matiere`
- `etudiants` link out to `id_ecole`, `id_formation`, `id_niveau`, `id_option`.

**Per-student fee ledgers** — `mutuelle_etudiant`, `photocopie_etudiant`, `uniforme_etudiant` all
follow the same shape: `avance` / `reste` / `etat_payement enum('non','partiel','solde')` tied to
`id_etudiant` (+ `id_ecole`, and `id_uniforme` for uniforms). `modalites_payement` defines the
installment plan (`montant_echeance`, `nombre_echeance`, `total`) per `id_niveau`.

**Money movement** — `versements` (student tuition installments, `mois` enum), `salaire_enseignant`
(teacher pay per month / matiere / formation / niveau / school, `source enum('caisse','banque')`),
`depenses` (free-text expenses per `compte`), `operation_banque_caisse` (raw cash-in/cash-out with
`intitule_compte enum('banque','caisse')`). Financial months run **SEPT…AOUT** (school year), and
the `mois` enum defaults to `'SEPT'`.

## Conventions and known quirks

- **Naming is inconsistently pluralized** by design — `etudiants`, `filieres`, `options`, `niveaux`
  are plural; `enseignant`, `matiere`, `formation`, `ecole` are singular. Match the existing table
  when adding related objects; don't "fix" the others.
- `ecole.annee_scolaire` is a FK to `annee_scolaire.annee` (a `varchar(9)` like `2025-2026`), **not**
  to its `id`.
- In `mlamine.sql`, only `versements.id` is `AUTO_INCREMENT`; other PKs are plain `int` (ids are
  assigned by the app/DbSchema). Several tables (`depenses`, `operation_banque_caisse`, `versements`,
  `annee_scolaire`) have no foreign keys.
- `etudiants` uniqueness is the composite `(matricule, numero_odre, nom)`.

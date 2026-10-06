# ESSIG-GEST — Backend completion report

## Scope implemented
The archive's documented backend scope reaches Phase 3B (Scolarité — frais annexes & bourses).
The included specifications/plans do not provide implementation plans for treasury, RH/paie,
evaluations/results, reporting, Excel imports, or PDF generation; those domains therefore remain
outside this implementation rather than being invented from incomplete requirements.

## Implemented in this pass

### Scolarité Phase 3B
- `TypeFrais`
- `FraisInscription`
- `Bourse`
- migration `scolarite.0002_typefrais_fraisinscription_bourse`
- audit fields through `core.Auditable`
- uniqueness and indexes required by the Phase 3B plan
- `materialiser_frais_obligatoires(inscription)`
  - only mandatory + active fee types
  - wildcard / school / level / academic-year scope matching
  - idempotent `get_or_create`
  - default amount copied from `montant_defaut`
- inscription creation now materializes mandatory fees in the same transaction
- inscription detail now exposes `frais_inscription` and `bourses`
- serializers with audit fields read-only
- filters
- CRUD API endpoints:
  - `/api/v1/scolarite/types-frais/`
  - `/api/v1/scolarite/frais-inscription/`
  - `/api/v1/scolarite/bourses/`
- role permissions:
  - TypeFrais writes: DIRECTION
  - FraisInscription/Bourse writes: DIRECTION, DAF, COMPTABLE
  - authenticated users retain read access
- idempotent `seed_scolarite` catalogue with 7 fee types
- admin registrations
- factories and tests for models, services, serializers, API and seed

### Authentication consistency
- JWT login now updates `Utilisateur.derniere_connexion`, resolving the TODO identified by
  the project audit.

## Validation performed in this environment
- Python syntax compilation: PASS for all 100 Python source files.
- Target modified modules: PASS syntax compilation.
- Django runtime tests: NOT EXECUTED because Django/dependencies are not installed in the
  execution environment and network access is unavailable for installation.

## Recommended local gates
From the backend directory:
- `ruff check .`
- `python manage.py check`
- `python manage.py makemigrations --check --dry-run`
- `python manage.py spectacular --file /tmp/schema.yml`
- `pytest -q`
- `python manage.py seed_scolarite`
- `python manage.py showmigrations`

# CLAUDE.md

Guide pour Claude Code (claude.ai/code) sur ce dépôt.

## Ce que c'est

**ESSIG-GEST** (nom technique : `mlamine`) — plateforme web de gestion intégrée du groupe
scolaire de Franceville (Gabon) : référentiel académique, personnes & inscriptions, scolarité &
facturation, encaissements & trésorerie, RH & paie, évaluations & résultats. Remplace un système
de classeurs Excel (un fichier par année). Outil **interne** (personnel administratif), **un seul
groupe scolaire**, **multi-années**. Tout est en **français** (tables, colonnes, enums, domaine) —
garder cette langue.

Prompt de mission détaillé : `prompts/PROMPT MAÎTRE — AGENT PRINCIPAL DE DÉVELOPPEMENT ESSIG-GEST.md`.

## Architecture (monorepo)

| Dossier | Contenu | État |
|---|---|---|
| `backend/` | Django 5.2 LTS + DRF, Python 3.13, MySQL 8.4. Modules : `comptes` (utilisateur/rôle/audit), `core` (health, exceptions, schéma, `viewsets._BaseCrudViewSet`, `models.Auditable` + `serializers.AuditableSerializerMixin`), `referentiel` (11 entités, `seed_referentiel`), `personnes` (étudiant/affiliation/situation_bac/type_piece + **inscription/piece_dossier**, matricule + numéro d'ordre serveur, `seed_personnes`), `scolarite` (**partiel — grilles tarifaires + échéancier ; frais/bourses = Phase 3B**) **livrés**. Modules métier restants (`tresorerie`, `paie`, `resultats`) **à créer**. | `scolarite` partiel (Phase 3A) |
| `frontend/` | React 19 + TypeScript strict + Vite + React Router 7 + Tailwind v4 + shadcn/ui (minimal) + TanStack Query. Auth JWT SPA. AppShell (sidebar 6 modules, topbar, fil d'Ariane, toasts) + scaffold CRUD générique `Descripteur` + écrans `/referentiel/*`, `/personnes/*` (étudiants, `type_piece`, fiche étudiant, **inscriptions + fiche inscription, pièces de dossier**), `/scolarite/*` (**grilles tarifaires, échéances**). | AppShell + référentiel + personnes + scolarité (Phase 3A) |
| `db/` | Migrations SQL MySQL 8.4 (49 tables + 13 vues) + harnais de tests SQL. **Référence de conception uniquement** — non appliquée par Django (voir « Sources de vérité »). | Complet |
| `infra/` | Docker Compose (`caddy` / `web` / `db`), `Caddyfile`, Dockerfiles, `entrypoint.sh`, `backup.sh`. Validé statiquement, **jamais exécuté au runtime**. | Écrit |
| `docs/superpowers/` | `specs/` (designs validés), `plans/` (plans d'implémentation). | — |
| `.superpowers/sdd/` | Journaux de tâches (`progress.md`, `task-*`, `review-*.diff`) des chantiers déjà menés. | — |

## Sources de vérité (hiérarchie)

1. Décisions validées dans `docs/superpowers/specs/` — notamment
   `2026-08-29-modele-donnees-gestion-groupe-scolaire-design.md` (modèle, 6 modules, règles D1–D21)
   et `2026-08-30-choix-technologies-sis-design.md` (pile, décisions T1–T22).
2. Arbitrages `.superpowers/sdd/*/progress.md` (rulings PF-*, décisions en cours de chantier).
3. Plans `docs/superpowers/plans/`.
4. **Django (ORM + migrations) = source de vérité de l'application qui tourne.**
5. `db/migrations/*.sql` + `db/tests/*.sql` = référence de conception (colonnes, types, contraintes,
   `ON DELETE`, colonnes générées, règles métier en SQL). À ne jamais ignorer.
6. Hypothèses de l'agent — en dernier recours, documentées comme `Decision` dans une spec.

Toute création/modification de modèle Django doit être comparée au `.sql` de référence
correspondant via `python manage.py sqlmigrate`. Les assertions de `db/tests/*.sql` sont à porter
en tests `pytest`.

## Commandes

```sh
# Backend (depuis backend/, venv .venv, MySQL 8.4 requis)
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py migrate
python manage.py spectacular --file /tmp/schema.yml   # doit rester 0 Error
pytest                                                # DB_USER=root (pytest crée test_<DB_NAME>)
ruff check .                                          # select E,F,I,UP,B,DJ ; migrations exclues
python manage.py seed_socle --admin-login <l> --admin-password <m>
python manage.py seed_referentiel                     # groupe, écoles, modalités, année, périodes
python manage.py seed_personnes                       # types de pièce (idempotent)

# Référence SQL (indépendante de Django)
bash db/run.sh                                        # migrations + assertions sur MySQL 8.4 jetable

# Frontend (depuis frontend/)
npm run typecheck          # tsc -b --noEmit
npm test                   # vitest
npm run build
npm run gen:api            # régénère src/api/schema.d.ts — exige le backend sur :8000

# Infra
docker compose --env-file .env -f infra/docker-compose.yml config
```

Après changement d'API : serializers → `@extend_schema` → `spectacular` → `npm run gen:api` →
adapter le front → tests.

## Conventions

- **Argent** : entiers FCFA, `DecimalField(max_digits=12, decimal_places=0)`. **Jamais de flottant.**
- **Multi-années** : `etudiant` = identité persistante, `inscription` = annuelle. Ne jamais fusionner.
- **Année financière** : SEPT…AOUT. `mois` enum par défaut `'SEPT'`.
- **Nommage tables cible** : `snake_case` singulier, sans accent, français ; PK `id` ; FK `<table>_id`
  (cf. design données §5). `db_table` explicite sur chaque modèle Django.
- **Clé primaire ORM** : `BigAutoField` / `BIGINT` partout (défaut Django), même si `db/migrations`
  utilise `INT UNSIGNED` — divergence assumée, voir
  `docs/superpowers/specs/2026-09-03-conventions-portage-orm-design.md`.
- **RBAC** : 5 rôles (`COMPTABLE`, `DAF`, `DIRECTION`, `SCOLARITE`, `LECTURE`), contrôle
  **exclusivement côté serveur** (`comptes/permissions.py` : `ARole(...)`, `EcritureInterditeEnLecture`).
  Le front masque des boutons, ce n'est pas une sécurité.
- **Audit** : `AuditLogMixin` sur les ViewSets d'opérations sensibles (avant/après JSON, IP).
  Jamais de secret/mot de passe/jeton dans `journal_audit`.
- **Transactions** : opérations multi-étapes (inscription+échéancier+frais, encaissement+imputation,
  virement, paie, délibération) atomiques (`transaction.atomic`).
- **Agrégats** : calculés (vues SQL / annotations / services), jamais stockés — sauf figés après
  délibération.
- **Erreurs API** : exceptions typées `core/exceptions.py` (FR, codes stables), format DRF standard.
- **Règles LMD / classique** : cf. design données D3–D8 et prompt maître §7 (validation matière
  ≥ 10/20 sans compensation ; `note_retenue = max(normale, min(rattrapage, 10))` ; passage
  60/48/<48 crédits ; CFPA = moyenne annuelle /20).

## Pièges connus

- `.env` est à la **racine** du dépôt (pas dans `infra/`). Compose : toujours `--env-file .env`
  depuis la racine. `.env`/`.env.example` mélangent la section « harnais SQL » (`DB_NAME=mlamine_test`)
  et la section compose (`mlamine`) — last-wins.
- Tests `pytest` : `DB_USER=root` obligatoire (l'utilisateur applicatif MySQL n'a pas le droit de
  créer `test_<DB_NAME>`).
- Namespace URL `v1:` requis (`SpectacularSwaggerView(url_name="v1:schema")`) — ne pas le retirer.
- `SPECTACULAR` : `SERVE_PERMISSIONS = IsAdminUser` en prod (schéma non public).
- `Utilisateur.derniere_connexion` non branché (collision avec `last_login` d'`AbstractBaseUser`) —
  TODO dans `settings/base.py`.
- Infra Docker/Caddy jamais lancée bout-en-bout : à vérifier dans un environnement réseau normal
  avant tout déploiement (checklist dans `.superpowers/sdd/2026-08-30-socle-applicatif-sis/progress.md`).
- Aucun remote Git configuré. Branche de travail : `main`.

## Portées technologiques écartées v1 (design §9)

PostgreSQL, Celery/Redis, WebSockets, GraphQL, microservices/K8s, SSO, multi-tenant SaaS, portail
étudiant/parent, paiement en ligne, mobile. Ne pas réintroduire sans nouvelle exigence métier
documentée.

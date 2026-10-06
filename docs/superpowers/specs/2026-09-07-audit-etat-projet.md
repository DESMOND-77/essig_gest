# ESSIG-GEST — Audit d'état du projet

_Date : 2026-09-07 · Auteur : agent principal (prompt maître §30/§32) · Branche au moment de
l'audit : `phase-1-referentiel` (HEAD `ceaac64`), `main` = `d006303` (socle seul)._

Audit complet réalisé **avant toute reprise d'implémentation métier**, conformément au prompt
maître §30 (« NE MODIFIE PAS LE CODE pendant cette première phase »). Aucun code modifié pour
produire ce document.

---

## 1. Architecture actuelle (résumé)

Monorepo. Backend Django 5.2 LTS / DRF / MySQL 8.4, JWT (refresh en cookie `httpOnly`, access en
mémoire côté SPA), RBAC serveur (5 rôles), audit générique, OpenAPI `drf-spectacular`. Frontend
React 19 / TypeScript strict / Vite / React Router 7 / Tailwind v4 / TanStack Query + Table /
React Hook Form + Zod. `db/` = 9 migrations SQL MySQL + 10 harnais de test SQL — **référence de
conception, non appliquée par Django**. `infra/` = Docker Compose (`caddy` / `web` / `db`) +
Caddyfile, validés statiquement, jamais exécutés au runtime. CI GitHub Actions :
`backend-lint`, `backend-tests` (service MySQL 8.4), `frontend`, `docker-build`.

**Hiérarchie des sources de vérité** : specs `docs/superpowers/specs/` (modèle de données D1–D21,
choix technos T1–T22, conventions de portage ORM, spec Phase 1) → rulings
`.superpowers/sdd/*/progress.md` → plans `docs/superpowers/plans/` → code Django → tests →
`db/migrations/*.sql` + `db/tests/*.sql` → hypothèses de l'agent (dernier recours, documentées).

---

## 2. Terminé

| Bloc | État | Preuve |
|---|---|---|
| **Socle applicatif** (`comptes`, `core`) | Livré, **mergé sur `main`** (`d006303`, 2026-09-02), revue finale opus + fix-wave 20/20 items | `.superpowers/sdd/2026-08-30-socle-applicatif-sis/progress.md` |
| **Schéma SQL de référence** (49 tables + 13 vues, 6 modules) | Complet, harnais `db/run.sh` vert | `db/migrations/00{1..9}`, `db/tests/test_0{01..10}` |
| **Phase 1 — `referentiel`** : 11 modèles + migration, services (`libelle_classe`, `definir_annee_courante`), 11 API CRUD `/api/v1/referentiel/`, permissions, filtres, audit, 409 suppression protégée, `seed_referentiel` idempotent | Fonctionnellement complet — **branche `phase-1-referentiel`, 15 commits, NON mergé** | `git log main..HEAD` ; `pytest` 74 passed ; `spectacular` 0 Error |
| **Frontend** : AppShell (sidebar 6 modules, topbar, breadcrumbs, toasts, `ConfirmDialog`), couche données générique (`createResourceHooks`, `errors.ts`), scaffold CRUD (`Descripteur` → `ResourcePage`/`ResourceForm`), **11 écrans `/referentiel/*`** | Livré sur la même branche | `frontend` : typecheck + 19 tests + build verts |

---

## 3. Partiellement terminé / à consolider

- **Phase 1 non revue formellement.** Tasks 12–14 (scaffold générique + 11 descripteurs +
  clôture) faites **hors boucle de dispatch superpowers** — jamais passées en
  `requesting-code-review`. Le progress log le signale : « À passer en review avant merge ».
- **`infra/`** : validé statiquement (`compose config`, `caddy validate`, `sh -n`) mais jamais
  lancé `up --build` : healthcheck, `/api/v1/healthz/` en HTTPS, `CSRF_TRUSTED_ORIGINS`,
  sauvegarde / restauration non éprouvés (checklist Task 8 du socle).
- **CI incomplète** : `backend-tests` ne lance **pas** `spectacular` (0 Error) ni un contrôle de
  dérive de `frontend/src/api/schema.d.ts` (`gen:api`). Le schéma TS peut pourrir silencieusement.
- **`comptes.Utilisateur.derniere_connexion`** toujours non branché (collision `last_login`) —
  TODO `settings/base.py`.
- **`C2-ssl`** (socle, ruling FINAL-1 parké) : branche `DATABASE_URL` + MySQL + prod → bloc `ssl`
  non gaté sur `DB_SSL_CA` → TLS non vérifié vers une base managée. 1 ligne, à faire au câblage.

---

## 4. Manquant (modules métier 2 → 6)

Aucune app Django, aucun endpoint, aucun écran pour : **personnes & inscriptions**, **scolarité &
facturation**, **encaissements & trésorerie**, **RH & paie**, **évaluations & résultats**,
**délibérations / bulletins**, **imports Excel** (`db/CORRESPONDANCE.md`), **génération PDF**
(WeasyPrint), **dashboard** (indicateurs calculés), **reporting** (exploitation des 13 vues SQL).

---

## 5. Incohérences / risques détectés

| # | Risque | Gravité |
|---|---|---|
| R1 | Phase 1 = 15 commits **non mergés et non revus**. Le dépôt exploitable est `main` = socle seul. | Élevée (process) |
| R2 | Commit externe `a1f6936` (auteur DESMOND-77, pendant la session d'audit) a affaibli la règle mot de passe `LoginPage` `min(10)` → `min(1)` — réaligné côté test (`ceaac64`) mais **intention à confirmer** (régression identique annulée une fois en Task 12). | Moyenne |
| R3 | `comptes/migrations/0004` = DROP + ADD de `ecole_id` (pas `AlterField`) → destructif si rejoué sur données peuplées. Sûr aujourd'hui (table née vide). | Moyenne |
| R4 | `W036` à chaque `manage.py` : `UniqueConstraint(condition=…)` no-op sur MySQL. L'invariant « une seule année courante » repose **entièrement** sur `services.definir_annee_courante`. Toute écriture directe de `est_courante` (shell, futur endpoint) casse l'invariant. | Moyenne |
| R5 | CI sans gate `spectacular` ni anti-dérive `gen:api` → divergence API / types possible sans échec rouge. | Moyenne |
| R6 | Colonnes d'audit `cree_par` / `modifie_par` (FK `utilisateur`) du modèle SQL **non encore portées en ORM** — `inscription` (Phase 3) est la 1ʳᵉ table qui en a besoin ; motif de portage à décider avant. | Moyenne |
| R7 | Bundle front 572 kB, pas de code-splitting — s'aggrave à chaque module. | Faible |
| R8 | `infra` jamais exécutée bout-en-bout. | Faible (connu) |
| R9 | `piece_dossier.inscription_id` → les pièces de dossier **dépendent d'une inscription**, alors que §16 les range en Phase 2 « Personnes ». Couplage à trancher (voir §8). | Faible (cadrage) |

---

## 6. Matrice fonctionnelle

| Domaine | Spec | Plan | DB SQL | Backend | API | Frontend | Tests | État |
|---|---|---|---|---|---|---|---|---|
| Référentiel académique | ✅ | ✅ | ✅ 001 | ✅ | ✅ 11 CRUD | ✅ 11 écrans | ✅ 74 back / 19 front | **Terminé, non mergé / non revu** |
| Utilisateurs & audit | ✅ | ✅ | ✅ 002 | ✅ | ✅ auth | ✅ login | ✅ 37 | **Terminé (mergé)** |
| Personnes & inscriptions | ✅ §6 M2 | ❌ | ✅ 003 | ❌ | ❌ | ❌ | ✅ SQL 003 | Spec + DB seulement |
| Scolarité & facturation | ✅ §6 M3 | ❌ | ✅ 004 | ❌ | ❌ | ❌ | ✅ SQL 004 | Spec + DB seulement |
| Encaissements & trésorerie | ✅ §6 M4 | ❌ | ✅ 005 | ❌ | ❌ | ❌ | ✅ SQL 005 | Spec + DB seulement |
| RH & paie | ✅ §6 M5 | ❌ | ✅ 006 | ❌ | ❌ | ❌ | ✅ SQL 006 | Spec + DB seulement |
| Évaluations & résultats | ✅ §6 M6 | ❌ | ✅ 007 | ❌ | ❌ | ❌ | ✅ SQL 007 | Spec + DB seulement |
| Vues / reporting | ✅ §7 | ❌ | ✅ 008 | ❌ | ❌ | ❌ | ✅ SQL 008 | Spec + DB seulement |
| Données de référence (seed) | ✅ §8 | partiel | ✅ 009 | `seed_socle` + `seed_referentiel` | — | — | ✅ | Partiel (par module) |
| Imports Excel | ✅ (`CORRESPONDANCE.md`) | ❌ | — | ❌ | ❌ | ❌ | ❌ | Non commencé |
| Documents PDF | ✅ (T : WeasyPrint) | ❌ | — | ❌ | ❌ | ❌ | ❌ | Non commencé |
| Infra runtime | ✅ | ✅ | — | écrit | — | — | statique | Jamais exécutée |

---

## 7. Matrice de traçabilité (règles métier critiques)

| Règle | Source | Table(s) | Modèle Django | Service | Endpoint | Interface | Test |
|---|---|---|---|---|---|---|---|
| Montants = entiers FCFA `DECIMAL(12,0)`, jamais de flottant | conv §5, prompt §7 | toutes tables monétaires | — (dès Phase 3) | — | — | — | ❌ à créer Phase 3/4 |
| Identité ≠ inscription annuelle | D1, prompt §7 | `etudiant` / `inscription` | ❌ | ❌ | ❌ | ❌ | SQL 003 ✅ |
| `inscription` unique par (étudiant, année) | design §6 M2 | `inscription` | ❌ | ❌ | ❌ | ❌ | SQL 003 ✅ |
| `numero_ordre` séquentiel par (école, année), réinit. annuelle | design §6 M2 | `inscription` | ❌ | **à créer** (séquence + `transaction.atomic`) | `POST /inscriptions/` | ❌ | SQL 003 ✅ |
| Échéancier généré depuis la grille, n°0 = inscription | D13 | `echeance` | ❌ | ❌ | `POST /inscriptions/{id}/…` | ❌ | SQL 004 ✅ |
| Boursier : seule échéance 0 due, 1..N `pris_en_charge_bourse` | D16 | `bourse`, `echeance` | ❌ | ❌ | ❌ | ❌ | SQL 004 ✅ |
| Grand livre : tout flux → `mouvement` ; virement = 2 mouvements liés | D14 | `compte`, `mouvement`, `virement` | ❌ | ❌ | ❌ | ❌ | SQL 005 ✅ |
| Validation matière LMD ≥ 10/20, sans compensation | D3–D5 | `resultat_matiere` | ❌ | ❌ | ❌ | ❌ | SQL 007 ✅ |
| Note retenue = `max(normale, min(rattrapage, 10))` | D6 | `resultat_matiere` | ❌ | ❌ | ❌ | ❌ | SQL 007 ✅ |
| Passage 60 / 48–59 (dette) / < 48 (redoublement) | D7 | `resultat_annuel`, `dette_credit` | ❌ | ❌ | `POST /resultats/{id}/deliberer/` | ❌ | SQL 007 ✅ |
| CFPA : moyenne /20 ≥ 10 → admis | D8 | `resultat_annuel` | ❌ | ❌ | ❌ | ❌ | SQL 007 ✅ |
| Audit des opérations sensibles (auteur / date / avant / après / IP), jamais de secret | D20, prompt §7 | `journal_audit` + `cree_par` / `modifie_par` | `AuditLogMixin` ✅ ; colonnes FK ❌ | ✅ mixin | monté sur `referentiel` ✅ | — | 37 socle ✅ |
| RBAC exclusivement serveur (5 rôles `COMPTABLE`/`DAF`/`DIRECTION`/`SCOLARITE`/`LECTURE`) | prompt §12 | `role`, `utilisateur_role` | ✅ `ARole`, `PeutEcrire*` | ✅ | ✅ | masquage seul | ✅ |

---

## 8. Backlog priorisé

### CRITIQUE

1. **Revue + merge de Phase 1** (`phase-1-referentiel` → `main`). Passer Tasks 12–14 en
   `requesting-code-review` (scaffold générique, 11 descripteurs, clôture), corriger les findings,
   merger. Prérequis à toute Phase 2.
2. **Phase 2 — Personnes / Étudiants** (§16). Voir §10.

### IMPORTANT

3. CI : ajouter le gate `spectacular --file …` (0 Error) + contrôle de dérive de `schema.d.ts`
   (`npm run gen:api` puis `git diff --exit-code`).
4. Trancher R2 : intention du commit `a1f6936` — garder `min(1)` ou restaurer une vraie règle de
   mot de passe côté SPA.
5. Décider le motif de portage ORM des **colonnes d'audit** `cree_par` / `modifie_par` (mixin de
   modèle + hook `perform_create` / `perform_update`) — nécessaire dès `inscription` (Phase 3), à
   cadrer en fin de Phase 2.

### NORMAL

6. Silencer explicitement `W036` (ou documenter le choix de le laisser).
7. `comptes/0004` : réécrire en two-step non destructif avant toute mise en données réelles.
8. Code-splitting frontend par module (routes `lazy`) avant que le bundle ne gonfle.
9. Coquille d'un **Dashboard** vide (route + placeholder) pour ancrer la navigation.
10. `infra` : `docker compose up -d --build` bout-en-bout dans un env réseau normal (checklist
    socle Task 8) ; gater `C2-ssl` sur `DB_SSL_CA`.
11. `derniere_connexion` : brancher ou retirer.

### AMÉLIORATION

- Dérivation des schémas Zod depuis OpenAPI (explicitement déféré Phase 1).
- Contrainte croisée `niveau.credits_requis` ↔ `ecole.regime`.

### HORS PÉRIMÈTRE v1 (design §9 / prompt §9)

PostgreSQL, SQLite réel, MongoDB, Firebase, GraphQL, microservices, Kubernetes, WebSockets,
Redis, Celery, multi-tenant SaaS, Flutter, SSO, cloud complexe, portail étudiant / parent,
paiement en ligne, mobile.

---

## 9. Phase recommandée en premier

Après le merge de Phase 1 : **Phase 2 — Personnes / Étudiants** (§16 PHASE 2), périmètre resserré
au sous-graphe sans couplage aval :

- **Inclus** : `etudiant` (identité persistante, `matricule` unique groupe), `affiliation`
  (`PERE` / `MERE` / `TUTEUR`, `ON DELETE CASCADE`, unicité `(etudiant, type)`), `situation_bac`
  (1:0..1), `type_piece` (référentiel pur, CRUD).
- **Reporté en Phase 3** : `piece_dossier` (FK `inscription`, ne peut exister avant une
  inscription — R9) et toute la logique d'inscription / échéancier.
- **Frontend** : liste + recherche serveur étudiants (`matricule`, `nom`, `prenoms`), création /
  édition, **fiche étudiant** (écran bespoke agrégeant affiliations + BAC), CRUD `type_piece` via
  le scaffold `Descripteur` existant.
- **Pas d'argent, pas de transaction multi-étapes, pas de colonnes d'audit** sur ces tables
  (conforme au design) → complexité proche de `referentiel`, réutilisation directe de
  `_BaseReferentielViewSet`, `createResourceHooks`, `Descripteur`.

---

## 10. Plan détaillé proposé — Phase 2 (esquisse, à formaliser en spec + plan)

Méthodologie §15 : PHASE 2 rédige d'abord
`docs/superpowers/specs/2026-09-XX-phase-2-personnes-etudiants-design.md`, puis
`docs/superpowers/plans/…`, puis exécution en petites tâches TDD.

| # | Tâche | Fichiers | Critère d'acceptation |
|---|---|---|---|
| T1 | App `personnes` + 4 modèles (`etudiant`, `affiliation`, `situation_bac`, `type_piece`) + migration `0001`, `db_table` explicites, `BigAutoField` | `backend/personnes/models.py`, `migrations/0001` | `sqlmigrate` diffé vs `db/migrations/003` (écarts justifiés : bigint, `ENUM` → `TextChoices`) ; `makemigrations --check` vert |
| T2 | Tests modèles — portage des assertions de `db/tests/test_003` (matricule unique, unicité `(etudiant, type)`, cascade affiliation, `situation_bac` 1:0..1) | `personnes/tests/test_models.py` | RED → GREEN |
| T3 | Serializers (`EtudiantSerializer` + lecture imbriquée `affiliations` / `situation_bac` ; `AffiliationSerializer` ; `SituationBacSerializer` ; `TypePieceSerializer`) | `personnes/serializers.py` | champs = miroir SQL ; `spectacular` 0 Error |
| T4 | Permissions (`PeutEcrirePersonnes` = `SCOLARITE`, `DIRECTION` ; lecture 5 rôles) + FilterSets (`sexe`, `nationalite`, `a_le_bac`) | `personnes/permissions.py`, `filters.py` | tests unitaires permissions par rôle |
| T5 | ViewSets + router `/api/v1/personnes/` (`etudiants`, `affiliations`, `situation-bac`, `types-piece`) réutilisant une base CRUD partagée ; recherche serveur `matricule` / `nom` / `prenoms` | `personnes/views.py`, `urls.py`, `config/urls.py` | CRUD testé par rôle ; 409 suppression protégée (effectif dès Phase 3) |
| T6 | Endpoint agrégat `GET /api/v1/personnes/etudiants/{id}/fiche/` (identité + affiliations + BAC), `@extend_schema` | `personnes/views.py` | 1 requête `prefetch_related` ; testé |
| T7 | `seed_personnes` idempotent (codes `type_piece` : `ACTE_NAISSANCE`, `RELEVE_BAC`, `PHOTOS`, `LETTRE_MOTIVATION`, `CERTIF_SCOLARITE`) | `personnes/management/commands/seed_personnes.py` | double run sans doublon |
| T8 | `gen:api` + adaptation des types front | `frontend/src/api/schema.d.ts` | `npm run typecheck` vert |
| T9 | Frontend : descripteurs `etudiant` + `typePiece` (scaffold), route `/personnes/*` sous AppShell, module sidebar `personnes` → `disponible: true` | `frontend/src/personnes/config/*.tsx`, `routes.tsx`, `app/Sidebar.tsx` | liste + filtres + pagination rendus |
| T10 | Frontend : **fiche étudiant** `/personnes/etudiants/:id` (sections identité / affiliations / BAC, états chargement / erreur / vide) | `frontend/src/personnes/FicheEtudiant.tsx` + test | rend les 3 sections depuis `/fiche/` mocké |
| T11 | Vérif globale (toutes portes) + `CLAUDE.md` (`personnes` livré) + rapport §26 + merge | — | portes vertes en une passe |

**Décisions à acter dans la spec Phase 2 :**

- (a) Factoriser `referentiel.views._BaseReferentielViewSet` → `core/viewsets.py` `_BaseCrudViewSet`
  (réutilisé par tous les modules) ;
- (b) `EtudiantSerializer` — affiliations / BAC en **lecture imbriquée seule**, écriture par leurs
  propres endpoints (évite un serializer d'écriture composite fragile) ;
- (c) `matricule` — **généré côté serveur** (`<POLE>-<AAAA>-<NNNN>`) ou saisi ? Le SQL ne
  l'impose pas → **point ouvert à trancher** (prompt §25), à documenter comme `Decision`.

---

## 11. Prochaine étape

Séquence recommandée : **(1)** revue + merge Phase 1 → **(2)** brainstorming + spec + plan
Phase 2 → **(3)** exécution TDD Phase 2 → **(4)** Phase 3 (Inscriptions), etc. selon l'ordre
§16 du prompt maître.

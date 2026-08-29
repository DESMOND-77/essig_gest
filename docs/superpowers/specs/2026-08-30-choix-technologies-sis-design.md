# Choix des technologies — Application de gestion du Groupe Scolaire (`mlamine`)

**Date :** 2026-08-30
**Statut :** design validé, prêt pour plan d'implémentation
**Portée :** choix de la pile technique de l'application (langages, frameworks, base,
infrastructure, CI/CD, tests, sécurité). Le modèle de données est traité dans
`2026-08-29-modele-donnees-gestion-groupe-scolaire-design.md` (validé).

---

## 1. Contexte et contraintes

Le groupe scolaire de Franceville (Gabon) remplace un système de classeurs Excel
(un fichier par année). Le modèle de données cible (40+ tables, 6 modules : référentiel
académique, personnes & inscriptions, scolarité & facturation, encaissements & trésorerie,
RH & paie, évaluations & résultats) est **déjà conçu, écrit en migrations SQL MySQL 8.4 et
couvert par un harnais de tests** (`db/migrations/*.sql`, `db/tests/*.sql`, `db/run.sh`).

Contraintes qui pilotent les choix :

| # | Contrainte | Source |
|---|---|---|
| C1 | **Périmètre v1 = outil interne** : personnel administratif uniquement. Portail étudiant/parent, notifications, paiement en ligne, emploi du temps sont **hors périmètre**. | design données §3 |
| C2 | **API-first** : le web est livré en v1, mais l'API doit rester réutilisable par une application mobile (consultation notes/scolarité) dans 6–18 mois. | décision de cadrage |
| C3 | **~5 rôles internes**, un seul groupe scolaire. Pas de SaaS multi-établissements. | design données §D20 |
| C4 | **Développeur unique, en apprentissage.** La pile doit minimiser les pièces mobiles et privilégier des technologies connues (Django, React, MySQL). | décision de cadrage |
| C5 | **Déploiement sur un VPS cloud unique** (OVH / Hetzner / Scaleway). | décision de cadrage |
| C6 | **Français**, devise **FCFA** (`XAF`, sans sous-unité → `DECIMAL(12,0)`). | design données §1 |
| C7 | Modèle de données validé en **MySQL 8.4**, migrations + tests déjà livrés. | repo `db/` |

## 2. Synthèse des avis externes (`sis-ideas.md`)

Cinq réponses d'IA ont été recueillies. Convergence forte sur : API backend + front séparé,
React + TypeScript + Tailwind, RBAC côté serveur, Docker, base relationnelle. Les
recommandations **non retenues** l'ont été parce qu'elles répondaient à un profil « SaaS
scolaire multi-établissements avec portails et temps réel » qui n'est pas celui de la v1
(voir §9).

- **Backend** : Django + DRF recommandé par 3 IA sur 5 ; correspond au profil « données
  très relationnelles, admin intégré » et à l'expérience du développeur. Retenu.
- **Base** : PostgreSQL recommandé par les 5. **Non retenu** — aucun besoin du modèle
  n'exige une capacité propre à PostgreSQL, et le coût de portage (migrations + harnais de
  tests + double courbe d'apprentissage) n'achète rien de concret ici. Voir §4.
- **Mobile** : Flutter recommandé par 4 IA. Hors périmètre v1 (C1) ; l'API reste
  « mobile-ready » (C2).

## 3. Décisions

| # | Sujet | Décision |
|---|---|---|
| T1 | Style d'architecture | SPA React découplée consommant une API REST Django/DRF. Un seul dépôt (monorepo : `backend/`, `frontend/`). |
| T2 | Base de données | **MySQL 8.4** conservée. |
| T3 | Source de vérité du schéma | **Django (ORM + migrations)**. Les `db/migrations/*.sql` et le design données restent la **référence de conception** ; les assertions de `db/tests/*.sql` sont portées en tests d'intégrité `pytest`. Option A. |
| T4 | Backend | Python 3.13 · Django 5.2 LTS · Django REST Framework 3.16. |
| T5 | Auth API | JWT via `djangorestframework-simplejwt` : access 15 min, refresh rotatif + blacklist. Refresh token en cookie `httpOnly`, access en mémoire côté SPA. |
| T6 | RBAC | Modèle `utilisateur` / `role` / `utilisateur_role` (scopable par école) du design données. `User` Django personnalisé + couche de permissions DRF maison. Contrôle **exclusivement côté serveur**. |
| T7 | Frontend | React 19 · TypeScript · Vite · React Router · TanStack Query · React Hook Form + Zod · Tailwind CSS · shadcn/ui · TanStack Table. |
| T8 | Contrat d'API | Schéma OpenAPI généré par `drf-spectacular` ; types TypeScript générés par `openapi-typescript`. |
| T9 | i18n | Français uniquement en v1. Aucun framework i18n ; chaînes centralisées côté front pour permettre l'ajout ultérieur de `react-i18next`. |
| T10 | Génération de documents | WeasyPrint (HTML/CSS → PDF) pour bulletins, reçus, fiches de scolarité. |
| T11 | Import des données existantes | `openpyxl` + commandes de management Django, à partir de `test 2026.xlsx` et `Enseignants.xlsx`. Correspondances : voir `db/CORRESPONDANCE.md`. |
| T12 | Tâches asynchrones | **Aucune infrastructure au démarrage.** Génération PDF et imports en synchrone. Ajout de Celery + Redis (ou Django-Q2) le jour où une tâche lente réelle apparaît. |
| T13 | Infrastructure | Docker Compose sur un VPS unique. Services : `caddy`, `web`, `db`. `redis` ajouté avec T12 si besoin. |
| T14 | Reverse-proxy / TLS | Caddy (HTTPS automatique). Sert le build React statique, proxifie `/api` vers Gunicorn. |
| T15 | Serveur d'application | Gunicorn, workers synchrones. |
| T16 | Stockage fichiers | Disque du VPS en v1, via `django-storages` pour basculer vers S3/MinIO sans changement de code. |
| T17 | Sauvegardes | `mysqldump` en cron → archive chiffrée → poussée hors-site (`rclone` vers object storage). Procédure de restauration testée et documentée. |
| T18 | CI/CD | GitHub Actions, un workflow. Back : `ruff`, `pytest` + `pytest-django` contre un service MySQL 8.4, `factory_boy`. Front : `tsc`, `eslint`, `vitest` + React Testing Library, `build`. Déploiement : SSH + `docker compose pull && up -d`. |
| T19 | Tests | Back : `pytest`, `pytest-django`, `factory_boy`, `APIClient` DRF ; tests d'intégrité portés depuis `db/tests/`. Front : `vitest` + React Testing Library. Playwright pour 2–3 parcours critiques (login, inscription, encaissement) — optionnel en v1. |
| T20 | Sécurité | HTTPS + HSTS ; throttling DRF sur les routes d'authentification ; hachage Argon2 (`argon2-cffi`) ; `journal_audit` alimenté par mixin DRF / signaux ; sauvegardes chiffrées. 2FA TOTP (`django-otp`) ajoutable ultérieurement. |
| T21 | Conformité | Loi gabonaise n°00001/2011 (protection des données personnelles, CNPDCP) : registre des traitements, finalités, durées de conservation. Aucun impact sur la pile ; à traiter au niveau organisationnel. |
| T22 | Configuration | `django-environ` + fichiers `.env` (convention déjà en place, cf. `.env.example`). |

## 4. Justification du maintien de MySQL 8.4 (T2)

Aucune fonctionnalité des 6 modules du modèle n'exige une capacité propre à PostgreSQL :

- Contraintes `CHECK` (ex. « Σ pondération = 100 », « exactement une des deux FK non nulle »)
  : supportées et appliquées par MySQL 8.0.16+.
- Colonnes générées (`montant_total`, `ecart`, `montant`) : `GENERATED ALWAYS AS` supporté
  par MySQL 8.x ; `GeneratedField` Django 5.x fonctionne sur MySQL.
- ENUM : le design données prévoit déjà « ENUM natif si le SGBD le supporte proprement,
  sinon table de référence + FK ». Django modélise en `CharField(choices=…)` ou table de
  correspondance, indépendamment du SGBD.
- Colonne `JSON` (`journal_audit.valeurs_avant/apres`) : type `JSON` natif MySQL 8.x.

Bénéfices conservés : ~9 migrations + ~10 fichiers de tests + `db/run.sh` déjà écrits et
validés ; design données rédigé en idiomes MySQL ; support Django/DRF de 1re classe ;
familiarité du développeur ; disponibilité de MySQL/MariaDB chez les hébergeurs et auprès
d'un administrateur local.

Ce que PostgreSQL aurait apporté et qui est abandonné sciemment : migrations DDL
transactionnelles (rollback propre en cas d'échec) et un optimiseur légèrement supérieur
sur les requêtes analytiques lourdes. Non significatif à l'échelle du projet (un groupe
scolaire, quelques milliers d'étudiants, dizaines de milliers de mouvements par an). Une
bascule ultérieure reste possible si un besoin réel émerge (multi-établissements, BI
lourde, `pgvector`).

## 5. Architecture cible

```
                       ┌───────────────────────────────┐
   navigateur  ───────▶│  Caddy  (VPS, HTTPS auto)      │
   (personnel)         │  · sert le build React (dist/) │
                       │  · proxifie /api  ─────────────┼──▶ Gunicorn ──▶ Django + DRF
                       └───────────────────────────────┘                      │
                                                                              ▼
   (client mobile futur) ───────────────  même API REST  ──────────────▶  MySQL 8.4
                                                                     (volume Docker)
```

- **Monorepo** : `backend/` (projet Django), `frontend/` (projet Vite), `infra/`
  (`docker-compose.yml`, `Caddyfile`, scripts de sauvegarde), `db/` (référence de
  conception SQL — conservé), `docs/`.
- **Frontière API** : toute logique métier et tout contrôle d'accès dans le backend. Le
  front n'applique que de l'ergonomie (masquer/afficher) — jamais de règle de sécurité.
- **Modules Django** alignés sur les 6 modules du modèle de données, plus un module
  transverse `comptes` (utilisateurs, rôles, audit) :
  `referentiel`, `personnes`, `scolarite`, `tresorerie`, `paie`, `resultats`, `comptes`.
  Chaque module : `models`, `serializers`, `permissions`, `views`, `tests`.

## 6. Pile backend détaillée

| Besoin | Bibliothèque | Version cible |
|---|---|---|
| Runtime | CPython | 3.13.x |
| Framework web | Django | 5.2 LTS |
| API REST | djangorestframework | 3.16.x |
| Driver MySQL | mysqlclient | 2.2.x |
| JWT | djangorestframework-simplejwt | 5.x |
| Schéma OpenAPI | drf-spectacular | 0.28.x |
| Filtres de liste | django-filter | 25.x |
| CORS | django-cors-headers | 4.x |
| Config env | django-environ | 0.12.x |
| Hachage mots de passe | argon2-cffi | 23.x |
| PDF | WeasyPrint | 63.x |
| Lecture Excel | openpyxl | 3.x |
| Serveur WSGI | gunicorn | 23.x |
| Stockage abstrait | django-storages | 1.14.x |
| Tests | pytest, pytest-django, factory_boy | — |
| Lint / format | ruff | — |

Les versions sont indicatives (dernière mineure stable au moment de l'implémentation) ;
Django est **épinglé sur la série 5.2 LTS**.

## 7. Pile frontend détaillée

| Besoin | Choix |
|---|---|
| Build / dev server | Vite |
| Vue | React 19 + TypeScript (mode `strict`) |
| Routage | React Router |
| État serveur (cache requêtes) | TanStack Query |
| Formulaires + validation | React Hook Form + Zod |
| Style | Tailwind CSS |
| Composants | shadcn/ui (Radix ; composants copiés dans le dépôt) |
| Tableaux de données | TanStack Table |
| Types d'API | `openapi-typescript` depuis le schéma `drf-spectacular` |
| État client (si nécessaire) | Zustand |
| Tests | Vitest + React Testing Library ; Playwright (parcours critiques, optionnel) |

Auth SPA : à la connexion, l'API pose le refresh token en cookie `httpOnly; Secure;
SameSite=Strict` et renvoie l'access token dans le corps ; le front garde l'access en
mémoire et le renouvelle silencieusement via `/api/auth/refresh` (protégé CSRF).

## 8. Infrastructure et exploitation

- **`docker-compose.yml`** : `caddy` (ports 80/443, volume certificats), `web` (Gunicorn,
  dépend de `db`), `db` (MySQL 8.4, volume de données). Fichier `.env` non versionné
  (`.env.example` fourni — déjà présent).
- **Caddy** : `Caddyfile` — un site, TLS automatique, `handle_path /api/*` → `web:8000`,
  `handle` → fichiers statiques `dist/` avec fallback SPA.
- **Sauvegardes** : conteneur/cron `mysqldump | gzip | age -e` puis `rclone copy` vers un
  bucket object storage. Rétention 30 jours. **Test de restauration mensuel documenté.**
- **Journalisation** : logs Django → stdout → `docker compose logs` ; rotation gérée par
  Docker. Pas de stack d'observabilité dédiée en v1 (Sentry ajoutable via DSN).
- **Migrations en production** : `docker compose run --rm web python manage.py migrate` dans
  la procédure de déploiement, avant le redémarrage de `web`.

## 9. Écarté volontairement (YAGNI)

| Écarté | Motif | Condition de réintroduction |
|---|---|---|
| Kubernetes, microservices | ~5 utilisateurs, un VPS suffit | charge ou équipe justifiant l'orchestration |
| MongoDB / Firebase / datastore hybride | modèle 100 % relationnel | besoin documentaire réel non modélisable |
| Temps réel / WebSockets, NestJS | aucun cas d'usage en v1 | messagerie interne ou tableau de bord live |
| SMS / push / campagnes e-mail | hors périmètre v1 (C1) | ouverture d'un portail étudiant/parent |
| GraphQL | REST + OpenAPI couvre le besoin | clients multiples aux besoins de projection divergents |
| Celery + Redis dès le départ | pas de tâche lente identifiée | génération PDF de masse, imports longs (T12) |
| SSO / SAML / OIDC / LDAP | 5 utilisateurs internes | intégration à un annuaire existant |
| Flutter / React Native (v1) | hors périmètre (C1), API mobile-ready (C2) | décision d'ouvrir l'app mobile |
| pgvector / fonctionnalités IA | aucun besoin | recherche sémantique / assistant |
| Infrastructure multi-tenant | un seul groupe scolaire (C3) | commercialisation SaaS |

## 10. Risques et points de vigilance

| Risque | Mitigation |
|---|---|
| Charge solo + SPA découplée (C4) vs monolithe plus simple | Front volontairement sobre (pas de sur-outillage) ; types d'API générés pour réduire les erreurs de contrat ; shadcn/ui plutôt qu'une lib lourde. |
| Portage du modèle SQL validé vers l'ORM Django (T3) : risque de divergence | Tests d'intégrité `pytest` portés depuis `db/tests/` ; revue table par table contre le design données §6 ; `db/migrations/*.sql` conservé comme référence de contrôle. |
| Colonnes générées / contraintes `CHECK` mal reproduites par l'ORM | Utiliser `GeneratedField` (Django 5.x) et `Meta.constraints` (`CheckConstraint`) ; vérifier le DDL émis (`sqlmigrate`) contre le SQL de référence. |
| Connexion Internet du secrétariat (accès au VPS) | Hors pile ; à confirmer avec l'établissement. Repli éventuel : réplique locale (décision d'infra ultérieure, non retenue en v1). |
| Séquence globale `encaissement.recu_numero` (design §P5) en environnement concurrent faible | Compteur applicatif sous transaction / `SELECT … FOR UPDATE` sur une table de séquence. |

## 11. Suite

Après validation de ce document : plan d'implémentation phasé (compétence `writing-plans`),
dans l'ordre de dépendance du design données §10 :

1. Socle projet : monorepo, Docker Compose, Django + DRF, auth JWT, module `comptes`
   (utilisateurs / rôles / audit), CI.
2. Module `referentiel` (Module 1 du modèle) + amorçage SPA (auth, layout, client API typé).
3. Module `personnes` (Module 2).
4. Modules `scolarite` + `tresorerie` (Modules 3 & 4, interdépendants).
5. Module `paie` (Module 5).
6. Module `resultats` (Module 6).
7. Vues / rapports, commandes d'import, contrôles d'intégrité, génération PDF.

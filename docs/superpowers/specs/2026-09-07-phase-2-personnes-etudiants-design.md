# Phase 2 — Module `personnes` (étudiants, affiliations, BAC, types de pièce)

_Date : 2026-09-07 · Statut : validé (brainstorming) · Base : `main` @ Phase 1 mergée
(`4518005`) · Branche de travail : `phase-2-personnes`._

Suit la méthodologie du prompt maître §15 (analyse → spec → plan → implémentation) et l'audit
`docs/superpowers/specs/2026-09-07-audit-etat-projet.md` §9–§10. Reprend la forme de
`2026-09-03-phase-1-referentiel-academique-design.md`.

---

## 1. Objectif

Livrer le module **personnes** : l'identité persistante de l'étudiant (indépendante de toute
année scolaire), ses affiliations familiales, sa situation BAC, et le référentiel `type_piece`.
Générer le **matricule** côté serveur. Fournir l'API REST CRUD, les types TypeScript, la commande
de seed, et les écrans SPA (liste + création/édition étudiant, fiche étudiant, CRUD `type_piece`).

Ne couvre **pas** l'inscription annuelle ni le dossier de pièces (`piece_dossier`) — Phase 3.

## 2. Périmètre

**Inclus**
- App Django `personnes` : modèles `etudiant`, `affiliation`, `situation_bac`, `type_piece`,
  `compteur_matricule` ; migration initiale.
- Refactor : `referentiel.views._BaseReferentielViewSet` → `core/viewsets.py._BaseCrudViewSet`
  (base partagée, sans `permission_classes`). `referentiel` et `personnes` en héritent.
- Service `generer_matricule(pole, nom, prenoms)` + `initiales(nom, prenoms)`.
- API `/api/v1/personnes/` : `etudiants`, `affiliations`, `situation-bac`, `types-piece`.
  Pagination socle, recherche serveur, filtres, tri. Schéma OpenAPI 0 Error, types TS régénérés.
- Permissions serveur `PeutEcrirePersonnes` (écriture `DIRECTION` + `SCOLARITE`, lecture = tout
  authentifié). `AuditLogMixin` sur les 4 ViewSets.
- Commande `seed_personnes` idempotente (5 `type_piece`).
- Frontend : `frontend/src/personnes/` — descripteurs `etudiant` + `typePiece` via le scaffold
  `Descripteur` ; écran bespoke `FicheEtudiant` ; routes `/personnes/*` sous l'AppShell ; module
  sidebar `personnes` activé.
- Tests : portage des assertions de `db/tests/test_003_personnes_inscriptions.sql` applicables +
  tests service/serializers/API/permissions/seed + tests frontend.

**Exclus** — voir §17.

## 3. Acteurs

| Rôle | Accès personnes |
|---|---|
| `SCOLARITE` | Lecture + écriture (création/édition étudiants, affiliations, BAC, `type_piece`). |
| `DIRECTION` | Lecture + écriture. |
| `COMPTABLE`, `DAF`, `LECTURE` | Lecture seule. |
| Superuser | Tout (bypass permission). |

## 4. Cas d'utilisation

1. **Ouvrir un dossier étudiant** : la scolarité saisit identité (nom, prénoms, sexe, naissance,
   contacts) + le **pôle** ; le serveur attribue le matricule. Retour = l'étudiant créé avec son
   matricule.
2. **Compléter le dossier** : ajouter jusqu'à 3 affiliations (PÈRE/MÈRE/TUTEUR) et la situation
   BAC via leurs endpoints propres.
3. **Rechercher un étudiant** par matricule, nom ou prénoms ; filtrer par sexe / présence du BAC.
4. **Consulter la fiche** d'un étudiant : identité + affiliations + BAC en une vue.
5. **Corriger** une donnée d'identité (sauf le matricule, immuable).
6. **Gérer le référentiel `type_piece`** (liste des pièces attendues dans un dossier).

## 5. Règles métier

| # | Règle | Portée |
|---|---|---|
| RP-1 | `etudiant.matricule` unique au niveau groupe, **immuable après création**, généré serveur. Format `<POLE>-FCV<INITIALES><N>`. | modèle + serializer + service |
| RP-2 | `<INITIALES>` = 2 premières lettres du premier mot de `nom` + 2 premières lettres du premier mot de `prenoms`, translittérées ASCII, majuscules. Mot < 2 lettres → complété par `X` ; mot vide/sans lettre → `XX`. Longueur finale toujours 4. | service `initiales` |
| RP-3 | `<N>` = compteur **par pôle, strictement croissant, jamais réinitialisé** (table `compteur_matricule`). Pas de zéro-padding. Enveloppe `VARCHAR(20)` : préfixe (≤ 5+4+4 = 13 car.) laisse ≥ 7 chiffres à `<N>` — largement suffisant. | service + `compteur_matricule` |
| RP-4 | Le `pole` est fourni à la création (champ write-only, `ChoiceField` sur `referentiel.Ecole.Pole`), sert uniquement à choisir la séquence et bâtir le matricule. **Non stocké** comme colonne ; récupérable via `matricule LIKE '<POLE>-%'`. Ignoré en modification. | serializer |
| RP-5 | Génération du matricule sous `transaction.atomic` + `select_for_update` sur la ligne `compteur_matricule` du pôle (anti-course). La contrainte `unq_etudiant_matricule` reste un garde-fou. | service |
| RP-6 | `affiliation` : au plus une par `(etudiant, type)`. Suppression d'un `etudiant` → cascade sur ses `affiliation` et sa `situation_bac`. | modèle |
| RP-7 | `situation_bac` : 0 ou 1 par étudiant (`OneToOneField`). | modèle |
| RP-8 | Suppression d'une entité référencée par une FK entrante `RESTRICT` → HTTP 409 (`ConflitSuppressionException`, via `SuppressionProtegeeMixin`). Effectif surtout en Phase 3 (`inscription` → `etudiant`) ; le chemin mixin est testé dès la Phase 2. | ViewSet |
| RP-9 | `type_piece.code` unique. | modèle |

Note : le SQL de référence ne pose pas de `CHECK` sur `annee_obtention` ni sur les formats
d'email/téléphone. Aucune contrainte ajoutée en Phase 2 (cohérent avec la sobriété Phase 1) ;
validation de forme légère côté serializer/Zod uniquement (§12).

## 6. Modèle de données (portage de `db/migrations/003`)

`db_table` explicite sur chaque modèle. `BigAutoField` PK partout.

### `etudiant` (`db_table="etudiant"`)
| Champ | Type ORM | SQL réf. | Notes |
|---|---|---|---|
| matricule | `CharField(max_length=20)` unique | `VARCHAR(20)` UNIQUE | read-only serializer, généré serveur |
| numero_interne_archive | `CharField(max_length=20, null=True, blank=True)` | NULL | `# noqa: DJ001` (miroir SQL) |
| nom | `CharField(max_length=60)` | NOT NULL | |
| prenoms | `CharField(max_length=120)` | NOT NULL | |
| sexe | `CharField(max_length=1, choices=Sexe)` | `ENUM('M','F')` | `TextChoices` M/F |
| date_naissance | `DateField(null=True, blank=True)` | DATE NULL | |
| lieu_naissance | `CharField(max_length=120, null=True, blank=True)` | NULL | `# noqa: DJ001` |
| nationalite | `CharField(max_length=60, null=True, blank=True)` | NULL | `# noqa: DJ001` |
| email | `CharField(max_length=120, null=True, blank=True)` | NULL | `# noqa: DJ001` (pas d'`EmailField` — miroir SQL) |
| telephone | `CharField(max_length=40, null=True, blank=True)` | NULL | `# noqa: DJ001` |
| adresse | `CharField(max_length=255, null=True, blank=True)` | NULL | `# noqa: DJ001` |
| photo | `CharField(max_length=255, null=True, blank=True)` | NULL | chemin/URL, **pas** d'upload en Phase 2 |
| situation_matrimoniale | `CharField(max_length=11, choices=..., null=True, blank=True)` | `ENUM('CELIBATAIRE','MARIE','AUTRE')` NULL | |

Index : `models.Index(fields=["nom", "prenoms"], name="idx_etudiant_nom")`.
`__str__` → `f"{self.matricule} — {self.nom} {self.prenoms}"`.

### `affiliation` (`db_table="affiliation"`)
| Champ | Type ORM | Notes |
|---|---|---|
| etudiant | `ForeignKey(Etudiant, on_delete=CASCADE, related_name="affiliations")` | |
| type | `CharField(max_length=6, choices=Type)` | `ENUM('PERE','MERE','TUTEUR')` |
| nom | `CharField(max_length=60)` | |
| prenom | `CharField(max_length=120)` | |
| contact | `CharField(max_length=60)` | |
| profession | `CharField(max_length=120, null=True, blank=True)` | `# noqa: DJ001` |

Contrainte : `UniqueConstraint(fields=["etudiant", "type"], name="unq_affiliation")`.

### `situation_bac` (`db_table="situation_bac"`)
| Champ | Type ORM | Notes |
|---|---|---|
| etudiant | `OneToOneField(Etudiant, on_delete=CASCADE, related_name="situation_bac")` | |
| a_le_bac | `BooleanField(default=False)` | `TINYINT(1) DEFAULT 0` |
| annee_obtention | `IntegerField(null=True, blank=True)` | |
| serie | `CharField(max_length=20, null=True, blank=True)` | `# noqa: DJ001` |
| mention | `CharField(max_length=2, choices=Mention, null=True, blank=True)` | `ENUM('TB','B','AB','P')` |
| etablissement | `CharField(max_length=150, null=True, blank=True)` | `# noqa: DJ001` |
| ville | `CharField(max_length=80, null=True, blank=True)` | `# noqa: DJ001` |

### `type_piece` (`db_table="type_piece"`)
| Champ | Type ORM | Notes |
|---|---|---|
| code | `CharField(max_length=30)` unique (`unq_type_piece_code`) | |
| libelle | `CharField(max_length=120)` | |

### `compteur_matricule` (`db_table="compteur_matricule"`) — **hors SQL de référence**
| Champ | Type ORM | Notes |
|---|---|---|
| pole | `CharField(max_length=5, primary_key=True, choices=Ecole.Pole.choices)` | 1 ligne par pôle |
| valeur | `PositiveIntegerField(default=0)` | dernier numéro attribué |

### Écarts au SQL de référence (à consigner comme `Decision`, style D-ORM-*)
- **D-P2-1** — `BigAutoField`/`BIGINT` PK partout (vs `INT UNSIGNED`). Cohérent D-ORM-1.
- **D-P2-2** — `ENUM` → `TextChoices` (valeurs SQL exactes). Cohérent D-ORM-4.
- **D-P2-3** — `email` reste un `CharField` (pas d'`EmailField`) : miroir strict du SQL
  (`VARCHAR(120) NULL`, aucune contrainte de forme). Validation d'ergonomie éventuelle au front.
- **D-P2-4** — Nouvelle table `compteur_matricule`, sans équivalent SQL : séquence applicative
  nécessaire à RP-3/RP-5. Locale au module `personnes` en Phase 2 ; pourra être généralisée si
  `inscription.numero_ordre` (Phase 3) adopte le même mécanisme.
- **D-P2-5** — `piece_dossier` (présent dans `db/migrations/003`) **non porté** : FK `inscription`,
  reporté en Phase 3.
- **D-P2-6** — Colonnes d'audit `cree_par`/`modifie_par` : `etudiant`/`affiliation`/`situation_bac`
  n'en ont pas au design §5 → aucune en Phase 2. La traçabilité passe par `journal_audit`
  (`AuditLogMixin`). Le mixin de modèle `Auditable` (D-ORM-8) sera introduit en Phase 3 avec
  `inscription`.

Procédure D-ORM-9 : comparer chaque modèle au `.sql` via `python manage.py sqlmigrate personnes
0001`, consigner les écarts.

## 7. Unicités & index (repris du SQL)

- `unq_etudiant_matricule` (`etudiant.matricule`).
- `idx_etudiant_nom` (`etudiant.nom, prenoms`).
- `unq_affiliation` (`affiliation.etudiant, type`).
- `unq_situation_bac_etudiant` — porté par le `OneToOneField`.
- `unq_type_piece_code` (`type_piece.code`).
- `compteur_matricule.pole` = PK.

## 8. Workflows

### 8.1 Création d'un étudiant (`POST /api/v1/personnes/etudiants/`)
1. Payload : champs d'identité + `pole` (write-only, requis).
2. `EtudiantSerializer.create()` : `matricule = services.generer_matricule(pole, nom, prenoms)`
   puis `super().create()`.
3. `generer_matricule` : `with transaction.atomic()` → `CompteurMatricule.objects
   .select_for_update().get_or_create(pole=pole)` → `valeur += 1` → `save()` →
   `f"{pole}-FCV{initiales(nom, prenoms)}{valeur}"`.
4. `AuditLogMixin.perform_create` journalise `CREATION` (snapshot sans champ sensible).
5. Réponse 201 : l'étudiant + `affiliations: []` + `situation_bac: null`.

### 8.2 Modification (`PATCH /api/v1/personnes/etudiants/{id}/`)
`pole` et `matricule` ignorés/refusés en écriture. Audit `MODIFICATION` (avant/après).

### 8.3 Affiliation / BAC
Créées/éditées via `POST|PATCH /api/v1/personnes/affiliations/` et `.../situation-bac/`.
Doublon `(etudiant, type)` → 400 (`UniqueValidator` DRF inféré de `unq_affiliation`). 2ᵉ
`situation_bac` pour un étudiant → 400 (`UniqueValidator` inféré du `OneToOneField`).

### 8.4 Suppression
`DELETE` étudiant sans référence entrante → 204 (+ cascade affiliations/BAC, audit `SUPPRESSION`).
Avec référence `RESTRICT` (Phase 3) → 409, **pas** d'écriture d'audit (MRO Phase 1).

## 9. Permissions (RBAC serveur)

`personnes/permissions.py` : `PeutEcrirePersonnes` — copie conforme de
`referentiel.permissions.PeutEcrireReferentiel` (méthodes sûres → tout authentifié ; écriture →
`{"DIRECTION", "SCOLARITE"}` ; superuser bypass). Montée sur les 4 ViewSets via
`_BaseCrudViewSet` + `permission_classes` du sous-module.

| Route | Lire | Créer / Modifier / Supprimer |
|---|---|---|
| `etudiants`, `affiliations`, `situation-bac`, `types-piece` | tout rôle authentifié | `DIRECTION`, `SCOLARITE` |

## 10. API

Base `/api/v1/personnes/` (namespace `v1:`), routeur DRF, `_BaseCrudViewSet`
(`SuppressionProtegeeMixin` + `AuditLogMixin` + `ModelViewSet` + `DjangoFilterBackend` +
`SearchFilter` + `OrderingFilter`, `ordering=["id"]`). Pagination socle (`PageNumberPagination`).

| Route | `search_fields` | Filtres (`filterset_class`) | `ordering_fields` |
|---|---|---|---|
| `etudiants` | `matricule`, `nom`, `prenoms` | `sexe`, `nationalite`, `situation_matrimoniale`, `a_le_bac` (→ `situation_bac__a_le_bac`) | `nom`, `matricule`, `id` |
| `affiliations` | `nom`, `prenom` | `etudiant`, `type` | `id` |
| `situation-bac` | — | `etudiant`, `a_le_bac`, `mention` | `id` |
| `types-piece` | `code`, `libelle` | — | `code`, `id` |

Endpoints par route : `GET` liste (paginée, `?search=`, `?ordering=`, filtres), `GET` détail,
`POST`, `PATCH`/`PUT`, `DELETE` (204 ou 409).

`EtudiantViewSet.get_queryset` : `.prefetch_related("affiliations").select_related("situation_bac")`.
`get_serializer_class` : `EtudiantListSerializer` pour `list`, `EtudiantSerializer` sinon.

Toutes les routes : `@extend_schema(tags=["personnes"])`, `spectacular` 0 Error/0 Warning,
`npm run gen:api` régénère `frontend/src/api/schema.d.ts`.

### Serializers
- `EtudiantListSerializer` — champs plats + `matricule` (read-only).
- `EtudiantSerializer` — tous les champs ; `matricule` read-only ; `pole` =
  `ChoiceField(choices=Ecole.Pole.choices, write_only=True, required=False)` (exigé dans
  `create()`, ignoré dans `update()`) ; `affiliations` = `AffiliationSerializer(many=True,
  read_only=True)` ; `situation_bac` = `SituationBacSerializer(read_only=True)`.
- `AffiliationSerializer`, `SituationBacSerializer`, `TypePieceSerializer` — `ModelSerializer`
  plats, `fields = "__all__"`.

## 11. Interface (frontend)

`frontend/src/personnes/`
- `config/etudiant.tsx` — `Descripteur` :
  - `titre` « Étudiants », `endpoint` `personnes/etudiants`, `roleEcriture` `["DIRECTION","SCOLARITE"]`,
    `rechercheActive` true.
  - `colonnes` : `matricule`, `nom`, `prenoms`, `sexe`, `nationalite`.
  - `filtres` : `sexe` (M/F), `a_le_bac` (Oui=`true`/Non=`false`).
  - `champs` (formulaire) : `pole` (`select`, requis — **création uniquement**), `nom`, `prenoms`,
    `sexe` (select), `date_naissance` (text `AAAA-MM-JJ`), `lieu_naissance`, `nationalite`,
    `email`, `telephone`, `adresse`, `situation_matrimoniale` (select). Pas de `matricule` dans
    le formulaire.
  - `schema` Zod : miroir des types/longueurs ; `pole` `z.enum([...])`.
  - Limite connue du scaffold : le champ `pole` create-only n'est pas masqué en édition par
    `ResourceForm` tel quel → **Task dédiée** : soit étendre `Champ` avec `creationSeule?: boolean`,
    soit un écran de création distinct. Tranché dans le plan.
- `config/typePiece.tsx` — `Descripteur` : colonnes `code` / `libelle`, `roleEcriture`
  `["DIRECTION","SCOLARITE"]`, endpoint `personnes/types-piece`.
- `FicheEtudiant.tsx` — écran bespoke `/personnes/etudiants/:id` : `GET personnes/etudiants/:id/`,
  sections **Identité** / **Affiliations** (petit tableau) / **Situation BAC** ; `DataState`
  chargement/erreur/vide. Édition des affiliations/BAC **hors périmètre Phase 2**.
- `routes.tsx` — `routesPersonnes` : `personnes/etudiants` (liste), `personnes/etudiants/:id`
  (fiche), `personnes/types-piece` (liste). `handle.miette` « Personnes » / « Étudiants » /
  « Fiche » / « Types de pièce ». Câblé dans `src/routes.tsx` à côté de `routesReferentiel`.
- `app/Sidebar.tsx` — module `personnes` : `disponible: true`, `chemin: "/personnes/etudiants"`.

## 12. Validations

**Serveur** (serializers) : `pole` requis à la création (sinon `ValidationError` FR) ;
`matricule` jamais accepté en entrée ; longueurs = `max_length` des modèles ; `sexe` /
`situation_matrimoniale` / `type` / `mention` bornés par les `choices`. Doublons d'unicité →
400 DRF standard.

**Frontend** (Zod) : requis (`nom`, `prenoms`, `sexe`, `pole` à la création) ; `date_naissance`
regex `^\d{4}-\d{2}-\d{2}$` optionnelle ; longueurs miroir ; enums. Validation d'ergonomie
seulement — l'autorité reste serveur.

## 13. Erreurs

Format DRF standard + exceptions typées `core/exceptions.py`. 400 (payload invalide, doublon
d'unicité), 403 (`PermissionRefuseeException` — rôle insuffisant), 404, 409
(`ConflitSuppressionException` — suppression d'un objet référencé). `errors.ts` /
`messageErreur` du front couvrent déjà 400/403/404/409/5xx.

## 14. Audit

`AuditLogMixin` (hérité de `_BaseCrudViewSet`) journalise `CREATION` / `MODIFICATION` /
`SUPPRESSION` sur `etudiant`, `affiliation`, `situation_bac`, `type_piece`. Snapshot avant/après
+ IP ; aucun champ sensible (`CHAMPS_SENSIBLES`) — l'étudiant n'a ni mot de passe ni jeton. Pas
d'audit sur un 409 (MRO Phase 1). `compteur_matricule` n'est pas exposé par l'API → pas d'audit.

## 15. Seed

`personnes/management/commands/seed_personnes.py` — idempotent (`get_or_create` sur
`type_piece.code`) : `ACTE_NAISSANCE`, `RELEVE_BAC`, `PHOTOS`, `LETTRE_MOTIVATION`,
`CERTIF_SCOLARITE` (libellés FR). Aucun étudiant créé (PII réelle). Double exécution → 0
création en double, sortie 0.

## 16. Tests d'acceptation

**Backend**
- `tests/test_models.py` — portage `db/tests/test_003` applicable : `unq_etudiant_matricule`
  rejette un doublon ; `unq_affiliation (etudiant, type)` ; `etudiant`→`affiliation` CASCADE ;
  `situation_bac` 1 max par étudiant ; `idx_etudiant_nom` présent ; `db_table` corrects.
- `tests/test_services.py` — `initiales()` : cas nominal (`GUDE`), accents (`Éric Kön` → `ERKO`),
  trait d'union (`Jean-Pierre` → `JE`), mot 1 lettre (`O.` → `OX`), token vide → `XX`.
  Compteur : incrémente par pôle, isolé entre pôles, jamais réinitialisé. `generer_matricule`
  format complet ; unicité sur 2 appels consécutifs même pôle.
- `tests/test_serializers.py` — `pole` requis à la création / ignoré en `update` ; `matricule`
  read-only (payload d'entrée ignoré) ; `affiliations` + `situation_bac` en lecture imbriquée
  seule ; `EtudiantListSerializer` n'imbrique pas.
- `tests/test_api.py` — CRUD par rôle (`LECTURE` lecture OK / écriture 403 ; `SCOLARITE` &
  `DIRECTION` écriture OK ; `COMPTABLE`/`DAF` écriture 403) ; recherche `?search=` sur
  matricule/nom/prenoms ; filtre `?a_le_bac=true` ; audit : 1 ligne `CREATION` après POST, 1
  `MODIFICATION` après PATCH (avant/après non nuls), 1 `SUPPRESSION` après DELETE ; suppression
  protégée : chemin `SuppressionProtegeeMixin` renvoie 409 sans audit (base factice ou, si un
  modèle Phase 2 acquiert une FK entrante, réel).
- `tests/test_permissions_unit.py` — matrice `PeutEcrirePersonnes`.
- `tests/test_seed.py` — double run idempotent.
- `core/tests/test_viewsets.py` — `_BaseCrudViewSet` : filtres montés, `ordering` par défaut,
  MRO `SuppressionProtegeeMixin` → `AuditLogMixin` → `ModelViewSet` inchangée (ou couverture
  transitive par la suite `referentiel` existante — tranché dans le plan).

**Frontend**
- `personnes/config` : tests descripteurs `etudiant` / `typePiece` via le pattern scaffold
  (rendu liste + compteur, visibilité « Créer » selon rôle).
- `personnes/FicheEtudiant.test.tsx` — 3 sections rendues depuis une API mockée (avec/sans BAC,
  0/n affiliations).
- `personnes/integration.test.tsx` — les 3 routes câblées ; `/personnes/etudiants` rend la liste
  depuis l'API mockée.
- Régression : `LoginPage`, `referentiel`, socle — inchangés verts.

**Portes** (une passe) : `ruff check .` · `manage.py check` · `makemigrations --check` ·
`pytest` (inclut `personnes`) · `spectacular` 0 Error · `npm run typecheck` · `npm test` ·
`npm run build` · `seed_personnes` ×2 sur base de dev.

## 17. Hors périmètre (rappel)

`piece_dossier` · `inscription` et tout l'aval (Phase 3) · dossier étudiant en écriture imbriquée
(passe ultérieure) · édition des affiliations/BAC depuis la fiche · upload de fichier (`photo`
reste `CharField`) · import Excel (`db/CORRESPONDANCE.md`, Phase 10) · mixin ORM `Auditable`
(`cree_par`/`modifie_par`, Phase 3) · contraintes de forme email/téléphone/`annee_obtention` ·
génération PDF · dérivation des schémas Zod depuis OpenAPI.

## 18. Décisions (récapitulatif)

| # | Décision |
|---|---|
| D-P2-1..6 | Écarts au SQL de référence — voir §6. |
| D-P2-7 | Matricule `<POLE>-FCV<INITIALES><N>` ; `<INITIALES>` = 2+2 lettres nom/prénom ASCII majuscules, `X`-complété ; `<N>` compteur par pôle jamais réinitialisé, sans padding. |
| D-P2-8 | `pole` transmis à la création (write-only), non stocké ; pôle relu via préfixe du matricule. |
| D-P2-9 | `_BaseReferentielViewSet` remonté en `core/viewsets.py._BaseCrudViewSet`, partagé `referentiel` + `personnes`. |
| D-P2-10 | Sérialisation étudiant : `affiliations` + `situation_bac` en lecture imbriquée seule ; écriture par endpoints dédiés ; pas d'endpoint `fiche` (le détail imbriqué suffit). |

# Phase 3 — Inscriptions (Module 2) + Scolarité & facturation (Module 3)

_Date : 2026-09-07 · Statut : validé (brainstorming) · Base : `main` @ Phase 2 mergée
(`23be400`) · Branches : `phase-3a-inscription-echeancier` puis `phase-3b-frais-bourses`._

Suit le prompt maître §15/§16 (Phase 3 « Inscriptions » + Phase 4 « Scolarité/facturation »
fusionnées sur décision utilisateur). Reprend la forme de
`2026-09-07-phase-2-personnes-etudiants-design.md`. Portage de `db/migrations/003` (inscription,
piece_dossier — reste de la Phase 2) et `db/migrations/004` (tout le Module 3).

---

## 1. Objectif

Livrer l'inscription annuelle de l'étudiant dans une classe, avec attribution serveur du
`numero_ordre`, et **toute la couche facturation** : grille tarifaire (`modalite_paiement`),
échéancier généré à l'inscription (`echeance`), catalogue de frais annexes (`type_frais`), frais
par inscription (`frais_inscription`, matérialisation automatique des frais obligatoires),
bourses (`bourse`). Introduire le mixin ORM `Auditable` (`cree_par`/`cree_le`/`modifie_par`/
`modifie_le`). API REST, types TS, seed, écrans SPA (listes + formulaires + fiche inscription
avec échéancier / frais / pièces / bourses).

## 2. Périmètre

**Inclus**
- `core` : mixin abstrait `Auditable` (modèle) + `AuditableSerializerMixin` (serializer).
- App `personnes` étendue : `Inscription`, `CompteurInscription`, `PieceDossier` + migration.
- **Nouvelle app `scolarite`** : `ModalitePaiement`, `TypeFrais`, `FraisInscription`, `Echeance`,
  `Bourse` + migration.
- Services : `personnes.services.attribuer_numero_ordre` ; `scolarite.services.generer_echeancier`,
  `scolarite.services.materialiser_frais_obligatoires`.
- Transaction de création d'inscription (inscription + échéancier + frais obligatoires atomiques).
- API : `/api/v1/personnes/` + `inscriptions`, `pieces-dossier` ; **nouveau** `/api/v1/scolarite/`
  + `modalites-paiement`, `types-frais`, `frais-inscription`, `echeances`, `bourses`.
- Permissions serveur : `PeutEcrireInscriptions`, `PeutEcrireTarifs`, `PeutEcrireFraisEleve`.
- Commande `seed_scolarite` (catalogue `type_frais`).
- Frontend : descripteurs des 7 ressources CRUD + écran bespoke `FicheInscription` ; routes
  `/personnes/inscriptions/*` + nouveau groupe `/scolarite/*` ; module sidebar `scolarite` activé.
- Tests : portage `db/tests/test_003` (inscription/piece_dossier) + `test_004` applicable + tests
  services/serializers/API/permissions/seed + tests frontend.

**Découpage d'implémentation** — deux plans, chacun vert et mergeable seul :
- **3A — Inscription & échéancier** : `Auditable`, `Inscription`/`CompteurInscription`/
  `PieceDossier`, `ModalitePaiement`/`Echeance`, `attribuer_numero_ordre`/`generer_echeancier`,
  transaction de création, API + RBAC associés, frontend (liste/formulaire inscription,
  `FicheInscription`, écran modalité de paiement), vérif + merge.
- **3B — Frais annexes & bourses** : `TypeFrais`/`FraisInscription`/`Bourse`,
  `materialiser_frais_obligatoires` + branchement dans la transaction, API + RBAC, `seed_scolarite`,
  frontend (3 écrans + sections de la fiche), vérif + merge. Dépend de 3A mergé.

**Exclus** — voir §17.

## 3. Acteurs

| Rôle | inscription / piece_dossier | modalite_paiement / type_frais | frais_inscription / echeance / bourse |
|---|---|---|---|
| `SCOLARITE` | Lecture + écriture | Lecture | Lecture |
| `DIRECTION` | Lecture + écriture | Lecture + écriture | Lecture + écriture |
| `DAF` | Lecture | Lecture | Lecture + écriture |
| `COMPTABLE` | Lecture | Lecture | Lecture + écriture |
| `LECTURE` | Lecture | Lecture | Lecture |
| Superuser | Tout (bypass) | Tout | Tout |

## 4. Cas d'utilisation

1. **Inscrire un étudiant** : la scolarité choisit `etudiant` + `classe` + `date_inscription`
   (+ `est_boursier`, `cout_scolarite_negocie`, `etablissement_provenance` facultatifs). Le
   serveur déduit `ecole`/`annee_scolaire` de la classe, attribue `numero_ordre`, propose
   `type`/`statut`, génère l'échéancier depuis la grille et matérialise les frais obligatoires.
2. **Consulter la fiche d'une inscription** : identité + classe + numéro + état, échéancier,
   frais, pièces du dossier, bourses.
3. **Suivre le dossier de pièces** : cocher `fournie` / renseigner `date_reception` par
   `type_piece`.
4. **Corriger l'état** d'une inscription (`ACTIVE` → `ABANDON`/`EXCLU`/`DIPLOME`).
5. **Saisir la grille tarifaire** d'un (niveau, année) — direction.
6. **Maintenir le catalogue `type_frais`** (montant par défaut, obligatoire, scope) — direction.
7. **Ajuster un `frais_inscription`** (montant dû, exonération) ou enregistrer une **bourse** —
   comptabilité / DAF / direction.

## 5. Règles métier

| # | Règle | Portée |
|---|---|---|
| RI-1 | `inscription.ecole` et `inscription.annee_scolaire` sont **dénormalisés depuis la classe** (`classe.niveau.ecole`, `classe.annee_scolaire`) ; jamais fournis par le client ; read-only API. | serializer |
| RI-2 | `numero_ordre` : entier **séquentiel par (ecole, annee_scolaire)**, réinitialisé de fait chaque année (nouvelle ligne `compteur_inscription`). Attribué sous `transaction.atomic` + `select_for_update`. Unicité BDD `(ecole, annee_scolaire, numero_ordre)`. | service + modèle |
| RI-3 | Unicité `(etudiant, annee_scolaire)` — une inscription par étudiant et par année. | modèle |
| RI-4 | `type`/`statut` : si absents du payload, le serveur calcule d'après l'existence d'une inscription antérieure de l'étudiant (n'importe quelle année) : `REINSCRIPTION`/`ANCIEN` si oui, sinon `INSCRIPTION`/`NOUVEAU`. Une valeur fournie par le client **prime**. | serializer |
| RI-5 | `classe` est **immuable après création** (changer de classe = nouvelle inscription). `numero_ordre`, `ecole`, `annee_scolaire` read-only. `etat`, `est_boursier`, `cout_scolarite_negocie`, `date_inscription`, `type`, `statut`, `etablissement_provenance` restent éditables. | serializer |
| RI-6 | La création d'une inscription est **atomique** : inscription + `numero_ordre` + N+1 échéances + frais obligatoires. Toute erreur (grille absente, `T < I`) annule l'ensemble — pas d'inscription partielle. | service |
| RE-1 | Échéancier généré depuis `ModalitePaiement(niveau=classe.niveau, annee_scolaire)`. **Grille absente → `ValidationError` 400.** | service |
| RE-2 | Échéance `numero=0` : `montant_prevu = grille.montant_inscription_reinscription` (I), `pris_en_charge_bourse=False`. | service |
| RE-3 | Sans `cout_scolarite_negocie` : échéances `1..N` (`N = grille.nombre_echeance`) à `grille.montant_echeance`. | service |
| RE-4 | Avec `cout_scolarite_negocie = T` : `T ≥ I` obligatoire (sinon 400) ; `reste = T - I` ; `base = reste // N` ; échéances `1..N-1 = base`, échéance `N = reste - base*(N-1)` (absorbe l'arrondi). Somme des N+1 échéances = `T` exactement. | service |
| RE-5 | Échéances `1..N` : `date_prevue = date_inscription + k mois` (k = numéro d'échéance) ; `pris_en_charge_bourse = inscription.est_boursier`. Échéance 0 : `date_prevue = date_inscription`. | service |
| RE-6 | L'échéancier **n'est pas régénéré automatiquement** si `cout_scolarite_negocie` ou `est_boursier` changent après création (endpoint explicite hors périmètre Phase 3). | — |
| RF-1 | Frais obligatoires matérialisés à la création : pour chaque `TypeFrais` `obligatoire=True, actif=True` dont le scope matche — `(ecole IS NULL OR = inscription.ecole)` ET `(niveau IS NULL OR = classe.niveau)` ET `(annee_scolaire IS NULL OR = inscription.annee_scolaire)` — créer `FraisInscription(montant_du = type_frais.montant_defaut)` via `get_or_create` (idempotent). | service |
| RF-2 | `frais_inscription` unicité `(inscription, type_frais)`. `montant_du` ajustable, `exonere` bool. | modèle |
| RM-1 | `modalite_paiement.montant_total` = `GeneratedField` `db_persist=True` = `montant_inscription_reinscription + nombre_echeance * montant_echeance`. Non saisi, read-only API. | modèle |
| RM-2 | `modalite_paiement` unicité `(niveau, annee_scolaire)`. `type_frais.code` unique. `echeance` unicité `(inscription, numero)`. | modèle |
| RB-1 | `bourse.perimetre` : `TextChoices` à une valeur `SCOLARITE_HORS_INSCRIPTION` (extensible). | modèle |
| RA-1 | `Auditable` : `cree_par` posé à la création, `modifie_par` à chaque MAJ, depuis `request.user`. `cree_le`/`modifie_le` automatiques. `cree_par`/`modifie_par` **read-only API** (jamais fournis par le client). FK `on_delete=SET_NULL`. | mixin |
| RD-1 | Suppression d'une inscription référencée par ≥ 1 `echeance`/`frais_inscription`/`bourse` (FK `RESTRICT`) → **HTTP 409** (`ConflitSuppressionException`), **sans écriture d'audit**. `piece_dossier` est supprimé en cascade (FK `CASCADE`). En pratique une inscription a toujours l'échéance 0 → non supprimable ; on passe `etat=ABANDON`. | ViewSet |

Argent : tous les montants sont des entiers FCFA — `DecimalField(max_digits=12, decimal_places=0)`,
jamais de flottant. Le calcul de répartition (RE-4) est en arithmétique entière.

## 6. Modèle de données (portage)

`db_table` explicite, `BigAutoField` PK, `ENUM`→`TextChoices` (valeurs SQL exactes),
`# noqa: DJ001` sur les `CharField` nullables miroir du SQL.

### `core.Auditable` (abstrait, `core/models.py`)
| Champ | Type ORM |
|---|---|
| cree_par | `ForeignKey(settings.AUTH_USER_MODEL, on_delete=SET_NULL, null=True, blank=True, related_name="+", editable=False)` |
| cree_le | `DateTimeField(auto_now_add=True)` |
| modifie_par | `ForeignKey(settings.AUTH_USER_MODEL, on_delete=SET_NULL, null=True, blank=True, related_name="+", editable=False)` |
| modifie_le | `DateTimeField(auto_now=True)` |
`class Meta: abstract = True`.

### `personnes.Inscription` (`db_table="inscription"`, hérite `Auditable`)
| Champ | Type ORM | SQL réf. |
|---|---|---|
| etudiant | `FK(Etudiant, on_delete=RESTRICT, related_name="inscriptions")` | FK etudiant |
| classe | `FK(referentiel.Classe, on_delete=RESTRICT, related_name="inscriptions")` | FK classe |
| ecole | `FK(referentiel.Ecole, on_delete=RESTRICT, related_name="+")` | dénormalisé, serveur |
| annee_scolaire | `FK(referentiel.AnneeScolaire, on_delete=RESTRICT, related_name="+")` | dénormalisé, serveur |
| numero_ordre | `PositiveIntegerField()` | serveur (RI-2) |
| type | `CharField(max_length=13, choices=Type)` | `ENUM('INSCRIPTION','REINSCRIPTION')` |
| statut | `CharField(max_length=7, choices=Statut)` | `ENUM('NOUVEAU','ANCIEN')` |
| etablissement_provenance | `CharField(max_length=150, null=True, blank=True)` | NULL |
| est_boursier | `BooleanField(default=False)` | def 0 |
| cout_scolarite_negocie | `DecimalField(max_digits=12, decimal_places=0, null=True, blank=True)` | NULL |
| date_inscription | `DateField()` | NOT NULL |
| etat | `CharField(max_length=8, choices=Etat, default=Etat.ACTIVE)` | `ENUM('ACTIVE','ABANDON','EXCLU','DIPLOME')` |

`Meta` : `db_table="inscription"` ; `constraints = [UniqueConstraint(["etudiant","annee_scolaire"],
name="unq_inscription_etudiant_annee"), UniqueConstraint(["ecole","annee_scolaire","numero_ordre"],
name="unq_inscription_numero_ordre")]` ; `indexes = [Index(fields=["classe"], name="idx_inscription_classe")]`.
`__str__` → `f"{self.numero_ordre} — {self.etudiant} ({self.annee_scolaire})"`.

### `personnes.CompteurInscription` (`db_table="compteur_inscription"`) — hors SQL de référence
| Champ | Type ORM |
|---|---|
| ecole | `FK(referentiel.Ecole, on_delete=CASCADE, related_name="+")` |
| annee_scolaire | `FK(referentiel.AnneeScolaire, on_delete=CASCADE, related_name="+")` |
| valeur | `PositiveIntegerField(default=0)` |
`Meta` : `constraints = [UniqueConstraint(["ecole","annee_scolaire"], name="unq_compteur_inscription")]`.

### `personnes.PieceDossier` (`db_table="piece_dossier"`)
| Champ | Type ORM |
|---|---|
| inscription | `FK(Inscription, on_delete=CASCADE, related_name="pieces_dossier")` |
| type_piece | `FK(TypePiece, on_delete=RESTRICT, related_name="+")` |
| fournie | `BooleanField(default=False)` |
| date_reception | `DateField(null=True, blank=True)` |
`Meta` : `constraints = [UniqueConstraint(["inscription","type_piece"], name="unq_piece_dossier")]`.

### `scolarite.ModalitePaiement` (`db_table="modalite_paiement"`)
| Champ | Type ORM |
|---|---|
| niveau | `FK(referentiel.Niveau, on_delete=RESTRICT, related_name="+")` |
| annee_scolaire | `FK(referentiel.AnneeScolaire, on_delete=RESTRICT, related_name="+")` |
| montant_inscription_reinscription | `DecimalField(max_digits=12, decimal_places=0)` |
| nombre_echeance | `PositiveIntegerField()` |
| montant_echeance | `DecimalField(max_digits=12, decimal_places=0)` |
| montant_total | `GeneratedField(expression=F("montant_inscription_reinscription") + F("nombre_echeance") * F("montant_echeance"), output_field=DecimalField(max_digits=12, decimal_places=0), db_persist=True)` |
`Meta` : `constraints = [UniqueConstraint(["niveau","annee_scolaire"], name="unq_modalite_paiement")]`.

### `scolarite.TypeFrais` (`db_table="type_frais"`)
| Champ | Type ORM |
|---|---|
| code | `CharField(max_length=30, unique=True)` |
| libelle | `CharField(max_length=120)` |
| ecole | `FK(referentiel.Ecole, on_delete=RESTRICT, null=True, blank=True, related_name="+")` |
| niveau | `FK(referentiel.Niveau, on_delete=RESTRICT, null=True, blank=True, related_name="+")` |
| annee_scolaire | `FK(referentiel.AnneeScolaire, on_delete=RESTRICT, null=True, blank=True, related_name="+")` |
| montant_defaut | `DecimalField(max_digits=12, decimal_places=0)` |
| obligatoire | `BooleanField(default=False)` |
| actif | `BooleanField(default=True)` |
`Meta` : `indexes = [Index(fields=["ecole"], ...), Index(fields=["niveau"], ...)]`.

### `scolarite.FraisInscription` (`db_table="frais_inscription"`, hérite `Auditable`)
| Champ | Type ORM |
|---|---|
| inscription | `FK(personnes.Inscription, on_delete=RESTRICT, related_name="frais_inscription")` |
| type_frais | `FK(TypeFrais, on_delete=RESTRICT, related_name="+")` |
| montant_du | `DecimalField(max_digits=12, decimal_places=0)` |
| exonere | `BooleanField(default=False)` |
| commentaire | `CharField(max_length=255, null=True, blank=True)` |
`Meta` : `constraints = [UniqueConstraint(["inscription","type_frais"], name="unq_frais_inscription")]`.

### `scolarite.Echeance` (`db_table="echeance"`, hérite `Auditable`)
| Champ | Type ORM |
|---|---|
| inscription | `FK(personnes.Inscription, on_delete=RESTRICT, related_name="echeances")` |
| numero | `PositiveIntegerField()` |
| montant_prevu | `DecimalField(max_digits=12, decimal_places=0)` |
| date_prevue | `DateField()` |
| pris_en_charge_bourse | `BooleanField(default=False)` |
`Meta` : `constraints = [UniqueConstraint(["inscription","numero"], name="unq_echeance")]`.

### `scolarite.Bourse` (`db_table="bourse"`, hérite `Auditable`)
| Champ | Type ORM |
|---|---|
| inscription | `FK(personnes.Inscription, on_delete=RESTRICT, related_name="bourses")` |
| organisme | `CharField(max_length=150)` |
| perimetre | `CharField(max_length=25, choices=Perimetre, default=Perimetre.SCOLARITE_HORS_INSCRIPTION)` |
| montant_couvert | `DecimalField(max_digits=12, decimal_places=0)` |
`Meta` : `indexes = [Index(fields=["inscription"], name="idx_bourse_inscription")]`.

### Écarts au SQL de référence (`Decision`, style D-ORM-*)
- **D-P3-1** — `BigAutoField`/`BIGINT` PK partout (vs `INT UNSIGNED`).
- **D-P3-2** — `ENUM` → `TextChoices` (valeurs SQL exactes).
- **D-P3-3** — Colonnes d'audit portées via `core.Auditable` (mixin abstrait, D-ORM-8) ; FK
  `cree_par`/`modifie_par` en `related_name="+"` (le SQL n'a pas de reverse), `editable=False`.
  Les tables SQL avec audit inline : `inscription`, `frais_inscription`, `echeance`, `bourse`.
- **D-P3-4** — `montant_total` de `modalite_paiement` : `GeneratedField(db_persist=True)`
  (D-ORM-5) — colonne générée stockée, comme le SQL (`GENERATED ALWAYS AS ... STORED`).
- **D-P3-5** — Table `compteur_inscription` sans équivalent SQL : séquence applicative pour
  `numero_ordre` (RI-2). Même motif que `compteur_matricule` (Phase 2).
- **D-P3-6** — `piece_dossier.type_piece` : FK `RESTRICT` (le SQL ne précise pas d'`ON DELETE`
  côté `type_piece` → défaut MySQL = RESTRICT).
- **D-P3-7** — Cascade `inscription → piece_dossier` implémentée au niveau ORM (Django), pas de
  clause `ON DELETE CASCADE` générée — convention du projet (cf. Phase 2).

Procédure D-ORM-9 : `python manage.py sqlmigrate personnes 0002` et `sqlmigrate scolarite 0001`,
comparer à `db/migrations/003` (inscription/piece_dossier) et `004`, consigner les écarts.

## 7. Unicités & index (repris du SQL)

`unq_inscription_etudiant_annee` · `unq_inscription_numero_ordre` · `idx_inscription_classe` ·
`unq_compteur_inscription` · `unq_piece_dossier` · `unq_modalite_paiement` · `unq_type_frais_code` ·
`idx_type_frais_ecole` · `idx_type_frais_niveau` · `unq_frais_inscription` · `unq_echeance` ·
`idx_bourse_inscription`.

## 8. Workflows

### 8.1 Création d'une inscription (`POST /api/v1/personnes/inscriptions/`)
1. Payload : `etudiant`, `classe`, `date_inscription` (+ `est_boursier`, `cout_scolarite_negocie`,
   `etablissement_provenance`, `type`, `statut` facultatifs).
2. `InscriptionSerializer.create()` dans **un** `transaction.atomic()` :
   a. `ecole = classe.niveau.ecole` ; `annee_scolaire = classe.annee_scolaire`.
   b. `type`/`statut` : défaut serveur (RI-4) si absents.
   c. `numero_ordre = personnes.services.attribuer_numero_ordre(ecole, annee_scolaire)`.
   d. `Inscription` sauvegardée (`cree_par = request.user`).
   e. `scolarite.services.generer_echeancier(inscription)` (RE-1..RE-5) — `bulk_create` des N+1
      `Echeance` (`cree_par` propagé).
   f. `scolarite.services.materialiser_frais_obligatoires(inscription)` (RF-1) — `get_or_create`
      des `FraisInscription` (`cree_par` propagé).
   g. `AuditLogMixin.perform_create` → `journal_audit` `CREATION` `table_cible="inscription"`.
3. 201 : inscription + `echeances` (triées `numero`, lecture seule) + `frais_inscription` +
   `pieces_dossier` + `bourses`.

### 8.2 Modification (`PATCH /api/v1/personnes/inscriptions/{id}/`)
`classe`/`numero_ordre`/`ecole`/`annee_scolaire`/`cree_par`/`modifie_par` refusés en écriture.
`etat` et les autres champs éditables → MAJ + `modifie_par = request.user` + audit `MODIFICATION`.
Pas de régénération d'échéancier (RE-6).

### 8.3 Suppression
`DELETE` inscription → 409 (`RESTRICT` via échéances/frais), pas d'audit (RD-1). `piece_dossier`
suivi via son endpoint. `modalite_paiement`/`type_frais` non supprimables si référencés → 409.

### 8.4 Grille & frais
`modalite_paiement` : CRUD direction, `montant_total` calculé. `type_frais` : CRUD direction.
`frais_inscription`/`echeance`/`bourse` : CRUD COMPTABLE/DAF/direction (ajustements, exonérations,
bourses). Toute écriture pose `cree_par`/`modifie_par`.

## 9. Permissions (RBAC serveur)

Trois classes, forme identique à `PeutEcrireReferentiel` (méthodes sûres → tout authentifié ;
écriture → jeu de rôles ; superuser bypass) :

| Classe | Écriture | Ressources |
|---|---|---|
| `personnes.permissions.PeutEcrireInscriptions` | `DIRECTION`, `SCOLARITE` | `inscriptions`, `pieces-dossier` |
| `scolarite.permissions.PeutEcrireTarifs` | `DIRECTION` | `modalites-paiement`, `types-frais` |
| `scolarite.permissions.PeutEcrireFraisEleve` | `DIRECTION`, `DAF`, `COMPTABLE` | `frais-inscription`, `echeances`, `bourses` |

## 10. API

`/api/v1/personnes/` (routeur existant, + 2) et **nouveau** `/api/v1/scolarite/` (routeur monté
dans `config/urls.py`, namespace `v1:`). Base `_BaseCrudViewSet` ; `scolarite` :
`_BaseScolariteViewSet(_BaseCrudViewSet)` sans permission par défaut (3 classes distinctes).

| Route | `search_fields` | `filterset` | `ordering_fields` | perm |
|---|---|---|---|---|
| `personnes/inscriptions` | `numero_ordre`, `etudiant__matricule`, `etudiant__nom` | `etudiant`, `classe`, `ecole`, `annee_scolaire`, `type`, `statut`, `etat`, `est_boursier` | `numero_ordre`, `date_inscription`, `id` | Inscriptions |
| `personnes/pieces-dossier` | — | `inscription`, `type_piece`, `fournie` | `id` | Inscriptions |
| `scolarite/modalites-paiement` | — | `niveau`, `annee_scolaire` | `id` | Tarifs |
| `scolarite/types-frais` | `code`, `libelle` | `ecole`, `niveau`, `annee_scolaire`, `obligatoire`, `actif` | `code`, `id` | Tarifs |
| `scolarite/frais-inscription` | — | `inscription`, `type_frais`, `exonere` | `id` | FraisEleve |
| `scolarite/echeances` | — | `inscription`, `numero`, `pris_en_charge_bourse` | `numero`, `date_prevue`, `id` | FraisEleve |
| `scolarite/bourses` | `organisme` | `inscription` | `id` | FraisEleve |

`InscriptionViewSet.get_queryset` : `select_related("etudiant", "classe__niveau__ecole",
"annee_scolaire", "cree_par", "modifie_par")` + `prefetch_related("echeances",
"frais_inscription", "pieces_dossier", "bourses")`.
`get_serializer_class` : `InscriptionListSerializer` si `action == "list"`, sinon
`InscriptionSerializer`.

### Serializers
- `InscriptionListSerializer` — champs plats + `etudiant_libelle` (`source="etudiant.__str__"`),
  `classe_libelle`, `ecole_libelle`.
- `InscriptionSerializer` — `AuditableSerializerMixin` ; `ecole`/`annee_scolaire`/`numero_ordre`/
  `cree_par`/`modifie_par`/`cree_le`/`modifie_le` **read-only** ; `classe` read-only si
  `self.instance` (création uniquement) ; `type`/`statut` `required=False` ; imbriqués **lecture
  seule** : `echeances`, `frais_inscription`, `pieces_dossier`, `bourses`. `create()` = transaction §8.1.
- `PieceDossierSerializer` — `ModelSerializer` plat.
- `ModalitePaiementSerializer` — `montant_total` `read_only`. `TypeFraisSerializer` — plat.
- `FraisInscriptionSerializer`, `EcheanceSerializer`, `BourseSerializer` — `AuditableSerializerMixin`,
  champs audit read-only.

### `core.serializers.AuditableSerializerMixin`
`create` : `validated_data["cree_par"] = self.context["request"].user` (si authentifié) puis
`super().create`. `update` : `validated_data["modifie_par"] = self.context["request"].user` puis
`super().update`. Les champs `cree_par`/`modifie_par`/`cree_le`/`modifie_le` sont déclarés
`read_only` (jamais acceptés en entrée). Robuste à l'absence de `request` (tests unitaires) :
garde `getattr(self.context.get("request"), "user", None)`.

OpenAPI : `@extend_schema(tags=[...])` par app ; `spectacular` **0 Error / 0 Warning** ;
`npm run gen:api` régénère `frontend/src/api/schema.d.ts`.

## 11. Interface (frontend)

**`frontend/src/personnes/`**
- `config/inscription.tsx` — `Descripteur` : colonnes `numero_ordre`, `etudiant_libelle`,
  `classe_libelle`, `type`, `etat`, `est_boursier` ; filtres `annee_scolaire`/`ecole`/`classe`
  (fk), `type`, `etat` ; champs `etudiant` (fk), `classe` (fk, `creationSeule`),
  `date_inscription` (text `AAAA-MM-JJ`), `est_boursier` (checkbox), `cout_scolarite_negocie`
  (number), `etablissement_provenance` (text), `type`/`statut` (select, non requis, `aide`
  « laisser vide = déduit du dossier »). `roleEcriture: ["DIRECTION","SCOLARITE"]`. Zod miroir.
- `config/pieceDossier.tsx` — `Descripteur` : `inscription` (fk), `type_piece` (fk), `fournie`
  (checkbox), `date_reception` (text). `roleEcriture: ["DIRECTION","SCOLARITE"]`.
- `FicheInscription.tsx` — écran bespoke `/personnes/inscriptions/:id` : en-tête (étudiant /
  classe / n° / état / boursier) + 4 sections **Échéancier** (numéro / montant prévu / date /
  pris en charge bourse), **Frais** (type / montant dû / exonéré), **Pièces du dossier** (type /
  fournie / date réception), **Bourses** (organisme / montant couvert). Lecture seule ;
  `DataState` chargement/erreur.
- `routes.tsx` — `routesPersonnes` gagne `inscriptions` (+ `:id` → `FicheInscription`) et
  `pieces-dossier`. Miettes « Personnes / Inscriptions / … ».

**`frontend/src/scolarite/` (nouveau)**
- `config/{modalitePaiement,typeFrais,fraisInscription,echeance,bourse}.tsx` — `Descripteur`
  scaffold. `modalitePaiement` : colonne `montant_total` (lecture seule) ; `roleEcriture:
  ["DIRECTION"]`. `typeFrais` : `roleEcriture: ["DIRECTION"]`. `fraisInscription`/`echeance`/
  `bourse` : `roleEcriture: ["DIRECTION","DAF","COMPTABLE"]`.
- `routes.tsx` — `routesScolarite` : `/scolarite/modalites-paiement`, `/scolarite/types-frais`,
  `/scolarite/frais-inscription`, `/scolarite/echeances`, `/scolarite/bourses`. Miettes
  « Scolarité / … ». Câblé dans `src/routes.tsx`.
- `src/app/Sidebar.tsx` — module `scolarite` : `disponible: true`,
  `chemin: "/scolarite/modalites-paiement"`.

`npm run gen:api` puis adaptation des types. Le champ `roleEcriture` du `Descripteur` accepte
déjà un tableau de codes ; `peutEcrire` (front) teste l'intersection — aucune modification du
scaffold requise (contrairement à `creationSeule` en Phase 2).

## 12. Validations

**Serveur** : `classe` obligatoire à la création ; `ecole`/`annee_scolaire`/`numero_ordre`/champs
d'audit jamais acceptés en entrée ; `cout_scolarite_negocie` ≥ `montant_inscription_reinscription`
de la grille (sinon 400 FR) ; grille absente → 400 FR ; unicités → 400 DRF standard ; `type`/
`statut`/`etat`/`perimetre` bornés par `choices`. `nombre_echeance` > 0 sur `modalite_paiement`
(validator `MinValueValidator(1)`).

**Frontend (Zod)** : requis (`etudiant`, `classe`, `date_inscription`) ; `date_*` regex
`^\d{4}-\d{2}-\d{2}$` ; montants `z.number().int().nonnegative()` optionnels tolérant `NaN`
(cf. Phase 2) ; enums. Validation d'ergonomie seulement — l'autorité reste serveur.

## 13. Erreurs

Format DRF standard + `core/exceptions.py`. 400 (payload invalide, grille absente,
`cout_scolarite_negocie` < I, doublon d'unicité), 403 (`PermissionRefuseeException`), 404, 409
(`ConflitSuppressionException` — suppression d'un objet référencé). `errors.ts` du front couvre
déjà 400/403/404/409/5xx.

## 14. Audit

`AuditLogMixin` (hérité de `_BaseCrudViewSet`) journalise `CREATION`/`MODIFICATION`/`SUPPRESSION`
sur les 7 ressources. Sur la création d'inscription : **une** ligne `CREATION`
`table_cible="inscription"` (les échéances/frais enfants ne sont pas journalisés sur ce chemin ;
ils le sont s'ils sont édités ensuite via leur endpoint). Pas d'audit sur un 409 (MRO Phase 1).
`compteur_inscription` non exposé → pas d'audit. Les FK `cree_par`/`modifie_par` figurent dans les
snapshots `valeurs_avant`/`valeurs_apres` (ids d'utilisateur, pas des secrets) — acceptable.

## 15. Seed

`scolarite/management/commands/seed_scolarite.py` — idempotent (`get_or_create` sur
`type_frais.code`) : catalogue du design §6 —
`TENUE`, `PHOTOCOPIE`, `MUTUELLE`, `JOURNEE_INTEGRATION`, `SOUTENANCE`, `EXAMEN`, `MATIERE_OEUVRE`
(libellés FR, `montant_defaut`, `obligatoire`, `actif`, scope wildcard `NULL`). **Aucun**
`modalite_paiement` seedé (tarifs réels saisis par la direction). Double exécution → 0 création en
double.

## 16. Tests d'acceptation

**Backend**
- `core/tests/test_auditable.py` — `Auditable` abstrait, 4 champs ; `AuditableSerializerMixin`
  pose `cree_par` à la création / `modifie_par` en MAJ depuis `context["request"].user`, ignore
  toute valeur cliente, tolère l'absence de `request`.
- `personnes/tests/test_models.py` (+) — portage `db/tests/test_003` :
  `unq_inscription_etudiant_annee`, `unq_inscription_numero_ordre`, `idx_inscription_classe`,
  `piece_dossier` cascade à la suppression de l'inscription, `unq_piece_dossier`.
- `personnes/tests/test_services.py` (+) — `attribuer_numero_ordre` : incrémente par
  (école, année), isolé entre écoles, séquence distincte pour une autre année ;
  2 appels consécutifs même (école, année) → valeurs distinctes.
- `personnes/tests/test_api.py` (+) — création : dérive `ecole`/`annee_scolaire` de la classe,
  attribue `numero_ordre` (1 puis 2), `type`/`statut` déduits (`INSCRIPTION`/`NOUVEAU` pour un
  1er, `REINSCRIPTION`/`ANCIEN` si inscription antérieure), override client prime ;
  **grille absente → 400 et aucune inscription/échéance créée** ; `cout_scolarite_negocie < I`
  → 400 ; échéancier grille : N+1 échéances, échéance 0 = I, 1..N = M ; échéancier négocié
  `T=600000` sur grille `I=105000,N=9,M=70000` → 0:105000, 1..9:55000, somme = T ; échéancier
  négocié avec reste non divisible → dernière échéance absorbe l'arrondi, somme = T ;
  `pris_en_charge_bourse` = `est_boursier` sur 1..N ; PATCH refuse `classe`/`numero_ordre` ;
  **DELETE inscription avec échéances → 409 sans ligne d'audit `SUPPRESSION`** ; DELETE
  inscription factice sans enfant → 204 + audit ; RBAC `inscriptions`/`pieces-dossier`
  (SCOLARITE/DIRECTION écrivent, COMPTABLE/DAF/LECTURE non).
- `personnes/tests/test_permissions_unit.py` (+) — matrice `PeutEcrireInscriptions`.
- `scolarite/tests/test_models.py` — `montant_total` généré = `I + N*M` (relecture DB) ;
  `unq_modalite_paiement`, `unq_type_frais_code`, `unq_frais_inscription`, `unq_echeance`,
  `db_table` corrects.
- `scolarite/tests/test_services.py` — `generer_echeancier` (montants/dates/bourse) ;
  `materialiser_frais_obligatoires` : ne prend que `obligatoire & actif`, respecte le scope
  (`ecole`/`niveau`/`annee` NULL = wildcard), idempotent (2ᵉ appel n'ajoute rien).
- `scolarite/tests/test_serializers.py` — champs `Auditable` read-only ; `montant_total`
  read-only.
- `scolarite/tests/test_api.py` — CRUD + RBAC : `modalites-paiement`/`types-frais` =
  DIRECTION seule écrit (SCOLARITE/DAF/COMPTABLE 403) ; `frais-inscription`/`echeances`/`bourses`
  = DIRECTION/DAF/COMPTABLE écrivent (SCOLARITE 403) ; `cree_par` posé à la création.
- `scolarite/tests/test_permissions_unit.py` — `PeutEcrireTarifs`, `PeutEcrireFraisEleve`.
- `scolarite/tests/test_seed.py` — double run idempotent (7 `type_frais`).

**Frontend**
- Tests descripteurs des 7 écrans scaffold (rendu liste + compteur + visibilité « Créer » selon
  rôle — `DIRECTION` vs `LECTURE`, et pour les frais-élève `COMPTABLE`).
- `personnes/FicheInscription.test.tsx` — 4 sections rendues depuis une API mockée (avec/sans
  bourse, 0/n échéances).
- `personnes/integration.test.tsx` (+) — routes `inscriptions` / `:id` / `pieces-dossier` câblées.
- `scolarite/integration.test.tsx` — 5 routes câblées ; `/scolarite/modalites-paiement` rend la
  liste.
- `app/Sidebar.test.tsx` — Référentiel + Personnes + Scolarité actifs ; 3 modules à venir.
- Régression : socle / `referentiel` / `personnes` inchangés verts.

**Portes** (une passe, par plan) : `ruff check .` · `manage.py check` ·
`makemigrations --check` · `pytest` · `spectacular` 0 Error · `npm run typecheck` · `npm test` ·
`npm run build` · `seed_scolarite` ×2 sur base de dev · création d'inscription bout-en-bout sur
base de dev (grille saisie manuellement, vérif échéancier + frais).

## 17. Hors périmètre (Phase 3)

- **Encaissements / imputations / trésorerie** (Module 4, Phase 5) → `montant_regle` / `reste` /
  `etat_payement` des échéances et frais **non calculés** (nécessitent les imputations et
  `v_situation_frais`).
- **Régénération de l'échéancier** après changement de `cout_scolarite_negocie` / `est_boursier`
  (endpoint explicite `POST /inscriptions/{id}/regenerer-echeancier/` — plus tard).
- **Réconciliation des bourses** (versements de l'organisme) — Module 4.
- Les 13 vues de calcul SQL (`v_situation_scolarite`, `v_echeancier`, …) — Phase 11.
- Édition des échéances/frais/pièces **depuis la fiche** (passe ultérieure ; on passe par les
  endpoints dédiés / écrans scaffold).
- Génération PDF (fiche de scolarité, reçu) — Phase 9. Import Excel — Phase 10.
- Endpoints d'action sur `etat` (`abandonner`, `exclure`, `diplomer`) — un simple PATCH suffit en
  Phase 3 (pas d'effet de bord avant les résultats/délibérations, Phase 8).
- `derniere_connexion`, code-splitting frontend, gate CI `spectacular`/`gen:api` — dette projet
  connue, hors périmètre.

## 18. Décisions (récapitulatif)

| # | Décision |
|---|---|
| D-P3-1..7 | Écarts au SQL de référence — voir §6. |
| D-P3-8 | `numero_ordre` : séquence `compteur_inscription` par (école, année), `select_for_update`, jamais réinitialisée dans l'année ; nouvelle année = nouvelle ligne. |
| D-P3-9 | `ecole`/`annee_scolaire` de l'inscription dérivés de `classe` côté serveur, read-only ; `classe` immuable après création. |
| D-P3-10 | `type`/`statut` : défaut serveur (inscription antérieure ⇒ REINSCRIPTION/ANCIEN), override client prioritaire. |
| D-P3-11 | Création d'inscription atomique : inscription + N+1 échéances + frais obligatoires ; grille absente ou `T < I` ⇒ 400 + rollback total. |
| D-P3-12 | `cout_scolarite_negocie = T` : échéance 0 = I inchangée ; `T - I` réparti en N parts entières, dernière échéance absorbe le reste ; Σ = T. |
| D-P3-13 | Frais obligatoires (`obligatoire & actif`, scope matché) matérialisés à la création (`get_or_create`, idempotent). |
| D-P3-14 | `core.Auditable` (modèle abstrait) + `core.serializers.AuditableSerializerMixin` (pose `cree_par`/`modifie_par` depuis `request.user`) — sur `inscription`, `frais_inscription`, `echeance`, `bourse`. |
| D-P3-15 | RBAC : `inscriptions`/`pieces-dossier` = SCOLARITE+DIRECTION ; `modalites-paiement`/`types-frais` = DIRECTION ; `frais-inscription`/`echeances`/`bourses` = COMPTABLE+DAF+DIRECTION. |
| D-P3-16 | `scolarite` = nouvelle app Django ; `inscription`/`piece_dossier` restent dans `personnes` (data-model Module 2). |
| D-P3-17 | Implémentation en 2 plans mergeables : 3A (inscription + échéancier) puis 3B (frais + bourses). |

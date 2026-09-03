# Phase 1 — Module `referentiel` (référentiel académique) + amorce SPA

**Date :** 2026-09-03
**Statut :** design validé, prêt pour plan d'implémentation
**Portée :** portage du Module 1 du modèle de données (11 tables) vers Django/DRF, exposition CRUD
sous `/api/v1/referentiel/`, conversion de `utilisateur_role.ecole_id` en FK réelle, commande de
seed, et pose de l'ossature SPA (AppShell + scaffold CRUD générique) que réutiliseront les modules
suivants.

Références : `2026-08-29-modele-donnees-gestion-groupe-scolaire-design.md` §6 Module 1 (autorité sur
le modèle), `2026-08-30-choix-technologies-sis-design.md` (pile), `2026-09-03-conventions-portage-orm-design.md`
(règles D-ORM-*), `db/migrations/001_referentiel_academique.sql` + `db/tests/test_001_referentiel.sql`
(référence de conception), prompt maître §11/§12/§16 Phase 1.

---

## 1. Objectif

Rendre le référentiel académique pilotable de bout en bout (DB ↔ ORM ↔ API ↔ OpenAPI ↔ types TS ↔
UI), avec RBAC serveur et audit, sans divergence avec le SQL de référence (hors type entier des
PK/FK, écart assumé D-ORM-1). Établir les patterns transverses (module Django, portage, layout,
data-fetching) pour les modules 2 à 6.

## 2. Périmètre

**Inclus**

- App Django `referentiel` : 11 modèles, migration initiale, serializers, permissions, filters,
  services, admin, urls, tests.
- `comptes` : migration `utilisateur_role.ecole_id` `PositiveIntegerField` → `ForeignKey(
  "referentiel.Ecole", null=True, on_delete=RESTRICT, db_index=True, db_column="ecole_id")`.
- Commande `python manage.py seed_referentiel` (idempotente).
- API `/api/v1/referentiel/…` : CRUD DRF (liste paginée + filtres + recherche + tri, détail,
  création, màj complète/partielle, suppression), annotée OpenAPI (0 Error), types TS régénérés.
- Frontend : `AppShell` (sidebar 6 groupes, topbar, breadcrumbs, `QueryClientProvider`, toasts,
  error boundary, états `skeleton`/`empty`/`error` réutilisables), scaffold CRUD générique
  (`ResourcePage`, `ResourceForm`), 11 descripteurs d'entité, routes `/referentiel/…`.

**Exclu** (autres phases)

- Modules 2 à 6 (personnes, scolarité, trésorerie, paie, résultats).
- Vues `v_*` et tout reporting (→ Phase Rapports).
- `modalite_paiement`, `type_frais`, `frais_inscription` (Module 3, Phase 4).
- Imports Excel (`openpyxl`), génération PDF (WeasyPrint).
- Résolution de la dette `derniere_connexion` / `last_login` (D-ORM-11).
- Gestion fine des uploads `logo` (un `CharField(255)` chemin/URL suffit en Phase 1 ; le stockage
  de fichiers est traité au module Documents).

## 3. Acteurs

| Rôle | Sur le référentiel |
|---|---|
| `DIRECTION` | lecture + création/édition/suppression de **toutes** les entités |
| `SCOLARITE` | lecture + création/édition/suppression de `classe`, `matiere`, `periode`, `session_examen` |
| `COMPTABLE`, `DAF`, `LECTURE` | lecture seule |
| superutilisateur | tout (contournement `ARole`) |
| anonyme | aucun accès (401) |

## 4. Cas d'utilisation

- Configurer le groupe scolaire et ses écoles (pôle, régime).
- Déclarer les niveaux d'une école (code, ordre, crédits requis LMD ou `NULL` en classique,
  drapeaux soutenance / examen national).
- Déclarer les filières d'une école et leurs options.
- Ouvrir une année scolaire, la marquer courante, définir ses 2 périodes et leurs sessions
  d'examen (normale / rattrapage).
- Créer les classes de l'année (croisement année × niveau × option × modalité) — le libellé est
  généré.
- Saisir la maquette pédagogique : matières par niveau × option × semestre.
- Rechercher / filtrer / paginer chaque référentiel ; consulter le détail ; supprimer un élément
  non référencé.

## 5. Règles métier

- **RM-1** `niveau.credits_requis` : `NULL` autorisé (régime classique) ; entier (60 en LMD) sinon.
  Pas de contrainte croisée avec `ecole.regime` en Phase 1 (le régime pilote surtout les
  résultats, Module 6) — laissé à une validation ultérieure.
- **RM-2** `annee_scolaire.est_courante` : **au plus une** ligne à `True`. Garanti par
  `UniqueConstraint(fields=["est_courante"], condition=Q(est_courante=True))` **et** par le service
  qui, sur passage d'une année à `est_courante=True`, repasse les autres à `False` dans la même
  transaction.
- **RM-3** `classe.libelle_auto` (`NOT NULL`) : calculé par le service à chaque création/màj de
  `classe`. La filière est obtenue via `classe.option_filiere.filiere`. Format
  `«{niveau.code} {filiere.sigle}/{option_filiere.sigle} {modalite_formation.code} {annee_scolaire.libelle}»`
  (ex. `L1 GACO/CI FI 2025-2026`). Si `option_filiere.sigle` est vide (cas CFPA), le segment
  `/{option_filiere.sigle}` est omis (`1A GEA FI 2025-2026`). Recalculé si l'une des 4 FK change.
- **RM-4** `filiere` et `option_filiere` sont **indépendantes du niveau** (design §8 : `id_niveau`
  supprimé de l'ancien modèle). `option_filiere.sigle` peut être vide.
- **RM-5** `matiere.credits` : `NULL` si le niveau n'est pas LMD ; `matiere.coefficient` et
  `volume_horaire` obligatoires.
- **RM-6** `periode.numero` ∈ {1, 2} (validation applicative ; le SQL ne pose pas de CHECK).
- **RM-7** `session_examen` : `type` ∈ {`NORMALE`, `RATTRAPAGE`}, dates nullables ; une seule
  session de chaque type par période (`UNIQUE(periode_id, type)`).
- **RM-8** Suppression : refusée (409) si l'objet est référencé par une FK entrante
  (`on_delete=RESTRICT` → `RestrictedError`).
- **RM-9** Toutes les unicités composites du SQL de référence sont reproduites (§7).

## 6. Modèle de données (portage)

11 modèles, un par table de `001_referentiel_academique.sql`. **Le SQL de référence fait foi pour
colonnes, nullabilité, longueurs, `UNIQUE`, index, FK.** Décisions de portage :

- Types entiers PK/FK : `BigAutoField` / `BIGINT` (D-ORM-1) — seul écart accepté au SQL.
- `db_table` explicite = nom de la table (`groupe_scolaire`, `ecole`, `annee_scolaire`,
  `modalite_formation`, `niveau`, `filiere`, `option_filiere`, `classe`, `matiere`, `periode`,
  `session_examen`).
- Enums en `TextChoices` (valeurs exactes) : `Ecole.Pole` (`ESSIG`,`UPSS`,`CFPA`,`CICI`),
  `Ecole.Regime` (`LMD`,`CLASSIQUE`), `ModaliteFormation.Code` (`FI`,`FC`,`FL`,`FT`),
  `Matiere.Semestre` (`S1`,`S2`), `SessionExamen.Type` (`NORMALE`,`RATTRAPAGE`). `CharField`
  `max_length` = longueur de la plus longue valeur.
- `modalite_formation` et les autres référentiels restent de **vrais modèles** (pas d'enum figé).
- Booléens : `est_courante`, `a_soutenance`, `a_examen_national` → `BooleanField(default=False)`.
- FK : `on_delete=models.RESTRICT` partout (aucune fille stricte dans ce module).
- `related_name` explicites (`ecole.niveaux`, `ecole.filieres`, `filiere.options`,
  `annee_scolaire.periodes`, `periode.sessions`, `annee_scolaire.classes`, `niveau.classes`,
  `niveau.matieres`, …).
- Champs texte optionnels du SQL (`sigle`, `logo`, `contacts`, `email`, `adresse` de
  `groupe_scolaire`/`ecole`) : `null=True, blank=True` conformes au `.sql`.
- `classe.libelle_auto` : `CharField(max_length=120)` **stocké**, rempli par le service (RM-3) ;
  `editable=False` côté serializer (lecture seule dans l'API).
- Aucune colonne générée SQL dans ce module → pas de `GeneratedField`.
- `Meta.constraints` : les `UniqueConstraint` de §7 + la contrainte partielle RM-2.

### Écarts au SQL de référence

| Écart | Motif |
|---|---|
| PK/FK `BIGINT` au lieu de `INT UNSIGNED` | D-ORM-1 (défaut Django, écart assumé global) |
| `est_courante` : `UniqueConstraint` partielle ajoutée | RM-2, non exprimée dans le `.sql` (règle applicative) — durcissement, pas une divergence de structure |

Tout autre écart détecté au `sqlmigrate` doit être corrigé ou consigné ici pendant l'implémentation.

## 7. Unicités & index (repris du SQL)

| Table | Contrainte |
|---|---|
| `annee_scolaire` | `UNIQUE(libelle)` |
| `modalite_formation` | `UNIQUE(code)` |
| `niveau` | `UNIQUE(ecole_id, code)` |
| `filiere` | `UNIQUE(ecole_id, sigle)` |
| `option_filiere` | `UNIQUE(filiere_id, sigle)` |
| `classe` | `UNIQUE(annee_scolaire_id, niveau_id, option_filiere_id, modalite_formation_id)` |
| `matiere` | `UNIQUE(niveau_id, option_filiere_id, semestre, code)` |
| `periode` | `UNIQUE(annee_scolaire_id, numero)` |
| `session_examen` | `UNIQUE(periode_id, type)` |
| `ecole` | index `groupe_scolaire_id` |
| `annee_scolaire` | index partiel `est_courante WHERE est_courante` (ajout RM-2) |

## 8. Workflows

- **Création classe** : `POST classes/` → serializer valide les 4 FK + unicité → `perform_create`
  (`AuditLogMixin`) dans `transaction.atomic` → `services.libelle_classe(...)` → `save()` →
  `JournalAudit(CREATION, apres=snapshot)`.
- **Édition classe** : `PATCH` → si une FK change, `libelle_auto` recalculé → audit avant/après.
- **Année courante** : `PATCH annees-scolaires/{id}/ {est_courante: true}` → service
  `AnneeScolaire.objects.filter(est_courante=True).exclude(pk=obj.pk).update(est_courante=False)`
  puis `save()` — le tout atomique.
- **Suppression** : `DELETE {entite}/{id}/` → `RestrictedError` interceptée → `409`.

## 9. Permissions (RBAC serveur)

- `permissions.py` :
  - `PeutLireReferentiel` = `IsAuthenticated`.
  - `PeutEcrireReferentiel` = `ARole("DIRECTION")` (+ lecture ouverte via `SAFE_METHODS`).
  - `PeutEcrirePedagogique` = `ARole("DIRECTION", "SCOLARITE")`.
- ViewSets « pédagogiques » (`classe`, `matiere`, `periode`, `session_examen`) →
  `permission_classes = [PeutEcrirePedagogique]` ; les 7 autres → `[PeutEcrireReferentiel]`.
- Lecture : toujours autorisée à un compte authentifié ; `LECTURE` ne peut jamais écrire
  (déjà couvert, cf. `EcritureInterditeEnLecture` — réutilisé si utile).
- Le frontend masque les boutons créer/éditer/supprimer selon les rôles de `useAuth()` ; **non
  considéré comme une sécurité**.

## 10. API

Router DRF `DefaultRouter` monté sur `path("referentiel/", include(referentiel.urls))` dans
`api_v1` :

| Endpoint (préfixe `/api/v1/referentiel/`) | Modèle | Écriture |
|---|---|---|
| `groupes-scolaires/` | `GroupeScolaire` | DIRECTION |
| `ecoles/` | `Ecole` | DIRECTION |
| `annees-scolaires/` | `AnneeScolaire` | DIRECTION |
| `modalites-formation/` | `ModaliteFormation` | DIRECTION |
| `niveaux/` | `Niveau` | DIRECTION |
| `filieres/` | `Filiere` | DIRECTION |
| `options-filiere/` | `OptionFiliere` | DIRECTION |
| `classes/` | `Classe` | DIRECTION + SCOLARITE |
| `matieres/` | `Matiere` | DIRECTION + SCOLARITE |
| `periodes/` | `Periode` | DIRECTION + SCOLARITE |
| `sessions-examen/` | `SessionExamen` | DIRECTION + SCOLARITE |

- Actions : `list` (paginé), `retrieve`, `create`, `update`, `partial_update`, `destroy`.
- Pagination : `PageNumberPagination` DRF (à définir dans `REST_FRAMEWORK` — `PAGE_SIZE = 25`,
  `page_size` overridable). Décision de socle prise ici car aucun endpoint paginé n'existait.
- Filtres (`django-filter`) : `ecole`, `groupe_scolaire`, `annee_scolaire`, `niveau`, `filiere`,
  `option_filiere`, `modalite_formation`, `semestre`, `type`, `pole`, `regime`, `est_courante`
  selon l'entité.
- Recherche (`SearchFilter`) : `nom`, `libelle`, `code`, `sigle` selon l'entité.
- Tri (`OrderingFilter`) : `ordre`, `libelle`, `code`, `nom`, `id`.
- `select_related` sur les FK affichées ; serializers exposant `*_id` en écriture et un libellé
  amont en lecture (`niveau_libelle`, `option_libelle`, …) pour éviter les allers-retours front.
- `@extend_schema(tags=["referentiel"])` sur chaque ViewSet ; `spectacular` **0 Error**.
- Après implémentation API : `python manage.py spectacular` → `npm run gen:api` →
  `src/api/types.ts` : `components["schemas"]` peuplés (plus de type écrit à la main pour ces
  entités).

## 11. Interface (frontend)

```
src/app/
  AppShell.tsx      grid [sidebar | (topbar / breadcrumbs / <Outlet/>)]
  Sidebar.tsx       6 groupes : Référentiel (actif) ; Personnes, Scolarité, Trésorerie, Paie,
                    Résultats (désactivés, badge « à venir »)
  Topbar.tsx        menu utilisateur (login affiché, déconnexion)
  Breadcrumbs.tsx   dérivés de la route
src/lib/
  query.ts          QueryClient + <AppQueryProvider>
  resource.ts       createResourceHooks<T>(endpoint) → useList(params) / useOne(id) /
                    useCreate() / useUpdate() / useRemove() (TanStack Query + apiFetch,
                    invalidation de la clé de liste)
  errors.ts         extractFieldErrors(resp) (400 → RHF setError) ; toastFromError (403/409/500)
src/components/
  ResourcePage.tsx  <ResourcePage config={...}/> : TanStack Table (colonnes du descripteur),
                    barre recherche + filtres, pagination, bouton « Créer » (si rôle), actions
                    ligne « Éditer » / « Supprimer » (ConfirmDialog) ; DataState pour
                    loading/empty/error
  ResourceForm.tsx  <ResourceForm config={...} valeurs?={...}/> : RHF + resolver Zod, rend les
                    champs par descripteur : text | number | checkbox | select(options) |
                    fk(endpoint → useList pour peupler)
  ConfirmDialog.tsx, DataState.tsx, Toaster.tsx
src/referentiel/
  config/<entite>.tsx   descripteur : { titre, endpoint, roleEcriture, colonnes[], champs[],
                        schemaZod, defautTri }
  routes.tsx            <Route path="referentiel"> enfants : ecoles, annees-scolaires, niveaux,
                        filieres, options-filiere, classes, matieres, periodes, sessions-examen,
                        modalites-formation, groupes-scolaires
src/routes.tsx          / → RequireAuth → AppShell ; /connexion inchangé
```

Descripteur de champ : `{ name, label, type, required, options?, fkEndpoint?, fkLabel?, help? }`.
Le schéma Zod par entité est écrit à la main dans le descripteur (dérivable plus tard des types
générés, hors périmètre Phase 1).

`classe.libelle_auto` : colonne affichée en liste, **non éditable** dans le formulaire (rendu en
lecture seule / aperçu calculé).

## 12. Validations

- **Serveur (source de vérité)** : types, `max_length`, FK existantes, unicités composites,
  `numero ∈ {1,2}`, `est_courante` unique, `credits_requis`/`credits` nullables, non-`NULL` des
  champs obligatoires. Erreurs renvoyées au format DRF (`{champ: [messages]}`).
- **Client (ergonomie)** : Zod par descripteur (obligatoire, type, longueur), affichage inline,
  conservation du contexte du formulaire, pas de blocage sur une règle purement serveur (unicité
  → laissée remonter en 400 et mappée sur le champ).

## 13. Erreurs

| Code | Cas | Rendu front |
|---|---|---|
| 400 | validation | erreurs mappées champ par champ dans le formulaire |
| 401 | non authentifié | redirection `/connexion` (déjà géré par `RequireAuth`/`apiFetch`) |
| 403 | rôle insuffisant | toast « Rôle insuffisant pour cette action », formulaire conservé |
| 404 | ressource absente | page/état « introuvable » |
| 409 | suppression d'un élément référencé (`RestrictedError`) | toast « Suppression impossible : élément utilisé ailleurs » |
| 5xx / réseau | panne | `DataState` erreur + bouton « Réessayer » |

Backend : nouvelle exception `ConflitSuppressionException(APIException)` dans `core/exceptions.py`
(`status_code = 409`, `default_code = "conflit_suppression"`), levée depuis un mixin
`SuppressionProtegeeMixin.perform_destroy` qui capture `RestrictedError`/`ProtectedError`.

## 14. Audit

`AuditLogMixin` (existant) appliqué à **tous** les ViewSets du module : `CREATION` /
`MODIFICATION` / `SUPPRESSION` avec `table_cible = instance._meta.db_table`, snapshots avant/après
(champs sensibles exclus — aucun ici). `utilisateur` = auteur authentifié. Pas de colonnes
`cree_par`/`modifie_par` sur les tables du référentiel (le design §5 ne les liste pas ; le
`journal_audit` générique suffit).

## 15. Seed

`python manage.py seed_referentiel` — idempotente (`get_or_create` sur les clés naturelles) :

- 1 `groupe_scolaire` (« Groupe Scolaire … », paramétrable par options).
- 4 `ecole` : ESSIG (LMD), UPSS (LMD), CFPA (CLASSIQUE), CICI (CLASSIQUE) — sigles/poles fixes.
- 4 `modalite_formation` : `FI`/`FC`/`FL`/`FT` avec libellés (`FL`/`FT` : libellés provisoires,
  cf. design P1 — modifiables ensuite par l'UI).
- 1 `annee_scolaire` courante (déduite de la date courante, ex. `2025-2026`, `est_courante=True`).
- 2 `periode` (Semestre 1, Semestre 2) sur l'année courante + 1 `session_examen` `NORMALE` par
  période.
- Aucune `filiere`/`option`/`niveau`/`classe`/`matiere` (données propres à l'établissement, saisies
  via l'UI ou un import ultérieur).

Options : `--groupe-nom`, `--annee` (`AAAA-AAAA`). Réexécution → aucune création en double, code de
sortie 0.

## 16. Tests d'acceptation

**Backend (`pytest`)**

- `test_models` : les 11 tables créées ; `UNIQUE(ecole, code)` sur `niveau` rejette un doublon ;
  `credits_requis` accepte `NULL` (assertions portées de `test_001_referentiel.sql`) ;
  `RESTRICT` empêche la suppression d'une `ecole` avec un `niveau` ; `est_courante` : impossible
  d'avoir deux années courantes ; `libelle_classe()` produit `L1 GACO/CI FI 2025-2026` et
  `1A GEA FI 2025-2026` (option sans sigle).
- `test_api` : CRUD complet sur au moins `ecole`, `niveau`, `classe`, `matiere` ; pagination
  (`count`, `next`) ; filtre `?ecole=` ; recherche `?search=` ; tri `?ordering=` ;
  `libelle_auto` en lecture seule (ignore une valeur postée).
- `test_permissions` : anonyme → 401 ; `LECTURE` → GET 200 / POST 403 ; `SCOLARITE` → POST
  `classe` 201, POST `ecole` 403 ; `DIRECTION` → POST `ecole` 201 ; suppression d'un objet
  référencé → 409.
- `test_integrite` : miroir pytest de `db/tests/test_001_referentiel.sql` (structure, 4 FK sur
  `classe`, unicités, nullabilité).
- `test_seed` : première exécution crée N objets ; seconde exécution n'en crée aucun ; l'année
  seed est `est_courante`.
- `test_audit` : une création via l'API écrit une ligne `journal_audit` (`CREATION`,
  `table_cible="ecole"`, `valeurs_apres` non nul).
- Migration `comptes` : `utilisateur_role.ecole` est une FK vers `ecole` ; `seed_socle` et les
  tests RBAC existants restent verts.

**Frontend (`vitest`)**

- `ResourcePage` : rend les lignes d'une liste mockée ; le clic « page suivante » refetch avec
  `page=2` ; la saisie dans la recherche refetch avec `search=`.
- `ResourceForm` : soumission valide → `useCreate` appelé ; réponse 400 → message sous le champ
  correspondant ; réponse 403 → toast, valeurs conservées.
- `Sidebar` : « Référentiel » actif et cliquable ; les 5 autres groupes désactivés.
- Route `/referentiel/ecoles` protégée : sans session → `/connexion`.

**Portes de validation**

`ruff check .` · `python manage.py check` · `makemigrations --check --dry-run` · `pytest` ·
`python manage.py spectacular` (0 Error) · `sqlmigrate referentiel 0001` diffé contre
`001_referentiel_academique.sql` (écarts consignés §6) · `npm run typecheck` · `npm test` ·
`npm run build`.

## 17. Hors périmètre (rappel)

Modules 2–6, vues/reporting, tarifs & frais (Module 3), imports Excel, PDF, upload de fichiers
`logo`, dette `derniere_connexion`, dérivation automatique des schémas Zod depuis OpenAPI,
contrainte croisée `niveau.credits_requis` ↔ `ecole.regime`.

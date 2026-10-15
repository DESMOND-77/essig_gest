# Plan — Phases 7, 8, 11 : Évaluations, Résultats/Délibérations, Rapporting

Spec : `docs/superpowers/specs/2026-10-14-phase-7-8-evaluations-resultats-design.md`.
Phases 9 (bulletins PDF) et 10 (import) restent sautées à la demande du commanditaire.

## Tâche 1 — App Django `evaluations`

Fichiers à créer : `backend/evaluations/{__init__,apps,models,serializers,services,
permissions,views,urls,admin}.py`, `backend/evaluations/migrations/`,
`backend/evaluations/tests/{__init__,test_models,test_services,test_api}.py`.
Enregistrer l'app dans `config/settings/base.py` (`INSTALLED_APPS`) et la route
`path("evaluations/", include("evaluations.urls"))` dans `config/urls.py`.

Modèles (tous `Auditable`, `db_table` explicite, `BigAutoField`) :
- `Evaluation` : FK `matiere`, `classe`, `session_examen` ; `type` (CC/EXAMEN/TP/PROJET) ;
  `ponderation` (DecimalField 5,2, validators 0 < x <= 100) ; `bareme` (IntegerField,
  défaut 20) ; `date` nullable.
- `NoteEvaluation` : FK `evaluation` (CASCADE), `inscription` (RESTRICT) ; `valeur`
  (Decimal 4,2 nullable, validators 0..bareme — valider en `clean()` car dépend d'un
  autre champ du FK) ; `absent` (bool) ; `UniqueConstraint(evaluation, inscription)`.

Service `evaluations/services.py` :
- `calculer_note_matiere_session(inscription_id, matiere_id, session_examen_id)` →
  `Σ(valeur_ramenée_sur_20 * ponderation/100)` sur les `NoteEvaluation` non absentes
  liées ; retourne `None` si aucune note non-absente.
- Validation à la création/MAJ d'une `Evaluation` : rejeter si `Σ ponderation` du
  groupe (matiere, classe, session_examen) dépasserait 100.

Tests (TDD, écrire avant le code) : note retenue sur barème ≠ 20, absent exclu du
calcul, dépassement de pondération rejeté, unicité (evaluation, inscription).

## Tâche 2 — App Django `resultats`

Fichiers : même structure que Tâche 1 sous `backend/resultats/`.

Modèles :
- `Deliberation` : FK `classe`, `session_examen` ; `periode` nullable (NULL =
  annuelle) ; `date`, `president_jury` ; `statut` (BROUILLON/VALIDEE) ; `validee_par`
  FK utilisateur nullable.
- `ResultatMatiere` : FK `inscription`, `matiere`, `periode` ; `note_normale`,
  `note_rattrapage` (Decimal 4,2 nullable) ; `note_retenue` calculée en Python à
  l'écriture (pas de colonne générée MySQL côté Django — recalculer dans
  `save()`/service, stocker la valeur) ; `credits` (copie de `matiere.credits` au
  moment du calcul) ; `validee` (bool, calculé) ; `credits_acquis` (nullable, calculé) ;
  FK `deliberation` nullable ; `UniqueConstraint(inscription, matiere, periode)`.
- `ResultatPeriode` : FK `inscription`, `periode` ; `moyenne_ponderee`,
  `credits_acquis` nullable, `rang` nullable ; `UniqueConstraint(inscription, periode)`.
- `ResultatAnnuel` : FK `inscription` (unique), `annee_scolaire` ; `regime` ;
  `moyenne_annuelle` ; `credits_acquis`/`credits_requis`/`dette_credits` nullable ;
  `decision` (ADMIS/ADMIS_CONDITIONNEL/REDOUBLE/EXCLU/AJOURNE) ; `mention` nullable ;
  `deliberee_le`, `deliberee_par`.
- `DetteCredit` : FK `inscription_origine`, `matiere`, `annee_origine` ; `credits` ;
  `soldee` (bool) ; FK `inscription_solde` nullable ;
  `UniqueConstraint(inscription_origine, matiere)`.

Service `resultats/services.py` (cœur métier, TDD strict — cf. spec §4/§10) :
- `calculer_note_retenue(note_normale, note_rattrapage) -> Decimal` :
  `max(normale or 0, min(rattrapage, 10) if rattrapage is not None else 0)`.
- `deliberer_session(deliberation_id)` : pour chaque inscription de la classe/session
  de la délibération, calcule `ResultatMatiere` par matière (note_normale depuis la
  session NORMALE, note_rattrapage depuis RATTRAPAGE si elle existe pour ce
  semestre), lève une erreur listant les inscriptions/matières sans aucune note (ni
  normale ni rattrapage, et pas marquées absentes) plutôt que de calculer avec des
  trous silencieux (spec §9). Marque `deliberation.statut = VALIDEE`.
- `deliberer_periode(inscription_id, periode_id)` : calcule `ResultatPeriode` à partir
  des `ResultatMatiere` de la période (moyenne pondérée par `matiere.coefficient`).
- `deliberer_annee(inscription_id, annee_scolaire_id)` : calcule `ResultatAnnuel` —
  branche LMD (`credits_acquis >= 60` / `48..59` / `<48`, gestion `DetteCredit`,
  interdiction `ADMIS_CONDITIONNEL` si dette non soldée de l'inscription précédente
  de l'étudiant — forcer `REDOUBLE`) vs CLASSIQUE (`moyenne_annuelle >= 10`) selon
  `inscription.ecole.regime`. Calcule la mention aux 4 seuils. Toute l'opération est
  `transaction.atomic`.
- Au passage en `ADMIS_CONDITIONNEL`, créer une ligne `DetteCredit` par matière de la
  période non validée et pas déjà couverte par une dette existante non soldée.
- Quand une matière en dette est revalidée dans une délibération ultérieure, marquer
  la `DetteCredit` correspondante `soldee=True` et poser `inscription_solde`.

Tests (TDD) : tous les cas listés spec §10 (bornes 60/48/47, CFPA 10/9.99, mentions
4 seuils, dette non soldée bloquant `ADMIS_CONDITIONNEL`, délibération refusée si
notes manquantes, dette soldée au bon moment).

Permissions `resultats/permissions.py` + `evaluations/permissions.py` sur le modèle
`ARole` de `scolarite/permissions.py` (PAS le style dupliqué `rh_paie/permissions.py`) :
`PeutEcrireEvaluations = ARole("SCOLARITE", "DIRECTION")`,
`PeutValiderDeliberation = ARole("DIRECTION")`.

API : CRUD standard `evaluation`/`note_evaluation`/`dette_credit` ; `Deliberation`
CRUD + action `POST .../valider/` (déclenche `deliberer_session`/`deliberer_periode`/
`deliberer_annee` selon que `periode` est renseignée ou non) ; `ResultatMatiere`/
`ResultatPeriode`/`ResultatAnnuel` en lecture seule (`ReadOnlyModelViewSet`).

## Tâche 3 — Phase 11 : Rapporting

Les 13 vues SQL de référence (`db/migrations/008_vues.sql`) n'existent que dans le
schéma SQL de conception, jamais traduites côté Django. Ne pas créer de vraies vues
MySQL via migration Django (incohérent avec "Django = source de vérité", et les
agrégats ne doivent pas être stockés redondamment). À la place : un module
`backend/rapports/` exposant chaque vue comme **un endpoint DRF en lecture seule** qui
réplique exactement la requête SQL de référence via l'ORM (annotations/agrégations)
ou, si l'expression SQL est trop complexe à porter fidèlement en ORM (ex. sous-requêtes
corrélées de `v_situation_scolarite`), via `Model.objects.raw()`/`connection.cursor()`
en lecture seule avec le SQL de `008_vues.sql` adapté aux noms de tables Django
actuels (`db_table` explicite partout, donc les noms correspondent déjà).

Endpoints (`GET /api/v1/rapports/<nom>/`, tous lecture seule, RBAC = authentifié) :
`situation-scolarite`, `situation-frais`, `echeancier`, `solde-compte`,
`bilan-mensuel`, `bilan-consolide`, `etat-scolarite-etudiant`, `resultat-matiere`,
`bulletin-periode`, `resultat-annuel`, `masse-salariale`, `paie-enseignant`,
`arrete-caisse`. Les 3 derniers overlappent des actions déjà existantes
(`tresorerie.ArreteCaisseViewSet.solde_theorique`, `rh_paie` masse salariale) —
vérifier avant de dupliquer, sinon exposer un simple alias/action supplémentaire
plutôt qu'un nouveau modèle de vue.

Chaque endpoint : `@extend_schema(responses=OpenApiTypes.OBJECT)` (ou un serializer
dédié en lecture seule si la forme est stable), paginé comme les autres listes, filtres
minimaux (au moins par `ecole_id`/`annee_scolaire_id`/`inscription_id` selon la vue).

Tests : au moins un test par endpoint comparant le résultat de l'API à un calcul
manuel sur des fixtures connues (pas de simple "ça répond 200").

Frontend : pas d'écran dédié obligatoire dans cette passe sauf si rapide — a minima
documenter dans le rapport final quels rapports restent à câbler côté UI (le mandat
dit explicitement "ne pas recréer inutilement dans le frontend des calculs déjà
définis dans le modèle métier" : privilégier des tableaux simples consommant les
endpoints plutôt que des recalculs côté client).

## Tâche 4 — Frontend Évaluations/Résultats (minimal viable)

Descripteurs `frontend/src/evaluations/config/{evaluation,noteEvaluation}.tsx` et
`frontend/src/resultats/config/{deliberation,detteCredit}.tsx` sur le modèle
`ResourcePage`/`Descripteur` générique existant (cf. `referentiel/config/ecole.tsx`).
`resultatMatiere`/`resultatPeriode`/`resultatAnnuel` : écrans de consultation seule
(pas de formulaire création/édition, lecture seule niveau UI en plus du backend).
Router : nouvelles entrées dans `src/app/Sidebar.tsx` (`disponible: true`,
rôles SCOLARITE/DIRECTION pour les saisies) et `routes.tsx` dédiés par module.

## Validation finale (toutes les commandes, résultats explicites pass/fail)

```sh
ruff check .
python manage.py check
python manage.py makemigrations --check --dry-run
pytest
python manage.py spectacular --file /tmp/schema.yml   # 0 erreur
npm run gen:api
npm run typecheck
npm test
npm run build
```

Comparer `pytest` à la baseline actuelle (269 passed / 27 failed) — zéro régression
attendue sur les échecs déjà documentés comme pré-existants.

## Documentation

Mettre à jour `docs/superpowers/plans/2026-10-14-audit-synthese-tous-modules.md` (ou
créer un complément) pour marquer évaluations/résultats/rapporting comme livrés ;
journaliser dans `.superpowers/` si le chantier suit ce format ailleurs dans le dépôt.

# Spécification fonctionnelle et technique — Consolidation Niveaux/Filières/Classes & Affectations enseignants (ESSIG-GEST)

```text
Document       : docs/superpowers/specs/2026-10-16-gestion-niveaux-classes-enseignants-design.md
Version        : 1.0
Statut         : À VALIDER
Phase          : Consolidation — referentiel (Phase 1) + rh_paie (Phase 6)
Dépendances    : Phase 1 (Référentiel), Phase 6 (RH & Paie)
Auteur         : Agent principal ESSIG-GEST
Date           : 2026-10-16
```

## 0. Instructions d'exécution pour les agents

Cette spécification n'est **pas** une spécification de création. Un audit factuel (section 2) a établi que la quasi-totalité du périmètre proposé par `deep-research-report.md` existe déjà, codée, testée et déployée (modèle + API + UI + audit + RBAC). Cette spec documente l'état réel et ne spécifie que les deltas réels.

Les agents doivent :
1. lire intégralement la section 2 (état existant) avant toute action — elle fait foi, pas le rapport générique source ;
2. ne recréer aucun modèle, endpoint, écran ou mécanisme déjà listé en section 2 ;
3. ne traiter que les deltas de la section 4, dans l'ordre de priorité indiqué ;
4. pour chaque delta, vérifier d'abord qu'il n'est pas déjà couvert par du code non audité avant d'écrire une migration ;
5. livrer par petites tâches testées, sans affaiblir les tests, permissions ou contraintes d'unicité existantes (notamment `unq_affectation` sur `AffectationEnseignement`) ;
6. mettre à jour `progress.md` et la documentation OpenAPI si un champ ou endpoint est ajouté.

Une proposition du rapport générique qui contredit le schéma réel (section 3) est rejetée, pas adaptée en façade.

---

## 1. Objectif

Combler les écarts réels entre le rapport de recherche générique (`deep-research-report.md`) et l'état du code ESSIG-GEST, sans réécrire ce qui fonctionne déjà. Le périmètre utile restant, après audit, se limite à :
- l'ajout d'un rôle d'affectation (professeur principal / suppléant) sur `AffectationEnseignement`, si retenu ;
- l'examen de quelques contraintes et parcours UI secondaires listés en section 4 (l'audit CRUD des entités `referentiel` et `rh_paie` est déjà en place, cf. section 2).

Aucune nouvelle entité (`Niveau`, `Filiere`, `OptionFiliere`, `Classe`, `Enseignant`, `TeacherAssignment`...) n'est à créer : elles existent toutes.

## 2. État existant à préserver — ce qui NE doit PAS être recréé

### 2.1 App `referentiel` (backend `backend/referentiel/models.py` + frontend `frontend/src/referentiel/`)

| Entité | Modèle | Unicité | Endpoint REST | Écran React |
|---|---|---|---|---|
| École | `Ecole` (L17-44) | — | `ecoles` | `config/ecole.tsx` |
| Année scolaire | `AnneeScolaire` (L70-93) | `libelle` ; `est_courante=True` (partiel) | `annees-scolaires` | oui |
| Modalité de formation | `ModaliteFormation` (L96-113) | `code` | `modalites-formation` | oui |
| Niveau | `Niveau` (L116-134) | `(ecole, code)` | `niveaux` | oui |
| Filière | `Filiere` (L137-151) | `(ecole, sigle)` | `filieres` | oui |
| Option de filière | `OptionFiliere` (L154-170) | `(filiere, sigle)` | `options-filiere` | oui |
| Classe | `Classe` (L173-202) | `(annee_scolaire, niveau, option_filiere, modalite_formation)` | `classes` | oui |
| Matière | `Matiere` (L205-231) | `(niveau, option_filiere, semestre, code)` | `matieres` | oui |
| Période | `Periode` (L234-254) | `(annee_scolaire, numero)` | `periodes` | oui |
| Session d'examen | `SessionExamen` (L257-278) | `(periode, type)` | `sessions-examen` | oui |

Toutes les 10 entités sont en CRUD complet (list/retrieve/create/update/partial_update/destroy), avec pagination, recherche, filtres FK, et montées sur `ResourcePage` générique (`frontend/src/referentiel/routes.tsx` L15-26).

**RBAC existant** (`referentiel/permissions.py`) : `PeutEcrireReferentiel` (écriture = DIRECTION) sur Ecole/AnneeScolaire/ModaliteFormation/Niveau/Filiere/OptionFiliere ; `PeutEcrirePedagogique` (écriture = DIRECTION ou SCOLARITE) sur Classe/Matiere/Periode/SessionExamen. Lecture authentifiée libre dans les deux cas.

**Audit CRUD** : tous les ViewSets héritent de `_BaseCrudViewSet` = `SuppressionProtegeeMixin + AuditLogMixin + ModelViewSet` (`core/viewsets.py` L8-20) → chaque création/modification/suppression des 10 entités est déjà journalisée dans `JournalAudit` via `comptes/audit.py::AuditLogMixin` (L34-73).

### 2.2 App `rh_paie` (backend `backend/rh_paie/models.py` + frontend `frontend/src/paie/`)

| Entité | Modèle | Contrainte | Endpoint REST | Écran React |
|---|---|---|---|---|
| Enseignant | `Enseignant` (L9-36) | `email` unique | `enseignants` (+ `activer`/`desactiver`) | `config/enseignant.tsx` |
| Personnel administratif | `PersonnelAdministratif` (L39-63) | — | `personnel-administratif` (+ `activer`/`desactiver`) | oui |
| Affectation enseignant↔classe/matière | `AffectationEnseignement` (L66-91) | `UniqueConstraint(matiere, classe)` nommée `unq_affectation` (L83-85) | `affectations-enseignement` (+ `par_enseignant`, `par_classe`) | `config/affectationEnseignement.tsx` |

`AffectationEnseignement` fait déjà office de table de liaison enseignant↔classe↔matière↔année scolaire, avec `volume_horaire_prevu`, `taux_horaire`, `montant_prevu`. **C'est le même rôle que le `TeacherAssignment` proposé par le rapport générique : il ne faut pas en créer un second.**

**RBAC existant** (`rh_paie/permissions.py`) : `RH_PaiePermission` (lecture : COMPTABLE/DAF/DIRECTION/SCOLARITE/LECTURE ; écriture : COMPTABLE/DAF) ; `RH_PaieValidationPermission` pour `activer`/`desactiver` (DAF/DIRECTION/COMPTABLE).

Module `Paie` activé dans la sidebar (`frontend/src/app/Sidebar.tsx:12`, `disponible: true`).

**Audit CRUD `rh_paie`** : `_BaseRhPaieViewSet` (`rh_paie/views.py` L32-36) hérite déjà de `_BaseCrudViewSet` (donc de `AuditLogMixin` et `SuppressionProtegeeMixin`), avec `permission_classes = [RH_PaiePermission]`. L'alignement a été fait lors de l'audit du 2026-10-14 (cf. docstring de `_BaseRhPaieViewSet`) : `Enseignant`, `PersonnelAdministratif` et `AffectationEnseignement` sont donc déjà journalisés dans `JournalAudit` comme les 10 entités `referentiel`.

### 2.3 Conclusion de l'audit

Le rapport `deep-research-report.md` présente Niveau/Filière/Option/Classe comme « non implémentées » : c'est factuellement faux. Il propose aussi une entité `TeacherAssignment` : elle existe déjà sous le nom `AffectationEnseignement`. Le seul manque réel identifié est un **champ de rôle d'affectation** (professeur principal) sur `AffectationEnseignement` ; l'audit CRUD des modèles `rh_paie` est déjà en place (cf. section 2.2).

## 3. Modèle de données réel — corrections par rapport au rapport générique

Le rapport générique (modèle Ed-Fi-like) décrit une hiérarchie `Niveau → Filière → Classe` avec `Classe.filiere_id` direct et un `Niveau` auto-référencé. **Ce n'est pas le schéma du projet.** Schéma réel :

```
Ecole ──┬── Niveau (code unique par école)
         ├── Filiere (sigle unique par école)
         │     └── OptionFiliere (sigle unique par filière)
         └── AnneeScolaire

Classe ── FK → AnneeScolaire, Niveau, OptionFiliere, ModaliteFormation
             (PAS de FK directe vers Filiere : passe par option_filiere.filiere)

Matiere ── FK → Niveau, OptionFiliere

AffectationEnseignement ── FK → Enseignant, Matiere, Classe, AnneeScolaire
             unique (Matiere, Classe)
```

Divergences à corriger explicitement si le rapport générique est réutilisé comme référence ailleurs :

1. **Pas de `Classe.filiere_id`.** Toute API ou documentation supposant ce champ (ex. `/filieres/{id}/classes`, blocage de suppression « si classes rattachées à la filière ») doit passer par `OptionFiliere` : `Classe.option_filiere.filiere`.
2. **Pas de niveau parent / auto-référence.** `Niveau` n'a aucun FK vers lui-même ; il n'y a pas d'héritage « 2de hérite de 3e ». Le champ `ordre` (déjà présent, L116-134) suffit à exprimer une progression. Rejeter toute proposition de self-FK.
3. **`Filiere` n'est pas rattachée à un `Niveau`.** `Filiere.ecole` est l'unique FK. `Niveau` et `Filiere` sont indépendants, tous deux rattachés à `Ecole`.
4. **Pas d'endpoint `/niveaux/{id}/filieres`.** Ce chemin n'a pas de sens dans le schéma réel ; utiliser `/ecoles/{id}/filieres` et `/ecoles/{id}/niveaux` séparément si un tel filtre est nécessaire (déjà possible via les `filterset_class` existants par `ecole`).
5. **« Option affectée seulement aux classes de sa filière »** : règle correcte en esprit mais à vérifier/implémenter via `option_filiere.filiere`, pas via un `classe.filiere_id` inexistant.
6. **`TeacherAssignment`** : ne pas créer, étendre `AffectationEnseignement` existant (cf. delta D1).

## 4. Deltas à traiter

### D1 — Rôle d'affectation (professeur principal / suppléant)

**Constat** : `AffectationEnseignement` (`rh_paie/models.py` L66-91) n'a aucun champ distinguant un professeur principal d'un enseignant ordinaire sur une classe.

**Justification métier** : besoin fonctionnel courant (bulletin scolaire, interlocuteur référent d'une classe), mais pas de preuve d'usage actif dans le code actuel — à confirmer avant implémentation.

**Proposition d'implémentation** (si confirmé) :
- ajouter `role` (choix : `TITULAIRE` / `PROFESSEUR_PRINCIPAL` / `SUPPLEANT`, par défaut `TITULAIRE`) sur `AffectationEnseignement` ;
- migration Django additive, non destructive, valeur par défaut rétroactive `TITULAIRE` ;
- contrainte métier : au plus un `PROFESSEUR_PRINCIPAL` actif par `(classe, annee_scolaire)` — à vérifier en service métier (pas en contrainte DB simple, car `unq_affectation` porte sur `(matiere, classe)` et un professeur principal peut ne pas être lié à une matière spécifique ; si le modèle l'exige, ce point doit être tranché avant migration, cf. décision D-bloquante en section 7) ;
- exposer le champ dans `frontend/src/paie/config/affectationEnseignement.tsx` (select) ;
- ne pas toucher à `unq_affectation` (matiere, classe), qui reste valide indépendamment du rôle.

### D2 — Audit des entités `referentiel` et `rh_paie` : déjà couvert, aucune action requise

**Constat** : les 10 entités `referentiel` sont déjà auditées via `_BaseCrudViewSet` (AuditLogMixin). `rh_paie/views.py::_BaseRhPaieViewSet` (L32-36) hérite bien de `_BaseCrudViewSet`, comme l'exige la Phase 6 (section 5.10 de `2026-10-12-phase-6-rh-paie.md`) : `Enseignant`, `PersonnelAdministratif` et `AffectationEnseignement` sont donc déjà journalisés dans `JournalAudit`.

**Proposition** : aucune action — ce delta, identifié par erreur dans une première lecture du code, est déjà résolu (alignement fait le 2026-10-14). À ne pas retraiter.

### D3 — Écran dédié « affectation enseignant » : ergonomie de recherche

**Constat** : `config/affectationEnseignement.tsx` a `rechercheActive: false` (pas de recherche texte), contrairement aux autres descripteurs.

**Justification métier** : utilisable en l'état via les filtres FK (`par_enseignant`, `par_classe`), mais moins ergonomique sur un volume important d'affectations.

**Proposition** : activer `rechercheActive` si un champ texte pertinent existe (ex. libellé enseignant via jointure) ; sinon conserver l'état actuel — delta mineur, non bloquant.

### D4 — Cohérence de la grille des niveaux (`Niveau.ordre`)

**Constat** : `Niveau.ordre` existe (`referentiel/models.py` L116-134) mais aucune contrainte garantit l'absence de doublon d'ordre au sein d'une même école.

**Justification métier** : à clarifier — si deux niveaux peuvent légitimement partager un `ordre` (ex. filières parallèles au même rang), ce n'est pas un bug. Sinon, ajouter une contrainte unique `(ecole, ordre)`.

**Proposition** : ne pas agir sans confirmation métier ; documenter comme décision ouverte (section 7).

## 5. RBAC

État réel (section 2) suffisant pour l'ensemble des deltas listés :
- D1 (rôle d'affectation) : écriture déjà restreinte à COMPTABLE/DAF via `RH_PaiePermission` — aucun ajustement RBAC nécessaire, le champ `role` est un champ de formulaire standard sur une ressource déjà protégée.
- D2 (audit) : aucun changement RBAC, uniquement un héritage de mixin.
- D3, D4 : aucun impact RBAC.

Aucun nouveau rôle technique ou fonctionnel n'est introduit par cette spec.

## 6. Hors périmètre

Rejeté explicitement du rapport générique source, avec justification :

- **Normes SIF/Ed-Fi** : standards d'interopérabilité externes à l'écosystème scolaire nord-américain ; sans lien avec le périmètre fonctionnel d'ESSIG-GEST (établissement unique/multi-site local).
- **RGPD générique / chiffrement au repos** : exigence générique non spécifique ; les mécanismes de permissions, d'audit et de périmètre existants du projet (`comptes/`, `core/`) couvrent déjà la protection des données RH/référentiel au niveau applicatif attendu.
- **OAuth2/JWT comme nouveau système d'authentification** : l'authentification (`Utilisateur`, `comptes/`) existe déjà et n'est pas remise en cause par cette spec.
- **Dimensionnement serveur, caching, sharding** : infrastructure, hors scope fonctionnel de cette consolidation.
- **Jalons/estimation en semaines, organisation de projet** : non actionnable techniquement, hors format des specs du dépôt.
- **Entité `TeacherAssignment` comme nouvelle entité** : redondante avec `AffectationEnseignement` existant (cf. section 3, point 6) — rejet définitif, pas une reformulation.
- **Hiérarchie Niveau→Filière, `Classe.filiere_id`, auto-référence de `Niveau`** : incompatibles avec le schéma réel (section 3) — rejetés, pas adaptés.

## 7. Décisions ouvertes à trancher avant implémentation de D1/D4

| ID | Décision | Question |
|---|---|---|
| C1 | Rôle d'affectation (D1) | Le champ `role` s'applique-t-il à une ligne `(enseignant, matiere, classe)` ou existe-t-il une notion de « professeur principal de classe » indépendante d'une matière, nécessitant une relation séparée de `AffectationEnseignement` ? |
| C2 | Contrainte professeur principal (D1) | Un seul professeur principal actif par `(classe, annee_scolaire)` est-il une règle dure (contrainte DB) ou une règle souple (validation applicative, dérogations possibles) ? |
| C3 | Unicité de `Niveau.ordre` (D4) | Deux niveaux peuvent-ils partager le même `ordre` au sein d'une école, ou l'ordre doit-il être strictement unique ? |

Ces décisions doivent être validées avant toute migration Django liée à D1 ou D4. D2 et D3 ne nécessitent pas de décision bloquante.

## 8. Plan de livraison

Limité aux deltas réels — pas de plan multi-mois pour du code déjà écrit.

1. D2 : aucune tâche — déjà fait (`_BaseRhPaieViewSet` hérite de `_BaseCrudViewSet`/`AuditLogMixin`).
2. Trancher C1/C2 avec la direction/métier (D1) ; si validé, migration additive `role` sur `AffectationEnseignement` + validation service + champ formulaire frontend — 1 tâche backend + 1 tâche frontend, tests unitaires sur la contrainte de rôle.
3. Activer `rechercheActive` sur `affectationEnseignement.tsx` si un champ exploitable existe (D3) — tâche frontend isolée, sans impact backend.
4. Trancher C3 (D4) ; si retenu, migration de contrainte unique `(ecole, ordre)` sur `Niveau` — tâche backend isolée avec vérification de données existantes avant migration (pas de contrainte posée si des doublons existent déjà sans justification).
5. Mettre à jour `progress.md` et, si un champ/endpoint change, régénérer les types OpenAPI frontend.

Aucune étape ne touche à la trésorerie, aux migrations de masse, ni aux 10 entités `referentiel` déjà complètes.

---

**Fin de la spécification — Consolidation Niveaux/Filières/Classes & Affectations enseignants, version 1.0.**

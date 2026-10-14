# Synthèse — audit de tous les modules backend livrés (2026-10-14)

```text
Portée  : comptes, core, referentiel, personnes, scolarite, tresorerie, rh_paie (déjà audité séparément)
Méthode : audit multi-agent en lecture seule, aucune ligne de code modifiée dans cette passe
Rapports détaillés :
  - docs/superpowers/plans/2026-10-14-audit-module-comptes.md
  - docs/superpowers/plans/2026-10-14-audit-module-core.md
  - docs/superpowers/plans/2026-10-14-audit-module-referentiel.md
  - docs/superpowers/plans/2026-10-14-audit-module-personnes.md
  - docs/superpowers/plans/2026-10-14-audit-module-scolarite.md
  - docs/superpowers/plans/2026-10-14-audit-module-tresorerie-complement.md
  - docs/superpowers/plans/2026-10-14-audit-etape-a-rh-paie-operations-financieres.md (session précédente)
```

## 1. Verdict par module

| Module | État | Gravité |
|---|---|---|
| `comptes` | Sain. Aucun bug de la grille. 25 tests couvrent permissions/audit/JWT. | — |
| `core` | Sain en lui-même, mais largement contourné par `rh_paie`/`tresorerie`. | — |
| `referentiel` | Sain, CRUD homogène. Un vrai risque de concurrence sur `est_courante`. | Moyen |
| `personnes` | Mature. Génération matricule/numéro d'ordre correctement verrouillée. Deux écarts mineurs. | Faible |
| `scolarite` | Plusieurs bugs confirmés par lecture, un placeholder jamais remplacé en production. | **Élevé** |
| `tresorerie` | **Quasi non-fonctionnel via l'API** — perform_create ne branche aucun service métier, et les services eux-mêmes ont de multiples NameError/AttributeError confirmés. | **Critique** |
| `rh_paie` | Audité et partiellement corrigé en session précédente (validation/paiement/régularisation avance). | Corrigé en partie |

## 2. Findings critiques (bloquants, confirmés par lecture et/ou exécution)

### tresorerie — le plus grave
- **`VirementViewSet`, `EncaissementViewSet`, `DepenseViewSet`, `ArreteCaisseViewSet` ont un `perform_create` qui sauvegarde le serializer brut sans jamais appeler leur service métier.** Conséquence : créer un virement/encaissement/dépense/arrêté via l'API ne génère **aucun mouvement de trésorerie**, indépendamment de tous les autres bugs ci-dessous. C'est le constat le plus grave de tout l'audit — toute la Phase 5 est effectivement un CRUD sans logique financière côté API.
- `executer_virement` : 3 bugs superposés (import manquant de `generer_mouvement_debit`/`credit`, `Virement.date` jamais fourni → `IntegrityError` confirmé, `Mouvement.annee_scolaire_id` jamais fourni).
- `VirementViewSet.valider`/`annuler` appellent `virement_service.valider_virement`/`annuler_virement` — **ces fonctions n'existent pas** → `AttributeError` garanti.
- `creer_encaissement` : import manquant de `generer_mouvement_credit` → `NameError` confirmé.
- `imputer_encaissement` : `F` jamais importé → `NameError` dès qu'une imputation cible une échéance.
- `calculer_solde_theorique_caisse` : faute de frappe bloquante (`movimentos_filter` au lieu de `mouvements_filter`) → `NameError` confirmé, toute création d'arrêté de caisse échoue.
- `categorie_mouvement.py` : la fonction est nommée `créer_categorie_mouvement` (avec accent) au lieu de `creer_categorie_mouvement` → `AttributeError` confirmé partout où elle est appelée sans l'accent.
- `get_ecarts_caisse_importants` : bug de variable de boucle masqué par un `except Exception` qui avale l'erreur et affiche silencieusement « aucun écart ».
- `Mouvement` (le grand livre lui-même) n'a **aucune** protection `save()`/`delete()`, contrairement à `Depense`/`Encaissement`/`Virement`/`ArreteCaisse` qui en ont une — la ligne la plus sensible de tout le système financier est la moins protégée.

### core / contournement par rh_paie et tresorerie
- `rh_paie.serializers.AffectationEnseignementSerializer` référence des champs (`cree_par`, `cree_le`, `modifie_par`, `modifie_le`) qui **n'existent pas** sur le modèle `AffectationEnseignement`. Confirmé en exécutant `manage.py spectacular` : ça casse la génération du schéma OpenAPI **pour tout le projet**, et fait **planter en 500 chaque requête** sur `/affectations-enseignement/`.
- `rh_paie/views.py` et `tresorerie/views.py` dérivent directement de `viewsets.ModelViewSet` au lieu de `core.viewsets._BaseCrudViewSet` → zéro `AuditLogMixin` sur les deux modules financiers (aucune trace d'audit sur les créations/modifications/suppressions via l'API), et pas de `SuppressionProtegeeMixin` (un conflit de suppression protégée renvoie un 500 brut au lieu d'un 409 propre).
- `core/exceptions.py` (codes d'erreur stables, exigés par CLAUDE.md) n'est utilisé que dans `comptes/views.py`. `rh_paie` + `tresorerie` cumulent 63 réponses d'erreur ad hoc (`{'error': str(e)}`) qui contournent ce contrat.

### scolarite
- `FraisInscriptionViewSet` : `select_related` sur des champs inexistants → `FieldError` garanti, **tout GET plante en 500** (masqué par des tests qui ne testent que le POST).
- `EcheanceViewSet.ordering_fields` référence un champ inexistant (`date_prevue` au lieu de `date_echeance`) → `FieldError` dès qu'un tri est demandé.
- `materialiser_frais_obligatoires`, appelée à chaque inscription réelle, est un stub `return []` inconditionnel.
- L'échéancier réellement généré en production (`generer_echeancier`) est un placeholder à une seule échéance (admis dans sa propre docstring) ; une version complète et testée (`generer_echeancier_inscription`) existe mais n'est jamais appelée en dehors des tests.
- `calculer_reste_a_payer_inscription` (désignée par CLAUDE.md comme fonction canonique à réutiliser par trésorerie) est importée dans `tresorerie/services/encaissement.py` mais jamais appelée — import mort.
- Deux implémentations distinctes et incompatibles de `imputer_encaissement` (une FIFO dans scolarite, jamais branchée ; une dans tresorerie, branchée à l'API).

## 3. Findings moyens

- `referentiel.definir_annee_courante` n'utilise aucun verrou (`select_for_update`). La contrainte DB censée garantir une seule `AnneeScolaire.est_courante=True` est documentée par ses propres auteurs comme un no-op sur MySQL. Deux créations/mises à jour concurrentes pourraient produire deux années courantes simultanées — ce qui ferait planter mon propre correctif RH&Paie de la session précédente (`AnneeScolaire.objects.get(est_courante=True)` lèverait `MultipleObjectsReturned`).
- `comptes/config/settings/base.py:156-157` : commentaire TODO obsolète sur `derniere_connexion` — le problème qu'il décrit est déjà résolu ailleurs (`LoginSerializer.validate()`), mais le commentaire laisse croire que c'est encore cassé.
- `UtilisateurManager.creer_utilisateur()` exige `login` ET `email` en positionnel — cohérent dans `comptes`, mais très probablement la cause du `TypeError` déjà observé dans `tresorerie/tests/test_models.py` (fixtures d'autres modules qui appellent ce manager avec une mauvaise signature).

## 4. Findings mineurs

- `personnes` : création d'`Etudiant` sans `transaction.atomic()` explicite (risque de trou de séquence, pas de doublon possible) ; `PieceDossierSerializer` sans `read_only_fields` (un PATCH pourrait rattacher une pièce à une autre inscription).
- `rh_paie/models.py` duplique manuellement les champs d'audit au lieu d'hériter `Auditable` — fonctionnellement correct mais incohérent avec le reste du projet.
- `seed_referentiel.py` utilise le 1er octobre comme début d'année scolaire alors que CLAUDE.md documente septembre.

## 5. Lecture d'ensemble

Les modules des **phases 1-2** (`comptes`, `core`, `referentiel`, `personnes`) sont solides : aucune des huit classes de bugs mécaniques trouvées en RH&Paie ne s'y reproduit, les patterns de verrouillage/transaction/read-only sont appliqués correctement et testés.

À partir de la **phase 3 (`scolarite`, partielle)**, puis surtout **phase 5 (`tresorerie`) et phase 6 (`rh_paie`)**, la qualité chute nettement : fonctions jamais branchées à l'API malgré des tests qui les exercent directement, imports manquants non détectés faute de tests au niveau HTTP, contournement de l'infrastructure commune (`core`), et dans le cas de `tresorerie`, les ViewSets ne branchent même pas leurs propres services métier. Le dénominateur commun : **les tests existants testent presque exclusivement les fonctions de service en isolation, jamais le chemin HTTP réel exécuté par l'API** — c'est exactement ce schéma qui a laissé passer tous ces bugs malgré des suites de tests qui, en apparence, passaient.

## 6. Recommandation

Aucune décision métier n'est requise pour la plupart de ces corrections (contrairement aux D5-D9 de RH&Paie) : ce sont des bugs mécaniques (imports, fautes de frappe, fonctions jamais branchées). Mais le volume et la gravité — en particulier le constat que **les ViewSets de trésorerie ne déclenchent aucune logique financière** — dépassent largement le cadre d'un simple « corrige ces bugs » : c'est une régression fonctionnelle de toute la Phase 5 qui justifie sa propre priorisation et son propre cycle TDD, plutôt que d'être traitée en vrac avec `scolarite` ou `referentiel`.

Suggestion d'ordre de traitement, du plus bloquant au moins bloquant :
1. `tresorerie` — brancher les services métier dans les `perform_create`, corriger les imports/fautes de frappe confirmés, décider d'une protection sur `Mouvement`.
2. `AffectationEnseignementSerializer` (rh_paie/core) — crash 500 garanti + casse le schéma OpenAPI global, correction triviale (retirer les champs ou faire hériter `Auditable`).
3. `scolarite` — brancher `generer_echeancier_inscription`/`materialiser_frais_obligatoires`, corriger les deux `FieldError`.
4. `referentiel` — verrou sur `definir_annee_courante`.
5. Alignement `rh_paie`/`tresorerie` sur `core._BaseCrudViewSet` et les exceptions typées (dette plus large, moins urgente).

## 7. Addendum — corrections appliquées le 2026-10-14 (ordre de phase ascendant, TDD)

Décision utilisateur : traiter en ordre de phase ascendant (1→2→3A→5→6), corriger les bugs
mécaniques sans attendre d'arbitrage métier supplémentaire.

**Phase 1 — `referentiel`** : verrou (`select_for_update()` sur toute la table) ajouté dans
`definir_annee_courante` pour fermer la fenêtre de course sur `est_courante`. Test de concurrence
réel (threads + connexions séparées) ajouté, confirmé reproduisant l'échec sans le correctif.

**Phase 2 — `personnes`** : `transaction.atomic()` ajouté sur `EtudiantViewSet.perform_create`
(symétrie avec `InscriptionViewSet`, évite un trou de séquence de matricule en cas d'échec tardif) ;
`PieceDossierSerializer.inscription` verrouillé après création.

**Phase 3A — `scolarite`** : `FraisInscriptionViewSet.queryset` (`select_related` sur des champs
inexistants, 500 garanti sur tout GET) et `EcheanceViewSet.ordering_fields` (`date_prevue`
inexistant) corrigés. Les deux implémentations concurrentes de l'échéancier
(`generer_echeancier` placeholder actif vs `generer_echeancier_inscription` complète et testée
mais jamais branchée) et `materialiser_frais_obligatoires` (stub) sont restées **intentionnellement
non résolues** : leur activation est un périmètre Phase 3B explicitement gaté par CLAUDE.md, pas un
bug mécanique.

**Phase 5 — `tresorerie`** (le plus gros correctif) :
- Imports manquants corrigés dans `virement.py` (`generer_mouvement_debit`/`credit`) et
  `encaissement.py` (`generer_mouvement_credit`/`debit`, `F`).
- `virement.py::executer_virement` : `Virement.date` et `Mouvement.annee_scolaire_id` (résolu via
  l'année scolaire courante) désormais fournis — bugs confirmés par `IntegrityError` à l'exécution.
- `arrete_caisse.py` : faute de frappe bloquante `movimentos_filter`→`mouvements_filter` corrigée
  (bloquait toute création d'arrêté de caisse) ; verrou ajouté sur `valider_arrete_caisse`.
- `categorie_mouvement.py` : fonction renommée `créer_categorie_mouvement`→`creer_categorie_mouvement`
  (incohérence d'accent, `AttributeError` confirmé, latent côté API).
- `dashboard.py::get_ecarts_caisse_importants` : variable de boucle corrigée (`arretes`→`arrete`),
  bug masqué silencieusement par un `except Exception: return []`.
- **`VirementViewSet.valider`/`annuler` appelaient des fonctions de service inexistantes**
  (`AttributeError` garanti) : `valider_virement`/`annuler_virement` implémentées de bout en bout
  (verrouillage, contre-écritures à l'annulation, traçage de l'auteur).
- **Les 4 `perform_create` de `VirementViewSet`/`EncaissementViewSet`/`DepenseViewSet`/
  `ArreteCaisseViewSet` sauvegardaient le serializer brut sans jamais appeler leur service
  métier** — corrigé : chacun appelle désormais `executer_virement`/`creer_encaissement`/
  `creer_depense`/`creer_arrete_caisse`. Champs client-writable incohérents avec cette logique
  serveur (`statut` sur Virement, `recu_numero`/`statut` sur Encaissement, `solde_theorique` sur
  ArreteCaisse) passés en lecture seule.
- **Découverte supplémentaire, confirmée en écrivant les premiers tests API de cette session sur
  ce module (aucun n'existait avant)** : les 9 serializers de `tresorerie/serializers.py`
  héritaient uniquement de `AuditableSerializerMixin` (un mixin nu, sans base) au lieu de
  `(AuditableSerializerMixin, serializers.ModelSerializer)` — **aucun serializer du module
  trésorerie n'était un serializer DRF fonctionnel** ; tout appel à `get_serializer()` (donc tout
  GET liste/détail et tout POST/PATCH sur les 9 ViewSets) levait `TypeError: ...Serializer() takes
  no arguments`. Corrigé en ajoutant la base manquante sur les 9 classes.
- **Découverte supplémentaire** : `TresoreriePermission`/`TresorerieValidationPermission`/
  `IsCompteOwnerOrReadOnly` vérifiaient `request.user.groups` (groupes Django standard, jamais
  peuplés dans ce projet) et `request.user.groupe_scolaire_id` (champ inexistant sur
  `comptes.Utilisateur`) au lieu de `request.user.roles` (le système RBAC réellement utilisé
  partout ailleurs dans le dépôt) — **toute écriture et toute validation sur l'ensemble du module
  trésorerie était refusée (403), pour tous les rôles, y compris DAF/COMPTABLE.** Corrigé pour
  utiliser `request.user.roles.values_list('role__code', flat=True)`, comme dans
  `rh_paie`/`referentiel`/`personnes`/`scolarite`.
- Tests API ajoutés dans `tresorerie/tests/test_api.py` (inexistant avant cette session) couvrant
  les 4 créations, le cycle virement BROUILLON→VALIDE→ANNULE, et la régression de permission.
- Bug de fixture de test pré-existant corrigé en passant (`username=`→`login=` dans
  `tresorerie/tests/test_models.py::setUp`) ; les échecs restants de ce fichier (`classe_id` NULL
  à la création d'une `Inscription` dans le même `setUp`) sont un bug de fixture distinct, non
  corrigé (hors périmètre de cette passe).

**Découverte transversale (core, phases 1-6)** : `rh_paie.serializers.AffectationEnseignementSerializer`,
`EnseignantSerializer` et `PersonnelAdministratifSerializer` déclaraient des champs d'audit
(`cree_par`/`cree_le`/`modifie_par`/`modifie_le`) **absents des modèles `AffectationEnseignement`,
`Enseignant` et `PersonnelAdministratif`** (contrairement à `SalaireEnseignant`/
`SalaireAdministration`/`AvancePersonnel`, qui les dupliquent correctement). Conséquence confirmée
par exécution : `ImproperlyConfigured` sur la génération du schéma OpenAPI (`manage.py spectacular`
et `GET /api/v1/schema/`), cassant la génération de schéma **pour tout le projet**, plus un échec
garanti sur tout `POST` vers ces trois endpoints (le mixin d'audit tente de poser `cree_par=...`
sur un modèle qui n'a pas ce champ). Corrigé en ajoutant les 4 champs d'audit aux 3 modèles
(migrations `rh_paie.0009`, `rh_paie.0010`).

**Validation finale** : `manage.py check` et `makemigrations --check` restent propres ;
`pytest` sur l'ensemble du dépôt passe de 36 échecs à 34, puis les 2 derniers écarts
(`core/tests/test_schema.py`, qui passe maintenant à 3/3) retombent sur des échecs confirmés
**pré-existants et non liés** à cette session : bugs de fixtures de test déjà documentés
(`scolarite.generer_echeancier`/`materialiser_frais_obligatoires`, chemin de paiement
`rh_paie`/`tresorerie` déjà mort, `Inscription.classe` manquant dans un `setUp`), et pollution de
test inter-fichiers propre à l'exécution de la suite complète (throttling JWT) sans rapport avec
le code de production.

## 8. Addendum — Phase 6 (`rh_paie`), suite du 2026-10-14

Poursuite de l'ordre de phase ascendant, toujours en TDD.

- **Protection des données validées/payées/régularisées** (Étape E de la mission initiale,
  jamais traitée) : `SalaireEnseignant`, `SalaireAdministration` et `AvancePersonnel` ont
  désormais un garde `save()`/`delete()` identique au pattern déjà en place sur
  `tresorerie.Depense`/`Encaissement`/`Virement`/`ArreteCaisse` — un enregistrement `VALIDÉ`/`PAYÉ`
  (ou une avance `regularisee=True`) refuse la modification de ses champs substantiels
  (`montant`, `compte`, bénéficiaire, dates...) et refuse toute suppression ; les champs de
  workflow eux-mêmes (`statut`, `mouvement`, `modifie_par`...) restent modifiables pour ne pas
  bloquer les transitions légitimes. **Piège rencontré et corrigé** : `montant_paye` avait
  d'abord été inclus dans les champs protégés de `SalaireAdministration`, ce qui cassait 6 tests
  de `tresorerie/tests/test_services.py` qui le modifient légitimement lors du paiement — exclu
  du tableau `protected_fields` après coup. 7 tests de régression dans
  `rh_paie/tests/test_protection_donnees_financieres.py`.
- **Alignement sur `core._BaseCrudViewSet`** (gap relevé par l'audit `core`) : les 6 ViewSets de
  `rh_paie` dérivaient directement de `viewsets.ModelViewSet`, sans `AuditLogMixin` (zéro entrée
  de `JournalAudit` sur create/update/destroy) ni `SuppressionProtegeeMixin` (un conflit
  RESTRICT/PROTECT remontait en 500 brut au lieu d'un 409 propre). Les 6 `perform_create`
  redondants (`serializer.save(cree_par=self.request.user)`, sans audit) ont été supprimés — le
  mixin hérité s'en charge, en s'appuyant sur `AuditableSerializerMixin` déjà présent sur tous les
  serializers rh_paie. 2 tests de régression dans `rh_paie/tests/test_core_viewset_adoption.py`.
- **Bug confirmé au passage** : `PersonnelAdministratifViewSet.activer` testait
  `if personnel.active:` — attribut inexistant (`AttributeError` garanti), le champ réel est
  `actif`. Corrigé.
- **Nettoyage** : suppression de `backend/rh_paie/test_api.py` (script manuel non pytest-safe,
  racine de l'app, faisait planter la collecte en suite complète avec
  `RuntimeError: Database access not allowed`), redondant avec `rh_paie/tests/test_api.py` qui
  couvre les mêmes cas en vrai test.
- **Laissé en l'état, documenté comme dette connue, non une régression** : la duplication
  `payer_salaire_enseignant`/`payer_salaire_administration` (service jamais appelé par l'API,
  testé en isolation) vs le chemin inline réellement exécuté dans `views.py` — fusionner les deux
  sans décision explicite sur laquelle doit devenir la référence porterait un risque de régression
  pour un gain incertain. `test_mouvement_null.py`, `rh_paie_audit.md` (racine) et
  `Services_Summary.md` restent en attente d'une décision utilisateur (déjà signalé le
  2026-10-14, non traité depuis).

**Validation finale (dépôt entier)** : `manage.py check` et `makemigrations --check` propres ;
`pytest` complet passe de 251 à 257 tests verts, pour le même ensemble de 33 échecs confirmés
pré-existants/sans lien (aucune régression). Un faux pas a été détecté et corrigé en cours de
route (`montant_paye` protégé par erreur) — cf. ci-dessus.

## 9. Addendum — traitement des deux points laissés en attente (2026-10-14)

- **Fichiers stray** : `test_mouvement_null.py` (racine, script manuel de repro, superseded par
  `rh_paie/tests/test_avance_personnel_regularisation.py`) et `rh_paie_audit.md` (racine, audit
  obsolète entièrement superseded par `docs/superpowers/plans/2026-10-14-audit-etape-a-rh-paie-*`)
  supprimés — aucun des deux n'était suivi par git, aucune perte d'historique.
  `backend/rh_paie/Services_Summary.md` déplacé vers
  `docs/superpowers/plans/2026-10-12-rh-paie-services-summary.md` (contenu légitime, mais mal
  placé à l'intérieur du package Python importable).
- **Duplication service-mort / chemin-inline sur le paiement des salaires** : choix retenu =
  documenter plutôt que fusionner. `payer_salaire_enseignant`/`payer_salaire_administration`
  (rh_paie/services/) restent en place, testées en isolation, mais portent désormais une note
  explicite dans leur docstring : non appelées par l'API réelle, règle de validation différente
  du chemin inline de `views.py` (qui, lui, est le chemin effectivement exécuté et déjà durci
  cette session), et ne doivent pas être branchées sans une décision explicite d'unification.
  Fusionner les deux maintenant aurait un risque de régression réel pour un gain incertain sans
  cette décision — cf. tableau de corrections nécessaires de l'audit initial.

## 10. Addendum — résolution des 6 échecs pré-existants nommés (2026-10-14)

Décision utilisateur obtenue en cours de route : **les paiements partiels/échelonnés de salaire
administratif sont supportés** (question posée car deux suites de tests encodaient des règles
contradictoires sur `montant_paye`).

- **`tresorerie/services/services.py::effectuer_paiement_salaire`** (branche `administration`) :
  bug réel confirmé — `restant_a_payer = montant_du - montant_paye` valait systématiquement 0
  car les tests appelants pré-remplissaient `montant_paye = montant_du` *avant* le paiement
  (convention "paiement unique" de `rh_paie/tests`), alors que `tresorerie/tests` teste un
  véritable paiement partiel (`montant_paye` = ce qui est *déjà* versé). Corrigé pour la
  sémantique "partiel" (décision ci-dessus) : `montant_paye` représente désormais ce qui est
  réellement déjà versé, chaque appel doit couvrir exactement le reste à payer courant, le statut
  ne passe à `PAYÉ` que lorsque le solde est intégralement soldé. Les 3 tests de
  `rh_paie/tests/test_salaire_administration_service.py` ont été ajustés en conséquence
  (fixtures `montant_paye=0`, appel avec `montant=salaire.montant_du`).
- **`rh_paie/tests/test_salaire_validation.py`** (3 échecs) : bugs de test, pas de code de
  production — (1) deux sous-tests qui provoquent délibérément une `IntegrityError` (champ
  `annee_scolaire` NOT NULL) sans l'isoler dans un `transaction.atomic()` dédié, ce qui invalidait
  la transaction englobante du test et faisait échouer tout appel DB suivant avec
  `TransactionManagementError` — corrigé en ajoutant le savepoint manquant (pattern Django
  standard) ; (2) `test_7_no_premature_treasury_movement` comparait `mouvement` à `0` alors que
  la fixture le fixait arbitrairement à `8` — corrigé en ne fixant plus `mouvement` du tout
  (`None` par défaut, cohérent avec "aucun mouvement avant paiement") ; (3) même classe de test,
  un placeholder `mouvement=5` était réutilisé sur 3 enregistrements différents dans la même
  méthode de test, violant la contrainte d'unicité sur `mouvement` — corrigé en retirant ce
  placeholder inutile (7 occurrences au total dans le fichier).

**Validation finale** : les 6 échecs nommés sont résolus, suite complète du dépôt passée de 257 à
263 tests verts (33 → 27 échecs), sans aucune régression. Les 27 restants sont tous confirmés
pré-existants et sans lien avec cette session (pollution de throttling JWT en suite complète,
bugs de fixtures déjà documentés dans `personnes`/`scolarite`/`tresorerie`, et un dernier test
`tresorerie` sur le même chemin de paiement mort, non nommé dans la demande initiale).

## 11. Addendum — Étape 0 (inventaire externe) et protection de `Mouvement` (2026-10-14)

Suite à un rapport d'analyse externe consolidant les audits de cette session et proposant un plan
de stabilisation en 6 étapes (document fourni par l'utilisateur), deux actions ont été menées en
parallèle (lecture seule pour l'une, TDD pour l'autre, conformément aux règles du rapport) :

- **Étape 0 — inventaire reproductible** (rapport complet :
  `docs/superpowers/plans/2026-10-14-etape0-inventaire-echecs.md`) : chacun des 27 échecs a été
  rejoué isolément et classé avec preuve. Résultat : **0 régression**, 6 ENVIRONNEMENT (pollution
  de throttling JWT en suite complète, disparaissent en isolation), 12 PRÉEXISTANT-FONCTIONNEL
  (dont 11 partagent une cause unique : `scolarite/services.py:31` accède à `inscription.niveau`,
  champ inexistant sur le modèle), 9 PRÉEXISTANT-FIXTURE (`tresorerie/tests/test_models.py` crée
  une `Inscription` sans `classe`), 0 décision métier bloquante. `manage.py check` et
  `makemigrations --check` confirmés propres.
  - **Découverte nouvelle, non signalée dans les audits précédents** : `manage.py spectacular`
    générait **28 erreurs** (1 cause unique) — `TableauDeBordViewSet` (`tresorerie/views.py`)
    n'a ni `serializer_class` ni annotation de schéma sur ses 7 actions personnalisées
    (tableau de bord : soldes, flux, encaissements/dépenses récents, écarts de caisse,
    prévisionnel), toutes retournant des dictionnaires ad hoc. Non conforme à la convention du
    projet (« doit rester 0 Error »). **Corrigé** : `@extend_schema(responses=OpenApiTypes.OBJECT)`
    ajouté aux 7 actions. `manage.py spectacular` : 0 Error (6 warnings mineurs pré-existants,
    hors périmètre de la convention). Aucune régression (suite `tresorerie/` : 28 passed, 1 échec
    pré-existant déjà documenté).
  - **Risque d'infrastructure signalé par l'agent** : deux exécutions `pytest` concurrentes sur la
    même base de test MySQL (`test_mlamine`) se sont interférées pendant cette tâche (tables
    disparaissant mi-course), causé par les deux agents de cette passe tournant en parallèle. Pas
    un bug de code — mais confirme que la suite de tests de ce dépôt n'est pas sûre en exécution
    multi-agent concurrente sur une même base ; à garder à l'esprit pour toute parallélisation
    future de `pytest` sur ce projet.
- **Protection du modèle `Mouvement`** (P0 explicite du rapport externe, § 2 point 4) : seul
  modèle financier du dépôt sans garde `save()`/`delete()`, contrairement à
  `Depense`/`Encaissement`/`Virement`/`ArreteCaisse` déjà protégés. Ajouté avec le même pattern
  (`tresorerie/models.py::Mouvement.save()`/`.delete()`), en se basant sur le champ `valide`
  (le modèle n'a pas de `statut`) : les champs substantiels sont protégés dès `valide=True`
  (cas normal) ; `valide` lui-même n'est jamais modifié ailleurs dans le code que par
  `valider_mouvement`/`invalider_mouvement` (confirmé par grep) et reste donc hors
  `protected_fields` ; la suppression est bloquée sans condition (aucun code n'appelle
  `.delete()` sur un `Mouvement`, le mécanisme de correction prévu est l'invalidation, pas la
  suppression). TDD suivi : 4 tests dans `tresorerie/tests/test_mouvement_protection.py`, échec
  confirmé avant correctif, succès après. Suite `tresorerie/`+`rh_paie/` (hors `test_api.py`) :
  89 passed, 10 failed — mêmes échecs déjà documentés, aucune régression nouvelle.
  `manage.py check`/`makemigrations --check` propres, aucune migration nécessaire.

**Validation finale (dépôt entier, exécution séquentielle)** : 267 passed / 27 failed — identique
à l'inventaire ci-dessus, confirmé de façon indépendante. `manage.py check`,
`makemigrations --check` et `manage.py spectacular` (0 Error) tous propres.

**Ce qui reste du plan externe, non traité dans cette passe** (scope des étapes 1 à 5, bien plus
large — tests de concurrence systématiques sur imputation/encaissement, décision D6/D8/imputation
FIFO vs explicite, activation Phase 3B scolarité, uniformisation des codes d'erreur publics,
recette métier, procédure de bascule production) : à planifier explicitement avec l'utilisateur
avant d'y engager une nouvelle session, le périmètre dépassant largement une seule passe.

## 12. Addendum — incident serveur réel : tables `Virement`/`Encaissement`/`Depense`/`ArreteCaisse` introuvables (2026-10-14)

**Signalé par l'utilisateur** : `ProgrammingError` sur `/admin/tresorerie/imputationencaissement/`
— `Table 'mlamine.tresorerie_encaissement' doesn't exist`. Ceci touchait la base de
**développement réelle** (`mlamine`), pas une base de test.

**Cause racine confirmée** : `Virement`, `Encaissement`, `Depense`, `ArreteCaisse` dans
`tresorerie/models.py` avaient perdu leur `class Meta` (donc `db_table` explicite, indexes et
contraintes), dans une version de travail non commitée antérieure à cette session (migration
`0002_alter_arretecaisse_options_...`, générée le 2026-10-13, en capture la trace : elle retire
précisément ces `Meta` — `AlterModelTable(table=None)` + `RemoveConstraint`/`RemoveIndex`). Sans
`db_table`, Django retombe sur le nom par défaut (`tresorerie_encaissement` au lieu de
`encaissement`) — d'où l'erreur. La version **committée** (`HEAD`) avait ces `Meta` intacts.

**Découverte aggravante** : sur `mlamine`, la migration 0002 est marquée appliquée dans
`django_migrations`, mais son renommage de table **n'a jamais réellement été exécuté** — les
tables sont restées nommées `arrete_caisse`/`depense`/`encaissement`/`virement`, et les
contraintes CHECK/UNIQUE qu'elle a supprimées n'existaient déjà plus physiquement. Base et
historique de migration étaient donc mutuellement incohérents, indépendamment du bug de code.

**Corrigé** :
1. `class Meta` restaurée (depuis `HEAD`) sur les 4 modèles — `db_table`, `verbose_name`,
   contraintes `CheckConstraint`/`UniqueConstraint`, `indexes` — en conservant les ajouts de
   cette session (`save()`/`delete()` de protection, `editable_statuses`, etc.).
2. Migration `0003` générée puis appliquée à `mlamine`, après vérification que les 4 tables
   étaient **vides** (aucune donnée à risque de violer les nouvelles contraintes CHECK).
   Un premier essai a révélé que l'ordre des opérations auto-généré par Django échouait sur
   `mlamine` spécifiquement (la table physique ne portait jamais le nom par défaut que 0002
   prétendait avoir posé) ; corrigé ponctuellement pour cette base précise, puis **le fichier de
   migration a été réécrit dans sa forme normale** (celle que `makemigrations` générerait sur
   n'importe quelle base migrée proprement depuis zéro) pour ne pas casser les bases fraîches —
   erreur détectée immédiatement par la suite de tests complète (285 erreurs, toutes liées à la
   création de la base de test), corrigée, revérifiée à 267 passed/27 failed (baseline inchangée).
3. Vérifié directement : la requête exacte qui plantait dans l'admin
   (`ImputationEncaissement.objects.select_related('encaissement')`) s'exécute maintenant sans
   erreur. `manage.py check`/`makemigrations --check` propres sur `mlamine`.

**Leçon pour la suite** : ne jamais corriger un problème de dérive migration/base en adaptant le
fichier de migration lui-même à l'état incohérent d'UNE base spécifique — ça casse silencieusement
toutes les autres (tests, CI, nouvelles installations). La bonne séquence est : corriger le code
(`models.py`) vers l'état correct et universel, générer la migration normale, puis — si une base
précise a une histoire incohérente — traiter cette base à part (ici : vérifier qu'elle était vide
et rejouer la migration normalement after a workaround ponctuel, sans altérer le fichier partagé).

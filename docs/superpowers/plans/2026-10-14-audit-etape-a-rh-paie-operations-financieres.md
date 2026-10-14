# Audit Étape A — RH & Paie, opérations financières (validation, paiement, régularisation, protection)

```text
Date     : 2026-10-14
Méthode  : audit multi-agent en lecture seule (6 agents parallèles + synthèse), aucune ligne de code modifiée
Spec     : docs/superpowers/specs/2026-10-12-phase-6-rh-paie.md §14 (D1-D14)
Plan     : docs/superpowers/plans/2026-10-12-phase-6-rh-paie.md
```

Cet audit remplace/complète `rh_paie_audit.md` (racine, obsolète — écrit avant que services/, views.py,
urls.py, permissions.py et les migrations 0002-0008 existent).

## 1. Tableau d'audit par opération

| Opération | Implémentation actuelle | Risques | Corrections nécessaires | Tests existants |
|---|---|---|---|---|
| Création salaire enseignant | `SalaireEnseignantViewSet` POST standard. `statut` défaut `BROUILLON` (models.py:109). `compte` FK requis CASCADE (models.py:106). `mouvement` reste `BigIntegerField` placeholder (models.py:107), jamais converti en FK malgré 8 migrations. | `compte` CASCADE supprime les salaires si le compte est supprimé. Serializer laisse `statut`/`date_validation`/`valide_par`/`mouvement` writable (serializers.py:97-105) — un POST/PATCH peut forger un enregistrement déjà "validé". | Convertir `mouvement` en FK réelle vers `tresorerie.Mouvement` ; passer les champs de workflow en `read_only_fields`. | Pas de test dédié à la création seule. |
| Validation salaire enseignant | Action `valider` (views.py:284) → `salaire_enseignant_service.valider_salaire_enseignant` : `select_for_update()`, vérifie `statut=='BROUILLON'`, idempotent via `date_validation`, flip `statut='VALIDÉ'`. **Aucun Mouvement créé à la validation** (confirmé par test). Permission `RH_PaieValidationPermission` (DAF/DIRECTION/COMPTABLE) — même rôle que paiement et régularisation. | Le service ne vérifie AUCUNE permission lui-même (seule la vue le fait) — aucun test HTTP réel ne confirme un 403 pour un rôle insuffisant. Pas de séparation auteur/validateur. Champs de workflow modifiables par PATCH direct (aucune garde `perform_update`). | Test HTTP réel sur permission (403 LECTURE/SCOLARITE). Bloquer l'édition standard des champs de workflow une fois VALIDÉ/PAYÉ. | `test_salaire_validation.py` (28-376) : happy path, id inexistant, double-validation, montant négatif, préservation audit-trail. Test "concurrence" (`test_8`) est **séquentiel, pas réellement concurrent**. |
| Création salaire administration | Idem enseignant + `UniqueConstraint(personnel_administratif, annee_scolaire, mois)` (models.py:168). | Idem enseignant. | Idem enseignant. | Idem. |
| Validation salaire administration | Idem enseignant (views.py:435). | Idem enseignant. | Idem. | `test_salaire_validation.py` (378-746), mêmes limites. |
| Paiement salaire enseignant | **Deux chemins concurrents, non unifiés** : (a) service `payer_salaire_enseignant` → `tresorerie_service.effectuer_paiement_salaire` — **jamais appelé en pratique** ; (b) chemin réellement exécuté = **inline dans views.py:309-391** : lecture non verrouillée (pas de `select_for_update`), check idempotence `if salaire.mouvement:` avant le bloc atomique (TOCTOU), puis `depense_service.creer_depense(...)`. `depense_service.creer_depense` appelle `generer_mouvement_debit` (depense.py:64) **sans l'avoir importé** → NameError probable, non vérifié en conditions réelles. | TOCTOU double-paiement ; bug d'import potentiellement bloquant ; deux implémentations avec règles différentes (le service mort exige `montant==restant_a_payer`, le chemin inline non) ; `date_operation` du Mouvement requis sans défaut, non fourni par `generer_mouvement_debit`. | Supprimer le chemin dupliqué, garder un seul chemin verrouillé (`select_for_update` avant tout check) ; corriger l'import manquant dans `depense.py` ; fournir `date_operation`. | Les tests de service testent le **service mort**, pas le chemin HTTP réellement exécuté par l'API — zéro couverture du code de production réel. |
| Paiement salaire administration | Même duplication (views.py:460-553). | Identiques. | Identiques. | Même limite (teste le service, pas la vue). |
| Création avance | `AvancePersonnel` **sans aucun champ de cycle de vie** — seulement `regularisee: bool` (models.py:191), pas de `statut`, pas de `date_validation`/`valide_par`. `compte` requis CASCADE. Pas de champ "solde restant". | Pas de workflow de validation d'avance contrairement aux salaires — à clarifier si volontaire (D5). `regularisee`/`mouvement` writable côté serializer. | Décider D5 ; passer `regularisee`/`mouvement` en read-only. | **Aucun test** (zéro couverture, confirmé par grep). |
| Régularisation avance | Action `regulariser` (views.py:608) → `AvancePersonnelService.regulariser_avance` (`avance_personnel_service.py:46-96`), `@transaction.atomic`, idempotent (`if avance.regularisee: raise`), vérifie cohérence bénéficiaire et `montant>0`, crée un Mouvement débit via `generer_mouvement_debit` (bon réflexe — réutilise le mécanisme canonique). **MAIS `views.py:619` appelle `avance_service.regulariser_avance(...)` alors que seul `avance_personnel_service` est importé** → **NameError quasi certain**, masqué par un `except Exception` générique → 400 générique. Pas de `select_for_update`. `annee_scolaire_id=None` passé à `generer_mouvement_debit` alors que `Mouvement.annee_scolaire` est une FK requise NOT NULL — échec probable. Pas de lien vers `SalaireAdministration` (`regularise_salaire_admin_id` jamais renseigné). | **Bug bloquant quasi certain** rendant l'endpoint non fonctionnel en l'état. Race condition sur double-régularisation concurrente (pas de verrou). Incompatibilité NOT NULL. | Corriger `avance_service` → `avance_personnel_service` dans views.py:619 ; ajouter `select_for_update()` ; fournir une vraie valeur `annee_scolaire_id` ; écrire les tests (actuellement inexistants). | **Aucun** test (grep sans résultat). |
| Protection des données validées/payées | **Aucune protection n'existe.** Aucun `get_queryset`/`perform_update`/`perform_destroy`/`has_object_permission` filtrant par statut sur les 6 ViewSets. Les `UniqueConstraint(mouvement)` ne protègent pas une modification/suppression (et `mouvement=NULL` ne bloque rien, MySQL traitant NULL comme non conflictuel). Comparer à `tresorerie.Depense` qui a un garde `save()`/`delete()` bloquant hors statut `ENGAGEE` (models.py:524-552) — modèle à suivre, absent de rh_paie. | Un salaire PAYÉ ou une avance régularisée peut être supprimé/réécrit par n'importe quel COMPTABLE/DAF via PATCH/PUT/DELETE standard. Aucun `AuditLogMixin` sur ces 6 ViewSets. | Implémenter une garde `save()`/`delete()` (à l'image de `Depense`) ou `perform_update`/`perform_destroy`+`get_queryset`, bloquant toute modification une fois VALIDÉ/PAYÉ/régularisée. Brancher `AuditLogMixin`. Passer les champs de workflow en read-only. | **Aucun** test. |

## 2. Conflits de modules Python (bugs latents, indépendants des décisions métier)

- **`rh_paie`** : `backend/rh_paie/services.py` (fichier plat, non tracké) coexiste avec `backend/rh_paie/services/` (package). Confirmé empiriquement (import réel) : le **package gagne toujours** — le fichier plat est **mort, zéro appelant**.
- **`tresorerie`** : même collision. `backend/tresorerie/services.py` est **tracké en git et modifié récemment** (`git status` le montre `M`) — contrairement à son équivalent rh_paie — ce qui est un signal plus fort d'un oubli que d'un résidu. Il contient une version alternative, non idempotente, de `effectuer_paiement_salaire`. **À examiner via `git log -p` avant suppression**, car quelqu'un y a travaillé récemment en pensant peut-être qu'il était actif.
- `backend/tresorerie/services/services.py.bak` : copie byte-identique, jamais commitée, aucun importeur — suppression sûre.
- **Bug confirmé** : `backend/rh_paie/views.py:619` appelle un nom (`avance_service`) jamais importé → `NameError` probable, masqué par un `except Exception` générique renvoyant 400. L'action `regulariser` d'une avance est donc **probablement cassée en l'état**.
- **Bug suspecté** : `depense_service.creer_depense` (tresorerie) appelle `generer_mouvement_debit` sans l'avoir importé dans ce fichier → `NameError` probable sur le chemin de paiement inline des salaires. Non vérifié à l'exécution (lecture statique uniquement).
- `payer_salaire_enseignant`/`payer_salaire_administration` (services) : code vivant au sens import mais **mort au sens appel** — le vrai chemin de paiement HTTP est inline dans `views.py` avec des règles différentes (pas de check `montant==restant_a_payer`).

## 3. Fichiers suspects à la racine du dépôt

| Fichier | Verdict |
|---|---|
| `shared_data.json`, `shared_data_utils.js`, `test_shared_data.js` | Suppression recommandée — scratch sans lien avec l'app, non branché sur les suites de tests. |
| `test_mouvement_null.py` | Décision utilisateur — script de repro réel (modèles rh_paie/tresorerie/referentiel) mais hors arbre `backend/`, écritures DB non maîtrisées, pas collecté par pytest. À convertir en test propre ou supprimer. |
| `backend/rh_paie/Services_Summary.md`, `rh_paie_audit.md` (racine) | Décision utilisateur — contenu légitime mais mal placé ; devrait être dans `docs/superpowers/` ou `.superpowers/sdd/`. |
| `backend/tresorerie/services/services.py.bak` | Suppression recommandée (copie morte). |

## 4. Décisions métier bloquantes (D5, D6, D7, D8, D9 — spec §14)

| Réf. | Ce que le code actuel laisse supposer | Ce qui reste à trancher |
|---|---|---|
| D5 — Avances : plafond / traitement sortants | Aucun plafond codé. Aucune étape de validation pour les avances (contrairement aux salaires) — création puis régularisation directe. | Faut-il un plafond métier (% salaire, montant fixe) ? Faut-il un statut/validation intermédiaire symétrique aux salaires, ou le flux à une étape est-il assumé ? |
| D6 — Remboursements : montant / méthode / plafond retenue | `regulariser_avance` traite toute la régularisation comme un seul mouvement débit du montant total — pas de retenue partielle échelonnée, pas de "solde restant". | Remboursement en une fois uniquement, ou retenues successives sur plusieurs bulletins ? Plafond de retenue par bulletin ? Le modèle actuel ne supporte pas structurellement l'échelonnement. |
| D7 — Validation/paiement : la validation autorise-t-elle le paiement ? Quelle preuve fait passer à PAYÉ ? | Le code impose `statut=='VALIDÉ'` avant paiement (testé). "Preuve de PAYÉ" = simple création réussie d'un Mouvement/Depense — aucune pièce justificative/référence bancaire exigée. | Suffit-il qu'un Mouvement soit créé, ou faut-il une preuve de décaissement effectif avant de flipper PAYÉ ? Lequel des deux chemins de paiement concurrents doit devenir la référence unique ? |
| D8 — Quel compte de trésorerie, qui le choisit | `compte` est une FK requise choisie librement à la création par l'utilisateur (COMPTABLE/DAF) — aucune contrainte codée sur quel compte est éligible. | Le compte doit-il être restreint (ex. compte "paie" dédié par école/année) plutôt que libre choix ? |
| D9 — Ajustements/annulations : qui autorise, traitement si fonds déjà décaissés | **Rien n'existe dans le code.** Aucune action d'annulation/ajustement sur les 6 ViewSets. `tresorerie.Depense` bloque structurellement toute modification hors `ENGAGEE` sans offrir de procédure d'annulation définie. | Qui peut annuler un paiement déjà effectué ? Via quel mécanisme (mouvement inverse, avoir, écriture de correction) ? Absence totale de workflow actuellement — pas un choix d'implémentation partiel. |

## 5. Recommandation

La mission interdit explicitement de commencer les modifications avant l'établissement de cet audit
et la résolution des décisions bloquantes. Deux pistes sont indépendantes et peuvent avancer en
parallèle :

1. **Décisions métier (D5/D6/D7/D8/D9)** : à trancher par un humain, à consigner dans
   `docs/superpowers/specs/2026-10-12-phase-6-rh-paie.md` §14 ou `.superpowers/sdd/`.
2. **Bugs mécaniques indépendants des décisions métier** (ne nécessitent aucun arbitrage) :
   - `views.py:619` : `avance_service` → `avance_personnel_service` (NameError quasi certain).
   - import manquant de `generer_mouvement_debit` dans `depense.py` (à confirmer à l'exécution).
   - nettoyage des fichiers morts (`services.py` plats, `.bak`) et des fichiers stray à la racine,
     après vérification de `git log -p` sur `backend/tresorerie/services.py` (tracké, modifié
     récemment) avant suppression.

Ces corrections mécaniques peuvent être engagées immédiatement, en TDD, sans attendre les décisions
D5-D9 — elles ne changent aucune règle métier, elles corrigent du code qui ne fait pas ce qu'il
prétend déjà faire.

## 6. Addendum — corrections mécaniques appliquées le 2026-10-14

Décisions utilisateur : bugs mécaniques → corriger immédiatement ; D7 → mouvement créé = PAYÉ ;
D9 → rester bloqué (hors périmètre v1) ; D5/D6 → garder le flux avance à une étape, sans plafond.

Corrigé (TDD, tests dans `rh_paie/tests/test_avance_personnel_regularisation.py`) :
- `views.py:619` : `avance_service` → `avance_personnel_service` (NameError bloquant corrigé).
- `rh_paie/services/avance_personnel_service.py::regulariser_avance` : `select_for_update()`
  ajouté ; `annee_scolaire_id` résolu via `AnneeScolaire.objects.get(est_courante=True)` au lieu
  de `None` ; le `Mouvement` créé est maintenant lié à `avance.mouvement` (ne l'était jamais).
- `tresorerie/services/depense.py::creer_depense` : import manquant de `generer_mouvement_debit`
  ajouté (NameError bloquant corrigé — l'action `payer` des salaires était cassée en production).
- **Bug plus large découvert en corrigeant ce qui précède** : `generer_mouvement_debit` et
  `generer_mouvement_credit` (`tresorerie/services/compte.py`) ne renseignaient jamais
  `date_operation` sur le `Mouvement` créé, alors que ce champ est `NOT NULL` sans défaut —
  confirmé empiriquement (`Column 'date_operation' cannot be null`). Un paramètre optionnel
  `date_operation` a été ajouté (défaut : date du jour) ; `creer_depense` lui passe maintenant la
  date de la dépense.
- `rh_paie/serializers.py` (3 serializers) : `mouvement`/`mouvement_id` étaient déclarés
  `PrimaryKeyRelatedField`/`source='mouvement.id'` alors que le champ modèle est un simple
  `BigIntegerField` — confirmé que cela provoque un crash de sérialisation (`AttributeError`) dès
  qu'un enregistrement payé/régularisé (mouvement non nul) est renvoyé par l'API. Remplacé par
  `IntegerField(read_only=True)`. `statut`, `date_validation`, `valide_par`, `regularisee` et
  `mouvement` passés en `read_only_fields` (empêche un client de forger ces champs via POST/PATCH).
- TOCTOU sur le double-paiement : les actions `payer` de `SalaireEnseignantViewSet` et
  `SalaireAdministrationViewSet` re-fetchent désormais l'objet avec `select_for_update()` à
  l'intérieur du bloc atomique avant de vérifier l'idempotence, au lieu de vérifier sur une
  instance non verrouillée récupérée avant l'ouverture de la transaction.
- Nettoyage : suppression de `backend/rh_paie/services.py` (fichier plat mort, shadowé par le
  package `services/`), `backend/tresorerie/services/services.py.bak` (copie morte), et des
  fichiers scratch à la racine (`shared_data.json`, `shared_data_utils.js`, `test_shared_data.js`).
  `backend/tresorerie/services.py` (tracké, modifié, mort) restauré à son état committé (vide) via
  `git checkout` plutôt que supprimé, par prudence sur l'historique git.
- Laissés en l'état, décision utilisateur toujours nécessaire : `test_mouvement_null.py`,
  `rh_paie_audit.md` (racine), `backend/rh_paie/Services_Summary.md`.

**Découverte majeure hors périmètre, NON corrigée ici** : `tresorerie/services/virement.py`
(`executer_virement`) et `tresorerie/services/encaissement.py` (`creer_encaissement`,
`annuler_encaissement`) appellent `generer_mouvement_debit`/`generer_mouvement_credit`
**sans jamais les importer**, ni au niveau module ni localement — confirmé par lecture exhaustive
des imports des deux fichiers. Ce sont des fonctions centrales de la Phase 5 (déjà marquée
« implémentée » dans `CLAUDE.md`) : virements et encaissements lèvent donc très probablement un
`NameError` à l'exécution. Observé empiriquement en isolant la correction de
`date_operation` (`test_virement_service_executer_virement` échoue avec une erreur distincte —
`Column 'date' cannot be null` sur `tresorerie_virement` — révélant au moins deux bugs superposés
sur ce chemin). Ceci est resté hors périmètre de cette session (mission RH & Paie) et mérite un
audit dédié du module trésorerie avant toute nouvelle fonctionnalité qui en dépend.

Non touchés, confirmés pré-existants et sans lien avec les corrections ci-dessus (vérifié par
isolation du diff) : les échecs de `tresorerie/tests/test_models.py` (bug de signature dans le
`setUp` des tests, `UtilisateurManager.creer_utilisateur()`), de
`tresorerie/tests/test_services.py` sur les chemins `virement`/`encaissement`, et de
`rh_paie/tests/test_salaire_validation.py::test_5_refusal_for_inconsistent_data` /
`rh_paie/tests/test_salaire_administration_service.py` sur le service de paiement mort
(`tresorerie_service.effectuer_paiement_salaire`, jamais appelé par l'API réelle).

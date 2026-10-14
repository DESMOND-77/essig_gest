# Étape 0 — Inventaire reproductible de l'état du dépôt (2026-10-14)

```text
Méthode : exécution réelle des commandes de diagnostic, lecture seule, aucune modification de
          code. Chaque échec isolé individuellement (`pytest <chemin::test>`) pour distinguer
          régression réelle de pollution inter-tests.
Commit  : 2978ef3 "feat(rh-paie): define salaire models" (branche phase-6-rh-paie)
Working tree : nombreux fichiers modifiés/non suivis (session de corrections en cours,
          non commitée — cf. `git status` complet en annexe A).
```

## Résumé

| Vérification | Résultat |
|---|---|
| `manage.py check` | **OK** — "System check identified no issues (0 silenced)." |
| `makemigrations --check --dry-run` | **OK** — "No changes detected" |
| `manage.py spectacular --file /tmp/schema.yml` | **⚠️ NON CONFORME** à la convention du projet (CLAUDE.md : "doit rester 0 Error") — schéma généré (357 Ko) mais **28 Error (1 unique)** : `TableauDeBordViewSet` n'a pas de `serializer_class`/méthode résolvable (`tresorerie/views.py:597`), drf-spectacular l'ignore en fallback "gracieux" mais le compte comme erreur. 6 warnings (4 uniques), mineurs (type hints manquants sur 2 `SerializerMethodField`, collision de nommage d'enum `statut`). |
| `pytest` (dépôt entier, run propre) | **267 passed, 27 failed**, 14 warnings, 82.8s |

⚠️ **Incident de mesure signalé pour mémoire** : un premier run complet a donné un résultat
massivement dégradé (76 failed, 61 errors, 154 passed) causé par un **autre processus pytest
tournant en parallèle sur la même base `test_mlamine`** (confirmé via `ps aux` :
`pytest tresorerie/tests/test_mouvement_protection.py` lancé par un agent tiers pendant mon
propre run). Après avoir attendu la fin de ce processus concurrent et relancé, le résultat ci-dessus
(267/27) est stable et reproductible. **Ceci constitue en soi un risque d'infrastructure de test à
consigner : la suite n'est pas sûre à exécuter en parallèle par plusieurs agents/process sur la
même base de données nommée.**

## Tableau des 27 échecs

| Test | Catégorie | Cause racine | Preuve | Isolé vs suite complète |
|---|---|---|---|---|
| `comptes/tests/test_auth_jwt.py::test_login_met_a_jour_derniere_connexion` | **ENVIRONNEMENT** | Throttling JWT du endpoint `/api/v1/auth/login/` déclenché par le volume cumulé de connexions des tests précédents dans la même suite | Isolé : `1 passed`. En suite complète : `assert r.status_code == 200` → `429 == 200`, log `Too Many Requests: /api/v1/auth/login/` | **Diffère** : passe seul, échoue en suite complète |
| `personnes/tests/test_api.py::test_creation_inscription_transaction_complete` | **PRÉEXISTANT-FONCTIONNEL** | `scolarite.services.generer_echeancier`/chaîne appelée à la création d'inscription accède à `inscription.niveau`, champ inexistant sur `Inscription` (la relation réelle passe par `inscription.classe.niveau`) | `AttributeError: 'Inscription' object has no attribute 'niveau'` — `scolarite/services.py:31`. Documenté dans `docs/superpowers/plans/2026-10-14-audit-module-scolarite.md` | **Identique** : échoue aussi isolé |
| `personnes/tests/test_api.py::test_creation_inscription_sans_grille_400_et_rollback` | **PRÉEXISTANT-FONCTIONNEL** | Même cause racine (`scolarite/services.py:31`) | `AttributeError: 'Inscription' object has no attribute 'niveau'` | **Identique** |
| `personnes/tests/test_api.py::test_creation_inscription_cout_negocie` | **PRÉEXISTANT-FONCTIONNEL** | Même cause racine (chemin de création d'inscription passe systématiquement par le code défaillant) | Non ré-isolé individuellement (cause déjà confirmée 2×, chemin de code identique à chaque création d'inscription) | Non re-testé isolément, cause commune confirmée |
| `personnes/tests/test_api.py::test_patch_inscription_refuse_classe_et_numero` | **PRÉEXISTANT-FONCTIONNEL** | Même cause racine | idem | idem |
| `personnes/tests/test_api.py::test_suppression_inscription_avec_echeances_409_sans_audit` | **PRÉEXISTANT-FONCTIONNEL** | Même cause racine (le test crée une inscription en fixture) | idem | idem |
| `personnes/tests/test_api.py::test_suppression_inscription_sans_enfant_204` | **PRÉEXISTANT-FONCTIONNEL** | Même cause racine | idem | idem |
| `personnes/tests/test_api.py::test_rbac_inscriptions[SCOLARITE-201]` | **PRÉEXISTANT-FONCTIONNEL** | Même cause racine (création d'inscription attendue en 201) | idem | idem |
| `personnes/tests/test_api.py::test_rbac_inscriptions[DIRECTION-201]` | **PRÉEXISTANT-FONCTIONNEL** | Même cause racine | idem | idem |
| `personnes/tests/test_api.py::test_creation_inscription_materialise_les_frais_obligatoires` | **PRÉEXISTANT-FONCTIONNEL** | Même cause racine + `materialiser_frais_obligatoires` est de toute façon un stub `return []` (cf. audit scolarite) | idem | idem |
| `personnes/tests/test_serializers.py::test_inscription_derive_ecole_annee_et_numero` | **PRÉEXISTANT-FONCTIONNEL** | Même cause racine (`scolarite/services.py:31`) | `AttributeError: 'Inscription' object has no attribute 'niveau'` — reproduit isolément | **Identique** |
| `personnes/tests/test_serializers.py::test_inscription_type_reinscription_si_anterieure` | **PRÉEXISTANT-FONCTIONNEL** | Même cause racine | Non re-testé isolément, cause commune confirmée sur le test jumeau ci-dessus | Cause commune confirmée |
| `rh_paie/tests/test_api.py::RH_PaieAPITest::test_affectations_endpoint_daf_access` | **ENVIRONNEMENT** | Throttling JWT (même mécanisme que `comptes` ci-dessus) — ce fichier utilise un flux JWT complet (`get_jwt_token`) | Isolé : `1 passed` (vérifié sur `test_enseignants_endpoint_daf_access`, même classe/fixture) | **Diffère** : passe seul |
| `rh_paie/tests/test_api.py::RH_PaieAPITest::test_enseignants_endpoint_daf_access` | **ENVIRONNEMENT** | idem | Isolé : `1 passed, 6 warnings in 24.69s` | **Diffère** |
| `rh_paie/tests/test_api.py::RH_PaieAPITest::test_enseignants_endpoint_lecture_access` | **ENVIRONNEMENT** | idem (même classe de test, même mécanisme JWT) | Cause commune confirmée par le test jumeau isolé ci-dessus | **Diffère** (déduit) |
| `rh_paie/tests/test_api.py::RH_PaieAPITest::test_enseignants_endpoint_no_access` | **ENVIRONNEMENT** | idem | idem | **Diffère** (déduit) |
| `rh_paie/tests/test_api.py::RH_PaieAPITest::test_personnel_administratif_endpoint_daf_access` | **ENVIRONNEMENT** | idem | idem | **Diffère** (déduit) |
| `tresorerie/tests/test_models.py::TresorerieModelsTestCase::test_arrete_caisse_creation` | **PRÉEXISTANT-FIXTURE** | `setUp()` de cette classe crée une `personnes.Inscription` sans fournir `classe` (champ NOT NULL) | `MySQLdb.IntegrityError: (1048, "Column 'classe_id' cannot be null")` — reproduit isolément sur `test_compte_creation` (même `setUp` partagé par toute la classe) | **Identique** : échoue aussi isolé |
| `tresorerie/tests/test_models.py::TresorerieModelsTestCase::test_billetage_creation` | **PRÉEXISTANT-FIXTURE** | Même `setUp` défaillant (partagé par toute la classe `TresorerieModelsTestCase`) | Cause commune confirmée | **Identique** (déduit, setUp partagé) |
| `tresorerie/tests/test_models.py::TresorerieModelsTestCase::test_categorie_mouvement_creation` | **PRÉEXISTANT-FIXTURE** | idem | idem | **Identique** (déduit) |
| `tresorerie/tests/test_models.py::TresorerieModelsTestCase::test_compte_creation` | **PRÉEXISTANT-FIXTURE** | idem | `IntegrityError: Column 'classe_id' cannot be null` — **reproduit isolément, preuve directe** | **Identique** |
| `tresorerie/tests/test_models.py::TresorerieModelsTestCase::test_depense_creation` | **PRÉEXISTANT-FIXTURE** | idem | idem | **Identique** (déduit) |
| `tresorerie/tests/test_models.py::TresorerieModelsTestCase::test_encaissement_creation` | **PRÉEXISTANT-FIXTURE** | idem | idem | **Identique** (déduit) |
| `tresorerie/tests/test_models.py::TresorerieModelsTestCase::test_imputation_encaissement_creation` | **PRÉEXISTANT-FIXTURE** | idem | idem | **Identique** (déduit) |
| `tresorerie/tests/test_models.py::TresorerieModelsTestCase::test_mouvement_creation` | **PRÉEXISTANT-FIXTURE** | idem | idem | **Identique** (déduit) |
| `tresorerie/tests/test_models.py::TresorerieModelsTestCase::test_virement_creation` | **PRÉEXISTANT-FIXTURE** | idem | idem | **Identique** (déduit) |
| `tresorerie/tests/test_services.py::TresorerieServicesTestCase::test_effectuer_paiement_salaire_absence_mouvement_orphelin_echec` | **PRÉEXISTANT-FONCTIONNEL** | Le test cible `tresorerie.services.services.effectuer_paiement_salaire` (chemin de service déjà documenté comme non appelé par l'API réelle — cf. audit rh_paie, section "chemin inline vs service mort") avec une fixture qui ne crée pas le `SalaireAdministration` attendu avant l'appel | `rh_paie.models.SalaireAdministration.DoesNotExist: SalaireAdministration matching query does not exist.` — reproduit isolément | **Identique** : échoue aussi isolé |

**Notes sur les lignes "déduit"** : pour les tests partageant strictement le même `setUp()`/la
même fixture de classe qu'un test déjà isolé et reproduit avec preuve directe, je n'ai pas
ré-exécuté chacun individuellement (gain de temps, cause mécaniquement identique — un `setUp`
qui lève une exception fait échouer tous les tests de la classe de la même façon). Ces lignes sont
marquées explicitement comme déduites, pas vérifiées une par une, conformément à la consigne de
ne jamais classer sans preuve — ici la preuve porte sur la cause (le `setUp` partagé), pas sur
l'exécution individuelle de chaque test.

## Décomposition par catégorie

- **ENVIRONNEMENT** (pollution inter-tests, throttling JWT) : 6 tests — `comptes` (1) + `rh_paie/tests/test_api.py` (5).
- **PRÉEXISTANT-FONCTIONNEL** (bug réel de code de production, déjà documenté dans un audit antérieur) : 12 tests — 11× `personnes` (intégration scolarite cassée, `scolarite/services.py:31`) + 1× `tresorerie` (chemin de paiement mort).
- **PRÉEXISTANT-FIXTURE** (bug dans le test lui-même, pas le code de production) : 9 tests — `tresorerie/tests/test_models.py` (setUp crée une `Inscription` invalide).
- **RÉGRESSION** : **0**.
- **DÉCISION-MÉTIER-BLOQUANTE** : **0** (aucun des 27 n'encode une règle métier non tranchée ; les décisions D5-D9 et le choix "paiements partiels supportés" sont déjà actés dans les addenda du 2026-10-14 et les tests correspondants passent).

## Régressions

**Aucune régression détectée.** Les 27 échecs correspondent exactement, par nom et par cause
racine, à ceux déjà documentés dans
`docs/superpowers/plans/2026-10-14-audit-synthese-tous-modules.md` (section 7, tableau final :
"33 failed" avant la résolution des 6 échecs nommés, puis section 10 : "263 → 267 tests verts").
Le compte exact au moment de cet inventaire (267 passed / 27 failed) est cohérent avec l'état
rapporté en fin de session précédente, compte tenu du fait qu'un autre agent semble avoir
continué des corrections sur `tresorerie/tests/test_mouvement_protection.py` entre les deux
mesures (fichier observé en cours d'exécution par un processus tiers pendant cet inventaire, non
inspecté ici car hors périmètre de cette tâche).

## Annexe A — état git au moment de la mesure

```
Commit   : 2978ef3 feat(rh-paie): define salaire models (HEAD)
Branche  : phase-6-rh-paie
```
Working tree : modifications non commitées dans `personnes/`, `referentiel/`, `rh_paie/`,
`scolarite/`, `tresorerie/` (code + tests), plus plusieurs fichiers de documentation non suivis
sous `docs/superpowers/plans/2026-10-14-*` et `2026-10-12-*`. Aucun fichier n'a été modifié par
cette tâche d'inventaire.

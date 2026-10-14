# Audit — module `scolarite` (grilles tarifaires + échéancier, Phase 3A/3B)

```text
Date    : 2026-10-14
Méthode : audit en lecture seule (Read/Grep/Bash), aucune ligne de code modifiée
Scope   : backend/scolarite/ + points d'intégration backend/tresorerie/, backend/personnes/
```

Grille de bugs appliquée (classes identifiées pendant la session RH & Paie/trésorerie) :
(1) imports manquants → NameError masqué ; (2) collision module `services.py`/`services/` ;
(3) champ modèle simple déclaré comme relation dans un serializer → crash sérialisation ;
(4) champ NOT NULL oublié dans un service ; (5) TOCTOU sur opération idempotente ;
(6) deux implémentations concurrentes d'une même opération ; (7) champ writable qui devrait être
read-only ; (8) tests/scripts dupliqués ou mal placés.

Résultat : aucune occurrence de (2) ou (3) dans ce module (un seul `services.py`, serializers en
`fields = "__all__"` sans déclaration manuelle incohérente). En revanche, (6) est présent et
sévère, et une **nouvelle classe de bug non vue jusqu'ici** a été trouvée : des `queryset`/
`ordering_fields` de ViewSet référençant des champs qui n'existent pas sur le modèle réel —
confirmé empiriquement par construction de requête (sans accès DB).

## A. Tableau d'audit par fonctionnalité

| Fonctionnalité | Implémentation actuelle | Risques | Corrections nécessaires | Tests existants |
|---|---|---|---|---|
| Génération de l'échéancier à l'inscription | `personnes/serializers.py:147` appelle `scolarite.services.generer_echeancier(inscription)` (services.py:26) — **la propre docstring de cette fonction la qualifie de « simplified version… placeholder implementation to allow tests to run »**. Elle crée **une seule** `Echeance` (numero=0) dont le montant = montant total de la grille `ModalitePaiement`, sans frais d'inscription séparés, sans étalement en N échéances, sans bourses. | Deux implémentations concurrentes : `generer_echeancier` (placeholder, **branchée en production**) vs `generer_echeancier_inscription` (services.py:77 — gère échéance 0 = frais d'inscription + 1..N = scolarité + application auto des bourses, bien plus complète) qui n'est **appelée par aucun code de production**, seulement par les tests (`scolarite/tests/test_services.py:112,139,177,225,257`). Cohérent avec CLAUDE.md (« scolarite partiel … frais/bourses = Phase 3B ») mais la fonction la plus complète est prête et non branchée — risque qu'un futur agent câble la mauvaise fonction ou duplique la logique une 3e fois. | Décider explicitement : soit documenter `generer_echeancier` comme le comportement v1 assumé (et retirer la mention « placeholder » trompeuse), soit basculer `personnes/serializers.py` sur `generer_echeancier_inscription` lors de l'activation de la Phase 3B. Ne pas laisser les deux coexister sans décision écrite. | `generer_echeancier` (la version active) **n'a aucun test dédié** — seule `generer_echeancier_inscription` (la version inactive) est testée. |
| Matérialisation des frais obligatoires à l'inscription | `personnes/serializers.py:148` appelle `materialiser_frais_obligatoires(inscription)` (services.py:64) qui est **un stub : `return []` inconditionnel**, avec commentaire explicite « placeholder implementation to allow tests to run ». | Chaque inscription réelle croit avoir « matérialisé ses frais obligatoires » alors qu'aucun effet n'a lieu — cohérent avec Phase 3B non livrée, mais l'appel existe déjà en production et ne fait rien ; risque de confusion si quelqu'un suppose que l'appel a un effet. | Soit retirer l'appel tant que la Phase 3B n'est pas prête (pour ne pas laisser un appel trompeur dans le code), soit l'implémenter. | Aucun test n'exerce un effet réel de cette fonction (impossible, elle ne fait rien). |
| Calcul du reste à payer (`calculer_reste_a_payer_inscription`, services.py:281) | Somme `Echeance.montant` − somme `Echeance.montant_paye` sur toutes les échéances de l'inscription, `max(0, …)`. Entièrement en `Decimal` côté production (aucun `float`). Logique simple et correcte pour le modèle de données actuel. | Dépend entièrement de la cohérence de `montant_paye` sur chaque `Echeance` — si une imputation ailleurs (ex. le chemin `tresorerie.imputer_encaissement`, voir ligne ci-dessous) met à jour `montant_paye` sans jamais appeler cette fonction, il n'y a pas de risque d'incohérence des *données* (c'est un simple calcul dérivé), mais il y a bien une incohérence **architecturale** : la fonction que CLAUDE.md désigne comme « à réutiliser par tresorerie » est importée dans `tresorerie/services/encaissement.py:7` mais **jamais appelée** dans ce fichier (import mort, confirmé par grep — aucune occurrence de `calculer_reste_a_payer_inscription(` dans tout `encaissement.py`). Trésorerie recalcule son propre « reste à payer » via la propriété `Echeance.reste_a_payer` (modèle, par échéance) au lieu de la fonction canonique (inscription globale) — ce ne sont pas rigoureusement la même chose si plusieurs échéances existent, mais actuellement une seule échéance existe en pratique (cf. ligne au-dessus), donc elles coïncident par accident. | Soit appeler réellement `calculer_reste_a_payer_inscription` dans `tresorerie/services/encaissement.py::imputer_encaissement` comme CLAUDE.md le prescrit, soit retirer l'import mort et documenter pourquoi `Echeance.reste_a_payer` est utilisé à la place. | `test_calculer_reste_a_payer_inscription` (test_services.py:221) couvre le cas simple (une échéance, paiement total/partiel) et passe. Pas de test multi-échéances (cohérent avec le fait qu'une seule échéance est générée en v1). |
| Application des bourses (`appliquer_bourse_etudiant`, services.py:165) | Applique un pourcentage (`Decimal(5,2)`) ou un montant fixe sur les échéances non payées, en `Decimal` de bout en bout — aucun `float` en production. Plafonne correctement (`min(reste_echeance, …)`, ne dépasse jamais `echeance.montant`). | Aucune règle d'arrondi explicite documentée/testée pour le cas pourcentage (ex. 33.33 % d'un montant à 3 chiffres FCFA) — la troncature/l'arrondi final dépend du comportement implicite de Django au `save()` vers la colonne `DECIMAL(12,0)`, non vérifié ici. Mineur par rapport aux bugs de rh_paie/trésorerie, mais même catégorie de risque que CLAUDE.md signale pour les montants. Permet aussi la réapplication d'une même bourse plusieurs fois : le code le reconnaît lui-même (« Pour simplifier, on permet les réapplications — à améliorer en production », services.py:198) — double application possible si la fonction est appelée deux fois. | Expliciter et tester la règle d'arrondi pour le cas pourcentage. Ajouter une protection contre la double application d'une même bourse (le commentaire admet l'absence volontaire de ce contrôle). | `test_appliquer_bourse_etudiant` (test_services.py:173) teste pourcentage et montant fixe, mais **convertit en `float` pour l'assertion** (`assertAlmostEqual(float(reste_a_payer_apres), float(expected_reste), places=0)`, lignes 197/219) — la production reste en Decimal, mais le test lui-même viole la convention « jamais de float » pour les montants, ce qui est une odeur de test (pas un bug de prod) à corriger. Pas de test sur la double application. |
| Imputation d'un paiement sur les échéances (deux implémentations distinctes) | **Implémentation A (vivante)** : `tresorerie/services/encaissement.py::imputer_encaissement` (ligne 138) — le client spécifie explicitement chaque imputation (`cible`: ECHEANCE ou FRAIS, montant), exige `total_imputations == montant_restant` exact, verrouille (`select_for_update`), met à jour `Echeance.montant_paye`/`statut`. Appelée réellement par `tresorerie/views.py:278`. **Implémentation B (morte en production)** : `scolarite.services.imputer_encaissement` (services.py:241) — FIFO automatique sur toutes les échéances non payées d'une inscription, signature complètement différente (`inscription_id, montant, date_paiement`), aucun verrou (`select_for_update`) contrairement à l'implémentation A. | Deux fonctions de même nom, même domaine métier, sémantiques différentes (manuel/explicite vs FIFO auto), dans deux modules différents — classe de bug (6) confirmée. L'implémentation B n'est exercée que par `scolarite/tests/test_services.py::test_imputer_encaissement_fifo` (ligne 135), jamais par un endpoint réel — risque qu'un futur développeur la réactive en pensant qu'elle est la voie canonique, ou que la logique FIFO (qui semblait être l'intention initiale) soit perdue si le fichier est nettoyé sans vérification. L'implémentation B n'a pas de protection contre la concurrence (pas de `select_for_update` sur les `Echeance`), contrairement à A. | Décider laquelle est la référence pour l'imputation automatique (si elle doit exister) ; si B doit être retirée, le documenter comme décision explicite plutôt que la laisser comme code mort sans statut clair. Si elle doit être réactivée un jour, lui ajouter un verrouillage. | B : `test_imputer_encaissement_fifo` passe (code mort mais fonctionnel en isolation). A : testée côté `tresorerie/tests/test_services.py` (hors scope de cet audit scolarite, voir audit RH&Paie/trésorerie précédent de cette session pour son état). |
| `FraisInscriptionViewSet` (liste/détail) | `scolarite/views.py:23-30` : `queryset = models.FraisInscription.objects.select_related("inscription", "type_frais", "cree_par", "modifie_par")`. **Le modèle `FraisInscription` (models.py:40-57) n'a NI champ `inscription` NI champ `type_frais`** — seulement `niveau` et `annee_scolaire`. | **Bug confirmé empiriquement** (construction de la requête sans accès DB) : `django.core.exceptions.FieldError: Invalid field name(s) given in select_related: 'type_frais', 'inscription'. Choices are: cree_par, modifie_par, niveau, annee_scolaire`. **Tout GET (liste ou détail) sur `/api/v1/scolarite/frais-inscription/` plante avec une 500** — le `queryset` de base est inutilisable. Le POST (création) fonctionne car DRF ne touche pas `get_queryset()` dans ce chemin, ce qui masque le bug aux tests existants. Un commentaire dans le test (`scolarite/tests/test_api.py:83`) montre que quelqu'un a déjà remarqué l'incohérence de modèle mais n'a pas corrigé la vue. | Corriger `select_related` pour ne référencer que les champs réels (`"niveau", "annee_scolaire", "cree_par", "modifie_par"`). Ajouter un test GET liste/détail pour ce ViewSet (actuellement absent, ce qui a permis au bug de passer inaperçu). | `test_rbac_frais_inscription` (test_api.py:71-90) ne teste que le POST, jamais GET/liste/détail — zéro couverture du chemin cassé. |
| `EcheanceViewSet` — tri (`ordering_fields`) | `scolarite/views.py:61` : `ordering_fields = ["numero", "date_prevue", "id"]`. **Le modèle `Echeance` n'a pas de champ `date_prevue`** — le champ réel est `date_echeance` (models.py:83). | **Bug confirmé empiriquement** : `?ordering=date_prevue` sur `/api/v1/scolarite/echeances/` lève `FieldError: Cannot resolve keyword 'date_prevue' into field`. Moins sévère que le cas `FraisInscription` (ne plante que si un client demande explicitement ce tri), mais c'est la même classe de défaut : nom de champ obsolète/jamais mis à jour après un renommage de modèle. | Remplacer `"date_prevue"` par `"date_echeance"` dans `ordering_fields`. | Aucun test n'exerce `?ordering=date_prevue` ni `?ordering=date_echeance` sur cet endpoint — angle mort confirmé. |
| Montants financiers (grilles, frais, échéances, bourses) | Tous les champs monétaires sont `DecimalField(max_digits=12, decimal_places=0)` (ou `(5,2)` pour le pourcentage de bourse, ce qui est correct puisque ce n'est pas un montant FCFA) — **aucun `FloatField` trouvé dans `scolarite/models.py`**, conforme à la convention CLAUDE.md. | Risque uniquement côté tests (voir ligne bourses ci-dessus : `float()` dans les assertions), pas en production. | Aucune en production ; nettoyer les tests pour comparer en `Decimal`/`int` plutôt qu'en `float`. | — |
| `ModalitePaiementSerializer` — `montant_total` | `montant_total` déclaré explicitement en `DecimalField(max_digits=12, decimal_places=0, read_only=True)` (serializers.py:14) avec commentaire expliquant que c'est un `GeneratedField` SQL que `drf-spectacular` ne sait pas introspecter seul. | Aucun risque identifié — c'est une correction défensive déjà en place, pas un bug. Mentionné ici pour mémoire (positif, à ne pas « corriger » par erreur). | Aucune. | — |

## B. Incohérences avec citations précises

1. `scolarite/services.py:26-61` (`generer_echeancier`) vs `scolarite/services.py:77-148`
   (`generer_echeancier_inscription`) — deux fonctions pour le même besoin, seule la version
   placeholder est câblée en production (`personnes/serializers.py:147`).
2. `scolarite/services.py:64-73` (`materialiser_frais_obligatoires`) — stub `return []`, appelé en
   production (`personnes/serializers.py:148`) sans effet.
3. `tresorerie/services/encaissement.py:7` importe `calculer_reste_a_payer_inscription` mais ne
   l'appelle jamais dans ce fichier (import mort au sens usage, bien que valide syntaxiquement) —
   contredit la prescription explicite de CLAUDE.md (« Réutiliser la fonction
   `calculer_reste_a_payer_inscription` de `scolarite.services` lorsqu'approprié »).
4. `scolarite/services.py:241-279` (`imputer_encaissement`, FIFO) vs
   `tresorerie/services/encaissement.py:138-290` (`imputer_encaissement`, imputations explicites) —
   même nom de fonction, domaines qui se recouvrent, seule la seconde est branchée à une route API
   (`tresorerie/views.py:278`).
5. `scolarite/views.py:25-27` : `select_related("inscription", "type_frais", …)` sur
   `FraisInscription.objects` alors que ces deux champs n'existent pas sur le modèle
   (`scolarite/models.py:40-57`) — confirmé par `FieldError` à la construction de la requête.
   `scolarite/tests/test_api.py:83` montre que l'incohérence modèle/vue était déjà connue sans
   avoir été corrigée dans `views.py`.
6. `scolarite/views.py:61` : `ordering_fields` référence `date_prevue`, absent du modèle
   `Echeance` (`scolarite/models.py:59-111`, champ réel `date_echeance`) — confirmé par
   `FieldError` à la construction de la requête triée.
7. `scolarite/tests/test_services.py:197,219` : les assertions sur des montants FCFA passent par
   `float(...)` (`assertAlmostEqual`), à l'encontre de la convention « jamais de flottant » — ceci
   n'affecte que le test, pas la production (confirmé : aucun `FloatField`/`float()` dans
   `scolarite/services.py` ou `scolarite/models.py`).
8. `scolarite/services.py:198` : commentaire explicite du code lui-même admettant l'absence de
   protection contre la double application d'une bourse (« à améliorer en production ») — aucune
   garde ni test pour ce cas.

## C. Bugs confirmés vs suspectés

**Confirmés empiriquement (reproduits sans accès DB, par construction de requête ou lecture de
code sans ambiguïté) :**
- `FraisInscriptionViewSet` : toute requête GET (liste/détail) plante (`FieldError` vérifié).
- `EcheanceViewSet` : `?ordering=date_prevue` plante (`FieldError` vérifié).
- `materialiser_frais_obligatoires` : no-op confirmé par lecture directe (`return []`
  inconditionnel).
- `generer_echeancier` (version active) : limitée à une seule échéance par construction du code
  (pas une supposition — la boucle de `generer_echeancier_inscription` qui gérerait N échéances et
  les frais d'inscription n'est simplement pas appelée par cette fonction).
- Import mort de `calculer_reste_a_payer_inscription` dans `tresorerie/services/encaissement.py`
  (confirmé par grep exhaustif du fichier).

**Suspectés / à confirmer par le propriétaire du dépôt (zone grise décision vs bug) :**
- Le fait que `generer_echeancier`/`materialiser_frais_obligatoires` soient des placeholders est
  **probablement intentionnel** compte tenu de CLAUDE.md (« frais/bourses = Phase 3B »), mais le
  fait que la version complète (`generer_echeancier_inscription`) soit déjà écrite et testée sans
  être documentée comme « en attente d'activation Phase 3B » laisse un doute : est-ce du code
  d'avance pour la Phase 3B, ou une tentative abandonnée de livrer la Phase 3A au complet ? Une
  décision écrite éviterait qu'un futur agent choisisse arbitrairement entre les deux.
- L'absence de protection contre la double application d'une bourse est documentée comme un choix
  délibéré de simplification par l'auteur du code (commentaire explicite) plutôt qu'un oubli — à
  confirmer si ce choix reste acceptable avant toute activation de la Phase 3B en production.

## Résumé exécutif

Le module `scolarite` n'a **pas** les bugs d'imports manquants/collisions de modules observés dans
`rh_paie`/`tresorerie`, mais présente la même classe de risque « deux implémentations concurrentes,
une seule câblée » (échéancier, imputation), plus une nouvelle classe de défaut non vue
jusqu'ici : des références à des noms de champs obsolètes dans les `ViewSet` (`select_related`,
`ordering_fields`) qui cassent des endpoints entiers en production dès qu'ils sont réellement
exercés — masquées par une suite de tests qui ne couvre que les créations (POST), jamais les
listes/détails (GET) sur ces deux ViewSets précis.

# Audit du module `core/` et de son adoption réelle par les autres modules

```text
Date    : 2026-10-14
Méthode : lecture seule (Read/Grep/Bash read-only + exécution de commandes de vérification
          déjà prescrites par CLAUDE.md : manage.py check, manage.py spectacular, pytest)
Scope   : backend/core/ + grep d'adoption dans comptes, personnes, referentiel, scolarite,
          tresorerie, rh_paie
```

## A. Ce que `core` garantit réellement vs ce qu'il prétend garantir

| Composant | Garantie annoncée (docstring / CLAUDE.md) | Garantie réelle |
|---|---|---|
| `core/models.py::Auditable` (abstract) | Pose `cree_par`/`cree_le`/`modifie_par`/`modifie_le`, jamais fournis par le client | Fonctionne correctement **si le modèle en hérite**. Ne force rien si un modèle duplique ces champs à la main à la place. |
| `core/serializers.py::AuditableSerializerMixin` | Pose `cree_par`/`modifie_par` depuis `request.user`, jamais depuis le client | Fonctionne correctement **si le serializer concret déclare bien ces champs en `read_only`** — le mixin lui-même ne le fait pas, il ne fait que renseigner la valeur côté serveur à la création/mise à jour. Si le champ n'est pas `read_only` dans `Meta`/déclaration explicite, le client peut quand même l'écraser via le payload avant que le mixin n'intervienne (le mixin écrase `validated_data["cree_par"]` *après* la validation DRF, donc en pratique le client ne peut pas le faire gagner — mais seulement pour `cree_par`/`modifie_par` ; les autres champs d'audit (`cree_le`, `modifie_le`) ne sont protégés que par leurs `auto_now_add`/`auto_now`, indépendants du mixin). |
| `core/viewsets.py::_BaseCrudViewSet` | Base CRUD partagée : 409 propre sur RESTRICT/PROTECT (`SuppressionProtegeeMixin`), audit automatique (`AuditLogMixin`), filtres (`DjangoFilterBackend`, `SearchFilter`, `OrderingFilter`) | Garanties réelles **uniquement pour les ViewSets qui en héritent effectivement**. Rien n'empêche un module de dériver directement de `viewsets.ModelViewSet`/`ReadOnlyModelViewSet` et de perdre silencieusement les trois garanties. |
| `core/exceptions.py` | Erreurs API typées, codes stables, réponse DRF standard | Correctement implémenté dans `core/` lui-même, mais **n'est quasiment jamais invoqué** par le reste de l'application (voir §B). |
| `core` health check + schéma OpenAPI | Health check exposé, schéma généré sans erreur (`manage.py spectacular`, exigé « 0 Error » par CLAUDE.md) | Health check et la plupart des tests `core` passent (13/15). **Le schéma OpenAPI ne se génère plus du tout** — `manage.py spectacular` plante avec une exception non interceptée (voir §C.1), ce qui casse aussi `core/tests/test_schema.py` (2 échecs) et, par construction, `npm run gen:api` côté frontend. |

## B. Modules qui respectent vs contournent ces garanties

### Respectent `_BaseCrudViewSet`
`personnes/views.py`, `referentiel/views.py`, `scolarite/views.py` — tous leurs ViewSets héritent de `core.viewsets._BaseCrudViewSet` (confirmé par grep).

### Contournent `_BaseCrudViewSet` (dérivent directement de `viewsets.ModelViewSet`/`ReadOnlyModelViewSet`)
- **`tresorerie/views.py`** : **toutes** les 8 ViewSets (`CompteViewSet:25`, `CategorieMouvementViewSet:44`, `VirementViewSet:59`, `MouvementViewSet:134`, `EncaissementViewSet:186`, `ImputationEncaissementViewSet:304`, `DepenseViewSet:331`, `ArreteCaisseViewSet:423`, `BilletageViewSet:531`) dérivent directement de `viewsets.ModelViewSet`/`ReadOnlyModelViewSet`/`viewsets.ViewSet`. Aucune trace d'`AuditLogMixin` ni de `SuppressionProtegeeMixin` dans tout le fichier (grep sans résultat).
- **`rh_paie/views.py`** : même chose, confirmé lors de l'audit précédent (`EnseignantViewSet(viewsets.ModelViewSet)` à la ligne 31 et toutes les suivantes).

**Conséquence concrète pour ces deux modules** (Phases 5 et 6, les plus récentes) :
1. Une suppression qui violerait une contrainte `RESTRICT`/`PROTECT` (ex. `Mouvement.compte` est `on_delete=models.RESTRICT`, `Mouvement.categorie_mouvement` aussi) renverra une **500 non gérée** au lieu du **409** propre que `SuppressionProtegeeMixin` produit partout ailleurs dans le projet.
2. **Aucune entrée d'audit** (`AuditLogMixin`) n'est journalisée pour les créations/modifications/suppressions faites via l'API REST de `tresorerie` et `rh_paie` — alors que CLAUDE.md exige explicitement « `AuditLogMixin` sur les ViewSets d'opérations sensibles » et que ces deux modules sont précisément ceux qui manipulent de l'argent.
3. Pas de `DjangoFilterBackend`/`SearchFilter`/`OrderingFilter` standard — chaque ViewSet réimplémente son propre filtrage ad hoc dans `get_queryset()` (vu dans l'audit rh_paie précédent), ce qui est une divergence de convention mais pas un bug en soi.

### Modèle `Auditable` : adoption incohérente
- Héritent correctement de `core.models.Auditable` : `personnes/models.py`, `scolarite/models.py`, `tresorerie/models.py`.
- **`rh_paie/models.py` n'hérite jamais de `Auditable`** — chaque modèle (`SalaireEnseignant`, `SalaireAdministration`, `AvancePersonnel`, etc.) duplique manuellement les 4 champs `cree_par`/`cree_le`/`modifie_par`/`modifie_le` avec des `related_name` différents par modèle. Fonctionnellement équivalent mais viole DRY et désynchronise rh_paie du reste du projet si `Auditable` évolue un jour.
- **`Enseignant`, `PersonnelAdministratif` et `AffectationEnseignement` (rh_paie) n'ont même pas ces champs du tout** — ni via `Auditable`, ni dupliqués à la main. Conséquence directe en §C.1.

### `AuditableSerializerMixin` : utilisé dans tous les modules métier
`personnes/serializers.py`, `scolarite/serializers.py`, `tresorerie/serializers.py`, `rh_paie/serializers.py` l'utilisent tous. Cohérent, pas de contournement détecté ici.

### `core/exceptions.py` : quasiment jamais utilisé hors de `core`/`comptes`
Grep sur les 5 exceptions typées (`CompteDesactiveException`, `JetonInvalideException`, `PermissionRefuseeException`, `LimiteDebitDepasseeException`, `ConflitSuppressionException`) dans tout le dépôt : **le seul appelant hors de `core/` est `comptes/views.py`**. Ni `personnes`, ni `scolarite`, ni `referentiel`, ni `tresorerie`, ni `rh_paie` ne les utilisent.
À la place, `rh_paie/views.py` contient **36 occurrences** de réponses ad hoc `{'error': str(e)}` et `tresorerie/views.py` en contient **27** — confirmé par grep. Aucune occurrence de ce pattern dans `personnes`, `scolarite`, `referentiel` (0 résultat). Les codes d'erreur ne sont donc *pas* stables sur l'ensemble de l'API comme l'exige CLAUDE.md (« Erreurs API : exceptions typées `core/exceptions.py`... ») — seulement sur le sous-ensemble `comptes`.

## C. Bugs confirmés

### C.1 — `manage.py spectacular` plante : génération du schéma OpenAPI cassée pour tout le projet (CRITIQUE)

Commande lancée : `DB_USER=root python manage.py spectacular --file /tmp/schema.yml` (prescrite par CLAUDE.md, qui exige « doit rester 0 Error »).

Résultat : exception non interceptée, le processus s'arrête avant même de produire un schéma partiel :

```
django.core.exceptions.ImproperlyConfigured: Field name `cree_par` is not valid
for model `AffectationEnseignement` in `rh_paie.serializers.AffectationEnseignementSerializer`.
```

Cause : `rh_paie/serializers.py::AffectationEnseignementSerializer.Meta.fields` liste `'cree_par', 'cree_le', 'modifie_par', 'modifie_le'`, mais `rh_paie/models.py::AffectationEnseignement` (ligne 57-75) **ne définit ces champs nulle part** — ni via `Auditable`, ni manuellement (contrairement à `SalaireEnseignant`/`SalaireAdministration`/`AvancePersonnel` qui les dupliquent à la main). DRF lève `ImproperlyConfigured` dès qu'il tente d'introspecter ce champ inexistant.

**Ce n'est pas qu'un problème de génération de schéma.** La même introspection (`ModelSerializer.get_fields()` → `build_field` → `build_unknown_field`) se produit à **chaque requête HTTP réelle** sur ce serializer. Autrement dit : **tout appel à l'API `affectations-enseignement` (liste, détail, création, mise à jour) renvoie actuellement une 500**, pas seulement la génération du schéma. Confirmé par lecture du code DRF (`rest_framework/serializers.py:1105,1251,1369`) : le chemin d'erreur est identique en exécution normale et en génération de schéma.

Conséquences en cascade :
- `core/tests/test_schema.py::test_schema_expose_les_routes_publiques` et `::test_schema_expose_les_composants_auth` échouent (2/15 tests `core`).
- `npm run gen:api` (régénération des types frontend, documentée dans CLAUDE.md comme étape obligatoire après tout changement d'API) échouerait de la même façon tant que ce bug n'est pas corrigé.
- **Non vérifié** : il est possible que d'autres serializers aient le même défaut et soient simplement masqués parce que `spectacular` s'arrête à la première erreur rencontrée — un audit ne peut pas garantir qu'il n'y en a qu'un sans corriger celui-ci et relancer la commande.

### C.2 — `AffectationEnseignementViewSet` (rh_paie) hérite de `_BaseCrudViewSet` ? — Non, confirmé `viewsets.ModelViewSet` direct, cf. §B.

### C.3 — Mécanisme d'erreurs typées contourné à grande échelle (SÉVÉRITÉ MOYENNE, dette d'architecture)

Cf. §B. Pas un crash, mais une divergence de contrat API : un client qui s'appuie sur les codes d'erreur stables de `core/exceptions.py` pour `comptes` ne peut pas faire la même chose pour `rh_paie`/`tresorerie`, qui renvoient des messages de chaîne libre (`str(e)`) sans code stable. Risque de rupture silencieuse si le frontend ou une intégration tente un jour de distinguer les erreurs par code plutôt que par message.

### C.4 — Pas de bug confirmé dans `SuppressionProtegeeMixin`/`AuditLogMixin`/`Auditable`/`AuditableSerializerMixin` eux-mêmes

Le code de `core/` lu (`models.py`, `serializers.py`, `viewsets.py`, `mixins.py`, `exceptions.py`) est court, cohérent, et les 13 tests `core` qui ne touchent pas au schéma passent. Le problème n'est pas dans `core`, il est dans son **adoption inégale** par les modules les plus récents (`tresorerie` Phase 5, `rh_paie` Phase 6), qui reproduisent à la main (ou oublient) ce que `core` offre déjà.

## Résumé exécutable

1. **Bloquant, à corriger en priorité absolue** : `AffectationEnseignementSerializer` référence des champs qui n'existent pas sur le modèle → 500 sur tout endpoint `affectations-enseignement` + `manage.py spectacular` cassé pour tout le projet. Deux solutions possibles sans décision métier : retirer ces 4 champs du serializer (si `AffectationEnseignement` n'est vraiment pas censé être audité), ou ajouter les champs d'audit au modèle (idéalement en le faisant hériter de `core.models.Auditable`, comme le reste du projet) — mais ce choix doit être validé par vous avant modification, ce n'est pas purement mécanique (ça détermine si ce modèle doit être audité ou non).
2. **tresorerie et rh_paie bypassent `_BaseCrudViewSet`** sur l'intégralité de leurs ViewSets → pas de 409 propre sur suppression bloquée (500 à la place), pas d'audit de create/update/destroy via l'API pour ces deux modules financiers. C'est une régression d'architecture par rapport aux modules plus anciens (`personnes`, `referentiel`, `scolarite`), qui, elle, touche à de nombreux fichiers et mérite d'être traitée comme un chantier dédié plutôt qu'un correctif ponctuel.
3. **`core/exceptions.py` n'est utilisé que par `comptes`** — `rh_paie` et `tresorerie` (63 occurrences combinées de `{'error': str(e)}`) contournent le mécanisme d'erreurs typées du projet.
4. `rh_paie/models.py` duplique manuellement les champs d'audit au lieu d'hériter de `Auditable` — fonctionnellement correct mais incohérent avec le reste du dépôt.

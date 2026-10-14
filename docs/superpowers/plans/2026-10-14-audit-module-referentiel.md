# Audit — module `referentiel` (Phase 1)

> **Mise à jour (2026-10-14, postérieure)** : les concepts `GroupeScolaire` et `Ecole.pole`
> mentionnés ci-dessous comme existants ont été **supprimés** — voir
> `docs/superpowers/specs/2026-10-14-suppression-pole-groupe-scolaire-design.md`. Ce document
> reste tel quel comme trace de l'état du module avant ce refactoring ; les observations relatives
> à `GroupeScolaireViewSet`, au filtre `pole` et à `seed_referentiel` (clé naturelle
> `(groupe_scolaire, pole)`) sont obsolètes.

```text
Date    : 2026-10-14
Méthode : audit en lecture seule (lecture statique du code + manage.py check/makemigrations
          --check, aucune exécution de pytest, aucun fichier modifié)
Grille  : classes de bugs identifiées sur rh_paie/tresorerie (imports manquants masqués,
          collisions services.py/services/, serializers mal typés, champs NOT NULL oubliés,
          TOCTOU, implémentations concurrentes, champs writable qui devraient être read-only,
          tests mal placés)
```

## Verdict général

Le module `referentiel` est nettement plus mûr et plus homogène que `rh_paie`/`tresorerie` à ce
stade. Aucune des 8 classes de bugs de la grille n'a été retrouvée sous sa forme la plus grave
(pas de `NameError`, pas de collision `services.py`/`services/`, pas de serializer mal typé, pas
de champ `NOT NULL` oublié dans un service). Le module s'appuie sur une base commune
(`core.viewsets._BaseCrudViewSet`) qui apporte gratuitement audit + protection suppression à
toutes les ViewSet. Un seul risque réel et concret a été identifié : une fenêtre de course sur
`definir_annee_courante`, non testée, qui peut casser l'invariant « une seule année scolaire
courante » — invariant dont `rh_paie.services.avance_personnel_service` dépend désormais
directement (`AnneeScolaire.objects.get(est_courante=True)`).

## A. Tableau d'audit

| Fonctionnalité | Implémentation actuelle | Risques | Corrections nécessaires | Tests existants |
|---|---|---|---|---|
| CRUD des 11 entités (GroupeScolaire, Ecole, AnneeScolaire, ModaliteFormation, Niveau, Filiere, OptionFiliere, Classe, Matiere, Periode, SessionExamen) | `_BaseCrudViewSet` (`core/viewsets.py:8`) = `SuppressionProtegeeMixin` + `AuditLogMixin` + `ModelViewSet`. Chaque ViewSet (`views.py`) fixe juste `queryset`/`serializer_class`/`filterset_class`/`permission_classes`. | Risque faible : la robustesse dépend entièrement de `_BaseCrudViewSet` (non ré-audité ici en détail — hors périmètre strict de ce module, mais c'est un point de levier partagé par tout le dépôt). | Aucune côté `referentiel` ; si un audit séparé de `core/viewsets.py` est fait, le bénéfice rejaillira automatiquement ici. | `test_api.py` (149 lignes), `test_permissions_unit.py` (44 lignes) couvrent CRUD + RBAC par rôle. |
| Bascule « année scolaire courante » (`definir_annee_courante`) | `referentiel/services.py:15-22` : `@transaction.atomic`, `UPDATE ... WHERE est_courante=True EXCLUDE pk=annee.pk` puis `annee.est_courante=True; save()`. Appelée de façon cohérente partout où `est_courante` peut être positionné : `AnneeScolaireSerializer.create/update` (`serializers.py:36-37,42-43`) et `seed_referentiel.py:57`. | **Confirmé par lecture de code (non testé empiriquement par concurrence réelle)** : aucun verrou (`select_for_update`) sur la lecture avant bascule. Si deux requêtes concurrentes appellent `definir_annee_courante` pour deux années *différentes*, alors qu'**aucune n'est encore `est_courante=True`**, chaque `UPDATE ... WHERE est_courante=True EXCLUDE pk=X` ne touche aucune ligne (rien n'est vrai encore) → pas de verrou partagé entre les deux transactions → les deux `annee.save()` sur des PK différentes committent indépendamment → **deux années courantes simultanées**, cassant l'invariant que la contrainte DB ne protège pas (voir ligne suivante). `rh_paie.services.avance_personnel_service.regulariser_avance` (hors de ce module, mais dépendant direct) fait `AnneeScolaire.objects.get(est_courante=True)` — lèverait alors `MultipleObjectsReturned`. | Verrouiller explicitement avant la bascule, p. ex. `AnneeScolaire.objects.select_for_update().filter(est_courante=True)` dans la même transaction, ou sérialiser via un verrou applicatif dédié (ligne sentinelle, `SELECT ... FOR UPDATE` sur toute la table `annee_scolaire`). Ajouter un test de concurrence réelle (deux threads/transactions) — absent actuellement. | `test_services.py:38-46` (`test_definir_annee_courante_bascule_les_autres`) et `test_api.py:127-136`, `test_serializers.py:53-75` testent la bascule **séquentielle**, jamais concurrente. |
| Unicité « une seule année courante » au niveau base | `models.py:68-72` : `UniqueConstraint(fields=["est_courante"], condition=Q(est_courante=True))`. **Le code documente lui-même** (`models.py:65-67`, `serializers.py:23-27`) que c'est un no-op sur MySQL (pas d'index partiel conditionnel supporté comme sur Postgres/SQLite) — donc **aucune protection DB réelle sur la cible de production (MySQL 8.4, cf. CLAUDE.md)**. L'unicité repose à 100 % sur la discipline applicative décrite ci-dessus. | Risque déjà documenté et assumé par les développeurs précédents (bonne pratique : ils ont écrit le commentaire plutôt que de prétendre que ça marche). Le risque résiduel est la fenêtre de course ci-dessus, pas l'absence de documentation. | Si l'équipe veut une vraie garantie DB-level sur MySQL, il faudrait un trigger ou une contrainte applicative renforcée (ex. verrou + contrainte unique classique sur une colonne générée `est_courante_slot` à une seule valeur possible) — décision d'architecture, pas un simple bugfix. | Aucun test ne vérifie le comportement MySQL réel de cette contrainte (cohérent avec le fait qu'elle est un no-op assumé). |
| `seed_referentiel` (commande de gestion) | `management/commands/seed_referentiel.py` : `@transaction.atomic`, uniquement des `get_or_create` (groupe, écoles, modalités, année, périodes, session normale), puis `services.definir_annee_courante(annee)`. | **Idempotence confirmée par lecture** : chaque étape utilise `get_or_create` avec une clé naturelle correcte (`nom`, `(groupe_scolaire, pole)`, `code`, `libelle`, `(annee_scolaire, numero)`, `(periode, type)`) ; relancer la commande ne duplique rien. Note mineure, pas un bug : la date de début d'année (`f"{annee[:4]}-10-01"`) utilise le 1er octobre alors que `CLAUDE.md` documente une année financière SEPT…AOUT pour le reste du dépôt — divergence terminologique « année scolaire » (pédagogique, Oct) vs « année financière » (compta, Sept), à confirmer intentionnelle. | Aucune correction de bug nécessaire. Si la divergence Oct/Sept n'est pas voulue, aligner `deb`. | `test_seed.py` (20 lignes) vérifie la création et `est_courante=True` après un seul run ; **ne teste pas le double-run idempotent explicitement** (bien que la lecture du code confirme que ça ne casserait rien). |
| `libelle_classe` / auto-génération du libellé de `Classe` | `services.py:6-12` fonction pure (pas de DB), appelée par `ClasseSerializer.create/update` (`serializers.py:84-110`) qui recalcule correctement `libelle_auto` à partir des valeurs fusionnées (nouvelles ou existantes) sur update. | Aucun risque identifié : fonction pure, pas d'effet de bord, logique de fusion sur update correcte à la lecture. | Aucune. | Pas de test dédié trouvé spécifiquement sur `libelle_classe`/`_libelle` (ni dans `test_serializers.py` ni `test_services.py` à la lecture) — couverture indirecte possible via `test_api.py`, non confirmée ligne à ligne. |
| Contraintes d'unicité métier (`niveau(ecole,code)`, `classe(...)`, `matiere(...)`, `periode(annee,numero)`, `session_examen(periode,type)`, `filiere(ecole,sigle)`, `option_filiere(filiere,sigle)`, `modalite_formation(code)`) | Toutes déclarées comme `UniqueConstraint` classiques (non conditionnelles) dans `models.py` — celles-ci **sont** effectives sur MySQL (contrairement à la contrainte conditionnelle ci-dessus). | Aucun risque identifié par lecture. | Aucune. | `test_integrite.py:49-55` vérifie explicitement le rejet d'un doublon `(ecole, code)` sur `Niveau` (`IntegrityError`). Les autres contraintes ne sont pas toutes vérifiées individuellement par un test dédié (lecture du fichier ne montre qu'un seul cas testé explicitement), mais sont de la même nature DB-enforced donc le risque de régression silencieuse est faible. |
| Permissions RBAC (`PeutEcrireReferentiel`, `PeutEcrirePedagogique`) | `permissions.py` : réutilise `comptes.permissions.ARole("DIRECTION")` / `ARole("DIRECTION","SCOLARITE")`, lecture ouverte à tout utilisateur authentifié, écriture restreinte par rôle. Appliqué de façon homogène sur toutes les ViewSets (`views.py`). | Aucun risque identifié par lecture — contrôle strictement côté serveur, cohérent avec la convention RBAC du dépôt (`CLAUDE.md`). | Aucune. | `test_permissions_unit.py` (44 lignes) + sous-ensemble de `test_api.py` couvrent le RBAC par rôle. |
| Modules `services.py` vs `services/` | Un seul fichier `referentiel/services.py` (pas de package `services/`). | Aucun — la classe de bug « collision module plat / package » observée sur `rh_paie` et `tresorerie` **ne s'applique pas** à `referentiel`. | — | — |
| Fichiers de test mal placés / scripts manuels | Structure standard : tous les tests sont sous `referentiel/tests/`, aucun fichier `test_*.py` ni script manuel (`if __name__ == "__main__":`) trouvé à la racine de l'app ou du dépôt pour ce module. | Aucun. | — | — |

## B. Incohérences relevées (détail)

1. **`models.py:65-67` + `serializers.py:23-27`** : la contrainte `unq_annee_scolaire_courante`
   (`UniqueConstraint` conditionnelle) est documentée comme no-op sur MySQL par les auteurs
   eux-mêmes. C'est une divergence connue et assumée entre l'intention du modèle et son effet réel
   en production — pas un bug caché, mais un point de fragilité qui mérite d'être mentionné dans
   `docs/superpowers/specs/` si ce n'est pas déjà fait, puisque d'autres modules (`rh_paie`)
   dépendent maintenant de l'invariant qu'elle est censée garantir.
2. **`referentiel/services.py:15-22`** : absence de verrouillage (`select_for_update`) dans
   `definir_annee_courante` — fenêtre de course décrite ligne 2 du tableau A. Confirmé par lecture
   du code et de la logique transactionnelle MySQL/InnoDB (un `UPDATE` qui ne matche aucune ligne
   ne pose aucun verrou empêchant une transaction concurrente de faire de même sur une autre
   ligne) ; **non reproduit empiriquement** (pas de test de concurrence exécuté, consigne
   lecture-seule de cette mission respectée).
3. **`management/commands/seed_referentiel.py:40`** : utilise le 1er octobre comme date de début
   d'année scolaire alors que la convention documentée dans `CLAUDE.md` pour l'année *financière*
   est Septembre. Possible confusion entre année scolaire (pédagogique) et année financière
   (comptable) — à confirmer, ce n'est pas nécessairement une erreur.

## C. Bugs confirmés vs suspectés

**Confirmé par lecture de code (logique démontrable, non exécuté empiriquement) :**
- Fenêtre de course sur `definir_annee_courante` pouvant produire deux `AnneeScolaire` avec
  `est_courante=True` simultanément si deux créations/mises à jour concurrentes partent d'un état
  où aucune année n'est encore courante. Impact direct sur `rh_paie.services.avance_personnel_service`
  qui suppose l'unicité via `.get(est_courante=True)`.

**Suspecté / à vérifier, pas de preuve trouvée :**
- Couverture de test incomplète sur `libelle_classe`/`_libelle` (fusion des champs sur update) —
  pas trouvé de test dédié, mais aucune anomalie de logique identifiée non plus.
- Divergence Oct/Sept dans `seed_referentiel` — probablement un non-problème (deux notions d'année
  différentes) mais non confirmé comme intentionnel par une spec lue dans ce périmètre.

**Rien trouvé** correspondant aux classes de bugs 1 (imports manquants), 2 (collision modules), 3
(serializers mal typés), 4 (champ NOT NULL oublié), 6 (double implémentation concurrente), 7
(champs writable qui devraient être read-only — `AnneeScolaireSerializer.est_courante` est
volontairement writable, c'est voulu et documenté, pas un oubli), 8 (tests mal placés).

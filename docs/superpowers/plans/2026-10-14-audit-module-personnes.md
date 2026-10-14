# Audit — module `backend/personnes/`

> **Mise à jour (2026-10-14, postérieure)** : le champ `pole` mentionné ci-dessous a été supprimé
> de `Ecole` — voir `docs/superpowers/specs/2026-10-14-suppression-pole-groupe-scolaire-design.md`.
> `CompteurMatricule` est désormais scopé par `ecole_sigle` (et non plus `pole`), et
> `generer_matricule` prend un sigle d'école en premier argument. Les observations ci-dessous sur
> le format et l'isolement du compteur restent valables mutatis mutandis (même logique, nouvelle
> clé) ; seule la recommandation sur le `transaction.atomic()` manquant reste un point ouvert.

```text
Date    : 2026-10-14
Méthode : audit en lecture seule (grille de bugs issue de l'audit rh_paie/trésorerie du même jour)
Scope   : backend/personnes/ (étudiant, affiliation, situation_bac, type_piece, inscription,
          piece_dossier, compteurs matricule/numéro d'ordre, seed_personnes)
```

## Verdict général

Ce module est **sensiblement plus mature et plus sûr** que `rh_paie`/`tresorerie`. Les classes de
bugs trouvées dans ces deux autres modules (imports manquants masqués par `except Exception`,
collision `services.py`/`services/`, serializers `PrimaryKeyRelatedField` sur un champ non-FK,
champs NOT NULL oubliés, TOCTOU sur génération de numéro séquentiel, deux implémentations
concurrentes d'une même opération) **ne se reproduisent pas ici**. Aucun bug confirmé de sévérité
équivalente. Quelques points mineurs à corriger listés en §C.

## A. Tableau d'audit par fonctionnalité

| Fonctionnalité | Implémentation actuelle | Risques | Corrections nécessaires | Tests existants |
|---|---|---|---|---|
| Génération du matricule étudiant | `services.generer_matricule()` (`services.py:27-32`) : `CompteurMatricule.objects.select_for_update().get_or_create(pole=pole)`, incrément, `save(update_fields=['valeur'])`, tout sous `@transaction.atomic`. Format `{pole}-FCV{initiales}{valeur}`. Compteur par pôle (`CompteurMatricule.pole` = PK), jamais réinitialisé. | Aucun risque de concurrence (verrouillage correct). Risque mineur : l'appel se fait depuis `EtudiantSerializer.create()` (serializers.py:63-65) **avant** `super().create()`, et ni la vue (`EtudiantViewSet`, views.py:15-26) ni le serializer n'ouvrent de `transaction.atomic()` autour de l'ensemble — contrairement à `InscriptionViewSet.perform_create` (views.py:66-68) qui le fait explicitement. Si l'insertion de l'`Etudiant` échoue après l'incrément du compteur (ex. contrainte DB inattendue), le compteur reste incrémenté : un numéro de matricule est "brûlé" (trou de séquence), sans risque de doublon (pas de duplication possible, `matricule` est `unique=True`). | Envelopper `EtudiantViewSet.perform_create`/`EtudiantSerializer.create` dans un `transaction.atomic()` explicite, par symétrie avec `InscriptionViewSet`, pour éviter les trous de séquence en cas d'échec tardif. Sévérité faible (pas de corruption de données, juste un gaspillage de numéro). | `test_generer_matricule_format_et_increment`, `test_compteur_isole_par_pole`, `test_compteur_jamais_reinitialise` (`tests/test_services.py:23-45`) — testent le format et l'incrément séquentiel **en appels successifs dans le même thread**, pas de test de concurrence réelle (threads/connexions parallèles). Le risque résiduel est faible car l'implémentation (`select_for_update`) est correcte par construction, mais ce n'est pas vérifié empiriquement sous charge concurrente. |
| Écriture client du matricule | `EtudiantSerializer.Meta.read_only_fields = ['matricule']` (serializers.py:50) **et** `update()` pop explicitement `matricule` de `validated_data` (serializers.py:70) — double protection. | Aucun. | Aucune. | `test_patch_ne_modifie_pas_le_matricule` (`tests/test_api.py:105-118`). |
| Attribution du numéro d'ordre d'inscription | `services.attribuer_numero_ordre(ecole, annee_scolaire)` (`services.py:35-42`) : même pattern `select_for_update().get_or_create()` + incrément, sous `@transaction.atomic`, compteur isolé par `(ecole, annee_scolaire)` avec `UniqueConstraint` DB (`models.py:192-197`). Appelé depuis `InscriptionSerializer.create()` (serializers.py:143-145), lui-même appelé depuis `InscriptionViewSet.perform_create` qui **enveloppe tout dans `transaction.atomic()`** (views.py:66-68) : attribution du numéro, création de l'inscription, génération de l'échéancier et matérialisation des frais obligatoires sont une seule transaction. Un échec de `generer_echeancier`/`materialiser_frais_obligatoires` fait tout annuler, y compris l'incrément du compteur (savepoint imbriqué). | Aucun risque de concurrence ni de doublon identifié. Défense en profondeur : même en cas de bug applicatif, `UniqueConstraint(ecole, annee_scolaire, numero_ordre)` (models.py:170-173) empêcherait un doublon en base. | Aucune corrigée nécessaire sur le fond. Même remarque que pour le matricule : aucun test de **concurrence réelle** (deux requêtes HTTP simultanées) n'existe, seulement des appels séquentiels. | `test_attribuer_numero_ordre_incremente_par_ecole_annee`, `test_attribuer_numero_ordre_sequence_par_annee` (`tests/test_services.py:47-66`) ; côté API : `test_creation_inscription_transaction_complete` (vérifie `numero_ordre == 1` + audit) et surtout **`test_creation_inscription_sans_grille_400_et_rollback`** (`tests/test_api.py:170-179`) qui vérifie explicitement le rollback total (`Inscription.objects.count() == 0`) quand `generer_echeancier` échoue faute de grille tarifaire — preuve empirique que l'atomicité fonctionne. |
| Écriture client du numéro d'ordre / école / année scolaire | `InscriptionSerializer.Meta.read_only_fields` inclut `ecole`, `annee_scolaire`, `numero_ordre` (serializers.py:103-111). La classe (`classe`) est modifiable à la création mais passée en `read_only=True` dynamiquement après instanciation (`__init__`, serializers.py:117-120) si `self.instance is not None` (donc modifiable seulement à la création, verrouillée en update). | Aucun. | Aucune. | `test_patch_inscription_refuse_classe_et_numero` (`tests/test_api.py:206-223`) vérifie qu'un PATCH tentant de changer `numero_ordre` et `classe` est sans effet, alors que `etat` (champ légitimement modifiable) l'est bien. |
| Distinction étudiant (identité persistante) / inscription (annuelle) | Modèles séparés (`Etudiant` vs `Inscription`), `Inscription.etudiant` en FK `on_delete=RESTRICT` (models.py:138-140, empêche la suppression d'un étudiant ayant des inscriptions). `UniqueConstraint(etudiant, annee_scolaire)` (models.py:166-169) empêche une double inscription du même étudiant la même année, sans empêcher plusieurs inscriptions sur des années différentes (réinscription). Aucun service ni vue ne fusionne les deux notions : `InscriptionSerializer.create()` ne modifie jamais l'`Etudiant`, et `EtudiantSerializer` ne référence aucune `Inscription`. | Aucun risque de fusion identifié dans le code lu. | Aucune. | `test_inscription_unicite_etudiant_annee` (`tests/test_models.py:76-82`). |
| Pièces de dossier (`PieceDossier`) | Modèle de **suivi** (checklist), pas de stockage de fichier : `fournie: bool`, `date_reception` (models.py:210-211). Pas de champ fichier/upload — cohérent avec CLAUDE.md (« stockage de documents hors périmètre sauf fonctionnalité documentaire déjà existante »). `UniqueConstraint(inscription, type_piece)` (models.py:216-219) empêche le doublon. `type_piece` en FK `on_delete=RESTRICT` (models.py:207-209). Suppression en cascade avec l'inscription (`on_delete=CASCADE`, models.py:205). | Aucun risque de validation de fichier à ce stade puisqu'il n'y a pas de champ fichier — ce n'est pas un gap de sécurité, c'est une fonctionnalité non encore implémentée (upload réel), hors périmètre déclaré. `PieceDossierSerializer` (serializers.py:74-77) exporte tous les champs (`fields = "__all__"`) sans aucun `read_only_fields` : un client pourrait réassigner `inscription` à une autre inscription via PATCH — à vérifier si c'est voulu (pas un risque financier, mais un risque d'intégrité de suivi de dossier). | Envisager de passer `inscription` en lecture seule après création dans `PieceDossierSerializer`, pour empêcher un PATCH de rattacher une pièce à une autre inscription (mineur, pas vérifié par un test). | `test_piece_dossier_unicite`, `test_piece_dossier_cascade_a_la_suppression_inscription` (`tests/test_models.py:91-107`). Pas de test API dédié trouvé pour `PieceDossierViewSet` au-delà des tests de permissions génériques (`test_rbac_inscriptions` couvre `PeutEcrireInscriptions`, partagée avec `PieceDossierViewSet`, views.py:71-76). |
| Seed des types de pièce | `seed_personnes.py` : `@transaction.atomic`, `get_or_create` par code — idempotent, pas de risque de doublon ni d'écrasement. | Aucun. | Aucune. | `tests/test_seed.py` (nom des tests non inspecté en détail, présent et dédié). |
| Collision de modules Python (`services.py` vs `services/`) | **Absente dans ce module** : un seul fichier `personnes/services.py`, pas de package `services/` concurrent. | N/A — classe de bug non applicable ici. | Aucune. | N/A |
| Deux implémentations concurrentes d'une même opération | Aucune détectée : un seul chemin pour générer le matricule (`services.generer_matricule`, appelé uniquement depuis `EtudiantSerializer.create`) et un seul pour le numéro d'ordre (`services.attribuer_numero_ordre`, appelé uniquement depuis `InscriptionSerializer.create`). | N/A | Aucune. | N/A |

## B. Incohérences trouvées

1. **Asymétrie d'atomicité Étudiant vs Inscription** (voir ligne 1 du tableau) : `InscriptionViewSet.perform_create` enveloppe explicitement la création dans `transaction.atomic()` (views.py:66-68), mais `EtudiantViewSet` ne le fait pas malgré un appel de service équivalent (`generer_matricule`) qui incrémente un compteur partagé avant l'insertion du modèle. Risque réel mais faible (gap de séquence, pas de duplication).
2. **`PieceDossierSerializer` sans `read_only_fields`** (serializers.py:74-77) : contrairement à tous les autres serializers sensibles du module (`EtudiantSerializer`, `InscriptionSerializer`), celui-ci n'a aucune protection de champ. `inscription` et `type_piece` restent modifiables par PATCH après création, ce qui pourrait permettre de rattacher une pièce déjà marquée "fournie" à une inscription différente. Impact limité (pas de champ financier), mais incohérent avec la rigueur du reste du module.
3. Aucun test de concurrence réelle (multi-thread/multi-connexion) pour `generer_matricule`/`attribuer_numero_ordre`, uniquement des appels séquentiels répétés — même limite que celle relevée dans l'audit rh_paie, mais ici le risque réel est beaucoup plus faible puisque l'implémentation utilise correctement `select_for_update()`.

## C. Bugs confirmés vs suspectés

**Bugs confirmés (vérifiés par lecture du code et des tests) :** aucun bug bloquant ou de sévérité
« NameError / crash » trouvé dans ce module, contrairement à `rh_paie`/`tresorerie`.

**Points mineurs confirmés (pas des bugs bloquants, juste des écarts de rigueur) :**
- Absence de `transaction.atomic()` explicite autour de la création `Etudiant` + génération du
  matricule (point B.1) — confirmé par lecture de `views.py` et `serializers.py`.
- `PieceDossierSerializer` sans champs protégés (point B.2) — confirmé par lecture directe.

**Suspecté, non vérifié par exécution :** aucun — tous les constats de cette section s'appuient sur
une lecture complète des fichiers concernés (`models.py`, `services.py`, `serializers.py`,
`views.py`, `permissions.py`, `seed_personnes.py`) et sur la liste des tests existants ; aucune
commande `pytest`/`manage.py` n'a été exécutée pour cet audit (contrainte lecture-seule de la
mission), donc l'exécution réelle des tests cités n'a pas été revérifiée dans cette session.

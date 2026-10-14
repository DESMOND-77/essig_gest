# Audit — module `backend/comptes/` (utilisateur, rôle, audit)

```text
Date    : 2026-10-14
Méthode : audit en lecture seule (lecture exhaustive des fichiers .py du module)
Grille  : mêmes classes de bugs que l'audit RH & Paie du même jour
          (docs/superpowers/plans/2026-10-14-audit-etape-a-rh-paie-operations-financieres.md)
```

## Verdict général

Contrairement à `rh_paie`/`tresorerie`, ce module est **sain** : aucun bug confirmé de la grille
(imports manquants, collision `services.py`/`services/`, `PrimaryKeyRelatedField` sur champ non-FK,
champ `NOT NULL` jamais renseigné, TOCTOU, double implémentation concurrente, champ writable
sensible). Couverture de tests large (25 tests sur 6 fichiers : permissions, audit, JWT, modèle
utilisateur, scope école, seed). Un seul point obsolète (commentaire TODO) et une absence de
surface API CRUD qui semble être un choix de conception, pas un oubli.

## A. Tableau d'audit par fonctionnalité

| Fonctionnalité | Implémentation actuelle | Risques | Corrections nécessaires | Tests existants |
|---|---|---|---|---|
| Authentification JWT (login/refresh/logout) | `comptes/views.py` : `LoginView`/`RefreshView`/`LogoutView` (`APIView`, `AllowAny`, `authentication_classes=[]`). Refresh en cookie httponly, `SameSite=Strict`, rotation + blacklist activées (`settings/base.py:149-157`). `RefreshView.post` vérifie `u.is_active` avant de renouveler (views.py:100-101) — refuse un compte désactivé. | Le commentaire `settings/base.py:158-159` documente explicitement que `/refresh/` et `/logout/` sont `csrf_exempt` de fait et que `SameSite=Strict` est le seul rempart anti-CSRF — c'est une mitigation connue et assumée, pas un oubli, mais à ne jamais relâcher en `Lax` sans ajouter un jeton CSRF (le commentaire le dit lui-même). | Aucune (risque documenté et mitigé). | `test_auth_jwt.py` : login, mauvais mot de passe, refresh via cookie, refresh sans cookie, logout+blacklist, refresh refusé si compte désactivé, mise à jour de `derniere_connexion`. Couverture large. |
| Suivi de dernière connexion (`derniere_connexion` vs `last_login`) | **Les deux colonnes sont en fait renseignées**, par deux mécanismes différents : `last_login` est mis à jour par simplejwt via `UPDATE_LAST_LOGIN: True` (`settings/base.py:153`) ; `derniere_connexion` est mis à jour manuellement dans `LoginSerializer.validate()` (`serializers.py:11-13`). | Le commentaire `settings/base.py:156-157` (« `derniere_connexion` est une colonne distincte que Django ne met pas à jour ; brancher un signal `user_logged_in` ou supprimer la colonne ») est **obsolète** — le TODO a déjà été résolu autrement (mise à jour manuelle dans le serializer), mais le commentaire laisse croire que le problème est encore ouvert. Risque faible : deux colonnes redondantes à maintenir en synchronisation si l'une des deux voies de mise à jour change sans que l'autre suive. | Mettre à jour ou supprimer le commentaire TODO dans `settings/base.py:156-157` pour refléter l'état réel (déjà fait dans `LoginSerializer`). Décider si les deux colonnes doivent subsister ou si l'une devient dérivée de l'autre. | `test_auth_jwt.py::test_login_met_a_jour_derniere_connexion` (serializers.py). Pas de test dédié à `last_login` lui-même (dépend de `simplejwt`, probablement considéré hors périmètre). |
| Rôles et permissions (`Role`, `UtilisateurRole`, `ARole`, `EcritureInterditeEnLecture`) | `ARole(*codes)` (permissions.py:10-22) génère une classe de permission DRF vérifiant l'intersection rôles-utilisateur/rôles-autorisés ; superuser toujours autorisé. `EcritureInterditeEnLecture` (permissions.py:25-35) autorise les méthodes sûres (ou superuser) et bloque l'écriture si l'ensemble de rôles de l'utilisateur est exactement `{"LECTURE"}` ou vide. Utilisées par d'autres modules (`rh_paie`, `tresorerie`, etc. — confirmé par les audits précédents qui citent `ARole`/`EcritureInterditeEnLecture` dans `CLAUDE.md`) ; `comptes` lui-même n'expose aucun ViewSet CRUD pour `Role`/`UtilisateurRole` (gestion via Django admin, `admin.py:51-65`, et la commande `seed_socle`). | Aucun risque de logique trouvé dans `permissions.py` lui-même (vérifié par lecture + tests dédiés). Le risque réel, déjà signalé dans les audits RH&Paie/trésorerie, est que **les modules consommateurs** (`rh_paie`, etc.) n'appliquent pas toujours ces permissions de façon cohérente avec ce que `comptes` fournit — ce n'est pas un défaut de `comptes`. | Aucune côté `comptes`. | `test_permissions.py` (8 tests) : `ARole` autorise/refuse selon le rôle, superuser toujours autorisé, anonyme refusé, `EcritureInterditeEnLecture` bloque un compte purement LECTURE, autorise si LECTURE + un autre rôle, refuse si aucun rôle. Couverture correcte de la logique de `permissions.py`. |
| Journal d'audit (`JournalAudit`, `AuditLogMixin`) | `AuditLogMixin` (`audit.py:34-73`) surcharge `perform_create`/`perform_update`/`perform_destroy` pour écrire une ligne `JournalAudit` avec snapshot avant/après (`_snapshot`, filtrant `CHAMPS_SENSIBLES = {"password", "mot_de_passe_hash", "token", "secret"}`) et l'IP cliente via `_ip()` qui valide la dernière entrée de `X-Forwarded-For` (cohérent avec `NUM_PROXIES=1`, `settings/base.py:147-148`). | Le mixin lui-même n'a pas de défaut trouvé. Comme noté dans l'audit RH&Paie, c'est aux ViewSets des **autres modules** de l'appliquer — `rh_paie` ne le fait pas sur ses 6 ViewSets (déjà signalé dans l'audit du 2026-10-14). | Aucune côté `comptes`. Rappel : brancher `AuditLogMixin` sur les ViewSets sensibles des autres modules reste à faire (cf. audit RH&Paie). | `test_audit.py` (5 tests, avec un `RoleViewSet` jetable monté sur un router de test) : création/modification/suppression écrivent la ligne attendue, les champs sensibles sont masqués, un utilisateur anonyme produit une ligne sans auteur. Couverture solide du mixin en isolation. |
| Gestion utilisateur (`Utilisateur`, `UtilisateurManager`) | `creer_utilisateur(login, email, password=None, **extra)` (`managers.py:7-14`) exige `login` et `email` en positionnel, puis alias anglais `create_user`/`create_superuser` (managers.py:23-24) pour compatibilité Django (`createsuperuser`, tests). `is_active` est une propriété dérivée de `actif` (models.py:27-33), pas un champ stocké séparément — évite toute divergence entre les deux. | **Signature stricte** : tout appelant (interne au projet ou dans un test d'un autre module) qui fait `Utilisateur.objects.create_user(login="x", password="y")` sans `email` lève un `TypeError` immédiat — déjà observé empiriquement dans `tresorerie/tests/test_models.py` (`UtilisateurManager.creer_utilisateur() missing 1 required positional argument: 'login'`), confirmant que des tests d'autres modules n'appellent pas ce manager avec la bonne signature. Ce n'est pas un bug de `comptes` (la signature est cohérente et testée), mais un piège pour les appelants externes à documenter. | Aucune côté `comptes`. Suggestion : si de nombreux modules se trompent sur cette signature, envisager de documenter l'usage attendu (ou un commentaire dans `managers.py`) plutôt que de l'assouplir. | `test_utilisateur_model.py` (5 tests) : hachage du mot de passe, unicité du login, création superutilisateur, désactivation via `actif`, alias `create_superuser`. Couverture correcte. |
| Scope établissement (`UtilisateurRole.ecole`) | FK optionnelle vers `referentiel.Ecole` (`models.py:59-67`, `on_delete=RESTRICT`), contrainte d'unicité `(utilisateur, role, ecole)` (`models.py:71-76`) — permet un même rôle sur plusieurs écoles pour un même utilisateur, mais pas de doublon exact. | Aucun défaut trouvé par lecture. `on_delete=RESTRICT` sur `ecole` empêche la suppression d'une école tant qu'un rôle y pointe — cohérent avec la volonté de ne pas perdre silencieusement un périmètre d'autorisation. | Aucune. | `test_utilisateur_role_ecole.py` (2 tests) : le rôle pointe une école réelle, le scope école est bien appliqué. |

## B. Incohérences modèle/migration/serializer

Aucune incohérence trouvée entre `models.py` et les 4 migrations (`0001_initial.py`,
`0002_role_utilisateurrole.py`, `0003_journalaudit.py`, `0004_utilisateurrole_ecole_fk.py`) : la
progression des migrations correspond exactement à l'état actuel du modèle (champs
`derniere_connexion`/`date_creation`/`actif` dès `0001`, puis `Role`/`UtilisateurRole` en `0002`,
`JournalAudit` en `0003`, FK `ecole` sur `UtilisateurRole` en `0004`). Pas de champ `BigIntegerField`
« en attente de FK » comme dans `rh_paie` — `UtilisateurRole.ecole` et toutes les FK du module sont
déjà de vraies `ForeignKey`.

Il n'y a pas de `serializers.py` exposant `Role`/`UtilisateurRole`/`JournalAudit` via API (seuls
`LoginSerializer`, `LoginRequeteSerializer`, `AccessTokenSerializer`, `RoleAffecteSerializer`,
`MoiSerializer` existent, tous liés à l'authentification) — donc pas de risque de
`PrimaryKeyRelatedField` mal typé comme observé dans `rh_paie/serializers.py`. Le seul serializer
qui référence un modèle (`LoginSerializer`, sous-classe de `TokenObtainPairSerializer`) ne déclare
aucun champ FK manuel.

Aucun fichier `services.py` ni package `services/` dans ce module — la collision de modules observée
dans `rh_paie` et `tresorerie` ne peut pas se produire ici.

## C. Bugs confirmés vs suspectés

**Confirmés (lecture seule, mais vérifiables empiriquement sans ambiguïté) :** aucun bug
fonctionnel. Seul constat : le commentaire TODO de `config/settings/base.py:156-157` à propos de
`derniere_connexion` est **factuellement obsolète** (le TODO qu'il décrit a déjà été résolu dans
`comptes/serializers.py:11-13`), ce qui peut induire un futur agent/développeur en erreur sur l'état
réel du champ.

**Suspectés (rien trouvé dans ce module ; dépendance externe à vérifier ailleurs) :** la signature
stricte de `UtilisateurManager.creer_utilisateur` (login + email obligatoires) est probablement la
cause du `TypeError` déjà observé dans `tresorerie/tests/test_models.py` lors de l'audit RH&Paie —
ce n'est pas un bug de `comptes`, mais la preuve que d'autres modules (au moins `tresorerie`, peut-
être d'autres encore à auditer) appellent ce manager avec une signature incorrecte dans leurs
fixtures de test.

**Aucun autre module interne** (`admin.py`, `apps.py`, `urls.py`, `__init__.py`) n'a révélé de
défaut à la lecture.

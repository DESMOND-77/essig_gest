# Phase 3A — Inscription & échéancier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer l'inscription annuelle d'un étudiant dans une classe — avec `numero_ordre` attribué par le serveur et l'échéancier généré atomiquement depuis la grille tarifaire — plus le mixin ORM `Auditable`.

**Architecture:** `inscription` / `compteur_inscription` / `piece_dossier` étendent l'app `personnes` ; `modalite_paiement` / `echeance` créent l'app `scolarite`. Un mixin abstrait `core.Auditable` + `core.serializers.AuditableSerializerMixin` portent `cree_par`/`modifie_par`. `POST /personnes/inscriptions/` exécute une transaction unique : inscription → `numero_ordre` (séquence `select_for_update`) → N+1 échéances. Frais annexes = Phase 3B.

**Tech Stack:** Django 5.2 / DRF 3.16 / MySQL 8.4 / `django-filter` / `factory_boy` / `pytest-django` ; React 19 / TS strict / Vite / React Router 7 / TanStack Query + Table / RHF + Zod / Vitest.

**Spec:** `docs/superpowers/specs/2026-09-07-phase-3-inscriptions-scolarite-design.md`

## Global Constraints

- **Français partout** : tables, colonnes, enums (valeurs SQL exactes), messages d'erreur, libellés UI.
- **Argent** : `DecimalField(max_digits=12, decimal_places=0)` (entiers FCFA). **Jamais de flottant.** La répartition du coût négocié est en arithmétique entière (`//`, soustraction).
- **PK ORM** : `BigAutoField` / `BIGINT` partout (défaut Django) — écart assumé au SQL `INT UNSIGNED` (D-P3-1).
- **`db_table` explicite** = nom cible snake_case singulier sans accent : `inscription`, `compteur_inscription`, `piece_dossier`, `modalite_paiement`, `echeance`.
- **`ENUM` SQL → `models.TextChoices`** valeurs SQL littérales (D-P3-2).
- **CharField nullables** miroir du SQL : `null=True, blank=True` + `# noqa: DJ001`.
- **`Auditable`** : `cree_par`/`modifie_par` = `FK(settings.AUTH_USER_MODEL, on_delete=SET_NULL, null=True, blank=True, related_name="+", editable=False)` ; `cree_le=auto_now_add`, `modifie_le=auto_now`. Jamais acceptés en entrée API (`read_only`). `AUTH_USER_MODEL = "comptes.Utilisateur"`.
- **RBAC exclusivement serveur.** Le front masque, ce n'est pas une sécurité.
- **pytest** : `DB_USER=root`, depuis `backend/`, venv `.venv` actif.
- **Après changement d'API** : serializers → `@extend_schema` → `python manage.py spectacular --file /tmp/schema.yml` (**0 Error / 0 Warning**) → backend sur `:8000` → `npm run gen:api` → adapter le front → tests.
- **Namespace URL `v1:`** — routers montés dans la liste `api_v1` de `config/urls.py`.
- **Comparer au `.sql`** : `python manage.py sqlmigrate personnes 0002` et `sqlmigrate scolarite 0001` vs `db/migrations/003` (inscription/piece_dossier) et `004` (modalite_paiement/echeance). Consigner les écarts (D-ORM-9).
- **Trailers de commit** (imposés) :
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_015vBabiytJuWPjuDR2qUfCf
  ```
- **Branche** : `phase-3a-inscription-echeancier` (depuis `main`).
- **Baseline** : `pytest` = 116 passed, `npm test` = 28 passed (fin Phase 2).

---

## File Structure

**Backend**
| Fichier | Responsabilité |
|---|---|
| `backend/core/models.py` *(créer)* | `Auditable` — modèle abstrait (`cree_par`/`cree_le`/`modifie_par`/`modifie_le`). Aucune migration (abstrait). |
| `backend/core/serializers.py` *(créer)* | `AuditableSerializerMixin` — pose `cree_par`/`modifie_par` depuis `context["request"].user`. |
| `backend/core/tests/test_auditable.py` *(créer)* | Champs du mixin + comportement du serializer mixin. |
| `backend/personnes/models.py` *(modifier)* | + `Inscription`, `CompteurInscription`, `PieceDossier`. |
| `backend/personnes/services.py` *(modifier)* | + `attribuer_numero_ordre(ecole, annee_scolaire) -> int`. |
| `backend/personnes/serializers.py` *(modifier)* | + `InscriptionListSerializer`, `InscriptionSerializer`, `PieceDossierSerializer`. |
| `backend/personnes/permissions.py` *(modifier)* | + `PeutEcrireInscriptions`. |
| `backend/personnes/filters.py` *(modifier)* | + `InscriptionFilter`, `PieceDossierFilter`. |
| `backend/personnes/views.py` *(modifier)* | + `InscriptionViewSet`, `PieceDossierViewSet`. |
| `backend/personnes/urls.py` *(modifier)* | + `register("inscriptions", ...)`, `register("pieces-dossier", ...)`. |
| `backend/personnes/admin.py` *(modifier)* | + `admin.site.register(models.Inscription)`. |
| `backend/personnes/migrations/0002_*.py` *(généré)* | Inscription / CompteurInscription / PieceDossier. |
| `backend/personnes/tests/factories.py` *(modifier)* | + `InscriptionFactory`, `PieceDossierFactory`. |
| `backend/personnes/tests/test_models.py` *(modifier)* | + unicités inscription, cascade piece_dossier. |
| `backend/personnes/tests/test_services.py` *(modifier)* | + `attribuer_numero_ordre`. |
| `backend/personnes/tests/test_serializers.py` *(modifier)* | + `InscriptionSerializer` (dérivations, imbrication, read-only). |
| `backend/personnes/tests/test_api.py` *(modifier)* | + création transactionnelle, 400 grille absente, 409 suppression, RBAC. |
| `backend/personnes/tests/test_permissions_unit.py` *(modifier)* | + `PeutEcrireInscriptions`. |
| `backend/scolarite/__init__.py`, `apps.py`, `models.py`, `serializers.py`, `permissions.py`, `filters.py`, `views.py`, `urls.py`, `admin.py`, `services.py` *(créer)* | Nouvelle app. |
| `backend/scolarite/migrations/__init__.py` + `0001_initial.py` *(créer/généré)* | ModalitePaiement / Echeance. |
| `backend/scolarite/tests/{__init__,factories,test_models,test_services,test_serializers,test_api,test_permissions_unit}.py` *(créer)* | Suite `scolarite`. |
| `backend/config/settings/base.py` *(modifier)* | `INSTALLED_APPS += "scolarite"`. |
| `backend/config/urls.py` *(modifier)* | `path("scolarite/", include("scolarite.urls"))`. |
| `backend/pyproject.toml` *(modifier)* | `packages.find` += `scolarite*`. |

**Frontend**
| Fichier | Responsabilité |
|---|---|
| `frontend/src/personnes/config/inscription.tsx` *(créer)* | `Descripteur` liste/formulaire inscription. |
| `frontend/src/personnes/config/pieceDossier.tsx` *(créer)* | `Descripteur` piece_dossier. |
| `frontend/src/personnes/FicheInscription.tsx` *(créer)* | Écran bespoke (en-tête + Échéancier + Pièces). |
| `frontend/src/scolarite/config/modalitePaiement.tsx`, `scolarite/config/echeance.tsx` *(créer)* | `Descripteur` scaffold. |
| `frontend/src/scolarite/routes.tsx` *(créer)* | `routesScolarite`. |
| `frontend/src/personnes/routes.tsx` *(modifier)* | + `inscriptions` (+ `:id`), `pieces-dossier`. |
| `frontend/src/routes.tsx` *(modifier)* | + `...routesScolarite`. |
| `frontend/src/app/Sidebar.tsx` *(modifier)* | module `scolarite` → `disponible: true`. |
| `frontend/src/app/Sidebar.test.tsx` *(modifier)* | 3 modules actifs, 3 à venir. |
| `frontend/src/personnes/config/inscription.test.tsx`, `config/pieceDossier.test.tsx`, `FicheInscription.test.tsx` *(créer)* | Tests. |
| `frontend/src/personnes/integration.test.tsx` *(modifier)* | + routes inscription. |
| `frontend/src/scolarite/config/modalitePaiement.test.tsx`, `scolarite/integration.test.tsx` *(créer)* | Tests. |
| `frontend/src/api/schema.d.ts` *(régénéré)* | `npm run gen:api`. |

**Docs**
| Fichier | Responsabilité |
|---|---|
| `CLAUDE.md` *(modifier)* | Tableau architecture : `scolarite` (partiel 3A). |
| `.superpowers/sdd/2026-09-07-phase-3a-inscription/progress.md` *(créer, non versionné)* | Rapport §26. |

---

## Task 1 : `core.Auditable` + `AuditableSerializerMixin`

**Files:**
- Create: `backend/core/models.py`, `backend/core/serializers.py`, `backend/core/tests/test_auditable.py`

**Interfaces:**
- Produces:
  - `core.models.Auditable` — modèle **abstrait** : `cree_par`, `cree_le`, `modifie_par`, `modifie_le` (voir Global Constraints). Aucune table, aucune migration.
  - `core.serializers.AuditableSerializerMixin` — mixin `serializers.ModelSerializer`. `create()` : injecte `cree_par = <user courant>` puis `super().create()`. `update()` : injecte `modifie_par = <user courant>` puis `super().update()`. `<user courant>` = `getattr(self.context.get("request"), "user", None)` s'il est authentifié, sinon `None`. Les 4 champs d'audit doivent être déclarés `read_only` par le serializer concret (rappel dans les tâches suivantes).

- [ ] **Step 1: Écrire les tests**

`backend/core/tests/test_auditable.py` :
```python
import pytest
from rest_framework import serializers

from comptes.tests.factories import UtilisateurFactory
from core.models import Auditable
from core.serializers import AuditableSerializerMixin
from referentiel import models as ref
from referentiel.tests import factories as rf

pytestmark = pytest.mark.django_db


def test_auditable_est_abstrait_avec_4_champs():
    assert Auditable._meta.abstract is True
    champs = {f.name for f in Auditable._meta.get_fields()}
    assert {"cree_par", "cree_le", "modifie_par", "modifie_le"} <= champs


class _GroupeSerializer(AuditableSerializerMixin, serializers.ModelSerializer):
    # GroupeScolaire n'hérite pas d'Auditable : on vérifie seulement que le mixin
    # tente d'injecter la clé (ignorée ici) sans casser. Le comportement réel est
    # couvert par les tests d'Inscription (Task 6).
    class Meta:
        model = ref.GroupeScolaire
        fields = ["id", "nom"]


def test_mixin_tolere_absence_de_request():
    s = _GroupeSerializer(data={"nom": "X"})
    assert s.is_valid(), s.errors
    # pas de context["request"] -> ne lève pas
    obj = s.save()
    assert obj.nom == "X"
```

> Le test réel du mixin (pose de `cree_par`/`modifie_par`) est dans `personnes/tests/test_serializers.py` (Task 6), sur `Inscription` qui hérite d'`Auditable`. Ici on borne le contrat : mixin importable, ne casse pas sans `request`.

- [ ] **Step 2: Lancer — échec attendu**

Run: `cd backend && DB_USER=root pytest core/tests/test_auditable.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'core.models'`.

- [ ] **Step 3: Écrire `core/models.py`**

```python
from django.conf import settings
from django.db import models


class Auditable(models.Model):
    """Colonnes d'audit inline (D-ORM-8) : qui/quand a créé et modifié la ligne.

    `cree_par`/`modifie_par` sont posés par `core.serializers.AuditableSerializerMixin`
    depuis l'utilisateur de la requête ; jamais fournis par le client.
    """

    cree_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        editable=False,
    )
    cree_le = models.DateTimeField(auto_now_add=True)
    modifie_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        editable=False,
    )
    modifie_le = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
```

- [ ] **Step 4: Écrire `core/serializers.py`**

```python
class AuditableSerializerMixin:
    """À combiner avec `ModelSerializer` sur un modèle héritant de `core.models.Auditable`.

    Pose `cree_par` à la création et `modifie_par` à la mise à jour depuis
    `context["request"].user`. Le serializer concret doit déclarer
    `cree_par`, `modifie_par`, `cree_le`, `modifie_le` en `read_only`.
    """

    def _utilisateur_courant(self):
        req = self.context.get("request")
        user = getattr(req, "user", None)
        return user if (user is not None and user.is_authenticated) else None

    def create(self, validated_data):
        u = self._utilisateur_courant()
        if u is not None:
            validated_data["cree_par"] = u
        return super().create(validated_data)

    def update(self, instance, validated_data):
        u = self._utilisateur_courant()
        if u is not None:
            validated_data["modifie_par"] = u
        return super().update(instance, validated_data)
```

- [ ] **Step 5: Lancer — passage attendu**

Run: `cd backend && DB_USER=root pytest core/tests/test_auditable.py -q`
Expected: PASS (2). `makemigrations --check` → `No changes detected` (abstrait).

- [ ] **Step 6: Portes**

Run: `cd backend && ruff check . && python manage.py check && python manage.py makemigrations --check --dry-run && DB_USER=root pytest core -q`
Expected: vert.

- [ ] **Step 7: Commit**

```bash
git add backend/core/models.py backend/core/serializers.py backend/core/tests/test_auditable.py
git commit -m "$(cat <<'EOF'
feat(core): mixin Auditable (modele abstrait) + AuditableSerializerMixin

cree_par/cree_le/modifie_par/modifie_le (D-ORM-8). Le serializer mixin pose
cree_par a la creation / modifie_par en MAJ depuis context['request'].user ;
jamais fourni par le client. Aucune migration (abstrait).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015vBabiytJuWPjuDR2qUfCf
EOF
)"
```

**Critère d'acceptation :** `Auditable` abstrait à 4 champs ; `AuditableSerializerMixin` importable et sûr sans `request` ; portes vertes ; aucune migration générée.

---

## Task 2 : Modèles `Inscription` / `CompteurInscription` / `PieceDossier`

**Files:**
- Modify: `backend/personnes/models.py`, `backend/personnes/admin.py`, `backend/personnes/tests/factories.py`, `backend/personnes/tests/test_models.py`
- Create (généré): `backend/personnes/migrations/0002_*.py`

**Interfaces:**
- Consumes: `core.models.Auditable`, `personnes.models.Etudiant`, `personnes.models.TypePiece`, `referentiel.models.{Classe, Ecole, AnneeScolaire, Niveau}`.
- Produces:
  - `personnes.models.Inscription(Auditable)` (`db_table="inscription"`) — champs et contraintes du spec §6. `related_name` : `Etudiant.inscriptions`, `Classe.inscriptions`, `Inscription.pieces_dossier`, `Inscription.echeances` (défini côté `scolarite` en Task 4).
  - `personnes.models.CompteurInscription` (`db_table="compteur_inscription"`) — `ecole` FK, `annee_scolaire` FK, `valeur` PositiveInt ; unique `(ecole, annee_scolaire)` = `unq_compteur_inscription`.
  - `personnes.models.PieceDossier` (`db_table="piece_dossier"`) — `inscription` FK CASCADE (`related_name="pieces_dossier"`), `type_piece` FK RESTRICT, `fournie` bool, `date_reception?` ; unique `(inscription, type_piece)` = `unq_piece_dossier`.
  - `personnes.tests.factories.InscriptionFactory` (SubFactory `EtudiantFactory` + `referentiel.tests.factories.ClasseFactory` ; `ecole`/`annee_scolaire` dérivés via `LazyAttribute` de la classe ; `numero_ordre` Sequence ; `type`/`statut`/`date_inscription` fixes), `PieceDossierFactory`.

- [ ] **Step 1: Ajouter les modèles à `personnes/models.py`**

Ajouter en tête l'import : `from core.models import Auditable` et `from referentiel.models import AnneeScolaire, Classe, Ecole, Niveau` (compléter l'import `Ecole` existant).

```python
class Inscription(Auditable):
    class Type(models.TextChoices):
        INSCRIPTION = "INSCRIPTION", "Inscription"
        REINSCRIPTION = "REINSCRIPTION", "Réinscription"

    class Statut(models.TextChoices):
        NOUVEAU = "NOUVEAU", "Nouveau"
        ANCIEN = "ANCIEN", "Ancien"

    class Etat(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        ABANDON = "ABANDON", "Abandon"
        EXCLU = "EXCLU", "Exclu"
        DIPLOME = "DIPLOME", "Diplômé"

    etudiant = models.ForeignKey(
        Etudiant, on_delete=models.RESTRICT, related_name="inscriptions"
    )
    classe = models.ForeignKey(
        Classe, on_delete=models.RESTRICT, related_name="inscriptions"
    )
    ecole = models.ForeignKey(Ecole, on_delete=models.RESTRICT, related_name="+")
    annee_scolaire = models.ForeignKey(
        AnneeScolaire, on_delete=models.RESTRICT, related_name="+"
    )
    numero_ordre = models.PositiveIntegerField()
    type = models.CharField(max_length=13, choices=Type.choices)
    statut = models.CharField(max_length=7, choices=Statut.choices)
    etablissement_provenance = models.CharField(  # noqa: DJ001
        max_length=150, null=True, blank=True
    )
    est_boursier = models.BooleanField(default=False)
    cout_scolarite_negocie = models.DecimalField(
        max_digits=12, decimal_places=0, null=True, blank=True
    )
    date_inscription = models.DateField()
    etat = models.CharField(
        max_length=8, choices=Etat.choices, default=Etat.ACTIVE
    )

    class Meta:
        db_table = "inscription"
        constraints = [
            models.UniqueConstraint(
                fields=["etudiant", "annee_scolaire"],
                name="unq_inscription_etudiant_annee",
            ),
            models.UniqueConstraint(
                fields=["ecole", "annee_scolaire", "numero_ordre"],
                name="unq_inscription_numero_ordre",
            ),
        ]
        indexes = [
            models.Index(fields=["classe"], name="idx_inscription_classe")
        ]

    def __str__(self):
        return f"{self.numero_ordre} — {self.etudiant} ({self.annee_scolaire})"


class CompteurInscription(models.Model):
    ecole = models.ForeignKey(Ecole, on_delete=models.CASCADE, related_name="+")
    annee_scolaire = models.ForeignKey(
        AnneeScolaire, on_delete=models.CASCADE, related_name="+"
    )
    valeur = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "compteur_inscription"
        constraints = [
            models.UniqueConstraint(
                fields=["ecole", "annee_scolaire"],
                name="unq_compteur_inscription",
            )
        ]

    def __str__(self):
        return f"{self.ecole_id}/{self.annee_scolaire_id}={self.valeur}"


class PieceDossier(models.Model):
    inscription = models.ForeignKey(
        Inscription, on_delete=models.CASCADE, related_name="pieces_dossier"
    )
    type_piece = models.ForeignKey(
        TypePiece, on_delete=models.RESTRICT, related_name="+"
    )
    fournie = models.BooleanField(default=False)
    date_reception = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "piece_dossier"
        constraints = [
            models.UniqueConstraint(
                fields=["inscription", "type_piece"], name="unq_piece_dossier"
            )
        ]

    def __str__(self):
        return f"{self.type_piece} / insc {self.inscription_id}"
```

- [ ] **Step 2: `admin.py`** — ajouter `admin.site.register(models.Inscription)`.

- [ ] **Step 3: Factories**

Dans `backend/personnes/tests/factories.py`, ajouter :
```python
from referentiel.tests.factories import ClasseFactory


class InscriptionFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Inscription

    etudiant = factory.SubFactory(EtudiantFactory)
    classe = factory.SubFactory(ClasseFactory)
    ecole = factory.LazyAttribute(lambda o: o.classe.niveau.ecole)
    annee_scolaire = factory.LazyAttribute(lambda o: o.classe.annee_scolaire)
    numero_ordre = factory.Sequence(lambda n: n + 1)
    type = models.Inscription.Type.INSCRIPTION
    statut = models.Inscription.Statut.NOUVEAU
    date_inscription = "2025-10-01"


class PieceDossierFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.PieceDossier

    inscription = factory.SubFactory(InscriptionFactory)
    type_piece = factory.SubFactory(TypePieceFactory)
    fournie = False
```

- [ ] **Step 4: Tests modèles**

Ajouter à `backend/personnes/tests/test_models.py` :
```python
def test_inscription_db_table_et_index():
    assert models.Inscription._meta.db_table == "inscription"
    assert models.PieceDossier._meta.db_table == "piece_dossier"
    assert models.CompteurInscription._meta.db_table == "compteur_inscription"
    noms = {i.name for i in models.Inscription._meta.indexes}
    assert "idx_inscription_classe" in noms


def test_inscription_unicite_etudiant_annee():
    e = f.EtudiantFactory()
    i1 = f.InscriptionFactory(etudiant=e)
    with pytest.raises(IntegrityError):
        f.InscriptionFactory(
            etudiant=e, annee_scolaire=i1.annee_scolaire
        )


def test_inscription_unicite_numero_ordre_par_ecole_annee():
    i1 = f.InscriptionFactory(numero_ordre=1)
    with pytest.raises(IntegrityError):
        f.InscriptionFactory(
            ecole=i1.ecole, annee_scolaire=i1.annee_scolaire, numero_ordre=1
        )


def test_piece_dossier_unicite_et_cascade():
    i = f.InscriptionFactory()
    tp = f.TypePieceFactory()
    f.PieceDossierFactory(inscription=i, type_piece=tp)
    with pytest.raises(IntegrityError):
        f.PieceDossierFactory(inscription=i, type_piece=tp)
    i2 = f.InscriptionFactory()
    f.PieceDossierFactory(inscription=i2)
    i2.delete()
    assert not models.PieceDossier.objects.filter(inscription_id=i2.pk).exists()


def test_compteur_inscription_unicite():
    from referentiel.tests import factories as rf

    e, a = rf.EcoleFactory(), rf.AnneeScolaireFactory()
    models.CompteurInscription.objects.create(ecole=e, annee_scolaire=a, valeur=3)
    with pytest.raises(IntegrityError):
        models.CompteurInscription.objects.create(ecole=e, annee_scolaire=a)
```

- [ ] **Step 5: Lancer — échec attendu**

Run: `cd backend && DB_USER=root pytest personnes/tests/test_models.py -q`
Expected: FAIL — `AttributeError`/`ProgrammingError` (modèles absents des migrations).

- [ ] **Step 6: Générer la migration + comparer**

Run:
```
cd backend && python manage.py makemigrations personnes
python manage.py makemigrations --check --dry-run          # -> No changes detected
python manage.py sqlmigrate personnes 0002
```
Comparer au bloc `inscription` + `piece_dossier` de `db/migrations/003`. Écarts attendus : `bigint` vs `INT UNSIGNED` (D-P3-1) ; `varchar` vs `ENUM` (D-P3-2) ; colonnes `cree_le`/`modifie_le` `datetime(6)` NOT NULL sans `DEFAULT CURRENT_TIMESTAMP` SQL (gérées par Django `auto_now*`) ; FK `cree_par`/`modifie_par` `related_name="+"` ; `compteur_inscription` sans équivalent SQL (D-P3-5) ; cascade `piece_dossier` au niveau ORM (D-P3-7). Consigner (Task 11).

- [ ] **Step 7: Lancer — passage attendu**

Run: `cd backend && DB_USER=root pytest personnes -q`
Expected: PASS. Total attendu = 116 (baseline) + 2 (Task 1 core, déjà comptés dans `pytest -q` global) ... `pytest personnes` seul ≈ 27 (Phase 2) + 5 nouveaux = **32 passed**.

- [ ] **Step 8: Portes**

Run: `cd backend && ruff check . && python manage.py check && DB_USER=root pytest -q`
Expected: vert ; total global ≈ 116 + 2 + 5 = **123 passed**.

- [ ] **Step 9: Commit**

```bash
git add backend/personnes
git commit -m "$(cat <<'EOF'
feat(personnes): modeles Inscription + CompteurInscription + PieceDossier

Portage db/migrations/003 (inscription, piece_dossier). Inscription herite de
core.Auditable. numero_ordre servi par la sequence compteur_inscription (ecole,
annee ; hors SQL, D-P3-5). Tests portes de db/tests/test_003 (unq_inscription_*,
piece_dossier cascade + unicite).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015vBabiytJuWPjuDR2qUfCf
EOF
)"
```

**Critère d'acceptation :** `makemigrations --check` propre ; `sqlmigrate` diffé ; tests unicités + cascade verts ; suite globale verte.

---

## Task 3 : Service `attribuer_numero_ordre`

**Files:**
- Modify: `backend/personnes/services.py`, `backend/personnes/tests/test_services.py`

**Interfaces:**
- Consumes: `personnes.models.CompteurInscription`.
- Produces: `personnes.services.attribuer_numero_ordre(ecole, annee_scolaire) -> int` — incrémente (sous `transaction.atomic` + `select_for_update`) le compteur `(ecole, annee_scolaire)` et retourne la nouvelle valeur (≥ 1).

- [ ] **Step 1: Écrire les tests**

Ajouter à `backend/personnes/tests/test_services.py` :
```python
def test_attribuer_numero_ordre_incremente_par_ecole_annee():
    from referentiel.tests import factories as rf
    from personnes import services

    e1, e2 = rf.EcoleFactory(), rf.EcoleFactory()
    a = rf.AnneeScolaireFactory()
    assert services.attribuer_numero_ordre(e1, a) == 1
    assert services.attribuer_numero_ordre(e1, a) == 2
    assert services.attribuer_numero_ordre(e2, a) == 1  # séquence distincte


def test_attribuer_numero_ordre_sequence_par_annee():
    from referentiel.tests import factories as rf
    from personnes import services

    e = rf.EcoleFactory()
    a1, a2 = rf.AnneeScolaireFactory(), rf.AnneeScolaireFactory()
    services.attribuer_numero_ordre(e, a1)
    services.attribuer_numero_ordre(e, a1)
    assert services.attribuer_numero_ordre(e, a2) == 1  # nouvelle année repart à 1
```

- [ ] **Step 2: Lancer — échec attendu**

Run: `cd backend && DB_USER=root pytest personnes/tests/test_services.py -q -k numero_ordre`
Expected: FAIL — `AttributeError: module 'personnes.services' has no attribute 'attribuer_numero_ordre'`.

- [ ] **Step 3: Implémenter**

Ajouter à `backend/personnes/services.py` (imports en tête : `from .models import CompteurInscription, Etudiant` — compléter l'import `CompteurMatricule` existant) :
```python
@transaction.atomic
def attribuer_numero_ordre(ecole, annee_scolaire) -> int:
    compteur, _ = (
        CompteurInscription.objects.select_for_update().get_or_create(
            ecole=ecole, annee_scolaire=annee_scolaire
        )
    )
    compteur.valeur += 1
    compteur.save(update_fields=["valeur"])
    return compteur.valeur
```

- [ ] **Step 4: Lancer — passage attendu**

Run: `cd backend && DB_USER=root pytest personnes/tests/test_services.py -q`
Expected: PASS.

- [ ] **Step 5: Portes + commit**

Run: `cd backend && ruff check . && DB_USER=root pytest personnes -q` → vert.
```bash
git add backend/personnes/services.py backend/personnes/tests/test_services.py
git commit -m "$(cat <<'EOF'
feat(personnes): service attribuer_numero_ordre (sequence par ecole+annee)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015vBabiytJuWPjuDR2qUfCf
EOF
)"
```

**Critère d'acceptation :** compteur par (école, année), isolé entre écoles, repart à 1 pour une nouvelle année ; `select_for_update` + `atomic`.

---

## Task 4 : App `scolarite` + `ModalitePaiement` + `Echeance`

**Files:**
- Create: `backend/scolarite/{__init__.py, apps.py, models.py, admin.py}`, `backend/scolarite/migrations/__init__.py`, `backend/scolarite/tests/{__init__.py, factories.py, test_models.py}`
- Modify: `backend/config/settings/base.py`, `backend/pyproject.toml`
- Create (généré): `backend/scolarite/migrations/0001_initial.py`

**Interfaces:**
- Consumes: `core.models.Auditable`, `referentiel.models.{Niveau, AnneeScolaire}`, `personnes.models.Inscription`.
- Produces:
  - `scolarite.models.ModalitePaiement` (`db_table="modalite_paiement"`) — spec §6 ; `montant_total` = `GeneratedField(..., db_persist=True)` (read-only) ; unique `(niveau, annee_scolaire)` = `unq_modalite_paiement`. `nombre_echeance` a un `MinValueValidator(1)`.
  - `scolarite.models.Echeance(Auditable)` (`db_table="echeance"`) — FK `inscription` RESTRICT (`related_name="echeances"`), `numero` PositiveInt, `montant_prevu` Decimal(12,0), `date_prevue` DateField, `pris_en_charge_bourse` bool ; unique `(inscription, numero)` = `unq_echeance`.
  - `scolarite.tests.factories.{ModalitePaiementFactory, EcheanceFactory}`.

- [ ] **Step 1: Scaffold app**

`backend/scolarite/__init__.py` : vide. `migrations/__init__.py` : vide. `tests/__init__.py` : vide.
`backend/scolarite/apps.py` :
```python
from django.apps import AppConfig


class ScolariteConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "scolarite"
```
`backend/scolarite/admin.py` :
```python
from django.contrib import admin

from . import models

admin.site.register(models.ModalitePaiement)
```
`base.py` : `INSTALLED_APPS` — ajouter `"scolarite"` après `"personnes"`.
`pyproject.toml` : `include = [..., "personnes*", "scolarite*"]`.

- [ ] **Step 2: `scolarite/models.py`**

```python
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import F

from core.models import Auditable
from personnes.models import Inscription
from referentiel.models import AnneeScolaire, Niveau


class ModalitePaiement(models.Model):
    niveau = models.ForeignKey(Niveau, on_delete=models.RESTRICT, related_name="+")
    annee_scolaire = models.ForeignKey(
        AnneeScolaire, on_delete=models.RESTRICT, related_name="+"
    )
    montant_inscription_reinscription = models.DecimalField(
        max_digits=12, decimal_places=0
    )
    nombre_echeance = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    montant_echeance = models.DecimalField(max_digits=12, decimal_places=0)
    montant_total = models.GeneratedField(
        expression=F("montant_inscription_reinscription")
        + F("nombre_echeance") * F("montant_echeance"),
        output_field=models.DecimalField(max_digits=12, decimal_places=0),
        db_persist=True,
    )

    class Meta:
        db_table = "modalite_paiement"
        constraints = [
            models.UniqueConstraint(
                fields=["niveau", "annee_scolaire"], name="unq_modalite_paiement"
            )
        ]

    def __str__(self):
        return f"{self.niveau_id}/{self.annee_scolaire_id} = {self.montant_total}"


class Echeance(Auditable):
    inscription = models.ForeignKey(
        Inscription, on_delete=models.RESTRICT, related_name="echeances"
    )
    numero = models.PositiveIntegerField()
    montant_prevu = models.DecimalField(max_digits=12, decimal_places=0)
    date_prevue = models.DateField()
    pris_en_charge_bourse = models.BooleanField(default=False)

    class Meta:
        db_table = "echeance"
        constraints = [
            models.UniqueConstraint(
                fields=["inscription", "numero"], name="unq_echeance"
            )
        ]

    def __str__(self):
        return f"éch. {self.numero} / insc {self.inscription_id}"
```

- [ ] **Step 3: Factories**

`backend/scolarite/tests/factories.py` :
```python
import factory

from personnes.tests.factories import InscriptionFactory
from referentiel.tests.factories import AnneeScolaireFactory, NiveauFactory
from scolarite import models


class ModalitePaiementFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.ModalitePaiement

    niveau = factory.SubFactory(NiveauFactory)
    annee_scolaire = factory.SubFactory(AnneeScolaireFactory)
    montant_inscription_reinscription = 105000
    nombre_echeance = 9
    montant_echeance = 70000


class EcheanceFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Echeance

    inscription = factory.SubFactory(InscriptionFactory)
    numero = factory.Sequence(lambda n: n)
    montant_prevu = 70000
    date_prevue = "2025-11-01"
```

- [ ] **Step 4: `scolarite/tests/test_models.py`**

```python
import pytest
from django.db import IntegrityError

from scolarite import models
from scolarite.tests import factories as f

pytestmark = pytest.mark.django_db


def test_db_tables():
    assert models.ModalitePaiement._meta.db_table == "modalite_paiement"
    assert models.Echeance._meta.db_table == "echeance"


def test_montant_total_est_genere():
    m = f.ModalitePaiementFactory(
        montant_inscription_reinscription=105000,
        nombre_echeance=9,
        montant_echeance=70000,
    )
    m.refresh_from_db()
    assert m.montant_total == 735000


def test_unq_modalite_paiement():
    m = f.ModalitePaiementFactory()
    with pytest.raises(IntegrityError):
        f.ModalitePaiementFactory(
            niveau=m.niveau, annee_scolaire=m.annee_scolaire
        )


def test_unq_echeance():
    e = f.EcheanceFactory(numero=0)
    with pytest.raises(IntegrityError):
        f.EcheanceFactory(inscription=e.inscription, numero=0)
```

- [ ] **Step 5: RED**

Run: `cd backend && DB_USER=root pytest scolarite -q`
Expected: FAIL — app non enregistrée / migrations absentes.

- [ ] **Step 6: Migration + diff**

Run:
```
cd backend && python manage.py makemigrations scolarite
python manage.py makemigrations --check --dry-run          # No changes detected
python manage.py sqlmigrate scolarite 0001
```
Comparer aux blocs `modalite_paiement` + `echeance` de `db/migrations/004`. Écarts : `bigint` vs `INT UNSIGNED` ; `GENERATED ALWAYS AS (...) STORED` doit apparaître pour `montant_total` (vérifier — sinon `db_persist=True` mal pris) ; audit `echeance` via Django ; FK `related_name="+"`. Consigner.

- [ ] **Step 7: GREEN**

Run: `cd backend && DB_USER=root pytest scolarite -q`
Expected: PASS (4).

- [ ] **Step 8: Portes + commit**

Run: `cd backend && ruff check . && python manage.py check && DB_USER=root pytest -q` → vert.
```bash
git add backend/scolarite backend/config/settings/base.py backend/pyproject.toml
git commit -m "$(cat <<'EOF'
feat(scolarite): app + modeles ModalitePaiement (montant_total genere) + Echeance

Portage db/migrations/004. Echeance herite de core.Auditable. montant_total =
GeneratedField(db_persist=True) (D-ORM-5 / D-P3-4). Unicites unq_modalite_paiement,
unq_echeance.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015vBabiytJuWPjuDR2qUfCf
EOF
)"
```

**Critère d'acceptation :** `montant_total` relu depuis la BDD = `I + N*M` ; unicités ; `sqlmigrate` montre `GENERATED ... STORED` ; portes vertes.

---

## Task 5 : Service `generer_echeancier`

**Files:**
- Create: `backend/scolarite/services.py`, `backend/scolarite/tests/test_services.py`

**Interfaces:**
- Consumes: `scolarite.models.{ModalitePaiement, Echeance}`, `personnes.models.Inscription`.
- Produces:
  - `scolarite.services._ajouter_mois(d: date, k: int) -> date` — ajoute `k` mois à `d`, en bornant le jour au dernier jour du mois cible (stdlib `calendar.monthrange`).
  - `scolarite.services.generer_echeancier(inscription) -> list[Echeance]` — crée et retourne les N+1 échéances selon RE-1..RE-5. Lève `rest_framework.serializers.ValidationError` (FR) si la grille `(classe.niveau, annee_scolaire)` est absente, ou si `cout_scolarite_negocie` < `montant_inscription_reinscription`. `cree_par` recopié de `inscription.cree_par`.

- [ ] **Step 1: Écrire les tests**

`backend/scolarite/tests/test_services.py` :
```python
import datetime as dt

import pytest
from rest_framework.serializers import ValidationError

from personnes.tests import factories as pf
from scolarite import models, services
from scolarite.tests import factories as f

pytestmark = pytest.mark.django_db


def _inscription_avec_grille(**insc):
    i = pf.InscriptionFactory(date_inscription="2025-10-01", **insc)
    f.ModalitePaiementFactory(
        niveau=i.classe.niveau,
        annee_scolaire=i.annee_scolaire,
        montant_inscription_reinscription=105000,
        nombre_echeance=9,
        montant_echeance=70000,
    )
    return i


def test_ajouter_mois_borne_le_jour():
    assert services._ajouter_mois(dt.date(2025, 1, 31), 1) == dt.date(2025, 2, 28)
    assert services._ajouter_mois(dt.date(2025, 10, 1), 3) == dt.date(2026, 1, 1)
    assert services._ajouter_mois(dt.date(2025, 10, 1), 0) == dt.date(2025, 10, 1)


def test_echeancier_grille_standard():
    i = _inscription_avec_grille()
    ech = services.generer_echeancier(i)
    assert [e.numero for e in ech] == list(range(10))
    assert ech[0].montant_prevu == 105000
    assert all(e.montant_prevu == 70000 for e in ech[1:])
    assert ech[1].date_prevue == dt.date(2025, 11, 1)
    assert models.Echeance.objects.filter(inscription=i).count() == 10


def test_echeancier_negocie_repartit_le_reste():
    i = _inscription_avec_grille(cout_scolarite_negocie=600000)
    ech = services.generer_echeancier(i)
    assert ech[0].montant_prevu == 105000
    assert [int(e.montant_prevu) for e in ech[1:]] == [55000] * 9
    assert sum(int(e.montant_prevu) for e in ech) == 600000


def test_echeancier_negocie_arrondi_sur_derniere():
    i = _inscription_avec_grille(cout_scolarite_negocie=205000)  # reste = 100000, N=9
    ech = services.generer_echeancier(i)
    montants = [int(e.montant_prevu) for e in ech[1:]]
    assert montants[:8] == [11111] * 8
    assert montants[8] == 100000 - 11111 * 8  # 11112
    assert sum(int(e.montant_prevu) for e in ech) == 205000


def test_echeancier_boursier_marque_1_a_N():
    i = _inscription_avec_grille(est_boursier=True)
    ech = services.generer_echeancier(i)
    assert ech[0].pris_en_charge_bourse is False
    assert all(e.pris_en_charge_bourse for e in ech[1:])


def test_echeancier_sans_grille_leve_400():
    i = pf.InscriptionFactory()
    with pytest.raises(ValidationError):
        services.generer_echeancier(i)


def test_echeancier_negocie_inferieur_a_inscription_leve_400():
    i = _inscription_avec_grille(cout_scolarite_negocie=50000)  # < 105000
    with pytest.raises(ValidationError):
        services.generer_echeancier(i)
```

- [ ] **Step 2: RED**

Run: `cd backend && DB_USER=root pytest scolarite/tests/test_services.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'scolarite.services'`.

- [ ] **Step 3: Implémenter `scolarite/services.py`**

```python
import calendar
import datetime as dt

from rest_framework import serializers

from .models import Echeance, ModalitePaiement


def _ajouter_mois(d: dt.date, k: int) -> dt.date:
    total = d.month - 1 + k
    annee = d.year + total // 12
    mois = total % 12 + 1
    dernier = calendar.monthrange(annee, mois)[1]
    return dt.date(annee, mois, min(d.day, dernier))


def generer_echeancier(inscription) -> list:
    try:
        grille = ModalitePaiement.objects.get(
            niveau=inscription.classe.niveau,
            annee_scolaire=inscription.annee_scolaire,
        )
    except ModalitePaiement.DoesNotExist as exc:
        raise serializers.ValidationError(
            {
                "detail": "Aucune grille tarifaire (modalité de paiement) pour ce "
                "niveau et cette année. Créez-la avant d'inscrire."
            }
        ) from exc

    i_montant = int(grille.montant_inscription_reinscription)
    n = int(grille.nombre_echeance)

    if inscription.cout_scolarite_negocie is not None:
        total = int(inscription.cout_scolarite_negocie)
        if total < i_montant:
            raise serializers.ValidationError(
                {
                    "cout_scolarite_negocie": "Le coût négocié ne peut être "
                    "inférieur au montant d'inscription de la grille "
                    f"({i_montant})."
                }
            )
        reste = total - i_montant
        base = reste // n
        montants = [base] * (n - 1) + [reste - base * (n - 1)]
    else:
        montants = [int(grille.montant_echeance)] * n

    d0 = inscription.date_inscription
    lignes = [
        Echeance(
            inscription=inscription,
            numero=0,
            montant_prevu=i_montant,
            date_prevue=d0,
            pris_en_charge_bourse=False,
            cree_par=inscription.cree_par,
        )
    ]
    for k, montant in enumerate(montants, start=1):
        lignes.append(
            Echeance(
                inscription=inscription,
                numero=k,
                montant_prevu=montant,
                date_prevue=_ajouter_mois(d0, k),
                pris_en_charge_bourse=inscription.est_boursier,
                cree_par=inscription.cree_par,
            )
        )
    Echeance.objects.bulk_create(lignes)
    return lignes
```

- [ ] **Step 4: GREEN**

Run: `cd backend && DB_USER=root pytest scolarite/tests/test_services.py -q`
Expected: PASS (7).

- [ ] **Step 5: Portes + commit**

Run: `cd backend && ruff check . && DB_USER=root pytest scolarite personnes -q` → vert.
```bash
git add backend/scolarite/services.py backend/scolarite/tests/test_services.py
git commit -m "$(cat <<'EOF'
feat(scolarite): service generer_echeancier (grille ou cout negocie reparti)

Echeance 0 = montant_inscription. Sans cout negocie : 1..N a montant_echeance.
Avec T : reste = T - I reparti en N parts entieres, derniere echeance absorbe
l'arrondi (somme = T). pris_en_charge_bourse = est_boursier sur 1..N. dates =
date_inscription + k mois (jour borne). Grille absente ou T < I -> 400.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015vBabiytJuWPjuDR2qUfCf
EOF
)"
```

**Critère d'acceptation :** échéancier grille + négocié (avec et sans reste divisible) ; flag boursier ; dates mensuelles ; 400 grille absente ; 400 `T < I` ; somme exacte.

---

## Task 6 : Serializers (personnes + scolarite)

**Files:**
- Modify: `backend/personnes/serializers.py`, `backend/personnes/tests/test_serializers.py`
- Create: `backend/scolarite/serializers.py`, `backend/scolarite/tests/test_serializers.py`

**Interfaces:**
- Consumes: `core.serializers.AuditableSerializerMixin`, `personnes.services.attribuer_numero_ordre`, `scolarite.services.generer_echeancier`.
- Produces:
  - `personnes.serializers.InscriptionListSerializer` — `ModelSerializer`, champs plats + `etudiant_libelle` (`source="etudiant.__str__"`, read-only), `classe_libelle` (`source="classe.__str__"`), `ecole_libelle` (`source="ecole.__str__"`).
  - `personnes.serializers.InscriptionSerializer(AuditableSerializerMixin, ModelSerializer)` — `fields="__all__"` ; `read_only_fields = ["ecole", "annee_scolaire", "numero_ordre", "cree_par", "modifie_par", "cree_le", "modifie_le"]` ; `type`/`statut` `required=False` ; `echeances = EcheanceSerializer(many=True, read_only=True)`, `pieces_dossier = PieceDossierSerializer(many=True, read_only=True)`. `__init__` : si `self.instance` → `self.fields["classe"].read_only = True`. `create()` = transaction §8.1 (dérive `ecole`/`annee_scolaire`, défaut `type`/`statut`, `attribuer_numero_ordre`, save via `super().create`, `generer_echeancier`). `update()` : hérité (`AuditableSerializerMixin.update` pose `modifie_par`).
  - `personnes.serializers.PieceDossierSerializer` — plat.
  - `scolarite.serializers.{ModalitePaiementSerializer, EcheanceSerializer}` — `ModalitePaiementSerializer` : `montant_total` `read_only`. `EcheanceSerializer` : `AuditableSerializerMixin`, champs audit read-only.

> **Import circulaire** : `personnes.serializers` importe `EcheanceSerializer` depuis `scolarite.serializers`, et `scolarite.serializers` n'importe rien de `personnes.serializers` → OK. `scolarite.services` importe des modèles `personnes` (pas de serializer) → OK.

- [ ] **Step 1: Écrire `scolarite/serializers.py`**

```python
from rest_framework import serializers

from core.serializers import AuditableSerializerMixin

from . import models

_AUDIT = ["cree_par", "modifie_par", "cree_le", "modifie_le"]


class ModalitePaiementSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.ModalitePaiement
        fields = "__all__"
        read_only_fields = ["montant_total"]


class EcheanceSerializer(AuditableSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = models.Echeance
        fields = "__all__"
        read_only_fields = _AUDIT
```

- [ ] **Step 2: Écrire `scolarite/tests/test_serializers.py`**

```python
import pytest

from scolarite.serializers import EcheanceSerializer, ModalitePaiementSerializer

pytestmark = pytest.mark.django_db


def test_montant_total_read_only():
    assert ModalitePaiementSerializer().fields["montant_total"].read_only is True


def test_echeance_audit_read_only():
    f = EcheanceSerializer().fields
    for nom in ("cree_par", "modifie_par", "cree_le", "modifie_le"):
        assert f[nom].read_only is True
```

- [ ] **Step 3: Étendre `personnes/serializers.py`**

Imports : `from scolarite.serializers import EcheanceSerializer` ; `from core.serializers import AuditableSerializerMixin` ; `from .services import attribuer_numero_ordre` ; `from scolarite.services import generer_echeancier`.

```python
class PieceDossierSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.PieceDossier
        fields = "__all__"


class InscriptionListSerializer(serializers.ModelSerializer):
    etudiant_libelle = serializers.CharField(source="etudiant.__str__", read_only=True)
    classe_libelle = serializers.CharField(source="classe.__str__", read_only=True)
    ecole_libelle = serializers.CharField(source="ecole.__str__", read_only=True)

    class Meta:
        model = models.Inscription
        fields = "__all__"


class InscriptionSerializer(AuditableSerializerMixin, serializers.ModelSerializer):
    echeances = EcheanceSerializer(many=True, read_only=True)
    pieces_dossier = PieceDossierSerializer(many=True, read_only=True)

    class Meta:
        model = models.Inscription
        fields = "__all__"
        read_only_fields = [
            "ecole",
            "annee_scolaire",
            "numero_ordre",
            "cree_par",
            "modifie_par",
            "cree_le",
            "modifie_le",
        ]
        extra_kwargs = {
            "type": {"required": False},
            "statut": {"required": False},
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance is not None:
            self.fields["classe"].read_only = True

    def create(self, validated_data):
        classe = validated_data["classe"]
        validated_data["ecole"] = classe.niveau.ecole
        validated_data["annee_scolaire"] = classe.annee_scolaire
        etudiant = validated_data["etudiant"]
        if not validated_data.get("type") or not validated_data.get("statut"):
            anterieure = models.Inscription.objects.filter(etudiant=etudiant).exists()
            validated_data.setdefault(
                "type",
                models.Inscription.Type.REINSCRIPTION
                if anterieure
                else models.Inscription.Type.INSCRIPTION,
            )
            validated_data.setdefault(
                "statut",
                models.Inscription.Statut.ANCIEN
                if anterieure
                else models.Inscription.Statut.NOUVEAU,
            )
        validated_data["numero_ordre"] = attribuer_numero_ordre(
            validated_data["ecole"], validated_data["annee_scolaire"]
        )
        inscription = super().create(validated_data)  # pose cree_par (mixin)
        generer_echeancier(inscription)
        return inscription
```

> **Transaction** : `create()` est appelé par `InscriptionViewSet.perform_create` qui l'enveloppe dans `transaction.atomic()` (Task 8). Ne pas décorer `create()` lui-même — la validation DRF doit rester hors transaction.

- [ ] **Step 4: Tests `personnes/tests/test_serializers.py`**

Ajouter :
```python
def _ctx(user=None):
    from rest_framework.test import APIRequestFactory

    req = APIRequestFactory().post("/x")
    req.user = user
    return {"request": req}


def test_inscription_derive_ecole_annee_et_numero(db):
    from comptes.tests.factories import UtilisateurFactory
    from personnes.serializers import InscriptionSerializer
    from referentiel.tests import factories as rf
    from scolarite.tests import factories as sf

    u = UtilisateurFactory()
    classe = rf.ClasseFactory()
    sf.ModalitePaiementFactory(
        niveau=classe.niveau, annee_scolaire=classe.annee_scolaire
    )
    etu = f.EtudiantFactory()
    s = InscriptionSerializer(
        data={
            "etudiant": etu.pk,
            "classe": classe.pk,
            "date_inscription": "2025-10-01",
        },
        context=_ctx(u),
    )
    assert s.is_valid(), s.errors
    insc = s.save()
    assert insc.ecole_id == classe.niveau.ecole_id
    assert insc.annee_scolaire_id == classe.annee_scolaire_id
    assert insc.numero_ordre == 1
    assert insc.type == "INSCRIPTION" and insc.statut == "NOUVEAU"
    assert insc.cree_par_id == u.pk
    assert insc.echeances.count() == 10


def test_inscription_type_reinscription_si_anterieure(db):
    from comptes.tests.factories import UtilisateurFactory
    from personnes.serializers import InscriptionSerializer
    from referentiel.tests import factories as rf
    from scolarite.tests import factories as sf

    etu = f.EtudiantFactory()
    f.InscriptionFactory(etudiant=etu)  # inscription antérieure
    classe = rf.ClasseFactory()
    sf.ModalitePaiementFactory(
        niveau=classe.niveau, annee_scolaire=classe.annee_scolaire
    )
    s = InscriptionSerializer(
        data={"etudiant": etu.pk, "classe": classe.pk, "date_inscription": "2025-10-01"},
        context=_ctx(UtilisateurFactory()),
    )
    assert s.is_valid(), s.errors
    insc = s.save()
    assert insc.type == "REINSCRIPTION" and insc.statut == "ANCIEN"


def test_inscription_classe_read_only_en_update(db):
    i = f.InscriptionFactory()
    from personnes.serializers import InscriptionSerializer

    s = InscriptionSerializer(i)
    assert s.fields["classe"].read_only is True
    for nom in ("ecole", "annee_scolaire", "numero_ordre", "cree_par"):
        assert s.fields[nom].read_only is True
```

- [ ] **Step 5: RED puis GREEN**

Run: `cd backend && DB_USER=root pytest scolarite/tests/test_serializers.py personnes/tests/test_serializers.py -q`
Expected: d'abord FAIL (imports), après implémentation PASS.

- [ ] **Step 6: Portes + commit**

Run: `cd backend && ruff check . && DB_USER=root pytest -q` → vert.
```bash
git add backend/personnes/serializers.py backend/personnes/tests/test_serializers.py backend/scolarite/serializers.py backend/scolarite/tests/test_serializers.py
git commit -m "$(cat <<'EOF'
feat(personnes,scolarite): serializers inscription (transaction) + echeance/modalite

InscriptionSerializer : derive ecole/annee de la classe, defaut type/statut
(inscription anterieure), attribue numero_ordre, genere l'echeancier ; classe
read-only en MAJ ; audit read-only. EcheanceSerializer/ModalitePaiementSerializer.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015vBabiytJuWPjuDR2qUfCf
EOF
)"
```

**Critère d'acceptation :** création dérive `ecole`/`annee`/`numero_ordre`, pose `cree_par`, crée 10 échéances ; `type`/`statut` déduits ; `classe` + dénormalisés + audit read-only ; `montant_total` read-only.

---

## Task 7 : Permissions + FilterSets

**Files:**
- Modify: `backend/personnes/permissions.py`, `backend/personnes/filters.py`, `backend/personnes/tests/test_permissions_unit.py`
- Create: `backend/scolarite/permissions.py`, `backend/scolarite/filters.py`, `backend/scolarite/tests/test_permissions_unit.py`

**Interfaces:**
- Produces:
  - `personnes.permissions.PeutEcrireInscriptions` — écriture `{DIRECTION, SCOLARITE}`.
  - `scolarite.permissions.PeutEcrireTarifs` — écriture `{DIRECTION}`.
  - `scolarite.permissions.PeutEcrireFraisEleve` — écriture `{DIRECTION, DAF, COMPTABLE}`.
  - `personnes.filters.{InscriptionFilter, PieceDossierFilter}`, `scolarite.filters.{ModalitePaiementFilter, EcheanceFilter}`.

- [ ] **Step 1: Tests permissions**

Ajouter à `personnes/tests/test_permissions_unit.py` (réutilise `_user_avec`, `_rf`) :
```python
@pytest.mark.parametrize(
    "code,attendu",
    [("DIRECTION", True), ("SCOLARITE", True), ("DAF", False), ("COMPTABLE", False)],
)
def test_ecriture_inscriptions(code, attendu):
    from personnes.permissions import PeutEcrireInscriptions

    req = _rf.post("/x")
    req.user = _user_avec(code)
    assert PeutEcrireInscriptions().has_permission(req, None) is attendu
```

`backend/scolarite/tests/test_permissions_unit.py` :
```python
import pytest
from rest_framework.test import APIRequestFactory

from comptes.models import Role, UtilisateurRole
from comptes.tests.factories import UtilisateurFactory
from scolarite.permissions import PeutEcrireFraisEleve, PeutEcrireTarifs

pytestmark = pytest.mark.django_db
_rf = APIRequestFactory()


def _user_avec(*codes):
    u = UtilisateurFactory()
    for c in codes:
        r, _ = Role.objects.get_or_create(code=c, defaults={"libelle": c})
        UtilisateurRole.objects.create(utilisateur=u, role=r)
    return u


@pytest.mark.parametrize(
    "code,attendu",
    [("DIRECTION", True), ("DAF", False), ("COMPTABLE", False), ("SCOLARITE", False)],
)
def test_tarifs_direction_seule(code, attendu):
    req = _rf.post("/x")
    req.user = _user_avec(code)
    assert PeutEcrireTarifs().has_permission(req, None) is attendu


@pytest.mark.parametrize(
    "code,attendu",
    [("DIRECTION", True), ("DAF", True), ("COMPTABLE", True), ("SCOLARITE", False)],
)
def test_frais_eleve(code, attendu):
    req = _rf.post("/x")
    req.user = _user_avec(code)
    assert PeutEcrireFraisEleve().has_permission(req, None) is attendu


def test_lecture_ouverte():
    req = _rf.get("/x")
    req.user = _user_avec("LECTURE")
    assert PeutEcrireTarifs().has_permission(req, None) is True
    assert PeutEcrireFraisEleve().has_permission(req, None) is True
```

- [ ] **Step 2: RED**

Run: `cd backend && DB_USER=root pytest scolarite/tests/test_permissions_unit.py personnes/tests/test_permissions_unit.py -q`
Expected: FAIL — imports.

- [ ] **Step 3: `personnes/permissions.py`** — ajouter :
```python
_EcritInscriptions = ARole("DIRECTION", "SCOLARITE")


class PeutEcrireInscriptions(BasePermission):
    message = "Rôle DIRECTION ou SCOLARITE requis pour les inscriptions."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return _EcritInscriptions().has_permission(request, view)
```

- [ ] **Step 4: `scolarite/permissions.py`** :
```python
from rest_framework.permissions import SAFE_METHODS, BasePermission

from comptes.permissions import ARole

_EcritTarifs = ARole("DIRECTION")
_EcritFraisEleve = ARole("DIRECTION", "DAF", "COMPTABLE")


class _BasePerm(BasePermission):
    _arole = None
    message = "Rôle insuffisant."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return self._arole().has_permission(request, view)


class PeutEcrireTarifs(_BasePerm):
    _arole = _EcritTarifs
    message = "Rôle DIRECTION requis pour la grille tarifaire."


class PeutEcrireFraisEleve(_BasePerm):
    _arole = _EcritFraisEleve
    message = "Rôle COMPTABLE, DAF ou DIRECTION requis."
```

- [ ] **Step 5: `personnes/filters.py`** — ajouter :
```python
class InscriptionFilter(df.FilterSet):
    class Meta:
        model = models.Inscription
        fields = {
            "etudiant": ["exact"],
            "classe": ["exact"],
            "ecole": ["exact"],
            "annee_scolaire": ["exact"],
            "type": ["exact"],
            "statut": ["exact"],
            "etat": ["exact"],
            "est_boursier": ["exact"],
        }


class PieceDossierFilter(df.FilterSet):
    class Meta:
        model = models.PieceDossier
        fields = {"inscription": ["exact"], "type_piece": ["exact"], "fournie": ["exact"]}
```

- [ ] **Step 6: `scolarite/filters.py`** :
```python
import django_filters as df

from . import models


class ModalitePaiementFilter(df.FilterSet):
    class Meta:
        model = models.ModalitePaiement
        fields = {"niveau": ["exact"], "annee_scolaire": ["exact"]}


class EcheanceFilter(df.FilterSet):
    class Meta:
        model = models.Echeance
        fields = {
            "inscription": ["exact"],
            "numero": ["exact"],
            "pris_en_charge_bourse": ["exact"],
        }
```

- [ ] **Step 7: GREEN + portes + commit**

Run: `cd backend && ruff check . && python manage.py check && DB_USER=root pytest scolarite personnes -q` → vert.
```bash
git add backend/personnes/permissions.py backend/personnes/filters.py backend/personnes/tests/test_permissions_unit.py backend/scolarite/permissions.py backend/scolarite/filters.py backend/scolarite/tests/test_permissions_unit.py
git commit -m "$(cat <<'EOF'
feat(personnes,scolarite): permissions (Inscriptions / Tarifs / FraisEleve) + FilterSets

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015vBabiytJuWPjuDR2qUfCf
EOF
)"
```

**Critère d'acceptation :** matrices RBAC vertes (inscriptions = DIRECTION/SCOLARITE ; tarifs = DIRECTION ; frais-élève = DIRECTION/DAF/COMPTABLE ; lecture ouverte) ; 4 FilterSets.

---

## Task 8 : ViewSets + routers + OpenAPI + types front

**Files:**
- Modify: `backend/personnes/views.py`, `backend/personnes/urls.py`, `backend/config/urls.py`, `backend/personnes/tests/test_api.py`
- Create: `backend/scolarite/views.py`, `backend/scolarite/urls.py`, `backend/scolarite/tests/test_api.py`
- Modify: `frontend/src/api/schema.d.ts` (via `gen:api`)

**Interfaces:**
- Consumes: `core.viewsets._BaseCrudViewSet`, tous les serializers/permissions/filters ci-dessus, `django.db.transaction`.
- Produces (namespace `v1:`) :
  - `personnes/inscriptions` → `InscriptionViewSet` : `queryset` avec `select_related("etudiant","classe__niveau__ecole","annee_scolaire","cree_par","modifie_par")` + `prefetch_related("echeances","pieces_dossier")` ; `permission_classes=[PeutEcrireInscriptions]` ; `filterset_class=InscriptionFilter` ; `search_fields=["numero_ordre","etudiant__matricule","etudiant__nom"]` ; `ordering_fields=["numero_ordre","date_inscription","id"]` ; `get_serializer_class` list≠detail ; `perform_create` **enveloppé dans `transaction.atomic()`**.
  - `personnes/pieces-dossier` → `PieceDossierViewSet` : `PieceDossierSerializer`, `PieceDossierFilter`, `permission_classes=[PeutEcrireInscriptions]`.
  - `scolarite/modalites-paiement` → `ModalitePaiementViewSet` (`PeutEcrireTarifs`), `scolarite/echeances` → `EcheanceViewSet` (`PeutEcrireFraisEleve`).

- [ ] **Step 1: Écrire `personnes/tests/test_api.py` (ajouts)**

```python
def _grille(classe, **kw):
    from scolarite.tests import factories as sf

    return sf.ModalitePaiementFactory(
        niveau=classe.niveau, annee_scolaire=classe.annee_scolaire, **kw
    )


def test_creation_inscription_transaction_complete():
    from referentiel.tests import factories as rf

    c, _ = _client(Role.Code.SCOLARITE)
    classe = rf.ClasseFactory()
    _grille(classe)
    etu = f.EtudiantFactory()
    resp = c.post(
        "/api/v1/personnes/inscriptions/",
        {"etudiant": etu.pk, "classe": classe.pk, "date_inscription": "2025-10-01"},
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["numero_ordre"] == 1
    assert resp.data["ecole"] == classe.niveau.ecole_id
    assert len(resp.data["echeances"]) == 10
    assert JournalAudit.objects.filter(
        action="CREATION", table_cible="inscription"
    ).count() == 1


def test_creation_inscription_sans_grille_400_et_rollback():
    from referentiel.tests import factories as rf
    from personnes.models import Inscription

    c, _ = _client(Role.Code.SCOLARITE)
    classe = rf.ClasseFactory()  # pas de grille
    etu = f.EtudiantFactory()
    resp = c.post(
        "/api/v1/personnes/inscriptions/",
        {"etudiant": etu.pk, "classe": classe.pk, "date_inscription": "2025-10-01"},
        format="json",
    )
    assert resp.status_code == 400
    assert Inscription.objects.count() == 0  # rollback total


def test_creation_inscription_cout_negocie():
    from referentiel.tests import factories as rf

    c, _ = _client(Role.Code.SCOLARITE)
    classe = rf.ClasseFactory()
    _grille(classe)
    etu = f.EtudiantFactory()
    resp = c.post(
        "/api/v1/personnes/inscriptions/",
        {
            "etudiant": etu.pk,
            "classe": classe.pk,
            "date_inscription": "2025-10-01",
            "cout_scolarite_negocie": 600000,
        },
        format="json",
    )
    assert resp.status_code == 201
    montants = sorted(e["montant_prevu"] for e in resp.data["echeances"])
    assert sum(int(m) for m in montants) == 600000


def test_patch_inscription_refuse_classe_et_numero():
    from referentiel.tests import factories as rf

    c, _ = _client(Role.Code.SCOLARITE)
    i = f.InscriptionFactory()
    autre_classe = rf.ClasseFactory()
    resp = c.patch(
        f"/api/v1/personnes/inscriptions/{i.pk}/",
        {"numero_ordre": 999, "classe": autre_classe.pk, "etat": "ABANDON"},
        format="json",
    )
    assert resp.status_code == 200
    i.refresh_from_db()
    assert i.numero_ordre != 999
    assert i.classe_id != autre_classe.pk  # `classe` read-only en MAJ
    assert i.etat == "ABANDON"


def test_suppression_inscription_avec_echeances_409_sans_audit():
    from scolarite.tests import factories as sf

    c, _ = _client(Role.Code.DIRECTION)
    i = f.InscriptionFactory()
    sf.EcheanceFactory(inscription=i, numero=0)
    resp = c.delete(f"/api/v1/personnes/inscriptions/{i.pk}/")
    assert resp.status_code == 409
    assert not JournalAudit.objects.filter(
        action="SUPPRESSION", table_cible="inscription"
    ).exists()


def test_suppression_inscription_sans_enfant_204():
    c, _ = _client(Role.Code.DIRECTION)
    i = f.InscriptionFactory()  # factory : pas d'échéance
    assert c.delete(f"/api/v1/personnes/inscriptions/{i.pk}/").status_code == 204


@pytest.mark.parametrize(
    "role,attendu",
    [("SCOLARITE", 201), ("DIRECTION", 201), ("COMPTABLE", 403), ("DAF", 403)],
)
def test_rbac_inscriptions(role, attendu):
    from referentiel.tests import factories as rf

    c, _ = _client(role)
    classe = rf.ClasseFactory()
    _grille(classe)
    resp = c.post(
        "/api/v1/personnes/inscriptions/",
        {
            "etudiant": f.EtudiantFactory().pk,
            "classe": classe.pk,
            "date_inscription": "2025-10-01",
        },
        format="json",
    )
    assert resp.status_code == attendu
```

- [ ] **Step 2: `personnes/views.py` (ajouts)**

```python
from django.db import transaction
# ... imports existants ...


class InscriptionViewSet(_BasePersonnesViewSet):
    permission_classes = [permissions.PeutEcrireInscriptions]
    queryset = models.Inscription.objects.select_related(
        "etudiant", "classe__niveau__ecole", "annee_scolaire", "cree_par", "modifie_par"
    ).prefetch_related("echeances", "pieces_dossier")
    filterset_class = p_filters.InscriptionFilter
    search_fields = ["numero_ordre", "etudiant__matricule", "etudiant__nom"]
    ordering_fields = ["numero_ordre", "date_inscription", "id"]

    def get_serializer_class(self):
        if self.action == "list":
            return serializers.InscriptionListSerializer
        return serializers.InscriptionSerializer

    def perform_create(self, serializer):
        with transaction.atomic():
            super().perform_create(serializer)  # AuditLogMixin.perform_create


class PieceDossierViewSet(_BasePersonnesViewSet):
    permission_classes = [permissions.PeutEcrireInscriptions]
    queryset = models.PieceDossier.objects.select_related("inscription", "type_piece")
    serializer_class = serializers.PieceDossierSerializer
    filterset_class = p_filters.PieceDossierFilter
    ordering_fields = ["id"]
```

> `_BasePersonnesViewSet` a `permission_classes = [PeutEcrirePersonnes]` par défaut (Phase 2) ; on le surcharge explicitement ici avec `PeutEcrireInscriptions`.

- [ ] **Step 3: `personnes/urls.py`** — ajouter :
```python
router.register("inscriptions", views.InscriptionViewSet)
router.register("pieces-dossier", views.PieceDossierViewSet)
```

- [ ] **Step 4: `scolarite/views.py`** :
```python
from drf_spectacular.utils import extend_schema

from core.viewsets import _BaseCrudViewSet

from . import filters as s_filters
from . import models, permissions, serializers


@extend_schema(tags=["scolarite"])
class _BaseScolariteViewSet(_BaseCrudViewSet):
    pass


class ModalitePaiementViewSet(_BaseScolariteViewSet):
    permission_classes = [permissions.PeutEcrireTarifs]
    queryset = models.ModalitePaiement.objects.select_related(
        "niveau", "annee_scolaire"
    )
    serializer_class = serializers.ModalitePaiementSerializer
    filterset_class = s_filters.ModalitePaiementFilter
    ordering_fields = ["id"]


class EcheanceViewSet(_BaseScolariteViewSet):
    permission_classes = [permissions.PeutEcrireFraisEleve]
    queryset = models.Echeance.objects.select_related(
        "inscription", "cree_par", "modifie_par"
    )
    serializer_class = serializers.EcheanceSerializer
    filterset_class = s_filters.EcheanceFilter
    ordering_fields = ["numero", "date_prevue", "id"]
```

- [ ] **Step 5: `scolarite/urls.py`** :
```python
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("modalites-paiement", views.ModalitePaiementViewSet)
router.register("echeances", views.EcheanceViewSet)

urlpatterns = router.urls
```

- [ ] **Step 6: `config/urls.py`** — ajouter dans `api_v1`, après `personnes/` :
```python
    path("scolarite/", include("scolarite.urls")),
```

- [ ] **Step 7: `scolarite/tests/test_api.py`** :
```python
import pytest
from rest_framework.test import APIClient

from comptes.models import Role, UtilisateurRole
from comptes.tests.factories import UtilisateurFactory
from referentiel.tests import factories as rf

pytestmark = pytest.mark.django_db


def _client(role_code=None):
    u = UtilisateurFactory()
    if role_code:
        r, _ = Role.objects.get_or_create(code=role_code, defaults={"libelle": role_code})
        UtilisateurRole.objects.create(utilisateur=u, role=r)
    c = APIClient()
    c.force_authenticate(u)
    return c, u


@pytest.mark.parametrize(
    "role,attendu",
    [("DIRECTION", 201), ("DAF", 403), ("SCOLARITE", 403), ("COMPTABLE", 403)],
)
def test_rbac_modalite_paiement(role, attendu):
    c, _ = _client(role)
    n, a = rf.NiveauFactory(), rf.AnneeScolaireFactory()
    resp = c.post(
        "/api/v1/scolarite/modalites-paiement/",
        {
            "niveau": n.pk,
            "annee_scolaire": a.pk,
            "montant_inscription_reinscription": 105000,
            "nombre_echeance": 9,
            "montant_echeance": 70000,
        },
        format="json",
    )
    assert resp.status_code == attendu
    if attendu == 201:
        assert resp.data["montant_total"] == "735000"


@pytest.mark.parametrize(
    "role,attendu",
    [("DIRECTION", 200), ("DAF", 200), ("COMPTABLE", 200), ("SCOLARITE", 403)],
)
def test_rbac_echeance_patch(role, attendu):
    from scolarite.tests import factories as sf

    c, _ = _client(role)
    e = sf.EcheanceFactory(numero=1)
    resp = c.patch(
        f"/api/v1/scolarite/echeances/{e.pk}/", {"montant_prevu": 60000}, format="json"
    )
    assert resp.status_code == attendu
    if attendu == 200:
        assert e.__class__.objects.get(pk=e.pk).modifie_par is not None
```

- [ ] **Step 8: RED → GREEN**

Run: `cd backend && DB_USER=root pytest personnes/tests/test_api.py scolarite/tests/test_api.py -q`
Expected: FAIL puis, après implémentation, PASS.

- [ ] **Step 9: OpenAPI**

Run: `cd backend && python manage.py spectacular --file /tmp/schema.yml`
Expected: **0 Error / 0 Warning**. Si warning sur `InscriptionViewSet` (double serializer) : `@extend_schema_view(list=extend_schema(responses=serializers.InscriptionListSerializer), retrieve=extend_schema(responses=serializers.InscriptionSerializer))` sur la classe.

- [ ] **Step 10: `gen:api`**

Terminal A : `cd backend && source .venv/bin/activate && python manage.py runserver 0.0.0.0:8000 --noreload`
Terminal B : `cd frontend && npm run gen:api` ; arrêter le serveur.
Vérifier `git diff --stat frontend/src/api/schema.d.ts` → schémas `Inscription`, `Echeance`, `ModalitePaiement`, `PieceDossier`.

- [ ] **Step 11: Portes**

Run:
```
cd backend && ruff check . && python manage.py check && python manage.py makemigrations --check --dry-run && DB_USER=root pytest -q
cd ../frontend && npm run typecheck
```
Expected: vert. `pytest` ≈ 123 + (serializers/permissions/api ajoutés) ≈ **150+ passed**.

- [ ] **Step 12: Commit**

```bash
git add backend/personnes/views.py backend/personnes/urls.py backend/config/urls.py backend/personnes/tests/test_api.py backend/scolarite/views.py backend/scolarite/urls.py backend/scolarite/tests/test_api.py frontend/src/api/schema.d.ts
git commit -m "$(cat <<'EOF'
feat(personnes,scolarite): API inscriptions + pieces-dossier + /scolarite/ (modalites-paiement, echeances)

InscriptionViewSet : perform_create sous transaction.atomic (inscription +
numero_ordre + echeancier) ; serializer liste/detail distinct ; 409 sans audit
sur suppression referencee. Routers scolarite montes. OpenAPI 0 Error, gen:api.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015vBabiytJuWPjuDR2qUfCf
EOF
)"
```

**Critère d'acceptation :** `POST /personnes/inscriptions/` crée l'inscription + 10 échéances + audit ; grille absente → 400 + 0 inscription ; coût négocié réparti ; PATCH refuse `classe`/`numero_ordre` ; DELETE avec échéances → 409 sans audit ; RBAC des 4 ressources ; `spectacular` 0 Error ; `typecheck` front vert.

---

## Task 9 : Frontend — écrans scaffold + routes + sidebar

**Files:**
- Create: `frontend/src/personnes/config/inscription.tsx`, `config/pieceDossier.tsx`,
  `frontend/src/scolarite/config/modalitePaiement.tsx`, `scolarite/config/echeance.tsx`,
  `frontend/src/scolarite/routes.tsx`, `frontend/src/personnes/FicheInscription.tsx` (stub),
  + tests `personnes/config/inscription.test.tsx`, `config/pieceDossier.test.tsx`,
  `scolarite/config/modalitePaiement.test.tsx`, `scolarite/integration.test.tsx`
- Modify: `frontend/src/personnes/routes.tsx`, `frontend/src/personnes/integration.test.tsx`,
  `frontend/src/routes.tsx`, `frontend/src/app/Sidebar.tsx`, `frontend/src/app/Sidebar.test.tsx`

**Interfaces:**
- Consumes: `Descripteur` (inchangé — `roleEcriture` accepte déjà un tableau), `ResourcePage`.
- Produces: `routesScolarite: RouteObject[]` ; `routesPersonnes` étendu.

- [ ] **Step 1: `personnes/config/inscription.tsx`**

```tsx
import { z } from "zod";
import type { Descripteur } from "../../referentiel/descripteur";

const TYPES = [
  { valeur: "INSCRIPTION", label: "Inscription" },
  { valeur: "REINSCRIPTION", label: "Réinscription" },
];
const STATUTS = [
  { valeur: "NOUVEAU", label: "Nouveau" },
  { valeur: "ANCIEN", label: "Ancien" },
];
const ETATS = ["ACTIVE", "ABANDON", "EXCLU", "DIPLOME"].map((v) => ({ valeur: v, label: v }));

export const inscriptionDescripteur: Descripteur = {
  titre: "Inscriptions",
  endpoint: "personnes/inscriptions",
  roleEcriture: ["DIRECTION", "SCOLARITE"],
  rechercheActive: true,
  colonnes: [
    { cle: "numero_ordre", entete: "N°" },
    { cle: "etudiant_libelle", entete: "Étudiant" },
    { cle: "classe_libelle", entete: "Classe" },
    { cle: "type", entete: "Type" },
    { cle: "etat", entete: "État" },
    { cle: "est_boursier", entete: "Boursier", rendu: (l) => (l.est_boursier ? "Oui" : "Non") },
  ],
  filtres: [
    { nom: "annee_scolaire", label: "Année", fkEndpoint: "referentiel/annees-scolaires" },
    { nom: "ecole", label: "École", fkEndpoint: "referentiel/ecoles" },
    { nom: "classe", label: "Classe", fkEndpoint: "referentiel/classes" },
    { nom: "type", label: "Type", options: TYPES },
    { nom: "etat", label: "État", options: ETATS },
  ],
  champs: [
    { nom: "etudiant", label: "Étudiant", type: "fk", requis: true, fkEndpoint: "personnes/etudiants", fkLabel: (o) => `${o.matricule} — ${o.nom} ${o.prenoms}` },
    { nom: "classe", label: "Classe", type: "fk", requis: true, creationSeule: true, fkEndpoint: "referentiel/classes", fkLabel: (o) => String(o.libelle_auto) },
    { nom: "date_inscription", label: "Date d'inscription", type: "text", requis: true, aide: "AAAA-MM-JJ" },
    { nom: "est_boursier", label: "Boursier", type: "checkbox" },
    { nom: "cout_scolarite_negocie", label: "Coût négocié (FCFA)", type: "number", aide: "vide = grille" },
    { nom: "etablissement_provenance", label: "Établissement de provenance", type: "text" },
    { nom: "type", label: "Type", type: "select", options: TYPES, aide: "vide = déduit du dossier" },
    { nom: "statut", label: "Statut", type: "select", options: STATUTS, aide: "vide = déduit du dossier" },
  ],
  schema: z.object({
    etudiant: z.number({ error: "Obligatoire" }),
    classe: z.number({ error: "Obligatoire" }),
    date_inscription: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format AAAA-MM-JJ"),
    est_boursier: z.boolean().optional(),
    cout_scolarite_negocie: z.union([z.number().int().nonnegative(), z.nan()]).optional(),
    etablissement_provenance: z.string().max(150).optional().or(z.literal("")),
    type: z.enum(["INSCRIPTION", "REINSCRIPTION"]).optional().or(z.literal("")),
    statut: z.enum(["NOUVEAU", "ANCIEN"]).optional().or(z.literal("")),
  }),
};
```

- [ ] **Step 2: `personnes/config/pieceDossier.tsx`**

```tsx
import { z } from "zod";
import type { Descripteur } from "../../referentiel/descripteur";

export const pieceDossierDescripteur: Descripteur = {
  titre: "Pièces du dossier",
  endpoint: "personnes/pieces-dossier",
  roleEcriture: ["DIRECTION", "SCOLARITE"],
  rechercheActive: false,
  colonnes: [
    { cle: "inscription", entete: "Inscription" },
    { cle: "type_piece", entete: "Type de pièce" },
    { cle: "fournie", entete: "Fournie", rendu: (l) => (l.fournie ? "Oui" : "Non") },
    { cle: "date_reception", entete: "Reçue le" },
  ],
  filtres: [
    { nom: "inscription", label: "Inscription", fkEndpoint: "personnes/inscriptions" },
    { nom: "type_piece", label: "Type", fkEndpoint: "personnes/types-piece" },
    { nom: "fournie", label: "Fournie", options: [{ valeur: "true", label: "Oui" }, { valeur: "false", label: "Non" }] },
  ],
  champs: [
    { nom: "inscription", label: "Inscription", type: "fk", requis: true, fkEndpoint: "personnes/inscriptions", fkLabel: (o) => `#${o.numero_ordre} — ${o.etudiant_libelle ?? o.etudiant}` },
    { nom: "type_piece", label: "Type de pièce", type: "fk", requis: true, fkEndpoint: "personnes/types-piece", fkLabel: (o) => String(o.libelle) },
    { nom: "fournie", label: "Fournie", type: "checkbox" },
    { nom: "date_reception", label: "Date de réception", type: "text", aide: "AAAA-MM-JJ" },
  ],
  schema: z.object({
    inscription: z.number({ error: "Obligatoire" }),
    type_piece: z.number({ error: "Obligatoire" }),
    fournie: z.boolean().optional(),
    date_reception: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format AAAA-MM-JJ").optional().or(z.literal("")),
  }),
};
```

- [ ] **Step 3: `scolarite/config/modalitePaiement.tsx` + `scolarite/config/echeance.tsx`**

`modalitePaiement.tsx` : `titre` « Grilles tarifaires », endpoint `scolarite/modalites-paiement`, `roleEcriture: ["DIRECTION"]`, colonnes `niveau` / `annee_scolaire` / `montant_inscription_reinscription` / `nombre_echeance` / `montant_echeance` / `montant_total` ; filtres `niveau` (fk `referentiel/niveaux`), `annee_scolaire` (fk) ; champs `niveau` (fk requis), `annee_scolaire` (fk requis), `montant_inscription_reinscription` (number requis), `nombre_echeance` (number requis), `montant_echeance` (number requis) — **pas** `montant_total` (généré) ; Zod : fk `z.number()`, montants `z.number().int().nonnegative()`, `nombre_echeance` `z.number().int().min(1)`.

`echeance.tsx` : `titre` « Échéances », endpoint `scolarite/echeances`, `roleEcriture: ["DIRECTION","DAF","COMPTABLE"]`, colonnes `inscription` / `numero` / `montant_prevu` / `date_prevue` / `pris_en_charge_bourse` ; filtres `inscription` (fk `personnes/inscriptions`), `pris_en_charge_bourse` (Oui/Non) ; champs `inscription` (fk requis), `numero` (number requis), `montant_prevu` (number requis), `date_prevue` (text requis `AAAA-MM-JJ`), `pris_en_charge_bourse` (checkbox) ; Zod miroir.

- [ ] **Step 4: `personnes/FicheInscription.tsx` (stub)**

`export function FicheInscription() { return <p>Fiche inscription</p>; }` — remplacé en Task 10.

- [ ] **Step 5: `scolarite/routes.tsx`**

```tsx
import type { RouteObject } from "react-router-dom";
import { ResourcePage } from "../components/ResourcePage";
import { echeanceDescripteur } from "./config/echeance";
import { modalitePaiementDescripteur } from "./config/modalitePaiement";

const paires: readonly (readonly [string, import("../referentiel/descripteur").Descripteur])[] = [
  ["modalites-paiement", modalitePaiementDescripteur],
  ["echeances", echeanceDescripteur],
];

export const routesScolarite: RouteObject[] = [
  {
    path: "scolarite",
    handle: { miette: "Scolarité" },
    children: paires.map(([seg, descr]) => ({
      path: seg,
      handle: { miette: descr.titre },
      element: <ResourcePage descripteur={descr} />,
    })),
  },
];
```

- [ ] **Step 6: `personnes/routes.tsx`** — ajouter dans `children` de `personnes` :
```tsx
      {
        path: "inscriptions",
        handle: { miette: "Inscriptions" },
        children: [
          { index: true, element: <ResourcePage descripteur={inscriptionDescripteur} /> },
          { path: ":id", handle: { miette: "Fiche" }, element: <FicheInscription /> },
        ],
      },
      {
        path: "pieces-dossier",
        handle: { miette: "Pièces du dossier" },
        element: <ResourcePage descripteur={pieceDossierDescripteur} />,
      },
```
(+ imports `inscriptionDescripteur`, `pieceDossierDescripteur`, `FicheInscription`.)

- [ ] **Step 7: `src/routes.tsx`** — `import { routesScolarite } from "./scolarite/routes";` puis `...routesScolarite,` après `...routesPersonnes,`.

- [ ] **Step 8: `app/Sidebar.tsx`** — `{ cle: "scolarite", libelle: "Scolarité", chemin: "/scolarite/modalites-paiement", disponible: true }`.

- [ ] **Step 9: `app/Sidebar.test.tsx`** — mettre à jour : Référentiel + Personnes + Scolarité en liens actifs ; « désactive les 3 modules à venir » sur `[/trésorerie/i, /paie/i, /résultats/i]`.

- [ ] **Step 10: Tests scaffold + intégration**

`personnes/config/inscription.test.tsx` — sur le modèle de `personnes/config/etudiant.test.tsx` : mock `apiFetch` renvoyant `{count:1, results:[{id:1, numero_ordre:1, etudiant_libelle:"ESSIG-… — X Y", classe_libelle:"L1", type:"INSCRIPTION", etat:"ACTIVE", est_boursier:false}]}` ; asserts `findByText("1")` (ou le libellé étudiant), compteur, « Créer » visible pour `SCOLARITE`, absent pour `LECTURE`.
`personnes/config/pieceDossier.test.tsx` — idem, résultat `{id:1, inscription:1, type_piece:1, fournie:false}`.
`scolarite/config/modalitePaiement.test.tsx` — résultat avec `montant_total:"735000"` ; « Créer » visible pour `DIRECTION`, absent pour `SCOLARITE`.
`scolarite/integration.test.tsx` — sur le modèle de `personnes/integration.test.tsx` : `routesScolarite[0].path === "scolarite"` ; 2 segments ; `/scolarite/modalites-paiement` rend la liste.
`personnes/integration.test.tsx` — ajouter un cas : segments de `routesPersonnes[0].children` contiennent `inscriptions` et `pieces-dossier`.

- [ ] **Step 11: Portes**

Run: `cd frontend && npm test && npm run typecheck && npm run build`
Expected: verts.

- [ ] **Step 12: Commit**

```bash
git add frontend/src/personnes frontend/src/scolarite frontend/src/routes.tsx frontend/src/app/Sidebar.tsx frontend/src/app/Sidebar.test.tsx
git commit -m "$(cat <<'EOF'
feat(front): ecrans inscription + pieces-dossier + /scolarite/ (grilles, echeances)

routesPersonnes + inscriptions (+ :id) et pieces-dossier. Nouveau groupe
routesScolarite. Module sidebar scolarite active (3 modules a venir).
FicheInscription en stub (Task 10).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015vBabiytJuWPjuDR2qUfCf
EOF
)"
```

**Critère d'acceptation :** `/personnes/inscriptions`, `/personnes/pieces-dossier`, `/scolarite/modalites-paiement`, `/scolarite/echeances` rendent leurs listes ; breadcrumbs corrects ; module sidebar `scolarite` actif ; visibilité « Créer » selon rôle ; tests + typecheck + build verts.

---

## Task 10 : Frontend — écran `FicheInscription`

**Files:**
- Modify (remplace le stub): `frontend/src/personnes/FicheInscription.tsx`
- Create: `frontend/src/personnes/FicheInscription.test.tsx`

**Interfaces:**
- Consumes: `createResourceHooks("personnes/inscriptions").useDetail`, `DataState`, `useParams`.
- Produces: `FicheInscription` — route `/personnes/inscriptions/:id`. En-tête + section **Échéancier** + section **Pièces du dossier** (les sections Frais/Bourses arrivent en Phase 3B).

- [ ] **Step 1: Écrire le test**

`frontend/src/personnes/FicheInscription.test.tsx` — sur le modèle de `FicheEtudiant.test.tsx` :
```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/client", () => ({ apiFetch: vi.fn() }));
import { apiFetch } from "../api/client";
import { FicheInscription } from "./FicheInscription";

const apiFetchMock = apiFetch as unknown as ReturnType<typeof vi.fn>;

function fiche(overrides = {}) {
  return new Response(
    JSON.stringify({
      id: 1, numero_ordre: 1, type: "INSCRIPTION", statut: "NOUVEAU", etat: "ACTIVE",
      est_boursier: false, date_inscription: "2025-10-01",
      etudiant_libelle: "ESSIG-FCVGUDE1 — Gumapi clos desmond junior",
      classe_libelle: "L1 INFO",
      echeances: [
        { id: 1, numero: 0, montant_prevu: "105000", date_prevue: "2025-10-01", pris_en_charge_bourse: false },
        { id: 2, numero: 1, montant_prevu: "70000", date_prevue: "2025-11-01", pris_en_charge_bourse: false },
      ],
      pieces_dossier: [{ id: 1, type_piece: 1, fournie: true, date_reception: "2025-10-02" }],
      ...overrides,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function monter(id = "1") {
  const router = createMemoryRouter(
    [{ path: "/personnes/inscriptions/:id", element: <FicheInscription /> }],
    { initialEntries: [`/personnes/inscriptions/${id}`] },
  );
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><RouterProvider router={router} /></QueryClientProvider>);
}

beforeEach(() => apiFetchMock.mockReset());
afterEach(() => vi.restoreAllMocks());

describe("FicheInscription", () => {
  it("rend en-tête, échéancier et pièces", async () => {
    apiFetchMock.mockResolvedValue(fiche());
    monter();
    expect(await screen.findByRole("heading", { name: /Inscription n°\s*1/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Échéancier/i })).toBeInTheDocument();
    expect(screen.getByText("105000")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Pièces du dossier/i })).toBeInTheDocument();
  });

  it("gère 0 échéance / 0 pièce", async () => {
    apiFetchMock.mockResolvedValue(fiche({ echeances: [], pieces_dossier: [] }));
    monter();
    await screen.findByRole("heading", { name: /Inscription n°\s*1/i });
    expect(screen.getByText(/Aucune échéance/i)).toBeInTheDocument();
    expect(screen.getByText(/Aucune pièce/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: RED** — `cd frontend && npm test -- FicheInscription` → FAIL (stub).

- [ ] **Step 3: Écrire `FicheInscription.tsx`**

En-tête `<h1>Inscription n° {numero_ordre} — {etudiant_libelle}</h1>` + `<dl>` (classe, type, statut, état, boursier, date). Section **Échéancier** : si `echeances.length === 0` → `<p>Aucune échéance.</p>` sinon `<table>` (Numéro / Montant prévu / Date prévue / Bourse). Section **Pièces du dossier** : si vide → `<p>Aucune pièce enregistrée.</p>` sinon `<table>` (Type / Fournie / Reçue le). `DataState` chargement/erreur. Type local `Inscription` avec `echeances: {...}[]`, `pieces_dossier: {...}[]`. (Structure identique à `FicheEtudiant.tsx`, adapter les champs.)

- [ ] **Step 4: GREEN + portes**

Run: `cd frontend && npm test && npm run typecheck && npm run build` → verts.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/personnes/FicheInscription.tsx frontend/src/personnes/FicheInscription.test.tsx
git commit -m "$(cat <<'EOF'
feat(front): ecran FicheInscription (en-tete + echeancier + pieces du dossier)

Sections Frais / Bourses ajoutees en Phase 3B.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015vBabiytJuWPjuDR2qUfCf
EOF
)"
```

**Critère d'acceptation :** `/personnes/inscriptions/:id` rend en-tête + échéancier + pièces depuis l'API ; cas 0 échéance / 0 pièce gérés ; tests + typecheck + build verts.

---

## Task 11 : Vérification globale + documentation + merge 3A

**Files:**
- Modify: `CLAUDE.md`
- Create (non versionné): `.superpowers/sdd/2026-09-07-phase-3a-inscription/progress.md`

- [ ] **Step 1: Portes en une passe**

```bash
cd backend && source .venv/bin/activate && ruff check . && python manage.py check && python manage.py makemigrations --check --dry-run && DB_USER=root pytest -q && python manage.py spectacular --file /tmp/schema.yml
cd ../frontend && npm run typecheck && npm test && npm run build && npx oxlint src
```
Attendu : tout vert ; `spectacular` 0 Error ; `pytest` inclut `core`/`personnes`/`scolarite`.

- [ ] **Step 2: Bout-en-bout sur base de dev**

```bash
cd backend && python manage.py migrate
python manage.py shell -c "
from decimal import Decimal
from referentiel.models import Niveau, AnneeScolaire
from personnes.models import Etudiant, Inscription
# supposer un niveau + une année + un étudiant existants (ou les créer)
"
```
Créer (shell ou API via `curl` avec un token) : un `modalite_paiement` pour un (niveau, année),
un `etudiant`, puis `POST /api/v1/personnes/inscriptions/`. Vérifier : `numero_ordre = 1`,
10 lignes `echeance`, `montant_total` de la grille. Refaire une 2ᵉ inscription même (école, année)
→ `numero_ordre = 2`. Nettoyer ensuite (`Inscription`, `Echeance`, `CompteurInscription`,
`ModalitePaiement` de test).

- [ ] **Step 3: `CLAUDE.md`** — tableau architecture : ajouter `scolarite` (partiel — grilles +
échéances ; frais/bourses en 3B) ; `personnes` gagne `inscription`/`piece_dossier` ; ligne
frontend : écrans `/personnes/inscriptions/*` + `/scolarite/*`. Ajouter `seed` : rien de nouveau
en 3A (`seed_scolarite` arrive en 3B). Mentionner `core.Auditable` dans la description de `core`.

- [ ] **Step 4: Rapport §26** dans `.superpowers/sdd/2026-09-07-phase-3a-inscription/progress.md`
(Objectif · Analyse · Fichiers créés/modifiés · Décisions D-P3-1..14 · Fonctionnalités · API ·
Modèles · Tests ajoutés/exécutés · Résultats · Risques · Travail restant [→ 3B] · Commit). Inclure
les diffs `sqlmigrate` (Tasks 2 & 4).

- [ ] **Step 5: Commit doc**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: cloture Phase 3A (inscription + echeancier) - maj CLAUDE.md

Rapport (non versionne) : .superpowers/sdd/2026-09-07-phase-3a-inscription/progress.md

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015vBabiytJuWPjuDR2qUfCf
EOF
)"
```

- [ ] **Step 6: Merge**

```bash
cd backend && source .venv/bin/activate && ruff check . && DB_USER=root pytest -q
cd ../frontend && npm test
cd .. && git checkout main && git merge --ff-only phase-3a-inscription-echeancier && git branch -d phase-3a-inscription-echeancier
```
Si le FF échoue : `git rebase main`, repasser les portes, `git merge --ff-only`.

**Critère d'acceptation :** portes vertes en une passe ; création d'inscription bout-en-bout vérifiée sur base réelle (numéro d'ordre + 10 échéances) ; rapport écrit ; `CLAUDE.md` à jour ; branche mergée sur `main`.

---

## Self-Review

**1. Spec coverage (3A)**

| Spec § | Tâche |
|---|---|
| §6 `core.Auditable` (D-P3-14) | T1 |
| §6 `Inscription`/`CompteurInscription`/`PieceDossier` + migration | T2 |
| §5 RI-2 `numero_ordre` séquence (D-P3-8) | T3 (service), T6/T8 (usage) |
| §6 `ModalitePaiement` (`montant_total` généré, D-P3-4) + `Echeance` | T4 |
| §5 RE-1..RE-5 `generer_echeancier` (D-P3-11, D-P3-12) | T5 |
| §5 RI-1/RI-4/RI-5 (dérivation, type/statut, classe immuable) | T6 |
| §10 serializers (Auditable read-only, imbrication) | T6 |
| §9 permissions `PeutEcrireInscriptions`/`PeutEcrireTarifs`/`PeutEcrireFraisEleve` (D-P3-15) | T7 |
| §10 API 4 ressources 3A + transaction `perform_create` (RI-6) | T8 |
| §8.3 / RD-1 suppression 409 sans audit | T8 (test) |
| §10 OpenAPI 0 Error + `gen:api` | T8 |
| §11 écrans scaffold + `FicheInscription` + routes + sidebar | T9, T10 |
| §16 tests d'acceptation (3A) | T1–T10 (tests) + T11 (portes + base réelle) |
| §17 hors périmètre 3A : frais annexes / bourses / seed_scolarite / sections Fiche | reportés Plan 3B |

**Écart traité inline :** RD-1 (« suppression 409 sans audit ») — 3A l'exerce **réellement**
(`test_suppression_inscription_avec_echeances_409_sans_audit` : une `Echeance` sur l'inscription
→ FK `RESTRICT` → 409). Remplace le test transitif de Phase 2. Le cas 204 est couvert par une
inscription factice sans enfant (`test_suppression_inscription_sans_enfant_204`).

**2. Placeholder scan**

- T8 Step 1 : le test PATCH construit une `ClasseFactory` réelle et vérifie que `classe` n'est pas
  modifiée (read-only en MAJ). Code final, pas d'artefact.
- T9 Step 3/10 et T10 Step 3 décrivent des écrans « sur le modèle de <fichier existant> » avec la
  liste exacte des champs/colonnes/asserts — pas de code intégral recopié pour les 4 descripteurs
  scaffold triviaux, mais chaque champ est nommé. Les 2 descripteurs non triviaux
  (`inscription`, `pieceDossier`) ont leur code complet (Steps 1–2). `FicheInscription` : structure
  décrite champ par champ + test complet fourni ; identique en forme à `FicheEtudiant.tsx` déjà au
  dépôt.
- T9 Step 4 : stub `FicheInscription` transitoire, remplacé T10 (code décrit + test complet).
- Aucun « TODO / TBD ».

**3. Type consistency**

- `core.models.Auditable` (T1) → hérité par `Inscription` (T2) et `Echeance` (T4).
- `core.serializers.AuditableSerializerMixin` (T1) → utilisé par `InscriptionSerializer` (T6),
  `EcheanceSerializer` (T6). Signature `create/update(self, validated_data[, instance])` alignée
  sur DRF.
- `attribuer_numero_ordre(ecole, annee_scolaire) -> int` : T3 (def) ↔ T6
  (`InscriptionSerializer.create`).
- `generer_echeancier(inscription) -> list` : T5 (def) ↔ T6 (`InscriptionSerializer.create`).
- `InscriptionSerializer` / `InscriptionListSerializer` : T6 (def) ↔ T8 (`get_serializer_class`).
- `EcheanceSerializer` importé par `personnes.serializers` depuis `scolarite.serializers` (T6) —
  pas de cycle (scolarite n'importe pas personnes.serializers).
- Endpoints : `personnes/inscriptions`, `personnes/pieces-dossier`, `scolarite/modalites-paiement`,
  `scolarite/echeances` — identiques entre `urls.py` (T8), descripteurs (T9), `FicheInscription`
  (T10), tests.
- `_BasePersonnesViewSet` (Phase 2) : sous-classé par `InscriptionViewSet`/`PieceDossierViewSet`
  (T8) qui **surchargent** `permission_classes`. `_BaseScolariteViewSet` (T8) : sans permission
  par défaut, chaque viewset fixe la sienne.
- Frontend : `Descripteur.roleEcriture: string[]` (existant) — pas de modif du scaffold (les
  tableaux multi-rôles marchent déjà via `peutEcrire`).

Aucune incohérence résiduelle.

---

## Execution Handoff

**Plan 3A complet, sauvegardé dans `docs/superpowers/plans/2026-09-07-phase-3a-inscription-echeancier.md`. Deux options d'exécution :**

**1. Subagent-Driven (recommandé)** — un sous-agent neuf par tâche, revue entre les tâches (`superpowers:subagent-driven-development`).

**2. Inline Execution** — exécution des tâches dans cette session avec points de contrôle (`superpowers:executing-plans`).

**Quelle approche ?** (Plan 3B — frais annexes & bourses — est écrit séparément et s'exécute après le merge de 3A.)

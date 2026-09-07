# Phase 2 — Module `personnes` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer le module `personnes` (identité étudiant persistante, affiliations, situation BAC, référentiel `type_piece`) avec matricule généré serveur, API REST, seed, et écrans SPA.

**Architecture:** Nouvelle app Django `personnes` calquée sur `referentiel`. Le ViewSet de base commun (`SuppressionProtegeeMixin` + `AuditLogMixin` + `ModelViewSet` + 3 filter backends) est remonté de `referentiel` vers `core/viewsets.py`. Le matricule est produit par un service transactionnel s'appuyant sur une table compteur par pôle. Le frontend réutilise le scaffold générique `Descripteur`/`ResourcePage`/`ResourceForm` plus un écran bespoke `FicheEtudiant`.

**Tech Stack:** Django 5.2 / DRF 3.16 / MySQL 8.4 / `django-filter` / `factory_boy` / `pytest-django` ; React 19 / TypeScript strict / Vite / React Router 7 / TanStack Query + Table / React Hook Form + Zod / Vitest.

**Spec:** `docs/superpowers/specs/2026-09-07-phase-2-personnes-etudiants-design.md`

## Global Constraints

- **Français partout** : tables, colonnes, enums (valeurs SQL exactes), messages d'erreur, libellés UI.
- **PK ORM** : `BigAutoField` / `BIGINT` sur tous les modèles (défaut Django), même si `db/migrations/003` utilise `INT UNSIGNED` — écart assumé (D-ORM-1 / D-P2-1).
- **`db_table` explicite** sur chaque modèle = nom cible snake_case singulier sans accent (`etudiant`, `affiliation`, `situation_bac`, `type_piece`, `compteur_matricule`).
- **`ENUM` SQL → `models.TextChoices`** avec les valeurs SQL littérales (D-P2-2).
- **CharField nullables** miroir du SQL : `null=True, blank=True` + `# noqa: DJ001` (le SQL de référence déclare ces colonnes `NULL`, pas `NOT NULL DEFAULT ''`).
- **RBAC exclusivement serveur.** Le front masque des champs/boutons — jamais une sécurité.
- **Argent** : sans objet en Phase 2 (aucune colonne monétaire).
- **pytest** : lancer avec `DB_USER=root` (l'utilisateur applicatif MySQL ne peut pas créer `test_<DB_NAME>`). Depuis `backend/`, venv `.venv` actif.
- **Après tout changement d'API** : serializers → `@extend_schema` → `python manage.py spectacular --file /tmp/schema.yml` (doit rester **0 Error / 0 Warning**) → `npm run gen:api` (backend doit tourner sur `:8000`) → adapter le front → tests.
- **Namespace URL `v1:`** obligatoire — router monté sous `path("api/v1/", include((api_v1, "v1")))` dans `config/urls.py`.
- **Comparer chaque modèle au `.sql`** via `python manage.py sqlmigrate personnes 0001` et consigner les écarts (procédure D-ORM-9). Les assertions de `db/tests/test_003_personnes_inscriptions.sql` applicables (hors `inscription`/`piece_dossier`) sont portées en `pytest`.
- **Trailers de commit** (imposés) :
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_015vBabiytJuWPjuDR2qUfCf
  ```
- **Branche de travail** : `phase-2-personnes` (déjà créée depuis `main` post-Phase 1).

---

## File Structure

**Backend**
| Fichier | Responsabilité |
|---|---|
| `backend/core/viewsets.py` *(créer)* | `_BaseCrudViewSet` — base CRUD partagée (mixins + filter backends + `ordering`), sans `permission_classes`. |
| `backend/core/tests/test_viewsets.py` *(créer)* | MRO et configuration de `_BaseCrudViewSet` (via une vue jouet sur un modèle `comptes`). |
| `backend/referentiel/views.py` *(modifier)* | `_BaseReferentielViewSet` devient `class _BaseReferentielViewSet(_BaseCrudViewSet): permission_classes = [permissions.PeutEcrireReferentiel]`. |
| `backend/personnes/__init__.py`, `apps.py` *(créer)* | App `personnes`. |
| `backend/personnes/models.py` *(créer)* | `Etudiant`, `Affiliation`, `SituationBac`, `TypePiece`, `CompteurMatricule`. |
| `backend/personnes/services.py` *(créer)* | `initiales(nom, prenoms)`, `generer_matricule(pole, nom, prenoms)`. |
| `backend/personnes/serializers.py` *(créer)* | `EtudiantListSerializer`, `EtudiantSerializer`, `AffiliationSerializer`, `SituationBacSerializer`, `TypePieceSerializer`. |
| `backend/personnes/permissions.py` *(créer)* | `PeutEcrirePersonnes`. |
| `backend/personnes/filters.py` *(créer)* | `EtudiantFilter`, `AffiliationFilter`, `SituationBacFilter`, `TypePieceFilter`. |
| `backend/personnes/views.py` *(créer)* | `EtudiantViewSet`, `AffiliationViewSet`, `SituationBacViewSet`, `TypePieceViewSet`. |
| `backend/personnes/urls.py` *(créer)* | Router DRF `/api/v1/personnes/`. |
| `backend/personnes/admin.py` *(créer)* | Enregistrement admin minimal. |
| `backend/personnes/migrations/0001_initial.py` *(généré)* | Migration initiale. |
| `backend/personnes/management/commands/seed_personnes.py` *(créer)* | Seed idempotent des `type_piece`. |
| `backend/personnes/tests/{__init__,factories,test_models,test_services,test_serializers,test_api,test_permissions_unit,test_seed}.py` *(créer)* | Suite pytest du module. |
| `backend/config/settings/base.py` *(modifier)* | `INSTALLED_APPS += ["personnes"]`. |
| `backend/config/urls.py` *(modifier)* | `path("personnes/", include("personnes.urls"))` dans `api_v1`. |
| `backend/pyproject.toml` *(modifier)* | `[tool.setuptools.packages.find] include += "personnes*"`. |

**Frontend**
| Fichier | Responsabilité |
|---|---|
| `frontend/src/referentiel/descripteur.ts` *(modifier)* | Ajouter `creationSeule?: boolean` au type `Champ`. |
| `frontend/src/components/ResourceForm.tsx` *(modifier)* | Masquer les champs `creationSeule` quand `valeurs` est défini (édition). |
| `frontend/src/components/ResourceForm.test.tsx` *(modifier)* | Test : champ `creationSeule` absent en édition, présent en création. |
| `frontend/src/personnes/config/etudiant.tsx` *(créer)* | `Descripteur` liste/formulaire étudiant. |
| `frontend/src/personnes/config/typePiece.tsx` *(créer)* | `Descripteur` `type_piece`. |
| `frontend/src/personnes/FicheEtudiant.tsx` *(créer)* | Écran bespoke fiche étudiant. |
| `frontend/src/personnes/routes.tsx` *(créer)* | `routesPersonnes: RouteObject[]`. |
| `frontend/src/personnes/{config/etudiant.test.tsx,config/typePiece.test.tsx,FicheEtudiant.test.tsx,integration.test.tsx}` *(créer)* | Tests Vitest. |
| `frontend/src/routes.tsx` *(modifier)* | Insérer `...routesPersonnes`. |
| `frontend/src/app/Sidebar.tsx` *(modifier)* | Module `personnes` → `disponible: true`, `chemin: "/personnes/etudiants"`. |
| `frontend/src/api/schema.d.ts` *(régénéré)* | `npm run gen:api`. |

**Docs**
| Fichier | Responsabilité |
|---|---|
| `CLAUDE.md` *(modifier)* | Tableau architecture : `personnes` livré. |
| `.superpowers/sdd/2026-09-07-phase-2-personnes/progress.md` *(créer, non versionné)* | Rapport de phase §26. |

---

## Task 1 : `_BaseCrudViewSet` partagé dans `core`

**Files:**
- Create: `backend/core/viewsets.py`
- Create: `backend/core/tests/test_viewsets.py`
- Modify: `backend/referentiel/views.py:11-24` (bloc `_BaseReferentielViewSet`)

**Interfaces:**
- Produces: `core.viewsets._BaseCrudViewSet` — sous-classe de `rest_framework.viewsets.ModelViewSet` avec `SuppressionProtegeeMixin` + `AuditLogMixin` dans la MRO (dans cet ordre), `filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]`, `ordering = ["id"]`, **sans** `permission_classes`. Les sous-modules ajoutent `permission_classes`, `queryset`, `serializer_class`, `filterset_class`, `search_fields`, `ordering_fields`.

- [ ] **Step 1: Écrire le test MRO/config**

`backend/core/tests/test_viewsets.py` :
```python
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets

from comptes.audit import AuditLogMixin
from core.mixins import SuppressionProtegeeMixin
from core.viewsets import _BaseCrudViewSet


def test_base_crud_viewset_mro_et_config():
    assert issubclass(_BaseCrudViewSet, viewsets.ModelViewSet)
    mro = _BaseCrudViewSet.__mro__
    # SuppressionProtegeeMixin doit précéder AuditLogMixin (il enveloppe super()).
    assert mro.index(SuppressionProtegeeMixin) < mro.index(AuditLogMixin)
    assert _BaseCrudViewSet.filter_backends == [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    assert _BaseCrudViewSet.ordering == ["id"]
    # Pas de permission par défaut : chaque module fixe la sienne.
    assert "permission_classes" not in _BaseCrudViewSet.__dict__
```

- [ ] **Step 2: Lancer le test — échec attendu**

Run: `cd backend && DB_USER=root pytest core/tests/test_viewsets.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'core.viewsets'`.

- [ ] **Step 3: Créer `core/viewsets.py`**

```python
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets

from comptes.audit import AuditLogMixin
from core.mixins import SuppressionProtegeeMixin


class _BaseCrudViewSet(SuppressionProtegeeMixin, AuditLogMixin, viewsets.ModelViewSet):
    """Base CRUD partagée par les modules métier.

    MRO : `SuppressionProtegeeMixin` (traduit RESTRICT/PROTECT en 409, enveloppe
    `super().perform_destroy`) → `AuditLogMixin` (journalise create/update/destroy)
    → `ModelViewSet`. Les sous-classes fixent `permission_classes`, `queryset`,
    `serializer_class`, `filterset_class`, `search_fields`, `ordering_fields`.
    """

    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    ordering = ["id"]
```

- [ ] **Step 4: Réécrire `_BaseReferentielViewSet`**

Dans `backend/referentiel/views.py`, remplacer l'import et la classe de base :
```python
from drf_spectacular.utils import extend_schema

from core.viewsets import _BaseCrudViewSet

from . import filters as ref_filters
from . import models, permissions, serializers


@extend_schema(tags=["referentiel"])
class _BaseReferentielViewSet(_BaseCrudViewSet):
    permission_classes = [permissions.PeutEcrireReferentiel]
```
Supprimer les imports devenus inutiles dans ce fichier : `DjangoFilterBackend`, `filters`, `viewsets` de `rest_framework`, `AuditLogMixin`, `SuppressionProtegeeMixin` (garder `extend_schema`). Les 11 ViewSets concrets (`GroupeScolaireViewSet`, …) sont inchangés.

- [ ] **Step 5: Lancer les tests concernés**

Run: `cd backend && DB_USER=root pytest core referentiel -q`
Expected: PASS — le nouveau test passe, la suite `referentiel` reste verte (aucune régression : 74 tests existants + 1 nouveau).

- [ ] **Step 6: Portes**

Run: `cd backend && ruff check . && python manage.py check && python manage.py makemigrations --check --dry-run`
Expected: `All checks passed`, `0 issues`, `No changes detected`.

- [ ] **Step 7: Commit**

```bash
git add backend/core/viewsets.py backend/core/tests/test_viewsets.py backend/referentiel/views.py
git commit -m "$(cat <<'EOF'
refactor(core): _BaseReferentielViewSet -> core.viewsets._BaseCrudViewSet partage

Base CRUD commune (SuppressionProtegeeMixin + AuditLogMixin + ModelViewSet +
filter backends + ordering) remontee de referentiel vers core, sans
permission_classes. referentiel garde une sous-classe de 2 lignes.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015vBabiytJuWPjuDR2qUfCf
EOF
)"
```

**Critère d'acceptation :** `_BaseCrudViewSet` existe dans `core`, `referentiel` l'utilise, `pytest core referentiel` vert, portes vertes.

---

## Task 2 : App `personnes` + 5 modèles + migration initiale

**Files:**
- Create: `backend/personnes/__init__.py` (vide), `backend/personnes/apps.py`, `backend/personnes/models.py`, `backend/personnes/admin.py`
- Create: `backend/personnes/tests/__init__.py` (vide), `backend/personnes/tests/factories.py`, `backend/personnes/tests/test_models.py`
- Create: `backend/personnes/migrations/__init__.py` (vide) — puis `0001_initial.py` généré
- Modify: `backend/config/settings/base.py` (`INSTALLED_APPS`)
- Modify: `backend/pyproject.toml` (`[tool.setuptools.packages.find] include`)

**Interfaces:**
- Consumes: `referentiel.models.Ecole.Pole` (choix de pôle, réutilisé par `CompteurMatricule.pole`).
- Produces:
  - `personnes.models.Etudiant` (`db_table="etudiant"`) — champs : `matricule` (`CharField(20)`, unique), `numero_interne_archive`, `nom` (`CharField(60)`), `prenoms` (`CharField(120)`), `sexe` (`Etudiant.Sexe` : `M`/`F`), `date_naissance`, `lieu_naissance`, `nationalite`, `email`, `telephone`, `adresse`, `photo`, `situation_matrimoniale` (`Etudiant.SituationMatrimoniale` : `CELIBATAIRE`/`MARIE`/`AUTRE`). `related_name` : `affiliations`, `situation_bac`.
  - `personnes.models.Affiliation` (`db_table="affiliation"`) — `etudiant` FK CASCADE, `type` (`Affiliation.Type` : `PERE`/`MERE`/`TUTEUR`), `nom`, `prenom`, `contact`, `profession`. Unique `(etudiant, type)` = `unq_affiliation`.
  - `personnes.models.SituationBac` (`db_table="situation_bac"`) — `etudiant` `OneToOneField` CASCADE, `a_le_bac` bool, `annee_obtention`, `serie`, `mention` (`SituationBac.Mention` : `TB`/`B`/`AB`/`P`), `etablissement`, `ville`.
  - `personnes.models.TypePiece` (`db_table="type_piece"`) — `code` (`CharField(30)`, unique = `unq_type_piece_code`), `libelle` (`CharField(120)`).
  - `personnes.models.CompteurMatricule` (`db_table="compteur_matricule"`) — `pole` (`CharField(5)`, `primary_key=True`, `choices=Ecole.Pole.choices`), `valeur` (`PositiveIntegerField(default=0)`).
  - `personnes.tests.factories` : `EtudiantFactory`, `AffiliationFactory`, `SituationBacFactory`, `TypePieceFactory`.

- [ ] **Step 1: Scaffold de l'app**

`backend/personnes/__init__.py` : vide.
`backend/personnes/apps.py` :
```python
from django.apps import AppConfig


class PersonnesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "personnes"
```
`backend/personnes/migrations/__init__.py` : vide.
`backend/personnes/tests/__init__.py` : vide.
`backend/personnes/admin.py` :
```python
from django.contrib import admin

from . import models

admin.site.register(models.Etudiant)
admin.site.register(models.TypePiece)
```
Dans `backend/config/settings/base.py`, ajouter `"personnes"` à `INSTALLED_APPS` juste après `"referentiel"`.
Dans `backend/pyproject.toml`, `[tool.setuptools.packages.find]` : `include = ["config*", "comptes*", "core*", "referentiel*", "personnes*"]`.

- [ ] **Step 2: Écrire `models.py`**

```python
from django.db import models

from referentiel.models import Ecole


class Etudiant(models.Model):
    class Sexe(models.TextChoices):
        M = "M", "Masculin"
        F = "F", "Féminin"

    class SituationMatrimoniale(models.TextChoices):
        CELIBATAIRE = "CELIBATAIRE", "Célibataire"
        MARIE = "MARIE", "Marié(e)"
        AUTRE = "AUTRE", "Autre"

    # matricule : généré serveur (personnes.services.generer_matricule), immuable.
    matricule = models.CharField(max_length=20, unique=True)
    numero_interne_archive = models.CharField(  # noqa: DJ001
        max_length=20, null=True, blank=True
    )
    nom = models.CharField(max_length=60)
    prenoms = models.CharField(max_length=120)
    sexe = models.CharField(max_length=1, choices=Sexe.choices)
    date_naissance = models.DateField(null=True, blank=True)
    lieu_naissance = models.CharField(max_length=120, null=True, blank=True)  # noqa: DJ001
    nationalite = models.CharField(max_length=60, null=True, blank=True)  # noqa: DJ001
    email = models.CharField(max_length=120, null=True, blank=True)  # noqa: DJ001
    telephone = models.CharField(max_length=40, null=True, blank=True)  # noqa: DJ001
    adresse = models.CharField(max_length=255, null=True, blank=True)  # noqa: DJ001
    photo = models.CharField(max_length=255, null=True, blank=True)  # noqa: DJ001
    situation_matrimoniale = models.CharField(  # noqa: DJ001
        max_length=11, choices=SituationMatrimoniale.choices, null=True, blank=True
    )

    class Meta:
        db_table = "etudiant"
        indexes = [models.Index(fields=["nom", "prenoms"], name="idx_etudiant_nom")]

    def __str__(self):
        return f"{self.matricule} — {self.nom} {self.prenoms}"


class Affiliation(models.Model):
    class Type(models.TextChoices):
        PERE = "PERE", "Père"
        MERE = "MERE", "Mère"
        TUTEUR = "TUTEUR", "Tuteur"

    etudiant = models.ForeignKey(
        Etudiant, on_delete=models.CASCADE, related_name="affiliations"
    )
    type = models.CharField(max_length=6, choices=Type.choices)
    nom = models.CharField(max_length=60)
    prenom = models.CharField(max_length=120)
    contact = models.CharField(max_length=60)
    profession = models.CharField(max_length=120, null=True, blank=True)  # noqa: DJ001

    class Meta:
        db_table = "affiliation"
        constraints = [
            models.UniqueConstraint(
                fields=["etudiant", "type"], name="unq_affiliation"
            )
        ]

    def __str__(self):
        return f"{self.type} de {self.etudiant_id}"


class SituationBac(models.Model):
    class Mention(models.TextChoices):
        TB = "TB", "Très bien"
        B = "B", "Bien"
        AB = "AB", "Assez bien"
        P = "P", "Passable"

    etudiant = models.OneToOneField(
        Etudiant, on_delete=models.CASCADE, related_name="situation_bac"
    )
    a_le_bac = models.BooleanField(default=False)
    annee_obtention = models.IntegerField(null=True, blank=True)
    serie = models.CharField(max_length=20, null=True, blank=True)  # noqa: DJ001
    mention = models.CharField(  # noqa: DJ001
        max_length=2, choices=Mention.choices, null=True, blank=True
    )
    etablissement = models.CharField(max_length=150, null=True, blank=True)  # noqa: DJ001
    ville = models.CharField(max_length=80, null=True, blank=True)  # noqa: DJ001

    class Meta:
        db_table = "situation_bac"

    def __str__(self):
        return f"BAC de {self.etudiant_id}"


class TypePiece(models.Model):
    code = models.CharField(max_length=30, unique=True)
    libelle = models.CharField(max_length=120)

    class Meta:
        db_table = "type_piece"

    def __str__(self):
        return self.code


class CompteurMatricule(models.Model):
    pole = models.CharField(
        max_length=5, primary_key=True, choices=Ecole.Pole.choices
    )
    valeur = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "compteur_matricule"

    def __str__(self):
        return f"{self.pole}={self.valeur}"
```

- [ ] **Step 3: Écrire les factories**

`backend/personnes/tests/factories.py` :
```python
import factory

from personnes import models


class EtudiantFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Etudiant

    matricule = factory.Sequence(lambda n: f"ESSIG-FCVTEST{n}")
    nom = factory.Sequence(lambda n: f"Nom{n}")
    prenoms = factory.Sequence(lambda n: f"Prenom{n}")
    sexe = models.Etudiant.Sexe.F


class AffiliationFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Affiliation

    etudiant = factory.SubFactory(EtudiantFactory)
    type = models.Affiliation.Type.PERE
    nom = factory.Sequence(lambda n: f"Parent{n}")
    prenom = "X"
    contact = "0100000000"


class SituationBacFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.SituationBac

    etudiant = factory.SubFactory(EtudiantFactory)
    a_le_bac = True
    annee_obtention = 2024
    serie = "D"


class TypePieceFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.TypePiece

    code = factory.Sequence(lambda n: f"PIECE_{n}")
    libelle = factory.LazyAttribute(lambda o: f"Pièce {o.code}")
```

- [ ] **Step 4: Écrire `test_models.py` (portage `db/tests/test_003`)**

```python
import pytest
from django.db import IntegrityError

from personnes import models
from personnes.tests import factories as f

pytestmark = pytest.mark.django_db


def test_db_tables_sont_les_noms_cibles():
    attendus = {
        models.Etudiant: "etudiant",
        models.Affiliation: "affiliation",
        models.SituationBac: "situation_bac",
        models.TypePiece: "type_piece",
        models.CompteurMatricule: "compteur_matricule",
    }
    for modele, table in attendus.items():
        assert modele._meta.db_table == table


def test_matricule_unique():
    f.EtudiantFactory(matricule="ESSIG-FCVGUDE1")
    with pytest.raises(IntegrityError):
        f.EtudiantFactory(matricule="ESSIG-FCVGUDE1")


def test_affiliation_unicite_etudiant_type():
    e = f.EtudiantFactory()
    f.AffiliationFactory(etudiant=e, type=models.Affiliation.Type.PERE)
    with pytest.raises(IntegrityError):
        f.AffiliationFactory(etudiant=e, type=models.Affiliation.Type.PERE)


def test_affiliation_cascade_a_la_suppression_etudiant():
    e = f.EtudiantFactory()
    f.AffiliationFactory(etudiant=e, type=models.Affiliation.Type.PERE)
    f.AffiliationFactory(etudiant=e, type=models.Affiliation.Type.MERE)
    e.delete()
    assert models.Affiliation.objects.filter(etudiant_id=e.pk).count() == 0


def test_situation_bac_une_seule_par_etudiant():
    e = f.EtudiantFactory()
    f.SituationBacFactory(etudiant=e)
    with pytest.raises(IntegrityError):
        f.SituationBacFactory(etudiant=e)


def test_situation_bac_cascade_a_la_suppression_etudiant():
    e = f.EtudiantFactory()
    f.SituationBacFactory(etudiant=e)
    e.delete()
    assert not models.SituationBac.objects.filter(etudiant_id=e.pk).exists()


def test_type_piece_code_unique():
    f.TypePieceFactory(code="ACTE_NAISSANCE")
    with pytest.raises(IntegrityError):
        f.TypePieceFactory(code="ACTE_NAISSANCE")


def test_index_nom_present():
    noms = {i.name for i in models.Etudiant._meta.indexes}
    assert "idx_etudiant_nom" in noms
```

- [ ] **Step 5: Lancer — échec attendu (collecte)**

Run: `cd backend && DB_USER=root pytest personnes -q`
Expected: FAIL — `ModuleNotFoundError` / app non enregistrée (les modèles n'existent pas encore côté migrations).

- [ ] **Step 6: Générer la migration**

Run: `cd backend && python manage.py makemigrations personnes`
Expected: crée `personnes/migrations/0001_initial.py` avec les 5 modèles.
Puis : `python manage.py makemigrations --check --dry-run` → `No changes detected`.

- [ ] **Step 7: Comparer au SQL de référence (D-ORM-9)**

Run: `cd backend && python manage.py sqlmigrate personnes 0001`
Comparer au bloc correspondant de `db/migrations/003_personnes_inscriptions.sql`. Écarts attendus et acceptés : `BIGINT` vs `INT UNSIGNED` (D-P2-1) ; `varchar` de `sexe`/`type`/`mention`/`situation_matrimoniale` au lieu d'`ENUM` (D-P2-2) ; noms de contraintes FK au défaut Django ; `compteur_matricule` sans équivalent SQL (D-P2-4) ; `piece_dossier` absent (D-P2-5). Consigner dans le rapport (Task 11).

- [ ] **Step 8: Lancer les tests — passage attendu**

Run: `cd backend && DB_USER=root pytest personnes -q`
Expected: PASS (8 tests).

- [ ] **Step 9: Portes**

Run: `cd backend && ruff check . && python manage.py check && DB_USER=root pytest -q`
Expected: tout vert ; total = 75 (Task 1) + 8 = **83 passed**.

- [ ] **Step 10: Commit**

```bash
git add backend/personnes backend/config/settings/base.py backend/pyproject.toml
git commit -m "$(cat <<'EOF'
feat(personnes): 5 modeles (etudiant, affiliation, situation_bac, type_piece, compteur_matricule) + migration

Portage de db/migrations/003 (hors piece_dossier -> Phase 3). db_table
explicites, BigAutoField, ENUM->TextChoices. compteur_matricule : sequence
applicative par pole (hors SQL de reference, D-P2-4). Tests modeles portes de
db/tests/test_003 (matricule unique, unq_affiliation, cascades, situation_bac
1:0..1, type_piece code unique).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015vBabiytJuWPjuDR2qUfCf
EOF
)"
```

**Critère d'acceptation :** `makemigrations --check` propre, `sqlmigrate` diffé, `pytest personnes` = 8 verts, suite globale verte.

---

## Task 3 : Service de génération du matricule

**Files:**
- Create: `backend/personnes/services.py`
- Create: `backend/personnes/tests/test_services.py`

**Interfaces:**
- Consumes: `personnes.models.CompteurMatricule`.
- Produces:
  - `personnes.services.initiales(nom: str, prenoms: str) -> str` — 4 caractères `[A-Z]`. Pour `nom` puis `prenoms` : premier mot (split whitespace), translittération ASCII (`unicodedata.normalize("NFKD", …)` + drop non-ASCII), garde `[A-Za-z]`, majuscules, 2 premières lettres ; complète avec `"X"` si 1 lettre, `"XX"` si 0.
  - `personnes.services.generer_matricule(pole: str, nom: str, prenoms: str) -> str` — `f"{pole}-FCV{initiales(nom, prenoms)}{n}"` où `n` = `CompteurMatricule` du pôle incrémenté sous `transaction.atomic` + `select_for_update`.

- [ ] **Step 1: Écrire les tests**

`backend/personnes/tests/test_services.py` :
```python
import pytest

from personnes import services
from personnes.models import CompteurMatricule

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    "nom,prenoms,attendu",
    [
        ("Gumapi clos", "desmond junior", "GUDE"),  # cas nominal
        ("Éric", "Kön", "ERKO"),                    # accents translittérés
        ("Jean-Pierre", "Éléonore", "JEEL"),        # trait d'union : "Jean-Pierre" -> "JE"
        ("O", "A", "OXAX"),                         # mot d'1 lettre -> complété par X
        ("  ", "123", "XXXX"),                      # aucun caractère alpha -> XX + XX
    ],
)
def test_initiales(nom, prenoms, attendu):
    assert services.initiales(nom, prenoms) == attendu


def test_generer_matricule_format_et_increment():
    m1 = services.generer_matricule("ESSIG", "Gumapi clos", "desmond junior")
    m2 = services.generer_matricule("ESSIG", "Autre", "Personne")
    assert m1 == "ESSIG-FCVGUDE1"
    assert m2 == "ESSIG-FCVAUPE2"
    assert CompteurMatricule.objects.get(pole="ESSIG").valeur == 2


def test_compteur_isole_par_pole():
    services.generer_matricule("ESSIG", "A", "B")
    services.generer_matricule("ESSIG", "C", "D")
    services.generer_matricule("UPSS", "E", "F")
    assert CompteurMatricule.objects.get(pole="ESSIG").valeur == 2
    assert CompteurMatricule.objects.get(pole="UPSS").valeur == 1


def test_compteur_jamais_reinitialise():
    for _ in range(3):
        services.generer_matricule("CFPA", "X", "Y")
    # nouvelle « année » simulée : rien ne remet à zéro
    m = services.generer_matricule("CFPA", "Z", "W")
    assert m == "CFPA-FCVZXWX4"
    assert CompteurMatricule.objects.get(pole="CFPA").valeur == 4
```

- [ ] **Step 2: Lancer — échec attendu**

Run: `cd backend && DB_USER=root pytest personnes/tests/test_services.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'personnes.services'`.

- [ ] **Step 3: Écrire `services.py`**

```python
import re
import unicodedata

from django.db import transaction

from .models import CompteurMatricule


def _deux_lettres(mot: str) -> str:
    ascii_ = (
        unicodedata.normalize("NFKD", mot or "")
        .encode("ascii", "ignore")
        .decode("ascii")
    )
    lettres = re.sub(r"[^A-Za-z]", "", ascii_).upper()
    return (lettres[:2] + "XX")[:2]


def initiales(nom: str, prenoms: str) -> str:
    premier_nom = (nom or "").split()[:1]
    premier_prenom = (prenoms or "").split()[:1]
    a = _deux_lettres(premier_nom[0] if premier_nom else "")
    b = _deux_lettres(premier_prenom[0] if premier_prenom else "")
    return a + b


@transaction.atomic
def generer_matricule(pole: str, nom: str, prenoms: str) -> str:
    compteur, _ = CompteurMatricule.objects.select_for_update().get_or_create(pole=pole)
    compteur.valeur += 1
    compteur.save(update_fields=["valeur"])
    return f"{pole}-FCV{initiales(nom, prenoms)}{compteur.valeur}"
```

- [ ] **Step 4: Lancer — passage attendu**

Run: `cd backend && DB_USER=root pytest personnes/tests/test_services.py -q`
Expected: PASS.

- [ ] **Step 5: Portes**

Run: `cd backend && ruff check . && DB_USER=root pytest personnes -q`
Expected: vert (8 + ~8 = ~16 tests `personnes`).

- [ ] **Step 6: Commit**

```bash
git add backend/personnes/services.py backend/personnes/tests/test_services.py
git commit -m "$(cat <<'EOF'
feat(personnes): service generer_matricule (<POLE>-FCV<INITIALES><N>)

initiales() : 2 lettres du premier mot du nom + 2 du premier prenom,
translittere ASCII, majuscules, X-complete. generer_matricule() : compteur par
pole sous transaction.atomic + select_for_update, jamais reinitialise.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015vBabiytJuWPjuDR2qUfCf
EOF
)"
```

**Critère d'acceptation :** `initiales` couvre accents / trait d'union / mot court / vide ; `generer_matricule` incrémente par pôle sans reset ; tests verts.

---

## Task 4 : Serializers

**Files:**
- Create: `backend/personnes/serializers.py`
- Create: `backend/personnes/tests/test_serializers.py`

**Interfaces:**
- Consumes: `personnes.models.*`, `personnes.services.generer_matricule`, `referentiel.models.Ecole.Pole`.
- Produces:
  - `EtudiantListSerializer` — `ModelSerializer` sur `Etudiant`, `fields = "__all__"` (inclut `matricule` en lecture).
  - `EtudiantSerializer` — `ModelSerializer` sur `Etudiant`, `fields = "__all__"` + `pole = ChoiceField(choices=Ecole.Pole.choices, write_only=True, required=False)` + `affiliations = AffiliationSerializer(many=True, read_only=True)` + `situation_bac = SituationBacSerializer(read_only=True)`. `matricule` en `read_only`. `create()` : exige `pole`, appelle `generer_matricule`. `update()` : ignore `pole` et `matricule`.
  - `AffiliationSerializer`, `SituationBacSerializer`, `TypePieceSerializer` — `ModelSerializer` plats, `fields = "__all__"`.

- [ ] **Step 1: Écrire les tests**

`backend/personnes/tests/test_serializers.py` :
```python
import pytest

from personnes import models
from personnes.serializers import EtudiantListSerializer, EtudiantSerializer
from personnes.tests import factories as f

pytestmark = pytest.mark.django_db

_BASE = {"nom": "Gumapi clos", "prenoms": "desmond junior", "sexe": "F"}


def test_create_exige_pole_et_genere_le_matricule():
    s = EtudiantSerializer(data={**_BASE, "pole": "ESSIG"})
    assert s.is_valid(), s.errors
    etu = s.save()
    assert etu.matricule == "ESSIG-FCVGUDE1"


def test_create_sans_pole_est_invalide():
    s = EtudiantSerializer(data=_BASE)
    assert not s.is_valid()
    assert "pole" in s.errors


def test_matricule_en_entree_est_ignore():
    s = EtudiantSerializer(data={**_BASE, "pole": "ESSIG", "matricule": "PIRATE"})
    assert s.is_valid(), s.errors
    etu = s.save()
    assert etu.matricule != "PIRATE"


def test_update_ne_touche_ni_pole_ni_matricule():
    etu = f.EtudiantFactory(matricule="ESSIG-FCVGUDE7", nom="Ancien")
    s = EtudiantSerializer(
        etu, data={"nom": "Nouveau", "pole": "UPSS"}, partial=True
    )
    assert s.is_valid(), s.errors
    etu = s.save()
    etu.refresh_from_db()
    assert etu.nom == "Nouveau"
    assert etu.matricule == "ESSIG-FCVGUDE7"


def test_detail_imbrique_affiliations_et_bac_en_lecture_seule():
    etu = f.EtudiantFactory()
    f.AffiliationFactory(etudiant=etu, type=models.Affiliation.Type.PERE)
    f.SituationBacFactory(etudiant=etu)
    data = EtudiantSerializer(etu).data
    assert len(data["affiliations"]) == 1
    assert data["situation_bac"]["a_le_bac"] is True


def test_list_serializer_n_imbrique_pas():
    assert "affiliations" not in EtudiantListSerializer().fields
```

- [ ] **Step 2: Lancer — échec attendu**

Run: `cd backend && DB_USER=root pytest personnes/tests/test_serializers.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'personnes.serializers'`.

- [ ] **Step 3: Écrire `serializers.py`**

```python
from rest_framework import serializers

from referentiel.models import Ecole

from . import models, services


class AffiliationSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Affiliation
        fields = "__all__"


class SituationBacSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.SituationBac
        fields = "__all__"


class TypePieceSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.TypePiece
        fields = "__all__"


class EtudiantListSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Etudiant
        fields = "__all__"


class EtudiantSerializer(serializers.ModelSerializer):
    pole = serializers.ChoiceField(
        choices=Ecole.Pole.choices, write_only=True, required=False
    )
    affiliations = AffiliationSerializer(many=True, read_only=True)
    situation_bac = SituationBacSerializer(read_only=True)

    class Meta:
        model = models.Etudiant
        fields = "__all__"
        read_only_fields = ["matricule"]

    def create(self, validated_data):
        pole = validated_data.pop("pole", None)
        if not pole:
            raise serializers.ValidationError(
                {"pole": "Le pôle est obligatoire à la création."}
            )
        validated_data["matricule"] = services.generer_matricule(
            pole, validated_data["nom"], validated_data["prenoms"]
        )
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop("pole", None)
        validated_data.pop("matricule", None)
        return super().update(instance, validated_data)
```

- [ ] **Step 4: Lancer — passage attendu**

Run: `cd backend && DB_USER=root pytest personnes/tests/test_serializers.py -q`
Expected: PASS (6 tests).

- [ ] **Step 5: Portes**

Run: `cd backend && ruff check . && DB_USER=root pytest personnes -q`
Expected: vert.

- [ ] **Step 6: Commit**

```bash
git add backend/personnes/serializers.py backend/personnes/tests/test_serializers.py
git commit -m "$(cat <<'EOF'
feat(personnes): serializers (pole write-only a la creation, matricule read-only, imbrication lecture)

EtudiantSerializer : create() exige `pole` et route par generer_matricule ;
update() ignore pole/matricule ; affiliations + situation_bac imbriques en
lecture seule. EtudiantListSerializer plat pour la liste.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015vBabiytJuWPjuDR2qUfCf
EOF
)"
```

**Critère d'acceptation :** `pole` exigé à la création et ignoré en `update` ; `matricule` non modifiable via l'API ; imbrication lecture seule ; `EtudiantListSerializer` plat.

---

## Task 5 : Permissions + FilterSets

**Files:**
- Create: `backend/personnes/permissions.py`
- Create: `backend/personnes/filters.py`
- Create: `backend/personnes/tests/test_permissions_unit.py`

**Interfaces:**
- Consumes: `comptes.permissions.ARole`.
- Produces:
  - `personnes.permissions.PeutEcrirePersonnes` — `BasePermission` : méthodes sûres → tout authentifié ; écriture → rôle `DIRECTION` ou `SCOLARITE` ; superuser bypass (via `ARole`).
  - `personnes.filters.EtudiantFilter` (`sexe`, `nationalite`, `situation_matrimoniale` exact ; `a_le_bac` → `situation_bac__a_le_bac`), `AffiliationFilter` (`etudiant`, `type`), `SituationBacFilter` (`etudiant`, `a_le_bac`, `mention`), `TypePieceFilter` (`code` icontains).

- [ ] **Step 1: Écrire le test de permission**

`backend/personnes/tests/test_permissions_unit.py` :
```python
import pytest
from rest_framework.test import APIRequestFactory

from comptes.models import Role, UtilisateurRole
from comptes.tests.factories import UtilisateurFactory
from personnes.permissions import PeutEcrirePersonnes

pytestmark = pytest.mark.django_db
_rf = APIRequestFactory()


def _user_avec(*codes):
    u = UtilisateurFactory()
    for c in codes:
        r, _ = Role.objects.get_or_create(code=c, defaults={"libelle": c})
        UtilisateurRole.objects.create(utilisateur=u, role=r)
    return u


@pytest.mark.parametrize("code,attendu", [("DIRECTION", True), ("SCOLARITE", True),
                                          ("COMPTABLE", False), ("LECTURE", False)])
def test_ecriture_reservee_direction_scolarite(code, attendu):
    req = _rf.post("/x")
    req.user = _user_avec(code)
    assert PeutEcrirePersonnes().has_permission(req, None) is attendu


def test_lecture_ouverte_a_tout_authentifie():
    req = _rf.get("/x")
    req.user = _user_avec("LECTURE")
    assert PeutEcrirePersonnes().has_permission(req, None) is True


def test_ecriture_refusee_a_lanonyme():
    from django.contrib.auth.models import AnonymousUser

    req = _rf.post("/x")
    req.user = AnonymousUser()
    assert PeutEcrirePersonnes().has_permission(req, None) is False
```

- [ ] **Step 2: Lancer — échec attendu**

Run: `cd backend && DB_USER=root pytest personnes/tests/test_permissions_unit.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'personnes.permissions'`.

- [ ] **Step 3: Écrire `permissions.py`**

```python
from rest_framework.permissions import SAFE_METHODS, BasePermission

from comptes.permissions import ARole

_EcritPersonnes = ARole("DIRECTION", "SCOLARITE")


class PeutEcrirePersonnes(BasePermission):
    message = "Rôle DIRECTION ou SCOLARITE requis pour modifier les personnes."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return _EcritPersonnes().has_permission(request, view)
```

- [ ] **Step 4: Écrire `filters.py`**

```python
import django_filters as df

from . import models


class EtudiantFilter(df.FilterSet):
    a_le_bac = df.BooleanFilter(field_name="situation_bac__a_le_bac")

    class Meta:
        model = models.Etudiant
        fields = {
            "sexe": ["exact"],
            "nationalite": ["exact"],
            "situation_matrimoniale": ["exact"],
        }


class AffiliationFilter(df.FilterSet):
    class Meta:
        model = models.Affiliation
        fields = {"etudiant": ["exact"], "type": ["exact"]}


class SituationBacFilter(df.FilterSet):
    class Meta:
        model = models.SituationBac
        fields = {"etudiant": ["exact"], "a_le_bac": ["exact"], "mention": ["exact"]}


class TypePieceFilter(df.FilterSet):
    class Meta:
        model = models.TypePiece
        fields = {"code": ["icontains"]}
```

- [ ] **Step 5: Lancer — passage attendu**

Run: `cd backend && DB_USER=root pytest personnes/tests/test_permissions_unit.py -q`
Expected: PASS (6 cas).

- [ ] **Step 6: Portes**

Run: `cd backend && ruff check . && python manage.py check && DB_USER=root pytest personnes -q`
Expected: vert.

- [ ] **Step 7: Commit**

```bash
git add backend/personnes/permissions.py backend/personnes/filters.py backend/personnes/tests/test_permissions_unit.py
git commit -m "$(cat <<'EOF'
feat(personnes): PeutEcrirePersonnes (DIRECTION/SCOLARITE) + 4 FilterSets

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015vBabiytJuWPjuDR2qUfCf
EOF
)"
```

**Critère d'acceptation :** matrice de permission (DIRECTION/SCOLARITE écrivent, autres non, anon refusé, lecture ouverte) verte ; 4 FilterSets définis.

---

## Task 6 : ViewSets + router + URLs + OpenAPI + types front

**Files:**
- Create: `backend/personnes/views.py`
- Create: `backend/personnes/urls.py`
- Modify: `backend/config/urls.py` (liste `api_v1`)
- Create: `backend/personnes/tests/test_api.py`
- Modify: `frontend/src/api/schema.d.ts` (via `npm run gen:api`)

**Interfaces:**
- Consumes: `core.viewsets._BaseCrudViewSet`, `personnes.{models,serializers,permissions,filters}`.
- Produces (routes montées sous `/api/v1/personnes/`, namespace `v1:`) :
  - `etudiants` → `EtudiantViewSet` : `queryset = Etudiant.objects.prefetch_related("affiliations").select_related("situation_bac")`, `get_serializer_class` → `EtudiantListSerializer` si `action == "list"` sinon `EtudiantSerializer`, `permission_classes = [PeutEcrirePersonnes]`, `filterset_class = EtudiantFilter`, `search_fields = ["matricule", "nom", "prenoms"]`, `ordering_fields = ["nom", "matricule", "id"]`.
  - `affiliations` → `AffiliationViewSet` : `AffiliationSerializer`, `filterset_class = AffiliationFilter`, `search_fields = ["nom", "prenom"]`, `ordering_fields = ["id"]`.
  - `situation-bac` → `SituationBacViewSet` : `SituationBacSerializer`, `filterset_class = SituationBacFilter`, `ordering_fields = ["id"]`, pas de `search_fields`.
  - `types-piece` → `TypePieceViewSet` : `TypePieceSerializer`, `filterset_class = TypePieceFilter`, `search_fields = ["code", "libelle"]`, `ordering_fields = ["code", "id"]`.

- [ ] **Step 1: Écrire `test_api.py`**

```python
import pytest
from rest_framework.test import APIClient

from comptes.models import JournalAudit, Role, UtilisateurRole
from comptes.tests.factories import UtilisateurFactory
from personnes import models
from personnes.tests import factories as f

pytestmark = pytest.mark.django_db


def _client(role_code=None, superuser=False):
    u = UtilisateurFactory(is_superuser=superuser, is_staff=superuser)
    if role_code:
        r, _ = Role.objects.get_or_create(code=role_code, defaults={"libelle": role_code})
        UtilisateurRole.objects.create(utilisateur=u, role=r)
    c = APIClient()
    c.force_authenticate(u)
    return c, u


def test_creation_etudiant_attribue_le_matricule_et_ecrit_un_audit():
    c, _ = _client(Role.Code.SCOLARITE)
    resp = c.post(
        "/api/v1/personnes/etudiants/",
        {"nom": "Gumapi clos", "prenoms": "desmond junior", "sexe": "F", "pole": "ESSIG"},
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["matricule"] == "ESSIG-FCVGUDE1"
    assert JournalAudit.objects.filter(action="CREATION", table_cible="etudiant").count() == 1


def test_lecture_ouverte_ecriture_refusee_en_lecture_seule():
    c, _ = _client(Role.Code.LECTURE)
    assert c.get("/api/v1/personnes/etudiants/").status_code == 200
    resp = c.post(
        "/api/v1/personnes/etudiants/",
        {"nom": "X", "prenoms": "Y", "sexe": "M", "pole": "UPSS"},
        format="json",
    )
    assert resp.status_code == 403


@pytest.mark.parametrize("role,attendu", [("DIRECTION", 201), ("SCOLARITE", 201),
                                          ("COMPTABLE", 403), ("DAF", 403)])
def test_ecriture_par_role(role, attendu):
    c, _ = _client(role)
    resp = c.post(
        "/api/v1/personnes/etudiants/",
        {"nom": "N", "prenoms": "P", "sexe": "M", "pole": "ESSIG"},
        format="json",
    )
    assert resp.status_code == attendu


def test_recherche_par_matricule_nom_prenoms():
    c, _ = _client(Role.Code.SCOLARITE)
    c.post("/api/v1/personnes/etudiants/",
           {"nom": "Ndong", "prenoms": "Alice", "sexe": "F", "pole": "ESSIG"}, format="json")
    c.post("/api/v1/personnes/etudiants/",
           {"nom": "Obame", "prenoms": "Bob", "sexe": "M", "pole": "ESSIG"}, format="json")
    resp = c.get("/api/v1/personnes/etudiants/?search=ndong")
    assert resp.data["count"] == 1


def test_filtre_a_le_bac():
    c, _ = _client(Role.Code.SCOLARITE)
    e = f.EtudiantFactory()
    f.SituationBacFactory(etudiant=e, a_le_bac=True)
    f.EtudiantFactory()  # sans BAC
    resp = c.get("/api/v1/personnes/etudiants/?a_le_bac=true")
    assert resp.data["count"] == 1


def test_detail_imbrique_affiliations_et_bac():
    c, _ = _client(Role.Code.LECTURE)
    e = f.EtudiantFactory()
    f.AffiliationFactory(etudiant=e, type=models.Affiliation.Type.MERE)
    resp = c.get(f"/api/v1/personnes/etudiants/{e.pk}/")
    assert resp.status_code == 200
    assert len(resp.data["affiliations"]) == 1


def test_patch_ne_modifie_pas_le_matricule():
    c, _ = _client(Role.Code.SCOLARITE)
    e = f.EtudiantFactory(matricule="ESSIG-FCVGUDE9")
    resp = c.patch(f"/api/v1/personnes/etudiants/{e.pk}/",
                   {"matricule": "PIRATE", "nom": "Z"}, format="json")
    assert resp.status_code == 200
    e.refresh_from_db()
    assert e.matricule == "ESSIG-FCVGUDE9"
    assert e.nom == "Z"


def test_suppression_etudiant_204_et_audit():
    c, _ = _client(Role.Code.DIRECTION)
    e = f.EtudiantFactory()
    assert c.delete(f"/api/v1/personnes/etudiants/{e.pk}/").status_code == 204
    assert JournalAudit.objects.filter(action="SUPPRESSION", table_cible="etudiant").exists()


def test_types_piece_crud_par_scolarite():
    c, _ = _client(Role.Code.SCOLARITE)
    resp = c.post("/api/v1/personnes/types-piece/",
                  {"code": "ACTE_NAISSANCE", "libelle": "Acte de naissance"}, format="json")
    assert resp.status_code == 201
```

- [ ] **Step 2: Lancer — échec attendu**

Run: `cd backend && DB_USER=root pytest personnes/tests/test_api.py -q`
Expected: FAIL — `404` partout (routes non montées).

- [ ] **Step 3: Écrire `views.py`**

```python
from drf_spectacular.utils import extend_schema

from core.viewsets import _BaseCrudViewSet

from . import filters as p_filters
from . import models, permissions, serializers


@extend_schema(tags=["personnes"])
class _BasePersonnesViewSet(_BaseCrudViewSet):
    permission_classes = [permissions.PeutEcrirePersonnes]


class EtudiantViewSet(_BasePersonnesViewSet):
    queryset = models.Etudiant.objects.prefetch_related("affiliations").select_related(
        "situation_bac"
    )
    filterset_class = p_filters.EtudiantFilter
    search_fields = ["matricule", "nom", "prenoms"]
    ordering_fields = ["nom", "matricule", "id"]

    def get_serializer_class(self):
        if self.action == "list":
            return serializers.EtudiantListSerializer
        return serializers.EtudiantSerializer


class AffiliationViewSet(_BasePersonnesViewSet):
    queryset = models.Affiliation.objects.select_related("etudiant")
    serializer_class = serializers.AffiliationSerializer
    filterset_class = p_filters.AffiliationFilter
    search_fields = ["nom", "prenom"]
    ordering_fields = ["id"]


class SituationBacViewSet(_BasePersonnesViewSet):
    queryset = models.SituationBac.objects.select_related("etudiant")
    serializer_class = serializers.SituationBacSerializer
    filterset_class = p_filters.SituationBacFilter
    ordering_fields = ["id"]


class TypePieceViewSet(_BasePersonnesViewSet):
    queryset = models.TypePiece.objects.all()
    serializer_class = serializers.TypePieceSerializer
    filterset_class = p_filters.TypePieceFilter
    search_fields = ["code", "libelle"]
    ordering_fields = ["code", "id"]
```

- [ ] **Step 4: Écrire `urls.py`**

```python
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("etudiants", views.EtudiantViewSet)
router.register("affiliations", views.AffiliationViewSet)
router.register("situation-bac", views.SituationBacViewSet)
router.register("types-piece", views.TypePieceViewSet)

urlpatterns = router.urls
```

- [ ] **Step 5: Monter dans `config/urls.py`**

Dans `backend/config/urls.py`, ajouter à la liste `api_v1`, après la ligne `referentiel/` :
```python
    path("personnes/", include("personnes.urls")),
```

- [ ] **Step 6: Lancer — passage attendu**

Run: `cd backend && DB_USER=root pytest personnes/tests/test_api.py -q`
Expected: PASS.

- [ ] **Step 7: Vérifier le schéma OpenAPI**

Run: `cd backend && python manage.py spectacular --file /tmp/schema.yml`
Expected: **0 Error / 0 Warning** (aucune sortie). Si un warning apparaît sur `EtudiantViewSet` (double serializer), ajouter `@extend_schema_view(list=extend_schema(responses=serializers.EtudiantListSerializer), retrieve=extend_schema(responses=serializers.EtudiantSerializer))` sur la classe.

- [ ] **Step 8: Régénérer les types front**

Terminal A : `cd backend && python manage.py runserver 0.0.0.0:8000`
Terminal B : `cd frontend && npm run gen:api`
Puis arrêter le serveur. Vérifier `git diff --stat frontend/src/api/schema.d.ts` → le fichier gagne les schémas `personnes` (`Etudiant`, `Affiliation`, `SituationBac`, `TypePiece`, `PaginatedEtudiantList`, …).

- [ ] **Step 9: Portes**

Run:
```
cd backend && ruff check . && python manage.py check && python manage.py makemigrations --check --dry-run && DB_USER=root pytest -q
cd ../frontend && npm run typecheck
```
Expected: tout vert ; `pytest` ~= 83 + (test_serializers 6 déjà comptés) … cumul attendu **≈ 100 passed** ; `typecheck` PASS (schema.d.ts régénéré cohérent).

- [ ] **Step 10: Commit**

```bash
git add backend/personnes/views.py backend/personnes/urls.py backend/config/urls.py backend/personnes/tests/test_api.py frontend/src/api/schema.d.ts
git commit -m "$(cat <<'EOF'
feat(personnes): API CRUD /api/v1/personnes/ (etudiants, affiliations, situation-bac, types-piece)

_BasePersonnesViewSet sur core._BaseCrudViewSet. EtudiantViewSet :
prefetch affiliations + select_related situation_bac, serializer liste/detail
distinct, recherche matricule/nom/prenoms, filtre a_le_bac. OpenAPI 0 Error,
schema.d.ts regenere.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015vBabiytJuWPjuDR2qUfCf
EOF
)"
```

**Critère d'acceptation :** CRUD des 4 ressources par rôle ; création attribue le matricule + audit ; recherche et filtre `a_le_bac` OK ; `spectacular` 0 Error ; `schema.d.ts` régénéré ; `typecheck` front vert.

---

## Task 7 : Commande `seed_personnes`

**Files:**
- Create: `backend/personnes/management/__init__.py` (vide)
- Create: `backend/personnes/management/commands/__init__.py` (vide)
- Create: `backend/personnes/management/commands/seed_personnes.py`
- Create: `backend/personnes/tests/test_seed.py`

**Interfaces:**
- Produces: commande `seed_personnes` — crée (idempotent, `get_or_create` sur `code`) les 5 `type_piece` : `ACTE_NAISSANCE`, `RELEVE_BAC`, `PHOTOS`, `LETTRE_MOTIVATION`, `CERTIF_SCOLARITE`.

- [ ] **Step 1: Écrire le test**

`backend/personnes/tests/test_seed.py` :
```python
import pytest
from django.core.management import call_command

from personnes.models import TypePiece

pytestmark = pytest.mark.django_db


def test_seed_personnes_idempotent():
    call_command("seed_personnes")
    call_command("seed_personnes")
    assert TypePiece.objects.count() == 5
    assert set(TypePiece.objects.values_list("code", flat=True)) == {
        "ACTE_NAISSANCE", "RELEVE_BAC", "PHOTOS", "LETTRE_MOTIVATION", "CERTIF_SCOLARITE",
    }
```

- [ ] **Step 2: Lancer — échec attendu**

Run: `cd backend && DB_USER=root pytest personnes/tests/test_seed.py -q`
Expected: FAIL — `CommandError: Unknown command: 'seed_personnes'`.

- [ ] **Step 3: Écrire la commande**

`backend/personnes/management/commands/seed_personnes.py` :
```python
from django.core.management.base import BaseCommand
from django.db import transaction

from personnes.models import TypePiece

TYPES_PIECE = [
    ("ACTE_NAISSANCE", "Acte de naissance"),
    ("RELEVE_BAC", "Relevé de notes du BAC"),
    ("PHOTOS", "Photos d'identité"),
    ("LETTRE_MOTIVATION", "Lettre de motivation"),
    ("CERTIF_SCOLARITE", "Certificat de scolarité"),
]


class Command(BaseCommand):
    help = "Amorce idempotente du référentiel personnes (types de pièce)."

    @transaction.atomic
    def handle(self, *args, **opts):
        for code, libelle in TYPES_PIECE:
            TypePiece.objects.get_or_create(code=code, defaults={"libelle": libelle})
        self.stdout.write(self.style.SUCCESS("Référentiel personnes amorcé."))
```

- [ ] **Step 4: Lancer — passage attendu**

Run: `cd backend && DB_USER=root pytest personnes/tests/test_seed.py -q`
Expected: PASS.

- [ ] **Step 5: Portes**

Run: `cd backend && ruff check . && DB_USER=root pytest personnes -q`
Expected: vert.

- [ ] **Step 6: Commit**

```bash
git add backend/personnes/management backend/personnes/tests/test_seed.py
git commit -m "$(cat <<'EOF'
feat(personnes): commande seed_personnes idempotente (5 type_piece)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015vBabiytJuWPjuDR2qUfCf
EOF
)"
```

**Critère d'acceptation :** double exécution → 5 `type_piece`, aucun doublon.

---

## Task 8 : Frontend — champ `creationSeule` dans le scaffold

**Files:**
- Modify: `frontend/src/referentiel/descripteur.ts` (type `Champ`)
- Modify: `frontend/src/components/ResourceForm.tsx` (filtre des champs)
- Modify: `frontend/src/components/ResourceForm.test.tsx` (nouveau cas)

**Interfaces:**
- Consumes: type `Champ` (existant).
- Produces: `Champ.creationSeule?: boolean` — quand `true`, le champ n'est rendu par `ResourceForm` que si `valeurs` est absent (mode création).

- [ ] **Step 1: Ajouter le cas de test**

Dans `frontend/src/components/ResourceForm.test.tsx`, ajouter :
```tsx
it("masque un champ creationSeule en edition et l'affiche en creation", async () => {
  const d: Descripteur = {
    titre: "T",
    endpoint: "x/y",
    roleEcriture: ["DIRECTION"],
    colonnes: [],
    champs: [
      { nom: "nom", label: "Nom", type: "text", requis: true },
      { nom: "pole", label: "Pôle", type: "select", creationSeule: true,
        options: [{ valeur: "ESSIG", label: "ESSIG" }] },
    ],
    schema: z.object({ nom: z.string().min(1), pole: z.string().optional() }),
  };
  const { unmount } = render(
    <ResourceForm descripteur={d} onFerme={() => {}} />, { wrapper },
  );
  expect(screen.getByLabelText("Pôle")).toBeInTheDocument();
  unmount();

  render(
    <ResourceForm descripteur={d} valeurs={{ id: 1, nom: "A" }} onFerme={() => {}} />,
    { wrapper },
  );
  expect(screen.queryByLabelText("Pôle")).toBeNull();
});
```
(Réutilise `z`, `wrapper`, `render`, `screen` déjà importés dans ce fichier de test.)

- [ ] **Step 2: Lancer — échec attendu**

Run: `cd frontend && npm test -- ResourceForm`
Expected: FAIL — le champ « Pôle » reste visible en édition (et/ou erreur de type sur `creationSeule`).

- [ ] **Step 3: Étendre le type `Champ`**

Dans `frontend/src/referentiel/descripteur.ts`, ajouter la propriété au type `Champ` :
```ts
export type Champ = {
  nom: string;
  label: string;
  type: "text" | "number" | "checkbox" | "select" | "fk";
  requis?: boolean;
  options?: { valeur: string; label: string }[];
  fkEndpoint?: string;
  fkLabel?: (o: Record<string, unknown>) => string;
  aide?: string;
  creationSeule?: boolean;
};
```

- [ ] **Step 4: Filtrer dans `ResourceForm`**

Dans `frontend/src/components/ResourceForm.tsx`, remplacer `descripteur.champs.map((c) => (` par :
```tsx
{descripteur.champs
  .filter((c) => !(c.creationSeule && valeurs))
  .map((c) => (
```
(Fermer le `.map(` au même endroit qu'avant — la parenthèse de fin ne change pas.)

- [ ] **Step 5: Lancer — passage attendu**

Run: `cd frontend && npm test -- ResourceForm && npm run typecheck`
Expected: PASS ; typecheck vert.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/referentiel/descripteur.ts frontend/src/components/ResourceForm.tsx frontend/src/components/ResourceForm.test.tsx
git commit -m "$(cat <<'EOF'
feat(front): Champ.creationSeule - champ masque en edition (ResourceForm)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015vBabiytJuWPjuDR2qUfCf
EOF
)"
```

**Critère d'acceptation :** un champ `creationSeule: true` est rendu en création, absent en édition ; tests + typecheck verts.

---

## Task 9 : Frontend — descripteurs `etudiant` + `typePiece`, routes, sidebar

**Files:**
- Create: `frontend/src/personnes/config/etudiant.tsx`
- Create: `frontend/src/personnes/config/typePiece.tsx`
- Create: `frontend/src/personnes/routes.tsx`
- Create: `frontend/src/personnes/config/etudiant.test.tsx`, `frontend/src/personnes/config/typePiece.test.tsx`, `frontend/src/personnes/integration.test.tsx`
- Modify: `frontend/src/routes.tsx`
- Modify: `frontend/src/app/Sidebar.tsx`

**Interfaces:**
- Consumes: `Descripteur` (+ `creationSeule` de Task 8), `ResourcePage`, `zod`.
- Produces: `routesPersonnes: RouteObject[]` (`frontend/src/personnes/routes.tsx`).

- [ ] **Step 1: `config/etudiant.tsx`**

```tsx
import { z } from "zod";
import type { Descripteur } from "../../referentiel/descripteur";

const POLES = ["ESSIG", "UPSS", "CFPA", "CICI"].map((v) => ({ valeur: v, label: v }));
const SEXES = [
  { valeur: "M", label: "Masculin" },
  { valeur: "F", label: "Féminin" },
];
const MATRIMONIAL = [
  { valeur: "CELIBATAIRE", label: "Célibataire" },
  { valeur: "MARIE", label: "Marié(e)" },
  { valeur: "AUTRE", label: "Autre" },
];

export const etudiantDescripteur: Descripteur = {
  titre: "Étudiants",
  endpoint: "personnes/etudiants",
  roleEcriture: ["DIRECTION", "SCOLARITE"],
  rechercheActive: true,
  colonnes: [
    { cle: "matricule", entete: "Matricule" },
    { cle: "nom", entete: "Nom" },
    { cle: "prenoms", entete: "Prénoms" },
    { cle: "sexe", entete: "Sexe" },
    { cle: "nationalite", entete: "Nationalité" },
  ],
  filtres: [
    { nom: "sexe", label: "Sexe", options: SEXES },
    {
      nom: "a_le_bac",
      label: "BAC",
      options: [
        { valeur: "true", label: "Oui" },
        { valeur: "false", label: "Non" },
      ],
    },
  ],
  champs: [
    { nom: "pole", label: "Pôle", type: "select", requis: true, creationSeule: true, options: POLES },
    { nom: "nom", label: "Nom", type: "text", requis: true },
    { nom: "prenoms", label: "Prénoms", type: "text", requis: true },
    { nom: "sexe", label: "Sexe", type: "select", requis: true, options: SEXES },
    { nom: "date_naissance", label: "Date de naissance", type: "text", aide: "AAAA-MM-JJ" },
    { nom: "lieu_naissance", label: "Lieu de naissance", type: "text" },
    { nom: "nationalite", label: "Nationalité", type: "text" },
    { nom: "email", label: "Email", type: "text" },
    { nom: "telephone", label: "Téléphone", type: "text" },
    { nom: "adresse", label: "Adresse", type: "text" },
    { nom: "situation_matrimoniale", label: "Situation matrimoniale", type: "select", options: MATRIMONIAL },
  ],
  schema: z.object({
    pole: z.enum(["ESSIG", "UPSS", "CFPA", "CICI"]).optional(),
    nom: z.string().min(1, "Obligatoire").max(60),
    prenoms: z.string().min(1, "Obligatoire").max(120),
    sexe: z.enum(["M", "F"]),
    date_naissance: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format AAAA-MM-JJ").optional().or(z.literal("")),
    lieu_naissance: z.string().max(120).optional().or(z.literal("")),
    nationalite: z.string().max(60).optional().or(z.literal("")),
    email: z.string().max(120).optional().or(z.literal("")),
    telephone: z.string().max(40).optional().or(z.literal("")),
    adresse: z.string().max(255).optional().or(z.literal("")),
    situation_matrimoniale: z.enum(["CELIBATAIRE", "MARIE", "AUTRE"]).optional().or(z.literal("")),
  }),
};
```

- [ ] **Step 2: `config/typePiece.tsx`**

```tsx
import { z } from "zod";
import type { Descripteur } from "../../referentiel/descripteur";

export const typePieceDescripteur: Descripteur = {
  titre: "Types de pièce",
  endpoint: "personnes/types-piece",
  roleEcriture: ["DIRECTION", "SCOLARITE"],
  rechercheActive: true,
  colonnes: [
    { cle: "code", entete: "Code" },
    { cle: "libelle", entete: "Libellé" },
  ],
  champs: [
    { nom: "code", label: "Code", type: "text", requis: true },
    { nom: "libelle", label: "Libellé", type: "text", requis: true },
  ],
  schema: z.object({
    code: z.string().min(1, "Obligatoire").max(30),
    libelle: z.string().min(1, "Obligatoire").max(120),
  }),
};
```

- [ ] **Step 3: `routes.tsx`**

```tsx
import type { RouteObject } from "react-router-dom";
import { ResourcePage } from "../components/ResourcePage";
import { FicheEtudiant } from "./FicheEtudiant";
import { etudiantDescripteur } from "./config/etudiant";
import { typePieceDescripteur } from "./config/typePiece";

export const routesPersonnes: RouteObject[] = [
  {
    path: "personnes",
    handle: { miette: "Personnes" },
    children: [
      {
        path: "etudiants",
        handle: { miette: "Étudiants" },
        children: [
          { index: true, element: <ResourcePage descripteur={etudiantDescripteur} /> },
          { path: ":id", handle: { miette: "Fiche" }, element: <FicheEtudiant /> },
        ],
      },
      {
        path: "types-piece",
        handle: { miette: "Types de pièce" },
        element: <ResourcePage descripteur={typePieceDescripteur} />,
      },
    ],
  },
];
```
> `FicheEtudiant` est créé en Task 10 ; pour garder le build vert entre Task 9 et Task 10, créer d'abord un stub `frontend/src/personnes/FicheEtudiant.tsx` : `export function FicheEtudiant() { return <p>Fiche</p>; }` — Task 10 le remplace.

- [ ] **Step 4: Câbler `src/routes.tsx`**

Dans `frontend/src/routes.tsx`, importer `routesPersonnes` et l'ajouter aux `children` du `/` (AppShell), après `...routesReferentiel` :
```tsx
import { routesPersonnes } from "./personnes/routes";
// ...
      { index: true, element: <p className="text-gray-600">Bienvenue. Choisissez un module.</p> },
      ...routesReferentiel,
      ...routesPersonnes,
```

- [ ] **Step 5: Activer le module dans `Sidebar.tsx`**

Dans `frontend/src/app/Sidebar.tsx`, la ligne `personnes` de `NAV_MODULES` :
```tsx
  { cle: "personnes", libelle: "Personnes", chemin: "/personnes/etudiants", disponible: true },
```

- [ ] **Step 6: Tests descripteurs + intégration**

`frontend/src/personnes/config/etudiant.test.tsx` — sur le modèle de `referentiel/config` (rendu liste + compteur + visibilité « Créer ») :
```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();
vi.mock("../../auth/AuthContext", () => ({ useAuth: () => useAuthMock() }));
vi.mock("../../api/client", () => ({ apiFetch: vi.fn() }));

import { apiFetch } from "../../api/client";
import { ResourcePage } from "../../components/ResourcePage";
import { ToastProvider } from "../../components/ToastProvider";
import { etudiantDescripteur } from "./etudiant";

const apiFetchMock = apiFetch as unknown as ReturnType<typeof vi.fn>;

function rep() {
  return new Response(
    JSON.stringify({
      count: 1, next: null, previous: null,
      results: [{ id: 1, matricule: "ESSIG-FCVGUDE1", nom: "Gumapi clos",
                  prenoms: "desmond junior", sexe: "F", nationalite: "Gabonaise" }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}><ToastProvider>{children}</ToastProvider></QueryClientProvider>;
};

beforeEach(() => {
  apiFetchMock.mockReset().mockResolvedValue(rep());
  useAuthMock.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("etudiantDescripteur", () => {
  it("rend la liste et le compteur", async () => {
    useAuthMock.mockReturnValue({ utilisateur: { roles: [{ code: "LECTURE" }] } });
    render(<ResourcePage descripteur={etudiantDescripteur} />, { wrapper });
    expect(await screen.findByText("ESSIG-FCVGUDE1")).toBeInTheDocument();
    expect(screen.getByText("1 élément(s)")).toBeInTheDocument();
  });

  it("affiche « Créer » pour SCOLARITE", async () => {
    useAuthMock.mockReturnValue({ utilisateur: { roles: [{ code: "SCOLARITE" }] } });
    render(<ResourcePage descripteur={etudiantDescripteur} />, { wrapper });
    await screen.findByText("ESSIG-FCVGUDE1");
    expect(screen.getByRole("button", { name: "Créer" })).toBeInTheDocument();
  });
});
```

`frontend/src/personnes/config/typePiece.test.tsx` — même patron, `results: [{ id: 1, code: "ACTE_NAISSANCE", libelle: "Acte de naissance" }]`, asserts `findByText("ACTE_NAISSANCE")` + « Créer » pour `SCOLARITE`.

`frontend/src/personnes/integration.test.tsx` — sur le modèle de `referentiel/integration.test.tsx` :
```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();
vi.mock("../auth/AuthContext", () => ({ useAuth: () => useAuthMock() }));
vi.mock("../api/client", () => ({ apiFetch: vi.fn() }));

import { apiFetch } from "../api/client";
import { ToastProvider } from "../components/ToastProvider";
import { routesPersonnes } from "./routes";

const apiFetchMock = apiFetch as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  useAuthMock.mockReset().mockReturnValue({ utilisateur: { roles: [{ code: "LECTURE" }] } });
  apiFetchMock.mockReset().mockResolvedValue(
    new Response(
      JSON.stringify({ count: 1, next: null, previous: null,
        results: [{ id: 1, matricule: "ESSIG-FCVGUDE1", nom: "N", prenoms: "P", sexe: "F" }] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
});
afterEach(() => vi.restoreAllMocks());

describe("routes personnes", () => {
  it("câble personnes/etudiants, :id et types-piece", () => {
    expect(routesPersonnes[0].path).toBe("personnes");
    const segs = routesPersonnes[0].children!.map((r) => r.path);
    expect(segs).toContain("etudiants");
    expect(segs).toContain("types-piece");
  });

  it("rend la liste des étudiants depuis l'API mockée", async () => {
    const router = createMemoryRouter(
      [{ path: "/", element: <ToastProvider><Outlet /></ToastProvider>, children: routesPersonnes }],
      { initialEntries: ["/personnes/etudiants"] },
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={qc}><RouterProvider router={router} /></QueryClientProvider>);
    expect(await screen.findByText("ESSIG-FCVGUDE1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Étudiants" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Lancer les portes front**

Run: `cd frontend && npm test && npm run typecheck && npm run build`
Expected: verts (dont les 3 nouveaux fichiers ; `FicheEtudiant` stub suffit au build).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/personnes frontend/src/routes.tsx frontend/src/app/Sidebar.tsx
git commit -m "$(cat <<'EOF'
feat(front): ecrans personnes (descripteurs etudiant + typePiece, routes, sidebar)

routesPersonnes sous l'AppShell : /personnes/etudiants (+ :id), /personnes/types-piece.
Champ `pole` en creationSeule. Module sidebar personnes active. FicheEtudiant en
stub (Task 10 la remplace).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015vBabiytJuWPjuDR2qUfCf
EOF
)"
```

**Critère d'acceptation :** `/personnes/etudiants` et `/personnes/types-piece` rendent leurs listes ; breadcrumb « Personnes / … » ; module sidebar actif ; tests + typecheck + build verts.

---

## Task 10 : Frontend — écran `FicheEtudiant`

**Files:**
- Modify (remplace le stub) : `frontend/src/personnes/FicheEtudiant.tsx`
- Create: `frontend/src/personnes/FicheEtudiant.test.tsx`

**Interfaces:**
- Consumes: `createResourceHooks` (via `useDetail`), `DataState`, `useParams`.
- Produces: composant `FicheEtudiant` — route `/personnes/etudiants/:id`. Affiche 3 sections (Identité, Affiliations, Situation BAC) depuis `GET /personnes/etudiants/:id/`.

- [ ] **Step 1: Écrire le test**

`frontend/src/personnes/FicheEtudiant.test.tsx` :
```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/client", () => ({ apiFetch: vi.fn() }));
import { apiFetch } from "../api/client";
import { FicheEtudiant } from "./FicheEtudiant";

const apiFetchMock = apiFetch as unknown as ReturnType<typeof vi.fn>;

function fiche(overrides: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      id: 1, matricule: "ESSIG-FCVGUDE1", nom: "Gumapi clos", prenoms: "desmond junior",
      sexe: "F", nationalite: "Gabonaise",
      affiliations: [{ id: 1, type: "PERE", nom: "Gumapi", prenom: "Jean", contact: "01" }],
      situation_bac: { id: 1, a_le_bac: true, serie: "D", mention: "B" },
      ...overrides,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function monter(id = "1") {
  const router = createMemoryRouter(
    [{ path: "/personnes/etudiants/:id", element: <FicheEtudiant /> }],
    { initialEntries: [`/personnes/etudiants/${id}`] },
  );
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><RouterProvider router={router} /></QueryClientProvider>);
}

beforeEach(() => apiFetchMock.mockReset());
afterEach(() => vi.restoreAllMocks());

describe("FicheEtudiant", () => {
  it("rend identité, affiliations et BAC", async () => {
    apiFetchMock.mockResolvedValue(fiche());
    monter();
    expect(await screen.findByText("ESSIG-FCVGUDE1")).toBeInTheDocument();
    expect(screen.getByText(/Gumapi clos/)).toBeInTheDocument();
    expect(screen.getByText("PERE")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Situation BAC/i })).toBeInTheDocument();
  });

  it("gère l'absence de BAC et 0 affiliation", async () => {
    apiFetchMock.mockResolvedValue(fiche({ affiliations: [], situation_bac: null }));
    monter();
    await screen.findByText("ESSIG-FCVGUDE1");
    expect(screen.getByText(/Aucune affiliation/i)).toBeInTheDocument();
    expect(screen.getByText(/Pas d.information BAC/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Lancer — échec attendu**

Run: `cd frontend && npm test -- FicheEtudiant`
Expected: FAIL — le stub ne rend ni le matricule ni les sections.

- [ ] **Step 3: Écrire `FicheEtudiant.tsx`**

```tsx
import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { DataState } from "../components/DataState";
import { createResourceHooks } from "../lib/resource";

type Affiliation = {
  id: number;
  type: string;
  nom: string;
  prenom: string;
  contact: string;
  profession?: string | null;
};
type SituationBac = {
  a_le_bac: boolean;
  annee_obtention?: number | null;
  serie?: string | null;
  mention?: string | null;
  etablissement?: string | null;
  ville?: string | null;
} | null;
type Etudiant = Record<string, unknown> & {
  id: number;
  matricule: string;
  nom: string;
  prenoms: string;
  affiliations: Affiliation[];
  situation_bac: SituationBac;
};

const IDENTITE: [string, string][] = [
  ["matricule", "Matricule"],
  ["nom", "Nom"],
  ["prenoms", "Prénoms"],
  ["sexe", "Sexe"],
  ["date_naissance", "Date de naissance"],
  ["lieu_naissance", "Lieu de naissance"],
  ["nationalite", "Nationalité"],
  ["email", "Email"],
  ["telephone", "Téléphone"],
  ["adresse", "Adresse"],
  ["situation_matrimoniale", "Situation matrimoniale"],
];

export function FicheEtudiant() {
  const { id } = useParams();
  const hooks = useMemo(() => createResourceHooks<Etudiant>("personnes/etudiants"), []);
  const { data, isLoading, isError, refetch } = hooks.useDetail(Number(id));

  if (isLoading) return <DataState statut="chargement" />;
  if (isError || !data) return <DataState statut="erreur" onReessayer={refetch} />;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">
        {data.matricule} — {data.nom} {data.prenoms}
      </h1>

      <section>
        <h2 className="mb-2 font-medium">Identité</h2>
        <dl className="grid grid-cols-[180px_1fr] gap-y-1 text-sm">
          {IDENTITE.map(([cle, label]) => (
            <div key={cle} className="contents">
              <dt className="text-gray-500">{label}</dt>
              <dd>{data[cle] == null || data[cle] === "" ? "—" : String(data[cle])}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Affiliations</h2>
        {data.affiliations.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune affiliation enregistrée.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-1">Type</th>
                <th className="py-1">Nom</th>
                <th className="py-1">Prénom</th>
                <th className="py-1">Contact</th>
                <th className="py-1">Profession</th>
              </tr>
            </thead>
            <tbody>
              {data.affiliations.map((a) => (
                <tr key={a.id} className="border-b">
                  <td className="py-1">{a.type}</td>
                  <td className="py-1">{a.nom}</td>
                  <td className="py-1">{a.prenom}</td>
                  <td className="py-1">{a.contact}</td>
                  <td className="py-1">{a.profession ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-medium">Situation BAC</h2>
        {!data.situation_bac ? (
          <p className="text-sm text-gray-500">Pas d'information BAC.</p>
        ) : (
          <dl className="grid grid-cols-[180px_1fr] gap-y-1 text-sm">
            <dt className="text-gray-500">A le BAC</dt>
            <dd>{data.situation_bac.a_le_bac ? "Oui" : "Non"}</dd>
            <dt className="text-gray-500">Année</dt>
            <dd>{data.situation_bac.annee_obtention ?? "—"}</dd>
            <dt className="text-gray-500">Série</dt>
            <dd>{data.situation_bac.serie ?? "—"}</dd>
            <dt className="text-gray-500">Mention</dt>
            <dd>{data.situation_bac.mention ?? "—"}</dd>
            <dt className="text-gray-500">Établissement</dt>
            <dd>{data.situation_bac.etablissement ?? "—"}</dd>
            <dt className="text-gray-500">Ville</dt>
            <dd>{data.situation_bac.ville ?? "—"}</dd>
          </dl>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Lancer — passage attendu**

Run: `cd frontend && npm test -- FicheEtudiant && npm run typecheck`
Expected: PASS ; typecheck vert.

- [ ] **Step 5: Portes front complètes**

Run: `cd frontend && npm test && npm run typecheck && npm run build`
Expected: verts.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/personnes/FicheEtudiant.tsx frontend/src/personnes/FicheEtudiant.test.tsx
git commit -m "$(cat <<'EOF'
feat(front): ecran FicheEtudiant (identite + affiliations + situation BAC)

GET personnes/etudiants/:id/ ; 3 sections ; etats chargement/erreur ; gere
0 affiliation et absence de BAC.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015vBabiytJuWPjuDR2qUfCf
EOF
)"
```

**Critère d'acceptation :** `/personnes/etudiants/:id` rend les 3 sections depuis l'API ; cas 0 affiliation / sans BAC gérés ; tests + typecheck + build verts.

---

## Task 11 : Vérification globale + documentation + clôture

**Files:**
- Modify: `CLAUDE.md` (tableau architecture)
- Create (non versionné) : `.superpowers/sdd/2026-09-07-phase-2-personnes/progress.md`

**Interfaces:** aucune.

- [ ] **Step 1: Repasser toutes les portes en une passe**

```bash
cd backend && source .venv/bin/activate && ruff check . && python manage.py check && python manage.py makemigrations --check --dry-run && DB_USER=root pytest -q && python manage.py spectacular --file /tmp/schema.yml
cd ../frontend && npm run typecheck && npm test && npm run build
```
Attendu : tout vert ; `spectacular` **0 Error / 0 Warning** ; `pytest` inclut `personnes` (models, services, serializers, permissions_unit, api, seed) + `core` (viewsets) + suites `comptes` / `referentiel` inchangées.

- [ ] **Step 2: `seed_personnes` bout-en-bout sur base de dev**

```bash
cd backend && python manage.py migrate && python manage.py seed_personnes && python manage.py seed_personnes
```
Attendu : 2ᵉ passage sans création en double, sortie 0. Vérifier : `python manage.py shell -c "from personnes.models import TypePiece; print(TypePiece.objects.count())"` → `5`.

- [ ] **Step 3: Vérifier un cycle réel de matricule sur base de dev**

```bash
cd backend && python manage.py shell -c "
from personnes.services import generer_matricule
print(generer_matricule('ESSIG', 'Gumapi clos', 'desmond junior'))
print(generer_matricule('ESSIG', 'Autre', 'Personne'))
"
```
Attendu : `ESSIG-FCVGUDE<n>` puis `ESSIG-FCVAUPE<n+1>` (n dépend de l'état de la base ; l'incrément de 1 est la vérification). *(Nettoyer ensuite si base de dev partagée : `CompteurMatricule` et les étudiants de test.)*

- [ ] **Step 4: Mettre à jour `CLAUDE.md`**

Dans le tableau « Architecture », ligne `backend/` : passer de « `comptes`, `core`, `referentiel` … **livrés** » à inclure `personnes` :
> `comptes`, `core`, `referentiel`, `personnes` **livrés**. Modules métier restants (`scolarite`, `tresorerie`, `paie`, `resultats`) **à créer**.

État : `personnes` livré (Phase 2).

- [ ] **Step 5: Rapport de fin de phase**

Rédiger `.superpowers/sdd/2026-09-07-phase-2-personnes/progress.md` au format prompt maître §26 (Objectif · Analyse de l'existant · Fichiers créés · Fichiers modifiés · Décisions D-P2-1..10 · Fonctionnalités · API · Modèles · Tests ajoutés · Tests exécutés · Résultats · Risques · Travail restant · Commit). Inclure le diff `sqlmigrate` vs `db/migrations/003` (Task 2 Step 7).

- [ ] **Step 6: Commit doc**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: cloture Phase 2 (module personnes) - maj CLAUDE.md

Rapport de phase (non versionne) : .superpowers/sdd/2026-09-07-phase-2-personnes/progress.md

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015vBabiytJuWPjuDR2qUfCf
EOF
)"
```

- [ ] **Step 7: Merge**

```bash
cd backend && source .venv/bin/activate && ruff check . && DB_USER=root pytest -q
cd ../frontend && npm test
cd .. && git checkout main && git merge --ff-only phase-2-personnes && git branch -d phase-2-personnes
```
Si le fast-forward échoue (commits arrivés sur `main` entre-temps) : `git rebase main` sur `phase-2-personnes`, repasser les portes, puis `git merge --ff-only`.

**Critère d'acceptation :** toutes les portes vertes en une passe ; `seed_personnes` idempotent vérifié sur base réelle ; matricule vérifié sur base réelle ; rapport écrit ; `CLAUDE.md` à jour ; branche mergée sur `main`.

---

## Self-Review

**1. Spec coverage**

| Spec § | Couvert par |
|---|---|
| §2 refactor `_BaseCrudViewSet` | Task 1 |
| §2 / §6 modèles `etudiant`/`affiliation`/`situation_bac`/`type_piece`/`compteur_matricule` + migration | Task 2 |
| §2 / §6 écarts D-P2-1..6 (dont `sqlmigrate`) | Task 2 Step 7 + Task 11 Step 5 |
| §2 / §8.1 service `generer_matricule` + `initiales` (RP-1..3, RP-5) | Task 3 |
| §10 serializers (`pole` write-only RP-4, `matricule` read-only RP-1, imbrication D-P2-10) | Task 4 |
| §9 `PeutEcrirePersonnes` | Task 5 |
| §10 FilterSets | Task 5 |
| §10 API 4 routers, pagination, recherche, filtres, tri, `get_serializer_class` | Task 6 |
| §10 OpenAPI 0 Error + `gen:api` | Task 6 Steps 7-8 |
| §14 audit (create/update/delete, pas d'audit sur 409) | Task 6 (test) — chemin 409 via `SuppressionProtegeeMixin` hérité, testé transitivement par `referentiel` + Task 1 MRO ; aucune FK entrante vers `personnes` en Phase 2 donc pas de 409 réel (noté §8.4) |
| §11 champ `creationSeule` | Task 8 |
| §11 descripteurs `etudiant` + `typePiece`, routes, sidebar | Task 9 |
| §11 écran `FicheEtudiant` | Task 10 |
| §12 validations serveur + Zod | Tasks 4 (serveur) + 9 (Zod) |
| §13 erreurs | hérité socle (`errors.ts` inchangé) ; 400/403 testés Task 6 |
| §15 seed | Task 7 |
| §16 tests d'acceptation | Tasks 2-10 (tests) + Task 11 (portes globales + base réelle) |
| §17 hors périmètre | respecté : pas de `piece_dossier`, pas d'`inscription`, pas d'écriture imbriquée, `photo` = `CharField` |

**Écart identifié et traité inline :** la spec §16 évoque un test « suppression protégée renvoie 409 sans audit » pour `personnes`. Aucune table de Phase 2 n'a de FK entrante `RESTRICT` (elles arriveront avec `inscription` en Phase 3). Le chemin `SuppressionProtegeeMixin` → 409 est déjà prouvé par la suite `referentiel` (`test_api` Phase 1) et par le test MRO de Task 1. **Décision** : ne pas ajouter de test 409 artificiel en Phase 2 ; Task 6 teste la suppression **204 + audit** (cas réel du module). À réintroduire en Phase 3 quand `inscription.etudiant` (RESTRICT) existera. Consigné dans le rapport (Task 11).

**2. Placeholder scan**

- Task 3 Step 1 : `parametrize` à 5 cas nommés, code final. Pas de « TODO / TBD / similar to » dans le plan.
- Task 9 Step 3 : stub `FicheEtudiant` explicitement transitoire, remplacé en Task 10 (code complet fourni). Cohérent, ordre 9→10, build vert entre les deux.
- Toutes les étapes de code portent le code réel (modèles, service, serializers, viewsets, composants, tests). Aucun « add error handling » abstrait.

**3. Type consistency**

- `_BaseCrudViewSet` (Task 1) → consommé identique par `referentiel` (Task 1) et `_BasePersonnesViewSet` (Task 6).
- `generer_matricule(pole, nom, prenoms) -> str` : signature identique Task 3 (def) ↔ Task 4 (`EtudiantSerializer.create` : `services.generer_matricule(pole, validated_data["nom"], validated_data["prenoms"])`).
- `initiales(nom, prenoms) -> str` : Task 3 def ↔ Task 3 tests. `_deux_lettres` interne, non exporté.
- `EtudiantSerializer` / `EtudiantListSerializer` : noms constants Task 4 (def) ↔ Task 6 (`get_serializer_class`) ↔ tests Tasks 4/6.
- `Champ.creationSeule?` : ajouté Task 8 (`referentiel/descripteur.ts`), consommé Task 8 (`ResourceForm`) et Task 9 (`config/etudiant.tsx`).
- `routesPersonnes` : produit Task 9 (`personnes/routes.tsx`), consommé Task 9 (`src/routes.tsx`) et testé Task 9 (`integration.test.tsx`).
- `createResourceHooks<Etudiant>("personnes/etudiants").useDetail(id)` : API existante (`lib/resource.ts`, Phase 1), réutilisée Task 10 sans modification.
- `CompteurMatricule.pole` (`primary_key`, `choices=Ecole.Pole.choices`) : défini Task 2, utilisé Task 3 (`get_or_create(pole=pole)`).
- Endpoints : `personnes/etudiants`, `personnes/affiliations`, `personnes/situation-bac`, `personnes/types-piece` — identiques entre `urls.py` (Task 6), descripteurs (Task 9), `FicheEtudiant` (Task 10), tests.

Aucune incohérence résiduelle.

---

## Execution Handoff

**Plan complet et sauvegardé dans `docs/superpowers/plans/2026-09-07-phase-2-personnes-etudiants.md`. Deux options d'exécution :**

**1. Subagent-Driven (recommandé)** — un sous-agent neuf par tâche, revue entre les tâches (`superpowers:subagent-driven-development`).

**2. Inline Execution** — exécution des tâches dans cette session avec points de contrôle (`superpowers:executing-plans`).

**Quelle approche ?**

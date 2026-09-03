# Phase 1 — Module référentiel académique — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Porter le Module 1 du modèle de données (11 tables) vers Django/DRF, l'exposer en CRUD sous `/api/v1/referentiel/` avec RBAC serveur et audit, convertir `utilisateur_role.ecole_id` en FK réelle, fournir une commande de seed, et poser l'ossature SPA (AppShell + scaffold CRUD générique) réutilisable par les modules suivants.

**Architecture :** Une app Django `referentiel` isolée (`models` / `services` / `serializers` / `permissions` / `filters` / `views` / `urls` / `admin` / `tests`). Logique métier (libellé de classe, année courante unique) dans `services.py`, testable hors HTTP. Frontend : un `AppShell` (sidebar/topbar/breadcrumbs + providers), un scaffold générique `ResourcePage`/`ResourceForm` piloté par un descripteur par entité, et des hooks TanStack Query générés par `createResourceHooks`.

**Tech Stack :** Python 3.13 · Django 5.2 · DRF 3.16 · django-filter · drf-spectacular · MySQL 8.4 · pytest/factory_boy · React 19 · TypeScript strict · Vite · React Router 7 · TanStack Query + TanStack Table · React Hook Form + Zod · Tailwind v4 · Radix Dialog · Vitest + React Testing Library.

**Spec :** `docs/superpowers/specs/2026-09-03-phase-1-referentiel-academique-design.md`
**Conventions de portage :** `docs/superpowers/specs/2026-09-03-conventions-portage-orm-design.md`
**Référence de conception SQL :** `db/migrations/001_referentiel_academique.sql`, `db/migrations/002_utilisateurs_audit.sql`, `db/tests/test_001_referentiel.sql`

## Global Constraints

- **Montants** FCFA : `DecimalField(max_digits=12, decimal_places=0)`. Jamais de float. *(Aucun montant dans ce module, contrainte rappelée pour cohérence.)*
- **PK/FK** : `BigAutoField` / `BIGINT` (défaut Django). Écart au SQL de référence (`INT UNSIGNED`) **assumé** — ne pas le corriger (D-ORM-1).
- **`db_table`** explicite sur chaque modèle = nom exact de la table SQL.
- **Enums** : `models.TextChoices` internes, valeurs **exactement** celles du SQL (MAJUSCULES). `CharField.max_length` = longueur de la plus longue valeur.
- **`on_delete`** : `models.RESTRICT` sur toutes les FK du module (aucune fille stricte).
- **Français** partout (tables, colonnes, enums, messages, libellés UI, commits).
- **Contrôle d'accès** : exclusivement serveur. Le front masque des boutons, ce n'est pas une sécurité.
- **Audit** : tout ViewSet du module hérite de `AuditLogMixin` (`comptes/audit.py`).
- **Portes de validation** (à repasser vertes à chaque tâche concernée) : `ruff check .` · `python manage.py check` · `python manage.py makemigrations --check --dry-run` · `pytest` · `python manage.py spectacular --file /tmp/schema.yml` (0 Error) · `npm run typecheck` · `npm test` · `npm run build`.
- **Base de test** : MySQL 8.4, `DB_USER=root` (pytest crée `test_<DB_NAME>`).
- **Commits** : messages français, préfixe `feat:` / `test:` / `chore:` ; terminer par les *trailers* :
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01HAgLuAfW7byohrEERKtDyo
  ```

---

## File Structure

**Backend — créé**

| Fichier | Responsabilité |
|---|---|
| `backend/referentiel/__init__.py` | vide |
| `backend/referentiel/apps.py` | `ReferentielConfig` |
| `backend/referentiel/models.py` | 11 modèles + `Meta` (db_table, constraints, indexes) |
| `backend/referentiel/migrations/__init__.py`, `0001_initial.py` | migration initiale |
| `backend/referentiel/services.py` | `libelle_classe()`, `definir_annee_courante()` |
| `backend/referentiel/serializers.py` | 11 `ModelSerializer` |
| `backend/referentiel/permissions.py` | `PeutEcrireReferentiel`, `PeutEcrirePedagogique` |
| `backend/referentiel/filters.py` | 11 `FilterSet` |
| `backend/referentiel/views.py` | 11 `ModelViewSet` + `_BaseReferentielViewSet` |
| `backend/referentiel/urls.py` | `DefaultRouter` |
| `backend/referentiel/admin.py` | enregistrement des 11 modèles |
| `backend/referentiel/management/commands/seed_referentiel.py` | seed idempotent |
| `backend/referentiel/tests/{__init__,factories,test_models,test_services,test_api,test_permissions,test_integrite,test_seed}.py` | tests |
| `backend/core/mixins.py` | `SuppressionProtegeeMixin` |
| `backend/comptes/migrations/0004_utilisateurrole_ecole_fk.py` | FK `utilisateur_role.ecole` |

**Backend — modifié**

| Fichier | Changement |
|---|---|
| `backend/config/settings/base.py` | `INSTALLED_APPS += ["referentiel"]` ; bloc pagination dans `REST_FRAMEWORK` |
| `backend/config/urls.py` | `path("referentiel/", include("referentiel.urls"))` dans `api_v1` |
| `backend/comptes/models.py` | `UtilisateurRole.ecole_id` → `ForeignKey("referentiel.Ecole", …)` |
| `backend/core/exceptions.py` | `ConflitSuppressionException` |

**Frontend — créé**

| Fichier | Responsabilité |
|---|---|
| `frontend/src/lib/query.ts` | `queryClient` configuré + `<AppQueryProvider>` |
| `frontend/src/lib/resource.ts` | `createResourceHooks<T>(endpoint)` |
| `frontend/src/lib/errors.ts` | `champErreurs()`, `messageErreur()` |
| `frontend/src/app/{AppShell,Sidebar,Topbar,Breadcrumbs}.tsx` | ossature |
| `frontend/src/components/{DataState,ToastProvider,ConfirmDialog}.tsx` | primitives UI |
| `frontend/src/components/{ResourcePage,ResourceForm}.tsx` | scaffold CRUD |
| `frontend/src/referentiel/descripteur.ts` | types `Descripteur`, `Champ`, `Colonne` |
| `frontend/src/referentiel/config/*.tsx` | 11 descripteurs |
| `frontend/src/referentiel/routes.tsx` | routes enfants `/referentiel/*` |

**Frontend — modifié**

| Fichier | Changement |
|---|---|
| `frontend/package.json` | deps `@tanstack/react-table`, `@radix-ui/react-dialog` |
| `frontend/src/routes.tsx` | `/` → `RequireAuth` → `AppShell` avec routes référentiel imbriquées |
| `frontend/src/main.tsx` | utiliser `queryClient` de `lib/query.ts` |

---

## Task 1 — App `referentiel` : 11 modèles + migration initiale

**Files:**
- Create: `backend/referentiel/__init__.py`, `backend/referentiel/apps.py`, `backend/referentiel/models.py`, `backend/referentiel/admin.py`, `backend/referentiel/migrations/__init__.py`
- Create: `backend/referentiel/tests/__init__.py`, `backend/referentiel/tests/factories.py`, `backend/referentiel/tests/test_models.py`
- Modify: `backend/config/settings/base.py` (INSTALLED_APPS)
- Generated: `backend/referentiel/migrations/0001_initial.py`

**Interfaces:**
- Produces: modèles `GroupeScolaire, Ecole, AnneeScolaire, ModaliteFormation, Niveau, Filiere, OptionFiliere, Classe, Matiere, Periode, SessionExamen` dans `referentiel.models`. Enums : `Ecole.Pole`, `Ecole.Regime`, `ModaliteFormation.Code`, `Matiere.Semestre`, `SessionExamen.Type`. Factories `*Factory` dans `referentiel.tests.factories`.
- Consumes: rien.

- [ ] **Step 1: Créer `apps.py`**

```python
from django.apps import AppConfig


class ReferentielConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "referentiel"
    verbose_name = "Référentiel académique"
```

- [ ] **Step 2: Écrire `models.py` (intégral)**

```python
from django.db import models
from django.db.models import Q


class GroupeScolaire(models.Model):
    nom = models.CharField(max_length=120)
    sigle = models.CharField(max_length=20, null=True, blank=True)
    logo = models.CharField(max_length=255, null=True, blank=True)
    contacts = models.CharField(max_length=120, null=True, blank=True)
    email = models.CharField(max_length=120, null=True, blank=True)
    adresse = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        db_table = "groupe_scolaire"

    def __str__(self):
        return self.nom


class Ecole(models.Model):
    class Pole(models.TextChoices):
        ESSIG = "ESSIG", "ESSIG"
        UPSS = "UPSS", "UPSS"
        CFPA = "CFPA", "CFPA"
        CICI = "CICI", "CICI"

    class Regime(models.TextChoices):
        LMD = "LMD", "LMD"
        CLASSIQUE = "CLASSIQUE", "Classique"

    groupe_scolaire = models.ForeignKey(
        GroupeScolaire, on_delete=models.RESTRICT, related_name="ecoles"
    )
    nom = models.CharField(max_length=120)
    sigle = models.CharField(max_length=20, null=True, blank=True)
    pole = models.CharField(max_length=5, choices=Pole.choices)
    regime = models.CharField(max_length=9, choices=Regime.choices)
    logo = models.CharField(max_length=255, null=True, blank=True)
    contacts = models.CharField(max_length=120, null=True, blank=True)
    email = models.CharField(max_length=120, null=True, blank=True)

    class Meta:
        db_table = "ecole"
        indexes = [models.Index(fields=["groupe_scolaire"], name="idx_ecole_groupe")]

    def __str__(self):
        return self.nom


class AnneeScolaire(models.Model):
    libelle = models.CharField(max_length=9)
    date_debut = models.DateField()
    date_fin = models.DateField()
    est_courante = models.BooleanField(default=False)

    class Meta:
        db_table = "annee_scolaire"
        constraints = [
            models.UniqueConstraint(
                fields=["libelle"], name="unq_annee_scolaire_libelle"
            ),
            models.UniqueConstraint(
                fields=["est_courante"],
                condition=Q(est_courante=True),
                name="unq_annee_scolaire_courante",
            ),
        ]

    def __str__(self):
        return self.libelle


class ModaliteFormation(models.Model):
    class Code(models.TextChoices):
        FI = "FI", "Formation initiale"
        FC = "FC", "Formation continue"
        FL = "FL", "FL"
        FT = "FT", "FT"

    code = models.CharField(max_length=2, choices=Code.choices)
    libelle = models.CharField(max_length=60)

    class Meta:
        db_table = "modalite_formation"
        constraints = [
            models.UniqueConstraint(fields=["code"], name="unq_modalite_formation_code")
        ]

    def __str__(self):
        return self.code


class Niveau(models.Model):
    ecole = models.ForeignKey(Ecole, on_delete=models.RESTRICT, related_name="niveaux")
    code = models.CharField(max_length=10)
    libelle = models.CharField(max_length=60)
    ordre = models.IntegerField()
    credits_requis = models.IntegerField(null=True, blank=True)
    a_soutenance = models.BooleanField(default=False)
    a_examen_national = models.BooleanField(default=False)

    class Meta:
        db_table = "niveau"
        constraints = [
            models.UniqueConstraint(
                fields=["ecole", "code"], name="unq_niveau_ecole_code"
            )
        ]

    def __str__(self):
        return f"{self.code} ({self.ecole.sigle or self.ecole.nom})"


class Filiere(models.Model):
    ecole = models.ForeignKey(Ecole, on_delete=models.RESTRICT, related_name="filieres")
    nom = models.CharField(max_length=80)
    sigle = models.CharField(max_length=15)

    class Meta:
        db_table = "filiere"
        constraints = [
            models.UniqueConstraint(
                fields=["ecole", "sigle"], name="unq_filiere_ecole_sigle"
            )
        ]

    def __str__(self):
        return self.sigle


class OptionFiliere(models.Model):
    filiere = models.ForeignKey(
        Filiere, on_delete=models.RESTRICT, related_name="options"
    )
    nom = models.CharField(max_length=80)
    sigle = models.CharField(max_length=15, blank=True)

    class Meta:
        db_table = "option_filiere"
        constraints = [
            models.UniqueConstraint(
                fields=["filiere", "sigle"], name="unq_option_filiere_sigle"
            )
        ]

    def __str__(self):
        return self.sigle or self.nom


class Classe(models.Model):
    annee_scolaire = models.ForeignKey(
        AnneeScolaire, on_delete=models.RESTRICT, related_name="classes"
    )
    niveau = models.ForeignKey(Niveau, on_delete=models.RESTRICT, related_name="classes")
    option_filiere = models.ForeignKey(
        OptionFiliere, on_delete=models.RESTRICT, related_name="classes"
    )
    modalite_formation = models.ForeignKey(
        ModaliteFormation, on_delete=models.RESTRICT, related_name="classes"
    )
    libelle_auto = models.CharField(max_length=120, editable=False)
    effectif_max = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = "classe"
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "annee_scolaire",
                    "niveau",
                    "option_filiere",
                    "modalite_formation",
                ],
                name="unq_classe",
            )
        ]

    def __str__(self):
        return self.libelle_auto


class Matiere(models.Model):
    class Semestre(models.TextChoices):
        S1 = "S1", "Semestre 1"
        S2 = "S2", "Semestre 2"

    niveau = models.ForeignKey(Niveau, on_delete=models.RESTRICT, related_name="matieres")
    option_filiere = models.ForeignKey(
        OptionFiliere, on_delete=models.RESTRICT, related_name="matieres"
    )
    semestre = models.CharField(max_length=2, choices=Semestre.choices)
    nom = models.CharField(max_length=120)
    code = models.CharField(max_length=20)
    coefficient = models.IntegerField()
    credits = models.IntegerField(null=True, blank=True)
    volume_horaire = models.IntegerField()

    class Meta:
        db_table = "matiere"
        constraints = [
            models.UniqueConstraint(
                fields=["niveau", "option_filiere", "semestre", "code"],
                name="unq_matiere",
            )
        ]

    def __str__(self):
        return f"{self.code} {self.nom}"


class Periode(models.Model):
    annee_scolaire = models.ForeignKey(
        AnneeScolaire, on_delete=models.RESTRICT, related_name="periodes"
    )
    numero = models.IntegerField()
    libelle = models.CharField(max_length=40)
    date_debut = models.DateField()
    date_fin = models.DateField()

    class Meta:
        db_table = "periode"
        constraints = [
            models.UniqueConstraint(
                fields=["annee_scolaire", "numero"], name="unq_periode"
            )
        ]

    def __str__(self):
        return f"{self.libelle} {self.annee_scolaire.libelle}"


class SessionExamen(models.Model):
    class Type(models.TextChoices):
        NORMALE = "NORMALE", "Normale"
        RATTRAPAGE = "RATTRAPAGE", "Rattrapage"

    periode = models.ForeignKey(
        Periode, on_delete=models.RESTRICT, related_name="sessions"
    )
    type = models.CharField(max_length=10, choices=Type.choices)
    date_debut = models.DateField(null=True, blank=True)
    date_fin = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "session_examen"
        constraints = [
            models.UniqueConstraint(
                fields=["periode", "type"], name="unq_session_examen"
            )
        ]

    def __str__(self):
        return f"{self.type} — {self.periode}"
```

- [ ] **Step 3: `admin.py`**

```python
from django.contrib import admin

from . import models

for _m in (
    models.GroupeScolaire,
    models.Ecole,
    models.AnneeScolaire,
    models.ModaliteFormation,
    models.Niveau,
    models.Filiere,
    models.OptionFiliere,
    models.Classe,
    models.Matiere,
    models.Periode,
    models.SessionExamen,
):
    admin.site.register(_m)
```

- [ ] **Step 4: Enregistrer l'app**

Dans `backend/config/settings/base.py`, `INSTALLED_APPS`, après `"comptes",` ajouter `"referentiel",`.

- [ ] **Step 5: `tests/factories.py`**

```python
import factory

from referentiel import models


class GroupeScolaireFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.GroupeScolaire

    nom = factory.Sequence(lambda n: f"Groupe {n}")


class EcoleFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Ecole

    groupe_scolaire = factory.SubFactory(GroupeScolaireFactory)
    nom = factory.Sequence(lambda n: f"Ecole {n}")
    sigle = factory.Sequence(lambda n: f"E{n}")
    pole = models.Ecole.Pole.ESSIG
    regime = models.Ecole.Regime.LMD


class AnneeScolaireFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.AnneeScolaire

    libelle = factory.Sequence(lambda n: f"20{20 + n}-20{21 + n}")
    date_debut = "2025-10-01"
    date_fin = "2026-08-31"
    est_courante = False


class ModaliteFormationFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.ModaliteFormation

    code = factory.Iterator(
        [c for c in models.ModaliteFormation.Code.values]
    )
    libelle = factory.LazyAttribute(lambda o: f"Modalité {o.code}")


class NiveauFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Niveau

    ecole = factory.SubFactory(EcoleFactory)
    code = factory.Sequence(lambda n: f"L{n}")
    libelle = factory.LazyAttribute(lambda o: f"Niveau {o.code}")
    ordre = factory.Sequence(lambda n: n + 1)
    credits_requis = 60


class FiliereFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Filiere

    ecole = factory.SubFactory(EcoleFactory)
    nom = factory.Sequence(lambda n: f"Filière {n}")
    sigle = factory.Sequence(lambda n: f"F{n}")


class OptionFiliereFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.OptionFiliere

    filiere = factory.SubFactory(FiliereFactory)
    nom = factory.Sequence(lambda n: f"Option {n}")
    sigle = factory.Sequence(lambda n: f"O{n}")


class ClasseFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Classe

    annee_scolaire = factory.SubFactory(AnneeScolaireFactory)
    niveau = factory.SubFactory(NiveauFactory)
    option_filiere = factory.SubFactory(OptionFiliereFactory)
    modalite_formation = factory.SubFactory(ModaliteFormationFactory)
    libelle_auto = "à recalculer"


class MatiereFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Matiere

    niveau = factory.SubFactory(NiveauFactory)
    option_filiere = factory.SubFactory(OptionFiliereFactory)
    semestre = models.Matiere.Semestre.S1
    nom = factory.Sequence(lambda n: f"Matière {n}")
    code = factory.Sequence(lambda n: f"M{n}")
    coefficient = 2
    credits = 4
    volume_horaire = 30


class PeriodeFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Periode

    annee_scolaire = factory.SubFactory(AnneeScolaireFactory)
    numero = factory.Sequence(lambda n: (n % 2) + 1)
    libelle = factory.LazyAttribute(lambda o: f"Semestre {o.numero}")
    date_debut = "2025-10-01"
    date_fin = "2026-02-28"


class SessionExamenFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.SessionExamen

    periode = factory.SubFactory(PeriodeFactory)
    type = models.SessionExamen.Type.NORMALE
```

- [ ] **Step 6: `tests/test_models.py` (RED)**

```python
import pytest
from django.db import IntegrityError

from referentiel import models
from referentiel.tests import factories as f

pytestmark = pytest.mark.django_db


def test_db_tables_sont_les_noms_cibles():
    assert models.OptionFiliere._meta.db_table == "option_filiere"
    assert models.SessionExamen._meta.db_table == "session_examen"


def test_niveau_unicite_ecole_code():
    e = f.EcoleFactory()
    f.NiveauFactory(ecole=e, code="L1")
    with pytest.raises(IntegrityError):
        f.NiveauFactory(ecole=e, code="L1")


def test_niveau_credits_requis_nullable():
    n = f.NiveauFactory(credits_requis=None)
    n.refresh_from_db()
    assert n.credits_requis is None


def test_une_seule_annee_courante():
    f.AnneeScolaireFactory(est_courante=True)
    with pytest.raises(IntegrityError):
        f.AnneeScolaireFactory(est_courante=True)


def test_restrict_empeche_suppression_ecole_referencee():
    n = f.NiveauFactory()
    with pytest.raises(IntegrityError):
        n.ecole.delete()


def test_classe_unicite_quadruplet():
    c = f.ClasseFactory()
    with pytest.raises(IntegrityError):
        f.ClasseFactory(
            annee_scolaire=c.annee_scolaire,
            niveau=c.niveau,
            option_filiere=c.option_filiere,
            modalite_formation=c.modalite_formation,
        )
```

- [ ] **Step 7: Générer la migration**

Run: `cd backend && python manage.py makemigrations referentiel`
Expected: `0001_initial.py` créé avec les 11 modèles.

- [ ] **Step 8: Diff `sqlmigrate` contre le SQL de référence**

Run: `cd backend && python manage.py sqlmigrate referentiel 0001`
Comparer au `db/migrations/001_referentiel_academique.sql` : colonnes, nullabilité, longueurs `VARCHAR`, `UNIQUE` composites, index `idx_ecole_groupe`, FK ciblées. **Écarts acceptés** : type entier PK/FK (`bigint` vs `int unsigned`) ; `unq_annee_scolaire_courante` (contrainte partielle ajoutée, RM-2). Tout autre écart → corriger le modèle et régénérer. Consigner le résultat dans le rapport de tâche.

- [ ] **Step 9: Lancer les tests**

Run: `cd backend && pytest referentiel/tests/test_models.py -v`
Expected: PASS (6 tests).

- [ ] **Step 10: Portes + commit**

Run: `cd backend && ruff check . && python manage.py check && python manage.py makemigrations --check --dry-run && pytest`
Expected: tout vert.

```bash
git add backend/referentiel backend/config/settings/base.py
git commit -m "feat(referentiel): 11 modeles du referentiel academique + migration initiale

Portage du Module 1 (db/migrations/001). PK/FK BIGINT (D-ORM-1) ;
unicites composites reproduites ; contrainte partielle une-seule-annee-courante.
sqlmigrate diffe contre le SQL de reference (ecarts: types entiers, annee courante).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HAgLuAfW7byohrEERKtDyo"
```

**Critère d'acceptation :** les 11 modèles existent avec `db_table` cible ; `makemigrations --check` propre ; `test_models` vert ; diff `sqlmigrate` consigné sans écart non justifié.

---

## Task 2 — Services : libellé de classe + année courante

**Files:**
- Create: `backend/referentiel/services.py`
- Create: `backend/referentiel/tests/test_services.py`

**Interfaces:**
- Consumes: modèles de Task 1.
- Produces:
  - `libelle_classe(*, niveau, option_filiere, modalite_formation, annee_scolaire) -> str`
  - `definir_annee_courante(annee: AnneeScolaire) -> None` (met `est_courante=True` sur `annee`, `False` sur les autres, atomique)

- [ ] **Step 1: `tests/test_services.py` (RED)**

```python
import pytest

from referentiel import models, services
from referentiel.tests import factories as f

pytestmark = pytest.mark.django_db


def _classe_parts(option_sigle="CI"):
    e = f.EcoleFactory()
    niveau = f.NiveauFactory(ecole=e, code="L1")
    filiere = f.FiliereFactory(ecole=e, sigle="GACO")
    option = f.OptionFiliereFactory(filiere=filiere, sigle=option_sigle)
    modalite = f.ModaliteFormationFactory(code="FI")
    annee = f.AnneeScolaireFactory(libelle="2025-2026")
    return dict(
        niveau=niveau,
        option_filiere=option,
        modalite_formation=modalite,
        annee_scolaire=annee,
    )


def test_libelle_classe_complet():
    assert (
        services.libelle_classe(**_classe_parts("CI"))
        == "L1 GACO/CI FI 2025-2026"
    )


def test_libelle_classe_sans_sigle_option():
    assert (
        services.libelle_classe(**_classe_parts(""))
        == "L1 GACO FI 2025-2026"
    )


def test_definir_annee_courante_bascule_les_autres():
    a1 = f.AnneeScolaireFactory(est_courante=True)
    a2 = f.AnneeScolaireFactory(est_courante=False)
    services.definir_annee_courante(a2)
    a1.refresh_from_db()
    a2.refresh_from_db()
    assert a2.est_courante is True
    assert a1.est_courante is False
    assert models.AnneeScolaire.objects.filter(est_courante=True).count() == 1
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd backend && pytest referentiel/tests/test_services.py -v`
Expected: FAIL (`ModuleNotFoundError` / `AttributeError`).

- [ ] **Step 3: Écrire `services.py`**

```python
from django.db import transaction

from .models import AnneeScolaire


def libelle_classe(*, niveau, option_filiere, modalite_formation, annee_scolaire) -> str:
    filiere_sigle = option_filiere.filiere.sigle
    option_sigle = (option_filiere.sigle or "").strip()
    tete = f"{filiere_sigle}/{option_sigle}" if option_sigle else filiere_sigle
    return (
        f"{niveau.code} {tete} {modalite_formation.code} {annee_scolaire.libelle}"
    )


@transaction.atomic
def definir_annee_courante(annee: AnneeScolaire) -> None:
    AnneeScolaire.objects.filter(est_courante=True).exclude(pk=annee.pk).update(
        est_courante=False
    )
    if not annee.est_courante:
        annee.est_courante = True
        annee.save(update_fields=["est_courante"])
```

- [ ] **Step 4: Vérifier le succès**

Run: `cd backend && pytest referentiel/tests/test_services.py -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/referentiel/services.py backend/referentiel/tests/test_services.py
git commit -m "feat(referentiel): services libelle_classe + definir_annee_courante

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HAgLuAfW7byohrEERKtDyo"
```

**Critère d'acceptation :** `libelle_classe` produit `L1 GACO/CI FI 2025-2026` et `L1 GACO FI 2025-2026` (option sans sigle) ; `definir_annee_courante` laisse exactement une année courante.

---

## Task 3 — FK `utilisateur_role.ecole`

**Files:**
- Modify: `backend/comptes/models.py:54-68` (`UtilisateurRole`)
- Create: `backend/comptes/migrations/0004_utilisateurrole_ecole_fk.py` (généré)
- Create: `backend/comptes/tests/test_utilisateur_role_ecole.py`

**Interfaces:**
- Consumes: `referentiel.Ecole` (Task 1).
- Produces: `UtilisateurRole.ecole` (FK, `null=True`), colonne DB inchangée (`ecole_id`).

- [ ] **Step 1: Écrire le test (RED)**

```python
import pytest

from comptes.models import Role, UtilisateurRole
from comptes.tests.factories import UtilisateurFactory
from referentiel.tests.factories import EcoleFactory

pytestmark = pytest.mark.django_db


def test_utilisateur_role_pointe_une_ecole_reelle():
    champ = UtilisateurRole._meta.get_field("ecole")
    assert champ.related_model.__name__ == "Ecole"
    assert champ.null is True


def test_role_scope_ecole():
    u = UtilisateurFactory()
    r = Role.objects.create(code=Role.Code.SCOLARITE, libelle="Scolarité")
    e = EcoleFactory()
    ur = UtilisateurRole.objects.create(utilisateur=u, role=r, ecole=e)
    assert ur.ecole_id == e.pk
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd backend && pytest comptes/tests/test_utilisateur_role_ecole.py -v`
Expected: FAIL (`ecole` field does not exist / `FieldDoesNotExist`).

- [ ] **Step 3: Modifier le modèle**

Dans `backend/comptes/models.py`, remplacer la ligne
`ecole_id = models.PositiveIntegerField(null=True, blank=True)` par :

```python
    ecole = models.ForeignKey(
        "referentiel.Ecole",
        on_delete=models.RESTRICT,
        null=True,
        blank=True,
        db_column="ecole_id",
        db_index=True,
        related_name="+",
    )
```

Dans le même fichier, `UtilisateurRole.Meta.constraints` : remplacer `fields=["utilisateur", "role", "ecole_id"]` par `fields=["utilisateur", "role", "ecole"]` (le nom de contrainte `uniq_utilisateur_role_ecole` reste). Adapter `__str__` : `self.ecole_id` reste valide (attribut d'accès rapide de la FK).

- [ ] **Step 4: Générer la migration**

Run: `cd backend && python manage.py makemigrations comptes`
Expected: `0004_utilisateurrole_ecole_fk.py` (AlterField + AlterUniqueTogether/constraint). Vérifier qu'elle dépend de `referentiel.0001_initial` (Django l'ajoute automatiquement) ; sinon ajouter `("referentiel", "0001_initial")` à `dependencies`.

- [ ] **Step 5: Vérifier**

Run: `cd backend && pytest comptes/ referentiel/ -v && python manage.py makemigrations --check --dry-run`
Expected: tous verts, y compris `test_permissions.py`, `test_seed_socle.py`, `test_auth_jwt.py` existants.

- [ ] **Step 6: Commit**

```bash
git add backend/comptes
git commit -m "feat(comptes): utilisateur_role.ecole devient une FK vers referentiel.Ecole

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HAgLuAfW7byohrEERKtDyo"
```

**Critère d'acceptation :** `UtilisateurRole.ecole` est une FK nullable vers `Ecole` ; suite `comptes` (RBAC, seed_socle, JWT) toujours verte ; `makemigrations --check` propre.

---

## Task 4 — `ConflitSuppressionException` + `SuppressionProtegeeMixin`

**Files:**
- Modify: `backend/core/exceptions.py` (ajout classe)
- Create: `backend/core/mixins.py`
- Create: `backend/core/tests/test_mixins.py`

**Interfaces:**
- Produces:
  - `core.exceptions.ConflitSuppressionException` (`status_code = 409`, `default_code = "conflit_suppression"`)
  - `core.mixins.SuppressionProtegeeMixin` : surcharge `perform_destroy(self, instance)` — capture `django.db.models.RestrictedError` et `django.db.models.ProtectedError`, lève `ConflitSuppressionException`.

- [ ] **Step 1: Test (RED)**

```python
import pytest
from django.db.models import RestrictedError
from rest_framework.test import APIRequestFactory

from core.exceptions import ConflitSuppressionException
from core.mixins import SuppressionProtegeeMixin


class _Vue(SuppressionProtegeeMixin):
    def __init__(self, exc):
        self._exc = exc

    def _perform_reel(self, instance):
        raise self._exc


def test_restricted_error_devient_409():
    vue = _Vue(RestrictedError("nope", set()))
    # perform_destroy attend un objet avec .delete()
    class Obj:
        def delete(self):
            raise RestrictedError("nope", set())

    with pytest.raises(ConflitSuppressionException) as e:
        vue.perform_destroy(Obj())
    assert e.value.status_code == 409
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd backend && pytest core/tests/test_mixins.py -v`
Expected: FAIL (`ModuleNotFoundError: core.mixins`).

- [ ] **Step 3: Ajouter l'exception**

Dans `backend/core/exceptions.py`, à la fin :

```python
class ConflitSuppressionException(APIException):
    status_code = 409
    default_detail = _(
        "Suppression impossible : cet élément est référencé ailleurs."
    )
    default_code = "conflit_suppression"
```

- [ ] **Step 4: Écrire `core/mixins.py`**

```python
from django.db.models import ProtectedError, RestrictedError

from .exceptions import ConflitSuppressionException


class SuppressionProtegeeMixin:
    """Traduit un refus d'intégrité référentielle (`on_delete=RESTRICT`/`PROTECT`)
    en réponse HTTP 409 au lieu d'une 500."""

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except (RestrictedError, ProtectedError) as exc:
            raise ConflitSuppressionException() from exc
```

- [ ] **Step 5: Vérifier le succès**

Run: `cd backend && pytest core/tests/test_mixins.py -v`
Expected: PASS.

- [ ] **Step 6: Portes + commit**

Run: `cd backend && ruff check . && pytest`

```bash
git add backend/core
git commit -m "feat(core): SuppressionProtegeeMixin + ConflitSuppressionException (409)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HAgLuAfW7byohrEERKtDyo"
```

**Critère d'acceptation :** une suppression bloquée par `RESTRICT` lève une `APIException` 409 typée.

---

## Task 5 — Serializers (11)

**Files:**
- Create: `backend/referentiel/serializers.py`
- Create: `backend/referentiel/tests/test_serializers.py`

**Interfaces:**
- Consumes: modèles Task 1, `services.libelle_classe` Task 2.
- Produces: `GroupeScolaireSerializer, EcoleSerializer, AnneeScolaireSerializer, ModaliteFormationSerializer, NiveauSerializer, FiliereSerializer, OptionFiliereSerializer, ClasseSerializer, MatiereSerializer, PeriodeSerializer, SessionExamenSerializer` dans `referentiel.serializers`.

**Règles communes :**
- `fields = "__all__"`.
- Les FK sont exposées en écriture par leur `*_id` (défaut DRF `PrimaryKeyRelatedField`, nom `<fk>` — on garde `<fk>` p.ex. `ecole`).
- Pour chaque FK affichée en liste, ajouter un champ lecture seule `<fk>_libelle` (`source="<fk>.__str__"` via `SerializerMethodField` ou `CharField(source=..., read_only=True)`).
- `ClasseSerializer` : `libelle_auto` en `read_only`; `create`/`update` recalculent via `services.libelle_classe`.

- [ ] **Step 1: `tests/test_serializers.py` (RED)**

```python
import pytest

from referentiel.serializers import ClasseSerializer, NiveauSerializer
from referentiel.tests import factories as f

pytestmark = pytest.mark.django_db


def test_niveau_serializer_expose_ecole_libelle():
    n = f.NiveauFactory()
    data = NiveauSerializer(n).data
    assert data["ecole"] == n.ecole_id
    assert data["ecole_libelle"] == str(n.ecole)


def test_classe_serializer_calcule_libelle_auto_a_la_creation():
    e = f.EcoleFactory()
    niveau = f.NiveauFactory(ecole=e, code="L1")
    filiere = f.FiliereFactory(ecole=e, sigle="GACO")
    option = f.OptionFiliereFactory(filiere=filiere, sigle="CI")
    modalite = f.ModaliteFormationFactory(code="FI")
    annee = f.AnneeScolaireFactory(libelle="2025-2026")
    s = ClasseSerializer(
        data={
            "annee_scolaire": annee.pk,
            "niveau": niveau.pk,
            "option_filiere": option.pk,
            "modalite_formation": modalite.pk,
        }
    )
    assert s.is_valid(), s.errors
    classe = s.save()
    assert classe.libelle_auto == "L1 GACO/CI FI 2025-2026"


def test_classe_serializer_ignore_libelle_auto_poste():
    e = f.EcoleFactory()
    s = ClasseSerializer(
        data={
            "annee_scolaire": f.AnneeScolaireFactory(libelle="2030-2031").pk,
            "niveau": f.NiveauFactory(ecole=e, code="L2").pk,
            "option_filiere": f.OptionFiliereFactory().pk,
            "modalite_formation": f.ModaliteFormationFactory(code="FC").pk,
            "libelle_auto": "PIRATÉ",
        }
    )
    assert s.is_valid(), s.errors
    assert s.save().libelle_auto != "PIRATÉ"
```

- [ ] **Step 2: Vérifier l'échec** — `pytest referentiel/tests/test_serializers.py -v` → FAIL.

- [ ] **Step 3: Écrire `serializers.py`**

```python
from rest_framework import serializers

from . import models, services


class GroupeScolaireSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.GroupeScolaire
        fields = "__all__"


class EcoleSerializer(serializers.ModelSerializer):
    groupe_scolaire_libelle = serializers.CharField(
        source="groupe_scolaire.__str__", read_only=True
    )

    class Meta:
        model = models.Ecole
        fields = "__all__"


class AnneeScolaireSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.AnneeScolaire
        fields = "__all__"


class ModaliteFormationSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.ModaliteFormation
        fields = "__all__"


class NiveauSerializer(serializers.ModelSerializer):
    ecole_libelle = serializers.CharField(source="ecole.__str__", read_only=True)

    class Meta:
        model = models.Niveau
        fields = "__all__"


class FiliereSerializer(serializers.ModelSerializer):
    ecole_libelle = serializers.CharField(source="ecole.__str__", read_only=True)

    class Meta:
        model = models.Filiere
        fields = "__all__"


class OptionFiliereSerializer(serializers.ModelSerializer):
    filiere_libelle = serializers.CharField(source="filiere.__str__", read_only=True)

    class Meta:
        model = models.OptionFiliere
        fields = "__all__"


class ClasseSerializer(serializers.ModelSerializer):
    libelle_auto = serializers.CharField(read_only=True)

    class Meta:
        model = models.Classe
        fields = "__all__"

    def _libelle(self, validated):
        return services.libelle_classe(
            niveau=validated["niveau"],
            option_filiere=validated["option_filiere"],
            modalite_formation=validated["modalite_formation"],
            annee_scolaire=validated["annee_scolaire"],
        )

    def create(self, validated_data):
        validated_data["libelle_auto"] = self._libelle(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        fusion = {
            "niveau": validated_data.get("niveau", instance.niveau),
            "option_filiere": validated_data.get(
                "option_filiere", instance.option_filiere
            ),
            "modalite_formation": validated_data.get(
                "modalite_formation", instance.modalite_formation
            ),
            "annee_scolaire": validated_data.get(
                "annee_scolaire", instance.annee_scolaire
            ),
        }
        validated_data["libelle_auto"] = self._libelle(fusion)
        return super().update(instance, validated_data)


class MatiereSerializer(serializers.ModelSerializer):
    niveau_libelle = serializers.CharField(source="niveau.__str__", read_only=True)
    option_filiere_libelle = serializers.CharField(
        source="option_filiere.__str__", read_only=True
    )

    class Meta:
        model = models.Matiere
        fields = "__all__"


class PeriodeSerializer(serializers.ModelSerializer):
    annee_scolaire_libelle = serializers.CharField(
        source="annee_scolaire.__str__", read_only=True
    )

    class Meta:
        model = models.Periode
        fields = "__all__"


class SessionExamenSerializer(serializers.ModelSerializer):
    periode_libelle = serializers.CharField(source="periode.__str__", read_only=True)

    class Meta:
        model = models.SessionExamen
        fields = "__all__"
```

- [ ] **Step 4: Vérifier le succès** — `pytest referentiel/tests/test_serializers.py -v` → PASS (3).

- [ ] **Step 5: Portes + commit**

```bash
git add backend/referentiel/serializers.py backend/referentiel/tests/test_serializers.py
git commit -m "feat(referentiel): serializers des 11 entites (libelle_auto calcule, libelles amont)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HAgLuAfW7byohrEERKtDyo"
```

**Critère d'acceptation :** chaque serializer expose les `*_id` en écriture + un `*_libelle` en lecture ; `ClasseSerializer` calcule `libelle_auto` et ignore toute valeur postée.

---

## Task 6 — Permissions + FilterSets

**Files:**
- Create: `backend/referentiel/permissions.py`
- Create: `backend/referentiel/filters.py`
- Create: `backend/referentiel/tests/test_permissions_unit.py`

**Interfaces:**
- Consumes: `comptes.permissions.ARole` (existant), `django_filters`.
- Produces:
  - `referentiel.permissions.PeutEcrireReferentiel`, `PeutEcrirePedagogique` (classes DRF `BasePermission`).
  - `referentiel.filters.{GroupeScolaireFilter, EcoleFilter, AnneeScolaireFilter, ModaliteFormationFilter, NiveauFilter, FiliereFilter, OptionFiliereFilter, ClasseFilter, MatiereFilter, PeriodeFilter, SessionExamenFilter}`.

- [ ] **Step 1: `tests/test_permissions_unit.py` (RED)**

```python
import pytest
from rest_framework.test import APIRequestFactory

from comptes.models import Role, UtilisateurRole
from comptes.tests.factories import UtilisateurFactory
from referentiel.permissions import PeutEcrirePedagogique, PeutEcrireReferentiel

pytestmark = pytest.mark.django_db
rf = APIRequestFactory()


def _user_avec(code):
    u = UtilisateurFactory()
    r, _ = Role.objects.get_or_create(code=code, defaults={"libelle": code})
    UtilisateurRole.objects.create(utilisateur=u, role=r)
    return u


def test_lecture_ouverte_a_tout_authentifie():
    req = rf.get("/x")
    req.user = _user_avec(Role.Code.LECTURE)
    assert PeutEcrireReferentiel().has_permission(req, None) is True


def test_ecriture_referentiel_reservee_direction():
    for code, attendu in [
        (Role.Code.DIRECTION, True),
        (Role.Code.SCOLARITE, False),
        (Role.Code.LECTURE, False),
    ]:
        req = rf.post("/x")
        req.user = _user_avec(code)
        assert PeutEcrireReferentiel().has_permission(req, None) is attendu


def test_ecriture_pedagogique_direction_ou_scolarite():
    for code, attendu in [
        (Role.Code.DIRECTION, True),
        (Role.Code.SCOLARITE, True),
        (Role.Code.COMPTABLE, False),
    ]:
        req = rf.post("/x")
        req.user = _user_avec(code)
        assert PeutEcrirePedagogique().has_permission(req, None) is attendu
```

- [ ] **Step 2: Vérifier l'échec** — FAIL (`ModuleNotFoundError`).

- [ ] **Step 3: `permissions.py`**

```python
from rest_framework.permissions import SAFE_METHODS, BasePermission

from comptes.permissions import ARole

_EcritDirection = ARole("DIRECTION")
_EcritPedago = ARole("DIRECTION", "SCOLARITE")


class PeutEcrireReferentiel(BasePermission):
    message = "Rôle DIRECTION requis pour modifier ce référentiel."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return _EcritDirection().has_permission(request, view)


class PeutEcrirePedagogique(BasePermission):
    message = "Rôle DIRECTION ou SCOLARITE requis."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return _EcritPedago().has_permission(request, view)
```

- [ ] **Step 4: `filters.py`**

```python
import django_filters as df

from . import models


class GroupeScolaireFilter(df.FilterSet):
    class Meta:
        model = models.GroupeScolaire
        fields = {"nom": ["icontains"]}


class EcoleFilter(df.FilterSet):
    class Meta:
        model = models.Ecole
        fields = {"groupe_scolaire": ["exact"], "pole": ["exact"], "regime": ["exact"]}


class AnneeScolaireFilter(df.FilterSet):
    class Meta:
        model = models.AnneeScolaire
        fields = {"est_courante": ["exact"], "libelle": ["icontains"]}


class ModaliteFormationFilter(df.FilterSet):
    class Meta:
        model = models.ModaliteFormation
        fields = {"code": ["exact"]}


class NiveauFilter(df.FilterSet):
    class Meta:
        model = models.Niveau
        fields = {"ecole": ["exact"], "code": ["icontains"]}


class FiliereFilter(df.FilterSet):
    class Meta:
        model = models.Filiere
        fields = {"ecole": ["exact"], "sigle": ["icontains"]}


class OptionFiliereFilter(df.FilterSet):
    class Meta:
        model = models.OptionFiliere
        fields = {"filiere": ["exact"]}


class ClasseFilter(df.FilterSet):
    class Meta:
        model = models.Classe
        fields = {
            "annee_scolaire": ["exact"],
            "niveau": ["exact"],
            "option_filiere": ["exact"],
            "modalite_formation": ["exact"],
        }


class MatiereFilter(df.FilterSet):
    class Meta:
        model = models.Matiere
        fields = {
            "niveau": ["exact"],
            "option_filiere": ["exact"],
            "semestre": ["exact"],
        }


class PeriodeFilter(df.FilterSet):
    class Meta:
        model = models.Periode
        fields = {"annee_scolaire": ["exact"], "numero": ["exact"]}


class SessionExamenFilter(df.FilterSet):
    class Meta:
        model = models.SessionExamen
        fields = {"periode": ["exact"], "type": ["exact"]}
```

- [ ] **Step 5: Vérifier le succès** — `pytest referentiel/tests/test_permissions_unit.py -v` → PASS (3).

- [ ] **Step 6: Portes + commit**

```bash
git add backend/referentiel/permissions.py backend/referentiel/filters.py backend/referentiel/tests/test_permissions_unit.py
git commit -m "feat(referentiel): classes de permission + FilterSets

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HAgLuAfW7byohrEERKtDyo"
```

**Critère d'acceptation :** lecture ouverte à tout authentifié ; `PeutEcrireReferentiel` n'accepte que DIRECTION ; `PeutEcrirePedagogique` accepte DIRECTION + SCOLARITE.

---

## Task 7 — ViewSets, router, pagination, OpenAPI, régénération des types

**Files:**
- Create: `backend/referentiel/views.py`, `backend/referentiel/urls.py`
- Create: `backend/referentiel/tests/test_api.py`
- Modify: `backend/config/settings/base.py` (`REST_FRAMEWORK` : pagination)
- Modify: `backend/config/urls.py` (`api_v1`)
- Modify: `frontend/src/api/schema.d.ts`, `frontend/src/api/types.ts` (régénérés)

**Interfaces:**
- Consumes: serializers Task 5, permissions/filtres Task 6, `AuditLogMixin` (`comptes.audit`), `SuppressionProtegeeMixin` (Task 4).
- Produces: routes REST `/api/v1/referentiel/<ressource>/` pour les 11 entités (voir spec §10). `components["schemas"]` OpenAPI peuplés.

- [ ] **Step 1: Pagination de socle**

Dans `backend/config/settings/base.py`, `REST_FRAMEWORK` : ajouter
```python
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
```

- [ ] **Step 2: `tests/test_api.py` (RED)** — tests d'intégration DRF

```python
import pytest
from rest_framework.test import APIClient

from comptes.models import JournalAudit, Role, UtilisateurRole
from comptes.tests.factories import UtilisateurFactory
from referentiel.tests import factories as f

pytestmark = pytest.mark.django_db


def _client(role_code=None, superuser=False):
    u = UtilisateurFactory(is_superuser=superuser, is_staff=superuser)
    if role_code:
        r, _ = Role.objects.get_or_create(
            code=role_code, defaults={"libelle": role_code}
        )
        UtilisateurRole.objects.create(utilisateur=u, role=r)
    c = APIClient()
    c.force_authenticate(u)
    return c, u


def test_liste_paginee():
    f.EcoleFactory.create_batch(3)
    c, _ = _client(Role.Code.LECTURE)
    resp = c.get("/api/v1/referentiel/ecoles/")
    assert resp.status_code == 200
    assert resp.data["count"] == 3
    assert "results" in resp.data


def test_filtre_niveau_par_ecole():
    e1, e2 = f.EcoleFactory(), f.EcoleFactory()
    f.NiveauFactory(ecole=e1)
    f.NiveauFactory(ecole=e2)
    c, _ = _client(Role.Code.LECTURE)
    resp = c.get(f"/api/v1/referentiel/niveaux/?ecole={e1.pk}")
    assert resp.data["count"] == 1


def test_recherche_matiere():
    f.MatiereFactory(nom="Comptabilité générale")
    f.MatiereFactory(nom="Droit")
    c, _ = _client(Role.Code.LECTURE)
    resp = c.get("/api/v1/referentiel/matieres/?search=compta")
    assert resp.data["count"] == 1


def test_direction_cree_ecole_et_ecrit_un_audit():
    c, _ = _client(Role.Code.DIRECTION)
    g = f.GroupeScolaireFactory()
    resp = c.post(
        "/api/v1/referentiel/ecoles/",
        {
            "groupe_scolaire": g.pk,
            "nom": "ESSIG",
            "pole": "ESSIG",
            "regime": "LMD",
        },
        format="json",
    )
    assert resp.status_code == 201
    assert JournalAudit.objects.filter(
        action="CREATION", table_cible="ecole"
    ).exists()


def test_scolarite_cree_classe_mais_pas_ecole():
    c, _ = _client(Role.Code.SCOLARITE)
    g = f.GroupeScolaireFactory()
    assert (
        c.post(
            "/api/v1/referentiel/ecoles/",
            {"groupe_scolaire": g.pk, "nom": "x", "pole": "CFPA", "regime": "CLASSIQUE"},
            format="json",
        ).status_code
        == 403
    )
    e = f.EcoleFactory()
    payload = {
        "annee_scolaire": f.AnneeScolaireFactory().pk,
        "niveau": f.NiveauFactory(ecole=e).pk,
        "option_filiere": f.OptionFiliereFactory().pk,
        "modalite_formation": f.ModaliteFormationFactory(code="FI").pk,
    }
    assert (
        c.post(
            "/api/v1/referentiel/classes/", payload, format="json"
        ).status_code
        == 201
    )


def test_anonyme_401():
    assert APIClient().get("/api/v1/referentiel/ecoles/").status_code == 401


def test_suppression_referencee_409():
    n = f.NiveauFactory()
    c, _ = _client(Role.Code.DIRECTION)
    resp = c.delete(f"/api/v1/referentiel/ecoles/{n.ecole_id}/")
    assert resp.status_code == 409


def test_libelle_auto_lecture_seule_via_api():
    c, _ = _client(Role.Code.DIRECTION)
    e = f.EcoleFactory()
    resp = c.post(
        "/api/v1/referentiel/classes/",
        {
            "annee_scolaire": f.AnneeScolaireFactory(libelle="2025-2026").pk,
            "niveau": f.NiveauFactory(ecole=e, code="L1").pk,
            "option_filiere": f.OptionFiliereFactory(
                filiere=f.FiliereFactory(ecole=e, sigle="GACO"), sigle="CI"
            ).pk,
            "modalite_formation": f.ModaliteFormationFactory(code="FI").pk,
            "libelle_auto": "PIRATÉ",
        },
        format="json",
    )
    assert resp.status_code == 201
    assert resp.data["libelle_auto"] == "L1 GACO/CI FI 2025-2026"
```

- [ ] **Step 3: Vérifier l'échec** — `pytest referentiel/tests/test_api.py -v` → FAIL (404 / no urls).

- [ ] **Step 4: `views.py`**

```python
from comptes.audit import AuditLogMixin
from core.mixins import SuppressionProtegeeMixin
from drf_spectacular.utils import extend_schema
from rest_framework import filters, viewsets

from . import filters as ref_filters
from . import models, permissions, serializers


@extend_schema(tags=["referentiel"])
class _BaseReferentielViewSet(
    SuppressionProtegeeMixin, AuditLogMixin, viewsets.ModelViewSet
):
    permission_classes = [permissions.PeutEcrireReferentiel]
    filter_backends = [
        ref_filters.df_backend if False else __import__(
            "django_filters.rest_framework", fromlist=["DjangoFilterBackend"]
        ).DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    ordering = ["id"]


class GroupeScolaireViewSet(_BaseReferentielViewSet):
    queryset = models.GroupeScolaire.objects.all()
    serializer_class = serializers.GroupeScolaireSerializer
    filterset_class = ref_filters.GroupeScolaireFilter
    search_fields = ["nom", "sigle"]
    ordering_fields = ["nom", "id"]


class EcoleViewSet(_BaseReferentielViewSet):
    queryset = models.Ecole.objects.select_related("groupe_scolaire")
    serializer_class = serializers.EcoleSerializer
    filterset_class = ref_filters.EcoleFilter
    search_fields = ["nom", "sigle"]
    ordering_fields = ["nom", "id"]


class AnneeScolaireViewSet(_BaseReferentielViewSet):
    queryset = models.AnneeScolaire.objects.all()
    serializer_class = serializers.AnneeScolaireSerializer
    filterset_class = ref_filters.AnneeScolaireFilter
    search_fields = ["libelle"]
    ordering_fields = ["libelle", "date_debut", "id"]


class ModaliteFormationViewSet(_BaseReferentielViewSet):
    queryset = models.ModaliteFormation.objects.all()
    serializer_class = serializers.ModaliteFormationSerializer
    filterset_class = ref_filters.ModaliteFormationFilter
    search_fields = ["code", "libelle"]
    ordering_fields = ["code", "id"]


class NiveauViewSet(_BaseReferentielViewSet):
    queryset = models.Niveau.objects.select_related("ecole")
    serializer_class = serializers.NiveauSerializer
    filterset_class = ref_filters.NiveauFilter
    search_fields = ["code", "libelle"]
    ordering_fields = ["ordre", "code", "id"]
    ordering = ["ordre"]


class FiliereViewSet(_BaseReferentielViewSet):
    queryset = models.Filiere.objects.select_related("ecole")
    serializer_class = serializers.FiliereSerializer
    filterset_class = ref_filters.FiliereFilter
    search_fields = ["nom", "sigle"]
    ordering_fields = ["nom", "sigle", "id"]


class OptionFiliereViewSet(_BaseReferentielViewSet):
    queryset = models.OptionFiliere.objects.select_related("filiere")
    serializer_class = serializers.OptionFiliereSerializer
    filterset_class = ref_filters.OptionFiliereFilter
    search_fields = ["nom", "sigle"]
    ordering_fields = ["nom", "sigle", "id"]


class ClasseViewSet(_BaseReferentielViewSet):
    permission_classes = [permissions.PeutEcrirePedagogique]
    queryset = models.Classe.objects.select_related(
        "annee_scolaire", "niveau", "option_filiere", "modalite_formation"
    )
    serializer_class = serializers.ClasseSerializer
    filterset_class = ref_filters.ClasseFilter
    search_fields = ["libelle_auto"]
    ordering_fields = ["libelle_auto", "id"]


class MatiereViewSet(_BaseReferentielViewSet):
    permission_classes = [permissions.PeutEcrirePedagogique]
    queryset = models.Matiere.objects.select_related("niveau", "option_filiere")
    serializer_class = serializers.MatiereSerializer
    filterset_class = ref_filters.MatiereFilter
    search_fields = ["nom", "code"]
    ordering_fields = ["nom", "code", "id"]


class PeriodeViewSet(_BaseReferentielViewSet):
    permission_classes = [permissions.PeutEcrirePedagogique]
    queryset = models.Periode.objects.select_related("annee_scolaire")
    serializer_class = serializers.PeriodeSerializer
    filterset_class = ref_filters.PeriodeFilter
    search_fields = ["libelle"]
    ordering_fields = ["numero", "id"]
    ordering = ["numero"]


class SessionExamenViewSet(_BaseReferentielViewSet):
    permission_classes = [permissions.PeutEcrirePedagogique]
    queryset = models.SessionExamen.objects.select_related("periode")
    serializer_class = serializers.SessionExamenSerializer
    filterset_class = ref_filters.SessionExamenFilter
    search_fields = ["type"]
    ordering_fields = ["type", "id"]
```

> **Note d'implémentation :** remplacer l'expression `ref_filters.df_backend if False else __import__(...)` par un import propre en tête de fichier :
> `from django_filters.rest_framework import DjangoFilterBackend` puis `filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]`. (L'`__import__` ci-dessus n'est qu'un pense-bête pour éviter l'oubli ; ne pas le laisser.)

- [ ] **Step 5: `urls.py`**

```python
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("groupes-scolaires", views.GroupeScolaireViewSet)
router.register("ecoles", views.EcoleViewSet)
router.register("annees-scolaires", views.AnneeScolaireViewSet)
router.register("modalites-formation", views.ModaliteFormationViewSet)
router.register("niveaux", views.NiveauViewSet)
router.register("filieres", views.FiliereViewSet)
router.register("options-filiere", views.OptionFiliereViewSet)
router.register("classes", views.ClasseViewSet)
router.register("matieres", views.MatiereViewSet)
router.register("periodes", views.PeriodeViewSet)
router.register("sessions-examen", views.SessionExamenViewSet)

urlpatterns = router.urls
```

- [ ] **Step 6: Câbler dans `config/urls.py`**

Dans `api_v1`, ajouter avant `schema/` : `path("referentiel/", include("referentiel.urls")),`. Ajouter `include` à l'import si absent.

- [ ] **Step 7: Vérifier le succès**

Run: `cd backend && pytest referentiel/tests/test_api.py -v`
Expected: PASS (8 tests).

- [ ] **Step 8: OpenAPI 0 Error**

Run: `cd backend && python manage.py spectacular --file /tmp/schema.yml`
Expected: aucune ligne `Error:`. (Warnings tolérés mais à minimiser.)

- [ ] **Step 9: Régénérer les types TypeScript**

Terminal A : `cd backend && python manage.py runserver 0.0.0.0:8000`
Terminal B : `cd frontend && npm run gen:api`
Puis vérifier que `frontend/src/api/schema.d.ts` contient les chemins `/api/v1/referentiel/...` et que `components["schemas"]` n'est plus `never`. Arrêter le serveur.

- [ ] **Step 10: typecheck frontend**

Run: `cd frontend && npm run typecheck`
Expected: PASS (schema.d.ts régénéré ne casse rien ; `types.ts` inchangé pour l'instant).

- [ ] **Step 11: Portes + commit**

Run: `cd backend && ruff check . && python manage.py check && python manage.py makemigrations --check --dry-run && pytest`

```bash
git add backend/referentiel/views.py backend/referentiel/urls.py backend/referentiel/tests/test_api.py backend/config/settings/base.py backend/config/urls.py frontend/src/api/schema.d.ts
git commit -m "feat(referentiel): API CRUD /api/v1/referentiel/ (11 ressources) + pagination socle

ViewSets ModelViewSet + AuditLogMixin + SuppressionProtegeeMixin ; filtres
django-filter, recherche, tri ; permissions DIRECTION / DIRECTION+SCOLARITE.
OpenAPI 0 Error ; schema.d.ts regenere.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HAgLuAfW7byohrEERKtDyo"
```

**Critère d'acceptation :** les 11 ressources répondent en CRUD ; pagination `count`/`results` ; filtres/recherche/tri opérationnels ; RBAC appliqué (anon 401, LECTURE lit, SCOLARITE limité au pédagogique) ; suppression référencée → 409 ; audit écrit ; `spectacular` 0 Error ; `schema.d.ts` régénéré, `typecheck` vert.

---

## Task 8 — Tests d'intégrité portés de `db/tests/test_001_referentiel.sql`

**Files:**
- Create: `backend/referentiel/tests/test_integrite.py`

**Interfaces:**
- Consumes: modèles Task 1.
- Produces: rien (tests seulement).

- [ ] **Step 1: Écrire `test_integrite.py`** — miroir pytest des assertions SQL

```python
"""Portage pytest de db/tests/test_001_referentiel.sql.

Le harnais SQL vérifie : présence des 11 tables, moteur/collation (hors ORM),
4 FK sur `classe`, unicité (ecole, code) sur `niveau`, `credits_requis` nullable.
"""

import pytest
from django.db import connection

from referentiel import models
from referentiel.tests import factories as f

pytestmark = pytest.mark.django_db

TABLES = {
    "groupe_scolaire",
    "ecole",
    "annee_scolaire",
    "modalite_formation",
    "niveau",
    "filiere",
    "option_filiere",
    "classe",
    "matiere",
    "periode",
    "session_examen",
}


def test_les_11_tables_existent():
    existantes = set(connection.introspection.table_names())
    assert TABLES <= existantes


def test_classe_a_quatre_cles_etrangeres():
    fks = [
        f
        for f in models.Classe._meta.get_fields()
        if f.many_to_one and f.concrete
    ]
    assert {f.name for f in fks} == {
        "annee_scolaire",
        "niveau",
        "option_filiere",
        "modalite_formation",
    }


def test_unicite_niveau_ecole_code_rejette_doublon():
    from django.db import IntegrityError

    e = f.EcoleFactory()
    f.NiveauFactory(ecole=e, code="L1")
    with pytest.raises(IntegrityError):
        f.NiveauFactory(ecole=e, code="L1")


def test_credits_requis_accepte_null():
    n = f.NiveauFactory(code="1A", credits_requis=None)
    n.refresh_from_db()
    assert n.credits_requis is None
```

- [ ] **Step 2: Lancer**

Run: `cd backend && pytest referentiel/tests/test_integrite.py -v`
Expected: PASS (4).

- [ ] **Step 3: Commit**

```bash
git add backend/referentiel/tests/test_integrite.py
git commit -m "test(referentiel): portage pytest de db/tests/test_001_referentiel.sql

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HAgLuAfW7byohrEERKtDyo"
```

**Critère d'acceptation :** les assertions structurelles de `test_001_referentiel.sql` ont un équivalent pytest vert.

---

## Task 9 — Commande `seed_referentiel`

**Files:**
- Create: `backend/referentiel/management/__init__.py`, `backend/referentiel/management/commands/__init__.py`, `backend/referentiel/management/commands/seed_referentiel.py`
- Create: `backend/referentiel/tests/test_seed.py`

**Interfaces:**
- Consumes: modèles Task 1, `services.definir_annee_courante` Task 2.
- Produces: commande `seed_referentiel` (`--groupe-nom`, `--annee AAAA-AAAA`).

- [ ] **Step 1: `tests/test_seed.py` (RED)**

```python
import pytest
from django.core.management import call_command

from referentiel import models

pytestmark = pytest.mark.django_db


def test_seed_cree_le_socle_et_est_idempotent():
    call_command("seed_referentiel", "--annee", "2025-2026")
    assert models.Ecole.objects.count() == 4
    assert models.ModaliteFormation.objects.count() == 4
    assert models.Periode.objects.count() == 2
    assert models.SessionExamen.objects.count() == 2
    assert models.AnneeScolaire.objects.get(libelle="2025-2026").est_courante is True

    call_command("seed_referentiel", "--annee", "2025-2026")
    assert models.Ecole.objects.count() == 4
    assert models.ModaliteFormation.objects.count() == 4
    assert models.Periode.objects.count() == 2
```

- [ ] **Step 2: Vérifier l'échec** — `pytest referentiel/tests/test_seed.py -v` → FAIL (`Unknown command`).

- [ ] **Step 3: Écrire `seed_referentiel.py`**

```python
from django.core.management.base import BaseCommand
from django.db import transaction

from referentiel import models, services

ECOLES = [
    ("École Supérieure des Sciences et Ingénierie de Gestion", "ESSIG", "ESSIG", "LMD"),
    ("Université Privée des Sciences de la Santé", "UPSS", "UPSS", "LMD"),
    ("Centre de Formation Professionnelle et d'Apprentissage", "CFPA", "CFPA", "CLASSIQUE"),
    ("CICI", "CICI", "CICI", "CLASSIQUE"),
]
MODALITES = [
    ("FI", "Formation initiale"),
    ("FC", "Formation continue"),
    ("FL", "Formation à distance"),
    ("FT", "Formation en alternance"),
]


class Command(BaseCommand):
    help = "Amorce idempotente du référentiel (groupe, écoles, modalités, année, périodes)."

    def add_arguments(self, parser):
        parser.add_argument("--groupe-nom", default="Groupe Scolaire USIA")
        parser.add_argument("--annee", default="2025-2026")

    @transaction.atomic
    def handle(self, *args, **opts):
        groupe, _ = models.GroupeScolaire.objects.get_or_create(nom=opts["groupe_nom"])
        for nom, sigle, pole, regime in ECOLES:
            models.Ecole.objects.get_or_create(
                groupe_scolaire=groupe,
                pole=pole,
                defaults={"nom": nom, "sigle": sigle, "regime": regime},
            )
        for code, libelle in MODALITES:
            models.ModaliteFormation.objects.get_or_create(
                code=code, defaults={"libelle": libelle}
            )
        deb, fin = f"{opts['annee'][:4]}-10-01", f"{opts['annee'][5:]}-08-31"
        annee, _ = models.AnneeScolaire.objects.get_or_create(
            libelle=opts["annee"], defaults={"date_debut": deb, "date_fin": fin}
        )
        for numero in (1, 2):
            periode, _ = models.Periode.objects.get_or_create(
                annee_scolaire=annee,
                numero=numero,
                defaults={
                    "libelle": f"Semestre {numero}",
                    "date_debut": deb,
                    "date_fin": fin,
                },
            )
            models.SessionExamen.objects.get_or_create(
                periode=periode, type=models.SessionExamen.Type.NORMALE
            )
        services.definir_annee_courante(annee)
        self.stdout.write(self.style.SUCCESS("Référentiel amorcé."))
```

- [ ] **Step 4: Vérifier le succès** — `pytest referentiel/tests/test_seed.py -v` → PASS.

- [ ] **Step 5: Portes + commit**

```bash
git add backend/referentiel/management backend/referentiel/tests/test_seed.py
git commit -m "feat(referentiel): commande seed_referentiel idempotente

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HAgLuAfW7byohrEERKtDyo"
```

**Critère d'acceptation :** 1re exécution crée groupe + 4 écoles + 4 modalités + année courante + 2 périodes + 2 sessions ; 2e exécution ne crée rien ; sortie 0.

---

## Task 10 — Frontend : couche données (`query`, `resource`, `errors`) + dépendances

**Files:**
- Modify: `frontend/package.json` (deps)
- Create: `frontend/src/lib/query.ts`, `frontend/src/lib/resource.ts`, `frontend/src/lib/errors.ts`
- Create: `frontend/src/lib/resource.test.ts`, `frontend/src/lib/errors.test.ts`
- Modify: `frontend/src/main.tsx`

**Interfaces:**
- Consumes: `apiFetch` (`src/api/client.ts`), TanStack Query.
- Produces:
  - `queryClient` + `<AppQueryProvider>` (`lib/query.ts`)
  - `createResourceHooks<T>(endpoint: string)` → `{ useListe(params?), useDetail(id), useCreer(), useModifier(), useSupprimer() }` (`lib/resource.ts`). `useListe` renvoie `{ data: Page<T>, ... }` avec `Page<T> = { count: number; next: string | null; previous: string | null; results: T[] }`.
  - `champErreurs(payload): Record<string, string>` et `messageErreur(status, payload): string` (`lib/errors.ts`).

- [ ] **Step 1: Ajouter les dépendances**

Run: `cd frontend && npm install @tanstack/react-table@^8 @radix-ui/react-dialog@^1`
Vérifier qu'elles apparaissent dans `dependencies`.

- [ ] **Step 2: `lib/errors.ts`**

```typescript
export type PayloadErreur = Record<string, unknown> | { detail?: string } | null;

/** Extrait les erreurs de champ d'une réponse DRF 400 : { champ: ["msg", ...] }. */
export function champErreurs(payload: PayloadErreur): Record<string, string> {
  const out: Record<string, string> = {};
  if (payload && typeof payload === "object") {
    for (const [cle, val] of Object.entries(payload)) {
      if (cle === "detail") continue;
      out[cle] = Array.isArray(val) ? String(val[0]) : String(val);
    }
  }
  return out;
}

/** Message lisible pour un toast selon le statut HTTP. */
export function messageErreur(status: number, payload: PayloadErreur): string {
  const detail =
    payload && typeof payload === "object" && "detail" in payload
      ? String((payload as { detail?: unknown }).detail ?? "")
      : "";
  if (status === 403) return detail || "Rôle insuffisant pour cette action.";
  if (status === 409)
    return detail || "Suppression impossible : élément référencé ailleurs.";
  if (status === 404) return "Ressource introuvable.";
  if (status >= 500) return "Erreur serveur. Réessayez plus tard.";
  return detail || "Une erreur est survenue.";
}
```

- [ ] **Step 3: `lib/errors.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { champErreurs, messageErreur } from "./errors";

describe("champErreurs", () => {
  it("mappe les listes DRF sur le premier message", () => {
    expect(champErreurs({ nom: ["Ce champ est obligatoire."], detail: "x" })).toEqual({
      nom: "Ce champ est obligatoire.",
    });
  });
});

describe("messageErreur", () => {
  it("403 -> message de rôle", () => {
    expect(messageErreur(403, null)).toMatch(/rôle/i);
  });
  it("409 -> message de suppression", () => {
    expect(messageErreur(409, null)).toMatch(/référencé/i);
  });
});
```

- [ ] **Step 4: `lib/query.ts`**

```typescript
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});
```

- [ ] **Step 5: `lib/resource.ts`**

```typescript
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "../api/client";

export type Page<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type ParamsListe = Record<string, string | number | undefined>;

async function jsonOuLeve(resp: Response) {
  const corps = resp.status === 204 ? null : await resp.json().catch(() => null);
  if (!resp.ok) {
    throw Object.assign(new Error(`HTTP ${resp.status}`), {
      status: resp.status,
      payload: corps,
    });
  }
  return corps;
}

function qs(params: ParamsListe): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function createResourceHooks<T extends { id: number }>(endpoint: string) {
  const cleListe = (params: ParamsListe) => [endpoint, "liste", params] as const;
  const cleDetail = (id: number) => [endpoint, "detail", id] as const;

  return {
    useListe(params: ParamsListe = {}) {
      return useQuery({
        queryKey: cleListe(params),
        queryFn: () =>
          apiFetch(`/${endpoint}/${qs(params)}`).then(jsonOuLeve) as Promise<Page<T>>,
      });
    },
    useDetail(id: number) {
      return useQuery({
        queryKey: cleDetail(id),
        queryFn: () =>
          apiFetch(`/${endpoint}/${id}/`).then(jsonOuLeve) as Promise<T>,
        enabled: Number.isFinite(id),
      });
    },
    useCreer() {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: (corps: Partial<T>) =>
          apiFetch(`/${endpoint}/`, {
            method: "POST",
            body: JSON.stringify(corps),
          }).then(jsonOuLeve) as Promise<T>,
        onSuccess: () => qc.invalidateQueries({ queryKey: [endpoint, "liste"] }),
      });
    },
    useModifier() {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: ({ id, corps }: { id: number; corps: Partial<T> }) =>
          apiFetch(`/${endpoint}/${id}/`, {
            method: "PATCH",
            body: JSON.stringify(corps),
          }).then(jsonOuLeve) as Promise<T>,
        onSuccess: (_d, { id }) => {
          qc.invalidateQueries({ queryKey: [endpoint, "liste"] });
          qc.invalidateQueries({ queryKey: cleDetail(id) });
        },
      });
    },
    useSupprimer() {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: (id: number) =>
          apiFetch(`/${endpoint}/${id}/`, { method: "DELETE" }).then(jsonOuLeve),
        onSuccess: () => qc.invalidateQueries({ queryKey: [endpoint, "liste"] }),
      });
    },
  };
}
```

- [ ] **Step 6: `lib/resource.test.ts`**

```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "../api/client";
import { createResourceHooks } from "./resource";

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

const hooks = createResourceHooks<{ id: number; nom: string }>("referentiel/ecoles");

beforeEach(() => {
  vi.spyOn(client, "apiFetch").mockImplementation(
    async () =>
      new Response(
        JSON.stringify({ count: 1, next: null, previous: null, results: [{ id: 1, nom: "X" }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  );
});
afterEach(() => vi.restoreAllMocks());

describe("useListe", () => {
  it("passe les params en query string", async () => {
    const { result } = renderHook(() => hooks.useListe({ page: 2, search: "es" }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.count).toBe(1);
    const url = (client.apiFetch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(url).toContain("page=2");
    expect(url).toContain("search=es");
  });
});
```

- [ ] **Step 7: Utiliser `queryClient` partagé dans `main.tsx`**

Remplacer `const queryClient = new QueryClient();` par `import { queryClient } from "./lib/query";` (retirer l'import `QueryClient` devenu inutile, garder `QueryClientProvider`).

- [ ] **Step 8: Lancer les tests**

Run: `cd frontend && npm test`
Expected: nouveaux tests verts + les 4 existants toujours verts.

- [ ] **Step 9: Portes + commit**

Run: `cd frontend && npm run typecheck && npm run build`

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/lib frontend/src/main.tsx
git commit -m "feat(front): couche donnees generique (query, createResourceHooks, errors)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HAgLuAfW7byohrEERKtDyo"
```

**Critère d'acceptation :** `createResourceHooks` fournit liste/détail/CRUD avec invalidation ; `useListe` sérialise les params ; helpers d'erreur testés ; suite front verte.

---

## Task 11 — Frontend : AppShell (sidebar, topbar, breadcrumbs, primitives UI)

**Files:**
- Create: `frontend/src/app/AppShell.tsx`, `Sidebar.tsx`, `Topbar.tsx`, `Breadcrumbs.tsx`
- Create: `frontend/src/components/DataState.tsx`, `frontend/src/components/ToastProvider.tsx`, `frontend/src/components/ConfirmDialog.tsx`
- Create: `frontend/src/app/Sidebar.test.tsx`, `frontend/src/app/AppShell.test.tsx`
- Modify: `frontend/src/routes.tsx`

**Interfaces:**
- Consumes: `useAuth` (`src/auth/AuthContext`), `RequireAuth`, React Router `Outlet`/`NavLink`/`useMatches`.
- Produces:
  - `<AppShell>` : `RequireAuth` + grille sidebar/topbar/contenu + `<Outlet/>`, enveloppé dans `<ToastProvider>`.
  - `useToast()` → `{ toast(message: string, variant?: "info" | "erreur") }` (`components/ToastProvider`).
  - `<DataState statut={"chargement"|"vide"|"erreur"} onReessayer?={() => void}>` — squelette / message vide / erreur+bouton.
  - `<ConfirmDialog ouvert titre description onConfirmer onAnnuler>` (Radix Dialog).
  - `NAV_MODULES` (`app/Sidebar.tsx`) : liste des 6 groupes, `disponible: boolean`.

- [ ] **Step 1: `Sidebar.test.tsx` (RED)**

```typescript
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Sidebar } from "./Sidebar";

const rendre = () =>
  render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>,
  );

describe("Sidebar", () => {
  it("affiche Référentiel comme lien actif", () => {
    rendre();
    const lien = screen.getByRole("link", { name: /référentiel/i });
    expect(lien).toHaveAttribute("href", "/referentiel/ecoles");
  });

  it("désactive les 5 modules à venir", () => {
    rendre();
    for (const nom of [/personnes/i, /scolarité/i, /trésorerie/i, /paie/i, /résultats/i]) {
      expect(screen.getByText(nom).closest("a")).toBeNull();
    }
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — FAIL (module introuvable).

- [ ] **Step 3: `app/Sidebar.tsx`**

```tsx
import { NavLink } from "react-router-dom";

type Module = { cle: string; libelle: string; chemin: string; disponible: boolean };

export const NAV_MODULES: Module[] = [
  { cle: "referentiel", libelle: "Référentiel", chemin: "/referentiel/ecoles", disponible: true },
  { cle: "personnes", libelle: "Personnes", chemin: "/personnes", disponible: false },
  { cle: "scolarite", libelle: "Scolarité", chemin: "/scolarite", disponible: false },
  { cle: "tresorerie", libelle: "Trésorerie", chemin: "/tresorerie", disponible: false },
  { cle: "paie", libelle: "Paie", chemin: "/paie", disponible: false },
  { cle: "resultats", libelle: "Résultats", chemin: "/resultats", disponible: false },
];

export function Sidebar() {
  return (
    <nav className="flex flex-col gap-1 p-3 text-sm">
      <span className="px-2 pb-2 font-semibold text-gray-500">ESSIG-GEST</span>
      {NAV_MODULES.map((m) =>
        m.disponible ? (
          <NavLink
            key={m.cle}
            to={m.chemin}
            className={({ isActive }) =>
              `rounded px-2 py-1.5 ${isActive ? "bg-gray-200 font-medium" : "hover:bg-gray-100"}`
            }
          >
            {m.libelle}
          </NavLink>
        ) : (
          <span
            key={m.cle}
            className="flex items-center justify-between rounded px-2 py-1.5 text-gray-400"
          >
            {m.libelle}
            <span className="text-[10px] uppercase">à venir</span>
          </span>
        ),
      )}
    </nav>
  );
}
```

- [ ] **Step 4: `components/ToastProvider.tsx`**

```tsx
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Variant = "info" | "erreur";
type Toast = { id: number; message: string; variant: Variant };
type Ctx = { toast: (message: string, variant?: Variant) => void };

const ToastCtx = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((message: string, variant: Variant = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, variant }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2" role="status">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded px-4 py-2 text-sm text-white shadow ${
              t.variant === "erreur" ? "bg-red-600" : "bg-gray-800"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const c = useContext(ToastCtx);
  if (!c) throw new Error("useToast hors ToastProvider");
  return c;
}
```

- [ ] **Step 5: `components/DataState.tsx`**

```tsx
export function DataState({
  statut,
  onReessayer,
}: {
  statut: "chargement" | "vide" | "erreur";
  onReessayer?: () => void;
}) {
  if (statut === "chargement")
    return (
      <div className="animate-pulse space-y-2 p-4" aria-label="Chargement">
        <div className="h-6 rounded bg-gray-200" />
        <div className="h-6 rounded bg-gray-200" />
        <div className="h-6 rounded bg-gray-200" />
      </div>
    );
  if (statut === "vide")
    return <p className="p-8 text-center text-gray-500">Aucun élément.</p>;
  return (
    <div className="p-8 text-center">
      <p className="text-red-600">Impossible de charger les données.</p>
      {onReessayer && (
        <button onClick={onReessayer} className="mt-2 rounded border px-3 py-1 text-sm">
          Réessayer
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 6: `components/ConfirmDialog.tsx`**

```tsx
import * as Dialog from "@radix-ui/react-dialog";

export function ConfirmDialog({
  ouvert,
  titre,
  description,
  onConfirmer,
  onAnnuler,
}: {
  ouvert: boolean;
  titre: string;
  description: string;
  onConfirmer: () => void;
  onAnnuler: () => void;
}) {
  return (
    <Dialog.Root open={ouvert} onOpenChange={(o) => !o && onAnnuler()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-80 -translate-x-1/2 -translate-y-1/2 rounded bg-white p-5 shadow-lg">
          <Dialog.Title className="font-semibold">{titre}</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-gray-600">
            {description}
          </Dialog.Description>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={onAnnuler} className="rounded border px-3 py-1 text-sm">
              Annuler
            </button>
            <button
              onClick={onConfirmer}
              className="rounded bg-red-600 px-3 py-1 text-sm text-white"
            >
              Supprimer
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 7: `app/Breadcrumbs.tsx`**

```tsx
import { Link, useMatches } from "react-router-dom";

type MiettesHandle = { miette?: string };

export function Breadcrumbs() {
  const matches = useMatches() as { pathname: string; handle?: MiettesHandle }[];
  const items = matches.filter((m) => m.handle?.miette);
  return (
    <nav className="flex gap-1 text-xs text-gray-500" aria-label="Fil d'Ariane">
      {items.map((m, i) => (
        <span key={m.pathname}>
          {i > 0 && <span className="px-1">/</span>}
          <Link to={m.pathname} className="hover:underline">
            {m.handle!.miette}
          </Link>
        </span>
      ))}
    </nav>
  );
}
```

- [ ] **Step 8: `app/Topbar.tsx`**

```tsx
import { useAuth } from "../auth/AuthContext";
import { Breadcrumbs } from "./Breadcrumbs";

export function Topbar() {
  const { utilisateur, deconnexion } = useAuth();
  return (
    <header className="flex items-center justify-between border-b px-4 py-2">
      <Breadcrumbs />
      <div className="flex items-center gap-3 text-sm">
        <span className="text-gray-600">{utilisateur?.login}</span>
        <button onClick={() => deconnexion()} className="rounded border px-2 py-1">
          Déconnexion
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 9: `app/AppShell.tsx`**

```tsx
import { Outlet } from "react-router-dom";
import { RequireAuth } from "../auth/RequireAuth";
import { ToastProvider } from "../components/ToastProvider";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell() {
  return (
    <RequireAuth>
      <ToastProvider>
        <div className="grid min-h-screen grid-cols-[220px_1fr]">
          <aside className="border-r bg-gray-50">
            <Sidebar />
          </aside>
          <div className="flex flex-col">
            <Topbar />
            <main className="flex-1 p-6">
              <Outlet />
            </main>
          </div>
        </div>
      </ToastProvider>
    </RequireAuth>
  );
}
```

- [ ] **Step 10: `AppShell.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    utilisateur: { id: 1, login: "dupont", email: "d@ex.ga", roles: [] },
    chargement: false,
    deconnexion: vi.fn(),
  }),
}));

describe("AppShell", () => {
  it("rend le contenu enfant derrière la sidebar", () => {
    const r = createMemoryRouter(
      [{ path: "/", element: <AppShell />, children: [{ index: true, element: <p>CONTENU</p> }] }],
      { initialEntries: ["/"] },
    );
    render(<RouterProvider router={r} />);
    expect(screen.getByText("CONTENU")).toBeInTheDocument();
    expect(screen.getByText("dupont")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /référentiel/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 11: Recâbler `routes.tsx`**

```tsx
import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./app/AppShell";
import { LoginPage } from "./auth/LoginPage";
import { routesReferentiel } from "./referentiel/routes";

export const router = createBrowserRouter([
  { path: "/connexion", element: <LoginPage /> },
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <p className="text-gray-600">Bienvenue. Choisissez un module.</p> },
      ...routesReferentiel,
    ],
  },
]);
```

> Si Task 12 n'est pas encore faite, créer un `frontend/src/referentiel/routes.tsx` provisoire exportant `export const routesReferentiel = [];` pour ne pas casser le build ; Task 12 le remplacera.

- [ ] **Step 12: Lancer les tests + portes**

Run: `cd frontend && npm test && npm run typecheck && npm run build`
Expected: verts (dont `Sidebar.test`, `AppShell.test`).

- [ ] **Step 13: Commit**

```bash
git add frontend/src/app frontend/src/components/DataState.tsx frontend/src/components/ToastProvider.tsx frontend/src/components/ConfirmDialog.tsx frontend/src/routes.tsx frontend/src/referentiel/routes.tsx
git commit -m "feat(front): AppShell (sidebar 6 modules, topbar, breadcrumbs, toasts, dialog)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HAgLuAfW7byohrEERKtDyo"
```

**Critère d'acceptation :** `/` protégé rend l'AppShell (sidebar 6 groupes, Référentiel actif, 5 désactivés ; topbar avec login + déconnexion) ; primitives `DataState`/`useToast`/`ConfirmDialog` disponibles ; suite front verte.

---

## Task 12 — Frontend : scaffold `ResourcePage` + `ResourceForm`

**Files:**
- Create: `frontend/src/referentiel/descripteur.ts`
- Create: `frontend/src/components/ResourcePage.tsx`, `frontend/src/components/ResourceForm.tsx`
- Create: `frontend/src/components/ResourcePage.test.tsx`, `frontend/src/components/ResourceForm.test.tsx`

**Interfaces:**
- Consumes: `createResourceHooks` (Task 10), `useToast`, `DataState`, `ConfirmDialog` (Task 11), `champErreurs`/`messageErreur` (Task 10), TanStack Table, React Hook Form, Zod, `useAuth`.
- Produces:
  - Types `Champ`, `Colonne`, `Descripteur<T>` (`referentiel/descripteur.ts`).
  - `<ResourcePage descripteur={...}/>` — liste + recherche + filtres + pagination + créer/éditer/supprimer.
  - `<ResourceForm descripteur={...} valeurs? onFerme/>` — formulaire RHF+Zod.

- [ ] **Step 1: `referentiel/descripteur.ts`**

```typescript
import type { ZodTypeAny } from "zod";

export type Champ = {
  nom: string;
  label: string;
  type: "text" | "number" | "checkbox" | "select" | "fk";
  requis?: boolean;
  options?: { valeur: string; label: string }[];
  fkEndpoint?: string;
  fkLabel?: (o: Record<string, unknown>) => string;
  aide?: string;
};

export type Colonne = {
  cle: string;
  entete: string;
  rendu?: (ligne: Record<string, unknown>) => string;
};

export type Descripteur<T extends { id: number } = { id: number }> = {
  titre: string;
  endpoint: string; // ex. "referentiel/ecoles"
  roleEcriture: string[]; // ["DIRECTION"] ou ["DIRECTION","SCOLARITE"]
  colonnes: Colonne[];
  champs: Champ[];
  schema: ZodTypeAny;
  triDefaut?: string;
  filtres?: { nom: string; label: string; fkEndpoint?: string; options?: { valeur: string; label: string }[] }[];
  rechercheActive?: boolean;
  _t?: T;
};

export function peutEcrire(roles: { code: string }[], requis: string[]): boolean {
  const codes = new Set(roles.map((r) => r.code));
  return requis.some((r) => codes.has(r));
}
```

- [ ] **Step 2: `ResourceForm.tsx`**

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useToast } from "./ToastProvider";
import { champErreurs, messageErreur } from "../lib/errors";
import { createResourceHooks } from "../lib/resource";
import type { Descripteur } from "../referentiel/descripteur";

export function ResourceForm({
  descripteur,
  valeurs,
  onFerme,
}: {
  descripteur: Descripteur;
  valeurs?: Record<string, unknown> & { id: number };
  onFerme: () => void;
}) {
  const hooks = createResourceHooks(descripteur.endpoint);
  const creer = hooks.useCreer();
  const modifier = hooks.useModifier();
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(descripteur.schema), defaultValues: valeurs ?? {} });

  useEffect(() => reset(valeurs ?? {}), [valeurs, reset]);

  async function soumettre(data: Record<string, unknown>) {
    try {
      if (valeurs) await modifier.mutateAsync({ id: valeurs.id, corps: data });
      else await creer.mutateAsync(data);
      toast("Enregistré.");
      onFerme();
    } catch (e) {
      const err = e as { status?: number; payload?: Record<string, unknown> };
      if (err.status === 400 && err.payload) {
        for (const [champ, msg] of Object.entries(champErreurs(err.payload))) {
          setError(champ as never, { message: msg });
        }
      } else {
        toast(messageErreur(err.status ?? 0, err.payload ?? null), "erreur");
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(soumettre)} className="space-y-3">
      {descripteur.champs.map((c) => (
        <div key={c.nom} className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor={c.nom}>
            {c.label}
            {c.requis && <span className="text-red-600"> *</span>}
          </label>
          {c.type === "checkbox" ? (
            <input id={c.nom} type="checkbox" {...register(c.nom)} />
          ) : c.type === "select" ? (
            <select id={c.nom} {...register(c.nom)} className="rounded border px-2 py-1">
              <option value="">—</option>
              {c.options?.map((o) => (
                <option key={o.valeur} value={o.valeur}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : c.type === "fk" ? (
            <FkSelect champ={c} register={register} />
          ) : (
            <input
              id={c.nom}
              type={c.type === "number" ? "number" : "text"}
              {...register(c.nom, c.type === "number" ? { valueAsNumber: true } : {})}
              className="rounded border px-2 py-1"
            />
          )}
          {errors[c.nom] && (
            <span className="text-xs text-red-600">
              {String(errors[c.nom]?.message)}
            </span>
          )}
        </div>
      ))}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onFerme} className="rounded border px-3 py-1 text-sm">
          Annuler
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-gray-800 px-3 py-1 text-sm text-white"
        >
          Enregistrer
        </button>
      </div>
    </form>
  );
}

function FkSelect({
  champ,
  register,
}: {
  champ: import("../referentiel/descripteur").Champ;
  register: ReturnType<typeof useForm>["register"];
}) {
  const hooks = createResourceHooks(champ.fkEndpoint!);
  const { data } = hooks.useListe({ page: 1 });
  return (
    <select {...register(champ.nom, { valueAsNumber: true })} className="rounded border px-2 py-1">
      <option value="">—</option>
      {(data?.results ?? []).map((o: Record<string, unknown>) => (
        <option key={String(o.id)} value={String(o.id)}>
          {champ.fkLabel ? champ.fkLabel(o) : String(o.id)}
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 3: `ResourcePage.tsx`**

```tsx
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { DataState } from "./DataState";
import { ConfirmDialog } from "./ConfirmDialog";
import { ResourceForm } from "./ResourceForm";
import { useToast } from "./ToastProvider";
import { messageErreur } from "../lib/errors";
import { createResourceHooks } from "../lib/resource";
import { peutEcrire, type Descripteur } from "../referentiel/descripteur";

export function ResourcePage({ descripteur }: { descripteur: Descripteur }) {
  const hooks = useMemo(
    () => createResourceHooks(descripteur.endpoint),
    [descripteur.endpoint],
  );
  const [page, setPage] = useState(1);
  const [recherche, setRecherche] = useState("");
  const [filtres, setFiltres] = useState<Record<string, string>>({});
  const [edition, setEdition] = useState<null | (Record<string, unknown> & { id: number })>(null);
  const [creation, setCreation] = useState(false);
  const [aSupprimer, setASupprimer] = useState<null | { id: number }>(null);

  const params = { page, search: recherche || undefined, ...filtres };
  const { data, isLoading, isError, refetch } = hooks.useListe(params);
  const supprimer = hooks.useSupprimer();
  const { toast } = useToast();
  const { utilisateur } = useAuth();
  const ecrivable = peutEcrire(utilisateur?.roles ?? [], descripteur.roleEcriture);

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(
    () => [
      ...descripteur.colonnes.map((c) => ({
        id: c.cle,
        header: c.entete,
        accessorFn: (l: Record<string, unknown>) => (c.rendu ? c.rendu(l) : l[c.cle]),
      })),
      ...(ecrivable
        ? [
            {
              id: "_actions",
              header: "",
              cell: ({ row }: { row: { original: Record<string, unknown> & { id: number } } }) => (
                <span className="flex gap-2">
                  <button
                    className="text-blue-600 underline"
                    onClick={() => setEdition(row.original)}
                  >
                    Éditer
                  </button>
                  <button
                    className="text-red-600 underline"
                    onClick={() => setASupprimer(row.original)}
                  >
                    Supprimer
                  </button>
                </span>
              ),
            } as ColumnDef<Record<string, unknown>>,
          ]
        : []),
    ],
    [descripteur.colonnes, ecrivable],
  );

  const table = useReactTable({
    data: data?.results ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{descripteur.titre}</h1>
        {ecrivable && (
          <button
            onClick={() => setCreation(true)}
            className="rounded bg-gray-800 px-3 py-1 text-sm text-white"
          >
            Créer
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {descripteur.rechercheActive !== false && (
          <input
            placeholder="Rechercher…"
            value={recherche}
            onChange={(e) => {
              setPage(1);
              setRecherche(e.target.value);
            }}
            className="rounded border px-2 py-1 text-sm"
          />
        )}
        {descripteur.filtres?.map((fl) => (
          <FiltreSelect
            key={fl.nom}
            filtre={fl}
            valeur={filtres[fl.nom] ?? ""}
            onChange={(v) => {
              setPage(1);
              setFiltres((f) => ({ ...f, [fl.nom]: v }));
            }}
          />
        ))}
      </div>

      {isLoading ? (
        <DataState statut="chargement" />
      ) : isError ? (
        <DataState statut="erreur" onReessayer={refetch} />
      ) : (data?.results.length ?? 0) === 0 ? (
        <DataState statut="vide" />
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b text-left">
                {hg.headers.map((h) => (
                  <th key={h.id} className="py-2">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((r) => (
              <tr key={r.id} className="border-b">
                {r.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="py-1.5">
                    {flexRender(cell.column.columnDef.cell ?? cell.column.columnDef.header, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex items-center gap-2 text-sm">
        <button
          disabled={!data?.previous}
          onClick={() => setPage((p) => p - 1)}
          className="rounded border px-2 py-1 disabled:opacity-40"
        >
          Précédent
        </button>
        <span>{data?.count ?? 0} élément(s)</span>
        <button
          disabled={!data?.next}
          onClick={() => setPage((p) => p + 1)}
          className="rounded border px-2 py-1 disabled:opacity-40"
        >
          Suivant
        </button>
      </div>

      {(creation || edition) && (
        <div className="rounded border p-4">
          <h2 className="mb-3 font-medium">
            {edition ? "Modifier" : "Créer"} — {descripteur.titre}
          </h2>
          <ResourceForm
            descripteur={descripteur}
            valeurs={edition ?? undefined}
            onFerme={() => {
              setCreation(false);
              setEdition(null);
            }}
          />
        </div>
      )}

      <ConfirmDialog
        ouvert={!!aSupprimer}
        titre="Confirmer la suppression"
        description="Cette action est définitive."
        onAnnuler={() => setASupprimer(null)}
        onConfirmer={async () => {
          try {
            await supprimer.mutateAsync(aSupprimer!.id);
            toast("Supprimé.");
          } catch (e) {
            const err = e as { status?: number; payload?: Record<string, unknown> };
            toast(messageErreur(err.status ?? 0, err.payload ?? null), "erreur");
          } finally {
            setASupprimer(null);
          }
        }}
      />
    </section>
  );
}

function FiltreSelect({
  filtre,
  valeur,
  onChange,
}: {
  filtre: NonNullable<Descripteur["filtres"]>[number];
  valeur: string;
  onChange: (v: string) => void;
}) {
  const hooks = filtre.fkEndpoint ? createResourceHooks(filtre.fkEndpoint) : null;
  const liste = hooks?.useListe({ page: 1 });
  const options =
    filtre.options ??
    (liste?.data?.results ?? []).map((o: Record<string, unknown>) => ({
      valeur: String(o.id),
      label: String(o.nom ?? o.libelle ?? o.id),
    }));
  return (
    <select
      value={valeur}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border px-2 py-1 text-sm"
      aria-label={filtre.label}
    >
      <option value="">{filtre.label} : tous</option>
      {options.map((o) => (
        <option key={o.valeur} value={o.valeur}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 4: `ResourcePage.test.tsx`**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { z } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "../api/client";
import { ToastProvider } from "./ToastProvider";
import { ResourcePage } from "./ResourcePage";
import type { Descripteur } from "../referentiel/descripteur";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ utilisateur: { id: 1, login: "d", email: "e", roles: [{ code: "DIRECTION" }] } }),
}));

const descr: Descripteur = {
  titre: "Écoles",
  endpoint: "referentiel/ecoles",
  roleEcriture: ["DIRECTION"],
  colonnes: [{ cle: "nom", entete: "Nom" }],
  champs: [{ nom: "nom", label: "Nom", type: "text", requis: true }],
  schema: z.object({ nom: z.string().min(1) }),
};

function page(results: unknown[], count = results.length, extra: object = {}) {
  return new Response(
    JSON.stringify({ count, next: null, previous: null, results, ...extra }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

const wrap = (ui: React.ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  vi.spyOn(client, "apiFetch").mockResolvedValue(page([{ id: 1, nom: "ESSIG" }]));
});
afterEach(() => vi.restoreAllMocks());

describe("ResourcePage", () => {
  it("affiche les lignes de la liste", async () => {
    wrap(<ResourcePage descripteur={descr} />);
    await waitFor(() => expect(screen.getByText("ESSIG")).toBeInTheDocument());
  });

  it("refetch avec search= quand on tape dans la recherche", async () => {
    wrap(<ResourcePage descripteur={descr} />);
    await screen.findByText("ESSIG");
    await userEvent.type(screen.getByPlaceholderText("Rechercher…"), "es");
    await waitFor(() => {
      const urls = (client.apiFetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map(
        (c) => c[0] as string,
      );
      expect(urls.some((u) => u.includes("search=es"))).toBe(true);
    });
  });

  it("passe page=2 au clic sur Suivant", async () => {
    vi.spyOn(client, "apiFetch").mockResolvedValue(
      page([{ id: 1, nom: "ESSIG" }], 60, { next: "http://x/?page=2" }),
    );
    wrap(<ResourcePage descripteur={descr} />);
    await screen.findByText("ESSIG");
    await userEvent.click(screen.getByRole("button", { name: "Suivant" }));
    await waitFor(() => {
      const urls = (client.apiFetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map(
        (c) => c[0] as string,
      );
      expect(urls.some((u) => u.includes("page=2"))).toBe(true);
    });
  });
});
```

- [ ] **Step 5: `ResourceForm.test.tsx`**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { z } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "../api/client";
import { ResourceForm } from "./ResourceForm";
import { ToastProvider } from "./ToastProvider";
import type { Descripteur } from "../referentiel/descripteur";

const descr: Descripteur = {
  titre: "Écoles",
  endpoint: "referentiel/ecoles",
  roleEcriture: ["DIRECTION"],
  colonnes: [],
  champs: [{ nom: "nom", label: "Nom", type: "text", requis: true }],
  schema: z.object({ nom: z.string().min(1, "Obligatoire") }),
};

const wrap = (ui: React.ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );
};

afterEach(() => vi.restoreAllMocks());

describe("ResourceForm", () => {
  it("mappe une 400 DRF sur le champ", async () => {
    vi.spyOn(client, "apiFetch").mockResolvedValue(
      new Response(JSON.stringify({ nom: ["Ce nom existe déjà."] }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );
    wrap(<ResourceForm descripteur={descr} onFerme={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/nom/i), "ESSIG");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() =>
      expect(screen.getByText("Ce nom existe déjà.")).toBeInTheDocument(),
    );
  });

  it("appelle onFerme après une création réussie", async () => {
    vi.spyOn(client, "apiFetch").mockResolvedValue(
      new Response(JSON.stringify({ id: 1, nom: "ESSIG" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const onFerme = vi.fn();
    wrap(<ResourceForm descripteur={descr} onFerme={onFerme} />);
    await userEvent.type(screen.getByLabelText(/nom/i), "ESSIG");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(onFerme).toHaveBeenCalled());
  });
});
```

- [ ] **Step 6: Lancer les tests + portes**

Run: `cd frontend && npm test && npm run typecheck && npm run build`
Expected: verts.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/referentiel/descripteur.ts frontend/src/components/ResourcePage.tsx frontend/src/components/ResourceForm.tsx frontend/src/components/ResourcePage.test.tsx frontend/src/components/ResourceForm.test.tsx
git commit -m "feat(front): scaffold CRUD generique ResourcePage + ResourceForm

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HAgLuAfW7byohrEERKtDyo"
```

**Critère d'acceptation :** `ResourcePage` affiche une liste mockée, refetch sur `search=` et `page=2` ; `ResourceForm` mappe une 400 sur le champ et ferme sur succès ; boutons créer/éditer/supprimer conditionnés au rôle.

---

## Task 13 — Frontend : 11 descripteurs d'entité + routes référentiel

**Files:**
- Create: `frontend/src/referentiel/config/{groupeScolaire,ecole,anneeScolaire,modaliteFormation,niveau,filiere,optionFiliere,classe,matiere,periode,sessionExamen}.tsx`
- Create/replace: `frontend/src/referentiel/routes.tsx`
- Create: `frontend/src/referentiel/integration.test.tsx`

**Interfaces:**
- Consumes: `Descripteur` (Task 12), `ResourcePage`, `zod`.
- Produces: `routesReferentiel: RouteObject[]` (`referentiel/routes.tsx`).

- [ ] **Step 1: Écrire les 11 descripteurs**

Chaque fichier exporte `export const <nom>Descripteur: Descripteur = { ... }`. Modèle **complet** pour `ecole.tsx` :

```tsx
import { z } from "zod";
import type { Descripteur } from "../descripteur";

export const ecoleDescripteur: Descripteur = {
  titre: "Écoles",
  endpoint: "referentiel/ecoles",
  roleEcriture: ["DIRECTION"],
  rechercheActive: true,
  colonnes: [
    { cle: "nom", entete: "Nom" },
    { cle: "sigle", entete: "Sigle" },
    { cle: "pole", entete: "Pôle" },
    { cle: "regime", entete: "Régime" },
    { cle: "groupe_scolaire_libelle", entete: "Groupe" },
  ],
  filtres: [
    { nom: "pole", label: "Pôle", options: ["ESSIG", "UPSS", "CFPA", "CICI"].map((v) => ({ valeur: v, label: v })) },
    { nom: "regime", label: "Régime", options: [
      { valeur: "LMD", label: "LMD" },
      { valeur: "CLASSIQUE", label: "Classique" },
    ] },
    { nom: "groupe_scolaire", label: "Groupe", fkEndpoint: "referentiel/groupes-scolaires" },
  ],
  champs: [
    { nom: "groupe_scolaire", label: "Groupe scolaire", type: "fk", requis: true, fkEndpoint: "referentiel/groupes-scolaires", fkLabel: (o) => String(o.nom) },
    { nom: "nom", label: "Nom", type: "text", requis: true },
    { nom: "sigle", label: "Sigle", type: "text" },
    { nom: "pole", label: "Pôle", type: "select", requis: true, options: ["ESSIG", "UPSS", "CFPA", "CICI"].map((v) => ({ valeur: v, label: v })) },
    { nom: "regime", label: "Régime", type: "select", requis: true, options: [
      { valeur: "LMD", label: "LMD" },
      { valeur: "CLASSIQUE", label: "Classique" },
    ] },
    { nom: "contacts", label: "Contacts", type: "text" },
    { nom: "email", label: "Email", type: "text" },
  ],
  schema: z.object({
    groupe_scolaire: z.number({ message: "Obligatoire" }),
    nom: z.string().min(1, "Obligatoire").max(120),
    sigle: z.string().max(20).optional().or(z.literal("")),
    pole: z.enum(["ESSIG", "UPSS", "CFPA", "CICI"]),
    regime: z.enum(["LMD", "CLASSIQUE"]),
    contacts: z.string().max(120).optional().or(z.literal("")),
    email: z.string().max(120).optional().or(z.literal("")),
  }),
};
```

Les 10 autres suivent la **même forme**. Contenu de chacun (colonnes = champs listés ; `champs` = un champ par colonne SQL éditable ; `schema` Zod = miroir des types/longueurs ; `roleEcriture` : `["DIRECTION"]` sauf `classe/matiere/periode/sessionExamen` → `["DIRECTION","SCOLARITE"]`) :

| Fichier / `titre` | `endpoint` | Champs (nom · type · requis) | Filtres |
|---|---|---|---|
| `groupeScolaire.tsx` · « Groupes scolaires » | `referentiel/groupes-scolaires` | `nom` text ✔ · `sigle` text · `contacts` text · `email` text · `adresse` text | — |
| `anneeScolaire.tsx` · « Années scolaires » | `referentiel/annees-scolaires` | `libelle` text ✔ (regex `^\d{4}-\d{4}$`) · `date_debut` text ✔ (`YYYY-MM-DD`) · `date_fin` text ✔ · `est_courante` checkbox | `est_courante` (options Oui=`true`/Non=`false`) |
| `modaliteFormation.tsx` · « Modalités de formation » | `referentiel/modalites-formation` | `code` select ✔ (`FI/FC/FL/FT`) · `libelle` text ✔ | — |
| `niveau.tsx` · « Niveaux » | `referentiel/niveaux` | `ecole` fk ✔ (`referentiel/ecoles`, label `nom`) · `code` text ✔ (max 10) · `libelle` text ✔ (max 60) · `ordre` number ✔ · `credits_requis` number · `a_soutenance` checkbox · `a_examen_national` checkbox | `ecole` fk |
| `filiere.tsx` · « Filières » | `referentiel/filieres` | `ecole` fk ✔ · `nom` text ✔ (max 80) · `sigle` text ✔ (max 15) | `ecole` fk |
| `optionFiliere.tsx` · « Options de filière » | `referentiel/options-filiere` | `filiere` fk ✔ (`referentiel/filieres`, label `sigle`) · `nom` text ✔ · `sigle` text (peut être vide) | `filiere` fk |
| `classe.tsx` · « Classes » | `referentiel/classes` | `annee_scolaire` fk ✔ (label `libelle`) · `niveau` fk ✔ (label `code`) · `option_filiere` fk ✔ (label `sigle`/`nom`) · `modalite_formation` fk ✔ (label `code`) · `effectif_max` number | `annee_scolaire` fk · `niveau` fk |
| `matiere.tsx` · « Matières » | `referentiel/matieres` | `niveau` fk ✔ · `option_filiere` fk ✔ · `semestre` select ✔ (`S1/S2`) · `nom` text ✔ (max 120) · `code` text ✔ (max 20) · `coefficient` number ✔ · `credits` number · `volume_horaire` number ✔ | `niveau` fk · `semestre` (S1/S2) |
| `periode.tsx` · « Périodes » | `referentiel/periodes` | `annee_scolaire` fk ✔ · `numero` number ✔ (1 ou 2) · `libelle` text ✔ (max 40) · `date_debut` text ✔ · `date_fin` text ✔ | `annee_scolaire` fk |
| `sessionExamen.tsx` · « Sessions d'examen » | `referentiel/sessions-examen` | `periode` fk ✔ (label `libelle`) · `type` select ✔ (`NORMALE/RATTRAPAGE`) · `date_debut` text · `date_fin` text | `periode` fk · `type` |

Pour `classe.tsx`, ajouter une colonne `{ cle: "libelle_auto", entete: "Libellé" }` **en tête** (lecture seule, pas dans `champs`).

- [ ] **Step 2: `referentiel/routes.tsx`**

```tsx
import type { RouteObject } from "react-router-dom";
import { ResourcePage } from "../components/ResourcePage";
import { anneeScolaireDescripteur } from "./config/anneeScolaire";
import { classeDescripteur } from "./config/classe";
import { ecoleDescripteur } from "./config/ecole";
import { filiereDescripteur } from "./config/filiere";
import { groupeScolaireDescripteur } from "./config/groupeScolaire";
import { matiereDescripteur } from "./config/matiere";
import { modaliteFormationDescripteur } from "./config/modaliteFormation";
import { niveauDescripteur } from "./config/niveau";
import { optionFiliereDescripteur } from "./config/optionFiliere";
import { periodeDescripteur } from "./config/periode";
import { sessionExamenDescripteur } from "./config/sessionExamen";

const paires = [
  ["groupes-scolaires", groupeScolaireDescripteur],
  ["ecoles", ecoleDescripteur],
  ["annees-scolaires", anneeScolaireDescripteur],
  ["modalites-formation", modaliteFormationDescripteur],
  ["niveaux", niveauDescripteur],
  ["filieres", filiereDescripteur],
  ["options-filiere", optionFiliereDescripteur],
  ["classes", classeDescripteur],
  ["matieres", matiereDescripteur],
  ["periodes", periodeDescripteur],
  ["sessions-examen", sessionExamenDescripteur],
] as const;

export const routesReferentiel: RouteObject[] = [
  {
    path: "referentiel",
    handle: { miette: "Référentiel" },
    children: paires.map(([seg, descr]) => ({
      path: seg,
      handle: { miette: descr.titre },
      element: <ResourcePage descripteur={descr} />,
    })),
  },
];
```

- [ ] **Step 3: `referentiel/integration.test.tsx`**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "../api/client";
import { ToastProvider } from "../components/ToastProvider";
import { routesReferentiel } from "./routes";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ utilisateur: { id: 1, login: "d", email: "e", roles: [{ code: "LECTURE" }] } }),
}));

beforeEach(() => {
  vi.spyOn(client, "apiFetch").mockResolvedValue(
    new Response(
      JSON.stringify({ count: 1, next: null, previous: null, results: [{ id: 1, nom: "ESSIG", sigle: "E", pole: "ESSIG", regime: "LMD", groupe_scolaire_libelle: "G" }] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
});
afterEach(() => vi.restoreAllMocks());

describe("routes référentiel", () => {
  it("rend la liste des écoles depuis l'API mockée", async () => {
    const r = createMemoryRouter(
      [{ path: "/", element: <ToastProvider><RouterOutletProxy /></ToastProvider>, children: routesReferentiel }],
      { initialEntries: ["/referentiel/ecoles"] },
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={qc}><RouterProvider router={r} /></QueryClientProvider>);
    await waitFor(() => expect(screen.getByText("ESSIG")).toBeInTheDocument());
  });
});

function RouterOutletProxy() {
  const { Outlet } = require("react-router-dom");
  return <Outlet />;
}
```

> Note : si `require` n'est pas disponible en ESM strict, remplacer `RouterOutletProxy` par un `import { Outlet } from "react-router-dom"` en tête et l'utiliser directement dans l'élément parent.

- [ ] **Step 4: Lancer les tests + portes**

Run: `cd frontend && npm test && npm run typecheck && npm run build`
Expected: verts (dont l'intégration).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/referentiel
git commit -m "feat(front): 11 ecrans referentiel (descripteurs + routes imbriquees AppShell)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HAgLuAfW7byohrEERKtDyo"
```

**Critère d'acceptation :** naviguer sur `/referentiel/<ressource>` rend la liste correspondante ; breadcrumbs « Référentiel / <titre> » ; les 11 routes sont câblées sous l'AppShell.

---

## Task 14 — Vérification globale + documentation

**Files:**
- Modify: `.superpowers/sdd/2026-08-30-socle-applicatif-sis/progress.md` *(ou nouveau `progress.md` de chantier — voir Step 2)*
- Create: `.superpowers/sdd/2026-09-03-phase-1-referentiel/progress.md` + `task-*-report.md` si le chantier utilise subagent-driven-development
- Modify: `CLAUDE.md` (retirer la ligne « `utilisateur_role.ecole_id` … devient une vraie FK en Phase 1 » des pièges, désormais faite ; mentionner l'app `referentiel` comme livrée)

**Interfaces:** aucune.

- [ ] **Step 1: Repasser toutes les portes**

```bash
cd backend && ruff check . && python manage.py check && python manage.py makemigrations --check --dry-run && pytest && python manage.py spectacular --file /tmp/schema.yml
cd ../frontend && npm run typecheck && npm test && npm run build
```

Attendu : tout vert ; `spectacular` **0 Error** ; `pytest` inclut les tests référentiel (models, services, serializers, permissions_unit, api, integrite, seed) + les suites `comptes`/`core` inchangées vertes.

- [ ] **Step 2: `seed_referentiel` bout-en-bout sur base de dev**

```bash
cd backend && python manage.py migrate && python manage.py seed_referentiel --annee 2025-2026 && python manage.py seed_referentiel --annee 2025-2026
```

Attendu : 2e passage sans création en double, sortie 0.

- [ ] **Step 3: Rapport de fin de phase**

Rédiger le rapport au format prompt maître §26 (Objectif · Analyse de l'existant · Fichiers créés · Fichiers modifiés · Décisions · Fonctionnalités · API · Modèles · Tests ajoutés · Tests exécutés · Résultats · Risques · Travail restant · Commit) dans `.superpowers/sdd/2026-09-03-phase-1-referentiel/progress.md`.

- [ ] **Step 4: Mettre à jour `CLAUDE.md`**

Dans la section « Pièges connus », supprimer la puce sur `utilisateur_role.ecole_id`. Dans le tableau « Architecture », passer la ligne `backend/` de « Modules métier … restent à créer » à « `comptes`, `core`, `referentiel` livrés ; `personnes`…`resultats` à créer ».

- [ ] **Step 5: Commit final**

```bash
git add CLAUDE.md .superpowers/sdd/2026-09-03-phase-1-referentiel
git commit -m "docs: cloture Phase 1 (referentiel academique) - rapport + maj CLAUDE.md

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HAgLuAfW7byohrEERKtDyo"
```

**Critère d'acceptation :** toutes les portes vertes en une passe ; seed idempotent vérifié sur base réelle ; rapport de phase écrit ; `CLAUDE.md` reflète l'état post-Phase 1.

---

## Self-Review

**1. Spec coverage**

| Spec § | Couvert par |
|---|---|
| §2 périmètre backend (11 modèles, migration) | Task 1 |
| §2 FK `utilisateur_role.ecole` | Task 3 |
| §2 `seed_referentiel` | Task 9 |
| §2 API CRUD + OpenAPI + types | Task 7 |
| §2 AppShell | Task 11 |
| §2 scaffold + descripteurs | Tasks 12, 13 |
| §5 RM-1 (`credits_requis` nullable) | Task 1 (test), Task 8 |
| §5 RM-2 (`est_courante` unique) | Task 1 (constraint + test), Task 2 (`definir_annee_courante`) |
| §5 RM-3 (`libelle_auto`) | Task 2 (service + tests), Task 5 (serializer), Task 7 (test API) |
| §5 RM-4/RM-5/RM-6/RM-7 | Task 1 (modèles/contraintes) ; RM-6 `numero∈{1,2}` : **validé applicativement — voir note ci-dessous** |
| §5 RM-8 (suppression → 409) | Task 4 (mixin), Task 7 (test) |
| §5 RM-9 (unicités) | Task 1 |
| §6 portage / écarts | Task 1 Step 8 |
| §7 unicités & index | Task 1 |
| §8 workflows | Task 2 (année courante), Task 5 (libellé), Task 7 (audit, 409) |
| §9 permissions | Task 6, appliquées Task 7 |
| §10 API (11 endpoints, pagination, filtres, recherche, tri) | Task 7 |
| §11 interface | Tasks 11–13 |
| §12 validations | Task 5 (serveur), Task 13 (Zod) |
| §13 erreurs | Task 4 (backend 409), Task 10 (`errors.ts`), Tasks 11–12 (rendu) |
| §14 audit | Task 7 (`AuditLogMixin` sur `_BaseReferentielViewSet`) |
| §15 seed | Task 9 |
| §16 tests d'acceptation | Tasks 1,2,5,6,7,8,9 (back) ; 10,11,12,13 (front) ; Task 14 (portes) |

**Écart identifié et corrigé inline :** RM-6 (`periode.numero ∈ {1,2}`) n'avait pas de test dédié. **Ajout** à Task 1 Step 6 : compléter `test_models.py` avec

```python
def test_periode_numero_hors_1_2_rejete_par_validation():
    import pytest
    from django.core.exceptions import ValidationError
    from referentiel.tests import factories as f
    p = f.PeriodeFactory.build(numero=3)
    with pytest.raises(ValidationError):
        p.full_clean()
```

et, dans `models.py`, ajouter à `Periode` un `validators=[MinValueValidator(1), MaxValueValidator(2)]` sur `numero` (`from django.core.validators import MinValueValidator, MaxValueValidator`). Le `.sql` de référence ne pose pas ce CHECK ; c'est un durcissement applicatif à noter dans « Écarts » (spec §6).

**2. Placeholder scan** — Le pense-bête `__import__` dans Task 7 Step 4 est explicitement signalé « ne pas le laisser » avec le remplacement fourni. Task 13 Step 1 fournit un modèle complet (`ecole.tsx`) + un tableau exhaustif des 10 autres (champs, types, requis, filtres, règles Zod) — pas de « similar to ». Aucun « TODO / TBD ».

**3. Type consistency** — `createResourceHooks` renvoie `useListe/useDetail/useCreer/useModifier/useSupprimer` : noms identiques dans `resource.ts` (Task 10), `ResourceForm`/`ResourcePage` (Task 12), tests (Tasks 10, 12). `Descripteur`/`Champ`/`Colonne` définis Task 12, consommés Tasks 12–13 sans divergence. `Page<T>` = `{count,next,previous,results}` cohérent backend (DRF `PageNumberPagination`) ↔ `resource.ts` ↔ tests. `peutEcrire(roles, requis)` défini Task 12, utilisé Task 12 (`ResourcePage`). Permissions backend : `PeutEcrireReferentiel`/`PeutEcrirePedagogique` définies Task 6, montées Task 7. `SuppressionProtegeeMixin.perform_destroy` (Task 4) ↔ ordre MRO dans `_BaseReferentielViewSet` (Task 7 : `SuppressionProtegeeMixin, AuditLogMixin, ModelViewSet` — `SuppressionProtegeeMixin.perform_destroy` gagne, et `AuditLogMixin.perform_destroy` n'est donc plus appelé : **incohérence**).

**Correction inline (Task 4 + Task 7) :** `AuditLogMixin.perform_destroy` doit rester actif (il écrit l'audit de suppression). Modifier `SuppressionProtegeeMixin` pour **envelopper `super().perform_destroy`** au lieu d'appeler `instance.delete()` directement :

```python
class SuppressionProtegeeMixin:
    def perform_destroy(self, instance):
        try:
            super().perform_destroy(instance)
        except (RestrictedError, ProtectedError) as exc:
            raise ConflitSuppressionException() from exc
```

et dans `_BaseReferentielViewSet`, ordre MRO : `class _BaseReferentielViewSet(SuppressionProtegeeMixin, AuditLogMixin, viewsets.ModelViewSet)` — `SuppressionProtegeeMixin.perform_destroy` appelle `AuditLogMixin.perform_destroy` (qui appelle `instance.delete()` puis écrit l'audit) via `super()`. Le test de Task 4 doit donc fournir une classe de base factice avec `perform_destroy` :

```python
class _Base:
    def perform_destroy(self, instance):
        instance.delete()

class _Vue(SuppressionProtegeeMixin, _Base):
    pass
```

(remplacer le `_Vue`/`_perform_reel` du Step 1 par cette forme ; le reste du test — `Obj.delete` qui lève `RestrictedError`, assertion 409 — est inchangé). Ajout à Task 7 `test_api.py` : après `test_suppression_referencee_409`, vérifier qu'**aucune** ligne d'audit `SUPPRESSION` n'est écrite quand la suppression échoue en 409, et qu'une ligne `SUPPRESSION` **est** écrite quand elle réussit :

```python
def test_audit_suppression_seulement_si_succes():
    from comptes.models import JournalAudit
    c, _ = _client(Role.Code.DIRECTION)
    g = f.GroupeScolaireFactory()
    e = f.EcoleFactory(groupe_scolaire=g)
    n = f.NiveauFactory(ecole=e)
    assert c.delete(f"/api/v1/referentiel/ecoles/{e.pk}/").status_code == 409
    assert not JournalAudit.objects.filter(action="SUPPRESSION", table_cible="ecole").exists()
    n.delete()
    assert c.delete(f"/api/v1/referentiel/ecoles/{e.pk}/").status_code == 204
    assert JournalAudit.objects.filter(action="SUPPRESSION", table_cible="ecole").exists()
```

Ces corrections sont intégrées ci-dessus ; ne pas les re-traiter séparément lors de l'exécution.

---

## Execution Handoff

**Plan complet et sauvegardé dans `docs/superpowers/plans/2026-09-03-phase-1-referentiel-academique.md`. Deux options d'exécution :**

**1. Subagent-Driven (recommandé)** — un sous-agent neuf par tâche, revue entre les tâches, itération rapide (`superpowers:subagent-driven-development`).

**2. Inline Execution** — exécution des tâches dans cette session avec points de contrôle (`superpowers:executing-plans`).

**Quelle approche ?**

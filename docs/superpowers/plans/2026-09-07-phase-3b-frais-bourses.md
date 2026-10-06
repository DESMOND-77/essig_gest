# Phase 3B — Frais annexes & bourses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compléter le Module 3 : catalogue `type_frais`, frais par inscription (`frais_inscription`, avec matérialisation automatique des frais obligatoires à l'inscription), bourses (`bourse`), seed du catalogue, écrans, et les sections Frais / Bourses de la fiche d'inscription.

**Architecture:** `TypeFrais` / `FraisInscription` / `Bourse` complètent l'app `scolarite`. `scolarite.services.materialiser_frais_obligatoires(inscription)` est appelé dans la **même transaction** que la création d'inscription (branchement dans `InscriptionSerializer.create`, livré en 3A). `FraisInscription` et `Bourse` héritent de `core.Auditable`.

**Tech Stack:** identique au Plan 3A.

**Spec:** `docs/superpowers/specs/2026-09-07-phase-3-inscriptions-scolarite-design.md`

## Global Constraints

- **Prérequis** : Plan 3A mergé sur `main` (`core.Auditable`, `Inscription`, `scolarite` app, `ModalitePaiement`, `Echeance`, `InscriptionSerializer` avec sa transaction de création).
- **Français partout** ; **argent** `DecimalField(max_digits=12, decimal_places=0)` entiers FCFA, jamais de flottant.
- **PK ORM** `BigAutoField` ; `db_table` explicite : `type_frais`, `frais_inscription`, `bourse` ; `ENUM`→`TextChoices` ; `CharField` nullables `# noqa: DJ001`.
- **`Auditable`** : `FraisInscription`, `Bourse` héritent de `core.models.Auditable` ; serializers avec `core.serializers.AuditableSerializerMixin` ; champs d'audit `read_only`.
- **RBAC serveur** : `types-frais` → `scolarite.permissions.PeutEcrireTarifs` (DIRECTION) ; `frais-inscription`, `bourses` → `scolarite.permissions.PeutEcrireFraisEleve` (DIRECTION, DAF, COMPTABLE). (Classes créées en 3A.)
- **pytest** `DB_USER=root`, depuis `backend/` ; **après changement d'API** : `spectacular` 0 Error → `gen:api` → front → tests. Namespace `v1:`.
- **`sqlmigrate scolarite <n>`** vs `db/migrations/004` (type_frais / frais_inscription / bourse). Consigner les écarts (D-ORM-9).
- **Trailers de commit** :
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_015vBabiytJuWPjuDR2qUfCf
  ```
- **Branche** : `phase-3b-frais-bourses` (depuis `main` post-3A).

---

## File Structure

**Backend**
| Fichier | Responsabilité |
|---|---|
| `backend/scolarite/models.py` *(modifier)* | + `TypeFrais`, `FraisInscription`, `Bourse`. |
| `backend/scolarite/services.py` *(modifier)* | + `materialiser_frais_obligatoires(inscription) -> list`. |
| `backend/scolarite/serializers.py` *(modifier)* | + `TypeFraisSerializer`, `FraisInscriptionSerializer`, `BourseSerializer`. |
| `backend/scolarite/filters.py` *(modifier)* | + `TypeFraisFilter`, `FraisInscriptionFilter`, `BourseFilter`. |
| `backend/scolarite/views.py` *(modifier)* | + `TypeFraisViewSet`, `FraisInscriptionViewSet`, `BourseViewSet`. |
| `backend/scolarite/urls.py` *(modifier)* | + 3 `router.register`. |
| `backend/scolarite/admin.py` *(modifier)* | + `register(TypeFrais)`. |
| `backend/scolarite/migrations/0002_*.py` *(généré)* | TypeFrais / FraisInscription / Bourse. |
| `backend/scolarite/management/{__init__,commands/__init__,commands/seed_scolarite}.py` *(créer)* | Seed catalogue `type_frais`. |
| `backend/personnes/serializers.py` *(modifier)* | `InscriptionSerializer` : + `frais_inscription`/`bourses` imbriqués (lecture seule) ; `create()` appelle `materialiser_frais_obligatoires`. |
| `backend/personnes/views.py` *(modifier)* | `InscriptionViewSet.queryset` : + `prefetch_related("frais_inscription", "bourses")`. |
| `backend/scolarite/tests/{factories,test_models,test_services,test_serializers,test_api,test_seed}.py` *(modifier/créer)* | Suite. |
| `backend/personnes/tests/test_api.py` *(modifier)* | + frais obligatoires matérialisés à la création. |

**Frontend**
| Fichier | Responsabilité |
|---|---|
| `frontend/src/scolarite/config/{typeFrais,fraisInscription,bourse}.tsx` *(créer)* | `Descripteur` scaffold. |
| `frontend/src/scolarite/routes.tsx` *(modifier)* | + 3 segments. |
| `frontend/src/personnes/FicheInscription.tsx` *(modifier)* | + sections **Frais** et **Bourses**. |
| `frontend/src/scolarite/config/*.test.tsx`, `scolarite/integration.test.tsx` *(modifier/créer)* | Tests. |
| `frontend/src/personnes/FicheInscription.test.tsx` *(modifier)* | + assertions Frais/Bourses. |
| `frontend/src/api/schema.d.ts` *(régénéré)* | `gen:api`. |

**Docs**
| Fichier | Responsabilité |
|---|---|
| `CLAUDE.md` *(modifier)* | `scolarite` complet ; `seed_scolarite`. |
| `.superpowers/sdd/2026-09-07-phase-3b-frais/progress.md` *(créer, non versionné)* | Rapport §26. |

---

## Task 1 : Modèles `TypeFrais` / `FraisInscription` / `Bourse`

**Files:**
- Modify: `backend/scolarite/models.py`, `backend/scolarite/admin.py`, `backend/scolarite/tests/factories.py`, `backend/scolarite/tests/test_models.py`
- Create (généré): `backend/scolarite/migrations/0002_*.py`

**Interfaces:**
- Consumes: `core.models.Auditable`, `personnes.models.Inscription`, `referentiel.models.{Ecole, Niveau, AnneeScolaire}`.
- Produces:
  - `scolarite.models.TypeFrais` (`db_table="type_frais"`) — `code` unique, `libelle`, FK `ecole?`/`niveau?`/`annee_scolaire?` (RESTRICT, null), `montant_defaut` Decimal(12,0), `obligatoire` bool (def False), `actif` bool (def True). Index sur `ecole`, `niveau`.
  - `scolarite.models.FraisInscription(Auditable)` (`db_table="frais_inscription"`) — FK `inscription` RESTRICT (`related_name="frais_inscription"`), FK `type_frais` RESTRICT, `montant_du` Decimal(12,0), `exonere` bool (def False), `commentaire?`. Unique `(inscription, type_frais)` = `unq_frais_inscription`.
  - `scolarite.models.Bourse(Auditable)` (`db_table="bourse"`) — FK `inscription` RESTRICT (`related_name="bourses"`), `organisme` CharField(150), `perimetre` (`Perimetre` TextChoices, une valeur `SCOLARITE_HORS_INSCRIPTION`, défaut), `montant_couvert` Decimal(12,0). Index `idx_bourse_inscription`.
  - `scolarite.tests.factories.{TypeFraisFactory, FraisInscriptionFactory, BourseFactory}`.

- [ ] **Step 1: Ajouter les modèles**

Dans `backend/scolarite/models.py`, compléter l'import `from referentiel.models import ...` avec `Ecole`, puis :
```python
class TypeFrais(models.Model):
    code = models.CharField(max_length=30, unique=True)
    libelle = models.CharField(max_length=120)
    ecole = models.ForeignKey(
        Ecole, on_delete=models.RESTRICT, null=True, blank=True, related_name="+"
    )
    niveau = models.ForeignKey(
        Niveau, on_delete=models.RESTRICT, null=True, blank=True, related_name="+"
    )
    annee_scolaire = models.ForeignKey(
        AnneeScolaire, on_delete=models.RESTRICT, null=True, blank=True, related_name="+"
    )
    montant_defaut = models.DecimalField(max_digits=12, decimal_places=0)
    obligatoire = models.BooleanField(default=False)
    actif = models.BooleanField(default=True)

    class Meta:
        db_table = "type_frais"
        indexes = [
            models.Index(fields=["ecole"], name="idx_type_frais_ecole"),
            models.Index(fields=["niveau"], name="idx_type_frais_niveau"),
        ]

    def __str__(self):
        return self.code


class FraisInscription(Auditable):
    inscription = models.ForeignKey(
        Inscription, on_delete=models.RESTRICT, related_name="frais_inscription"
    )
    type_frais = models.ForeignKey(
        TypeFrais, on_delete=models.RESTRICT, related_name="+"
    )
    montant_du = models.DecimalField(max_digits=12, decimal_places=0)
    exonere = models.BooleanField(default=False)
    commentaire = models.CharField(max_length=255, null=True, blank=True)  # noqa: DJ001

    class Meta:
        db_table = "frais_inscription"
        constraints = [
            models.UniqueConstraint(
                fields=["inscription", "type_frais"], name="unq_frais_inscription"
            )
        ]

    def __str__(self):
        return f"{self.type_frais} / insc {self.inscription_id}"


class Bourse(Auditable):
    class Perimetre(models.TextChoices):
        SCOLARITE_HORS_INSCRIPTION = (
            "SCOLARITE_HORS_INSCRIPTION",
            "Scolarité hors inscription",
        )

    inscription = models.ForeignKey(
        Inscription, on_delete=models.RESTRICT, related_name="bourses"
    )
    organisme = models.CharField(max_length=150)
    perimetre = models.CharField(
        max_length=25,
        choices=Perimetre.choices,
        default=Perimetre.SCOLARITE_HORS_INSCRIPTION,
    )
    montant_couvert = models.DecimalField(max_digits=12, decimal_places=0)

    class Meta:
        db_table = "bourse"
        indexes = [
            models.Index(fields=["inscription"], name="idx_bourse_inscription")
        ]

    def __str__(self):
        return f"{self.organisme} / insc {self.inscription_id}"
```
`admin.py` : `admin.site.register(models.TypeFrais)`.

- [ ] **Step 2: Factories**

Ajouter à `backend/scolarite/tests/factories.py` :
```python
class TypeFraisFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.TypeFrais

    code = factory.Sequence(lambda n: f"FRAIS_{n}")
    libelle = factory.LazyAttribute(lambda o: f"Frais {o.code}")
    montant_defaut = 15000
    obligatoire = False
    actif = True


class FraisInscriptionFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.FraisInscription

    inscription = factory.SubFactory(InscriptionFactory)
    type_frais = factory.SubFactory(TypeFraisFactory)
    montant_du = 15000


class BourseFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Bourse

    inscription = factory.SubFactory(InscriptionFactory)
    organisme = factory.Sequence(lambda n: f"Organisme {n}")
    montant_couvert = 300000
```

- [ ] **Step 3: Tests modèles**

Ajouter à `backend/scolarite/tests/test_models.py` :
```python
def test_db_tables_3b():
    assert models.TypeFrais._meta.db_table == "type_frais"
    assert models.FraisInscription._meta.db_table == "frais_inscription"
    assert models.Bourse._meta.db_table == "bourse"


def test_unq_type_frais_code():
    f.TypeFraisFactory(code="TENUE")
    with pytest.raises(IntegrityError):
        f.TypeFraisFactory(code="TENUE")


def test_unq_frais_inscription():
    fi = f.FraisInscriptionFactory()
    with pytest.raises(IntegrityError):
        f.FraisInscriptionFactory(
            inscription=fi.inscription, type_frais=fi.type_frais
        )


def test_bourse_perimetre_defaut():
    b = f.BourseFactory()
    assert b.perimetre == "SCOLARITE_HORS_INSCRIPTION"
```

- [ ] **Step 4: RED → migration + diff → GREEN**

```
cd backend && DB_USER=root pytest scolarite/tests/test_models.py -q          # FAIL
python manage.py makemigrations scolarite
python manage.py makemigrations --check --dry-run                            # No changes detected
python manage.py sqlmigrate scolarite 0002
DB_USER=root pytest scolarite/tests/test_models.py -q                        # PASS
```
Comparer aux blocs `type_frais` / `frais_inscription` / `bourse` de `db/migrations/004`. Écarts :
`bigint` vs `INT UNSIGNED` ; audit `frais_inscription`/`bourse` via `core.Auditable` (colonnes
`datetime(6)` gérées par Django, FK `related_name="+"`) ; `perimetre` `varchar(25)` vs `ENUM`.
Consigner (Task 8).

- [ ] **Step 5: Portes + commit**

`cd backend && ruff check . && python manage.py check && DB_USER=root pytest -q` → vert.
```bash
git add backend/scolarite
git commit -m "$(cat <<'EOF'
feat(scolarite): modeles TypeFrais + FraisInscription + Bourse

Portage db/migrations/004. FraisInscription et Bourse heritent de core.Auditable.
Unicites unq_type_frais_code, unq_frais_inscription. perimetre TextChoices
(SCOLARITE_HORS_INSCRIPTION).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015vBabiytJuWPjuDR2qUfCf
EOF
)"
```

**Critère d'acceptation :** `db_table` corrects ; unicités ; `perimetre` défaut ; `sqlmigrate` diffé ; portes vertes.

---

## Task 2 : Service `materialiser_frais_obligatoires` + branchement transaction

**Files:**
- Modify: `backend/scolarite/services.py`, `backend/scolarite/tests/test_services.py`, `backend/personnes/serializers.py`, `backend/personnes/tests/test_api.py`

**Interfaces:**
- Consumes: `scolarite.models.{TypeFrais, FraisInscription}`, `personnes.models.Inscription`.
- Produces: `scolarite.services.materialiser_frais_obligatoires(inscription) -> list[FraisInscription]` — pour chaque `TypeFrais` `obligatoire=True, actif=True` dont le scope matche l'inscription (RF-1), crée un `FraisInscription(montant_du=type_frais.montant_defaut, cree_par=inscription.cree_par)` via `get_or_create` (idempotent). Retourne la liste des lignes (créées + préexistantes).

- [ ] **Step 1: Tests service**

Ajouter à `backend/scolarite/tests/test_services.py` :
```python
def test_materialiser_frais_obligatoires_scope_et_idempotence():
    from personnes.tests import factories as pf

    i = pf.InscriptionFactory()
    ecole = i.classe.niveau.ecole
    niveau = i.classe.niveau
    annee = i.annee_scolaire
    # matche (wildcard total)
    f.TypeFraisFactory(code="MUTUELLE", obligatoire=True, actif=True, montant_defaut=5000)
    # matche (école ciblée)
    f.TypeFraisFactory(code="TENUE", obligatoire=True, actif=True, ecole=ecole, montant_defaut=20000)
    # ne matche pas (autre niveau)
    autre_niveau = i.classe.__class__._meta.get_field("niveau").related_model.objects.create(
        ecole=ecole, code="ZZ", libelle="Autre", ordre=99
    )
    f.TypeFraisFactory(code="SOUTENANCE", obligatoire=True, actif=True, niveau=autre_niveau)
    # ne matche pas (non obligatoire)
    f.TypeFraisFactory(code="PHOTOCOPIE", obligatoire=False, actif=True)
    # ne matche pas (inactif)
    f.TypeFraisFactory(code="EXAMEN", obligatoire=True, actif=False)

    lignes = services.materialiser_frais_obligatoires(i)
    codes = {fi.type_frais.code for fi in models.FraisInscription.objects.filter(inscription=i)}
    assert codes == {"MUTUELLE", "TENUE"}
    assert models.FraisInscription.objects.get(inscription=i, type_frais__code="TENUE").montant_du == 20000

    # 2e appel : rien de nouveau
    services.materialiser_frais_obligatoires(i)
    assert models.FraisInscription.objects.filter(inscription=i).count() == 2
```

- [ ] **Step 2: RED**

`cd backend && DB_USER=root pytest scolarite/tests/test_services.py -q -k materialiser` → FAIL.

- [ ] **Step 3: Implémenter**

Ajouter à `backend/scolarite/services.py` :
```python
from django.db.models import Q

from .models import FraisInscription, TypeFrais


def materialiser_frais_obligatoires(inscription) -> list:
    ecole = inscription.ecole
    niveau = inscription.classe.niveau
    annee = inscription.annee_scolaire
    types = (
        TypeFrais.objects.filter(obligatoire=True, actif=True)
        .filter(Q(ecole__isnull=True) | Q(ecole=ecole))
        .filter(Q(niveau__isnull=True) | Q(niveau=niveau))
        .filter(Q(annee_scolaire__isnull=True) | Q(annee_scolaire=annee))
    )
    lignes = []
    for tf in types:
        fi, _ = FraisInscription.objects.get_or_create(
            inscription=inscription,
            type_frais=tf,
            defaults={
                "montant_du": tf.montant_defaut,
                "cree_par": inscription.cree_par,
            },
        )
        lignes.append(fi)
    return lignes
```

- [ ] **Step 4: Brancher dans la transaction de création**

Dans `backend/personnes/serializers.py`, `InscriptionSerializer` :
- imports : `from scolarite.services import generer_echeancier, materialiser_frais_obligatoires`.
- `create()` : après `generer_echeancier(inscription)`, ajouter `materialiser_frais_obligatoires(inscription)`.
- ajouter les champs imbriqués : `frais_inscription = FraisInscriptionSerializer(many=True, read_only=True)` et `bourses = BourseSerializer(many=True, read_only=True)` (imports depuis `scolarite.serializers`).

Dans `backend/personnes/views.py`, `InscriptionViewSet.queryset` : ajouter `"frais_inscription", "bourses"` au `prefetch_related`.

- [ ] **Step 5: Test API — frais matérialisés à la création**

Ajouter à `backend/personnes/tests/test_api.py` :
```python
def test_creation_inscription_materialise_les_frais_obligatoires():
    from referentiel.tests import factories as rf
    from scolarite.tests import factories as sf

    c, _ = _client(Role.Code.SCOLARITE)
    classe = rf.ClasseFactory()
    _grille(classe)
    sf.TypeFraisFactory(code="MUTUELLE", obligatoire=True, actif=True, montant_defaut=5000)
    sf.TypeFraisFactory(code="PHOTOCOPIE", obligatoire=False, actif=True)  # ignoré
    resp = c.post(
        "/api/v1/personnes/inscriptions/",
        {
            "etudiant": f.EtudiantFactory().pk,
            "classe": classe.pk,
            "date_inscription": "2025-10-01",
        },
        format="json",
    )
    assert resp.status_code == 201
    codes = {fi["type_frais"] for fi in resp.data["frais_inscription"]}
    assert len(codes) == 1  # seul MUTUELLE
```

- [ ] **Step 6: GREEN + portes + commit**

`cd backend && ruff check . && DB_USER=root pytest -q` → vert.
```bash
git add backend/scolarite/services.py backend/scolarite/tests/test_services.py backend/personnes/serializers.py backend/personnes/views.py backend/personnes/tests/test_api.py
git commit -m "$(cat <<'EOF'
feat(scolarite): materialiser_frais_obligatoires + branchement transaction inscription

Frais obligatoires (obligatoire & actif, scope ecole/niveau/annee matche)
materialises dans la meme transaction que l'inscription (get_or_create,
idempotent). InscriptionSerializer imbrique frais_inscription + bourses (lecture).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015vBabiytJuWPjuDR2qUfCf
EOF
)"
```

**Critère d'acceptation :** seul `obligatoire & actif & scope matché` matérialisé ; `montant_du` = `montant_defaut` ; 2ᵉ appel sans doublon ; `POST /inscriptions/` renvoie `frais_inscription`.

---

## Task 3 : Serializers + FilterSets `scolarite` (3B)

**Files:**
- Modify: `backend/scolarite/serializers.py`, `backend/scolarite/filters.py`, `backend/scolarite/tests/test_serializers.py`

**Interfaces:**
- Produces:
  - `scolarite.serializers.TypeFraisSerializer` — `ModelSerializer` plat.
  - `scolarite.serializers.FraisInscriptionSerializer(AuditableSerializerMixin, ModelSerializer)` — champs audit `read_only`.
  - `scolarite.serializers.BourseSerializer(AuditableSerializerMixin, ModelSerializer)` — champs audit `read_only`.
  - `scolarite.filters.{TypeFraisFilter, FraisInscriptionFilter, BourseFilter}`.

- [ ] **Step 1: Sérializers**

Ajouter à `backend/scolarite/serializers.py` :
```python
class TypeFraisSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.TypeFrais
        fields = "__all__"


class FraisInscriptionSerializer(AuditableSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = models.FraisInscription
        fields = "__all__"
        read_only_fields = _AUDIT


class BourseSerializer(AuditableSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = models.Bourse
        fields = "__all__"
        read_only_fields = _AUDIT
```

- [ ] **Step 2: FilterSets**

Ajouter à `backend/scolarite/filters.py` :
```python
class TypeFraisFilter(df.FilterSet):
    class Meta:
        model = models.TypeFrais
        fields = {
            "ecole": ["exact"],
            "niveau": ["exact"],
            "annee_scolaire": ["exact"],
            "obligatoire": ["exact"],
            "actif": ["exact"],
        }


class FraisInscriptionFilter(df.FilterSet):
    class Meta:
        model = models.FraisInscription
        fields = {"inscription": ["exact"], "type_frais": ["exact"], "exonere": ["exact"]}


class BourseFilter(df.FilterSet):
    class Meta:
        model = models.Bourse
        fields = {"inscription": ["exact"]}
```

- [ ] **Step 3: Tests**

Ajouter à `backend/scolarite/tests/test_serializers.py` :
```python
def test_frais_et_bourse_audit_read_only():
    from scolarite.serializers import BourseSerializer, FraisInscriptionSerializer

    for S in (FraisInscriptionSerializer, BourseSerializer):
        f = S().fields
        for nom in ("cree_par", "modifie_par", "cree_le", "modifie_le"):
            assert f[nom].read_only is True
```

- [ ] **Step 4: Portes + commit**

`cd backend && ruff check . && DB_USER=root pytest scolarite -q` → vert.
```bash
git add backend/scolarite/serializers.py backend/scolarite/filters.py backend/scolarite/tests/test_serializers.py
git commit -m "$(cat <<'EOF'
feat(scolarite): serializers + filters TypeFrais / FraisInscription / Bourse

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015vBabiytJuWPjuDR2qUfCf
EOF
)"
```

**Critère d'acceptation :** champs d'audit read-only sur frais/bourse ; 3 FilterSets.

---

## Task 4 : ViewSets + routers + OpenAPI + types

**Files:**
- Modify: `backend/scolarite/views.py`, `backend/scolarite/urls.py`, `backend/scolarite/tests/test_api.py`, `frontend/src/api/schema.d.ts`

**Interfaces:**
- Produces (namespace `v1:`, base `_BaseScolariteViewSet`) :
  - `scolarite/types-frais` → `TypeFraisViewSet` (`PeutEcrireTarifs`), `search_fields=["code","libelle"]`, `filterset_class=TypeFraisFilter`, `ordering_fields=["code","id"]`.
  - `scolarite/frais-inscription` → `FraisInscriptionViewSet` (`PeutEcrireFraisEleve`), `filterset_class=FraisInscriptionFilter`, `ordering_fields=["id"]`, `queryset` `select_related("inscription","type_frais","cree_par","modifie_par")`.
  - `scolarite/bourses` → `BourseViewSet` (`PeutEcrireFraisEleve`), `search_fields=["organisme"]`, `filterset_class=BourseFilter`, `ordering_fields=["id"]`, `select_related("inscription","cree_par","modifie_par")`.

- [ ] **Step 1: Views**

Ajouter à `backend/scolarite/views.py` :
```python
class TypeFraisViewSet(_BaseScolariteViewSet):
    permission_classes = [permissions.PeutEcrireTarifs]
    queryset = models.TypeFrais.objects.select_related("ecole", "niveau", "annee_scolaire")
    serializer_class = serializers.TypeFraisSerializer
    filterset_class = s_filters.TypeFraisFilter
    search_fields = ["code", "libelle"]
    ordering_fields = ["code", "id"]


class FraisInscriptionViewSet(_BaseScolariteViewSet):
    permission_classes = [permissions.PeutEcrireFraisEleve]
    queryset = models.FraisInscription.objects.select_related(
        "inscription", "type_frais", "cree_par", "modifie_par"
    )
    serializer_class = serializers.FraisInscriptionSerializer
    filterset_class = s_filters.FraisInscriptionFilter
    ordering_fields = ["id"]


class BourseViewSet(_BaseScolariteViewSet):
    permission_classes = [permissions.PeutEcrireFraisEleve]
    queryset = models.Bourse.objects.select_related(
        "inscription", "cree_par", "modifie_par"
    )
    serializer_class = serializers.BourseSerializer
    filterset_class = s_filters.BourseFilter
    search_fields = ["organisme"]
    ordering_fields = ["id"]
```

- [ ] **Step 2: URLs**

Ajouter à `backend/scolarite/urls.py` :
```python
router.register("types-frais", views.TypeFraisViewSet)
router.register("frais-inscription", views.FraisInscriptionViewSet)
router.register("bourses", views.BourseViewSet)
```

- [ ] **Step 3: Tests API**

Ajouter à `backend/scolarite/tests/test_api.py` :
```python
@pytest.mark.parametrize(
    "role,attendu",
    [("DIRECTION", 201), ("DAF", 403), ("COMPTABLE", 403), ("SCOLARITE", 403)],
)
def test_rbac_types_frais(role, attendu):
    c, _ = _client(role)
    resp = c.post(
        "/api/v1/scolarite/types-frais/",
        {"code": f"X_{role}", "libelle": "X", "montant_defaut": 1000},
        format="json",
    )
    assert resp.status_code == attendu


@pytest.mark.parametrize(
    "role,attendu",
    [("DIRECTION", 201), ("DAF", 201), ("COMPTABLE", 201), ("SCOLARITE", 403)],
)
def test_rbac_frais_inscription(role, attendu):
    from personnes.tests import factories as pf
    from scolarite.tests import factories as sf

    c, _ = _client(role)
    i = pf.InscriptionFactory()
    tf = sf.TypeFraisFactory()
    resp = c.post(
        "/api/v1/scolarite/frais-inscription/",
        {"inscription": i.pk, "type_frais": tf.pk, "montant_du": 12000},
        format="json",
    )
    assert resp.status_code == attendu
    if attendu == 201:
        assert resp.data["cree_par"] is not None


def test_rbac_bourse_daf():
    from personnes.tests import factories as pf

    c, _ = _client("DAF")
    i = pf.InscriptionFactory()
    resp = c.post(
        "/api/v1/scolarite/bourses/",
        {"inscription": i.pk, "organisme": "Fondation X", "montant_couvert": 250000},
        format="json",
    )
    assert resp.status_code == 201
```

- [ ] **Step 4: RED → GREEN**

`cd backend && DB_USER=root pytest scolarite/tests/test_api.py -q` → FAIL puis PASS.

- [ ] **Step 5: OpenAPI + gen:api**

```
cd backend && python manage.py spectacular --file /tmp/schema.yml     # 0 Error / 0 Warning
# backend sur :8000, puis :
cd ../frontend && npm run gen:api
```
Vérifier `schema.d.ts` : schémas `TypeFrais`, `FraisInscription`, `Bourse` + `Inscription` gagne `frais_inscription`/`bourses`.

- [ ] **Step 6: Portes + commit**

```
cd backend && ruff check . && python manage.py check && python manage.py makemigrations --check --dry-run && DB_USER=root pytest -q
cd ../frontend && npm run typecheck
```
→ vert.
```bash
git add backend/scolarite/views.py backend/scolarite/urls.py backend/scolarite/tests/test_api.py frontend/src/api/schema.d.ts
git commit -m "$(cat <<'EOF'
feat(scolarite): API types-frais + frais-inscription + bourses (RBAC + OpenAPI)

types-frais = DIRECTION ; frais-inscription/bourses = DIRECTION/DAF/COMPTABLE.
cree_par pose a la creation. gen:api regenere.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015vBabiytJuWPjuDR2qUfCf
EOF
)"
```

**Critère d'acceptation :** CRUD + RBAC des 3 ressources ; `cree_par` posé ; `spectacular` 0 Error ; `typecheck` front vert.

---

## Task 5 : Commande `seed_scolarite`

**Files:**
- Create: `backend/scolarite/management/{__init__.py, commands/__init__.py, commands/seed_scolarite.py}`, `backend/scolarite/tests/test_seed.py`

**Interfaces:**
- Produces: commande `seed_scolarite` — idempotente (`get_or_create` sur `type_frais.code`), catalogue : `TENUE`, `PHOTOCOPIE`, `MUTUELLE`, `JOURNEE_INTEGRATION`, `SOUTENANCE`, `EXAMEN`, `MATIERE_OEUVRE` (libellés FR, `montant_defaut`, `obligatoire`/`actif`, scope wildcard).

- [ ] **Step 1: Test**

`backend/scolarite/tests/test_seed.py` :
```python
import pytest
from django.core.management import call_command

from scolarite.models import TypeFrais

pytestmark = pytest.mark.django_db


def test_seed_scolarite_idempotent():
    call_command("seed_scolarite")
    call_command("seed_scolarite")
    assert TypeFrais.objects.count() == 7
    assert set(TypeFrais.objects.values_list("code", flat=True)) == {
        "TENUE", "PHOTOCOPIE", "MUTUELLE", "JOURNEE_INTEGRATION",
        "SOUTENANCE", "EXAMEN", "MATIERE_OEUVRE",
    }
```

- [ ] **Step 2: RED → commande → GREEN**

`backend/scolarite/management/commands/seed_scolarite.py` :
```python
from django.core.management.base import BaseCommand
from django.db import transaction

from scolarite.models import TypeFrais

# (code, libelle, montant_defaut, obligatoire, actif)
CATALOGUE = [
    ("TENUE", "Tenue / uniforme", 25000, True, True),
    ("PHOTOCOPIE", "Frais de photocopie", 10000, True, True),
    ("MUTUELLE", "Mutuelle étudiante", 5000, True, True),
    ("JOURNEE_INTEGRATION", "Journée d'intégration", 8000, False, True),
    ("SOUTENANCE", "Frais de soutenance", 50000, False, True),
    ("EXAMEN", "Frais d'examen national", 30000, False, True),
    ("MATIERE_OEUVRE", "Matière d'œuvre", 15000, False, True),
]


class Command(BaseCommand):
    help = "Amorce idempotente du catalogue de frais annexes (type_frais)."

    @transaction.atomic
    def handle(self, *args, **opts):
        for code, libelle, montant, obligatoire, actif in CATALOGUE:
            TypeFrais.objects.get_or_create(
                code=code,
                defaults={
                    "libelle": libelle,
                    "montant_defaut": montant,
                    "obligatoire": obligatoire,
                    "actif": actif,
                },
            )
        self.stdout.write(self.style.SUCCESS("Catalogue de frais amorcé."))
```
`management/__init__.py`, `management/commands/__init__.py` : vides.

Run: `cd backend && DB_USER=root pytest scolarite/tests/test_seed.py -q` → PASS.

- [ ] **Step 3: Portes + commit**

`cd backend && ruff check . && DB_USER=root pytest scolarite -q` → vert.
```bash
git add backend/scolarite/management backend/scolarite/tests/test_seed.py
git commit -m "$(cat <<'EOF'
feat(scolarite): commande seed_scolarite idempotente (catalogue 7 type_frais)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015vBabiytJuWPjuDR2qUfCf
EOF
)"
```

**Critère d'acceptation :** double run → 7 `type_frais`, aucun doublon.

---

## Task 6 : Frontend — écrans scaffold `scolarite` (3B)

**Files:**
- Create: `frontend/src/scolarite/config/{typeFrais,fraisInscription,bourse}.tsx` + `.test.tsx` associés
- Modify: `frontend/src/scolarite/routes.tsx`, `frontend/src/scolarite/integration.test.tsx`

**Interfaces:**
- Produces: 3 descripteurs + 3 segments de route sous `scolarite`.

- [ ] **Step 1: `config/typeFrais.tsx`**

`titre` « Catalogue de frais », endpoint `scolarite/types-frais`, `roleEcriture: ["DIRECTION"]`, `rechercheActive: true`.
- colonnes : `code`, `libelle`, `montant_defaut`, `obligatoire` (`rendu` Oui/Non), `actif` (`rendu` Oui/Non).
- filtres : `ecole` (fk `referentiel/ecoles`), `niveau` (fk `referentiel/niveaux`), `annee_scolaire` (fk), `obligatoire` (Oui/Non), `actif` (Oui/Non).
- champs : `code` (text requis), `libelle` (text requis), `ecole` (fk optionnel `referentiel/ecoles`), `niveau` (fk optionnel), `annee_scolaire` (fk optionnel), `montant_defaut` (number requis), `obligatoire` (checkbox), `actif` (checkbox).
- Zod : `code` min1 max30, `libelle` min1 max120, fk `z.union([z.number(), z.nan()]).optional()`, `montant_defaut` `z.number().int().nonnegative()`, booléens optionnels.

- [ ] **Step 2: `config/fraisInscription.tsx`**

`titre` « Frais par inscription », endpoint `scolarite/frais-inscription`, `roleEcriture: ["DIRECTION","DAF","COMPTABLE"]`.
- colonnes : `inscription`, `type_frais`, `montant_du`, `exonere` (Oui/Non), `commentaire`.
- filtres : `inscription` (fk `personnes/inscriptions`), `type_frais` (fk `scolarite/types-frais`), `exonere` (Oui/Non).
- champs : `inscription` (fk requis), `type_frais` (fk requis), `montant_du` (number requis), `exonere` (checkbox), `commentaire` (text).
- Zod miroir.

- [ ] **Step 3: `config/bourse.tsx`**

`titre` « Bourses », endpoint `scolarite/bourses`, `roleEcriture: ["DIRECTION","DAF","COMPTABLE"]`, `rechercheActive: true`.
- colonnes : `inscription`, `organisme`, `perimetre`, `montant_couvert`.
- filtres : `inscription` (fk `personnes/inscriptions`).
- champs : `inscription` (fk requis), `organisme` (text requis), `perimetre` (select, une option `SCOLARITE_HORS_INSCRIPTION`), `montant_couvert` (number requis).
- Zod : `organisme` min1 max150, `perimetre` `z.enum(["SCOLARITE_HORS_INSCRIPTION"]).optional()`, `montant_couvert` `z.number().int().nonnegative()`.

- [ ] **Step 4: `routes.tsx`** — étendre `paires` avec `["types-frais", typeFraisDescripteur]`, `["frais-inscription", fraisInscriptionDescripteur]`, `["bourses", bourseDescripteur]` (+ imports).

- [ ] **Step 5: Tests**

3 fichiers `config/*.test.tsx` sur le modèle de `scolarite/config/modalitePaiement.test.tsx` (Plan 3A) : rendu liste + « Créer » visible pour le bon rôle, absent pour `LECTURE` (et pour `typeFrais`, absent pour `DAF`).
`scolarite/integration.test.tsx` — mettre à jour : `routesScolarite[0].children` a 5 segments ; asserts `types-frais`, `bourses` présents.

- [ ] **Step 6: Portes + commit**

`cd frontend && npm test && npm run typecheck && npm run build` → verts.
```bash
git add frontend/src/scolarite
git commit -m "$(cat <<'EOF'
feat(front): ecrans scolarite catalogue-frais / frais-inscription / bourses

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015vBabiytJuWPjuDR2qUfCf
EOF
)"
```

**Critère d'acceptation :** `/scolarite/types-frais`, `/scolarite/frais-inscription`, `/scolarite/bourses` rendent leurs listes ; visibilité « Créer » selon rôle ; tests + typecheck + build verts.

---

## Task 7 : Frontend — sections Frais / Bourses de `FicheInscription`

**Files:**
- Modify: `frontend/src/personnes/FicheInscription.tsx`, `frontend/src/personnes/FicheInscription.test.tsx`

**Interfaces:**
- Consumes: le détail `personnes/inscriptions/:id` inclut désormais `frais_inscription: [...]` et `bourses: [...]` (livré en Task 2).

- [ ] **Step 1: Étendre le test**

Dans `FicheInscription.test.tsx`, ajouter à l'objet `fiche()` : `frais_inscription: [{ id: 1, type_frais: 1, montant_du: "5000", exonere: false }]`, `bourses: [{ id: 1, organisme: "Fondation X", perimetre: "SCOLARITE_HORS_INSCRIPTION", montant_couvert: "300000" }]`. Ajouter deux `it(...)` :
```tsx
it("rend les sections Frais et Bourses", async () => {
  apiFetchMock.mockResolvedValue(fiche());
  monter();
  expect(await screen.findByRole("heading", { name: /Frais/i })).toBeInTheDocument();
  expect(screen.getByText("Fondation X")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /Bourses/i })).toBeInTheDocument();
});

it("gère 0 frais / 0 bourse", async () => {
  apiFetchMock.mockResolvedValue(fiche({ frais_inscription: [], bourses: [] }));
  monter();
  await screen.findByRole("heading", { name: /Inscription n°\s*1/i });
  expect(screen.getByText(/Aucun frais/i)).toBeInTheDocument();
  expect(screen.getByText(/Aucune bourse/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: RED** — `cd frontend && npm test -- FicheInscription` → les 2 nouveaux échouent.

- [ ] **Step 3: Implémenter**

Dans `FicheInscription.tsx` : étendre le type local avec `frais_inscription: {...}[]` et `bourses: {...}[]` ; ajouter après la section Pièces :
- **Frais** : si `frais_inscription.length === 0` → `<p>Aucun frais enregistré.</p>` sinon `<table>` (Type / Montant dû / Exonéré / Commentaire).
- **Bourses** : si `bourses.length === 0` → `<p>Aucune bourse enregistrée.</p>` sinon `<table>` (Organisme / Périmètre / Montant couvert).

- [ ] **Step 4: GREEN + portes + commit**

`cd frontend && npm test && npm run typecheck && npm run build` → verts.
```bash
git add frontend/src/personnes/FicheInscription.tsx frontend/src/personnes/FicheInscription.test.tsx
git commit -m "$(cat <<'EOF'
feat(front): FicheInscription - sections Frais et Bourses

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015vBabiytJuWPjuDR2qUfCf
EOF
)"
```

**Critère d'acceptation :** la fiche affiche les 4 sections (échéancier, pièces, frais, bourses) ; cas vides gérés ; tests + typecheck + build verts.

---

## Task 8 : Vérification globale + documentation + merge 3B

**Files:**
- Modify: `CLAUDE.md`
- Create (non versionné): `.superpowers/sdd/2026-09-07-phase-3b-frais/progress.md`

- [ ] **Step 1: Portes en une passe**

```bash
cd backend && source .venv/bin/activate && ruff check . && python manage.py check && python manage.py makemigrations --check --dry-run && DB_USER=root pytest -q && python manage.py spectacular --file /tmp/schema.yml
cd ../frontend && npm run typecheck && npm test && npm run build && npx oxlint src
```
Attendu : tout vert ; `spectacular` 0 Error.

- [ ] **Step 2: Bout-en-bout sur base de dev**

```bash
cd backend && python manage.py migrate && python manage.py seed_scolarite && python manage.py seed_scolarite
```
Attendu : 7 `type_frais`, idempotent. Puis créer une inscription (API) avec un `type_frais`
obligatoire préexistant matchant → vérifier que `frais_inscription` contient la ligne
(`montant_du` = `montant_defaut`). Nettoyer les données de test.

- [ ] **Step 3: `CLAUDE.md`** — tableau architecture : `scolarite` **complet** (grilles, échéances,
catalogue de frais, frais par inscription, bourses) ; commandes seed : ajouter `seed_scolarite`.

- [ ] **Step 4: Rapport §26** dans `.superpowers/sdd/2026-09-07-phase-3b-frais/progress.md`
(mêmes rubriques, décisions D-P3-13/15/16, diffs `sqlmigrate` Task 1).

- [ ] **Step 5: Commit doc**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: cloture Phase 3B (frais annexes & bourses) - maj CLAUDE.md

Rapport (non versionne) : .superpowers/sdd/2026-09-07-phase-3b-frais/progress.md

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015vBabiytJuWPjuDR2qUfCf
EOF
)"
```

- [ ] **Step 6: Merge**

```bash
cd backend && source .venv/bin/activate && ruff check . && DB_USER=root pytest -q
cd ../frontend && npm test
cd .. && git checkout main && git merge --ff-only phase-3b-frais-bourses && git branch -d phase-3b-frais-bourses
```
Si le FF échoue : `git rebase main`, repasser les portes, `git merge --ff-only`.

**Critère d'acceptation :** portes vertes en une passe ; `seed_scolarite` idempotent + frais obligatoires matérialisés vérifiés sur base réelle ; rapport écrit ; `CLAUDE.md` reflète le Module 3 complet ; branche mergée sur `main`. **Phase 3 terminée.**

---

## Self-Review

**1. Spec coverage (3B)**

| Spec § | Tâche |
|---|---|
| §6 `TypeFrais`/`FraisInscription`/`Bourse` + migration | T1 |
| §5 RF-1 `materialiser_frais_obligatoires` (D-P3-13) + branchement transaction | T2 |
| §10 serializers (Auditable read-only) + `Inscription` imbrique frais/bourses | T2, T3 |
| §10 FilterSets `scolarite` restants | T3 |
| §9 RBAC `types-frais`=Tarifs / `frais-inscription`+`bourses`=FraisEleve (D-P3-15) | T4 (les classes viennent de 3A) |
| §10 API 3 ressources + OpenAPI + `gen:api` | T4 |
| §15 `seed_scolarite` | T5 |
| §11 écrans scaffold + sections Fiche | T6, T7 |
| §16 tests d'acceptation (3B) | T1–T7 + T8 (portes + base réelle) |
| §17 hors périmètre | respecté : pas d'imputations / calculs `montant_regle`/`reste` / réconciliation bourses / vues SQL |

**2. Placeholder scan**

- T1 Step 1 (test service, T2) : le bloc `autre_niveau = ... .objects.create(...)` construit un
  `Niveau` réel via l'ORM (pas un artefact) — champs `ecole`/`code`/`libelle`/`ordre` fournis,
  cohérent avec `referentiel.models.Niveau`. À garder tel quel.
- T6 Steps 1–3 : les 3 descripteurs scaffold sont décrits **champ par champ** (titre, endpoint,
  roleEcriture, colonnes, filtres, champs, règles Zod) — même niveau de détail que les descripteurs
  Phase 2 acceptés. Pas de code intégral recopié pour ces 3 formulaires triviaux mais rien n'est
  laissé à l'interprétation.
- T7 : sections décrites + test complet fourni ; structure identique aux sections déjà présentes
  dans `FicheInscription.tsx` (livré 3A) et `FicheEtudiant.tsx`.
- Aucun « TODO / TBD / similar to Task N » sans contenu.

**3. Type consistency**

- `core.models.Auditable` / `core.serializers.AuditableSerializerMixin` (Plan 3A) → hérités par
  `FraisInscription`/`Bourse` (T1) et leurs serializers (T3).
- `materialiser_frais_obligatoires(inscription) -> list` : T2 (def) ↔ T2
  (`InscriptionSerializer.create`, ajout après `generer_echeancier`).
- `TypeFraisSerializer`/`FraisInscriptionSerializer`/`BourseSerializer` : T3 (def) ↔ T4
  (`serializer_class`) ↔ T2 (`InscriptionSerializer` imbrique `FraisInscriptionSerializer`,
  `BourseSerializer`).
- `scolarite.permissions.PeutEcrireTarifs`/`PeutEcrireFraisEleve` : définies en **Plan 3A Task 7**,
  consommées ici T4. (Dépendance inter-plans explicite dans Global Constraints.)
- `_BaseScolariteViewSet` : défini Plan 3A Task 8, sous-classé ici T1..T4 sans redéfinition.
- Endpoints : `scolarite/types-frais`, `scolarite/frais-inscription`, `scolarite/bourses` —
  identiques `urls.py` (T4) ↔ descripteurs (T6) ↔ tests.
- `Inscription.frais_inscription` / `Inscription.bourses` (`related_name`) : définis Plan 3A Task 2
  (`Inscription`) via les FK de T1 ici — cohérent (`related_name="frais_inscription"` et
  `"bourses"` sur les FK `FraisInscription.inscription` / `Bourse.inscription`).

Aucune incohérence résiduelle.

---

## Execution Handoff

**Plan 3B complet, sauvegardé dans `docs/superpowers/plans/2026-09-07-phase-3b-frais-bourses.md`. À exécuter APRÈS le merge de 3A. Deux options :**

**1. Subagent-Driven (recommandé)** — un sous-agent neuf par tâche (`superpowers:subagent-driven-development`).

**2. Inline Execution** — dans cette session avec points de contrôle (`superpowers:executing-plans`).

**Quelle approche ?**

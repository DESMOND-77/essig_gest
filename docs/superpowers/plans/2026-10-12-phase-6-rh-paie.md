# Phase 6 RH & Paie Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the RH & Paie module for ESSIG-GEST, enabling management of teaching and administrative staff, their professional information, assignments, salary parameters, payroll cycles, payroll preparation/calculation/validation/payment tracking, salary advances, payroll mass calculation, integration with treasury module, and payslip preparation.

**Architecture:** The implementation will follow the existing Django/React architecture patterns from phases 1-5. Backend services will be implemented in Django with proper transaction management and audit trails. Frontend components will reuse existing design system patterns and follow the established CRUD structure. The module will integrate with the existing trésorerie module for financial movements.

**Tech Stack:** Django 5.2, Python 3.13, MySQL 8.4, React 19, TypeScript, Vite, React Router 7, Tailwind v4, shadcn/ui, TanStack Query

**Spec:** docs/superpowers/specs/2026-10-12-phase-6-rh-paie.md

## Global Constraints

- All monetary amounts use FCFA integers, `DecimalField(max_digits=12, decimal_places=0)`. Never use `FloatField`.
- Multi-year approach: `etudiant` = persistent identity, `inscription` = annual. Never merge.
- Financial year: SEPT…AOUT. Default `mois` enum `'SEPT'`.
- Target table naming: `snake_case` singular, no accents, French; PK `id`; FK `<table>_id`.
- ORM primary key: `BigAutoField` / `BIGINT` everywhere.
- RBAC: 5 roles (`COMPTABLE`, `DAF`, `DIRECTION`, `SCOLARITE`, `LECTURE`), server-side only.
- Audit: `AuditLogMixin` on sensitive ViewSets.
- Transactions: Multi-step operations use `transaction.atomic`.
- Aggregates: Calculated (SQL views/annotations/services), never stored — except frozen after deliberation.
- API errors: Typed exceptions from `core/exceptions.py` (FR, stable codes), DRF standard format.
- No PostgreSQL, Celery/Redis, WebSockets, GraphQL, microservices/K8s, SSO, multi-tenant SaaS, student/parent portal, online payment, mobile.

---

## Phase 1: Model Alignment and Initial Setup

### Task 1: Create rh_paie Django app and configure

**Files:**
- Create: `backend/rh_paie/__init__.py`
- Create: `backend/rh_paie/apps.py`
- Create: `backend/rh_paie/models.py`
- Modify: `backend/config/settings.py:INSTALLED_APPS`

**Interfaces:**
- Consumes: None (foundation task)
- Produces: Django app configuration ready for model definitions

- [ ] **Step 1: Create app directory and basic files**

```bash
mkdir -p backend/rh_paie/migrations
touch backend/rh_paie/__init__.py
```

```python
# backend/rh_paie/apps.py
from django.apps import AppConfig

class RhPaieConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'rh_paie'
```

- [ ] **Step 2: Add app to settings**

```python
# In backend/config/settings.py, add to INSTALLED_APPS:
    'rh_paie',
```

- [ ] **Step 3: Verify app creation**

Run: `python manage.py check`
Expected: No errors related to rh_paie app

- [ ] **Step 4: Commit**

```bash
git add backend/rh_paie/ backend/config/settings.py
git commit -m "feat(rh-paie): create Django app structure"
```

### Task 2: Define Enseignant model aligned with SQL schema

**Files:**
- Create: `backend/rh_paie/models.py`

**Interfaces:**
- Consumes: None
- Produces: Enseignant model matching SQL schema

- [ ] **Step 1: Write Enseignant model**

```python
# backend/rh_paie/models.py
from django.db import models
from core.models import AuditableMixin  # Assuming this exists based on spec


class Enseignant(AuditableMixin):
    nom = models.CharField(max_length=60)
    prenom = models.CharField(max_length=120)
    telephone = models.CharField(max_length=60, blank=True, null=True)
    email = models.EmailField(max_length=120, unique=True)
    specialite = models.CharField(max_length=120, blank=True, null=True)
    statut = models.CharField(
        max_length=20,
        choices=[
            ('VACATAIRE', 'Vacataire'),
            ('PERMANENT', 'Permanent'),
        ],
        default='VACATAIRE'
    )
    taux_horaire = models.DecimalField(max_digits=12, decimal_places=0, blank=True, null=True)
    actif = models.BooleanField(default=True)

    class Meta:
        db_table = 'enseignant'
        verbose_name = 'Enseignant'
        verbose_name_plural = 'Enseignants'
        indexes = [
            models.Index(fields=['nom', 'prenom']),
        ]

    def __str__(self):
        return f"{self.nom} {self.prenom}"
```

- [ ] **Step 2: Run migrations to verify model**

Run: `python manage.py makemigrations rh_paie --dry-run`
Expected: Migration file generated without errors

- [ ] **Step 3: Commit**

```bash
git add backend/rh_paie/models.py
git commit -m "feat(rh-paie): add Enseignant model"
```

### Task 3: Define PersonnelAdministratif model

**Files:**
- Modify: `backend/rh_paie/models.py`

**Interfaces:**
- Consumes: None
- Produces: PersonnelAdministratif model matching SQL schema

- [ ] **Step 1: Add PersonnelAdministratif model**

```python
# Continuing in backend/rh_paie/models.py
from referentiel.models import Ecole  # Assuming Ecole exists


class PersonnelAdministratif(AuditableMixin):
    nom = models.CharField(max_length=60)
    prenom = models.CharField(max_length=120)
    poste = models.CharField(max_length=120)
    ecole = models.ForeignKey(Ecole, on_delete=models.SET_NULL, null=True, blank=True)
    telephone = models.CharField(max_length=60, blank=True, null=True)
    email = models.EmailField(max_length=120)
    salaire_base = models.DecimalField(max_digits=12, decimal_places=0)
    date_embauche = models.DateField(blank=True, null=True)
    actif = models.BooleanField(default=True)

    class Meta:
        db_table = 'personnel_administratif'
        verbose_name = 'Personnel Administratif'
        verbose_name_plural = 'Personnels Administratifs'
        indexes = [
            models.Index(fields=['ecole']),
        ]

    def __str__(self):
        return f"{self.nom} {self.prenom}"
```

- [ ] **Step 2: Run migrations**

Run: `python manage.py makemigrations rh_paie --dry-run`
Expected: Migration file generated

- [ ] **Step 3: Commit**

```bash
git add backend/rh_paie/models.py
git commit -m "feat(rh-paie): add PersonnelAdministratif model"
```

### Task 4: Define AffectationEnseignement model

**Files:**
- Modify: `backend/rh_paie/models.py`

**Interfaces:**
- Consumes: None
- Produces: AffectationEnseignement model with computed montant_prevu

- [ ] **Step 1: Add AffectationEnseignement model**

```python
# Continuing in backend/rh_paie/models.py
from personnes.models import Inscription  # Assuming this exists for AnneeScolaire, etc.
# Actually, let's check what's available - based on SQL we need matiere, classe, annee_scolaire
# These likely exist in referentiel or scolarite apps
from referentiel.models import Matiere, Classe
from scolarite.models import AnneeScolaire  # Assuming this exists


class AffectationEnseignement(models.Model):
    enseignant = models.ForeignKey('Enseignant', on_delete=models.CASCADE)
    matiere = models.ForeignKey(Matiere, on_delete=models.CASCADE)
    classe = models.ForeignKey(Classe, on_delete=models.CASCADE)
    annee_scolaire = models.ForeignKey(AnneeScolaire, on_delete=models.CASCADE)
    volume_horaire_prevu = models.IntegerField()
    taux_horaire = models.DecimalField(max_digits=12, decimal_places=0)
    # montant_prevu is computed as volume_horaire_prevu * taux_horaire
    montant_prevu = models.DecimalField(
        max_digits=12, 
        decimal_places=0,
        editable=False,
        db_persist=True  # This would be a stored generated column in SQL
    )

    class Meta:
        db_table = 'affectation_enseignement'
        verbose_name = 'Affectation d\'enseignement'
        verbose_name_plural = 'Affectations d\'enseignement'
        constraints = [
            models.UniqueConstraint(
                fields=['matiere', 'classe'],
                name='unq_affectation'
            )
        ]
        indexes = [
            models.Index(fields=['enseignant', 'annee_scolaire']),
        ]

    def save(self, *args, **kwargs):
        # Calculate montant_prevu before saving
        self.montant_prevu = self.volume_horaire_prevu * self.taux_horaire
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.enseignant} - {self.matiere} dans {self.classe}"
```

Note: For the generated column, we'll need to handle this in the migration since Django doesn't natively support computed columns. We'll address this in the migration task.

- [ ] **Step 2: Run migrations**

Run: `python manage.py makemigrations rh_paie --dry-run`
Expected: Migration file generated

- [ ] **Step 3: Commit**

```bash
git add backend/rh_paie/models.py
git commit -m "feat(rh-paie): add AffectationEnseignement model"
```

### Task 5: Define SalaireEnseignant model

**Files:**
- Modify: `backend/rh_paie/models.py`

**Interfaces:**
- Consumes: Enseignant, AffectationEnseignant (optional), AnneeScolaire, Compte, Mouvement, Utilisateur
- Produces: SalaireEnseignant model for teacher salary records

- [ ] **Step 1: Add SalaireEnseignant model**

```python
# Continuing in backend/rh_paie/models.py
from tresorerie.models import Compte, Mouvement  # Assuming these exist
from comptes.models import Utilisateur  # Assuming this exists


class SalaireEnseignant(models.Model):
    enseignant = models.ForeignKey(Enseignant, on_delete=models.CASCADE)
    affectation_enseignement = models.ForeignKey(
        AffectationEnseignement, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True
    )
    annee_scolaire = models.ForeignKey(AnneeScolaire, on_delete=models.CASCADE)
    mois = models.CharField(
        max_length=10,
        choices=[
            ('SEPT', 'Septembre'),
            ('OCT', 'Octobre'),
            ('NOV', 'Novembre'),
            ('DEC', 'Décembre'),
            ('JAN', 'Janvier'),
            ('FEV', 'Février'),
            ('MAR', 'Mars'),
            ('AVR', 'Avril'),
            ('MAI', 'Mai'),
            ('JUIN', 'Juin'),
            ('JUIL', 'Juillet'),
            ('AOUT', 'Août'),
        ]
    )
    date_paiement = models.DateField()
    montant = models.DecimalField(max_digits=12, decimal_places=0)
    compte = models.ForeignKey(Compte, on_delete=models.CASCADE)
    mouvement = models.OneToOneField(Mouvement, on_delete=models.CASCADE)  # OneToOne because unique constraint
    cree_par = models.ForeignKey(
        Utilisateur, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='salaire_enseignant_crees'
    )
    cree_le = models.DateTimeField(auto_now_add=True)
    modifie_par = models.ForeignKey(
        Utilisateur,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='salaire_enseignant_modifies'
    )
    modifie_le = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'salaire_enseignant'
        verbose_name = 'Salaire Enseignant'
        verbose_name_plural = 'Salaires Enseignants'
        constraints = [
            models.UniqueConstraint(
                fields=['mouvement'],
                name='unq_salaire_enseignant_mouvement'
            )
        ]
        indexes = [
            models.Index(fields=['enseignant', 'annee_scolaire', 'mois']),
        ]

    def __str__(self):
        return f"Salaire {self.enseignant} - {self.mois} {self.annee_scolaire}: {self.montant} FCFA"
```

- [ ] **Step 2: Run migrations**

Run: `python manage.py makemigrations rh_paie --dry-run`
Expected: Migration file generated

- [ ] **Step 3: Commit**

```bash
git add backend/rh_paie/models.py
git commit -m "feat(rh-paie): add SalaireEnseignant model"
```

### Task 6: Define SalaireAdministration model

**Files:**
- Modify: `backend/rh_paie/models.py`

**Interfaces:**
- Consumes: PersonnelAdministratif, AnneeScolaire, Compte, Mouvement, Utilisateur
- Produces: SalaireAdministration model for admin salary records

- [ ] **Step 1: Add SalaireAdministration model**

```python
# Continuing in backend/rh_paie/models.py
class SalaireAdministration(models.Model):
    personnel_administratif = models.ForeignKey(PersonnelAdministratif, on_delete=models.CASCADE)
    annee_scolaire = models.ForeignKey(AnneeScolaire, on_delete=models.CASCADE)
    mois = models.CharField(
        max_length=10,
        choices=[
            ('SEPT', 'Septembre'),
            ('OCT', 'Octobre'),
            ('NOV', 'Novembre'),
            ('DEC', 'Décembre'),
            ('JAN', 'Janvier'),
            ('FEV', 'Février'),
            ('MAR', 'Mars'),
            ('AVR', 'Avril'),
            ('MAI', 'Mai'),
            ('JUIN', 'Juin'),
            ('JUIL', 'Juillet'),
            ('AOUT', 'Août'),
        ]
    )
    date_paiement = models.DateField()
    montant_du = models.DecimalField(max_digits=12, decimal_places=0)
    montant_paye = models.DecimalField(max_digits=12, decimal_places=0)
    compte = models.ForeignKey(Compte, on_delete=models.CASCADE)
    mouvement = models.OneToOneField(Mouvement, on_delete=models.CASCADE)  # OneToOne because unique constraint
    cree_par = models.ForeignKey(
        Utilisateur, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='salaire_admin_crees'
    )
    cree_le = models.DateTimeField(auto_now_add=True)
    modifie_par = models.ForeignKey(
        Utilisateur,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='salaire_admin_modifies'
    )
    modifie_le = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'salaire_administration'
        verbose_name = 'Salaire Administration'
        verbose_name_plural = 'Salaires Administration'
        constraints = [
            models.UniqueConstraint(
                fields=['personnel_administratif', 'annee_scolaire', 'mois'],
                name='unq_salaire_admin'
            ),
            models.UniqueConstraint(
                fields=['mouvement'],
                name='unq_salaire_admin_mouvement'
            )
        ]

    def __str__(self):
        return f"Salaire {self.personnel_administratif} - {self.mois} {self.annee_scolaire}: {self.montant_paye}/{self.montant_du} FCFA"
```

- [ ] **Step 2: Run migrations**

Run: `python manage.py makemigrations rh_paie --dry-run`
Expected: Migration file generated

- [ ] **Step 3: Commit**

```bash
git add backend/rh_paie/models.py
git commit -m "feat(rh-paie): add SalaireAdministration model"
```

### Task 7: Define AvancePersonnel model

**Files:**
- Modify: `backend/rh_paie/models.py`

**Interfaces:**
- Consumes: Enseignant (optional), PersonnelAdministratif (optional), Compte, Mouvement, Utilisateur, SalaireAdministration (optional for regularization)
- Produces: AvancePersonnel model for salary advances

- [ ] **Step 1: Add AvancePersonnel model**

```python
# Continuing in backend/rh_paie/models.py
class AvancePersonnel(models.Model):
    BENEFICIAIRE_CHOICES = [
        ('ENSEIGNANT', 'Enseignant'),
        ('ADMIN', 'Administratif'),
    ]
    
    beneficiaire = models.CharField(max_length=11, choices=BENEFICIAIRE_CHOICES)
    enseignant = models.ForeignKey(
        Enseignant, 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True
    )
    personnel_administratif = models.ForeignKey(
        PersonnelAdministratif, 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True
    )
    date = models.DateField()
    montant = models.DecimalField(max_digits=12, decimal_places=0)
    motif = models.CharField(max_length=255, blank=True, null=True)
    compte = models.ForeignKey(Compte, on_delete=models.CASCADE)
    mouvement = models.OneToOneField(Mouvement, on_delete=models.CASCADE)  # OneToOne because unique constraint
    regularise_salaire_admin = models.ForeignKey(
        SalaireAdministration,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='avances_regularisees'
    )
    regularisee = models.BooleanField(default=False)
    cree_par = models.ForeignKey(
        Utilisateur, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='avances_crees'
    )
    cree_le = models.DateTimeField(auto_now_add=True)
    modifie_par = models.ForeignKey(
        Utilisateur,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='avances_modifies'
    )
    modifie_le = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'avance_personnel'
        verbose_name = 'Avance Personnel'
        verbose_name_plural = 'Avances Personnel'
        constraints = [
            models.UniqueConstraint(
                fields=['mouvement'],
                name='unq_avance_personnel_mouvement'
            ),
            models.CheckConstraint(
                check=(
                    models.Q(beneficiaire='ENSEIGNANT', enseignant__isnull=False, personnel_administratif__isnull=True) |
                    models.Q(beneficiaire='ADMIN', personnel_administratif__isnull=False, enseignant__isnull=True)
                ),
                name='chk_avance_beneficiaire'
            )
        ]

    def __str__(self):
        beneficiaire_nom = ""
        if self.beneficiaire == 'ENSEIGNANT' and self.enseignant:
            beneficiaire_nom = f"{self.enseignant.nom} {self.enseignant.prenom}"
        elif self.beneficiaire == 'ADMIN' and self.personnel_administratif:
            beneficiaire_nom = f"{self.personnel_administratif.nom} {self.personnel_administratif.prenom}"
        return f"Avance {beneficiaire_nom} - {self.date}: {self.montant} FCFA"
```

- [ ] **Step 2: Run migrations**

Run: `python manage.py makemigrations rh_paie --dry-run`
Expected: Migration file generated

- [ ] **Step 3: Commit**

```bash
git add backend/rh_paie/models.py
git commit -m "feat(rh-paie): add AvancePersonnel model"
```

### Task 8: Create and apply initial migration for rh_paie models

**Files:**
- Create: `backend/rh_paie/migrations/0001_initial.py` (will be generated)
- Modify: Database schema

**Interfaces:**
- Consumes: RhPaiemodels defined in models.py
- Produces: Applied database schema matching SQL reference

- [ ] **Step 1: Generate migration**

Run: `python manage.py makemigrations rh_paie`
Expected: Migration file created with all model definitions

- [ ] **Step 2: Review migration for generated columns**

Check that the migration handles the computed montant_prevu field appropriately (may need custom SQL for generated column)

- [ ] **Step 3: Apply migration**

Run: `python manage.py migrate rh_paie`
Expected: Tables created successfully

- [ ] **Step 4: Verify schema matches SQL reference**

Run: `python manage.py sqlmigrate rh_paie 0001`
Expected: SQL output similar to db/migrations/006_rh_paie.sql (adjusting for Django's BigAutoField vs INT UNSIGNED)

- [ ] **Step 5: Commit**

```bash
git add backend/rh_paie/migrations/
git commit -m "feat(rh-paie): apply initial migration"
```

### Task 9: Handle salaire_enseignant.montant_prevu generated column

**Files:**
- Modify: `backend/rh_paie/migrations/0001_initial.py`

**Interfaces:**
- Consumes: Initial migration file
- Produces: Migration with proper generated column for montant_prevu

- [ ] **Step 1: Edit migration to add generated column**

In the migration file, modify the CreateModel for AffectationEnseignement to include:
```python
migrations.AlterField(
    model_name='affectationenseignement',
    name='montant_prevu',
    field=models.DecimalField(
        max_digits=12,
        decimal_places=0,
        editable=False,
    ),
    # Add database-specific generated column syntax
    # For MySQL: 
    db_type_suffix='GENERATED ALWAYS AS (volume_horaire_prevu * taux_horaire) STORED'
),
```

Actually, Django doesn't support generated columns natively, so we'll need to use RunSQL:

```python
migrations.RunSQL(
    sql="ALTER TABLE rh_paie_affectation_enseignement ADD COLUMN montant_prevu DECIMAL(12,0) GENERATED ALWAYS AS (volume_horaire_prevu * taux_horaire) STORED",
    reverse_sql="ALTER TABLE rh_paie_affectation_enseignement DROP COLUMN montant_prevu",
),
```

- [ ] **Step 2: Apply updated migration**

Run: `python manage.py migrate rh_paie`
Expected: Migration applied with generated column

- [ ] **Step 3: Commit**

```bash
git add backend/rh_paie/migrations/0001_initial.py
git commit -m "feat(rh-paie): add generated column for montant_prevu"
```

## Phase 2: RH Services Implementation

### Task 10: Create service for Enseignant operations

**Files:**
- Create: `backend/rh_paie/services.py`
- Create: `backend/rh_paie/services/__init__.py` (if using package)
- Modify: `backend/rh_paie/apps.py` to initialize service if needed

**Interfaces:**
- Consumes: Enseignant model
- Produces: CRUD operations for Enseignant with business rule validation

- [ ] **Step 1: Create services module structure**

```bash
mkdir -p backend/rh_paie/services
touch backend/rh_paie/services/__init__.py
```

```python
# backend/rh_paie/services.py
from django.core.exceptions import ValidationError
from django.db import transaction
from .models import Enseignant


class EnseignantService:
    @staticmethod
    def create_enseignant(nom, prenom, email, **kwargs):
        """Create an enseignant with validation"""
        if Enseignant.objects.filter(email=email).exists():
            raise ValidationError("Un enseignant avec cet email existe déjà.")
        
        enseignant = Enseignant.objects.create(
            nom=nom,
            prenom=prenom,
            email=email,
            **kwargs
        )
        return enseignant
    
    @staticmethod
    @transaction.atomic
    def update_enseignant(enseignant_id, **kwargs):
        """Update an enseignant"""
        enseignant = Enseignant.objects.get(id=enseignant_id)
        for attr, value in kwargs.items():
            setattr(enseignant, attr, value)
        enseignant.full_clean()  # Validate model constraints
        enseignant.save()
        return enseignant
    
    @staticmethod
    def get_enseignant_by_email(email):
        """Retrieve enseignant by email"""
        return Enseignant.objects.filter(email=email).first()
    
    @staticmethod
    def list_enseignants(actif_only=True):
        """List all enseignants"""
        queryset = Enseignant.objects.all()
        if actif_only:
            queryset = queryset.filter(actif=True)
        return queryset
```

- [ ] **Step 2: Create unit tests for service**

Create: `backend/rh_paie/tests/test_services.py`
```python
from django.test import TestCase
from django.core.exceptions import ValidationError
from rh_paie.models import Enseignant
from rh_paie.services import EnseignantService


class EnseignantServiceTest(TestCase):
    def setUp(self):
        self.enseignant_data = {
            'nom': 'DOE',
            'prenom': 'John',
            'email': 'john.doe@example.com',
            'statut': 'PERMANENT'
        }
    
    def test_create_enseignant_success(self):
        enseignant = EnseignantService.create_enseignant(**self.enseignant_data)
        self.assertEqual(enseignant.nom, 'DOE')
        self.assertEqual(enseignant.email, 'john.doe@example.com')
    
    def test_create_enseignant_duplicate_email(self):
        EnseignantService.create_enseignant(**self.enseignant_data)
        with self.assertRaises(ValidationError):
            EnseignantService.create_enseignant(**self.enseignant_data)
    
    def test_get_enseignant_by_email(self):
        EnseignantService.create_enseignant(**self.enseignant_data)
        retrieved = EnseignantService.get_enseignant_by_email('john.doe@example.com')
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.nom, 'DOE')
```

- [ ] **Step 3: Run tests to verify**

Run: `python manage.py test rh_paie.tests.test_services.EnseignantServiceTest`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add backend/rh_paie/services/ backend/rh_paie/tests/
git commit -m "feat(rh-paie): implement Enseignant service with tests"
```

### Task 11: Create service for PersonnelAdministratif operations

**Files:**
- Modify: `backend/rh_paie/services.py`

**Interfaces:**
- Consumes: PersonnelAdministratif model
- Produces: CRUD operations for PersonnelAdministratif with business rule validation

- [ ] **Step 1: Add PersonnelAdministratif service methods**

```python
# Adding to backend/rh_paie/services.py
from ..referentiel.models import Ecole  # Adjust import based on actual location
from .models import PersonnelAdministratif


class PersonnelAdministratifService:
    @staticmethod
    def create_personnel_administratif(nom, prenom, poste, email, salaire_base, **kwargs):
        """Create a personnel administratif with validation"""
        if PersonnelAdministratif.objects.filter(email=email).exists():
            raise ValidationError("Un personnel administratif avec cet email existe déjà.")
        
        personnel = PersonnelAdministratif.objects.create(
            nom=nom,
            prenom=prenom,
            poste=poste,
            email=email,
            salaire_base=salaire_base,
            **kwargs
        )
        return personnel
    
    @staticmethod
    @transaction.atomic
    def update_personnel_administratif(personnel_id, **kwargs):
        """Update a personnel administratif"""
        personnel = PersonnelAdministratif.objects.get(id=personnel_id)
        for attr, value in kwargs.items():
            setattr(personnel, attr, value)
        personnel.full_clean()
        personnel.save()
        return personnel
    
    @staticmethod
    def get_personnel_administratif_by_email(email):
        """Retrieve personnel administratif by email"""
        return PersonnelAdministratif.objects.filter(email=email).first()
    
    @staticmethod
    def list_personnels_administratifs(actif_only=True, ecole_id=None):
        """List all personnels administratifs"""
        queryset = PersonnelAdministratif.objects.all()
        if actif_only:
            queryset = queryset.filter(actif=True)
        if ecole_id:
            queryset = queryset.filter(ecole_id=ecole_id)
        return queryset
```

- [ ] **Step 2: Create unit tests for service**

Add to: `backend/rh_paie/tests/test_services.py`
```python
from rh_paie.models import PersonnelAdministratif
from rh_paie.services import PersonnelAdministratifService


class PersonnelAdministratifServiceTest(TestCase):
    def setUp(self):
        # First create an ecole for testing
        from referentiel.models import Ecole
        self.ecole = Ecole.objects.create(nom="Ecole Test")
        
        self.personnel_data = {
            'nom': 'SMITH',
            'prenom': 'Jane',
            'poste': 'Comptable',
            'ecole': self.ecole,
            'email': 'jane.smith@example.com',
            'salaire_base': 300000
        }
    
    def test_create_personnel_administratif_success(self):
        personnel = PersonnelAdministratifService.create_personnel_administratif(**self.personnel_data)
        self.assertEqual(personnel.nom, 'SMITH')
        self.assertEqual(personnel.email, 'jane.smith@example.com')
    
    def test_create_personnel_administratif_duplicate_email(self):
        PersonnelAdministratifService.create_personnel_administratif(**self.personnel_data)
        with self.assertRaises(ValidationError):
            PersonnelAdministratifService.create_personnel_administratif(**self.personnel_data)
    
    def test_list_personnels_by_ecole(self):
        PersonnelAdministratifService.create_personnel_administratif(**self.personnel_data)
        personnels = PersonnelAdministratifService.list_personnels_administratifs(ecole_id=self.ecole.id)
        self.assertEqual(personnels.count(), 1)
```

- [ ] **Step 3: Run tests to verify**

Run: `python manage.py test rh_paie.tests.test_services.PersonnelAdministratifServiceTest`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add backend/rh_paie/services.py backend/rh_paie/tests/test_services.py
git commit -m "feat(rh-paie): implement PersonnelAdministratif service with tests"
```

### Task 12: Create service for AffectationEnseignement operations

**Files:**
- Modify: `backend/rh_paie/services.py`

**Interfaces:**
- Consumes: AffectationEnseignement model
- Produces: Operations for managing teaching assignments with duplication prevention

- [ ] **Step 1: Add AffectationEnseignement service methods**

```python
# Adding to backend/rh_paie/services.py
from .models import AffectationEnseignement


class AffectationEnseignementService:
    @staticmethod
    def create_affectation(enseignant, matiere, classe, annee_scolaire, volume_horaire_prevu, taux_horaire):
        """Create an affectation with validation against duplication"""
        # Check for existing affectation with same matiere and classe (uniqueness constraint)
        if AffectationEnseignement.objects.filter(
            matiere=matiere, 
            classe=classe
        ).exists():
            raise ValidationError("Une affectation pour cette matière et cette classe existe déjà.")
        
        affectation = AffectationEnseignement.objects.create(
            enseignant=enseignant,
            matiere=matiere,
            classe=classe,
            annee_scolaire=annee_scolaire,
            volume_horaire_prevu=volume_horaire_prevu,
            taux_horaire=taux_horaire
        )
        return affectation
    
    @staticmethod
    def get_affectations_for_enseignant(enseignant, annee_scolaire=None):
        """Get all affectations for an enseignant"""
        queryset = AffectationEnseignement.objects.filter(enseignant=enseignant)
        if annee_scolaire:
            queryset = queryset.filter(annee_scolaire=annee_scolaire)
        return queryset
    
    @staticmethod
    def get_affectations_for_classe(classe, annee_scolaire=None):
        """Get all affectations for a classe"""
        queryset = AffectationEnseignement.objects.filter(classe=classe)
        if annee_scolaire:
            queryset = queryset.filter(annee_scolaire=annee_scolaire)
        return queryset
```

- [ ] **Step 2: Create unit tests for service**

Add to: `backend/rh_paie/tests/test_services.py`
```python
from rh_paie.models import AffectationEnseignement
from rh_paie.services import AffectationEnseignementService


class AffectationEnseignementServiceTest(TestCase):
    def setUp(self):
        # Create dependencies
        from referentiel.models import Ecole, Matiere, Classe
        from scolarite.models import AnneeScolaire
        from rh_paie.models import Enseignant
        
        self.ecole = Ecole.objects.create(nom="Ecole Test")
        self.matiere = Matiere.objects.create(nom="Mathématiques")
        self.classe = Classe.objects.create(nom="6A", ecole=self.ecole)
        self.annee_scolaire = AnneeScolaire.objects.create(
            annee_scolaire="2025-2026",
            date_debut="2025-09-01",
            date_fin="2026-06-30"
        )
        self.enseignant = Enseignant.objects.create(
            nom="DUPONT",
            prenom="Marie",
            email="marie.dupont@example.com"
        )
        
        self.affectation_data = {
            'enseignant': self.enseignant,
            'matiere': self.matiere,
            'classe': self.classe,
            'annee_scolaire': self.annee_scolaire,
            'volume_horaire_prevu': 45,
            'taux_horaire': 8000
        }
    
    def test_create_affectation_success(self):
        affectation = AffectationEnseignementService.create_affectation(**self.affectation_data)
        self.assertEqual(affectation.volume_horaire_prevu, 45)
        self.assertEqual(affectation.montant_prevu, 360000)  # 45 * 8000
    
    def test_create_affectation_duplicate_matiere_classe(self):
        # Create first affectation
        AffectationEnseignementService.create_affectation(**self.affectation_data)
        
        # Try to create another with same matiere and classe
        with self.assertRaises(ValidationError):
            AffectationEnseignementService.create_affectation(
                enseignant=self.enseignant,
                matiere=self.matiere,
                classe=self.classe,
                annee_scolaire=self.annee_scolaire,
                volume_horaire_prevu=10,
                taux_horaire=8000
            )
    
    def test_get_affectations_for_enseignant(self):
        AffectationEnseignementService.create_affectation(**self.affectation_data)
        affectations = AffectationEnseignementService.get_affectations_for_enseignant(self.enseignant)
        self.assertEqual(affectations.count(), 1)
```

- [ ] **Step 3: Run tests to verify**

Run: `python manage.py test rh_paie.tests.test_services.AffectationEnseignementServiceTest`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add backend/rh_paie/services.py backend/rh_paie/tests/test_services.py
git commit -m "feat(rh-paie): implement AffectationEnseignement service with tests"
```

### Task 13: Create service for SalaireEnseignant operations

**Files:**
- Modify: `backend/rh_paie/services.py`

**Interfaces:**
- Consumes: SalaireEnseignant model
- Produces: Operations for teacher salary calculation and validation

- [ ] **Step 1: Add SalaireEnseignant service methods**

```python
# Adding to backend/rh_paie/services.py
from django.db.models import F
from .models import SalaireEnseignant


class SalaireEnseignantService:
    @staticmethod
    def create_salaire(enseignant, annee_scolaire, mois, date_paiement, montant, compte, mouvement, cree_par, affectation_enseignement=None):
        """Create a teacher salary record"""
        salaire = SalaireEnseignant.objects.create(
            enseignant=enseignant,
            annee_scolaire=annee_scolaire,
            mois=mois,
            date_paiement=date_paiement,
            montant=montant,
            compte=compte,
            mouvement=mouvement,
            cree_par=cree_par,
            affectation_enseignement=affectation_enseignement
        )
        return salaire
    
    @staticmethod
    def validate_salaire_enseignant_data(enseignant, annee_scolaire, mois):
        """Validate that data is coherent for salary calculation"""
        # Check if enseignant is actif
        if not enseignant.actif:
            raise ValidationError("L'enseignant doit être actif pour recevoir un salaire.")
        
        # Check if there's already a salaire for this period (uniqueness)
        if SalaireEnseignant.objects.filter(
            enseignant=enseignant,
            annee_scolaire=annee_scolaire,
            mois=mois
        ).exists():
            raise ValidationError("Un salaire existe déjà pour cet enseignant, cette période et ce mois.")
        
        return True
    
    @staticmethod
    def calculate_salaire_from_affectation(affectation):
        """Calculate salaire amount from affectation data"""
        # This would be used when generating salaire from affectation
        return affectation.montant_prevu
    
    @staticmethod
    def get_salaires_for_enseignant(enseignant, annee_scolaire=None):
        """Get all salaries for an enseignant"""
        queryset = SalaireEnseignant.objects.filter(enseignant=enseignant)
        if annee_scolaire:
            queryset = queryset.filter(annee_scolaire=annee_scolaire)
        return queryset.order_by('-date_paiement')
    
    @staticmethod
    def get_masse_salariale_for_period(annee_scolaire, mois):
        """Calculate total masse salariale for a period"""
        from django.db.models import Sum
        total = SalaireEnseignant.objects.filter(
            annee_scolaire=annee_scolaire,
            mois=mois
        ).aggregate(total=Sum('montant'))['total'] or 0
        return total
```

- [ ] **Step 2: Create unit tests for service**

Add to: `backend/rh_paie/tests/test_services.py`
```python
from rh_paie.models import SalaireEnseignant
from rh_paie.services import SalaireEnseignantService
from tresorerie.models import Compte, Mouvement
from comptes.models import Utilisateur


class SalaireEnseignantServiceTest(TestCase):
    def setUp(self):
        # Create dependencies
        from rh_paie.models import Enseignant, AnneeScolaire
        from referentiel.models import Ecole, Matiere, Classe
        from scolarite.models import AnneeScolaire as ScolAnneeScolaire  # Avoid conflict
        
        self.ecole = Ecole.objects.create(nom="Ecole Test")
        self.matiere = Matiere.objects.create(nom="Mathématiques")
        self.classe = Classe.objects.create(nom="6A", ecole=self.ecole)
        self.annee_scolaire = ScolAnneeScolaire.objects.create(
            annee_scolaire="2025-2026",
            date_debut="2025-09-01",
            date_fin="2026-06-30"
        )
        self.enseignant = Enseignant.objects.create(
            nom="DURAND",
            prenom="Paul",
            email="paul.durand@example.com",
            taux_horaire=8000
        )
        
        # Create affectation for testing
        self.affectation = AffectationEnseignement.objects.create(
            enseignant=self.enseignant,
            matiere=self.matiere,
            classe=self.classe,
            annee_scolaire=self.annee_scolaire,
            volume_horaire_prevu=45,
            taux_horaire=8000
        )
        
        # Create trésorerie dependencies
        self.compte = Compte.objects.create(
            nom="Compte Banque",
            code="BANQUE",
            solde=0
        )
        from tresorerie.models import CategoriaMouvement
        self.categorie = CategoriaMouvement.objects.create(
            code="SALAIRE_ENSEIGNANT",
            libelle="Salaire Enseignant"
        )
        self.mouvement = Mouvement.objects.create(
            compte_id=self.compte,
            date_operation="2025-11-30",
            sens="DEBIT",
            montant=360000,
            categorie_mouvement_id=self.categorie,
            ecole_id=self.ecole,
            annee_scolaire_id=self.annee_scolaire,
            cree_par_id=1  # Assuming admin user exists
        )
        
        self.utilisateur = Utilisateur.objects.create(
            username="admin",
            email="admin@example.com",
            is_staff=True
        )
        
        self.salaire_data = {
            'enseignant': self.enseignant,
            'annee_scolaire': self.annee_scolaire,
            'mois': 'NOV',
            'date_paiement': '2025-11-30',
            'montant': 360000,
            'compte': self.compte,
            'mouvement': self.mouvement,
            'cree_par': self.utilisateur,
            'affectation_enseignement': self.affectation
        }
    
    def test_create_salaire_success(self):
        salaire = SalaireEnseignantService.create_salaire(**self.salaire_data)
        self.assertEqual(salaire.montant, 360000)
        self.assertEqual(salaire.enseignant, self.enseignant)
    
    def test_validate_salaire_enseignant_data_success(self):
        # Should not raise exception
        SalaireEnseignantService.validate_salaire_enseignant_data(
            self.enseignant, self.annee_scolaire, 'NOV'
        )
    
    def test_validate_salaire_enseignant_data_inactif_enseignant(self):
        self.enseignant.actif = False
        self.enseignant.save()
        with self.assertRaises(ValidationError):
            SalaireEnseignantService.validate_salaire_enseignant_data(
                self.enseignant, self.annee_scolaire, 'NOV'
            )
    
    def test_calculate_salaire_from_affectation(self):
        calculated = SalaireEnseignantService.calculate_salaire_from_affectation(self.affectation)
        self.assertEqual(calculated, 360000)  # 45 * 8000
    
    def test_get_masse_salariale_for_period(self):
        SalaireEnseignantService.create_salaire(**self.salaire_data)
        masse = SalaireEnseignantService.get_masse_salariale_for_period(self.annee_scolaire, 'NOV')
        self.assertEqual(masse, 360000)
```

- [ ] **Step 3: Run tests to verify**

Run: `python manage.py test rh_paie.tests.test_services.SalaireEnseignantServiceTest`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add backend/rh_paie/services.py backend/rh_paie/tests/test_services.py
git commit -m "feat(rh-paie): implement SalaireEnseignant service with tests"
```

### Task 14: Create service for SalaireAdministration operations

**Files:**
- Modify: `backend/rh_paie/services.py`

**Interfaces:**
- Consumes: SalaireAdministration model
- Produces: Operations for admin salary calculation and validation

- [ ] **Step 1: Add SalaireAdministration service methods**

```python
# Adding to backend/rh_paie/services.py
from .models import SalaireAdministration


class SalaireAdministrationService:
    @staticmethod
    def create_salaire(personnel_administratif, annee_scolaire, mois, date_paiement, montant_du, montant_paye, compte, mouvement, cree_par):
        """Create an admin salary record"""
        salaire = SalaireAdministration.objects.create(
            personnel_administratif=personnel_administratif,
            annee_scolaire=annee_scolaire,
            mois=mois,
            date_paiement=date_paiement,
            montant_du=montant_du,
            montant_paye=montant_paye,
            compte=compte,
            mouvement=mouvement,
            cree_par=cree_par
        )
        return salaire
    
    @staticmethod
    def validate_salaire_admin_data(personnel_administratif, annee_scolaire, mois):
        """Validate that data is coherent for salary calculation"""
        # Check if personnel is actif
        if not personnel_administratif.actif:
            raise ValidationError("Le personnel administratif doit être actif pour recevoir un salaire.")
        
        # Check if there's already a salaire for this period (uniqueness)
        if SalaireAdministration.objects.filter(
            personnel_administratif=personnel_administratif,
            annee_scolaire=annee_scolaire,
            mois=mois
        ).exists():
            raise ValidationError("Un salaire existe déjà pour ce personnel, cette période et ce mois.")
        
        # Check that montant_paye <= montant_du
        if montant_paye > montant_du:
            raise ValidationError("Le montant payé ne peut pas dépasser le montant dû.")
        
        return True
    
    @staticmethod
    def get_salaires_for_personnel(personnel_administratif, annee_scolaire=None):
        """Get all salaries for a personnel administratif"""
        queryset = SalaireAdministration.objects.filter(personnel_administratif=personnel_administratif)
        if annee_scolaire:
            queryset = queryset.filter(annee_scolaire=annee_scolaire)
        return queryset.order_by('-date_paiement')
    
    @staticmethod
    def get_masse_salariale_for_period(annee_scolaire, mois, montant_type='net'):
        """Calculate total masse salariale for a period"""
        from django.db.models import Sum
        field = 'montant_paye' if montant_type == 'net' else 'montant_du'
        total = SalaireAdministration.objects.filter(
            annee_scolaire=annee_scolaire,
            mois=mois
        ).aggregate(total=Sum(field))['total'] or 0
        return total
```

- [ ] **Step 2: Create unit tests for service**

Add to: `backend/rh_paie/tests/test_services.py`
```python
from rh_paie.models import SalaireAdministration
from rh_paie.services import SalaireAdministrationService


class SalaireAdministrationServiceTest(TestCase):
    def setUp(self):
        # Create dependencies
        from rh_paie.models import PersonnelAdministratif, AnneeScolaire
        from referentiel.models import Ecole
        from tresorerie.models import Compte, Mouvement, CategoriaMouvement
        from comptes.models import Utilisateur
        
        self.ecole = Ecole.objects.create(nom="Ecole Test")
        self.annee_scolaire = AnneeScolaire.objects.create(
            annee_scolaire="2025-2026",
            date_debut="2025-09-01",
            date_fin="2026-06-30"
        )
        self.personnel = PersonnelAdministratif.objects.create(
            nom="MOREAU",
            prenom="Sophie",
            poste="Directrice",
            ecole=self.ecole,
            email="sophie.moreau@example.com",
            salaire_base=400000
        )
        
        # Create trésorerie dependencies
        self.compte = Compte.objects.create(
            nom="Compte Banque",
            code="BANQUE",
            solde=0
        )
        self.categorie = CategoriaMouvement.objects.create(
            code="SALAIRE_ADMIN",
            libelle="Salaire Administratif"
        )
        self.mouvement = Mouvement.objects.create(
            compte_id=self.compte,
            date_operation="2025-11-30",
            sens="DEBIT",
            montant=100000,
            categorie_mouvement_id=self.categorie,
            annee_scolaire_id=self.annee_scolaire,
            cree_par_id=1
        )
        
        self.utilisateur = Utilisateur.objects.create(
            username="admin",
            email="admin@example.com",
            is_staff=True
        )
        
        self.salaire_data = {
            'personnel_administratif': self.personnel,
            'annee_scolaire': self.annee_scolaire,
            'mois': 'NOV',
            'date_paiement': '2025-11-30',
            'montant_du': 100000,
            'montant_paye': 100000,
            'compte': self.compte,
            'mouvement': self.mouvement,
            'cree_par': self.utilisateur
        }
    
    def test_create_salaire_success(self):
        salaire = SalaireAdministrationService.create_salaire(**self.salaire_data)
        self.assertEqual(salaire.montant_paye, 100000)
        self.assertEqual(salaire.personnel_administratif, self.personnel)
    
    def test_validate_salaire_admin_data_success(self):
        # Should not raise exception
        SalaireAdministrationService.validate_salaire_admin_data(
            self.personnel, self.annee_scolaire, 'NOV'
        )
    
    def test_validate_salaire_admin_data_inactif_personnel(self):
        self.personnel.actif = False
        self.personnel.save()
        with self.assertRaises(ValidationError):
            SalaireAdministrationService.validate_salaire_admin_data(
                self.personnel, self.annee_scolaire, 'NOV'
            )
    
    def test_validate_salaire_admin_data_paye_sup_du(self):
        data = self.salaire_data.copy()
        data['montant_paye'] = 150000  # More than montant_du
        with self.assertRaises(ValidationError):
            SalaireAdministrationService.create_salaire(**data)
    
    def test_get_masse_salariale_for_period(self):
        SalaireAdministrationService.create_salaire(**self.salaire_data)
        masse_brute = SalaireAdministrationService.get_masse_salariale_for_period(
            self.annee_scolaire, 'NOV', 'brute'
        )
        masse_nette = SalaireAdministrationService.get_masse_salariale_for_period(
            self.annee_scolaire, 'NOV', 'nette'
        )
        self.assertEqual(masse_brute, 100000)
        self.assertEqual(masse_nette, 100000)
```

- [ ] **Step 3: Run tests to verify**

Run: `python manage.py test rh_paie.tests.test_services.SalaireAdministrationServiceTest`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add backend/rh_paie/services.py backend/rh_paie/tests/test_services.py
git commit -m "feat(rh-paie): implement SalaireAdministration service with tests"
```

### Task 15: Create service for AvancePersonnel operations

**Files:**
- Modify: `backend/rh_paie/services.py`

**Interfaces:**
- Consumes: AvancePersonnel model
- Produces: Operations for salary advance management with business rules

- [ ] **Step 1: Add AvancePersonnel service methods**

```python
# Adding to backend/rh_paie/services.py
from decimal import Decimal
from .models import AvancePersonnel


class AvancePersonnelService:
    # These would be loaded from settings or database in real implementation
    AVANCE_PLAFOND_RATIO = Decimal('0.3')  # 30% of salaire by default
    AVANCE_PLAFOND_FIXE = None  # Fixed amount if set
    
    @staticmethod
    def create_avance(beneficiaire_type, date, montant, compte, mouvement, cree_par, 
                      enseignant=None, personnel_administratif=None, motif=None):
        """Create a salary advance with validation"""
        # Validate beneficiaire coherence
        if beneficiaire_type == 'ENSEIGNANT':
            if not enseignant:
                raise ValidationError("Un enseignant doit être spécifié pour une avance enseignant.")
            if personnel_administratif:
                raise ValidationError("Un personnel administratif ne doit pas être spécifié pour une avance enseignant.")
        elif beneficiaire_type == 'ADMIN':
            if not personnel_administratif:
                raise ValidationError("Un personnel administratif doit être spécifié pour une avance administratif.")
            if enseignant:
                raise ValidationError("Un enseignant ne doit pas être spécifié pour une avance administratif.")
        
        # Check plafond if applicable
        plafond = AvancePersonnelService._get_avance_plafond(enseignant, personnel_administratif)
        if plafond and montant > plafond:
            raise ValidationError(f"Le montant de l'avance dépasse le plafond autorisé de {plafond} FCFA.")
        
        # Check solde restant for remboursement capacity (simplified)
        solde_restant = AvancePersonnelService.get_solde_restant(enseignant, personnel_administratif)
        if solde_restant is not None and montant > solde_restant:
            raise ValidationError(f"Le montant de l'avance dépasse le solde restant autorisé de {solde_restant} FCFA.")
        
        avance = AvancePersonnel.objects.create(
            beneficiaire=beneficiaire_type,
            enseignant=enseignant,
            personnel_administratif=personnel_administratif,
            date=date,
            montant=montant,
            motif=motif,
            compte=compte,
            mouvement=mouvement,
            cree_par=cree_par
        )
        return avance
    
    @staticmethod
    def _get_avance_plafond(enseignant=None, personnel_administratif=None):
        """Calculate the advance plafond based on business rules"""
        # This would integrate with salary data to calculate based on ratio or fixed amount
        # For now, return None (no plafond) or implement based on D5 decision
        return None  # Placeholder - would be implemented based on actual business rule
    
    @staticmethod
    def get_solde_restant(enseignant=None, personnel_administratif=None):
        """Calculate remaining balance for advance reimbursement"""
        # Solde = total versements - total remboursements
        versements = AvancePersonnel.objects.filter(
            beneficiaire='ENSEIGNANT' if enseignant else 'ADMIN',
            enseignant=enseignant,
            personnel_administratif=personnel_administratif
        ).aggregate(total=models.Sum('montant'))['total'] or 0
        
        # Remboursements would come from salaire advances imputed or manual remboursements
        # This is simplified - would need to integrate with salaire models
        remboursements = 0  # Placeholder
        
        solde = versements - remboursements
        return max(solde, 0)  # Never negative
    
    @staticmethod
    def regulariser_avance(avance, salaire_admin):
        """Mark an advance as regularized against a salary"""
        if avance.regularisee:
            raise ValidationError("Cette avance est déjà régulée.")
        
        if avance.beneficiaire != 'ADMIN':
            raise ValidationError("Seules les avances aux personnels administratifs peuvent être régulées de cette manière.")
        
        avance.regularise_salaire_admin = salaire_admin
        avance.regularisee = True
        avance.save()
        return avance
    
    @staticmethod
    def get_avances_for_beneficiaire(enseignant=None, personnel_administratif=None):
        """Get all advances for a beneficiaire"""
        queryset = AvancePersonnel.objects.all()
        if enseignant:
            queryset = queryset.filter(enseignant=enseignant)
        elif personnel_administratif:
            queryset = queryset.filter(personnel_administratif=personnel_administratif)
        return queryset.order_by('-date')
```

- [ ] **Step 2: Create unit tests for service**

Add to: `backend/rh_paie/tests/test_services.py`
```python
from rh_paie.models import AvancePersonnel
from rh_paie.services import AvancePersonnelService


class AvancePersonnelServiceTest(TestCase):
    def setUp(self):
        # Create dependencies
        from rh_paie.models import Enseignant, PersonnelAdministratif
        from referentiel.models import Ecole
        from tresorerie.models import Compte, Mouvement
        from comptes.models import Utilisateur
        
        self.ecole = Ecole.objects.create(nom="Ecole Test")
        self.enseignant = Enseignant.objects.create(
            nom="LEROY",
            prenom="Jacques",
            email="jacques.leroy@example.com"
        )
        self.personnel = PersonnelAdministratif.objects.create(
            nom="BERNARD",
            prenom="Marie",
            poste="Secrétaire",
            ecole=self.ecole,
            email="marie.bernard@example.com",
            salaire_base=250000
        )
        
        # Create trésorerie dependencies
        self.compte = Compte.objects.create(
            nom="Compte Caisse",
            code="CAISSE",
            solde=0
        )
        self.mouvement = Mouvement.objects.create(
            compte_id=self.compte,
            date_operation="2025-11-10",
            sens="DEBIT",
            montant=20000,
            categorie_mouvement_id=1,  # Assuming AVANCE category exists
            annee_scolaire_id=1,
            cree_par_id=1
        )
        
        self.utilisateur = Utilisateur.objects.create(
            username="directeur",
            email="directeur@example.com",
            is_staff=True
        )
        
        self.avance_data_ens = {
            'beneficiaire_type': 'ENSEIGNANT',
            'date': '2025-11-10',
            'montant': 20000,
            'compte': self.compte,
            'mouvement': self.mouvement,
            'cree_par': self.utilisateur,
            'enseignant': self.enseignant,
            'motif': 'Avance sur salaire novembre'
        }
        
        self.avance_data_admin = {
            'beneficiaire_type': 'ADMIN',
            'date': '2025-11-10',
            'montant': 15000,
            'compte': self.compte,
            'mouvement': self.mouvement,
            'cree_par': self.utilisateur,
            'personnel_administratif': self.personnel,
            'motif': 'Avance sur salaire novembre'
        }
    
    def test_create_avance_enseignant_success(self):
        avance = AvancePersonnelService.create_avance(**self.avance_data_ens)
        self.assertEqual(avance.montant, 20000)
        self.assertEqual(avance.beneficiaire, 'ENSEIGNANT')
        self.assertEqual(avance.enseignant, self.enseignant)
    
    def test_create_avance_admin_success(self):
        avance = AvancePersonnelService.create_avance(**self.avance_data_admin)
        self.assertEqual(avance.montant, 15000)
        self.assertEqual(avance.beneficiaire, 'ADMIN')
        self.assertEqual(avance.personnel_administratif, self.personnel)
    
    def test_create_avance_enseignant_missing_enseignant(self):
        data = self.avance_data_ens.copy()
        del data['enseignant']
        with self.assertRaises(ValidationError):
            AvancePersonnelService.create_avance(**data)
    
    def test_create_avance_admin_missing_personnel(self):
        data = self.avance_data_admin.copy()
        del data['personnel_administratif']
        with self.assertRaises(ValidationError):
            AvancePersonnelService.create_avance(**data)
    
    def test_regulariser_avance_success(self):
        avance = AvancePersonnelService.create_avance(**self.avance_data_admin)
        from rh_paie.models import SalaireAdministration
        # Create a salaire to regularize against
        salaire = SalaireAdministration.objects.create(
            personnel_administratif=self.personnel,
            annee_scolaire_id=1,
            mois='NOV',
            date_paiement='2025-11-30',
            montant_du=100000,
            montant_paye=100000,
            compte_id=self.compte.id,
            mouvement_id=2,  # Different mouvement
            cree_par_id=self.utilisateur.id
        )
        régulière = AvancePersonnelService.regulariser_avance(avance, salaire)
        self.assertTrue(régulière.regularisee)
        self.assertEqual(régulière.regularise_salaire_admin, salaire)
    
    def test_get_avances_for_beneficiaire(self):
        AvancePersonnelService.create_avance(**self.avance_data_ens)
        avances = AvancePersonnelService.get_avances_for_beneficiaire(enseignant=self.enseignant)
        self.assertEqual(avances.count(), 1)
```

- [ ] **Step 3: Run tests to verify**

Run: `python manage.py test rh_paie.tests.test_services.AvancePersonnelServiceTest`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add backend/rh_paie/services.py backend/rh_paie/tests/test_services.py
git commit -m "feat(rh-paie): implement AvancePersonnel service with tests"
```

### Task 17: Integrate with trésorerie service for financial movements

**Files:**
- Modify: `backend/rh_paie/services.py` to use trésorerie services
- Create: `backend/rh_paie/tresorerie_integration.py`

**Interfaces:**
- Consumes: RhPaiemodels, trésorerie services
- Produces: Integrated financial operations with proper mouvement creation

- [ ] **Step 1: Create trésorerie integration module**

```bash
mkdir -p backend/rh_paie/tresorerie_integration
touch backend/rh_paie/tresorerie_integration/__init__.py
```

```python
# backend/rh_paie/tresorerie_integration.py
from django.db import transaction
from .models import SalaireEnseignant, SalaireAdministration, AvancePersonnel
from tresorerie.services import MouvementService  # Assuming this exists
from tresorerie.models import Compte, CategoriaMouvement


class TresorerieIntegrationService:
    @staticmethod
    def create_mouvement_for_salaire_enseignant(salaire_data, utilisateur):
        """Create a mouvement for teacher salaire and link it"""
        with transaction.atomic():
            # Get or create appropriate compte and categorie
            compte = Compte.objects.get(code='BANQUE')  # Or determine based on rules
            categorie = CategoriaMouvement.objects.get(code='SALAIRE_ENSEIGNANT')
            
            # Create mouvement
            mouvement = MouvementService.create_mouvement(
                compte_id=compte.id,
                date_operation=salaire_data['date_paiement'],
                sens='DEBIT',
                montant=salaire_data['montant'],
                categorie_mouvement_id=categorie.id,
                libelle=f"Salaire {salaire_data['enseignant'].nom} {salaire_data['enseignant'].prenom} {salaire_data['mois']} {salaire_data['annee_scolaire']}",
                ecole_id=salaire_data.get('ecole_id'),  # Would need to determine from affectation
                annee_scolaire_id=salaire_data['annee_scolaire'].id,
                cree_par=utilisateur
            )
            
            # Link mouvement to salaire
            salaire_data['mouvement'] = mouvement
            salaire = SalaireEnseignant.objects.create(**salaire_data)
            
            return salaire, mouvement
    
    @staticmethod
    def create_mouvement_for_salaire_admin(salaire_data, utilisateur):
        """Create a mouvement for admin salaire and link it"""
        with transaction.atomic():
            compte = Compte.objects.get(code='BANQUE')
            categorie = CategoriaMouvement.objects.get(code='SALAIRE_ADMIN')
            
            mouvement = MouvementService.create_mouvement(
                compte_id=compte.id,
                date_operation=salaire_data['date_paiement'],
                sens='DEBIT',
                montant=salaire_data['montant_paye'],  # Or montant_du based on rules
                categorie_mouvement_id=categorie.id,
                libelle=f"Salaire {salaire_data['personnel_administratif'].nom} {salaire_data['personnel_administratif'].prenom} {salaire_data['mois']} {salaire_data['annee_scolaire']}",
                ecole_id=salaire_data.get('ecole_id'),
                annee_scolaire_id=salaire_data['annee_scolaire'].id,
                cree_par=utilisateur
            )
            
            salaire_data['mouvement'] = mouvement
            salaire = SalaireAdministration.objects.create(**salaire_data)
            
            return salaire, mouvement
    
    @staticmethod
    def create_mouvement_for_avance(avance_data, utilisateur):
        """Create a mouvement for avance and link it"""
        with transaction.atomic():
            # Determine compte based on rules (caisse vs banque)
            compte = Compte.objects.get(code='CAISSE')  # Simplified
            # Determine categorie based on beneficiaire type
            if avance_data['beneficiaire'] == 'ENSEIGNANT':
                categorie_code = 'AVANCE_ENSEIGNANT'
            else:
                categorie_code = 'AVANCE_ADMIN'
            categorie = CategoriaMouvement.objects.get(code=categorie_code)
            
            mouvement = MouvementService.create_mouvement(
                compte_id=compte.id,
                date_operation=avance_data['date'],
                sens='DEBIT',
                montant=avance_data['montant'],
                categorie_mouvement_id=categorie.id,
                libelle=f"Avance {avance_data['beneficiaire']} {avance_data.get('enseignant', avance_data.get('personnel_administratif')).nom} {avance_data.get('enseignant', avance_data.get('personnel_administratif')).prenom} {avance_data['date']}",
                ecole_id=avance_data.get('ecole_id'),
                annee_scolaire_id=avance_data.get('annee_scolaire_id'),
                cree_par=utilisateur
            )
            
            avance_data['mouvement'] = mouvement
            avance = AvancePersonnel.objects.create(**avance_data)
            
            return avance, mouvement
```

- [ ] **Step 2: Update service methods to use trésorerie integration**

Modify the service create methods to use this integration instead of creating mouvements directly.

- [ ] **Step 3: Create unit tests for trésorerie integration**

Create: `backend/rh_paie/tests/test_tresorerie_integration.py`
```python
from django.test import TestCase
from rh_paie.tresorerie_integration import TresorerieIntegrationService
from rh_paie.models import Enseignant, PersonnelAdministratif, AvancePersonnel
from tresorerie.models import Compte, Mouvement, CategoriaMouvement
from comptes.models import Utilisateur


class TresorerieIntegrationServiceTest(TestCase):
    def setUp(self):
        # Create dependencies
        self.utilisateur = Utilisateur.objects.create(
            username="comptable",
            email="comptable@example.com",
            is_staff=True
        )
        
        # Create trésorerie dependencies
        self.compte_banque = Compte.objects.create(
            nom="Compte Banque",
            code="BANQUE",
            solde=0
        )
        self.compte_caisse = Compte.objects.create(
            nom="Compte Caisse",
            code="CAISSE",
            solde=0
        )
        self.categorie_salaire_ens = CategoriaMouvement.objects.create(
            code="SALAIRE_ENSEIGNANT",
            libelle="Salaire Enseignant"
        )
        self.categorie_salaire_admin = CategoriaMouvement.objects.create(
            code="SALAIRE_ADMIN",
            libelle="Salaire Administratif"
        )
        self.categorie_avance = CategoriaMouvement.objects.create(
            code="AVANCE_ENSEIGNANT",
            libelle="Avance Enseignant"
        )
        
        # Create rh_paie dependencies
        self.enseignant = Enseignant.objects.create(
            nom="TESTENS",
            prenom="Prof",
            email="test.ens@example.com"
        )
    
    def test_create_mouvement_for_salaire_enseignant(self):
        salaire_data = {
            'enseignant': self.enseignant,
            'annee_scolaire_id': 1,
            'mois': 'NOV',
            'date_paiement': '2025-11-30',
            'montant': 200000
        }
        
        salaire, mouvement = TresorerieIntegrationService.create_mouvement_for_salaire_enseignant(
            salaire_data, self.utilisateur
        )
        
        self.assertEqual(salaire.montant, 200000)
        self.assertEqual(mouvement.montant, 200000)
        self.assertEqual(mouvement.sens, 'DEBIT')
        self.assertEqual(mouvement.compte, self.compte_banque)
        self.assertEqual(mouvement.categorie_mouvement, self.categorie_salaire_ens)
        self.assertEqual(salaire.mouvement, mouvement)
    
    def test_create_mouvement_for_avance(self):
        avance_data = {
            'beneficiaire': 'ENSEIGNANT',
            'enseignant': self.enseignant,
            'date': '2025-11-10',
            'montant': 50000,
            'ecole_id': 1
        }
        
        avance, mouvement = TresorerieIntegrationService.create_mouvement_for_avance(
            avance_data, self.utilisateur
        )
        
        self.assertEqual(avance.montant, 50000)
        self.assertEqual(mouvement.montant, 50000)
        self.assertEqual(mouvement.sens, 'DEBIT')
        self.assertEqual(mouvement.compte, self.compte_caisse)
        self.assertEqual(mouvement.categorie_mouvement, self.categorie_avance)
        self.assertEqual(avance.mouvement, mouvement)
```

- [ ] **Step 4: Run tests to verify**

Run: `python manage.py test rh_paie.tests.test_tresorerie_integration.TresorerieIntegrationServiceTest`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add backend/rh_paie/tresorerie_integration/ backend/rh_paie/tests/test_tresorerie_integration.py
git commit -m "feat(rh-paie): implement trésorerie integration service"
```

## Phase 4: API Endpoints and Serializers

### Task 18: Create serializers for RH & Paie models

**Files:**
- Create: `backend/rh_paie/serializers.py`

**Interfaces:**
- Consumes: RhPaiemodels
- Produces: DRF serializers for API endpoints

- [ ] **Step 1: Create serializers module**

```bash
touch backend/rh_paie/serializers.py
```

```python
# backend/rh_paie/serializers.py
from rest_framework import serializers
from .models import Enseignant, PersonnelAdministratif, AffectationEnseignement
from .models import SalaireEnseignant, SalaireAdministration, AvancePersonnel


class EnseignantSerializer(serializers.ModelSerializer):
    nom_complet = serializers.SerializerMethodField()
    
    class Meta:
        model = Enseignant
        fields = ['id', 'nom', 'prenom', 'nom_complet', 'telephone', 'email', 
                 'specialite', 'statut', 'taux_horaire', 'actif']
        read_only_fields = ['id']
    
    def get_nom_complet(self, obj):
        return f"{obj.nom} {obj.prenom}"


class PersonnelAdministratifSerializer(serializers.ModelSerializer):
    nom_complet = serializers.SerializerMethodField()
    
    class Meta:
        model = PersonnelAdministratif
        fields = ['id', 'nom', 'prenom', 'nom_complet', 'poste', 'ecole', 
                 'telephone', 'email', 'salaire_base', 'date_embauche', 'actif']
        read_only_fields = ['id']
    
    def get_nom_complet(self, obj):
        return f"{obj.nom} {obj.prenom}"


class AffectationEnseignementSerializer(serializers.ModelSerializer):
    montant_prevu = serializers.ReadOnlyField()
    enseignant_nom = serializers.CharField(source='enseignant.nom_complet', read_only=True)
    matiere_nom = serializers.CharField(source='matiere.nom', read_only=True)
    classe_nom = serializers.CharField(source='classe.nom', read_only=True)
    
    class Meta:
        model = AffectationEnseignement
        fields = ['id', 'enseignant', 'enseignant_nom', 'matiere', 'matiere_nom', 
                 'classe', 'classe_nom', 'annee_scolaire', 'volume_horaire_prevu', 
                 'taux_horaire', 'montant_prevu']
        read_only_fields = ['id', 'montant_prevu']


class SalaireEnseignantSerializer(serializers.ModelSerializer):
    enseignant_nom = serializers.CharField(source='enseignant.nom_complet', read_only=True)
    mois_affichage = serializers.SerializerMethodField()
    
    class Meta:
        model = SalaireEnseignant
        fields = ['id', 'enseignant', 'enseignant_nom', 'affectation_enseignement', 
                 'annee_scolaire', 'mois', 'mois_affichage', 'date_paiement', 
                 'montant', 'compte', 'mouvement']
        read_only_fields = ['id']
    
    def get_mois_affichage(self, obj):
        return obj.get_mois_display()


class SalaireAdministrationSerializer(serializers.ModelSerializer):
    personnel_nom = serializers.CharField(source='personnel_administratif.nom_complet', read_only=True)
    mois_affichage = serializers.SerializerMethodField()
    
    class Meta:
        model = SalaireAdministration
        fields = ['id', 'personnel_administratif', 'personnel_nom', 'annee_scolaire', 
                 'mois', 'mois_affichage', 'date_paiement', 'montant_du', 'montant_paye', 
                 'compte', 'mouvement']
        read_only_fields = ['id']
    
    def get_mois_affichage(self, obj):
        return obj.get_mois_display()


class AvancePersonnelSerializer(serializers.ModelSerializer):
    beneficiaire_affichage = serializers.SerializerMethodField()
    nom_beneficiaire = serializers.SerializerMethodField()
    mois_affichage = serializers.SerializerMethodField()
    
    class Meta:
        model = AvancePersonnel
        fields = ['id', 'beneficiaire', 'beneficiaire_affichage', 'enseignant', 
                 'personnel_administratif', 'nom_beneficiaire', 'date', 'montant', 
                 'motif', 'compte', 'mouvement', 'regularisee', 'regularise_salaire_admin']
        read_only_fields = ['id']
    
    def get_beneficiaire_affichage(self, obj):
        return obj.get_beneficiaire_display()
    
    def get_nom_beneficiaire(self, obj):
        if obj.beneficiaire == 'ENSEIGNANT' and obj.enseignant:
            return f"{obj.enseignant.nom} {obj.enseignant.prenom}"
        elif obj.beneficiaire == 'ADMIN' and obj.personnel_administratif:
            return f"{obj.personnel_administratif.nom} {obj.personnel_administratif.prenom}"
        return ""
    
    def get_mois_affichage(self, obj):
        # For avance, we might want to show the month of the date
        return obj.date.strftime('%B') if obj.date else ""
```

- [ ] **Step 2: Create unit tests for serializers**

Create: `backend/rh_paie/tests/test_serializers.py`
```python
from django.test import TestCase
from rh_paie.serializers import *
from rh_paie.models import Enseignant, PersonnelAdministratif, AffectationEnseignement
from referentiel.models import Ecole, Matiere, Classe
from scolarite.models import AnneeScolaire
from tresorerie.models import Compte, Mouvement
from comptes.models import Utilisateur


class EnseignantSerializerTest(TestCase):
    def setUp(self):
        self.enseignant = Enseignant.objects.create(
            nom="DURAND",
            prenom="Sophie",
            email="sophie.durand@example.com",
            taux_horaire=7000
        )
    
    test_serializer_contains_expected_fields(self):
        serializer = EnseignantSerializer(self.enseignant)
        data = serializer.data
        self.assertEqual(set(data.keys()), {
            'id', 'nom', 'prenom', 'nom_complet', 'telephone', 'email', 
            'specialite', 'statut', 'taux_horaire', 'actif'
        })
    
    def test_nom_complet_field(self):
        serializer = EnseignantSerializer(self.enseignant)
        self.assertEqual(serializer.data['nom_complet'], 'DURAND Sophie')


class PersonnelAdministratifSerializerTest(TestCase):
    def setUp(self):
        self.ecole = Ecole.objects.create(nom="Ecole Test")
        self.personnel = PersonnelAdministratif.objects.create(
            nom="MOREAU",
            prenom="Luc",
            poste="Directeur",
            ecole=self.ecole,
            email="luc.moreau@example.com",
            salaire_base=350000
        )
    
    def test_nom_complet_field(self):
        serializer = PersonnelAdministratifSerializer(self.personnel)
        self.assertEqual(serializer.data['nom_complet'], 'MOREAU Luc')


class AffectationEnseignementSerializerTest(TestCase):
    def setUp(self):
        self.ecole = Ecole.objects.create(nom="Ecole Test")
        self.matiere = Matiere.objects.create(nom="Physique")
        self.classe = Classe.objects.create(nom="Terminale C", ecole=self.ecole)
        self.annee_scolaire = AnneeScolaire.objects.create(
            annee_scolaire="2025-2026",
            date_debut="2025-09-01",
            date_fin="2026-06-30"
        )
        self.enseignant = Enseignant.objects.create(
            nom="LEFEBVRE",
            prenom="Marc",
            email="marc.lefebvre@example.com",
            taux_horaire=8000
        )
        self.affectation = AffectationEnseignement.objects.create(
            enseignant=self.enseignant,
            matiere=self.matiere,
            classe=self.classe,
            annee_scolaire=self.annee_scolaire,
            volume_horaire_prevu=35,
            taux_horaire=8000
        )
    
    def test_montant_prevu_field(self):
        serializer = AffectationEnseignementSerializer(self.affectation)
        self.assertEqual(serializer.data['montant_prevu'], 280000)  # 35 * 8000
    
    def test_related_fields_display(self):
        serializer = AffectationEnseignementSerializer(self.affectation)
        self.assertEqual(serializer.data['enseignant_nom'], 'LEFEBVRE Marc')
        self.assertEqual(serializer.data['matiere_nom'], 'Physique')
        self.assertEqual(serializer.data['classe_nom'], 'Terminale C')


# Similar tests for other serializers would follow...
```

- [ ] **Step 3: Run tests to verify**

Run: `python manage.py test rh_paie.tests.test_serializers`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add backend/rh_paie/serializers.py backend/rh_paie/tests/test_serializers.py
git commit -m "feat(rh-paie): create serializers for API endpoints"
```

### Task 19: Create API views for RH & Paie endpoints

**Files:**
- Create: `backend/rh_paie/views.py`
- Modify: `backend/rh_paie/urls.py`
- Modify: `backend/config/urls.py` to include rh_paie URLs

**Interfaces:**
- Consumes: Serializers, services
- Produces: RESTful API endpoints for RH & Paie operations

- [ ] **Step 1: Create views module**

```bash
touch backend/rh_paie/views.py
```

```python
# backend/rh_paie/views.py
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import Enseignant, PersonnelAdministratif, AffectationEnseignement
from .models import SalaireEnseignant, SalaireAdministration, AvancePersonnel
from .serializers import *
from .services import *
from comptes.permissions import ARole, EcritureInterditeEnLecture  # Assuming these exist


class EnseignantViewSet(viewsets.ModelViewSet):
    queryset = Enseignant.objects.all()
    serializer_class = EnseignantSerializer
    permission_classes = [ARole(['RH', 'DAF', 'DIRECTION'])]  # Example
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['statut', 'actif', 'specialite']
    search_fields = ['nom', 'prenom', 'email']
    ordering_fields = ['nom', 'prenom']
    ordering = ['nom']
    
    @action(detail=False, methods=['get'])
    def actifs(self, request):
        """Get only actif enseignants"""
        actifs = self.get_queryset().filter(actif=True)
        serializer = self.get_serializer(actifs, many=True)
        return Response(serializer.data)


class PersonnelAdministratifViewSet(viewsets.ModelViewSet):
    queryset = PersonnelAdministratif.objects.all()
    serializer_class = PersonnelAdministratifSerializer
    permission_classes = [ARole(['RH', 'DAF', 'DIRECTION'])]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['poste', 'ecole', 'actif']
    search_fields = ['nom', 'prenom', 'email']
    ordering_fields = ['nom', 'prenom']
    ordering = ['nom']
    
    @action(detail=False, methods=['get'])
    def par_ecole(self, request):
        """Get personnel administratifs by ecole"""
        ecole_id = request.query_params.get('ecole_id')
        if ecole_id:
            personnel = self.get_queryset().filter(ecole_id=ecole_id)
            serializer = self.get_serializer(personnel, many=True)
            return Response(serializer.data)
        return Response({"error": "ecole_id parameter required"}, status=400)


class AffectationEnseignementViewSet(viewsets.ModelViewSet):
    queryset = AffectationEnseignement.objects.all()
    serializer_class = AffectationEnseignementSerializer
    permission_classes = [ARole(['RH', 'SCOLARITE'])]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['enseignant', 'matiere', 'classe', 'annee_scolaire']
    search_fields = ['enseignant__nom', 'enseignant__prenom', 'matiere__nom', 'classe__nom']
    ordering_fields = ['enseignant__nom', 'matiere__nom']
    ordering = ['enseignant__nom', 'matiere__nom']
    
    @action(detail=False, methods=['get'])
    def par_enseignant(self, request):
        """Get affectations for a specific enseignant"""
        enseignant_id = request.query_params.get('enseignant_id')
        if enseignant_id:
            affectations = self.get_queryset().filter(enseignant_id=enseignant_id)
            serializer = self.get_serializer(affectations, many=True)
            return Response(serializer.data)
        return Response({"error": "enseignant_id parameter required"}, status=400)


class SalaireEnseignantViewSet(viewsets.ModelViewSet):
    queryset = SalaireEnseignant.objects.all()
    serializer_class = SalaireEnseignantSerializer
    permission_classes = [ARole(['RH', 'TRESORIER', 'DAF', 'DIRECTION'])]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['enseignant', 'annee_scolaire', 'mois']
    search_fields = ['enseignant__nom', 'enseignant__prenom']
    ordering_fields = ['date_paiement', 'montant']
    ordering = ['-date_paiement']
    
    @action(detail=False, methods=['get'])
    def masse_salariale(self, request):
        """Get masse salariale for a period"""
        annee_scolaire_id = request.query_params.get('annee_scolaire_id')
        mois = request.query_params.get('mois')
        if annee_scolaire_id and mois:
            total = SalaireEnseignantService.get_masse_salariale_for_period(
                annee_scolaire_id, mois
            )
            return Response({'masse_salariale': total})
        return Response({"error": "annee_scolaire_id and mois parameters required"}, status=400)


class SalaireAdministrationViewSet(viewsets.ModelViewSet):
    queryset = SalaireAdministration.objects.all()
    serializer_class = SalaireAdministrationSerializer
    permission_classes = [ARole(['RH', 'TRESORIER', 'DAF', 'DIRECTION'])]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['personnel_administratif', 'annee_scolaire', 'mois']
    search_fields = ['personnel_administratif__nom', 'personnel_administratif__prenom']
    ordering_fields = ['date_paiement', 'montant_paye']
    ordering = ['-date_paiement']
    
    @action(detail=False, methods=['get'])
    def masse_salariale(self, request):
        """Get masse salariale for a period"""
        annee_scolaire_id = request.query_params.get('annee_scolaire_id')
        mois = request.query_params.get('mois')
        montant_type = request.query_params.get('montant_type', 'net')  # net or brute
        if annee_scolaire_id and mois:
            total = SalaireAdministrationService.get_masse_salariale_for_period(
                annee_scolaire_id, mois, montant_type
            )
            return Response({'masse_salariale': total})
        return Response({"error": "annee_scolaire_id and mois parameters required"}, status=400)


class AvancePersonnelViewSet(viewsets.ModelViewSet):
    queryset = AvancePersonnel.objects.all()
    serializer_class = AvancePersonnelSerializer
    permission_classes = [ARole(['RH', 'DAF', 'DIRECTION'])]  # Would need more specific rules
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['beneficiaire', 'enseignant', 'personnel_administratif', 'date']
    search_fields = ['enseignant__nom', 'enseignant__prenom', 
                    'personnel_administratif__nom', 'personnel_administratif__prenom']
    ordering_fields = ['date', 'montant']
    ordering = ['-date']
    
    @action(detail=True, methods=['post'])
    def regulariser(self, request, pk=None):
        """Mark an avance as regularized"""
        avance = self.get_object()
        salaire_admin_id = request.data.get('salaire_admin_id')
        if not salaire_admin_id:
            return Response({"error": "salaire_admin_id required"}, status=400)
        
        try:
            from rh_paie.models import SalaireAdministration
            salaire_admin = SalaireAdministration.objects.get(id=salaire_admin_id)
            régulière = AvancePersonnelService.regulariser_avance(avance, salaire_admin)
            serializer = self.get_serializer(régulière)
            return Response(serializer.data)
        except SalaireAdministration.DoesNotExist:
            return Response({"error": "Salaire administration not found"}, status=404)
        except ValidationError as e:
            return Response({"error": str(e)}, status=400)
    
    @action(detail=False, methods=['get'])
    def par_beneficiaire(self, request):
        """Get avances for a specific beneficiaire"""
        enseignant_id = request.query_params.get('enseignant_id')
        personnel_administratif_id = request.query_params.get('personnel_administratif_id')
        
        if enseignant_id:
            avances = self.get_queryset().filter(enseignant_id=enseignant_id)
        elif personnel_administratif_id:
            avances = self.get_queryset().filter(personnel_administratif_id=personnel_administratif_id)
        else:
            return Response({"error": "Either enseignant_id or personnel_administratif_id required"}, status=400)
        
        serializer = self.get_serializer(avances, many=True)
        return Response(serializer.data)
```

- [ ] **Step 2: Create urls module**

```bash
touch backend/rh_paie/urls.py
```

```python
# backend/rh_paie/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EnseignantViewSet, PersonnelAdministratifViewSet, AffectationEnseignementViewSet
from .views import SalaireEnseignantViewSet, SalaireAdministrationViewSet, AvancePersonnelViewSet

router = DefaultRouter()
router.register(r'enseignants', EnseignantViewSet)
router.register(r'personnels-administratifs', PersonnelAdministratifViewSet)
router.register(r'affectations-enseignement', AffectationEnseignementViewSet)
router.register(r'salaires-enseignants', SalaireEnseignantViewSet)
router.register(r'salaires-administration', SalaireAdministrationViewSet)
router.register(r'avances-personnel', AvancePersonnelViewSet)

urlpatterns = [
    path('api/v1/', include(router.urls)),
]
```

- [ ] **Step 3: Update main urls.py to include rh_paie URLs**

Modify: `backend/config/urls.py`
```python
# Add this to the urlpatterns list:
    path('rh-paie/', include('rh_paie.urls')),
```

- [ ] **Step 4: Create unit tests for views**

Create: `backend/rh_paie/tests/test_views.py`
```python
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from rh_paie.models import Enseignant, PersonnelAdministratif
from referentiel.models import Ecole
from comptes.models import Utilisateur


class EnseignantViewSetTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        # Create a user and force login for testing
        self.utilisateur = Utilisateur.objects.create_user(
            username='testuser',
            password='testpass123',
            email='test@example.com',
            is_staff=True
        )
        self.client.force_authenticate(user=self.utilisateur)
        
        # Create test data
        self.enseignant1 = Enseignant.objects.create(
            nom="DUPONT",
            prenom="Jean",
            email="jean.dupont@example.com",
            statut="PERMANENT"
        )
        self.enseignant2 = Enseignant.objects.create(
            nom="DURAND",
            prenom="Marie",
            email="marie.durand@example.com",
            statut="VACATAIRE",
            actif=False
        )
    
    def test_list_enseignants(self):
        url = reverse('enseignant-list')  # Assuming router generates this name
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)  # Both actif and inactif
    
    def test_filter_enseignants_by_statut(self):
        url = reverse('enseignant-list')
        response = self.client.get(url, {'statut': 'PERMANENT'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['nom'], 'DUPONT')
    
    def test_search_enseignants(self):
        url = reverse('enseignant-list')
        response = self.client.get(url, {'search': 'DURAND'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['nom'], 'DURAND')
    
    def test_actifs_action(self):
        url = reverse('enseignant-actifs')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)  # Only the actif one
        self.assertEqual(response.data[0]['nom'], 'DUPONT')


# Similar tests for other viewsets would follow...
```

- [ ] **Step 5: Run tests to verify**

Run: `python manage.py test rh_paie.tests.test_views`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add backend/rh_paie/views.py backend/rh_paie/urls.py backend/config/urls.py backend/rh_paie/tests/test_views.py
git commit -m "feat(rh-paie): create API views and endpoints"
```

## Phase 5: Frontend React Components

### Task 20: Create React components for Enseignant management

**Files:**
- Create: `frontend/src/rh_paie/components/EnseignantList.tsx`
- Create: `frontend/src/rh_paie/components/EnseignantForm.tsx`
- Create: `frontend/src/rh_paie/components/EnseignantDetail.tsx`
- Create: `frontend/src/rh_paie/hooks/useEnseignants.ts`
- Modify: `frontend/src/rh_paie/index.ts` (barrel export)

**Interfaces:**
- Consumes: RH & Paie API endpoints
- Produces: UI components for managing enseignants

- [ ] **Step 1: Create components directory**

```bash
mkdir -p frontend/src/rh_paie/components
mkdir -p frontend/src/rh_paie/hooks
touch frontend/src/rh_paie/index.ts
```

```typescript
// frontend/src/rh_paie/components/EnseignantList.tsx
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { enseignantService } from '@/services/rh-paie.service';
import { Button } from '@/components/ui/button';
import { Table } from '@/components/ui/table';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Plus } from 'lucide-react';

interface Enseignant {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  specialite?: string;
  statut: 'VACATAIRE' | 'PERMANENT';
  taux_horaire?: number;
  actif: boolean;
}

const EnseignantList: React.FC = () => {
  const { data: enseignants = [], isLoading, error } = useQuery<
    Enseignant[],
    Error
  >({
    queryKey: ['enseignants'],
    queryFn: () => enseignantService.getAll(),
  });

  const [selectedId, setSelectedId] = useState<number | null>(null);

  if (isLoading) return <div>Chargement...</div>;
  if (error) return <div>Erreur: {error.message}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Liste des enseignants</h2>
        <Button variant="outline" size="icon" asChild>
          <a href="/rh-paie/enseignants/new">
            <Plus className="mr-2 h-4 w-4" />Nouveau
          </a>
        </Button>
      </div>

      {enseignants.length === 0 ? (
        <p className="text-muted-foreground">Aucun enseignant trouvé.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Prénom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {enseignants.map((enseignant) => (
              <TableRow key={enseignant.id}>
                <TableCell>{enseignant.nom}</TableCell>
                <TableCell>{enseignant.prenom}</TableCell>
                <TableCell>{enseignant.email}</TableCell>
                <TableCell>
                  <span className={`px-2 inline-flex text-xs rounded-full ${
                    enseignant.statut === 'PERMANENT'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {enseignant.statut === 'PERMANENT' ? 'Permanent' : 'Vacataire'}
                  </span>
                </TableCell>
                <TableCell className="text-center space-x-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Dot3 className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelectedId(enseignant.id)}>
                        Détails
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => /* handle edit */}>
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => /* handle delete */}>
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

export default EnseignantList;
```

```typescript
// frontend/src/rh_paie/components/EnseignantForm.tsx
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
import { enseignantService } from '@/services/rh-paie.service';
import {
  Input,
  InputError,
  InputLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { Button } from '@/components/ui/button';
import { zonedTimeToUtc } from 'date-fns-tz';

const enseignantSchema = z.object({
  nom: z.string().min(2, 'Le nom est requis'),
  prenom: z.string().min(2, 'Le prénom est requis'),
  email: z.string().email('Email invalide'),
  telephone: z.string().optional(),
  specialite: z.string().optional(),
  statut: z.enum(['VACATAIRE', 'PERMANENT']),
  taux_horaire: z.number().nonnegative().optional(),
  actif: z.boolean().default(true),
});

type EnseignantFormValues = z.infer<typeof enseignantSchema>;

interface EnseignantFormProps {
  onSuccess?: () => void;
  initialData?: Partial<EnseignantFormValues>;
}

const EnseignantForm: React.FC<EnseignantFormProps> = ({
  onSuccess,
  initialData,
}) => {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<EnseignantFormValues>({
    resolver: zodResolver(enseignantSchema),
    defaultValues: initialData,
  });

  const onSubmit = async (data: EnseignantFormValues) => {
    try {
      await enseignantService.create(data);
      if (onSuccess) onSuccess();
      navigate(-1); // Go back
    } catch (error) {
      // Handle error - could show toast notification
      console.error('Error creating enseignant:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <InputLabel htmlFor="nom">Nom *</InputLabel>
          <Input
            id="nom"
            placeholder="Dupont"
            {...register('nom')}
          />
          {errors.nom && <InputError>{errors.nom.message}</InputError>}
        </div>

        <div>
          <InputLabel htmlFor="prenom">Prénom *</InputLabel>
          <Input
            id="prenom"
            placeholder="Jean"
            {...register('prenom')}
          />
          {errors.prenom && <InputError>{errors.prenom.message}</InputError>}
        </div>

        <div>
          <InputLabel htmlFor="email">Email *</InputLabel>
          <Input
            id="email"
            placeholder="jean.dupont@example.com"
            type="email"
            {...register('email')}
          />
          {errors.email && <InputError>{errors.email.message}</InputError>}
        </div>

        <div>
          <InputLabel htmlFor="telephone">Téléphone</InputLabel>
          <Input
            id="telephone"
            placeholder="06 12 34 56 78"
            {...register('telephone')}
          />
        </div>

        <div>
          <InputLabel htmlFor="specialite">Spécialité</InputLabel>
          <Input
            id="specialite"
            placeholder="Mathématiques"
            {...register('specialite')}
          />
        </div>

        <div>
          <InputLabel htmlFor="statut">Statut *</InputLabel>
          <Select
            onValueChange={(value) => reset({ statut: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="VACATAIRE">Vacataire</SelectItem>
              <SelectItem value="PERMANENT">Permanent</SelectItem>
            </SelectContent>
          </Select>
          {errors.statut && <InputError>{errors.statut.message}</InputError>}
        </div>

        <div>
          <InputLabel htmlFor="taux_horaire">Taux horaire</InputLabel>
          <Input
            id="taux_horaire"
            type="number"
            placeholder="8000"
            {...register('taux_horaire')}
          />
          {errors.taux_horaire && <InputError>{errors.taux_horaire.message}</InputError>}
        </div>

        <div className="md:col-span-2">
          <div className="flex items-center space-x-2">
            <input
              id="actif"
              type="checkbox"
              {...register('actif')}
            />
            <label htmlFor="actif" className="text-sm font-medium">
              Actif
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        <Button variant="outline" asChild>
          <a href="javascript:history.back()">Annuler</a>
        </Button>
        <Button type="submit">Enregistrer</Button>
      </div>
    </form>
  );
};

export default EnseignantForm;
```

```typescript
// frontend/src/rh_paie/hooks/useEnseignants.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { enseignantService } from '@/services/rh-paie.service';

export const useEnseignants = () => {
  const queryClient = useQueryClient();

  const {
    data: enseignants,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['enseignants'],
    queryFn: () => enseignantService.getAll(),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['enseignants'] });
  };

  return {
    enseignants: enseignants ?? [],
    isLoading,
    error,
    refetch,
    refresh,
  };
};

export const useEnseignant = (id: number) => {
  const {
    data: enseignant,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['enseignant', id],
    queryFn: () => enseignantService.getById(id),
    enabled: !!id,
  });

  return {
    enseignant,
    isLoading,
    error,
  };
};
```

- [ ] **Step 2: Create barrel export**

```typescript
// frontend/src/rh_paie/index.ts
export { default as EnseignantList } from './components/EnseignantList';
export { default as EnseignantForm } from './components/EnseignantForm';
export { useEnseignants, useEnseignant } from './hooks/useEnseignants';
```

- [ ] **Step 3: Create unit tests for components**

Create: `frontend/src/rh_paie/__tests__/EnseignantList.test.tsx`
```typescript
import { render, screen } from '@testing-library/react';
import EnseignantList from '../components/EnseignantList';

describe('EnseignantList', () => {
  const mockEnseignants = [
    {
      id: 1,
      nom: 'DUPONT',
      prenom: 'Jean',
      email: 'jean.dupont@example.com',
      statut: 'PERMANENT',
      actif: true,
    },
    {
      id: 2,
      nom: 'DURAND',
      prenom: 'Marie',
      email: 'marie.durand@example.com',
      statut: 'VACATAIRE',
      actif: false,
    },
  ];

  beforeEach(() => {
    // Mock the useQuery hook
    jest.spyOn(require('@tanstack/react-query'), 'useQuery').mockReturnValue({
      data: mockEnseignants,
      isLoading: false,
      error: null,
    } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('displays the list of enseignants', () => {
    render(<EnseignantList />);

    // Check that both enseignants are displayed
    expect(screen.getByText(/DUPONT/i)).toBeInTheDocument();
    expect(screen.getByText(/jean.dupont@example.com/i)).toBeInTheDocument();
    expect(screen.getByText(/DURAND/i)).toBeInTheDocument();
    expect(screen.getByText(/marie.durand@example.com/i)).toBeInTheDocument();

    // Check statut badges
    expect(screen.getByText(/Permanent/i)).toBeInTheDocument();
    expect(screen.getByText(/Vacataire/i)).toBeInTheDocument();
  });

  it('shows loading state when data is fetching', () => {
    jest.spyOn(require('@tanstack/react-query'), 'useQuery').mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    render(<EnseignantList />);
    expect(screen.getByText(/Chargement/i)).toBeInTheDocument();
  });

  it('shows error state when request fails', () => {
    jest.spyOn(require('@tanstack/react-query'), 'useQuery').mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to fetch'),
    } as any);

    render(<EnseignantList />);
    expect(screen.getByText(/Erreur/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run tests to verify**

Run: `npm test -- src/rh_paie/__tests__/EnseignantList.test.tsx`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add frontend/src/rh_paie/ frontend/src/rh_paie/__tests__/
git commit -m "feat(rh-paie): create React components for Enseignant management"
```

### Task 21: Create React components for PersonnelAdministratif management

**Files:**
- Create: `frontend/src/rh_paie/components/PersonnelAdministratifList.tsx`
- Create: `frontend/src/rh_paie/components/PersonnelAdministratifForm.tsx`
- Create: `frontend/src/rh_paie/hooks/usePersonnelsAdministratifs.ts`
- Update: `frontend/src/rh_paie/index.ts`

**Interfaces:**
- Consumes: RH & Paie API endpoints for personnel administratif
- Produces: UI components for managing personnels administratifs

- [ ] **Step 1: Create components** (similar pattern to Enseignant components)
- [ ] **Step 2: Create hooks** 
- [ ] **Step 3: Update barrel exports**
- [ ] **Step 4: Create unit tests**
- [ ] **Step 5: Run tests**
- [ ] **Step 6: Commit**

```bash
git add frontend/src/rh_paie/components/PersonnelAdministratif{List,Form}.tsx frontend/src/rh_paie/hooks/usePersonnelsAdministratifs.ts
git commit -m "feat(rh-paie): create React components for PersonnelAdministratif management"
```

### Task 22: Create React components for AffectationEnseignement management

**Files:**
- Create: `frontend/src/rh_paie/components/AffectationEnseignementList.tsx`
- Create: `frontend/src/rh_paie/components/AffectationEnseignementForm.tsx`
- Create: `frontend/src/rh_paie/hooks/useAffectationsEnseignement.ts`
- Update: `frontend/src/rh_paie/index.ts`

**Interfaces:**
- Consumes: RH & Paie API endpoints for affectations
- Produces: UI components for managing teaching assignments

- [ ] **Step 1: Create components** (with related data lookup for enseignant, matiere, classe)
- [ ] **Step 2: Create hooks**
- [ ] **Step 3: Update barrel exports**
- [ ] **Step 4: Create unit tests**
- [ ] **Step 5: Run tests**
- [ ] **Step 6: Commit**

```bash
git add frontend/src/rh_paie/components/AffectationEnseignement{List,Form}.tsx frontend/src/rh_paie/hooks/useAffectationsEnseignement.ts
git commit -m "feat(rh-paie): create React components for AffectationEnseignement management"
```

### Task 23: Create React components for Salaire management

**Files:**
- Create: `frontend/src/rh_paie/components/SalaireEnseignantList.tsx`
- Create: `frontend/src/rh_paie/components/SalaireAdministrationList.tsx`
- Create: `frontend/src/rh_paie/components/SalaireDetail.tsx`
- Create: `frontend/src/rh_paie/hooks/useSalaires.ts`
- Update: `frontend/src/rh_paie/index.ts`

**Interfaces:**
- Consumes: RH & Paie API endpoints for salaries
- Produces: UI components for viewing and managing salaries
- Includes: Masse salariale visualization components

- [ ] **Step 1: Create components**
- [ ] **Step 2: Create hooks**
- [ ] **Step 3: Update barrel exports**
- [ ] **Step 4: Create unit tests**
- [ ] **Step 5: Run tests**
- [ ] **Step 6: Commit**

```bash
git add frontend/src/rh_paie/components/Salaire{Enseignant,Administration}List.tsx frontend/src/rh_paie/components/SalaireDetail.tsx frontend/src/rh_paie/hooks/useSalaires.ts
git commit -m "feat(rh-paie): create React components for Salaire management"
```

### Task 24: Create React components for Avance management

**Files:**
- Create: `frontend/src/rh_paie/components/AvancePersonnelList.tsx`
- Create: `frontend/src/rh_paie/components/AvancePersonnelForm.tsx`
- Create: `frontend/src/rh_paie/components/AvanceDetail.tsx`
- Create: `frontend/src/rh_paie/hooks/useAvances.ts`
- Update: `frontend/src/rh_paie/index.ts`

**Interfaces:**
- Consumes: RH & Paie API endpoints for avances
- Produces: UI components for managing salary advances
- Includes: Advance regularization workflow

- [ ] **Step 1: Create components**
- [ ] **Step 2: Create hooks**
- [ ] **Step 3: Update barrel exports**
- [ ] **Step 4: Create unit tests**
- [ ] **Step 5: Run tests**
- [ ] **Step 6: Commit**

```bash
git add frontend/src/rh_paie/components/AvancePersonnel{List,Form}.tsx frontend/src/rh_paie/components/AvanceDetail.tsx frontend/src/rh_paie/hooks/useAvances.ts
git commit -m "feat(rh-paie): create React components for Avance management"
```

## Phase 6: Integration Testing and Verification

### Task 25: Create integration tests for key workflows

**Files:**
- Create: `backend/rh_paie/tests/test_integration.py`
- Create: `frontend/src/rh_paie/__tests__/integration.test.tsx`

**Interfaces:**
- Consumes: All implemented components and services
- Produces: Verified end-to-end workflows

- [ ] **Step 1: Create backend integration tests**

```python
# backend/rh_paie/tests/test_integration.py
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
import json


class RhPaieIntegrationTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.utilisateur = Utilisateur.objects.create_user(
            username='testuser',
            password='testpass123',
            email='test@example.com',
            is_staff=True
        )
        self.client.force_authenticate(user=self.utilisateur)
        
        # Create dependencies
        self.ecole = Ecole.objects.create(nom="Ecole Test")
        self.matiere = Matiere.objects.create(nom="Mathématiques")
        self.classe = Classe.objects.create(nom="6A", ecole=self.ecole)
        self.annee_scolaire = AnneeScolaire.objects.create(
            annee_scolaire="2025-2026",
            date_debut="2025-09-01",
            date_fin="2026-06-30"
        )
    
    def test_complete_enseignant_workflow(self):
        """Test creating an enseignant, assigning them, and paying them"""
        # 1. Create enseignant
        enseignant_data = {
            'nom': 'INTEGRATION',
            'prenom': 'Test',
            'email': 'integration@test.com',
            'statut': 'PERMANENT',
            'taux_horaire': 7500
        }
        response = self.client.post(
            reverse('enseignant-list'),
            enseignant_data,
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        enseignant_id = response.data['id']
        
        # 2. Create affectation
        affectation_data = {
            'enseignant': enseignant_id,
            'matiere': self.matiere.id,
            'classe': self.classe.id,
            'annee_scolaire': self.annee_scolaire.id,
            'volume_horaire_prevu': 40,
            'taux_horaire': 7500
        }
        response = self.client.post(
            reverse('affectationenseignement-list'),
            affectation_data,
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        affectation_id = response.data['id']
        
        # 3. Verify montant_prevu is calculated correctly
        self.assertEqual(response.data['montant_prevu'], 300000)  # 40 * 7500
        
        # 4. Create trésorerie dependencies for paiement
        compte = Compte.objects.create(nom="Banque", code="BANQUE", solde=0)
        categorie = CategoriaMouvement.objects.create(
            code="SALAIRE_ENSEIGNANT", 
            libelle="Salaire Enseignant"
        )
        mouvement = Mouvement.objects.create(
            compte_id=compte.id,
            date_operation="2025-11-30",
            sens="DEBIT",
            montant=300000,
            categorie_mouvement_id=categorie.id,
            ecole_id=self.ecole.id,
            annee_scolaire_id=self.annee_scolaire.id,
            cree_par_id=self.utilisateur.id
        )
        
        # 5. Create salaire
        salaire_data = {
            'enseignant': enseignant_id,
            'affectation_enseignement': affectation_id,
            'annee_scolaire': self.annee_scolaire.id,
            'mois': 'NOV',
            'date_paiement': '2025-11-30',
            'montant': 300000,
            'compte': compte.id,
            'mouvement': mouvement.id,
            'cree_par': self.utilisateur.id
        }
        response = self.client.post(
            reverse('salaireenseignant-list'),
            salaire_data,
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['montant'], 300000)
        
        # 6. Verify masse salariale calculation
        response = self.client.get(
            reverse('salaireenseignant-masse_salariale') + 
            '?annee_scolaire_id={}&mois=NOV'.format(self.annee_scolaire.id)
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['masse_salariale'], 300000)
    
    def test_avance_workflow(self):
        """Test creating an avance and regularizing it"""
        # 1. Create personnel administratif
        personnel = PersonnelAdministratif.objects.create(
            nom='ADMINTEST',
            prenom='User',
            poste='Comptable',
            ecole=self.ecole,
            email='admin@test.com',
            salaire_base=250000
        )
        
        # 2. Create trésorerie dependencies
        compte = Compte.objects.create(nom="Caisse", code="CAISSE", solde=0)
        categorie = CategoriaMouvement.objects.create(
            code="AVANCE_ADMIN", 
            libelle="Avance Administratif"
        )
        mouvement = Mouvement.objects.create(
            compte_id=compte.id,
            date_operation="2025-11-10",
            sens="DEBIT",
            montant=20000,
            categorie_mouvement_id=categorie.id,
            ecole_id=self.ecole.id,
            annee_scolaire_id=self.annee_scolaire.id,
            cree_par_id=self.utilisateur.id
        )
        
        # 3. Create avance
        avance_data = {
            'beneficiaire': 'ADMIN',
            'personnel_administratif': personnel.id,
            'date': '2025-11-10',
            'montant': 20000,
            'motif': 'Avance test',
            'compte': compte.id,
            'mouvement': mouvement.id,
            'cree_par': self.utilisateur.id
        }
        response = self.client.post(
            reverse('avancepersonnel-list'),
            avance_data,
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        avance_id = response.data['id']
        self.assertFalse(response.data['regularisee'])
        
        # 4. Create salaire to regularize against
        salaire_mvt = Mouvement.objects.create(
            compte_id=compte.id,
            date_operation="2025-11-30",
            sens="DEBIT",
            montant=250000,
            categorie_mouvement_id=CategoriaMouvement.objects.get(code="SALAIRE_ADMIN").id,
            ecole_id=self.ecole.id,
            annee_scolaire_id=self.annee_scolaire.id,
            cree_par_id=self.utilisateur.id
        )
        salaire = SalaireAdministration.objects.create(
            personnel_administratif=personnel.id,
            annee_scolaire=self.annee_scolaire.id,
            mois='NOV',
            date_paiement='2025-11-30',
            montant_du=250000,
            montant_paye=250000,
            compte_id=compte.id,
            mouvement_id=salaire_mvt.id,
            cree_par_id=self.utilisateur.id
        )
        
        # 5. Regularize the avance
        response = self.client.post(
            reverse('avancepersonnel-regulariser', kwargs={'pk': avance_id}),
            {'salaire_admin_id': salaire.id},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['regularisee'])
        self.assertEqual(response.data['regularise_salaire_admin'], salaire.id)
```

- [ ] **Step 2: Create frontend integration tests** (using Cypress or React Testing Library with mocks)
- [ ] **Step 3: Run integration tests**
- [ ] **Step 4: Commit**

```bash
git add backend/rh_paie/tests/test_integration.py
git commit -m "feat(rh-paie): create integration tests for key workflows"
```

### Task 26: Run full test suite and quality checks

**Files:**
- Modify: Various (running checks)

**Interfaces:**
- Consumes: All implemented code
- Produces: Verified quality and test coverage

- [ ] **Step 1: Run backend tests**

Run: `pytest`
Expected: All tests pass

- [ ] **Step 2: Run backend specific tests**

Run: `pytest backend/rh_paie/`
Expected: All RH & Paie tests pass

- [ ] **Step 3: Run Django checks**

Run: `python manage.py check`
Expected: No errors

- [ ] **Step 4: Run migrations check**

Run: `python manage.py makemigrations --check --dry-run`
Expected: No pending migrations

- [ ] **Step 5: Run SQL migrations validation**

Run: `python manage.py migrate`
Expected: All migrations applied successfully

- [ ] **Step 6: Run spectacular validation**

Run: `python manage.py spectacular --file /tmp/schema.yml`
Expected: 0 Errors

- [ ] **Step 7: Run frontend tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 8: Run frontend type checking**

Run: `npm run typecheck`
Expected: No TypeScript errors

- [ ] **Step 9: Run frontend linting**

Run: `npm run lint` (or equivalent based on project setup)
Expected: No linting errors

- [ ] **Step 10: Run frontend build**

Run: `npm run build`
Expected: Successful build

- [ ] **Step 11: Commit**

```bash
git add .  # Record that tests passed
git commit -m "feat(rh-paie): run full test suite and quality checks - all passing"
```

### Task 27: Update documentation and traceability

**Files:**
- Modify: `docs/superpowers/plans/progress.md`
- Create/Update: `db/CORRESPONDANCE.md`
- Update: `docs/superpowers/plans/phase-6-rh-paie.md` (this file)
- Update: README or other docs if needed

**Interfaces:**
- Consumes: All implemented work
- Produces: Updated documentation and traceability matrix

- [ ] **Step 1: Update progress.md**

Add entry indicating completion of Phase 6 RH & Paie implementation

- [ ] **Step 2: Update CORRESPONDANCE.md**

Add mappings between SQL tables and Django models for rh_paie app

- [ ] **Step 3: Ensure this plan is complete and accurate**

Verify all tasks are properly documented

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/progress.md db/CORRESPONDANCE.md docs/superpowers/plans/2026-10-12-phase-6-rh-paie.md
git commit -m "feat(rh-paie): update documentation and traceability"
```

## Phase 7: Final Review and Validation

### Task 28: Perform final review against spec requirements

**Files:**
- Modify: None (review only)

**Interfaces:**
- Consumes: Spec document and implemented code
- Produces: Validation that all requirements are met

- [ ] **Step 1: Review spec sections 1-18**

Verify that all functional and technical requirements are addressed

- [ ] **Step 2: Check all blocking decisions (D1-D14)**

Ensure each decision is either resolved by existing implementation or documented as needing further clarification

- [ ] **Step 3: Verify all workflows from section 7**

Check that payroll, advance, and other workflows are correctly implemented

- [ ] **Step 4: Validate API endpoints against section 8**

Ensure all specified endpoints are implemented with correct behavior

- [ ] **Step 5: Confirm frontend screens match section 9**

Verify all specified screens are implemented

- [ ] **Step 6: Check validations from section 10**

Ensure all backend validations are implemented

- [ ] **Step 7: Confirm tests cover section 12 requirements**

Verify all required test types are implemented and passing

- [ ] **Step 8: Check security considerations from section 11**

Verify security implementations are in place

- [ ] **Step 9: Commit review notes**

```bash
git add .  # Optional: if any minor fixes were made during review
git commit -m "feat(rh-paie): final review against spec requirements completed"
```

### Task 29: Create final execution handoff

**Files:**
- Modify: None

**Interfaces:**
- Consumes: Completed implementation
- Produces: Ready-for-execution notification

- [ ] **Step 1: Announce plan completion**

Output message indicating the plan is ready for execution

- [ ] **Step 2: Offer execution choices**

As per the writing-plans skill, offer subagent-driven or inline execution

**Plan complete and saved to `docs/superpowers/plans/2026-10-12-phase-6-rh-paie.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**


# backend/scolarite/models.py
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from core.models import Auditable
from referentiel.models import Ecole, Niveau, AnneeScolaire
from personnes.models import Etudiant

class ModalitePaiement(Auditable):
    """Modalité de paiement (grille tarifaire) par niveau et année scolaire.

    Conforme à db/migrations/004_scolarite_facturation.sql : l'échéance 0 de
    l'échéancier (inscription/réinscription) est financée par
    `montant_inscription_reinscription`, les échéances 1..N par
    `nombre_echeance` mensualités de `montant_echeance` chacune.
    """
    niveau = models.ForeignKey(Niveau, on_delete=models.RESTRICT)
    annee_scolaire = models.ForeignKey(AnneeScolaire, on_delete=models.RESTRICT)
    montant_inscription_reinscription = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Montant de l'échéance 0 (inscription/réinscription) en FCFA"
    )
    nombre_echeance = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1)],
        help_text="Nombre de mensualités de scolarité (échéances 1..N)"
    )
    montant_echeance = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Montant d'une mensualité de scolarité en FCFA"
    )

    class Meta:
        unique_together = ('niveau', 'annee_scolaire')
        verbose_name = "Modalité de paiement"
        verbose_name_plural = "Modalités de paiement"

    def __str__(self):
        return f"{self.niveau.code} - {self.annee_scolaire.libelle}: {self.montant_total} FCFA"

    @property
    def montant_total(self):
        return self.montant_inscription_reinscription + self.nombre_echeance * self.montant_echeance

class TypeFrais(Auditable):
    """Type/famille de frais annexe (scolarité, inscription, activités, etc.).

    `ecole`/`niveau`/`annee_scolaire` NULL = s'applique à tous (scope
    générique) ; une valeur précise restreint le frais à ce périmètre.
    Utilisé par `scolarite.services.materialiser_frais_obligatoires`.
    """
    code = models.CharField(max_length=30, unique=True)
    libelle = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    ecole = models.ForeignKey(Ecole, null=True, blank=True, on_delete=models.RESTRICT)
    niveau = models.ForeignKey(Niveau, null=True, blank=True, on_delete=models.RESTRICT)
    annee_scolaire = models.ForeignKey(
        AnneeScolaire, null=True, blank=True, on_delete=models.RESTRICT
    )
    montant_defaut = models.DecimalField(
        max_digits=12, decimal_places=0, default=0, validators=[MinValueValidator(0)]
    )
    obligatoire = models.BooleanField(default=False)
    actif = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Type de frais"
        verbose_name_plural = "Types de frais"

    def __str__(self):
        return self.libelle

class FraisInscription(Auditable):
    """Frais annexe matérialisé pour une inscription donnée (une ligne par
    (inscription, type_frais)) — distinct de l'échéance 0 de l'échéancier,
    qui elle vient de `ModalitePaiement.montant_inscription_reinscription`."""
    inscription = models.ForeignKey(
        'personnes.Inscription', on_delete=models.CASCADE, related_name='frais_inscription'
    )
    type_frais = models.ForeignKey(TypeFrais, on_delete=models.RESTRICT)
    montant_du = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Montant en FCFA (peut être zéro pour frais gratuits)"
    )
    exonere = models.BooleanField(default=False)
    commentaire = models.CharField(max_length=255, null=True, blank=True)  # noqa: DJ001

    class Meta:
        unique_together = ('inscription', 'type_frais')
        verbose_name = "Frais d'inscription"
        verbose_name_plural = "Frais d'inscription"

    def __str__(self):
        return f"{self.type_frais.libelle} - inscription {self.inscription_id}: {self.montant_du} FCFA"

class Echeance(Auditable):
    """Échéance de paiement associée à une inscription"""
    STATUT_CHOICES = [
        ('à payer', 'À payer'),
        ('partiellement payé', 'Partiellement payé'),
        ('payé', 'Payé'),
        ('en retard', 'En retard'),
        ('surpaye', 'Surpayé'),  # Trop-perçu ou avoir
    ]

    inscription = models.ForeignKey(
        'personnes.Inscription',
        on_delete=models.RESTRICT,
        related_name='echeances'
    )
    numero = models.PositiveSmallIntegerField(
        help_text="0 = inscription/réinscription, 1..N = échéances suivantes"
    )
    montant = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        validators=[MinValueValidator(0)],
        help_text="Montant de l'échéance en FCFA"
    )
    date_echeance = models.DateField()
    date_paiement = models.DateField(null=True, blank=True)
    montant_paye = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Montant déjà payé pour cette échéance"
    )
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='à payer')

    class Meta:
        unique_together = ('inscription', 'numero')
        ordering = ['inscription', 'numero']
        verbose_name = "Échéance"
        verbose_name_plural = "Échéances"

    def __str__(self):
        return f"Échéance {self.numero} pour {self.inscription} - {self.montant} FCFA ({self.statut})"

    @property
    def reste_a_payer(self):
        """Montant restant à payer pour cette échéance"""
        return max(0, self.montant - self.montant_paye)

    @property
    def est_payee(self):
        """Vérifie si l'échéance est entièrement payée"""
        return self.montant_paye >= self.montant

class Bourse(Auditable):
    """Bourse attribuée à un étudiant pour une année scolaire"""
    TYPE_CHOICES = [
        ('TOTAL', 'Bourse totale'),
        ('PARTIELLE', 'Bourse partielle'),
        ('MERITE', 'Bourse au mérite'),
        ('SOCIALE', 'Bourse sociale'),
    ]

    etudiant = models.ForeignKey(Etudiant, on_delete=models.CASCADE)
    annee_scolaire = models.ForeignKey(AnneeScolaire, on_delete=models.CASCADE)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    # Soit pourcentage, soit montant fixe (exclusif)
    pourcentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Pourcentage des échéances pris en charge (NULL si montant_fixe utilisé)"
    )
    montant_fixe = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
        help_text="Montant fixe en FCFA pris en charge (NULL si pourcentage utilisé)"
    )
    date_attribution = models.DateField()
    date_fin_validite = models.DateField(null=True, blank=True)

    class Meta:
        verbose_name = "Bourse"
        verbose_name_plural = "Bourses"

    def __str__(self):
        if self.pourcentage is not None:
            return f"Bourse {self.type} pour {self.etudiant} ({self.pourcentage}%)"
        else:
            return f"Bourse {self.type} pour {self.etudiant} ({self.montant_fixe} FCFA)"

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.pourcentage is not None and self.montant_fixe is not None:
            raise ValidationError("Une bourse ne peut pas avoir à la fois un pourcentage et un montant fixe")
        if self.pourcentage is None and self.montant_fixe is None:
            raise ValidationError("Une bourse doit avoir soit un pourcentage, soit un montant fixe")
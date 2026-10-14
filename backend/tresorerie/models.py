# backend/tresorerie/models.py
from django.db import models
from django.core.validators import MinValueValidator
from django.core.exceptions import ValidationError
from core.models import Auditable
from personnes.models import Inscription
from referentiel.models import AnneeScolaire, Ecole
from scolarite.models import Echeance, FraisInscription


class Compte(Auditable):
    """Compte bancaire ou de caisse"""

    class Type(models.TextChoices):
        CAISSE = 'CAISSE', 'Caisse'
        BANQUE = 'BANQUE', 'Banque'
        MOBILE_MONEY = 'MOBILE_MONEY', 'Mobile Money'
        VIRTUEL = 'VIRTUEL', 'Virtuel'

    code = models.CharField(
        max_length=30,
        unique=True,
        verbose_name="Code"
    )
    libelle = models.CharField(
        max_length=120,
        verbose_name="Libellé"
    )
    type = models.CharField(
        max_length=20,
        choices=Type.choices,
        verbose_name="Type"
    )
    numero_bancaire = models.CharField(
        max_length=40,
        blank=True,
        null=True,
        verbose_name="Numéro bancaire"
    )
    banque = models.CharField(
        max_length=120,
        blank=True,
        null=True,
        verbose_name="Banque"
    )
    solde_initial = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        default=0,
        validators=[MinValueValidator(0)],
        verbose_name="Solde initial (FCFA)"
    )
    actif = models.BooleanField(
        default=True,
        verbose_name="Actif"
    )

    class Meta:
        db_table = 'compte'
        verbose_name = "Compte"
        verbose_name_plural = "Comptes"

    def __str__(self):
        return f"{self.code} - {self.libelle}"


class CategorieMouvement(Auditable):
    """Catégorie de mouvement financier"""

    class Sens(models.TextChoices):
        ENTREE = 'ENTREE', 'Entrée'
        SORTIE = 'SORTIE', 'Sortie'
        NEUTRE = 'NEUTRE', 'Neutre'

    code = models.CharField(
        max_length=40,
        unique=True,
        verbose_name="Code"
    )
    libelle = models.CharField(
        max_length=120,
        verbose_name="Libellé"
    )
    sens = models.CharField(
        max_length=10,
        choices=Sens.choices,
        verbose_name="Sens"
    )

    class Meta:
        db_table = 'categorie_mouvement'
        verbose_name = "Catégorie de mouvement"
        verbose_name_plural = "Catégories de mouvement"

    def __str__(self):
        return f"{self.code} - {self.libelle}"


class Virement(Auditable):
    """Virement entre deux comptes du groupe scolaire"""

    class Statut(models.TextChoices):
        BROUILLON = 'BROUILLON', 'Brouillon'
        EN_ATTENTE_VALIDATION = 'EN_ATTENTE_VALIDATION', 'En attente de validation'
        VALIDE = 'VALIDE', 'Validé'
        ANNULE = 'ANNULE', 'Annulé'

    compte_source = models.ForeignKey(
        Compte,
        on_delete=models.RESTRICT,
        related_name='virements_source',
        verbose_name="Compte source"
    )
    compte_destination = models.ForeignKey(
        Compte,
        on_delete=models.RESTRICT,
        related_name='virements_destination',
        verbose_name="Compte destination"
    )
    montant = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        validators=[MinValueValidator(1)],
        verbose_name="Montant (FCFA)"
    )
    date = models.DateField(verbose_name="Date")
    motif = models.CharField(
        max_length=255,
        verbose_name="Motif"
    )
    statut = models.CharField(
        max_length=25,
        choices=Statut.choices,
        default=Statut.BROUILLON,
        verbose_name="Statut"
    )
    valide_par = models.ForeignKey(
        'comptes.Utilisateur',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
        verbose_name="Validé par"
    )

    class Meta:
        db_table = 'virement'
        verbose_name = "Virement"
        verbose_name_plural = "Virements"
        constraints = [
            models.CheckConstraint(
                check=~models.Q(compte_source=models.F('compte_destination')),
                name='chk_virement_comptes_differents'
            )
        ]

    # Protected fields configuration
    editable_statuses = [Statut.BROUILLON]
    protected_fields = ['compte_source', 'compte_destination', 'montant', 'date', 'motif']
    deletable_statuses = [Statut.BROUILLON]

    def save(self, *args, **kwargs):
        if self.pk:
            try:
                original = Virement.objects.get(pk=self.pk)
            except Virement.DoesNotExist:
                pass
            else:
                if original.statut not in self.editable_statuses:
                    for field in self.protected_fields:
                        original_value = getattr(original, field)
                        current_value = getattr(self, field)
                        if original_value != current_value:
                            raise ValidationError(
                                f"Le champ '{field}' ne peut pas être modifié pour un virement avec le statut '{original.statut}'."
                            )
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.pk:
            try:
                original = Virement.objects.get(pk=self.pk)
            except Virement.DoesNotExist:
                pass
            else:
                if original.statut not in self.deletable_statuses:
                    raise ValidationError(
                        f"Suppression interdite pour un virement avec le statut '{original.statut}'."
                    )
        super().delete(*args, **kwargs)

    def __str__(self):
        return f"Virement {self.id}: {self.compte_source.code} → {self.compte_destination.code} ({self.montant} FCFA)"


class Mouvement(Auditable):
    """Mouvement financier simple (débit ou crédit) - Grand livre unifié"""

    class Sens(models.TextChoices):
        DEBIT = 'DEBIT', 'Débit'
        CREDIT = 'CREDIT', 'Crédit'

    compte = models.ForeignKey(
        Compte,
        on_delete=models.RESTRICT,
        verbose_name="Compte"
    )
    date_operation = models.DateField(verbose_name="Date d'opération")
    sens = models.CharField(
        max_length=6,
        choices=Sens.choices,
        verbose_name="Sens"
    )
    montant = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        validators=[MinValueValidator(1)],
        verbose_name="Montant (FCFA)"
    )
    categorie_mouvement = models.ForeignKey(
        CategorieMouvement,
        on_delete=models.RESTRICT,
        verbose_name="Catégorie de mouvement"
    )
    libelle = models.CharField(
        max_length=255,
        verbose_name="Libellé"
    )
    piece_reference = models.CharField(
        max_length=40,
        blank=True,
        null=True,
        verbose_name="Référence de peça"
    )
    ecole = models.ForeignKey(
        Ecole,
        on_delete=models.RESTRICT,
        blank=True,
        null=True,
        related_name='+',
        verbose_name="École"
    )
    annee_scolaire = models.ForeignKey(
        AnneeScolaire,
        on_delete=models.RESTRICT,
        verbose_name="Année scolaire"
    )
    virement = models.ForeignKey(
        Virement,
        on_delete=models.RESTRICT,
        blank=True,
        null=True,
        related_name='mouvements',
        verbose_name="Virement associé"
    )
    valide = models.BooleanField(
        default=True,
        verbose_name="Valide"
    )

    class Meta:
        db_table = 'mouvement'
        verbose_name = "Mouvement"
        verbose_name_plural = "Mouvements"
        indexes = [
            models.Index(fields=['compte', 'date_operation'], name='idx_mouvement_compte_date'),
            models.Index(fields=['annee_scolaire', 'ecole', 'date_operation'], name='idx_mouvement_analytique'),
            models.Index(fields=['categorie_mouvement', 'date_operation'], name='idx_mouvement_categorie'),
            models.Index(fields=['virement'], name='idx_mouvement_virement'),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(montant__gt=0),
                name='chk_mouvement_montant_positif'
            )
        ]

    # Protection du grand livre (P0, audit du 2026-10-14) : `Mouvement` est le seul modèle
    # financier du dépôt sans garde save()/delete(), contrairement à Depense/Encaissement/
    # Virement/ArreteCaisse. Pas de champ `statut` ici — `valide` est le seul levier existant
    # (cf. tresorerie.services.mouvement.valider_mouvement/invalider_mouvement, qui ne touchent
    # que ce champ) ; il reste donc volontairement hors de `protected_fields`. La suppression
    # n'est jamais autorisée : le mécanisme de correction prévu est l'invalidation
    # (`invalider_mouvement`), pas la suppression physique d'une ligne du grand livre.
    protected_fields = [
        'compte', 'date_operation', 'sens', 'montant', 'categorie_mouvement',
        'ecole', 'annee_scolaire', 'virement',
    ]

    def save(self, *args, **kwargs):
        if self.pk:
            try:
                original = Mouvement.objects.get(pk=self.pk)
            except Mouvement.DoesNotExist:
                pass
            else:
                for field in self.protected_fields:
                    if getattr(original, field) != getattr(self, field):
                        raise ValidationError(
                            f"Le champ '{field}' ne peut pas être modifié pour un mouvement "
                            f"déjà enregistré dans le grand livre."
                        )
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError(
            "Suppression interdite pour un mouvement du grand livre. "
            "Utiliser l'invalidation (invalider_mouvement) pour corriger une erreur."
        )

    def __str__(self):
        return f"{self.date_operation} - {self.get_sens_display()} {self.montant} FCFA sur {self.compte.code}"


class Encaissement(Auditable):
    """Encaissement de fonds lié à une inscription"""

    class Mode(models.TextChoices):
        ESPECES = 'ESPECES', 'Espèces'
        VIREMENT = 'VIREMENT', 'Virement'
        MOBILE_MONEY = 'MOBILE_MONEY', 'Mobile Money'
        CHEQUE = 'CHEQUE', 'Chèque'

    class Statut(models.TextChoices):
        EN_COURS = 'EN_COURS', 'En cours'
        VALIDE = 'VALIDE', 'Validé'
        ANNULE = 'ANNULE', 'Annulé'

    inscription = models.ForeignKey(
        Inscription,
        on_delete=models.RESTRICT,
        verbose_name="Inscription"
    )
    date = models.DateField(verbose_name="Date")
    montant_total = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        validators=[MinValueValidator(1)],
        verbose_name="Montant total (FCFA)"
    )
    mode = models.CharField(
        max_length=15,
        choices=Mode.choices,
        verbose_name="Mode de paiement"
    )
    compte = models.ForeignKey(
        Compte,
        on_delete=models.RESTRICT,
        verbose_name="Compte de crédit"
    )
    mouvement = models.OneToOneField(
        Mouvement,
        on_delete=models.RESTRICT,
        verbose_name="Mouvement associé"
    )
    recu_numero = models.CharField(
        max_length=40,
        unique=True,
        verbose_name="Numéro de reçu"
    )
    statut = models.CharField(
        max_length=10,
        choices=Statut.choices,
        default=Statut.EN_COURS,
        verbose_name="Statut"
    )

    class Meta:
        db_table = 'encaissement'
        verbose_name = "Encaissement"
        verbose_name_plural = "Encaissements"
        indexes = [
            models.Index(fields=['inscription'], name='idx_encaissement_inscription'),
        ]

    # Protected fields configuration
    editable_statuses = [Statut.EN_COURS]
    protected_fields = ['inscription', 'date', 'montant_total', 'mode', 'compte', 'recu_numero']
    deletable_statuses = [Statut.EN_COURS]

    def save(self, *args, **kwargs):
        if self.pk:
            try:
                original = Encaissement.objects.get(pk=self.pk)
            except Encaissement.DoesNotExist:
                pass
            else:
                if original.statut not in self.editable_statuses:
                    for field in self.protected_fields:
                        original_value = getattr(original, field)
                        current_value = getattr(self, field)
                        if original_value != current_value:
                            raise ValidationError(
                                f"Le champ '{field}' ne peut pas être modifié pour un encaissement avec le statut '{original.statut}'."
                            )
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.pk:
            try:
                original = Encaissement.objects.get(pk=self.pk)
            except Encaissement.DoesNotExist:
                pass
            else:
                if original.statut not in self.deletable_statuses:
                    raise ValidationError(
                        f"Suppression interdite pour un encaissement avec le statut '{original.statut}'."
                    )
        super().delete(*args, **kwargs)

    def __str__(self):
        return f"Encaissement {self.recu_numero} du {self.date} - {self.montant_total} FCFA"


class ImputationEncaissement(Auditable):
    """Imputation d'un encaissement sur une échéance ou un frais d'inscription"""

    class Cible(models.TextChoices):
        ECHEANCE = 'ECHEANCE', 'Échéance'
        FRAIS = 'FRAIS', 'Frais d\'inscription'

    encaissement = models.ForeignKey(
        Encaissement,
        on_delete=models.CASCADE,
        verbose_name="Encaissement"
    )
    cible = models.CharField(
        max_length=10,
        choices=Cible.choices,
        verbose_name="Cible"
    )
    echeance = models.ForeignKey(
        Echeance,
        on_delete=models.RESTRICT,
        blank=True,
        null=True,
        verbose_name="Échéance"
    )
    frais_inscription = models.ForeignKey(
        FraisInscription,
        on_delete=models.RESTRICT,
        blank=True,
        null=True,
        verbose_name="Frais d'inscription"
    )
    montant = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        validators=[MinValueValidator(1)],
        verbose_name="Montant imputé (FCFA)"
    )

    class Meta:
        db_table = 'imputation_encaissement'
        verbose_name = "Imputation d'encaissement"
        verbose_name_plural = "Imputations d'encaissement"
        indexes = [
            models.Index(fields=['encaissement'], name='idx_imputation_encaissement'),
            models.Index(fields=['echeance'], name='idx_imputation_echeance'),
            models.Index(fields=['frais_inscription'], name='idx_imputation_frais'),
        ]
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(cible='ECHEANCE', echeance__isnull=False, frais_inscription__isnull=True) |
                    models.Q(cible='FRAIS', echeance__isnull=True, frais_inscription__isnull=False)
                ),
                name='chk_imputation_cible_coherente'
            ),
            models.CheckConstraint(
                check=models.Q(montant__gt=0),
                name='chk_imputation_montant_positif'
            )
        ]

    def __str__(self):
        cible_libelle = self.echeance if self.cible == self.Cible.ECHEANCE else self.frais_inscription
        return f"Imputation {self.montant} FCFA sur {cible_libelle}"


class Depense(Auditable):
    """Dépense de fonds du groupe scolaire"""

    class Statut(models.TextChoices):
        ENGAGEE = 'ENGAGEE', 'Engagée'
        VALIDEE = 'VALIDEE', 'Validée'
        PAYEE = 'PAYEE', 'Payée'
        ANNULEE = 'ANNULEE', 'Annulée'

    date = models.DateField(verbose_name="Date")
    categorie_mouvement = models.ForeignKey(
        CategorieMouvement,
        on_delete=models.RESTRICT,
        limit_choices_to={'sens': CategorieMouvement.Sens.SORTIE},
        verbose_name="Catégorie de mouvement"
    )
    beneficiaire = models.CharField(
        max_length=150,
        verbose_name="Bénéficiaire"
    )
    designation = models.CharField(
        max_length=255,
        verbose_name="Désignation"
    )
    montant = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        validators=[MinValueValidator(1)],
        verbose_name="Montant (FCFA)"
    )
    compte = models.ForeignKey(
        Compte,
        on_delete=models.RESTRICT,
        verbose_name="Compte de débit"
    )
    mouvement = models.OneToOneField(
        Mouvement,
        on_delete=models.RESTRICT,
        verbose_name="Mouvement associé"
    )
    ecole = models.ForeignKey(
        Ecole,
        on_delete=models.RESTRICT,
        blank=True,
        null=True,
        related_name='+',
        verbose_name="École"
    )
    annee_scolaire = models.ForeignKey(
        AnneeScolaire,
        on_delete=models.RESTRICT,
        verbose_name="Année scolaire"
    )
    piece_justificative = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name="Pièce justificative"
    )
    engage_par = models.ForeignKey(
        'comptes.Utilisateur',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='+',
        verbose_name="Engagé par"
    )
    valide_par = models.ForeignKey(
        'comptes.Utilisateur',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='+',
        verbose_name="Validé par"
    )
    statut = models.CharField(
        max_length=10,
        choices=Statut.choices,
        default=Statut.ENGAGEE,
        verbose_name="Statut"
    )

    class Meta:
        db_table = 'depense'
        verbose_name = "Dépense"
        verbose_name_plural = "Dépenses"
        indexes = [
            models.Index(fields=['annee_scolaire', 'ecole', 'date'], name='idx_depense_analytique'),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(montant__gt=0),
                name='chk_depense_montant_positif'
            )
        ]

    # Protected fields configuration
    editable_statuses = [Statut.ENGAGEE]
    protected_fields = ['date', 'categorie_mouvement', 'beneficiaire', 'designation', 'montant', 'compte', 'ecole', 'annee_scolaire', 'piece_justificative']
    deletable_statuses = [Statut.ENGAGEE]

    def save(self, *args, **kwargs):
        if self.pk:
            try:
                original = Depense.objects.get(pk=self.pk)
            except Depense.DoesNotExist:
                pass
            else:
                if original.statut not in self.editable_statuses:
                    for field in self.protected_fields:
                        original_value = getattr(original, field)
                        current_value = getattr(self, field)
                        if original_value != current_value:
                            raise ValidationError(
                                f"Le champ '{field}' ne peut pas être modifié pour une dépense avec le statut '{original.statut}'."
                            )
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.pk:
            try:
                original = Depense.objects.get(pk=self.pk)
            except Depense.DoesNotExist:
                pass
            else:
                if original.statut not in self.deletable_statuses:
                    raise ValidationError(
                        f"Suppression interdite pour une dépense avec le statut '{original.statut}'."
                    )
        super().delete(*args, **kwargs)

    def __str__(self):
        return f"Dépense {self.id}: {self.beneficiaire} - {self.designation} ({self.montant} FCFA)"


class ArreteCaisse(Auditable):
    """Arrêté de caisse - clôture périodique d'une caisse"""

    class Statut(models.TextChoices):
        EN_COURS = 'EN_COURS', 'En cours'
        VALIDE = 'VALIDE', 'Validé'

    compte = models.ForeignKey(
        Compte,
        on_delete=models.RESTRICT,
        limit_choices_to={'type': Compte.Type.CAISSE},
        verbose_name="Compte de caisse"
    )
    date = models.DateField(verbose_name="Date")
    solde_theorique = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        validators=[MinValueValidator(0)],
        verbose_name="Solde théorique (FCFA)"
    )
    solde_physique = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        validators=[MinValueValidator(0)],
        verbose_name="Solde physique (FCFA)"
    )
    ecart = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        editable=False,
        verbose_name="Écart (FCFA)"
    )
    fait_par = models.ForeignKey(
        'comptes.Utilisateur',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='+',
        verbose_name="Fait par"
    )
    valide_par = models.ForeignKey(
        'comptes.Utilisateur',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='+',
        verbose_name="Validé par"
    )
    statut = models.CharField(
        max_length=10,
        choices=Statut.choices,
        default=Statut.EN_COURS,
        verbose_name="Statut"
    )

    class Meta:
        db_table = 'arrete_caisse'
        verbose_name = "Arrêté de caisse"
        verbose_name_plural = "Arrêtés de caisse"
        indexes = [
            models.Index(fields=['compte', 'date'], name='idx_arrete_caisse_compte_date'),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(solde_theorique__gte=0),
                name='chk_arrete_caisse_solde_theorique_positif'
            ),
            models.CheckConstraint(
                check=models.Q(solde_physique__gte=0),
                name='chk_arrete_caisse_solde_physique_positif'
            ),
            models.UniqueConstraint(
                fields=['compte', 'date'],
                name='uq_arrete_caisse_compte_date'
            )
        ]

    # Protected fields configuration
    editable_statuses = [Statut.EN_COURS]
    protected_fields = ['compte', 'date', 'solde_theorique', 'solde_physique', 'fait_par', 'valide_par']
    deletable_statuses = [Statut.EN_COURS]

    def save(self, *args, **kwargs):
        if self.pk:
            try:
                original = ArreteCaisse.objects.get(pk=self.pk)
            except ArreteCaisse.DoesNotExist:
                pass
            else:
                if original.statut not in self.editable_statuses:
                    for field in self.protected_fields:
                        original_value = getattr(original, field)
                        current_value = getattr(self, field)
                        if original_value != current_value:
                            raise ValidationError(
                                f"Le champ '{field}' ne peut pas être modifié pour un arrêté de caisse avec le statut '{original.statut}'."
                            )
        # Calculate ecart automatically
        self.ecart = self.solde_physique - self.solde_theorique
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.pk:
            try:
                original = ArreteCaisse.objects.get(pk=self.pk)
            except ArreteCaisse.DoesNotExist:
                pass
            else:
                if original.statut not in self.deletable_statuses:
                    raise ValidationError(
                        f"Suppression interdite pour un arrêté de caisse avec le statut '{original.statut}'."
                    )
        super().delete(*args, **kwargs)

    def __str__(self):
        return f"Arrêté de caisse {self.compte.code} du {self.date} - Écart: {self.ecart} FCFA"


class Billetage(Auditable):
    """Billetage - décomposition du cash par dénomination"""

    arrete_caisse = models.ForeignKey(
        ArreteCaisse,
        on_delete=models.CASCADE,
        verbose_name="Arrêté de caisse"
    )
    denomination = models.PositiveIntegerField(
        verbose_name="Dénomination (FCFA)"
    )
    quantite = models.PositiveIntegerField(
        verbose_name="Quantité"
    )
    montant = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        editable=False,
        verbose_name="Montant (FCFA)"
    )

    class Meta:
        db_table = 'billetage'
        verbose_name = "Billetage"
        verbose_name_plural = "Billetages"
        indexes = [
            models.Index(fields=['arrete_caisse'], name='idx_billetage_arrete_caisse'),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(denomination__gt=0),
                name='chk_billetage_denomination_positif'
            ),
            models.CheckConstraint(
                check=models.Q(quantite__gte=0),
                name='chk_billetage_quantite_positif'
            ),
            models.UniqueConstraint(
                fields=['arrete_caisse', 'denomination'],
                name='uq_billetage_arrete_caisse_denomination'
            )
        ]

    def save(self, *args, **kwargs):
        # Calculate montant automatically
        self.montant = self.denomination * self.quantite
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.quantite} x {self.denomination} FCFA = {self.montant} FCFA"
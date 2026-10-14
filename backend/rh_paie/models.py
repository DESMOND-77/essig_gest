from django.db import models
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from referentiel.models import Matiere, Classe, Ecole, AnneeScolaire
from tresorerie.models import Compte, Mouvement
from comptes.models import Utilisateur


class Enseignant(models.Model):
    nom = models.CharField(max_length=60)
    prenom = models.CharField(max_length=120)
    telephone = models.CharField(max_length=60, blank=True, null=True)
    email = models.EmailField(max_length=120, blank=True, null=True, unique=True)
    specialite = models.CharField(max_length=120, blank=True, null=True)
    statut = models.CharField(
        max_length=12,
        choices=[('VACATAIRE', 'Vacataire'), ('PERMANENT', 'Permanent')],
        default='VACATAIRE'
    )
    taux_horaire = models.DecimalField(max_digits=12, decimal_places=0, blank=True, null=True)
    actif = models.BooleanField(default=True)
    cree_par = models.ForeignKey(Utilisateur, on_delete=models.SET_NULL, blank=True, null=True, related_name='enseignant_cree_par')
    cree_le = models.DateTimeField(auto_now_add=True)
    modifie_par = models.ForeignKey(Utilisateur, on_delete=models.SET_NULL, blank=True, null=True, related_name='enseignant_modifie_par')
    modifie_le = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'enseignant'
        verbose_name = 'Enseignant'
        verbose_name_plural = 'Enseignants'
        indexes = [
            models.Index(fields=['nom', 'prenom']),
        ]

    def __str__(self):
        return f"{self.nom} {self.prenom}"


class PersonnelAdministratif(models.Model):
    nom = models.CharField(max_length=60)
    prenom = models.CharField(max_length=120)
    poste = models.CharField(max_length=120)
    ecole = models.ForeignKey(Ecole, on_delete=models.SET_NULL, blank=True, null=True)
    telephone = models.CharField(max_length=60, blank=True, null=True)
    email = models.EmailField(max_length=120, blank=True, null=True)
    salaire_base = models.DecimalField(max_digits=12, decimal_places=0)
    date_embauche = models.DateField(blank=True, null=True)
    actif = models.BooleanField(default=True)
    cree_par = models.ForeignKey(Utilisateur, on_delete=models.SET_NULL, blank=True, null=True, related_name='personnel_administratif_cree_par')
    cree_le = models.DateTimeField(auto_now_add=True)
    modifie_par = models.ForeignKey(Utilisateur, on_delete=models.SET_NULL, blank=True, null=True, related_name='personnel_administratif_modifie_par')
    modifie_le = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'personnel_administratif'
        verbose_name = 'Personnel Administratif'
        verbose_name_plural = 'Personnels Administratifs'
        indexes = [
            models.Index(fields=['nom', 'prenom']),
        ]

    def __str__(self):
        return f"{self.nom} {self.prenom}"


class AffectationEnseignement(models.Model):
    enseignant = models.ForeignKey('rh_paie.Enseignant', on_delete=models.CASCADE)
    matiere = models.ForeignKey(Matiere, on_delete=models.CASCADE)
    classe = models.ForeignKey(Classe, on_delete=models.CASCADE)
    annee_scolaire = models.ForeignKey(AnneeScolaire, on_delete=models.CASCADE)
    volume_horaire_prevu = models.IntegerField()
    taux_horaire = models.DecimalField(max_digits=12, decimal_places=0)
    montant_prevu = models.DecimalField(max_digits=12, decimal_places=0)
    cree_par = models.ForeignKey(Utilisateur, on_delete=models.SET_NULL, blank=True, null=True, related_name='affectation_enseignement_cree_par')
    cree_le = models.DateTimeField(auto_now_add=True)
    modifie_par = models.ForeignKey(Utilisateur, on_delete=models.SET_NULL, blank=True, null=True, related_name='affectation_enseignement_modifie_par')
    modifie_le = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'affectation_enseignement'
        verbose_name = 'Affectation d\'enseignement'
        verbose_name_plural = 'Affectations d\'enseignement'
        constraints = [
            models.UniqueConstraint(fields=['matiere', 'classe'], name='unq_affectation'),
        ]
        indexes = [
            models.Index(fields=['enseignant', 'annee_scolaire']),
        ]

    def __str__(self):
        return f"{self.enseignant.nom} {self.enseignant.prenom} - {self.matiere.nom} ({self.classe.nom})"


class SalaireEnseignant(models.Model):
    STATUT_CHOICES = [
        ('BROUILLON', 'Brouillon'),
        ('VALIDÉ', 'Validé'),
        ('PAYÉ', 'Payé'),
    ]
    enseignant = models.ForeignKey('rh_paie.Enseignant', on_delete=models.CASCADE)
    affectation_enseignement = models.ForeignKey(
        'rh_paie.AffectationEnseignement',
        on_delete=models.SET_NULL,
        blank=True,
        null=True
    )
    annee_scolaire = models.ForeignKey('referentiel.AnneeScolaire', on_delete=models.CASCADE)
    mois = models.CharField(
        max_length=4,
        choices=[
            ('SEPT', 'Septembre'), ('OCT', 'Octobre'), ('NOV', 'Novembre'),
            ('DEC', 'Décembre'), ('JAN', 'Janvier'), ('FEV', 'Février'),
            ('MAR', 'Mars'), ('AVR', 'Avril'), ('MAI', 'Mai'),
            ('JUIN', 'Juin'), ('JUIL', 'Juillet'), ('AOUT', 'Août')
        ]
    )
    date_paiement = models.DateField()
    montant = models.DecimalField(max_digits=12, decimal_places=0)
    compte = models.ForeignKey(Compte, on_delete=models.CASCADE)
    mouvement = models.BigIntegerField(null=True, blank=True)  # Will be ForeignKey to Mouvement after migration
    # Validation fields
    statut = models.CharField(max_length=10, choices=STATUT_CHOICES, default='BROUILLON')
    date_validation = models.DateTimeField(blank=True, null=True)
    valide_par = models.ForeignKey(Utilisateur, on_delete=models.SET_NULL, blank=True, null=True, related_name='salaire_enseignant_valide_par')
    cree_par = models.ForeignKey(Utilisateur, on_delete=models.SET_NULL, blank=True, null=True, related_name='salaire_enseignant_cree_par')
    cree_le = models.DateTimeField(auto_now_add=True)
    modifie_par = models.ForeignKey(Utilisateur, on_delete=models.SET_NULL, blank=True, null=True, related_name='salaire_enseignant_modifie_par')
    modifie_le = models.DateTimeField(auto_now=True)

    # Protection des données validées/payées, même pattern que tresorerie.Depense/Encaissement/
    # Virement/ArreteCaisse (cf. audit du 2026-10-14 : aucune protection n'existait).
    editable_statuses = ['BROUILLON']
    protected_fields = [
        'enseignant', 'affectation_enseignement', 'annee_scolaire', 'mois',
        'date_paiement', 'montant', 'compte'
    ]
    deletable_statuses = ['BROUILLON']

    class Meta:
        db_table = 'salaire_enseignant'
        verbose_name = 'Salaire Enseignant'
        verbose_name_plural = 'Salaires Enseignants'
        constraints = [
            models.UniqueConstraint(fields=['mouvement'], name='unq_salaire_enseignant_mouvement'),
        ]
        indexes = [
            models.Index(fields=['enseignant', 'annee_scolaire', 'mois']),
        ]

    def save(self, *args, **kwargs):
        if self.pk:
            try:
                original = SalaireEnseignant.objects.get(pk=self.pk)
            except SalaireEnseignant.DoesNotExist:
                pass
            else:
                if original.statut not in self.editable_statuses:
                    for field in self.protected_fields:
                        if getattr(original, field) != getattr(self, field):
                            raise ValidationError(
                                f"Le champ '{field}' ne peut pas être modifié pour un salaire "
                                f"avec le statut '{original.statut}'."
                            )
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.pk:
            try:
                original = SalaireEnseignant.objects.get(pk=self.pk)
            except SalaireEnseignant.DoesNotExist:
                pass
            else:
                if original.statut not in self.deletable_statuses:
                    raise ValidationError(
                        f"Suppression interdite pour un salaire avec le statut '{original.statut}'."
                    )
        super().delete(*args, **kwargs)

    def __str__(self):
        return f"Salaire {self.enseignant.nom} {self.enseignant.prenom} - {self.mois} {self.annee_scolaire}"


class SalaireAdministration(models.Model):
    STATUT_CHOICES = [
        ('BROUILLON', 'Brouillon'),
        ('VALIDÉ', 'Validé'),
        ('PAYÉ', 'Payé'),
    ]
    personnel_administratif = models.ForeignKey('rh_paie.PersonnelAdministratif', on_delete=models.CASCADE)
    annee_scolaire = models.ForeignKey('referentiel.AnneeScolaire', on_delete=models.CASCADE)
    mois = models.CharField(
        max_length=4,
        choices=[
            ('SEPT', 'Septembre'), ('OCT', 'Octobre'), ('NOV', 'Novembre'),
            ('DEC', 'Décembre'), ('JAN', 'Janvier'), ('FEV', 'Février'),
            ('MAR', 'Mars'), ('AVR', 'Avril'), ('MAI', 'Mai'),
            ('JUIN', 'Juin'), ('JUIL', 'Juillet'), ('AOUT', 'Août')
        ]
    )
    date_paiement = models.DateField()
    montant_du = models.DecimalField(max_digits=12, decimal_places=0)
    montant_paye = models.DecimalField(max_digits=12, decimal_places=0)
    compte = models.ForeignKey(Compte, on_delete=models.CASCADE)
    mouvement = models.BigIntegerField(null=True, blank=True)  # Will be ForeignKey to Mouvement after migration
    # Validation fields
    statut = models.CharField(max_length=10, choices=STATUT_CHOICES, default='BROUILLON')
    date_validation = models.DateTimeField(blank=True, null=True)
    valide_par = models.ForeignKey(Utilisateur, on_delete=models.SET_NULL, blank=True, null=True, related_name='salaire_administration_valide_par')
    cree_par = models.ForeignKey(Utilisateur, on_delete=models.SET_NULL, blank=True, null=True, related_name='salaire_administration_cree_par')
    cree_le = models.DateTimeField(auto_now_add=True)
    modifie_par = models.ForeignKey(Utilisateur, on_delete=models.SET_NULL, blank=True, null=True, related_name='salaire_administration_modifie_par')
    modifie_le = models.DateTimeField(auto_now=True)

    # Protection des données validées/payées, même pattern que tresorerie.Depense/Encaissement/
    # Virement/ArreteCaisse (cf. audit du 2026-10-14 : aucune protection n'existait).
    editable_statuses = ['BROUILLON']
    # `montant_paye` est volontairement exclu : il est mis à jour par le paiement lui-même
    # (VALIDÉ -> PAYÉ), ce n'est pas une donnée figée comme `montant_du`.
    protected_fields = [
        'personnel_administratif', 'annee_scolaire', 'mois',
        'date_paiement', 'montant_du', 'compte'
    ]
    deletable_statuses = ['BROUILLON']

    class Meta:
        db_table = 'salaire_administration'
        verbose_name = 'Salaire Administration'
        verbose_name_plural = 'Salaires Administrations'
        constraints = [
            models.UniqueConstraint(fields=['personnel_administratif', 'annee_scolaire', 'mois'], name='unq_salaire_admin'),
            models.UniqueConstraint(fields=['mouvement'], name='unq_salaire_admin_mouvement'),
        ]

    def save(self, *args, **kwargs):
        if self.pk:
            try:
                original = SalaireAdministration.objects.get(pk=self.pk)
            except SalaireAdministration.DoesNotExist:
                pass
            else:
                if original.statut not in self.editable_statuses:
                    for field in self.protected_fields:
                        if getattr(original, field) != getattr(self, field):
                            raise ValidationError(
                                f"Le champ '{field}' ne peut pas être modifié pour un salaire "
                                f"avec le statut '{original.statut}'."
                            )
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.pk:
            try:
                original = SalaireAdministration.objects.get(pk=self.pk)
            except SalaireAdministration.DoesNotExist:
                pass
            else:
                if original.statut not in self.deletable_statuses:
                    raise ValidationError(
                        f"Suppression interdite pour un salaire avec le statut '{original.statut}'."
                    )
        super().delete(*args, **kwargs)

    def __str__(self):
        return f"Salaire {self.personnel_administratif.nom} {self.personnel_administratif.prenom} - {self.mois} {self.annee_scolaire}"


class AvancePersonnel(models.Model):
    BENEFICIAIRE_CHOICES = [
        ('ENSEIGNANT', 'Enseignant'),
        ('ADMIN', 'Administratif')
    ]

    beneficiaire = models.CharField(max_length=10, choices=BENEFICIAIRE_CHOICES)
    enseignant = models.ForeignKey('rh_paie.Enseignant', on_delete=models.SET_NULL, blank=True, null=True)
    personnel_administratif = models.ForeignKey('rh_paie.PersonnelAdministratif', on_delete=models.SET_NULL, blank=True, null=True)
    date = models.DateField()
    montant = models.DecimalField(max_digits=12, decimal_places=0)
    motif = models.CharField(max_length=255, blank=True, null=True)
    compte = models.ForeignKey(Compte, on_delete=models.CASCADE)
    mouvement = models.BigIntegerField(null=True, blank=True)  # Will be ForeignKey to Mouvement after migration
    regularise_salaire_admin_id = models.IntegerField(blank=True, null=True)  # FK to salaire_administration
    regularisee = models.BooleanField(default=False)
    cree_par = models.ForeignKey(Utilisateur, on_delete=models.SET_NULL, blank=True, null=True, related_name='avance_personnel_cree_par')
    cree_le = models.DateTimeField(auto_now_add=True)
    modifie_par = models.ForeignKey(Utilisateur, on_delete=models.SET_NULL, blank=True, null=True, related_name='avance_personnel_modifie_par')
    modifie_le = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'avance_personnel'
        verbose_name = 'Avance Personnel'
        verbose_name_plural = 'Avances Personnel'
        constraints = [
            models.UniqueConstraint(fields=['mouvement'], name='unq_avance_personnel_mouvement'),
            models.CheckConstraint(
                check=(
                    (models.Q(beneficiaire='ENSEIGNANT') & models.Q(enseignant__isnull=False) & models.Q(personnel_administratif__isnull=True)) |
                    (models.Q(beneficiaire='ADMIN') & models.Q(personnel_administratif__isnull=False) & models.Q(enseignant__isnull=True))
                ),
                name='chk_avance_beneficiaire'
            ),
        ]

    # Protection des données régularisées, même pattern que SalaireEnseignant/SalaireAdministration
    # (cf. audit du 2026-10-14). `AvancePersonnel` n'a pas de `statut`, seulement `regularisee`.
    protected_fields = [
        'beneficiaire', 'enseignant', 'personnel_administratif', 'date', 'montant', 'compte'
    ]

    def save(self, *args, **kwargs):
        if self.pk:
            try:
                original = AvancePersonnel.objects.get(pk=self.pk)
            except AvancePersonnel.DoesNotExist:
                pass
            else:
                if original.regularisee:
                    for field in self.protected_fields:
                        if getattr(original, field) != getattr(self, field):
                            raise ValidationError(
                                f"Le champ '{field}' ne peut pas être modifié pour une avance déjà régularisée."
                            )
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.pk:
            try:
                original = AvancePersonnel.objects.get(pk=self.pk)
            except AvancePersonnel.DoesNotExist:
                pass
            else:
                if original.regularisee:
                    raise ValidationError("Suppression interdite pour une avance déjà régularisée.")
        super().delete(*args, **kwargs)

    def __str__(self):
        beneficiaire_nom = ""
        if self.beneficiaire == 'ENSEIGNANT' and self.enseignant:
            beneficiaire_nom = f"{self.enseignant.nom} {self.enseignant.prenom}"
        elif self.beneficiaire == 'ADMIN' and self.personnel_administratif:
            beneficiaire_nom = f"{self.personnel_administratif.nom} {self.personnel_administratif.prenom}"
        return f"Avance {beneficiaire_nom} - {self.date}"
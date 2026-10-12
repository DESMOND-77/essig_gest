from django.db import models
from django.core.validators import MinValueValidator
from referentiel.models import Matiere, Classe, Ecole
from scolarite.models import AnneeScolaire
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
    enseignant = models.ForeignKey('rh_paie.Enseignant', on_delete=models.CASCADE)
    affectation_enseignement = models.ForeignKey(
        'rh_paie.AffectationEnseignement',
        on_delete=models.SET_NULL,
        blank=True,
        null=True
    )
    annee_scolaire = models.ForeignKey('scolarite.AnneeScolaire', on_delete=models.CASCADE)
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
    mouvement = models.BigIntegerField()  # Will be ForeignKey to Mouvement after migration
    cree_par = models.ForeignKey(Utilisateur, on_delete=models.SET_NULL, blank=True, null=True)
    cree_le = models.DateTimeField(auto_now_add=True)
    modifie_par = models.ForeignKey(Utilisateur, on_delete=models.SET_NULL, blank=True, null=True)
    modifie_le = models.DateTimeField(auto_now=True)

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

    def __str__(self):
        return f"Salaire {self.enseignant.nom} {self.enseignant.prenom} - {self.mois} {self.annee_scolaire}"


class SalaireAdministration(models.Model):
    personnel_administratif = models.ForeignKey('rh_paie.PersonnelAdministratif', on_delete=models.CASCADE)
    annee_scolaire = models.ForeignKey('scolarite.AnneeScolaire', on_delete=models.CASCADE)
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
    mouvement = models.BigIntegerField()  # Will be ForeignKey to Mouvement after migration
    cree_par = models.ForeignKey(Utilisateur, on_delete=models.SET_NULL, blank=True, null=True)
    cree_le = models.DateTimeField(auto_now_add=True)
    modifie_par = models.ForeignKey(Utilisateur, on_delete=models.SET_NULL, blank=True, null=True)
    modifie_le = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'salaire_administration'
        verbose_name = 'Salaire Administration'
        verbose_name_plural = 'Salaires Administrations'
        constraints = [
            models.UniqueConstraint(fields=['personnel_administratif', 'annee_scolaire', 'mois'], name='unq_salaire_admin'),
            models.UniqueConstraint(fields=['mouvement'], name='unq_salaire_admin_mouvement'),
        ]

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
    mouvement = models.BigIntegerField()  # Will be ForeignKey to Mouvement after migration
    regularise_salaire_admin_id = models.IntegerField(blank=True, null=True)  # FK to salaire_administration
    regularisee = models.BooleanField(default=False)
    cree_par = models.ForeignKey(Utilisateur, on_delete=models.SET_NULL, blank=True, null=True)
    cree_le = models.DateTimeField(auto_now_add=True)
    modifie_par = models.ForeignKey(Utilisateur, on_delete=models.SET_NULL, blank=True, null=True)
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

    def __str__(self):
        beneficiaire_nom = ""
        if self.beneficiaire == 'ENSEIGNANT' and self.enseignant:
            beneficiaire_nom = f"{self.enseignant.nom} {self.enseignant.prenom}"
        elif self.beneficiaire == 'ADMIN' and self.personnel_administratif:
            beneficiaire_nom = f"{self.personnel_administratif.nom} {self.personnel_administratif.prenom}"
        return f"Avance {beneficiaire_nom} - {self.date}"
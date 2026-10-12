from django.db import models
from django.core.validators import MinValueValidator
from referentiel.models import Matiere, Classe
from scolarite.models import AnneeScolaire


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
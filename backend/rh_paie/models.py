from django.db import models
from django.core.validators import MinValueValidator


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
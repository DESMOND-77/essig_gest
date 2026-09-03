from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models

from .managers import UtilisateurManager


class Utilisateur(AbstractBaseUser, PermissionsMixin):
    login = models.CharField(max_length=60, unique=True)
    email = models.CharField(max_length=120)
    password = models.CharField(max_length=255, db_column="mot_de_passe_hash")
    actif = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    derniere_connexion = models.DateTimeField(null=True, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    objects = UtilisateurManager()

    USERNAME_FIELD = "login"
    REQUIRED_FIELDS = ["email"]

    class Meta:
        db_table = "utilisateur"

    def __str__(self):
        return self.login

    @property
    def is_active(self):
        return self.actif

    @is_active.setter
    def is_active(self, value):
        self.actif = value


class Role(models.Model):
    class Code(models.TextChoices):
        COMPTABLE = "COMPTABLE", "Comptable"
        DAF = "DAF", "Directeur administratif et financier"
        DIRECTION = "DIRECTION", "Direction"
        SCOLARITE = "SCOLARITE", "Scolarité"
        LECTURE = "LECTURE", "Lecture seule"

    code = models.CharField(max_length=20, choices=Code.choices, unique=True)
    libelle = models.CharField(max_length=80)

    class Meta:
        db_table = "role"

    def __str__(self):
        return self.code


class UtilisateurRole(models.Model):
    utilisateur = models.ForeignKey(
        "comptes.Utilisateur", on_delete=models.CASCADE, related_name="roles"
    )
    role = models.ForeignKey(Role, on_delete=models.RESTRICT)
    ecole = models.ForeignKey(
        "referentiel.Ecole",
        on_delete=models.RESTRICT,
        null=True,
        blank=True,
        db_column="ecole_id",
        db_index=True,
        related_name="+",
    )

    class Meta:
        db_table = "utilisateur_role"
        constraints = [
            models.UniqueConstraint(
                fields=["utilisateur", "role", "ecole"],
                name="uniq_utilisateur_role_ecole",
            )
        ]

    def __str__(self):
        return f"{self.utilisateur} / {self.role} / {self.ecole_id}"


class JournalAudit(models.Model):
    class Action(models.TextChoices):
        CREATION = "CREATION"
        MODIFICATION = "MODIFICATION"
        SUPPRESSION = "SUPPRESSION"

    utilisateur = models.ForeignKey(
        "comptes.Utilisateur", on_delete=models.SET_NULL, null=True
    )
    action = models.CharField(max_length=20, choices=Action.choices)
    table_cible = models.CharField(max_length=60)
    ligne_id = models.BigIntegerField()
    valeurs_avant = models.JSONField(null=True)
    valeurs_apres = models.JSONField(null=True)
    date = models.DateTimeField(auto_now_add=True)
    ip = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        db_table = "journal_audit"
        indexes = [
            models.Index(fields=["table_cible", "ligne_id"]),
            models.Index(fields=["utilisateur", "date"]),
        ]

    def __str__(self):
        return f"{self.action} {self.table_cible}#{self.ligne_id}"

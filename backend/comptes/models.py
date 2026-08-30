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

from django.conf import settings
from django.db import models


class Auditable(models.Model):
    """Colonnes d'audit inline (D-ORM-8) : qui/quand a créé et modifié la ligne.

    `cree_par`/`modifie_par` sont posés par `core.serializers.AuditableSerializerMixin`
    depuis l'utilisateur de la requête ; jamais fournis par le client.
    """

    cree_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        editable=False,
    )
    cree_le = models.DateTimeField(auto_now_add=True)
    modifie_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        editable=False,
    )
    modifie_le = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True

from django.contrib import admin

from . import models

admin.site.register(models.ModalitePaiement)

admin.site.register(models.TypeFrais)
admin.site.register(models.FraisInscription)
admin.site.register(models.Bourse)

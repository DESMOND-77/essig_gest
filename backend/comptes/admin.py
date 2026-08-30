from django.contrib import admin

from .models import Utilisateur


@admin.register(Utilisateur)
class UtilisateurAdmin(admin.ModelAdmin):
    list_display = ("login", "email", "actif", "is_staff", "date_creation")
    search_fields = ("login", "email")
    list_filter = ("actif", "is_staff", "is_superuser")
    readonly_fields = ("date_creation", "derniere_connexion", "last_login")

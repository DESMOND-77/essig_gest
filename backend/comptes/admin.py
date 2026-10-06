from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Role, Utilisateur, UtilisateurRole


@admin.register(Utilisateur)
class UtilisateurAdmin(UserAdmin):
    """Formulaires d'authentification standards de Django, adaptes aux champs
    du modele (`login` / `actif`, pas de `username` / `first_name`).

    Herite de `UserAdmin` : le formulaire de modification affiche l'empreinte
    en lecture seule (`ReadOnlyPasswordHashField`) et le formulaire de creation
    demande deux fois le mot de passe puis le hache — jamais de stockage en
    clair.
    """

    ordering = ("login",)
    list_display = ("login", "email", "actif", "is_staff", "date_creation")
    search_fields = ("login", "email")
    list_filter = ("actif", "is_staff", "is_superuser")
    readonly_fields = ("date_creation", "derniere_connexion", "last_login")
    filter_horizontal = ("groups", "user_permissions")
    fieldsets = (
        (None, {"fields": ("login", "password")}),
        ("Contact", {"fields": ("email",)}),
        (
            "Permissions",
            {
                "fields": (
                    "actif",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        ("Dates", {"fields": ("date_creation", "derniere_connexion", "last_login")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("login", "email", "password1", "password2"),
            },
        ),
    )

@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    """Formulaire d'administration des roles."""

    ordering = ("code",)
    list_display = ("code", "libelle")
    search_fields = ("code", "libelle")

@admin.register(UtilisateurRole)
class UtilisateurRoleAdmin(admin.ModelAdmin):
    """Formulaire d'administration des roles des utilisateurs."""

    ordering = ("utilisateur", "role", "ecole")
    list_display = ("utilisateur", "role", "ecole")
    search_fields = ("utilisateur__login", "role__code", "ecole__nom")
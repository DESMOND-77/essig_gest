# backend/rh_paie/permissions.py
from rest_framework import permissions


class RH_PaiePermission(permissions.BasePermission):
    """
    Permission personnalisée pour le module RH & Paie.

    Lecture : COMPTABLE, DAF, DIRECTION, SCOLARITE, LECTURE
    Écriture : COMPTABLE, DAF
    """

    def has_permission(self, request, view):
        # Vérifier que l'utilisateur est authentifié
        if not request.user or not request.user.is_authenticated:
            return False

        # Obtenir les rôles de l'utilisateur
        user_roles = request.user.roles.values_list('role__code', flat=True)

        # Définir les rôles autorisés selon le type d'opération
        if request.method in permissions.SAFE_METHODS:  # GET, HEAD, OPTIONS
            # Lecture autorisée pour plusieurs rôles
            autorises_lecture = ['COMPTABLE', 'DAF', 'DIRECTION', 'SCOLARITE', 'LECTURE']
            return any(role in user_roles for role in autorises_lecture)
        else:
            # Écriture, création, suppression - plus restrictif
            autorises_ecriture = ['COMPTABLE', 'DAF']
            return any(role in user_roles for role in autorises_ecriture)


class RH_PaieValidationPermission(permissions.BasePermission):
    """
    Permission pour les opérations de validation (workflow d'approbation).
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        # Obtenir les rôles de l'utilisateur
        user_roles = request.user.roles.values_list('role__code', flat=True)
        # Validation autorisée pour DAF, DIRECTION, COMPTABLE
        autorises_validation = ['DAF', 'DIRECTION', 'COMPTABLE']
        return any(role in user_roles for role in autorises_validation)
# backend/tresorerie/permissions.py
from rest_framework import permissions
from comptes.models import Utilisateur


class TresoreriePermission(permissions.BasePermission):
    """
    Permission personnalisée pour le module trésorerie.

    Lecture : COMPTABLE, DAF, DIRECTION, SCOLARITE, LECTURE
    Écriture : COMPTABLE, DAF (selon seuils et types d'opérations)
    Validation : DAF, DIRECTION, COMPTABLE (workflow d'approbation)
    """

    def has_permission(self, request, view):
        # Vérifier que l'utilisateur est authentifié
        if not request.user or not request.user.is_authenticated:
            return False

        # Obtenir le rôle de l'utilisateur
        user_roles = request.user.groups.values_list('name', flat=True)

        # Définir les rôles autorisés selon le type d'opération
        if request.method in permissions.SAFE_METHODS:  # GET, HEAD, OPTIONS
            # Lecture autorisée pour plusieurs rôles
            autorises_lecture = ['COMPTABLE', 'DAF', 'DIRECTION', 'SCOLARITE', 'LECTURE']
            return any(role in user_roles for role in autorises_lecture)
        else:
            # Écriture, création, suppression - plus restrictif
            autorises_ecriture = ['COMPTABLE', 'DAF']
            return any(role in user_roles for role in autorises_ecriture)


class TresorerieValidationPermission(permissions.BasePermission):
    """
    Permission pour les opérations de validation (workflow d'approbation).
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        user_roles = request.user.groups.values_list('name', flat=True)
        # Validation autorisée pour DAF, DIRECTION, COMPTABLE
        autorises_validation = ['DAF', 'DIRECTION', 'COMPTABLE']
        return any(role in user_roles for role in autorises_validation)


class TresorerieLectureSeulePermission(permissions.BasePermission):
    """
    Permission lecture seule pour certains endpoints.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        user_roles = request.user.groups.values_list('name', flat=True)
        # Lecture seule autorisée pour tous les rôles authentifiés
        return True  # Tous les utilisateurs authentifiés peuvent lire en base


class IsCompteOwnerOrReadOnly(permissions.BasePermission):
    """
    Permission personnalisée pour vérifier que l'utilisateur appartient
    au même groupe scolaire que le compte.
    """

    def has_object_permission(self, request, view, obj):
        # Lecture autorisée pour tous les rôles authentifiés
        if request.method in permissions.SAFE_METHODS:
            user_roles = request.user.groups.values_list('name', flat=True)
            autorises_lecture = ['COMPTABLE', 'DAF', 'DIRECTION', 'SCOLARITE', 'LECTURE']
            return any(role in user_roles for role in autorises_lecture)

        # Pour les opérations d'écriture, vérifier l'appartenance au groupe scolaire
        if hasattr(obj, 'groupe_scolaire'):
            user_groupscolaire = request.user.groupe_scolaire_id if hasattr(request.user, 'groupe_scolaire_id') else None
            return user_groupscolaire == obj.groupe_scolaire_id

        # Pour les objets liés à un compte, vérifier via le compte
        if hasattr(obj, 'compte'):
            user_groupscolaire = request.user.groupe_scolaire_id if hasattr(request.user, 'groupe_scolaire_id') else None
            return user_groupscolaire == obj.compte.groupe_scolaire_id

        # Par défaut, refuser l'écriture si on ne peut pas déterminer l'appartenance
        return False
# backend/tresorerie/permissions.py
from rest_framework import permissions


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

        # Obtenir les rôles de l'utilisateur. Régression : ce fichier utilisait
        # `request.user.groups` (groupes Django standard, jamais peuplés dans ce projet —
        # les rôles sont assignés via `comptes.UtilisateurRole`, cf. rh_paie/referentiel/
        # personnes/scolarite permissions.py), ce qui bloquait silencieusement TOUTE écriture
        # et TOUTE validation sur l'ensemble du module trésorerie, pour tous les rôles.
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


class TresorerieValidationPermission(permissions.BasePermission):
    """
    Permission pour les opérations de validation (workflow d'approbation).
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        user_roles = request.user.roles.values_list('role__code', flat=True)
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

        # Lecture seule autorisée pour tous les utilisateurs authentifiés.
        return True


class IsCompteOwnerOrReadOnly(permissions.BasePermission):
    """
    Permission d'écriture sur les comptes de trésorerie.

    Régression : cette classe comparait `request.user.groupe_scolaire_id` à
    `obj.groupe_scolaire_id`, mais `comptes.Utilisateur` n'a pas de champ
    `groupe_scolaire` (CLAUDE.md : « un seul groupe scolaire », notion non modélisée sur
    l'utilisateur) — la comparaison valait toujours `None == <id>`, donc refusait
    systématiquement l'écriture, pour tout le monde. Le projet étant mono-groupe-scolaire en v1
    (multi-tenant explicitement hors périmètre, CLAUDE.md §9), l'autorisation d'écriture se
    résume au contrôle par rôle, identique à `TresoreriePermission`.
    """

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            user_roles = request.user.roles.values_list('role__code', flat=True)
            autorises_lecture = ['COMPTABLE', 'DAF', 'DIRECTION', 'SCOLARITE', 'LECTURE']
            return any(role in user_roles for role in autorises_lecture)

        user_roles = request.user.roles.values_list('role__code', flat=True)
        autorises_ecriture = ['COMPTABLE', 'DAF']
        return any(role in user_roles for role in autorises_ecriture)
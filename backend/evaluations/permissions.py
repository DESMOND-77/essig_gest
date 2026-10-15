from rest_framework.permissions import SAFE_METHODS, BasePermission

from comptes.permissions import ARole

_EcritEvaluations = ARole("SCOLARITE", "DIRECTION")


class PeutEcrireEvaluations(BasePermission):
    message = "Rôle SCOLARITE ou DIRECTION requis."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return _EcritEvaluations().has_permission(request, view)

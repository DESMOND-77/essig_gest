from rest_framework.permissions import SAFE_METHODS, BasePermission

from comptes.permissions import ARole

_EcritEvaluations = ARole("SCOLARITE", "DIRECTION")
_ValideDeliberation = ARole("DIRECTION")


class PeutEcrireEvaluations(BasePermission):
    message = "Rôle SCOLARITE ou DIRECTION requis."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return _EcritEvaluations().has_permission(request, view)


class PeutValiderDeliberation(BasePermission):
    message = "Rôle DIRECTION requis pour valider une délibération."

    def has_permission(self, request, view):
        return _ValideDeliberation().has_permission(request, view)

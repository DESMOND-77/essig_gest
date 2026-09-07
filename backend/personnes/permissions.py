from rest_framework.permissions import SAFE_METHODS, BasePermission

from comptes.permissions import ARole

_EcritPersonnes = ARole("DIRECTION", "SCOLARITE")
_EcritInscriptions = ARole("DIRECTION", "SCOLARITE")


class PeutEcrirePersonnes(BasePermission):
    message = "Rôle DIRECTION ou SCOLARITE requis pour modifier les personnes."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return _EcritPersonnes().has_permission(request, view)


class PeutEcrireInscriptions(BasePermission):
    message = "Rôle DIRECTION ou SCOLARITE requis pour les inscriptions."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return _EcritInscriptions().has_permission(request, view)

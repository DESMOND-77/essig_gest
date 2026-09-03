from rest_framework.permissions import SAFE_METHODS, BasePermission

from comptes.permissions import ARole

_EcritDirection = ARole("DIRECTION")
_EcritPedago = ARole("DIRECTION", "SCOLARITE")


class PeutEcrireReferentiel(BasePermission):
    message = "Rôle DIRECTION requis pour modifier ce référentiel."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return _EcritDirection().has_permission(request, view)


class PeutEcrirePedagogique(BasePermission):
    message = "Rôle DIRECTION ou SCOLARITE requis."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return _EcritPedago().has_permission(request, view)

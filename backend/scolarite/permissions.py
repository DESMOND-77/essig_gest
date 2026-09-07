from rest_framework.permissions import SAFE_METHODS, BasePermission

from comptes.permissions import ARole

_EcritTarifs = ARole("DIRECTION")
_EcritFraisEleve = ARole("DIRECTION", "DAF", "COMPTABLE")


class _BasePerm(BasePermission):
    _arole = None
    message = "Rôle insuffisant."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return self._arole().has_permission(request, view)


class PeutEcrireTarifs(_BasePerm):
    _arole = _EcritTarifs
    message = "Rôle DIRECTION requis pour la grille tarifaire."


class PeutEcrireFraisEleve(_BasePerm):
    _arole = _EcritFraisEleve
    message = "Rôle COMPTABLE, DAF ou DIRECTION requis."

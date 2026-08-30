from rest_framework.permissions import SAFE_METHODS, BasePermission


def _codes(user):
    if not user or not user.is_authenticated:
        return set()
    return {ur.role.code for ur in user.roles.select_related("role").all()}


def ARole(*codes):
    autorises = set(codes)

    class _ARole(BasePermission):
        message = "Rôle insuffisant."

        def has_permission(self, request, view):
            u = request.user
            if u and u.is_superuser:
                return True
            return bool(autorises & _codes(u))

    return _ARole


class EcritureInterditeEnLecture(BasePermission):
    message = "Compte en lecture seule."

    def has_permission(self, request, view):
        u = request.user
        if not u or not u.is_authenticated:
            return False
        if request.method in SAFE_METHODS or u.is_superuser:
            return True
        codes = _codes(u)
        return codes != {"LECTURE"} and len(codes) > 0

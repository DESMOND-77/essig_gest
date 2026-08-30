"""Exceptions API typées — messages français, codes stables.

Adapté de `core/exceptions.py` du projet gestion_p. Utilisées telles quelles
(`raise CompteDesactiveException()`), DRF produit la réponse d'erreur standard.
"""

from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import APIException


class CompteDesactiveException(APIException):
    status_code = 403
    default_detail = _("Ce compte est désactivé. Contactez un administrateur.")
    default_code = "compte_desactive"


class JetonInvalideException(APIException):
    status_code = 401
    default_detail = _("Le jeton fourni est invalide ou a expiré.")
    default_code = "jeton_invalide"


class PermissionRefuseeException(APIException):
    status_code = 403
    default_detail = _("Vous n'avez pas la permission d'effectuer cette action.")
    default_code = "permission_refusee"


class LimiteDebitDepasseeException(APIException):
    status_code = 429
    default_detail = _("Trop de requêtes. Réessayez plus tard.")
    default_code = "limite_debit_depassee"

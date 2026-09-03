from django.db.models import ProtectedError, RestrictedError

from .exceptions import ConflitSuppressionException


class SuppressionProtegeeMixin:
    """Traduit un refus d'intégrité référentielle (`on_delete=RESTRICT`/`PROTECT`)
    en réponse HTTP 409 au lieu d'une 500. À placer AVANT les autres mixins de
    suppression dans la MRO : il délègue la suppression réelle (et l'audit) à
    `super().perform_destroy()`."""

    def perform_destroy(self, instance):
        try:
            super().perform_destroy(instance)
        except (RestrictedError, ProtectedError) as exc:
            raise ConflitSuppressionException() from exc

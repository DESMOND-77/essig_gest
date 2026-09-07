from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets

from comptes.audit import AuditLogMixin
from core.mixins import SuppressionProtegeeMixin


class _BaseCrudViewSet(SuppressionProtegeeMixin, AuditLogMixin, viewsets.ModelViewSet):
    """Base CRUD partagée par les modules métier.

    MRO : `SuppressionProtegeeMixin` (traduit RESTRICT/PROTECT en 409, enveloppe
    `super().perform_destroy`) → `AuditLogMixin` (journalise create/update/destroy)
    → `ModelViewSet`. Les sous-classes fixent `permission_classes`, `queryset`,
    `serializer_class`, `filterset_class`, `search_fields`, `ordering_fields`.
    """

    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    ordering = ["id"]

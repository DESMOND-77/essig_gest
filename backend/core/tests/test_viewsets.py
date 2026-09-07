from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets

from comptes.audit import AuditLogMixin
from core.mixins import SuppressionProtegeeMixin
from core.viewsets import _BaseCrudViewSet


def test_base_crud_viewset_mro_et_config():
    assert issubclass(_BaseCrudViewSet, viewsets.ModelViewSet)
    mro = _BaseCrudViewSet.__mro__
    # SuppressionProtegeeMixin doit précéder AuditLogMixin (il enveloppe super()).
    assert mro.index(SuppressionProtegeeMixin) < mro.index(AuditLogMixin)
    assert _BaseCrudViewSet.filter_backends == [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    assert _BaseCrudViewSet.ordering == ["id"]
    # Pas de permission par défaut : chaque module fixe la sienne.
    assert "permission_classes" not in _BaseCrudViewSet.__dict__

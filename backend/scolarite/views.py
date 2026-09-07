from drf_spectacular.utils import extend_schema

from core.viewsets import _BaseCrudViewSet

from . import filters as s_filters
from . import models, permissions, serializers


@extend_schema(tags=["scolarite"])
class _BaseScolariteViewSet(_BaseCrudViewSet):
    pass


class ModalitePaiementViewSet(_BaseScolariteViewSet):
    permission_classes = [permissions.PeutEcrireTarifs]
    queryset = models.ModalitePaiement.objects.select_related(
        "niveau", "annee_scolaire"
    )
    serializer_class = serializers.ModalitePaiementSerializer
    filterset_class = s_filters.ModalitePaiementFilter
    ordering_fields = ["id"]


class EcheanceViewSet(_BaseScolariteViewSet):
    permission_classes = [permissions.PeutEcrireFraisEleve]
    queryset = models.Echeance.objects.select_related(
        "inscription", "cree_par", "modifie_par"
    )
    serializer_class = serializers.EcheanceSerializer
    filterset_class = s_filters.EcheanceFilter
    ordering_fields = ["numero", "date_prevue", "id"]

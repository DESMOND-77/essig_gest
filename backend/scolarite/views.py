from drf_spectacular.utils import extend_schema

from core.viewsets import _BaseCrudViewSet

from . import filters as s_filters
from . import models, permissions, serializers


@extend_schema(tags=["scolarite"])
class _BaseScolariteViewSet(_BaseCrudViewSet):
    pass


class TypeFraisViewSet(_BaseScolariteViewSet):
    permission_classes = [permissions.PeutEcrireTarifs]
    queryset = models.TypeFrais.objects.all()
    serializer_class = serializers.TypeFraisSerializer
    filterset_class = s_filters.TypeFraisFilter
    search_fields = ["code", "libelle"]
    ordering_fields = ["code", "id"]


class FraisInscriptionViewSet(_BaseScolariteViewSet):
    permission_classes = [permissions.PeutEcrireFraisEleve]
    queryset = models.FraisInscription.objects.select_related(
        "inscription", "type_frais", "cree_par", "modifie_par"
    )
    serializer_class = serializers.FraisInscriptionSerializer
    filterset_class = s_filters.FraisInscriptionFilter
    ordering_fields = ["id"]


class BourseViewSet(_BaseScolariteViewSet):
    permission_classes = [permissions.PeutEcrireFraisEleve]
    queryset = models.Bourse.objects.select_related(
        "inscription", "cree_par", "modifie_par"
    )
    serializer_class = serializers.BourseSerializer
    filterset_class = s_filters.BourseFilter
    search_fields = ["organisme"]
    ordering_fields = ["id"]


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

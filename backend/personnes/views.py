from drf_spectacular.utils import extend_schema

from core.viewsets import _BaseCrudViewSet

from . import filters as p_filters
from . import models, permissions, serializers


@extend_schema(tags=["personnes"])
class _BasePersonnesViewSet(_BaseCrudViewSet):
    permission_classes = [permissions.PeutEcrirePersonnes]


class EtudiantViewSet(_BasePersonnesViewSet):
    queryset = models.Etudiant.objects.prefetch_related("affiliations").select_related(
        "situation_bac"
    )
    filterset_class = p_filters.EtudiantFilter
    search_fields = ["matricule", "nom", "prenoms"]
    ordering_fields = ["nom", "matricule", "id"]

    def get_serializer_class(self):
        if self.action == "list":
            return serializers.EtudiantListSerializer
        return serializers.EtudiantSerializer


class AffiliationViewSet(_BasePersonnesViewSet):
    queryset = models.Affiliation.objects.select_related("etudiant")
    serializer_class = serializers.AffiliationSerializer
    filterset_class = p_filters.AffiliationFilter
    search_fields = ["nom", "prenom"]
    ordering_fields = ["id"]


class SituationBacViewSet(_BasePersonnesViewSet):
    queryset = models.SituationBac.objects.select_related("etudiant")
    serializer_class = serializers.SituationBacSerializer
    filterset_class = p_filters.SituationBacFilter
    ordering_fields = ["id"]


class TypePieceViewSet(_BasePersonnesViewSet):
    queryset = models.TypePiece.objects.all()
    serializer_class = serializers.TypePieceSerializer
    filterset_class = p_filters.TypePieceFilter
    search_fields = ["code", "libelle"]
    ordering_fields = ["code", "id"]

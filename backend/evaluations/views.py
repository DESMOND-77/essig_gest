from drf_spectacular.utils import extend_schema

from core.viewsets import _BaseCrudViewSet

from . import filters as e_filters
from . import models, permissions, serializers


@extend_schema(tags=["evaluations"])
class _BaseEvaluationsViewSet(_BaseCrudViewSet):
    permission_classes = [permissions.PeutEcrireEvaluations]


class EvaluationViewSet(_BaseEvaluationsViewSet):
    queryset = models.Evaluation.objects.select_related(
        "matiere", "classe", "session_examen"
    )
    serializer_class = serializers.EvaluationSerializer
    filterset_class = e_filters.EvaluationFilter
    ordering_fields = ["date", "id"]


class NoteEvaluationViewSet(_BaseEvaluationsViewSet):
    queryset = models.NoteEvaluation.objects.select_related("evaluation", "inscription")
    serializer_class = serializers.NoteEvaluationSerializer
    filterset_class = e_filters.NoteEvaluationFilter
    ordering_fields = ["id"]

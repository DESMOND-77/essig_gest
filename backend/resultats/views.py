from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response

from core.viewsets import _BaseCrudViewSet

from . import filters as r_filters
from . import models, permissions, serializers, services


@extend_schema(tags=["resultats"])
class DeliberationViewSet(_BaseCrudViewSet):
    permission_classes = [permissions.PeutEcrireEvaluations]
    queryset = models.Deliberation.objects.select_related("classe", "session_examen", "periode")
    serializer_class = serializers.DeliberationSerializer
    filterset_class = r_filters.DeliberationFilter
    ordering_fields = ["date", "id"]

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[permissions.PeutValiderDeliberation],
    )
    @extend_schema(responses=OpenApiTypes.OBJECT)
    def valider(self, request, pk=None):
        """Déclenche le calcul figé : résultats de matière (si la délibération porte
        une période) puis, si `inscription_id`/`annee_scolaire_id` sont fournis dans
        le corps, le calcul de la période et/ou de l'année pour cette inscription."""
        delib = self.get_object()
        try:
            if delib.periode_id is not None:
                services.deliberer_session(delib.id)

            inscription_id = request.data.get("inscription_id")
            annee_scolaire_id = request.data.get("annee_scolaire_id")
            if inscription_id and delib.periode_id is not None:
                services.deliberer_periode(inscription_id, delib.periode_id)
            if inscription_id and annee_scolaire_id:
                services.deliberer_annee(
                    inscription_id, annee_scolaire_id, valide_par=request.user.id
                )
        except DjangoValidationError as exc:
            detail = exc.message if hasattr(exc, "message") else exc.messages
            raise DRFValidationError(detail) from exc

        serializer = self.get_serializer(self.get_object())
        return Response(serializer.data)


@extend_schema(tags=["resultats"])
class DetteCreditViewSet(_BaseCrudViewSet):
    permission_classes = [permissions.PeutEcrireEvaluations]
    queryset = models.DetteCredit.objects.select_related(
        "inscription_origine", "matiere", "annee_origine"
    )
    serializer_class = serializers.DetteCreditSerializer
    filterset_class = r_filters.DetteCreditFilter
    ordering_fields = ["id"]


@extend_schema(tags=["resultats"])
class ResultatMatiereViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = models.ResultatMatiere.objects.select_related("inscription", "matiere", "periode")
    serializer_class = serializers.ResultatMatiereSerializer
    filterset_class = r_filters.ResultatMatiereFilter
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "inscription__etudiant__matricule",
        "inscription__etudiant__nom",
        "inscription__etudiant__prenoms",
        "matiere__nom",
        "matiere__code",
    ]
    ordering_fields = ["id"]


@extend_schema(tags=["resultats"])
class ResultatPeriodeViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = models.ResultatPeriode.objects.select_related("inscription", "periode")
    serializer_class = serializers.ResultatPeriodeSerializer
    filterset_class = r_filters.ResultatPeriodeFilter
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "inscription__etudiant__matricule",
        "inscription__etudiant__nom",
        "inscription__etudiant__prenoms",
    ]
    ordering_fields = ["id"]


@extend_schema(tags=["resultats"])
class ResultatAnnuelViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = models.ResultatAnnuel.objects.select_related("inscription", "annee_scolaire")
    serializer_class = serializers.ResultatAnnuelSerializer
    filterset_class = r_filters.ResultatAnnuelFilter
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "inscription__etudiant__matricule",
        "inscription__etudiant__nom",
        "inscription__etudiant__prenoms",
    ]
    ordering_fields = ["id"]

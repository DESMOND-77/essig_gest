from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework.decorators import action
from rest_framework.response import Response

from core.viewsets import _BaseCrudViewSet
from scolarite.services import calculer_reste_a_payer_inscription

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

    def perform_create(self, serializer):
        # Par symétrie avec InscriptionViewSet : si l'insertion échoue après l'incrément du
        # compteur de matricule (generer_matricule), la transaction annule aussi l'incrément
        # plutôt que de "brûler" un numéro de matricule.
        with transaction.atomic():
            super().perform_create(serializer)  # AuditLogMixin.perform_create


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


class InscriptionViewSet(_BasePersonnesViewSet):
    permission_classes = [permissions.PeutEcrireInscriptions]
    queryset = models.Inscription.objects.select_related(
        "etudiant", "classe__niveau__ecole", "annee_scolaire", "cree_par", "modifie_par"
    # `bourses` reste absent : `Bourse` n'a pas de FK `inscription` (seulement
    # `etudiant`+`annee_scolaire`, cf. scolarite/models.py) — hors scope de cette
    # correction. `frais_inscription` restauré : la relation est désormais réelle
    # (FraisInscription.inscription, cf. db/migrations/004_scolarite_facturation.sql).
    ).prefetch_related("echeances", "pieces_dossier", "frais_inscription")
    filterset_class = p_filters.InscriptionFilter
    search_fields = ["numero_ordre", "etudiant__matricule", "etudiant__nom"]
    ordering_fields = ["numero_ordre", "date_inscription", "id"]

    def get_serializer_class(self):
        if self.action == "list":
            return serializers.InscriptionListSerializer
        return serializers.InscriptionSerializer

    def perform_create(self, serializer):
        with transaction.atomic():
            super().perform_create(serializer)  # AuditLogMixin.perform_create

    @extend_schema(responses=OpenApiTypes.OBJECT)
    @action(detail=True, methods=["get"], url_path="reste-a-payer")
    def reste_a_payer(self, request, pk=None):
        """Reste à payer courant de l'inscription (échéances dues - montants déjà imputés).

        Calcul informatif, exposé pour que le frontend puisse l'afficher avant un encaissement
        (cf. scolarite.services.calculer_reste_a_payer_inscription) ; le backend reste seul
        responsable du contrôle réel au moment de l'imputation.
        """
        try:
            reste = calculer_reste_a_payer_inscription(pk)
        except ObjectDoesNotExist:
            return Response({"detail": "Inscription introuvable."}, status=404)
        return Response({"reste_a_payer": reste})


class PieceDossierViewSet(_BasePersonnesViewSet):
    permission_classes = [permissions.PeutEcrireInscriptions]
    queryset = models.PieceDossier.objects.select_related("inscription", "type_piece")
    serializer_class = serializers.PieceDossierSerializer
    filterset_class = p_filters.PieceDossierFilter
    ordering_fields = ["id"]

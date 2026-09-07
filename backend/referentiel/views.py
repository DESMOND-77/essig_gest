from drf_spectacular.utils import extend_schema

from core.viewsets import _BaseCrudViewSet

from . import filters as ref_filters
from . import models, permissions, serializers


@extend_schema(tags=["referentiel"])
class _BaseReferentielViewSet(_BaseCrudViewSet):
    permission_classes = [permissions.PeutEcrireReferentiel]


class GroupeScolaireViewSet(_BaseReferentielViewSet):
    queryset = models.GroupeScolaire.objects.all()
    serializer_class = serializers.GroupeScolaireSerializer
    filterset_class = ref_filters.GroupeScolaireFilter
    search_fields = ["nom", "sigle"]
    ordering_fields = ["nom", "id"]


class EcoleViewSet(_BaseReferentielViewSet):
    queryset = models.Ecole.objects.select_related("groupe_scolaire")
    serializer_class = serializers.EcoleSerializer
    filterset_class = ref_filters.EcoleFilter
    search_fields = ["nom", "sigle"]
    ordering_fields = ["nom", "id"]


class AnneeScolaireViewSet(_BaseReferentielViewSet):
    queryset = models.AnneeScolaire.objects.all()
    serializer_class = serializers.AnneeScolaireSerializer
    filterset_class = ref_filters.AnneeScolaireFilter
    search_fields = ["libelle"]
    ordering_fields = ["libelle", "date_debut", "id"]


class ModaliteFormationViewSet(_BaseReferentielViewSet):
    queryset = models.ModaliteFormation.objects.all()
    serializer_class = serializers.ModaliteFormationSerializer
    filterset_class = ref_filters.ModaliteFormationFilter
    search_fields = ["code", "libelle"]
    ordering_fields = ["code", "id"]


class NiveauViewSet(_BaseReferentielViewSet):
    queryset = models.Niveau.objects.select_related("ecole")
    serializer_class = serializers.NiveauSerializer
    filterset_class = ref_filters.NiveauFilter
    search_fields = ["code", "libelle"]
    ordering_fields = ["ordre", "code", "id"]
    ordering = ["ordre"]


class FiliereViewSet(_BaseReferentielViewSet):
    queryset = models.Filiere.objects.select_related("ecole")
    serializer_class = serializers.FiliereSerializer
    filterset_class = ref_filters.FiliereFilter
    search_fields = ["nom", "sigle"]
    ordering_fields = ["nom", "sigle", "id"]


class OptionFiliereViewSet(_BaseReferentielViewSet):
    queryset = models.OptionFiliere.objects.select_related("filiere")
    serializer_class = serializers.OptionFiliereSerializer
    filterset_class = ref_filters.OptionFiliereFilter
    search_fields = ["nom", "sigle"]
    ordering_fields = ["nom", "sigle", "id"]


class ClasseViewSet(_BaseReferentielViewSet):
    permission_classes = [permissions.PeutEcrirePedagogique]
    queryset = models.Classe.objects.select_related(
        "annee_scolaire", "niveau", "option_filiere", "modalite_formation"
    )
    serializer_class = serializers.ClasseSerializer
    filterset_class = ref_filters.ClasseFilter
    search_fields = ["libelle_auto"]
    ordering_fields = ["libelle_auto", "id"]


class MatiereViewSet(_BaseReferentielViewSet):
    permission_classes = [permissions.PeutEcrirePedagogique]
    queryset = models.Matiere.objects.select_related("niveau", "option_filiere")
    serializer_class = serializers.MatiereSerializer
    filterset_class = ref_filters.MatiereFilter
    search_fields = ["nom", "code"]
    ordering_fields = ["nom", "code", "id"]


class PeriodeViewSet(_BaseReferentielViewSet):
    permission_classes = [permissions.PeutEcrirePedagogique]
    queryset = models.Periode.objects.select_related("annee_scolaire")
    serializer_class = serializers.PeriodeSerializer
    filterset_class = ref_filters.PeriodeFilter
    search_fields = ["libelle"]
    ordering_fields = ["numero", "id"]
    ordering = ["numero"]


class SessionExamenViewSet(_BaseReferentielViewSet):
    permission_classes = [permissions.PeutEcrirePedagogique]
    queryset = models.SessionExamen.objects.select_related("periode")
    serializer_class = serializers.SessionExamenSerializer
    filterset_class = ref_filters.SessionExamenFilter
    search_fields = ["type"]
    ordering_fields = ["type", "id"]

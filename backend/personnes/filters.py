import django_filters as df

from . import models


class EtudiantFilter(df.FilterSet):
    a_le_bac = df.BooleanFilter(field_name="situation_bac__a_le_bac")

    class Meta:
        model = models.Etudiant
        fields = {
            "sexe": ["exact"],
            "nationalite": ["exact"],
            "situation_matrimoniale": ["exact"],
        }


class AffiliationFilter(df.FilterSet):
    class Meta:
        model = models.Affiliation
        fields = {"etudiant": ["exact"], "type": ["exact"]}


class SituationBacFilter(df.FilterSet):
    class Meta:
        model = models.SituationBac
        fields = {"etudiant": ["exact"], "a_le_bac": ["exact"], "mention": ["exact"]}


class TypePieceFilter(df.FilterSet):
    class Meta:
        model = models.TypePiece
        fields = {"code": ["icontains"]}

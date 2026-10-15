import django_filters as df

from . import models


class DeliberationFilter(df.FilterSet):
    class Meta:
        model = models.Deliberation
        fields = {
            "classe": ["exact"],
            "session_examen": ["exact"],
            "periode": ["exact"],
            "statut": ["exact"],
        }


class DetteCreditFilter(df.FilterSet):
    class Meta:
        model = models.DetteCredit
        fields = {
            "inscription_origine": ["exact"],
            "matiere": ["exact"],
            "soldee": ["exact"],
        }


class ResultatMatiereFilter(df.FilterSet):
    class Meta:
        model = models.ResultatMatiere
        fields = {"inscription": ["exact"], "matiere": ["exact"], "periode": ["exact"]}


class ResultatPeriodeFilter(df.FilterSet):
    class Meta:
        model = models.ResultatPeriode
        fields = {"inscription": ["exact"], "periode": ["exact"]}


class ResultatAnnuelFilter(df.FilterSet):
    class Meta:
        model = models.ResultatAnnuel
        fields = {"inscription": ["exact"], "annee_scolaire": ["exact"], "decision": ["exact"]}

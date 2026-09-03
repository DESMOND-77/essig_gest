import django_filters as df

from . import models


class GroupeScolaireFilter(df.FilterSet):
    class Meta:
        model = models.GroupeScolaire
        fields = {"nom": ["icontains"]}


class EcoleFilter(df.FilterSet):
    class Meta:
        model = models.Ecole
        fields = {"groupe_scolaire": ["exact"], "pole": ["exact"], "regime": ["exact"]}


class AnneeScolaireFilter(df.FilterSet):
    class Meta:
        model = models.AnneeScolaire
        fields = {"est_courante": ["exact"], "libelle": ["icontains"]}


class ModaliteFormationFilter(df.FilterSet):
    class Meta:
        model = models.ModaliteFormation
        fields = {"code": ["exact"]}


class NiveauFilter(df.FilterSet):
    class Meta:
        model = models.Niveau
        fields = {"ecole": ["exact"], "code": ["icontains"]}


class FiliereFilter(df.FilterSet):
    class Meta:
        model = models.Filiere
        fields = {"ecole": ["exact"], "sigle": ["icontains"]}


class OptionFiliereFilter(df.FilterSet):
    class Meta:
        model = models.OptionFiliere
        fields = {"filiere": ["exact"]}


class ClasseFilter(df.FilterSet):
    class Meta:
        model = models.Classe
        fields = {
            "annee_scolaire": ["exact"],
            "niveau": ["exact"],
            "option_filiere": ["exact"],
            "modalite_formation": ["exact"],
        }


class MatiereFilter(df.FilterSet):
    class Meta:
        model = models.Matiere
        fields = {
            "niveau": ["exact"],
            "option_filiere": ["exact"],
            "semestre": ["exact"],
        }


class PeriodeFilter(df.FilterSet):
    class Meta:
        model = models.Periode
        fields = {"annee_scolaire": ["exact"], "numero": ["exact"]}


class SessionExamenFilter(df.FilterSet):
    class Meta:
        model = models.SessionExamen
        fields = {"periode": ["exact"], "type": ["exact"]}

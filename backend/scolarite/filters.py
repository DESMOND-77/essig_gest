import django_filters as df

from . import models


class ModalitePaiementFilter(df.FilterSet):
    class Meta:
        model = models.ModalitePaiement
        fields = {"niveau": ["exact"], "annee_scolaire": ["exact"]}


class EcheanceFilter(df.FilterSet):
    class Meta:
        model = models.Echeance
        fields = {
            "inscription": ["exact"],
            "numero": ["exact"],
        }


class TypeFraisFilter(df.FilterSet):
    class Meta:
        model = models.TypeFrais
        fields = {
            "libelle": ["exact"],
            "code": ["exact"],
        }


class FraisInscriptionFilter(df.FilterSet):
    class Meta:
        model = models.FraisInscription
        fields = {
            "niveau": ["exact"],
            "annee_scolaire": ["exact"],
        }


class BourseFilter(df.FilterSet):
    class Meta:
        model = models.Bourse
        fields = {
            "etudiant": ["exact"],
            "annee_scolaire": ["exact"],
            "type": ["exact"],
        }

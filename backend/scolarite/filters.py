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
            "pris_en_charge_bourse": ["exact"],
        }


class TypeFraisFilter(df.FilterSet):
    class Meta:
        model = models.TypeFrais
        fields = {
            "ecole": ["exact"],
            "niveau": ["exact"],
            "annee_scolaire": ["exact"],
            "obligatoire": ["exact"],
            "actif": ["exact"],
        }


class FraisInscriptionFilter(df.FilterSet):
    class Meta:
        model = models.FraisInscription
        fields = {"inscription": ["exact"], "type_frais": ["exact"], "exonere": ["exact"]}


class BourseFilter(df.FilterSet):
    class Meta:
        model = models.Bourse
        fields = {"inscription": ["exact"]}

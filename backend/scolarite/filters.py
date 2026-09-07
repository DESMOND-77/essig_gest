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

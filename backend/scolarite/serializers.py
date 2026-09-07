from rest_framework import serializers

from core.serializers import AuditableSerializerMixin

from . import models

_AUDIT = ["cree_par", "modifie_par", "cree_le", "modifie_le"]


class ModalitePaiementSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.ModalitePaiement
        fields = "__all__"
        read_only_fields = ["montant_total"]


class EcheanceSerializer(AuditableSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = models.Echeance
        fields = "__all__"
        read_only_fields = _AUDIT

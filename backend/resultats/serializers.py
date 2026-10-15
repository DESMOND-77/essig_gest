from rest_framework import serializers

from core.serializers import AuditableSerializerMixin

from . import models

_AUDIT = ["cree_par", "modifie_par", "cree_le", "modifie_le"]


class DeliberationSerializer(AuditableSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = models.Deliberation
        fields = "__all__"
        read_only_fields = [*_AUDIT, "statut", "validee_par"]


class DetteCreditSerializer(AuditableSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = models.DetteCredit
        fields = "__all__"
        read_only_fields = _AUDIT


class ResultatMatiereSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.ResultatMatiere
        fields = "__all__"


class ResultatPeriodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.ResultatPeriode
        fields = "__all__"


class ResultatAnnuelSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.ResultatAnnuel
        fields = "__all__"

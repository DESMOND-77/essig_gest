from rest_framework import serializers

from core.serializers import AuditableSerializerMixin

from . import models

_AUDIT = ["cree_par", "modifie_par", "cree_le", "modifie_le"]


class ModalitePaiementSerializer(AuditableSerializerMixin, serializers.ModelSerializer):
    # Déclaration explicite : `montant_total` est un GeneratedField, que
    # drf-spectacular ne sait pas introspecter (il tente d'instancier un
    # DecimalField sans max_digits/decimal_places).
    montant_total = serializers.DecimalField(
        max_digits=12, decimal_places=0, read_only=True
    )

    class Meta:
        model = models.ModalitePaiement
        fields = "__all__"
        read_only_fields = _AUDIT


class EcheanceSerializer(AuditableSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = models.Echeance
        fields = "__all__"
        read_only_fields = _AUDIT


class TypeFraisSerializer(AuditableSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = models.TypeFrais
        fields = "__all__"
        read_only_fields = _AUDIT


class FraisInscriptionSerializer(AuditableSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = models.FraisInscription
        fields = "__all__"
        read_only_fields = _AUDIT


class BourseSerializer(AuditableSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = models.Bourse
        fields = "__all__"
        read_only_fields = _AUDIT

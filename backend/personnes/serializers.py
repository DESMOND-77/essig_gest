from rest_framework import serializers

from referentiel.models import Ecole

from . import models, services


class AffiliationSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Affiliation
        fields = "__all__"


class SituationBacSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.SituationBac
        fields = "__all__"


class TypePieceSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.TypePiece
        fields = "__all__"


class EtudiantListSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Etudiant
        fields = "__all__"


class EtudiantSerializer(serializers.ModelSerializer):
    pole = serializers.ChoiceField(
        choices=Ecole.Pole.choices, write_only=True, required=False
    )
    affiliations = AffiliationSerializer(many=True, read_only=True)
    situation_bac = SituationBacSerializer(read_only=True)

    class Meta:
        model = models.Etudiant
        fields = "__all__"
        read_only_fields = ["matricule"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # `pole` obligatoire à la création (self.instance is None), ignoré en MAJ.
        self.fields["pole"].required = self.instance is None

    def create(self, validated_data):
        pole = validated_data.pop("pole", None)
        if not pole:
            raise serializers.ValidationError(
                {"pole": "Le pôle est obligatoire à la création."}
            )
        validated_data["matricule"] = services.generer_matricule(
            pole, validated_data["nom"], validated_data["prenoms"]
        )
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop("pole", None)
        validated_data.pop("matricule", None)
        return super().update(instance, validated_data)

from rest_framework import serializers

from core.serializers import AuditableSerializerMixin
from referentiel.models import Ecole
from scolarite.serializers import EcheanceSerializer
from scolarite.services import generer_echeancier

from . import models, services
from .services import attribuer_numero_ordre


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


class PieceDossierSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.PieceDossier
        fields = "__all__"


class InscriptionListSerializer(serializers.ModelSerializer):
    etudiant_libelle = serializers.CharField(
        source="etudiant.__str__", read_only=True
    )
    classe_libelle = serializers.CharField(source="classe.__str__", read_only=True)
    ecole_libelle = serializers.CharField(source="ecole.__str__", read_only=True)

    class Meta:
        model = models.Inscription
        fields = "__all__"


class InscriptionSerializer(
    AuditableSerializerMixin, serializers.ModelSerializer
):
    echeances = EcheanceSerializer(many=True, read_only=True)
    pieces_dossier = PieceDossierSerializer(many=True, read_only=True)

    class Meta:
        model = models.Inscription
        fields = "__all__"
        read_only_fields = [
            "ecole",
            "annee_scolaire",
            "numero_ordre",
            "cree_par",
            "modifie_par",
            "cree_le",
            "modifie_le",
        ]
        extra_kwargs = {
            "type": {"required": False},
            "statut": {"required": False},
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance is not None:
            self.fields["classe"].read_only = True

    def create(self, validated_data):
        classe = validated_data["classe"]
        validated_data["ecole"] = classe.niveau.ecole
        validated_data["annee_scolaire"] = classe.annee_scolaire
        etudiant = validated_data["etudiant"]
        if not validated_data.get("type") or not validated_data.get("statut"):
            anterieure = models.Inscription.objects.filter(
                etudiant=etudiant
            ).exists()
            validated_data.setdefault(
                "type",
                models.Inscription.Type.REINSCRIPTION
                if anterieure
                else models.Inscription.Type.INSCRIPTION,
            )
            validated_data.setdefault(
                "statut",
                models.Inscription.Statut.ANCIEN
                if anterieure
                else models.Inscription.Statut.NOUVEAU,
            )
        validated_data["numero_ordre"] = attribuer_numero_ordre(
            validated_data["ecole"], validated_data["annee_scolaire"]
        )
        inscription = super().create(validated_data)  # pose cree_par (mixin)
        generer_echeancier(inscription)
        return inscription

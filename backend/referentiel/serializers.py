from rest_framework import serializers

from . import models, services


class GroupeScolaireSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.GroupeScolaire
        fields = "__all__"


class EcoleSerializer(serializers.ModelSerializer):
    groupe_scolaire_libelle = serializers.CharField(
        source="groupe_scolaire.__str__", read_only=True
    )

    class Meta:
        model = models.Ecole
        fields = "__all__"


class AnneeScolaireSerializer(serializers.ModelSerializer):
    # La contrainte d'unicité partielle sur `est_courante` est un no-op MySQL
    # (cf. models.AnneeScolaire) : l'unicité effective passe par
    # services.definir_annee_courante. On neutralise donc le UniqueValidator
    # que DRF déduirait de la contrainte, sinon marquer une 2e année courante
    # échouerait à la validation avant la bascule.
    est_courante = serializers.BooleanField(required=False)

    class Meta:
        model = models.AnneeScolaire
        fields = "__all__"

    def create(self, validated_data):
        instance = super().create(validated_data)
        if instance.est_courante:
            services.definir_annee_courante(instance)
        return instance

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        if instance.est_courante:
            services.definir_annee_courante(instance)
        return instance


class ModaliteFormationSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.ModaliteFormation
        fields = "__all__"


class NiveauSerializer(serializers.ModelSerializer):
    ecole_libelle = serializers.CharField(source="ecole.__str__", read_only=True)

    class Meta:
        model = models.Niveau
        fields = "__all__"


class FiliereSerializer(serializers.ModelSerializer):
    ecole_libelle = serializers.CharField(source="ecole.__str__", read_only=True)

    class Meta:
        model = models.Filiere
        fields = "__all__"


class OptionFiliereSerializer(serializers.ModelSerializer):
    filiere_libelle = serializers.CharField(source="filiere.__str__", read_only=True)

    class Meta:
        model = models.OptionFiliere
        fields = "__all__"


class ClasseSerializer(serializers.ModelSerializer):
    libelle_auto = serializers.CharField(read_only=True)

    class Meta:
        model = models.Classe
        fields = "__all__"

    def _libelle(self, validated):
        return services.libelle_classe(
            niveau=validated["niveau"],
            option_filiere=validated["option_filiere"],
            modalite_formation=validated["modalite_formation"],
            annee_scolaire=validated["annee_scolaire"],
        )

    def create(self, validated_data):
        validated_data["libelle_auto"] = self._libelle(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        fusion = {
            "niveau": validated_data.get("niveau", instance.niveau),
            "option_filiere": validated_data.get(
                "option_filiere", instance.option_filiere
            ),
            "modalite_formation": validated_data.get(
                "modalite_formation", instance.modalite_formation
            ),
            "annee_scolaire": validated_data.get(
                "annee_scolaire", instance.annee_scolaire
            ),
        }
        validated_data["libelle_auto"] = self._libelle(fusion)
        return super().update(instance, validated_data)


class MatiereSerializer(serializers.ModelSerializer):
    niveau_libelle = serializers.CharField(source="niveau.__str__", read_only=True)
    option_filiere_libelle = serializers.CharField(
        source="option_filiere.__str__", read_only=True
    )

    class Meta:
        model = models.Matiere
        fields = "__all__"


class PeriodeSerializer(serializers.ModelSerializer):
    annee_scolaire_libelle = serializers.CharField(
        source="annee_scolaire.__str__", read_only=True
    )

    class Meta:
        model = models.Periode
        fields = "__all__"


class SessionExamenSerializer(serializers.ModelSerializer):
    periode_libelle = serializers.CharField(source="periode.__str__", read_only=True)

    class Meta:
        model = models.SessionExamen
        fields = "__all__"

from rest_framework import serializers

from core.serializers import AuditableSerializerMixin

from . import models, services

_AUDIT = ["cree_par", "modifie_par", "cree_le", "modifie_le"]


class EvaluationSerializer(AuditableSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = models.Evaluation
        fields = "__all__"
        read_only_fields = _AUDIT

    def validate(self, attrs):
        matiere = attrs.get("matiere", getattr(self.instance, "matiere", None))
        classe = attrs.get("classe", getattr(self.instance, "classe", None))
        session_examen = attrs.get(
            "session_examen", getattr(self.instance, "session_examen", None)
        )
        ponderation = attrs.get("ponderation", getattr(self.instance, "ponderation", None))
        services.valider_ponderation_evaluation(
            matiere_id=matiere.id,
            classe_id=classe.id,
            session_examen_id=session_examen.id,
            ponderation=ponderation,
            instance_id=self.instance.id if self.instance else None,
        )
        return attrs


class NoteEvaluationSerializer(AuditableSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = models.NoteEvaluation
        fields = "__all__"
        read_only_fields = _AUDIT

    def validate(self, attrs):
        evaluation = attrs.get("evaluation", getattr(self.instance, "evaluation", None))
        valeur = attrs.get("valeur", getattr(self.instance, "valeur", None))
        if valeur is not None and evaluation is not None:
            if valeur < 0 or valeur > evaluation.bareme:
                raise serializers.ValidationError(
                    {"valeur": f"La note doit être comprise entre 0 et {evaluation.bareme}."}
                )
        return attrs

import django_filters as df

from . import models


class EvaluationFilter(df.FilterSet):
    class Meta:
        model = models.Evaluation
        fields = {
            "matiere": ["exact"],
            "classe": ["exact"],
            "session_examen": ["exact"],
            "type": ["exact"],
        }


class NoteEvaluationFilter(df.FilterSet):
    class Meta:
        model = models.NoteEvaluation
        fields = {
            "evaluation": ["exact"],
            "inscription": ["exact"],
        }

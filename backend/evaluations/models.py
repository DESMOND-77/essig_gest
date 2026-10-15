# backend/evaluations/models.py
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from core.models import Auditable
from personnes.models import Inscription
from referentiel.models import Classe, Matiere, SessionExamen


class Evaluation(Auditable):
    class Type(models.TextChoices):
        CC = "CC", "Contrôle continu"
        EXAMEN = "EXAMEN", "Examen"
        TP = "TP", "Travaux pratiques"
        PROJET = "PROJET", "Projet"

    matiere = models.ForeignKey(Matiere, on_delete=models.RESTRICT, related_name="evaluations")
    classe = models.ForeignKey(Classe, on_delete=models.RESTRICT, related_name="evaluations")
    session_examen = models.ForeignKey(
        SessionExamen, on_delete=models.RESTRICT, related_name="evaluations"
    )
    type = models.CharField(max_length=10, choices=Type.choices)
    ponderation = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01")), MaxValueValidator(Decimal("100"))],
        help_text="% de la note matière pour cette évaluation",
    )
    bareme = models.IntegerField(default=20, validators=[MinValueValidator(1)])
    date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "evaluation"
        indexes = [
            models.Index(
                fields=["matiere", "classe", "session_examen"],
                name="idx_evaluation_matiere",
            )
        ]

    def __str__(self):
        return f"{self.matiere} - {self.type} ({self.session_examen})"


class NoteEvaluation(Auditable):
    evaluation = models.ForeignKey(
        Evaluation, on_delete=models.CASCADE, related_name="notes"
    )
    inscription = models.ForeignKey(
        Inscription, on_delete=models.RESTRICT, related_name="notes_evaluation"
    )
    valeur = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    absent = models.BooleanField(default=False)

    class Meta:
        db_table = "note_evaluation"
        constraints = [
            models.UniqueConstraint(
                fields=["evaluation", "inscription"], name="unq_note_evaluation"
            )
        ]
        indexes = [
            models.Index(fields=["inscription"], name="idx_note_eval_inscription")
        ]

    def clean(self):
        super().clean()
        if self.valeur is not None and self.evaluation_id:
            if self.valeur < 0 or self.valeur > self.evaluation.bareme:
                raise ValidationError(
                    {"valeur": f"La note doit être comprise entre 0 et {self.evaluation.bareme}."}
                )

    def __str__(self):
        return f"{self.inscription} - {self.evaluation} : {self.valeur}"

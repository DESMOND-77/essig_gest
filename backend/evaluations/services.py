# backend/evaluations/services.py
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db.models import Sum

from personnes.models import Inscription

from .models import Evaluation, NoteEvaluation


def calculer_note_matiere_session(*, inscription_id, matiere_id, session_examen_id):
    """Note matière/session = Σ(valeur_ramenée_sur_20 * pondération / 100).

    Les notes marquées `absent` (valeur NULL) sont exclues du calcul plutôt que
    comptées comme 0 : une évaluation non passée ne doit pas pénaliser la moyenne
    au même titre qu'une copie rendue avec une mauvaise note (cf. spec §4, choix
    documenté explicitement car le mandat ne le tranchait pas).

    Retourne `None` si aucune note exploitable n'existe pour ce triplet.
    """
    classe_id = Inscription.objects.filter(pk=inscription_id).values_list(
        "classe_id", flat=True
    ).first()

    notes = NoteEvaluation.objects.filter(
        evaluation__matiere_id=matiere_id,
        evaluation__classe_id=classe_id,
        evaluation__session_examen_id=session_examen_id,
        inscription_id=inscription_id,
        absent=False,
        valeur__isnull=False,
    ).select_related("evaluation")

    total = Decimal("0")
    trouve = False
    for note in notes:
        bareme = note.evaluation.bareme or 20
        valeur_sur_20 = (note.valeur / Decimal(bareme)) * Decimal(20)
        total += valeur_sur_20 * note.evaluation.ponderation / Decimal(100)
        trouve = True

    if not trouve:
        return None
    return total.quantize(Decimal("0.01"))


def valider_ponderation_evaluation(
    *, matiere_id, classe_id, session_examen_id, ponderation, instance_id=None
):
    """Rejette si la Σ pondération du groupe (matière, classe, session) dépasserait 100."""
    qs = Evaluation.objects.filter(
        matiere_id=matiere_id, classe_id=classe_id, session_examen_id=session_examen_id
    )
    if instance_id:
        qs = qs.exclude(pk=instance_id)
    total_existant = qs.aggregate(total=Sum("ponderation"))["total"] or Decimal("0")
    if total_existant + Decimal(ponderation) > Decimal("100"):
        raise ValidationError(
            {
                "ponderation": (
                    f"La somme des pondérations pour cette matière/classe/session "
                    f"dépasserait 100 (déjà {total_existant}, + {ponderation})."
                )
            }
        )

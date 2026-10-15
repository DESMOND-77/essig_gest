from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError

from evaluations.services import calculer_note_matiere_session, valider_ponderation_evaluation
from evaluations.tests.factories import EvaluationFactory, NoteEvaluationFactory
from personnes.tests.factories import InscriptionFactory

pytestmark = pytest.mark.django_db


def test_note_matiere_session_pondere_sur_bareme_different_de_20():
    evaluation = EvaluationFactory(bareme=10, ponderation=Decimal("100"))
    inscription = InscriptionFactory(classe=evaluation.classe)
    NoteEvaluationFactory(evaluation=evaluation, inscription=inscription, valeur=Decimal("8"))

    note = calculer_note_matiere_session(
        inscription_id=inscription.id,
        matiere_id=evaluation.matiere_id,
        session_examen_id=evaluation.session_examen_id,
    )

    # 8/10 ramené sur 20 = 16, pondération 100% -> 16
    assert note == Decimal("16.00")


def test_note_matiere_session_additionne_plusieurs_evaluations_ponderees():
    classe = EvaluationFactory().classe
    inscription = InscriptionFactory(classe=classe)
    # Deux évaluations de la même matière/session, pondérées à 50% chacune.
    eval1 = EvaluationFactory(classe=classe, bareme=20, ponderation=Decimal("50"))
    eval2 = EvaluationFactory(
        classe=classe,
        matiere=eval1.matiere,
        session_examen=eval1.session_examen,
        bareme=20,
        ponderation=Decimal("50"),
    )
    NoteEvaluationFactory(evaluation=eval1, inscription=inscription, valeur=Decimal("10"))
    NoteEvaluationFactory(evaluation=eval2, inscription=inscription, valeur=Decimal("20"))

    note = calculer_note_matiere_session(
        inscription_id=inscription.id,
        matiere_id=eval1.matiere_id,
        session_examen_id=eval1.session_examen_id,
    )

    # (10*0.5) + (20*0.5) = 15
    assert note == Decimal("15.00")


def test_note_absente_exclue_du_calcul_pas_comptee_comme_zero():
    classe = EvaluationFactory().classe
    inscription = InscriptionFactory(classe=classe)
    eval1 = EvaluationFactory(classe=classe, bareme=20, ponderation=Decimal("100"))
    NoteEvaluationFactory(evaluation=eval1, inscription=inscription, valeur=None, absent=True)

    note = calculer_note_matiere_session(
        inscription_id=inscription.id,
        matiere_id=eval1.matiere_id,
        session_examen_id=eval1.session_examen_id,
    )

    assert note is None


def test_aucune_note_renvoie_none():
    classe = EvaluationFactory().classe
    inscription = InscriptionFactory(classe=classe)
    eval1 = EvaluationFactory(classe=classe)

    note = calculer_note_matiere_session(
        inscription_id=inscription.id,
        matiere_id=eval1.matiere_id,
        session_examen_id=eval1.session_examen_id,
    )

    assert note is None


def test_ponderation_depassant_100_est_rejetee():
    eval1 = EvaluationFactory(ponderation=Decimal("60"))

    with pytest.raises(ValidationError):
        valider_ponderation_evaluation(
            matiere_id=eval1.matiere_id,
            classe_id=eval1.classe_id,
            session_examen_id=eval1.session_examen_id,
            ponderation=Decimal("50"),
        )


def test_ponderation_exactement_100_est_acceptee():
    eval1 = EvaluationFactory(ponderation=Decimal("60"))

    # Ne doit pas lever : 60 + 40 = 100 pile.
    valider_ponderation_evaluation(
        matiere_id=eval1.matiere_id,
        classe_id=eval1.classe_id,
        session_examen_id=eval1.session_examen_id,
        ponderation=Decimal("40"),
    )


def test_unicite_evaluation_inscription():
    from django.db import IntegrityError

    note = NoteEvaluationFactory()
    with pytest.raises(IntegrityError):
        NoteEvaluationFactory(evaluation=note.evaluation, inscription=note.inscription)

import factory

from evaluations import models
from personnes.tests.factories import InscriptionFactory
from referentiel.tests.factories import ClasseFactory, MatiereFactory, SessionExamenFactory


class EvaluationFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Evaluation

    matiere = factory.SubFactory(MatiereFactory)
    classe = factory.SubFactory(ClasseFactory)
    session_examen = factory.SubFactory(SessionExamenFactory)
    type = models.Evaluation.Type.CC
    ponderation = 50
    bareme = 20


class NoteEvaluationFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.NoteEvaluation

    evaluation = factory.SubFactory(EvaluationFactory)
    inscription = factory.SubFactory(InscriptionFactory)
    valeur = 15
    absent = False

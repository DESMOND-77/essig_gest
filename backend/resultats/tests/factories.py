import factory

from referentiel.tests.factories import ClasseFactory, PeriodeFactory, SessionExamenFactory
from resultats import models


class DeliberationFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Deliberation

    classe = factory.SubFactory(ClasseFactory)
    session_examen = factory.SubFactory(SessionExamenFactory)
    periode = factory.SubFactory(PeriodeFactory)
    date = "2026-01-15"
    president_jury = "Dr. Président"
    statut = models.Deliberation.Statut.BROUILLON

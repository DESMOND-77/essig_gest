import factory

from personnes.tests.factories import InscriptionFactory
from referentiel.tests.factories import AnneeScolaireFactory, NiveauFactory
from scolarite import models


class ModalitePaiementFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.ModalitePaiement

    niveau = factory.SubFactory(NiveauFactory)
    annee_scolaire = factory.SubFactory(AnneeScolaireFactory)
    montant_inscription_reinscription = 105000
    nombre_echeance = 9
    montant_echeance = 70000


class EcheanceFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Echeance

    inscription = factory.SubFactory(InscriptionFactory)
    numero = factory.Sequence(lambda n: n)
    montant_prevu = 70000
    date_prevue = "2025-11-01"

import factory

from personnes.tests.factories import InscriptionFactory
from referentiel.tests.factories import AnneeScolaireFactory, NiveauFactory
from personnes.tests.factories import EtudiantFactory
from scolarite import models


class ModalitePaiementFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.ModalitePaiement

    niveau = factory.SubFactory(NiveauFactory)
    annee_scolaire = factory.SubFactory(AnneeScolaireFactory)
    montant = 70000


class EcheanceFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Echeance

    inscription = factory.SubFactory(InscriptionFactory)
    numero = factory.Sequence(lambda n: n)
    montant = 70000
    date_echeance = "2025-11-01"


class TypeFraisFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.TypeFrais

    code = factory.Sequence(lambda n: f"FRAIS_{n}")
    libelle = factory.LazyAttribute(lambda o: f"Frais {o.code}")


class FraisInscriptionFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.FraisInscription

    niveau = factory.SubFactory(NiveauFactory)
    annee_scolaire = factory.SubFactory(AnneeScolaireFactory)
    montant = 15000


class BourseFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Bourse

    etudiant = factory.SubFactory(EtudiantFactory)
    annee_scolaire = factory.SubFactory(AnneeScolaireFactory)
    type = "PARTIELLE"
    pourcentage = 50.00
    date_attribution = factory.Faker('date_between', start_date='-1y', end_date='today')
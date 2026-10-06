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


class TypeFraisFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.TypeFrais

    code = factory.Sequence(lambda n: f"FRAIS_{n}")
    libelle = factory.LazyAttribute(lambda o: f"Frais {o.code}")
    montant_defaut = 15000
    obligatoire = False
    actif = True


class FraisInscriptionFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.FraisInscription

    inscription = factory.SubFactory(InscriptionFactory)
    type_frais = factory.SubFactory(TypeFraisFactory)
    montant_du = 15000


class BourseFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Bourse

    inscription = factory.SubFactory(InscriptionFactory)
    organisme = factory.Sequence(lambda n: f"Organisme {n}")
    montant_couvert = 300000

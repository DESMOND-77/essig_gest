import factory

from personnes import models


class EtudiantFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Etudiant

    matricule = factory.Sequence(lambda n: f"ESSIG-FCVTEST{n}")
    nom = factory.Sequence(lambda n: f"Nom{n}")
    prenoms = factory.Sequence(lambda n: f"Prenom{n}")
    sexe = models.Etudiant.Sexe.F


class AffiliationFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Affiliation

    etudiant = factory.SubFactory(EtudiantFactory)
    type = models.Affiliation.Type.PERE
    nom = factory.Sequence(lambda n: f"Parent{n}")
    prenom = "X"
    contact = "0100000000"


class SituationBacFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.SituationBac

    etudiant = factory.SubFactory(EtudiantFactory)
    a_le_bac = True
    annee_obtention = 2024
    serie = "D"


class TypePieceFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.TypePiece

    code = factory.Sequence(lambda n: f"PIECE_{n}")
    libelle = factory.LazyAttribute(lambda o: f"Pièce {o.code}")

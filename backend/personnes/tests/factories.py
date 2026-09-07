import factory

from personnes import models
from referentiel.tests.factories import ClasseFactory


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


class InscriptionFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Inscription

    etudiant = factory.SubFactory(EtudiantFactory)
    classe = factory.SubFactory(ClasseFactory)
    ecole = factory.LazyAttribute(lambda o: o.classe.niveau.ecole)
    annee_scolaire = factory.LazyAttribute(lambda o: o.classe.annee_scolaire)
    numero_ordre = factory.Sequence(lambda n: n + 1)
    type = models.Inscription.Type.INSCRIPTION
    statut = models.Inscription.Statut.NOUVEAU
    date_inscription = "2025-10-01"


class PieceDossierFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.PieceDossier

    inscription = factory.SubFactory(InscriptionFactory)
    type_piece = factory.SubFactory(TypePieceFactory)
    fournie = False

import factory

from referentiel import models


class GroupeScolaireFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.GroupeScolaire

    nom = factory.Sequence(lambda n: f"Groupe {n}")


class EcoleFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Ecole

    groupe_scolaire = factory.SubFactory(GroupeScolaireFactory)
    nom = factory.Sequence(lambda n: f"Ecole {n}")
    sigle = factory.Sequence(lambda n: f"E{n}")
    pole = models.Ecole.Pole.ESSIG
    regime = models.Ecole.Regime.LMD


class AnneeScolaireFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.AnneeScolaire

    libelle = factory.Sequence(lambda n: f"20{20 + n}-20{21 + n}")
    date_debut = "2025-10-01"
    date_fin = "2026-08-31"
    est_courante = False


class ModaliteFormationFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.ModaliteFormation

    code = factory.Iterator(
        [c for c in models.ModaliteFormation.Code.values]
    )
    libelle = factory.LazyAttribute(lambda o: f"Modalité {o.code}")


class NiveauFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Niveau

    ecole = factory.SubFactory(EcoleFactory)
    code = factory.Sequence(lambda n: f"L{n}")
    libelle = factory.LazyAttribute(lambda o: f"Niveau {o.code}")
    ordre = factory.Sequence(lambda n: n + 1)
    credits_requis = 60


class FiliereFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Filiere

    ecole = factory.SubFactory(EcoleFactory)
    nom = factory.Sequence(lambda n: f"Filière {n}")
    sigle = factory.Sequence(lambda n: f"F{n}")


class OptionFiliereFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.OptionFiliere

    filiere = factory.SubFactory(FiliereFactory)
    nom = factory.Sequence(lambda n: f"Option {n}")
    sigle = factory.Sequence(lambda n: f"O{n}")


class ClasseFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Classe

    annee_scolaire = factory.SubFactory(AnneeScolaireFactory)
    niveau = factory.SubFactory(NiveauFactory)
    option_filiere = factory.SubFactory(OptionFiliereFactory)
    modalite_formation = factory.SubFactory(ModaliteFormationFactory)
    libelle_auto = "à recalculer"


class MatiereFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Matiere

    niveau = factory.SubFactory(NiveauFactory)
    option_filiere = factory.SubFactory(OptionFiliereFactory)
    semestre = models.Matiere.Semestre.S1
    nom = factory.Sequence(lambda n: f"Matière {n}")
    code = factory.Sequence(lambda n: f"M{n}")
    coefficient = 2
    credits = 4
    volume_horaire = 30


class PeriodeFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Periode

    annee_scolaire = factory.SubFactory(AnneeScolaireFactory)
    numero = factory.Sequence(lambda n: (n % 2) + 1)
    libelle = factory.LazyAttribute(lambda o: f"Semestre {o.numero}")
    date_debut = "2025-10-01"
    date_fin = "2026-02-28"


class SessionExamenFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.SessionExamen

    periode = factory.SubFactory(PeriodeFactory)
    type = models.SessionExamen.Type.NORMALE

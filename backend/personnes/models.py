from django.db import models

from referentiel.models import Ecole


class Etudiant(models.Model):
    class Sexe(models.TextChoices):
        M = "M", "Masculin"
        F = "F", "Féminin"

    class SituationMatrimoniale(models.TextChoices):
        CELIBATAIRE = "CELIBATAIRE", "Célibataire"
        MARIE = "MARIE", "Marié(e)"
        AUTRE = "AUTRE", "Autre"

    # matricule : généré serveur (personnes.services.generer_matricule), immuable.
    matricule = models.CharField(max_length=20, unique=True)
    numero_interne_archive = models.CharField(  # noqa: DJ001
        max_length=20, null=True, blank=True
    )
    nom = models.CharField(max_length=60)
    prenoms = models.CharField(max_length=120)
    sexe = models.CharField(max_length=1, choices=Sexe.choices)
    date_naissance = models.DateField(null=True, blank=True)
    lieu_naissance = models.CharField(max_length=120, null=True, blank=True)  # noqa: DJ001
    nationalite = models.CharField(max_length=60, null=True, blank=True)  # noqa: DJ001
    email = models.CharField(max_length=120, null=True, blank=True)  # noqa: DJ001
    telephone = models.CharField(max_length=40, null=True, blank=True)  # noqa: DJ001
    adresse = models.CharField(max_length=255, null=True, blank=True)  # noqa: DJ001
    photo = models.CharField(max_length=255, null=True, blank=True)  # noqa: DJ001
    situation_matrimoniale = models.CharField(  # noqa: DJ001
        max_length=11, choices=SituationMatrimoniale.choices, null=True, blank=True
    )

    class Meta:
        db_table = "etudiant"
        indexes = [models.Index(fields=["nom", "prenoms"], name="idx_etudiant_nom")]

    def __str__(self):
        return f"{self.matricule} — {self.nom} {self.prenoms}"


class Affiliation(models.Model):
    class Type(models.TextChoices):
        PERE = "PERE", "Père"
        MERE = "MERE", "Mère"
        TUTEUR = "TUTEUR", "Tuteur"

    etudiant = models.ForeignKey(
        Etudiant, on_delete=models.CASCADE, related_name="affiliations"
    )
    type = models.CharField(max_length=6, choices=Type.choices)
    nom = models.CharField(max_length=60)
    prenom = models.CharField(max_length=120)
    contact = models.CharField(max_length=60)
    profession = models.CharField(max_length=120, null=True, blank=True)  # noqa: DJ001

    class Meta:
        db_table = "affiliation"
        constraints = [
            models.UniqueConstraint(
                fields=["etudiant", "type"], name="unq_affiliation"
            )
        ]

    def __str__(self):
        return f"{self.type} de {self.etudiant_id}"


class SituationBac(models.Model):
    class Mention(models.TextChoices):
        TB = "TB", "Très bien"
        B = "B", "Bien"
        AB = "AB", "Assez bien"
        P = "P", "Passable"

    etudiant = models.OneToOneField(
        Etudiant, on_delete=models.CASCADE, related_name="situation_bac"
    )
    a_le_bac = models.BooleanField(default=False)
    annee_obtention = models.IntegerField(null=True, blank=True)
    serie = models.CharField(max_length=20, null=True, blank=True)  # noqa: DJ001
    mention = models.CharField(  # noqa: DJ001
        max_length=2, choices=Mention.choices, null=True, blank=True
    )
    etablissement = models.CharField(  # noqa: DJ001
        max_length=150, null=True, blank=True
    )
    ville = models.CharField(max_length=80, null=True, blank=True)  # noqa: DJ001

    class Meta:
        db_table = "situation_bac"

    def __str__(self):
        return f"BAC de {self.etudiant_id}"


class TypePiece(models.Model):
    code = models.CharField(max_length=30, unique=True)
    libelle = models.CharField(max_length=120)

    class Meta:
        db_table = "type_piece"

    def __str__(self):
        return self.code


class CompteurMatricule(models.Model):
    pole = models.CharField(
        max_length=5, primary_key=True, choices=Ecole.Pole.choices
    )
    valeur = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "compteur_matricule"

    def __str__(self):
        return f"{self.pole}={self.valeur}"

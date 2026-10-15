# backend/resultats/models.py
from django.conf import settings
from django.db import models

from core.models import Auditable
from personnes.models import Inscription
from referentiel.models import AnneeScolaire, Classe, Matiere, Periode, SessionExamen


class Deliberation(Auditable):
    class Statut(models.TextChoices):
        BROUILLON = "BROUILLON", "Brouillon"
        VALIDEE = "VALIDEE", "Validée"

    classe = models.ForeignKey(Classe, on_delete=models.RESTRICT, related_name="deliberations")
    session_examen = models.ForeignKey(
        SessionExamen, on_delete=models.RESTRICT, related_name="deliberations"
    )
    periode = models.ForeignKey(
        Periode, on_delete=models.RESTRICT, related_name="deliberations", null=True, blank=True
    )
    date = models.DateField()
    president_jury = models.CharField(max_length=150)
    statut = models.CharField(
        max_length=10, choices=Statut.choices, default=Statut.BROUILLON
    )
    validee_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    class Meta:
        db_table = "deliberation"
        indexes = [
            models.Index(fields=["classe", "session_examen"], name="idx_deliberation_classe")
        ]

    def __str__(self):
        return f"Délibération {self.classe} - {self.session_examen} ({self.statut})"


class ResultatMatiere(Auditable):
    inscription = models.ForeignKey(
        Inscription, on_delete=models.RESTRICT, related_name="resultats_matiere"
    )
    matiere = models.ForeignKey(Matiere, on_delete=models.RESTRICT, related_name="resultats")
    periode = models.ForeignKey(
        Periode, on_delete=models.RESTRICT, related_name="resultats_matiere"
    )
    note_normale = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    note_rattrapage = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    note_retenue = models.DecimalField(max_digits=4, decimal_places=2)
    credits = models.IntegerField(null=True, blank=True)
    validee = models.BooleanField()
    credits_acquis = models.IntegerField(null=True, blank=True)
    deliberation = models.ForeignKey(
        Deliberation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resultats_matiere",
    )

    class Meta:
        db_table = "resultat_matiere"
        constraints = [
            models.UniqueConstraint(
                fields=["inscription", "matiere", "periode"], name="unq_resultat_matiere"
            )
        ]

    def __str__(self):
        return f"{self.inscription} - {self.matiere} ({self.periode})"


class ResultatPeriode(Auditable):
    inscription = models.ForeignKey(
        Inscription, on_delete=models.RESTRICT, related_name="resultats_periode"
    )
    periode = models.ForeignKey(
        Periode, on_delete=models.RESTRICT, related_name="resultats_periode"
    )
    moyenne_ponderee = models.DecimalField(max_digits=4, decimal_places=2)
    credits_acquis = models.IntegerField(null=True, blank=True)
    rang = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = "resultat_periode"
        constraints = [
            models.UniqueConstraint(
                fields=["inscription", "periode"], name="unq_resultat_periode"
            )
        ]

    def __str__(self):
        return f"{self.inscription} - {self.periode} : {self.moyenne_ponderee}"


class ResultatAnnuel(Auditable):
    class Regime(models.TextChoices):
        LMD = "LMD", "LMD"
        CLASSIQUE = "CLASSIQUE", "Classique"

    class Decision(models.TextChoices):
        ADMIS = "ADMIS", "Admis"
        ADMIS_CONDITIONNEL = "ADMIS_CONDITIONNEL", "Admis conditionnel"
        REDOUBLE = "REDOUBLE", "Redouble"
        EXCLU = "EXCLU", "Exclu"
        AJOURNE = "AJOURNE", "Ajourné"

    class Mention(models.TextChoices):
        PASSABLE = "PASSABLE", "Passable"
        AB = "AB", "Assez bien"
        B = "B", "Bien"
        TB = "TB", "Très bien"

    inscription = models.OneToOneField(
        Inscription, on_delete=models.RESTRICT, related_name="resultat_annuel"
    )
    annee_scolaire = models.ForeignKey(
        AnneeScolaire, on_delete=models.RESTRICT, related_name="resultats_annuels"
    )
    regime = models.CharField(max_length=9, choices=Regime.choices)
    moyenne_annuelle = models.DecimalField(max_digits=4, decimal_places=2)
    credits_acquis = models.IntegerField(null=True, blank=True)
    credits_requis = models.IntegerField(null=True, blank=True)
    dette_credits = models.IntegerField(null=True, blank=True)
    decision = models.CharField(max_length=20, choices=Decision.choices)
    mention = models.CharField(  # noqa: DJ001
        max_length=10, choices=Mention.choices, null=True, blank=True
    )
    deliberee_le = models.DateTimeField(null=True, blank=True)
    deliberee_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    class Meta:
        db_table = "resultat_annuel"

    def __str__(self):
        return f"{self.inscription} - {self.annee_scolaire} : {self.decision}"


class DetteCredit(Auditable):
    inscription_origine = models.ForeignKey(
        Inscription, on_delete=models.RESTRICT, related_name="dettes_credit_origine"
    )
    matiere = models.ForeignKey(Matiere, on_delete=models.RESTRICT, related_name="dettes_credit")
    credits = models.IntegerField()
    annee_origine = models.ForeignKey(
        AnneeScolaire, on_delete=models.RESTRICT, related_name="dettes_credit"
    )
    soldee = models.BooleanField(default=False)
    inscription_solde = models.ForeignKey(
        Inscription,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="dettes_credit_soldees",
    )

    class Meta:
        db_table = "dette_credit"
        constraints = [
            models.UniqueConstraint(
                fields=["inscription_origine", "matiere"], name="unq_dette_credit"
            )
        ]

    def __str__(self):
        statut = "soldée" if self.soldee else "ouverte"
        return f"Dette {self.matiere} - {self.inscription_origine} ({statut})"

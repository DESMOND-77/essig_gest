from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import F

from core.models import Auditable
from personnes.models import Inscription
from referentiel.models import AnneeScolaire, Ecole, Niveau


class TypeFrais(models.Model):
    code = models.CharField(max_length=30, unique=True)
    libelle = models.CharField(max_length=120)
    ecole = models.ForeignKey(
        Ecole, on_delete=models.RESTRICT, null=True, blank=True, related_name="+"
    )
    niveau = models.ForeignKey(
        Niveau, on_delete=models.RESTRICT, null=True, blank=True, related_name="+"
    )
    annee_scolaire = models.ForeignKey(
        AnneeScolaire, on_delete=models.RESTRICT, null=True, blank=True, related_name="+"
    )
    montant_defaut = models.DecimalField(max_digits=12, decimal_places=0)
    obligatoire = models.BooleanField(default=False)
    actif = models.BooleanField(default=True)

    class Meta:
        db_table = "type_frais"
        indexes = [
            models.Index(fields=["ecole"], name="idx_type_frais_ecole"),
            models.Index(fields=["niveau"], name="idx_type_frais_niveau"),
        ]

    def __str__(self):
        return self.code


class FraisInscription(Auditable):
    inscription = models.ForeignKey(
        Inscription, on_delete=models.RESTRICT, related_name="frais_inscription"
    )
    type_frais = models.ForeignKey(
        TypeFrais, on_delete=models.RESTRICT, related_name="+"
    )
    montant_du = models.DecimalField(max_digits=12, decimal_places=0)
    exonere = models.BooleanField(default=False)
    commentaire = models.CharField(max_length=255, null=True, blank=True)  # noqa: DJ001

    class Meta:
        db_table = "frais_inscription"
        constraints = [
            models.UniqueConstraint(
                fields=["inscription", "type_frais"], name="unq_frais_inscription"
            )
        ]

    def __str__(self):
        return f"{self.type_frais} / insc {self.inscription_id}"


class Bourse(Auditable):
    class Perimetre(models.TextChoices):
        SCOLARITE_HORS_INSCRIPTION = (
            "SCOLARITE_HORS_INSCRIPTION",
            "Scolarité hors inscription",
        )

    inscription = models.ForeignKey(
        Inscription, on_delete=models.RESTRICT, related_name="bourses"
    )
    organisme = models.CharField(max_length=150)
    perimetre = models.CharField(
        max_length=30,
        choices=Perimetre.choices,
        default=Perimetre.SCOLARITE_HORS_INSCRIPTION,
    )
    montant_couvert = models.DecimalField(max_digits=12, decimal_places=0)

    class Meta:
        db_table = "bourse"
        indexes = [
            models.Index(fields=["inscription"], name="idx_bourse_inscription")
        ]

    def __str__(self):
        return f"{self.organisme} / insc {self.inscription_id}"


class ModalitePaiement(models.Model):
    niveau = models.ForeignKey(Niveau, on_delete=models.RESTRICT, related_name="+")
    annee_scolaire = models.ForeignKey(
        AnneeScolaire, on_delete=models.RESTRICT, related_name="+"
    )
    montant_inscription_reinscription = models.DecimalField(
        max_digits=12, decimal_places=0
    )
    nombre_echeance = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    montant_echeance = models.DecimalField(max_digits=12, decimal_places=0)
    montant_total = models.GeneratedField(
        expression=F("montant_inscription_reinscription")
        + F("nombre_echeance") * F("montant_echeance"),
        output_field=models.DecimalField(max_digits=12, decimal_places=0),
        db_persist=True,
    )

    class Meta:
        db_table = "modalite_paiement"
        constraints = [
            models.UniqueConstraint(
                fields=["niveau", "annee_scolaire"], name="unq_modalite_paiement"
            )
        ]

    def __str__(self):
        return f"{self.niveau_id}/{self.annee_scolaire_id} = {self.montant_total}"


class Echeance(Auditable):
    inscription = models.ForeignKey(
        Inscription, on_delete=models.RESTRICT, related_name="echeances"
    )
    numero = models.PositiveIntegerField()
    montant_prevu = models.DecimalField(max_digits=12, decimal_places=0)
    date_prevue = models.DateField()
    pris_en_charge_bourse = models.BooleanField(default=False)

    class Meta:
        db_table = "echeance"
        constraints = [
            models.UniqueConstraint(
                fields=["inscription", "numero"], name="unq_echeance"
            )
        ]

    def __str__(self):
        return f"éch. {self.numero} / insc {self.inscription_id}"

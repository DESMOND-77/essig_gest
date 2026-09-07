from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import F

from core.models import Auditable
from personnes.models import Inscription
from referentiel.models import AnneeScolaire, Niveau


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

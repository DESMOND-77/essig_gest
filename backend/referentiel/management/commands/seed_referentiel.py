from django.core.management.base import BaseCommand
from django.db import transaction

from referentiel import models, services

ECOLES = [
    ("École Supérieure des Sciences et Ingénierie de Gestion", "ESSIG", "LMD"),
    ("Université Privée des Sciences de la Santé", "UPSS", "LMD"),
    ("Centre de Formation Professionnelle et d'Apprentissage", "CFPA", "CLASSIQUE"),
    ("CICI", "CICI", "CLASSIQUE"),
]
MODALITES = [
    ("FI", "Formation initiale"),
    ("FC", "Formation continue"),
    ("FL", "Formation à distance"),
    ("FT", "Formation en alternance"),
]


class Command(BaseCommand):
    help = "Amorce idempotente du référentiel (écoles, modalités, année, périodes)."

    def add_arguments(self, parser):
        parser.add_argument("--annee", default="2025-2026")

    @transaction.atomic
    def handle(self, *args, **opts):
        for nom, sigle, regime in ECOLES:
            models.Ecole.objects.get_or_create(
                sigle=sigle,
                defaults={"nom": nom, "regime": regime},
            )
        for code, libelle in MODALITES:
            models.ModaliteFormation.objects.get_or_create(
                code=code, defaults={"libelle": libelle}
            )
        deb, fin = f"{opts['annee'][:4]}-10-01", f"{opts['annee'][5:]}-08-31"
        annee, _ = models.AnneeScolaire.objects.get_or_create(
            libelle=opts["annee"], defaults={"date_debut": deb, "date_fin": fin}
        )
        for numero in (1, 2):
            periode, _ = models.Periode.objects.get_or_create(
                annee_scolaire=annee,
                numero=numero,
                defaults={
                    "libelle": f"Semestre {numero}",
                    "date_debut": deb,
                    "date_fin": fin,
                },
            )
            models.SessionExamen.objects.get_or_create(
                periode=periode, type=models.SessionExamen.Type.NORMALE
            )
        services.definir_annee_courante(annee)
        self.stdout.write(self.style.SUCCESS("Référentiel amorcé."))

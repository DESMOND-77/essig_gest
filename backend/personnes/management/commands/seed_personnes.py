from django.core.management.base import BaseCommand
from django.db import transaction

from personnes.models import TypePiece

TYPES_PIECE = [
    ("ACTE_NAISSANCE", "Acte de naissance"),
    ("RELEVE_BAC", "Relevé de notes du BAC"),
    ("PHOTOS", "Photos d'identité"),
    ("LETTRE_MOTIVATION", "Lettre de motivation"),
    ("CERTIF_SCOLARITE", "Certificat de scolarité"),
]


class Command(BaseCommand):
    help = "Amorce idempotente du référentiel personnes (types de pièce)."

    @transaction.atomic
    def handle(self, *args, **opts):
        for code, libelle in TYPES_PIECE:
            TypePiece.objects.get_or_create(code=code, defaults={"libelle": libelle})
        self.stdout.write(self.style.SUCCESS("Référentiel personnes amorcé."))

from django.core.management.base import BaseCommand
from django.db import transaction

from scolarite.models import TypeFrais

CATALOGUE = [
    ("TENUE", "Tenue / uniforme", 25000, True, True),
    ("PHOTOCOPIE", "Frais de photocopie", 10000, True, True),
    ("MUTUELLE", "Mutuelle étudiante", 5000, True, True),
    ("JOURNEE_INTEGRATION", "Journée d'intégration", 8000, False, True),
    ("SOUTENANCE", "Frais de soutenance", 50000, False, True),
    ("EXAMEN", "Frais d'examen national", 30000, False, True),
    ("MATIERE_OEUVRE", "Matière d'œuvre", 15000, False, True),
]


class Command(BaseCommand):
    help = "Amorce idempotente du catalogue de frais annexes (type_frais)."

    @transaction.atomic
    def handle(self, *args, **opts):
        for code, libelle, montant, obligatoire, actif in CATALOGUE:
            TypeFrais.objects.get_or_create(
                code=code,
                defaults={
                    "libelle": libelle,
                    "montant_defaut": montant,
                    "obligatoire": obligatoire,
                    "actif": actif,
                },
            )
        self.stdout.write(self.style.SUCCESS("Catalogue de frais amorcé."))

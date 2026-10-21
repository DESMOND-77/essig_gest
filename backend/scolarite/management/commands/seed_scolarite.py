from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from referentiel.models import AnneeScolaire, Ecole, Niveau
from scolarite.models import ModalitePaiement, TypeFrais

# Grilles tarifaires des affiches, par (sigle d'école, code de niveau) : (inscription ou
# réinscription, nombre de mensualités, montant d'une mensualité), en FCFA. Le « Total »
# imprimé vaut inscription + nombre × mensualité.
TARIFS = {
    ("ESSIG", "L1"): (105000, 9, 70000),
    ("ESSIG", "L2"): (105000, 9, 70000),
    ("ESSIG", "L3"): (105000, 9, 70000),
    ("ESSIG", "M1"): (150000, 8, 175000),
    ("ESSIG", "M2"): (150000, 8, 175000),
    ("ESSS", "L1"): (140000, 8, 95000),
    ("ESSS", "L2"): (140000, 8, 100000),
    ("ESSS", "L3"): (140000, 8, 105000),
    ("ESSS", "MP"): (185000, 16, 120000),
    ("CFPA", "A1"): (50000, 8, 25000),
    ("CFPA", "A2"): (60000, 8, 30000),
}

# Frais annexes des affiches, par sigle d'école : (code, libellé, montant en FCFA). Les
# montants diffèrent d'une école à l'autre alors que `TypeFrais.code` est unique : un type
# par école, de code `<code>-<sigle>`, obligatoire pour toute inscription de l'école.
FRAIS = {
    "ESSIG": [
        ("MUTUELLE", "Mutuelle", 20000),
        ("TENUE", "Uniforme", 80000),
        ("JOURNEE_INTEGRATION", "Journée d'intégration", 10000),
        ("MATIERE_OEUVRE", "Matière d'œuvre", 30000),
    ],
    "ESSS": [
        ("MUTUELLE", "Mutuelle", 20000),
        ("TENUE", "Uniforme", 80000),
        ("MATIERE_OEUVRE", "Matière d'œuvre", 20000),
    ],
    "CFPA": [
        ("MUTUELLE", "Mutuelle", 5000),
        ("TENUE", "Uniforme", 30000),
        ("MATIERE_OEUVRE", "Matière d'œuvre", 20000),
    ],
}


class Command(BaseCommand):
    help = (
        "Amorce idempotente des grilles tarifaires (modalité de paiement par niveau) "
        "et des frais annexes de chaque école."
    )

    def add_arguments(self, parser):
        parser.add_argument("--annee", default="2026-2027")

    @transaction.atomic
    def handle(self, *args, **opts):
        try:
            annee = AnneeScolaire.objects.get(libelle=opts["annee"])
        except AnneeScolaire.DoesNotExist as exc:
            raise CommandError(
                f"AnneeScolaire '{opts['annee']}' introuvable : lancez d'abord seed_referentiel."
            ) from exc

        for (sigle, code), (inscription, nombre, mensualite) in TARIFS.items():
            try:
                niveau = Niveau.objects.get(ecole__sigle=sigle, code=code)
            except Niveau.DoesNotExist as exc:
                raise CommandError(
                    f"Niveau {code} de l'école {sigle} introuvable : "
                    "lancez d'abord seed_referentiel."
                ) from exc
            ModalitePaiement.objects.get_or_create(
                niveau=niveau,
                annee_scolaire=annee,
                defaults={
                    "montant_inscription_reinscription": inscription,
                    "nombre_echeance": nombre,
                    "montant_echeance": mensualite,
                },
            )

        for sigle, frais in FRAIS.items():
            try:
                ecole = Ecole.objects.get(sigle=sigle)
            except Ecole.DoesNotExist as exc:
                raise CommandError(
                    f"École {sigle} introuvable : lancez d'abord seed_referentiel."
                ) from exc
            for code, libelle, montant in frais:
                TypeFrais.objects.get_or_create(
                    code=f"{code}-{sigle}",
                    defaults={
                        "libelle": f"{libelle} ({sigle})",
                        "ecole": ecole,
                        "montant_defaut": montant,
                        "obligatoire": True,
                        "actif": True,
                    },
                )
        self.stdout.write(self.style.SUCCESS("Grilles tarifaires et frais amorcés."))

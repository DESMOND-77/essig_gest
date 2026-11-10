from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = (
        "Amorçage initial complet : rôles, référentiel (écoles, niveaux, filières, options), "
        "grilles tarifaires, frais, pièces, puis import des enseignants et des inscriptions "
        "depuis les classeurs. Idempotent ; pour repartir d'une base vide, lancer "
        "`manage.py flush` auparavant."
    )

    def add_arguments(self, parser):
        parser.add_argument("--annee", default="2026-2027")
        parser.add_argument("--admin-login")
        parser.add_argument("--admin-password")
        parser.add_argument(
            "--enseignants",
            help="Classeur des enseignants (défaut : Enseignants.xlsx à la racine du dépôt).",
        )
        parser.add_argument(
            "--classeur",
            help="Classeur de scolarité (défaut : « test 2026.xlsx » à la racine du dépôt).",
        )

    def handle(self, *args, **opts):
        # Tout est validé avant d'amorcer : une erreur ne laisse pas une base à moitié semée.
        login, mot_de_passe = opts["admin_login"], opts["admin_password"]
        if bool(login) != bool(mot_de_passe):
            raise CommandError("--admin-login et --admin-password vont ensemble.")
        racine = Path(settings.BASE_DIR).parent
        enseignants = self._classeur(opts["enseignants"], racine / "Enseignants.xlsx")
        classeur = self._classeur(opts["classeur"], racine / "test 2026.xlsx")

        call_command(
            "seed_socle", admin_login=login, admin_password=mot_de_passe, stdout=self.stdout
        )
        call_command("seed_referentiel", annee=opts["annee"], stdout=self.stdout)
        call_command("seed_personnes", stdout=self.stdout)
        call_command("seed_scolarite", annee=opts["annee"], stdout=self.stdout)
        if enseignants:
            call_command("import_enseignants", str(enseignants), stdout=self.stdout)
        if classeur:
            call_command(
                "import_scolarite", str(classeur), annee=opts["annee"], stdout=self.stdout
            )
        self.stdout.write(self.style.SUCCESS("Amorçage initial terminé."))

    def _classeur(self, fourni, par_defaut):
        chemin = Path(fourni) if fourni else par_defaut
        if chemin.exists():
            return chemin
        if fourni:
            raise CommandError(f"Fichier introuvable : {chemin}")
        self.stdout.write(self.style.WARNING(f"{chemin.name} absent : import ignoré."))
        return None

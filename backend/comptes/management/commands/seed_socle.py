from django.core.management.base import BaseCommand

from comptes.models import Role, Utilisateur


class Command(BaseCommand):
    help = "Amorce le socle : rôles et, optionnellement, un superutilisateur."

    def add_arguments(self, parser):
        parser.add_argument("--admin-login")
        parser.add_argument("--admin-password")

    def handle(self, *args, **options):
        crees = 0
        for code, libelle in Role.Code.choices:
            _, cree = Role.objects.get_or_create(code=code, defaults={"libelle": libelle})
            crees += int(cree)
        self.stdout.write(f"Rôles créés : {crees}")

        login = options.get("admin_login")
        mdp = options.get("admin_password")
        if login and mdp and not Utilisateur.objects.filter(login=login).exists():
            Utilisateur.objects.creer_superutilisateur(login, f"{login}@local", mdp)
            self.stdout.write(f"Superutilisateur {login} créé.")

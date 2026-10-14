from django.core.management.base import BaseCommand

from comptes.models import Role, Utilisateur, UtilisateurRole


class Command(BaseCommand):
    help = "Amorce le socle : rôles et, optionnellement, un superutilisateur."

    def add_arguments(self, parser):
        parser.add_argument("--admin-login")
        parser.add_argument("--admin-password")

    def handle(self, *args, **options):
        crees = 0
        roles = []
        for code, libelle in Role.Code.choices:
            role, cree = Role.objects.get_or_create(code=code, defaults={"libelle": libelle})
            roles.append(role)
            crees += int(cree)
        self.stdout.write(f"Rôles créés : {crees}")

        login = options.get("admin_login")
        mdp = options.get("admin_password")
        if login and mdp and not Utilisateur.objects.filter(login=login).exists():
            superutilisateur = Utilisateur.objects.creer_superutilisateur(login, f"{login}@local", mdp)
            # Un superutilisateur Django (is_superuser) ne porte aucun rôle métier par défaut :
            # le RBAC applicatif (`comptes.permissions.ARole`, `peutEcrire` côté frontend) se base
            # exclusivement sur `UtilisateurRole`, jamais sur `is_superuser`. Sans cette
            # attribution, le compte créé ici peut lire mais ne peut écrire nulle part dans
            # l'application (tous les boutons d'action restent masqués côté frontend).
            for role in roles:
                UtilisateurRole.objects.get_or_create(utilisateur=superutilisateur, role=role)
            self.stdout.write(f"Superutilisateur {login} créé, avec tous les rôles métier.")

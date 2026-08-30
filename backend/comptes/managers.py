from django.contrib.auth.base_user import BaseUserManager


class UtilisateurManager(BaseUserManager):
    use_in_migrations = True

    def creer_utilisateur(self, login, email, password=None, **extra):
        if not login:
            raise ValueError("Le login est obligatoire.")
        email = self.normalize_email(email)
        utilisateur = self.model(login=login, email=email, **extra)
        utilisateur.set_password(password)
        utilisateur.save(using=self._db)
        return utilisateur

    def creer_superutilisateur(self, login, email, password):
        return self.creer_utilisateur(
            login, email, password, is_staff=True, is_superuser=True
        )

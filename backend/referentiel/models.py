from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator, MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

TAILLE_MAX_LOGO_OCTETS = 2 * 1024 * 1024  # 2 Mo
EXTENSIONS_LOGO_AUTORISEES = ["png", "jpg", "jpeg", "webp"]


def valider_taille_logo(fichier):
    if fichier.size > TAILLE_MAX_LOGO_OCTETS:
        raise ValidationError("Le logo ne doit pas dépasser 2 Mo.")


class Ecole(models.Model):
    # École autonome : pas de Groupe scolaire ni de Pôle (cf. décision
    # docs/superpowers/specs/2026-10-14-suppression-pole-groupe-scolaire-design.md).
    class Regime(models.TextChoices):
        LMD = "LMD", "LMD"
        CLASSIQUE = "CLASSIQUE", "Classique"

    nom = models.CharField(max_length=120)
    sigle = models.CharField(max_length=20, null=True, blank=True)  # noqa: DJ001
    regime = models.CharField(max_length=9, choices=Regime.choices)
    logo = models.ImageField(
        upload_to="ecoles/logos/",
        null=True,
        blank=True,
        validators=[
            FileExtensionValidator(allowed_extensions=EXTENSIONS_LOGO_AUTORISEES),
            valider_taille_logo,
        ],
    )
    contacts = models.CharField(max_length=120, null=True, blank=True)  # noqa: DJ001
    email = models.CharField(max_length=120, null=True, blank=True)  # noqa: DJ001
    adresse = models.CharField(max_length=255, null=True, blank=True)  # noqa: DJ001

    class Meta:
        db_table = "ecole"

    def __str__(self):
        return self.nom


@receiver(pre_save, sender=Ecole)
def _supprimer_ancien_logo_si_remplace(sender, instance, **kwargs):
    if not instance.pk:
        return
    ancien = sender.objects.filter(pk=instance.pk).values_list("logo", flat=True).first()
    if ancien and ancien != instance.logo.name:
        instance._ancien_logo_a_supprimer = ancien


@receiver(post_save, sender=Ecole)
def _supprimer_ancien_logo_apres_sauvegarde(sender, instance, **kwargs):
    ancien = getattr(instance, "_ancien_logo_a_supprimer", None)
    if ancien:
        instance.logo.storage.delete(ancien)
        del instance._ancien_logo_a_supprimer


@receiver(post_delete, sender=Ecole)
def _supprimer_logo_a_la_suppression(sender, instance, **kwargs):
    if instance.logo:
        instance.logo.storage.delete(instance.logo.name)


class AnneeScolaire(models.Model):
    libelle = models.CharField(max_length=9)
    date_debut = models.DateField()
    date_fin = models.DateField()
    est_courante = models.BooleanField(default=False)

    class Meta:
        db_table = "annee_scolaire"
        constraints = [
            models.UniqueConstraint(
                fields=["libelle"], name="unq_annee_scolaire_libelle"
            ),
            # No-op sur MySQL (index partiel non supporté) ; l'unicité effective est
            # assurée par referentiel.services.definir_annee_courante. Correct sur un
            # SGBD à index partiels.
            models.UniqueConstraint(
                fields=["est_courante"],
                condition=Q(est_courante=True),
                name="unq_annee_scolaire_courante",
            ),
        ]

    def __str__(self):
        return self.libelle


class ModaliteFormation(models.Model):
    class Code(models.TextChoices):
        FI = "FI", "Formation initiale"
        FC = "FC", "Formation continue"
        FL = "FL", "FL"
        FT = "FT", "FT"

    code = models.CharField(max_length=2, choices=Code.choices)
    libelle = models.CharField(max_length=60)

    class Meta:
        db_table = "modalite_formation"
        constraints = [
            models.UniqueConstraint(fields=["code"], name="unq_modalite_formation_code")
        ]

    def __str__(self):
        return self.code


class Niveau(models.Model):
    ecole = models.ForeignKey(Ecole, on_delete=models.RESTRICT, related_name="niveaux")
    code = models.CharField(max_length=10)
    libelle = models.CharField(max_length=60)
    ordre = models.IntegerField()
    credits_requis = models.IntegerField(null=True, blank=True)
    a_soutenance = models.BooleanField(default=False)
    a_examen_national = models.BooleanField(default=False)

    class Meta:
        db_table = "niveau"
        constraints = [
            models.UniqueConstraint(
                fields=["ecole", "code"], name="unq_niveau_ecole_code"
            )
        ]

    def __str__(self):
        return f"{self.code} ({self.ecole.sigle or self.ecole.nom})"


class Filiere(models.Model):
    ecole = models.ForeignKey(Ecole, on_delete=models.RESTRICT, related_name="filieres")
    nom = models.CharField(max_length=80)
    sigle = models.CharField(max_length=15)

    class Meta:
        db_table = "filiere"
        constraints = [
            models.UniqueConstraint(
                fields=["ecole", "sigle"], name="unq_filiere_ecole_sigle"
            )
        ]

    def __str__(self):
        return self.sigle


class OptionFiliere(models.Model):
    filiere = models.ForeignKey(
        Filiere, on_delete=models.RESTRICT, related_name="options"
    )
    nom = models.CharField(max_length=80)
    sigle = models.CharField(max_length=15, blank=True)

    class Meta:
        db_table = "option_filiere"
        constraints = [
            models.UniqueConstraint(
                fields=["filiere", "sigle"], name="unq_option_filiere_sigle"
            )
        ]

    def __str__(self):
        return self.sigle or self.nom


class Classe(models.Model):
    annee_scolaire = models.ForeignKey(
        AnneeScolaire, on_delete=models.RESTRICT, related_name="classes"
    )
    niveau = models.ForeignKey(Niveau, on_delete=models.RESTRICT, related_name="classes")
    option_filiere = models.ForeignKey(
        OptionFiliere, on_delete=models.RESTRICT, related_name="classes"
    )
    modalite_formation = models.ForeignKey(
        ModaliteFormation, on_delete=models.RESTRICT, related_name="classes"
    )
    libelle_auto = models.CharField(max_length=120, editable=False)
    effectif_max = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = "classe"
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "annee_scolaire",
                    "niveau",
                    "option_filiere",
                    "modalite_formation",
                ],
                name="unq_classe",
            )
        ]

    def __str__(self):
        return self.libelle_auto


class Matiere(models.Model):
    class Semestre(models.TextChoices):
        S1 = "S1", "Semestre 1"
        S2 = "S2", "Semestre 2"

    niveau = models.ForeignKey(Niveau, on_delete=models.RESTRICT, related_name="matieres")
    option_filiere = models.ForeignKey(
        OptionFiliere, on_delete=models.RESTRICT, related_name="matieres"
    )
    semestre = models.CharField(max_length=2, choices=Semestre.choices)
    nom = models.CharField(max_length=120)
    code = models.CharField(max_length=20)
    coefficient = models.IntegerField()
    credits = models.IntegerField(null=True, blank=True)
    volume_horaire = models.IntegerField()

    class Meta:
        db_table = "matiere"
        constraints = [
            models.UniqueConstraint(
                fields=["niveau", "option_filiere", "semestre", "code"],
                name="unq_matiere",
            )
        ]

    def __str__(self):
        return f"{self.code} {self.nom}"


class Periode(models.Model):
    annee_scolaire = models.ForeignKey(
        AnneeScolaire, on_delete=models.RESTRICT, related_name="periodes"
    )
    numero = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(2)]
    )
    libelle = models.CharField(max_length=40)
    date_debut = models.DateField()
    date_fin = models.DateField()

    class Meta:
        db_table = "periode"
        constraints = [
            models.UniqueConstraint(
                fields=["annee_scolaire", "numero"], name="unq_periode"
            )
        ]

    def __str__(self):
        return f"{self.libelle} {self.annee_scolaire.libelle}"


class SessionExamen(models.Model):
    class Type(models.TextChoices):
        NORMALE = "NORMALE", "Normale"
        RATTRAPAGE = "RATTRAPAGE", "Rattrapage"

    periode = models.ForeignKey(
        Periode, on_delete=models.RESTRICT, related_name="sessions"
    )
    type = models.CharField(max_length=10, choices=Type.choices)
    date_debut = models.DateField(null=True, blank=True)
    date_fin = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "session_examen"
        constraints = [
            models.UniqueConstraint(
                fields=["periode", "type"], name="unq_session_examen"
            )
        ]

    def __str__(self):
        return f"{self.type} — {self.periode}"


# Alias de choix pour SPECTACULAR_SETTINGS.ENUM_NAME_OVERRIDES (cf. personnes.models).
SESSION_EXAMEN_TYPE_CHOICES = SessionExamen.Type.choices

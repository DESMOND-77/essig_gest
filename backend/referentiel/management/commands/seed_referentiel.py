from django.core.management.base import BaseCommand
from django.db import transaction

from referentiel import models, services

# Établissements du Groupe ESSIG (campus de Franceville), d'après les affiches de la
# campagne d'inscription. Le sigle d'ESSIG-USIA reste court : il préfixe le matricule
# étudiant (VARCHAR(20), cf. personnes.services.generer_matricule).
CONTACTS = "066 91 00 99 / 077 29 09 17"
EMAIL = "essigcours@gmail.com"
ADRESSE_CAISSE = "À la caisse, en face du dispensaire CNSS de Franceville"
ECOLES = [
    # (nom, sigle, régime, adresse)
    ("ESSIG-USIA", "ESSIG", "LMD", "À 100 mètres de l'hôpital de la CNSS, Franceville"),
    ("École Supérieure des Sciences de la Santé", "ESSS", "LMD", ADRESSE_CAISSE),
    ("Centre de Formation Polytechnique Appliquée", "CFPA", "CLASSIQUE", ADRESSE_CAISSE),
]
MODALITES = [
    ("FI", "Formation initiale"),
    ("FC", "Formation continue"),
    ("FL", "Formation à distance"),
    ("FT", "Formation en alternance"),
]
# Niveaux par école, dans l'ordre de progression : (code, libellé). Le « Master
# Professionnel » d'ESSS est un seul niveau (une seule grille, 16 mensualités).
NIVEAUX = {
    "ESSIG": [
        ("L1", "Licence 1"),
        ("L2", "Licence 2"),
        ("L3", "Licence 3"),
        ("M1", "Master 1"),
        ("M2", "Master 2"),
    ],
    "ESSS": [
        ("L1", "Licence 1"),
        ("L2", "Licence 2"),
        ("L3", "Licence 3"),
        ("MP", "Master Professionnel"),
    ],
    "CFPA": [("A1", "1ère année"), ("A2", "2ème année")],
}
# Filières par école : (nom, sigle, [(nom de l'option, sigle), ...]). ESSS et CFPA
# listent leurs formations à plat : elles sont regroupées sous une filière unique.
FILIERES = {
    "ESSIG": [
        (
            "Activités Économiques Littorales et Maritimes",
            "AELM",
            [
                ("Logistique et Transport", "LT"),
                ("Transit et Douane", "TD"),
                ("Commerce International et Transit", "CIT"),
            ],
        ),
        (
            "Gestion Administrative et Commerciale des Organisations",
            "GACO",
            [
                ("Assistant Manager", "AM"),
                ("Commerce et Distribution", "CD"),
                ("Techniques Commerciales et Managériales", "TCM"),
                ("Gestion des Entreprises d'Export-Import", "GEEI"),
                ("Coaching", "COACHING"),
            ],
        ),
        (
            "Gestion des Entreprises et des Administrations",
            "GEA",
            [
                ("Banque-Finance", "BF"),
                ("Banque Assurance Microfinance", "BAM"),
                ("Comptabilité Contrôle Audit et Finance", "CCAF"),
                ("Gestion des Ressources Humaines", "GRH"),
                ("Administration du Travail et de la Sécurité Sociale", "ATSS"),
                ("Collectivités Locales et Territoriales", "CLT"),
                ("Entrepreneuriat et Gestion", "EG"),
            ],
        ),
        (
            "Informations et Communications",
            "IC",
            [
                ("Journalisme et Communication", "JC"),
                ("Communication d'Entreprise", "CE"),
                ("Management de la Communication", "MC"),
                ("Communication et Publicité", "CP"),
                ("Infographie et Multimédia", "IM"),
                ("Community Manager « Marketing Digitale »", "CM"),
            ],
        ),
        (
            "Droits et Fiscalité",
            "DF",
            [
                ("Droit Privé : Droit des Affaires", "DA"),
                ("Droit International", "DI"),
                ("Carrières Juridiques", "CJ"),
                ("Droit du Travail", "DT"),
                ("Fiscalité", "FI"),
            ],
        ),
        (
            "Réseaux et Génie Informatique",
            "RGI",
            [
                ("Administration des Systèmes Informatiques", "ASI"),
                ("Gestion des Réseaux Informatiques", "GRI"),
                ("Maintenance et Réseaux Informatiques", "MRI"),
            ],
        ),
        (
            "Qualité Hygiène Sécurité et Environnement",
            "QHSE",
            [
                ("Hygiène Sécurité et Environnement", "HSE"),
                ("Contrôle de la Qualité", "CQ"),
                ("Sécurité Santé au Travail et Environnement", "SSTE"),
                ("Qualité Hygiène Sécurité et Environnement", "QHSE"),
            ],
        ),
    ],
    "ESSS": [
        (
            "Santé",
            "SANTE",
            [
                ("Biologie Médicale", "BM"),
                ("Maïeutique (Sages-femmes)", "SG"),
                ("Soins Infirmiers", "SI"),
            ],
        ),
    ],
    "CFPA": [
        (
            "Formations Professionnelles",
            "FP",
            [
                ("Éducatrice Préscolaire", "EP"),
                ("Gestion Comptabilité", "GC"),
                ("Maintenance Informatique", "MI"),
                ("Infirmière Assistante", "IASS"),
                ("Infirmière Accoucheuse", "IACC"),
                ("Vendeuse en Pharmacie", "VP"),
                ("Secrétaire Bureautique", "SB"),
                ("Secrétariat Comptable", "SC"),
                ("Déclarant en Douane", "TD"),
                ("Hôtellerie et Restauration", "HR"),
            ],
        ),
    ],
}


class Command(BaseCommand):
    help = (
        "Amorce idempotente du référentiel (écoles, niveaux, filières et options, "
        "modalités, année, périodes)."
    )

    def add_arguments(self, parser):
        parser.add_argument("--annee", default="2026-2027")

    @transaction.atomic
    def handle(self, *args, **opts):
        for nom, sigle, regime, adresse in ECOLES:
            ecole, _ = models.Ecole.objects.get_or_create(
                sigle=sigle,
                defaults={
                    "nom": nom,
                    "regime": regime,
                    "contacts": CONTACTS,
                    "email": EMAIL,
                    "adresse": adresse,
                },
            )
            self._amorcer_niveaux(ecole)
            self._amorcer_filieres(ecole)
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

    def _amorcer_niveaux(self, ecole):
        for ordre, (code, libelle) in enumerate(NIVEAUX[ecole.sigle], start=1):
            models.Niveau.objects.get_or_create(
                ecole=ecole, code=code, defaults={"libelle": libelle, "ordre": ordre}
            )

    def _amorcer_filieres(self, ecole):
        for nom, sigle, options in FILIERES[ecole.sigle]:
            filiere, _ = models.Filiere.objects.get_or_create(
                ecole=ecole, sigle=sigle, defaults={"nom": nom}
            )
            for nom_option, sigle_option in options:
                models.OptionFiliere.objects.get_or_create(
                    filiere=filiere, sigle=sigle_option, defaults={"nom": nom_option}
                )

"""Import legacy du groupe `tresorerie` (§16 Phase 10) depuis un classeur Excel.

Périmètre couvert, conformément à `db/IMPORT_MAPPING_tresorerie.md` :
- feuille `DEPENSES`, sous-tableau principal (colonnes A-C) -> `Depense` + `Mouvement`.
- feuille `VERSEMENTS` (nom réel avec espace final), blocs Versements/Retraits -> `Mouvement`.

Hors périmètre (cf. mapping, à traiter ailleurs ou manuellement) :
- sous-tableaux RH de `DEPENSES` (salaires enseignants/administration) -> groupe `rh_paie`.
- feuilles `BILAN ESSIG`/`BILAN UPSS`/`BILAN CFPA` -> dépendent d'`Inscription`/`Echeance`
  déjà créées, trop ambiguës pour un import automatique sans validation métier au cas par cas.
- feuille `BILAN TOTAL` -> vue recalculée, ne doit jamais être importée telle quelle.
"""
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

import openpyxl
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from referentiel.models import AnneeScolaire, Ecole
from tresorerie.models import CategorieMouvement, Compte, Depense, Mouvement

NOM_FEUILLE_DEPENSES = "DEPENSES"
NOM_FEUILLE_VERSEMENTS = "VERSEMENTS"
LIGNES_IGNOREES = {"total", "totaux"}


class Command(BaseCommand):
    help = (
        "Import idempotent des feuilles DEPENSES et VERSEMENTS d'un classeur legacy "
        "trésorerie (§16 Phase 10) vers Mouvement/Depense."
    )

    def add_arguments(self, parser):
        parser.add_argument("fichier", help="Chemin du classeur .xlsx source")
        parser.add_argument(
            "--annee-scolaire", required=True,
            help="Libellé AnneeScolaire à affecter aux lignes importées (ex: 2025-2026)",
        )
        parser.add_argument(
            "--compte-caisse", required=True,
            help="Code Compte (caisse) utilisé pour les dépenses et les retraits sans contrepartie",
        )
        parser.add_argument(
            "--compte-banque", required=True,
            help="Code Compte (banque) utilisé pour la feuille VERSEMENTS",
        )
        parser.add_argument(
            "--ecole", default=None,
            help="Sigle Ecole à affecter aux lignes importées (optionnel, laissé vide sinon)",
        )
        parser.add_argument(
            "--rapport-erreurs", default=None,
            help="Chemin du fichier rapport d'erreurs (par défaut: horodaté dans le répertoire courant)",
        )

    def handle(self, *args, **opts):
        chemin = Path(opts["fichier"])
        if not chemin.exists():
            raise CommandError(f"Fichier introuvable : {chemin}")

        annee_scolaire = self._resoudre_annee_scolaire(opts["annee_scolaire"])
        ecole = self._resoudre_ecole(opts["ecole"])
        compte_caisse = self._get_or_create_compte(opts["compte_caisse"], Compte.Type.CAISSE)
        compte_banque = self._get_or_create_compte(opts["compte_banque"], Compte.Type.BANQUE)

        erreurs = []
        resume = {"traitees": 0, "importees": 0, "ignorees": 0, "erreurs": 0}

        classeur = openpyxl.load_workbook(chemin, data_only=True)
        feuilles = {nom.strip(): nom for nom in classeur.sheetnames}

        if NOM_FEUILLE_DEPENSES in feuilles:
            self._importer_depenses(
                classeur[feuilles[NOM_FEUILLE_DEPENSES]], annee_scolaire, ecole,
                compte_caisse, erreurs, resume,
            )
        else:
            self.stdout.write(self.style.WARNING(f"Feuille '{NOM_FEUILLE_DEPENSES}' absente, ignorée."))

        if NOM_FEUILLE_VERSEMENTS in feuilles:
            self._importer_versements(
                classeur[feuilles[NOM_FEUILLE_VERSEMENTS]], annee_scolaire, ecole,
                compte_banque, compte_caisse, erreurs, resume,
            )
        else:
            self.stdout.write(self.style.WARNING(f"Feuille '{NOM_FEUILLE_VERSEMENTS}' absente, ignorée."))

        self._ecrire_rapport_erreurs(opts["rapport_erreurs"], erreurs)

        self.stdout.write(self.style.SUCCESS(
            f"Import terminé : {resume['traitees']} ligne(s) traitée(s), "
            f"{resume['importees']} importée(s), {resume['ignorees']} ignorée(s), "
            f"{resume['erreurs']} en erreur."
        ))

    def _resoudre_annee_scolaire(self, libelle):
        try:
            return AnneeScolaire.objects.get(libelle=libelle)
        except AnneeScolaire.DoesNotExist as exc:
            raise CommandError(f"AnneeScolaire '{libelle}' introuvable, créez-la au préalable.") from exc

    def _resoudre_ecole(self, sigle):
        if not sigle:
            return None
        try:
            return Ecole.objects.get(sigle=sigle)
        except Ecole.DoesNotExist as exc:
            raise CommandError(f"Ecole de sigle '{sigle}' introuvable.") from exc

    def _get_or_create_compte(self, code, type_compte):
        compte, cree = Compte.objects.get_or_create(
            code=code, defaults={"libelle": code, "type": type_compte},
        )
        if cree:
            self.stdout.write(self.style.WARNING(f"Compte '{code}' créé automatiquement (à valider)."))
        return compte

    def _get_or_create_categorie(self, code, libelle, sens):
        categorie, cree = CategorieMouvement.objects.get_or_create(
            code=code, defaults={"libelle": libelle, "sens": sens},
        )
        if cree:
            self.stdout.write(self.style.WARNING(f"CategorieMouvement '{code}' créée automatiquement."))
        return categorie

    def _comme_date(self, valeur):
        if isinstance(valeur, datetime):
            return valeur.date()
        if isinstance(valeur, date):
            return valeur
        return None

    def _comme_montant(self, valeur):
        try:
            montant = Decimal(str(valeur)).to_integral_value()
        except (InvalidOperation, TypeError):
            return None
        if montant <= 0:
            return None
        return montant

    def _est_ligne_total(self, valeur):
        return isinstance(valeur, str) and valeur.strip().lower() in LIGNES_IGNOREES

    def _ecrire_rapport_erreurs(self, chemin_fourni, erreurs):
        if not erreurs:
            return
        if chemin_fourni:
            chemin = Path(chemin_fourni)
        else:
            horodatage = datetime.now().strftime("%Y%m%d_%H%M%S")
            chemin = Path(f"rapport_import_tresorerie_{horodatage}.txt")
        with open(chemin, "w", encoding="utf-8") as f:
            for ligne in erreurs:
                f.write(ligne + "\n")
        self.stdout.write(self.style.ERROR(
            f"{len(erreurs)} erreur(s) consignée(s) dans {chemin}"
        ))

    @transaction.atomic
    def _importer_depenses(self, feuille, annee_scolaire, ecole, compte, erreurs, resume):
        categorie = self._get_or_create_categorie(
            "DIVERS", "Dépenses diverses (import legacy)", CategorieMouvement.Sens.SORTIE,
        )
        for num_ligne, ligne in enumerate(feuille.iter_rows(min_row=6, max_col=3, values_only=True), start=6):
            date_brute, designation_brute, montant_brut = ligne
            if date_brute is None and designation_brute is None and montant_brut is None:
                continue
            if self._est_ligne_total(date_brute) or self._est_ligne_total(designation_brute):
                continue

            resume["traitees"] += 1
            designation = (designation_brute or "").strip() if isinstance(designation_brute, str) else designation_brute
            date_operation = self._comme_date(date_brute)
            montant = self._comme_montant(montant_brut)

            if not date_operation:
                erreurs.append(f"DEPENSES ligne {num_ligne}: date manquante ou invalide ({date_brute!r})")
                resume["erreurs"] += 1
                continue
            if not designation:
                erreurs.append(f"DEPENSES ligne {num_ligne}: désignation manquante")
                resume["erreurs"] += 1
                continue
            if montant is None:
                erreurs.append(f"DEPENSES ligne {num_ligne}: montant invalide ou non positif ({montant_brut!r})")
                resume["erreurs"] += 1
                continue

            depense = Depense.objects.filter(
                date=date_operation, designation=designation, montant=montant,
                annee_scolaire=annee_scolaire,
            ).first()
            if depense:
                resume["ignorees"] += 1
                self.stdout.write(f"DEPENSES ligne {num_ligne}: déjà importée, ignorée.")
                continue

            mouvement = Mouvement.objects.create(
                compte=compte, date_operation=date_operation, sens=Mouvement.Sens.DEBIT,
                montant=montant, categorie_mouvement=categorie, libelle=designation,
                ecole=ecole, annee_scolaire=annee_scolaire,
            )
            Depense.objects.create(
                date=date_operation, categorie_mouvement=categorie, beneficiaire=designation,
                designation=designation, montant=montant, compte=compte, mouvement=mouvement,
                ecole=ecole, annee_scolaire=annee_scolaire, statut=Depense.Statut.PAYEE,
            )
            resume["importees"] += 1
            self.stdout.write(f"DEPENSES ligne {num_ligne}: importée ({designation}, {montant} FCFA).")

    @transaction.atomic
    def _importer_versements(self, feuille, annee_scolaire, ecole, compte_banque, compte_caisse, erreurs, resume):
        categorie_versement = self._get_or_create_categorie(
            "VERSEMENT_BANQUE", "Versement banque (import legacy)", CategorieMouvement.Sens.ENTREE,
        )
        categorie_retrait = self._get_or_create_categorie(
            "RETRAIT_BANQUE", "Retrait banque (import legacy)", CategorieMouvement.Sens.SORTIE,
        )
        for num_ligne, ligne in enumerate(feuille.iter_rows(min_row=6, max_col=7, values_only=True), start=6):
            date_versement, montant_versement = ligne[1], ligne[2]
            date_retrait, montant_retrait = ligne[5], ligne[6]

            self._traiter_mouvement_versement(
                num_ligne, "Versement", date_versement, montant_versement, compte_banque,
                Mouvement.Sens.CREDIT, categorie_versement, annee_scolaire, ecole, erreurs, resume,
            )
            self._traiter_mouvement_versement(
                num_ligne, "Retrait", date_retrait, montant_retrait, compte_banque,
                Mouvement.Sens.DEBIT, categorie_retrait, annee_scolaire, ecole, erreurs, resume,
            )

    def _traiter_mouvement_versement(
        self, num_ligne, libelle_bloc, date_brute, montant_brut, compte, sens, categorie,
        annee_scolaire, ecole, erreurs, resume,
    ):
        if date_brute is None and montant_brut is None:
            return
        if self._est_ligne_total(date_brute):
            return

        resume["traitees"] += 1
        date_operation = self._comme_date(date_brute)
        montant = self._comme_montant(montant_brut)

        if not date_operation:
            erreurs.append(f"VERSEMENTS ligne {num_ligne} ({libelle_bloc}): date manquante ou invalide ({date_brute!r})")
            resume["erreurs"] += 1
            return
        if montant is None:
            erreurs.append(f"VERSEMENTS ligne {num_ligne} ({libelle_bloc}): montant invalide ou non positif ({montant_brut!r})")
            resume["erreurs"] += 1
            return

        existants = Mouvement.objects.filter(
            compte=compte, date_operation=date_operation, sens=sens, montant=montant,
        )
        if existants.exists():
            resume["ignorees"] += 1
            self.stdout.write(f"VERSEMENTS ligne {num_ligne} ({libelle_bloc}): déjà importé, ignoré.")
            return

        Mouvement.objects.create(
            compte=compte, date_operation=date_operation, sens=sens, montant=montant,
            categorie_mouvement=categorie, libelle=f"{libelle_bloc} banque (import legacy)",
            ecole=ecole, annee_scolaire=annee_scolaire,
        )
        resume["importees"] += 1
        self.stdout.write(f"VERSEMENTS ligne {num_ligne} ({libelle_bloc}): importé ({montant} FCFA).")

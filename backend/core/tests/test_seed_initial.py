import openpyxl
import pytest
from django.core.management import CommandError, call_command

from comptes.models import Role, Utilisateur, UtilisateurRole
from personnes.models import Inscription, TypePiece
from referentiel.models import AnneeScolaire, Ecole, Filiere, Niveau, OptionFiliere
from rh_paie.models import Enseignant
from scolarite.models import ModalitePaiement, TypeFrais

pytestmark = pytest.mark.django_db


def _classeur_enseignants(chemin):
    classeur = openpyxl.Workbook()
    feuille = classeur.active
    feuille.append(["NOM", "PRENOM", "TELEPHONE", "EMAIL"])
    feuille.append(["ABAKER ", "Madi Guirema", "062-12-77-12", None])
    feuille.append(["D\\'ARTAGNAN", "Charles", None, None])
    classeur.save(chemin)
    return chemin


def _classeur_inscriptions(chemin):
    """Un étudiant par feuille, écrit avec le vocabulaire des listes déroulantes du
    classeur (`L 1`, `GACO / TCM`, `1ère  Année`, `EP`), suivi de lignes de gabarit."""
    classeur = openpyxl.Workbook()
    classeur.active.title = "ESSIG"
    classeur.create_sheet("ESSS")
    classeur.create_sheet("CFPA")
    # (nom, niveau, filière/option, colonne du matricule) : sans colonne « type de
    # formation » (ESSS, CFPA), le matricule est en AE (31) au lieu de AF (32).
    etudiants = {
        "ESSIG": ("DIALLO Mamadou", "L 1", "GACO / TCM", 32, "ESSIG-FCV0001"),
        "ESSS": ("DUPONT Anne", "L 2", "SANTE / BM", 31, "ESSS-FCV0001"),
        "CFPA": ("DURAND Carine", "1ère  Année", "EP", 31, "CFPA-FCV0001"),
    }
    for nom_feuille, (nom, niveau, option, colonne_matricule, matricule) in etudiants.items():
        feuille = classeur[nom_feuille]
        feuille.cell(row=4, column=1, value=1)
        feuille.cell(row=4, column=2, value=nom)
        feuille.cell(row=4, column=3, value=niveau)
        feuille.cell(row=4, column=4, value=option)
        feuille.cell(row=4, column=colonne_matricule, value=matricule)
        for ligne in (5, 6):
            feuille.cell(row=ligne, column=1, value=ligne - 3)
    classeur.save(chemin)
    return chemin


def _fichiers(tmp_path):
    return [
        "--enseignants",
        str(_classeur_enseignants(tmp_path / "enseignants.xlsx")),
        "--classeur",
        str(_classeur_inscriptions(tmp_path / "inscriptions.xlsx")),
    ]


def _compter():
    return {
        modele.__name__: modele.objects.count()
        for modele in (
            Role,
            Ecole,
            Niveau,
            Filiere,
            OptionFiliere,
            AnneeScolaire,
            ModalitePaiement,
            TypeFrais,
            TypePiece,
            Enseignant,
            Inscription,
        )
    }


def test_seed_initial_amorce_tout_et_est_idempotent(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)

    call_command("seed_initial", *_fichiers(tmp_path))

    premier_passage = _compter()
    assert premier_passage["Enseignant"] == 2
    assert premier_passage["Inscription"] == 3
    assert all(nombre > 0 for nombre in premier_passage.values())
    assert AnneeScolaire.objects.get(est_courante=True).libelle == "2026-2027"

    call_command("seed_initial", *_fichiers(tmp_path))
    assert _compter() == premier_passage


def test_seed_initial_importe_les_inscriptions_contre_le_referentiel_seme(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)

    call_command("seed_initial", *_fichiers(tmp_path))

    inscriptions = {
        i.etudiant.matricule: (
            i.ecole.sigle,
            i.classe.niveau.code,
            f"{i.classe.option_filiere.filiere.sigle}/{i.classe.option_filiere.sigle}",
        )
        for i in Inscription.objects.select_related(
            "etudiant", "ecole", "classe__niveau", "classe__option_filiere__filiere"
        )
    }
    assert inscriptions == {
        "ESSIG-FCV0001": ("ESSIG", "L1", "GACO/TCM"),
        "ESSS-FCV0001": ("ESSS", "L2", "SANTE/BM"),
        "CFPA-FCV0001": ("CFPA", "A1", "FP/EP"),
    }


def test_seed_initial_nettoie_les_noms_d_enseignants_importes(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)

    call_command("seed_initial", *_fichiers(tmp_path))

    assert set(Enseignant.objects.values_list("nom", flat=True)) == {"ABAKER", "D'ARTAGNAN"}


def test_seed_initial_cree_l_admin_demande_avec_tous_les_roles(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)

    call_command(
        "seed_initial",
        "--admin-login",
        "root",
        "--admin-password",
        "motdepasse42",
        *_fichiers(tmp_path),
    )

    admin = Utilisateur.objects.get(login="root")
    assert admin.is_superuser
    assert admin.check_password("motdepasse42")
    assert UtilisateurRole.objects.filter(utilisateur=admin).count() == 5


def test_seed_initial_ne_cree_aucun_admin_sans_login_ni_mot_de_passe(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)

    call_command("seed_initial", *_fichiers(tmp_path))

    assert Utilisateur.objects.count() == 0


def test_seed_initial_exige_le_login_et_le_mot_de_passe_ensemble(tmp_path):
    with pytest.raises(CommandError, match="--admin-password"):
        call_command("seed_initial", "--admin-login", "root", *_fichiers(tmp_path))

    assert Role.objects.count() == 0 and Ecole.objects.count() == 0


def test_seed_initial_refuse_un_fichier_introuvable_avant_tout_amorcage(tmp_path):
    with pytest.raises(CommandError, match="introuvable"):
        call_command("seed_initial", "--enseignants", str(tmp_path / "absent.xlsx"))

    assert Ecole.objects.count() == 0 and Role.objects.count() == 0


def test_seed_initial_cherche_les_classeurs_a_la_racine_du_depot(tmp_path, monkeypatch, settings):
    # `settings.BASE_DIR` est le dossier `backend/` : les classeurs sont dans son parent,
    # quel que soit le dossier courant.
    ailleurs = tmp_path / "ailleurs"
    ailleurs.mkdir()
    monkeypatch.chdir(ailleurs)
    settings.BASE_DIR = tmp_path / "backend"
    _classeur_enseignants(tmp_path / "Enseignants.xlsx")
    _classeur_inscriptions(tmp_path / "test 2026.xlsx")

    call_command("seed_initial")

    assert Enseignant.objects.count() == 2
    assert Inscription.objects.count() == 3


def test_seed_initial_saute_les_classeurs_par_defaut_absents(tmp_path, settings):
    settings.BASE_DIR = tmp_path / "backend"

    call_command("seed_initial")

    assert Ecole.objects.count() == 3
    assert Enseignant.objects.count() == 0 and Inscription.objects.count() == 0

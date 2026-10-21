from io import StringIO

import openpyxl
import pytest
from django.core.management import call_command

from personnes.models import Etudiant, Inscription
from referentiel.tests.factories import (
    AnneeScolaireFactory,
    EcoleFactory,
    FiliereFactory,
    ModaliteFormationFactory,
    NiveauFactory,
    OptionFiliereFactory,
)

pytestmark = pytest.mark.django_db


def _creer_classeur(
    tmp_path, niveau, option_filiere, *, feuille_nom="ESSIG", niveau_brut=None, option_brute=None
):
    classeur = openpyxl.Workbook()
    feuille = classeur.active
    feuille.title = feuille_nom
    for ligne in range(1, 4):
        feuille.cell(row=ligne, column=1, value="en-tête")
    feuille.cell(row=4, column=1, value=1)  # A: N° ordre
    feuille.cell(row=4, column=2, value="DIALLO Mamadou")  # B: NOMS ET PRENOMS
    feuille.cell(
        row=4, column=3, value=niveau.libelle if niveau_brut is None else niveau_brut
    )  # C: NIVEAU
    feuille.cell(
        row=4,
        column=4,
        value=(
            f"{option_filiere.filiere.sigle}/{option_filiere.sigle}"
            if option_brute is None
            else option_brute
        ),
    )  # D
    feuille.cell(row=4, column=29, value=150000)  # AC: Coût de la scolarité
    feuille.cell(row=4, column=32, value="ESSIG-0001")  # AF: N° MATRICULE
    chemin = tmp_path / "test_import.xlsx"
    classeur.save(chemin)
    return chemin


def _referentiel(sigle_ecole, *, code_niveau, libelle_niveau, sigle_filiere, sigle_option):
    ecole = EcoleFactory(sigle=sigle_ecole)
    annee = AnneeScolaireFactory(libelle="2026-2027")
    niveau = NiveauFactory(ecole=ecole, code=code_niveau, libelle=libelle_niveau)
    filiere = FiliereFactory(ecole=ecole, sigle=sigle_filiere)
    option = OptionFiliereFactory(filiere=filiere, sigle=sigle_option)
    ModaliteFormationFactory(code="FI")
    return ecole, annee, niveau, option


@pytest.fixture
def jeu_de_test():
    ecole = EcoleFactory(sigle="ESSIG")
    annee = AnneeScolaireFactory(libelle="2025-2026")
    niveau = NiveauFactory(ecole=ecole, libelle="L1")
    filiere = FiliereFactory(ecole=ecole, sigle="GACO")
    option = OptionFiliereFactory(filiere=filiere, sigle="CI")
    modalite = ModaliteFormationFactory(code="FI")
    return ecole, annee, niveau, option, modalite


def test_import_scolarite_cree_etudiant_et_inscription(tmp_path, jeu_de_test):
    _, annee, niveau, option, _ = jeu_de_test
    chemin = _creer_classeur(tmp_path, niveau, option)

    call_command("import_scolarite", str(chemin), "--annee", annee.libelle)

    assert Etudiant.objects.filter(matricule="ESSIG-0001").count() == 1
    assert Inscription.objects.filter(etudiant__matricule="ESSIG-0001").count() == 1
    inscription = Inscription.objects.get(etudiant__matricule="ESSIG-0001")
    assert inscription.cout_scolarite_negocie == 150000


def test_import_scolarite_est_idempotent(tmp_path, jeu_de_test):
    _, annee, niveau, option, _ = jeu_de_test
    chemin = _creer_classeur(tmp_path, niveau, option)

    call_command("import_scolarite", str(chemin), "--annee", annee.libelle)
    call_command("import_scolarite", str(chemin), "--annee", annee.libelle)

    assert Etudiant.objects.filter(matricule="ESSIG-0001").count() == 1
    assert Inscription.objects.filter(etudiant__matricule="ESSIG-0001").count() == 1


def test_import_scolarite_journalise_ligne_sans_matricule(tmp_path, jeu_de_test):
    _, annee, niveau, option, _ = jeu_de_test
    chemin = _creer_classeur(tmp_path, niveau, option)
    classeur = openpyxl.load_workbook(chemin)
    classeur["ESSIG"].cell(row=4, column=32).value = None
    classeur.save(chemin)
    rapport = tmp_path / "rapport.txt"

    call_command(
        "import_scolarite",
        str(chemin),
        "--annee",
        annee.libelle,
        "--rapport-erreurs",
        str(rapport),
    )

    assert Etudiant.objects.count() == 0
    assert rapport.exists()
    assert "matricule" in rapport.read_text(encoding="utf-8")


def test_import_scolarite_rattache_la_feuille_esss_a_l_ecole_esss(tmp_path):
    ecole, annee, niveau, option = _referentiel(
        "ESSS",
        code_niveau="L1",
        libelle_niveau="Licence 1",
        sigle_filiere="SANTE",
        sigle_option="BM",
    )
    chemin = _creer_classeur(tmp_path, niveau, option, feuille_nom="ESSS")

    call_command("import_scolarite", str(chemin), "--annee", annee.libelle)

    assert Inscription.objects.get(etudiant__matricule="ESSIG-0001").ecole == ecole


def test_import_scolarite_ignore_les_lignes_de_gabarit_sans_nom(tmp_path, monkeypatch, jeu_de_test):
    # Dans le gabarit `test 2026.xlsx`, seule la colonne A (N° ordre) est pré-remplie :
    # ce n'est pas un étudiant, donc ni ligne traitée ni erreur.
    monkeypatch.chdir(tmp_path)
    _, annee, _, _, _ = jeu_de_test
    classeur = openpyxl.Workbook()
    feuille = classeur.active
    feuille.title = "ESSIG"
    for ligne in range(4, 7):
        feuille.cell(row=ligne, column=1, value=ligne - 3)
    chemin = tmp_path / "gabarit.xlsx"
    classeur.save(chemin)
    sortie = StringIO()

    call_command("import_scolarite", str(chemin), "--annee", annee.libelle, stdout=sortie)

    assert "sur 0 ligne(s) traitée(s), 0 erreur(s)" in sortie.getvalue()
    assert list(tmp_path.glob("rapport_import_scolarite_*.txt")) == []


def test_import_scolarite_traite_une_ligne_avec_matricule_mais_sans_nom(
    tmp_path, monkeypatch, jeu_de_test
):
    # Avec un matricule, ce n'est plus une ligne de gabarit : on la journalise au lieu de
    # l'ignorer en silence.
    monkeypatch.chdir(tmp_path)
    _, annee, _, _, _ = jeu_de_test
    classeur = openpyxl.Workbook()
    feuille = classeur.active
    feuille.title = "ESSIG"
    feuille.cell(row=4, column=1, value=1)
    feuille.cell(row=4, column=32, value="ESSIG-0009")  # AF: N° MATRICULE
    chemin = tmp_path / "ligne_sans_nom.xlsx"
    classeur.save(chemin)
    sortie = StringIO()

    call_command("import_scolarite", str(chemin), "--annee", annee.libelle, stdout=sortie)

    assert "sur 1 ligne(s) traitée(s), 1 erreur(s)" in sortie.getvalue()


@pytest.mark.parametrize(
    "niveau_brut, code, libelle",
    [
        ("L 1", "L1", "Licence 1"),  # liste déroulante du classeur ESSIG/ESSS
        ("1ère  Année", "A1", "1ère année"),  # double espace, liste déroulante CFPA
    ],
)
def test_import_scolarite_tolere_espaces_et_casse_dans_le_niveau(
    tmp_path, niveau_brut, code, libelle
):
    _, annee, niveau, option = _referentiel(
        "ESSIG", code_niveau=code, libelle_niveau=libelle, sigle_filiere="GACO", sigle_option="CI"
    )
    chemin = _creer_classeur(tmp_path, niveau, option, niveau_brut=niveau_brut)

    call_command("import_scolarite", str(chemin), "--annee", annee.libelle)

    assert Inscription.objects.get().classe.niveau == niveau


@pytest.mark.parametrize("option_brute, sigle", [("EP", "EP"), ("I Ass", "IASS")])
def test_import_scolarite_resout_une_option_citee_sans_filiere(tmp_path, option_brute, sigle):
    # Feuille CFPA : la colonne « FILIERES ET OPTION » ne contient que l'option.
    _, annee, niveau, option = _referentiel(
        "CFPA",
        code_niveau="A1",
        libelle_niveau="1ère année",
        sigle_filiere="FP",
        sigle_option=sigle,
    )
    chemin = _creer_classeur(
        tmp_path, niveau, option, feuille_nom="CFPA", option_brute=option_brute
    )

    call_command("import_scolarite", str(chemin), "--annee", annee.libelle)

    assert Inscription.objects.get().classe.option_filiere == option


def test_import_scolarite_refuse_une_option_sans_filiere_ambigue(tmp_path, monkeypatch):
    # Même sigle d'option dans deux filières de l'école : ne jamais choisir arbitrairement.
    monkeypatch.chdir(tmp_path)
    ecole, annee, niveau, option = _referentiel(
        "CFPA", code_niveau="A1", libelle_niveau="1ère année", sigle_filiere="FP", sigle_option="EP"
    )
    OptionFiliereFactory(filiere=FiliereFactory(ecole=ecole, sigle="AUTRE"), sigle="EP")
    chemin = _creer_classeur(tmp_path, niveau, option, feuille_nom="CFPA", option_brute="EP")

    call_command("import_scolarite", str(chemin), "--annee", annee.libelle)

    assert Inscription.objects.count() == 0

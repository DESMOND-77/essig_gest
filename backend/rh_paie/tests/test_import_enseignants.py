import openpyxl
import pytest
from django.core.management import call_command

from rh_paie.models import Enseignant

pytestmark = pytest.mark.django_db


def _creer_classeur(tmp_path, lignes):
    classeur = openpyxl.Workbook()
    feuille = classeur.active
    feuille.append(["NOM", "PRENOM", "TELEPHONE", "EMAIL"])
    for ligne in lignes:
        feuille.append(ligne)
    chemin = tmp_path / "enseignants.xlsx"
    classeur.save(chemin)
    return chemin


def test_import_enseignants_cree_les_lignes_valides(tmp_path):
    chemin = _creer_classeur(
        tmp_path,
        [
            ("ABAKER ", "Madi Guirema", "062-12-77-12", "abaker@gmail.com"),
            ("MANFOUMBI", "Térence", 24174436161, None),
        ],
    )

    call_command("import_enseignants", str(chemin))

    assert Enseignant.objects.count() == 2
    abaker = Enseignant.objects.get(nom="ABAKER")
    assert abaker.email == "abaker@gmail.com"
    manfoumbi = Enseignant.objects.get(nom="MANFOUMBI")
    assert manfoumbi.telephone == "24174436161"
    assert manfoumbi.email is None


def test_import_enseignants_est_idempotent(tmp_path):
    chemin = _creer_classeur(
        tmp_path, [("ABAKER", "Madi Guirema", "062-12-77-12", "abaker@gmail.com")]
    )

    call_command("import_enseignants", str(chemin))
    call_command("import_enseignants", str(chemin))

    assert Enseignant.objects.count() == 1
    assert Enseignant.objects.get().telephone == "062-12-77-12"


def test_import_enseignants_journalise_ligne_sans_nom(tmp_path):
    chemin = _creer_classeur(tmp_path, [(None, "Prenom", None, None)])
    rapport = tmp_path / "rapport.txt"

    call_command("import_enseignants", str(chemin), "--rapport-erreurs", str(rapport))

    assert Enseignant.objects.count() == 0
    assert rapport.exists()
    assert "NOM ou PRENOM vide" in rapport.read_text(encoding="utf-8")


def test_import_enseignants_email_deja_pris_importe_sans_email(tmp_path):
    chemin = _creer_classeur(
        tmp_path,
        [
            ("ABAKER", "Madi", None, "doublon@gmail.com"),
            ("BOUITY", "Franck", None, "doublon@gmail.com"),
        ],
    )

    call_command("import_enseignants", str(chemin))

    assert Enseignant.objects.get(nom="ABAKER").email == "doublon@gmail.com"
    assert Enseignant.objects.get(nom="BOUITY").email is None

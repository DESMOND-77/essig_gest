import pytest

from personnes import services
from personnes.models import CompteurMatricule

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    "nom,prenoms,attendu",
    [
        ("Gumapi clos", "desmond junior", "GUDE"),  # cas nominal
        ("Éric", "Kön", "ERKO"),                    # accents translittérés
        ("Jean-Pierre", "Éléonore", "JEEL"),        # trait d'union : "Jean-Pierre" -> "JE"
        ("O", "A", "OXAX"),                         # mot d'1 lettre -> complété par X
        ("  ", "123", "XXXX"),                      # aucun caractère alpha -> XX + XX
    ],
)
def test_initiales(nom, prenoms, attendu):
    assert services.initiales(nom, prenoms) == attendu


def test_generer_matricule_format_et_increment():
    m1 = services.generer_matricule("ESSIG", "Gumapi clos", "desmond junior")
    m2 = services.generer_matricule("ESSIG", "Autre", "Personne")
    assert m1 == "ESSIG-FCVGUDE1"
    assert m2 == "ESSIG-FCVAUPE2"
    assert CompteurMatricule.objects.get(pole="ESSIG").valeur == 2


def test_compteur_isole_par_pole():
    services.generer_matricule("ESSIG", "A", "B")
    services.generer_matricule("ESSIG", "C", "D")
    services.generer_matricule("UPSS", "E", "F")
    assert CompteurMatricule.objects.get(pole="ESSIG").valeur == 2
    assert CompteurMatricule.objects.get(pole="UPSS").valeur == 1


def test_compteur_jamais_reinitialise():
    for _ in range(3):
        services.generer_matricule("CFPA", "X", "Y")
    m = services.generer_matricule("CFPA", "Z", "W")
    assert m == "CFPA-FCVZXWX4"
    assert CompteurMatricule.objects.get(pole="CFPA").valeur == 4

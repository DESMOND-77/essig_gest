import re
import unicodedata

from django.db import transaction

from .models import CompteurInscription, CompteurMatricule


def _deux_lettres(mot: str) -> str:
    ascii_ = (
        unicodedata.normalize("NFKD", mot or "")
        .encode("ascii", "ignore")
        .decode("ascii")
    )
    lettres = re.sub(r"[^A-Za-z]", "", ascii_).upper()
    return (lettres[:2] + "XX")[:2]


def initiales(nom: str, prenoms: str) -> str:
    premier_nom = (nom or "").split()[:1]
    premier_prenom = (prenoms or "").split()[:1]
    a = _deux_lettres(premier_nom[0] if premier_nom else "")
    b = _deux_lettres(premier_prenom[0] if premier_prenom else "")
    return a + b


@transaction.atomic
def generer_matricule(ecole_sigle: str, nom: str, prenoms: str) -> str:
    compteur, _ = CompteurMatricule.objects.select_for_update().get_or_create(
        ecole_sigle=ecole_sigle
    )
    compteur.valeur += 1
    compteur.save(update_fields=["valeur"])
    return f"{ecole_sigle}-FCV{initiales(nom, prenoms)}{compteur.valeur}"


@transaction.atomic
def attribuer_numero_ordre(ecole, annee_scolaire) -> int:
    compteur, _ = CompteurInscription.objects.select_for_update().get_or_create(
        ecole=ecole, annee_scolaire=annee_scolaire
    )
    compteur.valeur += 1
    compteur.save(update_fields=["valeur"])
    return compteur.valeur

from django.db import transaction

from .models import AnneeScolaire


def libelle_classe(*, niveau, option_filiere, modalite_formation, annee_scolaire) -> str:
    filiere_sigle = option_filiere.filiere.sigle
    option_sigle = (option_filiere.sigle or "").strip()
    tete = f"{filiere_sigle}/{option_sigle}" if option_sigle else filiere_sigle
    return (
        f"{niveau.code} {tete} {modalite_formation.code} {annee_scolaire.libelle}"
    )


@transaction.atomic
def definir_annee_courante(annee: AnneeScolaire) -> None:
    AnneeScolaire.objects.filter(est_courante=True).exclude(pk=annee.pk).update(
        est_courante=False
    )
    if not annee.est_courante:
        annee.est_courante = True
        annee.save(update_fields=["est_courante"])

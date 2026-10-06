import calendar
import datetime as dt

from django.db.models import Q
from rest_framework import serializers

from .models import Echeance, FraisInscription, ModalitePaiement, TypeFrais


def _ajouter_mois(d: dt.date, k: int) -> dt.date:
    total = d.month - 1 + k
    annee = d.year + total // 12
    mois = total % 12 + 1
    dernier = calendar.monthrange(annee, mois)[1]
    return dt.date(annee, mois, min(d.day, dernier))


def generer_echeancier(inscription) -> list:
    try:
        grille = ModalitePaiement.objects.get(
            niveau=inscription.classe.niveau,
            annee_scolaire=inscription.annee_scolaire,
        )
    except ModalitePaiement.DoesNotExist as exc:
        raise serializers.ValidationError(
            {
                "detail": "Aucune grille tarifaire (modalité de paiement) pour ce "
                "niveau et cette année. Créez-la avant d'inscrire."
            }
        ) from exc

    i_montant = int(grille.montant_inscription_reinscription)
    n = int(grille.nombre_echeance)

    if inscription.cout_scolarite_negocie is not None:
        total = int(inscription.cout_scolarite_negocie)
        if total < i_montant:
            raise serializers.ValidationError(
                {
                    "cout_scolarite_negocie": "Le coût négocié ne peut être "
                    "inférieur au montant d'inscription de la grille "
                    f"({i_montant})."
                }
            )
        reste = total - i_montant
        base = reste // n
        montants = [base] * (n - 1) + [reste - base * (n - 1)]
    else:
        montants = [int(grille.montant_echeance)] * n

    d0 = inscription.date_inscription
    lignes = [
        Echeance(
            inscription=inscription,
            numero=0,
            montant_prevu=i_montant,
            date_prevue=d0,
            pris_en_charge_bourse=False,
            cree_par=inscription.cree_par,
        )
    ]
    for k, montant in enumerate(montants, start=1):
        lignes.append(
            Echeance(
                inscription=inscription,
                numero=k,
                montant_prevu=montant,
                date_prevue=_ajouter_mois(d0, k),
                pris_en_charge_bourse=inscription.est_boursier,
                cree_par=inscription.cree_par,
            )
        )
    Echeance.objects.bulk_create(lignes)
    return lignes


def materialiser_frais_obligatoires(inscription) -> list:
    """Matérialise les frais obligatoires actifs dont le périmètre correspond."""
    ecole = inscription.ecole
    niveau = inscription.classe.niveau
    annee = inscription.annee_scolaire
    types = (
        TypeFrais.objects.filter(obligatoire=True, actif=True)
        .filter(Q(ecole__isnull=True) | Q(ecole=ecole))
        .filter(Q(niveau__isnull=True) | Q(niveau=niveau))
        .filter(Q(annee_scolaire__isnull=True) | Q(annee_scolaire=annee))
    )
    lignes = []
    for type_frais in types:
        ligne, _ = FraisInscription.objects.get_or_create(
            inscription=inscription,
            type_frais=type_frais,
            defaults={
                "montant_du": type_frais.montant_defaut,
                "cree_par": inscription.cree_par,
            },
        )
        lignes.append(ligne)
    return lignes

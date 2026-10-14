# backend/tresorerie/services/dashboard.py
from django.db.models import Sum
from django.utils import timezone
from datetime import timedelta
from ..models import Compte, Mouvement, ArreteCaisse
import logging
import types

logger = logging.getLogger(__name__)


def get_solde_par_type_de_compte():
    """
    Récupère le solde global par type de compte.

    Returns:
        dict: Dictionnaire avec les soldes par type de compte
    """
    try:
        # Récupérer tous les comptes actifs avec leur solde
        comptes = Compte.objects.filter(actif=True)
        soldes_par_type = {}

        for compte_type in Compte.Type.choices:
            type_code = compte_type[0]
            type_libelle = compte_type[1]

            # Filtrer les comptes par type
            comptes_type = comptes.filter(type=type_code)

            # Calculer le solde total pour ce type
            solde_total = 0
            for compte in comptes_type:
                from .compte import calculer_solde_compte
                solde_compte = calculer_solde_compte(compte.id)
                solde_total += solde_compte

            soldes_par_type[type_libelle] = float(solde_total)

        return soldes_par_type

    except Exception as e:
        logger.error(f"Erreur lors du calcul des soldes par type de compte: {str(e)}")
        return {}


def get_flux_entrants_sortants(jours=30):
    """
    Récupère les flux entrants et sortants sur une période donnée.

    Args:
        jours (int): Nombre de jours en arrière à considérer (défaut: 30)

    Returns:
        dict: Dictionnaire avec les flux entrants, sortants et nets
    """
    try:
        date_debut = timezone.now().date() - timedelta(days=jours)
        date_fin = timezone.now().date()

        # Filtrer les mouvements sur la période
        mouvements = Mouvement.objects.filter(
            date_operation__gte=date_debut,
            date_operation__lte=date_fin,
            valide=True
        )

        # Calculer les totaux
        total_credits = mouvements.filter(sens=Mouvement.Sens.CREDIT).aggregate(
            total=Sum('montant')
        )['total'] or 0

        total_debits = mouvements.filter(sens=Mouvement.Sens.DEBIT).aggregate(
            total=Sum('montant')
        )['total'] or 0

        flux_net = total_credits - total_debits

        return {
            'entrants': float(total_credits),
            'sortants': float(total_debits),
            'net': float(flux_net),
            'periode_jours': jours,
            'date_debut': date_debut.isoformat(),
            'date_fin': date_fin.isoformat()
        }

    except Exception as e:
        logger.error(f"Erreur lors du calcul des flux entrants/sortants: {str(e)}")
        return {
            'entrants': 0.0,
            'sortants': 0.0,
            'net': 0.0,
            'periode_jours': jours
        }


def get_encaissements_recents(limit=10):
    """
    Récupère les encaissements récents.

    Args:
        limit (int): Nombre maximum d'encaissements à retourner (défaut: 10)

    Returns:
        list: Liste des encaissements récents avec leurs informations de base
    """
    try:
        encaissements = (
            Encaissement.objects.select_related('inscription__etudiant', 'compte')
            .order_by('-date', '-id')[:limit]
        )

        result = []
        for encaissement in encaissements:
            result.append({
                'id': encaissement.id,
                'recu_numero': encaissement.recu_numero,
                'date': encaissement.date.isoformat(),
                'montant_total': float(encaissement.montant_total),
                'mode': encaissement.get_mode_display(),
                'etudiant_nom': f"{encaissement.inscription.etudiant.nom} {encaissement.inscription.etudiant.prenoms}",
                'compte_libelle': encaissement.compte.libelle,
                'statut': encaissement.get_statut_display()
            })

        return result

    except Exception as e:
        logger.error(f"Erreur lors de la récupération des encaissements récents: {str(e)}")
        return []


def get_depenses_recentes(limit=10):
    """
    Récupère les dépenses récentes.

    Args:
        limit (int): Nombre maximum de dépenses à retourner (défaut: 10)

    Returns:
        list: Liste des dépenses récentes avec leurs informations de base
    """
    try:
        depenses = (
            Depense.objects.select_related('compte')
            .order_by('-date', '-id')[:limit]
        )

        result = []
        for depense in depenses:
            result.append({
                'id': depense.id,
                'date': depense.date.isoformat(),
                'montant': float(depense.montant),
                'beneficiaire': depense.beneficiaire,
                'designation': depense.designation,
                'compte_libelle': depense.compte.libelle,
                'statut': depense.get_statut_display()
            })

        return result

    except Exception as e:
        logger.error(f"Erreur lors de la récupération des dépenses récentes: {str(e)}")
        return []


def get_ecarts_caisse_importants(limite_montant=1000):
    """
    Récupère les écarts de caisse importants (en valeur absolue).

    Args:
        limite_montant (int): Seuil au-delà duquel un écart est considéré comme important (défaut: 1000 FCFA)

    Returns:
        list: Liste des arrêtés de caisse avec écarts importants
    """
    try:
        arretes = (
            ArreteCaisse.objects.select_related('compte')
            .filter(
                statut=ArreteCaisse.Statut.VALIDE
            )
            .extra(
                where=["ABS(ecart) >= %s"],
                params=[limite_montant]
            )
            .order_by('-date', '-id')
        )

        result = []
        for arrete in arretes:
            result.append({
                'id': arrete.id,
                'date': arrete.date.isoformat(),
                'compte_code': arrete.compte.code,
                'compte_libelle': arrete.compte.libelle,
                'solde_theorique': float(arrete.solde_theorique),
                'solde_physique': float(arrete.solde_physique),
                'ecart': float(arrete.ecart),
                'fait_par_nom': f"{arrete.fait_par.get_full_name() if arrete.fait_par else 'Inconnu'}",
                'valide_par_nom': f"{arrete.valide_par.get_full_name() if arrete.valide_par else 'Inconnu'}"
            })

        return result

    except Exception as e:
        logger.error(f"Erreur lors de la récupération des écarts de caisse importants: {str(e)}")
        return []


def get_previsionnel_tresorerie(jours=30):
    """
    Calcule un prévisionnel simple de trésorerie basé sur les tendances récentes.
    Ceci est une implémentation simplifiée - en production, ceci serait basé
    sur des entrées/sorties connues à venir (factures à payer, prélèvements programmés, etc.).

    Args:
        jours (int): Nombre de jours pour le prévisionnel (défaut: 30)

    Returns:
        dict: Prévisionnel de trésorerie
    """
    try:
        # Pour simplifier, on utilise la moyenne quotidienne des flux des 30 derniers jours
        # et on projette sur la période demandée
        flux_recents = get_flux_entrants_sortants(jours=30)

        if flux_recents['entrants'] == 0 and flux_recents['sortants'] == 0:
            # Pas de données historiques, on retourne zéro
            moyenne_quotidienne_entrants = 0
            moyenne_quotidienne_sortants = 0
        else:
            moyenne_quotidienne_entrants = flux_recents['entrants'] / 30
            moyenne_quotidienne_sortants = flux_recents['sortants'] / 30

        # Projection sur la période demandée
        entrees_prevues = moyenne_quotidienne_entrants * jours
        sorties_prevues = moyenne_quotidienne_sortants * jours
        flux_net_prevu = entrees_prevues - sorties_prevues

        # Solde actuel global
        soldes_par_type = get_solde_par_type_de_compte()
        solde_actuel_global = sum(soldes_par_type.values())

        # Solde prévu à la fin de la periode
        solde_prevue_fin = solde_actuel_global + flux_net_prevu

        return {
            'solde_actuel': solde_actuel_global,
            'prevision_entrees': entrees_prevues,
            'prevision_sorties': sorties_prevues,
            'prevision_flux_net': flux_net_prevu,
            'solde_prevue_fin': solde_prevue_fin,
            'periode_jours': jours,
            'date_base': timezone.now().date().isoformat(),
            'methode': 'moyenne_quotidienne_historique_30_jours'
        }

    except Exception as e:
        logger.error(f"Erreur lors du calcul du previsionnel de tresorerie: {str(e)}")
        return {
            'solde_actuel': 0.0,
            'prevision_entrees': 0.0,
            'prevision_sorties': 0.0,
            'prevision_flux_net': 0.0,
            'solde_prevue_fin': 0.0,
            'periode_jours': jours
        }


# Imports locaux pour eviter les references circulaires
from .encaissement import Encaissement
from .depense import Depense


dashboard_service = types.SimpleNamespace(
    get_solde_par_type_de_compte=get_solde_par_type_de_compte,
    get_flux_entrants_sortants=get_flux_entrants_sortants,
    get_encaissements_recents=get_encaissements_recents,
    get_depenses_recentes=get_depenses_recentes,
    get_ecarts_caisse_importants=get_ecarts_caisse_importants,
    get_previsionnel_tresorerie=get_previsionnel_tresorerie
)
# backend/tresorerie/services/imputation_encaissement.py
from django.core.exceptions import ValidationError
from ..models import ImputationEncaissement
import logging
import types

logger = logging.getLogger(__name__)


def get_imputations_par_encaissement(encaissement_id):
    """
    Récupère toutes les imputations associées à un encaissement.

    Args:
        encaissement_id (int): ID de l'encaissement

    Returns:
        QuerySet: Les imputations de l'encaissement

    Raises:
        ValidationError: Si l'encaissement n'existe pas
    """
    try:
        return ImputationEncaissement.objects.filter(encaissement_id=encaissement_id)
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des imputations: {str(e)}")
        raise


def get_total_imputations_par_encaissement(encaissement_id):
    """
    Calcule le total des imputations pour un encaissement.

    Args:
        encaissement_id (int): ID de l'encaissement

    Returns:
        Decimal: Total des imputations

    Raises:
        ValidationError: Si l'encaissement n'existe pas
    """
    from django.db.models import Sum
    try:
        result = ImputationEncaissement.objects.filter(
            encaissement_id=encaissement_id
        ).aggregate(total=Sum('montant'))
        return result['total'] or 0
    except Exception as e:
        logger.error(f"Erreur lors du calcul du total des imputations: {str(e)}")
        raise


imputation_encaissement_service = types.SimpleNamespace(
    get_imputations_par_encaissement=get_imputations_par_encaissement,
    get_total_imputations_par_encaissement=get_total_imputations_par_encaissement
)
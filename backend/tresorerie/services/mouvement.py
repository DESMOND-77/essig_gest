# backend/tresorerie/services/mouvement.py
from django.db import transaction
from django.core.exceptions import ValidationError
from ..models import Mouvement
import logging
import types

logger = logging.getLogger(__name__)


def valider_mouvement(mouvement_id):
    """
    Valide un mouvement.

    Args:
        mouvement_id (int): ID du mouvement à valider

    Returns:
        Mouvement: Le mouvement validé

    Raises:
        ValidationError: Si le mouvement n'existe pas
    """
    try:
        mouvement = Mouvement.objects.get(id=mouvement_id)
        mouvement.valide = True
        mouvement.save(update_fields=['valide'])

        logger.info(f"Mouvement {mouvement_id} validé")
        return mouvement

    except Mouvement.DoesNotExist:
        raise ValidationError(f"Mouvement avec l'ID {mouvement_id} introuvable")


def invalider_mouvement(mouvement_id):
    """
    Invalide un mouvement (sans le supprimer pour préserver l'audit).

    Args:
        mouvement_id (int): ID du mouvement à invalider

    Returns:
        Mouvement: Le mouvement invalidé

    Raises:
        ValidationError: Si le mouvement n'existe pas
    """
    try:
        mouvement = Mouvement.objects.get(id=mouvement_id)
        mouvement.valide = False
        mouvement.save(update_fields=['valide'])

        logger.info(f"Mouvement {mouvement_id} invalidé")
        return mouvement

    except Mouvement.DoesNotExist:
        raise ValidationError(f"Mouvement avec l'ID {mouvement_id} introuvable")


mouvement_service = types.SimpleNamespace(
    valider_mouvement=valider_mouvement,
    invalider_mouvement=invalider_mouvement
)
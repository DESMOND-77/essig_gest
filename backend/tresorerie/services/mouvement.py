# backend/tresorerie/services/mouvement.py
from django.db import transaction
from django.core.exceptions import ValidationError
from ..models import Mouvement
import logging
import types

logger = logging.getLogger(__name__)


def creer_mouvement(compte, categorie_mouvement, sens, montant, libelle,
                   piece_reference=None, ecole_id=None, annee_scolaire_id=None,
                   virement_id=None, cree_par_id=None):
    """
    Crée un nouveau mouvement.

    Args:
        compte: Le compte associé au mouvement
        categorie_mouvement: La catégorie de mouvement associée
        sens: Le sens du mouvement (DEBIT ou CREDIT)
        montant (Decimal): Le montant du mouvement
        libelle (str): Le libellé du mouvement
        piece_reference (str, optionnel): Référence de pièce
        ecole_id (int, optionnel): ID de l'école
        annee_scolaire_id (int, optionnel): ID de l'année scolaire
        virement_id (int, optionnel): ID du virement associé
        cree_par_id (int, optionnel): ID de l'utilisateur créateur

    Returns:
        Mouvement: Le mouvement créé
    """
    try:
        with transaction.atomic():
            mouvement = Mouvement.objects.create(
                compte=compte,
                categorie_mouvement=categorie_mouvement,
                sens=sens,
                montant=montant,
                libelle=libelle,
                piece_reference=piece_reference,
                ecole_id=ecole_id,
                annee_scolaire_id=annee_scolaire_id,
                virement_id=virement_id,
                cree_par_id=cree_par_id
            )

            logger.info(f"Mouvement créé: {mouvement.id} - {mouvement.montant} FCFA "
                       f"en {mouvement.get_sens_display()} sur compte {mouvement.compte.code}")

            return mouvement

    except Exception as e:
        logger.error(f"Erreur lors de la création du mouvement: {str(e)}")
        raise


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
    invalider_mouvement=invalider_mouvement,
    creer_mouvement=creer_mouvement
)
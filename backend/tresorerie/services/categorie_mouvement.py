# backend/tresorerie/services/categorie_mouvement.py
from django.core.exceptions import ValidationError
from ..models import CategorieMouvement
import logging
import types

logger = logging.getLogger(__name__)


def créer_categorie_mouvement(code, libelle, sens, cree_par_id=None):
    """
    Crée une nouvelle catégorie de mouvement.

    Args:
        code (str): Code unique de la catégorie
        libelle (str): Libellé de la catégorie
        sens (str): Sens de la catégorie (ENTREE, SORTIE, NEUTRE)
        cree_par_id (int, optionnel): ID de l'utilisateur créateur

    Returns:
        CategorieMouvement: La catégorie créée

    Raises:
        ValidationError: Si les données sont invalides
    """
    try:
        categorie = CategorieMouvement.objects.create(
            code=code,
            libelle=libelle,
            sens=sens,
            cree_par_id=cree_par_id
        )

        logger.info(f"Catégorie de mouvement créée: {categorie.code} - {categorie.libelle}")
        return categorie

    except Exception as e:
        logger.error(f"Erreur lors de la création de la catégorie de mouvement: {str(e)}")
        raise


def mettre_a_jour_categorie_mouvement(categorie_id, code=None, libelle=None, sens=None):
    """
    Met à jour une catégorie de mouvement existante.

    Args:
        categorie_id (int): ID de la catégorie à mettre à jour
        code (str, optionnel): Nouveau code
        libelle (str, optionnel): Nouveau libellé
        sens (str, optionnel): Nouveau sens

    Returns:
        CategorieMouvement: La catégorie mise à jour

    Raises:
        ValidationError: Si la catégorie n'existe pas ou si les données sont invalides
    """
    try:
        categorie = CategorieMouvement.objects.get(id=categorie_id)

        if code is not None:
            categorie.code = code
        if libelle is not None:
            categorie.libelle = libelle
        if sens is not None:
            categorie.sens = sens

        categorie.save()

        logger.info(f"Catégorie de mouvement {categorie_id} mise à jour")
        return categorie

    except CategorieMouvement.DoesNotExist:
        raise ValidationError(f"Catégorie de mouvement avec l'ID {categorie_id} introuvable")
    except Exception as e:
        logger.error(f"Erreur lors de la mise à jour de la catégorie de mouvement: {str(e)}")
        raise


categorie_mouvement_service = types.SimpleNamespace(
    créer_categorie_mouvement=créer_categorie_mouvement,
    mettre_a_jour_categorie_mouvement=mettre_a_jour_categorie_mouvement
)
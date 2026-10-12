# backend/tresorerie/services/compte.py
from django.db import transaction
from django.db.models import Sum, F
from django.core.exceptions import ValidationError
from ..models import Compte, Mouvement
import logging
import types

logger = logging.getLogger(__name__)


def calculer_solde_compte(compte_id):
    """
    Calcule le solde actuel d'un compte basé sur ses mouvements.

    Args:
        compte_id (int): ID du compte

    Returns:
        Decimal: Solde du compte (solde_initial + crédits - débits)
    """
    try:
        compte = Compte.objects.get(id=compte_id)

        # Calculer la somme des crédits et débits
        mouvements = Mouvement.objects.filter(
            compte_id=compte_id,
            valide=True
        ).aggregate(
            total_credits=Sum('montant', filter=models.Q(sens=Mouvement.Sens.CREDIT)),
            total_debits=Sum('montant', filter=models.Q(sens=Mouvement.Sens.DEBIT))
        )

        total_credits = movements['total_credits'] or 0
        total_debits = movements['total_debits'] or 0

        solde = compte.solde_initial + total_credits - total_debits
        return solde

    except Compte.DoesNotExist:
        raise ValidationError(f"Compte avec l'ID {compte_id} introuvable")


def generer_mouvement_credit(compte_id, montant, categorie_mouvement_id, libelle,
                           piece_reference=None, ecole_id=None, annee_scolaire_id=None,
                           virement_id=None, cree_par_id=None):
    """
    Génère un mouvement de crédit sur un compte.

    Args:
        compte_id (int): ID du compte à créditer
        montant (Decimal): Montant du mouvement (> 0)
        categorie_mouvement_id (int): ID de la catégorie de mouvement
        libelle (str): Libellé du mouvement
        piece_reference (str, optionnel): Référence de pièce
        ecole_id (int, optionnel): ID de l'école
        annee_scolaire_id (int): ID de l'année scolaire
        virement_id (int, optionnel): ID du virement associé
        cree_par_id (int, optionnel): ID de l'utilisateur créateur

    Returns:
        Mouvement: Le mouvement créé

    Raises:
        ValidationError: Si les données sont invalides
    """
    if montant <= 0:
        raise ValidationError("Le montant doit être strictement positif")

    try:
        with transaction.atomic():
            mouvement = Mouvement.objects.create(
                compte_id=compte_id,
                sens=Mouvement.Sens.CREDIT,
                montant=montant,
                categorie_mouvement_id=categorie_mouvement_id,
                libelle=libelle,
                piece_reference=piece_reference,
                ecole_id=ecole_id,
                annee_scolaire_id=annee_scolaire_id,
                virement_id=virement_id,
                cree_par_id=cree_par_id
            )

            logger.info(
                f"Mouvement de crédit créé: {mouvement.id} - {mouvement.montant} FCFA "
                f"sur compte {mouvement.compte.code}"
            )

            return mouvement

    except Exception as e:
        logger.error(f"Erreur lors de la création du mouvement de crédit: {str(e)}")
        raise


def generer_mouvement_debit(compte_id, montant, categorie_mouvement_id, libelle,
                          piece_reference=None, ecole_id=None, annee_scolaire_id=None,
                          virement_id=None, cree_par_id=None):
    """
    Génère un mouvement de débit sur un compte.

    Args:
        compte_id (int): ID du compte à débiter
        montant (Decimal): Montant du mouvement (> 0)
        categorie_mouvement_id (int): ID de la catégorie de mouvement
        libelle (str): Libellé du mouvement
        piece_reference (str, optionnel): Référence de pièce
        ecole_id (int, optionnel): ID de l'école
        annee_scolaire_id (int): ID de l'année scolaire
        virement_id (int, optionnel): ID du virement associé
        cree_par_id (int, optionnel): ID de l'utilisateur créateur

    Returns:
        Mouvement: Le mouvement créé

    Raises:
        ValidationError: Si les données sont invalides ou si solde insuffisant
    """
    if montant <= 0:
        raise ValidationError("Le montant doit être strictement positif")

    try:
        with transaction.atomic():
            # Vérifier la disponibilité des fonds (solde théorique)
            solde_actuel = calculer_solde_compte(compte_id)
            if solde_actuel < montant:
                raise ValidationError(
                    f"Solde insuffisant. Solde disponible: {solde_actuel} FCFA, "
                    f"montant demandé: {montant} FCFA"
                )

            mouvement = Mouvement.objects.create(
                compte_id=compte_id,
                sens=Mouvement.Sens.DEBIT,
                montant=montant,
                categorie_mouvement_id=categorie_mouvement_id,
                libelle=libelle,
                piece_reference=piece_reference,
                ecole_id=ecole_id,
                annee_scolaire_id=annee_scolaire_id,
                virement_id=virement_id,
                cree_par_id=cree_par_id
            )

            logger.info(
                f"Mouvement de débit créé: {mouvement.id} - {mouvement.montant} FCFA "
                f"sur compte {mouvement.compte.code}"
            )

            return mouvement

    except Compte.DoesNotExist:
        raise ValidationError(f"Compte avec l'ID {compte_id} introuvable")
    except Exception as e:
        logger.error(f"Erreur lors de la création du mouvement de débit: {str(e)}")
        raise


def activer_compte(compte_id):
    """Active un compte."""
    try:
        compte = Compte.objects.get(id=compte_id)
        compte.actif = True
        compte.save(update_fields=['actif'])
        logger.info(f"Compte {compte.code} activé")
        return compte
    except Compte.DoesNotExist:
        raise ValidationError(f"Compte avec l'ID {compte_id} introuvable")


def desactiver_compte(compte_id):
    """Désactive un compte."""
    try:
        compte = Compte.objects.get(id=compte_id)
        compte.actif = False
        compte.save(update_fields=['actif'])
        logger.info(f"Compte {compte.code} désactivé")
        return compte
    except Compte.DoesNotExist:
        raise ValidationError(f"Compte avec l'ID {compte_id} introuvable")


compte_service = types.SimpleNamespace(
    calculer_solde_compte=calculer_solde_compte,
    generer_mouvement_credit=generer_mouvement_credit,
    generer_mouvement_debit=generer_mouvement_debit,
    activer_compte=activer_compte,
    desactiver_compte=desactiver_compte
)
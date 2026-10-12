# backend/tresorerie/services/depense.py
from django.db import transaction
from django.core.exceptions import ValidationError
from ..models import Depense, Mouvement, Compte
import logging
import types

logger = logging.getLogger(__name__)


def creer_depense(date, categorie_mouvement_id, beneficiaire, designation, montant,
                 compte_id, ecole_id=None, annee_scolaire_id=None,
                 piece_justificative=None, engage_par_id=None, cree_par_id=None):
    """
    Crée une dépense avec génération automatique du mouvement DEBIT associé.

    Args:
        date (date): Date de la dépense
        categorie_mouvement_id (int): ID de la catégorie de mouvement (doit être SORTIE)
        beneficiaire (str): Bénéficiaire de la dépense
        designation (str): Désignation détaillée de la dépense
        montant (Decimal): Montant de la dépense (> 0)
        compte_id (int): ID du compte de débit
        ecole_id (int, optionnel): ID de l'école
        annee_scolaire_id (int): ID de l'année scolaire
        piece_justificative (str, optionnel): Référence de la pièce justificative
        engage_par_id (int, optionnel): ID de l'utilisateur qui a engagé la dépense
        cree_par_id (int, optionnel): ID de l'utilisateur créateur

    Returns:
        Depense: La dépense créée

    Raises:
        ValidationError: Si les données sont invalides ou si solde insuffisant
    """
    if montant <= 0:
        raise ValidationError("Le montant doit être strictement positif")

    try:
        with transaction.atomic():
            # Vérifier que la catégorie de mouvement est bien de type SORTIE
            from ..models import CategorieMouvement
            categorie_mouvement = CategorieMouvement.objects.get(id=categorie_mouvement_id)
            if categorie_mouvement.sens != CategorieMouvement.Sens.SORTIE:
                raise ValidationError(
                    f"La catégorie de mouvement doit être de type SORTIE. "
                    f"Catégorie reçue: {categorie_mouvement.sens}"
                )

            # Vérifier que le compte existe et est actif
            compte = Compte.objects.select_for_update().get(id=compte_id)
            if not compte.actif:
                raise ValidationError(f"Le compte {compte.code} est inactif")

            # Vérifier la disponibilité des fonds
            solde_actuel = calculer_solde_compte(compte_id)
            if solde_actuel < montant:
                raise ValidationError(
                    f"Solde insuffisant. Solde disponible: {solde_actuel} FCFA, "
                    f"montant demandé: {montant} FCFA"
                )

            # Créer le mouvement DEBIT associé
            mouvement = generer_mouvement_debit(
                compte_id=compte_id,
                montant=montant,
                categorie_mouvement_id=categorie_mouvement_id,
                libelle=f"Dépense: {designation} - {beneficiaire}",
                piece_reference=piece_justificative,
                ecole_id=ecole_id,
                annee_scolaire_id=annee_scolaire_id,
                cree_par_id=cree_par_id
            )

            # Créer la dépense
            depense = Depense.objects.create(
                date=date,
                categorie_mouvement_id=categorie_mouvement_id,
                beneficiaire=beneficiaire,
                designation=designation,
                montant=montant,
                compte_id=compte_id,
                mouvement_id=mouvement.id,
                ecole_id=ecole_id,
                annee_scolaire_id=annee_scolaire_id,
                piece_justificative=piece_justificative,
                engage_par_id=engage_par_id,
                cree_par_id=cree_par_id
            )

            logger.info(
                f"Dépense créée: {depense.id} - {depense.montant} FCFA "
                f"pour {depense.beneficiaire}: {depense.designation}"
            )

            return depense

    except Compte.DoesNotExist:
        raise ValidationError(f"Compte avec l'ID {compte_id} introuvable")
    except Exception as e:
        logger.error(f"Erreur lors de la création de la dépense: {str(e)}")
        raise


def valider_depense(depense_id, valide_par_id=None):
    """
    Valide une dépense engagée.

    Args:
        depense_id (int): ID de la dépense à valider
        valide_par_id (int, optionnel): ID de l'utilisateur validateur

    Returns:
        Depense: La dépense validée

    Raises:
        ValidationError: Si la dépense n'existe pas ou ne peut pas être validée
    """
    try:
        depense = Depense.objects.get(id=depense_id)
        if depense.statut != Depense.Statut.ENGAGEE:
            raise ValidationError(
                f"Seule une dépense engagée peut être validée. "
                f"Statut actuel: {depense.statut}"
            )

        depense.statut = Depense.Statut.VALIDEE
        if valide_par_id:
            depense.valide_par_id = valide_par_id
        depense.save(update_fields=['statut', 'valide_par'])

        logger.info(f"Dépense {depense_id} validée")
        return depense

    except Depense.DoesNotExist:
        raise ValidationError(f"Dépense avec l'ID {depense_id} introuvable")


def payer_depense(depense_id):
    """
    Marque une dépense comme payée (généralement après validation et paiement effectif).

    Args:
        depense_id (int): ID de la dépense à marquer comme payée

    Returns:
        Depense: La dépense marquée comme payée

    Raises:
        ValidationError: Si la dépense n'existe pas ou ne peut pas être marquée comme payée
    """
    try:
        depense = Depense.objects.get(id=depense_id)
        if depense.statut not in [Depense.Statut.ENGAGEE, Depense.Statut.VALIDEE]:
            raise ValidationError(
                f"Seule une dépense engagée ou validée peut être marquée comme payée. "
                f"Statut actuel: {depense.statut}"
            )

        depense.statut = Depense.Statut.PAYEE
        depense.save(update_fields=['statut'])

        logger.info(f"Dépense {depense_id} marquée comme payée")
        return depense

    except Depense.DoesNotExist:
        raise ValidationError(f"Dépense avec l'ID {depense_id} introuvable")


def annuler_depense(depense_id):
    """
    Annule une dépense en créant un mouvement inverse.

    Args:
        depense_id (int): ID de la dépense à annuler

    Returns:
        Depense: La dépense annulée

    Raises:
        ValidationError: Si la dépense n'existe pas ou ne peut pas être annulée
    """
    try:
        with transaction.atomic():
            depense = Depense.objects.select_for_update().get(id=depense_id)

            if depense.statut == Depense.Statut.ANNULEE:
                raise ValidationError(f"La dépense {depense.id} est déjà annulée")

            # Créer un mouvement inverse (crédit si c'était un débit)
            if depense.mouvement:
                sens_inverse = (
                    Mouvement.Sens.CREDIT
                    if depense.mouvement.sens == Mouvement.Sens.DEBIT
                    else Mouvement.Sens.DEBIT
                )

                from ..services.mouvement import generer_mouvement_credit
                generer_mouvement_credit(
                    compte_id=depense.mouvement.compte_id,
                    montant=depense.mouvement.montant,
                    categorie_mouvement_id=depense.mouvement.categorie_mouvement_id,
                    libelle=f"Annulation dépense {depense.id}",
                    piece_reference=f"ANN-{depense.id}",
                    ecole_id=depense.mouvement.ecole_id,
                    annee_scolaire_id=depense.mouvement.annee_scolaire_id,
                    cree_par_id=None  # À remplir par l'appelant
                )

            # Marquer la dépense comme annulée
            depense.statut = Depense.Statut.ANNULEE
            depense.save(update_fields=['statut'])

            logger.info(f"Dépense {depense_id} annulée")
            return depense

    except Depense.DoesNotExist:
        raise ValidationError(f"Dépense avec l'ID {depense_id} introuvable")
    except Exception as e:
        logger.error(f"Erreur lors de l'annulation de la dépense: {str(e)}")
        raise


def calculer_solde_compte(compte_id):
    """Calcule le solde actuel d'un compte (fonction interne réutilisée)."""
    from .compte import calculer_solde_compte as compte_service_calculer_solde
    return compte_service_calculer_solde(compte_id)


depense_service = types.SimpleNamespace(
    creer_depense=creer_depense,
    valider_depense=valider_depense,
    payer_depense=payer_depense,
    annuler_depense=annuler_depense,
    calculer_solde_compte=calculer_solde_compte
)
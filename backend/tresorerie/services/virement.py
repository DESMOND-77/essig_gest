# backend/tresorerie/services/virement.py
from django.db import transaction
from django.core.exceptions import ValidationError
from ..models import Virement, Mouvement, Compte
import logging
import types

logger = logging.getLogger(__name__)


def executer_virement(compte_source_id, compte_destination_id, montant, motif,
                     cree_par_id=None, valide_par_id=None):
    """
    Exécute un virement entre deux comptes en créant deux mouvements opposés
    dans une seule transaction.

    Args:
        compte_source_id (int): ID du compte source
        compte_destination_id (int): ID du compte destination
        montant (Decimal): Montant du virement (> 0)
        motif (str): Motif du virement
        cree_par_id (int, optionnel): ID de l'utilisateur créateur
        valide_par_id (int, optionnel): ID de l'utilisateur validateur

    Returns:
        Virement: Le virement exécuté

    Raises:
        ValidationError: Si les données sont invalides ou si solde insuffisant
    """
    if montant <= 0:
        raise ValidationError("Le montant doit être strictement positif")

    if compte_source_id == compte_destination_id:
        raise ValidationError("Le compte source et le compte destination doivent être différents")

    try:
        with transaction.atomic():
            # Vérifier que les comptes existent et sont actifs
            compte_source = Compte.objects.select_for_update().get(id=compte_source_id)
            compte_destination = Compte.objects.select_for_update().get(id=compte_destination_id)

            if not compte_source.actif:
                raise ValidationError(f"Le compte source {compte_source.code} est inactif")

            if not compte_destination.actif:
                raise ValidationError(f"Le compte destination {compte_destination.code} est inactif")

            # Vérifier la disponibilité des fonds sur le compte source
            solde_source = calculer_solde_compte(compte_source_id)
            if solde_source < montant:
                raise ValidationError(
                    f"Solde insuffisant sur le compte source {compte_source.code}. "
                    f"Solde disponible: {solde_source} FCFA, montant demandé: {montant} FCFA"
                )

            # Créer le virement
            virement = Virement.objects.create(
                compte_source_id=compte_source_id,
                compte_destination_id=compte_destination_id,
                montant=montant,
                motif=motif,
                cree_par_id=cree_par_id,
                valide_par_id=valide_par_id,
                statut=Virement.Statut.VALIDE
            )

            # Créer le mouvement de débit sur le compte source
            categorie_sortie = get_categorie_sortie_par_defaut()
            generer_mouvement_debit(
                compte_id=compte_source_id,
                montant=montant,
                categorie_mouvement_id=categorie_sortie.id,
                libelle=f"Virement vers {compte_destination.code}: {motif}",
                virement_id=virement.id,
                cree_par_id=cree_par_id
            )

            # Créer le mouvement de crédit sur le compte destination
            categorie_entree = get_categorie_entree_par_defaut()
            generer_mouvement_credit(
                compte_id=compte_destination_id,
                montant=montant,
                categorie_mouvement_id=categorie_entree.id,
                libelle=f"Virement depuis {compte_source.code}: {motif}",
                virement_id=virement.id,
                cree_par_id=cree_par_id
            )

            logger.info(
                f"Virement exécuté: {virement.id} - {montant} FCFA "
                f"de {compte_source.code} vers {compte_destination.code}"
            )

            return virement

    except Compte.DoesNotExist as e:
        raise ValidationError(f"Compte introuvable: {str(e)}")
    except Exception as e:
        logger.error(f"Erreur lors de l'exécution du virement: {str(e)}")
        raise


def get_categorie_sortie_par_defaut():
    """Récupère ou crée une catégorie de sortie par défaut pour les virements."""
    from ..models import CategorieMouvement
    categorie, created = CategorieMouvement.objects.get_or_create(
        code='VIREMENT_SORTIE',
        defaults={
            'libelle': 'Virement sortant',
            'sens': CategorieMouvement.Sens.SORTIE
        }
    )
    return categorie


def get_categorie_entree_par_defaut():
    """Récupère ou crée une catégorie d'entrée par défaut pour les virements."""
    from ..models import CategorieMouvement
    categorie, created = CategorieMouvement.objects.get_or_create(
        code='VIREMENT_ENTREE',
        defaults={
            'libelle': 'Virement entrant',
            'sens': CategorieMouvement.Sens.ENTREE
        }
    )
    return categorie


def calculer_solde_compte(compte_id):
    """Calcule le solde actuel d'un compte (fonction interne réutilisée)."""
    from .compte import calculer_solde_compte as compte_service_calculer_solde
    return compte_service_calculer_solde(compte_id)


virement_service = types.SimpleNamespace(
    executer_virement=executer_virement,
    get_categorie_sortie_par_defaut=get_categorie_sortie_par_defaut,
    get_categorie_entree_par_defaut=get_categorie_entree_par_defaut,
    calculer_solde_compte=calculer_solde_compte
)
# backend/tresorerie/services/services.py
from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal
import logging
import types
from ..models import Compte, Mouvement, CategorieMouvement

logger = logging.getLogger(__name__)

# Import the service objects from submodules
from .compte import compte_service
from .categorie_mouvement import categorie_mouvement_service
from .mouvement import mouvement_service
from .virement import virement_service
from .encaissement import encaissement_service
from .imputation_encaissement import imputation_encaissement_service
from .depense import depense_service
from .arrete_caisse import arrete_caisse_service
from .billetage import billetage_service
from .dashboard import dashboard_service

# Import models directly
from tresorerie.models import Compte, CategorieMouvement

def effectuer_paiement_salaire(compte_debiteur_id, salaire_id, type_salaire, montant, categorie_mouvement_id, libelle,
                               piece_reference=None, ecole_id=None, annee_scolaire_id=None, cree_par_id=None):
    """
    Effectue le paiement d'un salaire (administratif ou enseignant) avec création du mouvement de trésorerie.

    Args:
        compte_debiteur_id (int): ID du compte à débiter
        salaire_id (int): ID du salaire à payer
        type_salaire (str): Type de salaire ('administration' ou 'enseignant')
        montant (Decimal): Montant à payer
        categorie_mouvement_id (int): ID de la catégorie de mouvement
        libelle (str): Libellé du mouvement
        piece_reference (str, optionnel): Référence de pièce
        ecole_id (int, optionnel): ID de l'école
        annee_scolaire_id (int): ID de l'année scolaire
        cree_par_id (int, optionnel): ID de l'utilisateur créateur

    Returns:
        dict: {
            'mouvement': Mouvement créé,
            'salaire': Salaire mis à jour,
            'message': str
        }

    Raises:
        ValidationError: Si les données sont invalides ou si le salaire est déjà payé
    """
    try:
        with transaction.atomic():
            # Récupérer le salaire selon son type
            if type_salaire == 'administration':
                from rh_paie.models import SalaireAdministration
                salaire = SalaireAdministration.objects.select_for_update().get(id=salaire_id)
                # Idempotence: si déjà payé, retourner le mouvement existant
                if salaire.statut == 'PAYÉ' and salaire.mouvement is not None:
                    mouvement_existant = Mouvement.objects.get(id=salaire.mouvement)
                    return {
                        'mouvement': mouvement_existant,
                        'salaire': salaire,
                        'message': f"Paiement de {type_salaire} déjà effectué (idempotence)."
                    }
                # Vérifier que le salaire est validé
                if salaire.statut != 'VALIDÉ':
                    raise ValidationError(f"Le salaire administratif doit être validé avant paiement. Statut actuel: {salaire.statut}")
                if montant <= 0:
                    raise ValidationError("Le montant du paiement doit être strictement positif.")
                # Paiements partiels/échelonnés supportés : `montant_paye` représente ce qui a
                # déjà été réellement versé avant cet appel (0 si aucun versement antérieur, pas
                # `montant_du` par défaut) ; chaque appel doit couvrir exactement le reste à payer
                # courant (ni moins, ni plus — pas de sur-paiement silencieux).
                restant_a_payer = salaire.montant_du - salaire.montant_paye
                if montant != restant_a_payer:
                    raise ValidationError(
                        f"Le montant du paiement ({montant}) doit correspondre au montant restant à payer ({restant_a_payer})."
                    )
                salaire.montant_paye += montant
                salaire_entierement_paye = salaire.montant_paye >= salaire.montant_du
            elif type_salaire == 'enseignant':
                from rh_paie.models import SalaireEnseignant
                salaire = SalaireEnseignant.objects.select_for_update().get(id=salaire_id)
                # Idempotence: si déjà payé, retourner le mouvement existant
                if salaire.statut == 'PAYÉ' and salaire.mouvement is not None:
                    mouvement_existant = Mouvement.objects.get(id=salaire.mouvement)
                    return {
                        'mouvement': mouvement_existant,
                        'salaire': salaire,
                        'message': f"Paiement de {type_salaire} déjà effectué (idempotence)."
                    }
                # Vérifier que le salaire est validé
                if salaire.statut != 'VALIDÉ':
                    raise ValidationError(f"Le salaire enseignant doit être validé avant paiement. Statut actuel: {salaire.statut}")
                if montant <= 0:
                    raise ValidationError("Le montant du paiement doit être strictement positif.")
                if montant != salaire.montant:
                    raise ValidationError(
                        f"Le montant du paiement ({montant}) doit correspondre au montant du salaire ({salaire.montant})."
                    )
                # Pas de paiement partiel pour les enseignants : un seul versement, intégral.
                salaire_entierement_paye = True
            else:
                raise ValidationError(f"Type de salaire invalide: {type_salaire}. Doit être 'administration' ou 'enseignant'.")

            # Récupérer le compte à débiter
            compte_debiteur = Compte.objects.get(id=compte_debiteur_id)

            # Récupérer la catégorie de mouvement
            categorie_mouvement = CategorieMouvement.objects.get(id=categorie_mouvement_id)

            # Vérifier la solvabilité du compte (fonds suffisants)
            solde_actuel = compte_service.calculer_solde_compte(compte_debiteur_id)
            if solde_actuel < montant:
                raise ValidationError(
                    f"Solde insuffisant. Solde disponible: {solde_actuel} FCFA, montant demandé: {montant} FCFA"
                )

            # Vérifier que la catégorie de mouvement est de sens SORTIE (appropriée pour un débit)
            if categorie_mouvement.sens != CategorieMouvement.Sens.SORTIE:
                raise ValidationError(f"La catégorie de mouvement doit avoir un sens SORTIE pour un paiement de salaire. Sens actuel: {categorie_mouvement.sens}")

            # Créer le mouvement de débit (paiement)
            mouvement = Mouvement.objects.create(
                compte=compte_debiteur,
                categorie_mouvement=categorie_mouvement,
                sens=Mouvement.Sens.DEBIT,
                montant=montant,
                libelle=libelle,
                piece_reference=piece_reference,
                ecole_id=ecole_id,
                annee_scolaire_id=annee_scolaire_id,
                date_operation=salaire.date_paiement,
                cree_par_id=cree_par_id
            )

            # Mettre à jour le salaire avec le mouvement ; le statut ne passe à PAYÉ que si le
            # versement couvre la totalité du montant dû (un versement partiel laisse le salaire
            # VALIDÉ, en attente des versements suivants).
            salaire.mouvement = mouvement.id
            if salaire_entierement_paye:
                salaire.statut = 'PAYÉ'
            salaire.save()

            logger.info(
                f"Paiement de {type_salaire} effectué: {mouvement.id} - {mouvement.montant} FCFA "
                f"déposé sur compte {compte_debiteur.code}"
            )

            return {
                'mouvement': mouvement,
                'salaire': salaire,
                'message': f"Paiement de {type_salaire} effectué avec succès."
            }

    except Compte.DoesNotExist:
        raise ValidationError(f"Compte avec l'ID {compte_debiteur_id} introuvable")
    except CategorieMouvement.DoesNotExist:
        raise ValidationError(f"Catégorie de mouvement avec l'ID {categorie_mouvement_id} introuvable")
    except Exception as e:
        logger.error(f"Erreur lors du paiement du salaire: {str(e)}")
        raise

# Create the main trésorerie service object
tresorerie_service = types.SimpleNamespace(
    compte=compte_service,
    categorie_mouvement=categorie_mouvement_service,
    mouvement=mouvement_service,
    virement=virement_service,
    encaissement=encaissement_service,
    imputation_encaissement=imputation_encaissement_service,
    depense=depense_service,
    arrete_caisse=arrete_caisse_service,
    billetage=billetage_service,
    dashboard=dashboard_service,
    effectuer_paiement_salaire=effectuer_paiement_salaire
)
# backend/rh_paie/services/salaire_administration_service.py
from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from ..models import SalaireAdministration
import logging

logger = logging.getLogger(__name__)


class SalaireAdministrationService:
    @staticmethod
    def create_salaire_administration(personnel_administratif, annee_scolaire, mois, date_paiement, montant_du, montant_paye, compte, **kwargs):
        """Create a salaire administration"""
        salaire = SalaireAdministration.objects.create(
            personnel_administratif=personnel_administratif,
            annee_scolaire=annee_scolaire,
            mois=mois,
            date_paiement=date_paiement,
            montant_du=montant_du,
            montant_paye=montant_paye,
            compte=compte,
            **kwargs
        )
        return salaire

    @staticmethod
    @transaction.atomic
    def update_salaire_administration(salaire_id, **kwargs):
        """Update a salaire administration"""
        salaire = SalaireAdministration.objects.get(id=salaire_id)
        for attr, value in kwargs.items():
            setattr(salaire, attr, value)
        salaire.full_clean()  # Validate model constraints
        salaire.save()
        return salaire

    @staticmethod
    def get_salaires_administration(personnel_administratif_id):
        """Get all salaries for a personnel administratif"""
        return SalaireAdministration.objects.filter(personnel_administratif_id=personnel_administratif_id)

    @staticmethod
    def get_salaires_par_mois_et_annee(mois, annee_scolaire_id):
        """Get all salaries for a specific month and school year"""
        return SalaireAdministration.objects.filter(mois=mois, annee_scolaire_id=annee_scolaire_id)

    @staticmethod
    @transaction.atomic
    def valider_salaire_administration(salaire_id, utilisateur_id):
        """
        Valide un salaire administratif (passe de BROUILLON à VALIDÉ)
        Includes checks for existence, status authorization, data consistency,
        year/period/beneficiary, absence of prior validation, and audit tracking.
        """
        try:
            salaire = SalaireAdministration.objects.select_for_update().get(id=salaire_id)
        except SalaireAdministration.DoesNotExist:
            raise ValidationError(f"Salaire administratif avec id {salaire_id} n'existe pas.")

        # Status authorization: only BROUILLON can be validated
        if salaire.statut != 'BROUILLON':
            raise ValidationError(
                f"Le salaire doit être en statut BROUILLON pour être validé. "
                f"Statut actuel: {salaire.statut}"
            )

        # Data consistency: montant_du positive, montant_paye between 0 and montant_du
        if salaire.montant_du <= 0:
            raise ValidationError("Le montant dû doit être positif.")
        if salaire.montant_paye < 0 or salaire.montant_paye > salaire.montant_du:
            raise ValidationError(
                f"Le montant payé doit être entre 0 et le montant dû ({salaire.montant_du})."
            )

        # Beneficiary exists and is active (via foreign key, but check actif flag)
        if not salaire.personnel_administratif.actif:
            raise ValidationError("Le personnel administratif associé n'est pas actif.")

        # Year/period/beneficiary: ensured by foreign keys and model fields
        # Additional check: annee_scolaire and mois are set (they are, but we can check not empty)
        if not salaire.annee_scolaire or not salaire.mois:
            raise ValidationError("L'année scolaire et le mois doivent être définis.")

        # Absence of prior validation: date_validation should be null and statut BROUILLON (already checked)
        if salaire.date_validation is not None:
            raise ValidationError("Ce salaire a déjà été validé.")

        # Update the salaire for validation
        salaire.statut = 'VALIDÉ'
        salaire.date_validation = timezone.now()
        salaire.valide_par_id = utilisateur_id
        # Audit tracking: set modifier fields
        salaire.modifie_par_id = utilisateur_id
        # modifie_le will be updated automatically by auto_now
        salaire.full_clean()
        salaire.save()

        logger.info(
            f"Salaire administratif {salaire_id} validé par l'utilisateur {utilisateur_id}. "
            f"Nouveau statut: {salaire.statut}"
        )
        return salaire

    @staticmethod
    @transaction.atomic
    def payer_salaire_administration(salaire_id, compte_debiteur_id, montant, categorie_mouvement_id, libelle,
                                    piece_reference=None, ecole_id=None, annee_scolaire_id=None, cree_par_id=None):
        """
        NON UTILISÉ EN PRODUCTION (audit du 2026-10-14) : `SalaireAdministrationViewSet.payer`
        (rh_paie/views.py) n'appelle pas cette méthode — le paiement réel est fait inline dans
        la vue, qui appelle directement `tresorerie.services.depense_service.creer_depense`.
        Cette méthode reste testée en isolation (délègue à
        `tresorerie.services.tresorerie_service.effectuer_paiement_salaire`, lui-même non
        branché à l'API) mais a une règle de validation différente du chemin réel
        (`montant == restant_a_payer` strict). Ne pas la caller depuis une vue sans d'abord
        unifier les deux chemins — décision explicite à prendre, pas un simple choix technique.

        Paiement d'un salaire administratif avec création du mouvement de trésorerie.

        Args:
            salaire_id (int): ID du salaire administratif à payer
            compte_debiteur_id (int): ID du compte à débiter
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
        """
        from tresorerie.services import tresorerie_service

        # Utiliser le service de trésorerie pour effectuer le paiement
        return tresorerie_service.effectuer_paiement_salaire(
            compte_debiteur_id=compte_debiteur_id,
            salaire_id=salaire_id,
            type_salaire='administration',
            montant=montant,
            categorie_mouvement_id=categorie_mouvement_id,
            libelle=libelle,
            piece_reference=piece_reference,
            ecole_id=ecole_id,
            annee_scolaire_id=annee_scolaire_id,
            cree_par_id=cree_par_id
        )
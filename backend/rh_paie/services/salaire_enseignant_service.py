# backend/rh_paie/services/salaire_enseignant_service.py
from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from ..models import SalaireEnseignant
import logging

logger = logging.getLogger(__name__)


class SalaireEnseignantService:
    @staticmethod
    def create_salaire_enseignant(enseignant, annee_scolaire, mois, date_paiement, montant, compte, **kwargs):
        """Create a salaire enseignant"""
        salaire = SalaireEnseignant.objects.create(
            enseignant=enseignant,
            annee_scolaire=annee_scolaire,
            mois=mois,
            date_paiement=date_paiement,
            montant=montant,
            compte=compte,
            **kwargs
        )
        return salaire

    @staticmethod
    @transaction.atomic
    def update_salaire_enseignant(salaire_id, **kwargs):
        """Update a salaire enseignant"""
        salaire = SalaireEnseignant.objects.get(id=salaire_id)
        for attr, value in kwargs.items():
            setattr(salaire, attr, value)
        salaire.full_clean()  # Validate model constraints
        salaire.save()
        return salaire

    @staticmethod
    def get_salaires_enseignant(enseignant_id):
        """Get all salaries for an enseignant"""
        return SalaireEnseignant.objects.filter(enseignant_id=enseignant_id)

    @staticmethod
    def get_salaires_par_mois_et_annee(mois, annee_scolaire_id):
        """Get all salaries for a specific month and school year"""
        return SalaireEnseignant.objects.filter(mois=mois, annee_scolaire_id=annee_scolaire_id)

    @staticmethod
    @transaction.atomic
    def valider_salaire_enseignant(salaire_id, utilisateur_id):
        """
        Valide un salaire enseignant (passe de BROUILLON à VALIDÉ)
        Includes checks for existence, status authorization, data consistency,
        year/period/beneficiary, absence of prior validation, and audit tracking.
        """
        try:
            salaire = SalaireEnseignant.objects.select_for_update().get(id=salaire_id)
        except SalaireEnseignant.DoesNotExist:
            raise ValidationError(f"Salaire enseignant avec id {salaire_id} n'existe pas.")

        # Status authorization: only BROUILLON can be validated
        if salaire.statut != 'BROUILLON':
            raise ValidationError(
                f"Le salaire doit être en statut BROUILLON pour être validé. "
                f"Statut actuel: {salaire.statut}"
            )

        # Data consistency: montant positive
        if salaire.montant <= 0:
            raise ValidationError("Le montant du salaire doit être positif.")

        # Beneficiary exists and is active (via foreign key, but check actif flag)
        if not salaire.enseignant.actif:
            raise ValidationError("L'enseignant associé n'est pas actif.")

        # Year/period/beneficiary: ensured by foreign keys and model fields
        # Additional check: annee_scolaire and mois are set (they are, but we can check not empty)
        if not salaire.annee_scolaire or not salaire.mois:
            raise ValidationError("L'année scolaire et le mois doivent être définis.")

        # Absence of prior validation: date_validation should be null and statut BROUILLON (already checked)
        if salaire.date_validation is not None:
            raise ValidationError("Ce salaire a déjà été validé.")

        # Optional: consistency with affectation_enseignement if set
        # We could verify that the montant aligns with the affectation's volume_horaire_prevu and taux_horaire,
        # but the affectation may span multiple months. For simplicity, we skip this check,
        # assuming the montant is set correctly during création.
        # If salaire.affectation_enseignement:
        #     expected_montant = salaire.affectation_enseignement.montant_prevu / 12  # example
        #     if abs(salaire.montant - expected_montant) > 0:
        #         raise ValidationError("Le montant ne correspond pas à l'affectation.")

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
            f"Salaire enseignant {salaire_id} validé par l'utilisateur {utilisateur_id}. "
            f"Nouveau statut: {salaire.statut}"
        )
        return salaire

    @staticmethod
    @transaction.atomic
    def payer_salaire_enseignant(salaire_id, compte_debiteur_id, montant, categorie_mouvement_id, libelle,
                                piece_reference=None, ecole_id=None, annee_scolaire_id=None, cree_par_id=None):
        """
        NON UTILISÉ EN PRODUCTION (audit du 2026-10-14) : `SalaireEnseignantViewSet.payer`
        (rh_paie/views.py) n'appelle pas cette méthode — le paiement réel est fait inline dans
        la vue, qui appelle directement `tresorerie.services.depense_service.creer_depense`.
        Cette méthode reste testée en isolation (délègue à
        `tresorerie.services.tresorerie_service.effectuer_paiement_salaire`, lui-même non
        branché à l'API) mais a une règle de validation différente du chemin réel
        (`montant == restant_a_payer` strict). Ne pas la caller depuis une vue sans d'abord
        unifier les deux chemins — décision explicite à prendre, pas un simple choix technique.

        Paiement d'un salaire enseignant avec création du mouvement de trésorerie.

        Args:
            salaire_id (int): ID du salaire enseignant à payer
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
            type_salaire='enseignant',
            montant=montant,
            categorie_mouvement_id=categorie_mouvement_id,
            libelle=libelle,
            piece_reference=piece_reference,
            ecole_id=ecole_id,
            annee_scolaire_id=annee_scolaire_id,
            cree_par_id=cree_par_id
        )
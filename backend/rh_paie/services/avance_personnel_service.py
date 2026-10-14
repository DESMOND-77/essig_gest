# backend/rh_paie/services/avance_personnel_service.py
from django.core.exceptions import ValidationError
from django.db import transaction
from ..models import AvancePersonnel
from tresorerie.services.compte import generer_mouvement_debit
from tresorerie.models import CategorieMouvement
from referentiel.models import AnneeScolaire
import logging

logger = logging.getLogger(__name__)


class AvancePersonnelService:
    @staticmethod
    def create_avance_personnel(beneficiaire, date, montant, motif, compte, **kwargs):
        """Create an avance personnel"""
        avance = AvancePersonnel.objects.create(
            beneficiaire=beneficiaire,
            date=date,
            montant=montant,
            motif=motif,
            compte=compte,
            **kwargs
        )
        return avance

    @staticmethod
    @transaction.atomic
    def update_avance_personnel(avance_id, **kwargs):
        """Update an avance personnel"""
        avance = AvancePersonnel.objects.get(id=avance_id)
        for attr, value in kwargs.items():
            setattr(avance, attr, value)
        avance.full_clean()  # Validate model constraints
        avance.save()
        return avance

    @staticmethod
    def get_avances_personnel(beneficiaire=None, beneficiaire_type=None):
        """Get all avances for a specific beneficiary"""
        queryset = AvancePersonnel.objects.all()
        if beneficiaire and beneficiaire_type:
            queryset = queryset.filter(beneficiaire=beneficiaire_type,
                                     **({} if beneficiaire_type == 'ENSEIGNANT' else {'personnel_administratif': beneficiaire} if beneficiaire_type == 'ADMIN' else {'enseignant': beneficiaire}))
        return queryset

    @staticmethod
    @transaction.atomic
    def regulariser_avance(avance_id, regularise_par_id):
        """Regulariser une avance en la liant à un salaire"""
        try:
            avance = AvancePersonnel.objects.select_for_update().get(id=avance_id)
            if avance.regularisee:
                raise ValidationError("L'avance est déjà régulée")

            # Vérifier la cohérence du bénéficiaire
            if avance.beneficiaire == 'ENSEIGNANT':
                if not avance.enseignant or avance.personnel_administratif is not None:
                    raise ValidationError("Incohérence du bénéficiaire : l'avance est marquée comme enseignant mais les liens ne sont pas cohérents.")
            elif avance.beneficiaire == 'ADMIN':
                if not avance.personnel_administratif or avance.enseignant is not None:
                    raise ValidationError("Incohérence du bénéficiaire : l'avance est marquée comme administratif mais les liens ne sont pas cohérents.")
            else:
                raise ValidationError("Type de bénéficiaire inconnu.")

            # Vérifier le montant et l'état actuel
            if avance.montant <= 0:
                raise ValidationError("Le montant de l'avance doit être positif.")

            # Enregistrer la date, l'auteur et la référence (via les champs modifie_par et modifie_le)
            avance.modifie_par_id = regularise_par_id
            # La date de modification sera mise à jour automatiquement par auto_now

            # Créer le mouvement de débit comptable pour la regularisation
            try:
                categorie = CategorieMouvement.objects.get(code='REGULARISATION_AVANCE')
            except CategorieMouvement.DoesNotExist:
                raise ValidationError("La catégorie de mouvement 'REGULARISATION_AVANCE' est introuvable. Veuillez la créer dans la trésorerie.")

            try:
                annee_scolaire = AnneeScolaire.objects.get(est_courante=True)
            except AnneeScolaire.DoesNotExist:
                raise ValidationError("Aucune année scolaire courante n'est définie dans le référentiel.")

            mouvement = generer_mouvement_debit(
                compte_id=avance.compte.id,
                montant=avance.montant,
                categorie_mouvement_id=categorie.id,
                libelle=f"Regularisation d'avance {avance.id} pour {avance.beneficiaire}",
                piece_reference=f"AV-{avance.id}",
                ecole_id=None,
                annee_scolaire_id=annee_scolaire.id,
                cree_par_id=regularise_par_id
            )

            # Marquer l'avance comme régulée et la lier au mouvement de décaissement
            avance.mouvement = mouvement.id
            avance.regularisee = True
            avance.save()

            return avance
        except AvancePersonnel.DoesNotExist:
            raise ValidationError("Avance introuvable")
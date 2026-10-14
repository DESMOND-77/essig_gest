# backend/rh_paie/services/affectation_enseignement_service.py
from django.core.exceptions import ValidationError
from ..models import AffectationEnseignement
import logging

logger = logging.getLogger(__name__)


class AffectationEnseignementService:
    @staticmethod
    def create_affectation(enseignant, matiere, classe, annee_scolaire, volume_horaire_prevu, taux_horaire):
        """Create an affectation with validation against duplication"""
        # Check for existing affectation with same matiere and classe (uniqueness constraint)
        if AffectationEnseignement.objects.filter(
            matiere=matiere,
            classe=classe
        ).exists():
            raise ValidationError("Une affectation pour cette matière et cette classe existe déjà.")

        # Calculate montant_prevu as volume_horaire_prevu * taux_horaire
        montant_prevu = volume_horaire_prevu * taux_horaire

        affectation = AffectationEnseignement.objects.create(
            enseignant=enseignant,
            matiere=matiere,
            classe=classe,
            annee_scolaire=annee_scolaire,
            volume_horaire_prevu=volume_horaire_prevu,
            taux_horaire=taux_horaire,
            montant_prevu=montant_prevu
        )
        return affectation

    @staticmethod
    def get_affectations_for_enseignant(enseignant, annee_scolaire=None):
        """Get all affectations for an enseignant"""
        queryset = AffectationEnseignement.objects.filter(enseignant=enseignant)
        if annee_scolaire:
            queryset = queryset.filter(annee_scolaire=annee_scolaire)
        return queryset

    @staticmethod
    def get_affectations_for_classe(classe, annee_scolaire=None):
        """Get all affectations for a classe"""
        queryset = AffectationEnseignement.objects.filter(classe=classe)
        if annee_scolaire:
            queryset = queryset.filter(annee_scolaire=annee_scolaire)
        return queryset
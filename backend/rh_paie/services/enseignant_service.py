# backend/rh_paie/services/enseignant_service.py
from django.core.exceptions import ValidationError
from django.db import transaction
from ..models import Enseignant
import logging

logger = logging.getLogger(__name__)


class EnseignantService:
    @staticmethod
    def create_enseignant(nom, prenom, email, **kwargs):
        """Create an enseignant with validation"""
        if Enseignant.objects.filter(email=email).exists():
            raise ValidationError("Un enseignant avec cet email existe déjà.")

        enseignant = Enseignant.objects.create(
            nom=nom,
            prenom=prenom,
            email=email,
            **kwargs
        )
        return enseignant

    @staticmethod
    @transaction.atomic
    def update_enseignant(enseignant_id, **kwargs):
        """Update an enseignant"""
        enseignant = Enseignant.objects.get(id=enseignant_id)
        for attr, value in kwargs.items():
            setattr(enseignant, attr, value)
        enseignant.full_clean()  # Validate model constraints
        enseignant.save()
        return enseignant

    @staticmethod
    def get_enseignant_by_email(email):
        """Retrieve enseignant by email"""
        return Enseignant.objects.filter(email=email).first()

    @staticmethod
    def list_enseignants(actif_only=True):
        """List all enseignants"""
        queryset = Enseignant.objects.all()
        if actif_only:
            queryset = queryset.filter(actif=True)
        return queryset
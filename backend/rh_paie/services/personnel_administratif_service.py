# backend/rh_paie/services/personnel_administratif_service.py
from django.core.exceptions import ValidationError
from django.db import transaction
from ..models import PersonnelAdministratif
import logging

logger = logging.getLogger(__name__)


class PersonnelAdministratifService:
    @staticmethod
    def create_personnel_administratif(nom, prenom, poste, email, salaire_base, **kwargs):
        """Create a personnel administratif with validation"""
        if PersonnelAdministratif.objects.filter(email=email).exists():
            raise ValidationError("Un personnel administratif avec cet email existe déjà.")

        personnel = PersonnelAdministratif.objects.create(
            nom=nom,
            prenom=prenom,
            poste=poste,
            email=email,
            salaire_base=salaire_base,
            **kwargs
        )
        return personnel

    @staticmethod
    @transaction.atomic
    def update_personnel_administratif(personnel_id, **kwargs):
        """Update a personnel administratif"""
        personnel = PersonnelAdministratif.objects.get(id=personnel_id)
        for attr, value in kwargs.items():
            setattr(personnel, attr, value)
        personnel.full_clean()
        personnel.save()
        return personnel

    @staticmethod
    def get_personnel_administratif_by_email(email):
        """Retrieve personnel administratif by email"""
        return PersonnelAdministratif.objects.filter(email=email).first()

    @staticmethod
    def list_personnels_administratifs(actif_only=True, ecole_id=None):
        """List all personnels administratifs"""
        queryset = PersonnelAdministratif.objects.all()
        if actif_only:
            queryset = queryset.filter(actif=True)
        if ecole_id:
            queryset = queryset.filter(ecole_id=ecole_id)
        return queryset
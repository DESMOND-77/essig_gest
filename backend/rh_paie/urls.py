# backend/rh_paie/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    EnseignantViewSet, PersonnelAdministratifViewSet,
    AffectationEnseignementViewSet, SalaireEnseignantViewSet,
    SalaireAdministrationViewSet, AvancePersonnelViewSet
)

# Créer le router et enregistrer les ViewSets
router = DefaultRouter()
router.register(r'enseignants', EnseignantViewSet, basename='enseignant')
router.register(r'personnel-administratif', PersonnelAdministratifViewSet, basename='personnel-administratif')
router.register(r'affectations-enseignement', AffectationEnseignementViewSet, basename='affectation-enseignement')
router.register(r'salaires-enseignant', SalaireEnseignantViewSet, basename='salaire-enseignant')
router.register(r'salaires-administration', SalaireAdministrationViewSet, basename='salaire-administration')
router.register(r'avances-personnel', AvancePersonnelViewSet, basename='avance-personnel')

# URL patterns
urlpatterns = [
    path('', include(router.urls)),
]
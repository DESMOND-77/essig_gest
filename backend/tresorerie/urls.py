# backend/tresorerie/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CompteViewSet, CategorieMouvementViewSet, VirementViewSet,
    MouvementViewSet, EncaissementViewSet, ImputationEncaissementViewSet,
    DepenseViewSet, ArreteCaisseViewSet, BilletageViewSet, TableauDeBordViewSet
)

# Créer le router et enregistrer les ViewSets
router = DefaultRouter()
router.register(r'comptes', CompteViewSet, basename='compte')
router.register(r'categories-mouvement', CategorieMouvementViewSet, basename='categorie-mouvement')
router.register(r'virements', VirementViewSet, basename='virement')
router.register(r'mouvements', MouvementViewSet, basename='mouvement')
router.register(r'encaissements', EncaissementViewSet, basename='encaissement')
router.register(r'imputations-encaissement', ImputationEncaissementViewSet, basename='imputation-encaissement')
router.register(r'depenses', DepenseViewSet, basename='depense')
router.register(r'arretes-caisse', ArreteCaisseViewSet, basename='arret-caisse')
router.register(r'billetage', BilletageViewSet, basename='billetage')

# URLs spécifiques pour le tableau de bord
tableau_de_bord_urls = [
    path('solde/', TableauDeBordViewSet.as_view({'get': 'solde'}), name='tableau-de-bord-solde'),
    path('solde-par-compte/', TableauDeBordViewSet.as_view({'get': 'solde_par_compte'}), name='tableau-de-bord-solde-par-compte'),
    path('flux/', TableauDeBordViewSet.as_view({'get': 'flux'}), name='tableau-de-bord-flux'),
    path('encaissements-recents/', TableauDeBordViewSet.as_view({'get': 'encaissements_recents'}), name='tableau-de-bord-encaissements-recents'),
    path('depenses-recentes/', TableauDeBordViewSet.as_view({'get': 'depenses_recentes'}), name='tableau-de-bord-depenses-recentes'),
    path('ecarts-caisse/', TableauDeBordViewSet.as_view({'get': 'ecarts_caisse'}), name='tableau-de-bord-ecarts-caisse'),
    path('previsionnel/', TableauDeBordViewSet.as_view({'get': 'previsionnel'}), name='tableau-de-bord-previsionnel'),
]

# URL patterns
urlpatterns = [
    path('', include(router.urls)),
    path('tableau-de-bord/', include(tableau_de_bord_urls)),
]
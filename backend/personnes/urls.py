from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("etudiants", views.EtudiantViewSet)
router.register("affiliations", views.AffiliationViewSet)
router.register("situation-bac", views.SituationBacViewSet)
router.register("types-piece", views.TypePieceViewSet)

urlpatterns = router.urls

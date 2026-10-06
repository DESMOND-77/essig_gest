from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("types-frais", views.TypeFraisViewSet)
router.register("frais-inscription", views.FraisInscriptionViewSet)
router.register("bourses", views.BourseViewSet)
router.register("modalites-paiement", views.ModalitePaiementViewSet)
router.register("echeances", views.EcheanceViewSet)

urlpatterns = router.urls

from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("modalites-paiement", views.ModalitePaiementViewSet)
router.register("echeances", views.EcheanceViewSet)

urlpatterns = router.urls

from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("deliberations", views.DeliberationViewSet)
router.register("dettes-credit", views.DetteCreditViewSet)
router.register("resultats-matiere", views.ResultatMatiereViewSet)
router.register("resultats-periode", views.ResultatPeriodeViewSet)
router.register("resultats-annuels", views.ResultatAnnuelViewSet)

urlpatterns = router.urls

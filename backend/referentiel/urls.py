from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("groupes-scolaires", views.GroupeScolaireViewSet)
router.register("ecoles", views.EcoleViewSet)
router.register("annees-scolaires", views.AnneeScolaireViewSet)
router.register("modalites-formation", views.ModaliteFormationViewSet)
router.register("niveaux", views.NiveauViewSet)
router.register("filieres", views.FiliereViewSet)
router.register("options-filiere", views.OptionFiliereViewSet)
router.register("classes", views.ClasseViewSet)
router.register("matieres", views.MatiereViewSet)
router.register("periodes", views.PeriodeViewSet)
router.register("sessions-examen", views.SessionExamenViewSet)

urlpatterns = router.urls

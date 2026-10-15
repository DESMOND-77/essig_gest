from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("evaluations", views.EvaluationViewSet)
router.register("notes", views.NoteEvaluationViewSet)

urlpatterns = router.urls

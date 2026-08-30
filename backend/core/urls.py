from django.urls import path

from .views import HealthView

urlpatterns = [path("healthz/", HealthView.as_view(), name="healthz")]

import pytest
from rest_framework import viewsets
from rest_framework.routers import SimpleRouter
from rest_framework.test import APIClient

from comptes.audit import AuditLogMixin
from comptes.models import JournalAudit, Role
from comptes.serializers import serializers
from comptes.tests.factories import UtilisateurFactory

pytestmark = pytest.mark.django_db


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["id", "code", "libelle"]


class RoleViewSet(AuditLogMixin, viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes: list = []


router = SimpleRouter()
router.register("roles-test", RoleViewSet, basename="roles-test")


@pytest.fixture
def urlconf(settings):
    module = type("m", (), {"urlpatterns": router.urls})
    settings.ROOT_URLCONF = module
    return module


def test_creation_ecrit_une_ligne_audit(urlconf):
    c = APIClient()
    c.force_authenticate(UtilisateurFactory())
    r = c.post("/roles-test/", {"code": "DAF", "libelle": "DAF"}, format="json")
    assert r.status_code == 201
    ligne = JournalAudit.objects.get()
    assert ligne.action == "CREATION"
    assert ligne.table_cible == "role"
    assert ligne.valeurs_apres["code"] == "DAF"
    assert ligne.valeurs_avant is None


def test_modification_ecrit_avant_et_apres(urlconf):
    role = Role.objects.create(code="DAF", libelle="DAF")
    c = APIClient()
    c.force_authenticate(UtilisateurFactory())
    r = c.patch(f"/roles-test/{role.pk}/", {"libelle": "Directeur AF"}, format="json")
    assert r.status_code == 200
    ligne = JournalAudit.objects.get(action="MODIFICATION")
    assert ligne.valeurs_avant["libelle"] == "DAF"
    assert ligne.valeurs_apres["libelle"] == "Directeur AF"


def test_suppression_ecrit_avant(urlconf):
    role = Role.objects.create(code="DAF", libelle="DAF")
    c = APIClient()
    c.force_authenticate(UtilisateurFactory())
    r = c.delete(f"/roles-test/{role.pk}/")
    assert r.status_code == 204
    ligne = JournalAudit.objects.get(action="SUPPRESSION")
    assert ligne.valeurs_avant["code"] == "DAF"
    assert ligne.valeurs_apres is None

import pytest
from rest_framework import serializers

from core.models import Auditable
from core.serializers import AuditableSerializerMixin
from referentiel import models as ref

pytestmark = pytest.mark.django_db


def test_auditable_est_abstrait_avec_4_champs():
    assert Auditable._meta.abstract is True
    champs = {f.name for f in Auditable._meta.get_fields()}
    assert {"cree_par", "cree_le", "modifie_par", "modifie_le"} <= champs


class _GroupeSerializer(AuditableSerializerMixin, serializers.ModelSerializer):
    # GroupeScolaire n'hérite pas d'Auditable : on vérifie seulement que le mixin
    # n'injecte rien de bloquant. Le comportement réel (pose de cree_par) est
    # couvert par les tests d'Inscription (Task 6).
    class Meta:
        model = ref.GroupeScolaire
        fields = ["id", "nom"]


def test_mixin_tolere_absence_de_request():
    s = _GroupeSerializer(data={"nom": "X"})
    assert s.is_valid(), s.errors
    obj = s.save()
    assert obj.nom == "X"

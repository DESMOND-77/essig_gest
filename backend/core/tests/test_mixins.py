import pytest
from django.db.models import RestrictedError

from core.exceptions import ConflitSuppressionException
from core.mixins import SuppressionProtegeeMixin


class _Base:
    def perform_destroy(self, instance):
        instance.delete()


class _Vue(SuppressionProtegeeMixin, _Base):
    pass


class _ObjOK:
    def __init__(self):
        self.supprime = False

    def delete(self):
        self.supprime = True


class _ObjProtege:
    def delete(self):
        raise RestrictedError("referencé", set())


def test_suppression_normale_delegue_au_super():
    obj = _ObjOK()
    _Vue().perform_destroy(obj)
    assert obj.supprime is True


def test_restricted_error_devient_409():
    with pytest.raises(ConflitSuppressionException) as e:
        _Vue().perform_destroy(_ObjProtege())
    assert e.value.status_code == 409

import pytest

from scolarite.serializers import EcheanceSerializer, ModalitePaiementSerializer

pytestmark = pytest.mark.django_db


def test_montant_total_read_only():
    assert ModalitePaiementSerializer().fields["montant_total"].read_only is True


def test_echeance_audit_read_only():
    f = EcheanceSerializer().fields
    for nom in ("cree_par", "modifie_par", "cree_le", "modifie_le"):
        assert f[nom].read_only is True

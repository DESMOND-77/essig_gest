import pytest
from rest_framework.test import APIClient

from comptes.models import Role, UtilisateurRole
from comptes.tests.factories import UtilisateurFactory
from referentiel.tests import factories as rf

pytestmark = pytest.mark.django_db


def _client(role_code=None):
    u = UtilisateurFactory()
    if role_code:
        r, _ = Role.objects.get_or_create(
            code=role_code, defaults={"libelle": role_code}
        )
        UtilisateurRole.objects.create(utilisateur=u, role=r)
    c = APIClient()
    c.force_authenticate(u)
    return c, u


@pytest.mark.parametrize(
    "role,attendu",
    [("DIRECTION", 201), ("DAF", 403), ("SCOLARITE", 403), ("COMPTABLE", 403)],
)
def test_rbac_modalite_paiement(role, attendu):
    c, _ = _client(role)
    n, a = rf.NiveauFactory(), rf.AnneeScolaireFactory()
    resp = c.post(
        "/api/v1/scolarite/modalites-paiement/",
        {
            "niveau": n.pk,
            "annee_scolaire": a.pk,
            "montant_inscription_reinscription": 105000,
            "nombre_echeance": 9,
            "montant_echeance": 70000,
        },
        format="json",
    )
    assert resp.status_code == attendu
    if attendu == 201:
        assert int(resp.data["montant_total"]) == 735000


@pytest.mark.parametrize(
    "role,attendu",
    [("DIRECTION", 200), ("DAF", 200), ("COMPTABLE", 200), ("SCOLARITE", 403)],
)
def test_rbac_echeance_patch(role, attendu):
    from scolarite.tests import factories as sf

    c, _ = _client(role)
    e = sf.EcheanceFactory(numero=1)
    resp = c.patch(
        f"/api/v1/scolarite/echeances/{e.pk}/",
        {"montant_prevu": 60000},
        format="json",
    )
    assert resp.status_code == attendu
    if attendu == 200:
        assert e.__class__.objects.get(pk=e.pk).modifie_par is not None

import pytest

from comptes.models import Role, UtilisateurRole
from comptes.tests.factories import UtilisateurFactory
from referentiel.tests.factories import EcoleFactory

pytestmark = pytest.mark.django_db


def test_utilisateur_role_pointe_une_ecole_reelle():
    champ = UtilisateurRole._meta.get_field("ecole")
    assert champ.related_model.__name__ == "Ecole"
    assert champ.null is True


def test_role_scope_ecole():
    u = UtilisateurFactory()
    r = Role.objects.create(code=Role.Code.SCOLARITE, libelle="Scolarité")
    e = EcoleFactory()
    ur = UtilisateurRole.objects.create(utilisateur=u, role=r, ecole=e)
    assert ur.ecole_id == e.pk

# backend/rh_paie/tests/test_core_viewset_adoption.py
"""
Régression : les ViewSets rh_paie dérivaient directement de `viewsets.ModelViewSet` au lieu de
`core.viewsets._BaseCrudViewSet` (audit du 2026-10-14), contrairement à
referentiel/personnes/scolarite. Conséquence : aucune entrée de `JournalAudit` n'était jamais
écrite sur create/update/destroy pour ce module. Ce test vérifie que l'alignement sur
`_BaseCrudViewSet` corrige bien ce manque.
"""
import pytest
from rest_framework.test import APIClient

from comptes.models import JournalAudit, Role, UtilisateurRole
from comptes.tests.factories import UtilisateurFactory

pytestmark = pytest.mark.django_db


def _client(role_code):
    user = UtilisateurFactory()
    role, _ = Role.objects.get_or_create(code=role_code, defaults={"libelle": role_code})
    UtilisateurRole.objects.create(utilisateur=user, role=role)
    client = APIClient()
    client.force_authenticate(user)
    return client, user


def test_creation_enseignant_ecrit_une_entree_de_journal_audit():
    client, _ = _client("DAF")
    resp = client.post(
        "/api/v1/rh-paie/enseignants/",
        {"nom": "DUPONT", "prenom": "Marie"},
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert JournalAudit.objects.filter(action="CREATION", table_cible="enseignant").count() == 1


def test_modification_enseignant_ecrit_une_entree_de_journal_audit():
    client, _ = _client("DAF")
    creation = client.post(
        "/api/v1/rh-paie/enseignants/",
        {"nom": "DUPONT", "prenom": "Marie"},
        format="json",
    )
    assert creation.status_code == 201, creation.data

    resp = client.patch(
        f"/api/v1/rh-paie/enseignants/{creation.data['id']}/",
        {"specialite": "Mathématiques"},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    assert JournalAudit.objects.filter(action="MODIFICATION", table_cible="enseignant").count() == 1

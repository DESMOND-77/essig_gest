import pytest
from rest_framework.test import APIClient

from comptes.models import Role, UtilisateurRole
from comptes.tests.factories import UtilisateurFactory
from evaluations.tests.factories import EvaluationFactory
from referentiel.tests.factories import ClasseFactory, MatiereFactory, SessionExamenFactory

pytestmark = pytest.mark.django_db


def _client_avec_role(code):
    user = UtilisateurFactory()
    role, _ = Role.objects.get_or_create(code=code, defaults={"libelle": code})
    UtilisateurRole.objects.create(utilisateur=user, role=role)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_lecture_seule_ne_peut_pas_creer_evaluation():
    classe = ClasseFactory()
    matiere = MatiereFactory()
    session_examen = SessionExamenFactory()
    client = _client_avec_role(Role.Code.LECTURE)
    resp = client.post(
        "/api/v1/evaluations/evaluations/",
        {
            "matiere": matiere.id,
            "classe": classe.id,
            "session_examen": session_examen.id,
            "type": "CC",
            "ponderation": "50",
            "bareme": 20,
        },
    )
    assert resp.status_code == 403


def test_scolarite_peut_creer_evaluation():
    classe = ClasseFactory()
    matiere = MatiereFactory()
    session_examen = SessionExamenFactory()
    client = _client_avec_role(Role.Code.SCOLARITE)
    resp = client.post(
        "/api/v1/evaluations/evaluations/",
        {
            "matiere": matiere.id,
            "classe": classe.id,
            "session_examen": session_examen.id,
            "type": "CC",
            "ponderation": "50",
            "bareme": 20,
        },
    )
    assert resp.status_code == 201


def test_ponderation_superieure_a_100_rejetee_par_api():
    existante = EvaluationFactory(ponderation=70)
    client = _client_avec_role(Role.Code.SCOLARITE)
    resp = client.post(
        "/api/v1/evaluations/evaluations/",
        {
            "matiere": existante.matiere.id,
            "classe": existante.classe.id,
            "session_examen": existante.session_examen.id,
            "type": "EXAMEN",
            "ponderation": "50",
            "bareme": 20,
        },
    )
    assert resp.status_code == 400

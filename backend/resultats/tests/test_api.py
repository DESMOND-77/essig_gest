import pytest
from rest_framework.test import APIClient

from comptes.models import Role, UtilisateurRole
from comptes.tests.factories import UtilisateurFactory
from evaluations.tests.factories import EvaluationFactory, NoteEvaluationFactory
from personnes.tests.factories import InscriptionFactory
from referentiel import models as ref_models
from referentiel.tests.factories import (
    ClasseFactory,
    MatiereFactory,
    PeriodeFactory,
    SessionExamenFactory,
)
from resultats.models import Deliberation
from resultats.tests.factories import DeliberationFactory

pytestmark = pytest.mark.django_db


def _client_avec_role(code):
    user = UtilisateurFactory()
    role, _ = Role.objects.get_or_create(code=code, defaults={"libelle": code})
    UtilisateurRole.objects.create(utilisateur=user, role=role)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_scolarite_ne_peut_pas_valider_deliberation():
    delib = DeliberationFactory()
    client = _client_avec_role(Role.Code.SCOLARITE)
    resp = client.post(f"/api/v1/resultats/deliberations/{delib.id}/valider/")
    assert resp.status_code == 403


def test_direction_peut_valider_deliberation():
    classe = ClasseFactory()
    periode = PeriodeFactory(annee_scolaire=classe.annee_scolaire, numero=1)
    normale = SessionExamenFactory(periode=periode, type=ref_models.SessionExamen.Type.NORMALE)
    matiere = MatiereFactory(
        niveau=classe.niveau,
        option_filiere=classe.option_filiere,
        semestre=ref_models.Matiere.Semestre.S1,
    )
    evaluation = EvaluationFactory(
        matiere=matiere, classe=classe, session_examen=normale, ponderation=100
    )
    inscription = InscriptionFactory(classe=classe)
    NoteEvaluationFactory(evaluation=evaluation, inscription=inscription, valeur=14)

    delib = DeliberationFactory(classe=classe, session_examen=normale, periode=periode)
    client = _client_avec_role(Role.Code.DIRECTION)
    resp = client.post(f"/api/v1/resultats/deliberations/{delib.id}/valider/")

    assert resp.status_code == 200
    delib.refresh_from_db()
    assert delib.statut == Deliberation.Statut.VALIDEE

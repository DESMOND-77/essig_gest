import pytest
from rest_framework.test import APIClient

from comptes.tests.factories import UtilisateurFactory
from personnes.tests.factories import InscriptionFactory
from resultats.models import ResultatAnnuel

pytestmark = pytest.mark.django_db


def test_bulletin_pdf_repond_200_application_pdf():
    inscription = InscriptionFactory()
    resultat_annuel = ResultatAnnuel.objects.create(
        inscription=inscription,
        annee_scolaire=inscription.annee_scolaire,
        regime=ResultatAnnuel.Regime.LMD,
        moyenne_annuelle=14.5,
        credits_acquis=60,
        credits_requis=60,
        dette_credits=0,
        decision=ResultatAnnuel.Decision.ADMIS,
        mention=ResultatAnnuel.Mention.AB,
    )

    user = UtilisateurFactory()
    client = APIClient()
    client.force_authenticate(user=user)

    resp = client.get(f"/api/v1/resultats/resultats-annuels/{resultat_annuel.id}/bulletin/")

    assert resp.status_code == 200
    assert resp["Content-Type"] == "application/pdf"

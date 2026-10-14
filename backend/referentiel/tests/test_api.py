import pytest
from rest_framework.test import APIClient

from comptes.models import JournalAudit, Role, UtilisateurRole
from comptes.tests.factories import UtilisateurFactory
from referentiel.tests import factories as f

pytestmark = pytest.mark.django_db


def _client(role_code=None, superuser=False):
    u = UtilisateurFactory(is_superuser=superuser, is_staff=superuser)
    if role_code:
        r, _ = Role.objects.get_or_create(
            code=role_code, defaults={"libelle": role_code}
        )
        UtilisateurRole.objects.create(utilisateur=u, role=r)
    c = APIClient()
    c.force_authenticate(u)
    return c, u


def test_liste_paginee():
    f.EcoleFactory.create_batch(3)
    c, _ = _client(Role.Code.LECTURE)
    resp = c.get("/api/v1/referentiel/ecoles/")
    assert resp.status_code == 200
    assert resp.data["count"] == 3
    assert "results" in resp.data


def test_filtre_niveau_par_ecole():
    e1, e2 = f.EcoleFactory(), f.EcoleFactory()
    f.NiveauFactory(ecole=e1)
    f.NiveauFactory(ecole=e2)
    c, _ = _client(Role.Code.LECTURE)
    resp = c.get(f"/api/v1/referentiel/niveaux/?ecole={e1.pk}")
    assert resp.data["count"] == 1


def test_recherche_matiere():
    f.MatiereFactory(nom="Comptabilité générale")
    f.MatiereFactory(nom="Droit")
    c, _ = _client(Role.Code.LECTURE)
    resp = c.get("/api/v1/referentiel/matieres/?search=compta")
    assert resp.data["count"] == 1


def test_direction_cree_ecole_et_ecrit_un_audit():
    c, _ = _client(Role.Code.DIRECTION)
    resp = c.post(
        "/api/v1/referentiel/ecoles/",
        {
            "nom": "ESSIG",
            "sigle": "ESSIG",
            "regime": "LMD",
        },
        format="json",
    )
    assert resp.status_code == 201
    assert JournalAudit.objects.filter(
        action="CREATION", table_cible="ecole"
    ).exists()


def test_scolarite_cree_classe_mais_pas_ecole():
    c, _ = _client(Role.Code.SCOLARITE)
    assert (
        c.post(
            "/api/v1/referentiel/ecoles/",
            {"nom": "x", "sigle": "CFPA", "regime": "CLASSIQUE"},
            format="json",
        ).status_code
        == 403
    )
    e = f.EcoleFactory()
    payload = {
        "annee_scolaire": f.AnneeScolaireFactory().pk,
        "niveau": f.NiveauFactory(ecole=e).pk,
        "option_filiere": f.OptionFiliereFactory().pk,
        "modalite_formation": f.ModaliteFormationFactory(code="FI").pk,
    }
    assert (
        c.post(
            "/api/v1/referentiel/classes/", payload, format="json"
        ).status_code
        == 201
    )


def test_anonyme_401():
    assert APIClient().get("/api/v1/referentiel/ecoles/").status_code == 401


def test_suppression_referencee_409():
    n = f.NiveauFactory()
    c, _ = _client(Role.Code.DIRECTION)
    resp = c.delete(f"/api/v1/referentiel/ecoles/{n.ecole_id}/")
    assert resp.status_code == 409


def test_libelle_auto_lecture_seule_via_api():
    c, _ = _client(Role.Code.DIRECTION)
    e = f.EcoleFactory()
    resp = c.post(
        "/api/v1/referentiel/classes/",
        {
            "annee_scolaire": f.AnneeScolaireFactory(libelle="2025-2026").pk,
            "niveau": f.NiveauFactory(ecole=e, code="L1").pk,
            "option_filiere": f.OptionFiliereFactory(
                filiere=f.FiliereFactory(ecole=e, sigle="GACO"), sigle="CI"
            ).pk,
            "modalite_formation": f.ModaliteFormationFactory(code="FI").pk,
            "libelle_auto": "PIRATÉ",
        },
        format="json",
    )
    assert resp.status_code == 201
    assert resp.data["libelle_auto"] == "L1 GACO/CI FI 2025-2026"


def test_annee_courante_bascule_via_api():
    c, _ = _client(Role.Code.DIRECTION)
    a1 = f.AnneeScolaireFactory(libelle="2024-2025", est_courante=True)
    a2 = f.AnneeScolaireFactory(libelle="2025-2026", est_courante=False)
    resp = c.patch(
        f"/api/v1/referentiel/annees-scolaires/{a2.pk}/",
        {"est_courante": True}, format="json",
    )
    assert resp.status_code == 200
    a1.refresh_from_db()
    a2.refresh_from_db()
    assert a2.est_courante is True and a1.est_courante is False


def test_audit_suppression_seulement_si_succes():
    from comptes.models import JournalAudit
    c, _ = _client(Role.Code.DIRECTION)
    e = f.EcoleFactory()
    n = f.NiveauFactory(ecole=e)
    assert c.delete(f"/api/v1/referentiel/ecoles/{e.pk}/").status_code == 409
    assert not JournalAudit.objects.filter(action="SUPPRESSION", table_cible="ecole").exists()
    n.delete()
    assert c.delete(f"/api/v1/referentiel/ecoles/{e.pk}/").status_code == 204
    assert JournalAudit.objects.filter(action="SUPPRESSION", table_cible="ecole").exists()

import pytest
from rest_framework.test import APIClient

from comptes.models import JournalAudit, Role, UtilisateurRole
from comptes.tests.factories import UtilisateurFactory
from personnes import models
from personnes.tests import factories as f

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


def test_creation_etudiant_attribue_le_matricule_et_ecrit_un_audit():
    c, _ = _client(Role.Code.SCOLARITE)
    resp = c.post(
        "/api/v1/personnes/etudiants/",
        {
            "nom": "Gumapi clos",
            "prenoms": "desmond junior",
            "sexe": "F",
            "pole": "ESSIG",
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["matricule"] == "ESSIG-FCVGUDE1"
    assert (
        JournalAudit.objects.filter(
            action="CREATION", table_cible="etudiant"
        ).count()
        == 1
    )


def test_lecture_ouverte_ecriture_refusee_en_lecture_seule():
    c, _ = _client(Role.Code.LECTURE)
    assert c.get("/api/v1/personnes/etudiants/").status_code == 200
    resp = c.post(
        "/api/v1/personnes/etudiants/",
        {"nom": "X", "prenoms": "Y", "sexe": "M", "pole": "UPSS"},
        format="json",
    )
    assert resp.status_code == 403


@pytest.mark.parametrize(
    "role,attendu",
    [("DIRECTION", 201), ("SCOLARITE", 201), ("COMPTABLE", 403), ("DAF", 403)],
)
def test_ecriture_par_role(role, attendu):
    c, _ = _client(role)
    resp = c.post(
        "/api/v1/personnes/etudiants/",
        {"nom": "N", "prenoms": "P", "sexe": "M", "pole": "ESSIG"},
        format="json",
    )
    assert resp.status_code == attendu


def test_recherche_par_matricule_nom_prenoms():
    c, _ = _client(Role.Code.SCOLARITE)
    c.post(
        "/api/v1/personnes/etudiants/",
        {"nom": "Ndong", "prenoms": "Alice", "sexe": "F", "pole": "ESSIG"},
        format="json",
    )
    c.post(
        "/api/v1/personnes/etudiants/",
        {"nom": "Obame", "prenoms": "Bob", "sexe": "M", "pole": "ESSIG"},
        format="json",
    )
    resp = c.get("/api/v1/personnes/etudiants/?search=ndong")
    assert resp.data["count"] == 1


def test_filtre_a_le_bac():
    c, _ = _client(Role.Code.SCOLARITE)
    e = f.EtudiantFactory()
    f.SituationBacFactory(etudiant=e, a_le_bac=True)
    f.EtudiantFactory()  # sans BAC
    resp = c.get("/api/v1/personnes/etudiants/?a_le_bac=true")
    assert resp.data["count"] == 1


def test_detail_imbrique_affiliations_et_bac():
    c, _ = _client(Role.Code.LECTURE)
    e = f.EtudiantFactory()
    f.AffiliationFactory(etudiant=e, type=models.Affiliation.Type.MERE)
    resp = c.get(f"/api/v1/personnes/etudiants/{e.pk}/")
    assert resp.status_code == 200
    assert len(resp.data["affiliations"]) == 1


def test_patch_ne_modifie_pas_le_matricule():
    c, _ = _client(Role.Code.SCOLARITE)
    e = f.EtudiantFactory(matricule="ESSIG-FCVGUDE9")
    resp = c.patch(
        f"/api/v1/personnes/etudiants/{e.pk}/",
        {"matricule": "PIRATE", "nom": "Z"},
        format="json",
    )
    assert resp.status_code == 200
    e.refresh_from_db()
    assert e.matricule == "ESSIG-FCVGUDE9"
    assert e.nom == "Z"


def test_suppression_etudiant_204_et_audit():
    c, _ = _client(Role.Code.DIRECTION)
    e = f.EtudiantFactory()
    assert c.delete(f"/api/v1/personnes/etudiants/{e.pk}/").status_code == 204
    assert JournalAudit.objects.filter(
        action="SUPPRESSION", table_cible="etudiant"
    ).exists()


def test_types_piece_crud_par_scolarite():
    c, _ = _client(Role.Code.SCOLARITE)
    resp = c.post(
        "/api/v1/personnes/types-piece/",
        {"code": "ACTE_NAISSANCE", "libelle": "Acte de naissance"},
        format="json",
    )
    assert resp.status_code == 201

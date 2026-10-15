import pytest
from rest_framework.test import APIClient

from comptes.models import Role, UtilisateurRole
from comptes.tests.factories import UtilisateurFactory
from referentiel.tests import factories as rf
from personnes.tests import factories as pf
from scolarite.tests import factories as sf

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
            "montant_inscription_reinscription": 50000,
            "nombre_echeance": 9,
            "montant_echeance": 70000,
        },
        format="json",
    )
    assert resp.status_code == attendu
    if attendu == 201:
        assert int(resp.data["montant_echeance"]) == 70000


@pytest.mark.parametrize(
    "role,attendu",
    [("DIRECTION", 200), ("DAF", 200), ("COMPTABLE", 200), ("SCOLARITE", 403)],
)
def test_rbac_echeance_patch(role, attendu):
    c, _ = _client(role)
    e = sf.EcheanceFactory(numero=1)
    resp = c.patch(
        f"/api/v1/scolarite/echeances/{e.pk}/",
        {"montant": 60000},
        format="json",
    )
    assert resp.status_code == attendu
    if attendu == 200:
        assert e.__class__.objects.get(pk=e.pk).modifie_par is not None


@pytest.mark.parametrize(
    "role,attendu",
    [("DIRECTION", 201), ("DAF", 403), ("COMPTABLE", 403), ("SCOLARITE", 403)],
)
def test_rbac_types_frais(role, attendu):
    c, _ = _client(role)
    resp = c.post(
        "/api/v1/scolarite/types-frais/",
        {"code": f"X_{role}", "libelle": "X", "montant_defaut": 5000},
        format="json",
    )
    assert resp.status_code == attendu


@pytest.mark.parametrize(
    "role,attendu",
    [("DIRECTION", 201), ("DAF", 201), ("COMPTABLE", 201), ("SCOLARITE", 403)],
)
def test_rbac_frais_inscription(role, attendu):
    c, _ = _client(role)
    inscription = pf.InscriptionFactory()
    type_frais = sf.TypeFraisFactory()
    resp = c.post(
        "/api/v1/scolarite/frais-inscription/",
        {
            "inscription": inscription.pk,
            "type_frais": type_frais.pk,
            "montant_du": 12000,
        },
        format="json",
    )
    assert resp.status_code == attendu
    if attendu == 201:
        assert resp.data["cree_par"] is not None


def test_frais_inscription_liste_et_detail_ne_plantent_pas():
    """Régression : `FraisInscriptionViewSet.queryset` faisait un `select_related` sur
    `inscription`/`type_frais` alors que le modèle n'avait que `niveau`/`annee_scolaire`
    -> FieldError sur tout GET liste/détail. Corrigé : `FraisInscription` porte
    maintenant une vraie FK `inscription`/`type_frais` (cf. modèle)."""
    c, _ = _client("DIRECTION")
    frais = sf.FraisInscriptionFactory()

    liste = c.get("/api/v1/scolarite/frais-inscription/")
    assert liste.status_code == 200, liste.data

    detail = c.get(f"/api/v1/scolarite/frais-inscription/{frais.pk}/")
    assert detail.status_code == 200, detail.data


def test_echeance_tri_par_date_echeance_fonctionne_reellement():
    """Régression : `ordering_fields` référençait `date_prevue`, absent du modèle `Echeance`
    (champ réel : `date_echeance`). `?ordering=date_prevue` levait `FieldError` (500) dès que le
    queryset était évalué ; vérifié empiriquement. `date_echeance` n'étant pas dans l'ancienne
    liste blanche `ordering_fields`, un tri demandé sur ce champ réel était silencieusement
    ignoré (DRF `OrderingFilter` ignore les champs hors whitelist sans erreur) : il ne suffit
    donc pas de vérifier un code 200, il faut vérifier que le tri est réellement appliqué."""
    c, _ = _client("DIRECTION")
    sf.EcheanceFactory(numero=1, date_echeance="2025-12-01")
    sf.EcheanceFactory(numero=2, date_echeance="2025-10-01")
    sf.EcheanceFactory(numero=3, date_echeance="2025-11-01")

    resp = c.get("/api/v1/scolarite/echeances/?ordering=date_echeance")
    assert resp.status_code == 200, resp.data
    dates = [row["date_echeance"] for row in resp.data["results"]]
    assert dates == sorted(dates)

    resp_desc = c.get("/api/v1/scolarite/echeances/?ordering=-date_echeance")
    assert resp_desc.status_code == 200, resp_desc.data
    dates_desc = [row["date_echeance"] for row in resp_desc.data["results"]]
    assert dates_desc == sorted(dates_desc, reverse=True)

    # Le nom de champ fautif ne doit plus être exploitable (plus dans la whitelist) : la
    # requête ne doit pas planter, elle retombe simplement sur l'ordre par défaut.
    resp_champ_fautif = c.get("/api/v1/scolarite/echeances/?ordering=date_prevue")
    assert resp_champ_fautif.status_code == 200, resp_champ_fautif.data


def test_rbac_bourse_daf():
    c, _ = _client("DAF")
    etudiant = pf.EtudiantFactory()
    annee = rf.AnneeScolaireFactory()
    resp = c.post(
        "/api/v1/scolarite/bourses/",
        {
            "etudiant": etudiant.pk,
            "annee_scolaire": annee.pk,
            "pourcentage": 50.00,
            "type": "PARTIELLE",
            "date_attribution": "2025-09-01"
        },
        format="json",
    )
    assert resp.status_code == 201
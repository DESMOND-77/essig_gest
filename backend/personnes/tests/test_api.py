from unittest import mock

import pytest
from rest_framework.test import APIClient

from comptes.models import JournalAudit, Role, UtilisateurRole
from comptes.tests.factories import UtilisateurFactory
from personnes import models
from personnes.tests import factories as f
from referentiel.tests.factories import EcoleFactory

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
    EcoleFactory(sigle="ESSIG")
    c, _ = _client(Role.Code.SCOLARITE)
    resp = c.post(
        "/api/v1/personnes/etudiants/",
        {
            "nom": "Gumapi clos",
            "prenoms": "desmond junior",
            "sexe": "F",
            "ecole_sigle": "ESSIG",
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


def test_creation_etudiant_echec_tardif_annule_aussi_le_compteur_matricule():
    """Régression : EtudiantViewSet.perform_create enveloppe maintenant la création dans
    `transaction.atomic()`, par symétrie avec InscriptionViewSet. Sans ce verrou transactionnel,
    un échec après `generer_matricule()` (qui incrémente CompteurMatricule) laissait le compteur
    incrémenté ("brûlé") même si l'Etudiant n'était jamais inséré."""
    EcoleFactory(sigle="ESSIG")
    c, _ = _client(Role.Code.SCOLARITE)

    with mock.patch.object(
        models.Etudiant.objects, "create", side_effect=RuntimeError("échec simulé tardif")
    ):
        with pytest.raises(RuntimeError):
            c.post(
                "/api/v1/personnes/etudiants/",
                {"nom": "Echec", "prenoms": "Tardif", "sexe": "M", "ecole_sigle": "ESSIG"},
                format="json",
            )

    assert models.Etudiant.objects.count() == 0
    assert models.CompteurMatricule.objects.filter(ecole_sigle="ESSIG").count() == 0


def test_lecture_ouverte_ecriture_refusee_en_lecture_seule():
    EcoleFactory(sigle="UPSS")
    c, _ = _client(Role.Code.LECTURE)
    assert c.get("/api/v1/personnes/etudiants/").status_code == 200
    resp = c.post(
        "/api/v1/personnes/etudiants/",
        {"nom": "X", "prenoms": "Y", "sexe": "M", "ecole_sigle": "UPSS"},
        format="json",
    )
    assert resp.status_code == 403


@pytest.mark.parametrize(
    "role,attendu",
    [("DIRECTION", 201), ("SCOLARITE", 201), ("COMPTABLE", 403), ("DAF", 403)],
)
def test_ecriture_par_role(role, attendu):
    EcoleFactory(sigle="ESSIG")
    c, _ = _client(role)
    resp = c.post(
        "/api/v1/personnes/etudiants/",
        {"nom": "N", "prenoms": "P", "sexe": "M", "ecole_sigle": "ESSIG"},
        format="json",
    )
    assert resp.status_code == attendu


def test_recherche_par_matricule_nom_prenoms():
    EcoleFactory(sigle="ESSIG")
    c, _ = _client(Role.Code.SCOLARITE)
    c.post(
        "/api/v1/personnes/etudiants/",
        {"nom": "Ndong", "prenoms": "Alice", "sexe": "F", "ecole_sigle": "ESSIG"},
        format="json",
    )
    c.post(
        "/api/v1/personnes/etudiants/",
        {"nom": "Obame", "prenoms": "Bob", "sexe": "M", "ecole_sigle": "ESSIG"},
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


def _grille(classe, **kw):
    from scolarite.tests import factories as sf

    return sf.ModalitePaiementFactory(
        niveau=classe.niveau, annee_scolaire=classe.annee_scolaire, **kw
    )


def test_creation_inscription_transaction_complete():
    from referentiel.tests import factories as rf

    c, _ = _client(Role.Code.SCOLARITE)
    classe = rf.ClasseFactory()
    _grille(classe)
    etu = f.EtudiantFactory()
    resp = c.post(
        "/api/v1/personnes/inscriptions/",
        {"etudiant": etu.pk, "classe": classe.pk, "date_inscription": "2025-10-01"},
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["numero_ordre"] == 1
    assert resp.data["ecole"] == classe.niveau.ecole_id
    assert len(resp.data["echeances"]) == 10
    assert (
        JournalAudit.objects.filter(
            action="CREATION", table_cible="inscription"
        ).count()
        == 1
    )


def test_creation_inscription_sans_grille_400_et_rollback():
    from referentiel.tests import factories as rf

    c, _ = _client(Role.Code.SCOLARITE)
    classe = rf.ClasseFactory()  # pas de grille
    etu = f.EtudiantFactory()
    resp = c.post(
        "/api/v1/personnes/inscriptions/",
        {"etudiant": etu.pk, "classe": classe.pk, "date_inscription": "2025-10-01"},
        format="json",
    )
    assert resp.status_code == 400
    assert models.Inscription.objects.count() == 0  # rollback total


def test_creation_inscription_cout_negocie():
    from referentiel.tests import factories as rf

    c, _ = _client(Role.Code.SCOLARITE)
    classe = rf.ClasseFactory()
    _grille(classe)
    etu = f.EtudiantFactory()
    resp = c.post(
        "/api/v1/personnes/inscriptions/",
        {
            "etudiant": etu.pk,
            "classe": classe.pk,
            "date_inscription": "2025-10-01",
            "cout_scolarite_negocie": 600000,
        },
        format="json",
    )
    assert resp.status_code == 201
    assert sum(int(e["montant_prevu"]) for e in resp.data["echeances"]) == 600000


def test_patch_inscription_refuse_classe_et_numero():
    from referentiel.tests import factories as rf

    c, _ = _client(Role.Code.SCOLARITE)
    i = f.InscriptionFactory()
    autre_classe = rf.ClasseFactory()
    resp = c.patch(
        f"/api/v1/personnes/inscriptions/{i.pk}/",
        {"numero_ordre": 999, "classe": autre_classe.pk, "etat": "ABANDON"},
        format="json",
    )
    assert resp.status_code == 200
    i.refresh_from_db()
    assert i.numero_ordre != 999
    assert i.classe_id != autre_classe.pk
    assert i.etat == "ABANDON"


def test_suppression_inscription_avec_echeances_409_sans_audit():
    from scolarite.tests import factories as sf

    c, _ = _client(Role.Code.DIRECTION)
    i = f.InscriptionFactory()
    sf.EcheanceFactory(inscription=i, numero=0)
    resp = c.delete(f"/api/v1/personnes/inscriptions/{i.pk}/")
    assert resp.status_code == 409
    assert not JournalAudit.objects.filter(
        action="SUPPRESSION", table_cible="inscription"
    ).exists()


def test_suppression_inscription_sans_enfant_204():
    c, _ = _client(Role.Code.DIRECTION)
    i = f.InscriptionFactory()
    assert c.delete(f"/api/v1/personnes/inscriptions/{i.pk}/").status_code == 204


def test_reste_a_payer_inscription():
    """Endpoint ajouté pour le frontend trésorerie (affichage informatif avant encaissement) :
    GET /personnes/inscriptions/{id}/reste-a-payer/."""
    from scolarite.tests import factories as sf

    c, _ = _client(Role.Code.SCOLARITE)
    i = f.InscriptionFactory()
    sf.EcheanceFactory(inscription=i, numero=0, montant=100000, montant_paye=40000)

    resp = c.get(f"/api/v1/personnes/inscriptions/{i.pk}/reste-a-payer/")
    assert resp.status_code == 200, resp.data
    assert resp.data["reste_a_payer"] == 60000

    resp_inexistant = c.get("/api/v1/personnes/inscriptions/999999/reste-a-payer/")
    assert resp_inexistant.status_code == 404


@pytest.mark.parametrize(
    "role,attendu",
    [("SCOLARITE", 201), ("DIRECTION", 201), ("COMPTABLE", 403), ("DAF", 403)],
)
def test_rbac_inscriptions(role, attendu):
    from referentiel.tests import factories as rf

    c, _ = _client(role)
    classe = rf.ClasseFactory()
    _grille(classe)
    resp = c.post(
        "/api/v1/personnes/inscriptions/",
        {
            "etudiant": f.EtudiantFactory().pk,
            "classe": classe.pk,
            "date_inscription": "2025-10-01",
        },
        format="json",
    )
    assert resp.status_code == attendu


def test_creation_inscription_materialise_les_frais_obligatoires():
    from referentiel.tests import factories as rf
    from scolarite.tests import factories as sf

    c, _ = _client(Role.Code.SCOLARITE)
    classe = rf.ClasseFactory()
    sf.ModalitePaiementFactory(
        niveau=classe.niveau,
        annee_scolaire=classe.annee_scolaire,
    )
    sf.TypeFraisFactory(
        code="MUTUELLE", obligatoire=True, actif=True, montant_defaut=5000
    )
    sf.TypeFraisFactory(code="PHOTOCOPIE", obligatoire=False, actif=True)
    resp = c.post(
        "/api/v1/personnes/inscriptions/",
        {
            "etudiant": f.EtudiantFactory().pk,
            "classe": classe.pk,
            "date_inscription": "2025-10-01",
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    mutuelle = sf.TypeFraisFactory._meta.model.objects.get(code="MUTUELLE")
    assert {fi["type_frais"] for fi in resp.data["frais_inscription"]} == {mutuelle.pk}

# backend/tresorerie/tests/test_api.py
"""
Tests de régression API pour le module tresorerie, découverts lors de l'audit du 2026-10-14
(docs/superpowers/plans/2026-10-14-audit-module-tresorerie-complement.md) :

1) `TresoreriePermission`/`TresorerieValidationPermission`/`IsCompteOwnerOrReadOnly` utilisaient
   `request.user.groups` (jamais peuplé dans ce projet) au lieu de `request.user.roles` -> toute
   écriture/validation sur TOUT le module trésorerie était refusée, pour tout rôle.
2) `VirementViewSet.perform_create`, `EncaissementViewSet.perform_create`,
   `DepenseViewSet.perform_create`, `ArreteCaisseViewSet.perform_create` sauvegardaient le
   serializer brut sans jamais appeler leur service métier -> aucun Mouvement de trésorerie
   n'était jamais créé (et pour Encaissement/Depense, `mouvement` étant un OneToOneField requis,
   la création plantait purement et simplement).
"""
import datetime

import pytest
from rest_framework.test import APIClient

from comptes.models import Role, UtilisateurRole
from comptes.tests.factories import UtilisateurFactory
from personnes.tests import factories as pf
from referentiel.tests import factories as rf
from tresorerie.models import (
    ArreteCaisse, CategorieMouvement, Compte, Depense, Encaissement, Mouvement, Virement
)

pytestmark = pytest.mark.django_db


def _client(role_code=None):
    u = UtilisateurFactory()
    if role_code:
        r, _ = Role.objects.get_or_create(code=role_code, defaults={"libelle": role_code})
        UtilisateurRole.objects.create(utilisateur=u, role=r)
    c = APIClient()
    c.force_authenticate(u)
    return c, u


def _compte(**kwargs):
    defaults = dict(
        code="C1",
        libelle="Compte test",
        type=Compte.Type.BANQUE,
        solde_initial=1_000_000,
        actif=True,
    )
    defaults.update(kwargs)
    return Compte.objects.create(**defaults)


def test_ecriture_refusee_sans_role_autorise():
    """Avant la correction, ce test aurait aussi échoué pour un rôle autorisé (DAF/COMPTABLE) :
    `request.user.groups` était toujours vide, donc 403 pour tout le monde."""
    c, _ = _client("SCOLARITE")  # rôle non autorisé en écriture tresorerie
    compte = _compte()
    resp = c.post(
        "/api/v1/tresorerie/virements/",
        {
            "compte_source": compte.id,
            "compte_destination": compte.id,
            "montant": 1000,
            "date": "2025-10-14",
            "motif": "test",
        },
        format="json",
    )
    assert resp.status_code == 403


def test_virement_cree_en_brouillon_puis_engage_puis_valide_poste_les_mouvements():
    """Flux maker-checker à 3 étapes : BROUILLON -> (engager) -> EN_ATTENTE_VALIDATION ->
    (valider) -> VALIDE. Aucun mouvement avant la validation finale."""
    c, _ = _client("DAF")
    compte_source = _compte(code="VIR_SRC")
    compte_destination = Compte.objects.create(
        code="VIR_DST", libelle="Destination",
        type=Compte.Type.BANQUE, solde_initial=0, actif=True,
    )
    rf.AnneeScolaireFactory(libelle="2025-2026", est_courante=True)

    resp = c.post(
        "/api/v1/tresorerie/virements/",
        {
            "compte_source": compte_source.id,
            "compte_destination": compte_destination.id,
            "montant": 50000,
            "date": "2025-10-14",
            "motif": "Approvisionnement caisse",
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    virement = Virement.objects.get(id=resp.data["id"])
    assert virement.statut == Virement.Statut.BROUILLON
    assert Mouvement.objects.filter(virement=virement).count() == 0

    # Valider directement un BROUILLON doit être refusé : il faut d'abord l'engager.
    resp_valider_trop_tot = c.post(f"/api/v1/tresorerie/virements/{virement.id}/valider/")
    assert resp_valider_trop_tot.status_code == 400, resp_valider_trop_tot.data
    assert Mouvement.objects.filter(virement=virement).count() == 0

    resp_engager = c.post(f"/api/v1/tresorerie/virements/{virement.id}/engager/")
    assert resp_engager.status_code == 200, resp_engager.data
    virement.refresh_from_db()
    assert virement.statut == Virement.Statut.EN_ATTENTE_VALIDATION
    assert Mouvement.objects.filter(virement=virement).count() == 0

    # Engager un virement déjà engagé doit être refusé (pas de double soumission).
    resp_reengager = c.post(f"/api/v1/tresorerie/virements/{virement.id}/engager/")
    assert resp_reengager.status_code == 400, resp_reengager.data

    resp_valider = c.post(f"/api/v1/tresorerie/virements/{virement.id}/valider/")
    assert resp_valider.status_code == 200, resp_valider.data
    virement.refresh_from_db()
    assert virement.statut == Virement.Statut.VALIDE
    mouvements = Mouvement.objects.filter(virement=virement)
    assert mouvements.count() == 2
    assert set(mouvements.values_list("sens", flat=True)) == {Mouvement.Sens.DEBIT, Mouvement.Sens.CREDIT}

    resp_annuler = c.post(f"/api/v1/tresorerie/virements/{virement.id}/annuler/")
    assert resp_annuler.status_code == 200, resp_annuler.data
    virement.refresh_from_db()
    assert virement.statut == Virement.Statut.ANNULE
    # 2 mouvements d'origine + 2 mouvements de contre-écriture
    assert Mouvement.objects.filter(virement=virement).count() == 4


def test_virement_statut_fourni_par_le_client_est_ignore_a_la_creation():
    """Régression : `statut` était écrivable et `perform_create` posait `valide_par` sans
    jamais créer de Mouvement si le client fournissait `statut=VALIDE` -> un virement pouvait
    se prétendre validé sans aucun effet sur le grand livre."""
    c, _ = _client("DAF")
    compte_source = _compte(code="VIR_SRC2")
    compte_destination = Compte.objects.create(
        code="VIR_DST2", libelle="Destination",
        type=Compte.Type.BANQUE, solde_initial=0, actif=True,
    )
    resp = c.post(
        "/api/v1/tresorerie/virements/",
        {
            "compte_source": compte_source.id,
            "compte_destination": compte_destination.id,
            "montant": 1000,
            "date": "2025-10-14",
            "motif": "test",
            "statut": Virement.Statut.VALIDE,
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    virement = Virement.objects.get(id=resp.data["id"])
    assert virement.statut == Virement.Statut.BROUILLON
    assert Mouvement.objects.filter(virement=virement).count() == 0


def test_encaissement_cree_poste_le_mouvement_et_genere_le_recu():
    c, _ = _client("DAF")
    compte = _compte(code="ENC1")
    inscription = pf.InscriptionFactory()

    resp = c.post(
        "/api/v1/tresorerie/encaissements/",
        {
            "inscription": inscription.id,
            "date": "2025-10-14",
            "montant_total": 25000,
            "mode": Encaissement.Mode.ESPECES,
            "compte": compte.id,
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    encaissement = Encaissement.objects.get(id=resp.data["id"])
    assert encaissement.mouvement is not None
    assert encaissement.mouvement.sens == Mouvement.Sens.CREDIT
    assert encaissement.recu_numero  # généré serveur, non vide


def test_recu_encaissement_retourne_un_pdf():
    c, _ = _client("DAF")
    compte = _compte(code="ENC2")
    inscription = pf.InscriptionFactory()

    resp_create = c.post(
        "/api/v1/tresorerie/encaissements/",
        {
            "inscription": inscription.id,
            "date": "2025-10-14",
            "montant_total": 25000,
            "mode": Encaissement.Mode.ESPECES,
            "compte": compte.id,
        },
        format="json",
    )
    assert resp_create.status_code == 201, resp_create.data
    encaissement_id = resp_create.data["id"]

    resp = c.get(f"/api/v1/tresorerie/encaissements/{encaissement_id}/recu/")
    assert resp.status_code == 200, resp.content
    assert resp["Content-Type"] == "application/pdf"


def test_depense_cree_poste_le_mouvement():
    c, _ = _client("DAF")
    compte = _compte(code="DEP1")
    annee = rf.AnneeScolaireFactory(libelle="2025-2027")
    categorie = CategorieMouvement.objects.create(
        code="DEP_TEST", libelle="Dépense test", sens=CategorieMouvement.Sens.SORTIE
    )

    resp = c.post(
        "/api/v1/tresorerie/depenses/",
        {
            "date": "2025-10-14",
            "categorie_mouvement": categorie.id,
            "beneficiaire": "Fournisseur X",
            "designation": "Achat fournitures",
            "montant": 15000,
            "compte": compte.id,
            "ecole": None,
            "annee_scolaire": annee.id,
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    depense = Depense.objects.get(id=resp.data["id"])
    assert depense.mouvement is not None
    assert depense.mouvement.sens == Mouvement.Sens.DEBIT


def test_arrete_caisse_cree_calcule_le_solde_theorique_cote_serveur():
    c, _ = _client("DAF")
    caisse = _compte(code="CAI1", type=Compte.Type.CAISSE, solde_initial=100000)

    resp = c.post(
        "/api/v1/tresorerie/arretes-caisse/",
        {
            "compte": caisse.id,
            "date": "2025-10-14",
            "solde_physique": 100000,
            # `solde_theorique` fourni par le client : doit être ignoré (read-only, calculé serveur).
            "solde_theorique": 999999,
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    arrete = ArreteCaisse.objects.get(id=resp.data["id"])
    assert arrete.solde_theorique == 100000
    assert arrete.ecart == 0

    # Un second arrêté pour le même compte/date doit être refusé (règle déjà portée par le
    # service `creer_arrete_caisse`, désormais atteignable depuis l'API).
    resp_doublon = c.post(
        "/api/v1/tresorerie/arretes-caisse/",
        {"compte": caisse.id, "date": "2025-10-14", "solde_physique": 100000},
        format="json",
    )
    assert resp_doublon.status_code == 400, resp_doublon.data


def test_solde_theorique_caisse_preview_avant_creation_arrete():
    """Endpoint ajouté pour le frontend (prévisualisation avant de créer l'arrêté) :
    GET /arretes-caisse/solde-theorique/?compte_id=...&date=..."""
    c, _ = _client("DAF")
    caisse = _compte(code="CAI2", type=Compte.Type.CAISSE, solde_initial=75000)

    resp = c.get(
        "/api/v1/tresorerie/arretes-caisse/solde-theorique/",
        {"compte_id": caisse.id, "date": "2025-10-14"},
    )
    assert resp.status_code == 200, resp.data
    assert resp.data["solde_theorique"] == 75000

    resp_params_manquants = c.get("/api/v1/tresorerie/arretes-caisse/solde-theorique/")
    assert resp_params_manquants.status_code == 400

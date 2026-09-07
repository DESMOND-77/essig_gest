import datetime as dt

import pytest
from rest_framework.serializers import ValidationError

from personnes.tests import factories as pf
from scolarite import models, services
from scolarite.tests import factories as f

pytestmark = pytest.mark.django_db


def _inscription_avec_grille(**insc):
    i = pf.InscriptionFactory(date_inscription=dt.date(2025, 10, 1), **insc)
    f.ModalitePaiementFactory(
        niveau=i.classe.niveau,
        annee_scolaire=i.annee_scolaire,
        montant_inscription_reinscription=105000,
        nombre_echeance=9,
        montant_echeance=70000,
    )
    return i


def test_ajouter_mois_borne_le_jour():
    assert services._ajouter_mois(dt.date(2025, 1, 31), 1) == dt.date(2025, 2, 28)
    assert services._ajouter_mois(dt.date(2025, 10, 1), 3) == dt.date(2026, 1, 1)
    assert services._ajouter_mois(dt.date(2025, 10, 1), 0) == dt.date(2025, 10, 1)


def test_echeancier_grille_standard():
    i = _inscription_avec_grille()
    ech = services.generer_echeancier(i)
    assert [e.numero for e in ech] == list(range(10))
    assert ech[0].montant_prevu == 105000
    assert all(e.montant_prevu == 70000 for e in ech[1:])
    assert ech[1].date_prevue == dt.date(2025, 11, 1)
    assert models.Echeance.objects.filter(inscription=i).count() == 10


def test_echeancier_negocie_repartit_le_reste():
    i = _inscription_avec_grille(cout_scolarite_negocie=600000)
    ech = services.generer_echeancier(i)
    assert ech[0].montant_prevu == 105000
    assert [int(e.montant_prevu) for e in ech[1:]] == [55000] * 9
    assert sum(int(e.montant_prevu) for e in ech) == 600000


def test_echeancier_negocie_arrondi_sur_derniere():
    i = _inscription_avec_grille(cout_scolarite_negocie=205000)  # reste = 100000, N=9
    ech = services.generer_echeancier(i)
    montants = [int(e.montant_prevu) for e in ech[1:]]
    assert montants[:8] == [11111] * 8
    assert montants[8] == 100000 - 11111 * 8  # 11112
    assert sum(int(e.montant_prevu) for e in ech) == 205000


def test_echeancier_boursier_marque_1_a_N():
    i = _inscription_avec_grille(est_boursier=True)
    ech = services.generer_echeancier(i)
    assert ech[0].pris_en_charge_bourse is False
    assert all(e.pris_en_charge_bourse for e in ech[1:])


def test_echeancier_sans_grille_leve_400():
    i = pf.InscriptionFactory()
    with pytest.raises(ValidationError):
        services.generer_echeancier(i)


def test_echeancier_negocie_inferieur_a_inscription_leve_400():
    i = _inscription_avec_grille(cout_scolarite_negocie=50000)  # < 105000
    with pytest.raises(ValidationError):
        services.generer_echeancier(i)

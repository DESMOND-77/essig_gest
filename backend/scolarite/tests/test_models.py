import pytest
from django.db import IntegrityError, transaction

from scolarite import models
from scolarite.tests import factories as f

pytestmark = pytest.mark.django_db


def test_db_tables():
    assert models.ModalitePaiement._meta.db_table == "modalite_paiement"
    assert models.Echeance._meta.db_table == "echeance"


def test_montant_total_est_genere():
    m = f.ModalitePaiementFactory(
        montant_inscription_reinscription=105000,
        nombre_echeance=9,
        montant_echeance=70000,
    )
    m.refresh_from_db()
    assert m.montant_total == 735000


def test_unq_modalite_paiement():
    m = f.ModalitePaiementFactory()
    with pytest.raises(IntegrityError), transaction.atomic():
        f.ModalitePaiementFactory(niveau=m.niveau, annee_scolaire=m.annee_scolaire)


def test_unq_echeance():
    e = f.EcheanceFactory(numero=0)
    with pytest.raises(IntegrityError), transaction.atomic():
        f.EcheanceFactory(inscription=e.inscription, numero=0)


def test_db_tables_3b():
    assert models.TypeFrais._meta.db_table == "type_frais"
    assert models.FraisInscription._meta.db_table == "frais_inscription"
    assert models.Bourse._meta.db_table == "bourse"


def test_unq_type_frais_code():
    f.TypeFraisFactory(code="TENUE")
    with pytest.raises(IntegrityError), transaction.atomic():
        f.TypeFraisFactory(code="TENUE")


def test_unq_frais_inscription():
    fi = f.FraisInscriptionFactory()
    with pytest.raises(IntegrityError), transaction.atomic():
        f.FraisInscriptionFactory(inscription=fi.inscription, type_frais=fi.type_frais)


def test_bourse_perimetre_defaut():
    b = f.BourseFactory()
    assert b.perimetre == "SCOLARITE_HORS_INSCRIPTION"

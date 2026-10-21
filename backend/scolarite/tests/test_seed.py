import pytest
from django.core.management import CommandError, call_command

from personnes.tests.factories import InscriptionFactory
from referentiel.models import AnneeScolaire, Classe, ModaliteFormation, Niveau, OptionFiliere
from scolarite import services
from scolarite.models import Echeance, FraisInscription, ModalitePaiement, TypeFrais

pytestmark = pytest.mark.django_db

ANNEE = "2026-2027"

# Colonne « Total » imprimée sur les affiches (barèmes de la campagne), par (école, niveau).
TOTAUX_AFFICHES = {
    ("ESSIG", "L1"): 735000,
    ("ESSIG", "L2"): 735000,
    ("ESSIG", "L3"): 735000,
    ("ESSIG", "M1"): 1550000,
    ("ESSIG", "M2"): 1550000,
    ("ESSS", "L1"): 900000,
    ("ESSS", "L2"): 940000,
    ("ESSS", "L3"): 980000,
    ("ESSS", "MP"): 2105000,
    ("CFPA", "A1"): 250000,
    ("CFPA", "A2"): 300000,
}


@pytest.fixture
def referentiel_seme():
    call_command("seed_referentiel", "--annee", ANNEE)


def _inscription(sigle_ecole, code_niveau):
    niveau = Niveau.objects.get(ecole__sigle=sigle_ecole, code=code_niveau)
    classe = Classe.objects.create(
        annee_scolaire=AnneeScolaire.objects.get(libelle=ANNEE),
        niveau=niveau,
        option_filiere=OptionFiliere.objects.filter(filiere__ecole__sigle=sigle_ecole).first(),
        modalite_formation=ModaliteFormation.objects.get(code="FI"),
        libelle_auto="test",
    )
    return InscriptionFactory(classe=classe)


def test_seed_scolarite_est_idempotent(referentiel_seme):
    call_command("seed_scolarite", "--annee", ANNEE)
    call_command("seed_scolarite", "--annee", ANNEE)

    assert ModalitePaiement.objects.count() == 11
    assert TypeFrais.objects.count() == 10


def test_seed_scolarite_donne_une_grille_a_chaque_niveau(referentiel_seme):
    call_command("seed_scolarite", "--annee", ANNEE)

    assert list(Niveau.objects.filter(modalitepaiement__isnull=True)) == []


def test_seed_scolarite_totaux_des_grilles_egaux_a_ceux_des_affiches(referentiel_seme):
    call_command("seed_scolarite", "--annee", ANNEE)

    totaux = {
        (m.niveau.ecole.sigle, m.niveau.code): m.montant_total
        for m in ModalitePaiement.objects.select_related("niveau__ecole")
    }
    assert totaux == TOTAUX_AFFICHES


@pytest.mark.parametrize(
    "sigle, code_niveau, nombre_echeances, total",
    [
        ("ESSIG", "L1", 10, 735000),
        ("ESSIG", "M2", 9, 1550000),
        ("ESSS", "MP", 17, 2105000),
        ("CFPA", "A2", 9, 300000),
    ],
)
def test_seed_scolarite_alimente_l_echeancier_d_une_inscription(
    referentiel_seme, sigle, code_niveau, nombre_echeances, total
):
    call_command("seed_scolarite", "--annee", ANNEE)
    inscription = _inscription(sigle, code_niveau)

    services.generer_echeancier(inscription)

    echeances = Echeance.objects.filter(inscription=inscription)
    montants = list(echeances.values_list("montant", flat=True))
    assert len(montants) == nombre_echeances
    assert sum(montants) == total


@pytest.mark.parametrize(
    "sigle, nombre_frais, total",
    [("ESSIG", 4, 140000), ("ESSS", 3, 120000), ("CFPA", 3, 55000)],
)
def test_seed_scolarite_facture_les_frais_annexes_propres_a_l_ecole(
    referentiel_seme, sigle, nombre_frais, total
):
    call_command("seed_scolarite", "--annee", ANNEE)
    inscription = _inscription(sigle, "L1" if sigle != "CFPA" else "A1")

    services.materialiser_frais_obligatoires(inscription)

    frais = FraisInscription.objects.filter(inscription=inscription)
    assert frais.count() == nombre_frais
    assert sum(f.montant_du for f in frais) == total


def test_seed_scolarite_ne_modifie_pas_ce_qui_a_ete_ajuste(referentiel_seme):
    call_command("seed_scolarite", "--annee", ANNEE)
    ModalitePaiement.objects.filter(niveau__ecole__sigle="ESSIG", niveau__code="L1").update(
        montant_echeance=99000
    )
    TypeFrais.objects.filter(code="TENUE-ESSIG").update(montant_defaut=95000)

    call_command("seed_scolarite", "--annee", ANNEE)

    grille = ModalitePaiement.objects.get(niveau__ecole__sigle="ESSIG", niveau__code="L1")
    assert grille.montant_echeance == 99000
    assert TypeFrais.objects.get(code="TENUE-ESSIG").montant_defaut == 95000


def test_seed_scolarite_exige_l_annee_scolaire():
    with pytest.raises(CommandError, match="seed_referentiel"):
        call_command("seed_scolarite", "--annee", ANNEE)

    assert ModalitePaiement.objects.count() == 0


def test_seed_scolarite_exige_les_niveaux_du_referentiel():
    AnneeScolaire.objects.create(libelle=ANNEE, date_debut="2026-10-01", date_fin="2027-08-31")

    with pytest.raises(CommandError, match="seed_referentiel"):
        call_command("seed_scolarite", "--annee", ANNEE)

    assert ModalitePaiement.objects.count() == 0 and TypeFrais.objects.count() == 0


def test_les_seeders_partagent_la_meme_annee_par_defaut():
    call_command("seed_referentiel")

    call_command("seed_scolarite")

    assert ModalitePaiement.objects.count() == 11

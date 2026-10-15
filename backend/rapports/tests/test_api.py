import datetime
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

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
from resultats import services
from resultats.tests.factories import DeliberationFactory
from scolarite.models import Echeance
from tresorerie.models import CategorieMouvement, Compte, Mouvement

pytestmark = pytest.mark.django_db


def _client():
    u = UtilisateurFactory()
    c = APIClient()
    c.force_authenticate(u)
    return c


def test_solde_compte_endpoint():
    from referentiel.tests.factories import AnneeScolaireFactory

    annee = AnneeScolaireFactory()
    compte = Compte.objects.create(
        code="C1", libelle="Compte test", type=Compte.Type.BANQUE, solde_initial=100_000
    )
    cat = CategorieMouvement.objects.create(code="CAT1", libelle="Catégorie", sens="ENTREE")
    Mouvement.objects.create(
        compte=compte,
        date_operation=datetime.date(2026, 1, 1),
        sens="CREDIT",
        montant=50_000,
        categorie_mouvement=cat,
        libelle="Entrée",
        annee_scolaire=annee,
        valide=True,
    )
    Mouvement.objects.create(
        compte=compte,
        date_operation=datetime.date(2026, 1, 2),
        sens="DEBIT",
        montant=20_000,
        categorie_mouvement=cat,
        libelle="Sortie",
        annee_scolaire=annee,
        valide=True,
    )

    resp = _client().get("/api/v1/rapports/solde-compte/")
    assert resp.status_code == 200
    ligne = next(r for r in resp.data if r["compte_id"] == compte.id)
    # 100_000 + 50_000 - 20_000 = 130_000
    assert Decimal(ligne["solde"]) == Decimal("130000")


def test_echeancier_calcule_reste_et_retard():
    inscription = InscriptionFactory()
    echeance = Echeance.objects.create(
        inscription=inscription,
        numero=1,
        montant=100_000,
        date_echeance=datetime.date(2020, 1, 1),  # largement passé -> en retard
    )
    resp = _client().get(f"/api/v1/rapports/echeancier/?inscription_id={inscription.id}")
    assert resp.status_code == 200
    assert len(resp.data) == 1
    ligne = resp.data[0]
    assert ligne["echeance_id"] == echeance.id
    assert Decimal(ligne["reste"]) == Decimal("100000")
    assert ligne["en_retard"] is True


def test_resultat_matiere_expose_regime_depuis_credits():
    classe = ClasseFactory()
    periode = PeriodeFactory(annee_scolaire=classe.annee_scolaire, numero=1)
    normale = SessionExamenFactory(periode=periode, type=ref_models.SessionExamen.Type.NORMALE)
    matiere = MatiereFactory(
        niveau=classe.niveau,
        option_filiere=classe.option_filiere,
        semestre=ref_models.Matiere.Semestre.S1,
        credits=6,
    )
    evaluation = EvaluationFactory(
        matiere=matiere, classe=classe, session_examen=normale, ponderation=100
    )
    inscription = InscriptionFactory(classe=classe)
    NoteEvaluationFactory(evaluation=evaluation, inscription=inscription, valeur=12)

    delib = DeliberationFactory(classe=classe, session_examen=normale, periode=periode)
    services.deliberer_session(delib.id)

    resp = _client().get(f"/api/v1/rapports/resultat-matiere/?inscription_id={inscription.id}")
    assert resp.status_code == 200
    assert len(resp.data) == 1
    ligne = resp.data[0]
    assert ligne["regime"] == "LMD"
    assert Decimal(ligne["note_retenue"]) == Decimal("12.00")
    assert ligne["validee"] is True


def test_bulletin_periode_moyenne_ponderee():
    classe = ClasseFactory()
    periode = PeriodeFactory(annee_scolaire=classe.annee_scolaire, numero=1)
    normale = SessionExamenFactory(periode=periode, type=ref_models.SessionExamen.Type.NORMALE)
    matiere1 = MatiereFactory(
        niveau=classe.niveau,
        option_filiere=classe.option_filiere,
        semestre=ref_models.Matiere.Semestre.S1,
        coefficient=2,
        credits=5,
    )
    matiere2 = MatiereFactory(
        niveau=classe.niveau,
        option_filiere=classe.option_filiere,
        semestre=ref_models.Matiere.Semestre.S1,
        coefficient=1,
        credits=3,
    )
    inscription = InscriptionFactory(classe=classe)
    for matiere, note in ((matiere1, 12), (matiere2, 6)):
        evaluation = EvaluationFactory(
            matiere=matiere, classe=classe, session_examen=normale, ponderation=100
        )
        NoteEvaluationFactory(evaluation=evaluation, inscription=inscription, valeur=note)

    delib = DeliberationFactory(classe=classe, session_examen=normale, periode=periode)
    services.deliberer_session(delib.id)

    resp = _client().get(
        f"/api/v1/rapports/bulletin-periode/?inscription_id={inscription.id}&periode_id={periode.id}"
    )
    assert resp.status_code == 200
    assert len(resp.data) == 1
    # (12*2 + 6*1) / 3 = 10
    assert Decimal(resp.data[0]["moyenne_ponderee"]) == Decimal("10.00")


def test_tableau_de_bord_scope_annee_courante():
    from referentiel.tests.factories import AnneeScolaireFactory

    annee = AnneeScolaireFactory(est_courante=True)
    autre_annee = AnneeScolaireFactory(est_courante=False)

    classe = ClasseFactory(annee_scolaire=annee)
    inscription = InscriptionFactory(classe=classe, etat="ACTIVE")
    InscriptionFactory(classe=ClasseFactory(annee_scolaire=autre_annee), etat="ACTIVE")

    Echeance.objects.create(
        inscription=inscription, numero=1, montant=100_000, date_echeance=datetime.date(2020, 1, 1)
    )

    resp = _client().get("/api/v1/rapports/tableau-de-bord/")
    assert resp.status_code == 200
    assert resp.data["annee_scolaire_id"] == annee.id
    # Seule l'inscription de l'année courante est comptée, pas celle de l'autre année.
    assert resp.data["etudiants_inscrits"] == 1
    assert Decimal(resp.data["reste_a_recouvrer"]) == Decimal("100000")
    assert resp.data["alertes"]["echeances_en_retard"] == 1


def test_resultat_annuel_apres_deliberation():
    from referentiel.tests.factories import NiveauFactory

    niveau = NiveauFactory(credits_requis=60)
    classe = ClasseFactory(niveau=niveau)
    periode1 = PeriodeFactory(annee_scolaire=classe.annee_scolaire, numero=1)
    periode2 = PeriodeFactory(annee_scolaire=classe.annee_scolaire, numero=2)
    inscription = InscriptionFactory(classe=classe)

    from resultats.models import ResultatPeriode

    ResultatPeriode.objects.create(
        inscription=inscription, periode=periode1, moyenne_ponderee=14, credits_acquis=30
    )
    ResultatPeriode.objects.create(
        inscription=inscription, periode=periode2, moyenne_ponderee=14, credits_acquis=30
    )
    services.deliberer_annee(inscription.id, classe.annee_scolaire_id)

    resp = _client().get(f"/api/v1/rapports/resultat-annuel/?inscription_id={inscription.id}")
    assert resp.status_code == 200
    assert len(resp.data) == 1
    assert resp.data[0]["decision"] == "ADMIS"

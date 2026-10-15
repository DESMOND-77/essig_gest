from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError

from evaluations.tests.factories import EvaluationFactory, NoteEvaluationFactory
from personnes.tests.factories import InscriptionFactory
from referentiel import models as ref_models
from referentiel.tests.factories import (
    ClasseFactory,
    MatiereFactory,
    NiveauFactory,
    PeriodeFactory,
    SessionExamenFactory,
)
from resultats import services
from resultats.models import (
    Deliberation,
    DetteCredit,
    ResultatAnnuel,
    ResultatMatiere,
    ResultatPeriode,
)
from resultats.tests.factories import DeliberationFactory

pytestmark = pytest.mark.django_db


# --- calculer_note_retenue (D6) ------------------------------------------------

@pytest.mark.parametrize(
    "normale, rattrapage, attendu",
    [
        (Decimal("12"), None, Decimal("12")),  # pas de rattrapage, validé direct
        (Decimal("5"), Decimal("14"), Decimal("10")),  # rattrapage plafonné à 10
        (Decimal("5"), Decimal("8"), Decimal("8")),  # rattrapage < 10 gardé tel quel
        (Decimal("5"), None, Decimal("5")),  # rattrapage absent -> 0, normale gagne
        (None, None, Decimal("0")),  # tout absent
        (Decimal("10"), Decimal("0"), Decimal("10")),  # pile la validation
    ],
)
def test_calculer_note_retenue(normale, rattrapage, attendu):
    assert services.calculer_note_retenue(normale, rattrapage) == attendu


# --- fixtures de scénario complet (classe, matières, périodes, sessions) ------

def _construire_classe_lmd(credits_requis=60):
    niveau = NiveauFactory(credits_requis=credits_requis)
    classe = ClasseFactory(niveau=niveau)
    periode = PeriodeFactory(annee_scolaire=classe.annee_scolaire, numero=1)
    normale = SessionExamenFactory(periode=periode, type=ref_models.SessionExamen.Type.NORMALE)
    matiere = MatiereFactory(
        niveau=niveau,
        option_filiere=classe.option_filiere,
        semestre=ref_models.Matiere.Semestre.S1,
        coefficient=2,
        credits=10,
    )
    return classe, periode, normale, matiere


def _noter(inscription, matiere, classe, session, valeur, bareme=20, ponderation=Decimal("100")):
    evaluation = EvaluationFactory(
        matiere=matiere,
        classe=classe,
        session_examen=session,
        bareme=bareme,
        ponderation=ponderation,
    )
    NoteEvaluationFactory(evaluation=evaluation, inscription=inscription, valeur=valeur)


# --- deliberer_session ---------------------------------------------------------

def test_deliberer_session_calcule_note_retenue_et_validation():
    classe, periode, normale, matiere = _construire_classe_lmd()
    inscription = InscriptionFactory(classe=classe)
    _noter(inscription, matiere, classe, normale, Decimal("12"))

    delib = DeliberationFactory(classe=classe, session_examen=normale, periode=periode)
    services.deliberer_session(delib.id)

    rm = ResultatMatiere.objects.get(inscription=inscription, matiere=matiere, periode=periode)
    assert rm.note_normale == Decimal("12.00")
    assert rm.note_retenue == Decimal("12.00")
    assert rm.validee is True
    assert rm.credits_acquis == 10

    delib.refresh_from_db()
    assert delib.statut == Deliberation.Statut.VALIDEE


def test_deliberer_session_note_exactement_10_est_validee():
    classe, periode, normale, matiere = _construire_classe_lmd()
    inscription = InscriptionFactory(classe=classe)
    _noter(inscription, matiere, classe, normale, Decimal("10"))

    delib = DeliberationFactory(classe=classe, session_examen=normale, periode=periode)
    services.deliberer_session(delib.id)

    rm = ResultatMatiere.objects.get(inscription=inscription, matiere=matiere, periode=periode)
    assert rm.validee is True


def test_deliberer_session_refuse_si_note_manquante_sans_absence():
    classe, periode, normale, matiere = _construire_classe_lmd()
    InscriptionFactory(classe=classe)  # aucune note, aucune évaluation créée pour cette inscription

    delib = DeliberationFactory(classe=classe, session_examen=normale, periode=periode)

    with pytest.raises(ValidationError):
        services.deliberer_session(delib.id)


def test_deliberer_session_accepte_absence_explicite():
    classe, periode, normale, matiere = _construire_classe_lmd()
    inscription = InscriptionFactory(classe=classe)
    evaluation = EvaluationFactory(
        matiere=matiere, classe=classe, session_examen=normale, ponderation=Decimal("100")
    )
    NoteEvaluationFactory(evaluation=evaluation, inscription=inscription, valeur=None, absent=True)

    delib = DeliberationFactory(classe=classe, session_examen=normale, periode=periode)
    services.deliberer_session(delib.id)  # ne doit pas lever

    rm = ResultatMatiere.objects.get(inscription=inscription, matiere=matiere, periode=periode)
    assert rm.note_normale is None
    assert rm.validee is False


def test_deliberer_session_combine_normale_et_rattrapage():
    classe, periode, normale, matiere = _construire_classe_lmd()
    rattrapage = SessionExamenFactory(
        periode=periode, type=ref_models.SessionExamen.Type.RATTRAPAGE
    )
    inscription = InscriptionFactory(classe=classe)
    _noter(inscription, matiere, classe, normale, Decimal("5"))
    _noter(inscription, matiere, classe, rattrapage, Decimal("14"))

    delib = DeliberationFactory(classe=classe, session_examen=normale, periode=periode)
    services.deliberer_session(delib.id)

    rm = ResultatMatiere.objects.get(inscription=inscription, matiere=matiere, periode=periode)
    assert rm.note_normale == Decimal("5.00")
    assert rm.note_rattrapage == Decimal("14.00")
    assert rm.note_retenue == Decimal("10.00")  # max(5, min(14,10))
    assert rm.validee is True


# --- deliberer_periode ----------------------------------------------------------

def test_deliberer_periode_moyenne_ponderee_par_coefficient():
    classe, periode, normale, matiere1 = _construire_classe_lmd()
    matiere2 = MatiereFactory(
        niveau=classe.niveau,
        option_filiere=classe.option_filiere,
        semestre=ref_models.Matiere.Semestre.S1,
        coefficient=1,
        credits=5,
    )
    inscription = InscriptionFactory(classe=classe)
    _noter(inscription, matiere1, classe, normale, Decimal("12"))  # coeff 2
    _noter(inscription, matiere2, classe, normale, Decimal("6"))  # coeff 1

    delib = DeliberationFactory(classe=classe, session_examen=normale, periode=periode)
    services.deliberer_session(delib.id)
    rp = services.deliberer_periode(inscription.id, periode.id)

    # (12*2 + 6*1) / 3 = 10
    assert rp.moyenne_ponderee == Decimal("10.00")
    assert rp.credits_acquis == 10  # seule matiere1 validée (>=10) apporte ses 10 crédits


def test_deliberer_periode_sans_resultat_matiere_leve_erreur():
    classe, periode, normale, matiere = _construire_classe_lmd()
    inscription = InscriptionFactory(classe=classe)

    with pytest.raises(ValidationError):
        services.deliberer_periode(inscription.id, periode.id)


# --- deliberer_annee : LMD (D7) --------------------------------------------------

def _resultat_periode_direct(inscription, periode, moyenne, credits_acquis):
    return ResultatPeriode.objects.create(
        inscription=inscription,
        periode=periode,
        moyenne_ponderee=moyenne,
        credits_acquis=credits_acquis,
    )


def test_deliberer_annee_lmd_60_credits_admis():
    classe, periode1, _, _ = _construire_classe_lmd(credits_requis=60)
    periode2 = PeriodeFactory(annee_scolaire=classe.annee_scolaire, numero=2)
    inscription = InscriptionFactory(classe=classe)
    _resultat_periode_direct(inscription, periode1, Decimal("14"), 30)
    _resultat_periode_direct(inscription, periode2, Decimal("14"), 30)

    ra = services.deliberer_annee(inscription.id, classe.annee_scolaire_id)

    assert ra.credits_acquis == 60
    assert ra.decision == ResultatAnnuel.Decision.ADMIS
    assert ra.dette_credits is None


def test_deliberer_annee_lmd_48_credits_admis_conditionnel_cree_dette():
    classe, periode1, _, matiere = _construire_classe_lmd(credits_requis=60)
    periode2 = PeriodeFactory(annee_scolaire=classe.annee_scolaire, numero=2)
    inscription = InscriptionFactory(classe=classe)
    _resultat_periode_direct(inscription, periode1, Decimal("11"), 24)
    _resultat_periode_direct(inscription, periode2, Decimal("11"), 24)
    # Une matière non validée de la période 1, pour vérifier la création de dette.
    autre_matiere = MatiereFactory(
        niveau=classe.niveau,
        option_filiere=classe.option_filiere,
        semestre=ref_models.Matiere.Semestre.S1,
        credits=6,
    )
    ResultatMatiere.objects.create(
        inscription=inscription,
        matiere=autre_matiere,
        periode=periode1,
        note_normale=Decimal("5"),
        note_retenue=Decimal("5"),
        credits=6,
        validee=False,
        credits_acquis=0,
    )

    ra = services.deliberer_annee(inscription.id, classe.annee_scolaire_id)

    assert ra.credits_acquis == 48
    assert ra.decision == ResultatAnnuel.Decision.ADMIS_CONDITIONNEL
    assert ra.dette_credits == 12
    assert DetteCredit.objects.filter(
        inscription_origine=inscription, matiere=autre_matiere, soldee=False
    ).exists()


def test_deliberer_annee_lmd_47_credits_redouble():
    classe, periode1, _, _ = _construire_classe_lmd(credits_requis=60)
    periode2 = PeriodeFactory(annee_scolaire=classe.annee_scolaire, numero=2)
    inscription = InscriptionFactory(classe=classe)
    _resultat_periode_direct(inscription, periode1, Decimal("8"), 23)
    _resultat_periode_direct(inscription, periode2, Decimal("8"), 24)

    ra = services.deliberer_annee(inscription.id, classe.annee_scolaire_id)

    assert ra.credits_acquis == 47
    assert ra.decision == ResultatAnnuel.Decision.REDOUBLE


def test_deliberer_annee_admis_conditionnel_interdit_si_dette_non_soldee():
    classe, periode1, _, _ = _construire_classe_lmd(credits_requis=60)
    periode2 = PeriodeFactory(annee_scolaire=classe.annee_scolaire, numero=2)
    classe_precedente = ClasseFactory(niveau=classe.niveau, option_filiere=classe.option_filiere)
    inscription_precedente = InscriptionFactory(classe=classe_precedente)

    # Dette non soldée portée par une inscription précédente (année antérieure) du
    # MÊME étudiant.
    matiere_dette = MatiereFactory(
        niveau=classe.niveau, option_filiere=classe.option_filiere, credits=4
    )
    DetteCredit.objects.create(
        inscription_origine=inscription_precedente,
        matiere=matiere_dette,
        credits=4,
        annee_origine=classe_precedente.annee_scolaire,
        soldee=False,
    )

    inscription = InscriptionFactory(classe=classe, etudiant=inscription_precedente.etudiant)
    _resultat_periode_direct(inscription, periode1, Decimal("11"), 24)
    _resultat_periode_direct(inscription, periode2, Decimal("11"), 24)

    ra = services.deliberer_annee(inscription.id, classe.annee_scolaire_id)

    # 48 crédits normalement -> ADMIS_CONDITIONNEL, mais forcé REDOUBLE par la dette.
    assert ra.decision == ResultatAnnuel.Decision.REDOUBLE


def test_deliberer_annee_solde_dette_quand_matiere_revalidee():
    classe, periode1, normale, matiere_dette = _construire_classe_lmd(credits_requis=60)
    periode2 = PeriodeFactory(annee_scolaire=classe.annee_scolaire, numero=2)
    classe_precedente = ClasseFactory(niveau=classe.niveau, option_filiere=classe.option_filiere)
    inscription_precedente = InscriptionFactory(classe=classe_precedente)
    dette = DetteCredit.objects.create(
        inscription_origine=inscription_precedente,
        matiere=matiere_dette,
        credits=10,
        annee_origine=classe_precedente.annee_scolaire,
        soldee=False,
    )

    inscription = InscriptionFactory(classe=classe, etudiant=inscription_precedente.etudiant)
    _noter(inscription, matiere_dette, classe, normale, Decimal("15"))
    delib = DeliberationFactory(classe=classe, session_examen=normale, periode=periode1)
    services.deliberer_session(delib.id)
    services.deliberer_periode(inscription.id, periode1.id)
    _resultat_periode_direct(inscription, periode2, Decimal("15"), 30)

    services.deliberer_annee(inscription.id, classe.annee_scolaire_id)

    dette.refresh_from_db()
    assert dette.soldee is True
    assert dette.inscription_solde == inscription


# --- deliberer_annee : CFPA classique (D8) --------------------------------------

def test_deliberer_annee_classique_moyenne_10_pile_admis():
    niveau = NiveauFactory(credits_requis=None)
    classe = ClasseFactory(niveau=niveau)
    classe.niveau.ecole.regime = "CLASSIQUE"
    classe.niveau.ecole.save()
    periode1 = PeriodeFactory(annee_scolaire=classe.annee_scolaire, numero=1)
    periode2 = PeriodeFactory(annee_scolaire=classe.annee_scolaire, numero=2)
    inscription = InscriptionFactory(classe=classe, ecole=classe.niveau.ecole)
    _resultat_periode_direct(inscription, periode1, Decimal("10"), None)
    _resultat_periode_direct(inscription, periode2, Decimal("10"), None)

    ra = services.deliberer_annee(inscription.id, classe.annee_scolaire_id)

    assert ra.regime == "CLASSIQUE"
    assert ra.decision == ResultatAnnuel.Decision.ADMIS
    assert ra.credits_acquis is None


def test_deliberer_annee_classique_moyenne_9_99_redouble():
    niveau = NiveauFactory(credits_requis=None)
    classe = ClasseFactory(niveau=niveau)
    classe.niveau.ecole.regime = "CLASSIQUE"
    classe.niveau.ecole.save()
    periode1 = PeriodeFactory(annee_scolaire=classe.annee_scolaire, numero=1)
    periode2 = PeriodeFactory(annee_scolaire=classe.annee_scolaire, numero=2)
    inscription = InscriptionFactory(classe=classe, ecole=classe.niveau.ecole)
    _resultat_periode_direct(inscription, periode1, Decimal("9.99"), None)
    _resultat_periode_direct(inscription, periode2, Decimal("9.99"), None)

    ra = services.deliberer_annee(inscription.id, classe.annee_scolaire_id)

    assert ra.decision == ResultatAnnuel.Decision.REDOUBLE


# --- mentions --------------------------------------------------------------------

@pytest.mark.parametrize(
    "moyenne, mention",
    [
        (Decimal("9.99"), None),
        (Decimal("10"), ResultatAnnuel.Mention.PASSABLE),
        (Decimal("12"), ResultatAnnuel.Mention.AB),
        (Decimal("14"), ResultatAnnuel.Mention.B),
        (Decimal("16"), ResultatAnnuel.Mention.TB),
    ],
)
def test_mention_aux_4_seuils(moyenne, mention):
    niveau = NiveauFactory(credits_requis=None)
    classe = ClasseFactory(niveau=niveau)
    classe.niveau.ecole.regime = "CLASSIQUE"
    classe.niveau.ecole.save()
    periode1 = PeriodeFactory(annee_scolaire=classe.annee_scolaire, numero=1)
    periode2 = PeriodeFactory(annee_scolaire=classe.annee_scolaire, numero=2)
    inscription = InscriptionFactory(classe=classe, ecole=classe.niveau.ecole)
    _resultat_periode_direct(inscription, periode1, moyenne, None)
    _resultat_periode_direct(inscription, periode2, moyenne, None)

    ra = services.deliberer_annee(inscription.id, classe.annee_scolaire_id)

    assert ra.mention == mention

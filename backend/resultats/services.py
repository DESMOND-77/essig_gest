# backend/resultats/services.py
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from evaluations.models import NoteEvaluation
from evaluations.services import calculer_note_matiere_session
from personnes.models import Inscription
from referentiel.models import Matiere, SessionExamen

from .models import Deliberation, DetteCredit, ResultatAnnuel, ResultatMatiere, ResultatPeriode

SEUIL_VALIDATION = Decimal("10")
CREDITS_REQUIS_LMD = 60
SEUIL_ADMIS_CONDITIONNEL = 48


def calculer_note_retenue(note_normale, note_rattrapage):
    """D6 : note_retenue = max(note_normale, min(note_rattrapage, 10)).

    `None` est traité comme 0 des deux côtés (une absence totale donne 0, pas une
    erreur ici — la détection des trous de saisie est faite en amont par
    `deliberer_session`, pas par cette fonction purement arithmétique).
    """
    normale = note_normale if note_normale is not None else Decimal("0")
    if note_rattrapage is not None:
        rattrapage = min(note_rattrapage, Decimal("10"))
    else:
        rattrapage = Decimal("0")
    return max(normale, rattrapage)


def _matieres_de_la_periode(classe, periode):
    semestre = Matiere.Semestre.S1 if periode.numero == 1 else Matiere.Semestre.S2
    return Matiere.objects.filter(
        niveau=classe.niveau, option_filiere=classe.option_filiere, semestre=semestre
    )


@transaction.atomic
def deliberer_session(deliberation_id):
    """Calcule `ResultatMatiere` pour chaque (inscription, matière) de la classe/
    périodе de la délibération, à partir des sessions NORMALE et RATTRAPAGE de cette
    période (indépendamment de la session propre portée par la délibération, qui ne
    sert qu'à identifier le jury/la date — choix documenté, le mandat ne tranchait
    pas explicitement ce point). Lève une erreur listant les (inscription, matière)
    sans aucune note normale et sans marque d'absence explicite, plutôt que de
    calculer avec des trous silencieux.
    """
    delib = Deliberation.objects.select_related("classe", "periode").get(pk=deliberation_id)
    if delib.periode is None:
        raise ValidationError(
            "Une délibération de matières doit porter une période (la délibération "
            "annuelle, elle, n'a pas de période)."
        )

    normale = SessionExamen.objects.filter(
        periode=delib.periode, type=SessionExamen.Type.NORMALE
    ).first()
    rattrapage = SessionExamen.objects.filter(
        periode=delib.periode, type=SessionExamen.Type.RATTRAPAGE
    ).first()
    if normale is None:
        raise ValidationError("Aucune session NORMALE définie pour cette période.")

    matieres = list(_matieres_de_la_periode(delib.classe, delib.periode))
    inscriptions = list(Inscription.objects.filter(classe=delib.classe))

    manquants = []
    resultats_a_creer = []
    for inscription in inscriptions:
        for matiere in matieres:
            a_une_note_normale = NoteEvaluation.objects.filter(
                inscription=inscription,
                evaluation__matiere=matiere,
                evaluation__session_examen=normale,
            ).exists()
            if not a_une_note_normale:
                manquants.append(f"{inscription} / {matiere}")
                continue

            note_normale = calculer_note_matiere_session(
                inscription_id=inscription.id,
                matiere_id=matiere.id,
                session_examen_id=normale.id,
            )
            note_rattrapage = (
                calculer_note_matiere_session(
                    inscription_id=inscription.id,
                    matiere_id=matiere.id,
                    session_examen_id=rattrapage.id,
                )
                if rattrapage is not None
                else None
            )
            note_retenue = calculer_note_retenue(note_normale, note_rattrapage)
            validee = note_retenue >= SEUIL_VALIDATION
            credits = matiere.credits
            credits_acquis = (credits if validee else 0) if credits is not None else None

            resultats_a_creer.append(
                (inscription, matiere, delib.periode, note_normale, note_rattrapage,
                 note_retenue, credits, validee, credits_acquis)
            )

    if manquants:
        raise ValidationError(
            "Notes manquantes (ni note normale, ni marque d'absence) pour : "
            + ", ".join(manquants)
        )

    for (inscription, matiere, periode, note_normale, note_rattrapage,
         note_retenue, credits, validee, credits_acquis) in resultats_a_creer:
        ResultatMatiere.objects.update_or_create(
            inscription=inscription,
            matiere=matiere,
            periode=periode,
            defaults={
                "note_normale": note_normale,
                "note_rattrapage": note_rattrapage,
                "note_retenue": note_retenue,
                "credits": credits,
                "validee": validee,
                "credits_acquis": credits_acquis,
                "deliberation": delib,
            },
        )

    delib.statut = Deliberation.Statut.VALIDEE
    delib.save(update_fields=["statut"])
    return delib


@transaction.atomic
def deliberer_periode(inscription_id, periode_id):
    resultats = list(
        ResultatMatiere.objects.filter(inscription_id=inscription_id, periode_id=periode_id)
        .select_related("matiere")
    )
    if not resultats:
        raise ValidationError(
            "Aucun résultat de matière calculé pour cette (inscription, période) — "
            "déliberer la session d'abord."
        )

    total_pondere = sum(r.note_retenue * r.matiere.coefficient for r in resultats)
    total_coefficients = sum(r.matiere.coefficient for r in resultats)
    moyenne_ponderee = (total_pondere / total_coefficients).quantize(Decimal("0.01"))

    credits_lmd = any(r.credits is not None for r in resultats)
    credits_acquis = (
        sum(r.credits_acquis or 0 for r in resultats) if credits_lmd else None
    )

    resultat_periode, _ = ResultatPeriode.objects.update_or_create(
        inscription_id=inscription_id,
        periode_id=periode_id,
        defaults={"moyenne_ponderee": moyenne_ponderee, "credits_acquis": credits_acquis},
    )
    return resultat_periode


def _calculer_mention(moyenne_annuelle):
    if moyenne_annuelle >= Decimal("16"):
        return ResultatAnnuel.Mention.TB
    if moyenne_annuelle >= Decimal("14"):
        return ResultatAnnuel.Mention.B
    if moyenne_annuelle >= Decimal("12"):
        return ResultatAnnuel.Mention.AB
    if moyenne_annuelle >= SEUIL_VALIDATION:
        return ResultatAnnuel.Mention.PASSABLE
    return None


@transaction.atomic
def deliberer_annee(inscription_id, annee_scolaire_id, *, valide_par=None):
    inscription = Inscription.objects.select_related("ecole", "etudiant", "classe__niveau").get(
        pk=inscription_id
    )
    regime = inscription.ecole.regime  # "LMD" ou "CLASSIQUE"

    periodes_resultats = list(
        ResultatPeriode.objects.filter(
            inscription_id=inscription_id, periode__annee_scolaire_id=annee_scolaire_id
        )
    )
    if not periodes_resultats:
        raise ValidationError(
            "Aucun résultat de période calculé pour cette inscription/année — "
            "déliberer les périodes d'abord."
        )

    moyenne_annuelle = (
        sum(rp.moyenne_ponderee for rp in periodes_resultats) / len(periodes_resultats)
    ).quantize(Decimal("0.01"))
    mention = _calculer_mention(moyenne_annuelle)

    credits_acquis = None
    credits_requis = None
    dette_credits = None

    if regime == "LMD":
        credits_requis = inscription.classe.niveau.credits_requis or CREDITS_REQUIS_LMD
        credits_acquis = sum(rp.credits_acquis or 0 for rp in periodes_resultats)

        dette_non_soldee_existante = DetteCredit.objects.filter(
            inscription_origine__etudiant=inscription.etudiant, soldee=False
        ).exclude(inscription_origine=inscription).exists()

        if credits_acquis >= credits_requis:
            decision = ResultatAnnuel.Decision.ADMIS
        elif credits_acquis >= SEUIL_ADMIS_CONDITIONNEL:
            if dette_non_soldee_existante:
                decision = ResultatAnnuel.Decision.REDOUBLE
            else:
                decision = ResultatAnnuel.Decision.ADMIS_CONDITIONNEL
                dette_credits = credits_requis - credits_acquis
        else:
            decision = ResultatAnnuel.Decision.REDOUBLE
    else:
        decision = (
            ResultatAnnuel.Decision.ADMIS
            if moyenne_annuelle >= SEUIL_VALIDATION
            else ResultatAnnuel.Decision.REDOUBLE
        )

    resultat_annuel, _ = ResultatAnnuel.objects.update_or_create(
        inscription_id=inscription_id,
        defaults={
            "annee_scolaire_id": annee_scolaire_id,
            "regime": regime,
            "moyenne_annuelle": moyenne_annuelle,
            "credits_acquis": credits_acquis,
            "credits_requis": credits_requis,
            "dette_credits": dette_credits,
            "decision": decision,
            "mention": mention,
            "deliberee_le": timezone.now(),
            "deliberee_par_id": valide_par,
        },
    )

    if regime == "LMD":
        _solder_dettes_revalidees(inscription, annee_scolaire_id)
        if decision == ResultatAnnuel.Decision.ADMIS_CONDITIONNEL:
            _creer_dettes_matieres_non_validees(inscription, annee_scolaire_id)

    return resultat_annuel


def _solder_dettes_revalidees(inscription, annee_scolaire_id):
    """Marque soldée toute dette (de n'importe quelle inscription d'origine de cet
    étudiant) dont la matière vient d'être validée cette année."""
    matieres_validees = ResultatMatiere.objects.filter(
        inscription=inscription, periode__annee_scolaire_id=annee_scolaire_id, validee=True
    ).values_list("matiere_id", flat=True)

    DetteCredit.objects.filter(
        inscription_origine__etudiant=inscription.etudiant,
        matiere_id__in=list(matieres_validees),
        soldee=False,
    ).update(soldee=True, inscription_solde=inscription)


def _creer_dettes_matieres_non_validees(inscription, annee_scolaire_id):
    non_validees = ResultatMatiere.objects.filter(
        inscription=inscription,
        periode__annee_scolaire_id=annee_scolaire_id,
        validee=False,
        credits__isnull=False,
    ).select_related("matiere")

    for rm in non_validees:
        deja_couverte = DetteCredit.objects.filter(
            inscription_origine__etudiant=inscription.etudiant,
            matiere=rm.matiere,
            soldee=False,
        ).exists()
        if not deja_couverte:
            DetteCredit.objects.create(
                inscription_origine=inscription,
                matiere=rm.matiere,
                credits=rm.credits,
                annee_origine_id=annee_scolaire_id,
            )

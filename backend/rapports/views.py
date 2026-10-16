# backend/rapports/views.py
"""Phase 11 — Rapporting.

Chaque fonction réplique une vue SQL de référence (`db/migrations/008_vues.sql`) via
l'ORM Django plutôt que via une vraie vue MySQL (cf. plan Tâche 3 : Django est la
source de vérité de l'application qui tourne, pas question de dupliquer la logique
dans une vue physique non gérée par les migrations Django).

Toutes les routes sont en lecture seule (GET), RBAC = authentifié.
"""
from datetime import date

from django.db.models import Case, Count, DecimalField, F, Q, Sum, Value, When
from django.db.models.functions import Coalesce
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.pdf import render_pdf
from personnes.models import Etudiant, Inscription
from referentiel.models import AnneeScolaire
from resultats.models import ResultatAnnuel, ResultatMatiere
from rh_paie.models import AffectationEnseignement, SalaireAdministration, SalaireEnseignant
from scolarite.models import Echeance, FraisInscription
from tresorerie.models import (
    ArreteCaisse,
    Billetage,
    Compte,
    Depense,
    Encaissement,
    ImputationEncaissement,
    Mouvement,
)

# `montant` est un DecimalField(12,0) sur la quasi-totalité des modèles financiers :
# `Coalesce(Sum(...), Value(0))` lève FieldError ("mixed types Decimal/Integer") sans
# output_field explicite sur le zéro de repli.
ZERO_FCFA = Value(0, output_field=DecimalField(max_digits=14, decimal_places=2))


def _montant_encaisse_echeance(echeance_id):
    return (
        ImputationEncaissement.objects.filter(
            cible=ImputationEncaissement.Cible.ECHEANCE, echeance_id=echeance_id
        ).aggregate(total=Coalesce(Sum("montant"), ZERO_FCFA))["total"]
    )


@extend_schema(
    tags=["rapports"],
    parameters=[OpenApiParameter("inscription_id", OpenApiTypes.INT, required=False)],
    responses=OpenApiTypes.OBJECT,
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def situation_scolarite(request):
    """v_situation_scolarite : reste à payer de scolarité par inscription."""
    qs = Inscription.objects.all()
    inscription_id = request.query_params.get("inscription_id")
    if inscription_id:
        qs = qs.filter(pk=inscription_id)

    resultats = [
        situation_scolarite_ligne(inscription)
        for inscription in qs.select_related("etudiant", "classe__niveau")
    ]
    return Response(resultats)


def situation_scolarite_ligne(inscription):
    """Ligne v_situation_scolarite pour une inscription (réutilisée par la fiche PDF)."""
    part_etudiant = (
        Echeance.objects.filter(inscription=inscription)
        .aggregate(total=Coalesce(Sum("montant"), ZERO_FCFA))["total"]
    )
    total_encaisse = (
        ImputationEncaissement.objects.filter(
            cible=ImputationEncaissement.Cible.ECHEANCE,
            echeance__inscription=inscription,
        ).aggregate(total=Coalesce(Sum("montant"), ZERO_FCFA))["total"]
    )
    reste = part_etudiant - total_encaisse
    if total_encaisse >= part_etudiant and part_etudiant > 0:
        etat = "SOLDE"
    elif total_encaisse > 0:
        etat = "PARTIEL"
    else:
        etat = "A_JOUR"
    return {
        "inscription_id": inscription.id,
        "etudiant_id": inscription.etudiant_id,
        "ecole_id": inscription.ecole_id,
        "annee_scolaire_id": inscription.annee_scolaire_id,
        "cout_du": part_etudiant,
        "part_etudiant": part_etudiant,
        "total_encaisse": total_encaisse,
        "reste": reste,
        "etat": etat,
    }


@extend_schema(
    tags=["rapports"],
    parameters=[OpenApiParameter("inscription_id", OpenApiTypes.INT, required=True)],
    responses=OpenApiTypes.BINARY,
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def fiche_scolarite_pdf(request):
    """Fiche de scolarité PDF d'une inscription (situation de paiement, reste à payer)."""
    inscription_id = request.query_params.get("inscription_id")
    inscription = get_object_or_404(
        Inscription.objects.select_related(
            "etudiant", "classe__niveau", "annee_scolaire", "ecole"
        ),
        pk=inscription_id,
    )
    situation = situation_scolarite_ligne(inscription)
    echeances = Echeance.objects.filter(inscription=inscription).order_by("numero")
    echeances_detail = [
        {
            "numero": e.numero,
            "date_echeance": e.date_echeance,
            "montant": e.montant,
            "encaisse": _montant_encaisse_echeance(e.id),
            "statut": e.get_statut_display(),
        }
        for e in echeances
    ]
    pdf_bytes = render_pdf(
        "pdf/fiche_scolarite.html",
        {
            "inscription": inscription,
            "situation": situation,
            "echeances": echeances_detail,
            "date_generation": date.today(),
        },
    )
    disposition = request.query_params.get("disposition", "inline")
    disposition = "attachment" if disposition == "attachment" else "inline"
    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = (
        f'{disposition}; filename="fiche_scolarite_{inscription.id}.pdf"'
    )
    return response


@extend_schema(
    tags=["rapports"],
    parameters=[OpenApiParameter("inscription_id", OpenApiTypes.INT, required=False)],
    responses=OpenApiTypes.OBJECT,
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def situation_frais(request):
    """v_situation_frais : reste à payer par (inscription, frais annexe)."""
    inscription_id = request.query_params.get("inscription_id")
    qs = FraisInscription.objects.select_related("inscription", "type_frais")
    if inscription_id:
        qs = qs.filter(inscription_id=inscription_id)

    resultats = []
    for f in qs:
        paye = (
            ImputationEncaissement.objects.filter(
                cible=ImputationEncaissement.Cible.FRAIS, frais_inscription=f
            ).aggregate(total=Coalesce(Sum("montant"), ZERO_FCFA))["total"]
        )
        reste = 0 if f.exonere else f.montant_du - paye
        etat = (
            "EXONERE" if f.exonere
            else "SOLDE" if paye >= f.montant_du
            else "PARTIEL" if paye > 0
            else "NON"
        )
        resultats.append(
            {
                "frais_inscription_id": f.id,
                "inscription_id": f.inscription_id,
                "montant_du": f.montant_du,
                "paye": paye,
                "reste": reste,
                "etat": etat,
            }
        )
    return Response(resultats)


@extend_schema(
    tags=["rapports"],
    parameters=[OpenApiParameter("inscription_id", OpenApiTypes.INT, required=False)],
    responses=OpenApiTypes.OBJECT,
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def echeancier(request):
    """v_echeancier : échéancier détaillé avec reste et retard."""
    qs = Echeance.objects.select_related("inscription")
    inscription_id = request.query_params.get("inscription_id")
    if inscription_id:
        qs = qs.filter(inscription_id=inscription_id)

    aujourdhui = date.today()
    resultats = []
    for e in qs:
        montant_regle = _montant_encaisse_echeance(e.id)
        reste = e.montant - montant_regle
        en_retard = aujourdhui > e.date_echeance and reste > 0
        resultats.append(
            {
                "echeance_id": e.id,
                "inscription_id": e.inscription_id,
                "numero": e.numero,
                "montant_prevu": e.montant,
                "date_prevue": e.date_echeance,
                "montant_regle": montant_regle,
                "reste": reste,
                "en_retard": en_retard,
            }
        )
    return Response(resultats)


@extend_schema(tags=["rapports"], responses=OpenApiTypes.OBJECT)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def solde_compte(request):
    """v_solde_compte : solde initial + crédits validés - débits validés."""
    comptes = Compte.objects.annotate(
        credits=Coalesce(
            Sum("mouvement__montant", filter=Q(mouvement__sens="CREDIT", mouvement__valide=True)),
            ZERO_FCFA,
        ),
        debits=Coalesce(
            Sum("mouvement__montant", filter=Q(mouvement__sens="DEBIT", mouvement__valide=True)),
            ZERO_FCFA,
        ),
    )
    resultats = [
        {
            "compte_id": c.id,
            "code": c.code,
            "libelle": c.libelle,
            "type": c.type,
            "solde": c.solde_initial + c.credits - c.debits,
        }
        for c in comptes
    ]
    return Response(resultats)


@extend_schema(
    tags=["rapports"],
    parameters=[
        OpenApiParameter("ecole_id", OpenApiTypes.INT, required=False),
        OpenApiParameter("annee_scolaire_id", OpenApiTypes.INT, required=False),
    ],
    responses=OpenApiTypes.OBJECT,
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def bilan_mensuel(request):
    """v_bilan_mensuel : entrées/dépenses/solde par (école, année, mois)."""
    return Response(_bilan_mensuel_donnees(request))


def _bilan_mensuel_donnees(request):
    """Calcul brut réutilisé par `bilan_mensuel` et `bilan_consolide` (évite d'invoquer
    une vue DRF décorée depuis une autre vue)."""
    qs = Mouvement.objects.filter(valide=True).select_related("categorie_mouvement")
    ecole_id = request.query_params.get("ecole_id")
    annee_scolaire_id = request.query_params.get("annee_scolaire_id")
    if ecole_id:
        qs = qs.filter(ecole_id=ecole_id)
    if annee_scolaire_id:
        qs = qs.filter(annee_scolaire_id=annee_scolaire_id)

    qs = qs.annotate(
        annee=F("date_operation__year"), mois=F("date_operation__month")
    ).values("ecole_id", "annee_scolaire_id", "annee", "mois").annotate(
        entrees=Coalesce(
            Sum("montant", filter=Q(categorie_mouvement__sens="ENTREE", sens="CREDIT")),
            ZERO_FCFA,
        ),
        depenses=Coalesce(
            Sum("montant", filter=Q(categorie_mouvement__sens="SORTIE", sens="DEBIT")),
            ZERO_FCFA,
        ),
        solde=Coalesce(
            Sum(Case(When(sens="CREDIT", then=F("montant")), default=-F("montant"))),
            ZERO_FCFA,
        ),
    ).order_by("ecole_id", "annee", "mois")
    return list(qs)


@extend_schema(
    tags=["rapports"],
    parameters=[OpenApiParameter("annee_scolaire_id", OpenApiTypes.INT, required=False)],
    responses=OpenApiTypes.OBJECT,
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def bilan_consolide(request):
    """v_bilan_consolide : v_bilan_mensuel consolidé toutes écoles confondues."""
    return Response(_bilan_consolide_donnees(request))


def _bilan_consolide_donnees(request):
    agrege = {}
    for ligne in _bilan_mensuel_donnees(request):
        cle = (ligne["annee_scolaire_id"], ligne["annee"], ligne["mois"])
        acc = agrege.setdefault(
            cle,
            {
                "annee_scolaire_id": cle[0],
                "annee": cle[1],
                "mois": cle[2],
                "entrees": 0,
                "depenses": 0,
                "solde": 0,
            },
        )
        acc["entrees"] += ligne["entrees"]
        acc["depenses"] += ligne["depenses"]
        acc["solde"] += ligne["solde"]
    return sorted(agrege.values(), key=lambda r: (r["annee"], r["mois"]))


@extend_schema(
    tags=["rapports"],
    parameters=[
        OpenApiParameter("ecole_id", OpenApiTypes.INT, required=False),
        OpenApiParameter("annee_scolaire_id", OpenApiTypes.INT, required=False),
        OpenApiParameter("consolide", OpenApiTypes.BOOL, required=False),
        OpenApiParameter("disposition", OpenApiTypes.STR, required=False),
    ],
    responses=OpenApiTypes.BINARY,
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def etat_financier_pdf(request):
    """État financier PDF (bilan mensuel ou consolidé) — réutilise les calculs de
    `bilan_mensuel`/`bilan_consolide`."""
    consolide = request.query_params.get("consolide") == "true"
    lignes = _bilan_consolide_donnees(request) if consolide else _bilan_mensuel_donnees(request)

    pdf_bytes = render_pdf(
        "pdf/etat_financier.html",
        {
            "lignes": lignes,
            "consolide": consolide,
            "date_generation": date.today(),
        },
    )
    disposition = request.query_params.get("disposition", "inline")
    disposition = "attachment" if disposition == "attachment" else "inline"
    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    nom = "etat_financier_consolide" if consolide else "etat_financier_mensuel"
    response["Content-Disposition"] = f'{disposition}; filename="{nom}.pdf"'
    return response


def _situation_scolarite_donnees(request):
    qs = Inscription.objects.all()
    inscription_id = request.query_params.get("inscription_id")
    if inscription_id:
        qs = qs.filter(pk=inscription_id)

    resultats = []
    for inscription in qs.select_related("etudiant", "classe__niveau"):
        part_etudiant = (
            Echeance.objects.filter(inscription=inscription)
            .aggregate(total=Coalesce(Sum("montant"), ZERO_FCFA))["total"]
        )
        total_encaisse = (
            ImputationEncaissement.objects.filter(
                cible=ImputationEncaissement.Cible.ECHEANCE,
                echeance__inscription=inscription,
            ).aggregate(total=Coalesce(Sum("montant"), ZERO_FCFA))["total"]
        )
        resultats.append(
            {
                "inscription_id": inscription.id,
                "cout_du": part_etudiant,
                "part_etudiant": part_etudiant,
                "total_encaisse": total_encaisse,
                "reste": part_etudiant - total_encaisse,
            }
        )
    return resultats


def _situation_frais_donnees(request):
    inscription_id = request.query_params.get("inscription_id")
    qs = FraisInscription.objects.all()
    if inscription_id:
        qs = qs.filter(inscription_id=inscription_id)

    resultats = []
    for f in qs:
        if f.exonere:
            resultats.append({"inscription_id": f.inscription_id, "reste": 0})
            continue
        paye = (
            ImputationEncaissement.objects.filter(
                cible=ImputationEncaissement.Cible.FRAIS, frais_inscription=f
            ).aggregate(total=Coalesce(Sum("montant"), ZERO_FCFA))["total"]
        )
        resultats.append({"inscription_id": f.inscription_id, "reste": f.montant_du - paye})
    return resultats


@extend_schema(
    tags=["rapports"],
    parameters=[OpenApiParameter("inscription_id", OpenApiTypes.INT, required=False)],
    responses=OpenApiTypes.OBJECT,
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def etat_scolarite_etudiant(request):
    """v_etat_scolarite_etudiant : état imprimable (scolarité + frais + reste total)."""
    scolarite = _situation_scolarite_donnees(request)
    frais = _situation_frais_donnees(request)
    frais_par_inscription = {}
    for f in frais:
        frais_par_inscription.setdefault(f["inscription_id"], []).append(f["reste"])

    etudiants = {e.id: e for e in Etudiant.objects.all()}
    inscriptions = {i.id: i for i in Inscription.objects.all()}

    resultats = []
    for s in scolarite:
        reste_frais = sum(frais_par_inscription.get(s["inscription_id"], []))
        inscription = inscriptions.get(s["inscription_id"])
        etudiant = etudiants.get(inscription.etudiant_id) if inscription else None
        resultats.append(
            {
                "inscription_id": s["inscription_id"],
                "matricule": etudiant.matricule if etudiant else None,
                "etudiant": f"{etudiant.nom} {etudiant.prenoms}" if etudiant else None,
                "cout_du": s["cout_du"],
                "part_etudiant": s["part_etudiant"],
                "total_encaisse": s["total_encaisse"],
                "reste_scolarite": s["reste"],
                "reste_frais": reste_frais,
                "reste_total": s["reste"] + reste_frais,
            }
        )
    return Response(resultats)


@extend_schema(
    tags=["rapports"],
    parameters=[
        OpenApiParameter("inscription_id", OpenApiTypes.INT, required=False),
        OpenApiParameter("periode_id", OpenApiTypes.INT, required=False),
    ],
    responses=OpenApiTypes.OBJECT,
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def resultat_matiere(request):
    """v_resultat_matiere : ré-expose resultat_matiere + régime lisible."""
    qs = ResultatMatiere.objects.select_related("inscription", "matiere", "periode")
    inscription_id = request.query_params.get("inscription_id")
    periode_id = request.query_params.get("periode_id")
    if inscription_id:
        qs = qs.filter(inscription_id=inscription_id)
    if periode_id:
        qs = qs.filter(periode_id=periode_id)
    resultats = [
        {
            "id": r.id,
            "inscription_id": r.inscription_id,
            "matiere_id": r.matiere_id,
            "periode_id": r.periode_id,
            "note_normale": r.note_normale,
            "note_rattrapage": r.note_rattrapage,
            "note_retenue": r.note_retenue,
            "credits": r.credits,
            "validee": r.validee,
            "credits_acquis": r.credits_acquis,
            "regime": "CLASSIQUE" if r.credits is None else "LMD",
        }
        for r in qs
    ]
    return Response(resultats)


def calculer_bulletin_periode(inscription_id=None, periode_id=None):
    """v_bulletin_periode : moyenne pondérée par (inscription, période).

    Logique de calcul partagée entre `bulletin_periode` (JSON) et la génération
    PDF du bulletin (`resultats.views.ResultatAnnuelViewSet.bulletin`).
    """
    qs = ResultatMatiere.objects.select_related("matiere")
    if inscription_id:
        qs = qs.filter(inscription_id=inscription_id)
    if periode_id:
        qs = qs.filter(periode_id=periode_id)

    qs = qs.values("inscription_id", "periode_id").annotate(
        total_pondere=Sum(
            F("note_retenue") * F("matiere__coefficient"),
            output_field=DecimalField(max_digits=10, decimal_places=2),
        ),
        total_coefficients=Sum("matiere__coefficient"),
        credits_acquis=Coalesce(Sum("credits_acquis"), Value(0)),
        nb_matieres=Count("id"),
        nb_matieres_validees=Coalesce(Sum(Case(When(validee=True, then=1), default=0)), Value(0)),
    )
    resultats = []
    for r in qs:
        moyenne = None
        if r["total_coefficients"]:
            moyenne = round(r["total_pondere"] / r["total_coefficients"], 2)
        resultats.append(
            {
                "inscription_id": r["inscription_id"],
                "periode_id": r["periode_id"],
                "moyenne_ponderee": moyenne,
                "credits_acquis": r["credits_acquis"],
                "nb_matieres": r["nb_matieres"],
                "nb_matieres_validees": r["nb_matieres_validees"],
            }
        )
    return resultats


@extend_schema(
    tags=["rapports"],
    parameters=[
        OpenApiParameter("inscription_id", OpenApiTypes.INT, required=False),
        OpenApiParameter("periode_id", OpenApiTypes.INT, required=False),
    ],
    responses=OpenApiTypes.OBJECT,
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def bulletin_periode(request):
    """v_bulletin_periode : moyenne pondérée par (inscription, période)."""
    resultats = calculer_bulletin_periode(
        inscription_id=request.query_params.get("inscription_id"),
        periode_id=request.query_params.get("periode_id"),
    )
    return Response(resultats)


@extend_schema(
    tags=["rapports"],
    parameters=[
        OpenApiParameter("inscription_id", OpenApiTypes.INT, required=False),
        OpenApiParameter("annee_scolaire_id", OpenApiTypes.INT, required=False),
    ],
    responses=OpenApiTypes.OBJECT,
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def resultat_annuel(request):
    """v_resultat_annuel : ré-expose resultat_annuel."""
    qs = ResultatAnnuel.objects.all()
    inscription_id = request.query_params.get("inscription_id")
    annee_scolaire_id = request.query_params.get("annee_scolaire_id")
    if inscription_id:
        qs = qs.filter(inscription_id=inscription_id)
    if annee_scolaire_id:
        qs = qs.filter(annee_scolaire_id=annee_scolaire_id)
    resultats = [
        {
            "inscription_id": r.inscription_id,
            "annee_scolaire_id": r.annee_scolaire_id,
            "regime": r.regime,
            "moyenne_annuelle": r.moyenne_annuelle,
            "credits_acquis": r.credits_acquis,
            "credits_requis": r.credits_requis,
            "dette_credits": r.dette_credits,
            "decision": r.decision,
            "mention": r.mention,
        }
        for r in qs
    ]
    return Response(resultats)


@extend_schema(
    tags=["rapports"],
    parameters=[OpenApiParameter("annee_scolaire_id", OpenApiTypes.INT, required=False)],
    responses=OpenApiTypes.OBJECT,
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def masse_salariale(request):
    """v_masse_salariale : masse salariale enseignants + administration.

    Limite connue : `SalaireEnseignant.mouvement` est un `BigIntegerField` brut (pas
    une vraie FK, cf. commentaire dans rh_paie/models.py), et `Compte` ne porte pas
    de FK `ecole` (retirée avec GroupeScolaire sans remplacement, cf. l'audit du
    2026-10-14). La vue SQL de référence regroupe par école via ce chaînage
    mouvement -> ecole, impossible à répliquer fidèlement en l'état : les salaires
    enseignants sont donc agrégés sans `ecole_id` (seulement par année/mois) ; seuls
    les salaires administration, dont `PersonnelAdministratif.ecole` est une vraie
    FK, sont ventilés par école.
    """
    annee_scolaire_id = request.query_params.get("annee_scolaire_id")

    qs_ens = SalaireEnseignant.objects.all()
    if annee_scolaire_id:
        qs_ens = qs_ens.filter(annee_scolaire_id=annee_scolaire_id)
    enseignant = list(
        qs_ens.values("annee_scolaire_id", "mois")
        .annotate(montant=Sum("montant"))
        .order_by("annee_scolaire_id", "mois")
    )
    for r in enseignant:
        r["ecole_id"] = None
        r["categorie"] = "ENSEIGNANT"

    qs_admin = SalaireAdministration.objects.select_related("personnel_administratif")
    if annee_scolaire_id:
        qs_admin = qs_admin.filter(annee_scolaire_id=annee_scolaire_id)
    admin = list(
        qs_admin.values("personnel_administratif__ecole_id", "annee_scolaire_id", "mois")
        .annotate(montant=Sum("montant_paye"))
        .order_by("personnel_administratif__ecole_id", "annee_scolaire_id", "mois")
    )
    for r in admin:
        r["ecole_id"] = r.pop("personnel_administratif__ecole_id")
        r["categorie"] = "ADMIN"

    return Response(enseignant + admin)


@extend_schema(
    tags=["rapports"],
    parameters=[OpenApiParameter("enseignant_id", OpenApiTypes.INT, required=False)],
    responses=OpenApiTypes.OBJECT,
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def paie_enseignant(request):
    """v_paie_enseignant : dû vs payé par enseignant/année."""
    enseignant_id = request.query_params.get("enseignant_id")
    qs = AffectationEnseignement.objects.all()
    if enseignant_id:
        qs = qs.filter(enseignant_id=enseignant_id)

    qs = qs.values("enseignant_id", "annee_scolaire_id").annotate(
        montant_du=Sum("montant_prevu")
    )
    resultats = []
    for r in qs:
        montant_paye = (
            SalaireEnseignant.objects.filter(
                enseignant_id=r["enseignant_id"], annee_scolaire_id=r["annee_scolaire_id"]
            ).aggregate(total=Coalesce(Sum("montant"), ZERO_FCFA))["total"]
        )
        resultats.append(
            {
                "enseignant_id": r["enseignant_id"],
                "annee_scolaire_id": r["annee_scolaire_id"],
                "montant_du": r["montant_du"],
                "montant_paye": montant_paye,
            }
        )
    return Response(resultats)


@extend_schema(
    tags=["rapports"],
    parameters=[
        OpenApiParameter("compte_id", OpenApiTypes.INT, required=True),
        OpenApiParameter("date", OpenApiTypes.DATE, required=False),
    ],
    responses=OpenApiTypes.OBJECT,
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def arrete_caisse(request):
    """v_arrete_caisse : théorique/physique/écart/billetage.

    Pour un arrêté déjà créé : renvoie ses valeurs enregistrées + le total du
    billetage. `tresorerie.ArreteCaisseViewSet.solde_theorique` existe déjà pour la
    prévisualisation AVANT création (réutilisé tel quel côté frontend, pas dupliqué
    ici) — ce rapport sert la consultation APRÈS création.
    """
    compte_id = request.query_params.get("compte_id")
    date_arrete = request.query_params.get("date")

    qs = (
        ArreteCaisse.objects.filter(compte_id=compte_id)
        if compte_id
        else ArreteCaisse.objects.all()
    )
    if date_arrete:
        qs = qs.filter(date=date_arrete)

    resultats = []
    for ac in qs:
        total_billetage = (
            Billetage.objects.filter(arrete_caisse=ac).aggregate(
                total=Coalesce(Sum("montant"), ZERO_FCFA)
            )["total"]
        )
        resultats.append(
            {
                "id": ac.id,
                "compte_id": ac.compte_id,
                "date": ac.date,
                "solde_theorique": ac.solde_theorique,
                "solde_physique": ac.solde_physique,
                "ecart": ac.ecart,
                "total_billetage": total_billetage,
            }
        )
    return Response(resultats)


@extend_schema(tags=["rapports"], responses=OpenApiTypes.OBJECT)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def tableau_de_bord(request):
    """Indicateurs d'ensemble (§18 du mandat) : étudiants inscrits, encaissements,
    reste à recouvrer, dépenses, solde des comptes, masse salariale, résultats,
    alertes administratives. Scope sur l'année scolaire courante (`est_courante`)
    quand une année est marquée comme telle, sinon sur l'ensemble des données."""
    annee = AnneeScolaire.objects.filter(est_courante=True).first()

    inscriptions = Inscription.objects.filter(etat=Inscription.Etat.ACTIVE)
    encaissements = Encaissement.objects.filter(statut=Encaissement.Statut.VALIDE)
    echeances = Echeance.objects.all()
    depenses = Depense.objects.filter(statut=Depense.Statut.PAYEE)
    salaires_enseignant = SalaireEnseignant.objects.all()
    salaires_admin = SalaireAdministration.objects.all()
    resultats_annuels = ResultatAnnuel.objects.all()

    if annee:
        inscriptions = inscriptions.filter(annee_scolaire=annee)
        encaissements = encaissements.filter(inscription__annee_scolaire=annee)
        echeances = echeances.filter(inscription__annee_scolaire=annee)
        # Depense n'a pas de FK annee_scolaire directe : on scope sur la fenêtre de
        # dates de l'année courante plutôt que de renoncer au filtrage.
        depenses = depenses.filter(date__range=(annee.date_debut, annee.date_fin))
        salaires_enseignant = salaires_enseignant.filter(annee_scolaire=annee)
        salaires_admin = salaires_admin.filter(annee_scolaire=annee)
        resultats_annuels = resultats_annuels.filter(annee_scolaire=annee)

    etudiants_inscrits = inscriptions.count()

    total_encaisse = encaissements.aggregate(total=Coalesce(Sum("montant_total"), ZERO_FCFA))[
        "total"
    ]

    montant_echeances = echeances.aggregate(total=Coalesce(Sum("montant"), ZERO_FCFA))["total"]
    montant_encaisse_echeances = ImputationEncaissement.objects.filter(
        cible=ImputationEncaissement.Cible.ECHEANCE,
        echeance__in=echeances,
    ).aggregate(total=Coalesce(Sum("montant"), ZERO_FCFA))["total"]
    reste_a_recouvrer = montant_echeances - montant_encaisse_echeances

    total_depenses = depenses.aggregate(total=Coalesce(Sum("montant"), ZERO_FCFA))["total"]

    solde_comptes = sum((row["solde"] for row in _solde_compte_donnees()), start=0)

    masse_salariale_total = (
        salaires_enseignant.aggregate(total=Coalesce(Sum("montant"), ZERO_FCFA))["total"]
        + salaires_admin.aggregate(total=Coalesce(Sum("montant_paye"), ZERO_FCFA))["total"]
    )

    resultats_par_decision = dict(
        resultats_annuels.values("decision")
        .annotate(nb=Count("id"))
        .values_list("decision", "nb")
    )

    aujourdhui = date.today()
    echeances_en_retard = sum(
        1
        for e in echeances
        if aujourdhui > e.date_echeance
        and (e.montant - _montant_encaisse_echeance(e.id)) > 0
    )
    ecarts_caisse = ArreteCaisse.objects.exclude(ecart=0).count()

    return Response(
        {
            "annee_scolaire_id": annee.id if annee else None,
            "annee_scolaire_libelle": annee.libelle if annee else None,
            "etudiants_inscrits": etudiants_inscrits,
            "encaissements": total_encaisse,
            "reste_a_recouvrer": reste_a_recouvrer,
            "depenses": total_depenses,
            "solde_comptes": solde_comptes,
            "masse_salariale": masse_salariale_total,
            "resultats_par_decision": resultats_par_decision,
            "alertes": {
                "echeances_en_retard": echeances_en_retard,
                "arretes_caisse_en_ecart": ecarts_caisse,
            },
        }
    )


def _solde_compte_donnees():
    comptes = Compte.objects.annotate(
        credits=Coalesce(
            Sum("mouvement__montant", filter=Q(mouvement__sens="CREDIT", mouvement__valide=True)),
            ZERO_FCFA,
        ),
        debits=Coalesce(
            Sum("mouvement__montant", filter=Q(mouvement__sens="DEBIT", mouvement__valide=True)),
            ZERO_FCFA,
        ),
    )
    return [{"solde": c.solde_initial + c.credits - c.debits} for c in comptes]

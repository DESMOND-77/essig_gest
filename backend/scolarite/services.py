import calendar
import datetime as dt

from django.db import transaction
from django.db.models import Sum, Q
from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers

from .models import (
    Echeance, FraisInscription, ModalitePaiement, TypeFrais,
    Bourse
)
from referentiel.models import AnneeScolaire
from personnes.models import Etudiant, Inscription


def _ajouter_mois(d: dt.date, k: int) -> dt.date:
    total = d.month - 1 + k
    annee = d.year + total // 12
    mois = total % 12 + 1
    dernier = calendar.monthrange(annee, mois)[1]
    return dt.date(annee, mois, min(d.day, dernier))


def generer_echeancier(inscription) -> list:
    """Génère l'échéancier d'une inscription à partir de la grille tarifaire
    (CLAUDE.md §Échéancier ; db/migrations/004_scolarite_facturation.sql) :
      - échéance 0 = `grille.montant_inscription_reinscription` ;
      - échéances 1..`grille.nombre_echeance` = `grille.montant_echeance` chacune,
        sauf si `inscription.cout_scolarite_negocie` est renseigné, auquel cas ce
        montant négocié est réparti en `nombre_echeance` mensualités (reliquat
        d'arrondi absorbé par la dernière, montants entiers FCFA).
    Ne concerne PAS les frais annexes (`FraisInscription`/`TypeFrais`), qui sont un
    système de facturation séparé, cf. `materialiser_frais_obligatoires`."""
    niveau = inscription.classe.niveau
    try:
        grille = ModalitePaiement.objects.get(
            niveau=niveau, annee_scolaire=inscription.annee_scolaire
        )
    except ModalitePaiement.DoesNotExist as exc:
        raise serializers.ValidationError(
            {
                "detail": "Aucune grille tarifaire (modalité de paiement) pour ce "
                "niveau et cette année. Créez-la avant d'inscrire."
            }
        ) from exc

    d0 = inscription.date_inscription
    lignes = [
        Echeance(
            inscription=inscription,
            numero=0,
            montant=int(grille.montant_inscription_reinscription),
            date_echeance=d0,
            date_paiement=None,
            montant_paye=0,
            statut='à payer',
        )
    ]

    if inscription.cout_scolarite_negocie is not None:
        base, reste = divmod(int(inscription.cout_scolarite_negocie), grille.nombre_echeance)
        montants = [
            base + (reste if i == grille.nombre_echeance else 0)
            for i in range(1, grille.nombre_echeance + 1)
        ]
    else:
        montants = [int(grille.montant_echeance)] * grille.nombre_echeance

    for i, montant in enumerate(montants, start=1):
        lignes.append(
            Echeance(
                inscription=inscription,
                numero=i,
                montant=montant,
                date_echeance=_ajouter_mois(d0, i),
                date_paiement=None,
                montant_paye=0,
                statut='à payer',
            )
        )

    Echeance.objects.bulk_create(lignes)
    return lignes


def materialiser_frais_obligatoires(inscription) -> list:
    """Matérialise une ligne `FraisInscription` pour chaque `TypeFrais` obligatoire
    et actif applicable au périmètre (école/niveau/année) de l'inscription — un champ
    de périmètre NULL sur le TypeFrais signifie "s'applique à tous"."""
    niveau = inscription.classe.niveau
    types_applicables = TypeFrais.objects.filter(
        obligatoire=True, actif=True
    ).filter(
        Q(ecole__isnull=True) | Q(ecole=inscription.ecole)
    ).filter(
        Q(niveau__isnull=True) | Q(niveau=niveau)
    ).filter(
        Q(annee_scolaire__isnull=True) | Q(annee_scolaire=inscription.annee_scolaire)
    )
    lignes = [
        FraisInscription(
            inscription=inscription,
            type_frais=t,
            montant_du=t.montant_defaut,
        )
        for t in types_applicables
    ]
    FraisInscription.objects.bulk_create(lignes)
    return lignes




# NEW FUNCTIONS REQUIRED BY TASK 3
def generer_echeancier_inscription(inscription_id):
    """Variante de `generer_echeancier` prenant un id et appliquant les bourses
    disponibles juste après génération. Délègue entièrement à `generer_echeancier`
    pour le calcul des échéances (même grille tarifaire, même source de vérité) —
    ne duplique plus sa propre logique (l'ancienne version datait d'avant la
    correction du modèle `ModalitePaiement`/`FraisInscription` et ignorait
    `nombre_echeance`/`montant_echeance`)."""
    try:
        inscription = Inscription.objects.select_related(
            'classe__niveau', 'annee_scolaire', 'etudiant'
        ).get(id=inscription_id)
    except Inscription.DoesNotExist as exc:
        raise ObjectDoesNotExist(f"Inscription avec id {inscription_id} non trouvée") from exc

    with transaction.atomic():
        lignes = generer_echeancier(inscription)
        appliquer_bourses_disponibles(inscription.etudiant_id, inscription.annee_scolaire_id)
        return lignes[0]  # échéance 0, pour compatibilité avec l'appelant historique

def appliquer_bourses_disponibles(etudiant_id, annee_scolaire_id):
    """
    Applique automatiquement toutes les bourses disponibles
    pour un étudiant et une année scolaire donnée.
    """
    bourses_actives = Bourse.objects.filter(
        etudiant_id=etudiant_id,
        annee_scolaire_id=annee_scolaire_id,
        date_attribution__lte=dt.date.today(),
        date_fin_validite__gte=dt.date.today()
    )

    for bourse in bourses_actives:
        appliquer_bourse_etudiant(etudiant_id, annee_scolaire_id, bourse_id=bourse.id)

def appliquer_bourse_etudiant(etudiant_id, annee_scolaire_id, bourse_id=None):
    """
    Applique une bourse spécifique à un étudiant pour réduire son reste à payer.
    """
    try:
        etudiant = Etudiant.objects.get(id=etudiant_id)
        annee_scolaire = AnneeScolaire.objects.get(id=annee_scolaire_id)
    except (Etudiant.DoesNotExist, AnneeScolaire.DoesNotExist):
        raise ObjectDoesNotExist("Étudiant ou année scolaire non trouvé")

    if bourse_id:
        try:
            bourse = Bourse.objects.get(
                id=bourse_id,
                etudiant_id=etudiant_id,
                annee_scolaire_id=annee_scolaire_id
            )
        except Bourse.DoesNotExist:
            raise ObjectDoesNotExist(f"Bourse avec id {bourse_id} non trouvée pour cet étudiant/année")
    else:
        # Appliquer la première bourse disponible
        bourse = Bourse.objects.filter(
            etudiant_id=etudiant_id,
            annee_scolaire_id=annee_scolaire_id,
            date_attribution__lte=dt.date.today()
        ).filter(
            Q(date_fin_validite__isnull=True) | Q(date_fin_validite__gte=dt.date.today())
        ).first()

        if not bourse:
            return  # Aucune bourse à appliquer

    # Vérifier qu'il n'y a pas de conflit (déjà appliquée pour cette période)
    # Pour simplifier, on permet les réapplications - à améliorer en production

    with transaction.atomic():
        # Appliquer la bourse à toutes les échéances non payées de l'étudiant
        echeances_non_payees = Echeance.objects.filter(
            inscription__etudiant=etudiant,
            inscription__annee_scolaire=annee_scolaire,
            statut__in=['à payer', 'partiellement payé']
        ).order_by('date_echeance')

        if bourse.pourcentage is not None:
            # Application par pourcentage
            for echeance in echeances_non_payees:
                montant_a_rembourser = echeance.montant * (bourse.pourcentage / 100)
                nouveau_montant_paye = echeance.montant_paye + montant_a_rembourser

                # Ne pas dépasser le montant total de l'échéance
                if nouveau_montant_paye > echeance.montant:
                    nouveau_montant_paye = echeance.montant

                echeance.montant_paye = nouveau_montant_paye
                echeance.statut = 'payé' if nouveau_montant_paye == echeance.montant else 'partiellement payé'
                echeance.save(update_fields=['montant_paye', 'statut'])
        else:
            # Application par montant fixe
            montant_restant_a_appliquer = bourse.montant_fixe

            for echeance in echeances_non_payees:
                if montant_restant_a_appliquer <= 0:
                    break

                reste_echeance = echeance.montant - echeance.montant_paye
                montant_a_appliquer = min(reste_echeance, montant_restant_a_appliquer)

                nouveau_montant_paye = echeance.montant_paye + montant_a_appliquer
                nouveau_statut = 'payé' if nouveau_montant_paye == echeance.montant else 'partiellement payé'

                echeance.montant_paye = nouveau_montant_paye
                echeance.statut = nouveau_statut
                echeance.save(update_fields=['montant_paye', 'statut'])

                montant_restant_a_appliquer -= montant_a_appliquer

def imputer_encaissement(inscription_id, montant, date_paiement):
    """
    Impute un encaissement selon la règle FIFO (First In, First Out) sur les échéances d'une inscription.
    """
    try:
        inscription = Inscription.objects.get(id=inscription_id)
    except Inscription.DoesNotExist:
        raise ObjectDoesNotExist(f"Inscription avec id {inscription_id} non trouvée")

    with transaction.atomic():
        # Récupérer toutes les échéances non payées de l'inscription, ordonnées par date d'échéance (FIFO)
        echeances = Echeance.objects.filter(
            inscription=inscription,
            statut__in=['à payer', 'partiellement payé']
        ).order_by('date_echeance')

        montant_restant_a_imputer = montant

        for echeance in echeances:
            if montant_restant_a_imputer <= 0:
                break

            reste_echeance = echeance.montant - echeance.montant_paye

            if reste_echeance <= 0:
                continue  # Cette échéance est déjà entièrement payée

            # Appliquer le paiement sur cette échéance (jusqu'à concurrence du reste)
            montant_a_imputer = min(reste_echeance, montant_restant_a_imputer)

            nouveau_montant_paye = echeance.montant_paye + montant_a_imputer
            nouveau_statut = 'payé' if nouveau_montant_paye == echeance.montant else 'partiellement payé'

            echeance.montant_paye = nouveau_montant_paye
            echeance.date_paiement = date_paiement
            echeance.statut = nouveau_statut
            echeance.save(update_fields=['montant_paye', 'date_paiement', 'statut'])

            montant_restant_a_imputer -= montant_a_imputer

def calculer_reste_a_payer_inscription(inscription_id):
    """
    Calcule le reste à payer pour une inscription donnée.
    Reste à payer = Σ(échéances) - Σ(encaissements imputés)
    """
    try:
        inscription = Inscription.objects.get(id=inscription_id)
    except Inscription.DoesNotExist:
        raise ObjectDoesNotExist(f"Inscription avec id {inscription_id} non trouvée")

    # Somme du montant de toutes les échéances
    total_du = Echeance.objects.filter(
        inscription=inscription
    ).aggregate(total=Sum('montant'))['total'] or 0

    # Somme du montant déjà payé
    total_paye = Echeance.objects.filter(
        inscription=inscription
    ).aggregate(total=Sum('montant_paye'))['total'] or 0

    reste_a_payer = total_du - total_paye
    # Le reste à payer ne devrait jamais être négatif (les trop-perçus deviennent des avoirs)
    return max(0, reste_a_payer)

def preparer_donnees_fiche_scolarite(inscription_id):
    """
    Prépare les données nécessaires pour générer une fiche scolarité.
    Cette fonction agrège les données de plusieurs sources.
    """
    try:
        inscription = Inscription.objects.select_related(
            'etudiant', 'classe__niveau', 'annee_scolaire'
        ).get(id=inscription_id)
    except Inscription.DoesNotExist:
        raise ObjectDoesNotExist(f"Inscription avec id {inscription_id} non trouvée")

    # Données de base de l'étudiant et inscription
    etudiant_data = {
        'id': inscription.etudiant.id,
        'nom': inscription.etudiant.nom,
        'prenoms': inscription.etudiant.prenoms,
        'date_naissance': inscription.etudiant.date_naissance,
        'email': inscription.etudiant.email,
        'telephone': getattr(inscription.etudiant, 'telephone', ''),
        'adresse': getattr(inscription.etudiant, 'adresse', ''),
    }

    inscription_data = {
        'id': inscription.id,
        'date_inscription': inscription.date_inscription,
        'statut': inscription.statut,
        'niveau': {
            'id': inscription.classe.niveau.id,
            'code': inscription.classe.niveau.code,
            'libelle': inscription.classe.niveau.libelle,
        },
        'annee_scolaire': {
            'id': inscription.annee_scolaire.id,
            'libelle': inscription.annee_scolaire.libelle,
        }
    }

    # Situation financière
    situation_financiere = {
        'total_du': 0,
        'total_paye': 0,
        'reste_a_payer': 0,
        'echeances': []
    }

    echeances = Echeance.objects.filter(inscription=inscription).order_by('numero')
    for echeance in echeances:
        situation_financiere['total_du'] += echeance.montant
        situation_financiere['total_paye'] += echeance.montant_paye
        situation_financiere['echeances'].append({
            'numero': echeance.numero,
            'montant': echeance.montant,
            'date_echeance': echeance.date_echeance,
            'date_paiement': echeance.date_paiement,
            'montant_paye': echeance.montant_paye,
            'reste_a_payer': echeance.reste_a_payer,
            'statut': echeance.statut,
        })

    situation_financiere['reste_a_payer'] = calculer_reste_a_payer_inscription(inscription.id)

    # Informations académiques (à développer avec le module 7/8)
    informations_academiques = {
        'moyenne_generale': None,  # À calculer depuis les notes
        'notes_par_matiere': [],   # À développer
        'appreciations': [],       # À développer
        'absences': {
            'justifiees': 0,
            'non_justifiees': 0,
            'retards': 0
        },
        'appreciation_generele': '',  # À développer
    }

    # Activités et comportement (à développer)
    activites = {
        'activites_periode': [],  # À développer
        'comportement': '',       # À développer
        'points_fortes': [],      # À développer
        'points_a_ameliorer': [], # À développer
    }

    return {
        'etudiant': etudiant_data,
        'inscription': inscription_data,
        'informations_academiques': informations_academiques,
        'situation_financiere': situation_financiere,
        'activites': activites,
        'date_preparation': dt.date.today(),
        'periode_scolaire': f"{inscription.annee_scolaire.libelle}",
    }
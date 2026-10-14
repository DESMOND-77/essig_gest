# backend/tresorerie/services/virement.py
from django.db import transaction
from django.core.exceptions import ValidationError
from referentiel.models import AnneeScolaire
from ..models import Virement, Mouvement, Compte
from .compte import generer_mouvement_credit, generer_mouvement_debit
import logging
import types

logger = logging.getLogger(__name__)


def _annee_scolaire_courante_id():
    try:
        return AnneeScolaire.objects.get(est_courante=True).id
    except AnneeScolaire.DoesNotExist:
        raise ValidationError("Aucune année scolaire courante n'est définie dans le référentiel.")


def executer_virement(compte_source_id, compte_destination_id, montant, motif,
                     cree_par_id=None, valide_par_id=None, date=None):
    """
    Exécute un virement entre deux comptes en créant deux mouvements opposés
    dans une seule transaction.

    Args:
        compte_source_id (int): ID du compte source
        compte_destination_id (int): ID du compte destination
        montant (Decimal): Montant du virement (> 0)
        motif (str): Motif du virement
        cree_par_id (int, optionnel): ID de l'utilisateur créateur
        valide_par_id (int, optionnel): ID de l'utilisateur validateur
        date (date, optionnel): Date du virement (aujourd'hui par défaut)

    Returns:
        Virement: Le virement exécuté

    Raises:
        ValidationError: Si les données sont invalides ou si solde insuffisant
    """
    if montant <= 0:
        raise ValidationError("Le montant doit être strictement positif")

    if compte_source_id == compte_destination_id:
        raise ValidationError("Le compte source et le compte destination doivent être différents")

    if date is None:
        from django.utils import timezone
        date = timezone.now().date()

    try:
        with transaction.atomic():
            annee_scolaire_id = _annee_scolaire_courante_id()
            # Vérifier que les comptes existent et sont actifs
            compte_source = Compte.objects.select_for_update().get(id=compte_source_id)
            compte_destination = Compte.objects.select_for_update().get(id=compte_destination_id)

            if not compte_source.actif:
                raise ValidationError(f"Le compte source {compte_source.code} est inactif")

            if not compte_destination.actif:
                raise ValidationError(f"Le compte destination {compte_destination.code} est inactif")

            # Vérifier la disponibilité des fonds sur le compte source
            solde_source = calculer_solde_compte(compte_source_id)
            if solde_source < montant:
                raise ValidationError(
                    f"Solde insuffisant sur le compte source {compte_source.code}. "
                    f"Solde disponible: {solde_source} FCFA, montant demandé: {montant} FCFA"
                )

            # Créer le virement
            virement = Virement.objects.create(
                compte_source_id=compte_source_id,
                compte_destination_id=compte_destination_id,
                montant=montant,
                date=date,
                motif=motif,
                cree_par_id=cree_par_id,
                valide_par_id=valide_par_id,
                statut=Virement.Statut.VALIDE
            )

            # Créer le mouvement de débit sur le compte source
            categorie_sortie = get_categorie_sortie_par_defaut()
            generer_mouvement_debit(
                compte_id=compte_source_id,
                montant=montant,
                categorie_mouvement_id=categorie_sortie.id,
                libelle=f"Virement vers {compte_destination.code}: {motif}",
                virement_id=virement.id,
                annee_scolaire_id=annee_scolaire_id,
                date_operation=date,
                cree_par_id=cree_par_id
            )

            # Créer le mouvement de crédit sur le compte destination
            categorie_entree = get_categorie_entree_par_defaut()
            generer_mouvement_credit(
                compte_id=compte_destination_id,
                montant=montant,
                categorie_mouvement_id=categorie_entree.id,
                libelle=f"Virement depuis {compte_source.code}: {motif}",
                virement_id=virement.id,
                annee_scolaire_id=annee_scolaire_id,
                date_operation=date,
                cree_par_id=cree_par_id
            )

            logger.info(
                f"Virement exécuté: {virement.id} - {montant} FCFA "
                f"de {compte_source.code} vers {compte_destination.code}"
            )

            return virement

    except Compte.DoesNotExist as e:
        raise ValidationError(f"Compte introuvable: {str(e)}")
    except Exception as e:
        logger.error(f"Erreur lors de l'exécution du virement: {str(e)}")
        raise


def engager_virement(virement_id, engage_par_id=None):
    """
    Soumet un virement BROUILLON pour validation (passage à EN_ATTENTE_VALIDATION).

    Étape de maker-checker : aucun mouvement n'est créé ici, seule la transition de statut.
    Le virement reste modifiable/supprimable tant qu'il est BROUILLON (cf. `editable_statuses`/
    `deletable_statuses` sur le modèle) ; une fois engagé, ces champs sont protégés par le garde
    `save()`/`delete()` existant, en attendant la décision du validateur (`valider`/`annuler`).

    Args:
        virement_id (int): ID du virement à engager
        engage_par_id (int, optionnel): ID de l'utilisateur à l'origine de la soumission

    Returns:
        Virement: Le virement engagé

    Raises:
        ValidationError: Si le virement n'existe pas ou n'est pas en statut BROUILLON
    """
    try:
        with transaction.atomic():
            virement = Virement.objects.select_for_update().get(id=virement_id)

            if virement.statut != Virement.Statut.BROUILLON:
                raise ValidationError(
                    f"Seul un virement BROUILLON peut être engagé. Statut actuel: {virement.statut}"
                )

            virement.statut = Virement.Statut.EN_ATTENTE_VALIDATION
            virement.modifie_par_id = engage_par_id
            virement.save(update_fields=['statut', 'modifie_par'])

            logger.info(f"Virement {virement.id} engagé (en attente de validation)")
            return virement

    except Virement.DoesNotExist:
        raise ValidationError(f"Virement avec l'ID {virement_id} introuvable")


def valider_virement(virement_id, valide_par_id=None):
    """
    Valide un virement EN_ATTENTE_VALIDATION : crée les deux mouvements opposés et passe le
    statut à VALIDE.

    `executer_virement` crée et valide un virement en une seule étape (BROUILLON et
    EN_ATTENTE_VALIDATION court-circuités) ; cette fonction couvre le cas normal où un virement
    a suivi le flux engager -> valider.

    Args:
        virement_id (int): ID du virement à valider
        valide_par_id (int, optionnel): ID de l'utilisateur validateur

    Returns:
        Virement: Le virement validé

    Raises:
        ValidationError: Si le virement n'existe pas ou n'est pas en statut EN_ATTENTE_VALIDATION
    """
    try:
        with transaction.atomic():
            virement = Virement.objects.select_for_update().get(id=virement_id)

            if virement.statut != Virement.Statut.EN_ATTENTE_VALIDATION:
                raise ValidationError(
                    f"Seul un virement en attente de validation peut être validé. "
                    f"Statut actuel: {virement.statut}"
                )

            compte_source = Compte.objects.select_for_update().get(id=virement.compte_source_id)
            compte_destination = Compte.objects.select_for_update().get(id=virement.compte_destination_id)

            solde_source = calculer_solde_compte(virement.compte_source_id)
            if solde_source < virement.montant:
                raise ValidationError(
                    f"Solde insuffisant sur le compte source {compte_source.code}. "
                    f"Solde disponible: {solde_source} FCFA, montant demandé: {virement.montant} FCFA"
                )

            annee_scolaire_id = _annee_scolaire_courante_id()

            categorie_sortie = get_categorie_sortie_par_defaut()
            generer_mouvement_debit(
                compte_id=virement.compte_source_id,
                montant=virement.montant,
                categorie_mouvement_id=categorie_sortie.id,
                libelle=f"Virement vers {compte_destination.code}: {virement.motif}",
                virement_id=virement.id,
                annee_scolaire_id=annee_scolaire_id,
                date_operation=virement.date,
                cree_par_id=valide_par_id
            )

            categorie_entree = get_categorie_entree_par_defaut()
            generer_mouvement_credit(
                compte_id=virement.compte_destination_id,
                montant=virement.montant,
                categorie_mouvement_id=categorie_entree.id,
                libelle=f"Virement depuis {compte_source.code}: {virement.motif}",
                virement_id=virement.id,
                annee_scolaire_id=annee_scolaire_id,
                date_operation=virement.date,
                cree_par_id=valide_par_id
            )

            virement.statut = Virement.Statut.VALIDE
            virement.valide_par_id = valide_par_id
            virement.save(update_fields=['statut', 'valide_par'])

            logger.info(f"Virement {virement.id} validé")
            return virement

    except Virement.DoesNotExist:
        raise ValidationError(f"Virement avec l'ID {virement_id} introuvable")
    except Compte.DoesNotExist as e:
        raise ValidationError(f"Compte introuvable: {str(e)}")


def annuler_virement(virement_id, annule_par_id=None):
    """
    Annule un virement. Un virement BROUILLON est simplement marqué ANNULE (aucun mouvement
    n'a encore été posté). Un virement VALIDE est annulé en créant les deux mouvements inverses
    pour maintenir l'intégrité du grand livre.

    Args:
        virement_id (int): ID du virement à annuler
        annule_par_id (int, optionnel): ID de l'utilisateur à l'origine de l'annulation

    Returns:
        Virement: Le virement annulé

    Raises:
        ValidationError: Si le virement n'existe pas ou est déjà annulé
    """
    try:
        with transaction.atomic():
            virement = Virement.objects.select_for_update().get(id=virement_id)

            if virement.statut == Virement.Statut.ANNULE:
                raise ValidationError(f"Le virement {virement.id} est déjà annulé")

            if virement.statut == Virement.Statut.VALIDE:
                annee_scolaire_id = _annee_scolaire_courante_id()
                categorie_sortie = get_categorie_sortie_par_defaut()
                categorie_entree = get_categorie_entree_par_defaut()

                # Contre-écriture : crédit sur le compte source, débit sur le compte destination.
                generer_mouvement_credit(
                    compte_id=virement.compte_source_id,
                    montant=virement.montant,
                    categorie_mouvement_id=categorie_entree.id,
                    libelle=f"Annulation virement {virement.id}",
                    piece_reference=f"ANN-VIR-{virement.id}",
                    virement_id=virement.id,
                    annee_scolaire_id=annee_scolaire_id,
                    cree_par_id=annule_par_id
                )
                generer_mouvement_debit(
                    compte_id=virement.compte_destination_id,
                    montant=virement.montant,
                    categorie_mouvement_id=categorie_sortie.id,
                    libelle=f"Annulation virement {virement.id}",
                    piece_reference=f"ANN-VIR-{virement.id}",
                    virement_id=virement.id,
                    annee_scolaire_id=annee_scolaire_id,
                    cree_par_id=annule_par_id
                )

            virement.statut = Virement.Statut.ANNULE
            virement.save(update_fields=['statut'])

            logger.info(f"Virement {virement.id} annulé")
            return virement

    except Virement.DoesNotExist:
        raise ValidationError(f"Virement avec l'ID {virement_id} introuvable")


def get_categorie_sortie_par_defaut():
    """Récupère ou crée une catégorie de sortie par défaut pour les virements."""
    from ..models import CategorieMouvement
    categorie, created = CategorieMouvement.objects.get_or_create(
        code='VIREMENT_SORTIE',
        defaults={
            'libelle': 'Virement sortant',
            'sens': CategorieMouvement.Sens.SORTIE
        }
    )
    return categorie


def get_categorie_entree_par_defaut():
    """Récupère ou crée une catégorie d'entrée par défaut pour les virements."""
    from ..models import CategorieMouvement
    categorie, created = CategorieMouvement.objects.get_or_create(
        code='VIREMENT_ENTREE',
        defaults={
            'libelle': 'Virement entrant',
            'sens': CategorieMouvement.Sens.ENTREE
        }
    )
    return categorie


def calculer_solde_compte(compte_id):
    """Calcule le solde actuel d'un compte (fonction interne réutilisée)."""
    from .compte import calculer_solde_compte as compte_service_calculer_solde
    return compte_service_calculer_solde(compte_id)


virement_service = types.SimpleNamespace(
    executer_virement=executer_virement,
    engager_virement=engager_virement,
    valider_virement=valider_virement,
    annuler_virement=annuler_virement,
    get_categorie_sortie_par_defaut=get_categorie_sortie_par_defaut,
    get_categorie_entree_par_defaut=get_categorie_entree_par_defaut,
    calculer_solde_compte=calculer_solde_compte
)
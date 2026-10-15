# backend/tresorerie/services/encaissement.py
from django.db import transaction
from django.core.exceptions import ValidationError
from django.db.models import F, Sum
from ..models import Encaissement, Mouvement, ImputationEncaissement, Compte
from .compte import generer_mouvement_credit, generer_mouvement_debit
from scolarite.models import Echeance, FraisInscription
from scolarite.services import calculer_reste_a_payer_inscription
import logging
import types

logger = logging.getLogger(__name__)


def creer_encaissement(inscription_id, montant_total, mode, compte_id,
                      date=None, cree_par_id=None):
    """
    Crée un encaissement avec génération automatique du mouvement CREDIT associé.

    Args:
        inscription_id (int): ID de l'inscription associée
        montant_total (Decimal): Montant total de l'encaissement (> 0)
        mode (str): Mode de paiement (ESPECES, VIREMENT, MOBILE_MONEY, CHEQUE)
        compte_id (int): ID du compte de crédit
        date (date, optionnel): Date de l'encaissement (aujourd'hui par défaut)
        cree_par_id (int, optionnel): ID de l'utilisateur créateur

    Returns:
        Encaissement: L'encaissement créé

    Raises:
        ValidationError: Si les données sont invalides
    """
    if montant_total <= 0:
        raise ValidationError("Le montant total doit être strictement positif")

    if date is None:
        from django.utils import timezone
        date = timezone.now().date()

    try:
        with transaction.atomic():
            # Vérifier que l'inscription existe
            from personnes.models import Inscription
            inscription = Inscription.objects.get(id=inscription_id)

            # Vérifier que le compte existe et est actif
            compte = Compte.objects.get(id=compte_id)
            if not compte.actif:
                raise ValidationError(f"Le compte {compte.code} est inactif")

            # Générer le numéro de reçu unique (concurrency-safe)
            recu_numero = generer_numero_recu_unique()

            # Créer le mouvement CREDIT associé
            categorie_entree = get_categorie_entree_encaissement_par_defaut()
            mouvement = generer_mouvement_credit(
                compte_id=compte_id,
                montant=montant_total,
                categorie_mouvement_id=categorie_entree.id,
                libelle=f"Encaissement {recu_numero} - {inscription}",
                piece_reference=recu_numero,
                ecole_id=inscription.ecole_id,
                annee_scolaire_id=inscription.annee_scolaire_id,
                cree_par_id=cree_par_id
            )

            # Créer l'encaissement
            encaissement = Encaissement.objects.create(
                inscription_id=inscription_id,
                date=date,
                montant_total=montant_total,
                mode=mode,
                compte_id=compte_id,
                mouvement_id=mouvement.id,
                recu_numero=recu_numero,
                cree_par_id=cree_par_id
            )

            logger.info(
                f"Encaissement créé: {encaissement.recu_numero} - "
                f"{encaissement.montant_total} FCFA pour l'inscription {inscription_id}"
            )

            return encaissement

    except Exception as e:
        logger.error(f"Erreur lors de la création de l'encaissement: {str(e)}")
        raise


def generer_numero_recu_unique():
    """
    Génère un numéro de reçu unique de manière concurrency-safe.

    Returns:
        str: Numéro de reçu unique
    """
    from django.db import transaction
    from ..models import Encaissement

    with transaction.atomic():
        # Utiliser un verrou sur la table pour éviter les doubles génération
        last_encaissement = Encaissement.objects.select_for_update().order_by('-id').first()
        if last_encaissement and last_encaissement.recu_numero:
            # Extraire le numéro numérique du dernier reçu
            try:
                # Format attendu: ETB-YYYY-NNNNN
                parts = last_encaissement.recu_numero.split('-')
                if len(parts) >= 3:
                    last_number = int(parts[-1])
                    new_number = last_number + 1
                else:
                    new_number = 1
            except (ValueError, IndexError):
                new_number = 1
        else:
            new_number = 1

        # Format: ETB-YYYY-NNNNN (établissement-année-numéro)
        from django.utils import timezone
        current_year = timezone.now().year
        return f"ETB-{current_year}-{new_number:05d}"


def get_categorie_entree_encaissement_par_defaut():
    """Récupère ou crée une catégorie d'entrée par défaut pour les encaissements."""
    from ..models import CategorieMouvement
    categorie, created = CategorieMouvement.objects.get_or_create(
        code='ENCAISSSEMENT',
        defaults={
            'libelle': 'Encaissement',
            'sens': CategorieMouvement.Sens.ENTREE
        }
    )
    return categorie


def imputer_encaissement(encaissement_id, imputations, cree_par_id=None):
    """
    Impute un encaissement sur des échéances et/ou frais d'inscription.

    Args:
        encaissement_id (int): ID de l'encaissement à imputer
        imputations (list): Liste de dictionnaires contenant les imputations
                           Chaque dictionnaire doit contenir:
                           - 'cible': 'ECHEANCE' ou 'FRAIS'
                           - 'echeance_id' (int, optionnel): requis si cible='ECHEANCE'
                           - 'frais_inscription_id' (int, optionnel): requis si cible='FRAIS'
                           - 'montant' (Decimal): Montant de l'imputation (> 0)
        cree_par_id (int, optionnel): ID de l'utilisateur créateur

    Returns:
        list: Liste des imputations créées

    Raises:
        ValidationError: Si les données sont invalides ou si le total des imputations
                       ne correspond pas au montant de l'encaissement
    """
    try:
        with transaction.atomic():
            encaissement = Encaissement.objects.select_for_update().get(id=encaissement_id)

            # Vérifier que l'encaissement n'est pas déjà entièrement imputé
            total_impute_existant = ImputationEncaissement.objects.filter(
                encaissement_id=encaissement_id
            ).aggregate(total=Sum('montant'))['total'] or 0

            if total_impute_existant >= encaissement.montant_total:
                raise ValidationError(
                    f"L'encaissement {encaissement.recu_numero} est déjà entièrement imputé"
                )

            # Calculer le montant restant à imputer
            montant_restant = encaissement.montant_total - total_impute_existant

            # Valider chaque imputation et préparer les objets à créer
            imputations_a_creer = []
            total_imputations = 0

            for imputation_data in imputations:
                cible = imputation_data.get('cible')
                montant = imputation_data.get('montant')

                if montant <= 0:
                    raise ValidationError("Le montant de chaque imputation doit être strictement positif")

                total_imputations += montant

                # Vérifier la cohérence de la cible
                if cible == ImputationEncaissement.Cible.ECHEANCE:
                    echeance_id = imputation_data.get('echeance_id')
                    if not echeance_id:
                        raise ValidationError("L'ID d'échéance est requis pour une cible ECHEANCE")

                    echeance = Echeance.objects.select_for_update().get(id=echeance_id)
                    # Vérifier que l'échéance appartient bien à la même inscription
                    if echeance.inscription_id != encaissement.inscription_id:
                        raise ValidationError(
                            f"L'échéance {echeance_id} n'appartient pas à l'inscription {encaissement.inscription_id}"
                        )

                    # Vérifier que le montant ne dépasse pas le reste à payer
                    reste_a_payer = echeance.reste_a_payer
                    if montant > reste_a_payer:
                        raise ValidationError(
                            f"Le montant de l'imputation ({montant} FCFA) dépasse le reste à payer "
                            f"pour l'échéance {echeance_id} ({reste_a_payer} FCFA)"
                        )

                    imputations_a_creer.append(
                        ImputationEncaissement(
                            encaissement_id=encaissement_id,
                            cible=cible,
                            echeance_id=echeance_id,
                            montant=montant,
                            cree_par_id=cree_par_id
                        )
                    )

                elif cible == ImputationEncaissement.Cible.FRAIS:
                    frais_inscription_id = imputation_data.get('frais_inscription_id')
                    if not frais_inscription_id:
                        raise ValidationError("L'ID de frais d'inscription est requis pour une cible FRAIS")

                    frais_inscription = FraisInscription.objects.select_for_update().get(
                        id=frais_inscription_id
                    )
                    # Vérifier que le frais appartient bien à la même inscription que
                    # l'encaissement (relation directe depuis la correction du modèle
                    # FraisInscription — cf. db/migrations/004_scolarite_facturation.sql).
                    if frais_inscription.inscription_id != encaissement.inscription_id:
                        raise ValidationError(
                            f"Le frais {frais_inscription_id} n'appartient pas à "
                            f"l'inscription {encaissement.inscription_id}"
                        )

                    imputations_a_creer.append(
                        ImputationEncaissement(
                            encaissement_id=encaissement_id,
                            cible=cible,
                            frais_inscription_id=frais_inscription_id,
                            montant=montant,
                            cree_par_id=cree_par_id
                        )
                    )
                else:
                    raise ValidationError(f"Cible invalide: {cible}. Doit être 'ECHEANCE' ou 'FRAIS'")

            # Vérifier que le total des imputations correspond au montant restant
            if total_imputations != montant_restant:
                raise ValidationError(
                    f"Le total des imputations ({total_imputations} FCFA) ne correspond pas "
                    f"au montant restant à imputer ({montant_restant} FCFA)"
                )

            # Créer toutes les imputations
            imputations_creees = ImputationEncaissement.objects.bulk_create(imputations_a_creer)

            # Mettre à jour les échéances concernées (montant_paye et statut)
            for imputation in imputations_creees:
                if imputation.cible == ImputationEncaissement.Cible.ECHEANCE:
                    echeance = Echeance.objects.select_for_update().get(id=imputation.echeance_id)
                    echeance.montant_paye = F('montant_paye') + imputation.montant
                    echeance.save(update_fields=['montant_paye'])

                    # Mettre à jour le statut basé sur le nouveau montant_paye
                    if echeance.est_payee:
                        echeance.statut = Echeance.STATUT_CHOICES[2][0]  # 'payé'
                    elif echeance.montant_paye > 0:
                        echeance.statut = Echeance.STATUT_CHOICES[1][0]  # 'partiellement payé'
                    else:
                        echeance.statut = Echeance.STATUT_CHOICES[0][0]  # 'à payer'
                    echeance.save(update_fields=['statut'])

            logger.info(
                f"Encaissement {encaissement.recu_numero} imputé: "
                f"{len(imputations_creees)} imputations pour un total de {total_imputations} FCFA"
            )

            return imputations_creees

    except Encaissement.DoesNotExist:
        raise ValidationError(f"Encaissement avec l'ID {encaissement_id} introuvable")
    except Exception as e:
        logger.error(f"Erreur lors de l'imputation de l'encaissement: {str(e)}")
        raise


def annuler_encaissement(encaissement_id, annule_par_id=None):
    """
    Annule un encaissement en créant un mouvement inverse et en supprimant les imputations.

    Args:
        encaissement_id (int): ID de l'encaissement à annuler
        annule_par_id (int, optionnel): ID de l'utilisateur à l'origine de l'annulation

    Returns:
        Encaissement: L'encaissement annulé

    Raises:
        ValidationError: Si l'encaissement n'existe pas ou ne peut pas être annulé
    """
    try:
        with transaction.atomic():
            encaissement = Encaissement.objects.select_for_update().get(id=encaissement_id)

            if encaissement.statut == Encaissement.Statut.ANNULE:
                raise ValidationError(f"L'encaissement {encaissement.recu_numero} est déjà annulé")

            # Annuler en supprimant les imputations (cascade supprimera les enregistrements)
            # mais en créant un mouvement inverse pour maintenir l'intégrité du grand livre
            if encaissement.mouvement:
                # Créer un mouvement inverse (débit si c'était un crédit, et vice-versa)
                generer_mouvement_inverse = (
                    generer_mouvement_debit
                    if encaissement.mouvement.sens == Mouvement.Sens.CREDIT
                    else generer_mouvement_credit
                )

                generer_mouvement_inverse(
                    compte_id=encaissement.mouvement.compte_id,
                    montant=encaissement.mouvement.montant,
                    categorie_mouvement_id=encaissement.mouvement.categorie_mouvement_id,
                    libelle=f"Annulation encaissement {encaissement.recu_numero}",
                    piece_reference=f"ANN-{encaissement.recu_numero}",
                    ecole_id=encaissement.mouvement.ecole_id,
                    annee_scolaire_id=encaissement.mouvement.annee_scolaire_id,
                    cree_par_id=annule_par_id
                )

            # Marquer l'encaissement comme annulé
            encaissement.statut = Encaissement.Statut.ANNULE
            encaissement.save(update_fields=['statut'])

            logger.info(f"Encaissement {encaissement.recu_numero} annulé")
            return encaissement

    except Encaissement.DoesNotExist:
        raise ValidationError(f"Encaissement avec l'ID {encaissement_id} introuvable")
    except Exception as e:
        logger.error(f"Erreur lors de l'annulation de l'encaissement: {str(e)}")
        raise


encaissement_service = types.SimpleNamespace(
    creer_encaissement=creer_encaissement,
    generer_numero_recu_unique=generer_numero_recu_unique,
    get_categorie_entree_encaissement_par_defaut=get_categorie_entree_encaissement_par_defaut,
    imputer_encaissement=imputer_encaissement,
    annuler_encaissement=annuler_encaissement
)
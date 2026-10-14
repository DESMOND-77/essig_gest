# backend/rh_paie/views.py
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.core.exceptions import ValidationError
from core.viewsets import _BaseCrudViewSet
from .models import (
    Enseignant, PersonnelAdministratif, AffectationEnseignement,
    SalaireEnseignant, SalaireAdministration, AvancePersonnel
)
from .serializers import (
    EnseignantSerializer, PersonnelAdministratifSerializer,
    AffectationEnseignementSerializer, SalaireEnseignantSerializer,
    SalaireAdministrationSerializer, AvancePersonnelSerializer
)
from .permissions import RH_PaiePermission, RH_PaieValidationPermission
from .services import (
    enseignant_service, personnel_administratif_service,
    affectation_enseignement_service, salaire_enseignant_service,
    salaire_administration_service, avance_personnel_service
)
from tresorerie.models import Mouvement, CategorieMouvement
from tresorerie.services import depense_service
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)


class _BaseRhPaieViewSet(_BaseCrudViewSet):
    """Base commune aux ViewSets rh_paie : apporte `AuditLogMixin` (journal d'audit sur
    create/update/destroy) et `SuppressionProtegeeMixin` (409 propre au lieu d'un 500 brut sur
    un RESTRICT/PROTECT) — alignement avec referentiel/personnes/scolarite (cf. audit du
    2026-10-14 : rh_paie dérivait directement de `viewsets.ModelViewSet`, sans ces garanties)."""
    permission_classes = [RH_PaiePermission]


class EnseignantViewSet(_BaseRhPaieViewSet):
    """ViewSet pour gérer les enseignants"""
    queryset = Enseignant.objects.all()
    serializer_class = EnseignantSerializer

    def get_queryset(self):
        queryset = Enseignant.objects.all()
        # Filtrer par actif/inactif si spécifié
        actif = self.request.query_params.get('actif', None)
        if actif is not None:
            queryset = queryset.filter(actif=actif.lower() == 'true')
        # Filtrer par statut si spécifié
        statut = self.request.query_params.get('statut', None)
        if statut:
            queryset = queryset.filter(statut=statut)
        # Filtrer par spécialité si spécifié (recherche partielle)
        specialite = self.request.query_params.get('specialite', None)
        if specialite:
            queryset = queryset.filter(specialite__icontains=specialite)
        return queryset.order_by('nom', 'prenom')


    @action(detail=True, methods=['post'], permission_classes=[RH_PaieValidationPermission])
    def desactiver(self, request, pk=None):
        """Désactiver un enseignant"""
        enseignant = self.get_object()
        if not enseignant.actif:
            return Response(
                {'error': 'L\'enseignant est déjà désactivé'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            enseignant.actif = False
            enseignant.modifie_par = request.user
            enseignant.save()
            serializer = self.get_serializer(enseignant)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Erreur lors de la désactivation de l'enseignant {enseignant.id}: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'], permission_classes=[RH_PaieValidationPermission])
    def activer(self, request, pk=None):
        """Activer un enseignant"""
        enseignant = self.get_object()
        if enseignant.actif:
            return Response(
                {'error': 'L\'enseignant est déjà activé'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            enseignant.actif = True
            enseignant.modifie_par = request.user
            enseignant.save()
            serializer = self.get_serializer(enseignant)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Erreur lors de l'activation de l'enseignant {enseignant.id}: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class PersonnelAdministratifViewSet(_BaseRhPaieViewSet):
    """ViewSet pour gérer le personnel administratif"""
    queryset = PersonnelAdministratif.objects.all()
    serializer_class = PersonnelAdministratifSerializer

    def get_queryset(self):
        queryset = PersonnelAdministratif.objects.all()
        # Filtrer par actif/inactif si spécifié
        actif = self.request.query_params.get('actif', None)
        if actif is not None:
            queryset = queryset.filter(actif=actif.lower() == 'true')
        # Filtrer par poste si spécifié (recherche partielle)
        poste = self.request.query_params.get('poste', None)
        if poste:
            queryset = queryset.filter(poste__icontains=poste)
        # Filtrer par école si spécifié
        ecole_id = self.request.query_params.get('ecole', None)
        if ecole_id:
            queryset = queryset.filter(ecole_id=ecole_id)
        return queryset.order_by('nom', 'prenom')


    @action(detail=True, methods=['post'], permission_classes=[RH_PaieValidationPermission])
    def desactiver(self, request, pk=None):
        """Désactiver un personnel administratif"""
        personnel = self.get_object()
        if not personnel.actif:
            return Response(
                {'error': 'Le personnel administratif est déjà désactivé'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            personnel.actif = False
            personnel.modifie_par = request.user
            personnel.save()
            serializer = self.get_serializer(personnel)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Erreur lors de la désactivation du personnel administratif {personnel.id}: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'], permission_classes=[RH_PaieValidationPermission])
    def activer(self, request, pk=None):
        """Activer un personnel administratif"""
        personnel = self.get_object()
        if personnel.actif:
            return Response(
                {'error': 'Le personnel administratif est déjà activé'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            personnel.actif = True
            personnel.modifie_par = request.user
            personnel.save()
            serializer = self.get_serializer(personnel)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Erreur lors de l'activation du personnel administratif {personnel.id}: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class AffectationEnseignementViewSet(_BaseRhPaieViewSet):
    """ViewSet pour gérer les affectations d'enseignement"""
    queryset = AffectationEnseignement.objects.all()
    serializer_class = AffectationEnseignementSerializer

    def get_queryset(self):
        queryset = AffectationEnseignement.objects.all()
        # Filtrer par enseignant si spécifié
        enseignant_id = self.request.query_params.get('enseignant', None)
        if enseignant_id:
            queryset = queryset.filter(enseignant_id=enseignant_id)
        # Filtrer par matière si spécifié
        matiere_id = self.request.query_params.get('matiere', None)
        if matiere_id:
            queryset = queryset.filter(matiere_id=matiere_id)
        # Filtrer par classe si spécifié
        classe_id = self.request.query_params.get('classe', None)
        if classe_id:
            queryset = queryset.filter(classe_id=classe_id)
        # Filtrer par année scolaire si spécifié
        annee_scolaire_id = self.request.query_params.get('annee_scolaire', None)
        if annee_scolaire_id:
            queryset = queryset.filter(annee_scolaire_id=annee_scolaire_id)
        return queryset.order_by('-annee_scolaire', '-id')


    @action(detail=False, methods=['get'])
    def par_enseignant(self, request):
        """Récupérer toutes les affectations d'un enseignant"""
        enseignant_id = request.query_params.get('enseignant_id', None)
        if not enseignant_id:
            return Response(
                {'error': 'Paramètre enseignant_id requis'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            affectations = affectation_enseignement_service.get_affectations_for_enseignant(
                enseignant_id=enseignant_id
            )
            serializer = self.get_serializer(affectations, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Erreur lors de la récupération des affectations pour l'enseignant {enseignant_id}: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def par_classe(self, request):
        """Récupérer toutes les affectations d'une classe"""
        classe_id = request.query_params.get('classe_id', None)
        if not classe_id:
            return Response(
                {'error': 'Paramètre classe_id requis'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            affectations = affectation_enseignement_service.get_affectations_for_classe(
                classe_id=classe_id
            )
            serializer = self.get_serializer(affectations, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Erreur lors de la récupération des affectations pour la classe {classe_id}: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class SalaireEnseignantViewSet(_BaseRhPaieViewSet):
    """ViewSet pour gérer les salaires des enseignants"""
    queryset = SalaireEnseignant.objects.all()
    serializer_class = SalaireEnseignantSerializer

    def get_queryset(self):
        queryset = SalaireEnseignant.objects.all()
        # Filtrer par enseignant si spécifié
        enseignant_id = self.request.query_params.get('enseignant', None)
        if enseignant_id:
            queryset = queryset.filter(enseignant_id=enseignant_id)
        # Filtrer par année scolaire si spécifié
        annee_scolaire_id = self.request.query_params.get('annee_scolaire', None)
        if annee_scolaire_id:
            queryset = queryset.filter(annee_scolaire_id=annee_scolaire_id)
        # Filtrer par mois si spécifié
        mois = self.request.query_params.get('mois', None)
        if mois:
            queryset = queryset.filter(mois=mois)
        # Filtrer par compte si spécifié
        compte_id = self.request.query_params.get('compte', None)
        if compte_id:
            queryset = queryset.filter(compte_id=compte_id)
        return queryset.order_by('-annee_scolaire', '-mois', '-id')


    @action(detail=True, methods=['post'], permission_classes=[RH_PaieValidationPermission])
    def valider(self, request, pk=None):
        """Valider un salaire d'enseignant"""
        try:
            salaire = salaire_enseignant_service.valider_salaire_enseignant(
                salaire_id=pk,
                utilisateur_id=request.user.id
            )
            serializer = self.get_serializer(salaire)
            return Response(
                {'message': 'Salaire validé avec succès', 'data': serializer.data},
                status=status.HTTP_200_OK
            )
        except ValidationError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Erreur lors de la validation du salaire d'enseignant {pk}: {str(e)}")
            return Response(
                {'error': 'Une erreur inattendue est survenue lors de la validation.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'], permission_classes=[RH_PaieValidationPermission])
    def payer(self, request, pk=None):
        """Payer un salaire d'enseignant"""
        # S'assurer que l'objet existe et que la permission d'objet s'applique (404/403)
        self.get_object()

        try:
            with transaction.atomic():
                # Verrouiller la ligne pour la durée de la transaction : empêche deux requêtes
                # concurrentes de passer toutes les deux le check d'idempotence ci-dessous.
                salaire = SalaireEnseignant.objects.select_for_update().get(pk=pk)

                # Check if already paid (idempotent)
                if salaire.mouvement:
                    return Response(
                        {'message': 'Le salaire est déjà payé', 'mouvement_id': salaire.mouvement},
                        status=status.HTTP_200_OK
                    )

                # Check that the salary is in VALIDÉ status before paying
                if salaire.statut != 'VALIDÉ':
                    return Response(
                        {'error': f'Le salaire ne peut pas être payé car son statut est {salaire.get_statut_display()}. Seul un salaire validé peut être payé.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Validate mandatory data (same as in valider action)
                if not salaire.enseignant:
                    return Response(
                        {'error': 'L\'enseignant est manquant'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                if not salaire.annee_scolaire:
                    return Response(
                        {'error': 'L\'année scolaire est manquante'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                if not salaire.mois:
                    return Response(
                        {'error': 'Le mois est manquant'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                if salaire.montant is None or salaire.montant <= 0:
                    return Response(
                        {'error': 'Le montant doit être positif'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                if not salaire.compte:
                    return Response(
                        {'error': 'Le compte est manquant'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Get or create the categorie_mouvement for salaries
                try:
                    categorie = CategorieMouvement.objects.get(code='SALAIRE')
                except CategorieMouvement.DoesNotExist:
                    return Response(
                        {'error': "Catégorie de mouvement 'SALAIRE' introuvable. Veuillez la créer dans la trésorerie."},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )

                # Determine ecole from affectation if available
                ecole = None
                if salaire.affectation_enseignement and salaire.affectation_enseignement.classe and salaire.affectation_enseignement.classe.ecole:
                    ecole = salaire.affectation_enseignement.classe.ecole

                # Use the depense service to create the expenditure movement
                depense = depense_service.creer_depense(
                    date=salaire.date_paiement,
                    categorie_mouvement_id=categorie.id,
                    beneficiaire=f"{salaire.enseignant.nom} {salaire.enseignant.prenom}",
                    designation=f"Salaire {salaire.enseignant.nom} {salaire.enseignant.prenom} pour {salaire.get_mois_display()} {salaire.annee_scolaire}",
                    montant=salaire.montant,
                    compte_id=salaire.compte.id,
                    ecole_id=ecole.id if ecole else None,
                    annee_scolaire_id=salaire.annee_scolaire.id,
                    piece_justificative=f"Salaire Enseignant ID: {salaire.id}",
                    engage_par_id=request.user.id,
                    cree_par_id=request.user.id
                )

                # Update the salaire with the mouvement id from the depense and audit info
                salaire.mouvement = depense.mouvement.id
                salaire.statut = 'PAYÉ'
                salaire.modifie_par = request.user
                salaire.modifie_le = timezone.now()
                salaire.save()

            return Response(
                {'message': 'Salaire payé avec succès', 'mouvement_id': depense.mouvement.id},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            logger.error(f"Erreur lors du paiement du salaire d'enseignant {pk}: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class SalaireAdministrationViewSet(_BaseRhPaieViewSet):
    """ViewSet pour gérer les salaires du personnel administratif"""
    queryset = SalaireAdministration.objects.all()
    serializer_class = SalaireAdministrationSerializer

    def get_queryset(self):
        queryset = SalaireAdministration.objects.all()
        # Filtrer par personnel administratif si spécifié
        personnel_administratif_id = self.request.query_params.get('personnel_administratif', None)
        if personnel_administratif_id:
            queryset = queryset.filter(personnel_administratif_id=personnel_administratif_id)
        # Filtrer par année scolaire si spécifié
        annee_scolaire_id = self.request.query_params.get('annee_scolaire', None)
        if annee_scolaire_id:
            queryset = queryset.filter(annee_scolaire_id=annee_scolaire_id)
        # Filtrer par mois si spécifié
        mois = self.request.query_params.get('mois', None)
        if mois:
            queryset = queryset.filter(mois=mois)
        # Filtrer par compte si spécifié
        compte_id = self.request.query_params.get('compte', None)
        if compte_id:
            queryset = queryset.filter(compte_id=compte_id)
        return queryset.order_by('-annee_scolaire', '-mois', '-id')


    @action(detail=True, methods=['post'], permission_classes=[RH_PaieValidationPermission])
    def valider(self, request, pk=None):
        """Valider un salaire du personnel administratif"""
        try:
            salaire = salaire_administration_service.valider_salaire_administration(
                salaire_id=pk,
                utilisateur_id=request.user.id
            )
            serializer = self.get_serializer(salaire)
            return Response(
                {'message': 'Salaire validé avec succès', 'data': serializer.data},
                status=status.HTTP_200_OK
            )
        except ValidationError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Erreur lors de la validation du salaire d'administration {pk}: {str(e)}")
            return Response(
                {'error': 'Une erreur inattendue est survenue lors de la validation.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'], permission_classes=[RH_PaieValidationPermission])
    def payer(self, request, pk=None):
        """Payer un salaire du personnel administratif"""
        # S'assurer que l'objet existe et que la permission d'objet s'applique (404/403)
        self.get_object()

        try:
            with transaction.atomic():
                # Verrouiller la ligne pour la durée de la transaction : empêche deux requêtes
                # concurrentes de passer toutes les deux le check d'idempotence ci-dessous.
                salaire = SalaireAdministration.objects.select_for_update().get(pk=pk)

                # Check if already paid (idempotent)
                if salaire.mouvement:
                    return Response(
                        {'message': 'Le salaire est déjà payé', 'mouvement_id': salaire.mouvement},
                        status=status.HTTP_200_OK
                    )

                # Check that the salary is in VALIDÉ status before paying
                if salaire.statut != 'VALIDÉ':
                    return Response(
                        {'error': f'Le salaire ne peut pas être payé car son statut est {salaire.get_statut_display()}. Seul un salaire validé peut être payé.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Validate mandatory data (same as in valider action)
                if not salaire.personnel_administratif:
                    return Response(
                        {'error': 'Le personnel administratif est manquant'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                if not salaire.annee_scolaire:
                    return Response(
                        {'error': 'L\'année scolaire est manquante'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                if not salaire.mois:
                    return Response(
                        {'error': 'Le mois est manquant'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                if salaire.montant_du is None or salaire.montant_du <= 0:
                    return Response(
                        {'error': 'Le montant dû doit être positif'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                if salaire.montant_paye is None or salaire.montant_paye <= 0:
                    return Response(
                        {'error': 'Le montant payé doit être positif'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                # Amount consistency: montant_paye should equal montant_du for full payment
                if salaire.montant_paye != salaire.montant_du:
                    return Response(
                        {'error': 'Le montant payé doit être égal au montant dû pour paiement'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                if not salaire.compte:
                    return Response(
                        {'error': 'Le compte est manquant'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Get or create the categorie_mouvement for salaries
                try:
                    categorie = CategorieMouvement.objects.get(code='SALAIRE')
                except CategorieMouvement.DoesNotExist:
                    return Response(
                        {'error': "Catégorie de mouvement 'SALAIRE' introuvable. Veuillez la créer dans la trésorerie."},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )

                # Determine ecole from personnel_administratif
                ecole = None
                if salaire.personnel_administratif and salaire.personnel_administratif.ecole:
                    ecole = salaire.personnel_administratif.ecole

                # Use the depense service to create the expenditure movement
                depense = depense_service.creer_depense(
                    date=salaire.date_paiement,
                    categorie_mouvement_id=categorie.id,
                    beneficiaire=f"{salaire.personnel_administratif.nom} {salaire.personnel_administratif.prenom}",
                    designation=f"Salaire {salaire.personnel_administratif.nom} {salaire.personnel_administratif.prenom} pour {salaire.get_mois_display()} {salaire.annee_scolaire}",
                    montant=salaire.montant_paye,  # Use the amount actually paid
                    compte_id=salaire.compte.id,
                    ecole_id=ecole.id if ecole else None,
                    annee_scolaire_id=salaire.annee_scolaire.id,
                    piece_justificative=f"Salaire Administration ID: {salaire.id}",
                    engage_par_id=request.user.id,
                    cree_par_id=request.user.id
                )

                # Update the salaire with the mouvement id from the depense and audit info
                salaire.mouvement = depense.mouvement.id
                salaire.statut = 'PAYÉ'
                salaire.modifie_par = request.user
                salaire.modifie_le = timezone.now()
                salaire.save()

            return Response(
                {'message': 'Salaire payé avec succès', 'mouvement_id': depense.mouvement.id},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            logger.error(f"Erreur lors du paiement du salaire d'administration {pk}: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class AvancePersonnelViewSet(_BaseRhPaieViewSet):
    """ViewSet pour gérer les avances au personnel"""
    queryset = AvancePersonnel.objects.all()
    serializer_class = AvancePersonnelSerializer

    def get_queryset(self):
        queryset = AvancePersonnel.objects.all()
        # Filtrer par bénéficiaire si spécifié
        beneficiaire = self.request.query_params.get('beneficiaire', None)
        if beneficiaire:
            queryset = queryset.filter(beneficiaire=beneficiaire)
        # Filtrer par enseignant si spécifié
        enseignant_id = self.request.query_params.get('enseignant', None)
        if enseignant_id:
            queryset = queryset.filter(enseignant_id=enseignant_id)
        # Filtrer par personnel administratif si spécifié
        personnel_administratif_id = self.request.query_params.get('personnel_administratif', None)
        if personnel_administratif_id:
            queryset = queryset.filter(personnel_administratif_id=personnel_administratif_id)
        # Filtrer par compte si spécifié
        compte_id = self.request.query_params.get('compte', None)
        if compte_id:
            queryset = queryset.filter(compte_id=compte_id)
        # Filtrer par date si spécifié (plage de dates)
        date_debut = self.request.query_params.get('date_debut', None)
        date_fin = self.request.query_params.get('date_fin', None)
        if date_debut:
            queryset = queryset.filter(date__gte=date_debut)
        if date_fin:
            queryset = queryset.filter(date__lte=date_fin)
        # Filtrer par régularisation si spécifié
        regularisee = self.request.query_params.get('regularisee', None)
        if regularisee is not None:
            queryset = queryset.filter(regularisee=regularisee.lower() == 'true')
        return queryset.order_by('-date', '-id')


    @action(detail=True, methods=['post'], permission_classes=[RH_PaieValidationPermission])
    def regulariser(self, request, pk=None):
        """Régulariser une avance sur un salaire"""
        avance = self.get_object()
        if avance.regularisee:
            return Response(
                {'error': 'L\'avance est déjà régulée'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            avance = avance_personnel_service.regulariser_avance(
                avance_id=avance.id,
                regularise_par_id=request.user.id
            )
            serializer = self.get_serializer(avance)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Erreur lors de la régularisation de l'avance {avance.id}: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
# backend/tresorerie/views.py
from rest_framework import viewsets, status, filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError as DRFValidationError
from drf_spectacular.utils import extend_schema
from drf_spectacular.types import OpenApiTypes
from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.http import HttpResponse
from datetime import date
from core.pdf import render_pdf
from rapports.views import situation_scolarite_ligne
from .models import (
    Compte, CategorieMouvement, Virement, Mouvement, Encaissement,
    ImputationEncaissement, Depense, ArreteCaisse, Billetage
)
from .serializers import (
    CompteSerializer, CategorieMouvementSerializer, VirementSerializer,
    MouvementSerializer, EncaissementSerializer, ImputationEncaissementSerializer,
    DepenseSerializer, ArreteCaisseSerializer, BilletageSerializer
)
from .permissions import TresoreriePermission, TresorerieValidationPermission, IsCompteOwnerOrReadOnly
from .services import compte_service, categorie_mouvement_service, mouvement_service
from .services import virement_service, encaissement_service, depense_service
from .services import arrete_caisse_service, dashboard_service
import logging

logger = logging.getLogger(__name__)


class CompteViewSet(viewsets.ModelViewSet):
    """ViewSet pour gérer les comptes"""
    queryset = Compte.objects.all()
    serializer_class = CompteSerializer
    permission_classes = [TresoreriePermission, IsCompteOwnerOrReadOnly]

    def get_queryset(self):
        queryset = Compte.objects.all()
        # Filtrer par actif/inactif si spécifié
        actif = self.request.query_params.get('actif', None)
        if actif is not None:
            queryset = queryset.filter(actif=actif.lower() == 'true')
        # Filtrer par type de compte
        type_compte = self.request.query_params.get('type', None)
        if type_compte:
            queryset = queryset.filter(type=type_compte)
        return queryset.order_by('code')


class CategorieMouvementViewSet(viewsets.ModelViewSet):
    """ViewSet pour gérer les catégories de mouvement"""
    queryset = CategorieMouvement.objects.all()
    serializer_class = CategorieMouvementSerializer
    permission_classes = [TresoreriePermission]

    def get_queryset(self):
        queryset = CategorieMouvement.objects.all()
        # Filtrer par sens si spécifié
        sens = self.request.query_params.get('sens', None)
        if sens:
            queryset = queryset.filter(sens=sens)
        return queryset.order_by('code')


class VirementViewSet(viewsets.ModelViewSet):
    """ViewSet pour gérer les virements"""
    queryset = Virement.objects.all()
    serializer_class = VirementSerializer
    permission_classes = [TresoreriePermission]

    def get_queryset(self):
        queryset = Virement.objects.all()
        # Filtrer par statut si spécifié
        statut = self.request.query_params.get('statut', None)
        if statut:
            queryset = queryset.filter(statut=statut)
        # Filtrer par compte source ou destination
        compte_source = self.request.query_params.get('compte_source', None)
        if compte_source:
            queryset = queryset.filter(compte_source_id=compte_source)
        compte_destination = self.request.query_params.get('compte_destination', None)
        if compte_destination:
            queryset = queryset.filter(compte_destination_id=compte_destination)
        return queryset.order_by('-date')

    def perform_create(self, serializer):
        # Toujours créé en BROUILLON (statut en lecture seule côté serializer) : le virement
        # suit ensuite le flux `engager` (soumission, EN_ATTENTE_VALIDATION) puis `valider`
        # (création des deux mouvements, VALIDE).
        serializer.save(cree_par=self.request.user)

    @action(detail=True, methods=['post'])
    def engager(self, request, pk=None):
        """Soumettre un virement brouillon pour validation (maker)"""
        virement = self.get_object()
        if virement.statut != Virement.Statut.BROUILLON:
            return Response(
                {'error': 'Seul un virement en brouillon peut être engagé'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            virement = virement_service.engager_virement(
                virement_id=virement.id,
                engage_par_id=request.user.id
            )
            serializer = self.get_serializer(virement)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Erreur lors de l'engagement du virement {virement.id}: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'], permission_classes=[TresorerieValidationPermission])
    def valider(self, request, pk=None):
        """Valider un virement en attente de validation (checker) : crée les mouvements"""
        virement = self.get_object()
        if virement.statut != Virement.Statut.EN_ATTENTE_VALIDATION:
            return Response(
                {'error': 'Seul un virement en attente de validation peut être validé'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            virement = virement_service.valider_virement(
                virement_id=virement.id,
                valide_par_id=request.user.id
            )
            serializer = self.get_serializer(virement)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Erreur lors de la validation du virement {virement.id}: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'], permission_classes=[TresorerieValidationPermission])
    def annuler(self, request, pk=None):
        """Annuler un virement"""
        virement = self.get_object()
        if virement.statut == Virement.Statut.ANNULE:
            return Response(
                {'error': 'Le virement est déjà annulé'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            virement = virement_service.annuler_virement(
                virement_id=virement.id,
                annule_par_id=request.user.id
            )
            serializer = self.get_serializer(virement)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Erreur lors de l'annulation du virement {virement.id}: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class MouvementViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet pour gérer les mouvements (lecture seule selon les spécifications)"""
    queryset = Mouvement.objects.filter(valide=True)
    serializer_class = MouvementSerializer
    permission_classes = [TresoreriePermission]

    def get_queryset(self):
        queryset = Mouvement.objects.filter(valide=True)
        # Filtrer par compte si spécifié
        compte_id = self.request.query_params.get('compte', None)
        if compte_id:
            queryset = queryset.filter(compte_id=compte_id)
        # Filtrer par sens si spécifié
        sens = self.request.query_params.get('sens', None)
        if sens:
            queryset = queryset.filter(sens=sens)
        # Filtrer par catégorie si spécifié
        categorie_id = self.request.query_params.get('categorie', None)
        if categorie_id:
            queryset = queryset.filter(categorie_mouvement_id=categorie_id)
        # Filtrer par virement si spécifié
        virement_id = self.request.query_params.get('virement', None)
        if virement_id:
            queryset = queryset.filter(virement_id=virement_id)
        # Filtrer par plage de dates
        date_debut = self.request.query_params.get('date_debut', None)
        date_fin = self.request.query_params.get('date_fin', None)
        if date_debut:
            queryset = queryset.filter(date_operation__gte=date_debut)
        if date_fin:
            queryset = queryset.filter(date_operation__lte=date_fin)
        return queryset.order_by('-date_operation', '-id')

    @action(detail=False, methods=['get'])
    def piece(self, request):
        """Générer la pièce justificative d'un mouvement (PDF)"""
        mouvement_id = request.query_params.get('id', None)
        if not mouvement_id:
            return Response(
                {'error': 'Paramètre id requis'},
                status=status.HTTP_400_BAD_REQUEST
            )

        mouvement = get_object_or_404(Mouvement, id=mouvement_id)
        # Ici on générerait le PDF - pour l'instant on retourne juste les données
        serializer = self.get_serializer(mouvement)
        return Response({
            'mouvement': serializer.data,
            'message': 'La génération de pièce justificative PDF serait implémentée ici'
        })


class EncaissementViewSet(viewsets.ModelViewSet):
    """ViewSet pour gérer les encaissements"""
    queryset = Encaissement.objects.all()
    serializer_class = EncaissementSerializer
    permission_classes = [TresoreriePermission]
    # Ce ViewSet ne dérive pas de `core.viewsets._BaseCrudViewSet` (filtrage manuel via
    # `get_queryset` ci-dessous) : `SearchFilter` n'est donc pas actif par défaut, il faut le
    # déclarer explicitement pour permettre la recherche par reçu/étudiant (§19 du mandat).
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "recu_numero",
        "inscription__etudiant__matricule",
        "inscription__etudiant__nom",
        "inscription__etudiant__prenoms",
    ]

    def get_queryset(self):
        queryset = Encaissement.objects.all()
        # Filtrer par inscription si spécifié
        inscription_id = self.request.query_params.get('inscription', None)
        if inscription_id:
            queryset = queryset.filter(inscription_id=inscription_id)
        # Filtrer par compte si spécifié
        compte_id = self.request.query_params.get('compte', None)
        if compte_id:
            queryset = queryset.filter(compte_id=compte_id)
        # Filtrer par mode si spécifié
        mode = self.request.query_params.get('mode', None)
        if mode:
            queryset = queryset.filter(mode=mode)
        # Filtrer par statut si spécifié
        statut = self.request.query_params.get('statut', None)
        if statut:
            queryset = queryset.filter(statut=statut)
        # Filtrer par plage de dates
        date_debut = self.request.query_params.get('date_debut', None)
        date_fin = self.request.query_params.get('date_fin', None)
        if date_debut:
            queryset = queryset.filter(date__gte=date_debut)
        if date_fin:
            queryset = queryset.filter(date__lte=date_fin)
        return queryset.order_by('-date', '-id')

    def perform_create(self, serializer):
        # `recu_numero` et `mouvement` ne peuvent pas venir du serializer (lecture seule) :
        # `creer_encaissement` les génère lui-même et poste le mouvement CREDIT associé.
        validated = serializer.validated_data
        try:
            encaissement = encaissement_service.creer_encaissement(
                inscription_id=validated['inscription'].id,
                montant_total=validated['montant_total'],
                mode=validated['mode'],
                compte_id=validated['compte'].id,
                date=validated.get('date'),
                cree_par_id=self.request.user.id
            )
        except DjangoValidationError as e:
            raise DRFValidationError(e.messages) from e
        serializer.instance = encaissement

    @action(detail=True, methods=['post'], permission_classes=[TresorerieValidationPermission])
    def valider(self, request, pk=None):
        """Valider un encaissement"""
        encaissement = self.get_object()
        if encaissement.statut != Encaissement.Statut.EN_COURS:
            return Response(
                {'error': 'Seul un encaissement en cours peut être validé'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Dans une implémentation complète, on appellerait un service de validation
            # Pour l'instant, on change simplement le statut
            encaissement.statut = Encaissement.Statut.VALIDE
            encaissement.valide_par = request.user
            encaissement.save()
            serializer = self.get_serializer(encaissement)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Erreur lors de la validation de l'encaissement {encaissement.id}: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'], permission_classes=[TresorerieValidationPermission])
    def annuler(self, request, pk=None):
        """Annuler un encaissement"""
        encaissement = self.get_object()
        try:
            encaissement = encaissement_service.annuler_encaissement(
                encaissement_id=encaissement.id,
                annule_par_id=request.user.id
            )
            serializer = self.get_serializer(encaissement)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Erreur lors de l'annulation de l'encaissement {encaissement.id}: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def imputer(self, request, pk=None):
        """Imputer un encaissement sur des échéances et/ou frais"""
        encaissement = self.get_object()
        imputations = request.data.get('imputations', [])

        if not imputations:
            return Response(
                {'error': 'Aucune imputation fournie'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            imputations_creees = encaissement_service.imputer_encaissement(
                encaissement_id=encaissement.id,
                imputations=imputations,
                cree_par_id=request.user.id
            )
            serializer = ImputationEncaissementSerializer(imputations_creees, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Erreur lors de l'imputation de l'encaissement {encaissement.id}: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['get'])
    def recu(self, request, pk=None):
        """Générer le reçu d'un encaissement (PDF)"""
        encaissement = self.get_object()
        imputations = ImputationEncaissement.objects.filter(
            encaissement=encaissement
        ).select_related("echeance", "frais_inscription__type_frais")
        situation = situation_scolarite_ligne(encaissement.inscription)
        pdf_bytes = render_pdf(
            "pdf/recu.html",
            {
                "encaissement": encaissement,
                "imputations": imputations,
                "situation": situation,
                "date_generation": date.today(),
            },
        )
        disposition = request.query_params.get("disposition", "inline")
        disposition = "attachment" if disposition == "attachment" else "inline"
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = (
            f'{disposition}; filename="recu_{encaissement.recu_numero}.pdf"'
        )
        return response


class ImputationEncaissementViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet pour gérer les imputations d'encaissement (lecture seule)"""
    queryset = ImputationEncaissement.objects.all()
    serializer_class = ImputationEncaissementSerializer
    permission_classes = [TresoreriePermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "encaissement__recu_numero",
        "encaissement__inscription__etudiant__matricule",
        "encaissement__inscription__etudiant__nom",
        "encaissement__inscription__etudiant__prenoms",
    ]

    def get_queryset(self):
        queryset = ImputationEncaissement.objects.all()
        # Filtrer par encaissement si spécifié
        encaissement_id = self.request.query_params.get('encaissement', None)
        if encaissement_id:
            queryset = queryset.filter(encaissement_id=encaissement_id)
        # Filtrer par cible si spécifié
        cible = self.request.query_params.get('cible', None)
        if cible:
            queryset = queryset.filter(cible=cible)
        # Filtrer par échéance si spécifié
        echeance_id = self.request.query_params.get('echeance', None)
        if echeance_id:
            queryset = queryset.filter(echeance_id=echeance_id)
        # Filtrer par frais d'inscription si spécifié
        frais_inscription_id = self.request.query_params.get('frais_inscription', None)
        if frais_inscription_id:
            queryset = queryset.filter(frais_inscription_id=frais_inscription_id)
        return queryset.order_by('-cree_le')


class DepenseViewSet(viewsets.ModelViewSet):
    """ViewSet pour gérer les dépenses"""
    queryset = Depense.objects.all()
    serializer_class = DepenseSerializer
    permission_classes = [TresoreriePermission]

    def get_queryset(self):
        queryset = Depense.objects.all()
        # Filtrer par compte si spécifié
        compte_id = self.request.query_params.get('compte', None)
        if compte_id:
            queryset = queryset.filter(compte_id=compte_id)
        # Filtrer par catégorie si spécifié
        categorie_id = self.request.query_params.get('categorie', None)
        if categorie_id:
            queryset = queryset.filter(categorie_mouvement_id=categorie_id)
        # Filtrer par bénéficiaire si spécifié (recherche partielle)
        beneficiaire = self.request.query_params.get('beneficiaire', None)
        if beneficiaire:
            queryset = queryset.filter(beneficiaire__icontains=beneficiaire)
        # Filtrer par statut si spécifié
        statut = self.request.query_params.get('statut', None)
        if statut:
            queryset = queryset.filter(statut=statut)
        # Filtrer par plage de dates
        date_debut = self.request.query_params.get('date_debut', None)
        date_fin = self.request.query_params.get('date_fin', None)
        if date_debut:
            queryset = queryset.filter(date__gte=date_debut)
        if date_fin:
            queryset = queryset.filter(date__lte=date_fin)
        return queryset.order_by('-date', '-id')

    def perform_create(self, serializer):
        # `mouvement` n'est même pas exposé par le serializer (requis en base, OneToOne) :
        # sans passer par `creer_depense`, un save() brut lève toujours IntegrityError.
        validated = serializer.validated_data
        try:
            depense = depense_service.creer_depense(
                date=validated['date'],
                categorie_mouvement_id=validated['categorie_mouvement'].id,
                beneficiaire=validated['beneficiaire'],
                designation=validated['designation'],
                montant=validated['montant'],
                compte_id=validated['compte'].id,
                ecole_id=validated['ecole'].id if validated.get('ecole') else None,
                annee_scolaire_id=validated['annee_scolaire'].id,
                piece_justificative=validated.get('piece_justificative'),
                engage_par_id=validated['engage_par'].id if validated.get('engage_par') else None,
                cree_par_id=self.request.user.id
            )
        except DjangoValidationError as e:
            raise DRFValidationError(e.messages) from e
        serializer.instance = depense

    @action(detail=True, methods=['post'], permission_classes=[TresorerieValidationPermission])
    def valider(self, request, pk=None):
        """Valider une dépense engagée"""
        depense = self.get_object()
        if depense.statut != Depense.Statut.ENGAGEE:
            return Response(
                {'error': 'Seule une dépense engagée peut être validée'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            depense_service.valider_depense(
                depense_id=depense.id,
                valide_par_id=request.user.id
            )
            serializer = self.get_serializer(depense)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Erreur lors de la validation de la dépense {depense.id}: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def payer(self, request, pk=None):
        """Marquer une dépense comme payée"""
        depense = self.get_object()
        try:
            depense_service.payer_depense(depense_id=depense.id)
            serializer = self.get_serializer(depense)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Erreur lors du paiement de la dépense {depense.id}: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'], permission_classes=[TresorerieValidationPermission])
    def annuler(self, request, pk=None):
        """Annuler une dépense"""
        depense = self.get_object()
        try:
            depense_service.annuler_depense(depense_id=depense.id)
            serializer = self.get_serializer(depense)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Erreur lors de l'annulation de la dépense {depense.id}: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class ArreteCaisseViewSet(viewsets.ModelViewSet):
    """ViewSet pour gérer les arrêtés de caisse"""
    queryset = ArreteCaisse.objects.all()
    serializer_class = ArreteCaisseSerializer
    permission_classes = [TresoreriePermission]

    def get_queryset(self):
        queryset = ArreteCaisse.objects.all()
        # Filtrer par compte si spécifié
        compte_id = self.request.query_params.get('compte', None)
        if compte_id:
            queryset = queryset.filter(compte_id=compte_id)
        # Filtrer par statut si spécifié
        statut = self.request.query_params.get('statut', None)
        if statut:
            queryset = queryset.filter(statut=statut)
        # Filtrer par plage de dates
        date_debut = self.request.query_params.get('date_debut', None)
        date_fin = self.request.query_params.get('date_fin', None)
        if date_debut:
            queryset = queryset.filter(date__gte=date_debut)
        if date_fin:
            queryset = queryset.filter(date__lte=date_fin)
        return queryset.order_by('-date', '-id')

    @extend_schema(responses=OpenApiTypes.OBJECT)
    @action(detail=False, methods=['get'], url_path='solde-theorique')
    def solde_theorique(self, request):
        """Prévisualisation du solde théorique d'une caisse à une date, avant création de
        l'arrêté (le même calcul que `creer_arrete_caisse` exécute lui-même à la création)."""
        compte_id = request.query_params.get('compte_id')
        date_arrete = request.query_params.get('date')
        if not compte_id or not date_arrete:
            return Response(
                {'error': "Paramètres 'compte_id' et 'date' requis"},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            solde = arrete_caisse_service.calculer_solde_theorique_caisse(compte_id, date_arrete)
        except DjangoValidationError as e:
            raise DRFValidationError(e.messages) from e
        return Response({'solde_theorique': solde})

    def perform_create(self, serializer):
        # `creer_arrete_caisse` calcule `solde_theorique`/`ecart` et refuse les doublons
        # compte+date — un save() brut les laissait tous les deux non vérifiés.
        validated = serializer.validated_data
        try:
            arrete_caisse = arrete_caisse_service.creer_arrete_caisse(
                compte_id=validated['compte'].id,
                date=validated['date'],
                solde_physique=validated['solde_physique'],
                fait_par_id=validated['fait_par'].id if validated.get('fait_par') else None,
                cree_par_id=self.request.user.id
            )
        except DjangoValidationError as e:
            raise DRFValidationError(e.messages) from e
        serializer.instance = arrete_caisse

    @action(detail=True, methods=['post'], permission_classes=[TresorerieValidationPermission])
    def valider(self, request, pk=None):
        """Valider un arrêté de caisse"""
        arrete_caisse = self.get_object()
        if arrete_caisse.statut != ArreteCaisse.Statut.EN_COURS:
            return Response(
                {'error': 'Seul un arrêté en cours peut être validé'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            arrete_caisse_service.valider_arrete_caisse(
                arrete_caisse_id=arrete_caisse.id,
                valide_par_id=request.user.id
            )
            serializer = self.get_serializer(arrete_caisse)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Erreur lors de la validation de l'arrêté de caisse {arrete_caisse.id}: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def billetage(self, request, pk=None):
        """Enregistrer une ligne de billetage pour un arrêté de caisse"""
        arrete_caisse = self.get_object()
        denomination = request.data.get('denomination')
        quantite = request.data.get('quantite')

        if denomination is None or quantite is None:
            return Response(
                {'error': 'Les paramètres denomination et quantite sont requis'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            billetage = arrete_caisse_service.enregistrer_billetage(
                arrete_caisse_id=arrete_caisse.id,
                denomination=denomination,
                quantite=quantite
            )
            serializer = BilletageSerializer(billetage)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Erreur lors de l'enregistrement du billetage pour l'arrêté {arrete_caisse.id}: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def billetage_batch(self, request, pk=None):
        """Enregistrer un lot de lignes de billetage pour un arrêté de caisse (opération atomique)"""
        arrete_caisse = self.get_object()
        lignes = request.data.get('lignes', [])

        if not lignes:
            return Response(
                {'error': 'Aucune ligne de billetage fournie'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Format expected: [{ "denomination": 10000, "quantite": 5 }, ...]
            result = arrete_caisse_service.enregistrer_billetage_batch(
                arrete_caisse_id=arrete_caisse.id,
                lignes=lignes
            )
            return Response(result)
        except Exception as e:
            logger.error(f"Erreur lors de l'enregistrement du billetage batch pour l'arrêté {arrete_caisse.id}: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class BilletageViewSet(viewsets.ModelViewSet):
    """ViewSet pour gérer les lignes de billetage"""
    queryset = Billetage.objects.all()
    serializer_class = BilletageSerializer
    permission_classes = [TresoreriePermission]

    def get_queryset(self):
        queryset = Billetage.objects.all()
        # Filtrer par arrêté de caisse si spécifié
        arrete_caisse_id = self.request.query_params.get('arrete_caisse', None)
        if arrete_caisse_id:
            queryset = queryset.filter(arrete_caisse_id=arrete_caisse_id)
        # Filtrer par dénomination si spécifié
        denomination = self.request.query_params.get('denomination', None)
        if denomination:
            queryset = queryset.filter(denomination=denomination)
        return queryset.order_by('-cree_le')


# ViewSet pour le tableau de bord (actions personnalisées uniquement)
class TableauDeBordViewSet(viewsets.ViewSet):
    """ViewSet pour les endpoints du tableau de bord trésorerie"""
    permission_classes = [TresoreriePermission]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    @action(detail=False, methods=['get'])
    def solde(self, request):
        """Get global balance by account type"""
        try:
            solde_par_type = dashboard_service.get_solde_par_type_de_compte()
            return Response(solde_par_type)
        except Exception as e:
            logger.error(f"Erreur lors de la récupération des soldes par type de compte: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @extend_schema(responses=OpenApiTypes.OBJECT)
    @action(detail=False, methods=['get'])
    def solde_par_compte(self, request):
        """Get balance for each account"""
        try:
            # We'll compute the solde for each active compte
            from .services.compte import calculer_solde_compte
            comptes = Compte.objects.filter(actif=True)
            soldes_par_compte = []
            for compte in comptes:
                solde = calculer_solde_compte(compte.id)
                soldes_par_compte.append({
                    'compte_code': compte.code,
                    'compte_libelle': compte.libelle,
                    'solde': float(solde)
                })
            return Response(soldes_par_compte)
        except Exception as e:
            logger.error(f"Erreur lors de la récupération des soldes par compte: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @extend_schema(responses=OpenApiTypes.OBJECT)
    @action(detail=False, methods=['get'])
    def flux(self, request):
        """Get incoming/outgoing flows for a period"""
        jours = int(request.query_params.get('jours', 30))
        try:
            flux = dashboard_service.get_flux_entrants_sortants(jours=jours)
            return Response(flux)
        except Exception as e:
            logger.error(f"Erreur lors du calcul des flux entrants/sortants: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @extend_schema(responses=OpenApiTypes.OBJECT)
    @action(detail=False, methods=['get'])
    def encaissements_recents(self, request):
        """Get recent encaissements"""
        limit = int(request.query_params.get('limit', 10))
        try:
            encaissements = dashboard_service.get_encaissements_recents(limit=limit)
            return Response(encaissements)
        except Exception as e:
            logger.error(f"Erreur lors de la récupération des encaissements récents: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @extend_schema(responses=OpenApiTypes.OBJECT)
    @action(detail=False, methods=['get'])
    def depenses_recentes(self, request):
        """Get recent expenses"""
        limit = int(request.query_params.get('limit', 10))
        try:
            depenses = dashboard_service.get_depenses_recentes(limit=limit)
            return Response(depenses)
        except Exception as e:
            logger.error(f"Erreur lors de la récupération des dépenses récentes: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @extend_schema(responses=OpenApiTypes.OBJECT)
    @action(detail=False, methods=['get'])
    def ecarts_caisse(self, request):
        """Get important cash discrepancies"""
        limite_montant = int(request.query_params.get('limite_montant', 1000))
        try:
            ecarts = dashboard_service.get_ecarts_caisse_importants(limite_montant=limite_montant)
            return Response(ecarts)
        except Exception as e:
            logger.error(f"Erreur lors de la récupération des écarts de caisse importants: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @extend_schema(responses=OpenApiTypes.OBJECT)
    @action(detail=False, methods=['get'])
    def previsionnel(self, request):
        """Get treasury forecast"""
        jours = int(request.query_params.get('jours', 30))
        try:
            previsionnel = dashboard_service.get_previsionnel_tresorerie(jours=jours)
            return Response(previsionnel)
        except Exception as e:
            logger.error(f"Erreur lors du calcul du prévisionnel de trésorerie: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
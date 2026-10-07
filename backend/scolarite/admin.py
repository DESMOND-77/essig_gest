# backend/scolarite/admin.py
from django.contrib import admin
from .models import ModalitePaiement, TypeFrais, FraisInscription, Echeance, Bourse

@admin.register(ModalitePaiement)
class ModalitePaiementAdmin(admin.ModelAdmin):
    list_display = ('niveau', 'annee_scolaire', 'montant', 'date_creation')
    list_filter = ('niveau', 'annee_scolaire', 'date_creation')
    search_fields = ('niveau__code', 'niveau__libelle', 'annee_scolaire__libelle')
    ordering = ('-date_creation',)
    readonly_fields = ('date_creation', 'date_modification')

@admin.register(TypeFrais)
class TypeFraisAdmin(admin.ModelAdmin):
    list_display = ('libelle', 'code', 'description', 'date_creation')
    list_filter = ('date_creation',)
    search_fields = ('libelle', 'code')
    ordering = ('libelle',)
    readonly_fields = ('date_creation',)

@admin.register(FraisInscription)
class FraisInscriptionAdmin(admin.ModelAdmin):
    list_display = ('niveau', 'annee_scolaire', 'montant', 'date_creation')
    list_filter = ('niveau', 'annee_scolaire', 'date_creation')
    search_fields = ('niveau__code', 'niveau__libelle', 'annee_scolaire__libelle')
    ordering = ('-date_creation',)
    readonly_fields = ('date_creation',)

@admin.register(Echeance)
class EcheanceAdmin(admin.ModelAdmin):
    list_display = ('inscription', 'numero', 'montant', 'montant_paye', 'statut', 'date_echeance')
    list_filter = ('statut', 'date_echeance', 'inscription__etudiant__nom')
    search_fields = ('inscription__etudiant__nom', 'inscription__etudiant__prenom', 'numero')
    ordering = ('inscription', 'numero')
    readonly_fields = ('date_creation',)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('inscription__etudiant')

@admin.register(Bourse)
class BourseAdmin(admin.ModelAdmin):
    list_display = ('etudiant', 'annee_scolaire', 'type', 'get_montant', 'date_attribution')
    list_filter = ('type', 'annee_scolaire', 'date_attribution')
    search_fields = ('etudiant__nom', 'etudiant__prenom', 'annee_scolaire__libelle')
    ordering = ('-date_attribution',)
    readonly_fields = ('date_creation',)

    def get_montant(self, obj):
        if obj.pourcentage is not None:
            return f"{obj.pourcentage}%"
        return f"{obj.montant_fixe} FCFA"
    get_montant.short_description = "Montant pris en charge"

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('etudiant', 'annee_scolaire')
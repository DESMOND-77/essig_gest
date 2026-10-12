# backend/tresorerie/admin.py
from django.contrib import admin
from .models import (
    Compte, CategorieMouvement, Virement, Mouvement, Encaissement,
    ImputationEncaissement, Depense, ArreteCaisse, Billetage
)


@admin.register(Compte)
class CompteAdmin(admin.ModelAdmin):
    list_display = ('code', 'libelle', 'type', 'solde_initial', 'actif', 'cree_le')
    list_filter = ('type', 'actif', 'cree_le')
    search_fields = ('code', 'libelle', 'numero_bancaire', 'banque')
    readonly_fields = ('cree_par', 'cree_le', 'modifie_par', 'modifie_le')

    fieldsets = (
        ('Informations principales', {
            'fields': ('groupe_scolaire', 'code', 'libelle', 'type')
        }),
        ('Informations bancaires', {
            'fields': ('numero_bancaire', 'banque')
        }),
        ('Informations finanzières', {
            'fields': ('solde_initial', 'actif')
        }),
        ('Audit', {
            'fields': ('cree_par', 'cree_le', 'modifie_par', 'modifie_le'),
            'classes': ('collapse',)
        }),
    )


@admin.register(CategorieMouvement)
class CategorieMouvementAdmin(admin.ModelAdmin):
    list_display = ('code', 'libelle', 'sens', 'cree_le')
    list_filter = ('sens', 'cree_le')
    search_fields = ('code', 'libelle')
    readonly_fields = ('cree_par', 'cree_le', 'modifie_par', 'modifie_le')


@admin.register(Virement)
class VirementAdmin(admin.ModelAdmin):
    list_display = ('id', 'compte_source', 'compte_destination', 'montant', 'date', 'statut', 'cree_le')
    list_filter = ('statut', 'date', 'cree_le')
    search_fields = ('motif', 'compte_source__code', 'compte_destination__code')
    readonly_fields = ('cree_par', 'cree_le', 'valide_par', 'modifie_par', 'modifie_le')

    fieldsets = (
        ('Informations du virement', {
            'fields': ('compte_source', 'compte_destination', 'montant', 'date', 'motif')
        }),
        ('Workflow de validation', {
            'fields': ('statut', 'valide_par')
        }),
        ('Audit', {
            'fields': ('cree_par', 'cree_le', 'modifie_par', 'modifie_le'),
            'classes': ('collapse',)
        }),
    )


@admin.register(Mouvement)
class MouvementAdmin(admin.ModelAdmin):
    list_display = ('id', 'compte', 'date_operation', 'sens', 'montant', 'categorie_mouvement', 'valide', 'cree_le')
    list_filter = ('sens', 'valide', 'date_operation', 'categorie_mouvement', 'cree_le')
    search_fields = ('libelle', 'piece_reference', 'compte__code')
    readonly_fields = ('cree_par', 'cree_le', 'modifie_par', 'modifie_le', 'valide')

    # Les mouvements sont en lecture seule selon les spécifications
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    fieldsets = (
        ('Informations du mouvement', {
            'fields': ('compte', 'date_operation', 'sens', 'montant', 'categorie_mouvement', 'libelle', 'piece_reference')
        }),
        ('Informations analytiques', {
            'fields': ('ecole', 'annee_scolaire', 'virement')
        }),
        ('État', {
            'fields': ('valide',)
        }),
        ('Audit', {
            'fields': ('cree_par', 'cree_le', 'modifie_par', 'modifie_le'),
            'classes': ('collapse',)
        }),
    )


@admin.register(Encaissement)
class EncaissementAdmin(admin.ModelAdmin):
    list_display = ('recu_numero', 'date', 'inscription', 'montant_total', 'mode', 'compte', 'statut', 'cree_le')
    list_filter = ('mode', 'statut', 'date', 'cree_le')
    search_fields = ('recu_numero', 'inscription__etudiant__nom', 'inscription__etudiant__prenoms')
    readonly_fields = ('cree_par', 'cree_le', 'modifie_par', 'modifie_le', 'mouvement')

    fieldsets = (
        ('Informations de l\'encaissement', {
            'fields': ('inscription', 'date', 'montant_total', 'mode', 'compte', 'recu_numero')
        }),
        ('Mouvement associé', {
            'fields': ('mouvement',)
        }),
        ('Statut et workflow', {
            'fields': ('statut',)
        }),
        ('Audit', {
            'fields': ('cree_par', 'cree_le', 'modifie_par', 'modifie_le'),
            'classes': ('collapse',)
        }),
    )


@admin.register(ImputationEncaissement)
class ImputationEncaissementAdmin(admin.ModelAdmin):
    list_display = ('id', 'encaissement', 'cible', 'echeance', 'frais_inscription', 'montant', 'cree_le')
    list_filter = ('cible', 'cree_le')
    search_fields = ('encaissement__recu_numero', 'echeance__id', 'frais_inscription__id')
    readonly_fields = ('cree_par', 'cree_le', 'modifie_par', 'modifie_le')

    fieldsets = (
        ('Informations de l\'imputation', {
            'fields': ('encaissement', 'cible', 'echeance', 'frais_inscription', 'montant')
        }),
        ('Audit', {
            'fields': ('cree_par', 'cree_le', 'modifie_par', 'modifie_le'),
            'classes': ('collapse',)
        }),
    )


@admin.register(Depense)
class DepenseAdmin(admin.ModelAdmin):
    list_display = ('id', 'date', 'beneficiaire', 'montant', 'compte', 'statut', 'cree_le')
    list_filter = ('statut', 'date', 'categorie_mouvement', 'cree_le')
    search_fields = ('beneficiaire', 'designation', 'compte__code')
    readonly_fields = ('cree_par', 'cree_le', 'modifie_par', 'modifie_le', 'mouvement')

    fieldsets = (
        ('Informations de la dépense', {
            'fields': ('date', 'categorie_mouvement', 'beneficiaire', 'designation', 'montant', 'compte', 'ecole', 'annee_scolaire', 'piece_justificative')
        }),
        ('Workflow de validation et paiement', {
            'fields': ('engage_par', 'valide_par', 'statut')
        }),
        ('Mouvement associé', {
            'fields': ('mouvement',)
        }),
        ('Audit', {
            'fields': ('cree_par', 'cree_le', 'modifie_par', 'modifie_le'),
            'classes': ('collapse',)
        }),
    )


@admin.register(ArreteCaisse)
class ArreteCaisseAdmin(admin.ModelAdmin):
    list_display = ('id', 'compte', 'date', 'solde_theorique', 'solde_physique', 'ecart', 'statut', 'cree_le')
    list_filter = ('statut', 'date', 'cree_le')
    search_fields = ('compte__code', 'compte__libelle')
    readonly_fields = ('cree_par', 'cree_le', 'modifie_par', 'modifie_le')

    fieldsets = (
        ('Informations de l\'arrêté de caisse', {
            'fields': ('compte', 'date', 'solde_theorique', 'solde_physique', 'fait_par', 'valide_par')
        }),
        ('Audit', {
            'fields': ('cree_par', 'cree_le', 'modifie_par', 'modifie_le'),
            'classes': ('collapse',)
        }),
    )


@admin.register(Billetage)
class BilletageAdmin(admin.ModelAdmin):
    list_display = ('id', 'arrete_caisse', 'denomination', 'quantite', 'montant', 'cree_le')
    list_filter = ('cree_le',)
    search_fields = ('arrete_caisse__compte__code', 'denomination')
    readonly_fields = ('cree_par', 'cree_le', 'modifie_par', 'modifie_le')

    fieldsets = (
        ('Informations du billetage', {
            'fields': ('arrete_caisse', 'denomination', 'quantite', 'montant')
        }),
        ('Audit', {
            'fields': ('cree_par', 'cree_le', 'modifie_par', 'modifie_le'),
            'classes': ('collapse',)
        }),
    )
# backend/tresorerie/serializers.py
from rest_framework import serializers
from core.serializers import AuditableSerializerMixin
from .models import (
    Compte, CategorieMouvement, Virement, Mouvement, Encaissement,
    ImputationEncaissement, Depense, ArreteCaisse, Billetage
)
from personnes.models import Inscription
from scolarite.models import Echeance, FraisInscription
from referentiel.models import GroupeScolaire, Ecole, AnneeScolaire


class CompteSerializer(AuditableSerializerMixin):
    """Serializer pour le modèle Compte"""

    groupe_scolaire = serializers.PrimaryKeyRelatedField(
        queryset=GroupeScolaire.objects.all()
    )
    groupe_scolaire_nom = serializers.CharField(
        source='groupe_scolaire.nom', read_only=True
    )
    solde_actuel = serializers.SerializerMethodField()

    class Meta:
        model = Compte
        fields = [
            'id', 'groupe_scolaire', 'groupe_scolaire_nom', 'code', 'libelle',
            'type', 'numero_bancaire', 'banque', 'solde_initial', 'solde_actuel',
            'actif', 'cree_par', 'cree_le', 'modifie_par', 'modifie_le'
        ]
        read_only_fields = ['cree_par', 'cree_le', 'modifie_par', 'modifie_le']

    def get_solde_actuel(self, obj):
        from .services.compte import calculer_solde_compte
        return float(calculer_solde_compte(obj.id))


class CategorieMouvementSerializer(AuditableSerializerMixin):
    """Serializer pour le modèle CategorieMouvement"""

    class Meta:
        model = CategorieMouvement
        fields = ['id', 'code', 'libelle', 'sens', 'cree_par', 'cree_le', 'modifie_par', 'modifie_le']
        read_only_fields = ['cree_par', 'cree_le', 'modifie_par', 'modifie_le']


class VirementSerializer(AuditableSerializerMixin):
    """Serializer pour le modèle Virement"""

    compte_source = serializers.PrimaryKeyRelatedField(queryset=Compte.objects.all())
    compte_source_code = serializers.CharField(source='compte_source.code', read_only=True)
    compte_source_libelle = serializers.CharField(source='compte_source.libelle', read_only=True)

    compte_destination = serializers.PrimaryKeyRelatedField(queryset=Compte.objects.all())
    compte_destination_code = serializers.CharField(source='compte_destination.code', read_only=True)
    compte_destination_libelle = serializers.CharField(source='compte_destination.libelle', read_only=True)

    cree_par_nom = serializers.CharField(source='cree_par.get_full_name', read_only=True)
    valide_par_nom = serializers.CharField(source='valide_par.get_full_name', read_only=True)

    class Meta:
        model = Virement
        fields = [
            'id', 'compte_source', 'compte_source_code', 'compte_source_libelle',
            'compte_destination', 'compte_destination_code', 'compte_destination_libelle',
            'montant', 'date', 'motif', 'statut', 'cree_par', 'cree_par_nom',
            'cree_le', 'valide_par', 'valide_par_nom', 'modifie_par', 'modifie_le'
        ]
        read_only_fields = ['cree_par', 'cree_le', 'valide_par', 'modifie_par', 'modifie_le']


class MouvementSerializer(AuditableSerializerMixin):
    """Serializer pour le modèle Mouvement (lecture seule selon les spécifications)"""

    compte = serializers.PrimaryKeyRelatedField(queryset=Compte.objects.all())
    compte_code = serializers.CharField(source='compte.code', read_only=True)
    compte_libelle = serializers.CharField(source='compte.libelle', read_only=True)

    categorie_mouvement = serializers.PrimaryKeyRelatedField(queryset=CategorieMouvement.objects.all())
    categorie_mouvement_code = serializers.CharField(source='categorie_mouvement.code', read_only=True)
    categorie_mouvement_libelle = serializers.CharField(source='categorie_mouvement.libelle', read_only=True)

    ecole = serializers.PrimaryKeyRelatedField(queryset=Ecole.objects.all(), allow_null=True)
    ecole_nom = serializers.CharField(source='ecole.nom', read_only=True)

    annee_scolaire = serializers.PrimaryKeyRelatedField(queryset=AnneeScolaire.objects.all())
    annee_scolaire_libelle = serializers.CharField(source='annee_scolaire.libelle', read_only=True)

    virement = serializers.PrimaryKeyRelatedField(queryset=Virement.objects.all(), allow_null=True)
    virement_id = serializers.IntegerField(source='virement.id', read_only=True)

    cree_par_nom = serializers.CharField(source='cree_par.get_full_name', read_only=True)
    modifie_par_nom = serializers.CharField(source='modifie_par.get_full_name', read_only=True)

    class Meta:
        model = Mouvement
        fields = [
            'id', 'compte', 'compte_code', 'compte_libelle', 'date_operation', 'sens',
            'montant', 'categorie_mouvement', 'categorie_mouvement_code', 'categorie_mouvement_libelle',
            'libelle', 'piece_reference', 'ecole', 'ecole_nom', 'annee_scolaire', 'annee_scolaire_libelle',
            'virement', 'virement_id', 'valide', 'cree_par', 'cree_par_nom', 'cree_le',
            'modifie_par', 'modifie_par_nom', 'modifie_le'
        ]
        read_only_fields = [
            'id', 'compte', 'compte_code', 'compte_libelle', 'date_operation', 'sens',
            'montant', 'categorie_mouvement', 'categorie_mouvement_code', 'categorie_mouvement_libelle',
            'libelle', 'piece_reference', 'ecole', 'ecole_nom', 'annee_scolaire', 'annee_scolaire_libelle',
            'virement', 'virement_id', 'valide', 'cree_par', 'cree_par_nom', 'cree_le',
            'modifie_par', 'modifie_par_nom', 'modifie_le'
        ]


class EncaissementSerializer(AuditableSerializerMixin):
    """Serializer pour le modèle Encaissement"""

    inscription = serializers.PrimaryKeyRelatedField(queryset=Inscription.objects.all())
    inscription_etudiant_nom = serializers.SerializerMethodField()

    compte = serializers.PrimaryKeyRelatedField(queryset=Compte.objects.all())
    compte_code = serializers.CharField(source='compte.code', read_only=True)
    compte_libelle = serializers.CharField(source='compte.libelle', read_only=True)

    mouvement = serializers.PrimaryKeyRelatedField(read_only=True)

    cree_par_nom = serializers.CharField(source='cree_par.get_full_name', read_only=True)
    modifie_par_nom = serializers.CharField(source='modifie_par.get_full_name', read_only=True)

    class Meta:
        model = Encaissement
        fields = [
            'id', 'inscription', 'inscription_etudiant_nom', 'date', 'montant_total',
            'mode', 'compte', 'compte_code', 'compte_libelle', 'mouvement',
            'recu_numero', 'statut', 'cree_par', 'cree_par_nom', 'cree_le',
            'modifie_par', 'modifie_par_nom', 'modifie_le'
        ]
        read_only_fields = ['cree_par', 'cree_par_nom', 'cree_le', 'modifie_par', 'modifie_par_nom', 'modifie_le']

    def get_inscription_etudiant_nom(self, obj):
        if obj.inscription and obj.inscription.etudiant:
            return f"{obj.inscription.etudiant.nom} {obj.inscription.etudiant.prenoms}"
        return None


class ImputationEncaissementSerializer(AuditableSerializerMixin):
    """Serializer pour le modèle ImputationEncaissement"""

    encaissement = serializers.PrimaryKeyRelatedField(queryset=Encaissement.objects.all())
    encaissement_recu_numero = serializers.CharField(source='encaissement.recu_numero', read_only=True)

    echeance = serializers.PrimaryKeyRelatedField(queryset=Echeance.objects.all(), allow_null=True)
    echeance_numero = serializers.IntegerField(source='echeance.numero', read_only=True)
    echeance_montant = serializers.DecimalField(
        source='echeance.montant', max_digits=12, decimal_places=0, read_only=True
    )

    frais_inscription = serializers.PrimaryKeyRelatedField(queryset=FraisInscription.objects.all(), allow_null=True)
    frais_inscription_libelle = serializers.CharField(source='frais_inscription.nom', read_only=True)
    frais_inscription_montant = serializers.DecimalField(
        source='frais_inscription.montant', max_digits=12, decimal_places=0, read_only=True
    )

    cree_par_nom = serializers.CharField(source='cree_par.get_full_name', read_only=True)
    modifie_par_nom = serializers.CharField(source='modifie_par.get_full_name', read_only=True)

    class Meta:
        model = ImputationEncaissement
        fields = [
            'id', 'encaissement', 'encaissement_recu_numero', 'cible', 'echeance',
            'echeance_numero', 'echeance_montant', 'frais_inscription',
            'frais_inscription_libelle', 'frais_inscription_montant', 'montant',
            'cree_par', 'cree_par_nom', 'cree_le', 'modifie_par', 'modifie_par_nom', 'modifie_le'
        ]
        read_only_fields = ['cree_par', 'cree_par_nom', 'cree_le', 'modifie_par', 'modifie_par_nom', 'modifie_le']

    def validate(self, data):
        """Validation personnalisée pour s'assurer de la cohérence de la cible"""
        cible = data.get('cible')
        echeance = data.get('echeance')
        frais_inscription = data.get('frais_inscription')

        if cible == ImputationEncaissement.Cible.ECHEANCE:
            if not echeance:
                raise serializers.ValidationError("L'échéance est requise pour une cible ECHEANCE")
            if frais_inscription:
                raise serializers.ValidationError("Le frais d'inscription doit être nul pour une cible ECHEANCE")
        elif cible == ImputationEncaissement.Cible.FRAIS:
            if not frais_inscription:
                raise serializers.ValidationError("Le frais d'inscription est requis pour une cible FRAIS")
            if echeance:
                raise serializers.ValidationError("L'échéance doit être nulle pour une cible FRAIS")

        return data


class DepenseSerializer(AuditableSerializerMixin):
    """Serializer pour le modèle Depense"""

    categorie_mouvement = serializers.PrimaryKeyRelatedField(queryset=CategorieMouvement.objects.all())
    categorie_mouvement_code = serializers.CharField(source='categorie_mouvement.code', read_only=True)
    categorie_mouvement_libelle = serializers.CharField(source='categorie_mouvement.libelle', read_only=True)

    compte = serializers.PrimaryKeyRelatedField(queryset=Compte.objects.all())
    compte_code = serializers.CharField(source='compte.code', read_only=True)
    compte_libelle = serializers.CharField(source='compte.libelle', read_only=True)

    ecole = serializers.PrimaryKeyRelatedField(queryset=Ecole.objects.all(), allow_null=True)
    ecole_nom = serializers.CharField(source='ecole.nom', read_only=True)

    annee_scolaire = serializers.PrimaryKeyRelatedField(queryset=AnneeScolaire.objects.all())
    annee_scolaire_libelle = serializers.CharField(source='annee_scolaire.libelle', read_only=True)

    engage_par_nom = serializers.CharField(source='engage_par.get_full_name', read_only=True)
    valide_par_nom = serializers.CharField(source='valide_par.get_full_name', read_only=True)
    cree_par_nom = serializers.CharField(source='cree_par.get_full_name', read_only=True)
    modifie_par_nom = serializers.CharField(source='modifie_par.get_full_name', read_only=True)

    class Meta:
        model = Depense
        fields = [
            'id', 'date', 'categorie_mouvement', 'categorie_mouvement_code', 'categorie_mouvement_libelle',
            'beneficiaire', 'designation', 'montant', 'compte', 'compte_code', 'compte_libelle',
            'ecole', 'ecole_nom', 'annee_scolaire', 'annee_scolaire_libelle',
            'piece_justificative', 'engage_par', 'engage_par_nom', 'valide_par', 'valide_par_nom',
            'cree_par', 'cree_par_nom', 'cree_le', 'modifie_par', 'modifie_par_nom', 'modifie_le'
        ]
        read_only_fields = ['cree_par', 'cree_par_nom', 'cree_le', 'modifie_par', 'modifie_par_nom', 'modifie_le']


class ArreteCaisseSerializer(AuditableSerializerMixin):
    """Serializer pour le modèle ArreteCaisse"""

    compte = serializers.PrimaryKeyRelatedField(queryset=Compte.objects.all())
    compte_code = serializers.CharField(source='compte.code', read_only=True)
    compte_libelle = serializers.CharField(source='compte.libelle', read_only=True)

    fait_par_nom = serializers.CharField(source='fait_par.get_full_name', read_only=True)
    valide_par_nom = serializers.CharField(source='valide_par.get_full_name', read_only=True)
    cree_par_nom = serializers.CharField(source='cree_par.get_full_name', read_only=True)
    modifie_par_nom = serializers.CharField(source='modifie_par.get_full_name', read_only=True)

    class Meta:
        model = ArreteCaisse
        fields = [
            'id', 'compte', 'compte_code', 'compte_libelle', 'date', 'solde_theorique',
            'solde_physique', 'ecart', 'fait_par', 'fait_par_nom', 'valide_par', 'valide_par_nom',
            'cree_par', 'cree_par_nom', 'cree_le', 'modifie_par', 'modifie_par_nom', 'modifie_le'
        ]
        read_only_fields = ['cree_par', 'cree_par_nom', 'cree_le', 'modifie_par', 'modifie_par_nom', 'modifie_le']


class BilletageSerializer(AuditableSerializerMixin):
    """Serializer pour le modèle Billetage"""

    arrete_caisse = serializers.PrimaryKeyRelatedField(queryset=ArreteCaisse.objects.all())
    arrete_caisse_date = serializers.DateField(source='arrete_caisse.date', read_only=True)
    arrete_caisse_compte_code = serializers.CharField(source='arrete_caisse.compte.code', read_only=True)

    cree_par_nom = serializers.CharField(source='cree_par.get_full_name', read_only=True)
    modifie_par_nom = serializers.CharField(source='modifie_par.get_full_name', read_only=True)

    class Meta:
        model = Billetage
        fields = [
            'id', 'arrete_caisse', 'arrete_caisse_date', 'arrete_caisse_compte_code',
            'denomination', 'quantite', 'montant', 'cree_par', 'cree_par_nom', 'cree_le',
            'modifie_par', 'modifie_par_nom', 'modifie_le'
        ]
        read_only_fields = ['cree_par', 'cree_par_nom', 'cree_le', 'modifie_par', 'modifie_par_nom', 'modifie_le']
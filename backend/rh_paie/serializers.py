# backend/rh_paie/serializers.py
from rest_framework import serializers
from core.serializers import AuditableSerializerMixin
from .models import (
    Enseignant, PersonnelAdministratif, AffectationEnseignement,
    SalaireEnseignant, SalaireAdministration, AvancePersonnel
)
from referentiel.models import Ecole, Matiere, Classe, AnneeScolaire
from tresorerie.models import Compte
from comptes.models import Utilisateur


class EnseignantSerializer(AuditableSerializerMixin, serializers.ModelSerializer):
    """Serializer pour le modèle Enseignant"""

    class Meta:
        model = Enseignant
        fields = [
            'id', 'nom', 'prenom', 'telephone', 'email', 'specialite',
            'statut', 'taux_horaire', 'actif', 'cree_par', 'cree_le',
            'modifie_par', 'modifie_le'
        ]
        read_only_fields = ['cree_par', 'cree_le', 'modifie_par', 'modifie_le']


class PersonnelAdministratifSerializer(AuditableSerializerMixin, serializers.ModelSerializer):
    """Serializer pour le modèle PersonnelAdministratif"""

    ecole = serializers.PrimaryKeyRelatedField(queryset=Ecole.objects.all())
    ecole_nom = serializers.CharField(source='ecole.nom', read_only=True)

    class Meta:
        model = PersonnelAdministratif
        fields = [
            'id', 'nom', 'prenom', 'poste', 'ecole', 'ecole_nom',
            'telephone', 'email', 'salaire_base', 'date_embauche',
            'actif', 'cree_par', 'cree_le', 'modifie_par', 'modifie_le'
        ]
        read_only_fields = ['cree_par', 'cree_le', 'modifie_par', 'modifie_le']


class AffectationEnseignementSerializer(AuditableSerializerMixin, serializers.ModelSerializer):
    """Serializer pour le modèle AffectationEnseignement"""

    enseignant = serializers.PrimaryKeyRelatedField(queryset=Enseignant.objects.all())
    enseignant_nom = serializers.CharField(source='enseignant.get_full_name', read_only=True)

    matiere = serializers.PrimaryKeyRelatedField(queryset=Matiere.objects.all())
    matiere_nom = serializers.CharField(source='matiere.nom', read_only=True)

    classe = serializers.PrimaryKeyRelatedField(queryset=Classe.objects.all())
    classe_nom = serializers.CharField(source='classe.nom', read_only=True)

    annee_scolaire = serializers.PrimaryKeyRelatedField(queryset=AnneeScolaire.objects.all())
    annee_scolaire_libelle = serializers.CharField(source='annee_scolaire.libelle', read_only=True)

    class Meta:
        model = AffectationEnseignement
        fields = [
            'id', 'enseignant', 'enseignant_nom', 'matiere', 'matiere_nom',
            'classe', 'classe_nom', 'annee_scolaire', 'annee_scolaire_libelle',
            'volume_horaire_prevu', 'taux_horaire', 'montant_prevu',
            'cree_par', 'cree_le', 'modifie_par', 'modifie_le'
        ]
        read_only_fields = ['cree_par', 'cree_le', 'modifie_par', 'modifie_le']


class SalaireEnseignantSerializer(AuditableSerializerMixin, serializers.ModelSerializer):
    """Serializer pour le modèle SalaireEnseignant"""

    enseignant = serializers.PrimaryKeyRelatedField(queryset=Enseignant.objects.all())
    enseignant_nom = serializers.CharField(source='enseignant.get_full_name', read_only=True)

    affectation_enseignement = serializers.PrimaryKeyRelatedField(
        queryset=AffectationEnseignement.objects.all(),
        allow_null=True
    )
    affectation_enseignement_id = serializers.IntegerField(
        source='affectation_enseignement.id', read_only=True
    )

    annee_scolaire = serializers.PrimaryKeyRelatedField(queryset=AnneeScolaire.objects.all())
    annee_scolaire_libelle = serializers.CharField(source='annee_scolaire.libelle', read_only=True)

    compte = serializers.PrimaryKeyRelatedField(queryset=Compte.objects.all())
    compte_code = serializers.CharField(source='compte.code', read_only=True)
    compte_libelle = serializers.CharField(source='compte.libelle', read_only=True)

    # `mouvement` est un BigIntegerField (pas encore une FK réelle vers tresorerie.Mouvement,
    # cf. models.py) : ne jamais le traiter comme PrimaryKeyRelatedField, ça provoquerait un
    # AttributeError dès qu'un salaire payé (mouvement non nul) est sérialisé.
    mouvement = serializers.IntegerField(read_only=True)

    cree_par_nom = serializers.CharField(source='cree_par.get_full_name', read_only=True)
    modifie_par_nom = serializers.CharField(source='modifie_par.get_full_name', read_only=True)

    class Meta:
        model = SalaireEnseignant
        fields = [
            'id', 'enseignant', 'enseignant_nom', 'affectation_enseignement',
            'affectation_enseignement_id', 'annee_scolaire', 'annee_scolaire_libelle',
            'mois', 'date_paiement', 'montant', 'compte', 'compte_code',
            'compte_libelle', 'mouvement',
            'statut', 'date_validation', 'valide_par',
            'cree_par', 'cree_par_nom', 'cree_le', 'modifie_par',
            'modifie_par_nom', 'modifie_le'
        ]
        read_only_fields = [
            'mouvement', 'statut', 'date_validation', 'valide_par',
            'cree_par', 'cree_par_nom', 'cree_le', 'modifie_par', 'modifie_par_nom', 'modifie_le'
        ]


class SalaireAdministrationSerializer(AuditableSerializerMixin, serializers.ModelSerializer):
    """Serializer pour le modèle SalaireAdministration"""

    personnel_administratif = serializers.PrimaryKeyRelatedField(
        queryset=PersonnelAdministratif.objects.all()
    )
    personnel_administratif_nom = serializers.CharField(
        source='personnel_administratif.get_full_name', read_only=True
    )

    annee_scolaire = serializers.PrimaryKeyRelatedField(queryset=AnneeScolaire.objects.all())
    annee_scolaire_libelle = serializers.CharField(source='annee_scolaire.libelle', read_only=True)

    compte = serializers.PrimaryKeyRelatedField(queryset=Compte.objects.all())
    compte_code = serializers.CharField(source='compte.code', read_only=True)
    compte_libelle = serializers.CharField(source='compte.libelle', read_only=True)

    # Cf. commentaire équivalent dans SalaireEnseignantSerializer : `mouvement` reste un
    # BigIntegerField, pas une FK, donc pas de PrimaryKeyRelatedField ici.
    mouvement = serializers.IntegerField(read_only=True)

    cree_par_nom = serializers.CharField(source='cree_par.get_full_name', read_only=True)
    modifie_par_nom = serializers.CharField(source='modifie_par.get_full_name', read_only=True)

    class Meta:
        model = SalaireAdministration
        fields = [
            'id', 'personnel_administratif', 'personnel_administratif_nom',
            'annee_scolaire', 'annee_scolaire_libelle', 'mois', 'date_paiement',
            'montant_du', 'montant_paye', 'compte', 'compte_code',
            'compte_libelle', 'mouvement',
            'statut', 'date_validation', 'valide_par',
            'cree_par', 'cree_par_nom', 'cree_le', 'modifie_par',
            'modifie_par_nom', 'modifie_le'
        ]
        read_only_fields = [
            'mouvement', 'statut', 'date_validation', 'valide_par',
            'cree_par', 'cree_par_nom', 'cree_le', 'modifie_par', 'modifie_par_nom', 'modifie_le'
        ]


class AvancePersonnelSerializer(AuditableSerializerMixin, serializers.ModelSerializer):
    """Serializer pour le modèle AvancePersonnel"""

    enseignant = serializers.PrimaryKeyRelatedField(
        queryset=Enseignant.objects.all(),
        allow_null=True
    )
    enseignant_nom = serializers.CharField(source='enseignant.get_full_name', read_only=True)

    personnel_administratif = serializers.PrimaryKeyRelatedField(
        queryset=PersonnelAdministratif.objects.all(),
        allow_null=True
    )
    personnel_administratif_nom = serializers.CharField(
        source='personnel_administratif.get_full_name', read_only=True
    )

    compte = serializers.PrimaryKeyRelatedField(queryset=Compte.objects.all())
    compte_code = serializers.CharField(source='compte.code', read_only=True)
    compte_libelle = serializers.CharField(source='compte.libelle', read_only=True)

    # Cf. commentaire équivalent dans SalaireEnseignantSerializer : `mouvement` reste un
    # BigIntegerField, pas une FK, donc pas de PrimaryKeyRelatedField ici.
    mouvement = serializers.IntegerField(read_only=True)

    regularise_salaire_admin_id = serializers.IntegerField(read_only=True)

    cree_par_nom = serializers.CharField(source='cree_par.get_full_name', read_only=True)
    modifie_par_nom = serializers.CharField(source='modifie_par.get_full_name', read_only=True)

    class Meta:
        model = AvancePersonnel
        fields = [
            'id', 'beneficiaire', 'enseignant', 'enseignant_nom',
            'personnel_administratif', 'personnel_administratif_nom',
            'date', 'montant', 'motif', 'compte', 'compte_code',
            'compte_libelle', 'mouvement',
            'regularise_salaire_admin_id', 'regularisee',
            'cree_par', 'cree_par_nom', 'cree_le', 'modifie_par',
            'modifie_par_nom', 'modifie_le'
        ]
        read_only_fields = [
            'mouvement', 'regularise_salaire_admin_id', 'regularisee',
            'cree_par', 'cree_par_nom', 'cree_le', 'modifie_par', 'modifie_par_nom', 'modifie_le'
        ]
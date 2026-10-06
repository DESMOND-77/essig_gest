import pytest
from django.db import IntegrityError, transaction

from scolarite import models
from scolarite.tests import factories as f

pytestmark = pytest.mark.django_db


def test_modalite_paiement_model_exists():
    """Test that ModalitePaiement model exists and has required fields."""
    # This test will fail until we implement the model
    assert hasattr(models, 'ModalitePaiement')

    # Test that we can create an instance with required fields
    # Note: We'll need to create related Niveau and AnneeScolaire instances first
    from referentiel.models import GroupeScolaire, Ecole, Niveau, AnneeScolaire

    # Create the dependency chain with all required fields
    gs = GroupeScolaire.objects.create(nom="Groupe Test")
    ecole = Ecole.objects.create(
        groupe_scolaire=gs,
        nom="Ecole Test",
        pole="ESSIG",
        regime="LMD"
    )
    niveau = Niveau.objects.create(
        ecole=ecole,
        code="06",
        libelle="6ème",
        ordre=1,
        credits_requis=0,
        a_soutenance=0,
        a_examen_national=0
    )
    annee_scolaire = AnneeScolaire.objects.create(
        libelle="2026-2027",
        date_debut="2026-09-01",
        date_fin="2027-06-30",
        est_courante=True
    )

    modalite = models.ModalitePaiement.objects.create(
        niveau=niveau,
        annee_scolaire=annee_scolaire,
        montant_inscription_reinscription=100000,
        nombre_echeance=3,
        montant_echeance=50000
    )

    assert modalite.niveau_id == niveau.id
    assert modalite.annee_scolaire_id == annee_scolaire.id
    assert modalite.montant_inscription_reinscription == 100000
    assert modalite.nombre_echeance == 3
    assert modalite.montant_echeance == 50000
    assert modalite.montant_total == 250000  # 100000 + 3 * 50000
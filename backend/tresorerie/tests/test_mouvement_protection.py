# backend/tresorerie/tests/test_mouvement_protection.py
"""
Régression P0 : `tresorerie.Mouvement` (grand livre unifié) n'avait aucune protection
`save()`/`delete()`, contrairement à `Depense`/`Encaissement`/`Virement`/`ArreteCaisse` qui ont
toutes un garde basé sur leur statut (cf. audit du 2026-10-14,
docs/superpowers/plans/2026-10-14-audit-module-tresorerie-complement.md, point C). N'importe qui
pouvait modifier ou supprimer une ligne du grand livre via l'ORM/API/admin, y compris un
mouvement déjà référencé par une pièce comptable validée.
"""
import datetime

import pytest
from django.core.exceptions import ValidationError

from referentiel.tests import factories as rf
from tresorerie.models import CategorieMouvement, Compte, Mouvement

pytestmark = pytest.mark.django_db


@pytest.fixture
def mouvement():
    compte = Compte.objects.create(
        code="MVTP01", libelle="Compte protection mouvement",
        type=Compte.Type.BANQUE, solde_initial=1_000_000, actif=True,
    )
    autre_compte = Compte.objects.create(
        code="MVTP02", libelle="Autre compte",
        type=Compte.Type.BANQUE, solde_initial=0, actif=True,
    )
    categorie = CategorieMouvement.objects.create(
        code="MVTP_CAT", libelle="Catégorie test", sens=CategorieMouvement.Sens.SORTIE,
    )
    annee = rf.AnneeScolaireFactory(libelle="2025-2026")
    m = Mouvement.objects.create(
        compte=compte, date_operation=datetime.date(2025, 10, 14), sens=Mouvement.Sens.DEBIT,
        montant=50000, categorie_mouvement=categorie, libelle="Mouvement test",
        annee_scolaire=annee,
    )
    return m, autre_compte


def test_mouvement_refuse_modification_champ_substantiel(mouvement):
    m, autre_compte = mouvement
    m.montant = 999999
    with pytest.raises(ValidationError):
        m.save()


def test_mouvement_refuse_changement_de_compte(mouvement):
    m, autre_compte = mouvement
    m.compte = autre_compte
    with pytest.raises(ValidationError):
        m.save()


def test_mouvement_refuse_suppression(mouvement):
    m, _ = mouvement
    with pytest.raises(ValidationError):
        m.delete()


def test_mouvement_autorise_toggle_valide(mouvement):
    """`valide` reste modifiable (cf. tresorerie.services.mouvement.valider_mouvement/
    invalider_mouvement, qui ne touchent que ce champ) : invalider un mouvement est le mécanisme
    officiel de correction, pas un champ "substantiel" à verrouiller."""
    m, _ = mouvement
    m.valide = False
    m.save()  # ne doit pas lever
    m.refresh_from_db()
    assert m.valide is False

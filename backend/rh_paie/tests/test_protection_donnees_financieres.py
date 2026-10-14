# backend/rh_paie/tests/test_protection_donnees_financieres.py
"""
Régression : les enregistrements financiers validés/payés/régularisés de rh_paie n'avaient
aucune protection contre la modification/suppression (audit du 2026-10-14), contrairement à
tresorerie.Depense/Encaissement/Virement/ArreteCaisse qui ont toutes un garde `save()`/`delete()`
basé sur leur statut. Ces tests vérifient que SalaireEnseignant/SalaireAdministration/
AvancePersonnel suivent désormais le même pattern.
"""
import datetime

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from referentiel.models import AnneeScolaire, Ecole
from rh_paie.models import AvancePersonnel, Enseignant, PersonnelAdministratif, SalaireEnseignant, SalaireAdministration
from tresorerie.models import Compte

User = get_user_model()


@pytest.fixture
def base(db):
    ecole = Ecole.objects.create(nom="École Test", sigle="ETP")
    annee = AnneeScolaire.objects.create(libelle="2025-2026", date_debut="2025-09-01", date_fin="2026-06-30")
    user = User.objects.create_user(login="prot_user", password="motdepasse42", email="prot@example.com")
    compte = Compte.objects.create(
        code="PROT01", libelle="Compte protection",
        type=Compte.Type.BANQUE, solde_initial=1_000_000, actif=True, cree_par=user,
    )
    return dict(ecole=ecole, annee=annee, user=user, compte=compte)


def test_salaire_enseignant_valide_refuse_modification_champ_protege(base):
    enseignant = Enseignant.objects.create(nom="DUPONT", prenom="Marie")
    salaire = SalaireEnseignant.objects.create(
        enseignant=enseignant, annee_scolaire=base["annee"], mois="SEPT",
        date_paiement=datetime.date(2025, 9, 25), montant=300000,
        compte=base["compte"], statut="VALIDÉ", cree_par=base["user"],
    )

    salaire.montant = 999999
    with pytest.raises(ValidationError):
        salaire.save()


def test_salaire_enseignant_valide_autorise_transition_de_statut(base):
    """La protection ne doit pas bloquer les champs de workflow eux-mêmes (statut, mouvement,
    modifie_par...) sous peine de rendre le paiement impossible."""
    enseignant = Enseignant.objects.create(nom="DUPONT", prenom="Marie")
    salaire = SalaireEnseignant.objects.create(
        enseignant=enseignant, annee_scolaire=base["annee"], mois="SEPT",
        date_paiement=datetime.date(2025, 9, 25), montant=300000,
        compte=base["compte"], statut="VALIDÉ", cree_par=base["user"],
    )

    salaire.mouvement = 42
    salaire.statut = "PAYÉ"
    salaire.save()  # ne doit pas lever

    salaire.refresh_from_db()
    assert salaire.statut == "PAYÉ"
    assert salaire.mouvement == 42


def test_salaire_enseignant_paye_refuse_suppression(base):
    enseignant = Enseignant.objects.create(nom="DUPONT", prenom="Marie")
    salaire = SalaireEnseignant.objects.create(
        enseignant=enseignant, annee_scolaire=base["annee"], mois="SEPT",
        date_paiement=datetime.date(2025, 9, 25), montant=300000,
        compte=base["compte"], statut="PAYÉ", cree_par=base["user"],
    )

    with pytest.raises(ValidationError):
        salaire.delete()


def test_salaire_enseignant_brouillon_autorise_modification_et_suppression(base):
    """Un brouillon reste pleinement modifiable/supprimable."""
    enseignant = Enseignant.objects.create(nom="DUPONT", prenom="Marie")
    salaire = SalaireEnseignant.objects.create(
        enseignant=enseignant, annee_scolaire=base["annee"], mois="SEPT",
        date_paiement=datetime.date(2025, 9, 25), montant=300000,
        compte=base["compte"], statut="BROUILLON", cree_par=base["user"],
    )

    salaire.montant = 350000
    salaire.save()  # ne doit pas lever
    salaire.delete()  # ne doit pas lever


def test_salaire_administration_valide_refuse_modification_champ_protege(base):
    personnel = PersonnelAdministratif.objects.create(nom="MBA", prenom="Paul", poste="Comptable", salaire_base=250000)
    salaire = SalaireAdministration.objects.create(
        personnel_administratif=personnel, annee_scolaire=base["annee"], mois="SEPT",
        date_paiement=datetime.date(2025, 9, 25), montant_du=250000, montant_paye=250000,
        compte=base["compte"], statut="VALIDÉ", cree_par=base["user"],
    )

    salaire.montant_du = 999999
    with pytest.raises(ValidationError):
        salaire.save()


def test_avance_regularisee_refuse_modification_et_suppression(base):
    enseignant = Enseignant.objects.create(nom="NZAMBA", prenom="Alain")
    avance = AvancePersonnel.objects.create(
        beneficiaire="ENSEIGNANT", enseignant=enseignant, date=datetime.date(2025, 10, 1),
        montant=50000, compte=base["compte"], regularisee=True, cree_par=base["user"],
    )

    avance.montant = 1
    with pytest.raises(ValidationError):
        avance.save()

    with pytest.raises(ValidationError):
        avance.delete()


def test_avance_non_regularisee_autorise_modification_et_suppression(base):
    enseignant = Enseignant.objects.create(nom="NZAMBA", prenom="Alain")
    avance = AvancePersonnel.objects.create(
        beneficiaire="ENSEIGNANT", enseignant=enseignant, date=datetime.date(2025, 10, 1),
        montant=50000, compte=base["compte"], cree_par=base["user"],
    )

    avance.montant = 60000
    avance.save()  # ne doit pas lever
    avance.delete()  # ne doit pas lever

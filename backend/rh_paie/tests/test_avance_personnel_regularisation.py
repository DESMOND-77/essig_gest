# backend/rh_paie/tests/test_avance_personnel_regularisation.py
"""
Tests de régression pour la régularisation des avances sur salaire.

Couvre les bugs identifiés par l'audit du 2026-10-14
(docs/superpowers/plans/2026-10-14-audit-etape-a-rh-paie-operations-financieres.md) :
- views.py appelait un nom jamais importé (`avance_service`) sur l'action HTTP `regulariser`
  -> NameError masqué en 400 générique, endpoint non fonctionnel.
- `tresorerie.services.depense.creer_depense` appelait `generer_mouvement_debit` sans
  l'avoir importé -> NameError masqué, endpoint `payer` non fonctionnel.
- `AvancePersonnelService.regulariser_avance` créait un Mouvement mais ne le liait jamais
  à l'avance (`avance.mouvement` restait vide) et passait `annee_scolaire_id=None`,
  incompatible avec la contrainte NOT NULL de `Mouvement.annee_scolaire`.
- Les serializers déclaraient `mouvement` comme `PrimaryKeyRelatedField` alors que le champ
  modèle est un simple `BigIntegerField` -> `AttributeError` dès qu'un enregistrement payé/
  régularisé (mouvement non nul) était sérialisé.
"""
import datetime

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient

from comptes.models import Role, UtilisateurRole
from referentiel.models import AnneeScolaire, Ecole
from rh_paie.models import AvancePersonnel, Enseignant, SalaireEnseignant
from rh_paie.services import AvancePersonnelService
from tresorerie.models import CategorieMouvement, Compte, Mouvement

User = get_user_model()


def _client_with_role(role_code):
    user = User.objects.create_user(
        login=f"user_{role_code.lower()}",
        password="motdepasse42",
        email=f"{role_code.lower()}@example.com",
    )
    role, _ = Role.objects.get_or_create(code=role_code, defaults={"libelle": role_code})
    UtilisateurRole.objects.create(utilisateur=user, role=role)
    client = APIClient()
    client.force_authenticate(user)
    return client, user


@pytest.mark.django_db
class TestRegulariserAvanceService:
    """Tests directs du service `AvancePersonnelService.regulariser_avance`."""

    @pytest.fixture(autouse=True)
    def _setup(self):
        self.ecole = Ecole.objects.create(nom="École Test", sigle="ET")
        self.annee_scolaire = AnneeScolaire.objects.create(
            libelle="2025-2026", date_debut="2025-09-01", date_fin="2026-06-30", est_courante=True
        )
        self.user = User.objects.create_user(
            login="daf_service_test", password="motdepasse42", email="daf_service@example.com"
        )
        self.enseignant = Enseignant.objects.create(
            nom="DUPONT", prenom="Marie", email="marie.dupont@example.com"
        )
        self.compte = Compte.objects.create(
            code="PAYE001",
            libelle="Compte de Paiement Test",
            type=Compte.Type.BANQUE,
            solde_initial=1000000,
            actif=True,
            cree_par=self.user,
        )
        self.categorie_regularisation = CategorieMouvement.objects.create(
            code="REGULARISATION_AVANCE",
            libelle="Régularisation d'avance",
            sens=CategorieMouvement.Sens.SORTIE,
            cree_par=self.user,
        )
        self.avance = AvancePersonnel.objects.create(
            beneficiaire="ENSEIGNANT",
            enseignant=self.enseignant,
            date=datetime.date(2025, 10, 1),
            montant=50000,
            compte=self.compte,
            cree_par=self.user,
        )

    def test_regularisation_cree_et_lie_le_mouvement(self):
        avance = AvancePersonnelService.regulariser_avance(
            avance_id=self.avance.id, regularise_par_id=self.user.id
        )

        assert avance.regularisee is True
        assert avance.mouvement is not None

        mouvement = Mouvement.objects.get(id=avance.mouvement)
        assert mouvement.sens == Mouvement.Sens.DEBIT
        assert mouvement.montant == self.avance.montant
        assert mouvement.compte_id == self.compte.id
        assert mouvement.categorie_mouvement_id == self.categorie_regularisation.id
        assert mouvement.annee_scolaire_id == self.annee_scolaire.id

    def test_double_regularisation_refusee(self):
        AvancePersonnelService.regulariser_avance(
            avance_id=self.avance.id, regularise_par_id=self.user.id
        )

        with pytest.raises(ValidationError):
            AvancePersonnelService.regulariser_avance(
                avance_id=self.avance.id, regularise_par_id=self.user.id
            )

        # Un seul mouvement doit avoir été créé pour cette avance.
        assert Mouvement.objects.filter(
            categorie_mouvement=self.categorie_regularisation
        ).count() == 1

    # Note : l'incohérence bénéficiaire/enseignant/personnel_administratif que
    # `regulariser_avance` revérifie est déjà bloquée au niveau base de données par
    # `chk_avance_beneficiaire` (models.py) — il est donc impossible de construire une ligne
    # incohérente à tester ici (l'INSERT lève IntegrityError avant d'atteindre le service).


@pytest.mark.django_db
class TestRegulariserAvanceApi:
    """Régression au niveau HTTP : l'action `regulariser` ne doit pas lever de NameError."""

    @pytest.fixture(autouse=True)
    def _setup(self):
        self.annee_scolaire = AnneeScolaire.objects.create(
            libelle="2025-2026", date_debut="2025-09-01", date_fin="2026-06-30", est_courante=True
        )
        self.enseignant = Enseignant.objects.create(
            nom="MBA", prenom="Paul", email="paul.mba@example.com"
        )
        self.client, self.user = _client_with_role("DAF")
        self.compte = Compte.objects.create(
            code="PAYE002",
            libelle="Compte de Paiement API",
            type=Compte.Type.BANQUE,
            solde_initial=1000000,
            actif=True,
            cree_par=self.user,
        )
        CategorieMouvement.objects.get_or_create(
            code="REGULARISATION_AVANCE",
            defaults={
                "libelle": "Régularisation d'avance",
                "sens": CategorieMouvement.Sens.SORTIE,
                "cree_par": self.user,
            },
        )
        self.avance = AvancePersonnel.objects.create(
            beneficiaire="ENSEIGNANT",
            enseignant=self.enseignant,
            date=datetime.date(2025, 10, 1),
            montant=30000,
            compte=self.compte,
            cree_par=self.user,
        )

    def test_regulariser_endpoint_succeeds_without_server_error(self):
        resp = self.client.post(f"/api/v1/rh-paie/avances-personnel/{self.avance.id}/regulariser/")
        assert resp.status_code == 200, resp.content

        self.avance.refresh_from_db()
        assert self.avance.regularisee is True
        assert self.avance.mouvement is not None

    def test_regulariser_endpoint_idempotent_sur_double_appel(self):
        first = self.client.post(f"/api/v1/rh-paie/avances-personnel/{self.avance.id}/regulariser/")
        assert first.status_code == 200, first.content

        second = self.client.post(
            f"/api/v1/rh-paie/avances-personnel/{self.avance.id}/regulariser/"
        )
        assert second.status_code == 400

    def test_detail_endpoint_does_not_crash_after_regularisation(self):
        """Régression : le serializer plantait sur `mouvement` (PrimaryKeyRelatedField
        sur un champ BigIntegerField) dès que `mouvement` devenait non nul."""
        self.client.post(f"/api/v1/rh-paie/avances-personnel/{self.avance.id}/regulariser/")

        resp = self.client.get(f"/api/v1/rh-paie/avances-personnel/{self.avance.id}/")
        assert resp.status_code == 200, resp.content
        assert resp.data["regularisee"] is True
        assert resp.data["mouvement"] is not None


@pytest.mark.django_db
class TestPayerSalaireEnseignantApi:
    """Régression au niveau HTTP : l'action `payer` ne doit pas lever de NameError
    (import manquant de `generer_mouvement_debit` dans tresorerie.services.depense)."""

    @pytest.fixture(autouse=True)
    def _setup(self):
        self.annee_scolaire = AnneeScolaire.objects.create(
            libelle="2025-2026", date_debut="2025-09-01", date_fin="2026-06-30", est_courante=True
        )
        self.enseignant = Enseignant.objects.create(
            nom="NZAMBA", prenom="Alain", email="alain.nzamba@example.com"
        )
        self.client, self.user = _client_with_role("DAF")
        self.compte = Compte.objects.create(
            code="PAYE003",
            libelle="Compte de Paiement Salaire",
            type=Compte.Type.BANQUE,
            solde_initial=1000000,
            actif=True,
            cree_par=self.user,
        )
        CategorieMouvement.objects.get_or_create(
            code="SALAIRE",
            defaults={
                "libelle": "Paiement de salaire",
                "sens": CategorieMouvement.Sens.SORTIE,
                "cree_par": self.user,
            },
        )
        self.salaire = SalaireEnseignant.objects.create(
            enseignant=self.enseignant,
            annee_scolaire=self.annee_scolaire,
            mois="SEPT",
            date_paiement=datetime.date(2025, 9, 25),
            montant=300000,
            compte=self.compte,
            statut="VALIDÉ",
            cree_par=self.user,
        )

    def test_payer_endpoint_succeeds_without_server_error(self):
        resp = self.client.post(f"/api/v1/rh-paie/salaires-enseignant/{self.salaire.id}/payer/")
        assert resp.status_code == 200, resp.content

        self.salaire.refresh_from_db()
        assert self.salaire.statut == "PAYÉ"
        assert self.salaire.mouvement is not None

    def test_payer_endpoint_idempotent_sur_double_appel(self):
        first = self.client.post(f"/api/v1/rh-paie/salaires-enseignant/{self.salaire.id}/payer/")
        assert first.status_code == 200, first.content
        mouvement_id = first.json()["mouvement_id"]

        second = self.client.post(f"/api/v1/rh-paie/salaires-enseignant/{self.salaire.id}/payer/")
        assert second.status_code == 200
        assert second.json()["mouvement_id"] == mouvement_id

        # Un seul mouvement doit exister pour ce salaire.
        assert Mouvement.objects.filter(categorie_mouvement__code="SALAIRE").count() == 1

    def test_detail_endpoint_does_not_crash_after_payment(self):
        """Régression : même bug de sérialisation que pour les avances, sur SalaireEnseignant."""
        self.client.post(f"/api/v1/rh-paie/salaires-enseignant/{self.salaire.id}/payer/")

        resp = self.client.get(f"/api/v1/rh-paie/salaires-enseignant/{self.salaire.id}/")
        assert resp.status_code == 200, resp.content
        assert resp.data["statut"] == "PAYÉ"

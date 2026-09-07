import pytest

from personnes import models
from personnes.serializers import EtudiantListSerializer, EtudiantSerializer
from personnes.tests import factories as f

pytestmark = pytest.mark.django_db

_BASE = {"nom": "Gumapi clos", "prenoms": "desmond junior", "sexe": "F"}


def test_create_exige_pole_et_genere_le_matricule():
    s = EtudiantSerializer(data={**_BASE, "pole": "ESSIG"})
    assert s.is_valid(), s.errors
    etu = s.save()
    assert etu.matricule == "ESSIG-FCVGUDE1"


def test_create_sans_pole_est_invalide():
    s = EtudiantSerializer(data=_BASE)
    assert not s.is_valid()
    assert "pole" in s.errors


def test_matricule_en_entree_est_ignore():
    s = EtudiantSerializer(data={**_BASE, "pole": "ESSIG", "matricule": "PIRATE"})
    assert s.is_valid(), s.errors
    etu = s.save()
    assert etu.matricule != "PIRATE"


def test_update_ne_touche_ni_pole_ni_matricule():
    etu = f.EtudiantFactory(matricule="ESSIG-FCVGUDE7", nom="Ancien")
    s = EtudiantSerializer(
        etu, data={"nom": "Nouveau", "pole": "UPSS"}, partial=True
    )
    assert s.is_valid(), s.errors
    etu = s.save()
    etu.refresh_from_db()
    assert etu.nom == "Nouveau"
    assert etu.matricule == "ESSIG-FCVGUDE7"


def test_detail_imbrique_affiliations_et_bac_en_lecture_seule():
    etu = f.EtudiantFactory()
    f.AffiliationFactory(etudiant=etu, type=models.Affiliation.Type.PERE)
    f.SituationBacFactory(etudiant=etu)
    data = EtudiantSerializer(etu).data
    assert len(data["affiliations"]) == 1
    assert data["situation_bac"]["a_le_bac"] is True


def test_list_serializer_n_imbrique_pas():
    assert "affiliations" not in EtudiantListSerializer().fields


def _ctx(user=None):
    from rest_framework.test import APIRequestFactory

    req = APIRequestFactory().post("/x")
    req.user = user
    return {"request": req}


def test_inscription_derive_ecole_annee_et_numero():
    from comptes.tests.factories import UtilisateurFactory
    from personnes.serializers import InscriptionSerializer
    from referentiel.tests import factories as rf
    from scolarite.tests import factories as sf

    u = UtilisateurFactory()
    classe = rf.ClasseFactory()
    sf.ModalitePaiementFactory(
        niveau=classe.niveau, annee_scolaire=classe.annee_scolaire
    )
    etu = f.EtudiantFactory()
    s = InscriptionSerializer(
        data={
            "etudiant": etu.pk,
            "classe": classe.pk,
            "date_inscription": "2025-10-01",
        },
        context=_ctx(u),
    )
    assert s.is_valid(), s.errors
    insc = s.save()
    assert insc.ecole_id == classe.niveau.ecole_id
    assert insc.annee_scolaire_id == classe.annee_scolaire_id
    assert insc.numero_ordre == 1
    assert insc.type == "INSCRIPTION" and insc.statut == "NOUVEAU"
    assert insc.cree_par_id == u.pk
    assert insc.echeances.count() == 10


def test_inscription_type_reinscription_si_anterieure():
    from comptes.tests.factories import UtilisateurFactory
    from personnes.serializers import InscriptionSerializer
    from referentiel.tests import factories as rf
    from scolarite.tests import factories as sf

    etu = f.EtudiantFactory()
    f.InscriptionFactory(etudiant=etu)  # inscription antérieure
    classe = rf.ClasseFactory()
    sf.ModalitePaiementFactory(
        niveau=classe.niveau, annee_scolaire=classe.annee_scolaire
    )
    s = InscriptionSerializer(
        data={
            "etudiant": etu.pk,
            "classe": classe.pk,
            "date_inscription": "2025-10-01",
        },
        context=_ctx(UtilisateurFactory()),
    )
    assert s.is_valid(), s.errors
    insc = s.save()
    assert insc.type == "REINSCRIPTION" and insc.statut == "ANCIEN"


def test_inscription_classe_read_only_en_update():
    from personnes.serializers import InscriptionSerializer

    i = f.InscriptionFactory()
    s = InscriptionSerializer(i)
    assert s.fields["classe"].read_only is True
    for nom in ("ecole", "annee_scolaire", "numero_ordre", "cree_par"):
        assert s.fields[nom].read_only is True

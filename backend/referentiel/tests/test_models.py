import pytest
from django.db import IntegrityError

from referentiel import models
from referentiel.tests import factories as f

pytestmark = pytest.mark.django_db


def test_db_tables_sont_les_noms_cibles():
    attendus = {
        models.GroupeScolaire: "groupe_scolaire",
        models.Ecole: "ecole",
        models.AnneeScolaire: "annee_scolaire",
        models.ModaliteFormation: "modalite_formation",
        models.Niveau: "niveau",
        models.Filiere: "filiere",
        models.OptionFiliere: "option_filiere",
        models.Classe: "classe",
        models.Matiere: "matiere",
        models.Periode: "periode",
        models.SessionExamen: "session_examen",
    }
    for modele, table in attendus.items():
        assert modele._meta.db_table == table


def test_niveau_unicite_ecole_code():
    e = f.EcoleFactory()
    f.NiveauFactory(ecole=e, code="L1")
    with pytest.raises(IntegrityError):
        f.NiveauFactory(ecole=e, code="L1")


def test_niveau_credits_requis_nullable():
    n = f.NiveauFactory(credits_requis=None)
    n.refresh_from_db()
    assert n.credits_requis is None


def test_restrict_empeche_suppression_ecole_referencee():
    n = f.NiveauFactory()
    with pytest.raises(IntegrityError):
        n.ecole.delete()


def test_classe_unicite_quadruplet():
    c = f.ClasseFactory()
    with pytest.raises(IntegrityError):
        f.ClasseFactory(
            annee_scolaire=c.annee_scolaire,
            niveau=c.niveau,
            option_filiere=c.option_filiere,
            modalite_formation=c.modalite_formation,
        )


def test_periode_numero_hors_1_2_rejete_par_validation():
    from django.core.exceptions import ValidationError

    p = f.PeriodeFactory.build(numero=3, annee_scolaire=f.AnneeScolaireFactory())
    with pytest.raises(ValidationError) as exc:
        p.full_clean()
    assert "numero" in exc.value.message_dict


def test_tables_en_utf8mb4_unicode_ci():
    from django.db import connection

    with connection.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*) FROM information_schema.tables
            WHERE table_schema = DATABASE()
              AND table_name IN ('groupe_scolaire','ecole','niveau','filiere','option_filiere',
                                 'classe','matiere','periode','session_examen','annee_scolaire','modalite_formation')
              AND table_collation <> 'utf8mb4_unicode_ci'
            """
        )
        assert cur.fetchone()[0] == 0

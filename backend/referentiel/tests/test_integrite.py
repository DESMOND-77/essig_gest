"""Portage pytest de db/tests/test_001_referentiel.sql.

Le harnais SQL vérifie : présence des 11 tables, moteur/collation (hors ORM),
4 FK sur `classe`, unicité (ecole, code) sur `niveau`, `credits_requis` nullable.
"""

import pytest
from django.db import connection

from referentiel import models
from referentiel.tests import factories as f

pytestmark = pytest.mark.django_db

TABLES = {
    "groupe_scolaire",
    "ecole",
    "annee_scolaire",
    "modalite_formation",
    "niveau",
    "filiere",
    "option_filiere",
    "classe",
    "matiere",
    "periode",
    "session_examen",
}


def test_les_11_tables_existent():
    existantes = set(connection.introspection.table_names())
    assert TABLES <= existantes


def test_classe_a_quatre_cles_etrangeres():
    fks = [
        f
        for f in models.Classe._meta.get_fields()
        if f.many_to_one and f.concrete
    ]
    assert {f.name for f in fks} == {
        "annee_scolaire",
        "niveau",
        "option_filiere",
        "modalite_formation",
    }


def test_unicite_niveau_ecole_code_rejette_doublon():
    from django.db import IntegrityError

    e = f.EcoleFactory()
    f.NiveauFactory(ecole=e, code="L1")
    with pytest.raises(IntegrityError):
        f.NiveauFactory(ecole=e, code="L1")


def test_credits_requis_accepte_null():
    n = f.NiveauFactory(code="1A", credits_requis=None)
    n.refresh_from_db()
    assert n.credits_requis is None

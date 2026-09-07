import pytest
from django.db import IntegrityError

from personnes import models
from personnes.tests import factories as f

pytestmark = pytest.mark.django_db


def test_db_tables_sont_les_noms_cibles():
    attendus = {
        models.Etudiant: "etudiant",
        models.Affiliation: "affiliation",
        models.SituationBac: "situation_bac",
        models.TypePiece: "type_piece",
        models.CompteurMatricule: "compteur_matricule",
    }
    for modele, table in attendus.items():
        assert modele._meta.db_table == table


def test_matricule_unique():
    f.EtudiantFactory(matricule="ESSIG-FCVGUDE1")
    with pytest.raises(IntegrityError):
        f.EtudiantFactory(matricule="ESSIG-FCVGUDE1")


def test_affiliation_unicite_etudiant_type():
    e = f.EtudiantFactory()
    f.AffiliationFactory(etudiant=e, type=models.Affiliation.Type.PERE)
    with pytest.raises(IntegrityError):
        f.AffiliationFactory(etudiant=e, type=models.Affiliation.Type.PERE)


def test_affiliation_cascade_a_la_suppression_etudiant():
    e = f.EtudiantFactory()
    f.AffiliationFactory(etudiant=e, type=models.Affiliation.Type.PERE)
    f.AffiliationFactory(etudiant=e, type=models.Affiliation.Type.MERE)
    e.delete()
    assert models.Affiliation.objects.filter(etudiant_id=e.pk).count() == 0


def test_situation_bac_une_seule_par_etudiant():
    e = f.EtudiantFactory()
    f.SituationBacFactory(etudiant=e)
    with pytest.raises(IntegrityError):
        f.SituationBacFactory(etudiant=e)


def test_situation_bac_cascade_a_la_suppression_etudiant():
    e = f.EtudiantFactory()
    f.SituationBacFactory(etudiant=e)
    e.delete()
    assert not models.SituationBac.objects.filter(etudiant_id=e.pk).exists()


def test_type_piece_code_unique():
    f.TypePieceFactory(code="ACTE_NAISSANCE")
    with pytest.raises(IntegrityError):
        f.TypePieceFactory(code="ACTE_NAISSANCE")


def test_index_nom_present():
    noms = {i.name for i in models.Etudiant._meta.indexes}
    assert "idx_etudiant_nom" in noms


def test_inscription_db_table_et_index():
    assert models.Inscription._meta.db_table == "inscription"
    assert models.PieceDossier._meta.db_table == "piece_dossier"
    assert models.CompteurInscription._meta.db_table == "compteur_inscription"
    noms = {i.name for i in models.Inscription._meta.indexes}
    assert "idx_inscription_classe" in noms


def test_inscription_unicite_etudiant_annee():
    e = f.EtudiantFactory()
    i1 = f.InscriptionFactory(etudiant=e)
    with pytest.raises(IntegrityError):
        f.InscriptionFactory(etudiant=e, annee_scolaire=i1.annee_scolaire)


def test_inscription_unicite_numero_ordre_par_ecole_annee():
    i1 = f.InscriptionFactory(numero_ordre=1)
    with pytest.raises(IntegrityError):
        f.InscriptionFactory(
            ecole=i1.ecole, annee_scolaire=i1.annee_scolaire, numero_ordre=1
        )


def test_piece_dossier_unicite():
    from django.db import transaction

    i = f.InscriptionFactory()
    tp = f.TypePieceFactory()
    f.PieceDossierFactory(inscription=i, type_piece=tp)
    with pytest.raises(IntegrityError), transaction.atomic():
        f.PieceDossierFactory(inscription=i, type_piece=tp)


def test_piece_dossier_cascade_a_la_suppression_inscription():
    i = f.InscriptionFactory()
    f.PieceDossierFactory(inscription=i)
    i.delete()
    assert not models.PieceDossier.objects.filter(inscription_id=i.pk).exists()


def test_compteur_inscription_unicite():
    from referentiel.tests import factories as rf

    e, a = rf.EcoleFactory(), rf.AnneeScolaireFactory()
    models.CompteurInscription.objects.create(ecole=e, annee_scolaire=a, valeur=3)
    with pytest.raises(IntegrityError):
        models.CompteurInscription.objects.create(ecole=e, annee_scolaire=a)

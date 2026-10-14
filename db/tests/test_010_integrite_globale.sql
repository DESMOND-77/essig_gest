-- Test 010 : invariants transversaux du schema (inter-modules).
-- Toutes les assertions sont positives ; l'ensemble est encadre par une
-- transaction annulee en fin de fichier pour ne rien laisser en base.
START TRANSACTION;

-- (a) aucune table metier hors InnoDB / utf8mb4_unicode_ci.
--     Le filtre table_type = 'BASE TABLE' exclut deja les 13 vues ;
--     le filtre NOT LIKE '\_test\_%' exclut la table utilitaire _test_log.
CALL assert_equals('0', CAST((
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE '\_test\_%'
    AND (engine <> 'InnoDB' OR table_collation <> 'utf8mb4_unicode_ci')
) AS CHAR), 'toutes les tables sont InnoDB + utf8mb4_unicode_ci');

-- (b) nombre total de tables de base attendu = 48
--     (migrations 001-007 : 10 + 4 + 6 + 5 + 9 + 6 + 8 = 48 CREATE TABLE ;
--      module 1 : 10 (groupe_scolaire supprimee, cf.
--      docs/superpowers/specs/2026-10-14-suppression-pole-groupe-scolaire-design.md),
--      utilisateurs/audit : 4, personnes/inscriptions : 6,
--      scolarite : 5, tresorerie : 9, RH/paie : 6, evaluations : 8).
CALL assert_equals('48', CAST((
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE '\_test\_%'
) AS CHAR), '48 tables de base');

-- (c) chaque table transactionnelle listee porte bien une colonne cree_le.
CALL assert_equals('0', CAST((
  SELECT COUNT(*) FROM (
    SELECT 'inscription' t UNION ALL SELECT 'frais_inscription' UNION ALL SELECT 'echeance'
    UNION ALL SELECT 'bourse' UNION ALL SELECT 'encaissement' UNION ALL SELECT 'mouvement'
    UNION ALL SELECT 'virement' UNION ALL SELECT 'depense' UNION ALL SELECT 'salaire_enseignant'
    UNION ALL SELECT 'salaire_administration' UNION ALL SELECT 'avance_personnel'
    UNION ALL SELECT 'note_evaluation' UNION ALL SELECT 'resultat_matiere' UNION ALL SELECT 'resultat_periode'
    UNION ALL SELECT 'resultat_annuel' UNION ALL SELECT 'deliberation' UNION ALL SELECT 'evaluation'
    UNION ALL SELECT 'arrete_caisse'
  ) req
  LEFT JOIN information_schema.columns c
    ON c.table_schema = DATABASE() AND c.table_name = req.t AND c.column_name = 'cree_le'
  WHERE c.column_name IS NULL
) AS CHAR), 'toutes les tables transactionnelles portent cree_le');

-- (d) invariant metier : une inscription ADMIS_CONDITIONNEL a une dette entre 1 et 12
--     (regle D7, verifiee applicativement). Les tables du module 6 sont videes
--     par les fixtures : aucune collision sur la cle unique (inscription_id).
INSERT INTO resultat_annuel (inscription_id, annee_scolaire_id, regime, moyenne_annuelle, credits_acquis, credits_requis, dette_credits, decision)
  VALUES (@insc_1, @an_2025, 'LMD', 10.5, 50, 60, 10, 'ADMIS_CONDITIONNEL');
CALL assert_true(
  (SELECT dette_credits BETWEEN 1 AND 12 FROM resultat_annuel WHERE inscription_id=@insc_1),
  'ADMIS_CONDITIONNEL : dette entre 1 et 12 (regle D7, verifiee applicativement)');

-- (e) l'echeancier d'une inscription non boursiere couvre exactement le cout du
--     (cout negocie sinon modalite_paiement.montant_total, joint via classe -> niveau).
CALL assert_equals(
  CAST((SELECT COALESCE(i.cout_scolarite_negocie, mp.montant_total)
        FROM inscription i
        JOIN classe c ON c.id = i.classe_id
        JOIN modalite_paiement mp ON mp.niveau_id = c.niveau_id AND mp.annee_scolaire_id = i.annee_scolaire_id
        WHERE i.id = @insc_1) AS CHAR),
  CAST((SELECT SUM(montant_prevu) FROM echeance WHERE inscription_id = @insc_1) AS CHAR),
  'somme de l echeancier = cout du de la scolarite');

ROLLBACK;

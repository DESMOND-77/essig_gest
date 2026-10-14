-- Test 001 : structure et contraintes du référentiel académique.
START TRANSACTION;

-- 10 tables créées par la migration 001
CALL assert_equals('10', CAST((
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name IN ('ecole','annee_scolaire','modalite_formation','niveau',
                       'filiere','option_filiere','classe','matiere','periode','session_examen')
) AS CHAR), 'les 10 tables du referentiel existent');

-- toutes en InnoDB / utf8mb4
CALL assert_equals('0', CAST((
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name IN ('ecole','niveau','classe','matiere')
    AND (engine <> 'InnoDB' OR table_collation <> 'utf8mb4_unicode_ci')
) AS CHAR), 'moteur InnoDB + collation utf8mb4_unicode_ci');

-- FK classe -> 4 references
CALL assert_equals('4', CAST((
  SELECT COUNT(*) FROM information_schema.referential_constraints
  WHERE constraint_schema = DATABASE() AND table_name = 'classe'
) AS CHAR), 'classe a 4 cles etrangeres');

-- unicite (ecole_id, code) sur niveau : deux L1 dans la meme ecole doivent echouer
INSERT INTO ecole (nom, regime) VALUES ('E tmp', 'LMD');
SET @et = LAST_INSERT_ID();
INSERT INTO niveau (ecole_id, code, libelle, ordre, credits_requis) VALUES (@et, 'L1', 'Licence 1', 1, 60);

DROP PROCEDURE IF EXISTS _t001_doublon;
DELIMITER $$
CREATE PROCEDURE _t001_doublon()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET @doublon_rejete = 1;
  SET @doublon_rejete = 0;
  INSERT INTO niveau (ecole_id, code, libelle, ordre, credits_requis) VALUES (@et, 'L1', 'Doublon', 9, 60);
END$$
DELIMITER ;
CALL _t001_doublon();
CALL assert_true(@doublon_rejete, 'unq_niveau_ecole_code rejette un doublon (ecole_id, code)');
DROP PROCEDURE _t001_doublon;

-- credits_requis nullable (regime CLASSIQUE)
INSERT INTO niveau (ecole_id, code, libelle, ordre, credits_requis) VALUES (@et, '1A', '1ere Annee', 1, NULL);
CALL assert_true((SELECT credits_requis IS NULL FROM niveau WHERE ecole_id=@et AND code='1A'),
                 'niveau.credits_requis accepte NULL');

ROLLBACK;

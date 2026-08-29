-- Test 007 : evaluations & resultats (regles LMD et classique).
START TRANSACTION;

-- note_retenue : rattrapage plafonne a 10, on garde le max
INSERT INTO resultat_matiere (inscription_id, matiere_id, periode_id, note_normale, note_rattrapage, credits)
  VALUES (@insc_1, @mat_cg1, @per_s1, 8.00, 14.00, 6);
SET @rm_1 = LAST_INSERT_ID();
CALL assert_equals('10.00', CAST((SELECT note_retenue FROM resultat_matiere WHERE id=@rm_1) AS CHAR),
                   'note_retenue = max(8, min(14,10)) = 10');
CALL assert_equals('1', CAST((SELECT validee FROM resultat_matiere WHERE id=@rm_1) AS CHAR),
                   'matiere validee car note_retenue >= 10');
CALL assert_equals('6', CAST((SELECT credits_acquis FROM resultat_matiere WHERE id=@rm_1) AS CHAR),
                   'credits_acquis = credits car validee');

-- normale >= 10, pas de rattrapage
UPDATE resultat_matiere SET note_normale = 12.50, note_rattrapage = NULL WHERE id=@rm_1;
CALL assert_equals('12.50', CAST((SELECT note_retenue FROM resultat_matiere WHERE id=@rm_1) AS CHAR),
                   'note_retenue = note_normale quand pas de rattrapage');

-- echec : normale 6, rattrapage 9 -> retenue 9, non validee, credits_acquis 0
UPDATE resultat_matiere SET note_normale = 6.00, note_rattrapage = 9.00 WHERE id=@rm_1;
CALL assert_equals('9.00', CAST((SELECT note_retenue FROM resultat_matiere WHERE id=@rm_1) AS CHAR), 'retenue = 9');
CALL assert_equals('0', CAST((SELECT validee FROM resultat_matiere WHERE id=@rm_1) AS CHAR), 'non validee');
CALL assert_equals('0', CAST((SELECT credits_acquis FROM resultat_matiere WHERE id=@rm_1) AS CHAR), 'credits_acquis = 0');

-- regime CLASSIQUE : credits NULL -> credits_acquis NULL
INSERT INTO resultat_matiere (inscription_id, matiere_id, periode_id, note_normale, credits)
  VALUES (@insc_1, (SELECT id FROM matiere WHERE niveau_id=@niv_essig_l1 AND code='MF1'), @per_s1, 11.00, NULL);
CALL assert_true((SELECT credits_acquis IS NULL FROM resultat_matiere
                  WHERE inscription_id=@insc_1 AND matiere_id=(SELECT id FROM matiere WHERE niveau_id=@niv_essig_l1 AND code='MF1')),
                 'credits NULL (non-LMD) -> credits_acquis NULL');

-- unicite du resultat par (inscription, matiere, periode)
DROP PROCEDURE IF EXISTS _t007_rm;
DELIMITER $$
CREATE PROCEDURE _t007_rm()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET @rm_rejete = 1;
  SET @rm_rejete = 0;
  INSERT INTO resultat_matiere (inscription_id, matiere_id, periode_id, note_normale, credits)
    VALUES (@insc_1, @mat_cg1, @per_s1, 15.00, 6);
END$$
DELIMITER ;
CALL _t007_rm();
CALL assert_true(@rm_rejete, 'unq_resultat_matiere (inscription, matiere, periode)');
DROP PROCEDURE _t007_rm;

-- resultat_annuel : decisions
INSERT INTO resultat_annuel (inscription_id, annee_scolaire_id, regime, moyenne_annuelle, credits_acquis, credits_requis, dette_credits, decision, mention)
  VALUES (@insc_1, @an_2025, 'LMD', 11.20, 52, 60, 8, 'ADMIS_CONDITIONNEL', 'PASSABLE');
CALL assert_equals('ADMIS_CONDITIONNEL', (SELECT decision FROM resultat_annuel WHERE inscription_id=@insc_1),
                   'LMD : 52/60 credits -> ADMIS_CONDITIONNEL (>=48)');

-- note_evaluation : borne 0..20
DROP PROCEDURE IF EXISTS _t007_ne;
DELIMITER $$
CREATE PROCEDURE _t007_ne()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET @ne_rejete = 1;
  SET @ne_rejete = 0;
  INSERT INTO evaluation (matiere_id, classe_id, session_examen_id, type, ponderation)
    VALUES (@mat_cg1, @classe_essig_l1, @sess_s1_normale, 'EXAMEN', 60);
  INSERT INTO note_evaluation (evaluation_id, inscription_id, valeur) VALUES (LAST_INSERT_ID(), @insc_1, 21.00);
END$$
DELIMITER ;
CALL _t007_ne();
CALL assert_true(@ne_rejete, 'chk_note_evaluation_valeur : note > 20 rejetee');
DROP PROCEDURE _t007_ne;

-- dette_credit + solde
INSERT INTO dette_credit (inscription_origine_id, matiere_id, credits, annee_origine_id)
  VALUES (@insc_1, @mat_cg1, 6, @an_2025);
CALL assert_equals('0', CAST((SELECT soldee FROM dette_credit WHERE inscription_origine_id=@insc_1 AND matiere_id=@mat_cg1) AS CHAR),
                   'dette_credit creee non soldee');

ROLLBACK;

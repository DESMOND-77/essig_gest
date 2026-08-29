-- Test 002 : utilisateurs, roles, audit.
START TRANSACTION;

CALL assert_equals('4', CAST((
  SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()
    AND table_name IN ('role','utilisateur','utilisateur_role','journal_audit')
) AS CHAR), 'les 4 tables transverses existent');

-- login unique
DROP PROCEDURE IF EXISTS _t002_login;
DELIMITER $$
CREATE PROCEDURE _t002_login()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET @login_rejete = 1;
  SET @login_rejete = 0;
  INSERT INTO utilisateur (login, email, mot_de_passe_hash) VALUES ('admin', 'autre@usia.test', 'y');
END$$
DELIMITER ;
CALL _t002_login();
CALL assert_true(@login_rejete, 'unq_utilisateur_login rejette un login en double');
DROP PROCEDURE _t002_login;

-- UNIQUE KEY unq_utilisateur_role : (u, r, NULL) puis (u, r, ecole) coexistent
INSERT INTO utilisateur_role (utilisateur_id, role_id, ecole_id)
  VALUES (@u_admin, (SELECT id FROM role WHERE code='DAF'), @e_essig);
CALL assert_equals('2', CAST((SELECT COUNT(*) FROM utilisateur_role WHERE utilisateur_id=@u_admin) AS CHAR),
                   'utilisateur_role accepte (u,r,NULL) et (u,r,ecole)');

-- suppression utilisateur -> cascade sur utilisateur_role
DELETE FROM utilisateur WHERE id=@u_admin;
CALL assert_equals('0', CAST((SELECT COUNT(*) FROM utilisateur_role WHERE utilisateur_id=@u_admin) AS CHAR),
                   'ON DELETE CASCADE utilisateur -> utilisateur_role');

-- journal_audit accepte du JSON
INSERT INTO utilisateur (login,email,mot_de_passe_hash) VALUES ('u2','u2@t','x'); SET @u2=LAST_INSERT_ID();
INSERT INTO journal_audit (utilisateur_id, action, table_cible, ligne_id, valeurs_apres)
  VALUES (@u2, 'CREATION', 'ecole', 1, JSON_OBJECT('nom','X'));
CALL assert_true((SELECT JSON_VALID(valeurs_apres) FROM journal_audit ORDER BY id DESC LIMIT 1),
                 'journal_audit.valeurs_apres est du JSON valide');

ROLLBACK;

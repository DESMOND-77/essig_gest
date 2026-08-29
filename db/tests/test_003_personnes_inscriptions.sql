-- Test 003 : personnes & inscriptions.
START TRANSACTION;

-- matricule unique
DROP PROCEDURE IF EXISTS _t003_mat;
DELIMITER $$
CREATE PROCEDURE _t003_mat()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET @mat_rejete = 1;
  SET @mat_rejete = 0;
  INSERT INTO etudiant (matricule, nom, prenoms, sexe) VALUES ('ESSIG-2025-0001', 'X', 'Y', 'F');
END$$
DELIMITER ;
CALL _t003_mat();
CALL assert_true(@mat_rejete, 'unq_etudiant_matricule rejette un doublon');
DROP PROCEDURE _t003_mat;

-- une seule inscription par (etudiant, annee)
DROP PROCEDURE IF EXISTS _t003_insc;
DELIMITER $$
CREATE PROCEDURE _t003_insc()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET @insc_rejete = 1;
  SET @insc_rejete = 0;
  INSERT INTO inscription (etudiant_id, classe_id, ecole_id, annee_scolaire_id, numero_ordre,
                           type, statut, date_inscription)
    VALUES (@etu_1, @classe_essig_l1, @e_essig, @an_2025, 99, 'REINSCRIPTION', 'ANCIEN', '2025-10-01');
END$$
DELIMITER ;
CALL _t003_insc();
CALL assert_true(@insc_rejete, 'unq_inscription_etudiant_annee : une inscription par etudiant et par annee');
DROP PROCEDURE _t003_insc;

-- numero_ordre unique par (ecole, annee)
INSERT INTO etudiant (matricule, nom, prenoms, sexe) VALUES ('ESSIG-2025-0002','A','B','M');
SET @etu_2 = LAST_INSERT_ID();
DROP PROCEDURE IF EXISTS _t003_ordre;
DELIMITER $$
CREATE PROCEDURE _t003_ordre()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET @ordre_rejete = 1;
  SET @ordre_rejete = 0;
  INSERT INTO inscription (etudiant_id, classe_id, ecole_id, annee_scolaire_id, numero_ordre,
                           type, statut, date_inscription)
    VALUES (@etu_2, @classe_essig_l1, @e_essig, @an_2025, 1, 'INSCRIPTION', 'NOUVEAU', '2025-09-21');
END$$
DELIMITER ;
CALL _t003_ordre();
CALL assert_true(@ordre_rejete, 'unq_inscription_numero_ordre : (ecole, annee, numero_ordre) unique');
DROP PROCEDURE _t003_ordre;

-- affiliation : 3 types + cascade a la suppression de l'etudiant
INSERT INTO affiliation (etudiant_id, type, nom, prenom, contact) VALUES
  (@etu_2,'PERE','A','P','01'), (@etu_2,'MERE','A','M','02'), (@etu_2,'TUTEUR','A','T','03');
CALL assert_equals('3', CAST((SELECT COUNT(*) FROM affiliation WHERE etudiant_id=@etu_2) AS CHAR),
                   'affiliation : PERE/MERE/TUTEUR');
DELETE FROM etudiant WHERE id=@etu_2;
CALL assert_equals('0', CAST((SELECT COUNT(*) FROM affiliation WHERE etudiant_id=@etu_2) AS CHAR),
                   'ON DELETE CASCADE etudiant -> affiliation');

-- etat par defaut
CALL assert_equals('ACTIVE', (SELECT etat FROM inscription WHERE id=@insc_1), 'inscription.etat defaut = ACTIVE');

ROLLBACK;

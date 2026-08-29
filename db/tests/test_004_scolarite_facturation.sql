-- Test 004 : scolarite & facturation.
START TRANSACTION;

-- colonne generee montant_total
CALL assert_equals('735000', CAST((
  SELECT montant_total FROM modalite_paiement WHERE niveau_id=@niv_essig_l1 AND annee_scolaire_id=@an_2025
) AS CHAR), 'modalite_paiement.montant_total = 105000 + 9*70000');

-- echeancier : 10 lignes (0..9), somme des mensualites = 630000
CALL assert_equals('10', CAST((SELECT COUNT(*) FROM echeance WHERE inscription_id=@insc_1) AS CHAR),
                   'echeancier : 10 echeances (numero 0..9)');
CALL assert_equals('630000', CAST((
  SELECT SUM(montant_prevu) FROM echeance WHERE inscription_id=@insc_1 AND numero > 0
) AS CHAR), 'somme des mensualites = 630000');

-- unicite (inscription, numero)
DROP PROCEDURE IF EXISTS _t004_ech;
DELIMITER $$
CREATE PROCEDURE _t004_ech()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET @ech_rejete = 1;
  SET @ech_rejete = 0;
  INSERT INTO echeance (inscription_id, numero, montant_prevu, date_prevue)
    VALUES (@insc_1, 1, 1, '2025-10-06');
END$$
DELIMITER ;
CALL _t004_ech();
CALL assert_true(@ech_rejete, 'unq_echeance (inscription_id, numero)');
DROP PROCEDURE _t004_ech;

-- unicite (inscription, type_frais)
DROP PROCEDURE IF EXISTS _t004_fi;
DELIMITER $$
CREATE PROCEDURE _t004_fi()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET @fi_rejete = 1;
  SET @fi_rejete = 0;
  INSERT INTO frais_inscription (inscription_id, type_frais_id, montant_du) VALUES (@insc_1, @tf_tenue, 1);
END$$
DELIMITER ;
CALL _t004_fi();
CALL assert_true(@fi_rejete, 'unq_frais_inscription (inscription_id, type_frais_id)');
DROP PROCEDURE _t004_fi;

-- bourse : marquage pris_en_charge_bourse
UPDATE echeance SET pris_en_charge_bourse = 1 WHERE inscription_id=@insc_1 AND numero > 0;
INSERT INTO bourse (inscription_id, organisme, montant_couvert, cree_par)
  VALUES (@insc_1, 'ANBG', 630000, @u_admin);
CALL assert_equals('9', CAST((
  SELECT COUNT(*) FROM echeance WHERE inscription_id=@insc_1 AND pris_en_charge_bourse=1
) AS CHAR), 'boursier : 9 echeances prises en charge, l inscription reste a la charge de l etudiant');

ROLLBACK;

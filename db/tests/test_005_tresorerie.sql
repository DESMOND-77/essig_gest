-- Test 005 : grand livre de tresorerie.
START TRANSACTION;

-- montant > 0 impose
DROP PROCEDURE IF EXISTS _t005_neg;
DELIMITER $$
CREATE PROCEDURE _t005_neg()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET @neg_rejete = 1;
  SET @neg_rejete = 0;
  INSERT INTO mouvement (compte_id, date_operation, sens, montant, categorie_mouvement_id, libelle, annee_scolaire_id)
    VALUES (@cpt_caisse, '2025-10-05', 'CREDIT', -100, @cat_scol, 'negatif', @an_2025);
END$$
DELIMITER ;
CALL _t005_neg();
CALL assert_true(@neg_rejete, 'chk_mouvement_montant : montant <= 0 rejete');
DROP PROCEDURE _t005_neg;

-- encaissement 100 000 : 1 mouvement CREDIT + ventilation echeance(70000) + frais tenue(25000) + echeance(5000)
INSERT INTO mouvement (compte_id, date_operation, sens, montant, categorie_mouvement_id, libelle, ecole_id, annee_scolaire_id, cree_par)
  VALUES (@cpt_caisse, '2025-10-05', 'CREDIT', 100000, @cat_scol, 'Encaissement recu R-0001', @e_essig, @an_2025, @u_admin);
SET @mv_enc = LAST_INSERT_ID();
INSERT INTO encaissement (inscription_id, date, montant_total, mode, compte_id, mouvement_id, recu_numero, cree_par)
  VALUES (@insc_1, '2025-10-05', 100000, 'ESPECES', @cpt_caisse, @mv_enc, 'R-0001', @u_admin);
SET @enc_1 = LAST_INSERT_ID();
INSERT INTO imputation_encaissement (encaissement_id, cible, echeance_id, montant)
  VALUES (@enc_1, 'ECHEANCE', @ech_1_1, 70000);
INSERT INTO imputation_encaissement (encaissement_id, cible, frais_inscription_id, montant)
  VALUES (@enc_1, 'FRAIS', @fi_tenue_1, 25000);
INSERT INTO imputation_encaissement (encaissement_id, cible, echeance_id, montant)
  VALUES (@enc_1, 'ECHEANCE', (SELECT id FROM echeance WHERE inscription_id=@insc_1 AND numero=2), 5000);

CALL assert_equals('100000', CAST((
  SELECT SUM(montant) FROM imputation_encaissement WHERE encaissement_id=@enc_1
) AS CHAR), 'somme des imputations = montant de l encaissement');

-- recu_numero unique
DROP PROCEDURE IF EXISTS _t005_recu;
DELIMITER $$
CREATE PROCEDURE _t005_recu()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET @recu_rejete = 1;
  SET @recu_rejete = 0;
  INSERT INTO mouvement (compte_id, date_operation, sens, montant, categorie_mouvement_id, libelle, annee_scolaire_id)
    VALUES (@cpt_caisse, '2025-10-06', 'CREDIT', 1, @cat_scol, 'x', @an_2025);
  INSERT INTO encaissement (inscription_id, date, montant_total, mode, compte_id, mouvement_id, recu_numero)
    VALUES (@insc_1, '2025-10-06', 1, 'ESPECES', @cpt_caisse, LAST_INSERT_ID(), 'R-0001');
END$$
DELIMITER ;
CALL _t005_recu();
CALL assert_true(@recu_rejete, 'unq_encaissement_recu : numerotation globale des recus');
DROP PROCEDURE _t005_recu;

-- imputation incoherente (cible ECHEANCE sans echeance_id) rejetee par le CHECK
DROP PROCEDURE IF EXISTS _t005_imp;
DELIMITER $$
CREATE PROCEDURE _t005_imp()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET @imp_rejete = 1;
  SET @imp_rejete = 0;
  INSERT INTO imputation_encaissement (encaissement_id, cible, montant) VALUES (@enc_1, 'ECHEANCE', 1);
END$$
DELIMITER ;
CALL _t005_imp();
CALL assert_true(@imp_rejete, 'chk_imputation_cible : ECHEANCE exige echeance_id');
DROP PROCEDURE _t005_imp;

-- suppression encaissement -> cascade imputations
DELETE FROM encaissement WHERE id=@enc_1;
CALL assert_equals('0', CAST((SELECT COUNT(*) FROM imputation_encaissement WHERE encaissement_id=@enc_1) AS CHAR),
                   'ON DELETE CASCADE encaissement -> imputation_encaissement');

-- virement : CHECK source <> destination
DROP PROCEDURE IF EXISTS _t005_vir;
DELIMITER $$
CREATE PROCEDURE _t005_vir()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET @vir_rejete = 1;
  SET @vir_rejete = 0;
  INSERT INTO virement (compte_source_id, compte_destination_id, montant, date, motif)
    VALUES (@cpt_caisse, @cpt_caisse, 1000, '2025-10-10', 'boucle');
END$$
DELIMITER ;
CALL _t005_vir();
CALL assert_true(@vir_rejete, 'chk_virement_comptes : source <> destination');
DROP PROCEDURE _t005_vir;

-- arrete_caisse.ecart genere
INSERT INTO arrete_caisse (compte_id, date, solde_theorique, solde_physique, fait_par)
  VALUES (@cpt_caisse, '2025-10-31', 500000, 495000, @u_admin);
SET @ac_1 = LAST_INSERT_ID();
CALL assert_equals('-5000', CAST((SELECT ecart FROM arrete_caisse WHERE id=@ac_1) AS CHAR),
                   'arrete_caisse.ecart = physique - theorique');
INSERT INTO billetage (arrete_caisse_id, denomination, quantite) VALUES (@ac_1, 10000, 40), (@ac_1, 5000, 19);
CALL assert_equals('495000', CAST((SELECT SUM(montant) FROM billetage WHERE arrete_caisse_id=@ac_1) AS CHAR),
                   'billetage.montant genere : 40*10000 + 19*5000');

ROLLBACK;

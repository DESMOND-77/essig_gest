-- Test 006 : RH & paie.
START TRANSACTION;

-- montant_prevu genere
CALL assert_equals('360000', CAST((SELECT montant_prevu FROM affectation_enseignement WHERE id=@aff_1) AS CHAR),
                   'affectation.montant_prevu = 45 * 8000');

-- une matiere d'une classe : un seul enseignant (pas de co-enseignement)
INSERT INTO enseignant (nom, prenom) VALUES ('AUTRE', 'Prof'); SET @ens_2 = LAST_INSERT_ID();
DROP PROCEDURE IF EXISTS _t006_coens;
DELIMITER $$
CREATE PROCEDURE _t006_coens()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET @coens_rejete = 1;
  SET @coens_rejete = 0;
  INSERT INTO affectation_enseignement (enseignant_id, matiere_id, classe_id, annee_scolaire_id, volume_horaire_prevu, taux_horaire)
    VALUES (@ens_2, @mat_cg1, @classe_essig_l1, @an_2025, 10, 8000);
END$$
DELIMITER ;
CALL _t006_coens();
CALL assert_true(@coens_rejete, 'unq_affectation (matiere_id, classe_id) : co-enseignement interdit');
DROP PROCEDURE _t006_coens;

-- FK differee utilisateur.personnel_administratif_id operationnelle
UPDATE utilisateur SET personnel_administratif_id = @pers_1 WHERE id = @u_admin;
CALL assert_equals(CAST(@pers_1 AS CHAR), CAST((SELECT personnel_administratif_id FROM utilisateur WHERE id=@u_admin) AS CHAR),
                   'fk_utilisateur_personnel ajoutee par 006');

-- salaire enseignant : 1 mouvement DEBIT + ligne salaire
INSERT INTO mouvement (compte_id, date_operation, sens, montant, categorie_mouvement_id, libelle, ecole_id, annee_scolaire_id, cree_par)
  VALUES (@cpt_banque, '2025-11-30', 'DEBIT', 180000, (SELECT id FROM categorie_mouvement WHERE code='SALAIRE_ENSEIGNANT'),
          'Salaire nov. EKO MBA', @e_essig, @an_2025, @u_admin);
SET @mv_sal = LAST_INSERT_ID();
INSERT INTO salaire_enseignant (enseignant_id, affectation_enseignement_id, annee_scolaire_id, mois, date_paiement, montant, compte_id, mouvement_id, cree_par)
  VALUES (@ens_1, @aff_1, @an_2025, 'NOV', '2025-11-30', 180000, @cpt_banque, @mv_sal, @u_admin);
CALL assert_equals('180000', CAST((SELECT montant FROM salaire_enseignant WHERE mouvement_id=@mv_sal) AS CHAR),
                   'salaire_enseignant enregistre');

-- salaire admin : unicite (personnel, annee, mois)
INSERT INTO mouvement (compte_id, date_operation, sens, montant, categorie_mouvement_id, libelle, annee_scolaire_id)
  VALUES (@cpt_banque, '2025-11-30', 'DEBIT', 100000, (SELECT id FROM categorie_mouvement WHERE code='SALAIRE_ADMIN'), 'Salaire nov. KASSA', @an_2025);
INSERT INTO salaire_administration (personnel_administratif_id, annee_scolaire_id, mois, date_paiement, montant_du, montant_paye, compte_id, mouvement_id)
  VALUES (@pers_1, @an_2025, 'NOV', '2025-11-30', 100000, 100000, @cpt_banque, LAST_INSERT_ID());
DROP PROCEDURE IF EXISTS _t006_saladmin;
DELIMITER $$
CREATE PROCEDURE _t006_saladmin()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET @saladmin_rejete = 1;
  SET @saladmin_rejete = 0;
  INSERT INTO mouvement (compte_id, date_operation, sens, montant, categorie_mouvement_id, libelle, annee_scolaire_id)
    VALUES (@cpt_banque, '2025-11-30', 'DEBIT', 1, (SELECT id FROM categorie_mouvement WHERE code='SALAIRE_ADMIN'), 'x', @an_2025);
  INSERT INTO salaire_administration (personnel_administratif_id, annee_scolaire_id, mois, date_paiement, montant_du, montant_paye, compte_id, mouvement_id)
    VALUES (@pers_1, @an_2025, 'NOV', '2025-12-01', 100000, 50000, @cpt_banque, LAST_INSERT_ID());
END$$
DELIMITER ;
CALL _t006_saladmin();
CALL assert_true(@saladmin_rejete, 'unq_salaire_admin (personnel, annee, mois)');
DROP PROCEDURE _t006_saladmin;

-- avance : coherence beneficiaire
INSERT INTO mouvement (compte_id, date_operation, sens, montant, categorie_mouvement_id, libelle, annee_scolaire_id)
  VALUES (@cpt_caisse, '2025-11-10', 'DEBIT', 20000, (SELECT id FROM categorie_mouvement WHERE code='SALAIRE_ADMIN'), 'avance', @an_2025);
SET @mv_avance = LAST_INSERT_ID();

DROP PROCEDURE IF EXISTS _t006_avance;
DELIMITER $$
CREATE PROCEDURE _t006_avance()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET @avance_rejete = 1;
  SET @avance_rejete = 0;
  INSERT INTO avance_personnel (beneficiaire, date, montant, compte_id, mouvement_id)
    VALUES ('ADMIN', '2025-11-10', 20000, @cpt_caisse, @mv_avance);
END$$
DELIMITER ;
CALL _t006_avance();
CALL assert_true(@avance_rejete, 'chk_avance_beneficiaire : ADMIN exige personnel_administratif_id');
DROP PROCEDURE _t006_avance;

ROLLBACK;

-- Test 008 : vues de calcul, sur le scenario des fixtures.
START TRANSACTION;

-- 13 vues creees
CALL assert_equals('13', CAST((
  SELECT COUNT(*) FROM information_schema.views WHERE table_schema = DATABASE()
    AND table_name IN ('v_situation_scolarite','v_situation_frais','v_echeancier','v_solde_compte',
      'v_bilan_mensuel','v_bilan_consolide','v_etat_scolarite_etudiant','v_resultat_matiere',
      'v_bulletin_periode','v_resultat_annuel','v_masse_salariale','v_paie_enseignant','v_arrete_caisse')
) AS CHAR), 'les 13 vues existent');

-- cout du de l'inscription 1 = 735 000 (grille), part etudiant = 735 000 (non boursier)
CALL assert_equals('735000', CAST((SELECT cout_du FROM v_situation_scolarite WHERE inscription_id=@insc_1) AS CHAR),
                   'v_situation_scolarite.cout_du = grille');
CALL assert_equals('735000', CAST((SELECT part_etudiant FROM v_situation_scolarite WHERE inscription_id=@insc_1) AS CHAR),
                   'v_situation_scolarite.part_etudiant (non boursier)');

-- encaissement de 70 000 impute sur echeance 1
INSERT INTO mouvement (compte_id, date_operation, sens, montant, categorie_mouvement_id, libelle, ecole_id, annee_scolaire_id)
  VALUES (@cpt_caisse, '2025-10-05', 'CREDIT', 70000, @cat_scol, 'R-9001', @e_essig, @an_2025);
SET @mv = LAST_INSERT_ID();
INSERT INTO encaissement (inscription_id, date, montant_total, mode, compte_id, mouvement_id, recu_numero)
  VALUES (@insc_1, '2025-10-05', 70000, 'ESPECES', @cpt_caisse, @mv, 'R-9001');
INSERT INTO imputation_encaissement (encaissement_id, cible, echeance_id, montant)
  VALUES (LAST_INSERT_ID(), 'ECHEANCE', @ech_1_1, 70000);

CALL assert_equals('70000', CAST((SELECT total_encaisse FROM v_situation_scolarite WHERE inscription_id=@insc_1) AS CHAR),
                   'v_situation_scolarite.total_encaisse');
CALL assert_equals('665000', CAST((SELECT reste FROM v_situation_scolarite WHERE inscription_id=@insc_1) AS CHAR),
                   'v_situation_scolarite.reste = 735000 - 70000');
CALL assert_equals('PARTIEL', (SELECT etat FROM v_situation_scolarite WHERE inscription_id=@insc_1),
                   'v_situation_scolarite.etat = PARTIEL');

-- v_echeancier : echeance 1 soldee, reste 0
CALL assert_equals('0', CAST((SELECT reste FROM v_echeancier WHERE echeance_id=@ech_1_1) AS CHAR),
                   'v_echeancier : echeance 1 reglee');

-- v_solde_compte : caisse = 70 000
CALL assert_equals('70000', CAST((SELECT solde FROM v_solde_compte WHERE compte_id=@cpt_caisse) AS CHAR),
                   'v_solde_compte : caisse creditee de 70000');

-- v_bilan_mensuel : entrees octobre 2025 pour ESSIG = 70 000
CALL assert_equals('70000', CAST((
  SELECT entrees FROM v_bilan_mensuel WHERE ecole_id=@e_essig AND annee=2025 AND mois=10
) AS CHAR), 'v_bilan_mensuel : entrees oct. 2025');

-- v_bulletin_periode : moyenne ponderee sur @insc_1 / S1
INSERT INTO resultat_matiere (inscription_id, matiere_id, periode_id, note_normale, credits)
  VALUES (@insc_1, @mat_cg1, @per_s1, 12.00, 6),
         (@insc_1, (SELECT id FROM matiere WHERE niveau_id=@niv_essig_l1 AND code='MF1'), @per_s1, 9.00, 4);
-- (12*3 + 9*2) / (3+2) = (36+18)/5 = 10.80
CALL assert_equals('10.80', CAST((
  SELECT moyenne_ponderee FROM v_bulletin_periode WHERE inscription_id=@insc_1 AND periode_id=@per_s1
) AS CHAR), 'v_bulletin_periode : moyenne ponderee = 10.80');

-- v_paie_enseignant : du = 360 000 (45h * 8000), paye = 0
CALL assert_equals('360000', CAST((
  SELECT montant_du FROM v_paie_enseignant WHERE enseignant_id=@ens_1 AND annee_scolaire_id=@an_2025
) AS CHAR), 'v_paie_enseignant.montant_du');

ROLLBACK;

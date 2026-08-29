-- Fixtures de base réutilisées par tous les tests. Idempotent (TRUNCATE puis INSERT).
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE session_examen;
TRUNCATE TABLE periode;
TRUNCATE TABLE matiere;
TRUNCATE TABLE classe;
TRUNCATE TABLE option_filiere;
TRUNCATE TABLE filiere;
TRUNCATE TABLE niveau;
TRUNCATE TABLE annee_scolaire;
TRUNCATE TABLE ecole;
TRUNCATE TABLE groupe_scolaire;
SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO groupe_scolaire (nom, sigle) VALUES ('Groupe Scolaire USIA', 'USIA');
SET @g_groupe = LAST_INSERT_ID();

INSERT INTO ecole (groupe_scolaire_id, nom, sigle, pole, regime) VALUES
  (@g_groupe, 'Ecole Superieure des Sciences d''Informatique et de Gestion', 'ESSIG', 'ESSIG', 'LMD');
SET @e_essig = LAST_INSERT_ID();
INSERT INTO ecole (groupe_scolaire_id, nom, sigle, pole, regime) VALUES
  (@g_groupe, 'Universite Polytechnique des Sciences de la Sante', 'UPSS', 'UPSS', 'LMD');
SET @e_upss = LAST_INSERT_ID();
INSERT INTO ecole (groupe_scolaire_id, nom, sigle, pole, regime) VALUES
  (@g_groupe, 'Centre de Formation Polytechnique Appliquee', 'CFPA', 'CFPA', 'CLASSIQUE');
SET @e_cfpa = LAST_INSERT_ID();

INSERT INTO annee_scolaire (libelle, date_debut, date_fin, est_courante)
  VALUES ('2025-2026', '2025-10-01', '2026-08-31', 1);
SET @an_2025 = LAST_INSERT_ID();

INSERT INTO modalite_formation (code, libelle) VALUES ('FI', 'Formation Initiale')
  ON DUPLICATE KEY UPDATE libelle = VALUES(libelle);
SET @mod_fi = (SELECT id FROM modalite_formation WHERE code = 'FI');

INSERT INTO niveau (ecole_id, code, libelle, ordre, credits_requis, a_soutenance) VALUES
  (@e_essig, 'L1', 'Licence 1', 1, 60, 0),
  (@e_essig, 'L2', 'Licence 2', 2, 60, 0),
  (@e_essig, 'L3', 'Licence 3', 3, 60, 1);
SET @niv_essig_l1 = (SELECT id FROM niveau WHERE ecole_id = @e_essig AND code = 'L1');
INSERT INTO niveau (ecole_id, code, libelle, ordre, credits_requis) VALUES
  (@e_cfpa, '1A', '1ere Annee', 1, NULL);
SET @niv_cfpa_1a = LAST_INSERT_ID();

INSERT INTO filiere (ecole_id, nom, sigle) VALUES
  (@e_essig, 'Gestion Administrative et Commerciale', 'GACO');
SET @fil_essig = LAST_INSERT_ID();
INSERT INTO option_filiere (filiere_id, nom, sigle) VALUES
  (@fil_essig, 'Commerce International', 'CI');
SET @opt_essig = LAST_INSERT_ID();

INSERT INTO classe (annee_scolaire_id, niveau_id, option_filiere_id, modalite_formation_id, libelle_auto)
  VALUES (@an_2025, @niv_essig_l1, @opt_essig, @mod_fi, 'L1 GACO/CI FI 2025-2026');
SET @classe_essig_l1 = LAST_INSERT_ID();

INSERT INTO matiere (niveau_id, option_filiere_id, semestre, nom, code, coefficient, credits, volume_horaire) VALUES
  (@niv_essig_l1, @opt_essig, 'S1', 'Comptabilite generale', 'CG1', 3, 6, 45),
  (@niv_essig_l1, @opt_essig, 'S1', 'Mathematiques financieres', 'MF1', 2, 4, 30);
SET @mat_cg1 = (SELECT id FROM matiere WHERE niveau_id=@niv_essig_l1 AND code='CG1');

INSERT INTO periode (annee_scolaire_id, numero, libelle, date_debut, date_fin) VALUES
  (@an_2025, 1, 'Semestre 1', '2025-10-01', '2026-02-15'),
  (@an_2025, 2, 'Semestre 2', '2026-02-16', '2026-07-15');
SET @per_s1 = (SELECT id FROM periode WHERE annee_scolaire_id=@an_2025 AND numero=1);

INSERT INTO session_examen (periode_id, type) VALUES (@per_s1, 'NORMALE'), (@per_s1, 'RATTRAPAGE');
SET @sess_s1_normale = (SELECT id FROM session_examen WHERE periode_id=@per_s1 AND type='NORMALE');

-- Fixtures utilisateurs & audit
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE utilisateur_role;
TRUNCATE TABLE journal_audit;
TRUNCATE TABLE utilisateur;
SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO role (code, libelle) VALUES ('DAF','Directeur Administratif et Financier') AS new
  ON DUPLICATE KEY UPDATE libelle = new.libelle;

INSERT INTO utilisateur (login, email, mot_de_passe_hash) VALUES ('admin', 'admin@usia.test', 'x');
SET @u_admin = LAST_INSERT_ID();
INSERT INTO utilisateur_role (utilisateur_id, role_id, ecole_id)
  VALUES (@u_admin, (SELECT id FROM role WHERE code='DAF'), NULL);

-- Fixtures personnes & inscriptions
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE inscription;
TRUNCATE TABLE situation_bac;
TRUNCATE TABLE affiliation;
TRUNCATE TABLE etudiant;
SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO etudiant (matricule, nom, prenoms, sexe, date_naissance, nationalite)
  VALUES ('ESSIG-2025-0001', 'NDONG', 'Jean Pierre', 'M', '2004-05-12', 'Gabonaise');
SET @etu_1 = LAST_INSERT_ID();

INSERT INTO inscription (etudiant_id, classe_id, ecole_id, annee_scolaire_id, numero_ordre,
                         type, statut, est_boursier, date_inscription, cree_par)
  VALUES (@etu_1, @classe_essig_l1, @e_essig, @an_2025, 1,
          'INSCRIPTION', 'NOUVEAU', 0, '2025-09-20', @u_admin);
SET @insc_1 = LAST_INSERT_ID();

-- Fixtures scolarite & facturation
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE bourse;
TRUNCATE TABLE echeance;
TRUNCATE TABLE frais_inscription;
TRUNCATE TABLE type_frais;
TRUNCATE TABLE modalite_paiement;
SET FOREIGN_KEY_CHECKS = 1;

-- ESSIG L1 2025-2026 : 105 000 + 70 000 x 9 = 735 000
INSERT INTO modalite_paiement (niveau_id, annee_scolaire_id, montant_inscription_reinscription, nombre_echeance, montant_echeance)
  VALUES (@niv_essig_l1, @an_2025, 105000, 9, 70000);

INSERT INTO type_frais (code, libelle, montant_defaut, obligatoire) VALUES
  ('TENUE', 'Tenue / uniforme', 25000, 1),
  ('PHOTOCOPIE', 'Frais de photocopie', 15000, 1),
  ('SOUTENANCE', 'Frais de soutenance', 220000, 0);
SET @tf_tenue = (SELECT id FROM type_frais WHERE code='TENUE');

-- Echeancier de l'inscription @insc_1 : numero 0 = inscription, 1..9 = mensualites
INSERT INTO echeance (inscription_id, numero, montant_prevu, date_prevue) VALUES
  (@insc_1, 0, 105000, '2025-09-20'),
  (@insc_1, 1, 70000, '2025-10-05'), (@insc_1, 2, 70000, '2025-11-05'),
  (@insc_1, 3, 70000, '2025-12-05'), (@insc_1, 4, 70000, '2026-01-05'),
  (@insc_1, 5, 70000, '2026-02-05'), (@insc_1, 6, 70000, '2026-03-05'),
  (@insc_1, 7, 70000, '2026-04-05'), (@insc_1, 8, 70000, '2026-05-05'),
  (@insc_1, 9, 70000, '2026-06-05');
SET @ech_1_1 = (SELECT id FROM echeance WHERE inscription_id=@insc_1 AND numero=1);

INSERT INTO frais_inscription (inscription_id, type_frais_id, montant_du, cree_par)
  VALUES (@insc_1, @tf_tenue, 25000, @u_admin);
SET @fi_tenue_1 = LAST_INSERT_ID();

-- Fixtures tresorerie (migration 005)
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE billetage;
TRUNCATE TABLE arrete_caisse;
TRUNCATE TABLE imputation_encaissement;
TRUNCATE TABLE depense;
TRUNCATE TABLE encaissement;
TRUNCATE TABLE mouvement;
TRUNCATE TABLE virement;
TRUNCATE TABLE compte;
SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO compte (groupe_scolaire_id, code, libelle, type, solde_initial) VALUES
  (@g_groupe, 'CAISSE', 'Caisse principale', 'CAISSE', 0),
  (@g_groupe, 'BANQUE_A', 'Banque compte A', 'BANQUE', 0),
  (@g_groupe, 'AIRTEL_MONEY', 'Airtel Money', 'MOBILE_MONEY', 0);
SET @cpt_caisse = (SELECT id FROM compte WHERE code='CAISSE');
SET @cpt_banque = (SELECT id FROM compte WHERE code='BANQUE_A');

-- categorie_mouvement est une table de reference peuplee par la migration 009 :
-- on n'ecrase pas son contenu, on garantit seulement les categories utiles au test (upsert).
INSERT INTO categorie_mouvement (code, libelle, sens) VALUES
  ('SCOLARITE','Encaissement scolarite','ENTREE'),
  ('FRAIS_ANNEXE','Encaissement frais annexe','ENTREE'),
  ('DEPENSE_FONCTIONNEMENT','Depense de fonctionnement','SORTIE'),
  ('SALAIRE_ENSEIGNANT','Salaire enseignant','SORTIE'),
  ('SALAIRE_ADMIN','Salaire administration','SORTIE'),
  ('VIREMENT','Virement inter-comptes','NEUTRE') AS new
ON DUPLICATE KEY UPDATE libelle = new.libelle, sens = new.sens;
SET @cat_scol = (SELECT id FROM categorie_mouvement WHERE code='SCOLARITE');
SET @cat_dep  = (SELECT id FROM categorie_mouvement WHERE code='DEPENSE_FONCTIONNEMENT');

-- Fixtures RH & paie (migration 006)
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE avance_personnel;
TRUNCATE TABLE salaire_administration;
TRUNCATE TABLE salaire_enseignant;
TRUNCATE TABLE affectation_enseignement;
TRUNCATE TABLE personnel_administratif;
TRUNCATE TABLE enseignant;
SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO enseignant (nom, prenom, statut, taux_horaire) VALUES ('EKO MBA', 'Jean Marie', 'VACATAIRE', 8000);
SET @ens_1 = LAST_INSERT_ID();
INSERT INTO personnel_administratif (nom, prenom, poste, salaire_base) VALUES ('KASSA', 'Estelle', 'Secretaire', 100000);
SET @pers_1 = LAST_INSERT_ID();
INSERT INTO affectation_enseignement (enseignant_id, matiere_id, classe_id, annee_scolaire_id, volume_horaire_prevu, taux_horaire)
  VALUES (@ens_1, @mat_cg1, @classe_essig_l1, @an_2025, 45, 8000);
SET @aff_1 = LAST_INSERT_ID();

-- Nettoyage des tables du module 6 (evaluations & resultats).
-- Aucune insertion : garantit seulement une ardoise vierge, meme si un test
-- precedent (ex. test_007, qui execute des DDL provoquant un COMMIT implicite)
-- a laisse des lignes committees que son propre ROLLBACK ne purge pas.
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE bulletin;
TRUNCATE TABLE dette_credit;
TRUNCATE TABLE resultat_annuel;
TRUNCATE TABLE resultat_periode;
TRUNCATE TABLE resultat_matiere;
TRUNCATE TABLE note_evaluation;
TRUNCATE TABLE evaluation;
TRUNCATE TABLE deliberation;
SET FOREIGN_KEY_CHECKS = 1;

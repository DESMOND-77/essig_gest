-- Test 009 : donnees de reference presentes et idempotentes.
-- La migration 009 peuple les jeux complets ; les fixtures 10_base.sql ne font
-- qu'upserter des sous-ensembles (jamais de TRUNCATE sur ces 4 tables), donc
-- apres migrations + fixtures les comptes doivent etre exactement 5 / 4 / 10 / 7.
START TRANSACTION;

CALL assert_equals('5',  CAST((SELECT COUNT(*) FROM role) AS CHAR), 'role : 5 lignes');
CALL assert_equals('4',  CAST((SELECT COUNT(*) FROM modalite_formation) AS CHAR), 'modalite_formation : 4 lignes');
CALL assert_equals('10', CAST((SELECT COUNT(*) FROM categorie_mouvement) AS CHAR), 'categorie_mouvement : 10 lignes');
CALL assert_equals('7',  CAST((SELECT COUNT(*) FROM type_piece) AS CHAR), 'type_piece : 7 lignes');

-- Idempotence : rejouer les 4 INSERT de la migration 009 ne cree aucun doublon.
INSERT INTO role (code, libelle) VALUES
  ('COMPTABLE',  'Comptable'),
  ('DAF',        'Directeur Administratif et Financier'),
  ('DIRECTION',  'Direction'),
  ('SCOLARITE',  'Service scolarite'),
  ('LECTURE',    'Consultation seule')
AS new
ON DUPLICATE KEY UPDATE libelle = new.libelle;

INSERT INTO modalite_formation (code, libelle) VALUES
  ('FI', 'Formation Initiale'),
  ('FC', 'Formation Continue'),
  ('FL', 'Formation FL (a preciser)'),
  ('FT', 'Formation FT (a preciser)')
AS new
ON DUPLICATE KEY UPDATE libelle = new.libelle;

INSERT INTO categorie_mouvement (code, libelle, sens) VALUES
  ('SCOLARITE',              'Encaissement scolarite',        'ENTREE'),
  ('FRAIS_ANNEXE',           'Encaissement frais annexe',     'ENTREE'),
  ('SUBVENTION_BOURSE',      'Versement organisme de bourse', 'ENTREE'),
  ('PRET',                   'Pret recu',                     'ENTREE'),
  ('SALAIRE_ENSEIGNANT',     'Salaire enseignant',            'SORTIE'),
  ('SALAIRE_ADMIN',          'Salaire administration',        'SORTIE'),
  ('AVANCE_PERSONNEL',       'Avance sur salaire',            'SORTIE'),
  ('DEPENSE_FONCTIONNEMENT', 'Depense de fonctionnement',     'SORTIE'),
  ('VIREMENT',               'Virement inter-comptes',        'NEUTRE'),
  ('AUTRE',                  'Autre operation',               'NEUTRE')
AS new
ON DUPLICATE KEY UPDATE libelle = new.libelle, sens = new.sens;

INSERT INTO type_piece (code, libelle) VALUES
  ('ACTE_NAISSANCE',    'Copie de l''acte de naissance'),
  ('RELEVE_BAC',        'Attestation ou releve de notes du BAC'),
  ('RELEVE_SEMESTRES',  'Releves de notes des deux semestres precedents'),
  ('CERTIF_SCOLARITE',  'Certificat de scolarite de l''etablissement de provenance'),
  ('ATTESTATION_REUSSITE','Attestation de reussite de l''annee precedente'),
  ('PHOTOS',            'Photos d''identite couleur fond blanc'),
  ('LETTRE_MOTIVATION', 'Lettre de motivation')
AS new
ON DUPLICATE KEY UPDATE libelle = new.libelle;

CALL assert_equals('5',  CAST((SELECT COUNT(*) FROM role) AS CHAR), 'role : toujours 5 lignes apres rejeu');
CALL assert_equals('4',  CAST((SELECT COUNT(*) FROM modalite_formation) AS CHAR), 'modalite_formation : toujours 4 lignes apres rejeu');
CALL assert_equals('10', CAST((SELECT COUNT(*) FROM categorie_mouvement) AS CHAR), 'categorie_mouvement : toujours 10 lignes apres rejeu');
CALL assert_equals('7',  CAST((SELECT COUNT(*) FROM type_piece) AS CHAR), 'type_piece : toujours 7 lignes apres rejeu');

ROLLBACK;

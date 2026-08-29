-- Migration 009 : Donnees de reference figees (idempotent)
-- Spec : §5, §6
SET NAMES utf8mb4;

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

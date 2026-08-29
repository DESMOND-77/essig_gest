-- Migration 003 : Personnes & inscriptions
-- Spec : §6 module 2
SET NAMES utf8mb4;

CREATE TABLE etudiant (
  id                     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  matricule              VARCHAR(20) NOT NULL,
  numero_interne_archive VARCHAR(20) NULL,
  nom                    VARCHAR(60) NOT NULL,
  prenoms                VARCHAR(120) NOT NULL,
  sexe                   ENUM('M','F') NOT NULL,
  date_naissance         DATE NULL,
  lieu_naissance         VARCHAR(120) NULL,
  nationalite            VARCHAR(60) NULL,
  email                  VARCHAR(120) NULL,
  telephone              VARCHAR(40) NULL,
  adresse                VARCHAR(255) NULL,
  photo                  VARCHAR(255) NULL,
  situation_matrimoniale ENUM('CELIBATAIRE','MARIE','AUTRE') NULL,
  PRIMARY KEY (id),
  UNIQUE KEY unq_etudiant_matricule (matricule),
  KEY idx_etudiant_nom (nom, prenoms)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE affiliation (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  etudiant_id INT UNSIGNED NOT NULL,
  type        ENUM('PERE','MERE','TUTEUR') NOT NULL,
  nom         VARCHAR(60) NOT NULL,
  prenom      VARCHAR(120) NOT NULL,
  contact     VARCHAR(60) NOT NULL,
  profession  VARCHAR(120) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY unq_affiliation (etudiant_id, type),
  CONSTRAINT fk_affiliation_etudiant FOREIGN KEY (etudiant_id) REFERENCES etudiant (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE situation_bac (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  etudiant_id   INT UNSIGNED NOT NULL,
  a_le_bac      TINYINT(1) NOT NULL DEFAULT 0,
  annee_obtention INT NULL,
  serie         VARCHAR(20) NULL,
  mention       ENUM('TB','B','AB','P') NULL,
  etablissement VARCHAR(150) NULL,
  ville         VARCHAR(80) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY unq_situation_bac_etudiant (etudiant_id),
  CONSTRAINT fk_situation_bac_etudiant FOREIGN KEY (etudiant_id) REFERENCES etudiant (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE type_piece (
  id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code    VARCHAR(30) NOT NULL,
  libelle VARCHAR(120) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY unq_type_piece_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inscription (
  id                       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  etudiant_id              INT UNSIGNED NOT NULL,
  classe_id                INT UNSIGNED NOT NULL,
  ecole_id                 INT UNSIGNED NOT NULL,
  annee_scolaire_id        INT UNSIGNED NOT NULL,
  numero_ordre             INT NOT NULL,
  type                     ENUM('INSCRIPTION','REINSCRIPTION') NOT NULL,
  statut                   ENUM('NOUVEAU','ANCIEN') NOT NULL,
  etablissement_provenance VARCHAR(150) NULL,
  est_boursier             TINYINT(1) NOT NULL DEFAULT 0,
  cout_scolarite_negocie   DECIMAL(12,0) NULL,
  date_inscription         DATE NOT NULL,
  etat                     ENUM('ACTIVE','ABANDON','EXCLU','DIPLOME') NOT NULL DEFAULT 'ACTIVE',
  cree_par                 INT UNSIGNED NULL,
  cree_le                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_par              INT UNSIGNED NULL,
  modifie_le               DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unq_inscription_etudiant_annee (etudiant_id, annee_scolaire_id),
  UNIQUE KEY unq_inscription_numero_ordre (ecole_id, annee_scolaire_id, numero_ordre),
  KEY idx_inscription_classe (classe_id),
  CONSTRAINT fk_inscription_etudiant   FOREIGN KEY (etudiant_id)       REFERENCES etudiant (id),
  CONSTRAINT fk_inscription_classe     FOREIGN KEY (classe_id)         REFERENCES classe (id),
  CONSTRAINT fk_inscription_ecole      FOREIGN KEY (ecole_id)          REFERENCES ecole (id),
  CONSTRAINT fk_inscription_annee      FOREIGN KEY (annee_scolaire_id) REFERENCES annee_scolaire (id),
  CONSTRAINT fk_inscription_cree_par   FOREIGN KEY (cree_par)          REFERENCES utilisateur (id) ON DELETE SET NULL,
  CONSTRAINT fk_inscription_modifie_par FOREIGN KEY (modifie_par)      REFERENCES utilisateur (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE piece_dossier (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  inscription_id INT UNSIGNED NOT NULL,
  type_piece_id  INT UNSIGNED NOT NULL,
  fournie        TINYINT(1) NOT NULL DEFAULT 0,
  date_reception DATE NULL,
  PRIMARY KEY (id),
  UNIQUE KEY unq_piece_dossier (inscription_id, type_piece_id),
  CONSTRAINT fk_piece_dossier_inscription FOREIGN KEY (inscription_id) REFERENCES inscription (id) ON DELETE CASCADE,
  CONSTRAINT fk_piece_dossier_type        FOREIGN KEY (type_piece_id)  REFERENCES type_piece (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migration 001 : Référentiel académique
-- Spec : docs/superpowers/specs/2026-08-29-modele-donnees-gestion-groupe-scolaire-design.md §6 module 1
SET NAMES utf8mb4;

CREATE TABLE ecole (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nom                VARCHAR(120) NOT NULL,
  sigle              VARCHAR(20)  NULL,
  regime             ENUM('LMD','CLASSIQUE') NOT NULL,
  logo               VARCHAR(255) NULL,
  contacts           VARCHAR(120) NULL,
  email              VARCHAR(120) NULL,
  adresse            VARCHAR(255) NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE annee_scolaire (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  libelle      VARCHAR(9)  NOT NULL,
  date_debut   DATE NOT NULL,
  date_fin     DATE NOT NULL,
  est_courante TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY unq_annee_scolaire_libelle (libelle)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE modalite_formation (
  id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code    ENUM('FI','FC','FL','FT') NOT NULL,
  libelle VARCHAR(60) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY unq_modalite_formation_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE niveau (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  ecole_id          INT UNSIGNED NOT NULL,
  code              VARCHAR(10) NOT NULL,
  libelle           VARCHAR(60) NOT NULL,
  ordre             INT NOT NULL,
  credits_requis    INT NULL,
  a_soutenance      TINYINT(1) NOT NULL DEFAULT 0,
  a_examen_national TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY unq_niveau_ecole_code (ecole_id, code),
  CONSTRAINT fk_niveau_ecole FOREIGN KEY (ecole_id) REFERENCES ecole (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE filiere (
  id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  ecole_id INT UNSIGNED NOT NULL,
  nom      VARCHAR(80) NOT NULL,
  sigle    VARCHAR(15) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY unq_filiere_ecole_sigle (ecole_id, sigle),
  CONSTRAINT fk_filiere_ecole FOREIGN KEY (ecole_id) REFERENCES ecole (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE option_filiere (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  filiere_id INT UNSIGNED NOT NULL,
  nom        VARCHAR(80) NOT NULL,
  sigle      VARCHAR(15) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY unq_option_filiere_sigle (filiere_id, sigle),
  CONSTRAINT fk_option_filiere_filiere FOREIGN KEY (filiere_id) REFERENCES filiere (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE classe (
  id                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  annee_scolaire_id     INT UNSIGNED NOT NULL,
  niveau_id             INT UNSIGNED NOT NULL,
  option_filiere_id     INT UNSIGNED NOT NULL,
  modalite_formation_id INT UNSIGNED NOT NULL,
  libelle_auto          VARCHAR(120) NOT NULL,
  effectif_max          INT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY unq_classe (annee_scolaire_id, niveau_id, option_filiere_id, modalite_formation_id),
  CONSTRAINT fk_classe_annee    FOREIGN KEY (annee_scolaire_id)     REFERENCES annee_scolaire (id),
  CONSTRAINT fk_classe_niveau   FOREIGN KEY (niveau_id)             REFERENCES niveau (id),
  CONSTRAINT fk_classe_option   FOREIGN KEY (option_filiere_id)     REFERENCES option_filiere (id),
  CONSTRAINT fk_classe_modalite FOREIGN KEY (modalite_formation_id) REFERENCES modalite_formation (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE matiere (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  niveau_id         INT UNSIGNED NOT NULL,
  option_filiere_id INT UNSIGNED NOT NULL,
  semestre          ENUM('S1','S2') NOT NULL,
  nom               VARCHAR(120) NOT NULL,
  code              VARCHAR(20) NOT NULL,
  coefficient       INT NOT NULL,
  credits           INT NULL,
  volume_horaire    INT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY unq_matiere (niveau_id, option_filiere_id, semestre, code),
  CONSTRAINT fk_matiere_niveau FOREIGN KEY (niveau_id)         REFERENCES niveau (id),
  CONSTRAINT fk_matiere_option FOREIGN KEY (option_filiere_id) REFERENCES option_filiere (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE periode (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  annee_scolaire_id INT UNSIGNED NOT NULL,
  numero            INT NOT NULL,
  libelle           VARCHAR(40) NOT NULL,
  date_debut        DATE NOT NULL,
  date_fin          DATE NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY unq_periode (annee_scolaire_id, numero),
  CONSTRAINT fk_periode_annee FOREIGN KEY (annee_scolaire_id) REFERENCES annee_scolaire (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE session_examen (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  periode_id INT UNSIGNED NOT NULL,
  type       ENUM('NORMALE','RATTRAPAGE') NOT NULL,
  date_debut DATE NULL,
  date_fin   DATE NULL,
  PRIMARY KEY (id),
  UNIQUE KEY unq_session_examen (periode_id, type),
  CONSTRAINT fk_session_examen_periode FOREIGN KEY (periode_id) REFERENCES periode (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

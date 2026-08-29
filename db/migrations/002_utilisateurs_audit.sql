-- Migration 002 : Utilisateurs & audit
-- Spec : §6 transverse
SET NAMES utf8mb4;

CREATE TABLE role (
  id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code    ENUM('COMPTABLE','DAF','DIRECTION','SCOLARITE','LECTURE') NOT NULL,
  libelle VARCHAR(80) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY unq_role_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE utilisateur (
  id                        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  personnel_administratif_id INT UNSIGNED NULL,
  login                     VARCHAR(60) NOT NULL,
  email                     VARCHAR(120) NOT NULL,
  mot_de_passe_hash         VARCHAR(255) NOT NULL,
  actif                     TINYINT(1) NOT NULL DEFAULT 1,
  derniere_connexion        DATETIME NULL,
  cree_le                   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unq_utilisateur_login (login),
  KEY idx_utilisateur_personnel (personnel_administratif_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE utilisateur_role (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  utilisateur_id INT UNSIGNED NOT NULL,
  role_id        INT UNSIGNED NOT NULL,
  ecole_id       INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY unq_utilisateur_role (utilisateur_id, role_id, ecole_id),
  KEY idx_utilisateur_role_role (role_id),
  KEY idx_utilisateur_role_ecole (ecole_id),
  CONSTRAINT fk_utilisateur_role_utilisateur FOREIGN KEY (utilisateur_id) REFERENCES utilisateur (id) ON DELETE CASCADE,
  CONSTRAINT fk_utilisateur_role_role        FOREIGN KEY (role_id)        REFERENCES role (id),
  CONSTRAINT fk_utilisateur_role_ecole       FOREIGN KEY (ecole_id)       REFERENCES ecole (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE journal_audit (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  utilisateur_id INT UNSIGNED NOT NULL,
  action         ENUM('CREATION','MODIFICATION','SUPPRESSION') NOT NULL,
  table_cible    VARCHAR(60) NOT NULL,
  ligne_id       BIGINT UNSIGNED NOT NULL,
  valeurs_avant  JSON NULL,
  valeurs_apres  JSON NULL,
  date           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip             VARCHAR(45) NULL,
  PRIMARY KEY (id),
  KEY idx_journal_audit_cible (table_cible, ligne_id),
  KEY idx_journal_audit_utilisateur (utilisateur_id, date),
  CONSTRAINT fk_journal_audit_utilisateur FOREIGN KEY (utilisateur_id) REFERENCES utilisateur (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Note : fk_utilisateur_personnel (utilisateur.personnel_administratif_id -> personnel_administratif.id)
-- est ajoutee par la migration 006.

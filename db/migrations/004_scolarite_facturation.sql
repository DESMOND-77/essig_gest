-- Migration 004 : Scolarite & facturation
-- Spec : §6 module 3
SET NAMES utf8mb4;

CREATE TABLE modalite_paiement (
  id                                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  niveau_id                         INT UNSIGNED NOT NULL,
  annee_scolaire_id                 INT UNSIGNED NOT NULL,
  montant_inscription_reinscription DECIMAL(12,0) NOT NULL,
  nombre_echeance                   INT NOT NULL,
  montant_echeance                  DECIMAL(12,0) NOT NULL,
  montant_total                     DECIMAL(12,0)
    GENERATED ALWAYS AS (montant_inscription_reinscription + nombre_echeance * montant_echeance) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY unq_modalite_paiement (niveau_id, annee_scolaire_id),
  CONSTRAINT fk_modalite_paiement_niveau FOREIGN KEY (niveau_id)         REFERENCES niveau (id),
  CONSTRAINT fk_modalite_paiement_annee  FOREIGN KEY (annee_scolaire_id) REFERENCES annee_scolaire (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE type_frais (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code              VARCHAR(30) NOT NULL,
  libelle           VARCHAR(120) NOT NULL,
  ecole_id          INT UNSIGNED NULL,
  niveau_id         INT UNSIGNED NULL,
  annee_scolaire_id INT UNSIGNED NULL,
  montant_defaut    DECIMAL(12,0) NOT NULL,
  obligatoire       TINYINT(1) NOT NULL DEFAULT 0,
  actif             TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY unq_type_frais_code (code),
  KEY idx_type_frais_ecole (ecole_id),
  KEY idx_type_frais_niveau (niveau_id),
  CONSTRAINT fk_type_frais_ecole  FOREIGN KEY (ecole_id)          REFERENCES ecole (id),
  CONSTRAINT fk_type_frais_niveau FOREIGN KEY (niveau_id)         REFERENCES niveau (id),
  CONSTRAINT fk_type_frais_annee  FOREIGN KEY (annee_scolaire_id) REFERENCES annee_scolaire (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE frais_inscription (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  inscription_id INT UNSIGNED NOT NULL,
  type_frais_id  INT UNSIGNED NOT NULL,
  montant_du     DECIMAL(12,0) NOT NULL,
  exonere        TINYINT(1) NOT NULL DEFAULT 0,
  commentaire    VARCHAR(255) NULL,
  cree_par       INT UNSIGNED NULL,
  cree_le        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_par    INT UNSIGNED NULL,
  modifie_le     DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unq_frais_inscription (inscription_id, type_frais_id),
  CONSTRAINT fk_frais_inscription_inscription FOREIGN KEY (inscription_id) REFERENCES inscription (id),
  CONSTRAINT fk_frais_inscription_type        FOREIGN KEY (type_frais_id)  REFERENCES type_frais (id),
  CONSTRAINT fk_frais_inscription_cree_par    FOREIGN KEY (cree_par)       REFERENCES utilisateur (id) ON DELETE SET NULL,
  CONSTRAINT fk_frais_inscription_modifie_par FOREIGN KEY (modifie_par)    REFERENCES utilisateur (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE echeance (
  id                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  inscription_id        INT UNSIGNED NOT NULL,
  numero                INT NOT NULL,
  montant_prevu         DECIMAL(12,0) NOT NULL,
  date_prevue           DATE NOT NULL,
  pris_en_charge_bourse TINYINT(1) NOT NULL DEFAULT 0,
  cree_par              INT UNSIGNED NULL,
  cree_le               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_par           INT UNSIGNED NULL,
  modifie_le            DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unq_echeance (inscription_id, numero),
  CONSTRAINT fk_echeance_inscription FOREIGN KEY (inscription_id) REFERENCES inscription (id),
  CONSTRAINT fk_echeance_cree_par    FOREIGN KEY (cree_par)       REFERENCES utilisateur (id) ON DELETE SET NULL,
  CONSTRAINT fk_echeance_modifie_par FOREIGN KEY (modifie_par)    REFERENCES utilisateur (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bourse (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  inscription_id INT UNSIGNED NOT NULL,
  organisme      VARCHAR(150) NOT NULL,
  perimetre      ENUM('SCOLARITE_HORS_INSCRIPTION') NOT NULL DEFAULT 'SCOLARITE_HORS_INSCRIPTION',
  montant_couvert DECIMAL(12,0) NOT NULL,
  cree_par       INT UNSIGNED NULL,
  cree_le        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_par    INT UNSIGNED NULL,
  modifie_le     DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_bourse_inscription (inscription_id),
  CONSTRAINT fk_bourse_inscription FOREIGN KEY (inscription_id) REFERENCES inscription (id),
  CONSTRAINT fk_bourse_cree_par    FOREIGN KEY (cree_par)       REFERENCES utilisateur (id) ON DELETE SET NULL,
  CONSTRAINT fk_bourse_modifie_par FOREIGN KEY (modifie_par)    REFERENCES utilisateur (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migration 005 : Encaissements & tresorerie
-- Spec : §6 module 4
SET NAMES utf8mb4;

CREATE TABLE compte (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code               VARCHAR(30) NOT NULL,
  libelle            VARCHAR(120) NOT NULL,
  type               ENUM('CAISSE','BANQUE','MOBILE_MONEY','VIRTUEL') NOT NULL,
  numero_bancaire    VARCHAR(40) NULL,
  banque             VARCHAR(120) NULL,
  solde_initial      DECIMAL(12,0) NOT NULL DEFAULT 0,
  actif              TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY unq_compte_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE categorie_mouvement (
  id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code    VARCHAR(40) NOT NULL,
  libelle VARCHAR(120) NOT NULL,
  sens    ENUM('ENTREE','SORTIE','NEUTRE') NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY unq_categorie_mouvement_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE virement (
  id                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  compte_source_id      INT UNSIGNED NOT NULL,
  compte_destination_id INT UNSIGNED NOT NULL,
  montant               DECIMAL(12,0) NOT NULL,
  date                  DATE NOT NULL,
  motif                 VARCHAR(255) NOT NULL,
  cree_par              INT UNSIGNED NULL,
  cree_le               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_par           INT UNSIGNED NULL,
  modifie_le            DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_virement_source      FOREIGN KEY (compte_source_id)      REFERENCES compte (id),
  CONSTRAINT fk_virement_destination FOREIGN KEY (compte_destination_id) REFERENCES compte (id),
  CONSTRAINT fk_virement_cree_par    FOREIGN KEY (cree_par)              REFERENCES utilisateur (id) ON DELETE SET NULL,
  CONSTRAINT fk_virement_modifie_par FOREIGN KEY (modifie_par)           REFERENCES utilisateur (id) ON DELETE SET NULL,
  CONSTRAINT chk_virement_comptes CHECK (compte_source_id <> compte_destination_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mouvement (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  compte_id             INT UNSIGNED NOT NULL,
  date_operation        DATE NOT NULL,
  sens                  ENUM('DEBIT','CREDIT') NOT NULL,
  montant               DECIMAL(12,0) NOT NULL,
  categorie_mouvement_id INT UNSIGNED NOT NULL,
  libelle               VARCHAR(255) NOT NULL,
  piece_reference       VARCHAR(40) NULL,
  ecole_id              INT UNSIGNED NULL,
  annee_scolaire_id     INT UNSIGNED NOT NULL,
  virement_id           INT UNSIGNED NULL,
  valide                TINYINT(1) NOT NULL DEFAULT 1,
  cree_par              INT UNSIGNED NULL,
  cree_le               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_par           INT UNSIGNED NULL,
  modifie_le            DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mouvement_compte_date (compte_id, date_operation),
  KEY idx_mouvement_analytique (annee_scolaire_id, ecole_id, date_operation),
  KEY idx_mouvement_categorie (categorie_mouvement_id, date_operation),
  KEY idx_mouvement_virement (virement_id),
  CONSTRAINT chk_mouvement_montant CHECK (montant > 0),
  CONSTRAINT fk_mouvement_compte     FOREIGN KEY (compte_id)              REFERENCES compte (id),
  CONSTRAINT fk_mouvement_categorie  FOREIGN KEY (categorie_mouvement_id) REFERENCES categorie_mouvement (id),
  CONSTRAINT fk_mouvement_ecole      FOREIGN KEY (ecole_id)               REFERENCES ecole (id),
  CONSTRAINT fk_mouvement_annee      FOREIGN KEY (annee_scolaire_id)      REFERENCES annee_scolaire (id),
  CONSTRAINT fk_mouvement_virement   FOREIGN KEY (virement_id)            REFERENCES virement (id),
  CONSTRAINT fk_mouvement_cree_par   FOREIGN KEY (cree_par)               REFERENCES utilisateur (id) ON DELETE SET NULL,
  CONSTRAINT fk_mouvement_modifie_par FOREIGN KEY (modifie_par)           REFERENCES utilisateur (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE encaissement (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  inscription_id INT UNSIGNED NOT NULL,
  date           DATE NOT NULL,
  montant_total  DECIMAL(12,0) NOT NULL,
  mode           ENUM('ESPECES','VIREMENT','MOBILE_MONEY','CHEQUE') NOT NULL,
  compte_id      INT UNSIGNED NOT NULL,
  mouvement_id   BIGINT UNSIGNED NOT NULL,
  recu_numero    VARCHAR(40) NOT NULL,
  cree_par       INT UNSIGNED NULL,
  cree_le        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_par    INT UNSIGNED NULL,
  modifie_le     DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unq_encaissement_recu (recu_numero),
  UNIQUE KEY unq_encaissement_mouvement (mouvement_id),
  KEY idx_encaissement_inscription (inscription_id),
  CONSTRAINT fk_encaissement_inscription FOREIGN KEY (inscription_id) REFERENCES inscription (id),
  CONSTRAINT fk_encaissement_compte      FOREIGN KEY (compte_id)      REFERENCES compte (id),
  CONSTRAINT fk_encaissement_mouvement   FOREIGN KEY (mouvement_id)   REFERENCES mouvement (id),
  CONSTRAINT fk_encaissement_cree_par    FOREIGN KEY (cree_par)       REFERENCES utilisateur (id) ON DELETE SET NULL,
  CONSTRAINT fk_encaissement_modifie_par FOREIGN KEY (modifie_par)    REFERENCES utilisateur (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE imputation_encaissement (
  id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  encaissement_id      INT UNSIGNED NOT NULL,
  cible                ENUM('ECHEANCE','FRAIS') NOT NULL,
  echeance_id          INT UNSIGNED NULL,
  frais_inscription_id INT UNSIGNED NULL,
  montant              DECIMAL(12,0) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_imputation_encaissement (encaissement_id),
  KEY idx_imputation_echeance (echeance_id),
  KEY idx_imputation_frais (frais_inscription_id),
  CONSTRAINT chk_imputation_cible CHECK (
    (cible = 'ECHEANCE' AND echeance_id IS NOT NULL AND frais_inscription_id IS NULL) OR
    (cible = 'FRAIS'    AND frais_inscription_id IS NOT NULL AND echeance_id IS NULL)
  ),
  CONSTRAINT chk_imputation_montant CHECK (montant > 0),
  CONSTRAINT fk_imputation_encaissement FOREIGN KEY (encaissement_id)      REFERENCES encaissement (id) ON DELETE CASCADE,
  CONSTRAINT fk_imputation_echeance     FOREIGN KEY (echeance_id)          REFERENCES echeance (id),
  CONSTRAINT fk_imputation_frais        FOREIGN KEY (frais_inscription_id) REFERENCES frais_inscription (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE depense (
  id                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  date                  DATE NOT NULL,
  categorie_mouvement_id INT UNSIGNED NOT NULL,
  beneficiaire          VARCHAR(150) NOT NULL,
  designation           VARCHAR(255) NOT NULL,
  montant               DECIMAL(12,0) NOT NULL,
  compte_id             INT UNSIGNED NOT NULL,
  mouvement_id          BIGINT UNSIGNED NOT NULL,
  ecole_id              INT UNSIGNED NULL,
  annee_scolaire_id     INT UNSIGNED NOT NULL,
  piece_justificative   VARCHAR(255) NULL,
  engage_par            INT UNSIGNED NULL,
  valide_par            INT UNSIGNED NULL,
  cree_par              INT UNSIGNED NULL,
  cree_le               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_par           INT UNSIGNED NULL,
  modifie_le            DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unq_depense_mouvement (mouvement_id),
  KEY idx_depense_analytique (annee_scolaire_id, ecole_id, date),
  CONSTRAINT fk_depense_categorie   FOREIGN KEY (categorie_mouvement_id) REFERENCES categorie_mouvement (id),
  CONSTRAINT fk_depense_compte      FOREIGN KEY (compte_id)              REFERENCES compte (id),
  CONSTRAINT fk_depense_mouvement   FOREIGN KEY (mouvement_id)           REFERENCES mouvement (id),
  CONSTRAINT fk_depense_ecole       FOREIGN KEY (ecole_id)               REFERENCES ecole (id),
  CONSTRAINT fk_depense_annee       FOREIGN KEY (annee_scolaire_id)      REFERENCES annee_scolaire (id),
  CONSTRAINT fk_depense_engage_par  FOREIGN KEY (engage_par)             REFERENCES utilisateur (id) ON DELETE SET NULL,
  CONSTRAINT fk_depense_valide_par  FOREIGN KEY (valide_par)             REFERENCES utilisateur (id) ON DELETE SET NULL,
  CONSTRAINT fk_depense_cree_par    FOREIGN KEY (cree_par)               REFERENCES utilisateur (id) ON DELETE SET NULL,
  CONSTRAINT fk_depense_modifie_par FOREIGN KEY (modifie_par)            REFERENCES utilisateur (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE arrete_caisse (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  compte_id       INT UNSIGNED NOT NULL,
  date            DATE NOT NULL,
  solde_theorique DECIMAL(12,0) NOT NULL,
  solde_physique  DECIMAL(12,0) NOT NULL,
  ecart           DECIMAL(12,0) GENERATED ALWAYS AS (solde_physique - solde_theorique) STORED,
  fait_par        INT UNSIGNED NULL,
  cree_par        INT UNSIGNED NULL,
  cree_le         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_par     INT UNSIGNED NULL,
  modifie_le      DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_arrete_caisse_compte_date (compte_id, date),
  CONSTRAINT fk_arrete_caisse_compte     FOREIGN KEY (compte_id)   REFERENCES compte (id),
  CONSTRAINT fk_arrete_caisse_fait_par   FOREIGN KEY (fait_par)    REFERENCES utilisateur (id) ON DELETE SET NULL,
  CONSTRAINT fk_arrete_caisse_cree_par   FOREIGN KEY (cree_par)    REFERENCES utilisateur (id) ON DELETE SET NULL,
  CONSTRAINT fk_arrete_caisse_modifie_par FOREIGN KEY (modifie_par) REFERENCES utilisateur (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE billetage (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  arrete_caisse_id INT UNSIGNED NOT NULL,
  denomination     INT NOT NULL,
  quantite         INT NOT NULL,
  montant          DECIMAL(12,0) GENERATED ALWAYS AS (denomination * quantite) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY unq_billetage (arrete_caisse_id, denomination),
  CONSTRAINT chk_billetage_quantite CHECK (quantite >= 0),
  CONSTRAINT fk_billetage_arrete FOREIGN KEY (arrete_caisse_id) REFERENCES arrete_caisse (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

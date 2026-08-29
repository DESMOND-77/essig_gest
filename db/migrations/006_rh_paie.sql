-- Migration 006 : RH & paie
-- Spec : §6 module 5
SET NAMES utf8mb4;

CREATE TABLE enseignant (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nom         VARCHAR(60) NOT NULL,
  prenom      VARCHAR(120) NOT NULL,
  telephone   VARCHAR(60) NULL,
  email       VARCHAR(120) NULL,
  specialite  VARCHAR(120) NULL,
  statut      ENUM('VACATAIRE','PERMANENT') NOT NULL DEFAULT 'VACATAIRE',
  taux_horaire DECIMAL(12,0) NULL,
  actif       TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY unq_enseignant_email (email),
  KEY idx_enseignant_nom (nom, prenom)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE personnel_administratif (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nom           VARCHAR(60) NOT NULL,
  prenom        VARCHAR(120) NOT NULL,
  poste         VARCHAR(120) NOT NULL,
  ecole_id      INT UNSIGNED NULL,
  telephone     VARCHAR(60) NULL,
  email         VARCHAR(120) NULL,
  salaire_base  DECIMAL(12,0) NOT NULL,
  date_embauche DATE NULL,
  actif         TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY idx_personnel_ecole (ecole_id),
  CONSTRAINT fk_personnel_ecole FOREIGN KEY (ecole_id) REFERENCES ecole (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE utilisateur
  ADD CONSTRAINT fk_utilisateur_personnel
  FOREIGN KEY (personnel_administratif_id) REFERENCES personnel_administratif (id) ON DELETE SET NULL;

CREATE TABLE affectation_enseignement (
  id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  enseignant_id        INT UNSIGNED NOT NULL,
  matiere_id           INT UNSIGNED NOT NULL,
  classe_id            INT UNSIGNED NOT NULL,
  annee_scolaire_id    INT UNSIGNED NOT NULL,
  volume_horaire_prevu INT NOT NULL,
  taux_horaire         DECIMAL(12,0) NOT NULL,
  montant_prevu        DECIMAL(12,0) GENERATED ALWAYS AS (volume_horaire_prevu * taux_horaire) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY unq_affectation (matiere_id, classe_id),
  KEY idx_affectation_enseignant (enseignant_id, annee_scolaire_id),
  CONSTRAINT fk_affectation_enseignant FOREIGN KEY (enseignant_id)     REFERENCES enseignant (id),
  CONSTRAINT fk_affectation_matiere    FOREIGN KEY (matiere_id)        REFERENCES matiere (id),
  CONSTRAINT fk_affectation_classe     FOREIGN KEY (classe_id)         REFERENCES classe (id),
  CONSTRAINT fk_affectation_annee      FOREIGN KEY (annee_scolaire_id) REFERENCES annee_scolaire (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE salaire_enseignant (
  id                          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  enseignant_id               INT UNSIGNED NOT NULL,
  affectation_enseignement_id INT UNSIGNED NULL,
  annee_scolaire_id           INT UNSIGNED NOT NULL,
  mois                        ENUM('SEPT','OCT','NOV','DEC','JAN','FEV','MAR','AVR','MAI','JUIN','JUIL','AOUT') NOT NULL,
  date_paiement               DATE NOT NULL,
  montant                     DECIMAL(12,0) NOT NULL,
  compte_id                   INT UNSIGNED NOT NULL,
  mouvement_id                BIGINT UNSIGNED NOT NULL,
  cree_par                    INT UNSIGNED NULL,
  cree_le                     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_par                 INT UNSIGNED NULL,
  modifie_le                  DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unq_salaire_enseignant_mouvement (mouvement_id),
  KEY idx_salaire_enseignant (enseignant_id, annee_scolaire_id, mois),
  CONSTRAINT fk_salaire_enseignant_enseignant  FOREIGN KEY (enseignant_id)               REFERENCES enseignant (id),
  CONSTRAINT fk_salaire_enseignant_affectation FOREIGN KEY (affectation_enseignement_id) REFERENCES affectation_enseignement (id) ON DELETE SET NULL,
  CONSTRAINT fk_salaire_enseignant_annee       FOREIGN KEY (annee_scolaire_id)           REFERENCES annee_scolaire (id),
  CONSTRAINT fk_salaire_enseignant_compte      FOREIGN KEY (compte_id)                   REFERENCES compte (id),
  CONSTRAINT fk_salaire_enseignant_mouvement   FOREIGN KEY (mouvement_id)                REFERENCES mouvement (id),
  CONSTRAINT fk_salaire_enseignant_cree_par    FOREIGN KEY (cree_par)                    REFERENCES utilisateur (id) ON DELETE SET NULL,
  CONSTRAINT fk_salaire_enseignant_modifie_par FOREIGN KEY (modifie_par)                 REFERENCES utilisateur (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE salaire_administration (
  id                        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  personnel_administratif_id INT UNSIGNED NOT NULL,
  annee_scolaire_id         INT UNSIGNED NOT NULL,
  mois                      ENUM('SEPT','OCT','NOV','DEC','JAN','FEV','MAR','AVR','MAI','JUIN','JUIL','AOUT') NOT NULL,
  date_paiement             DATE NOT NULL,
  montant_du                DECIMAL(12,0) NOT NULL,
  montant_paye              DECIMAL(12,0) NOT NULL,
  compte_id                 INT UNSIGNED NOT NULL,
  mouvement_id              BIGINT UNSIGNED NOT NULL,
  cree_par                  INT UNSIGNED NULL,
  cree_le                   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_par               INT UNSIGNED NULL,
  modifie_le                DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unq_salaire_admin (personnel_administratif_id, annee_scolaire_id, mois),
  UNIQUE KEY unq_salaire_admin_mouvement (mouvement_id),
  CONSTRAINT fk_salaire_admin_personnel  FOREIGN KEY (personnel_administratif_id) REFERENCES personnel_administratif (id),
  CONSTRAINT fk_salaire_admin_annee      FOREIGN KEY (annee_scolaire_id)          REFERENCES annee_scolaire (id),
  CONSTRAINT fk_salaire_admin_compte     FOREIGN KEY (compte_id)                  REFERENCES compte (id),
  CONSTRAINT fk_salaire_admin_mouvement  FOREIGN KEY (mouvement_id)               REFERENCES mouvement (id),
  CONSTRAINT fk_salaire_admin_cree_par   FOREIGN KEY (cree_par)                   REFERENCES utilisateur (id) ON DELETE SET NULL,
  CONSTRAINT fk_salaire_admin_modifie_par FOREIGN KEY (modifie_par)               REFERENCES utilisateur (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE avance_personnel (
  id                        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  beneficiaire              ENUM('ENSEIGNANT','ADMIN') NOT NULL,
  enseignant_id             INT UNSIGNED NULL,
  personnel_administratif_id INT UNSIGNED NULL,
  date                      DATE NOT NULL,
  montant                   DECIMAL(12,0) NOT NULL,
  motif                     VARCHAR(255) NULL,
  compte_id                 INT UNSIGNED NOT NULL,
  mouvement_id              BIGINT UNSIGNED NOT NULL,
  regularise_salaire_admin_id INT UNSIGNED NULL,
  regularisee               TINYINT(1) NOT NULL DEFAULT 0,
  cree_par                  INT UNSIGNED NULL,
  cree_le                   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_par               INT UNSIGNED NULL,
  modifie_le                DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unq_avance_personnel_mouvement (mouvement_id),
  CONSTRAINT chk_avance_beneficiaire CHECK (
    (beneficiaire = 'ENSEIGNANT' AND enseignant_id IS NOT NULL AND personnel_administratif_id IS NULL) OR
    (beneficiaire = 'ADMIN'      AND personnel_administratif_id IS NOT NULL AND enseignant_id IS NULL)
  ),
  CONSTRAINT fk_avance_enseignant FOREIGN KEY (enseignant_id)              REFERENCES enseignant (id),
  CONSTRAINT fk_avance_personnel  FOREIGN KEY (personnel_administratif_id) REFERENCES personnel_administratif (id),
  CONSTRAINT fk_avance_compte     FOREIGN KEY (compte_id)                  REFERENCES compte (id),
  CONSTRAINT fk_avance_mouvement  FOREIGN KEY (mouvement_id)               REFERENCES mouvement (id),
  CONSTRAINT fk_avance_regul      FOREIGN KEY (regularise_salaire_admin_id) REFERENCES salaire_administration (id) ON DELETE SET NULL,
  CONSTRAINT fk_avance_cree_par   FOREIGN KEY (cree_par)                   REFERENCES utilisateur (id) ON DELETE SET NULL,
  CONSTRAINT fk_avance_modifie_par FOREIGN KEY (modifie_par)               REFERENCES utilisateur (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

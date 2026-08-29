-- Migration 007 : Evaluations & resultats (LMD + classique)
-- Spec : §6 module 6
SET NAMES utf8mb4;

CREATE TABLE deliberation (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  classe_id         INT UNSIGNED NOT NULL,
  session_examen_id INT UNSIGNED NOT NULL,
  periode_id        INT UNSIGNED NULL,
  date              DATE NOT NULL,
  president_jury    VARCHAR(150) NOT NULL,
  statut            ENUM('BROUILLON','VALIDEE') NOT NULL DEFAULT 'BROUILLON',
  validee_par       INT UNSIGNED NULL,
  cree_par          INT UNSIGNED NULL,
  cree_le           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_par       INT UNSIGNED NULL,
  modifie_le        DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_deliberation_classe (classe_id, session_examen_id),
  CONSTRAINT fk_deliberation_classe   FOREIGN KEY (classe_id)         REFERENCES classe (id),
  CONSTRAINT fk_deliberation_session  FOREIGN KEY (session_examen_id) REFERENCES session_examen (id),
  CONSTRAINT fk_deliberation_periode  FOREIGN KEY (periode_id)        REFERENCES periode (id),
  CONSTRAINT fk_deliberation_validee_par FOREIGN KEY (validee_par)    REFERENCES utilisateur (id) ON DELETE SET NULL,
  CONSTRAINT fk_deliberation_cree_par    FOREIGN KEY (cree_par)       REFERENCES utilisateur (id) ON DELETE SET NULL,
  CONSTRAINT fk_deliberation_modifie_par FOREIGN KEY (modifie_par)    REFERENCES utilisateur (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE evaluation (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  matiere_id        INT UNSIGNED NOT NULL,
  classe_id         INT UNSIGNED NOT NULL,
  session_examen_id INT UNSIGNED NOT NULL,
  type              ENUM('CC','EXAMEN','TP','PROJET') NOT NULL,
  ponderation       DECIMAL(5,2) NOT NULL,
  bareme            INT NOT NULL DEFAULT 20,
  date              DATE NULL,
  cree_par          INT UNSIGNED NULL,
  cree_le           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_par       INT UNSIGNED NULL,
  modifie_le        DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_evaluation_matiere (matiere_id, classe_id, session_examen_id),
  CONSTRAINT chk_evaluation_ponderation CHECK (ponderation > 0 AND ponderation <= 100),
  CONSTRAINT fk_evaluation_matiere FOREIGN KEY (matiere_id)        REFERENCES matiere (id),
  CONSTRAINT fk_evaluation_classe  FOREIGN KEY (classe_id)         REFERENCES classe (id),
  CONSTRAINT fk_evaluation_session FOREIGN KEY (session_examen_id) REFERENCES session_examen (id),
  CONSTRAINT fk_evaluation_cree_par    FOREIGN KEY (cree_par)      REFERENCES utilisateur (id) ON DELETE SET NULL,
  CONSTRAINT fk_evaluation_modifie_par FOREIGN KEY (modifie_par)   REFERENCES utilisateur (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE note_evaluation (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  evaluation_id INT UNSIGNED NOT NULL,
  inscription_id INT UNSIGNED NOT NULL,
  valeur        DECIMAL(4,2) NULL,
  absent        TINYINT(1) NOT NULL DEFAULT 0,
  cree_par      INT UNSIGNED NULL,
  cree_le       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_par   INT UNSIGNED NULL,
  modifie_le    DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unq_note_evaluation (evaluation_id, inscription_id),
  KEY idx_note_evaluation_inscription (inscription_id),
  CONSTRAINT chk_note_evaluation_valeur CHECK (valeur IS NULL OR (valeur >= 0 AND valeur <= 20)),
  CONSTRAINT fk_note_evaluation_evaluation  FOREIGN KEY (evaluation_id)  REFERENCES evaluation (id) ON DELETE CASCADE,
  CONSTRAINT fk_note_evaluation_inscription FOREIGN KEY (inscription_id) REFERENCES inscription (id),
  CONSTRAINT fk_note_evaluation_cree_par    FOREIGN KEY (cree_par)       REFERENCES utilisateur (id) ON DELETE SET NULL,
  CONSTRAINT fk_note_evaluation_modifie_par FOREIGN KEY (modifie_par)    REFERENCES utilisateur (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE resultat_matiere (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  inscription_id INT UNSIGNED NOT NULL,
  matiere_id     INT UNSIGNED NOT NULL,
  periode_id     INT UNSIGNED NOT NULL,
  note_normale   DECIMAL(4,2) NULL,
  note_rattrapage DECIMAL(4,2) NULL,
  note_retenue   DECIMAL(4,2)
    GENERATED ALWAYS AS (
      GREATEST(COALESCE(note_normale, 0), COALESCE(LEAST(note_rattrapage, 10), 0))
    ) STORED,
  credits        INT NULL,
  validee        TINYINT(1)
    GENERATED ALWAYS AS (
      CASE WHEN GREATEST(COALESCE(note_normale, 0), COALESCE(LEAST(note_rattrapage, 10), 0)) >= 10 THEN 1 ELSE 0 END
    ) STORED,
  credits_acquis INT
    GENERATED ALWAYS AS (
      CASE
        WHEN credits IS NULL THEN NULL
        WHEN GREATEST(COALESCE(note_normale, 0), COALESCE(LEAST(note_rattrapage, 10), 0)) >= 10 THEN credits
        ELSE 0
      END
    ) STORED,
  deliberation_id INT UNSIGNED NULL,
  cree_par       INT UNSIGNED NULL,
  cree_le        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_par    INT UNSIGNED NULL,
  modifie_le     DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unq_resultat_matiere (inscription_id, matiere_id, periode_id),
  CONSTRAINT fk_resultat_matiere_inscription  FOREIGN KEY (inscription_id)  REFERENCES inscription (id),
  CONSTRAINT fk_resultat_matiere_matiere      FOREIGN KEY (matiere_id)      REFERENCES matiere (id),
  CONSTRAINT fk_resultat_matiere_periode      FOREIGN KEY (periode_id)      REFERENCES periode (id),
  CONSTRAINT fk_resultat_matiere_deliberation FOREIGN KEY (deliberation_id) REFERENCES deliberation (id) ON DELETE SET NULL,
  CONSTRAINT fk_resultat_matiere_cree_par     FOREIGN KEY (cree_par)        REFERENCES utilisateur (id) ON DELETE SET NULL,
  CONSTRAINT fk_resultat_matiere_modifie_par  FOREIGN KEY (modifie_par)     REFERENCES utilisateur (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE resultat_periode (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  inscription_id INT UNSIGNED NOT NULL,
  periode_id     INT UNSIGNED NOT NULL,
  moyenne_ponderee DECIMAL(4,2) NOT NULL,
  credits_acquis INT NULL,
  rang           INT NULL,
  cree_par       INT UNSIGNED NULL,
  cree_le        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_par    INT UNSIGNED NULL,
  modifie_le     DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unq_resultat_periode (inscription_id, periode_id),
  CONSTRAINT fk_resultat_periode_inscription FOREIGN KEY (inscription_id) REFERENCES inscription (id),
  CONSTRAINT fk_resultat_periode_periode     FOREIGN KEY (periode_id)     REFERENCES periode (id),
  CONSTRAINT fk_resultat_periode_cree_par    FOREIGN KEY (cree_par)       REFERENCES utilisateur (id) ON DELETE SET NULL,
  CONSTRAINT fk_resultat_periode_modifie_par FOREIGN KEY (modifie_par)    REFERENCES utilisateur (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE resultat_annuel (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  inscription_id  INT UNSIGNED NOT NULL,
  annee_scolaire_id INT UNSIGNED NOT NULL,
  regime          ENUM('LMD','CLASSIQUE') NOT NULL,
  moyenne_annuelle DECIMAL(4,2) NOT NULL,
  credits_acquis  INT NULL,
  credits_requis  INT NULL,
  dette_credits   INT NULL,
  decision        ENUM('ADMIS','ADMIS_CONDITIONNEL','REDOUBLE','EXCLU','AJOURNE') NOT NULL,
  mention         ENUM('PASSABLE','AB','B','TB') NULL,
  deliberee_le    DATETIME NULL,
  deliberee_par   INT UNSIGNED NULL,
  cree_par        INT UNSIGNED NULL,
  cree_le         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_par     INT UNSIGNED NULL,
  modifie_le      DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unq_resultat_annuel (inscription_id),
  CONSTRAINT fk_resultat_annuel_inscription   FOREIGN KEY (inscription_id)   REFERENCES inscription (id),
  CONSTRAINT fk_resultat_annuel_annee         FOREIGN KEY (annee_scolaire_id) REFERENCES annee_scolaire (id),
  CONSTRAINT fk_resultat_annuel_deliberee_par FOREIGN KEY (deliberee_par)    REFERENCES utilisateur (id) ON DELETE SET NULL,
  CONSTRAINT fk_resultat_annuel_cree_par      FOREIGN KEY (cree_par)         REFERENCES utilisateur (id) ON DELETE SET NULL,
  CONSTRAINT fk_resultat_annuel_modifie_par   FOREIGN KEY (modifie_par)      REFERENCES utilisateur (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE dette_credit (
  id                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  inscription_origine_id INT UNSIGNED NOT NULL,
  matiere_id            INT UNSIGNED NOT NULL,
  credits               INT NOT NULL,
  annee_origine_id      INT UNSIGNED NOT NULL,
  soldee                TINYINT(1) NOT NULL DEFAULT 0,
  inscription_solde_id  INT UNSIGNED NULL,
  cree_par              INT UNSIGNED NULL,
  cree_le               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_par           INT UNSIGNED NULL,
  modifie_le            DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unq_dette_credit (inscription_origine_id, matiere_id),
  CONSTRAINT fk_dette_credit_origine FOREIGN KEY (inscription_origine_id) REFERENCES inscription (id),
  CONSTRAINT fk_dette_credit_matiere FOREIGN KEY (matiere_id)            REFERENCES matiere (id),
  CONSTRAINT fk_dette_credit_annee   FOREIGN KEY (annee_origine_id)      REFERENCES annee_scolaire (id),
  CONSTRAINT fk_dette_credit_solde   FOREIGN KEY (inscription_solde_id)  REFERENCES inscription (id) ON DELETE SET NULL,
  CONSTRAINT fk_dette_credit_cree_par    FOREIGN KEY (cree_par)          REFERENCES utilisateur (id) ON DELETE SET NULL,
  CONSTRAINT fk_dette_credit_modifie_par FOREIGN KEY (modifie_par)       REFERENCES utilisateur (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bulletin (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  inscription_id INT UNSIGNED NOT NULL,
  periode_id     INT UNSIGNED NULL,
  genere_le      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  genere_par     INT UNSIGNED NULL,
  url_pdf        VARCHAR(255) NULL,
  PRIMARY KEY (id),
  KEY idx_bulletin_inscription (inscription_id, periode_id),
  CONSTRAINT fk_bulletin_inscription FOREIGN KEY (inscription_id) REFERENCES inscription (id),
  CONSTRAINT fk_bulletin_periode     FOREIGN KEY (periode_id)     REFERENCES periode (id),
  CONSTRAINT fk_bulletin_genere_par  FOREIGN KEY (genere_par)     REFERENCES utilisateur (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

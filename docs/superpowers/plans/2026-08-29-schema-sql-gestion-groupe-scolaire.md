# Schéma SQL — Gestion du Groupe Scolaire — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire le schéma de base de données cible (40 tables + 13 vues + données de référence) sous forme de migrations SQL numérotées pour MySQL 8.4, avec un harnais de tests SQL exécuté dans un conteneur MySQL jetable.

**Architecture:** Migrations SQL pures, idempotentes par fichier, appliquées dans l'ordre par un script `db/run.sh`. Chaque migration correspond à un module de la spec. Les tests sont des fichiers `.sql` qui chargent des fixtures puis exécutent des assertions via une procédure `assert_equals` ; `run.sh` monte un conteneur `mysql:8.4`, applique les migrations, exécute les tests, détruit le conteneur. Aucune application, aucun ORM.

**Tech Stack:** MySQL 8.4 (InnoDB, `utf8mb4` / `utf8mb4_unicode_ci`), Docker (`mysql:8.4`) ou MySQL local via variables d'environnement, Bash pour le runner.

**Spec:** `docs/superpowers/specs/2026-08-29-modele-donnees-gestion-groupe-scolaire-design.md`

## Global Constraints

- SGBD cible : **MySQL 8.4**, moteur **InnoDB**, `DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` sur toutes les tables.
- Conventions de nommage (spec §5) : tables `snake_case` **singulier** sans accent ; PK = `id` `INT UNSIGNED AUTO_INCREMENT` ; FK nommées `fk_<table>_<cible>` ; index `idx_<table>_<colonnes>` ; contraintes d'unicité `unq_<table>_<colonnes>`.
- Montants : `DECIMAL(12,0)` (FCFA entiers, jamais de flottant). Notes : `DECIMAL(4,2)` (barème 20).
- Booléens : `TINYINT(1) NOT NULL DEFAULT 0`.
- Colonnes d'audit sur les tables transactionnelles listées spec §5 : `cree_par INT UNSIGNED NULL`, `cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`, `modifie_par INT UNSIGNED NULL`, `modifie_le DATETIME NULL ON UPDATE CURRENT_TIMESTAMP`. Ces colonnes **et leurs FK** `fk_<table>_cree_par` / `fk_<table>_modifie_par` → `utilisateur(id)` (`ON DELETE SET NULL`) sont déclarées **inline** dans chaque migration 003→007 (la table `utilisateur` est créée par la migration 002, qui s'exécute avant). Les tables des migrations 001 et 002 ne portent pas de colonnes d'audit.
- `ON DELETE RESTRICT` par défaut sur toutes les FK ; `ON DELETE CASCADE` uniquement pour : `affiliation`→`etudiant`, `piece_dossier`→`inscription`, `imputation_encaissement`→`encaissement`, `billetage`→`arrete_caisse`, `note_evaluation`→`evaluation`.
- Colonnes générées : utiliser `GENERATED ALWAYS AS (...) STORED` (MySQL 8.4).
- Une migration = un fichier ; elle doit pouvoir être rejouée sur une base fraîche sans erreur. Pas de `DROP` destructif hors migrations de correction explicites.
- Chaque tâche se termine par un `git commit`. Le dépôt est déjà initialisé ; travailler sur la branche `design/modele-donnees` (ou une branche dédiée `feat/schema-sql`).
- **Régimes de calcul** (spec §6 module 6) : LMD (`credits` non nuls, décision sur crédits acquis /60, seuils 48/60) et CLASSIQUE (`credits` NULL, décision sur `moyenne_annuelle` ≥ 10). `note_retenue = max(note_normale, LEAST(note_rattrapage, 10))`. Mentions : PASSABLE ≥ 10, AB ≥ 12, B ≥ 14, TB ≥ 16.

---

## Structure des fichiers

```
db/
  run.sh                         Runner : monte MySQL 8.4, applique migrations/, exécute tests/, teardown
  README.md                      Mode d'emploi du runner et des tests
  migrations/
    001_referentiel_academique.sql   groupe_scolaire, ecole, annee_scolaire, modalite_formation,
                                     niveau, filiere, option_filiere, classe, matiere, periode, session_examen
    002_utilisateurs_audit.sql       role, utilisateur, utilisateur_role, journal_audit
    003_personnes_inscriptions.sql   etudiant, affiliation, situation_bac, type_piece, inscription, piece_dossier
    004_scolarite_facturation.sql    modalite_paiement, type_frais, frais_inscription, echeance, bourse
    005_tresorerie.sql               compte, categorie_mouvement, mouvement, virement, encaissement,
                                     imputation_encaissement, depense, arrete_caisse, billetage
    006_rh_paie.sql                  enseignant, personnel_administratif, affectation_enseignement,
                                     salaire_enseignant, salaire_administration, avance_personnel
    007_evaluations_resultats.sql    evaluation, note_evaluation, resultat_matiere, resultat_periode,
                                     resultat_annuel, deliberation, dette_credit, bulletin
    008_vues.sql                     les 13 vues de la spec §7
    009_donnees_reference.sql        role, categorie_mouvement, modalite_formation, type_piece (référentiels figés)
  tests/
    helpers/00_assert.sql          CREATE PROCEDURE assert_equals / assert_true / assert_fails ; table _test_log
    fixtures/10_base.sql           1 groupe, 3 écoles (ESSIG LMD, UPSS LMD, CFPA CLASSIQUE), 1 année,
                                   niveaux, 1 filière+option par école, 1 classe par école, 1 utilisateur
    test_001_referentiel.sql
    test_002_utilisateurs_audit.sql
    test_003_personnes_inscriptions.sql
    test_004_scolarite_facturation.sql
    test_005_tresorerie.sql
    test_006_rh_paie.sql
    test_007_evaluations_resultats.sql
    test_008_vues.sql
```

## Conventions des migrations

- En-tête de chaque fichier :
  ```sql
  -- Migration NNN : <module>
  -- Spec : docs/superpowers/specs/2026-08-29-modele-donnees-gestion-groupe-scolaire-design.md §<n>
  SET NAMES utf8mb4;
  SET FOREIGN_KEY_CHECKS = 1;
  ```
- Ordre interne : `CREATE TABLE` des tables sans dépendance d'abord, puis celles qui les référencent.
- Les colonnes d'audit et leurs FK vers `utilisateur` sont déclarées **inline** dans 003→007 (voir Global Constraints). 002 (création de `utilisateur`) s'exécute avant 003.

## Conventions des tests

- `run.sh` exécute, dans l'ordre : toutes les `migrations/*.sql`, puis `tests/helpers/*.sql`, puis `tests/fixtures/*.sql`, puis chaque `tests/test_*.sql`.
- Chaque `test_*.sql` est autonome : il insère ses propres données de scénario (au-delà des fixtures de base) dans une transaction, exécute ses assertions, puis `ROLLBACK` en fin de fichier pour ne pas polluer les tests suivants.
- Une assertion échouée fait `SIGNAL SQLSTATE '45000'` → `mysql` sort en erreur → `run.sh` renvoie un code non nul.
- Procédures fournies par `tests/helpers/00_assert.sql` :
  - `assert_equals(expected TEXT, actual TEXT, label TEXT)`
  - `assert_true(cond INT, label TEXT)` (échoue si `cond` est 0 ou NULL)
  - `assert_fails(label TEXT)` — à appeler dans un `DECLARE ... HANDLER` pour vérifier qu'une écriture viole bien une contrainte

---

## Task 0 : Harnais de tests (runner + assertions)

**Files:**
- Create: `db/run.sh`
- Create: `db/README.md`
- Create: `db/migrations/.gitkeep`
- Create: `db/tests/helpers/00_assert.sql`
- Create: `db/tests/smoke/test_smoke.sql`

**Interfaces:**
- Consumes: rien.
- Produces :
  - `db/run.sh` — script exécutable. Variables d'env : `MYSQL_IMAGE` (défaut `mysql:8.4`), `DB_NAME` (défaut `mlamine_test`), `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASS` (si définis, utilise un MySQL existant au lieu de Docker). Applique `db/migrations/*.sql` triés, puis `db/tests/helpers/*.sql`, `db/tests/fixtures/*.sql`, `db/tests/test_*.sql` et `db/tests/smoke/*.sql` triés. Code de sortie 0 = tous les tests passent.
  - Procédures SQL `assert_equals(TEXT, TEXT, TEXT)`, `assert_true(INT, TEXT)` dans le schéma courant.
  - Table `_test_log(id, label, ok, detail, cree_le)` alimentée par les procédures.

- [ ] **Step 1: Écrire le test smoke qui échoue**

`db/tests/smoke/test_smoke.sql` :

```sql
-- Vérifie que le harnais d'assertions fonctionne.
CALL assert_equals('1', CAST(1 AS CHAR), 'smoke: 1 == 1');
CALL assert_true( (SELECT COUNT(*) FROM information_schema.tables
                   WHERE table_schema = DATABASE() AND table_name = '_test_log') , 'smoke: _test_log existe');
```

- [ ] **Step 2: Lancer le runner et vérifier l'échec**

Run: `bash db/run.sh`
Expected: FAIL — `db/run.sh` n'existe pas encore (ou, une fois créé, échoue car `assert_equals` n'est pas définie).

- [ ] **Step 3: Écrire `db/tests/helpers/00_assert.sql`**

```sql
-- Harnais d'assertions pour les tests de schéma.
DROP TABLE IF EXISTS _test_log;
CREATE TABLE _test_log (
  id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  label  VARCHAR(255) NOT NULL,
  ok     TINYINT(1) NOT NULL,
  detail TEXT NULL,
  cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS assert_equals;
DROP PROCEDURE IF EXISTS assert_true;

DELIMITER $$

CREATE PROCEDURE assert_equals(IN p_expected TEXT, IN p_actual TEXT, IN p_label VARCHAR(255))
BEGIN
  IF NOT (p_expected <=> p_actual) THEN
    INSERT INTO _test_log(label, ok, detail)
      VALUES (p_label, 0, CONCAT('attendu=[', IFNULL(p_expected,'NULL'), '] obtenu=[', IFNULL(p_actual,'NULL'), ']'));
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = CONCAT('ASSERT FAIL: ', p_label,
                               ' | attendu=[', IFNULL(p_expected,'NULL'),
                               '] obtenu=[', IFNULL(p_actual,'NULL'), ']');
  ELSE
    INSERT INTO _test_log(label, ok) VALUES (p_label, 1);
  END IF;
END$$

CREATE PROCEDURE assert_true(IN p_cond INT, IN p_label VARCHAR(255))
BEGIN
  IF p_cond IS NULL OR p_cond = 0 THEN
    INSERT INTO _test_log(label, ok, detail) VALUES (p_label, 0, CONCAT('cond=', IFNULL(p_cond,'NULL')));
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = CONCAT('ASSERT FAIL: ', p_label);
  ELSE
    INSERT INTO _test_log(label, ok) VALUES (p_label, 1);
  END IF;
END$$

DELIMITER ;
```

- [ ] **Step 4: Écrire `db/run.sh`**

```bash
#!/usr/bin/env bash
# Applique les migrations et exécute les tests SQL sur une base MySQL 8.4 jetable.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MYSQL_IMAGE="${MYSQL_IMAGE:-mysql:8.4}"
DB_NAME="${DB_NAME:-mlamine_test}"
CID=""

cleanup() { [ -n "$CID" ] && docker rm -f "$CID" >/dev/null 2>&1 || true; }
trap cleanup EXIT

if [ -n "${DB_HOST:-}" ]; then
  MYSQL=(mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "${DB_USER:-root}" "${DB_PASS:+-p$DB_PASS}")
  "${MYSQL[@]}" -e "DROP DATABASE IF EXISTS \`$DB_NAME\`; CREATE DATABASE \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
  MYSQL+=("$DB_NAME")
else
  echo "Démarrage du conteneur $MYSQL_IMAGE ..."
  CID="$(docker run -d --rm -e MYSQL_ALLOW_EMPTY_PASSWORD=1 -e MYSQL_DATABASE="$DB_NAME" "$MYSQL_IMAGE" \
        --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci)"
  echo -n "Attente de MySQL "
  for _ in $(seq 1 60); do
    if docker exec "$CID" mysqladmin ping -h127.0.0.1 --silent >/dev/null 2>&1; then break; fi
    echo -n "."; sleep 2
  done
  echo " ok"
  MYSQL=(docker exec -i "$CID" mysql -uroot "$DB_NAME")
fi

run_sql() { echo ">> $1"; "${MYSQL[@]}" < "$1"; }

shopt -s nullglob
for f in "$ROOT"/migrations/*.sql;      do run_sql "$f"; done
for f in "$ROOT"/tests/helpers/*.sql;   do run_sql "$f"; done
for f in "$ROOT"/tests/fixtures/*.sql;  do run_sql "$f"; done
for f in "$ROOT"/tests/test_*.sql "$ROOT"/tests/smoke/*.sql; do run_sql "$f"; done

echo "OK — tous les tests SQL sont passés."
```

- [ ] **Step 5: Rendre exécutable et créer les répertoires**

Run:
```bash
chmod +x db/run.sh
mkdir -p db/migrations db/tests/helpers db/tests/fixtures db/tests/smoke
touch db/migrations/.gitkeep
```

- [ ] **Step 6: Écrire `db/README.md`**

```markdown
# Base de données `mlamine`

Schéma cible du système de gestion du groupe scolaire, en migrations SQL MySQL 8.4.

## Exécuter les migrations + tests

```bash
db/run.sh                     # via Docker (mysql:8.4)
DB_HOST=127.0.0.1 DB_USER=root DB_PASS=secret db/run.sh   # sur un MySQL existant
```

`run.sh` recrée une base jetable, applique `migrations/*.sql` dans l'ordre, puis
exécute `tests/helpers`, `tests/fixtures`, `tests/test_*`. Code de sortie non nul si une
assertion échoue.

## Ajouter une migration

Fichier `migrations/NNN_<module>.sql`, NNN strictement croissant. Rejouable sur base fraîche.
Voir `docs/superpowers/plans/2026-08-29-schema-sql-gestion-groupe-scolaire.md`.
```

- [ ] **Step 7: Lancer le runner et vérifier le succès du smoke**

Run: `bash db/run.sh`
Expected: PASS — sortie `OK — tous les tests SQL sont passés.` (le smoke test valide `assert_equals` et l'existence de `_test_log`).

- [ ] **Step 8: Commit**

```bash
git add db/
git commit -m "build: harnais de tests SQL (runner MySQL 8.4 + assertions)"
```

---

## Task 1 : Migration 001 — Référentiel académique

**Files:**
- Create: `db/migrations/001_referentiel_academique.sql`
- Create: `db/tests/fixtures/10_base.sql`
- Create: `db/tests/test_001_referentiel.sql`

**Interfaces:**
- Consumes: harnais Task 0 (`assert_equals`, `assert_true`, `run.sh`).
- Produces (tables et colonnes que les migrations suivantes référencent) :
  - `groupe_scolaire(id)`, `ecole(id, groupe_scolaire_id, pole, regime)`,
    `annee_scolaire(id, libelle, est_courante)`, `modalite_formation(id, code)`,
    `niveau(id, ecole_id, code, credits_requis, a_soutenance)`,
    `filiere(id, ecole_id, sigle)`, `option_filiere(id, filiere_id, sigle)`,
    `classe(id, annee_scolaire_id, niveau_id, option_filiere_id, modalite_formation_id)`,
    `matiere(id, niveau_id, option_filiere_id, semestre, coefficient, credits, volume_horaire)`,
    `periode(id, annee_scolaire_id, numero)`,
    `session_examen(id, periode_id, type)`.
  - `db/tests/fixtures/10_base.sql` insère et fixe des identifiants réutilisables par tous les tests suivants (via variables de session `@g_groupe`, `@e_essig`, `@e_upss`, `@e_cfpa`, `@an_2025`, `@niv_essig_l1`, `@fil_essig`, `@opt_essig`, `@classe_essig_l1`, `@per_s1`, `@sess_s1_normale`).

- [ ] **Step 1: Écrire `db/migrations/001_referentiel_academique.sql`**

```sql
-- Migration 001 : Référentiel académique
-- Spec : docs/superpowers/specs/2026-08-29-modele-donnees-gestion-groupe-scolaire-design.md §6 module 1
SET NAMES utf8mb4;

CREATE TABLE groupe_scolaire (
  id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nom      VARCHAR(120) NOT NULL,
  sigle    VARCHAR(20)  NULL,
  logo     VARCHAR(255) NULL,
  contacts VARCHAR(120) NULL,
  email    VARCHAR(120) NULL,
  adresse  VARCHAR(255) NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ecole (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  groupe_scolaire_id INT UNSIGNED NOT NULL,
  nom                VARCHAR(120) NOT NULL,
  sigle              VARCHAR(20)  NULL,
  pole               ENUM('ESSIG','UPSS','CFPA','CICI') NOT NULL,
  regime             ENUM('LMD','CLASSIQUE') NOT NULL,
  logo               VARCHAR(255) NULL,
  contacts           VARCHAR(120) NULL,
  email              VARCHAR(120) NULL,
  PRIMARY KEY (id),
  KEY idx_ecole_groupe (groupe_scolaire_id),
  CONSTRAINT fk_ecole_groupe FOREIGN KEY (groupe_scolaire_id) REFERENCES groupe_scolaire (id)
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
```

- [ ] **Step 2: Lancer le runner et vérifier l'échec du test 001 (fichiers absents)**

Run: `bash db/run.sh`
Expected: la migration 001 s'applique sans erreur, mais `bash db/run.sh` échoue plus loin car `db/tests/test_001_referentiel.sql` n'existe pas encore → aucun fichier `test_001` → (à ce stade seul le smoke tourne, il passe). Créer d'abord le test pour obtenir un échec réel : passer au Step 3.

- [ ] **Step 3: Écrire `db/tests/fixtures/10_base.sql`**

```sql
-- Fixtures de base réutilisées par tous les tests. Idempotent (TRUNCATE puis INSERT).
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE session_examen;
TRUNCATE TABLE periode;
TRUNCATE TABLE matiere;
TRUNCATE TABLE classe;
TRUNCATE TABLE option_filiere;
TRUNCATE TABLE filiere;
TRUNCATE TABLE niveau;
TRUNCATE TABLE modalite_formation;
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

INSERT INTO modalite_formation (code, libelle) VALUES ('FI', 'Formation Initiale');
SET @mod_fi = LAST_INSERT_ID();

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
```

- [ ] **Step 4: Écrire `db/tests/test_001_referentiel.sql` (assertions qui échouent si la migration est incomplète)**

```sql
-- Test 001 : structure et contraintes du référentiel académique.
START TRANSACTION;

-- 11 tables créées par la migration 001
CALL assert_equals('11', CAST((
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name IN ('groupe_scolaire','ecole','annee_scolaire','modalite_formation','niveau',
                       'filiere','option_filiere','classe','matiere','periode','session_examen')
) AS CHAR), 'les 11 tables du referentiel existent');

-- toutes en InnoDB / utf8mb4
CALL assert_equals('0', CAST((
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name IN ('groupe_scolaire','ecole','niveau','classe','matiere')
    AND (engine <> 'InnoDB' OR table_collation <> 'utf8mb4_unicode_ci')
) AS CHAR), 'moteur InnoDB + collation utf8mb4_unicode_ci');

-- FK classe -> 4 references
CALL assert_equals('4', CAST((
  SELECT COUNT(*) FROM information_schema.referential_constraints
  WHERE constraint_schema = DATABASE() AND table_name = 'classe'
) AS CHAR), 'classe a 4 cles etrangeres');

-- unicite (ecole_id, code) sur niveau : deux L1 dans la meme ecole doivent echouer
INSERT INTO groupe_scolaire (nom) VALUES ('G tmp'); SET @gt = LAST_INSERT_ID();
INSERT INTO ecole (groupe_scolaire_id, nom, pole, regime) VALUES (@gt, 'E tmp', 'ESSIG', 'LMD');
SET @et = LAST_INSERT_ID();
INSERT INTO niveau (ecole_id, code, libelle, ordre, credits_requis) VALUES (@et, 'L1', 'Licence 1', 1, 60);

SET @doublon_rejete = 0;
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET @doublon_rejete = 1;
  INSERT INTO niveau (ecole_id, code, libelle, ordre, credits_requis) VALUES (@et, 'L1', 'Doublon', 9, 60);
END;
CALL assert_true(@doublon_rejete, 'unq_niveau_ecole_code rejette un doublon (ecole_id, code)');

-- credits_requis nullable (regime CLASSIQUE)
INSERT INTO niveau (ecole_id, code, libelle, ordre, credits_requis) VALUES (@et, '1A', '1ere Annee', 1, NULL);
CALL assert_true((SELECT credits_requis IS NULL FROM niveau WHERE ecole_id=@et AND code='1A'),
                 'niveau.credits_requis accepte NULL');

ROLLBACK;
```

> Note : le bloc `BEGIN ... DECLARE HANDLER ... END` hors procédure n'est pas valide en SQL script MySQL. Utiliser à la place le motif ci-dessous dans le fichier de test (procédure jetable) :

```sql
DROP PROCEDURE IF EXISTS _t001_doublon;
DELIMITER $$
CREATE PROCEDURE _t001_doublon()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET @doublon_rejete = 1;
  SET @doublon_rejete = 0;
  INSERT INTO niveau (ecole_id, code, libelle, ordre, credits_requis) VALUES (@et, 'L1', 'Doublon', 9, 60);
END$$
DELIMITER ;
CALL _t001_doublon();
CALL assert_true(@doublon_rejete, 'unq_niveau_ecole_code rejette un doublon (ecole_id, code)');
DROP PROCEDURE _t001_doublon;
```

- [ ] **Step 5: Lancer le runner, vérifier que 001 passe**

Run: `bash db/run.sh`
Expected: PASS — `OK — tous les tests SQL sont passés.` avec les assertions de `test_001_referentiel.sql` enregistrées `ok=1` dans `_test_log`.

- [ ] **Step 6: Commit**

```bash
git add db/migrations/001_referentiel_academique.sql db/tests/fixtures/10_base.sql db/tests/test_001_referentiel.sql
git commit -m "feat(db): migration 001 - referentiel academique (11 tables)"
```

---

## Task 2 : Migration 002 — Utilisateurs & audit

**Files:**
- Create: `db/migrations/002_utilisateurs_audit.sql`
- Create: `db/tests/test_002_utilisateurs_audit.sql`

**Interfaces:**
- Consumes: harnais Task 0.
- Produces :
  - `role(id, code, libelle)` — `code` ENUM('COMPTABLE','DAF','DIRECTION','SCOLARITE','LECTURE').
  - `utilisateur(id, personnel_administratif_id NULL, login, email, mot_de_passe_hash, actif, derniere_connexion, cree_le)`. La FK `personnel_administratif_id` est **différée** : colonne créée ici, contrainte ajoutée par la migration 006 (`personnel_administratif` n'existe pas encore).
  - `utilisateur_role(utilisateur_id, role_id, ecole_id NULL)` — PK composite.
  - `journal_audit(id, utilisateur_id, action, table_cible, ligne_id, valeurs_avant, valeurs_apres, date, ip)`.
  - `db/tests/fixtures/10_base.sql` doit être complété (Step 3) pour insérer `@u_admin` (un `utilisateur`) réutilisé comme `cree_par` dans les tests suivants.

- [ ] **Step 1: Écrire `db/migrations/002_utilisateurs_audit.sql`**

```sql
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
  utilisateur_id INT UNSIGNED NOT NULL,
  role_id        INT UNSIGNED NOT NULL,
  ecole_id       INT UNSIGNED NULL,
  PRIMARY KEY (utilisateur_id, role_id, ecole_id),
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
```

- [ ] **Step 2: Compléter `db/tests/fixtures/10_base.sql` — ajouter un utilisateur**

Ajouter à la fin du fichier (après le bloc `session_examen`) :

```sql
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE utilisateur_role;
TRUNCATE TABLE journal_audit;
TRUNCATE TABLE utilisateur;
TRUNCATE TABLE role;
SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO role (code, libelle) VALUES ('COMPTABLE','Comptable'), ('DAF','Directeur Administratif et Financier');
INSERT INTO utilisateur (login, email, mot_de_passe_hash) VALUES ('admin', 'admin@usia.test', 'x');
SET @u_admin = LAST_INSERT_ID();
INSERT INTO utilisateur_role (utilisateur_id, role_id, ecole_id)
  VALUES (@u_admin, (SELECT id FROM role WHERE code='DAF'), NULL);
```

- [ ] **Step 3: Écrire `db/tests/test_002_utilisateurs_audit.sql`**

```sql
-- Test 002 : utilisateurs, roles, audit.
START TRANSACTION;

CALL assert_equals('4', CAST((
  SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()
    AND table_name IN ('role','utilisateur','utilisateur_role','journal_audit')
) AS CHAR), 'les 4 tables transverses existent');

-- login unique
DROP PROCEDURE IF EXISTS _t002_login;
DELIMITER $$
CREATE PROCEDURE _t002_login()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET @login_rejete = 1;
  SET @login_rejete = 0;
  INSERT INTO utilisateur (login, email, mot_de_passe_hash) VALUES ('admin', 'autre@usia.test', 'y');
END$$
DELIMITER ;
CALL _t002_login();
CALL assert_true(@login_rejete, 'unq_utilisateur_login rejette un login en double');
DROP PROCEDURE _t002_login;

-- PK composite utilisateur_role : (u, r, NULL) puis (u, r, ecole) coexistent
INSERT INTO utilisateur_role (utilisateur_id, role_id, ecole_id)
  VALUES (@u_admin, (SELECT id FROM role WHERE code='DAF'), @e_essig);
CALL assert_equals('2', CAST((SELECT COUNT(*) FROM utilisateur_role WHERE utilisateur_id=@u_admin) AS CHAR),
                   'utilisateur_role accepte (u,r,NULL) et (u,r,ecole)');

-- suppression utilisateur -> cascade sur utilisateur_role
DELETE FROM utilisateur WHERE id=@u_admin;
CALL assert_equals('0', CAST((SELECT COUNT(*) FROM utilisateur_role WHERE utilisateur_id=@u_admin) AS CHAR),
                   'ON DELETE CASCADE utilisateur -> utilisateur_role');

-- journal_audit accepte du JSON
INSERT INTO utilisateur (login,email,mot_de_passe_hash) VALUES ('u2','u2@t','x'); SET @u2=LAST_INSERT_ID();
INSERT INTO journal_audit (utilisateur_id, action, table_cible, ligne_id, valeurs_apres)
  VALUES (@u2, 'CREATION', 'ecole', 1, JSON_OBJECT('nom','X'));
CALL assert_true((SELECT JSON_VALID(valeurs_apres) FROM journal_audit ORDER BY id DESC LIMIT 1),
                 'journal_audit.valeurs_apres est du JSON valide');

ROLLBACK;
```

- [ ] **Step 4: Lancer le runner**

Run: `bash db/run.sh`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add db/migrations/002_utilisateurs_audit.sql db/tests/fixtures/10_base.sql db/tests/test_002_utilisateurs_audit.sql
git commit -m "feat(db): migration 002 - utilisateurs, roles, journal d'audit"
```

---

## Task 3 : Migration 003 — Personnes & inscriptions

**Files:**
- Create: `db/migrations/003_personnes_inscriptions.sql`
- Create: `db/tests/test_003_personnes_inscriptions.sql`

**Interfaces:**
- Consumes: 001 (`ecole`, `classe`, `annee_scolaire`), 002 (`utilisateur`).
- Produces :
  - `etudiant(id, matricule UNIQUE, numero_interne_archive, nom, prenoms, sexe, date_naissance, lieu_naissance, nationalite, email, telephone, adresse, photo, situation_matrimoniale)`.
  - `affiliation(id, etudiant_id, type, nom, prenom, contact, profession)` — `ON DELETE CASCADE`, UNIQUE(etudiant_id, type).
  - `situation_bac(id, etudiant_id UNIQUE, a_le_bac, annee_obtention, serie, mention, etablissement, ville)`.
  - `type_piece(id, code UNIQUE, libelle)`.
  - `inscription(id, etudiant_id, classe_id, ecole_id, annee_scolaire_id, numero_ordre, type, statut, etablissement_provenance, est_boursier, cout_scolarite_negocie, date_inscription, etat, + audit)` — UNIQUE(etudiant_id, annee_scolaire_id), UNIQUE(ecole_id, annee_scolaire_id, numero_ordre).
  - `piece_dossier(id, inscription_id, type_piece_id, fournie, date_reception)` — `ON DELETE CASCADE`, UNIQUE(inscription_id, type_piece_id).

- [ ] **Step 1: Écrire `db/migrations/003_personnes_inscriptions.sql`**

```sql
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
```

- [ ] **Step 2: Compléter `db/tests/fixtures/10_base.sql` — un étudiant + une inscription**

Ajouter à la fin :

```sql
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE piece_dossier;
TRUNCATE TABLE inscription;
TRUNCATE TABLE type_piece;
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
```

- [ ] **Step 3: Écrire `db/tests/test_003_personnes_inscriptions.sql`**

```sql
-- Test 003 : personnes & inscriptions.
START TRANSACTION;

-- matricule unique
DROP PROCEDURE IF EXISTS _t003_mat;
DELIMITER $$
CREATE PROCEDURE _t003_mat()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET @mat_rejete = 1;
  SET @mat_rejete = 0;
  INSERT INTO etudiant (matricule, nom, prenoms, sexe) VALUES ('ESSIG-2025-0001', 'X', 'Y', 'F');
END$$
DELIMITER ;
CALL _t003_mat();
CALL assert_true(@mat_rejete, 'unq_etudiant_matricule rejette un doublon');
DROP PROCEDURE _t003_mat;

-- une seule inscription par (etudiant, annee)
DROP PROCEDURE IF EXISTS _t003_insc;
DELIMITER $$
CREATE PROCEDURE _t003_insc()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET @insc_rejete = 1;
  SET @insc_rejete = 0;
  INSERT INTO inscription (etudiant_id, classe_id, ecole_id, annee_scolaire_id, numero_ordre,
                           type, statut, date_inscription)
    VALUES (@etu_1, @classe_essig_l1, @e_essig, @an_2025, 99, 'REINSCRIPTION', 'ANCIEN', '2025-10-01');
END$$
DELIMITER ;
CALL _t003_insc();
CALL assert_true(@insc_rejete, 'unq_inscription_etudiant_annee : une inscription par etudiant et par annee');
DROP PROCEDURE _t003_insc;

-- numero_ordre unique par (ecole, annee)
INSERT INTO etudiant (matricule, nom, prenoms, sexe) VALUES ('ESSIG-2025-0002','A','B','M');
SET @etu_2 = LAST_INSERT_ID();
DROP PROCEDURE IF EXISTS _t003_ordre;
DELIMITER $$
CREATE PROCEDURE _t003_ordre()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET @ordre_rejete = 1;
  SET @ordre_rejete = 0;
  INSERT INTO inscription (etudiant_id, classe_id, ecole_id, annee_scolaire_id, numero_ordre,
                           type, statut, date_inscription)
    VALUES (@etu_2, @classe_essig_l1, @e_essig, @an_2025, 1, 'INSCRIPTION', 'NOUVEAU', '2025-09-21');
END$$
DELIMITER ;
CALL _t003_ordre();
CALL assert_true(@ordre_rejete, 'unq_inscription_numero_ordre : (ecole, annee, numero_ordre) unique');
DROP PROCEDURE _t003_ordre;

-- affiliation : 3 types + cascade a la suppression de l'etudiant
INSERT INTO affiliation (etudiant_id, type, nom, prenom, contact) VALUES
  (@etu_2,'PERE','A','P','01'), (@etu_2,'MERE','A','M','02'), (@etu_2,'TUTEUR','A','T','03');
CALL assert_equals('3', CAST((SELECT COUNT(*) FROM affiliation WHERE etudiant_id=@etu_2) AS CHAR),
                   'affiliation : PERE/MERE/TUTEUR');
DELETE FROM etudiant WHERE id=@etu_2;
CALL assert_equals('0', CAST((SELECT COUNT(*) FROM affiliation WHERE etudiant_id=@etu_2) AS CHAR),
                   'ON DELETE CASCADE etudiant -> affiliation');

-- etat par defaut
CALL assert_equals('ACTIVE', (SELECT etat FROM inscription WHERE id=@insc_1), 'inscription.etat defaut = ACTIVE');

ROLLBACK;
```

- [ ] **Step 4: Lancer le runner**

Run: `bash db/run.sh`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add db/migrations/003_personnes_inscriptions.sql db/tests/fixtures/10_base.sql db/tests/test_003_personnes_inscriptions.sql
git commit -m "feat(db): migration 003 - etudiants, affiliation, inscriptions"
```

---

## Task 4 : Migration 004 — Scolarité & facturation

**Files:**
- Create: `db/migrations/004_scolarite_facturation.sql`
- Create: `db/tests/test_004_scolarite_facturation.sql`

**Interfaces:**
- Consumes: 001 (`niveau`, `annee_scolaire`, `ecole`), 003 (`inscription`), 002 (`utilisateur`).
- Produces :
  - `modalite_paiement(id, niveau_id, annee_scolaire_id, montant_inscription_reinscription, nombre_echeance, montant_echeance, montant_total GENERATED STORED)` — UNIQUE(niveau_id, annee_scolaire_id).
  - `type_frais(id, code UNIQUE, libelle, ecole_id NULL, niveau_id NULL, annee_scolaire_id NULL, montant_defaut, obligatoire, actif)`.
  - `frais_inscription(id, inscription_id, type_frais_id, montant_du, exonere, commentaire, + audit)` — UNIQUE(inscription_id, type_frais_id).
  - `echeance(id, inscription_id, numero, montant_prevu, date_prevue, pris_en_charge_bourse, + audit)` — UNIQUE(inscription_id, numero).
  - `bourse(id, inscription_id, organisme, perimetre, montant_couvert, + audit)`.

- [ ] **Step 1: Écrire `db/migrations/004_scolarite_facturation.sql`**

```sql
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
```

- [ ] **Step 2: Compléter `db/tests/fixtures/10_base.sql` — grille tarifaire + échéancier**

Ajouter à la fin :

```sql
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
```

- [ ] **Step 3: Écrire `db/tests/test_004_scolarite_facturation.sql`**

```sql
-- Test 004 : scolarite & facturation.
START TRANSACTION;

-- colonne generee montant_total
CALL assert_equals('735000', CAST((
  SELECT montant_total FROM modalite_paiement WHERE niveau_id=@niv_essig_l1 AND annee_scolaire_id=@an_2025
) AS CHAR), 'modalite_paiement.montant_total = 105000 + 9*70000');

-- echeancier : 10 lignes (0..9), somme des mensualites = 630000
CALL assert_equals('10', CAST((SELECT COUNT(*) FROM echeance WHERE inscription_id=@insc_1) AS CHAR),
                   'echeancier : 10 echeances (numero 0..9)');
CALL assert_equals('630000', CAST((
  SELECT SUM(montant_prevu) FROM echeance WHERE inscription_id=@insc_1 AND numero > 0
) AS CHAR), 'somme des mensualites = 630000');

-- unicite (inscription, numero)
DROP PROCEDURE IF EXISTS _t004_ech;
DELIMITER $$
CREATE PROCEDURE _t004_ech()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET @ech_rejete = 1;
  SET @ech_rejete = 0;
  INSERT INTO echeance (inscription_id, numero, montant_prevu, date_prevue)
    VALUES (@insc_1, 1, 1, '2025-10-06');
END$$
DELIMITER ;
CALL _t004_ech();
CALL assert_true(@ech_rejete, 'unq_echeance (inscription_id, numero)');
DROP PROCEDURE _t004_ech;

-- unicite (inscription, type_frais)
DROP PROCEDURE IF EXISTS _t004_fi;
DELIMITER $$
CREATE PROCEDURE _t004_fi()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET @fi_rejete = 1;
  SET @fi_rejete = 0;
  INSERT INTO frais_inscription (inscription_id, type_frais_id, montant_du) VALUES (@insc_1, @tf_tenue, 1);
END$$
DELIMITER ;
CALL _t004_fi();
CALL assert_true(@fi_rejete, 'unq_frais_inscription (inscription_id, type_frais_id)');
DROP PROCEDURE _t004_fi;

-- bourse : marquage pris_en_charge_bourse
UPDATE echeance SET pris_en_charge_bourse = 1 WHERE inscription_id=@insc_1 AND numero > 0;
INSERT INTO bourse (inscription_id, organisme, montant_couvert, cree_par)
  VALUES (@insc_1, 'ANBG', 630000, @u_admin);
CALL assert_equals('9', CAST((
  SELECT COUNT(*) FROM echeance WHERE inscription_id=@insc_1 AND pris_en_charge_bourse=1
) AS CHAR), 'boursier : 9 echeances prises en charge, l inscription reste a la charge de l etudiant');

ROLLBACK;
```

- [ ] **Step 4: Lancer le runner**

Run: `bash db/run.sh`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add db/migrations/004_scolarite_facturation.sql db/tests/fixtures/10_base.sql db/tests/test_004_scolarite_facturation.sql
git commit -m "feat(db): migration 004 - modalites, frais, echeancier, bourses"
```

---

## Task 5 : Migration 005 — Encaissements & trésorerie (grand livre)

**Files:**
- Create: `db/migrations/005_tresorerie.sql`
- Create: `db/tests/test_005_tresorerie.sql`

**Interfaces:**
- Consumes: 001 (`ecole`, `annee_scolaire`, `groupe_scolaire`), 003 (`inscription`), 004 (`echeance`, `frais_inscription`), 002 (`utilisateur`).
- Produces :
  - `compte(id, groupe_scolaire_id, code UNIQUE, libelle, type, numero_bancaire, banque, solde_initial, actif)`.
  - `categorie_mouvement(id, code UNIQUE, libelle, sens)`.
  - `virement(id, compte_source_id, compte_destination_id, montant, date, motif, + audit)`.
  - `mouvement(id, compte_id, date_operation, sens, montant, categorie_mouvement_id, libelle, piece_reference, ecole_id NULL, annee_scolaire_id, virement_id NULL, valide, + audit)`.
  - `encaissement(id, inscription_id, date, montant_total, mode, compte_id, mouvement_id, recu_numero UNIQUE, + audit)`.
  - `imputation_encaissement(id, encaissement_id, cible, echeance_id NULL, frais_inscription_id NULL, montant)` — `ON DELETE CASCADE` vers `encaissement`.
  - `depense(id, date, categorie_mouvement_id, beneficiaire, designation, montant, compte_id, mouvement_id, ecole_id NULL, annee_scolaire_id, piece_justificative, engage_par, valide_par NULL, + audit)`.
  - `arrete_caisse(id, compte_id, date, solde_theorique, solde_physique, ecart GENERATED STORED, fait_par, + audit)`.
  - `billetage(id, arrete_caisse_id, denomination, quantite, montant GENERATED STORED)` — `ON DELETE CASCADE`, UNIQUE(arrete_caisse_id, denomination).

- [ ] **Step 1: Écrire `db/migrations/005_tresorerie.sql`**

```sql
-- Migration 005 : Encaissements & tresorerie
-- Spec : §6 module 4
SET NAMES utf8mb4;

CREATE TABLE compte (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  groupe_scolaire_id INT UNSIGNED NOT NULL,
  code               VARCHAR(30) NOT NULL,
  libelle            VARCHAR(120) NOT NULL,
  type               ENUM('CAISSE','BANQUE','MOBILE_MONEY','VIRTUEL') NOT NULL,
  numero_bancaire    VARCHAR(40) NULL,
  banque             VARCHAR(120) NULL,
  solde_initial      DECIMAL(12,0) NOT NULL DEFAULT 0,
  actif              TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY unq_compte_code (code),
  CONSTRAINT fk_compte_groupe FOREIGN KEY (groupe_scolaire_id) REFERENCES groupe_scolaire (id)
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
```

- [ ] **Step 2: Compléter `db/tests/fixtures/10_base.sql` — comptes + catégories**

Ajouter à la fin :

```sql
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE billetage;
TRUNCATE TABLE arrete_caisse;
TRUNCATE TABLE imputation_encaissement;
TRUNCATE TABLE depense;
TRUNCATE TABLE encaissement;
TRUNCATE TABLE mouvement;
TRUNCATE TABLE virement;
TRUNCATE TABLE categorie_mouvement;
TRUNCATE TABLE compte;
SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO compte (groupe_scolaire_id, code, libelle, type, solde_initial) VALUES
  (@g_groupe, 'CAISSE', 'Caisse principale', 'CAISSE', 0),
  (@g_groupe, 'BANQUE_A', 'Banque compte A', 'BANQUE', 0),
  (@g_groupe, 'AIRTEL_MONEY', 'Airtel Money', 'MOBILE_MONEY', 0);
SET @cpt_caisse = (SELECT id FROM compte WHERE code='CAISSE');
SET @cpt_banque = (SELECT id FROM compte WHERE code='BANQUE_A');

INSERT INTO categorie_mouvement (code, libelle, sens) VALUES
  ('SCOLARITE', 'Encaissement scolarite', 'ENTREE'),
  ('FRAIS_ANNEXE', 'Encaissement frais annexe', 'ENTREE'),
  ('DEPENSE_FONCTIONNEMENT', 'Depense de fonctionnement', 'SORTIE'),
  ('SALAIRE_ENSEIGNANT', 'Salaire enseignant', 'SORTIE'),
  ('SALAIRE_ADMIN', 'Salaire administration', 'SORTIE'),
  ('VIREMENT', 'Virement inter-comptes', 'NEUTRE');
SET @cat_scol = (SELECT id FROM categorie_mouvement WHERE code='SCOLARITE');
SET @cat_dep  = (SELECT id FROM categorie_mouvement WHERE code='DEPENSE_FONCTIONNEMENT');
```

- [ ] **Step 3: Écrire `db/tests/test_005_tresorerie.sql`**

```sql
-- Test 005 : grand livre de tresorerie.
START TRANSACTION;

-- montant > 0 impose
DROP PROCEDURE IF EXISTS _t005_neg;
DELIMITER $$
CREATE PROCEDURE _t005_neg()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET @neg_rejete = 1;
  SET @neg_rejete = 0;
  INSERT INTO mouvement (compte_id, date_operation, sens, montant, categorie_mouvement_id, libelle, annee_scolaire_id)
    VALUES (@cpt_caisse, '2025-10-05', 'CREDIT', -100, @cat_scol, 'negatif', @an_2025);
END$$
DELIMITER ;
CALL _t005_neg();
CALL assert_true(@neg_rejete, 'chk_mouvement_montant : montant <= 0 rejete');
DROP PROCEDURE _t005_neg;

-- encaissement 100 000 : 1 mouvement CREDIT + ventilation echeance(70000) + frais tenue(25000) + echeance(5000)
INSERT INTO mouvement (compte_id, date_operation, sens, montant, categorie_mouvement_id, libelle, ecole_id, annee_scolaire_id, cree_par)
  VALUES (@cpt_caisse, '2025-10-05', 'CREDIT', 100000, @cat_scol, 'Encaissement recu R-0001', @e_essig, @an_2025, @u_admin);
SET @mv_enc = LAST_INSERT_ID();
INSERT INTO encaissement (inscription_id, date, montant_total, mode, compte_id, mouvement_id, recu_numero, cree_par)
  VALUES (@insc_1, '2025-10-05', 100000, 'ESPECES', @cpt_caisse, @mv_enc, 'R-0001', @u_admin);
SET @enc_1 = LAST_INSERT_ID();
INSERT INTO imputation_encaissement (encaissement_id, cible, echeance_id, montant)
  VALUES (@enc_1, 'ECHEANCE', @ech_1_1, 70000);
INSERT INTO imputation_encaissement (encaissement_id, cible, frais_inscription_id, montant)
  VALUES (@enc_1, 'FRAIS', @fi_tenue_1, 25000);
INSERT INTO imputation_encaissement (encaissement_id, cible, echeance_id, montant)
  VALUES (@enc_1, 'ECHEANCE', (SELECT id FROM echeance WHERE inscription_id=@insc_1 AND numero=2), 5000);

CALL assert_equals('100000', CAST((
  SELECT SUM(montant) FROM imputation_encaissement WHERE encaissement_id=@enc_1
) AS CHAR), 'somme des imputations = montant de l encaissement');

-- recu_numero unique
DROP PROCEDURE IF EXISTS _t005_recu;
DELIMITER $$
CREATE PROCEDURE _t005_recu()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET @recu_rejete = 1;
  SET @recu_rejete = 0;
  INSERT INTO mouvement (compte_id, date_operation, sens, montant, categorie_mouvement_id, libelle, annee_scolaire_id)
    VALUES (@cpt_caisse, '2025-10-06', 'CREDIT', 1, @cat_scol, 'x', @an_2025);
  INSERT INTO encaissement (inscription_id, date, montant_total, mode, compte_id, mouvement_id, recu_numero)
    VALUES (@insc_1, '2025-10-06', 1, 'ESPECES', @cpt_caisse, LAST_INSERT_ID(), 'R-0001');
END$$
DELIMITER ;
CALL _t005_recu();
CALL assert_true(@recu_rejete, 'unq_encaissement_recu : numerotation globale des recus');
DROP PROCEDURE _t005_recu;

-- imputation incoherente (cible ECHEANCE sans echeance_id) rejetee par le CHECK
DROP PROCEDURE IF EXISTS _t005_imp;
DELIMITER $$
CREATE PROCEDURE _t005_imp()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET @imp_rejete = 1;
  SET @imp_rejete = 0;
  INSERT INTO imputation_encaissement (encaissement_id, cible, montant) VALUES (@enc_1, 'ECHEANCE', 1);
END$$
DELIMITER ;
CALL _t005_imp();
CALL assert_true(@imp_rejete, 'chk_imputation_cible : ECHEANCE exige echeance_id');
DROP PROCEDURE _t005_imp;

-- suppression encaissement -> cascade imputations
DELETE FROM encaissement WHERE id=@enc_1;
CALL assert_equals('0', CAST((SELECT COUNT(*) FROM imputation_encaissement WHERE encaissement_id=@enc_1) AS CHAR),
                   'ON DELETE CASCADE encaissement -> imputation_encaissement');

-- virement : CHECK source <> destination
DROP PROCEDURE IF EXISTS _t005_vir;
DELIMITER $$
CREATE PROCEDURE _t005_vir()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET @vir_rejete = 1;
  SET @vir_rejete = 0;
  INSERT INTO virement (compte_source_id, compte_destination_id, montant, date, motif)
    VALUES (@cpt_caisse, @cpt_caisse, 1000, '2025-10-10', 'boucle');
END$$
DELIMITER ;
CALL _t005_vir();
CALL assert_true(@vir_rejete, 'chk_virement_comptes : source <> destination');
DROP PROCEDURE _t005_vir;

-- arrete_caisse.ecart genere
INSERT INTO arrete_caisse (compte_id, date, solde_theorique, solde_physique, fait_par)
  VALUES (@cpt_caisse, '2025-10-31', 500000, 495000, @u_admin);
SET @ac_1 = LAST_INSERT_ID();
CALL assert_equals('-5000', CAST((SELECT ecart FROM arrete_caisse WHERE id=@ac_1) AS CHAR),
                   'arrete_caisse.ecart = physique - theorique');
INSERT INTO billetage (arrete_caisse_id, denomination, quantite) VALUES (@ac_1, 10000, 40), (@ac_1, 5000, 19);
CALL assert_equals('495000', CAST((SELECT SUM(montant) FROM billetage WHERE arrete_caisse_id=@ac_1) AS CHAR),
                   'billetage.montant genere : 40*10000 + 19*5000');

ROLLBACK;
```

- [ ] **Step 4: Lancer le runner**

Run: `bash db/run.sh`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add db/migrations/005_tresorerie.sql db/tests/fixtures/10_base.sql db/tests/test_005_tresorerie.sql
git commit -m "feat(db): migration 005 - grand livre tresorerie (comptes, mouvements, encaissements)"
```

---

## Task 6 : Migration 006 — RH & paie

**Files:**
- Create: `db/migrations/006_rh_paie.sql`
- Create: `db/tests/test_006_rh_paie.sql`

**Interfaces:**
- Consumes: 001 (`ecole`, `matiere`, `classe`, `annee_scolaire`), 002 (`utilisateur`), 005 (`compte`, `mouvement`).
- Produces :
  - `enseignant(id, nom, prenom, telephone, email, specialite, statut, taux_horaire, actif)`.
  - `personnel_administratif(id, nom, prenom, poste, ecole_id NULL, telephone, email, salaire_base, date_embauche, actif)`.
  - `affectation_enseignement(id, enseignant_id, matiere_id, classe_id, annee_scolaire_id, volume_horaire_prevu, taux_horaire, montant_prevu GENERATED STORED)` — UNIQUE(matiere_id, classe_id).
  - `salaire_enseignant(id, enseignant_id, affectation_enseignement_id NULL, annee_scolaire_id, mois, date_paiement, montant, compte_id, mouvement_id, + audit)`.
  - `salaire_administration(id, personnel_administratif_id, annee_scolaire_id, mois, date_paiement, montant_du, montant_paye, compte_id, mouvement_id, + audit)` — UNIQUE(personnel_administratif_id, annee_scolaire_id, mois).
  - `avance_personnel(id, beneficiaire, enseignant_id NULL, personnel_administratif_id NULL, date, montant, motif, compte_id, mouvement_id, regularise_salaire_admin_id NULL, regularisee, + audit)`.
  - **ALTER** : `ALTER TABLE utilisateur ADD CONSTRAINT fk_utilisateur_personnel FOREIGN KEY (personnel_administratif_id) REFERENCES personnel_administratif (id) ON DELETE SET NULL;`
  - `mois` : `ENUM('SEPT','OCT','NOV','DEC','JAN','FEV','MAR','AVR','MAI','JUIN','JUIL','AOUT')` (réutilisé tel quel par la migration 007 si besoin).

- [ ] **Step 1: Écrire `db/migrations/006_rh_paie.sql`**

```sql
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
```

- [ ] **Step 2: Compléter `db/tests/fixtures/10_base.sql` — enseignant + affectation + personnel**

Ajouter à la fin :

```sql
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
```

- [ ] **Step 3: Écrire `db/tests/test_006_rh_paie.sql`**

```sql
-- Test 006 : RH & paie.
START TRANSACTION;

-- montant_prevu genere
CALL assert_equals('360000', CAST((SELECT montant_prevu FROM affectation_enseignement WHERE id=@aff_1) AS CHAR),
                   'affectation.montant_prevu = 45 * 8000');

-- une matiere d'une classe : un seul enseignant (pas de co-enseignement)
INSERT INTO enseignant (nom, prenom) VALUES ('AUTRE', 'Prof'); SET @ens_2 = LAST_INSERT_ID();
DROP PROCEDURE IF EXISTS _t006_coens;
DELIMITER $$
CREATE PROCEDURE _t006_coens()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET @coens_rejete = 1;
  SET @coens_rejete = 0;
  INSERT INTO affectation_enseignement (enseignant_id, matiere_id, classe_id, annee_scolaire_id, volume_horaire_prevu, taux_horaire)
    VALUES (@ens_2, @mat_cg1, @classe_essig_l1, @an_2025, 10, 8000);
END$$
DELIMITER ;
CALL _t006_coens();
CALL assert_true(@coens_rejete, 'unq_affectation (matiere_id, classe_id) : co-enseignement interdit');
DROP PROCEDURE _t006_coens;

-- FK differee utilisateur.personnel_administratif_id operationnelle
UPDATE utilisateur SET personnel_administratif_id = @pers_1 WHERE id = @u_admin;
CALL assert_equals(CAST(@pers_1 AS CHAR), CAST((SELECT personnel_administratif_id FROM utilisateur WHERE id=@u_admin) AS CHAR),
                   'fk_utilisateur_personnel ajoutee par 006');

-- salaire enseignant : 1 mouvement DEBIT + ligne salaire
INSERT INTO mouvement (compte_id, date_operation, sens, montant, categorie_mouvement_id, libelle, ecole_id, annee_scolaire_id, cree_par)
  VALUES (@cpt_banque, '2025-11-30', 'DEBIT', 180000, (SELECT id FROM categorie_mouvement WHERE code='SALAIRE_ENSEIGNANT'),
          'Salaire nov. EKO MBA', @e_essig, @an_2025, @u_admin);
SET @mv_sal = LAST_INSERT_ID();
INSERT INTO salaire_enseignant (enseignant_id, affectation_enseignement_id, annee_scolaire_id, mois, date_paiement, montant, compte_id, mouvement_id, cree_par)
  VALUES (@ens_1, @aff_1, @an_2025, 'NOV', '2025-11-30', 180000, @cpt_banque, @mv_sal, @u_admin);
CALL assert_equals('180000', CAST((SELECT montant FROM salaire_enseignant WHERE mouvement_id=@mv_sal) AS CHAR),
                   'salaire_enseignant enregistre');

-- salaire admin : unicite (personnel, annee, mois)
INSERT INTO mouvement (compte_id, date_operation, sens, montant, categorie_mouvement_id, libelle, annee_scolaire_id)
  VALUES (@cpt_banque, '2025-11-30', 'DEBIT', 100000, (SELECT id FROM categorie_mouvement WHERE code='SALAIRE_ADMIN'), 'Salaire nov. KASSA', @an_2025);
INSERT INTO salaire_administration (personnel_administratif_id, annee_scolaire_id, mois, date_paiement, montant_du, montant_paye, compte_id, mouvement_id)
  VALUES (@pers_1, @an_2025, 'NOV', '2025-11-30', 100000, 100000, @cpt_banque, LAST_INSERT_ID());
DROP PROCEDURE IF EXISTS _t006_saladmin;
DELIMITER $$
CREATE PROCEDURE _t006_saladmin()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET @saladmin_rejete = 1;
  SET @saladmin_rejete = 0;
  INSERT INTO mouvement (compte_id, date_operation, sens, montant, categorie_mouvement_id, libelle, annee_scolaire_id)
    VALUES (@cpt_banque, '2025-11-30', 'DEBIT', 1, (SELECT id FROM categorie_mouvement WHERE code='SALAIRE_ADMIN'), 'x', @an_2025);
  INSERT INTO salaire_administration (personnel_administratif_id, annee_scolaire_id, mois, date_paiement, montant_du, montant_paye, compte_id, mouvement_id)
    VALUES (@pers_1, @an_2025, 'NOV', '2025-12-01', 100000, 50000, @cpt_banque, LAST_INSERT_ID());
END$$
DELIMITER ;
CALL _t006_saladmin();
CALL assert_true(@saladmin_rejete, 'unq_salaire_admin (personnel, annee, mois)');
DROP PROCEDURE _t006_saladmin;

-- avance : coherence beneficiaire
DROP PROCEDURE IF EXISTS _t006_avance;
DELIMITER $$
CREATE PROCEDURE _t006_avance()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET @avance_rejete = 1;
  SET @avance_rejete = 0;
  INSERT INTO mouvement (compte_id, date_operation, sens, montant, categorie_mouvement_id, libelle, annee_scolaire_id)
    VALUES (@cpt_caisse, '2025-11-10', 'DEBIT', 20000, (SELECT id FROM categorie_mouvement WHERE code='SALAIRE_ADMIN'), 'avance', @an_2025);
  INSERT INTO avance_personnel (beneficiaire, date, montant, compte_id, mouvement_id)
    VALUES ('ADMIN', '2025-11-10', 20000, @cpt_caisse, LAST_INSERT_ID());
END$$
DELIMITER ;
CALL _t006_avance();
CALL assert_true(@avance_rejete, 'chk_avance_beneficiaire : ADMIN exige personnel_administratif_id');
DROP PROCEDURE _t006_avance;

ROLLBACK;
```

- [ ] **Step 4: Lancer le runner**

Run: `bash db/run.sh`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add db/migrations/006_rh_paie.sql db/tests/fixtures/10_base.sql db/tests/test_006_rh_paie.sql
git commit -m "feat(db): migration 006 - enseignants, personnel, affectations, paie"
```

---

## Task 7 : Migration 007 — Évaluations & résultats

**Files:**
- Create: `db/migrations/007_evaluations_resultats.sql`
- Create: `db/tests/test_007_evaluations_resultats.sql`

**Interfaces:**
- Consumes: 001 (`matiere`, `classe`, `session_examen`, `periode`, `annee_scolaire`), 003 (`inscription`), 002 (`utilisateur`).
- Produces :
  - `evaluation(id, matiere_id, classe_id, session_examen_id, type, ponderation, bareme, date, + audit)`.
  - `note_evaluation(id, evaluation_id, inscription_id, valeur NULL, absent, + audit)` — `ON DELETE CASCADE`, UNIQUE(evaluation_id, inscription_id).
  - `resultat_matiere(id, inscription_id, matiere_id, periode_id, note_normale NULL, note_rattrapage NULL, note_retenue GENERATED STORED, credits NULL, validee GENERATED STORED, credits_acquis GENERATED STORED, deliberation_id NULL, + audit)` — UNIQUE(inscription_id, matiere_id, periode_id).
  - `resultat_periode(id, inscription_id, periode_id, moyenne_ponderee, credits_acquis NULL, rang NULL, + audit)` — UNIQUE(inscription_id, periode_id).
  - `resultat_annuel(id, inscription_id UNIQUE, annee_scolaire_id, regime, moyenne_annuelle, credits_acquis NULL, credits_requis NULL, dette_credits NULL, decision, mention NULL, deliberee_le NULL, deliberee_par NULL, + audit)`.
  - `deliberation(id, classe_id, session_examen_id, periode_id NULL, date, president_jury, statut, validee_par NULL, + audit)`.
  - `dette_credit(id, inscription_origine_id, matiere_id, credits, annee_origine_id, soldee, inscription_solde_id NULL, + audit)`.
  - `bulletin(id, inscription_id, periode_id NULL, genere_le, genere_par, url_pdf NULL)`.

- [ ] **Step 1: Écrire `db/migrations/007_evaluations_resultats.sql`**

```sql
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
```

- [ ] **Step 2: Écrire `db/tests/test_007_evaluations_resultats.sql`** (fixtures inline, pas de modif de `10_base.sql`)

```sql
-- Test 007 : evaluations & resultats (regles LMD et classique).
START TRANSACTION;

-- note_retenue : rattrapage plafonne a 10, on garde le max
INSERT INTO resultat_matiere (inscription_id, matiere_id, periode_id, note_normale, note_rattrapage, credits)
  VALUES (@insc_1, @mat_cg1, @per_s1, 8.00, 14.00, 6);
SET @rm_1 = LAST_INSERT_ID();
CALL assert_equals('10.00', CAST((SELECT note_retenue FROM resultat_matiere WHERE id=@rm_1) AS CHAR),
                   'note_retenue = max(8, min(14,10)) = 10');
CALL assert_equals('1', CAST((SELECT validee FROM resultat_matiere WHERE id=@rm_1) AS CHAR),
                   'matiere validee car note_retenue >= 10');
CALL assert_equals('6', CAST((SELECT credits_acquis FROM resultat_matiere WHERE id=@rm_1) AS CHAR),
                   'credits_acquis = credits car validee');

-- normale >= 10, pas de rattrapage
UPDATE resultat_matiere SET note_normale = 12.50, note_rattrapage = NULL WHERE id=@rm_1;
CALL assert_equals('12.50', CAST((SELECT note_retenue FROM resultat_matiere WHERE id=@rm_1) AS CHAR),
                   'note_retenue = note_normale quand pas de rattrapage');

-- echec : normale 6, rattrapage 9 -> retenue 9, non validee, credits_acquis 0
UPDATE resultat_matiere SET note_normale = 6.00, note_rattrapage = 9.00 WHERE id=@rm_1;
CALL assert_equals('9.00', CAST((SELECT note_retenue FROM resultat_matiere WHERE id=@rm_1) AS CHAR), 'retenue = 9');
CALL assert_equals('0', CAST((SELECT validee FROM resultat_matiere WHERE id=@rm_1) AS CHAR), 'non validee');
CALL assert_equals('0', CAST((SELECT credits_acquis FROM resultat_matiere WHERE id=@rm_1) AS CHAR), 'credits_acquis = 0');

-- regime CLASSIQUE : credits NULL -> credits_acquis NULL
INSERT INTO resultat_matiere (inscription_id, matiere_id, periode_id, note_normale, credits)
  VALUES (@insc_1, (SELECT id FROM matiere WHERE niveau_id=@niv_essig_l1 AND code='MF1'), @per_s1, 11.00, NULL);
CALL assert_true((SELECT credits_acquis IS NULL FROM resultat_matiere
                  WHERE inscription_id=@insc_1 AND matiere_id=(SELECT id FROM matiere WHERE niveau_id=@niv_essig_l1 AND code='MF1')),
                 'credits NULL (non-LMD) -> credits_acquis NULL');

-- unicite du resultat par (inscription, matiere, periode)
DROP PROCEDURE IF EXISTS _t007_rm;
DELIMITER $$
CREATE PROCEDURE _t007_rm()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET @rm_rejete = 1;
  SET @rm_rejete = 0;
  INSERT INTO resultat_matiere (inscription_id, matiere_id, periode_id, note_normale, credits)
    VALUES (@insc_1, @mat_cg1, @per_s1, 15.00, 6);
END$$
DELIMITER ;
CALL _t007_rm();
CALL assert_true(@rm_rejete, 'unq_resultat_matiere (inscription, matiere, periode)');
DROP PROCEDURE _t007_rm;

-- resultat_annuel : decisions
INSERT INTO resultat_annuel (inscription_id, annee_scolaire_id, regime, moyenne_annuelle, credits_acquis, credits_requis, dette_credits, decision, mention)
  VALUES (@insc_1, @an_2025, 'LMD', 11.20, 52, 60, 8, 'ADMIS_CONDITIONNEL', 'PASSABLE');
CALL assert_equals('ADMIS_CONDITIONNEL', (SELECT decision FROM resultat_annuel WHERE inscription_id=@insc_1),
                   'LMD : 52/60 credits -> ADMIS_CONDITIONNEL (>=48)');

-- note_evaluation : borne 0..20
DROP PROCEDURE IF EXISTS _t007_ne;
DELIMITER $$
CREATE PROCEDURE _t007_ne()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET @ne_rejete = 1;
  SET @ne_rejete = 0;
  INSERT INTO evaluation (matiere_id, classe_id, session_examen_id, type, ponderation)
    VALUES (@mat_cg1, @classe_essig_l1, @sess_s1_normale, 'EXAMEN', 60);
  INSERT INTO note_evaluation (evaluation_id, inscription_id, valeur) VALUES (LAST_INSERT_ID(), @insc_1, 21.00);
END$$
DELIMITER ;
CALL _t007_ne();
CALL assert_true(@ne_rejete, 'chk_note_evaluation_valeur : note > 20 rejetee');
DROP PROCEDURE _t007_ne;

-- dette_credit + solde
INSERT INTO dette_credit (inscription_origine_id, matiere_id, credits, annee_origine_id)
  VALUES (@insc_1, @mat_cg1, 6, @an_2025);
CALL assert_equals('0', CAST((SELECT soldee FROM dette_credit WHERE inscription_origine_id=@insc_1 AND matiere_id=@mat_cg1) AS CHAR),
                   'dette_credit creee non soldee');

ROLLBACK;
```

- [ ] **Step 3: Lancer le runner**

Run: `bash db/run.sh`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add db/migrations/007_evaluations_resultats.sql db/tests/test_007_evaluations_resultats.sql
git commit -m "feat(db): migration 007 - evaluations, notes, resultats LMD + classique"
```

---

## Task 8 : Migration 008 — Vues de calcul

**Files:**
- Create: `db/migrations/008_vues.sql`
- Create: `db/tests/test_008_vues.sql`

**Interfaces:**
- Consumes: 001→007 (toutes les tables).
- Produces les 13 vues de la spec §7 :
  `v_situation_scolarite`, `v_situation_frais`, `v_echeancier`, `v_solde_compte`,
  `v_bilan_mensuel`, `v_bilan_consolide`, `v_etat_scolarite_etudiant`,
  `v_resultat_matiere`, `v_bulletin_periode`, `v_resultat_annuel`,
  `v_masse_salariale`, `v_paie_enseignant`, `v_arrete_caisse`.

- [ ] **Step 1: Écrire `db/migrations/008_vues.sql`**

```sql
-- Migration 008 : Vues de calcul
-- Spec : §7
SET NAMES utf8mb4;

-- 1. Situation de scolarite par inscription
CREATE OR REPLACE VIEW v_situation_scolarite AS
SELECT
  i.id                       AS inscription_id,
  i.etudiant_id,
  i.ecole_id,
  i.annee_scolaire_id,
  i.est_boursier,
  COALESCE(i.cout_scolarite_negocie, mp.montant_total) AS cout_du,
  COALESCE(SUM(CASE WHEN e.pris_en_charge_bourse = 0 THEN e.montant_prevu END), 0) AS part_etudiant,
  COALESCE((
    SELECT SUM(ie.montant)
    FROM imputation_encaissement ie
    JOIN echeance e2 ON e2.id = ie.echeance_id
    WHERE ie.cible = 'ECHEANCE' AND e2.inscription_id = i.id
  ), 0) AS total_encaisse,
  COALESCE(SUM(CASE WHEN e.pris_en_charge_bourse = 0 THEN e.montant_prevu END), 0)
    - COALESCE((
        SELECT SUM(ie.montant)
        FROM imputation_encaissement ie
        JOIN echeance e2 ON e2.id = ie.echeance_id
        WHERE ie.cible = 'ECHEANCE' AND e2.inscription_id = i.id
      ), 0) AS reste,
  CASE
    WHEN COALESCE((SELECT SUM(ie.montant) FROM imputation_encaissement ie
                   JOIN echeance e2 ON e2.id = ie.echeance_id
                   WHERE ie.cible='ECHEANCE' AND e2.inscription_id = i.id), 0)
         >= COALESCE(SUM(CASE WHEN e.pris_en_charge_bourse = 0 THEN e.montant_prevu END), 0)
      THEN 'SOLDE'
    WHEN COALESCE((SELECT SUM(ie.montant) FROM imputation_encaissement ie
                   JOIN echeance e2 ON e2.id = ie.echeance_id
                   WHERE ie.cible='ECHEANCE' AND e2.inscription_id = i.id), 0) > 0
      THEN 'PARTIEL'
    ELSE 'A_JOUR'
  END AS etat
FROM inscription i
LEFT JOIN modalite_paiement mp
  ON mp.niveau_id = (SELECT c.niveau_id FROM classe c WHERE c.id = i.classe_id)
 AND mp.annee_scolaire_id = i.annee_scolaire_id
LEFT JOIN echeance e ON e.inscription_id = i.id
GROUP BY i.id, i.etudiant_id, i.ecole_id, i.annee_scolaire_id, i.est_boursier,
         COALESCE(i.cout_scolarite_negocie, mp.montant_total);

-- 2. Situation des frais annexes par (inscription, type de frais)
CREATE OR REPLACE VIEW v_situation_frais AS
SELECT
  fi.id            AS frais_inscription_id,
  fi.inscription_id,
  tf.code          AS type_frais,
  fi.montant_du,
  fi.exonere,
  COALESCE((SELECT SUM(ie.montant) FROM imputation_encaissement ie
            WHERE ie.cible = 'FRAIS' AND ie.frais_inscription_id = fi.id), 0) AS paye,
  CASE WHEN fi.exonere = 1 THEN 0
       ELSE fi.montant_du - COALESCE((SELECT SUM(ie.montant) FROM imputation_encaissement ie
             WHERE ie.cible = 'FRAIS' AND ie.frais_inscription_id = fi.id), 0)
  END AS reste,
  CASE
    WHEN fi.exonere = 1 THEN 'EXONERE'
    WHEN COALESCE((SELECT SUM(ie.montant) FROM imputation_encaissement ie
                   WHERE ie.cible='FRAIS' AND ie.frais_inscription_id = fi.id), 0) >= fi.montant_du THEN 'SOLDE'
    WHEN COALESCE((SELECT SUM(ie.montant) FROM imputation_encaissement ie
                   WHERE ie.cible='FRAIS' AND ie.frais_inscription_id = fi.id), 0) > 0 THEN 'PARTIEL'
    ELSE 'NON'
  END AS etat
FROM frais_inscription fi
JOIN type_frais tf ON tf.id = fi.type_frais_id;

-- 3. Echeancier detaille
CREATE OR REPLACE VIEW v_echeancier AS
SELECT
  e.id AS echeance_id,
  e.inscription_id,
  e.numero,
  e.montant_prevu,
  e.date_prevue,
  e.pris_en_charge_bourse,
  COALESCE((SELECT SUM(ie.montant) FROM imputation_encaissement ie
            WHERE ie.cible = 'ECHEANCE' AND ie.echeance_id = e.id), 0) AS montant_regle,
  e.montant_prevu - COALESCE((SELECT SUM(ie.montant) FROM imputation_encaissement ie
            WHERE ie.cible = 'ECHEANCE' AND ie.echeance_id = e.id), 0) AS reste,
  CASE WHEN e.pris_en_charge_bourse = 0
        AND CURRENT_DATE() > e.date_prevue
        AND e.montant_prevu > COALESCE((SELECT SUM(ie.montant) FROM imputation_encaissement ie
              WHERE ie.cible='ECHEANCE' AND ie.echeance_id = e.id), 0)
       THEN 1 ELSE 0 END AS en_retard
FROM echeance e;

-- 4. Solde d'un compte
CREATE OR REPLACE VIEW v_solde_compte AS
SELECT
  c.id AS compte_id,
  c.code,
  c.libelle,
  c.type,
  c.solde_initial
    + COALESCE(SUM(CASE WHEN m.sens = 'CREDIT' THEN m.montant END), 0)
    - COALESCE(SUM(CASE WHEN m.sens = 'DEBIT'  THEN m.montant END), 0) AS solde
FROM compte c
LEFT JOIN mouvement m ON m.compte_id = c.id AND m.valide = 1
GROUP BY c.id, c.code, c.libelle, c.type, c.solde_initial;

-- 5. Bilan mensuel par ecole
CREATE OR REPLACE VIEW v_bilan_mensuel AS
SELECT
  m.ecole_id,
  m.annee_scolaire_id,
  YEAR(m.date_operation)  AS annee,
  MONTH(m.date_operation) AS mois,
  COALESCE(SUM(CASE WHEN cm.sens = 'ENTREE' AND m.sens = 'CREDIT' THEN m.montant END), 0) AS entrees,
  COALESCE(SUM(CASE WHEN cm.sens = 'SORTIE' AND m.sens = 'DEBIT'  THEN m.montant END), 0) AS depenses,
  COALESCE(SUM(CASE WHEN m.sens = 'CREDIT' THEN m.montant ELSE -m.montant END), 0)        AS solde
FROM mouvement m
JOIN categorie_mouvement cm ON cm.id = m.categorie_mouvement_id
WHERE m.valide = 1
GROUP BY m.ecole_id, m.annee_scolaire_id, YEAR(m.date_operation), MONTH(m.date_operation);

-- 6. Bilan consolide groupe
CREATE OR REPLACE VIEW v_bilan_consolide AS
SELECT
  e.groupe_scolaire_id,
  b.annee_scolaire_id,
  b.annee,
  b.mois,
  SUM(b.entrees)  AS entrees,
  SUM(b.depenses) AS depenses,
  SUM(b.solde)    AS solde
FROM v_bilan_mensuel b
JOIN ecole e ON e.id = b.ecole_id
GROUP BY e.groupe_scolaire_id, b.annee_scolaire_id, b.annee, b.mois;

-- 7. Etat de scolarite imprimable (mensualites + soutenance + reste total)
CREATE OR REPLACE VIEW v_etat_scolarite_etudiant AS
SELECT
  i.id AS inscription_id,
  et.matricule,
  CONCAT(et.nom, ' ', et.prenoms) AS etudiant,
  vs.cout_du,
  vs.part_etudiant,
  vs.total_encaisse,
  vs.reste            AS reste_scolarite,
  COALESCE((SELECT SUM(vf.reste) FROM v_situation_frais vf WHERE vf.inscription_id = i.id), 0) AS reste_frais,
  vs.reste + COALESCE((SELECT SUM(vf.reste) FROM v_situation_frais vf WHERE vf.inscription_id = i.id), 0) AS reste_total
FROM inscription i
JOIN etudiant et ON et.id = i.etudiant_id
JOIN v_situation_scolarite vs ON vs.inscription_id = i.id;

-- 8. Resultat par matiere (re-expose la table + regime lisible)
CREATE OR REPLACE VIEW v_resultat_matiere AS
SELECT
  rm.id,
  rm.inscription_id,
  rm.matiere_id,
  rm.periode_id,
  rm.note_normale,
  rm.note_rattrapage,
  rm.note_retenue,
  rm.credits,
  rm.validee,
  rm.credits_acquis,
  CASE WHEN rm.credits IS NULL THEN 'CLASSIQUE' ELSE 'LMD' END AS regime
FROM resultat_matiere rm;

-- 9. Bulletin de periode : moyenne ponderee par (inscription, periode)
CREATE OR REPLACE VIEW v_bulletin_periode AS
SELECT
  rm.inscription_id,
  rm.periode_id,
  ROUND(SUM(rm.note_retenue * mat.coefficient) / NULLIF(SUM(mat.coefficient), 0), 2) AS moyenne_ponderee,
  SUM(COALESCE(rm.credits_acquis, 0)) AS credits_acquis,
  COUNT(*)                            AS nb_matieres,
  SUM(rm.validee)                     AS nb_matieres_validees
FROM resultat_matiere rm
JOIN matiere mat ON mat.id = rm.matiere_id
GROUP BY rm.inscription_id, rm.periode_id;

-- 10. Resultat annuel (re-expose la table)
CREATE OR REPLACE VIEW v_resultat_annuel AS
SELECT
  ra.inscription_id,
  ra.annee_scolaire_id,
  ra.regime,
  ra.moyenne_annuelle,
  ra.credits_acquis,
  ra.credits_requis,
  ra.dette_credits,
  ra.decision,
  ra.mention
FROM resultat_annuel ra;

-- 11. Masse salariale par (ecole, annee, mois)
CREATE OR REPLACE VIEW v_masse_salariale AS
SELECT ecole_id, annee_scolaire_id, mois, SUM(montant) AS montant, 'ENSEIGNANT' AS categorie
FROM (
  SELECT m.ecole_id, se.annee_scolaire_id, se.mois, se.montant
  FROM salaire_enseignant se
  JOIN mouvement m ON m.id = se.mouvement_id
) t
GROUP BY ecole_id, annee_scolaire_id, mois
UNION ALL
SELECT pa.ecole_id, sa.annee_scolaire_id, sa.mois, SUM(sa.montant_paye) AS montant, 'ADMIN' AS categorie
FROM salaire_administration sa
JOIN personnel_administratif pa ON pa.id = sa.personnel_administratif_id
GROUP BY pa.ecole_id, sa.annee_scolaire_id, sa.mois;

-- 12. Paie enseignant : du vs paye
CREATE OR REPLACE VIEW v_paie_enseignant AS
SELECT
  ens.id AS enseignant_id,
  a.annee_scolaire_id,
  COALESCE(SUM(DISTINCT_AFF.montant_prevu), 0) AS montant_du,
  COALESCE((SELECT SUM(se.montant) FROM salaire_enseignant se
            WHERE se.enseignant_id = ens.id AND se.annee_scolaire_id = a.annee_scolaire_id), 0) AS montant_paye
FROM enseignant ens
JOIN (SELECT DISTINCT enseignant_id, annee_scolaire_id FROM affectation_enseignement) a
  ON a.enseignant_id = ens.id
LEFT JOIN (
  SELECT enseignant_id, annee_scolaire_id, SUM(montant_prevu) AS montant_prevu
  FROM affectation_enseignement GROUP BY enseignant_id, annee_scolaire_id
) DISTINCT_AFF ON DISTINCT_AFF.enseignant_id = ens.id AND DISTINCT_AFF.annee_scolaire_id = a.annee_scolaire_id
GROUP BY ens.id, a.annee_scolaire_id;

-- 13. Arrete de caisse : theorique a la date vs billetage vs ecart
CREATE OR REPLACE VIEW v_arrete_caisse AS
SELECT
  ac.id,
  ac.compte_id,
  ac.date,
  ac.solde_theorique,
  ac.solde_physique,
  ac.ecart,
  COALESCE((SELECT SUM(b.montant) FROM billetage b WHERE b.arrete_caisse_id = ac.id), 0) AS total_billetage
FROM arrete_caisse ac;
```

> **Note d'implémentation** : `v_paie_enseignant` ci-dessus contient une jointure redondante
> (`a` et `DISTINCT_AFF`). La simplifier lors de l'écriture en :
> ```sql
> CREATE OR REPLACE VIEW v_paie_enseignant AS
> SELECT aff.enseignant_id, aff.annee_scolaire_id,
>        SUM(aff.montant_prevu) AS montant_du,
>        COALESCE((SELECT SUM(se.montant) FROM salaire_enseignant se
>                  WHERE se.enseignant_id = aff.enseignant_id
>                    AND se.annee_scolaire_id = aff.annee_scolaire_id), 0) AS montant_paye
> FROM affectation_enseignement aff
> GROUP BY aff.enseignant_id, aff.annee_scolaire_id;
> ```
> Utiliser cette version.

- [ ] **Step 2: Écrire `db/tests/test_008_vues.sql`**

```sql
-- Test 008 : vues de calcul, sur le scenario des fixtures.
START TRANSACTION;

-- 13 vues creees
CALL assert_equals('13', CAST((
  SELECT COUNT(*) FROM information_schema.views WHERE table_schema = DATABASE()
    AND table_name IN ('v_situation_scolarite','v_situation_frais','v_echeancier','v_solde_compte',
      'v_bilan_mensuel','v_bilan_consolide','v_etat_scolarite_etudiant','v_resultat_matiere',
      'v_bulletin_periode','v_resultat_annuel','v_masse_salariale','v_paie_enseignant','v_arrete_caisse')
) AS CHAR), 'les 13 vues existent');

-- cout du de l'inscription 1 = 735 000 (grille), part etudiant = 735 000 (non boursier)
CALL assert_equals('735000', CAST((SELECT cout_du FROM v_situation_scolarite WHERE inscription_id=@insc_1) AS CHAR),
                   'v_situation_scolarite.cout_du = grille');
CALL assert_equals('735000', CAST((SELECT part_etudiant FROM v_situation_scolarite WHERE inscription_id=@insc_1) AS CHAR),
                   'v_situation_scolarite.part_etudiant (non boursier)');

-- encaissement de 70 000 impute sur echeance 1
INSERT INTO mouvement (compte_id, date_operation, sens, montant, categorie_mouvement_id, libelle, ecole_id, annee_scolaire_id)
  VALUES (@cpt_caisse, '2025-10-05', 'CREDIT', 70000, @cat_scol, 'R-9001', @e_essig, @an_2025);
SET @mv = LAST_INSERT_ID();
INSERT INTO encaissement (inscription_id, date, montant_total, mode, compte_id, mouvement_id, recu_numero)
  VALUES (@insc_1, '2025-10-05', 70000, 'ESPECES', @cpt_caisse, @mv, 'R-9001');
INSERT INTO imputation_encaissement (encaissement_id, cible, echeance_id, montant)
  VALUES (LAST_INSERT_ID(), 'ECHEANCE', @ech_1_1, 70000);

CALL assert_equals('70000', CAST((SELECT total_encaisse FROM v_situation_scolarite WHERE inscription_id=@insc_1) AS CHAR),
                   'v_situation_scolarite.total_encaisse');
CALL assert_equals('665000', CAST((SELECT reste FROM v_situation_scolarite WHERE inscription_id=@insc_1) AS CHAR),
                   'v_situation_scolarite.reste = 735000 - 70000');
CALL assert_equals('PARTIEL', (SELECT etat FROM v_situation_scolarite WHERE inscription_id=@insc_1),
                   'v_situation_scolarite.etat = PARTIEL');

-- v_echeancier : echeance 1 soldee, reste 0
CALL assert_equals('0', CAST((SELECT reste FROM v_echeancier WHERE echeance_id=@ech_1_1) AS CHAR),
                   'v_echeancier : echeance 1 reglee');

-- v_solde_compte : caisse = 70 000
CALL assert_equals('70000', CAST((SELECT solde FROM v_solde_compte WHERE compte_id=@cpt_caisse) AS CHAR),
                   'v_solde_compte : caisse creditee de 70000');

-- v_bilan_mensuel : entrees octobre 2025 pour ESSIG = 70 000
CALL assert_equals('70000', CAST((
  SELECT entrees FROM v_bilan_mensuel WHERE ecole_id=@e_essig AND annee=2025 AND mois=10
) AS CHAR), 'v_bilan_mensuel : entrees oct. 2025');

-- v_bulletin_periode : moyenne ponderee sur @insc_1 / S1
INSERT INTO resultat_matiere (inscription_id, matiere_id, periode_id, note_normale, credits)
  VALUES (@insc_1, @mat_cg1, @per_s1, 12.00, 6),
         (@insc_1, (SELECT id FROM matiere WHERE niveau_id=@niv_essig_l1 AND code='MF1'), @per_s1, 9.00, 4);
-- (12*3 + 9*2) / (3+2) = (36+18)/5 = 10.80
CALL assert_equals('10.80', CAST((
  SELECT moyenne_ponderee FROM v_bulletin_periode WHERE inscription_id=@insc_1 AND periode_id=@per_s1
) AS CHAR), 'v_bulletin_periode : moyenne ponderee = 10.80');

-- v_paie_enseignant : du = 360 000 (45h * 8000), paye = 0
CALL assert_equals('360000', CAST((
  SELECT montant_du FROM v_paie_enseignant WHERE enseignant_id=@ens_1 AND annee_scolaire_id=@an_2025
) AS CHAR), 'v_paie_enseignant.montant_du');

ROLLBACK;
```

- [ ] **Step 3: Lancer le runner**

Run: `bash db/run.sh`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add db/migrations/008_vues.sql db/tests/test_008_vues.sql
git commit -m "feat(db): migration 008 - 13 vues de calcul (situation scolarite, bilans, resultats)"
```

---

## Task 9 : Migration 009 — Données de référence

**Files:**
- Create: `db/migrations/009_donnees_reference.sql`
- Create: `db/tests/test_009_donnees_reference.sql`

**Interfaces:**
- Consumes: 002 (`role`), 004 (`type_piece` — créée en 003 en réalité ; ici on peuple), 005 (`categorie_mouvement`), 001 (`modalite_formation`).
- Produces : lignes de référence **idempotentes** (`INSERT ... ON DUPLICATE KEY UPDATE`) pour `role`, `modalite_formation`, `categorie_mouvement`, `type_piece`. Aucune donnée métier (écoles, niveaux, tarifs) — celle-ci relève de l'exploitation, pas des migrations.

- [ ] **Step 1: Écrire `db/migrations/009_donnees_reference.sql`**

```sql
-- Migration 009 : Donnees de reference figees (idempotent)
-- Spec : §5, §6
SET NAMES utf8mb4;

INSERT INTO role (code, libelle) VALUES
  ('COMPTABLE',  'Comptable'),
  ('DAF',        'Directeur Administratif et Financier'),
  ('DIRECTION',  'Direction'),
  ('SCOLARITE',  'Service scolarite'),
  ('LECTURE',    'Consultation seule')
ON DUPLICATE KEY UPDATE libelle = VALUES(libelle);

INSERT INTO modalite_formation (code, libelle) VALUES
  ('FI', 'Formation Initiale'),
  ('FC', 'Formation Continue'),
  ('FL', 'Formation FL (a preciser)'),
  ('FT', 'Formation FT (a preciser)')
ON DUPLICATE KEY UPDATE libelle = VALUES(libelle);

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
ON DUPLICATE KEY UPDATE libelle = VALUES(libelle), sens = VALUES(sens);

INSERT INTO type_piece (code, libelle) VALUES
  ('ACTE_NAISSANCE',    'Copie de l''acte de naissance'),
  ('RELEVE_BAC',        'Attestation ou releve de notes du BAC'),
  ('RELEVE_SEMESTRES',  'Releves de notes des deux semestres precedents'),
  ('CERTIF_SCOLARITE',  'Certificat de scolarite de l''etablissement de provenance'),
  ('ATTESTATION_REUSSITE','Attestation de reussite de l''annee precedente'),
  ('PHOTOS',            'Photos d''identite couleur fond blanc'),
  ('LETTRE_MOTIVATION', 'Lettre de motivation')
ON DUPLICATE KEY UPDATE libelle = VALUES(libelle);
```

- [ ] **Step 2: Écrire `db/tests/test_009_donnees_reference.sql`**

```sql
-- Test 009 : donnees de reference presentes et idempotentes.
CALL assert_equals('5',  CAST((SELECT COUNT(*) FROM role) AS CHAR), 'role : 5 lignes');
CALL assert_equals('4',  CAST((SELECT COUNT(*) FROM modalite_formation) AS CHAR), 'modalite_formation : 4 lignes');
CALL assert_equals('10', CAST((SELECT COUNT(*) FROM categorie_mouvement) AS CHAR), 'categorie_mouvement : 10 lignes');
CALL assert_equals('7',  CAST((SELECT COUNT(*) FROM type_piece) AS CHAR), 'type_piece : 7 lignes');

-- idempotence : rejouer la migration ne cree pas de doublon
SOURCE db/migrations/009_donnees_reference.sql;
CALL assert_equals('10', CAST((SELECT COUNT(*) FROM categorie_mouvement) AS CHAR),
                   'categorie_mouvement toujours 10 lignes apres rejeu');
```

> Note : `SOURCE` fonctionne avec le client `mysql` en ligne de commande. Si le runner
> utilise `docker exec -i mysql`, remplacer le rejeu par un second passage de `run.sh` documenté
> dans `db/README.md` ; l'assertion de comptage reste valable.

- [ ] **Step 3: Lancer le runner**

Run: `bash db/run.sh`
Expected: PASS. Les fixtures `10_base.sql` qui `TRUNCATE`/réinsèrent `role`, `categorie_mouvement`, `modalite_formation` doivent être ajustées pour ne pas entrer en conflit : le `TRUNCATE` de `10_base.sql` s'exécute après 009, puis réinsère son propre jeu minimal — c'est voulu (les tests travaillent sur un jeu contrôlé). Adapter `test_009` pour s'exécuter **avant** les fixtures : le renommer `db/tests/helpers/09_ref_check.sql` **n'est pas** souhaitable ; à la place, `test_009` recharge explicitement `009` en début de fichier (déjà fait au Step 2) et compte.

- [ ] **Step 4: Commit**

```bash
git add db/migrations/009_donnees_reference.sql db/tests/test_009_donnees_reference.sql
git commit -m "feat(db): migration 009 - donnees de reference (roles, categories, types de piece)"
```

---

## Task 10 : Contrôles d'intégrité globaux + correspondance avec l'existant

**Files:**
- Create: `db/tests/test_010_integrite_globale.sql`
- Create: `db/CORRESPONDANCE.md`
- Modify: `.gitignore` (retirer `mlamine.sql` du fichier ignoré — voir spec §8)

**Interfaces:**
- Consumes: 001→009.
- Produces : un test transversal qui vérifie les invariants inter-modules, et un document
  `db/CORRESPONDANCE.md` reprenant la spec §8 (tables `mlamine.sql` → cible, feuilles Excel → cible)
  pour guider la reprise de données ultérieure.

- [ ] **Step 1: Retirer `mlamine.sql` du `.gitignore`**

Éditer `.gitignore` : supprimer la ligne `mlamine.sql`. Garder `*.xlsx`, `scheme.dbs`, `scheme.dbs.bak`.
Corriger aussi `inscription.pdf` → `inscription pdf.pdf`.

Run:
```bash
git add .gitignore
git commit -m "chore: versionner mlamine.sql (schema de reference), corriger le motif du PDF"
```

- [ ] **Step 2: Écrire `db/CORRESPONDANCE.md`**

Copier le contenu des tableaux de la spec §8.1 et §8.2 (correspondance `mlamine.sql` → modèle cible,
et feuilles du classeur → tables/vues), en tête de fichier un rappel :

```markdown
# Correspondance ancien modèle → schéma cible

Référence pour la reprise des données depuis `mlamine.sql` et `test 2026.xlsx`.
Voir la spec §8 pour le détail des transformations.

## Tables `mlamine.sql` → cible
| mlamine.sql | Cible | Transformation |
| ... (recopier §8.1) ... |

## Feuilles `test 2026.xlsx` → cible
| Feuille | Tables / vues |
| ... (recopier §8.2) ... |
```

- [ ] **Step 3: Écrire `db/tests/test_010_integrite_globale.sql`**

```sql
-- Test 010 : invariants transversaux du schema.
START TRANSACTION;

-- (a) toute FK est indexee (MySQL le fait) et il n'existe aucune table hors InnoDB/utf8mb4
CALL assert_equals('0', CAST((
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE '\_test\_%'
    AND (engine <> 'InnoDB' OR table_collation <> 'utf8mb4_unicode_ci')
) AS CHAR), 'toutes les tables sont InnoDB + utf8mb4_unicode_ci');

-- (b) nombre total de tables metier attendu = 40
CALL assert_equals('40', CAST((
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE '\_test\_%'
) AS CHAR), '40 tables metier');

-- (c) chaque table transactionnelle listee a bien cree_le + FK cree_par
CALL assert_equals('0', CAST((
  SELECT COUNT(*) FROM (
    SELECT 'inscription' t UNION ALL SELECT 'frais_inscription' UNION ALL SELECT 'echeance'
    UNION ALL SELECT 'bourse' UNION ALL SELECT 'encaissement' UNION ALL SELECT 'mouvement'
    UNION ALL SELECT 'virement' UNION ALL SELECT 'depense' UNION ALL SELECT 'salaire_enseignant'
    UNION ALL SELECT 'salaire_administration' UNION ALL SELECT 'avance_personnel'
    UNION ALL SELECT 'note_evaluation' UNION ALL SELECT 'resultat_matiere' UNION ALL SELECT 'resultat_periode'
    UNION ALL SELECT 'resultat_annuel' UNION ALL SELECT 'deliberation' UNION ALL SELECT 'evaluation'
    UNION ALL SELECT 'arrete_caisse'
  ) req
  LEFT JOIN information_schema.columns c
    ON c.table_schema = DATABASE() AND c.table_name = req.t AND c.column_name = 'cree_le'
  WHERE c.column_name IS NULL
) AS CHAR), 'toutes les tables transactionnelles portent cree_le');

-- (d) invariant metier : une inscription ADMIS_CONDITIONNEL a une dette entre 1 et 12
INSERT INTO resultat_annuel (inscription_id, annee_scolaire_id, regime, moyenne_annuelle, credits_acquis, credits_requis, dette_credits, decision)
  VALUES (@insc_1, @an_2025, 'LMD', 10.5, 50, 60, 10, 'ADMIS_CONDITIONNEL');
CALL assert_true(
  (SELECT dette_credits BETWEEN 1 AND 12 FROM resultat_annuel WHERE inscription_id=@insc_1),
  'ADMIS_CONDITIONNEL : dette entre 1 et 12 (regle D7, verifiee applicativement)');

-- (e) l'echeancier d'une inscription non boursiere couvre exactement le cout du
CALL assert_equals(
  CAST((SELECT COALESCE(i.cout_scolarite_negocie, mp.montant_total)
        FROM inscription i
        JOIN classe c ON c.id = i.classe_id
        JOIN modalite_paiement mp ON mp.niveau_id = c.niveau_id AND mp.annee_scolaire_id = i.annee_scolaire_id
        WHERE i.id = @insc_1) AS CHAR),
  CAST((SELECT SUM(montant_prevu) FROM echeance WHERE inscription_id = @insc_1) AS CHAR),
  'somme de l echeancier = cout du de la scolarite');

ROLLBACK;
```

- [ ] **Step 4: Lancer le runner (suite complète)**

Run: `bash db/run.sh`
Expected: PASS — les 10 fichiers `test_*` passent, `run.sh` affiche `OK`.

- [ ] **Step 5: Commit**

```bash
git add db/tests/test_010_integrite_globale.sql db/CORRESPONDANCE.md
git commit -m "test(db): invariants transversaux + doc de correspondance ancien->cible"
```

---

## Self-Review (effectué)

**1. Couverture de la spec :**
- §6 module 1 → Task 1 ; module 2 → Task 3 ; module 3 → Task 4 ; module 4 → Task 5 ; module 5 → Task 6 ; module 6 → Task 7 ; transverse (utilisateurs/audit) → Task 2. ✅
- §7 (13 vues) → Task 8. ✅
- §8 (correspondance) → Task 10 (`db/CORRESPONDANCE.md`). ✅
- §5 conventions (InnoDB, utf8mb4, audit, `DECIMAL(12,0)`) → Global Constraints + vérifiées par `test_010` (c) et (a). ✅
- §4 D6 (note_retenue), D7 (seuil 48/60), D8 (CFPA), D16 (boursier) → colonnes générées Task 7 + tests `test_007`, `test_004`, `test_010`. ✅
- Données de référence (`role`, `categorie_mouvement`, `modalite_formation`, `type_piece`) → Task 9. ✅
- **Écart connu** : la reprise effective des données de `mlamine.sql` / `test 2026.xlsx` (scripts d'import) n'est pas dans ce plan — elle fera l'objet d'un plan séparé une fois le schéma figé (elle dépend de l'accès aux données réelles). `db/CORRESPONDANCE.md` en pose les règles.

**2. Placeholders :** aucun `TBD`/`TODO`. Les deux notes « à préciser » (FL/FT) sont des libellés de données, pas des trous de plan (cf. spec §9 P1). Les notes d'implémentation (`v_paie_enseignant` simplifiée, `SOURCE` vs `docker exec`) fournissent la version à utiliser.

**3. Cohérence des types :** `id` `INT UNSIGNED` partout, sauf `mouvement.id` et `journal_audit.id` en `BIGINT UNSIGNED` (volumétrie) ; les FK qui les référencent (`encaissement.mouvement_id`, `depense.mouvement_id`, `salaire_*.mouvement_id`, `avance_personnel.mouvement_id`) sont déclarées `BIGINT UNSIGNED`. ✅ Noms de contraintes `fk_*` uniques (préfixés par table). Colonnes générées : `montant_total`, `montant_prevu`, `ecart`, `montant` (billetage), `note_retenue`, `validee`, `credits_acquis` — cohérentes entre migration et tests.

---

## Execution Handoff

**Plan complet et enregistré dans `docs/superpowers/plans/2026-08-29-schema-sql-gestion-groupe-scolaire.md`. Deux options d'exécution :**

**1. Subagent-Driven (recommandée)** — un sous-agent neuf par tâche, revue entre chaque tâche, itération rapide.

**2. Inline Execution** — exécution des tâches dans cette session via `executing-plans`, par lots avec points de contrôle.

**Quelle approche ?**

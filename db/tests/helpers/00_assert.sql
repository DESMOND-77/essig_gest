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
  DECLARE v_msg TEXT;
  IF NOT (p_expected <=> p_actual) THEN
    INSERT INTO _test_log(label, ok, detail)
      VALUES (p_label, 0, CONCAT('attendu=[', IFNULL(p_expected,'NULL'), '] obtenu=[', IFNULL(p_actual,'NULL'), ']'));
    SET v_msg = CONCAT('ASSERT FAIL: ', p_label,
                       ' | attendu=[', IFNULL(p_expected,'NULL'),
                       '] obtenu=[', IFNULL(p_actual,'NULL'), ']');
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_msg;
  ELSE
    INSERT INTO _test_log(label, ok) VALUES (p_label, 1);
  END IF;
END$$

CREATE PROCEDURE assert_true(IN p_cond INT, IN p_label VARCHAR(255))
BEGIN
  DECLARE v_msg TEXT;
  IF p_cond IS NULL OR p_cond = 0 THEN
    INSERT INTO _test_log(label, ok, detail) VALUES (p_label, 0, CONCAT('cond=', IFNULL(p_cond,'NULL')));
    SET v_msg = CONCAT('ASSERT FAIL: ', p_label);
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_msg;
  ELSE
    INSERT INTO _test_log(label, ok) VALUES (p_label, 1);
  END IF;
END$$

DELIMITER ;

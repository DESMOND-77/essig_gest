-- Vérifie que le harnais d'assertions fonctionne.
CALL assert_equals('1', CAST(1 AS CHAR), 'smoke: 1 == 1');
CALL assert_true( (SELECT COUNT(*) FROM information_schema.tables
                   WHERE table_schema = DATABASE() AND table_name = '_test_log') , 'smoke: _test_log existe');

from core.exceptions import (
    CompteDesactiveException,
    JetonInvalideException,
    LimiteDebitDepasseeException,
    PermissionRefuseeException,
)


def test_statuts_et_codes():
    assert (CompteDesactiveException.status_code, CompteDesactiveException.default_code) == (
        403,
        "compte_desactive",
    )
    assert JetonInvalideException.status_code == 401
    assert JetonInvalideException.default_code == "jeton_invalide"
    assert PermissionRefuseeException.status_code == 403
    assert LimiteDebitDepasseeException.status_code == 429
    assert LimiteDebitDepasseeException.default_code == "limite_debit_depassee"


def test_message_par_defaut_est_francais():
    assert "désactivé" in str(CompteDesactiveException.default_detail)

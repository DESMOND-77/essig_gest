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
  MYSQL=(mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "${DB_USER:-root}")
  [ -n "${DB_PASS:-}" ] && MYSQL+=("-p$DB_PASS")
  "${MYSQL[@]}" -e "DROP DATABASE IF EXISTS \`$DB_NAME\`; CREATE DATABASE \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
  MYSQL+=("$DB_NAME")
else
  echo "Démarrage du conteneur $MYSQL_IMAGE ..."
  CID="$(docker run -d --rm -e MYSQL_ALLOW_EMPTY_PASSWORD=1 -e MYSQL_DATABASE="$DB_NAME" "$MYSQL_IMAGE" \
        --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci)"
  echo -n "Attente de MySQL "
  for _ in $(seq 1 90); do
    if docker exec "$CID" mysqladmin ping -h127.0.0.1 --silent >/dev/null 2>&1; then break; fi
    echo -n "."; sleep 2
  done
  echo " ok"
  MYSQL=(docker exec -i "$CID" mysql -uroot "$DB_NAME")
fi

run_sql() { echo ">> $1"; "${MYSQL[@]}" < "$1"; }

shopt -s nullglob

# 1. Migrations (triées), rejouées sur base fraîche.
for f in "$ROOT"/migrations/*.sql; do run_sql "$f"; done

# 2. Helpers d'assertions : appliqués UNE fois, directement, pour que les
#    procédures et la table _test_log persistent dans la base.
for f in "$ROOT"/tests/helpers/*.sql; do run_sql "$f"; done

# 3. Tests : chaque fichier est exécuté dans la MÊME invocation mysql que les
#    fixtures partagées (les variables de session des fixtures ne survivent pas
#    d'une invocation cliente à l'autre).
for f in "$ROOT"/tests/test_*.sql "$ROOT"/tests/smoke/*.sql; do
  echo ">> $f"
  cat "$ROOT"/tests/fixtures/*.sql "$f" | "${MYSQL[@]}"
done

echo "OK — tous les tests SQL sont passés."

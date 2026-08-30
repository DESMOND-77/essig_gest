#!/usr/bin/env sh
set -eu
# Sauvegarde chiffrée de la base + envoi hors-site.
# Prérequis hôte : age, rclone (remote "offsite" configuré).
# Variables attendues : AGE_RECIPIENT (clé publique age).
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="/tmp/mlamine-${STAMP}.sql.gz.age"
docker compose -f "$(dirname "$0")/docker-compose.yml" exec -T db \
  sh -c 'exec mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines "$MYSQL_DATABASE"' \
  | gzip | age -r "$AGE_RECIPIENT" -o "$OUT"
rclone copy "$OUT" offsite:mlamine-backups/
find /tmp -name 'mlamine-*.sql.gz.age' -mtime +2 -delete
echo "Sauvegarde $OUT poussée."

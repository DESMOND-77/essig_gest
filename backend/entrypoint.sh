#!/bin/sh
set -e
echo "==> Migrations..."
python manage.py migrate --noinput
echo "==> Fichiers statiques..."
python manage.py collectstatic --noinput
echo "==> Gunicorn..."
exec gunicorn config.wsgi:application \
    --bind "0.0.0.0:${PORT:-8000}" \
    --workers "${WEB_CONCURRENCY:-3}" \
    --worker-class sync \
    --timeout 60 \
    --access-logfile - --error-logfile -

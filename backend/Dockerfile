# --- Étage 1 : build des dépendances Python -------------------------------
FROM python:3.13-slim AS builder
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential default-libmysqlclient-dev pkg-config \
    && rm -rf /var/lib/apt/lists/*
# Sources réelles (vrais dossiers de paquets avec __init__.py) : `pip install .`
# résout ainsi la disposition « flat-layout » de setuptools sans bidouille.
# L'invalidation du cache de cet étage à chaque changement de source est sans
# conséquence : l'étage builder est jeté.
COPY . .
RUN pip install --no-cache-dir --prefix=/install .

# --- Étage 2 : image d'exécution -----------------------------------------
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 DJANGO_SETTINGS_MODULE=config.settings.prod
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
      libmariadb3 curl libpango-1.0-0 libpangocairo-1.0-0 libcairo2 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /install /usr/local
COPY . .
RUN chmod +x entrypoint.sh \
    && mkdir -p /app/logs /app/staticfiles /app/media \
    && useradd -m -u 1000 appuser \
    && chown -R appuser:appuser /app
USER appuser
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
    CMD curl -fsS -o /dev/null http://localhost:8000/api/v1/healthz/ || exit 1
ENTRYPOINT ["./entrypoint.sh"]

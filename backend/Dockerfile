# --- Étage 1 : build des dépendances Python -------------------------------
FROM python:3.13-slim AS builder
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential default-libmysqlclient-dev pkg-config \
    && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml .
# Arborescence minimale des paquets pour que `pip install .` (deps runtime
# uniquement, PAS [dev]) résolve la disposition « flat-layout » de setuptools.
RUN mkdir -p config comptes core && pip install --no-cache-dir --prefix=/install .

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

# Contexte de build = racine du dépôt (voir docker-compose.yml).
FROM node:22-slim AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM caddy:2
COPY --from=build /app/dist /srv
COPY infra/Caddyfile /etc/caddy/Caddyfile

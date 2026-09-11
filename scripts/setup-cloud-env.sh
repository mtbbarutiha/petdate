#!/usr/bin/env bash
# Idempotent bootstrap for the Cursor Cloud Agent dev environment.
# Runs the app in SQLite-only mode: Postgres/Redis/MinIO/Elasticsearch are all
# optional and left unconfigured so no Docker is required for local dev.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Installing workspace dependencies"
npm install

echo "==> Building @petdate/shared (required by api/bot which import its dist/)"
npm run build -w @petdate/shared

# Generate a Docker-free .env only when the developer has not created one.
# NOTE: we intentionally do NOT copy .env.example — it points REDIS_URL / S3 /
# Elasticsearch at docker-compose services that are not running here.
if [ ! -f .env ]; then
  echo "==> Writing local .env (SQLite mode, optional services disabled)"
  cat > .env <<'ENV'
# petdate — local development env (SQLite mode, optional services disabled)
NODE_ENV=development
WEB_URL=http://localhost:5180
API_URL=http://localhost:3001
PORT=3001

# Empty DATABASE_URL => SQLite is the source of truth (no Postgres needed).
DATABASE_URL=
DATABASE_PATH=./packages/api/data/petdate.db

# Left unset so the API degrades gracefully (no Docker services required):
#   REDIS_URL, S3/MinIO, Elasticsearch
REDIS_URL=
ELASTICSEARCH_URL=

# Admin panel password (used when no TELEGRAM_ADMIN_IDS are configured).
ADMIN_PASSWORD=petdate

# Return the web OTP code in the JSON response for local login testing.
WEB_OTP_DEV_ECHO=1

# The Telegram bot only runs with a real token from @BotFather.
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
ENV
else
  echo "==> .env already exists — leaving it untouched"
fi

echo "==> Cloud env setup complete"

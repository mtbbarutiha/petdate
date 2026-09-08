#!/usr/bin/env bash
# Telegram Bot API over IPv4 with short retries.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/lib/load-env.sh
source "$ROOT/scripts/lib/load-env.sh"
if [[ -f "$ROOT/.env" ]]; then load_env "$ROOT/.env"
elif [[ -f /opt/petdate/.env ]]; then load_env /opt/petdate/.env
fi
TOKEN="${TELEGRAM_BOT_TOKEN:-}"
[[ -n "$TOKEN" ]] || { echo "tg-api: TELEGRAM_BOT_TOKEN missing" >&2; exit 1; }
METHOD="${1:-}"
[[ -n "$METHOD" ]] || { echo "Usage: $0 <method> [json-body]" >&2; exit 1; }
BODY="${2:-}"
API_ROOT="${TELEGRAM_API_ROOT:-https://api.telegram.org}"
API_ROOT="${API_ROOT%/}"
URL="${API_ROOT}/bot${TOKEN}/${METHOD}"
MAX="${TELEGRAM_HTTP_RETRIES:-4}"
DELAY="${TELEGRAM_HTTP_RETRY_MS:-250}"
attempt=1
while [[ "$attempt" -le "$MAX" ]]; do
  set +e
  if [[ -n "$BODY" ]]; then
    RESP="$(curl -4 -sS --connect-timeout 8 --max-time 30 -X POST "$URL" -H 'Content-Type: application/json' -d "$BODY" 2>&1)"
    CODE=$?
  else
    RESP="$(curl -4 -sS --connect-timeout 8 --max-time 30 "$URL" 2>&1)"
    CODE=$?
  fi
  set -e
  if [[ "$CODE" -eq 0 ]] && echo "$RESP" | grep -q '"ok"'; then
    echo "$RESP"; exit 0
  fi
  if [[ "$attempt" -eq "$MAX" ]]; then
    echo "tg-api: failed after $MAX attempts (curl=$CODE): $RESP" >&2
    exit 1
  fi
  sleep_ms=$((DELAY * (1 << (attempt - 1))))
  # Cap per-retry sleep so ops never burn multi-minute loops (max ~2s)
  if [[ "$sleep_ms" -gt 2000 ]]; then sleep_ms=2000; fi
  sleep "$(awk -v ms="$sleep_ms" 'BEGIN{printf "%.3f", ms/1000}')"
  attempt=$((attempt + 1))
done

#!/usr/bin/env bash
# Print OK / MISSING / DEFAULT-RISK for production env names. NEVER print values.
# Usage: ./scripts/verify-prod-env.sh [/opt/petdate/.env]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${1:-}"

# shellcheck source=lib/load-env.sh
source "$ROOT/scripts/lib/load-env.sh"
if [[ -n "$ENV_FILE" ]]; then
  load_env "$ENV_FILE"
else
  load_env "$ROOT/.env" 2>/dev/null || load_env /opt/petdate/.env
fi

FAIL=0
ok=0
missing=0
risk=0

status() {
  local name="$1" state="$2"
  printf '%-22s %s\n' "$name" "$state"
  case "$state" in
    OK) ok=$((ok + 1)) ;;
    MISSING)
      missing=$((missing + 1))
      FAIL=1
      ;;
    DEFAULT-RISK)
      risk=$((risk + 1))
      FAIL=1
      ;;
  esac
}

# Present and non-empty? Never print the value.
is_set() {
  local v="${1:-}"
  [[ -n "$v" ]]
}

check_present() {
  local name="$1"
  local v="${!name:-}"
  if is_set "$v"; then
    status "$name" OK
  else
    status "$name" MISSING
  fi
}

# ADMIN_PASSWORD must be set and not the example literal.
if ! is_set "${ADMIN_PASSWORD:-}"; then
  status ADMIN_PASSWORD MISSING
elif [[ "$ADMIN_PASSWORD" == "petdate" ]]; then
  status ADMIN_PASSWORD DEFAULT-RISK
else
  status ADMIN_PASSWORD OK
fi

# ADMIN_SEED_PASSWORD: default demo password is a launch risk if seeds could run.
if ! is_set "${ADMIN_SEED_PASSWORD:-}"; then
  status ADMIN_SEED_PASSWORD MISSING
elif [[ "$ADMIN_SEED_PASSWORD" == "petdate-seed" ]]; then
  status ADMIN_SEED_PASSWORD DEFAULT-RISK
else
  status ADMIN_SEED_PASSWORD OK
fi

# Prod must keep webhook empty (polling) until a real HTTP listener exists.
if is_set "${BOT_WEBHOOK_URL:-}"; then
  status BOT_WEBHOOK_URL DEFAULT-RISK
else
  status BOT_WEBHOOK_URL OK
fi

check_present DATABASE_URL
check_present REDIS_URL
check_present TELEGRAM_BOT_TOKEN

check_present SMTP_HOST
check_present SMTP_FROM
check_present CANDOO_API_KEY
check_present CANDOO_SRC_NUMBERS
check_present S3_ENDPOINT
check_present S3_ACCESS_KEY
check_present S3_SECRET_KEY

echo "verify-prod-env: OK=$ok MISSING=$missing DEFAULT-RISK=$risk"
if [[ "$FAIL" -ne 0 ]]; then
  exit 1
fi
exit 0

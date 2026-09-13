#!/usr/bin/env bash
# Lightweight PetDate health monitor for the VPS (API + web + pm2 + disk).
# Prefers /api/health/ready (Postgres + Redis). Falls back to /api/health
# only when ready is missing (404) during rollout.
# Usage: ./scripts/monitor-health.sh
# Cron example (every 5 min):
#   */5 * * * * /opt/petdate/scripts/monitor-health.sh >> /var/log/petdate-health.log 2>&1

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_READY_URL="${PETDATE_HEALTH_READY:-http://127.0.0.1:3001/api/health/ready}"
API_LIVE_URL="${PETDATE_HEALTH_API:-http://127.0.0.1:3001/api/health}"
WEB_URL="${PETDATE_HEALTH_WEB:-http://127.0.0.1/}"
STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
FAIL=0

echo "[$STAMP] petdate health check"

check_http() {
  local name="$1" url="$2"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 "$url" || echo 000)"
  if [[ "$code" =~ ^2|3 ]]; then
    echo "  OK  $name ($code) $url"
  else
    echo "  BAD $name ($code) $url"
    FAIL=1
  fi
}

ready_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 "$API_READY_URL" || echo 000)"
if [[ "$ready_code" =~ ^2 ]]; then
  echo "  OK  api-ready ($ready_code) $API_READY_URL"
elif [[ "$ready_code" == "404" ]]; then
  echo "  WARN api-ready missing (404) — falling back to liveness"
  check_http "api-live" "$API_LIVE_URL"
else
  echo "  BAD api-ready ($ready_code) $API_READY_URL"
  FAIL=1
  check_http "api-live" "$API_LIVE_URL"
fi

check_http "web" "$WEB_URL"

if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe petdate-api >/dev/null 2>&1; then
    echo "  OK  pm2 petdate-api"
  else
    echo "  BAD pm2 petdate-api missing"
    FAIL=1
  fi
  if pm2 describe petdate-bot >/dev/null 2>&1; then
    echo "  OK  pm2 petdate-bot"
  else
    echo "  WARN pm2 petdate-bot missing"
  fi
else
  echo "  WARN pm2 not installed"
fi

DISK="$(df -P "$ROOT" | awk 'NR==2{print $5}' | tr -d '%')"
if [[ -n "$DISK" && "$DISK" -ge 90 ]]; then
  echo "  BAD disk ${DISK}% used"
  FAIL=1
elif [[ -n "$DISK" ]]; then
  echo "  OK  disk ${DISK}% used"
fi

if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -qx petdate-postgres; then
  echo "  OK  docker petdate-postgres"
elif [[ -f /opt/petdate/packages/api/data/petdate.db ]]; then
  echo "  OK  sqlite present"
else
  echo "  WARN neither petdate-postgres container nor default sqlite file"
fi

if [[ "$FAIL" -ne 0 ]]; then
  echo "[$STAMP] HEALTH_FAIL"
  exit 1
fi
echo "[$STAMP] HEALTH_OK"
exit 0

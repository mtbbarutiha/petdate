#!/usr/bin/env bash
# redis-cli via Docker when the host binary is missing (PetDate compose redis).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/lib/load-env.sh
source "$ROOT/scripts/lib/load-env.sh"
if [[ -f "$ROOT/.env" ]]; then load_env "$ROOT/.env" || true
elif [[ -f /opt/petdate/.env ]]; then load_env /opt/petdate/.env || true
fi
if command -v redis-cli >/dev/null 2>&1; then
  if [[ -n "${REDIS_URL:-}" ]]; then exec redis-cli -u "$REDIS_URL" "$@"; fi
  exec redis-cli "$@"
fi
command -v docker >/dev/null 2>&1 || { echo "redis-cli.sh: neither redis-cli nor docker available" >&2; exit 1; }
CID=""
for name in petdate-redis-1 petdate_redis_1 redis; do
  CID="$(docker ps -qf "name=${name}" 2>/dev/null | head -1 || true)"
  [[ -n "$CID" ]] && break
done
if [[ -z "$CID" ]]; then
  CID="$(docker ps --format '{{.ID}} {{.Names}}' | awk '/redis/ {print $1; exit}')"
fi
[[ -n "$CID" ]] || { echo "redis-cli.sh: no running redis container found" >&2; exit 1; }
exec docker exec -i "$CID" redis-cli "$@"

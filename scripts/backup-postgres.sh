#!/usr/bin/env bash
# Daily PostgreSQL dump for PetDate (docker compose service `postgres` / container petdate-postgres).
# Cron example (root):
#   15 3 * * * /opt/petdate/scripts/backup-postgres.sh >> /var/log/petdate-pg-backup.log 2>&1
#
# Never prints DATABASE_URL or passwords. Fails clearly if URL/container is missing.
set -euo pipefail

ROOT="${PETDATE_ROOT:-/opt/petdate}"
BACKUP_DIR="${PETDATE_PG_BACKUP_DIR:-/var/backups/petdate/postgres}"
KEEP_DAYS="${PETDATE_BACKUP_KEEP_DAYS:-14}"
COMPOSE_SERVICE="${PETDATE_PG_SERVICE:-postgres}"
CONTAINER="${PETDATE_PG_CONTAINER:-petdate-postgres}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="$BACKUP_DIR/petdate-$STAMP.sql.gz"
TMP="$DEST.partial"

log() { echo "backup-postgres: $*"; }

if [[ -f "$ROOT/scripts/lib/load-env.sh" ]]; then
  # shellcheck source=lib/load-env.sh
  source "$ROOT/scripts/lib/load-env.sh"
  load_env "$ROOT/.env" || true
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  log "DATABASE_URL missing — refuse dump (Postgres is production SoT)" >&2
  exit 1
fi

case "$DATABASE_URL" in
  postgres://*|postgresql://*) ;;
  *)
    log "DATABASE_URL is not a postgres URL" >&2
    exit 1
    ;;
esac

# User + database only — never echo the URL or password.
PG_USER="petdate"
PG_DB="petdate"
if command -v node >/dev/null 2>&1; then
  ident="$(
    node -e '
      const raw = process.env.DATABASE_URL || "";
      try {
        const u = new URL(raw);
        const user = decodeURIComponent(u.username || "petdate") || "petdate";
        const db = decodeURIComponent((u.pathname || "/petdate").replace(/^\//, "")) || "petdate";
        process.stdout.write(user + "\n" + db);
      } catch {
        process.exit(2);
      }
    ' 2>/dev/null || true
  )"
  if [[ -n "$ident" ]]; then
    PG_USER="$(printf '%s\n' "$ident" | sed -n '1p')"
    PG_DB="$(printf '%s\n' "$ident" | sed -n '2p')"
  fi
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose -f "$ROOT/docker-compose.yml" "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose -f "$ROOT/docker-compose.yml" "$@"
  else
    return 1
  fi
}

container_running() {
  docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$CONTAINER"
}

if ! command -v docker >/dev/null 2>&1; then
  log "docker not installed" >&2
  exit 1
fi

if ! container_running; then
  log "container $CONTAINER not running (compose service: $COMPOSE_SERVICE)" >&2
  exit 1
fi

dump_ok=0
# Local socket inside the official image — no password on argv / logs.
if compose exec -T "$COMPOSE_SERVICE" \
  pg_dump -U "$PG_USER" -d "$PG_DB" --no-owner --no-acl | gzip -c >"$TMP"; then
  dump_ok=1
elif docker exec "$CONTAINER" \
  pg_dump -U "$PG_USER" -d "$PG_DB" --no-owner --no-acl | gzip -c >"$TMP"; then
  dump_ok=1
fi

if [[ "$dump_ok" != "1" || ! -s "$TMP" ]]; then
  rm -f "$TMP"
  log "pg_dump failed (compose service or container missing / dump empty)" >&2
  exit 1
fi

mv -f "$TMP" "$DEST"
chmod 600 "$DEST"

find "$BACKUP_DIR" -type f -name 'petdate-*.sql.gz' -mtime +"$KEEP_DAYS" -delete 2>/dev/null || true

SIZE="$(du -h "$DEST" | awk '{print $1}')"
log "ok $DEST ($SIZE) retention=${KEEP_DAYS}d"

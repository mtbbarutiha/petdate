#!/usr/bin/env bash
# Daily PostgreSQL backup for PetDate (SoT). Prefer this over backup-sqlite.sh in production.
# Cron example (root):
#   15 2 * * * /opt/petdate/scripts/backup-postgres.sh >> /var/log/petdate-backup.log 2>&1
set -euo pipefail

ROOT="${PETDATE_ROOT:-/opt/petdate}"
BACKUP_DIR="${PETDATE_BACKUP_DIR:-/var/backups/petdate}"
KEEP_DAYS="${PETDATE_BACKUP_KEEP_DAYS:-14}"
CONTAINER="${PETDATE_POSTGRES_CONTAINER:-petdate-postgres}"
PGUSER="${POSTGRES_USER:-petdate}"
PGDB="${POSTGRES_DB:-petdate}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="$BACKUP_DIR/petdate-$STAMP.sql.gz"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "backup-postgres: container not running: $CONTAINER" >&2
  exit 1
fi

docker exec "$CONTAINER" pg_dump -U "$PGUSER" -d "$PGDB" --no-owner --no-acl \
  | gzip -c > "$DEST"
chmod 600 "$DEST"

# Keep pre-cutover SQLite snapshots; only prune dated pg dumps
find "$BACKUP_DIR" -type f -name 'petdate-*.sql.gz' -mtime +"$KEEP_DAYS" -delete 2>/dev/null || true

SIZE="$(du -h "$DEST" | awk '{print $1}')"
echo "backup-postgres: ok $DEST ($SIZE)"

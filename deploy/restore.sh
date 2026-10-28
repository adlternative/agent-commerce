#!/usr/bin/env bash
# Restore SQLite from a named backup created by deploy/backup.sh (ACP-38).
# Always writes a safety backup first; verifies /readyz (fallback /healthz) afterward.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-$(basename "$ROOT_DIR")}"
VOLUME_NAME="${BACKUP_VOLUME:-${PROJECT_NAME}_commerce-data}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/deploy/backups}"
DB_FILE="${BACKUP_DB_FILE:-commerce.sqlite}"
TOOLBOX_IMAGE="${BACKUP_TOOLBOX_IMAGE:-keinos/sqlite3:3.45.3}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.yml}"
HEALTH_URL="${RESTORE_HEALTH_URL:-http://127.0.0.1:8787/readyz}"
HEALTH_FALLBACK="${RESTORE_HEALTH_FALLBACK:-http://127.0.0.1:8787/healthz}"

usage() {
  echo "usage: $0 <backup-file>" >&2
  echo "  backup-file: path or basename under $BACKUP_DIR (e.g. commerce-20260101T000000Z.sqlite)" >&2
  exit 2
}

[[ $# -eq 1 ]] || usage
SRC="$1"
if [[ ! -f "$SRC" ]]; then
  if [[ -f "${BACKUP_DIR}/${SRC}" ]]; then
    SRC="${BACKUP_DIR}/${SRC}"
  else
    echo "restore.sh: backup not found: $1" >&2
    exit 1
  fi
fi

if [[ ! -s "$SRC" ]]; then
  echo "restore.sh: backup empty: $SRC" >&2
  exit 1
fi

if ! docker volume inspect "$VOLUME_NAME" >/dev/null 2>&1; then
  echo "restore.sh: volume not found: $VOLUME_NAME" >&2
  exit 1
fi

echo "restore.sh: safety backup before restore"
BACKUP_DIR="$BACKUP_DIR" BACKUP_VOLUME="$VOLUME_NAME" \
  BACKUP_RETAIN="${BACKUP_RETAIN:-7}" \
  "$ROOT_DIR/deploy/backup.sh"

echo "restore.sh: stopping api (compose)"
docker compose -f "$COMPOSE_FILE" stop api

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
echo "restore.sh: replacing /$DB_FILE from $SRC"

# Override ENTRYPOINT (sqlite3) so we can shell: copy file + integrity_check.
docker run --rm --entrypoint /bin/sh \
  -v "${VOLUME_NAME}:/data" \
  -v "${SRC}:/backup/restore.sqlite:ro" \
  "$TOOLBOX_IMAGE" \
  -c "rm -f /data/${DB_FILE} /data/${DB_FILE}-wal /data/${DB_FILE}-shm && cp /backup/restore.sqlite /data/${DB_FILE} && sqlite3 /data/${DB_FILE} 'PRAGMA integrity_check;'"

echo "restore.sh: starting api"
docker compose -f "$COMPOSE_FILE" start api

echo "restore.sh: waiting for health ($HEALTH_URL)"
ok=0
for _ in $(seq 1 30); do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1 || curl -fsS "$HEALTH_FALLBACK" >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 1
done

if [[ "$ok" -ne 1 ]]; then
  echo "restore.sh: post-restore health check failed ($HEALTH_URL / $HEALTH_FALLBACK)" >&2
  exit 1
fi

echo "restore.sh: ok (safety stamp $STAMP)"

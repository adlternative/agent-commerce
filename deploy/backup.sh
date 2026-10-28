#!/usr/bin/env bash
# SQLite backup for Agent Commerce compose volume (ACP-38).
# Runtime API image has no apt/sqlite3 CLI — use a disposable toolbox container.
# Cron-callable; non-zero exit on failure.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-$(basename "$ROOT_DIR")}"
VOLUME_NAME="${BACKUP_VOLUME:-${PROJECT_NAME}_commerce-data}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/deploy/backups}"
RETAIN="${BACKUP_RETAIN:-7}"
DB_FILE="${BACKUP_DB_FILE:-commerce.sqlite}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_NAME="commerce-${STAMP}.sqlite"
# Image ENTRYPOINT is sqlite3 — pass DB path + .backup as args.
TOOLBOX_IMAGE="${BACKUP_TOOLBOX_IMAGE:-keinos/sqlite3:3.45.3}"

mkdir -p "$BACKUP_DIR"

if ! docker volume inspect "$VOLUME_NAME" >/dev/null 2>&1; then
  echo "backup.sh: volume not found: $VOLUME_NAME" >&2
  echo "hint: set COMPOSE_PROJECT_NAME or BACKUP_VOLUME to match docker volume ls" >&2
  exit 1
fi

echo "backup.sh: dumping $VOLUME_NAME:/$DB_FILE → $BACKUP_DIR/$OUT_NAME"

# sqlite3 .backup is crash-safe while the API may still hold the DB open.
# Mount RW so WAL checkpoint / backup temp state can succeed.
docker run --rm \
  -v "${VOLUME_NAME}:/data" \
  -v "${BACKUP_DIR}:/backup" \
  "$TOOLBOX_IMAGE" \
  "/data/${DB_FILE}" ".backup '/backup/${OUT_NAME}'"

if [[ ! -s "${BACKUP_DIR}/${OUT_NAME}" ]]; then
  echo "backup.sh: backup file missing or empty: ${BACKUP_DIR}/${OUT_NAME}" >&2
  exit 1
fi

# Retain newest N timestamped backups; delete older commerce-*.sqlite files.
mapfile -t existing < <(ls -1t "$BACKUP_DIR"/commerce-*.sqlite 2>/dev/null || true)
if ((${#existing[@]} > RETAIN)); then
  for old in "${existing[@]:RETAIN}"; do
    echo "backup.sh: pruning $old"
    rm -f "$old"
  done
fi

echo "backup.sh: ok ${BACKUP_DIR}/${OUT_NAME}"

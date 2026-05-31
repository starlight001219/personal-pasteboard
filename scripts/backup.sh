#!/usr/bin/env sh
set -eu

APP_DIR="${APP_DIR:-/opt/personal-pasteboard}"
BACKUP_DIR="${BACKUP_DIR:-/opt/personal-pasteboard/backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"
if [ -f "$APP_DIR/data/pastes.json.enc" ]; then
  cp "$APP_DIR/data/pastes.json.enc" "$BACKUP_DIR/pastes-$STAMP.json.enc"
fi
if [ -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env" "$BACKUP_DIR/env-$STAMP"
fi

find "$BACKUP_DIR" -type f -mtime +30 -delete
echo "backup-ok $STAMP"

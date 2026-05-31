#!/usr/bin/env sh
set -eu

APP_DIR="${APP_DIR:-/opt/personal-pasteboard}"
URL="${PASTEBOARD_HEALTH_URL:-http://127.0.0.1:3088/healthz}"

if command -v curl >/dev/null 2>&1 && curl -fsS "$URL" >/dev/null; then
  exit 0
fi

cd "$APP_DIR"
docker compose up -d --remove-orphans
curl -fsS "$URL" >/dev/null
echo "keepalive-restarted"

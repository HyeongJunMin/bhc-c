#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

API_PORT="${API_PORT:-9990}"
WEB_PORT="${WEB_PORT:-9991}"
API_SERVER_URL="${API_SERVER_URL:-http://localhost:${API_PORT}}"

api_pid=""
web_pid=""

run_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    pnpm "$@"
    return
  fi

  if command -v corepack >/dev/null 2>&1; then
    corepack pnpm "$@"
    return
  fi

  npx pnpm "$@"
}

cleanup() {
  set +e
  if [[ -n "$web_pid" ]] && kill -0 "$web_pid" 2>/dev/null; then
    kill -TERM "$web_pid" 2>/dev/null || true
    wait "$web_pid" 2>/dev/null || true
  fi
  if [[ -n "$api_pid" ]] && kill -0 "$api_pid" 2>/dev/null; then
    kill -TERM "$api_pid" 2>/dev/null || true
    wait "$api_pid" 2>/dev/null || true
  fi
}

trap cleanup INT TERM EXIT

echo "[local-run] game-server: PORT=${API_PORT}"
run_pnpm --filter @bhc/game-server run dev &
api_pid=$!

# Give API server a brief head start.
sleep 1

echo "[local-run] web: WEB_PORT=${WEB_PORT} API_SERVER_URL=${API_SERVER_URL}"
WEB_PORT="$WEB_PORT" API_SERVER_URL="$API_SERVER_URL" run_pnpm --filter @bhc/web run dev &
web_pid=$!

# Portable process monitor (works with macOS bash 3.x; avoids wait -n).
while true; do
  if ! kill -0 "$api_pid" 2>/dev/null; then
    echo "[local-run] game-server exited. stopping web..."
    exit 1
  fi

  if ! kill -0 "$web_pid" 2>/dev/null; then
    echo "[local-run] web exited. stopping game-server..."
    exit 1
  fi

  sleep 1
done

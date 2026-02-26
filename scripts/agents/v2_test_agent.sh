#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

: "${SOAK_DURATION_MS:=1200000}"
: "${SOAK_TICK_MS:=500}"

LOBBY_LOG_PATH="/tmp/bhc_v2_lobby_test.log"
SOAK_LOG_PATH="/tmp/bhc_v2_soak.log"
current_stage="regression"
soak_error_count=-1

emit_summary_json() {
  local status="$1"
  local reason="${2:-}"
  printf '{"testAgent":"v2","status":"%s","stage":"%s","lobbyLogPath":"%s","soakLogPath":"%s","soakErrorCount":%s,"soakDurationMs":%s,"soakTickMs":%s,"reason":"%s"}\n' \
    "$status" \
    "$current_stage" \
    "$LOBBY_LOG_PATH" \
    "$SOAK_LOG_PATH" \
    "$soak_error_count" \
    "$SOAK_DURATION_MS" \
    "$SOAK_TICK_MS" \
    "$reason"
}

on_error() {
  emit_summary_json "fail" "stage_failed"
}

trap on_error ERR

echo "[test-agent] run regression tests"
node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts >"$LOBBY_LOG_PATH"

echo "[test-agent] run 4-player/20m soak scenario config"
current_stage="soak"

echo "[test-agent] SOAK_DURATION_MS=$SOAK_DURATION_MS SOAK_TICK_MS=$SOAK_TICK_MS"
QA_DURATION_MS="$SOAK_DURATION_MS" QA_TICK_MS="$SOAK_TICK_MS" node --experimental-strip-types scripts/qa/collect-play-errors.ts >"$SOAK_LOG_PATH"
soak_error_count="$(node -e "const fs=require('fs');const p=process.argv[1];const raw=fs.readFileSync(p,'utf8');const data=JSON.parse(raw);const n=Number(data.errorCount);if(!Number.isFinite(n)){process.exit(1);}process.stdout.write(String(n));" "$SOAK_LOG_PATH")"

echo "[test-agent] pass"
emit_summary_json "pass"

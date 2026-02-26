#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

: "${AUTO_LOOPS:=3}"
: "${MAX_ITERATIONS:=1}"
: "${SOAK_DURATION_MS:=1200000}"
: "${SOAK_TICK_MS:=500}"
current_cycle=0

on_error() {
  printf '{"autoLoop":"v2","status":"fail","cycle":%s,"totalCycles":%s,"soakDurationMs":%s,"soakTickMs":%s,"reason":"loop_failed"}\n' \
    "$current_cycle" \
    "$AUTO_LOOPS" \
    "$SOAK_DURATION_MS" \
    "$SOAK_TICK_MS"
}

trap on_error ERR

for ((i=1; i<=AUTO_LOOPS; i++)); do
  current_cycle="$i"
  echo "[auto-loop] cycle $i/$AUTO_LOOPS"

  MAX_ITERATIONS="$MAX_ITERATIONS" \
  SOAK_DURATION_MS="$SOAK_DURATION_MS" \
  SOAK_TICK_MS="$SOAK_TICK_MS" \
  scripts/agents/v2_team_loop.sh | node --experimental-strip-types scripts/qa/parse-team-loop-summary.ts

  printf '{"autoLoop":"v2","cycle":%s,"totalCycles":%s,"status":"pass","soakDurationMs":%s,"soakTickMs":%s}\n' \
    "$i" \
    "$AUTO_LOOPS" \
    "$SOAK_DURATION_MS" \
    "$SOAK_TICK_MS"
done

printf '{"autoLoop":"v2","status":"completed","totalCycles":%s}\n' "$AUTO_LOOPS"

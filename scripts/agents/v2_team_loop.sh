#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

: "${MAX_ITERATIONS:=10}"
: "${SOAK_DURATION_MS:=1200000}"
: "${SOAK_TICK_MS:=500}"

LOBBY_LOG_PATH="/tmp/bhc_v2_lobby_test.log"
SOAK_LOG_PATH="/tmp/bhc_v2_soak.log"

emit_summary_json() {
  local status="$1"
  local iteration="$2"
  local reason="${3:-}"
  printf '{"teamLoop":"v2","status":"%s","iteration":%s,"maxIterations":%s,"soakDurationMs":%s,"soakTickMs":%s,"lobbyLogPath":"%s","soakLogPath":"%s","reason":"%s"}\n' \
    "$status" \
    "$iteration" \
    "$MAX_ITERATIONS" \
    "$SOAK_DURATION_MS" \
    "$SOAK_TICK_MS" \
    "$LOBBY_LOG_PATH" \
    "$SOAK_LOG_PATH" \
    "$reason"
}

for ((i=1; i<=MAX_ITERATIONS; i++)); do
  echo "[team-loop] iteration $i/$MAX_ITERATIONS"

  if ! scripts/agents/v2_dev_agent.sh; then
    echo "[team-loop] dev-agent failed" >&2
    continue
  fi

  if ! SOAK_DURATION_MS="$SOAK_DURATION_MS" SOAK_TICK_MS="$SOAK_TICK_MS" scripts/agents/v2_test_agent.sh; then
    echo "[team-loop] test-agent failed" >&2
    continue
  fi

  echo "[team-loop] all gates green"
  emit_summary_json "pass" "$i"
  exit 0
done

echo "[team-loop] reached max iterations without green gates" >&2
emit_summary_json "fail" "$MAX_ITERATIONS" "max_iterations_reached"
exit 1

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./runtime_smoke_lib.sh
source "${SCRIPT_DIR}/runtime_smoke_lib.sh"

STRICT_MODE="false"
if [ "${1:-}" = "--strict" ]; then
  STRICT_MODE="true"
fi

GATE_DEBUG_FILE="${GATE_DEBUG_FILE_PATH:-gate-debug.txt}"

init_debug_file() {
  {
    echo "runtime_smoke_gate_debug"
    echo "started_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  } > "$GATE_DEBUG_FILE"
}

dump_gate_file() {
  local file="$1"
  echo "[runtime-smoke][gate] ${file}" >&2
  if [ -f "$file" ]; then
    cat "$file" >&2 || true
    {
      echo "----- file:${file} -----"
      cat "$file" || true
    } >> "$GATE_DEBUG_FILE"
  else
    echo "(missing)" >&2
    echo "file:${file}=(missing)" >> "$GATE_DEBUG_FILE"
  fi
}

dump_gate_tail() {
  local file="$1"
  local lines="$2"
  echo "[runtime-smoke][gate] tail -n ${lines} ${file}" >&2
  if [ -f "$file" ]; then
    tail -n "$lines" "$file" >&2 || true
    {
      echo "----- tail:${file}:${lines} -----"
      tail -n "$lines" "$file" || true
    } >> "$GATE_DEBUG_FILE"
  else
    echo "(missing)" >&2
    echo "tail:${file}:${lines}=(missing)" >> "$GATE_DEBUG_FILE"
  fi
}

fail_gate() {
  local message="$1"
  echo "[runtime-smoke][gate] ${message}" >&2
  echo "result=fail" >> "$GATE_DEBUG_FILE"
  echo "reason=${message}" >> "$GATE_DEBUG_FILE"
  echo "[runtime-smoke][gate] tail stream-shot.txt" >&2
  tail -n 40 stream-shot.txt >&2 || true
  echo "[runtime-smoke][gate] tail stream-leave.txt" >&2
  tail -n 40 stream-leave.txt >&2 || true
  dump_gate_tail game-server.log 80
  dump_gate_tail web.log 80
  dump_gate_file shot-conflict.status
  dump_gate_file shot-invalid.status
  dump_gate_file forbidden.status
  dump_gate_file shot.json
  dump_gate_file shot-conflict.json
  dump_gate_file shot-invalid.json
  dump_gate_file turn-changed.json
  dump_gate_file detail-after-shot.json
  dump_gate_file leave-host.json
  dump_gate_file detail-after-leave.json
  dump_gate_file forbidden.json
  exit 1
}

read_inputs() {
  SHOT_EVENT_ORDER="$(read_text_file_or_default "shot-event-order.txt" "")"
  TURN_DETAIL_SYNC="$(read_text_file_or_default "turn-detail-sync.txt" "")"
  LEAVE_EVENT_ORDER="$(read_text_file_or_default "leave-event-order.txt" "")"
  HOST_ID_VALUE="$(read_json_field "guest.json" '.guestId' "")"
  GUEST2_ID_VALUE="$(read_json_field "guest2.json" '.guestId' "")"
  HEALTH_OK="$(read_json_field "health.json" '.ok' "")"
  SHOT_ACCEPTED_VALUE="$(read_json_field "shot.json" '.accepted' "")"
  SHOT_CONFLICT_STATUS_VALUE="$(read_text_file_or_default "shot-conflict.status" "")"
  SHOT_INVALID_STATUS_VALUE="$(read_text_file_or_default "shot-invalid.status" "")"
  FORBIDDEN_STATUS_VALUE="$(read_text_file_or_default "forbidden.status" "")"
  SHOT_CONFLICT_CODE_VALUE="$(read_json_field "shot-conflict.json" '.errorCode' "")"
  SHOT_INVALID_CODE_VALUE="$(read_json_field "shot-invalid.json" '.errorCode' "")"
  FORBIDDEN_CODE_VALUE="$(read_json_field "forbidden.json" '.errorCode' "")"
  TURN_CHANGED_MEMBER_VALUE="$(read_json_field "turn-changed.json" '.currentMemberId' "")"
  TURN_CHANGED_DEADLINE_VALUE="$(read_json_field "turn-changed.json" '.turnDeadlineMs' "0")"
  FINAL_STATE_VALUE="$(read_json_field "detail-after-leave.json" '.room.state' "")"
  FINAL_WINNER_VALUE="$(read_json_field "detail-after-leave.json" '.room.winnerMemberId' "")"
  HOST_GAME_STATE_VALUE="$(jq -r --arg h "$HOST_ID_VALUE" '.room.memberGameStates[$h] // empty' detail-after-leave.json 2>/dev/null || true)"
  GUEST2_GAME_STATE_VALUE="$(jq -r --arg g "$GUEST2_ID_VALUE" '.room.memberGameStates[$g] // empty' detail-after-leave.json 2>/dev/null || true)"
}

log_inputs() {
  {
    echo "----- kv-table -----"
    printf "%-28s | %s\n" "key" "value"
    printf "%-28s-+-%s\n" "----------------------------" "----------------------------------------"
    printf "%-28s | %s\n" "final_state" "$FINAL_STATE_VALUE"
    printf "%-28s | %s\n" "final_winner" "$FINAL_WINNER_VALUE"
    printf "%-28s | %s\n" "forbidden_code" "$FORBIDDEN_CODE_VALUE"
    printf "%-28s | %s\n" "forbidden_status" "$FORBIDDEN_STATUS_VALUE"
    printf "%-28s | %s\n" "guest2_game_state" "$GUEST2_GAME_STATE_VALUE"
    printf "%-28s | %s\n" "health_ok" "$HEALTH_OK"
    printf "%-28s | %s\n" "host_game_state" "$HOST_GAME_STATE_VALUE"
    printf "%-28s | %s\n" "leave_event_order" "$LEAVE_EVENT_ORDER"
    printf "%-28s | %s\n" "shot_accepted" "$SHOT_ACCEPTED_VALUE"
    printf "%-28s | %s\n" "shot_conflict_code" "$SHOT_CONFLICT_CODE_VALUE"
    printf "%-28s | %s\n" "shot_conflict_status" "$SHOT_CONFLICT_STATUS_VALUE"
    printf "%-28s | %s\n" "shot_event_order" "$SHOT_EVENT_ORDER"
    printf "%-28s | %s\n" "shot_invalid_code" "$SHOT_INVALID_CODE_VALUE"
    printf "%-28s | %s\n" "shot_invalid_status" "$SHOT_INVALID_STATUS_VALUE"
    printf "%-28s | %s\n" "turn_changed_deadline" "$TURN_CHANGED_DEADLINE_VALUE"
    printf "%-28s | %s\n" "turn_changed_member" "$TURN_CHANGED_MEMBER_VALUE"
    printf "%-28s | %s\n" "turn_detail_sync" "$TURN_DETAIL_SYNC"
    echo "----- kv-raw -----"
    echo "shot_event_order=${SHOT_EVENT_ORDER}"
    echo "turn_detail_sync=${TURN_DETAIL_SYNC}"
    echo "leave_event_order=${LEAVE_EVENT_ORDER}"
    echo "health_ok=${HEALTH_OK}"
    echo "shot_accepted=${SHOT_ACCEPTED_VALUE}"
    echo "shot_conflict_status=${SHOT_CONFLICT_STATUS_VALUE}"
    echo "shot_invalid_status=${SHOT_INVALID_STATUS_VALUE}"
    echo "forbidden_status=${FORBIDDEN_STATUS_VALUE}"
    echo "shot_conflict_code=${SHOT_CONFLICT_CODE_VALUE}"
    echo "shot_invalid_code=${SHOT_INVALID_CODE_VALUE}"
    echo "forbidden_code=${FORBIDDEN_CODE_VALUE}"
    echo "turn_changed_member=${TURN_CHANGED_MEMBER_VALUE}"
    echo "turn_changed_deadline=${TURN_CHANGED_DEADLINE_VALUE}"
    echo "final_state=${FINAL_STATE_VALUE}"
    echo "final_winner=${FINAL_WINNER_VALUE}"
    echo "host_game_state=${HOST_GAME_STATE_VALUE}"
    echo "guest2_game_state=${GUEST2_GAME_STATE_VALUE}"
  } >> "$GATE_DEBUG_FILE"
}

validate_presence() {
  [ -n "$SHOT_EVENT_ORDER" ] || fail_gate "missing shot-event-order.txt content"
  [ -n "$TURN_DETAIL_SYNC" ] || fail_gate "missing turn-detail-sync.txt content"
  [ -n "$LEAVE_EVENT_ORDER" ] || fail_gate "missing leave-event-order.txt content"
  [ -n "$HOST_ID_VALUE" ] || fail_gate "missing host guestId in guest.json"
  [ -n "$GUEST2_ID_VALUE" ] || fail_gate "missing second guestId in guest2.json"
}

validate_status_codes() {
  [ "$HEALTH_OK" = "true" ] || fail_gate "health.ok is not true: $HEALTH_OK"
  [ "$SHOT_ACCEPTED_VALUE" = "true" ] || fail_gate "shot accepted flag is not true: $SHOT_ACCEPTED_VALUE"
  [ "$SHOT_CONFLICT_STATUS_VALUE" = "409" ] || fail_gate "shot conflict status is not 409: $SHOT_CONFLICT_STATUS_VALUE"
  [ "$SHOT_INVALID_STATUS_VALUE" = "400" ] || fail_gate "shot invalid status is not 400: $SHOT_INVALID_STATUS_VALUE"
  [ "$FORBIDDEN_STATUS_VALUE" = "403" ] || fail_gate "forbidden stream status is not 403: $FORBIDDEN_STATUS_VALUE"
  [ "$SHOT_CONFLICT_CODE_VALUE" = "SHOT_STATE_CONFLICT" ] || fail_gate "shot conflict code mismatch: $SHOT_CONFLICT_CODE_VALUE"
  [ "$SHOT_INVALID_CODE_VALUE" = "SHOT_INPUT_SCHEMA_INVALID" ] || fail_gate "shot invalid code mismatch: $SHOT_INVALID_CODE_VALUE"
  [ "$FORBIDDEN_CODE_VALUE" = "ROOM_STREAM_FORBIDDEN" ] || fail_gate "forbidden code mismatch: $FORBIDDEN_CODE_VALUE"
  [ -n "$TURN_CHANGED_MEMBER_VALUE" ] || fail_gate "turn-changed member is empty"
  [ "$TURN_CHANGED_DEADLINE_VALUE" -gt 0 ] || fail_gate "turn-changed deadline is invalid: $TURN_CHANGED_DEADLINE_VALUE"
}

validate_events() {
  grep -q "event: room_snapshot" stream.txt || fail_gate "stream.txt missing room_snapshot event"
  grep -q "event: shot_started" stream-shot.txt || fail_gate "stream-shot.txt missing shot_started event"
  grep -q "event: shot_resolved" stream-shot.txt || fail_gate "stream-shot.txt missing shot_resolved event"
  grep -q "event: turn_changed" stream-shot.txt || fail_gate "stream-shot.txt missing turn_changed event"
  grep -q "event: host_delegated" stream-leave.txt || fail_gate "stream-leave.txt missing host_delegated event"
  grep -q "event: game_finished" stream-leave.txt || fail_gate "stream-leave.txt missing game_finished event"
}

validate_orders() {
  echo "$SHOT_EVENT_ORDER" | grep -Eq '^[0-9]+,[0-9]+,[0-9]+$' || fail_gate "invalid shot event order format: $SHOT_EVENT_ORDER"
  echo "$TURN_DETAIL_SYNC" | grep -Eq '^[0-9]+,[0-9]+,(guest-[0-9]+|u[0-9]+)$' || fail_gate "invalid turn detail sync format: $TURN_DETAIL_SYNC"
  echo "$LEAVE_EVENT_ORDER" | grep -Eq '^[0-9]+,[0-9]+$' || fail_gate "invalid leave event order format: $LEAVE_EVENT_ORDER"

  IFS=',' read -r SHOT_STARTED_LINE SHOT_RESOLVED_LINE TURN_CHANGED_LINE <<< "$SHOT_EVENT_ORDER"
  test "$SHOT_STARTED_LINE" -lt "$SHOT_RESOLVED_LINE" || fail_gate "shot event order is not increasing: $SHOT_EVENT_ORDER"
  test "$SHOT_RESOLVED_LINE" -lt "$TURN_CHANGED_LINE" || fail_gate "shot event order is not increasing: $SHOT_EVENT_ORDER"

  IFS=',' read -r PRE_DEADLINE_MS POST_DEADLINE_MS TURN_MEMBER_ID <<< "$TURN_DETAIL_SYNC"
  [ -n "$TURN_MEMBER_ID" ] || fail_gate "turn member id is empty: $TURN_DETAIL_SYNC"
  test "$PRE_DEADLINE_MS" -lt "$POST_DEADLINE_MS" || fail_gate "turn deadline did not increase: $TURN_DETAIL_SYNC"
  [ "$TURN_MEMBER_ID" = "$TURN_CHANGED_MEMBER_VALUE" ] || fail_gate "turn member mismatch detail-sync vs turn-changed: $TURN_MEMBER_ID vs $TURN_CHANGED_MEMBER_VALUE"
  [ "$POST_DEADLINE_MS" = "$TURN_CHANGED_DEADLINE_VALUE" ] || fail_gate "turn deadline mismatch detail-sync vs turn-changed: $POST_DEADLINE_MS vs $TURN_CHANGED_DEADLINE_VALUE"

  IFS=',' read -r HOST_DELEGATED_LINE GAME_FINISHED_LINE <<< "$LEAVE_EVENT_ORDER"
  test "$HOST_DELEGATED_LINE" -lt "$GAME_FINISHED_LINE" || fail_gate "leave event order is not increasing: $LEAVE_EVENT_ORDER"
}

main() {
  init_debug_file
  read_inputs
  log_inputs
  validate_presence
  validate_status_codes
  if [ "$STRICT_MODE" = "true" ]; then
    [ "$FINAL_STATE_VALUE" = "FINISHED" ] || fail_gate "final room state is not FINISHED: $FINAL_STATE_VALUE"
    [ "$FINAL_WINNER_VALUE" = "$GUEST2_ID_VALUE" ] || fail_gate "final winner mismatch: $FINAL_WINNER_VALUE expected $GUEST2_ID_VALUE"
    [ "$HOST_GAME_STATE_VALUE" = "LOSE" ] || fail_gate "host game state mismatch: $HOST_GAME_STATE_VALUE"
    [ "$GUEST2_GAME_STATE_VALUE" = "WIN" ] || fail_gate "guest2 game state mismatch: $GUEST2_GAME_STATE_VALUE"
    validate_events
    validate_orders
  fi
  echo "result=pass" >> "$GATE_DEBUG_FILE"
}

main "$@"

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
GATE_SCRIPT="${REPO_ROOT}/scripts/ci/runtime_smoke_gate.sh"

create_temp_dir() {
  local dir=""
  if dir="$(mktemp -d 2>/dev/null)"; then
    echo "$dir"
    return 0
  fi
  mkdir -p "${REPO_ROOT}/.tmp"
  if dir="$(mktemp -d "${REPO_ROOT}/.tmp/runtime-smoke-gate.XXXXXX" 2>/dev/null)"; then
    echo "$dir"
    return 0
  fi
  echo "failed to create temp dir" >&2
  return 1
}

run_pass_case() {
  local tmp
  tmp="$(create_temp_dir)"
  (
    cd "$tmp"
    cat > guest.json <<'JSON'
{"guestId":"guest-1"}
JSON
    cat > guest2.json <<'JSON'
{"guestId":"guest-2"}
JSON
    cat > health.json <<'JSON'
{"ok":true}
JSON
    cat > shot.json <<'JSON'
{"accepted":true}
JSON
    echo "409" > shot-conflict.status
    echo "400" > shot-invalid.status
    echo "403" > forbidden.status
    cat > shot-conflict.json <<'JSON'
{"errorCode":"SHOT_STATE_CONFLICT"}
JSON
    cat > shot-invalid.json <<'JSON'
{"errorCode":"SHOT_INPUT_SCHEMA_INVALID"}
JSON
    cat > forbidden.json <<'JSON'
{"errorCode":"ROOM_STREAM_FORBIDDEN"}
JSON
    cat > turn-changed.json <<'JSON'
{"currentMemberId":"guest-2","turnDeadlineMs":2000}
JSON
    cat > detail-after-leave.json <<'JSON'
{"room":{"state":"FINISHED","winnerMemberId":"guest-2","memberGameStates":{"guest-1":"LOSE","guest-2":"WIN"}}}
JSON
    cat > stream.txt <<'EOF'
event: room_snapshot
EOF
    cat > stream-shot.txt <<'EOF'
event: shot_started
event: shot_resolved
event: turn_changed
EOF
    cat > stream-leave.txt <<'EOF'
event: host_delegated
event: game_finished
EOF
    echo "1,2,3" > shot-event-order.txt
    echo "1000,2000,guest-2" > turn-detail-sync.txt
    echo "1,2" > leave-event-order.txt
    bash "$GATE_SCRIPT"
    test -f gate-debug.txt
    grep -q "result=pass" gate-debug.txt
  )
  rm -rf "$tmp"
}

run_fail_case() {
  local tmp
  tmp="$(create_temp_dir)"
  (
    cd "$tmp"
    cat > guest.json <<'JSON'
{"guestId":"guest-1"}
JSON
    cat > guest2.json <<'JSON'
{"guestId":"guest-2"}
JSON
    cat > health.json <<'JSON'
{"ok":true}
JSON
    cat > shot.json <<'JSON'
{"accepted":false}
JSON
    echo "409" > shot-conflict.status
    echo "400" > shot-invalid.status
    echo "403" > forbidden.status
    cat > shot-conflict.json <<'JSON'
{"errorCode":"SHOT_STATE_CONFLICT"}
JSON
    cat > shot-invalid.json <<'JSON'
{"errorCode":"SHOT_INPUT_SCHEMA_INVALID"}
JSON
    cat > forbidden.json <<'JSON'
{"errorCode":"ROOM_STREAM_FORBIDDEN"}
JSON
    cat > turn-changed.json <<'JSON'
{"currentMemberId":"guest-2","turnDeadlineMs":2000}
JSON
    cat > detail-after-leave.json <<'JSON'
{"room":{"state":"FINISHED","winnerMemberId":"guest-2","memberGameStates":{"guest-1":"LOSE","guest-2":"WIN"}}}
JSON
    cat > stream.txt <<'EOF'
event: room_snapshot
EOF
    cat > stream-shot.txt <<'EOF'
event: shot_started
event: shot_resolved
event: turn_changed
EOF
    cat > stream-leave.txt <<'EOF'
event: host_delegated
event: game_finished
EOF
    echo "1,2,3" > shot-event-order.txt
    echo "1000,2000,guest-2" > turn-detail-sync.txt
    echo "1,2" > leave-event-order.txt
    if bash "$GATE_SCRIPT"; then
      echo "expected gate failure but passed" >&2
      exit 1
    fi
    test -f gate-debug.txt
    grep -q "result=fail" gate-debug.txt
  )
  rm -rf "$tmp"
}

run_fail_order_case() {
  local tmp
  tmp="$(create_temp_dir)"
  (
    cd "$tmp"
    cat > guest.json <<'JSON'
{"guestId":"guest-1"}
JSON
    cat > guest2.json <<'JSON'
{"guestId":"guest-2"}
JSON
    cat > health.json <<'JSON'
{"ok":true}
JSON
    cat > shot.json <<'JSON'
{"accepted":true}
JSON
    echo "409" > shot-conflict.status
    echo "400" > shot-invalid.status
    echo "403" > forbidden.status
    cat > shot-conflict.json <<'JSON'
{"errorCode":"SHOT_STATE_CONFLICT"}
JSON
    cat > shot-invalid.json <<'JSON'
{"errorCode":"SHOT_INPUT_SCHEMA_INVALID"}
JSON
    cat > forbidden.json <<'JSON'
{"errorCode":"ROOM_STREAM_FORBIDDEN"}
JSON
    cat > turn-changed.json <<'JSON'
{"currentMemberId":"guest-2","turnDeadlineMs":2000}
JSON
    cat > detail-after-leave.json <<'JSON'
{"room":{"state":"FINISHED","winnerMemberId":"guest-2","memberGameStates":{"guest-1":"LOSE","guest-2":"WIN"}}}
JSON
    cat > stream.txt <<'EOF'
event: room_snapshot
EOF
    cat > stream-shot.txt <<'EOF'
event: shot_started
event: shot_resolved
event: turn_changed
EOF
    cat > stream-leave.txt <<'EOF'
event: host_delegated
event: game_finished
EOF
    echo "3,2,1" > shot-event-order.txt
    echo "1000,2000,guest-2" > turn-detail-sync.txt
    echo "2,1" > leave-event-order.txt
    if bash "$GATE_SCRIPT" --strict; then
      echo "expected strict gate order failure but passed" >&2
      exit 1
    fi
    grep -q "result=fail" gate-debug.txt
  )
  rm -rf "$tmp"
}

run_fail_status_mismatch_case() {
  local tmp
  tmp="$(create_temp_dir)"
  (
    cd "$tmp"
    cat > guest.json <<'JSON'
{"guestId":"guest-1"}
JSON
    cat > guest2.json <<'JSON'
{"guestId":"guest-2"}
JSON
    cat > health.json <<'JSON'
{"ok":true}
JSON
    cat > shot.json <<'JSON'
{"accepted":true}
JSON
    echo "500" > shot-conflict.status
    echo "400" > shot-invalid.status
    echo "403" > forbidden.status
    cat > shot-conflict.json <<'JSON'
{"errorCode":"SHOT_STATE_CONFLICT"}
JSON
    cat > shot-invalid.json <<'JSON'
{"errorCode":"SHOT_INPUT_SCHEMA_INVALID"}
JSON
    cat > forbidden.json <<'JSON'
{"errorCode":"ROOM_STREAM_FORBIDDEN"}
JSON
    cat > turn-changed.json <<'JSON'
{"currentMemberId":"guest-2","turnDeadlineMs":2000}
JSON
    cat > detail-after-leave.json <<'JSON'
{"room":{"state":"FINISHED","winnerMemberId":"guest-2","memberGameStates":{"guest-1":"LOSE","guest-2":"WIN"}}}
JSON
    cat > stream.txt <<'EOF'
event: room_snapshot
EOF
    cat > stream-shot.txt <<'EOF'
event: shot_started
event: shot_resolved
event: turn_changed
EOF
    cat > stream-leave.txt <<'EOF'
event: host_delegated
event: game_finished
EOF
    echo "1,2,3" > shot-event-order.txt
    echo "1000,2000,guest-2" > turn-detail-sync.txt
    echo "1,2" > leave-event-order.txt
    if bash "$GATE_SCRIPT"; then
      echo "expected gate status mismatch failure but passed" >&2
      exit 1
    fi
    grep -q "result=fail" gate-debug.txt
  )
  rm -rf "$tmp"
}

run_fail_member_id_pattern_case() {
  local tmp
  tmp="$(create_temp_dir)"
  (
    cd "$tmp"
    cat > guest.json <<'JSON'
{"guestId":"guest-1"}
JSON
    cat > guest2.json <<'JSON'
{"guestId":"guest-2"}
JSON
    cat > health.json <<'JSON'
{"ok":true}
JSON
    cat > shot.json <<'JSON'
{"accepted":true}
JSON
    echo "409" > shot-conflict.status
    echo "400" > shot-invalid.status
    echo "403" > forbidden.status
    cat > shot-conflict.json <<'JSON'
{"errorCode":"SHOT_STATE_CONFLICT"}
JSON
    cat > shot-invalid.json <<'JSON'
{"errorCode":"SHOT_INPUT_SCHEMA_INVALID"}
JSON
    cat > forbidden.json <<'JSON'
{"errorCode":"ROOM_STREAM_FORBIDDEN"}
JSON
    cat > turn-changed.json <<'JSON'
{"currentMemberId":"bot-2","turnDeadlineMs":2000}
JSON
    cat > detail-after-leave.json <<'JSON'
{"room":{"state":"FINISHED","winnerMemberId":"guest-2","memberGameStates":{"guest-1":"LOSE","guest-2":"WIN"}}}
JSON
    cat > stream.txt <<'EOF'
event: room_snapshot
EOF
    cat > stream-shot.txt <<'EOF'
event: shot_started
event: shot_resolved
event: turn_changed
EOF
    cat > stream-leave.txt <<'EOF'
event: host_delegated
event: game_finished
EOF
    echo "1,2,3" > shot-event-order.txt
    echo "1000,2000,bot-2" > turn-detail-sync.txt
    echo "1,2" > leave-event-order.txt
    if bash "$GATE_SCRIPT" --strict; then
      echo "expected strict gate member pattern failure but passed" >&2
      exit 1
    fi
    grep -q "result=fail" gate-debug.txt
  )
  rm -rf "$tmp"
}

run_pass_case
run_fail_case
run_fail_order_case
run_fail_status_mismatch_case
run_fail_member_id_pattern_case
echo "runtime_smoke_gate_tests:ok"

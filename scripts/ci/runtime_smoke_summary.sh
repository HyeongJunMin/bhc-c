#!/usr/bin/env bash
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./runtime_smoke_lib.sh
source "${SCRIPT_DIR}/runtime_smoke_lib.sh"

SUMMARY_JSON="$(
  jq -n \
    --slurpfile health health.json \
    --slurpfile guest guest.json \
    --slurpfile guest2 guest2.json \
    --slurpfile room room.json \
    --slurpfile start start.json \
    --slurpfile detail detail.json \
    --slurpfile leaveHost leave-host.json \
    --slurpfile detailAfterLeave detail-after-leave.json \
    --slurpfile shot shot.json \
    --slurpfile shotConflict shot-conflict.json \
    --slurpfile shotInvalid shot-invalid.json \
    --slurpfile forbidden forbidden.json \
    --rawfile leaveEventOrder leave-event-order.txt \
    --rawfile shotEventOrder shot-event-order.txt \
    --rawfile turnDetailSync turn-detail-sync.txt \
    --rawfile shotConflictStatus shot-conflict.status \
    --rawfile shotInvalidStatus shot-invalid.status \
    --rawfile forbiddenStatus forbidden.status '
      def first_obj($arr): if ($arr | length) > 0 then $arr[0] else {} end;
      def text_or($v; $fallback): if ($v == null or $v == "") then $fallback else ($v | tostring) end;
      (first_obj($guest)) as $g |
      (first_obj($guest2)) as $g2 |
      (first_obj($detailAfterLeave)) as $dal |
      {
        health_ok: text_or(first_obj($health).ok; "unknown"),
        guest_id: text_or($g.guestId; "N/A"),
        guest2_id: text_or($g2.guestId; "N/A"),
        room_id: text_or(first_obj($room).room.roomId; "N/A"),
        start_state: text_or(first_obj($start).room.state; "N/A"),
        detail_state: text_or(first_obj($detail).room.state; "N/A"),
        detail_count: text_or(first_obj($detail).room.playerCount; "N/A"),
        leave_host_id: text_or(first_obj($leaveHost).room.hostMemberId; "N/A"),
        leave_count: text_or(first_obj($leaveHost).room.playerCount; "N/A"),
        final_state: text_or($dal.room.state; "N/A"),
        final_winner: text_or($dal.room.winnerMemberId; "N/A"),
        host_game_state: text_or($dal.room.memberGameStates[$g.guestId]; "N/A"),
        guest2_game_state: text_or($dal.room.memberGameStates[$g2.guestId]; "N/A"),
        leave_event_order: text_or($leaveEventOrder; "N/A"),
        shot_event_order: text_or($shotEventOrder; "N/A"),
        turn_detail_sync: text_or($turnDetailSync; "N/A"),
        shot_accepted: text_or(first_obj($shot).accepted; "N/A"),
        shot_conflict_status: text_or($shotConflictStatus; "N/A"),
        shot_conflict_code: text_or(first_obj($shotConflict).errorCode; "N/A"),
        shot_invalid_status: text_or($shotInvalidStatus; "N/A"),
        shot_invalid_code: text_or(first_obj($shotInvalid).errorCode; "N/A"),
        forbidden_status: text_or($forbiddenStatus; "N/A"),
        forbidden_code: text_or(first_obj($forbidden).errorCode; "N/A")
      }
    '
)"

echo "$SUMMARY_JSON" | jq -e '
  has("health_ok")
  and has("guest_id")
  and has("guest2_id")
  and has("room_id")
  and has("shot_event_order")
  and has("turn_detail_sync")
  and has("leave_event_order")
  and has("shot_accepted")
' >/dev/null

LEAVE_EVENT_ORDER="$(echo "$SUMMARY_JSON" | jq -r '.leave_event_order')"
SHOT_EVENT_ORDER="$(echo "$SUMMARY_JSON" | jq -r '.shot_event_order')"
TURN_DETAIL_SYNC="$(echo "$SUMMARY_JSON" | jq -r '.turn_detail_sync')"
HEALTH_OK="$(echo "$SUMMARY_JSON" | jq -r '.health_ok')"
STREAM_OK="$(bool_from_event_file "stream.txt" "room_snapshot")"
SHOT_LIFECYCLE_ORDER_OK="false"
if [ "$SHOT_EVENT_ORDER" != "N/A" ]; then
  SHOT_LIFECYCLE_ORDER_OK="true"
fi
TURN_DETAIL_SYNC_OK="false"
if [ "$TURN_DETAIL_SYNC" != "N/A" ]; then
  TURN_DETAIL_SYNC_OK="true"
fi
LEAVE_EVENT_ORDER_OK="false"
if [ "$LEAVE_EVENT_ORDER" != "N/A" ]; then
  LEAVE_EVENT_ORDER_OK="true"
fi
OVERALL_SMOKE_OK="false"
if [ "$SHOT_LIFECYCLE_ORDER_OK" = "true" ] && [ "$TURN_DETAIL_SYNC_OK" = "true" ] && [ "$LEAVE_EVENT_ORDER_OK" = "true" ] && [ "$HEALTH_OK" = "true" ]; then
  OVERALL_SMOKE_OK="true"
fi

SUMMARY_FORMAT="${SUMMARY_FORMAT:-list}"
SUMMARY_JSON_FILE="${SUMMARY_JSON_FILE:-runtime-smoke-summary.json}"

echo "$SUMMARY_JSON" | jq \
  --arg gameServerPort "${GAME_SERVER_PORT:-9900}" \
  --arg webPort "${WEB_PORT_VALUE:-9901}" \
  --arg streamSnapshotEvent "$STREAM_OK" \
  --arg shotLifecycleOrderOk "$SHOT_LIFECYCLE_ORDER_OK" \
  --arg turnDetailSyncOk "$TURN_DETAIL_SYNC_OK" \
  --arg leaveEventOrderOk "$LEAVE_EVENT_ORDER_OK" \
  --arg overallSmokeOk "$OVERALL_SMOKE_OK" \
  '. + {
    game_server_port: $gameServerPort,
    web_port: $webPort,
    stream_snapshot_event: $streamSnapshotEvent,
    shot_lifecycle_order_ok: $shotLifecycleOrderOk,
    turn_detail_sync_ok: $turnDetailSyncOk,
    leave_event_order_ok: $leaveEventOrderOk,
    overall_smoke_ok: $overallSmokeOk
  }' > "$SUMMARY_JSON_FILE"

{
  if [ "$SUMMARY_FORMAT" = "table" ]; then
    echo "$SUMMARY_JSON" | jq -r \
      --arg gport "${GAME_SERVER_PORT:-9900}" \
      --arg wport "${WEB_PORT_VALUE:-9901}" \
      --arg streamOk "$STREAM_OK" \
      --arg shotLifecycleOrderOk "$SHOT_LIFECYCLE_ORDER_OK" \
      --arg turnDetailSyncOk "$TURN_DETAIL_SYNC_OK" \
      --arg leaveEventOrderOk "$LEAVE_EVENT_ORDER_OK" \
      --arg overallSmokeOk "$OVERALL_SMOKE_OK" '
        def row($k; $v): "| " + $k + " | `" + ($v|tostring) + "` |";
        [
          "## Runtime Smoke Summary",
          "",
          "| Metric | Value |",
          "|---|---|",
          row("game-server port"; $gport),
          row("web port"; $wport),
          row("health.ok"; .health_ok),
          row("hostGuestId"; .guest_id),
          row("secondGuestId"; .guest2_id),
          row("roomId"; .room_id),
          row("startState"; .start_state),
          row("detailState"; .detail_state),
          row("detailPlayerCount"; .detail_count),
          row("leaveHostDelegatedTo"; .leave_host_id),
          row("leavePlayerCount"; .leave_count),
          row("finalStateAfterLeave"; .final_state),
          row("finalWinnerAfterLeave"; .final_winner),
          row("hostGameStateAfterLeave"; .host_game_state),
          row("guest2GameStateAfterLeave"; .guest2_game_state),
          row("shotEventOrder(started,resolved,turn_changed)"; .shot_event_order),
          row("shotLifecycleOrderOk"; $shotLifecycleOrderOk),
          row("turnDetailSync(preDeadline,postDeadline,currentMember)"; .turn_detail_sync),
          row("turnDetailSyncOk"; $turnDetailSyncOk),
          row("leaveEventOrder(host_delegated,game_finished)"; .leave_event_order),
          row("leaveEventOrderOk"; $leaveEventOrderOk),
          row("overallSmokeOk"; $overallSmokeOk),
          row("shotAccepted"; .shot_accepted),
          row("shotConflictStatus"; .shot_conflict_status),
          row("shotConflictCode"; .shot_conflict_code),
          row("shotInvalidStatus"; .shot_invalid_status),
          row("shotInvalidCode"; .shot_invalid_code),
          row("streamSnapshotEvent"; $streamOk),
          row("streamForbiddenStatus"; .forbidden_status),
          row("streamForbiddenCode"; .forbidden_code)
        ] | join("\n")
      '
  else
    echo "$SUMMARY_JSON" | jq -r \
      --arg gport "${GAME_SERVER_PORT:-9900}" \
      --arg wport "${WEB_PORT_VALUE:-9901}" \
      --arg streamOk "$STREAM_OK" \
      --arg shotLifecycleOrderOk "$SHOT_LIFECYCLE_ORDER_OK" \
      --arg turnDetailSyncOk "$TURN_DETAIL_SYNC_OK" \
      --arg leaveEventOrderOk "$LEAVE_EVENT_ORDER_OK" \
      --arg overallSmokeOk "$OVERALL_SMOKE_OK" '
        def line($k; $v): "- " + $k + ": `" + ($v|tostring) + "`";
        [
          "## Runtime Smoke Summary",
          "",
          line("game-server port"; $gport),
          line("web port"; $wport),
          line("health.ok"; .health_ok),
          line("hostGuestId"; .guest_id),
          line("secondGuestId"; .guest2_id),
          line("roomId"; .room_id),
          line("startState"; .start_state),
          line("detailState"; .detail_state),
          line("detailPlayerCount"; .detail_count),
          line("leaveHostDelegatedTo"; .leave_host_id),
          line("leavePlayerCount"; .leave_count),
          line("finalStateAfterLeave"; .final_state),
          line("finalWinnerAfterLeave"; .final_winner),
          line("hostGameStateAfterLeave"; .host_game_state),
          line("guest2GameStateAfterLeave"; .guest2_game_state),
          line("shotEventOrder(started,resolved,turn_changed)"; .shot_event_order),
          line("shotLifecycleOrderOk"; $shotLifecycleOrderOk),
          line("turnDetailSync(preDeadline,postDeadline,currentMember)"; .turn_detail_sync),
          line("turnDetailSyncOk"; $turnDetailSyncOk),
          line("leaveEventOrder(host_delegated,game_finished)"; .leave_event_order),
          line("leaveEventOrderOk"; $leaveEventOrderOk),
          line("overallSmokeOk"; $overallSmokeOk),
          line("shotAccepted"; .shot_accepted),
          line("shotConflictStatus"; .shot_conflict_status),
          line("shotConflictCode"; .shot_conflict_code),
          line("shotInvalidStatus"; .shot_invalid_status),
          line("shotInvalidCode"; .shot_invalid_code),
          line("streamSnapshotEvent"; $streamOk),
          line("streamForbiddenStatus"; .forbidden_status),
          line("streamForbiddenCode"; .forbidden_code)
        ] | join("\n")
      '
  fi
} >> "${GITHUB_STEP_SUMMARY}"

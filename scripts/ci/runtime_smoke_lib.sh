#!/usr/bin/env bash

read_json_field() {
  local file="$1"
  local jq_expr="$2"
  local fallback="$3"
  if [ ! -f "$file" ]; then
    printf "%s" "$fallback"
    return 0
  fi
  local value
  value="$(jq -r "$jq_expr // empty" "$file" 2>/dev/null || true)"
  if [ -z "$value" ]; then
    printf "%s" "$fallback"
  else
    printf "%s" "$value"
  fi
}

read_text_file_or_default() {
  local file="$1"
  local fallback="$2"
  if [ ! -f "$file" ]; then
    printf "%s" "$fallback"
    return 0
  fi
  local value
  value="$(cat "$file" 2>/dev/null || true)"
  if [ -z "$value" ]; then
    printf "%s" "$fallback"
  else
    printf "%s" "$value"
  fi
}

bool_from_event_file() {
  local file="$1"
  local event_name="$2"
  if [ -f "$file" ] && grep -q "event: ${event_name}" "$file" 2>/dev/null; then
    printf "true"
  else
    printf "false"
  fi
}

#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 4 ]; then
  echo "usage: $0 <topic> <key> <work_id> <model_name>" >&2
  exit 1
fi

topic_raw="$1"
key_raw="$2"
work_id="$3"
model_raw="$4"

trim() {
  printf '%s' "$1" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//'
}

sanitize_token() {
  # Keep user text (including Korean), but prevent path traversal / separators.
  printf '%s' "$1" | sed -E 's#[/\\]+#-#g; s/[[:cntrl:]]//g'
}

topic="$(sanitize_token "$(trim "$topic_raw")")"
key="$(sanitize_token "$(trim "$key_raw")")"
model_name="$(sanitize_token "$(trim "$model_raw")")"

if [ -z "$topic" ]; then
  topic="topic"
fi

if [ -z "$key" ] || [ -z "$model_name" ]; then
  echo "error: key/model_name must not be empty" >&2
  exit 1
fi

mkdir -p docs/discussions
file_path="docs/discussions/${topic}_${key}_${model_name}.md"

if [ -e "$file_path" ]; then
  echo "error: file already exists: $file_path" >&2
  exit 1
fi

created_at="$(date '+%Y-%m-%d %H:%M:%S %z')"

cat > "$file_path" <<EOF
# ${topic_raw}

- key: ${key_raw}
- work_id: ${work_id}
- model_name: ${model_name}
- created_at: ${created_at}

> 작성 규칙: 모든 섹션을 실제 분석 내용으로 채우고, 근거에는 파일 경로/라인을 포함한다.

## 배경
- 증상:
- 관찰 범위:

## 쟁점
- 논쟁 포인트:

## 선택지
- 선택지 A:
- 선택지 B:

## 결정
- 최종 결론:

## 근거
- 코드 근거 1:
- 코드 근거 2:

## 후속 작업
- 작업 1:
- 작업 2:
EOF

echo "$file_path"

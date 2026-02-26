#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

echo "[dev-agent] validate unity v2 core files"

required=(
  "unity-client/Assets/Scripts/Common/BilliardsTypes.cs"
  "unity-client/Assets/Scripts/Aim/DiamondMapper.cs"
  "unity-client/Assets/Scripts/Aim/HalfSystemSolver.cs"
  "unity-client/Assets/Scripts/Guide/GuidePathRenderer.cs"
  "unity-client/Assets/Scripts/Training/TrainingModeEvaluator.cs"
  "unity-client/Assets/Scripts/Runtime/BhcRoomApiDriver.cs"
)

for file in "${required[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "[dev-agent] missing file: $file" >&2
    exit 1
  fi
done

echo "[dev-agent] static checks"
rg -n "class DiamondMapper|class HalfSystemSolver|class GuidePathRenderer|class TrainingModeEvaluator|class BhcRoomApiDriver" unity-client/Assets/Scripts >/dev/null
rg -n "SseDownloadHandler|/lobby/rooms/.+/stream|ShouldUsePollingFallback" unity-client/Assets/Scripts/Runtime/BhcRoomApiDriver.cs >/dev/null

echo "[dev-agent] pass"

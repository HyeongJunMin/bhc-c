#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
UNITY_BIN="${UNITY_BIN:-/Applications/Unity/Unity.app/Contents/MacOS/Unity}"
PROJECT_PATH="$ROOT_DIR/unity-client"

"$UNITY_BIN" \
  -quit \
  -batchmode \
  -nographics \
  -projectPath "$PROJECT_PATH" \
  -executeMethod Bhc.UnityClient.Editor.WebGLBuild.Build

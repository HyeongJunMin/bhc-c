# Web 3-Cushion Billiards Input JSON Schema (MVP)

## 1. Purpose
This document defines a canonical JSON payload for shot input so client, server, replay, and validation logic all share one contract.

## 2. Schema Version
- `schemaName`: `shot_input`
- `schemaVersion`: `1.0.0`

## 2.1 Canonical Schema File
- Source of truth: `schemas/shot-input-v1.json`
- This document is a human-readable guide for the same schema contract.

## 3. JSON Schema (Draft 2020-12)
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://bhc.local/schemas/shot-input-v1.json",
  "title": "ShotInputV1",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schemaName",
    "schemaVersion",
    "roomId",
    "matchId",
    "turnId",
    "playerId",
    "clientTsMs",
    "shotDirectionDeg",
    "cueElevationDeg",
    "dragPx",
    "impactOffsetX",
    "impactOffsetY"
  ],
  "properties": {
    "schemaName": {
      "type": "string",
      "const": "shot_input"
    },
    "schemaVersion": {
      "type": "string",
      "const": "1.0.0"
    },
    "roomId": {
      "type": "string",
      "minLength": 1,
      "maxLength": 64
    },
    "matchId": {
      "type": "string",
      "minLength": 1,
      "maxLength": 64
    },
    "turnId": {
      "type": "string",
      "minLength": 1,
      "maxLength": 64
    },
    "playerId": {
      "type": "string",
      "minLength": 1,
      "maxLength": 64
    },
    "clientTsMs": {
      "type": "integer",
      "minimum": 0
    },
    "shotDirectionDeg": {
      "type": "number",
      "minimum": 0,
      "exclusiveMaximum": 360
    },
    "cueElevationDeg": {
      "type": "number",
      "minimum": 0,
      "maximum": 89
    },
    "dragPx": {
      "type": "number",
      "minimum": 10,
      "maximum": 1000
    },
    "impactOffsetX": {
      "type": "number",
      "minimum": -0.03075,
      "maximum": 0.03075
    },
    "impactOffsetY": {
      "type": "number",
      "minimum": -0.03075,
      "maximum": 0.03075
    },
    "inputSeq": {
      "type": "integer",
      "minimum": 0
    }
  }
}
```

## 4. Field Semantics
- `shotDirectionDeg`: Horizontal cue angle. Wrapped to `[0, 360)` if needed.
- `cueElevationDeg`: Vertical cue angle. Clamp to `[0, 89]`.
- `dragPx`: Mouse drag distance for stroke power. Clamp to `[10, 1000]`.
- `impactOffsetX`: Left/right hit-point offset from cue-ball center, meters.
- `impactOffsetY`: Up/down hit-point offset from cue-ball center, meters.
- `inputSeq`: Optional monotonic client sequence number for de-duplication.

## 5. Derived Values (Server)
Given accepted input:

1. Clamp values:
- `d = clamp(dragPx, 10, 1000)`
- `theta = wrap360(shotDirectionDeg)`
- `phi = clamp(cueElevationDeg, 0, 89)`

2. Enforce impact inside ball cap:
- `R = 0.03075`
- `r_off = sqrt(impactOffsetX^2 + impactOffsetY^2)`
- If `r_off > R`, reject as invalid input.
- If `r_off > 0.9 * R`, classify as miscue.

3. Compute target initial speed:
- `V0_min = 1.0 m/s`
- `V0_max = 13.89 m/s`
- `V0_target = V0_min + (d - 10) / 990 * (V0_max - V0_min)`

4. Convert to physical strike speed:
- `m_c = 0.50`
- `m_b = 0.21`
- `e_tip = 0.70`
- `v_c = V0_target * (m_c + m_b) / (m_c * (1 + e_tip))`
- `V0 = clamp((m_c * (1 + e_tip) / (m_c + m_b)) * v_c, V0_min, V0_max)`

## 6. Example Payload
```json
{
  "schemaName": "shot_input",
  "schemaVersion": "1.0.0",
  "roomId": "room_102",
  "matchId": "match_20260220_01",
  "turnId": "turn_17",
  "playerId": "player_a9",
  "clientTsMs": 1771545605123,
  "shotDirectionDeg": 215.4,
  "cueElevationDeg": 18.0,
  "dragPx": 420,
  "impactOffsetX": -0.008,
  "impactOffsetY": 0.010,
  "inputSeq": 331
}
```

## 7. Validation Failure Codes (Recommended)
- `ERR_TURN_NOT_OWNER`
- `ERR_TURN_TIMEOUT`
- `ERR_MATCH_NOT_IN_GAME`
- `ERR_OUT_OF_RANGE_DIRECTION`
- `ERR_OUT_OF_RANGE_ELEVATION`
- `ERR_OUT_OF_RANGE_DRAG`
- `ERR_OUT_OF_RANGE_IMPACT`
- `ERR_IMPACT_OUTSIDE_BALL`
- `ERR_DUPLICATE_INPUT_SEQ`

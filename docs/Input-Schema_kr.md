# 웹 3쿠션 당구 입력 JSON 스키마 (MVP)

## 1. 목적
이 문서는 샷 입력 페이로드를 표준화해 클라이언트, 서버, 리플레이, 검증 로직이 동일한 계약을 사용하도록 정의한다.

## 2. 스키마 버전
- `schemaName`: `shot_input`
- `schemaVersion`: `1.0.0`

## 2.1 기준 스키마 파일
- 기준 원본 파일: `schemas/shot-input-v1.json`
- 이 문서는 동일 계약을 사람이 읽기 쉽게 설명한 가이드다.

## 3. JSON 스키마 (Draft 2020-12)
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

## 4. 필드 의미
- `shotDirectionDeg`: 큐의 수평 각도. 필요 시 `[0, 360)`으로 래핑한다.
- `cueElevationDeg`: 큐의 수직 고각. `[0, 89]`로 클램프한다.
- `dragPx`: 스트로크 파워를 위한 마우스 드래그 거리. `[10, 1000]`로 클램프한다.
- `impactOffsetX`: 수구 중심 기준 좌우 당점 오프셋(미터 단위).
- `impactOffsetY`: 수구 중심 기준 상하 당점 오프셋(미터 단위).
- `inputSeq`: 중복 입력 제거를 위한 선택형 단조 증가 시퀀스 번호.

## 5. 파생값 계산 (서버)
입력 검증 통과 후:

1. 클램프:
- `d = clamp(dragPx, 10, 1000)`
- `theta = wrap360(shotDirectionDeg)`
- `phi = clamp(cueElevationDeg, 0, 89)`

2. 당점 유효성 검사:
- `R = 0.03075`
- `r_off = sqrt(impactOffsetX^2 + impactOffsetY^2)`
- `r_off > R`이면 잘못된 입력으로 거절한다.
- `r_off > 0.9 * R`이면 미스큐로 판정한다.

3. 목표 초기 속도 계산:
- `V0_min = 1.0 m/s`
- `V0_max = 13.89 m/s`
- `V0_target = V0_min + (d - 10) / 990 * (V0_max - V0_min)`

4. 물리식용 큐 타격 속도 환산:
- `m_c = 0.50`
- `m_b = 0.21`
- `e_tip = 0.70`
- `v_c = V0_target * (m_c + m_b) / (m_c * (1 + e_tip))`
- `V0 = clamp((m_c * (1 + e_tip) / (m_c + m_b)) * v_c, V0_min, V0_max)`

## 6. 예시 페이로드
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

## 7. 검증 실패 코드 (권장)
- `ERR_TURN_NOT_OWNER`
- `ERR_TURN_TIMEOUT`
- `ERR_MATCH_NOT_IN_GAME`
- `ERR_OUT_OF_RANGE_DIRECTION`
- `ERR_OUT_OF_RANGE_ELEVATION`
- `ERR_OUT_OF_RANGE_DRAG`
- `ERR_OUT_OF_RANGE_IMPACT`
- `ERR_IMPACT_OUTSIDE_BALL`
- `ERR_DUPLICATE_INPUT_SEQ`

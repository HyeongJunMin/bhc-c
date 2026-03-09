# Five & Half 연습 API (초안 v1)

## 1. 목적
이 문서는 다음 계약을 정의한다.
- Five & Half 시스템 예측
- 예측 타점을 기준으로 한 물리 시뮬레이션
- 테이블/사용자별 보정 계수 업데이트

이 계약은 `schemas/shot-input-v1.json`을 대체하지 않고, 별도 확장으로 사용한다.

## 2. 버전
- `schemaName`: `five_and_half_api`
- `schemaVersion`: `1.0.0`
- 기준 스키마 파일: `schemas/five-and-half-api-v1.json`

## 3. 엔드포인트

### 3.1 POST `/v1/systems/five-and-half/predict`
1쿠션 조준점과 3쿠션 예상 도달점을 계산한다.

요청 (`PredictRequest`):
- `tableProfile`: 테이블 치수/상태
- `layout`: 수구/목적구 배치
- `intent`: 경로 의도와 목표 쿠션
- `shotHint`: 보정 밴드 선택용 속도/회전 힌트(선택)

응답 (`PredictResponse`):
- `baseAim`: 보정 전 기본 시스템 타점
- `correctedAim`: 보정 후 타점
- `expectedThirdCushion`: 3쿠션 예상 인덱스
- `correctionBreakdown`: 요인별 보정량
- `confidence`: 0~1 신뢰도

### 3.2 POST `/v1/systems/five-and-half/simulate`
샷 입력으로 물리 시뮬레이션을 실행하고 궤적/이벤트를 반환한다.

요청 (`SimulateRequest`):
- `predict`: 3.1 결과(선택)
- `shotInput`: `shot-input-v1` 호환 권한 입력
- `physicsProfile`: 마찰/반발/회전 계수

응답 (`SimulateResponse`):
- `events`: 시간순 쿠션/공 충돌 이벤트
- `finalState`: 샷 종료 시 공 상태
- `errorMetrics`: 예측 대비 시뮬레이션 오차

### 3.3 POST `/v1/systems/five-and-half/calibrate`
샷 로그를 반영해 보정 계수를 갱신한다.

요청 (`CalibrateRequest`):
- `profileId`: 보정 프로필 키
- `samples`: 최근 시도 데이터(예측 + 시뮬레이션 + 결과)
- `strategy`: `ema` 또는 `batch_least_squares`

응답 (`CalibrateResponse`):
- `updatedProfile`: 갱신된 보정 계수
- `deltaSummary`: 변경 구간/크기 요약
- `appliedSampleCount`: 반영 샘플 수

## 4. 좌표 규칙
- 레일 인덱스는 정규화 스케일을 사용한다.
- Five & Half 기본 스케일은 코너 `50`, 다이아 간격 `10`이다.
- 내부 구현은 `0..100`을 사용해도 되지만 매핑 규칙을 보존해야 한다.
- 혼동 방지를 위해 모든 payload에 `indexScale`(`50` 또는 `100`)를 포함한다.

## 5. 에러 코드 (권장)
- `ERR_FAH_INVALID_LAYOUT`
- `ERR_FAH_UNSUPPORTED_INDEX_SCALE`
- `ERR_FAH_PREDICTION_OUT_OF_RANGE`
- `ERR_FAH_SIMULATION_DIVERGED`
- `ERR_FAH_CALIBRATION_NOT_ENOUGH_SAMPLES`
- `ERR_FAH_SCHEMA_VALIDATION_FAILED`

## 6. 검증
기준 JSON 스키마:
- `schemas/five-and-half-api-v1.json`


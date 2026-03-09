# Five & Half Practice API (Draft v1)

## 1. Purpose
This document defines a server contract for:
- Five & Half system prediction
- physics simulation based on a predicted aim point
- per-table/per-user calibration update

The contract is additive and does not replace `schemas/shot-input-v1.json`.

## 2. Version
- `schemaName`: `five_and_half_api`
- `schemaVersion`: `1.0.0`
- canonical schema file: `schemas/five-and-half-api-v1.json`

## 3. Endpoints

### 3.1 POST `/v1/systems/five-and-half/predict`
Calculates the first-cushion aim point and expected third-cushion landing.

Request (`PredictRequest`):
- `tableProfile`: table dimensions and condition
- `layout`: cue/object ball positions
- `intent`: desired route and target rail
- `shotHint`: optional speed/spin hint used for correction band selection

Response (`PredictResponse`):
- `baseAim`: raw system aim value before correction
- `correctedAim`: corrected aim value
- `expectedThirdCushion`: predicted third-cushion index
- `correctionBreakdown`: correction components by factor
- `confidence`: 0 to 1

### 3.2 POST `/v1/systems/five-and-half/simulate`
Runs physics simulation from an input shot and returns trajectory/events.

Request (`SimulateRequest`):
- `predict`: optional prediction result from endpoint 3.1
- `shotInput`: authoritative shot payload compatible with `shot-input-v1`
- `physicsProfile`: friction/restitution/spin coefficients

Response (`SimulateResponse`):
- `events`: cushion/ball contacts in time order
- `finalState`: ball states at shot end
- `errorMetrics`: distance/index deltas between prediction and simulation

### 3.3 POST `/v1/systems/five-and-half/calibrate`
Consumes shot result logs and updates correction coefficients.

Request (`CalibrateRequest`):
- `profileId`: calibration profile key
- `samples`: recent attempts (prediction + simulation + outcome)
- `strategy`: `ema` or `batch_least_squares`

Response (`CalibrateResponse`):
- `updatedProfile`: new correction coefficients
- `deltaSummary`: changed ranges and magnitudes
- `appliedSampleCount`

## 4. Coordinate Rule
- Rail index uses a normalized scale.
- Five & Half default scale: corner `50`, diamond step `10`.
- Implementations may internally use `0..100` while preserving a mapping rule.
- All API payloads must include `indexScale` (`50` or `100`) to avoid ambiguity.

## 5. Error Codes (Recommended)
- `ERR_FAH_INVALID_LAYOUT`
- `ERR_FAH_UNSUPPORTED_INDEX_SCALE`
- `ERR_FAH_PREDICTION_OUT_OF_RANGE`
- `ERR_FAH_SIMULATION_DIVERGED`
- `ERR_FAH_CALIBRATION_NOT_ENOUGH_SAMPLES`
- `ERR_FAH_SCHEMA_VALIDATION_FAILED`

## 6. Validation
Use the canonical JSON schema:
- `schemas/five-and-half-api-v1.json`


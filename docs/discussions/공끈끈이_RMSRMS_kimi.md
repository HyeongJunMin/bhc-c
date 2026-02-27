# 공끈끈이

- key: RMSRMS
- work_id: RMSRMS1
- model_name: kimi
- created_at: 2026-02-27 23:43:04 +0900

## 배경

공 간 충돌 시 입사각-반사각이 현실과 다르게 동작하며, 공들이 붙어서 엉기는 끈끈이 현상이 발생함.

## 쟁점

**파일**: `apps/web/src/core/SimplePhysics.ts`

### 원인 1: 과도한 위치 분리 (Separation)
```typescript
// SimplePhysics.ts 라인 210
const separationFactor = 1.05;  // ⚠️ 105% 분리
const separation = penetration * separationFactor;
```
겹침량의 105%를 분리시켜 공들이 실제보다 더 멀리 밀려남.

### 원인 2: 4번 반복 처리
```typescript
// SimplePhysics.ts 라인 78-81
for (let i = 0; i < 4; i++) {
  this.handleBallCollisions();  // ⚠️ 같은 프레임에서 4번 처리
}
```
같은 프레임 내에서 충돌을 4번 반복 처리하면서 위치 분리가 누적됨.

### 원인 3: 회전(Spin) 미고려
```typescript
// SimplePhysics.ts 라인 236-244
const tangent = new Vector3(-normal.z, 0, normal.x);
const velocityAlongTangent = relativeVelocity.dot(tangent);
const frictionImpulse = -velocityAlongTangent * 0.1;
```
회전을 전혀 고려하지 않고 단순 마찰만 적용되어 비현실적인 반발이 발생.

### 원인 4: 속도 업데이트 순서 문제
```typescript
// SimplePhysics.ts 라인 78-95
// 1. 위치 업데이트 전에 충돌 처리 (반복적으로 해결)
for (let i = 0; i < 4; i++) {
  this.handleBallCollisions();  // 위치만 분리, 속도는 나중에
}

// 2. 위치 업데이트
ball.position.add(ball.velocity.clone().multiplyScalar(dt));
```
충돌 시 위치만 분리하고 속도 업데이트는 나중에 하므로 공들이 "붙었다가 튕겨나가는" 현상이 발생.

## 선택지

### 옵션 A: separationFactor 감소
```typescript
const separationFactor = 0.5;  // 1.05 → 0.5
```

### 옵션 B: 반복 횟수 감소
```typescript
for (let i = 0; i < 2; i++) {  // 4 → 2
  this.handleBallCollisions();
}
```

### 옵션 C: 마찰 계수 감소
```typescript
const frictionImpulse = -velocityAlongTangent * 0.03;  // 0.1 → 0.03
```

### 옵션 D: 종합 수정
A+B+C 모두 적용 + 회전 고려 추가

## 결정

미정 - 검증 필요

## 근거

- 현재 물리 엔진은 실제 당구 물리와 차이가 큼
- `packages/physics-core/src/ball-ball-collision.ts`에는 더 정확한 구현이 존재 (회전 고려)
- 단순 수정 vs 정확한 물리 엔진 교체 중 선택 필요

## 후속 작업

1. `ball-ball-collision.ts`의 정확한 물리 구현 검토
2. `SimplePhysics.ts`에 통합 또는 교체 결정
3. 실제 게임 테스트로 입사각-반사각 검증

# Unity V2 개발/테스트 팀 루프

## 목적
사용자 개입 없이 V2 핵심 모듈(Half Solver, Diamond Mapper, Guide Renderer, Training Evaluator)을 지속 검증한다.

## 역할 분리
- Dev Agent: Unity V2 핵심 코드 구조와 필수 클래스 유지
- Test Agent: 서버 회귀 + 장시간 soak 검증

## 실행
```bash
scripts/agents/v2_team_loop.sh
```

자동 반복 실행(무인 루프):
```bash
scripts/agents/v2_auto_loop.sh
```

## 파라미터
- `MAX_ITERATIONS` (기본 `10`)
- `SOAK_DURATION_MS` (기본 `1200000`, 20분)
- `SOAK_TICK_MS` (기본 `500`)

예시:
```bash
MAX_ITERATIONS=20 SOAK_DURATION_MS=1200000 SOAK_TICK_MS=500 scripts/agents/v2_team_loop.sh
```

자동 루프 예시:
```bash
AUTO_LOOPS=3 MAX_ITERATIONS=1 SOAK_DURATION_MS=1200000 SOAK_TICK_MS=500 scripts/agents/v2_auto_loop.sh
```

요약 파서 예시:
```bash
AUTO_LOOPS=1 MAX_ITERATIONS=1 SOAK_DURATION_MS=1000 SOAK_TICK_MS=100 scripts/agents/v2_auto_loop.sh | node --experimental-strip-types scripts/qa/parse-auto-loop-summary.ts
```

## 게이트
1. Unity V2 핵심 파일 존재 및 클래스 시그니처 확인
2. `apps/game-server/src/lobby/http.test.ts` 통과
3. `scripts/qa/collect-play-errors.ts` 20분 시나리오 통과

## 산출 로그
- `/tmp/bhc_v2_lobby_test.log`
- `/tmp/bhc_v2_soak.log`

## JSON 로그 해석
- `scripts/agents/v2_test_agent.sh` 마지막 JSON:
  - `status`: `pass|fail`
  - `stage`: 실패 지점(`regression|soak`)
  - `soakErrorCount`: soak 루프 에러 수
- `scripts/agents/v2_team_loop.sh` 마지막 JSON:
  - `status`: `pass|fail`
  - `iteration/maxIterations`: 팀 루프 성공/실패 시점
  - `lobbyLogPath/soakLogPath`: 후속 분석 로그 파일 경로
- `scripts/agents/v2_auto_loop.sh` 마지막 JSON:
  - `status=completed`: 모든 사이클 통과
  - `status=fail`: 중간 사이클 실패(동일 출력 라인에 `cycle`, `reason` 포함)

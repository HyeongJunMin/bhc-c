# QA 메모리 관찰 기준/결과

## 1) 관찰 기준
- 관찰 대상: `game-server` 런타임 메모리(`rss`, `heapUsed`, `heapTotal`)
- 스모크 기준(운영 전 최소 통과선)
  - `rss`가 단시간 스모크에서 300MB 미만
  - `heapUsed`가 급격히 누적 증가(메시지/턴 루프당 지속 증가)하지 않을 것
  - 10분 플레이 로그 수집 중 치명 오류(`errorCount > 0`)가 없을 것
- 측정 커맨드
  - `node --experimental-strip-types -e "const m=process.memoryUsage(); ..."`
  - `QA_DURATION_MS=600000 QA_TICK_MS=1000 node --experimental-strip-types scripts/qa/collect-play-errors.ts`

## 2) 관찰 결과 (샘플)
- 측정 시각: 2026-02-22 10:19 (local)
- 메모리 스냅샷
  - `rssMB`: 41.92
  - `heapUsedMB`: 3.50
  - `heapTotalMB`: 5.64
- 플레이 로그 수집 샘플 실행
  - 커맨드: `QA_DURATION_MS=2000 QA_TICK_MS=500 node --experimental-strip-types scripts/qa/collect-play-errors.ts`
  - 결과: `loopCount=4`, `errorCount=0`
  - 로그 파일: `tmp/qa-play-errors.log`

## 3) 판정
- 샘플 기준으로는 메모리 사용량/오류 건수 모두 스모크 기준을 만족한다.
- 실제 릴리스 전에는 동일 스크립트를 `QA_DURATION_MS=600000`(10분)으로 실행해 재확인한다.

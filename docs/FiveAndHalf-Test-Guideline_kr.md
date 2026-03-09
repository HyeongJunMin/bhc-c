# Five&Half 테스트 가이드 (1,1 다이아 기준)

## 1) 목적
- 게임 모드와 분리된 `FAH 테스트 모드`에서
  - 고정 변수(당점/힘/출발점)로 반복 샷 데이터를 수집하고
  - 포인트별 편향(평균 오차)과 분산(표준편차)을 계산해
  - 보정값(`suggestedOffset`)을 산출한다.

## 2) 좌표/인덱스 기준 (고정)
- `1,1`은 항상 **다이아몬드 포인트 기준**이다.
- 테이블 평면 기준 좌표:
  - `x = tableWidth / 8`
  - `y = tableHeight / 4`
- 테스트 고정 입력:
  - 당점: 상-왼 `2팁` (엔진 입력에서는 `impactOffsetX=-0.4R`, `impactOffsetY=+0.4R`)
  - 파워: `30%` (`dragPx=127`, drag 범위 10..400 기준)

## 3) 시스템 공식(레퍼런스)
- 파이브앤하프 기본 공식:
  - `3쿠션수 = 수구수 - 1쿠션수`
  - 동치식: `1쿠션수 = 수구수 - 3쿠션수`
- 기본 당점 가정:
  - `2팁` 사용
- 출발점이 50라인이 아닐 때 보정:
  - 짧은각(예: 45/40/35/30 출발)에서는 짧아지는 보정 적용
  - 긴각(예: 70/80 출발)에서는 길어지는 보정 적용

## 4) 1,1 출발 지정 포인트 샷 가이드라인
1. `수구수(S_11)`를 먼저 고정한다.
   - 1,1 출발에서 기준 코스 10회로 `S_11`을 추정(테이블별로 다름).
2. 지정 `3쿠션 포인트(T)`를 정한다.
3. `1쿠션 목표(F)`는 `F = S_11 - T`로 계산한다.
4. `S_11`이 50 기준보다 짧은각/긴각 영역이면 출발보정을 적용한다.
5. 동일 조건(2팁 상좌, 30% 파워)으로 각 포인트를 `N=10`회 반복한다.
6. 포인트별로 아래를 기록한다.
   - `meanDelta` (평균 오차)
   - `ci95DeltaHalfWidth` (오차 평균의 95% 신뢰구간 반폭)
   - `stdDevDelta` (재현성)
   - `suggestedOffset = -meanDelta` (다음 샷 보정량)
   - `reproducibilityGrade` (`A/B/C/D/N/A`)

## 5) 실험 실행
- 배치 실행:
  - `npm run qa:fah-system-batch`
- 원클릭 실행(서버 자동 기동 + 배치 실행):
  - `npm run qa:fah-live-run`
- 주요 환경변수:
  - `FAH_BASE_URL` (기본 `http://localhost:9900`)
  - `FAH_PORT` (`qa:fah-live-run`에서 서버 기동 포트, 기본 `9900`)
  - `FAH_REPEATS` (기본 `10`)
  - `FAH_TARGET_POINTS` (기본 `10,20,30,40,50,60,70,80,90`)
- 산출물:
  - `tmp/fah/<runId>.ndjson` (샷별 원시 로그)
  - `tmp/fah/<runId>.summary.json` (요약 + correctionTable + `s11Estimate`)
  - `tmp/fah/<runId>.point-stats.csv` (포인트별 통계)

## 5-2) 사용자 실행 예시
```bash
# 기본 10회 반복
npm run qa:fah-live-run

# 반복/포인트 지정 실행
FAH_REPEATS=20 FAH_TARGET_POINTS=10,20,30,40,50 npm run qa:fah-live-run
```
- 실행 완료 후 콘솔의 `summaryPath`, `pointStatsCsvPath`를 확인한다.

## 5-1) S_11 자동 추정
- 각 샷에서 아래로 `estimatedS11`을 계산한다.
  - `observedThird = expectedThirdCushion + thirdCushionIndexDelta`
  - `estimatedS11 = correctedAim + observedThird`
- 전체 반복 샘플에서 `s11Estimate.mean/stdDev/ci95HalfWidth`를 산출한다.
- 엔진 반영 시에는 `s11Estimate.ci95HalfWidth`가 작은 구간(안정 구간)만 사용한다.

## 6) 엔진 반영 기준(권장)
- `stdDevDelta`가 큰 포인트는 엔진 상수 반영 전 제외/재측정.
- `stdDevDelta`가 안정된 포인트만 `correctionTable`에 반영.
- 1차 반영은 포인트별 오프셋 테이블, 2차 반영은 회귀식(속도/회전 포함)으로 확장.

## 참고 자료
- INPROD, 파이브앤하프 시스템(1): https://inprod.co.kr/%EA%B5%AD%EC%A0%9C%EC%8B%9D%EB%8C%80%EB%8C%80-3%EC%BF%A0%EC%85%98-%EB%8B%B9%EA%B5%AC-%ED%8C%8C%EC%9D%B4%EB%B8%8C%EC%95%A4%ED%95%98%ED%94%84-%EC%8B%9C%EC%8A%A4%ED%85%9C-1/
- INPROD, 파이브앤하프 시스템(4): https://inprod.co.kr/%EA%B5%AD%EC%A0%9C%EC%8B%9D%EB%8C%80%EB%8C%80-3%EC%BF%A0%EC%85%98-%EB%8B%B9%EA%B5%AC-%ED%8C%8C%EC%9D%B4%EB%B8%8C%EC%95%A4%ED%95%98%ED%94%84-%EC%8B%9C%EC%8A%A4%ED%85%9C-4/
- 당구노트 YouTube(Part 9): https://www.youtube.com/watch?v=J3lmGQcAmEk

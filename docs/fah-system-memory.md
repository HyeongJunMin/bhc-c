# FAH System Memory (Blog Baseline)

## Source
- Blog: `https://m.blog.naver.com/lbj6644/221445995404`
- Topic: Five-and-Half(파이브 앤 하프) 3쿠션 시스템 정리

## Core Rules
1. 색상 의미
- 붉은색: 수구수
- 검은색: 1쿠션수
- 파란색: 3쿠션수
- 노란색: 보정수치

2. 기본식
- `수구수 - 3쿠션수 = 1쿠션수`
- 실전에서는 보정수치(테이블/속도/당점) 적용 필수

3. 기준각 해석
- `수구수 50` 부근을 기준각으로 사용
- `50`보다 낮은 수구수: 짧아지는 경향
- `50`보다 높은 수구수: 길어지는 경향

4. 실전 순서
- 수구수 위치 파악
- 3쿠션 목표점 파악
- 식 대입으로 1쿠션 계산
- 실제 차이 발생 시 수구/1쿠션 재조정
- 마지막에 보정 적용

## Project Mapping (FAH / top-cam)
- Anchor button `P0~P45`는 1쿠션 기준 인덱스로 사용
- 기대 궤적은 `1 -> 2 -> 3 -> 4 쿠션` 인덱스로 관리
- FAH 전용 튜닝만 사용 (`fahTest` config override). `game/lobby/room`에는 적용 금지
- 가이드라인 렌더 우선순위:
  1) `bhc.fah.calibration.v1`의 학습(실측) 평균/보간값
  2) 데이터 부족 시 Baseline Guideline Table

## Baseline Guideline Table (P0~P45)
- 아래 값은 블로그 규칙 + 기존 프로젝트 앵커 기준을 통합한 기준선이다.
- 운영 중 검증 결과에 따라 허용오차 내에서 조정 가능하다.

| Anchor(first) | second | third | fourth | tol(second/third/fourth) |
|---|---:|---:|---:|---|
| P0  | 37 | 50 | 20(단쿠션)  | ±8 / ±8 / ±16 |
| P10 | 32 | 40 | 25(단쿠션)  | ±6 / ±6 / ±14 |
| P20 | 27 | 30 | 32(딘쿠샨)  | ±6 / ±6 / ±14 |
| P30 | 20 | 20 | 40(단쿠션) | ±6 / ±6 / ±14 |
| P40 | 10 | 10 | 100(장쿠션) | ±8 / ±6 / ±16 |
| P45 | 5 | 5  | 95(장쿠션)  | ±10 / ±8 / ±18 |

## Tuning Notes (FAH-only)
1. 짧아짐(under) 보정
- `pointCorrections` 증가(+)로 1쿠션 목표를 밀어줌
- 필요 시 `cushionRestitution` 상향, `cushionContactFriction` 하향

2. 길어짐(over) 보정
- `pointCorrections` 감소(-)로 1쿠션 목표를 당김
- 필요 시 `cushionRestitution` 하향, `cushionContactFriction` 상향

3. 스핀 민감도 조정
- `clothLinearSpinCouplingPerSec`, `spinDampingPerTick`을 같이 조정
- 과민하면 coupling 하향 + damping 상향

4. 속도 유지/감쇠 조정
- `cushionPostCollisionSpeedScale`, `linearDampingPerTick`으로 4쿠션 도착점 안정화

## Guardrail
- FAH 관련 수정은 반드시 `/test/fah` 경로에서만 검증
- 로비/룸/멀티플레이 스모크를 함께 실행해 무영향 확인

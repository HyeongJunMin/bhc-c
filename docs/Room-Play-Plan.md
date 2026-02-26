# Room Play 상세 구현 계획 (A안 우선)

## 1) 결정사항 고정
- 렌더링 시점: 탑뷰(정면 아님)
- 테이블 리소스: 이미지 1장
- 렌더링 기술: Canvas 2D
- 실시간 동기화 주기: 20Hz (50ms)
- 구현전략: A안 우선, B안은 TODO로 문서화

## 2) 에셋 경로 규약
- 테이블 이미지 경로: `apps/web/public/assets/table/table-top.png`
- 클라이언트 참조 URL: `/assets/table/table-top.png`
- 파일 정책:
  - 리사이즈/크롭은 코드에서 처리하고 원본 파일명은 고정한다.
  - 새 버전이 필요하면 `table-top-v2.png`처럼 suffix를 붙인다.

## 3) A안 아키텍처 (즉시 구현 대상)
- authoritative 서버: `apps/game-server`
- 전송 채널: 룸 단위 실시간 스트림(WebSocket)
- 서버 내부 시뮬레이션:
  - physics tick: 고정 tick(예: 120Hz)로 계산
  - snapshot broadcast: 20Hz로 클라이언트 전송
- 클라이언트 렌더:
  - Canvas 2D에 테이블 이미지 + 공(원/스프라이트) 렌더
  - 최신 snapshot 2개 기반 보간(interpolation)으로 60fps 표시

## 4) 20Hz 동기화 계약
- 서버 -> 클라이언트 메시지 타입
  - `room_snapshot`:
    - `roomId`, `seq`, `serverTimeMs`, `state`, `turn`
    - `balls[]`: `id`, `x`, `y`, `vx`, `vy`, `spinX`, `spinY`, `spinZ`, `isPocketed`
  - `shot_started`, `shot_resolved`, `turn_changed`, `game_finished`
- 입력(클라이언트 -> 서버)
  - `shot_submit` 1회성 명령만 허용
  - 샷 진행 중(`shot_running`)에는 추가 샷 제출 거부
- 재전송/누락 대응
  - A안에서는 full snapshot 위주로 복구
  - 클라이언트는 `seq` 역행 패킷 폐기

## 5) 구현 순서 (세션 인수인계용)
1. `ROOM-UI-002A`: 룸 Canvas 레이어/테이블 이미지 렌더 골격
2. `ROOM-UI-002B`: 월드좌표<->캔버스 좌표 변환/반응형 스케일
3. `ROOM-UI-002C`: 공 렌더/보간 루프 + HUD 기본 연결
4. `ROOM-NET-001A`: game-server 룸 실시간 스트림 엔드포인트
5. `ROOM-NET-001B`: 20Hz snapshot broadcaster + `seq` 증가
6. `ROOM-NET-001C`: web 서버 프록시/업그레이드 경로 연결
7. `ROOM-SIM-001A`: 샷 라이프사이클 상태(`idle/running/resolved`)
8. `ROOM-SIM-001B`: 물리 tick 결과를 snapshot 모델로 직렬화
9. `ROOM-SIM-001C`: 샷 종료/턴전환/득점 이벤트 브로드캐스트
10. `ROOM-INPUT-003A`: 캔버스 조준/드래그 UI
11. `ROOM-INPUT-003B`: 샷 요청 잠금/중복제출 방지 UX
12. `ROOM-INPUT-003C`: 에러코드/검증실패를 룸 UI에 통합 표시
13. `ROOM-QA-002A`: 단일 클라이언트 샷-종료 스모크
14. `ROOM-QA-002B`: 2클라이언트 동기화 오차 스모크
15. `ROOM-QA-002C`: 스트림 단절 시 fallback/polling 복구

## 6) B안 TODO (이번 범위 제외)
- delta compression + keyframe 혼합 전송
- client prediction + server reconciliation
- 입력 지연 보정(rollback/rewind) 연구
- 네트워크 품질별 가변 broadcast(10/20/30Hz)

## 7) 단계별 완료 기준(DoD)
- UI 단계 완료:
  - `/room/:id`에서 테이블 이미지와 공이 캔버스에 항상 보인다.
  - 브라우저 리사이즈 시 비율이 깨지지 않는다.
- 네트워크 단계 완료:
  - 룸 참가 클라이언트 2개에서 `seq` 증가 snapshot을 지속 수신한다.
  - 20Hz(허용 오차 ±10%)로 수신 로그가 관찰된다.
- 시뮬레이션 단계 완료:
  - 샷 1회 제출 -> 공 이동 -> 샷 종료 -> 턴 전환까지 이벤트 체인 완결.
- QA 단계 완료:
  - 룸 스모크 자동화에서 치명 오류 0건.

## 8) 검증 명령 초안
```bash
pnpm --filter @bhc/game-server run test
pnpm --filter @bhc/web run dev
node --experimental-strip-types scripts/qa/e2e-room-flow.ts
```

## 9) 리스크/대응
- 리스크: 20Hz 스냅샷만으로는 빠른 샷에서 끊김 체감 가능
- 대응: 클라이언트 보간 기본값 적용, B안을 후속 최적화로 분리


# 일감 단위 작업 워크플로우 (간단 버전)

## 1. 목적
- 마이크로 태스크 1개 완료마다 반드시 `commit + push` 한다.
- 커밋 메시지에 일감 번호와 작업 내용을 상세히 남긴다.

## 2. 대상 저장소
- 원격: `https://github.com/HyeongJunMin/bhc-c`

## 3. 기본 규칙
1. 한 번에 **Task ID 1개**만 `in_progress`로 잡는다.
2. 완료 시 `docs/Execution-Status.md`를 먼저 업데이트한다.
3. 같은 커밋에는 해당 Task와 직접 관련된 변경만 포함한다.
4. Task 완료마다 커밋 후 즉시 푸시한다.
5. 실패/보류 시에도 상태를 `blocked` 또는 `todo`로 되돌리고 이유를 남긴다.

## 4. 표준 작업 순서
1. Task 선택
- `docs/Execution-Backlog-Micro.md`에서 Task ID 선택
- `docs/Execution-Status.md`에서 해당 Task를 `in_progress`로 변경

2. 구현/문서/테스트 수행
- Task DoD를 만족하도록 변경
- 검증 명령 1~2개 실행

3. 진척도 기록
- `docs/Execution-Status.md`에 아래 반영
  - `Status: done`
  - `Validation`
  - `Next Task`
  - `Updated At`

4. 커밋/푸시
- 변경 파일 스테이징
- 규칙에 맞는 커밋 메시지 작성
- 원격 브랜치로 push

## 5. 커밋 메시지 규칙 (필수)
- 제목 형식:
  - `[TASK-ID] <작업 요약>`
- 본문 형식:
  - `왜 변경했는지`
  - `무엇을 변경했는지(파일/핵심 로직)`
  - `검증 결과(실행 명령 + 통과 여부)`
  - `다음 Task ID`

예시:
```text
[RULE-003B] N프레임 기반 샷 종료 판정 로직 구현

턴 종료 타이밍이 불안정해 조기 종료/무한 턴 가능성이 있어 종료 판정을 강화했다.
- packages/physics-core/src/shotEnd.ts: 연속 프레임 정지 판정 추가
- apps/game-server/src/turn.ts: 샷 종료 이벤트 연동
- docs/Execution-Status.md: RULE-003B done 처리

Validation:
- pnpm test --filter physics-core (pass)
- pnpm test --filter game-server (pass)

Next Task:
- RULE-003C
```

## 6. 권장 명령 템플릿
```bash
# 1) 변경 확인
git status

# 2) 관련 파일만 스테이징
git add <file1> <file2> <file3>

# 3) 커밋
git commit -m "[TASK-ID] <작업 요약>" -m "<상세 설명/검증/다음 Task>"

# 4) 푸시
git push origin <branch>
```

## 7. 브랜치 전략 (간단)
- 기본: `main`에서 작업하지 않고 task 브랜치 사용
- 브랜치명:
  - `task/<TASK-ID>-<short-slug>`
- 예:
  - `task/RULE-003B-shot-end-check`

## 8. PR 규칙 (선택, 권장)
- Task 1~3개 단위로 PR 생성
- PR 본문에 아래 4개를 반드시 포함
  1. Task ID
  2. 변경 파일
  3. 검증 명령 결과
  4. 다음 Task ID

## 9. 체크리스트 (작업 종료 시)
- [ ] Task DoD 만족
- [ ] `docs/Execution-Status.md` 업데이트
- [ ] 커밋 메시지에 Task ID 포함
- [ ] 검증 결과 커밋 본문 기재
- [ ] push 완료

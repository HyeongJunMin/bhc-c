# 3쿠션 당구 게임 E2E 테스트 계획

## 🎯 테스트 목적

Three.js + Ammo.js로 구현된 3쿠션 당구 게임의 **시각적 정확성**, **물리 엔진 신뢰성**, **UI 상호작용**을 자동화하여 검증합니다.

## 📁 테스트 구조

```
e2e/
├── billiard-game.spec.ts       # 메인 테스트 파일
├── __snapshots__/              # 스크린샷 비교용 기준 이미지
│   └── billiard-game.spec.ts/
│       ├── initial-game-state.png
│       ├── cue-ball-position-0.png
│       ├── cue-ball-position-25.png
│       └── ...
└── README.md                   # 이 파일
```

## 🚀 실행 방법

### 기본 테스트
```bash
npm run test:e2e
```

### UI 모드 (시각적 디버깅)
```bash
npm run test:e2e:ui
```

### 디버그 모드 (브레이크포인트)
```bash
npm run test:e2e:debug
```

### 스냅샷 업데이트 (UI 변경 시)
```bash
npm run test:e2e:update
```

## 📊 테스트 단계별 계획

### Phase 1: 설치 및 설정 ✅
- [x] Playwright 설치
- [x] Chromium 브라우저 다운로드
- [x] 설정 파일 구성 (playwright.config.ts)
- [x] 게임 객체 window 노출

### Phase 2: 시각적 회귀 테스트 (Visual Regression)
**목적**: UI 변경 시 의도치 않은 시각적 변화 감지

| 테스트 케이스 | 설명 | 스냅샷 파일 |
|--------------|------|------------|
| 초기 화면 | 테이블 + 3개 공 + UI | `initial-game-state.png` |
| 수구 위치 0P | 좌측 끝 | `cue-ball-position-0.png` |
| 수구 위치 25P | 중앙 | `cue-ball-position-25.png` |
| 수구 위치 50P | 우측 끝 | `cue-ball-position-50.png` |
| 하프 시스템 | 기본 UI | `system-half.png` |
| 파이브앤하프 | 시스템 변경 | `system-five-and-half.png` |
| 플러스투 | 시스템 변경 | `system-plus-two.png` |

### Phase 3: 기능 테스트 (UI Interaction)
**목적**: 사용자 상호작용의 정확한 동작 검증

| 테스트 케이스 | 검증 내용 | 성공 기준 |
|--------------|----------|----------|
| 수구 슬라이더 | 0P→50P 이동 | 공 X좌표: -14.2 → +14.2 |
| 키보드 단축키 | 1/2/3 키 | 시스템 변경 확인 |
| 궤적 토글 | 체크박스 | 라인 표시/숨김 |
| 샷 실행 | 스페이스바 | velocity > 0, isMoving = true |

### Phase 4: 물리 엔진 검증
**목적**: Ammo.js 물리 시뮬레이션의 정확성

| 테스트 케이스 | 검증 내용 | 허용 오차 |
|--------------|----------|----------|
| 테이블 범위 | 공이 쿠션 안에 있음 | ±14.2 (X), ±7.1 (Z) |
| 공 존재성 | 3개 공 모두 존재 | N/A |
| 중력 적용 | Y좌표 >= 반지름 | y >= 0.615 |
| 샷 완료 | 공이 멈추면 턴 종료 | isMoving = false |

### Phase 5: 성능 테스트
**목적**: 게임의 성능 기준 충족 확인

| 테스트 케이스 | 목표 | 실패 기준 |
|--------------|------|----------|
| 초기 로딩 | < 5초 | > 5초 |
| 프레임 레이트 | > 30fps | < 30fps |

## 🔧 테스트 개발 워크플로우

### 1. 새로운 테스트 추가
```typescript
test('새로운 기능 테스트', async ({ page }) => {
  // Given: 초기 상태 설정
  await page.goto('/');
  await page.waitForTimeout(3000);
  
  // When: 동작 실행
  await page.click('button');
  
  // Then: 결과 검증
  await expect(page).toHaveScreenshot('new-feature.png');
});
```

### 2. 스냅샷 업데이트 (의도된 UI 변경)
```bash
# 변경된 UI가 의도된 경우에만 실행
npm run test:e2e:update
```

### 3. CI/CD 통합
```yaml
# .github/workflows/test.yml (예시)
- name: Run E2E tests
  run: |
    npm run test:e2e
```

## 🐛 디버깅 팁

### 테스트 실패 시 확인 사항

1. **스크린샷 비교 실패**
   - `playwright-report/` 폼더에서 diff 이미지 확인
   - 작은 픽셀 차이는 `maxDiffPixels` 설정 조정

2. **게임 객체 접근 실패**
   ```javascript
   // 브라우저 콘솔에서 확인
   window.game          // BilliardGame 인스턴스
   window.gameState     // 현재 게임 상태
   ```

3. **물리 엔진 타이밍**
   - `waitForTimeout` 대신 `waitForFunction` 사용 권장
   - Ammo.js 초기화는 최소 3초 대기

### 유용한 Playwright 명령어

```bash
# 특정 테스트만 실행
npx playwright test -g "수구 위치"

# 헤드리스 모드 비활성화 (브라우저 보기)
npx playwright test --headed

# 반복 실행 (플레이크 테스트 확인)
npx playwright test --repeat-each=10

# 코드 생성 (테스트 자동 작성)
npx playwright codegen http://localhost:9900
```

## 📈 테스트 결과 해석

### 보고서 위치
- HTML 보고서: `playwright-report/index.html`
- 스크린샷: `e2e/__snapshots__/`
- 비디오: `test-results/` (실패 시)

### 성공 기준
- 모든 Phase 2-4 테스트 통과
- 스냅샷 diff < 100픽셀
- 성능 테스트 기준 충족

### 실패 대응
| 실패 유형 | 대응 방법 |
|----------|----------|
| 스냅샷 mismatch | UI 변경 의도 확인 → update 또는 버그 수정 |
| 물리 값 오차 | 오차 범위 조정 또는 엔진 버그 수정 |
| 타임아웃 | 성능 최적화 또는 대기 시간 증가 |

## 🔄 향후 확장 계획

- [ ] 멀티플레이어 동기화 테스트
- [ ] 모바일 반응형 테스트
- [ ] 샷 결과 예측 정확도 테스트 (AI vs 물리 엔진)
- [ ] 메모리 누수 테스트 (장시간 실행)

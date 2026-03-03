import { test, expect } from '@playwright/test';

test.describe('3쿠션 당구 게임 자동화 테스트', () => {
  // 테스트 타임아웃 설정 (60초)
  test.setTimeout(60000);
  
  // 각 테스트 전 페이지 로드
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Ammo.js 로딩 대기
    await page.waitForTimeout(3000);
  });

  // ============================================================
  // Phase 2: 시각적 회귀 테스트 (Visual Regression)
  // ============================================================
  
  test.describe('시각적 회귀 테스트', () => {
    
    test('초기 화면 - 테이블 및 공 배치 확인', async ({ page }) => {
      // Three.js 씬이 렌더링될 때까지 대기
      await page.waitForTimeout(2000);
      
      // 전체 화면 스크린샷
      await expect(page).toHaveScreenshot('initial-game-state.png', {
        fullPage: true,
      });
    });

    test('수구 위치 변경 시 시각적 변화', async ({ page }) => {
      const slider = page.locator('input[type="range"]').first();
      
      // 초기 상태 스크린샷
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('cue-ball-position-25.png');
      
      // 수구 위치 0으로 변경
      await slider.fill('0');
      await page.waitForTimeout(500); // 애니메이션 대기
      await expect(page).toHaveScreenshot('cue-ball-position-0.png');
      
      // 수구 위치 50으로 변경
      await slider.fill('50');
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot('cue-ball-position-50.png');
    });

    test('시스템 변경 시 UI 상태', async ({ page }) => {
      // 하프 시스템 (기본)
      await expect(page).toHaveScreenshot('system-half.png');
      
      // 파이브앤하프 시스템
      await page.keyboard.press('2');
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot('system-five-and-half.png');
      
      // 플러스투 시스템
      await page.keyboard.press('3');
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot('system-plus-two.png');
    });
  });

  // ============================================================
  // Phase 3: 기능 테스트 (UI Interaction)
  // ============================================================
  
  test.describe('UI 상호작용 테스트', () => {
    
    test('수구 위치 슬라이더 - 값 변경 확인', async ({ page }) => {
      const slider = page.locator('input[type="range"]').first();
      const valueLabel = page.locator('text=/수구 위치/');
      
      // 초기 값 확인
      await expect(valueLabel).toContainText('25P');
      
      // 0으로 변경
      await slider.fill('0');
      await expect(valueLabel).toContainText('0P');
      
      // 50으로 변경
      await slider.fill('50');
      await expect(valueLabel).toContainText('50P');
    });

    test('키보드 단축키 - 시스템 변경', async ({ page }) => {
      const getSystemName = async () => {
        return page.locator('text=/하프|파이브|플러스/').textContent();
      };

      // 기본: 하프 시스템
      expect(await getSystemName()).toContain('하프');

      // 2번 키: 파이브앤하프
      await page.keyboard.press('2');
      await page.waitForTimeout(300);
      expect(await getSystemName()).toContain('파이브');

      // 3번 키: 플러스투
      await page.keyboard.press('3');
      await page.waitForTimeout(300);
      expect(await getSystemName()).toContain('플러스');

      // 1번 키: 다시 하프
      await page.keyboard.press('1');
      await page.waitForTimeout(300);
      expect(await getSystemName()).toContain('하프');
    });

    test('궤적 표시 토글', async ({ page }) => {
      // 궤적이 보이는 상태
      await page.waitForTimeout(1000);
      const withTrajectory = await page.screenshot();

      // 체크박스 해제
      await page.locator('label:has-text("궤적 표시") input').uncheck();
      await page.waitForTimeout(500);
      const withoutTrajectory = await page.screenshot();

      // 스크린샷이 달라야 함
      expect(withTrajectory).not.toEqual(withoutTrajectory);
    });

    test('샷 실행 - UI 상태 변경 확인', async ({ page }) => {
      // 초기 상태: aiming
      await expect(page.locator('button:has-text("샷 실행")')).toBeVisible();
      
      // 스페이스바로 샷 실행
      await page.keyboard.press(' ');
      await page.waitForTimeout(100);

      // 버튼이 사라지거나 상태가 변경됨
      await expect(page.locator('button:has-text("샷 실행")')).not.toBeVisible();
    });
  });

  // ============================================================
  // Phase 4: 물리 엔진 검증 테스트 (개발 환경에서만 실행)
  // ============================================================
  
  test.describe('물리 엔진 검증', () => {
    
    test('공이 테이블 범위를 벗어나지 않음', async ({ page }) => {
      const slider = page.locator('input[type="range"]').first();
      
      // 극단적인 위치 테스트
      for (const position of [0, 10, 25, 40, 50]) {
        await slider.fill(position.toString());
        await page.waitForTimeout(200);
        
        // 스크린샷으로 시각적 확인 (공이 테이블 위에 있음)
        await expect(page).toHaveScreenshot(`ball-position-${position}.png`);
      }
    });

    test('3개의 공이 모두 보이는지 확인', async ({ page }) => {
      // 시각적으로 3개 공 확인
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('three-balls-visible.png');
    });
  });

  // ============================================================
  // 성능 테스트
  // ============================================================
  
  test.describe('성능 테스트', () => {
    
    test('페이지 로딩 및 렌더링', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/');
      
      // 캔버스가 렌더링될 때까지 대기
      await page.waitForSelector('canvas', { timeout: 10000 });
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(10000); // 10초 이내
      
      // 3초 후에도 캔버스가 존재
      await page.waitForTimeout(3000);
      const canvas = page.locator('canvas');
      await expect(canvas).toBeVisible();
    });
  });
});

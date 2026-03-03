import { test, expect } from '@playwright/test';

/**
 * 3쿠션 당구 게임 핵심 기능 검증 (Smoke Test)
 * 
 * 테스트 목표:
 * 1. 페이지가 로드되는가?
 * 2. Three.js 씬이 렌더링되는가?
 * 3. UI가 상호작용 가능한가?
 */

test.describe('3쿠션 당구 게임 - 핵심 검증', () => {
  test.setTimeout(60000);
  
  // 모든 테스트에서 사용할 뷰포트 설정
  test.use({
    viewport: { width: 1920, height: 1080 },
  });

  test('페이지 로드 및 씬 렌더링 확인', async ({ page }) => {
    await page.goto('/');
    
    // 1. 페이지 타이틀 확인
    await expect(page).toHaveTitle(/3-Cushion|Billiards/);
    
    // 2. Three.js 씬 로딩 대기 (3초)
    await page.waitForTimeout(3000);
    
    // 3. 스크린샷으로 씬 확인
    await expect(page).toHaveScreenshot('game-loaded.png', {
      fullPage: true,
    });
  });

  test('UI 요소 존재 확인', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);
    
    // 점수판
    await expect(page.locator('text=3-Cushion')).toBeVisible();
    await expect(page.locator('text=Player 1')).toBeVisible();
    await expect(page.locator('text=Player 2')).toBeVisible();
    
    // 시스템 패널
    await expect(page.locator('text=하프 시스템')).toBeVisible();
    
    // 컨트롤
    await expect(page.locator('input[type="range"]')).toHaveCount(2); // 수구 위치 + 파워
    await expect(page.locator('button:has-text("샷 실행")')).toBeVisible();
    await expect(page.locator('text=궤적 표시')).toBeVisible();
  });

  test('슬라이더 상호작용', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);
    
    const slider = page.locator('input[type="range"]').first();
    const valueLabel = page.locator('text=/수구 위치/');
    
    // 초기값 25
    await expect(valueLabel).toContainText('25P');
    
    // 0으로 변경
    await slider.fill('0');
    await expect(valueLabel).toContainText('0P');
    
    // 50으로 변경
    await slider.fill('50');
    await expect(valueLabel).toContainText('50P');
    
    // 시각적 변화 스크린샷
    await expect(page).toHaveScreenshot('slider-at-50.png');
  });

  test('시스템 변경 키보드 단축키', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);
    
    // 하프 시스템 (기본)
    await expect(page.locator('text=하프 시스템')).toBeVisible();
    
    // 2번: 파이브앤하프
    await page.keyboard.press('2');
    await page.waitForTimeout(500);
    await expect(page.locator('text=파이브')).toBeVisible();
    await expect(page).toHaveScreenshot('system-five-and-half.png');
    
    // 3번: 플러스투
    await page.keyboard.press('3');
    await page.waitForTimeout(500);
    await expect(page.locator('text=플러스')).toBeVisible();
    await expect(page).toHaveScreenshot('system-plus-two.png');
    
    // 1번: 하프로 복귀
    await page.keyboard.press('1');
    await page.waitForTimeout(500);
    await expect(page.locator('text=하프 시스템')).toBeVisible();
  });

  test('샷 실행 플로우', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);
    
    // 초기 상태: 샷 버튼 보임
    const shotButton = page.locator('button:has-text("샷 실행")');
    await expect(shotButton).toBeVisible();
    
    // 스크린샷: aiming 상태
    await expect(page).toHaveScreenshot('aiming-state.png');
    
    // 샷 실행
    await page.keyboard.press(' ');
    await page.waitForTimeout(500);
    
    // 샷 버튼이 사라짐 (shooting/simulating 상태)
    await expect(shotButton).not.toBeVisible();
    
    // 10초 이내에 공이 멈추고 aiming 상태로 복귀
    await expect(shotButton).toBeVisible({ timeout: 15000 });
    
    // 복귀 후 스크린샷
    await expect(page).toHaveScreenshot('returned-to-aiming.png');
  });
});

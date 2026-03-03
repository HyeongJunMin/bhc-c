import { defineConfig, devices } from '@playwright/test';

/**
 * 3쿠션 당구 게임 Playwright 설정
 * 
 * 테스트 범위:
 * 1. 시각적 회귀 테스트 (스크린샷 비교)
 * 2. UI 상호작용 테스트 (슬라이더, 버튼)
 * 3. 물리 엔진 검증 (공 위치, 쿠션 충돌)
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list']
  ],
  
  use: {
    baseURL: 'http://localhost:9900',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    // Three.js 렌더링을 위한 설정
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  },

  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // WebGL 활성화 (헤드리스 모드에서도)
        launchOptions: {
          args: [
            '--use-gl=swiftshader',           // 소프트웨어 렌더링
            '--enable-webgl',                  // WebGL 활성화
            '--enable-webgl2',                 // WebGL2 활성화
            '--ignore-gpu-blocklist',          // GPU 블랙리스트 무시
            '--no-sandbox',                    // 샌드박스 비활성화
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
          ]
        }
      },
    },
  ],

  // 개발 서버 자동 실행
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:9900',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  // 스냅샷 설정
  snapshotPathTemplate: '{testDir}/__snapshots__/{testFilePath}/{arg}{ext}',
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 100, // 작은 차이는 허용
      threshold: 0.2,
    },
    toMatchSnapshot: {
      maxDiffPixelRatio: 0.02,
    },
  },
});

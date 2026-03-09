import { spawn } from 'node:child_process';

async function run(): Promise<void> {
  console.log('[fah-physics-batch] 3쿠션 물리엔진 기반 FAH 배치 진단 실행');
  console.log('[fah-physics-batch] FAH 튜닝 계수는 FAH 전용 오버라이드만 사용');

  const child = spawn(
    'node',
    ['--experimental-strip-types', 'scripts/qa/fah-system-diagnostic.ts'],
    {
      env: { ...process.env },
      stdio: 'inherit',
    },
  );

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    throw new Error(`fah-system-diagnostic failed with code ${exitCode}`);
  }
}

run().catch((error) => {
  console.error('[fah-physics-batch] failed:', error);
  process.exit(1);
});

import { spawn } from 'node:child_process';
import process from 'node:process';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(baseUrl: string, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // ignore until timeout
    }
    await sleep(250);
  }
  throw new Error(`health check timeout: ${baseUrl}/health (${timeoutMs}ms)`);
}

async function isHealthReachable(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function run(): Promise<void> {
  const port = Number(process.env.FAH_PORT ?? '9900');
  const baseUrl = process.env.FAH_BASE_URL?.trim() || `http://localhost:${port}`;
  const healthTimeoutMs = Number(process.env.FAH_HEALTH_TIMEOUT_MS ?? '15000');

  const externalServerReady = await isHealthReachable(baseUrl);
  let server: ReturnType<typeof spawn> | null = null;
  let serverExited = false;

  if (!externalServerReady) {
    server = spawn(
      'node',
      ['--experimental-strip-types', 'apps/game-server/src/main.ts'],
      {
        env: {
          ...process.env,
          PORT: String(port),
        },
        stdio: 'inherit',
      },
    );
    server.on('exit', () => {
      serverExited = true;
    });
  } else {
    console.log(`[fah-live-run] using existing server: ${baseUrl}`);
  }

  const shutdown = () => {
    if (server && !serverExited) {
      server.kill('SIGTERM');
    }
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    if (!externalServerReady) {
      await waitForHealth(baseUrl, healthTimeoutMs);
    }

    const batch = spawn(
      'node',
      ['--experimental-strip-types', 'scripts/qa/five-and-half-system-batch.ts'],
      {
        env: {
          ...process.env,
          FAH_BASE_URL: baseUrl,
        },
        stdio: 'inherit',
      },
    );

    const batchExitCode = await new Promise<number>((resolve, reject) => {
      batch.on('error', reject);
      batch.on('exit', (code) => resolve(code ?? 1));
    });

    if (batchExitCode !== 0) {
      throw new Error(`batch script failed with code ${batchExitCode}`);
    }
  } finally {
    shutdown();
    await sleep(300);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

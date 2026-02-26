import { appendFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { createTurnState, handleTurnTimeout } from '../../apps/game-server/src/game/turn-policy.ts';
import { createScoreBoard, increaseScoreAndCheckGameEnd } from '../../apps/game-server/src/game/score-policy.ts';

type QaLog = {
  ts: string;
  step: string;
  message: string;
};

const durationMs = Number(process.env.QA_DURATION_MS ?? '600000');
const tickMs = Number(process.env.QA_TICK_MS ?? '1000');
const heartbeatIntervalMs = Number(process.env.QA_HEARTBEAT_INTERVAL_MS ?? '60000');
const logDir = resolve(process.cwd(), 'tmp');
const logPath = resolve(logDir, 'qa-play-errors.log');

function writeLog(entry: QaLog): void {
  appendFileSync(logPath, `${JSON.stringify(entry)}\n`, 'utf8');
}

async function run(): Promise<void> {
  mkdirSync(logDir, { recursive: true });
  writeLog({
    ts: new Date().toISOString(),
    step: 'run_started',
    message: JSON.stringify({ durationMs, tickMs, heartbeatIntervalMs }),
  });

  const startedAt = Date.now();
  let loopCount = 0;
  let errorCount = 0;
  const heartbeatEveryLoops = Math.max(1, Math.floor(heartbeatIntervalMs / Math.max(1, tickMs)));

  while (Date.now() - startedAt < durationMs) {
    loopCount += 1;

    try {
      const turnState = createTurnState(['p1', 'p2']);
      handleTurnTimeout(turnState);

      const scoreBoard = createScoreBoard(['p1', 'p2']);
      increaseScoreAndCheckGameEnd(scoreBoard, 'p1');
    } catch (error) {
      errorCount += 1;
      writeLog({
        ts: new Date().toISOString(),
        step: `loop-${loopCount}`,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    if (loopCount % heartbeatEveryLoops === 0) {
      writeLog({
        ts: new Date().toISOString(),
        step: 'heartbeat',
        message: JSON.stringify({
          loopCount,
          errorCount,
          elapsedMs: Date.now() - startedAt,
        }),
      });
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, tickMs));
  }

  const summary = {
    durationMs,
    tickMs,
    loopCount,
    errorCount,
    logPath,
  };
  writeLog({
    ts: new Date().toISOString(),
    step: 'run_completed',
    message: JSON.stringify(summary),
  });
  console.log(JSON.stringify(summary, null, 2));
}

run().catch((error) => {
  writeLog({
    ts: new Date().toISOString(),
    step: 'fatal',
    message: error instanceof Error ? error.stack ?? error.message : String(error),
  });
  process.exit(1);
});

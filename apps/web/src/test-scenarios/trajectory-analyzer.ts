import type { SimResult, SimEvent } from '../../../../packages/physics-core/src/standalone-simulator.ts';

export type BallDeviation = {
  ballId: string;
  maxDeviationM: number;
  avgDeviationM: number;
  divergeFrameIndex: number | null;
};

export type EventMatchResult = {
  matched: number;
  total: number;
  matchRatePct: number;
};

export type AnalysisResult = {
  passed: boolean;
  ballDeviations: BallDeviation[];
  eventMatch: EventMatchResult;
  maxDeviationM: number;
  avgDeviationM: number;
  divergeFrameIndex: number | null;
};

export type AnalysisOptions = {
  toleranceM?: number;
  divergeThresholdM?: number;
};

const DEFAULT_TOLERANCE_M = 0.005; // 5mm
const DEFAULT_DIVERGE_THRESHOLD_M = 0.05; // 50mm

export function analyzeTrajectory(
  actual: SimResult,
  baseline: SimResult,
  options: AnalysisOptions = {},
): AnalysisResult {
  const toleranceM = options.toleranceM ?? DEFAULT_TOLERANCE_M;
  const divergeThresholdM = options.divergeThresholdM ?? DEFAULT_DIVERGE_THRESHOLD_M;

  const commonFrames = Math.min(actual.frames.length, baseline.frames.length);
  const ballIds = new Set<string>();
  if (actual.frames[0]) {
    actual.frames[0].balls.forEach((b) => ballIds.add(b.id));
  }

  const ballDeviations: BallDeviation[] = [];
  let globalMaxDeviation = 0;
  let globalTotalDeviation = 0;
  let globalCount = 0;
  let globalDivergeFrame: number | null = null;

  for (const ballId of ballIds) {
    let maxDev = 0;
    let totalDev = 0;
    let count = 0;
    let divergeFrameIndex: number | null = null;

    for (let i = 0; i < commonFrames; i += 1) {
      const actualFrame = actual.frames[i];
      const baselineFrame = baseline.frames[i];
      if (!actualFrame || !baselineFrame) continue;

      const actualBall = actualFrame.balls.find((b) => b.id === ballId);
      const baselineBall = baselineFrame.balls.find((b) => b.id === ballId);
      if (!actualBall || !baselineBall) continue;

      const dx = actualBall.x - baselineBall.x;
      const dy = actualBall.y - baselineBall.y;
      const dist = Math.hypot(dx, dy);

      maxDev = Math.max(maxDev, dist);
      totalDev += dist;
      count += 1;
      globalCount += 1;
      globalTotalDeviation += dist;
      globalMaxDeviation = Math.max(globalMaxDeviation, dist);

      if (divergeFrameIndex === null && dist > divergeThresholdM) {
        divergeFrameIndex = i;
        if (globalDivergeFrame === null || i < globalDivergeFrame) {
          globalDivergeFrame = i;
        }
      }
    }

    ballDeviations.push({
      ballId,
      maxDeviationM: maxDev,
      avgDeviationM: count > 0 ? totalDev / count : 0,
      divergeFrameIndex,
    });
  }

  const avgDeviationM = globalCount > 0 ? globalTotalDeviation / globalCount : 0;
  const eventMatch = matchEvents(actual.events, baseline.events);
  const passed = globalMaxDeviation <= toleranceM && eventMatch.matchRatePct >= 80;

  return {
    passed,
    ballDeviations,
    eventMatch,
    maxDeviationM: globalMaxDeviation,
    avgDeviationM,
    divergeFrameIndex: globalDivergeFrame,
  };
}

function matchEvents(actual: SimEvent[], baseline: SimEvent[]): EventMatchResult {
  if (baseline.length === 0) {
    return { matched: actual.length, total: 0, matchRatePct: 100 };
  }

  let matched = 0;
  const usedActualIndices = new Set<number>();

  for (const baselineEvent of baseline) {
    for (let i = 0; i < actual.length; i += 1) {
      if (usedActualIndices.has(i)) continue;
      const a = actual[i];
      if (!a) continue;
      if (
        a.type === baselineEvent.type &&
        a.ballId === baselineEvent.ballId &&
        a.targetId === baselineEvent.targetId &&
        Math.abs(a.frameIndex - baselineEvent.frameIndex) <= 3
      ) {
        matched += 1;
        usedActualIndices.add(i);
        break;
      }
    }
  }

  const total = baseline.length;
  const matchRatePct = total > 0 ? (matched / total) * 100 : 100;
  return { matched, total, matchRatePct };
}

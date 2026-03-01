import type { SimulationResult, SimEvent } from '@physics-core/standalone-simulator';

export type EventComparison = {
  type: SimEvent['type'];
  ballId: string;
  matched: boolean;
  actualFrameIndex: number;
  baselineFrameIndex: number | null;
  frameDeviation: number | null;
  positionDeviationM: number | null;
};

export type TrajectoryAnalysis = {
  passed: boolean;
  maxDeviationM: number;
  avgDeviationM: number;
  deviationsByBall: Record<string, { max: number; avg: number }>;
  worstDeviation: {
    frameIndex: number;
    ballId: string;
    distanceM: number;
    timeSec: number;
  };
  eventComparisons: EventComparison[];
  /** 0–1 fraction of actual events matched to a baseline event */
  eventMatchRate: number;
  /** Frame index at which deviation first exceeds tolerance (null = never exceeded) */
  divergenceFrame: number | null;
};

const FRAME_MATCH_TOLERANCE = 2;
const POSITION_MATCH_TOLERANCE_M = 0.01;
const PHYSICS_DT_SEC = 0.05;

/**
 * Compares an actual simulation result against a saved baseline.
 *
 * @param actual    Simulation result from simulateShot()
 * @param baseline  Saved baseline SimulationResult
 * @param toleranceM  Max acceptable per-ball deviation in metres (default 5 mm)
 */
export function analyzeTrajectory(
  actual: SimulationResult,
  baseline: SimulationResult,
  toleranceM = 0.005,
): TrajectoryAnalysis {
  const frameCount = Math.min(actual.frames.length, baseline.frames.length);

  // ── Per-frame deviation ──────────────────────────────────────────────────
  const deviationsByBall: Record<string, number[]> = {};
  let worstDev = { frameIndex: 0, ballId: '', distanceM: 0, timeSec: 0 };
  let divergenceFrame: number | null = null;

  for (let fi = 0; fi < frameCount; fi += 1) {
    const actualFrame = actual.frames[fi];
    const baseFrame = baseline.frames[fi];
    if (!actualFrame || !baseFrame) {
      continue;
    }

    for (const actualBall of actualFrame.balls) {
      const baseBall = baseFrame.balls.find((b) => b.id === actualBall.id);
      if (!baseBall) {
        continue;
      }

      const dx = actualBall.x - baseBall.x;
      const dz = actualBall.z - baseBall.z;
      const dist = Math.hypot(dx, dz);

      if (!deviationsByBall[actualBall.id]) {
        deviationsByBall[actualBall.id] = [];
      }
      deviationsByBall[actualBall.id].push(dist);

      if (dist > worstDev.distanceM) {
        worstDev = {
          frameIndex: fi,
          ballId: actualBall.id,
          distanceM: dist,
          timeSec: fi * PHYSICS_DT_SEC,
        };
      }

      if (divergenceFrame === null && dist > toleranceM) {
        divergenceFrame = fi;
      }
    }
  }

  // ── Aggregate statistics ─────────────────────────────────────────────────
  const ballSummaries: Record<string, { max: number; avg: number }> = {};
  let allDeviations: number[] = [];

  for (const [ballId, devs] of Object.entries(deviationsByBall)) {
    const max = Math.max(...devs);
    const avg = devs.reduce((a, b) => a + b, 0) / Math.max(1, devs.length);
    ballSummaries[ballId] = { max, avg };
    allDeviations = allDeviations.concat(devs);
  }

  const maxDeviationM = allDeviations.length > 0 ? Math.max(...allDeviations) : 0;
  const avgDeviationM =
    allDeviations.length > 0
      ? allDeviations.reduce((a, b) => a + b, 0) / allDeviations.length
      : 0;

  // ── Event matching ───────────────────────────────────────────────────────
  const usedBaselineIndices = new Set<number>();
  const eventComparisons: EventComparison[] = actual.events.map((actualEvent) => {
    // Find the closest baseline event of the same type and ballId
    let bestMatch: { index: number; event: SimEvent } | null = null;
    let bestScore = Infinity;

    baseline.events.forEach((bEvent, bi) => {
      if (usedBaselineIndices.has(bi)) {
        return;
      }
      if (bEvent.type !== actualEvent.type || bEvent.ballId !== actualEvent.ballId) {
        return;
      }
      const frameDiff = Math.abs(bEvent.frameIndex - actualEvent.frameIndex);
      if (frameDiff > FRAME_MATCH_TOLERANCE) {
        return;
      }
      const posDiff = Math.hypot(
        bEvent.position.x - actualEvent.position.x,
        bEvent.position.z - actualEvent.position.z,
      );
      const score = frameDiff + posDiff * 10;
      if (score < bestScore) {
        bestScore = score;
        bestMatch = { index: bi, event: bEvent };
      }
    });

    if (bestMatch !== null) {
      const matched = bestMatch as { index: number; event: SimEvent };
      usedBaselineIndices.add(matched.index);
      const posDiff = Math.hypot(
        matched.event.position.x - actualEvent.position.x,
        matched.event.position.z - actualEvent.position.z,
      );
      const isPositionMatch = posDiff <= POSITION_MATCH_TOLERANCE_M;
      const frameDiff = Math.abs(matched.event.frameIndex - actualEvent.frameIndex);
      return {
        type: actualEvent.type,
        ballId: actualEvent.ballId,
        matched: isPositionMatch,
        actualFrameIndex: actualEvent.frameIndex,
        baselineFrameIndex: matched.event.frameIndex,
        frameDeviation: frameDiff,
        positionDeviationM: posDiff,
      };
    }

    return {
      type: actualEvent.type,
      ballId: actualEvent.ballId,
      matched: false,
      actualFrameIndex: actualEvent.frameIndex,
      baselineFrameIndex: null,
      frameDeviation: null,
      positionDeviationM: null,
    };
  });

  const matchedCount = eventComparisons.filter((e) => e.matched).length;
  const eventMatchRate =
    eventComparisons.length > 0 ? matchedCount / eventComparisons.length : 1;

  return {
    passed: maxDeviationM <= toleranceM,
    maxDeviationM,
    avgDeviationM,
    deviationsByBall: ballSummaries,
    worstDeviation: worstDev,
    eventComparisons,
    eventMatchRate,
    divergenceFrame,
  };
}

import type { SimResult } from '../../../../packages/physics-core/src/standalone-simulator.ts';
import type { TestScenario } from './types.ts';

export type VerifyResult = {
  passed: boolean;
  details: string[];
};

export function verifyScenario(scenario: TestScenario, result: SimResult): VerifyResult {
  const { expected } = scenario;
  if (!expected) {
    return { passed: true, details: ['No expectations defined'] };
  }

  const details: string[] = [];
  let passed = true;

  const cueBallId = scenario.shot.cueBallId;

  // Extract cue ball cushion events in order
  const cueCushionEvents = result.events.filter(
    (e) => e.type === 'CUSHION' && e.ballId === cueBallId,
  );

  // 1. cushionSequence check
  if (expected.cushionSequence) {
    const actualSequence = cueCushionEvents.map((e) => e.targetId);
    const expSeq = expected.cushionSequence;
    // Check that the expected sequence appears as a subsequence in actualSequence
    let matchIdx = 0;
    for (const cushion of actualSequence) {
      if (matchIdx < expSeq.length && cushion === expSeq[matchIdx]) {
        matchIdx++;
      }
    }
    const sequenceMatched = matchIdx === expSeq.length;
    if (sequenceMatched) {
      details.push(`✓ 쿠션 순서 일치: ${expSeq.join(' → ')}`);
    } else {
      details.push(
        `✗ 쿠션 순서 불일치: 기대 [${expSeq.join(', ')}], 실제 [${actualSequence.slice(0, 6).join(', ')}]`,
      );
      passed = false;
    }
  }

  // 2. arrivalPosition check (ball position after last cushion event)
  if (expected.arrivalPosition) {
    const { x: targetX, y: targetY, toleranceM } = expected.arrivalPosition;
    if (cueCushionEvents.length === 0) {
      details.push('✗ 도달 위치 확인 불가: 쿠션 이벤트 없음');
      passed = false;
    } else {
      const lastCushionEvent = cueCushionEvents[cueCushionEvents.length - 1];
      const frameAfter = result.frames[lastCushionEvent.frameIndex];
      if (!frameAfter) {
        details.push('✗ 도달 위치 확인 불가: 프레임 없음');
        passed = false;
      } else {
        const cueBallState = frameAfter.balls.find((b) => b.id === cueBallId);
        if (!cueBallState) {
          details.push('✗ 도달 위치 확인 불가: 수구 상태 없음');
          passed = false;
        } else {
          const dist = Math.hypot(cueBallState.x - targetX, cueBallState.y - targetY);
          if (dist <= toleranceM) {
            details.push(
              `✓ 도달 위치 허용 범위 내: 실제(${cueBallState.x.toFixed(3)}, ${cueBallState.y.toFixed(3)}), 기대(${targetX.toFixed(3)}, ${targetY.toFixed(3)}), 오차 ${(dist * 100).toFixed(1)}cm`,
            );
          } else {
            details.push(
              `✗ 도달 위치 초과: 실제(${cueBallState.x.toFixed(3)}, ${cueBallState.y.toFixed(3)}), 기대(${targetX.toFixed(3)}, ${targetY.toFixed(3)}), 오차 ${(dist * 100).toFixed(1)}cm (허용 ${(toleranceM * 100).toFixed(0)}cm)`,
            );
            passed = false;
          }
        }
      }
    }
  }

  // 3. mustHitBalls check
  if (expected.mustHitBalls && expected.mustHitBalls.length > 0) {
    const hitBallIds = new Set<string>();
    for (const e of result.events) {
      if (e.type === 'BALL_BALL') {
        hitBallIds.add(e.targetId);
        hitBallIds.add(e.ballId);
      }
    }
    for (const ballId of expected.mustHitBalls) {
      if (hitBallIds.has(ballId)) {
        details.push(`✓ 필수 공 맞힘: ${ballId}`);
      } else {
        details.push(`✗ 필수 공 미접촉: ${ballId}`);
        passed = false;
      }
    }
  }

  // 4. minCushionHitsBeforeLastBall check
  if (
    expected.minCushionHitsBeforeLastBall !== undefined &&
    expected.mustHitBalls &&
    expected.mustHitBalls.length > 0
  ) {
    const lastBallId = expected.mustHitBalls[expected.mustHitBalls.length - 1];
    const lastBallHitEvent = [...result.events]
      .reverse()
      .find(
        (e) =>
          e.type === 'BALL_BALL' && (e.ballId === lastBallId || e.targetId === lastBallId),
      );

    if (!lastBallHitEvent) {
      details.push(`✗ 쿠션 횟수 확인 불가: 마지막 적구(${lastBallId}) 미접촉`);
      passed = false;
    } else {
      const cushionHitsBeforeLast = result.events.filter(
        (e) =>
          e.type === 'CUSHION' &&
          e.ballId === cueBallId &&
          e.frameIndex < lastBallHitEvent.frameIndex,
      ).length;
      const minHits = expected.minCushionHitsBeforeLastBall;
      if (cushionHitsBeforeLast >= minHits) {
        details.push(
          `✓ 최소 쿠션 ${minHits}회 충족: 마지막 적구 전 ${cushionHitsBeforeLast}회`,
        );
      } else {
        details.push(
          `✗ 쿠션 횟수 부족: 마지막 적구 전 ${cushionHitsBeforeLast}회 (최소 ${minHits}회 필요)`,
        );
        passed = false;
      }
    }
  }

  return { passed, details };
}

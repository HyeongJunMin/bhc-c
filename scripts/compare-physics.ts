#!/usr/bin/env npx tsx
/**
 * compare-physics.ts
 * bhc vs bhc2 물리 엔진 비교 테스트 스크립트
 *
 * 실행: npx tsx scripts/compare-physics.ts
 *
 * 두 엔진에 동일한 초기 조건을 넣고 결과를 수치/서술적으로 비교한다.
 */

import { createRoomPhysicsStepConfig as bhcCreateConfig } from '../packages/physics-core/src/room-physics-config.ts';
import {
  stepRoomPhysicsWorld as bhcStep,
  type PhysicsBallState as BhcBall,
} from '../packages/physics-core/src/room-physics-step.ts';
import { createRoomPhysicsStepConfig as bhc2CreateConfig } from '/Users/minhyeongjun/IdeaProjects/bhc2/packages/physics-core/src/room-physics-config.ts';
import {
  stepRoomPhysicsWorld as bhc2Step,
  type PhysicsBallState as Bhc2Ball,
} from '/Users/minhyeongjun/IdeaProjects/bhc2/packages/physics-core/src/room-physics-step.ts';

// ─── 공통 상수 ──────────────────────────────────────────────────────────────
const BALL_RADIUS = 0.03075; // m
const TABLE_W = 2.844;       // m
const TABLE_H = 1.422;       // m
const MAX_FRAMES = 3000;

// ─── 유틸 ───────────────────────────────────────────────────────────────────
function fmt(n: number, digits = 4): string {
  return n.toFixed(digits);
}

/** 공이 완전히 정지했는지 (bhc2 는 threshold 내에서 자동 zeroing) */
function allStopped(balls: { vx: number; vy: number; isPocketed: boolean }[]): boolean {
  return balls.every(b => b.isPocketed || (Math.hypot(b.vx, b.vy) < 0.005));
}

// ─── bhc 시뮬 래퍼 ─────────────────────────────────────────────────────────
interface BallInit {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** bhc spinX = topspin/backspin (rad/s), positive = topspin when vy>0 */
  spinX: number;
  /** bhc spinY = sidespin/English (rad/s) */
  spinY: number;
  /** bhc spinZ = rolling causing X-motion (rad/s), rolling: spinZ = -vx/r */
  spinZ: number;
}

interface SimResult {
  finalBalls: { id: string; x: number; y: number; vx: number; vy: number }[];
  totalFrames: number;
  totalTimeSec: number;
  cushionEvents: { frame: number; ballId: string; cushionId: string }[];
  ballBallEvents: { frame: number; firstId: string; secondId: string }[];
  /** 첫 번째 쿠션 충돌 직후 각 공의 속도 스냅샷 */
  postFirstCushionVelocity: Map<string, { vx: number; vy: number }>;
}

function runBhc(inits: BallInit[]): SimResult {
  const config = bhcCreateConfig();
  const balls: BhcBall[] = inits.map(b => ({
    id: b.id,
    x: b.x,
    y: b.y,
    vx: b.vx,
    vy: b.vy,
    spinX: b.spinX,
    spinY: b.spinY,
    spinZ: b.spinZ,
    isPocketed: false,
  }));

  const cushionEvents: SimResult['cushionEvents'] = [];
  const ballBallEvents: SimResult['ballBallEvents'] = [];
  const postFirstCushionVelocity: SimResult['postFirstCushionVelocity'] = new Map();
  let frame = 0;

  while (frame < MAX_FRAMES) {
    frame += 1;
    bhcStep(balls, config, {
      onCushionCollision: (ball, cushionId) => {
        cushionEvents.push({ frame, ballId: ball.id, cushionId });
        if (!postFirstCushionVelocity.has(ball.id)) {
          postFirstCushionVelocity.set(ball.id, { vx: ball.vx, vy: ball.vy });
        }
      },
      onBallCollision: (first, second) => {
        ballBallEvents.push({ frame, firstId: first.id, secondId: second.id });
      },
    });
    if (allStopped(balls)) break;
  }

  return {
    finalBalls: balls.map(b => ({ id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy })),
    totalFrames: frame,
    totalTimeSec: frame * config.dtSec,
    cushionEvents,
    ballBallEvents,
    postFirstCushionVelocity,
  };
}

// ─── bhc2 시뮬 래퍼 ────────────────────────────────────────────────────────
/**
 * bhc2 spin axis 매핑 (bhc 기준으로 입력받아 변환):
 *   bhc  spinX (topspin, rad/s)  → bhc2 spinX
 *   bhc  spinY (sidespin, rad/s) → bhc2 spinZ  (English)
 *   bhc  spinZ (rolling-X, rad/s) → bhc2 spinY  (같은 부호)
 *     bhc rolling: spinZ = -vx/r
 *     bhc2 rolling: spinY = -vx/r  (rollingTargetVx = -spinY*r = vx → spinY = -vx/r = spinZ_bhc)
 */
function runBhc2(inits: BallInit[]): SimResult {
  const config = bhc2CreateConfig();
  const balls: Bhc2Ball[] = inits.map(b => ({
    id: b.id,
    x: b.x,
    y: b.y,
    vx: b.vx,
    vy: b.vy,
    spinX: b.spinX,          // topspin/backspin: 동일
    spinY: b.spinZ,           // bhc spinZ = -vx/r  ≡  bhc2 spinY = -vx/r (같은 부호)
    spinZ: b.spinY,           // bhc spinY (sidespin) → bhc2 spinZ
    isPocketed: false,
    preContactLockX: undefined,
    preContactLockY: undefined,
  }));

  const cushionEvents: SimResult['cushionEvents'] = [];
  const ballBallEvents: SimResult['ballBallEvents'] = [];
  const postFirstCushionVelocity: SimResult['postFirstCushionVelocity'] = new Map();
  let frame = 0;

  while (frame < MAX_FRAMES) {
    frame += 1;
    bhc2Step(balls, config, {
      onCushionCollision: (ball, cushionId) => {
        cushionEvents.push({ frame, ballId: ball.id, cushionId });
        if (!postFirstCushionVelocity.has(ball.id)) {
          postFirstCushionVelocity.set(ball.id, { vx: ball.vx, vy: ball.vy });
        }
      },
      onBallCollision: (first, second) => {
        ballBallEvents.push({ frame, firstId: first.id, secondId: second.id });
      },
    });
    if (allStopped(balls)) break;
  }

  return {
    finalBalls: balls.map(b => ({ id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy })),
    totalFrames: frame,
    totalTimeSec: frame * config.dtSec,
    cushionEvents,
    ballBallEvents,
    postFirstCushionVelocity,
  };
}

// ─── 결과 출력 ───────────────────────────────────────────────────────────────
function printComparison(title: string, bhcResult: SimResult, bhc2Result: SimResult): void {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`=== 시나리오: ${title} ===`);
  console.log('═'.repeat(60));

  for (const b of bhcResult.finalBalls) {
    const b2 = bhc2Result.finalBalls.find(x => x.id === b.id);
    if (!b2) continue;
    console.log(`  공 [${b.id}]:`);
    console.log(`    [bhc]  최종 위치: (${fmt(b.x)}, ${fmt(b.y)})  속도: (${fmt(b.vx)}, ${fmt(b.vy)})`);
    console.log(`    [bhc2] 최종 위치: (${fmt(b2.x)}, ${fmt(b2.y)})  속도: (${fmt(b2.vx)}, ${fmt(b2.vy)})`);
    const dx = Math.abs(b.x - b2.x);
    const dy = Math.abs(b.y - b2.y);
    const distDiff = Math.hypot(dx, dy);
    console.log(`    [diff] 위치 차이: ${fmt(distDiff)} m`);
  }

  console.log();
  console.log(`  [bhc]  정지 프레임: ${bhcResult.totalFrames}  (${fmt(bhcResult.totalTimeSec, 2)}s)`);
  console.log(`  [bhc2] 정지 프레임: ${bhc2Result.totalFrames}  (${fmt(bhc2Result.totalTimeSec, 2)}s)`);

  if (bhcResult.cushionEvents.length > 0 || bhc2Result.cushionEvents.length > 0) {
    console.log();
    const bhcCushions = bhcResult.cushionEvents.map(e => `${e.cushionId}@f${e.frame}`).join(', ');
    const bhc2Cushions = bhc2Result.cushionEvents.map(e => `${e.cushionId}@f${e.frame}`).join(', ');
    console.log(`  [bhc]  쿠션 충돌: ${bhcCushions || '없음'}`);
    console.log(`  [bhc2] 쿠션 충돌: ${bhc2Cushions || '없음'}`);
  }

  if (bhcResult.ballBallEvents.length > 0 || bhc2Result.ballBallEvents.length > 0) {
    console.log();
    const bhcBB = bhcResult.ballBallEvents.map(e => `${e.firstId}↔${e.secondId}@f${e.frame}`).join(', ');
    const bhc2BB = bhc2Result.ballBallEvents.map(e => `${e.firstId}↔${e.secondId}@f${e.frame}`).join(', ');
    console.log(`  [bhc]  공-공 충돌: ${bhcBB || '없음'}`);
    console.log(`  [bhc2] 공-공 충돌: ${bhc2BB || '없음'}`);
  }
}

// ─── 시나리오 정의 ──────────────────────────────────────────────────────────

const CX = TABLE_W / 2;  // 1.422
const CY = TABLE_H / 2;  // 0.711
const R = BALL_RADIUS;

/**
 * 롤링 속도에 해당하는 spinX 계산 (vy 방향 rolling)
 * rolling condition: spinX = vy / r
 */
function rollingSpinX(vy: number): number {
  return vy / R;
}

/**
 * rolling condition for x-motion: bhc spinZ = -vx/r
 */
function rollingSpinZ(vx: number): number {
  return -vx / R;
}

// ─── 시나리오 1: 직선 감속 ──────────────────────────────────────────────────
function scenario1(): void {
  const title = '1. 직선 감속 (Straight Deceleration, vy=3m/s, rolling)';
  const vy = 3.0;
  const inits: BallInit[] = [{
    id: 'ball', x: CX, y: 0.3,
    vx: 0, vy,
    spinX: rollingSpinX(vy),  // 완전 롤링 상태
    spinY: 0,
    spinZ: 0,
  }];
  console.log(`\n  초기: vy=${vy}, spinX=${fmt(rollingSpinX(vy), 1)} rad/s (완전 롤링)`);
  console.log(`  예상: bhc 마찰 상태기계(rolling→stationary), bhc2 linear damping 0.975/tick`);
  printComparison(title, runBhc(inits), runBhc2(inits));
}

// ─── 시나리오 2: 쿠션 반사 (저속/중속/고속) ────────────────────────────────
function scenario2(): void {
  const title = '2. 쿠션 반사 (Cushion Rebound, 45° 입사)';
  for (const speed of [1.0, 3.0, 6.0]) {
    const vx = -speed / Math.SQRT2;  // 좌측 쿠션을 향해
    const vy = -speed / Math.SQRT2;  // 상단 쿠션을 향해 (45° 각도)
    const inits: BallInit[] = [{
      id: 'ball', x: CX, y: CY,
      vx, vy,
      spinX: rollingSpinX(vy),
      spinY: 0,
      spinZ: rollingSpinZ(vx),
    }];
    const sub = `2.${speed === 1.0 ? 'a' : speed === 3.0 ? 'b' : 'c'} 속도 ${speed} m/s`;
    console.log(`\n  초기: vx=${fmt(vx, 2)}, vy=${fmt(vy, 2)}, speed=${speed} m/s`);
    console.log(`  예상: bhc 속도 의존 sigmoid 반발계수(0.88↔0.65), bhc2 고정 0.72`);
    printComparison(`${title} [${sub}]`, runBhc(inits), runBhc2(inits));
  }
}

// ─── 시나리오 3: 드로우 샷 (Draw Shot) ─────────────────────────────────────
function scenario3(): void {
  const vy = 3.0;

  // 3a: 강한 백스핀 + 멀리 배치 — bhc2 감속력 차이 관찰
  {
    const title = '3a. 드로우 샷 (강한 백스핀 1.5x, 원거리)';
    const drawSpin = -rollingSpinX(vy) * 1.5;
    const cueBall: BallInit = { id: 'cueBall', x: CX, y: 0.25, vx: 0, vy, spinX: drawSpin, spinY: 0, spinZ: 0 };
    const objBall: BallInit = { id: 'objBall', x: CX, y: 0.65, vx: 0, vy: 0, spinX: 0, spinY: 0, spinZ: 0 };
    const bhcR = runBhc([cueBall, objBall]);
    const bhc2R = runBhc2([cueBall, objBall]);
    console.log(`\n  초기: 큐볼 vy=${vy}, spinX=${fmt(drawSpin, 1)} rad/s (1.5x 백스핀), objBall y=0.65`);
    console.log(`  ※ bhc2는 강한 draw coupling으로 큐볼이 오브젝트볼 도달 전 정지 가능`);
    printComparison(title, bhcR, bhc2R);
    const bhcColl = bhcR.ballBallEvents.length > 0;
    const bhc2Coll = bhc2R.ballBallEvents.length > 0;
    const collisionY = 0.65 - 2 * R;
    const bhcCue = bhcR.finalBalls.find(b => b.id === 'cueBall');
    const bhc2Cue = bhc2R.finalBalls.find(b => b.id === 'cueBall');
    console.log(`  → [bhc]  공-공 충돌: ${bhcColl ? '있음' : '없음(큐볼 미도달!)'}  큐볼최종Y=${bhcCue ? fmt(bhcCue.y) : 'N/A'}`);
    console.log(`  → [bhc2] 공-공 충돌: ${bhc2Coll ? '있음' : '없음(큐볼 미도달!)'}  큐볼최종Y=${bhc2Cue ? fmt(bhc2Cue.y) : 'N/A'}  (충돌지점 ~${fmt(collisionY, 3)})`);
  }

  // 3b: 중간 백스핀 + 근거리 — 충돌 후 draw 거동 비교
  {
    const title = '3b. 드로우 샷 (1.0x 백스핀, 근거리 강제충돌)';
    const drawSpin = -rollingSpinX(vy) * 1.0;  // 정확히 rolling 반대 (pure stop-and-draw)
    // 공 사이 간격 0.1m → 빠르게 충돌
    const objY = 0.25 + 2 * R + 0.10;
    const cueBall: BallInit = { id: 'cueBall', x: CX, y: 0.25, vx: 0, vy, spinX: drawSpin, spinY: 0, spinZ: 0 };
    const objBall: BallInit = { id: 'objBall', x: CX, y: objY, vx: 0, vy: 0, spinX: 0, spinY: 0, spinZ: 0 };
    const bhcR = runBhc([cueBall, objBall]);
    const bhc2R = runBhc2([cueBall, objBall]);
    console.log(`\n  초기: 큐볼 vy=${vy}, spinX=${fmt(drawSpin, 1)} rad/s (1.0x 역방향 롤링), objBall y=${fmt(objY, 3)}`);
    console.log(`  예상: 충돌 후 큐볼 후진 (draw 성공 여부, 큐볼 최종 Y < ${fmt(objY - 2*R, 3)})`);
    printComparison(title, bhcR, bhc2R);
    const bhcCue = bhcR.finalBalls.find(b => b.id === 'cueBall');
    const bhc2Cue = bhc2R.finalBalls.find(b => b.id === 'cueBall');
    const drawSuccessY = objY - 2 * R;  // 충돌 위치보다 뒤로 가야 draw 성공
    if (bhcCue) {
      console.log(`  → [bhc]  큐볼 최종 Y=${fmt(bhcCue.y)} → ${bhcCue.y < drawSuccessY ? '후진 ✓ (draw)' : '정지/전진'}`);
    }
    if (bhc2Cue) {
      console.log(`  → [bhc2] 큐볼 최종 Y=${fmt(bhc2Cue.y)} → ${bhc2Cue.y < drawSuccessY ? '후진 ✓ (draw)' : '정지/전진'}`);
    }
  }
}

// ─── 시나리오 4: 팔로우 샷 (Follow Shot) ───────────────────────────────────
function scenario4(): void {
  const title = '4. 팔로우 샷 (Follow Shot) - 큐볼 오브젝트볼 정면 충돌';
  const vy = 3.0;
  const followSpin = rollingSpinX(vy) * 1.5;  // 1.5배 강도 탑스핀
  const cueBall: BallInit = {
    id: 'cueBall', x: CX, y: 0.25,
    vx: 0, vy,
    spinX: followSpin,
    spinY: 0, spinZ: 0,
  };
  const objBall: BallInit = {
    id: 'objBall', x: CX, y: 0.65,
    vx: 0, vy: 0,
    spinX: 0, spinY: 0, spinZ: 0,
  };
  console.log(`\n  초기: 큐볼 vy=${vy}, spinX=${fmt(followSpin, 1)} rad/s (강한 탑스핀 1.5x)`);
  console.log(`  예상: 충돌 후 큐볼 전진 지속 (follow 성공 여부 비교)`);
  printComparison(title, runBhc([cueBall, objBall]), runBhc2([cueBall, objBall]));

  const bhcR = runBhc([cueBall, objBall]);
  const bhc2R = runBhc2([cueBall, objBall]);
  const bhcCue = bhcR.finalBalls.find(b => b.id === 'cueBall');
  const bhc2Cue = bhc2R.finalBalls.find(b => b.id === 'cueBall');
  const objBallStart = 0.65;
  if (bhcCue) {
    console.log(`  → [bhc]  큐볼 최종 Y=${fmt(bhcCue.y)} (오브젝트볼 초기 위치 ${objBallStart} 기준 ${bhcCue.y > objBallStart ? '전진 ✓' : '정지/후진'})`);
  }
  if (bhc2Cue) {
    console.log(`  → [bhc2] 큐볼 최종 Y=${fmt(bhc2Cue.y)} (오브젝트볼 초기 위치 ${objBallStart} 기준 ${bhc2Cue.y > objBallStart ? '전진 ✓' : '정지/후진'})`);
  }
}

// ─── 시나리오 5: 사이드 스핀 + 쿠션 (English + Cushion) ────────────────────
function scenario5(): void {
  const title = '5. 사이드 스핀 + 쿠션 (English + Cushion)';
  const speed = 3.0;
  // 좌측 쿠션을 향해 직진 (vx=-3.0), 좌측 사이드 스핀(spinY>0)
  const vx = -speed;
  const sideSpinRads = 50;  // 적당한 사이드 스핀 (rad/s)
  const inits: BallInit[] = [{
    id: 'ball', x: CX, y: CY,
    vx, vy: 0,
    spinX: 0,
    spinY: sideSpinRads,    // bhc spinY = sidespin
    spinZ: rollingSpinZ(vx), // rolling condition for x-motion
  }];
  console.log(`\n  초기: vx=${vx}, spinY(사이드스핀)=${sideSpinRads} rad/s, 좌측 쿠션 충돌`);
  console.log(`  예상: bhc maxThrow=15°, bhc2 maxThrow=55° → bhc2가 더 큰 경로 편향`);
  printComparison(title, runBhc(inits), runBhc2(inits));

  const bhcR = runBhc(inits);
  const bhc2R = runBhc2(inits);

  // 첫 번째 쿠션 충돌 직후 속도로 throw 각도 계산 (누적 효과 제거)
  const bhcPostV = bhcR.postFirstCushionVelocity.get('ball');
  const bhc2PostV = bhc2R.postFirstCushionVelocity.get('ball');
  if (bhcPostV && bhc2PostV) {
    // 좌측 쿠션(axis=x) 충돌 후: vx는 반사됨(양수), vy가 throw에 의한 편향
    // throw 각도 = atan2(|vy_post|, |vx_post|)
    const bhcThrowDeg = Math.atan2(Math.abs(bhcPostV.vy), Math.abs(bhcPostV.vx)) * 180 / Math.PI;
    const bhc2ThrowDeg = Math.atan2(Math.abs(bhc2PostV.vy), Math.abs(bhc2PostV.vx)) * 180 / Math.PI;
    const bhcPostSpeed = Math.hypot(bhcPostV.vx, bhcPostV.vy);
    const bhc2PostSpeed = Math.hypot(bhc2PostV.vx, bhc2PostV.vy);
    const bhcLoss = ((1 - bhcPostSpeed / speed) * 100).toFixed(1);
    const bhc2Loss = ((1 - bhc2PostSpeed / speed) * 100).toFixed(1);
    console.log(`  → [bhc]  첫 쿠션 후 속도: (${fmt(bhcPostV.vx, 3)}, ${fmt(bhcPostV.vy, 3)})  throw각: ${fmt(bhcThrowDeg, 1)}°  속도손실: ${bhcLoss}%`);
    console.log(`  → [bhc2] 첫 쿠션 후 속도: (${fmt(bhc2PostV.vx, 3)}, ${fmt(bhc2PostV.vy, 3)})  throw각: ${fmt(bhc2ThrowDeg, 1)}°  속도손실: ${bhc2Loss}%`);
    console.log(`  → bhc maxThrow=15°, bhc2 maxThrow=55° → 실제 throw 각도: bhc=${fmt(bhcThrowDeg, 1)}°, bhc2=${fmt(bhc2ThrowDeg, 1)}°`);
  }

  const bhcB = bhcR.finalBalls[0];
  const bhc2B = bhc2R.finalBalls[0];
  if (bhcB && bhc2B) {
    const bhcYDev = Math.abs(bhcB.y - CY);
    const bhc2YDev = Math.abs(bhc2B.y - CY);
    console.log(`  → [bhc]  최종 Y편향: ${fmt(bhcYDev)} m  (총 쿠션 ${bhcR.cushionEvents.length}회)`);
    console.log(`  → [bhc2] 최종 Y편향: ${fmt(bhc2YDev)} m  (총 쿠션 ${bhc2R.cushionEvents.length}회)`);
  }
}

// ─── 시나리오 6: 공-공 충돌 + 스핀 전달 ────────────────────────────────────
function scenario6(): void {
  const title = '6. 공-공 충돌 + 스핀 전달 (30° angle, 사이드 스핀)';
  const speed = 3.0;
  // 큐볼이 30° 방향으로 이동, 오브젝트볼에 충돌
  const angleDeg = 30;
  const angleRad = (angleDeg * Math.PI) / 180;
  const vx = Math.sin(angleRad) * speed;
  const vy = Math.cos(angleRad) * speed;
  // 오브젝트볼 위치: 큐볼에서 정면 방향으로 0.4m
  const dx = Math.sin(angleRad) * 0.4;
  const dy = Math.cos(angleRad) * 0.4;
  const cueX = 0.7;
  const cueY = 0.3;
  const sideSpinRads = 80;  // 강한 사이드 스핀 (rad/s)
  const cueBall: BallInit = {
    id: 'cueBall', x: cueX, y: cueY,
    vx, vy,
    spinX: rollingSpinX(vy),
    spinY: sideSpinRads,
    spinZ: rollingSpinZ(vx),
  };
  const objBall: BallInit = {
    id: 'objBall', x: cueX + dx, y: cueY + dy,
    vx: 0, vy: 0,
    spinX: 0, spinY: 0, spinZ: 0,
  };
  console.log(`\n  초기: 큐볼 ${angleDeg}° 방향 speed=${speed}m/s, spinY(사이드)=${sideSpinRads} rad/s`);
  console.log(`  예상: bhc 스핀 전달로 오브젝트볼 throw 발생, bhc2 단순 impulse (스핀 전달 없음)`);
  printComparison(title, runBhc([cueBall, objBall]), runBhc2([cueBall, objBall]));

  const bhcR = runBhc([cueBall, objBall]);
  const bhc2R = runBhc2([cueBall, objBall]);
  const bhcObj = bhcR.finalBalls.find(b => b.id === 'objBall');
  const bhc2Obj = bhc2R.finalBalls.find(b => b.id === 'objBall');
  // 충돌이 없으면 throw 분석 불가
  if (bhcR.ballBallEvents.length === 0 && bhc2R.ballBallEvents.length === 0) {
    console.log(`  → 공-공 충돌 없음 (위치 설정 확인 필요)`);
    return;
  }
  if (bhcObj && bhc2Obj) {
    // 예상 진행 방향 (30° angle, 충돌 노말 기준 수직 방향이 oject ball 진행 방향)
    const throwAngleBhc = Math.atan2(bhcObj.x - (cueX + dx), bhcObj.y - (cueY + dy)) * 180 / Math.PI;
    const throwAngleBhc2 = Math.atan2(bhc2Obj.x - (cueX + dx), bhc2Obj.y - (cueY + dy)) * 180 / Math.PI;
    console.log(`  → [bhc]  오브젝트볼 최종: (${fmt(bhcObj.x)}, ${fmt(bhcObj.y)})  이동방향: ${fmt(throwAngleBhc, 1)}°`);
    console.log(`  → [bhc2] 오브젝트볼 최종: (${fmt(bhc2Obj.x)}, ${fmt(bhc2Obj.y)})  이동방향: ${fmt(throwAngleBhc2, 1)}°`);
  }
}

// ─── 메인 ────────────────────────────────────────────────────────────────────
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║       bhc vs bhc2 물리 엔진 비교 테스트                  ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log();
console.log('테이블: 2.844m × 1.422m  |  공 반지름: 0.03075m');
console.log('프레임: 50ms/tick, 12 substeps');

const bhcConfig = bhcCreateConfig();
const bhc2Config = bhc2CreateConfig();
console.log(`\nbhc  설정: cushionMaxThrow=${bhcConfig.cushionMaxThrowAngleDeg}°, maxSpeed=${bhcConfig.maxBallSpeedMps}m/s`);
console.log(`bhc2 설정: cushionMaxThrow=${bhc2Config.cushionMaxThrowAngleDeg}°, maxSpeed=${bhc2Config.maxBallSpeedMps}m/s, linearDamping=${bhc2Config.linearDampingPerTick}/tick`);

scenario1();
scenario2();
scenario3();
scenario4();
scenario5();
scenario6();

console.log(`\n${'═'.repeat(60)}`);
console.log('=== 비교 요약 ===');
console.log('═'.repeat(60));
console.log('bhc:');
console.log('  + 속도 의존 반발계수 (저속 0.88, 고속 0.65)');
console.log('  + 물리 기반 마찰 상태기계 (sliding→rolling→spinning→stationary)');
console.log('  + 공-공 충돌 시 3축 스핀 전달');
console.log('  + Squirt 편향 구현');
console.log('  - cushionMaxThrow=15° (보수적)');
console.log();
console.log('bhc2:');
console.log('  + cloth-spin coupling 시스템 (드로우/팔로우 제어성 향상)');
console.log('  + 사전 접촉 헤딩 락 (경로 안정성)');
console.log('  - 고정 반발계수 0.72 (속도 무관)');
console.log('  - 공-공 충돌 스핀 전달 없음');
console.log('  - cushionMaxThrow=55° (과도할 수 있음)');
console.log('  - linear damping 방식 (물리적으로 덜 정확)');

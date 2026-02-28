import { Vector3 } from 'three';
import { PHYSICS } from '../lib/constants';
import type { RoomSnapshot, SnapshotBall } from './SseClient';

type InterpolatedBall = {
  id: SnapshotBall['id'];
  position: Vector3;
  isPocketed: boolean;
};

export interface InterpolatedSnapshot {
  serverTimeMs: number;
  isStale: boolean;
  balls: InterpolatedBall[];
}

type BufferedSnapshot = RoomSnapshot;

const BUFFER_DELAY_MS = 100;
const STALE_THRESHOLD_MS = 500;
const MAX_BUFFER_SIZE = 30;

export class SnapshotInterpolator {
  private readonly snapshots: BufferedSnapshot[] = [];
  private serverClientOffsetMs = 0;
  private hasOffset = false;
  private lastSnapshotClientTimeMs = 0;

  pushSnapshot(snapshot: RoomSnapshot): void {
    const nowMs = performance.now();
    if (!this.hasOffset) {
      this.serverClientOffsetMs = snapshot.serverTimeMs - nowMs;
      this.hasOffset = true;
    } else {
      const nextOffset = snapshot.serverTimeMs - nowMs;
      this.serverClientOffsetMs = this.serverClientOffsetMs * 0.9 + nextOffset * 0.1;
    }
    this.lastSnapshotClientTimeMs = nowMs;
    this.snapshots.push(snapshot);
    this.snapshots.sort((a, b) => a.serverTimeMs - b.serverTimeMs);
    if (this.snapshots.length > MAX_BUFFER_SIZE) {
      this.snapshots.splice(0, this.snapshots.length - MAX_BUFFER_SIZE);
    }
  }

  sample(): InterpolatedSnapshot | null {
    if (this.snapshots.length === 0) {
      return null;
    }
    const nowMs = performance.now();
    const estimatedServerNowMs = this.hasOffset ? nowMs + this.serverClientOffsetMs : this.snapshots[this.snapshots.length - 1].serverTimeMs;
    const renderTimeMs = estimatedServerNowMs - BUFFER_DELAY_MS;
    const isStale = nowMs - this.lastSnapshotClientTimeMs > STALE_THRESHOLD_MS;

    if (this.snapshots.length === 1) {
      return {
        serverTimeMs: this.snapshots[0].serverTimeMs,
        isStale,
        balls: this.snapshots[0].balls.map((ball) => toClientBall(ball)),
      };
    }

    let left = this.snapshots[0];
    let right = this.snapshots[this.snapshots.length - 1];
    for (let index = 0; index < this.snapshots.length - 1; index += 1) {
      const candidateLeft = this.snapshots[index];
      const candidateRight = this.snapshots[index + 1];
      if (candidateLeft.serverTimeMs <= renderTimeMs && renderTimeMs < candidateRight.serverTimeMs) {
        left = candidateLeft;
        right = candidateRight;
        break;
      }
      if (renderTimeMs < this.snapshots[0].serverTimeMs) {
        left = this.snapshots[0];
        right = this.snapshots[0];
      }
      if (renderTimeMs >= this.snapshots[this.snapshots.length - 1].serverTimeMs) {
        left = this.snapshots[this.snapshots.length - 1];
        right = this.snapshots[this.snapshots.length - 1];
      }
    }

    if (left.serverTimeMs === right.serverTimeMs) {
      return {
        serverTimeMs: left.serverTimeMs,
        isStale,
        balls: left.balls.map((ball) => toClientBall(ball)),
      };
    }

    const spanMs = right.serverTimeMs - left.serverTimeMs;
    const alpha = clamp((renderTimeMs - left.serverTimeMs) / spanMs, 0, 1);

    const rightBallById = new Map(right.balls.map((ball) => [ball.id, ball]));
    const balls = left.balls.map((leftBall) => {
      const rightBall = rightBallById.get(leftBall.id) ?? leftBall;
      return interpolateClientBall(leftBall, rightBall, alpha);
    });

    return {
      serverTimeMs: renderTimeMs,
      isStale,
      balls,
    };
  }
}

let sharedInterpolator: SnapshotInterpolator | null = null;

export function getSharedInterpolator(): SnapshotInterpolator {
  if (!sharedInterpolator) {
    sharedInterpolator = new SnapshotInterpolator();
  }
  return sharedInterpolator;
}

function toClientBall(ball: SnapshotBall): InterpolatedBall {
  return {
    id: ball.id,
    position: new Vector3(
      ball.x - PHYSICS.TABLE_WIDTH / 2,
      PHYSICS.BALL_RADIUS,
      ball.z - PHYSICS.TABLE_HEIGHT / 2,
    ),
    isPocketed: ball.isPocketed,
  };
}

function interpolateClientBall(left: SnapshotBall, right: SnapshotBall, alpha: number): InterpolatedBall {
  const x = lerp(left.x, right.x, alpha);
  const z = lerp(left.z, right.z, alpha);
  return {
    id: left.id,
    position: new Vector3(
      x - PHYSICS.TABLE_WIDTH / 2,
      PHYSICS.BALL_RADIUS,
      z - PHYSICS.TABLE_HEIGHT / 2,
    ),
    isPocketed: alpha < 0.5 ? left.isPocketed : right.isPocketed,
  };
}

function lerp(start: number, end: number, alpha: number): number {
  return start + (end - start) * alpha;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

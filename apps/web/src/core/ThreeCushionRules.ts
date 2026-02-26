import { RULES } from '../lib/constants';

export type CollisionEvent = 
  | { type: 'BALL'; ballId1: string; ballId2: string; atMs: number }
  | { type: 'CUSHION'; ballId: string; cushionId: string; atMs: number };

export interface TurnState {
  events: CollisionEvent[];
  cushionCount: number;
  firstObjectBall: string | null;
  secondObjectBallHit: boolean;
  cueBallId: string;
  objectBallIds: [string, string];
}

/**
 * 3쿠션 득점 판정 (packages/physics-core 포팅)
 */
export class ThreeCushionRules {
  private turnState: TurnState | null = null;

  /**
   * 새 턴 시작
   */
  startTurn(cueBallId: string, objectBallIds: [string, string]): void {
    this.turnState = {
      events: [],
      cushionCount: 0,
      firstObjectBall: null,
      secondObjectBallHit: false,
      cueBallId,
      objectBallIds,
    };
  }

  /**
   * 충돌 이벤트 기록
   */
  recordCollision(event: CollisionEvent): void {
    if (!this.turnState) return;
    this.turnState.events.push(event);

    if (event.type === 'CUSHION') {
      // 첫 번째 목적구 맞추기 전의 쿠션만 카운트
      if (!this.turnState.secondObjectBallHit) {
        this.turnState.cushionCount++;
      }
    } else if (event.type === 'BALL') {
      const { ballId1, ballId2 } = event;
      
      // 수구가 목적구를 맞췄는지 확인
      if (ballId1 === this.turnState.cueBallId) {
        this.handleObjectBallHit(ballId2);
      } else if (ballId2 === this.turnState.cueBallId) {
        this.handleObjectBallHit(ballId1);
      }
    }
  }

  private handleObjectBallHit(hitBallId: string): void {
    if (!this.turnState) return;

    // 목적구인지 확인
    if (!this.turnState.objectBallIds.includes(hitBallId)) return;

    if (this.turnState.firstObjectBall === null) {
      // 첫 번째 목적구
      this.turnState.firstObjectBall = hitBallId;
    } else if (
      hitBallId !== this.turnState.firstObjectBall &&
      !this.turnState.secondObjectBallHit
    ) {
      // 두 번째 목적구
      this.turnState.secondObjectBallHit = true;
    }
  }

  /**
   * 득점 판정
   */
  isValidScore(): boolean {
    if (!this.turnState) return false;

    // 1. 두 목적구 모두 맞췄는가?
    if (!this.turnState.secondObjectBallHit) return false;

    // 2. 두 번째 목적구 맞추기 전에 3회 이상 쿠션?
    if (this.turnState.cushionCount < RULES.REQUIRED_CUSHIONS) return false;

    return true;
  }

  /**
   * 현재 쿠션 카운트
   */
  getCushionCount(): number {
    return this.turnState?.cushionCount ?? 0;
  }

  /**
   * 턴 종료 및 결과
   */
  endTurn(): { isScore: boolean; events: CollisionEvent[] } {
    const result = {
      isScore: this.isValidScore(),
      events: this.turnState?.events ?? [],
    };
    
    this.turnState = null;
    return result;
  }

  /**
   * 상태 리셋
   */
  reset(): void {
    this.turnState = null;
  }
}

// 싱글톤 인스턴스
export const threeCushionRules = new ThreeCushionRules();

import type Ammo from 'ammo.js';
import * as THREE from 'three';
import { BilliardGame } from './BilliardGame';

/**
 * 3쿠션 룰 및 판정 시스템
 * 
 * 룰:
 * 1. 수구가 적구 3개 이상 맞아야 득점
 * 2. 단, 수구가 3쿠션(벽 3번) 이상 닿은 후에 적구를 맞춰야 함
 * 3. 수구와 적구가 먼저 맞으면 무효
 */

export interface CushionContact {
  ballId: string;
  cushionId: 'left' | 'right' | 'top' | 'bottom';
  timestamp: number;
}

export interface BallCollision {
  ballId1: string;
  ballId2: string;
  timestamp: number;
}

export interface TurnResult {
  isScore: boolean;
  cushionCount: number;
  objectBallsHit: string[];
  reason: string;
}

export class ThreeCushionRules {
  private cushionContacts: CushionContact[] = [];
  private ballCollisions: BallCollision[] = [];
  private turnStartTime: number = 0;

  // 콜백
  onCushionCollision?: (contact: CushionContact) => void;
  onBallCollision?: (collision: BallCollision) => void;
  onScore?: (result: TurnResult) => void;
  onMiss?: (result: TurnResult) => void;

  /**
   * 새 턴 시작
   */
  startTurn(): void {
    this.cushionContacts = [];
    this.ballCollisions = [];
    this.turnStartTime = Date.now();
  }

  /**
   * 쿠션 충독 기록
   */
  recordCushionCollision(ballId: string, cushionId: 'left' | 'right' | 'top' | 'bottom'): void {
    const contact: CushionContact = {
      ballId,
      cushionId,
      timestamp: Date.now(),
    };

    this.cushionContacts.push(contact);
    this.onCushionCollision?.(contact);
  }

  /**
   * 공-공 충돌 기록
   */
  recordBallCollision(ballId1: string, ballId2: string): void {
    const collision: BallCollision = {
      ballId1,
      ballId2,
      timestamp: Date.now(),
    };

    this.ballCollisions.push(collision);
    this.onBallCollision?.(collision);
  }

  /**
   * 턴 종료 및 판정
   */
  endTurn(): TurnResult {
    const cueBallCollisions = this.ballCollisions.filter(
      (c) => c.ballId1 === 'cue' || c.ballId2 === 'cue'
    );

    const cueBallCushions = this.cushionContacts.filter((c) => c.ballId === 'cue');
    const cushionCount = cueBallCushions.length;

    // 적구 맞춘 순서 체크
    const objectBallsHit: string[] = [];
    let validHit = false;

    for (const collision of cueBallCollisions) {
      const otherBall = collision.ballId1 === 'cue' ? collision.ballId2 : collision.ballId1;

      if (otherBall.startsWith('obj')) {
        objectBallsHit.push(otherBall);

        // 3쿠션 이후에 맞았는지 확인
        const cushionsBeforeHit = cueBallCushions.filter(
          (c) => c.timestamp <= collision.timestamp
        ).length;

        if (cushionsBeforeHit >= 3) {
          validHit = true;
        }
      }
    }

    // 중복 제거
    const uniqueObjectBalls = [...new Set(objectBallsHit)];

    // 득점 판정
    let isScore = false;
    let reason = '';

    if (validHit && uniqueObjectBalls.length >= 2) {
      isScore = true;
      reason = `3쿠션 후 ${uniqueObjectBalls.length}개 적구 맞춤!`;
    } else if (cushionCount < 3 && uniqueObjectBalls.length > 0) {
      reason = `쿠션 부족 (${cushionCount}/3) - 먼저 벽을 맞춰야 합니다`;
    } else if (cushionCount >= 3 && uniqueObjectBalls.length < 2) {
      reason = `적구 부족 (${uniqueObjectBalls.length}/2)`;
    } else if (uniqueObjectBalls.length === 0) {
      reason = '적구를 맞추지 못함';
    }

    const result: TurnResult = {
      isScore,
      cushionCount,
      objectBallsHit: uniqueObjectBalls,
      reason,
    };

    if (isScore) {
      this.onScore?.(result);
    } else {
      this.onMiss?.(result);
    }

    return result;
  }

  /**
   * 현재 쿠션 수
   */
  getCushionCount(): number {
    return this.cushionContacts.filter((c) => c.ballId === 'cue').length;
  }

  /**
   * 현재 상태
   */
  getStatus(): {
    cushionCount: number;
    needCushions: number;
    objectBallsHit: string[];
  } {
    const hitBalls = this.ballCollisions
      .filter((c) => c.ballId1 === 'cue' || c.ballId2 === 'cue')
      .map((c) => (c.ballId1 === 'cue' ? c.ballId2 : c.ballId1))
      .filter((id) => id.startsWith('obj'));

    return {
      cushionCount: this.getCushionCount(),
      needCushions: Math.max(0, 3 - this.getCushionCount()),
      objectBallsHit: [...new Set(hitBalls)],
    };
  }
}

/**
 * 통합 3쿠션 게임 매니저
 */
export class ThreeCushionGameManager {
  private game: BilliardGame;
  private rules: ThreeCushionRules;
  private ammo: typeof Ammo;

  // 게임 상태
  private scores: number[] = [0, 0];
  private currentPlayer: number = 0;
  private phase: 'aiming' | 'shooting' | 'simulating' | 'scoring' = 'aiming';

  // 콜백
  onScore?: (player: number, newScore: number) => void;
  onTurnChange?: (player: number) => void;
  onPhaseChange?: (phase: string) => void;

  constructor(ammo: typeof Ammo, game: BilliardGame) {
    this.ammo = ammo;
    this.game = game;
    this.rules = new ThreeCushionRules();

    this.setupCallbacks();
  }

  /**
   * 콜백 설정
   */
  private setupCallbacks(): void {
    // 쿠션 충돌 콜백 설정 (BilliardGame에서 연결 필요)
    this.rules.onCushionCollision = (contact) => {
      console.log(`[3Cushion] 쿠션 ${contact.cushionId}에 닿음 (총 ${this.rules.getCushionCount()}개)`);
    };

    this.rules.onBallCollision = (collision) => {
      console.log(`[3Cushion] ${collision.ballId1} - ${collision.ballId2} 충돌`);
    };

    this.rules.onScore = (result) => {
      this.scores[this.currentPlayer]++;
      this.onScore?.(this.currentPlayer, this.scores[this.currentPlayer]);
      console.log(`[3Cushion] 득점! ${result.reason}`);
    };

    this.rules.onMiss = (result) => {
      console.log(`[3Cushion] 미스: ${result.reason}`);
    };
  }

  /**
   * 새 턴 시작
   */
  startTurn(): void {
    this.rules.startTurn();
    this.phase = 'aiming';
    this.onPhaseChange?.('aiming');
  }

  /**
   * 샷 실행
   */
  executeShot(cueBallPoint: number, targetPoint: number, power: number, system: string): void {
    if (this.phase !== 'aiming') return;

    this.phase = 'shooting';
    this.onPhaseChange?.('shooting');

    // 하프 시스템 샷 실행
    this.game.executeHalfSystemShot(
      'cue',
      {
        cueBallPosition: cueBallPoint,
        targetPosition: targetPoint,
        tableCondition: 'normal',
      },
      power
    );

    // 시뮬레이션 시작
    setTimeout(() => {
      this.phase = 'simulating';
      this.onPhaseChange?.('simulating');
      this.checkSimulationEnd();
    }, 100);
  }

  /**
   * 시뮬레이션 종료 체크
   */
  private checkSimulationEnd(): void {
    const checkInterval = setInterval(() => {
      if (this.game.areAllBallsStopped()) {
        clearInterval(checkInterval);
        this.endTurn();
      }
    }, 100);
  }

  /**
   * 턴 종료
   */
  endTurn(): void {
    const result = this.rules.endTurn();
    this.phase = 'scoring';
    this.onPhaseChange?.('scoring');

    // 다음 턴 준비
    setTimeout(() => {
      if (!result.isScore) {
        this.currentPlayer = this.currentPlayer === 0 ? 1 : 0;
        this.onTurnChange?.(this.currentPlayer);
      }
      this.startTurn();
    }, 2000);
  }

  /**
   * 쿠션 충돌 알림 (외부에서 호출)
   */
  notifyCushionCollision(ballId: string, cushionId: 'left' | 'right' | 'top' | 'bottom'): void {
    this.rules.recordCushionCollision(ballId, cushionId);
  }

  /**
   * 공-공 충돌 알림 (외부에서 호출)
   */
  notifyBallCollision(ballId1: string, ballId2: string): void {
    this.rules.recordBallCollision(ballId1, ballId2);
  }

  /**
   * 현재 상태
   */
  getState() {
    return {
      phase: this.phase,
      currentPlayer: this.currentPlayer,
      scores: [...this.scores],
      ...this.rules.getStatus(),
    };
  }

  /**
   * 승리 체크
   */
  checkWinner(winningScore: number = 10): number | null {
    if (this.scores[0] >= winningScore) return 0;
    if (this.scores[1] >= winningScore) return 1;
    return null;
  }
}

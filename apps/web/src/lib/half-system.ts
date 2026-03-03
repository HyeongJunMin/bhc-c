import { HalfSystemResult } from '../types';

/**
 * 3쿠션 하프 시스템 (Half System) - 대대(International Match Table) 기준
 * 
 * [기본 원리]
 * 1. 기본 공식: 1쿠션 지점 = 수구 수치(Long Rail) ÷ 2
 * 2. 팁 회전(Ef-2)을 기준으로 계산
 * 3. 대대 특성: 일반적으로 짧게 떨어지는 경향이 있음
 */

export interface HalfSystemParams {
  /** 수구 위치 (Long Rail 포인트 0-50) */
  cueBallPosition: number;
  /** 목적구 위치 (Long Rail 포인트 0-50) */
  targetPosition: number;
  /** 목적구가 코너인지 여부 */
  isCorner?: boolean;
  /** 테이블 상태: 'tight'(빡빡), 'normal'(보통), 'slippery'(미끄러움) */
  tableCondition: 'tight' | 'normal' | 'slippery';
  /** 2쿠션에서 짧게/길게 조절 (± 포인트) */
  adjustment?: number;
}

export interface HalfSystemAdvice {
  /** 1쿠션 지점 (Long Rail) */
  firstCushionPoint: number;
  /** 추천 당점 (상하: -R ~ +R, 좌우: -R ~ +R) */
  recommendedTip: {
    vertical: number; // 상하 당점 (음수: 상단, 양수: 하단)
    horizontal: number; // 좌우 당점
  };
  /** 회전 수 (0-10 scale) */
  spinAmount: number;
  /** 테이블 보정값 (포인트) */
  tableCorrection: number;
  /** 주의사항 및 팁 */
  tips: string[];
  /** 예상 경로 */
  expectedPath: string;
}

export class HalfSystemSolver {
  private readonly RAIL_MAX = 50;
  private readonly RAIL_MIN = 0;
  private readonly BALL_RADIUS = 0.03075;

  /**
   * 하프 시스템 계산 - 대대 기준
   * 기본 공식: 1쿠션 = 수구 수치 ÷ 2
   */
  calculate(params: HalfSystemParams): HalfSystemAdvice {
    const { cueBallPosition, targetPosition, isCorner, tableCondition, adjustment = 0 } = params;

    // 1. 기본 1쿠션 지점 계산 (하프 시스템 핵심)
    let firstCushionPoint = cueBallPosition / 2;

    // 2. 목적구 위치에 따른 보정
    let targetCorrection = 0;
    if (isCorner) {
      // 코너 목표시 약간 길게
      targetCorrection = 1.5;
    } else {
      // 목적구가 수구보다 길게/짧게 있을 때 보정
      const targetDiff = targetPosition - cueBallPosition;
      targetCorrection = targetDiff * 0.1;
    }

    // 3. 테이블 상태에 따른 보정 (대대 특성 반영)
    let tableCorrection = 0;
    let conditionDescription = '';
    
    switch (tableCondition) {
      case 'tight':
        // 빡빡한 테이블: 쿠션 반발이 강함 → 짧게 떨어짐倾향
        tableCorrection = -1.5;
        conditionDescription = '빡빡함 (반발 강함)';
        break;
      case 'slippery':
        // 미끄러운 테이블: 공이 많이 미끄러짐 → 길게 떨어짐
        tableCorrection = 2.0;
        conditionDescription = '미끄러움 (구름 마찰 적음)';
        break;
      case 'normal':
      default:
        // 보통 테이블: 대대 특성상 약간 짧게
        tableCorrection = -0.5;
        conditionDescription = '보통 (대대 기준 짧게)';
        break;
    }

    // 4. 사용자 조정값 반영
    const userAdjustment = adjustment;

    // 5. 최종 1쿠션 지점 계산
    const finalCushionPoint = this.clamp(
      firstCushionPoint + targetCorrection + tableCorrection + userAdjustment,
      this.RAIL_MIN,
      this.RAIL_MAX
    );

    // 6. 당점 및 회전 계산
    const { tip, spin, spinDescription } = this.calculateSpin(
      cueBallPosition,
      finalCushionPoint,
      tableCondition
    );

    // 7. 주의사항 및 팁 생성
    const tips = this.generateTips(
      cueBallPosition,
      finalCushionPoint,
      tableCondition,
      conditionDescription
    );

    // 8. 예상 경로 설명
    const expectedPath = this.generatePathDescription(
      cueBallPosition,
      finalCushionPoint,
      targetPosition,
      isCorner
    );

    return {
      firstCushionPoint: Math.round(finalCushionPoint * 10) / 10,
      recommendedTip: tip,
      spinAmount: spin,
      tableCorrection: tableCorrection,
      tips,
      expectedPath,
    };
  }

  /**
   * 당점 및 회전 계산
   * 기준: 팁(Ef-2) 또는 그에 준하는 회전
   */
  private calculateSpin(
    cueBallPos: number,
    cushionPoint: number,
    condition: string
  ): { tip: { vertical: number; horizontal: number }; spin: number; spinDescription: string } {
    // 기본 팁 당점 (약간 위쪽에서 팁)
    const baseVertical = -this.BALL_RADIUS * 0.3; // 상단 30% 지점
    const baseHorizontal = 0;

    // 테이블 상태에 따른 회전 조절
    let spinMultiplier = 1.0;
    if (condition === 'tight') {
      spinMultiplier = 0.8; // 빡빡하면 회전 덜 줌
    } else if (condition === 'slippery') {
      spinMultiplier = 1.2; // 미끄러우면 회전 더 줌
    }

    // 수구가 길게 있을수록 회전 조절
    const lengthFactor = cueBallPos > 30 ? 0.9 : 1.0;

    const finalVertical = baseVertical * spinMultiplier * lengthFactor;
    const spinAmount = Math.round(6 * spinMultiplier * lengthFactor); // 0-10 scale

    let description = '';
    if (spinAmount >= 7) {
      description = '팁(Ef-2) - 강한 상단 회전';
    } else if (spinAmount >= 5) {
      description = '중간 팁 - 적절한 상단 회전';
    } else {
      description = '약한 팁 - 가벼운 상단 회전';
    }

    return {
      tip: {
        vertical: Math.round(finalVertical * 1000) / 1000,
        horizontal: baseHorizontal,
      },
      spin: spinAmount,
      spinDescription: description,
    };
  }

  /**
   * 주의사항 및 팁 생성
   */
  private generateTips(
    cueBallPos: number,
    cushionPoint: number,
    condition: string,
    conditionDesc: string
  ): string[] {
    const tips: string[] = [];

    // 테이블 상태 팁
    tips.push(`테이블 상태: ${conditionDesc}`);

    // 수구 위치 팁
    if (cueBallPos < 10) {
      tips.push('⚠️ 수구가 짧은 위치: 2쿠션 각도가 예민하니 짧게 주의');
    } else if (cueBallPos > 40) {
      tips.push('⚠️ 수구가 긴 위치: 1쿠션 짧게 보정 필요');
    }

    // 대대 특성
    tips.push('💡 대대 특성: 일반적으로 짧게 떨어지는 경향이 있음');

    // 회전 팁
    tips.push('💡 팁(Ef-2) 기준: 2쿠션 후 자연스럽게 펼쳐지는 회전량');

    // 컨디션별 팁
    if (condition === 'tight') {
      tips.push('🔴 빡빡한 테이블: 쿠션 반발이 강하므로 0.5~1 포인트 짧게 조준');
    } else if (condition === 'slippery') {
      tips.push('🔵 미끄러운 테이블: 공이 많이 굴러가므로 1~2 포인트 길게 조준');
    }

    // 1쿠션 지점 팁
    if (cushionPoint < 5) {
      tips.push('⚠️ 1쿠션이 매우 짧음: 코너 트랩 주의');
    } else if (cushionPoint > 45) {
      tips.push('⚠️ 1쿠션이 매우 김: 반대편 긴 쿠션 각도 주의');
    }

    return tips;
  }

  /**
   * 예상 경로 설명
   */
  private generatePathDescription(
    cueBallPos: number,
    cushion1: number,
    targetPos: number,
    isCorner?: boolean
  ): string {
    const target = isCorner ? '코너' : `${targetPos}포인트`;
    
    return `
[예상 득점 경로]
1. 수구(${cueBallPos}P) → 1쿠션(${cushion1.toFixed(1)}P) [Long Rail]
2. 1쿠션(${cushion1.toFixed(1)}P) → 2쿠션(Short Rail) 
3. 2쿠션 → 목적구(${target})

* 2쿠션 후 펼쳐지는 각도: ${(cueBallPos / 2).toFixed(1)}° 예상
* 3쿠션 득점 확률: 중간~높음 (팁 회전 기준)
    `.trim();
  }

  /**
   * 대대 기준 특수 상황 계산
   * - 코너 돌리기
   * - 뱅크샷
   * - 더블 쿠션
   */
  calculateSpecialShot(
    type: 'corner' | 'bank' | 'double',
    cueBallPos: number,
    targetPos: number,
    tableCondition: 'tight' | 'normal' | 'slippery'
  ): HalfSystemAdvice {
    switch (type) {
      case 'corner':
        return this.calculate({
          cueBallPosition: cueBallPos,
          targetPosition: targetPos,
          isCorner: true,
          tableCondition,
        });
      
      case 'bank':
        // 뱅크샷은 반대로 계산
        return this.calculate({
          cueBallPosition: cueBallPos,
          targetPosition: 50 - targetPos,
          isCorner: false,
          tableCondition,
          adjustment: 2.0, // 뱅크는 길게
        });
      
      case 'double':
        // 더블 쿠션
        return this.calculate({
          cueBallPosition: cueBallPos,
          targetPosition: targetPos,
          isCorner: false,
          tableCondition,
          adjustment: -1.0, // 더블은 짧게
        });
      
      default:
        return this.calculate({
          cueBallPosition: cueBallPos,
          targetPosition: targetPos,
          tableCondition,
        });
    }
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}

// 싱글톤 인스턴스
export const halfSystemSolver = new HalfSystemSolver();

/**
 * 사용 예시:
 * 
 * const advice = halfSystemSolver.calculate({
 *   cueBallPosition: 30,  // 수구가 30포인트에 있음
 *   targetPosition: 20,   // 목적구가 20포인트에 있음
 *   isCorner: false,
 *   tableCondition: 'normal'
 * });
 * 
 * console.log(advice.firstCushionPoint); // 15 (30 ÷ 2)
 */

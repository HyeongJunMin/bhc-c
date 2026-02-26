import { HalfSystemInput, HalfSystemResult } from '../types';

/**
 * Unity HalfSystemSolver.cs 포팅
 * 하프 시스템 계산 (3쿠션 득점샷 예측)
 */
export class HalfSystemSolver {
  private readonly sideSpinWeight = 2.2;
  private readonly verticalSpinWeight = 1.1;
  private readonly incidenceAngleWeight = 0.03;
  private readonly referenceAngleDeg = 35;
  private readonly railMin = 0;
  private readonly railMax = 50;

  /**
   * 하프 시스템 계산
   * @param input 하프 시스템 입력
   * @param useReturnModel 되돌리기 모델 사용 여부
   */
  solve(input: HalfSystemInput, useReturnModel = false): HalfSystemResult {
    // 기본 조준점 계산
    const baseAim = useReturnModel
      ? input.startIndex * 0.5
      : (input.startIndex + input.arrivalIndex) * 0.5;

    // 스핀 보정
    const spinCorrection =
      this.sideSpinWeight * this.clamp(input.sideEnglish, -1, 1) +
      this.verticalSpinWeight * this.clamp(input.verticalEnglish, -1, 1);

    // 입사각 보정
    const angleCorrection =
      this.incidenceAngleWeight * (input.incidenceAngleDeg - this.referenceAngleDeg);

    // 최종 조준점
    const finalAim = this.clamp(
      baseAim + spinCorrection + angleCorrection,
      this.railMin,
      this.railMax
    );

    return {
      baseAim,
      finalAim,
      spinCorrection,
      angleCorrection,
    };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}

// 싱글톤 인스턴스
export const halfSystemSolver = new HalfSystemSolver();

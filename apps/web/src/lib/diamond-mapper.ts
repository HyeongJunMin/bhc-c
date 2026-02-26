import { RailId, RailPoint } from '../types';
import { PHYSICS } from './constants';

/**
 * Unity DiamondMapper.cs 포팅
 * 쿠션 다이아몬드 좌표 변환
 */
export class DiamondMapper {
  private readonly tableWidth = PHYSICS.TABLE_WIDTH;
  private readonly tableHeight = PHYSICS.TABLE_HEIGHT;
  private readonly indexMin = 0;
  private readonly indexMax = 50;

  /**
   * 다이아몬드 인덱스를 테이블 좌표로 변환
   */
  indexToCoord(point: RailPoint): { x: number; y: number } {
    const t = this.inverseLerp(
      this.indexMin,
      this.indexMax,
      Math.max(this.indexMin, Math.min(this.indexMax, point.index50))
    );

    switch (point.rail) {
      case 'bottom':
        return { x: t * this.tableWidth, y: 0 };
      case 'right':
        return { x: this.tableWidth, y: t * this.tableHeight };
      case 'top':
        return { x: (1 - t) * this.tableWidth, y: this.tableHeight };
      case 'left':
        return { x: 0, y: (1 - t) * this.tableHeight };
      default:
        return { x: 0, y: 0 };
    }
  }

  /**
   * 좌표에서 가장 가까운 다이아몬드 인덱스 계산
   */
  coordToNearestIndex(rail: RailId, coord: { x: number; y: number }): RailPoint {
    let t: number;

    switch (rail) {
      case 'bottom':
        t = Math.max(0, Math.min(1, coord.x / this.tableWidth));
        return { rail, index50: this.lerp(this.indexMin, this.indexMax, t) };
      case 'right':
        t = Math.max(0, Math.min(1, coord.y / this.tableHeight));
        return { rail, index50: this.lerp(this.indexMin, this.indexMax, t) };
      case 'top':
        t = Math.max(0, Math.min(1, 1 - coord.x / this.tableWidth));
        return { rail, index50: this.lerp(this.indexMin, this.indexMax, t) };
      case 'left':
        t = Math.max(0, Math.min(1, 1 - coord.y / this.tableHeight));
        return { rail, index50: this.lerp(this.indexMin, this.indexMax, t) };
      default:
        return { rail, index50: 0 };
    }
  }

  get tableRect() {
    return {
      x: 0,
      y: 0,
      width: this.tableWidth,
      height: this.tableHeight,
    };
  }

  private inverseLerp(a: number, b: number, value: number): number {
    return (value - a) / (b - a);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
}

// 싱글톤 인스턴스
export const diamondMapper = new DiamondMapper();

import { describe, expect, it } from 'vitest';

import {
  recommendPreviewOffset,
  safeParseHistory,
  summarizeFahHistory,
  toFahHistoryCsv,
  type FahHistoryEntry,
} from './five-and-half-history';

function makeEntry(partial: Partial<FahHistoryEntry> = {}): FahHistoryEntry {
  return {
    id: partial.id ?? 'fah-1',
    createdAt: partial.createdAt ?? '2026-03-06T00:00:00.000Z',
    playerId: partial.playerId ?? 'player-1',
    systemMode: partial.systemMode ?? 'fiveAndHalf',
    correctedAim: partial.correctedAim ?? 30,
    expectedThirdCushion: partial.expectedThirdCushion ?? 45,
    confidence: partial.confidence ?? 0.8,
    thirdCushionIndexDelta: partial.thirdCushionIndexDelta ?? 0.4,
    landingDistanceM: partial.landingDistanceM ?? 0.02,
    calibrationOffset: partial.calibrationOffset ?? null,
    sampleCount: partial.sampleCount ?? null,
  };
}

describe('five-and-half-history', () => {
  it('safeParseHistory: 잘못된 JSON이면 빈 배열을 반환한다', () => {
    expect(safeParseHistory('{invalid')).toEqual([]);
    expect(safeParseHistory('{"a":1}')).toEqual([]);
    expect(safeParseHistory(null)).toEqual([]);
  });

  it('summarizeFahHistory: 평균/최대 오차와 confidence를 계산한다', () => {
    const entries = [
      makeEntry({ id: 'a', thirdCushionIndexDelta: -1.2, landingDistanceM: 0.03, confidence: 0.7 }),
      makeEntry({ id: 'b', thirdCushionIndexDelta: 0.5, landingDistanceM: 0.01, confidence: 0.9 }),
      makeEntry({ id: 'c', thirdCushionIndexDelta: -0.3, landingDistanceM: 0.02, confidence: 0.6 }),
    ];
    const summary = summarizeFahHistory(entries);
    expect(summary.total).toBe(3);
    expect(summary.avgAbsIndexDelta).toBe(0.667);
    expect(summary.maxAbsIndexDelta).toBe(1.2);
    expect(summary.avgLandingDistanceM).toBe(0.02);
    expect(summary.bestConfidence).toBe(0.9);
  });

  it('recommendPreviewOffset: 최근 샘플 오차 기반으로 반대 보정 offset을 추천한다', () => {
    const entries = [
      makeEntry({ id: '1', thirdCushionIndexDelta: 1.0, confidence: 0.8 }),
      makeEntry({ id: '2', thirdCushionIndexDelta: 0.8, confidence: 0.7 }),
      makeEntry({ id: '3', thirdCushionIndexDelta: 0.6, confidence: 0.9 }),
    ];
    const rec = recommendPreviewOffset(entries, 3);
    expect(rec.basisSampleCount).toBe(3);
    expect(rec.confidence).toBe(0.5);
    expect(rec.offset).toBeLessThan(0);
    expect(rec.offset).toBeCloseTo(-0.341, 3);
  });

  it('toFahHistoryCsv: 쉼표/따옴표를 포함한 셀을 CSV로 이스케이프한다', () => {
    const csv = toFahHistoryCsv([
      makeEntry({
        id: 'id-1',
        playerId: 'player,one',
        createdAt: '2026-03-06T01:02:03.000Z',
      }),
      makeEntry({
        id: 'id-2',
        playerId: 'player "two"',
        createdAt: '2026-03-06T02:03:04.000Z',
      }),
    ]);
    expect(csv.split('\n')).toHaveLength(3);
    expect(csv).toContain('"player,one"');
    expect(csv).toContain('"player ""two"""');
  });
});

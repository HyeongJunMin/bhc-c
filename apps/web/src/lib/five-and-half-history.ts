export const FAH_HISTORY_STORAGE_KEY = 'bhc.fah.history.v1';

export type FahHistoryEntry = {
  id: string;
  createdAt: string;
  playerId: string;
  systemMode: 'half' | 'fiveAndHalf' | 'plusTwo';
  correctedAim: number;
  expectedThirdCushion: number;
  confidence: number;
  thirdCushionIndexDelta: number;
  landingDistanceM: number;
  calibrationOffset: number | null;
  sampleCount: number | null;
};

export type FahHistorySummary = {
  total: number;
  avgAbsIndexDelta: number;
  maxAbsIndexDelta: number;
  avgLandingDistanceM: number;
  bestConfidence: number;
};

export type FahPreviewRecommendation = {
  offset: number;
  basisSampleCount: number;
  confidence: number;
};

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function safeParseHistory(raw: string | null): FahHistoryEntry[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item): item is FahHistoryEntry => {
        return (
          typeof item === 'object' &&
          item !== null &&
          typeof (item as FahHistoryEntry).id === 'string' &&
          typeof (item as FahHistoryEntry).createdAt === 'string'
        );
      })
      .slice(-100);
  } catch {
    return [];
  }
}

export function summarizeFahHistory(entries: FahHistoryEntry[]): FahHistorySummary {
  if (entries.length === 0) {
    return {
      total: 0,
      avgAbsIndexDelta: 0,
      maxAbsIndexDelta: 0,
      avgLandingDistanceM: 0,
      bestConfidence: 0,
    };
  }
  const absDeltas = entries.map((entry) => Math.abs(entry.thirdCushionIndexDelta));
  const avgAbsIndexDelta = absDeltas.reduce((acc, value) => acc + value, 0) / absDeltas.length;
  const maxAbsIndexDelta = Math.max(...absDeltas);
  const avgLandingDistanceM = entries.reduce((acc, entry) => acc + entry.landingDistanceM, 0) / entries.length;
  const bestConfidence = Math.max(...entries.map((entry) => entry.confidence));
  return {
    total: entries.length,
    avgAbsIndexDelta: round3(avgAbsIndexDelta),
    maxAbsIndexDelta: round3(maxAbsIndexDelta),
    avgLandingDistanceM: round3(avgLandingDistanceM),
    bestConfidence: round3(bestConfidence),
  };
}

export function toFahHistoryCsv(entries: FahHistoryEntry[]): string {
  const header = [
    'id',
    'createdAt',
    'playerId',
    'systemMode',
    'correctedAim',
    'expectedThirdCushion',
    'confidence',
    'thirdCushionIndexDelta',
    'landingDistanceM',
    'calibrationOffset',
    'sampleCount',
  ];
  const rows = entries.map((entry) => [
    entry.id,
    entry.createdAt,
    entry.playerId,
    entry.systemMode,
    String(entry.correctedAim),
    String(entry.expectedThirdCushion),
    String(entry.confidence),
    String(entry.thirdCushionIndexDelta),
    String(entry.landingDistanceM),
    entry.calibrationOffset === null ? '' : String(entry.calibrationOffset),
    entry.sampleCount === null ? '' : String(entry.sampleCount),
  ]);
  const encodeCell = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.split('"').join('""')}"`;
    }
    return value;
  };
  return [header, ...rows].map((row) => row.map(encodeCell).join(',')).join('\n');
}

export function recommendPreviewOffset(entries: FahHistoryEntry[], recentWindow: number = 12): FahPreviewRecommendation {
  const source = entries.slice(-Math.max(1, recentWindow));
  if (source.length === 0) {
    return { offset: 0, basisSampleCount: 0, confidence: 0 };
  }

  let weightedDeltaSum = 0;
  let weightedConfidenceSum = 0;
  source.forEach((entry, index) => {
    const recencyWeight = 0.75 + (index + 1) / source.length;
    const confidenceWeight = Math.max(0.2, entry.confidence);
    const weight = recencyWeight * confidenceWeight;
    weightedDeltaSum += entry.thirdCushionIndexDelta * weight;
    weightedConfidenceSum += weight;
  });

  const meanDelta = weightedConfidenceSum > 0 ? weightedDeltaSum / weightedConfidenceSum : 0;
  const offset = round3(-meanDelta * 0.45);
  const confidence = round3(Math.min(0.99, 0.35 + source.length * 0.05));
  return {
    offset,
    basisSampleCount: source.length,
    confidence,
  };
}

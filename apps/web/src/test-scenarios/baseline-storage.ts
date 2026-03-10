import type { BaselineData } from './types.ts';
import type { SimResult } from '../../../../packages/physics-core/src/standalone-simulator.ts';

const BASELINE_VERSION = 1;
const storageKey = (scenarioId: string) => `physics-baseline-${scenarioId}`;

export function saveBaseline(scenarioId: string, result: SimResult): void {
  const data: BaselineData = {
    version: BASELINE_VERSION,
    scenarioId,
    generatedAt: new Date().toISOString(),
    result,
  };
  localStorage.setItem(storageKey(scenarioId), JSON.stringify(data));
}

export function loadBaseline(scenarioId: string): BaselineData | null {
  const raw = localStorage.getItem(storageKey(scenarioId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as BaselineData;
    if (parsed.version !== BASELINE_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function deleteBaseline(scenarioId: string): void {
  localStorage.removeItem(storageKey(scenarioId));
}

export function downloadBaselineJson(scenarioId: string, result: SimResult): void {
  const data: BaselineData = {
    version: BASELINE_VERSION,
    scenarioId,
    generatedAt: new Date().toISOString(),
    result,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `baseline-${scenarioId}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importBaselineFromJson(file: File): Promise<BaselineData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text) as BaselineData;
        if (data.version !== BASELINE_VERSION) {
          reject(new Error(`Unsupported baseline version: ${data.version}`));
          return;
        }
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

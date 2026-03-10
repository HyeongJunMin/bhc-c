import type { SandboxConfig } from './types.ts';
import type { SimResult } from '../../../../packages/physics-core/src/standalone-simulator.ts';

export type SandboxExport = {
  version: 1;
  exportedAt: string;
  config: SandboxConfig;
  result: SimResult;
};

export function exportSandboxJson(config: SandboxConfig, result: SimResult): void {
  const data: SandboxExport = {
    version: 1,
    exportedAt: new Date().toISOString(),
    config,
    result,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sandbox-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

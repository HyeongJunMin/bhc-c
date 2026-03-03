import type { SandboxInput } from './types';

type SandboxExportPayload = {
  balls: SandboxInput['balls'];
  shot: SandboxInput['shot'];
};

function toExportPayload(input: SandboxInput): SandboxExportPayload {
  return {
    balls: {
      cueBall: { ...input.balls.cueBall },
      objectBall1: { ...input.balls.objectBall1 },
      objectBall2: { ...input.balls.objectBall2 },
    },
    shot: { ...input.shot },
  };
}

export function exportSandboxInputJson(input: SandboxInput): void {
  const payload = toExportPayload(input);
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `sandbox-input-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

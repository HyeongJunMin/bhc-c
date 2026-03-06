import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { runSimulation } from '../../../../packages/physics-core/src/standalone-simulator.ts';
import type { SimResult } from '../../../../packages/physics-core/src/standalone-simulator.ts';
import { TestScene } from '../components/test/TestScene.tsx';
import { PlaybackSlider } from '../components/test/PlaybackSlider.tsx';
import { SandboxControlPanel } from '../components/test/SandboxControlPanel.tsx';
import { FrameKinematicsPanel } from '../components/test/FrameKinematicsPanel.tsx';
import { SANDBOX_PRESETS } from '../test-sandbox/presets.ts';
import { exportSandboxJson } from '../test-sandbox/export.ts';
import type { SandboxConfig } from '../test-sandbox/types.ts';

const PHYSICS_DT_SEC = 0.05;

const DEFAULT_CONFIG: SandboxConfig = SANDBOX_PRESETS['straight'];

const styles = {
  container: {
    minHeight: '100vh',
    background: '#0d0d1a',
    color: '#e0e0e0',
    fontFamily: 'monospace',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
    padding: '1rem',
  } as React.CSSProperties,
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  } as React.CSSProperties,
  title: {
    fontSize: '1.2rem',
    fontWeight: 'bold',
    color: '#4caf50',
    margin: 0,
  } as React.CSSProperties,
  backLink: {
    color: '#aaa',
    textDecoration: 'none',
    fontSize: '0.9rem',
  } as React.CSSProperties,
  mainLayout: {
    display: 'grid',
    gridTemplateColumns: '280px 1fr',
    gap: '0.75rem',
    flex: 1,
  } as React.CSSProperties,
  sceneArea: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
  } as React.CSSProperties,
  hint: {
    fontSize: '0.75rem',
    color: '#555',
  } as React.CSSProperties,
};

export function TestSandboxPage() {
  const [config, setConfig] = useState<SandboxConfig>(DEFAULT_CONFIG);
  const [result, setResult] = useState<SimResult | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);

  const handleRun = useCallback(() => {
    const activeBalls = config.balls.filter((b) => b.enabled);
    if (activeBalls.length === 0) return;
    const simResult = runSimulation(activeBalls, config.shot);
    setResult(simResult);
    setCurrentFrame(0);
  }, [config]);

  const handleExport = useCallback(() => {
    if (!result) return;
    exportSandboxJson(config, result);
  }, [config, result]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'r' || e.key === 'R') {
        handleRun();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleRun]);

  const totalFrames = result ? result.totalFrames : 0;
  const currentFrameData = result?.frames[currentFrame] ?? null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Sandbox</h1>
        <Link to="/test" style={styles.backLink}>← Scenarios</Link>
        <span style={styles.hint}>R = Run</span>
      </div>

      <div style={styles.mainLayout}>
        <SandboxControlPanel
          config={config}
          onConfigChange={setConfig}
          onRun={handleRun}
          onExport={handleExport}
        />

        <div style={styles.sceneArea}>
          <TestScene
            result={result}
            baselineResult={null}
            currentFrame={currentFrame}
            height="420px"
            initialBalls={config.balls}
            shotDirection={{ directionDeg: config.shot.directionDeg, cueBallId: config.shot.cueBallId }}
          />

          {result && (
            <PlaybackSlider
              totalFrames={totalFrames}
              currentFrame={currentFrame}
              dtSec={PHYSICS_DT_SEC}
              onFrameChange={setCurrentFrame}
            />
          )}

          <FrameKinematicsPanel frame={currentFrameData} />
        </div>
      </div>
    </div>
  );
}

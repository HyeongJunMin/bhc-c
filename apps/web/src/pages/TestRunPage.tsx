import { useState, useCallback, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getScenario } from '../test-scenarios/index.ts';
import { runSimulation } from '../../../../packages/physics-core/src/standalone-simulator.ts';
import type { SimResult } from '../../../../packages/physics-core/src/standalone-simulator.ts';
import {
  saveBaseline,
  loadBaseline,
  deleteBaseline,
  downloadBaselineJson,
} from '../test-scenarios/baseline-storage.ts';
import { analyzeTrajectory } from '../test-scenarios/trajectory-analyzer.ts';
import type { AnalysisResult } from '../test-scenarios/trajectory-analyzer.ts';
import { TestScene } from '../components/test/TestScene.tsx';
import { PlaybackSlider } from '../components/test/PlaybackSlider.tsx';
import { ControlPanel } from '../components/test/ControlPanel.tsx';
import type { TestConfig } from '../components/test/ControlPanel.tsx';
import { AnalysisPanel } from '../components/test/AnalysisPanel.tsx';
import { FrameKinematicsPanel } from '../components/test/FrameKinematicsPanel.tsx';

const PHYSICS_DT_SEC = 0.05 / 4;

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
    color: '#00d4ff',
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
  sidebar: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
  } as React.CSSProperties,
  sceneArea: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
  } as React.CSSProperties,
  checkRow: {
    display: 'flex',
    gap: '1rem',
    fontSize: '0.8rem',
    color: '#aaa',
  } as React.CSSProperties,
  notFound: {
    color: '#f44336',
    padding: '2rem',
    fontFamily: 'monospace',
  } as React.CSSProperties,
};

export function TestRunPage() {
  const { id } = useParams<{ id: string }>();
  const scenario = id ? getScenario(id) : undefined;

  const [config, setConfig] = useState<TestConfig>(() => ({
    balls: scenario?.balls ?? [],
    shot: scenario?.shot ?? { cueBallId: 'cueBall', directionDeg: 0, dragPx: 100, impactOffsetX: 0, impactOffsetY: 0 },
  }));

  useEffect(() => {
    if (scenario) setConfig({ balls: scenario.balls, shot: scenario.shot });
  }, [scenario]);

  const [result, setResult] = useState<SimResult | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [showBaseline, setShowBaseline] = useState(false);
  const [showDeviation, setShowDeviation] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [baselineLoaded, setBaselineLoaded] = useState<SimResult | null>(() => {
    if (!id) return null;
    const bl = loadBaseline(id);
    return bl?.result ?? null;
  });

  const handleRun = useCallback(() => {
    if (!scenario) return;
    const simResult = runSimulation(config.balls, config.shot, { dtSec: 0.0125, substeps: 3 });
    setResult(simResult);
    setCurrentFrame(0);
    setAnalysis(null);
  }, [scenario, config]);

  const handleSaveBaseline = useCallback(() => {
    if (!scenario || !result) return;
    saveBaseline(scenario.id, result);
    setBaselineLoaded(result);
  }, [scenario, result]);

  const handleDeleteBaseline = useCallback(() => {
    if (!scenario) return;
    deleteBaseline(scenario.id);
    setBaselineLoaded(null);
    setAnalysis(null);
    setShowBaseline(false);
    setShowDeviation(false);
  }, [scenario]);

  const handleCompare = useCallback(() => {
    if (!result || !baselineLoaded) return;
    const a = analyzeTrajectory(result, baselineLoaded);
    setAnalysis(a);
    setShowBaseline(true);
    setShowDeviation(true);
  }, [result, baselineLoaded]);

  const handleDownload = useCallback(() => {
    if (!scenario || !result) return;
    downloadBaselineJson(scenario.id, result);
  }, [scenario, result]);

  if (!scenario) {
    return <div style={styles.notFound}>Scenario not found: {id}</div>;
  }

  const totalFrames = result ? result.totalFrames : 0;
  const currentFrameData = result?.frames[currentFrame] ?? null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>{scenario.name}</h1>
        <Link to="/test" style={styles.backLink}>← Scenarios</Link>
      </div>

      <div style={styles.mainLayout}>
        <div style={styles.sidebar}>
          <ControlPanel
            scenario={scenario}
            config={config}
            onConfigChange={setConfig}
            result={result}
            hasBaseline={!!baselineLoaded}
            onRun={handleRun}
            onSaveBaseline={handleSaveBaseline}
            onDeleteBaseline={handleDeleteBaseline}
            onCompare={handleCompare}
            onDownload={handleDownload}
          />
          {analysis && <AnalysisPanel analysis={analysis} />}
        </div>

        <div style={styles.sceneArea}>
          <TestScene
            result={result}
            baselineResult={baselineLoaded}
            currentFrame={currentFrame}
            showBaseline={showBaseline}
            showDeviation={showDeviation}
            height="420px"
            initialBalls={config.balls}
            shotDirection={{ directionDeg: config.shot.directionDeg, cueBallId: config.shot.cueBallId, impactOffsetX: config.shot.impactOffsetX }}
          />

          {result && (
            <>
              <div style={styles.checkRow}>
                <label>
                  <input
                    type="checkbox"
                    checked={showBaseline}
                    onChange={(e) => setShowBaseline(e.target.checked)}
                    disabled={!baselineLoaded}
                  />
                  {' '}Show Baseline
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={showDeviation}
                    onChange={(e) => setShowDeviation(e.target.checked)}
                    disabled={!baselineLoaded}
                  />
                  {' '}Show Deviation
                </label>
              </div>

              <PlaybackSlider
                totalFrames={totalFrames}
                currentFrame={currentFrame}
                dtSec={PHYSICS_DT_SEC}
                onFrameChange={setCurrentFrame}
              />
            </>
          )}

          <FrameKinematicsPanel frame={currentFrameData} />
        </div>
      </div>
    </div>
  );
}

import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getScenario } from '../test-scenarios/index';
import type { BaselineData } from '../test-scenarios/index';
import { simulateShot } from '@physics-core/standalone-simulator';
import type { SimulationResult } from '@physics-core/standalone-simulator';
import { analyzeTrajectory } from '../physics-sim/trajectory-analyzer';
import type { TrajectoryAnalysis } from '../physics-sim/trajectory-analyzer';
import { TestScene } from '../components/test/TestScene';
import { ControlPanel } from '../components/test/ControlPanel';
import { PlaybackSlider } from '../components/test/PlaybackSlider';
import { AnalysisPanel } from '../components/test/AnalysisPanel';
import { FrameKinematicsPanel } from '../components/test/FrameKinematicsPanel';

const BASELINE_STORAGE_PREFIX = 'physics-baseline-';

function loadBaseline(scenarioId: string): SimulationResult | null {
  try {
    const raw = localStorage.getItem(BASELINE_STORAGE_PREFIX + scenarioId);
    if (!raw) {
      return null;
    }
    const data = JSON.parse(raw) as BaselineData;
    return { frames: data.frames, events: data.events, totalFrames: data.frames.length, totalTimeSec: (data.frames.length - 1) * 0.05 };
  } catch {
    return null;
  }
}

function saveBaseline(scenarioId: string, result: SimulationResult): void {
  const data: BaselineData = {
    version: 1,
    generatedAt: new Date().toISOString(),
    scenarioId,
    frames: result.frames,
    events: result.events,
  };
  const json = JSON.stringify(data, null, 2);

  // Save to localStorage
  localStorage.setItem(BASELINE_STORAGE_PREFIX + scenarioId, json);

  // Also trigger a download
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${scenarioId}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function TestRunPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const scenario = id ? getScenario(id) : undefined;

  const [actual, setActual] = useState<SimulationResult | null>(null);
  const [baseline, setBaseline] = useState<SimulationResult | null>(null);
  const [analysis, setAnalysis] = useState<TrajectoryAnalysis | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);

  // Load baseline from storage on mount
  useEffect(() => {
    if (id) {
      setBaseline(loadBaseline(id));
    }
  }, [id]);

  const handleExecute = useCallback(() => {
    if (!scenario) {
      return;
    }
    setIsRunning(true);
    setActual(null);
    setAnalysis(null);
    setCurrentFrame(0);

    // Run in next tick to allow UI to update
    setTimeout(() => {
      try {
        const result = simulateShot({
          balls: [
            { id: 'cueBall',     x: scenario.balls.cueBall.x,     z: scenario.balls.cueBall.z },
            { id: 'objectBall1', x: scenario.balls.objectBall1.x, z: scenario.balls.objectBall1.z },
            { id: 'objectBall2', x: scenario.balls.objectBall2.x, z: scenario.balls.objectBall2.z },
          ],
          shot: scenario.shot,
        });
        setActual(result);
        setCurrentFrame(result.totalFrames - 1);

        if (baseline) {
          const ana = analyzeTrajectory(result, baseline);
          setAnalysis(ana);
        }
      } catch (err) {
        console.error('simulateShot failed:', err);
      } finally {
        setIsRunning(false);
      }
    }, 0);
  }, [scenario, baseline]);

  const handleReset = useCallback(() => {
    setActual(null);
    setAnalysis(null);
    setCurrentFrame(0);
  }, []);

  const handleSaveBaseline = useCallback(() => {
    if (!actual || !id) {
      return;
    }
    saveBaseline(id, actual);
    setBaseline(actual);
    // Re-run analysis against new baseline
    if (actual) {
      const ana = analyzeTrajectory(actual, actual);
      setAnalysis(ana);
    }
  }, [actual, id]);

  if (!scenario) {
    return (
      <div style={{ color: '#f1f5f9', padding: 32, fontFamily: 'system-ui, sans-serif' }}>
        <p>시나리오를 찾을 수 없습니다: {id}</p>
        <button onClick={() => navigate('/test')} style={{ marginTop: 16, cursor: 'pointer' }}>
          목록으로
        </button>
      </div>
    );
  }

  const totalFrames = actual?.totalFrames ?? 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#0f172a',
        color: '#f1f5f9',
        fontFamily: 'system-ui, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 16px',
          background: '#0f1e35',
          borderBottom: '1px solid #1e293b',
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => navigate('/test')}
          style={{
            background: '#1e293b',
            border: '1px solid #334155',
            color: '#94a3b8',
            borderRadius: 4,
            padding: '4px 10px',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          ← 목록
        </button>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{scenario.name}</span>
        <span style={{ color: '#475569', fontSize: 12 }}>{scenario.id}</span>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* 3D view area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* 3D Scene */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <TestScene
              actual={actual}
              baseline={baseline}
              analysis={analysis}
              currentFrame={currentFrame}
            />
          </div>

          {/* Playback slider */}
          <PlaybackSlider
            currentFrame={currentFrame}
            totalFrames={totalFrames}
            onFrameChange={setCurrentFrame}
          />

          {/* Legend */}
          <div
            style={{
              display: 'flex',
              gap: 16,
              padding: '6px 16px',
              background: '#0f1e35',
              borderTop: '1px solid #1e293b',
              fontSize: 11,
              color: '#64748b',
            }}
          >
            <span>— 실선: 현재 시뮬레이션</span>
            <span style={{ opacity: 0.6 }}>- - 점선: baseline</span>
            <span>● 빨간 점: 최대 편차 위치</span>
            <span>■ 흰=수구 · 빨=1적 · 금=2적</span>
          </div>
        </div>

        {/* Right panel */}
        <div
          style={{
            width: 280,
            flexShrink: 0,
            borderLeft: '1px solid #1e293b',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Control panel (top half) */}
          <div
            style={{
              flex: '0 0 auto',
              padding: 16,
              borderBottom: '1px solid #1e293b',
              overflowY: 'auto',
              maxHeight: '55%',
            }}
          >
            <ControlPanel
              scenario={scenario}
              hasBaseline={baseline !== null}
              isRunning={isRunning}
              actual={actual}
              onExecute={handleExecute}
              onReset={handleReset}
              onSaveBaseline={handleSaveBaseline}
            />
          </div>

          {/* Analysis panel (bottom half) */}
          <div style={{ flex: 1, minHeight: 0, padding: 16, overflowY: 'auto' }}>
            <div style={{ marginBottom: 12 }}>
              <FrameKinematicsPanel
                result={actual}
                currentFrame={currentFrame}
                onFrameSelect={setCurrentFrame}
              />
            </div>
            <AnalysisPanel
              analysis={analysis}
              events={actual?.events ?? []}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SANDBOX_INPUT, SANDBOX_PRESETS } from '../test-sandbox/presets';
import type { SandboxInput } from '../test-sandbox/types';
import { SandboxControlPanel } from '../components/test/SandboxControlPanel';
import { simulateShot } from '@physics-core/standalone-simulator';
import type { SimulationResult } from '@physics-core/standalone-simulator';
import { TestScene } from '../components/test/TestScene';
import { PlaybackSlider } from '../components/test/PlaybackSlider';
import { exportSandboxInputJson } from '../test-sandbox/export';

export function TestSandboxPage() {
  const navigate = useNavigate();
  const [input, setInput] = useState<SandboxInput>(DEFAULT_SANDBOX_INPUT);
  const [actual, setActual] = useState<SimulationResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [activePresetId, setActivePresetId] = useState(SANDBOX_PRESETS[0]?.id ?? '');

  const handleExecute = useCallback(() => {
    setIsRunning(true);
    setTimeout(() => {
      try {
        const result = simulateShot({
          balls: [
            { id: 'cueBall', x: input.balls.cueBall.x, z: input.balls.cueBall.z },
            { id: 'objectBall1', x: input.balls.objectBall1.x, z: input.balls.objectBall1.z },
            { id: 'objectBall2', x: input.balls.objectBall2.x, z: input.balls.objectBall2.z },
          ],
          shot: input.shot,
        });
        setActual(result);
        setCurrentFrame(Math.max(0, result.totalFrames - 1));
      } finally {
        setIsRunning(false);
      }
    }, 0);
  }, [input]);

  const handleReset = useCallback(() => {
    setActual(null);
    setCurrentFrame(0);
  }, []);

  const handlePreset = useCallback((presetId: string) => {
    const preset = SANDBOX_PRESETS.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }
    setInput(preset.input);
    setActivePresetId(preset.id);
    setActual(null);
    setCurrentFrame(0);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase() ?? '';
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 'r') {
        event.preventDefault();
        handleExecute();
        return;
      }
      if (key === 'c') {
        event.preventDefault();
        handleReset();
        return;
      }

      const presetIndex = Number(key);
      if (Number.isInteger(presetIndex) && presetIndex >= 1 && presetIndex <= 5) {
        const preset = SANDBOX_PRESETS[presetIndex - 1];
        if (preset) {
          event.preventDefault();
          handlePreset(preset.id);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleExecute, handlePreset, handleReset]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f172a',
        color: '#f1f5f9',
        fontFamily: 'system-ui, sans-serif',
        padding: '32px 24px',
      }}
    >
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button
            onClick={() => navigate('/test')}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#94a3b8',
              borderRadius: 6,
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            ← 목록
          </button>
          <h1 style={{ margin: 0, fontSize: 24 }}>Sandbox</h1>
        </div>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(320px, 420px) minmax(0, 1fr)' }}>
          <div style={{ border: '1px solid #1e293b', borderRadius: 8, background: '#0f1e35', padding: 14 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button
                onClick={handleExecute}
                disabled={isRunning}
                style={{
                  background: isRunning ? '#1e3a5f' : '#2563eb',
                  color: '#f1f5f9',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 12px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isRunning ? 'not-allowed' : 'pointer',
                }}
              >
                {isRunning ? '실행 중...' : 'Run'}
              </button>
              <button
                onClick={handleReset}
                style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  color: '#cbd5e1',
                  borderRadius: 6,
                  padding: '8px 12px',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Reset
              </button>
              <button
                onClick={() => exportSandboxInputJson(input)}
                style={{
                  background: '#0f3a2a',
                  border: '1px solid #166534',
                  color: '#86efac',
                  borderRadius: 6,
                  padding: '8px 12px',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Export JSON
              </button>
            </div>
            <div style={{ marginBottom: 10, color: '#64748b', fontSize: 11 }}>
              단축키: <code>R</code> 실행, <code>C</code> 리셋, <code>1~5</code> 프리셋
            </div>
            <div style={{ marginBottom: 10, color: '#fca5a5', fontSize: 11 }}>
              물리 상수는 샌드박스에서 변경할 수 없습니다. (위치/샷 파라미터만 편집)
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>프리셋</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SANDBOX_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handlePreset(preset.id)}
                    style={{
                      background: preset.id === activePresetId ? '#0f766e' : '#1e293b',
                      border: `1px solid ${preset.id === activePresetId ? '#14b8a6' : '#334155'}`,
                      color: preset.id === activePresetId ? '#ccfbf1' : '#cbd5e1',
                      borderRadius: 4,
                      padding: '4px 8px',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                    title={preset.description}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
            <SandboxControlPanel input={input} onChange={setInput} />
          </div>
          <div
            style={{
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            <div
              style={{
                flex: 1,
                minHeight: 360,
                borderRadius: 8,
                border: '1px solid #1e293b',
                overflow: 'hidden',
              }}
            >
              <TestScene actual={actual} baseline={null} analysis={null} currentFrame={currentFrame} />
            </div>
            <PlaybackSlider
              currentFrame={currentFrame}
              totalFrames={actual?.totalFrames ?? 0}
              onFrameChange={setCurrentFrame}
            />
            <pre
              style={{
                margin: 0,
                padding: 12,
                borderRadius: 8,
                background: '#0b1220',
                color: '#93c5fd',
                border: '1px solid #1e293b',
                fontSize: 12,
                overflowX: 'auto',
              }}
            >
              {JSON.stringify(input, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

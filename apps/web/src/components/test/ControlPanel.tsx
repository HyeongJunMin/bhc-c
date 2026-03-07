import type { TestScenario } from '../../test-scenarios/types.ts';
import type { SimResult } from '../../../../../packages/physics-core/src/standalone-simulator.ts';
import { SliderRow } from './SliderRow.tsx';

const TABLE_WIDTH = 2.844;
const TABLE_HEIGHT = 1.422;
const BALL_RADIUS = 0.03075;
const MAX_IMPACT_OFFSET = BALL_RADIUS * 0.7;

export type TestConfig = {
  balls: Array<{ id: string; x: number; y: number }>;
  shot: TestScenario['shot'];
};

const styles = {
  container: {
    background: '#1a1a2e',
    border: '1px solid #0f3460',
    borderRadius: '8px',
    padding: '1rem',
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    color: '#e0e0e0',
  } as React.CSSProperties,
  row: { display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' } as React.CSSProperties,
  label: { color: '#aaa' } as React.CSSProperties,
  value: { color: '#00d4ff' } as React.CSSProperties,
  divider: { borderColor: '#0f3460', margin: '0.5rem 0' } as React.CSSProperties,
  btnRow: { display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' as const } as React.CSSProperties,
  btn: {
    background: '#0f3460',
    border: 'none',
    color: '#e0e0e0',
    padding: '0.4rem 0.8rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
  } as React.CSSProperties,
  btnPrimary: {
    background: '#00d4ff',
    border: 'none',
    color: '#1a1a2e',
    padding: '0.4rem 0.8rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 'bold',
  } as React.CSSProperties,
  btnDanger: {
    background: '#8b0000',
    border: 'none',
    color: '#e0e0e0',
    padding: '0.4rem 0.8rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
  } as React.CSSProperties,
  btnReset: {
    background: '#5a4000',
    border: 'none',
    color: '#ffd700',
    padding: '0.4rem 0.8rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
  } as React.CSSProperties,
  sectionTitle: { color: '#888', fontSize: '0.75rem', marginBottom: '0.4rem' } as React.CSSProperties,
};

type Props = {
  scenario: TestScenario;
  config: TestConfig;
  onConfigChange: (config: TestConfig) => void;
  result: SimResult | null;
  hasBaseline: boolean;
  onRun: () => void;
  onSaveBaseline: () => void;
  onDeleteBaseline: () => void;
  onCompare: () => void;
  onDownload: () => void;
};

export function ControlPanel({
  scenario,
  config,
  onConfigChange,
  result,
  hasBaseline,
  onRun,
  onSaveBaseline,
  onDeleteBaseline,
  onCompare,
  onDownload,
}: Props) {
  const updateBall = (id: string, field: 'x' | 'y', v: number) => {
    onConfigChange({
      ...config,
      balls: config.balls.map((b) => (b.id === id ? { ...b, [field]: v } : b)),
    });
  };

  const updateShot = (patch: Partial<TestConfig['shot']>) => {
    onConfigChange({ ...config, shot: { ...config.shot, ...patch } });
  };

  const handleReset = () => {
    onConfigChange({ balls: scenario.balls, shot: scenario.shot });
  };

  return (
    <div style={styles.container}>
      <div style={styles.sectionTitle}>Scenario</div>
      <div style={styles.row}><span style={styles.label}>ID</span><span style={styles.value}>{scenario.id}</span></div>
      <div style={styles.row}><span style={styles.label}>Tags</span><span style={styles.value}>{scenario.tags.join(', ')}</span></div>
      <hr style={styles.divider} />

      <div style={styles.sectionTitle}>Balls</div>
      {config.balls.map((b) => (
        <div key={b.id}>
          <div style={{ ...styles.label, marginBottom: '0.2rem', fontSize: '0.75rem' }}>{b.id}</div>
          <SliderRow
            label="x"
            value={b.x}
            min={BALL_RADIUS}
            max={TABLE_WIDTH - BALL_RADIUS}
            step={0.01}
            onChange={(v) => updateBall(b.id, 'x', v)}
          />
          <SliderRow
            label="y"
            value={b.y}
            min={BALL_RADIUS}
            max={TABLE_HEIGHT - BALL_RADIUS}
            step={0.01}
            onChange={(v) => updateBall(b.id, 'y', v)}
          />
        </div>
      ))}
      <hr style={styles.divider} />

      <div style={styles.sectionTitle}>Shot</div>
      <SliderRow
        label="direction"
        value={config.shot.directionDeg}
        min={0}
        max={360}
        step={1}
        onChange={(v) => updateShot({ directionDeg: v })}
      />
      <SliderRow
        label="drag"
        value={config.shot.dragPx}
        min={10}
        max={400}
        step={5}
        onChange={(v) => updateShot({ dragPx: v })}
      />
      <SliderRow
        label="impactX"
        value={config.shot.impactOffsetX}
        min={-MAX_IMPACT_OFFSET}
        max={MAX_IMPACT_OFFSET}
        step={0.001}
        onChange={(v) => updateShot({ impactOffsetX: v })}
      />
      <SliderRow
        label="impactY"
        value={config.shot.impactOffsetY}
        min={-MAX_IMPACT_OFFSET}
        max={MAX_IMPACT_OFFSET}
        step={0.001}
        onChange={(v) => updateShot({ impactOffsetY: v })}
      />
      <hr style={styles.divider} />

      {result && (
        <>
          <div style={styles.sectionTitle}>Result</div>
          <div style={styles.row}><span style={styles.label}>frames</span><span style={styles.value}>{result.totalFrames}</span></div>
          <div style={styles.row}><span style={styles.label}>time</span><span style={styles.value}>{result.totalTimeSec.toFixed(2)}s</span></div>
          <div style={styles.row}><span style={styles.label}>events</span><span style={styles.value}>{result.events.length}</span></div>
          <hr style={styles.divider} />
        </>
      )}

      <div style={styles.btnRow}>
        <button style={styles.btnPrimary} onClick={onRun}>Run</button>
        <button style={styles.btnReset} onClick={handleReset}>Reset</button>
        {result && <button style={styles.btn} onClick={onSaveBaseline}>Save Baseline</button>}
        {result && <button style={styles.btn} onClick={onDownload}>Download</button>}
        {result && hasBaseline && <button style={styles.btn} onClick={onCompare}>Compare</button>}
        {hasBaseline && <button style={styles.btnDanger} onClick={onDeleteBaseline}>Delete Baseline</button>}
      </div>
    </div>
  );
}

import type { SandboxConfig, SandboxBallConfig } from '../../test-sandbox/types.ts';
import { SANDBOX_PRESETS, PRESET_NAMES } from '../../test-sandbox/presets.ts';
import type { PresetName } from '../../test-sandbox/presets.ts';

const TABLE_WIDTH = 2.844;
const TABLE_HEIGHT = 1.422;
const BALL_RADIUS = 0.03075;
const MAX_IMPACT_OFFSET = BALL_RADIUS;

const styles = {
  container: {
    background: '#1a1a2e',
    border: '1px solid #0f3460',
    borderRadius: '8px',
    padding: '1rem',
    fontFamily: 'monospace',
    fontSize: '0.78rem',
    color: '#e0e0e0',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
  } as React.CSSProperties,
  sectionTitle: { color: '#888', fontSize: '0.75rem', marginBottom: '0.3rem' } as React.CSSProperties,
  row: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' } as React.CSSProperties,
  label: { color: '#aaa', minWidth: '80px' } as React.CSSProperties,
  slider: { flex: 1, accentColor: '#00d4ff' } as React.CSSProperties,
  numberInput: {
    width: '60px',
    background: 'transparent',
    border: '1px solid #0f3460',
    borderRadius: '3px',
    color: '#00d4ff',
    fontSize: '0.75rem',
    textAlign: 'right' as const,
    padding: '0.1rem 0.2rem',
  } as React.CSSProperties,
  divider: { borderColor: '#0f3460', margin: '0.25rem 0' } as React.CSSProperties,
  btnRow: { display: 'flex', gap: '0.4rem', flexWrap: 'wrap' as const } as React.CSSProperties,
  btn: {
    background: '#0f3460',
    border: 'none',
    color: '#e0e0e0',
    padding: '0.3rem 0.6rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.75rem',
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
};

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div style={styles.row}>
      <span style={styles.label}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={styles.slider}
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
        }}
        style={styles.numberInput}
      />
    </div>
  );
}

type Props = {
  config: SandboxConfig;
  onConfigChange: (config: SandboxConfig) => void;
  onRun: () => void;
  onExport: () => void;
};

export function SandboxControlPanel({ config, onConfigChange, onRun, onExport }: Props) {
  const updateBall = (id: string, patch: Partial<SandboxBallConfig>) => {
    onConfigChange({
      ...config,
      balls: config.balls.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    });
  };

  const updateShot = (patch: Partial<SandboxConfig['shot']>) => {
    onConfigChange({ ...config, shot: { ...config.shot, ...patch } });
  };

  const applyPreset = (name: PresetName) => {
    onConfigChange(SANDBOX_PRESETS[name]);
  };

  return (
    <div style={styles.container}>
      <div>
        <div style={styles.sectionTitle}>Presets</div>
        <div style={styles.btnRow}>
          {PRESET_NAMES.map((name) => (
            <button key={name} style={styles.btn} onClick={() => applyPreset(name)}>
              {name}
            </button>
          ))}
        </div>
      </div>

      <hr style={styles.divider} />

      {config.balls.map((ball) => (
        <div key={ball.id}>
          <div style={styles.sectionTitle}>{ball.id}</div>
          <SliderRow
            label="x"
            value={ball.x}
            min={BALL_RADIUS}
            max={TABLE_WIDTH - BALL_RADIUS}
            step={0.01}
            onChange={(v) => updateBall(ball.id, { x: v })}
          />
          <SliderRow
            label="y"
            value={ball.y}
            min={BALL_RADIUS}
            max={TABLE_HEIGHT - BALL_RADIUS}
            step={0.01}
            onChange={(v) => updateBall(ball.id, { y: v })}
          />
        </div>
      ))}

      <hr style={styles.divider} />

      <div>
        <div style={styles.sectionTitle}>Shot</div>
        <SliderRow
          label="direction"
          value={config.shot.directionDeg}
          min={0}
          max={360}
          step={1}
          onChange={(v) => updateShot({ directionDeg: v })}
          format={(v) => `${v.toFixed(0)}°`}
        />
        <SliderRow
          label="drag"
          value={config.shot.dragPx}
          min={10}
          max={400}
          step={5}
          onChange={(v) => updateShot({ dragPx: v })}
          format={(v) => `${v.toFixed(0)}px`}
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
      </div>

      <hr style={styles.divider} />

      <div style={styles.btnRow}>
        <button style={styles.btnPrimary} onClick={onRun}>Run (R)</button>
        <button style={styles.btn} onClick={onExport}>Export JSON</button>
      </div>
    </div>
  );
}

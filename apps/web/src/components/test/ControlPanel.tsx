import type { TestScenario } from '../../test-scenarios/types.ts';
import type { SimResult } from '../../../../../packages/physics-core/src/standalone-simulator.ts';

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
  sectionTitle: { color: '#888', fontSize: '0.75rem', marginBottom: '0.4rem' } as React.CSSProperties,
};

type Props = {
  scenario: TestScenario;
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
  result,
  hasBaseline,
  onRun,
  onSaveBaseline,
  onDeleteBaseline,
  onCompare,
  onDownload,
}: Props) {
  return (
    <div style={styles.container}>
      <div style={styles.sectionTitle}>Scenario</div>
      <div style={styles.row}><span style={styles.label}>ID</span><span style={styles.value}>{scenario.id}</span></div>
      <div style={styles.row}><span style={styles.label}>Tags</span><span style={styles.value}>{scenario.tags.join(', ')}</span></div>
      <hr style={styles.divider} />

      <div style={styles.sectionTitle}>Balls</div>
      {scenario.balls.map((b) => (
        <div key={b.id} style={styles.row}>
          <span style={styles.label}>{b.id}</span>
          <span style={styles.value}>({b.x.toFixed(3)}, {b.y.toFixed(3)})</span>
        </div>
      ))}
      <hr style={styles.divider} />

      <div style={styles.sectionTitle}>Shot</div>
      <div style={styles.row}><span style={styles.label}>direction</span><span style={styles.value}>{scenario.shot.directionDeg}°</span></div>
      <div style={styles.row}><span style={styles.label}>drag</span><span style={styles.value}>{scenario.shot.dragPx}px</span></div>
      <div style={styles.row}><span style={styles.label}>impactX</span><span style={styles.value}>{scenario.shot.impactOffsetX.toFixed(4)}</span></div>
      <div style={styles.row}><span style={styles.label}>impactY</span><span style={styles.value}>{scenario.shot.impactOffsetY.toFixed(4)}</span></div>
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
        {result && <button style={styles.btn} onClick={onSaveBaseline}>Save Baseline</button>}
        {result && <button style={styles.btn} onClick={onDownload}>Download</button>}
        {result && hasBaseline && <button style={styles.btn} onClick={onCompare}>Compare</button>}
        {hasBaseline && <button style={styles.btnDanger} onClick={onDeleteBaseline}>Delete Baseline</button>}
      </div>
    </div>
  );
}

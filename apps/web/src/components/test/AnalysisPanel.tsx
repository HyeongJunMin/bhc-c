import type { AnalysisResult } from '../../test-scenarios/trajectory-analyzer.ts';

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
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '0.4rem',
  } as React.CSSProperties,
  label: { color: '#aaa' } as React.CSSProperties,
  pass: { color: '#4caf50', fontWeight: 'bold' } as React.CSSProperties,
  fail: { color: '#f44336', fontWeight: 'bold' } as React.CSSProperties,
  value: { color: '#00d4ff' } as React.CSSProperties,
  divider: { borderColor: '#0f3460', margin: '0.5rem 0' } as React.CSSProperties,
  sectionTitle: { color: '#888', fontSize: '0.75rem', marginBottom: '0.4rem' } as React.CSSProperties,
};

type Props = { analysis: AnalysisResult };

export function AnalysisPanel({ analysis }: Props) {
  return (
    <div style={styles.container}>
      <div style={styles.row}>
        <span style={styles.label}>Result</span>
        <span style={analysis.passed ? styles.pass : styles.fail}>
          {analysis.passed ? 'PASS' : 'FAIL'}
        </span>
      </div>
      <hr style={styles.divider} />
      <div style={styles.row}>
        <span style={styles.label}>Max deviation</span>
        <span style={styles.value}>{(analysis.maxDeviationM * 1000).toFixed(1)} mm</span>
      </div>
      <div style={styles.row}>
        <span style={styles.label}>Avg deviation</span>
        <span style={styles.value}>{(analysis.avgDeviationM * 1000).toFixed(1)} mm</span>
      </div>
      <div style={styles.row}>
        <span style={styles.label}>Diverge frame</span>
        <span style={styles.value}>
          {analysis.divergeFrameIndex !== null ? `#${analysis.divergeFrameIndex}` : '-'}
        </span>
      </div>
      <hr style={styles.divider} />
      <div style={styles.sectionTitle}>Events</div>
      <div style={styles.row}>
        <span style={styles.label}>Match rate</span>
        <span style={styles.value}>{analysis.eventMatch.matchRatePct.toFixed(0)}%</span>
      </div>
      <div style={styles.row}>
        <span style={styles.label}>Matched / Total</span>
        <span style={styles.value}>{analysis.eventMatch.matched} / {analysis.eventMatch.total}</span>
      </div>
      <hr style={styles.divider} />
      <div style={styles.sectionTitle}>Per Ball</div>
      {analysis.ballDeviations.map((b) => (
        <div key={b.ballId} style={styles.row}>
          <span style={styles.label}>{b.ballId}</span>
          <span style={styles.value}>
            max {(b.maxDeviationM * 1000).toFixed(1)}mm
            {b.divergeFrameIndex !== null ? ` @ #${b.divergeFrameIndex}` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

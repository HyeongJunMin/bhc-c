import type { SimFrame } from '../../../../../packages/physics-core/src/standalone-simulator.ts';

const styles = {
  container: {
    background: '#1a1a2e',
    border: '1px solid #0f3460',
    borderRadius: '8px',
    padding: '1rem',
    fontFamily: 'monospace',
    fontSize: '0.75rem',
    color: '#e0e0e0',
    overflowX: 'auto' as const,
  } as React.CSSProperties,
  title: { color: '#888', marginBottom: '0.5rem', fontSize: '0.75rem' } as React.CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse' as const } as React.CSSProperties,
  th: {
    textAlign: 'left' as const,
    color: '#00d4ff',
    padding: '0.2rem 0.4rem',
    borderBottom: '1px solid #0f3460',
    fontWeight: 'normal',
  } as React.CSSProperties,
  td: {
    padding: '0.2rem 0.4rem',
    color: '#e0e0e0',
    borderBottom: '1px solid #0a2040',
  } as React.CSSProperties,
  valDim: { color: '#888' } as React.CSSProperties,
};

type Props = { frame: SimFrame | null };

export function FrameKinematicsPanel({ frame }: Props) {
  if (!frame) {
    return (
      <div style={styles.container}>
        <div style={styles.title}>Kinematics — no frame</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.title}>
        Kinematics — Frame #{frame.frameIndex} ({frame.timeSec.toFixed(3)}s)
      </div>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>ball</th>
            <th style={styles.th}>x</th>
            <th style={styles.th}>y</th>
            <th style={styles.th}>speed</th>
            <th style={styles.th}>vx</th>
            <th style={styles.th}>vy</th>
            <th style={styles.th}>spinX</th>
            <th style={styles.th}>spinY</th>
            <th style={styles.th}>spinZ</th>
          </tr>
        </thead>
        <tbody>
          {frame.balls.map((b) => (
            <tr key={b.id}>
              <td style={styles.td}>{b.id}</td>
              <td style={styles.td}>{b.x.toFixed(4)}</td>
              <td style={styles.td}>{b.y.toFixed(4)}</td>
              <td style={styles.td}>{b.speed.toFixed(3)}</td>
              <td style={{ ...styles.td, ...styles.valDim }}>{b.vx.toFixed(3)}</td>
              <td style={{ ...styles.td, ...styles.valDim }}>{b.vy.toFixed(3)}</td>
              <td style={{ ...styles.td, ...styles.valDim }}>{b.spinX.toFixed(2)}</td>
              <td style={{ ...styles.td, ...styles.valDim }}>{b.spinY.toFixed(2)}</td>
              <td style={{ ...styles.td, ...styles.valDim }}>{b.spinZ.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

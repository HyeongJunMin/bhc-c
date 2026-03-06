import { Link } from 'react-router-dom';
import { ALL_SCENARIOS } from '../test-scenarios/index.ts';
import { loadBaseline } from '../test-scenarios/baseline-storage.ts';

const styles = {
  container: {
    minHeight: '100vh',
    background: '#1a1a2e',
    color: '#e0e0e0',
    padding: '2rem',
    fontFamily: 'monospace',
  } as React.CSSProperties,
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '2rem',
  } as React.CSSProperties,
  title: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#00d4ff',
    margin: 0,
  } as React.CSSProperties,
  backLink: {
    color: '#aaa',
    textDecoration: 'none',
    fontSize: '0.9rem',
  } as React.CSSProperties,
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '1rem',
  } as React.CSSProperties,
  card: {
    background: '#16213e',
    border: '1px solid #0f3460',
    borderRadius: '8px',
    padding: '1rem',
    textDecoration: 'none',
    color: 'inherit',
    display: 'block',
    transition: 'border-color 0.2s',
  } as React.CSSProperties,
  sandboxCard: {
    background: '#1a2a1a',
    border: '1px solid #2d5a2d',
    borderRadius: '8px',
    padding: '1rem',
    textDecoration: 'none',
    color: 'inherit',
    display: 'block',
  } as React.CSSProperties,
  cardTitle: {
    fontSize: '1rem',
    fontWeight: 'bold',
    marginBottom: '0.4rem',
    color: '#ffffff',
  } as React.CSSProperties,
  cardDesc: {
    fontSize: '0.8rem',
    color: '#aaa',
    marginBottom: '0.6rem',
  } as React.CSSProperties,
  tags: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.3rem',
  } as React.CSSProperties,
  tag: {
    fontSize: '0.7rem',
    background: '#0f3460',
    color: '#00d4ff',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
  } as React.CSSProperties,
  baselineBadge: {
    fontSize: '0.7rem',
    background: '#1a4a1a',
    color: '#4caf50',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: '0.85rem',
    color: '#888',
    marginBottom: '0.8rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  } as React.CSSProperties,
};

export function TestListPage() {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Physics Test Scenarios</h1>
        <Link to="/" style={styles.backLink}>← Game</Link>
      </div>

      <p style={styles.sectionTitle}>Scenarios ({ALL_SCENARIOS.length})</p>
      <div style={styles.grid}>
        <Link to="/test/sandbox" style={styles.sandboxCard}>
          <div style={styles.cardTitle}>Sandbox</div>
          <div style={styles.cardDesc}>자유 파라미터로 물리 시뮬레이션 테스트</div>
          <div style={styles.tags}>
            <span style={{ ...styles.tag, background: '#2d5a2d', color: '#4caf50' }}>sandbox</span>
          </div>
        </Link>

        {ALL_SCENARIOS.map((scenario) => {
          const baseline = loadBaseline(scenario.id);
          return (
            <Link key={scenario.id} to={`/test/${scenario.id}`} style={styles.card}>
              <div style={styles.cardTitle}>{scenario.name}</div>
              <div style={styles.cardDesc}>{scenario.description}</div>
              <div style={styles.tags}>
                {scenario.tags.map((tag) => (
                  <span key={tag} style={styles.tag}>{tag}</span>
                ))}
                {baseline && (
                  <span style={styles.baselineBadge}>baseline saved</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

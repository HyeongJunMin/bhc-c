import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { GameScene } from '../components/GameScene';
import { useGameStore } from '../stores/gameStore';

const styles = {
  header: {
    position: 'fixed',
    top: 12,
    left: 12,
    zIndex: 20,
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
    fontFamily: 'monospace',
  } as React.CSSProperties,
  title: {
    fontSize: '0.8rem',
    color: '#9ee6ff',
    background: 'rgba(0,0,0,0.45)',
    border: '1px solid rgba(158,230,255,0.35)',
    borderRadius: 6,
    padding: '0.2rem 0.45rem',
  } as React.CSSProperties,
  backLink: {
    color: '#e0e0e0',
    textDecoration: 'none',
    fontSize: '0.8rem',
    background: 'rgba(0,0,0,0.45)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 6,
    padding: '0.2rem 0.45rem',
  } as React.CSSProperties,
};

export function TestFahPage() {
  useEffect(() => {
    useGameStore.getState().setPlayMode('fahTest');
    return () => {
      useGameStore.getState().setPlayMode('game');
    };
  }, []);

  return (
    <>
      <div style={styles.header}>
        <span style={styles.title}>FAH Test Mode</span>
        <Link to="/test" style={styles.backLink}>← Scenarios</Link>
      </div>
      <GameScene />
    </>
  );
}

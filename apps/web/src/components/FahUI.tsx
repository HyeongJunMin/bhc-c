import { useEffect } from 'react';
import { useGameStore } from '../stores/gameStore';

type FahUIProps = {
  mode?: 'fah';
};

const FAH_ANCHOR_POINTS = [0, 5, 8, 10, 20, 23, 30, 40, 45] as const;

export function FahUI({ mode = 'fah' }: FahUIProps) {
  const {
    phase,
    playMode,
    setPlayMode,
    systemMode,
    setSystemMode,
    fahTestTargetPoint,
    requestFahTestShot,
    showBallTrail,
    toggleBallTrail,
  } = useGameStore();

  useEffect(() => {
    if (mode !== 'fah') {
      return;
    }
    if (playMode !== 'fahTest') {
      setPlayMode('fahTest');
    }
    if (systemMode !== 'fiveAndHalf') {
      setSystemMode('fiveAndHalf');
    }
  }, [mode, playMode, setPlayMode, systemMode, setSystemMode]);

  const canShoot = phase === 'AIMING';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        color: 'white',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          background: 'rgba(0,0,0,0.88)',
          padding: 16,
          borderRadius: 12,
          minWidth: 260,
          border: '1px solid rgba(255,255,255,0.1)',
          pointerEvents: 'auto',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: '#ffd700' }}>
          FAH TEST
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button
            type="button"
            onClick={toggleBallTrail}
            style={{
              border: 'none',
              borderRadius: 6,
              background: showBallTrail ? '#0f9d58' : '#2e2e2e',
              color: '#fff',
              padding: '6px 10px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            수구궤적 {showBallTrail ? 'ON' : 'OFF'}
          </button>
        </div>

        <div style={{ marginBottom: 8, fontSize: 12, opacity: 0.8 }}>
          현재 앵커: <span style={{ color: '#ffd700', fontWeight: 700 }}>{fahTestTargetPoint}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          {FAH_ANCHOR_POINTS.map((point) => (
            <button
              key={point}
              type="button"
              onClick={() => requestFahTestShot(point)}
              disabled={!canShoot}
              style={{
                border: 'none',
                borderRadius: 8,
                padding: '8px 0',
                fontSize: 12,
                fontWeight: 700,
                background: fahTestTargetPoint === point ? '#ffd700' : '#303030',
                color: fahTestTargetPoint === point ? '#000' : '#fff',
                opacity: canShoot ? 1 : 0.5,
                cursor: canShoot ? 'pointer' : 'not-allowed',
              }}
            >
              P{point}
            </button>
          ))}
        </div>

        {!canShoot && (
          <div style={{ marginTop: 10, fontSize: 11, opacity: 0.65 }}>
            조준 단계에서만 샷을 실행할 수 있습니다.
          </div>
        )}
      </div>
    </div>
  );
}

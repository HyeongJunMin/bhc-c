import { useGameStore } from '../hooks/useGameStore';
import { INPUT_LIMITS, PHYSICS, RULES } from '../lib/constants';

export function GameUI() {
  const { 
    phase, 
    shotInput, 
    isDragging,
    currentPlayer, 
    scores, 
    turnMessage,
    resetGame,
  } = useGameStore();
  
  const powerPercent = Math.round(
    ((shotInput.dragPx - INPUT_LIMITS.DRAG_MIN) / 
     (INPUT_LIMITS.DRAG_MAX - INPUT_LIMITS.DRAG_MIN)) * 100
  );
  
  const speed = (
    PHYSICS.MIN_SPEED_MPS + 
    (powerPercent / 100) * (PHYSICS.MAX_SPEED_MPS - PHYSICS.MIN_SPEED_MPS)
  ).toFixed(1);

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
      }}
    >
      {/* 상단 정보 패널 */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          background: 'rgba(0,0,0,0.8)',
          padding: '20px',
          borderRadius: 12,
          minWidth: 220,
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <h2 style={{ margin: '0 0 15px 0', fontSize: 20, color: '#00ff88' }}>
          3-Cushion Billiards
        </h2>
        
        {/* 점수판 */}
        <div style={{ marginBottom: 15 }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>SCORE</div>
          <div style={{ display: 'flex', gap: 20 }}>
            {Object.entries(scores).map(([player, score]) => (
              <div 
                key={player} 
                style={{ 
                  textAlign: 'center',
                  opacity: currentPlayer === player ? 1 : 0.5,
                }}
              >
                <div style={{ 
                  fontSize: 24, 
                  fontWeight: 'bold',
                  color: currentPlayer === player ? '#00ff88' : 'white',
                }}>
                  {score}
                </div>
                <div style={{ fontSize: 11, textTransform: 'uppercase' }}>
                  {player}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 목표 점수 */}
        <div style={{ fontSize: 11, opacity: 0.5 }}>
          First to {RULES.WINNING_SCORE} points wins
        </div>
      </div>

      {/* 턴 결과 메시지 */}
      {turnMessage && (
        <div
          style={{
            position: 'absolute',
            top: '30%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: turnMessage.includes('SCORE') 
              ? 'rgba(0, 255, 136, 0.9)' 
              : turnMessage.includes('WINS')
              ? 'rgba(255, 215, 0, 0.95)'
              : 'rgba(255, 100, 100, 0.9)',
            padding: '20px 40px',
            borderRadius: 12,
            fontSize: 28,
            fontWeight: 'bold',
            color: turnMessage.includes('SCORE') || turnMessage.includes('WINS') ? '#000' : '#fff',
            animation: 'fadeInOut 2s ease-in-out',
          }}
        >
          {turnMessage}
        </div>
      )}

      {/* 샷 준비 가이드 */}
      {phase === 'AIMING' && !isDragging && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0,0,0,0.7)',
            padding: '30px 50px',
            borderRadius: 16,
            textAlign: 'center',
            border: '2px solid #00ff88',
          }}
        >
          <div style={{ fontSize: 24, marginBottom: 10, color: '#00ff88' }}>
            🖱️ 왼쪽 클릭 + 드래그
          </div>
          <div style={{ fontSize: 16, opacity: 0.8 }}>
            샷 준비 및 파워 조절
          </div>
          <div style={{ fontSize: 14, opacity: 0.6, marginTop: 10 }}>
            (오른쪽 클릭으로 당구대 회전)
          </div>
        </div>
      )}

      {/* 샷 정보 (드래그 중일 때만) */}
      {phase === 'AIMING' && isDragging && (
        <>
          {/* 파워 게이지 */}
          <div
            style={{
              position: 'absolute',
              bottom: 120,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 320,
              background: 'rgba(0,0,0,0.8)',
              padding: 20,
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 14 }}>POWER</span>
              <span style={{ fontSize: 14, fontWeight: 'bold' }}>
                {powerPercent}% ({speed} m/s)
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: 12,
                background: '#333',
                borderRadius: 6,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${powerPercent}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, #00ff88 0%, #ffff00 50%, #ff4444 100%)`,
                  transition: 'width 0.05s',
                }}
              />
            </div>
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 10, textAlign: 'center' }}>
              마우스를 아래로 드래그해서 파워 증가
            </div>
          </div>

          {/* 당점 표시 */}
          <div
            style={{
              position: 'absolute',
              bottom: 120,
              right: 30,
              background: 'rgba(0,0,0,0.8)',
              padding: 20,
              borderRadius: 12,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div style={{ fontSize: 12, marginBottom: 10, opacity: 0.8 }}>ENGLISH (WASD)</div>
            <div
              style={{
                width: 70,
                height: 70,
                borderRadius: '50%',
                background: 'linear-gradient(145deg, #fff 0%, #ddd 100%)',
                position: 'relative',
                border: '3px solid #666',
                boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.2)',
              }}
            >
              {/* 십자선 */}
              <div style={{ 
                position: 'absolute', 
                top: '50%', 
                left: 0, 
                right: 0, 
                height: 1, 
                background: 'rgba(0,0,0,0.2)' 
              }} />
              <div style={{ 
                position: 'absolute', 
                left: '50%', 
                top: 0, 
                bottom: 0, 
                width: 1, 
                background: 'rgba(0,0,0,0.2)' 
              }} />
              
              {/* 당점 마커 */}
              <div
                style={{
                  position: 'absolute',
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: '#ff4444',
                  border: '2px solid white',
                  left: `calc(50% + ${(shotInput.impactOffsetX / PHYSICS.BALL_RADIUS) * 28}px)`,
                  top: `calc(50% + ${(shotInput.impactOffsetY / PHYSICS.BALL_RADIUS) * 28}px)`,
                  transform: 'translate(-50%, -50%)',
                  transition: 'all 0.1s',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                }}
              />
            </div>
          </div>

          {/* 방향 정보 */}
          <div
            style={{
              position: 'absolute',
              bottom: 120,
              left: 30,
              background: 'rgba(0,0,0,0.8)',
              padding: 20,
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.1)',
              minWidth: 150,
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 5 }}>DIRECTION</div>
            <div style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>
              {shotInput.shotDirectionDeg.toFixed(0)}°
            </div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 5 }}>ELEVATION</div>
            <div style={{ fontSize: 20, fontWeight: 'bold' }}>
              {shotInput.cueElevationDeg.toFixed(0)}°
            </div>
          </div>
        </>
      )}

      {/* 컨트롤 가이드 */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          background: 'rgba(0,0,0,0.8)',
          padding: 20,
          borderRadius: 12,
          fontSize: 13,
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🖱️</span> <strong>오른쪽 클릭 + 이동</strong>: 당구대 회전
        </div>
        <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🖱️</span> <strong>왼쪽 클릭</strong>: 샷 준비
        </div>
        <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🖱️</span> <strong>드래그</strong>: 파워 조절
        </div>
        <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>⌨️</span> <strong>WASD</strong>: 당점 조절
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>⌨️</span> <strong>스페이스</strong>: 새 게임
        </div>
      </div>

      {/* 게임 리셋 버튼 */}
      <button
        onClick={resetGame}
        style={{
          position: 'absolute',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '10px 20px',
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 8,
          color: 'white',
          cursor: 'pointer',
          pointerEvents: 'auto',
          fontSize: 14,
        }}
      >
        New Game
      </button>

      <style>{`
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
          20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        }
      `}</style>
    </div>
  );
}

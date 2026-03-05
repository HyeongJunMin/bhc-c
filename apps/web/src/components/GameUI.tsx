import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { INPUT_LIMITS, PHYSICS, RULES } from '../lib/constants';

export function GameUI() {
  const TURN_DURATION_MS = 20_000;
  const gameStore = useGameStore();
  const { 
    phase, 
    shotInput, 
    isDragging,
    currentPlayer, 
    activeCueBallId,
    scores, 
    turnMessage,
    turnStartedAtMs,
    cushionContacts,
    objectBallsHit,
    resetGame,
  } = gameStore;
  const [turnRemainMs, setTurnRemainMs] = useState(TURN_DURATION_MS);
  
  // 파워 계산
  const powerPercent = Math.round(
    ((shotInput.dragPx - INPUT_LIMITS.DRAG_MIN) / 
     (INPUT_LIMITS.DRAG_MAX - INPUT_LIMITS.DRAG_MIN)) * 100
  );
  
  // 속도 계산
  const speed = (
    PHYSICS.MIN_SPEED_MPS + 
    (powerPercent / 100) * (PHYSICS.MAX_SPEED_MPS - PHYSICS.MIN_SPEED_MPS)
  ).toFixed(1);
  
  // 당점 거리 계산
  const offsetDistance = Math.sqrt(
    shotInput.impactOffsetX ** 2 + shotInput.impactOffsetY ** 2
  );
  const offsetPercent = Math.round((offsetDistance / PHYSICS.BALL_RADIUS) * 100);
  const isMiscueRisk = offsetPercent > 85;
  const overlapRows = useMemo(() => {
    const cueBall = gameStore.balls.find((ball) => ball.id === activeCueBallId);
    const objectBalls = gameStore.balls.filter((ball) => ball.id !== activeCueBallId);
    if (!cueBall) return [];

    const dirRad = (shotInput.shotDirectionDeg * Math.PI) / 180;
    const dirX = Math.sin(dirRad);
    const dirZ = Math.cos(dirRad);
    const diameter = PHYSICS.BALL_RADIUS * 2;

    return objectBalls.map((ball) => {
      const relX = ball.position.x - cueBall.position.x;
      const relZ = ball.position.z - cueBall.position.z;
      const along = relX * dirX + relZ * dirZ;
      const signedPerp = relX * dirZ - relZ * dirX;
      const perp = Math.abs(signedPerp);
      const overlap = along <= 0 ? 0 : Math.max(0, Math.min(1, (diameter - perp) / diameter));
      return {
        id: ball.id,
        overlap,
        hittable: along > 0 && perp <= diameter,
        signedPerp,
      };
    });
  }, [gameStore.balls, shotInput.shotDirectionDeg, activeCueBallId]);

  const ballColorMap: Record<string, string> = {
    cueBall: '#ffffff',
    objectBall1: '#ff3b30',
    objectBall2: '#ffd60a',
  };
  const overlappingRows = overlapRows.filter((row) => row.hittable && row.overlap > 0);
  const overlayBallSize = 34;
  const overlayTrackWidth = 112;
  const cueBall = gameStore.balls.find((ball) => ball.id === 'cueBall');
  const objectBall1 = gameStore.balls.find((ball) => ball.id === 'objectBall1');
  const objectBall2 = gameStore.balls.find((ball) => ball.id === 'objectBall2');
  const isMissTurnOver = turnMessage.trim().toUpperCase().includes('MISS - TURN OVER');
  const isScoreTurnMessage = turnMessage.trim().toUpperCase().includes('SCORE');
  const isCompactTurnMessage = isMissTurnOver || isScoreTurnMessage;

  useEffect(() => {
    const update = () => {
      if (phase !== 'AIMING') {
        setTurnRemainMs(TURN_DURATION_MS);
        return;
      }
      setTurnRemainMs(Math.max(0, TURN_DURATION_MS - (Date.now() - turnStartedAtMs)));
    };
    update();
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [phase, turnStartedAtMs]);

  // 3쿠션 상태
  const secondTargetId = activeCueBallId === 'cueBall' ? 'objectBall2' : 'cueBall';
  const hitObject1 = objectBallsHit.has('objectBall1');
  const hitObject2 = objectBallsHit.has(secondTargetId);
  
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
      {/* 상단 정보 패널 */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          background: 'rgba(0,0,0,0.85)',
          padding: '20px',
          borderRadius: 12,
          minWidth: 240,
          border: '1px solid rgba(255,255,255,0.1)',
          pointerEvents: 'auto',
        }}
      >
        <h2 style={{ margin: '0 0 15px 0', fontSize: 20, color: '#00ff88' }}>
          3-Cushion Billiards
        </h2>
        
        {/* 점수판 */}
        <div style={{ marginBottom: 15 }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>SCORE (Target: {RULES.WINNING_SCORE})</div>
          <div style={{ display: 'flex', gap: 20 }}>
            {Object.entries(scores).map(([player, score]) => (
              <div 
                key={player} 
                style={{ 
                  textAlign: 'center',
                  opacity: currentPlayer === player ? 1 : 0.5,
                  transform: currentPlayer === player ? 'scale(1.1)' : 'scale(1)',
                  transition: 'all 0.3s',
                }}
              >
                <div style={{ 
                  fontSize: 28, 
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

        <div style={{ marginBottom: 10, fontSize: 12, opacity: 0.85 }}>
          TURN: <span style={{ color: '#ffd700', fontWeight: 700 }}>{(turnRemainMs / 1000).toFixed(1)}s</span>
        </div>
        
        {/* 게임 상태 */}
        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 10 }}>
          Phase: <span style={{ color: '#ffd700' }}>{phase}</span>
        </div>
      </div>
      
      {/* 3쿠션 상태 패널 */}
      {(phase === 'SHOOTING' || phase === 'SIMULATING') && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            background: 'rgba(0,0,0,0.85)',
            padding: '20px',
            borderRadius: 12,
            minWidth: 180,
            border: `2px solid ${cushionContacts >= 3 ? '#00ff88' : '#444'}`,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 12, color: '#ffd700' }}>
            3-CUSHION TRACKER
          </div>
          
          {/* 쿠션 카운터 */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Cushions</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    background: cushionContacts >= i ? '#00ff88' : '#333',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    color: cushionContacts >= i ? '#000' : '#666',
                    transition: 'all 0.3s',
                  }}
                >
                  {i}
                </div>
              ))}
            </div>
          </div>
          
          {/* 목적구 히트 */}
          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Object Balls Hit</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 6,
                opacity: hitObject1 ? 1 : 0.4,
              }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff0000' }} />
                <span style={{ color: hitObject1 ? '#00ff88' : 'white' }}>
                  {hitObject1 ? '✓' : '○'}
                </span>
              </div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 6,
                opacity: hitObject2 ? 1 : 0.4,
              }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: ballColorMap[secondTargetId] ?? '#ffd700' }} />
                <span style={{ color: hitObject2 ? '#00ff88' : 'white' }}>
                  {hitObject2 ? '✓' : '○'}
                </span>
              </div>
            </div>
          </div>
          
          {/* 득점 가능 여부 */}
          {cushionContacts >= 3 && hitObject1 && hitObject2 && (
            <div style={{ 
              marginTop: 12, 
              padding: 8, 
              background: '#00ff88', 
              color: '#000',
              borderRadius: 6,
              textAlign: 'center',
              fontWeight: 'bold',
            }}>
              SCORED! ✓
            </div>
          )}
        </div>
      )}

      {/* 턴 결과 메시지 */}
      {turnMessage && (
        <div
          style={{
            position: 'absolute',
            top: isCompactTurnMessage ? '13%' : '35%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: turnMessage.includes('SCORE') 
              ? 'rgba(0, 255, 136, 0.95)' 
              : turnMessage.includes('WINS')
              ? 'rgba(255, 215, 0, 0.95)'
              : 'rgba(255, 100, 100, 0.9)',
            padding: isCompactTurnMessage ? '10px 18px' : '25px 50px',
            borderRadius: isCompactTurnMessage ? 10 : 16,
            fontSize: isCompactTurnMessage ? 18 : 32,
            fontWeight: 'bold',
            color: turnMessage.includes('SCORE') || turnMessage.includes('WINS') ? '#000' : '#fff',
            animation: 'pulse 0.5s ease-in-out',
            zIndex: 100,
          }}
        >
          {turnMessage}
        </div>
      )}

      {phase === 'AIMING' && overlappingRows.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '48%',
            left: 20,
            transform: 'translateY(-50%)',
            background: 'rgba(0,0,0,0.82)',
            borderRadius: 12,
            padding: '14px 16px',
            minWidth: 120,
          }}
        >
          {overlappingRows.map((row) => (
            <div key={row.id} style={{ marginBottom: 10 }}>
              {(() => {
                const overlapPx = overlayBallSize;
                const centerDistancePx = (1 - row.overlap) * overlapPx;
                const sideSign = row.signedPerp >= 0 ? -1 : 1;
                const centerX = (overlayTrackWidth - overlayBallSize) / 2;
                const cueLeft = Math.round(centerX - (sideSign * centerDistancePx) / 2);
                const objectLeft = Math.round(centerX + (sideSign * centerDistancePx) / 2);

                return (
                  <div
                    style={{
                      position: 'relative',
                      height: overlayBallSize,
                      width: overlayTrackWidth,
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: `${cueLeft}px`,
                        width: overlayBallSize,
                        height: overlayBallSize,
                        borderRadius: '50%',
                        background: ballColorMap[activeCueBallId] ?? '#ffffff',
                        border: '1px solid rgba(0,0,0,0.35)',
                        zIndex: 2,
                        boxShadow: '0 0 0 1px rgba(255,255,255,0.15) inset',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: `${objectLeft}px`,
                        width: overlayBallSize,
                        height: overlayBallSize,
                        borderRadius: '50%',
                        background: ballColorMap[row.id] ?? '#00bcd4',
                        border: '1px solid rgba(0,0,0,0.35)',
                        opacity: 0.95,
                        zIndex: 1,
                        boxShadow: '0 0 10px rgba(0,255,136,0.35)',
                      }}
                    />
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      {/* 샷 정보 (드래그 중) */}
      {phase === 'AIMING' && isDragging && (
        <>
          {/* 파워 게이지 */}
          <div
            style={{
              position: 'absolute',
              bottom: 140,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 320,
              background: 'rgba(0,0,0,0.8)',
              padding: '15px 20px',
              borderRadius: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 14 }}>Power</span>
              <span style={{ 
                fontSize: 18, 
                fontWeight: 'bold',
                color: powerPercent > 80 ? '#ff4444' : powerPercent > 50 ? '#ffff00' : '#00ff88',
              }}>
                {powerPercent}%
              </span>
            </div>
            <div style={{ 
              height: 12, 
              background: '#333', 
              borderRadius: 6,
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${powerPercent}%`,
                height: '100%',
                background: powerPercent > 80 
                  ? 'linear-gradient(90deg, #ffff00, #ff4444)' 
                  : powerPercent > 50 
                    ? 'linear-gradient(90deg, #00ff88, #ffff00)'
                    : '#00ff88',
                transition: 'width 0.05s',
              }} />
            </div>
            <div style={{ 
              textAlign: 'center', 
              marginTop: 8,
              fontSize: 14,
              color: '#aaa',
            }}>
              Speed: {speed} m/s
            </div>
          </div>
        </>
      )}
      
      {/* 당점 정보 */}
      {phase === 'AIMING' && (
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            background: 'rgba(0,0,0,0.85)',
            padding: '12px',
            borderRadius: 12,
          }}
        >
          {/* 당점 시각화 */}
          <div style={{ 
            width: 60, 
            height: 60, 
            borderRadius: '50%', 
            background: 'rgba(255,255,255,0.1)',
            border: `2px solid ${isMiscueRisk ? '#ff4444' : '#fff'}`,
            position: 'relative',
            marginBottom: 10,
          }}>
            {/* 중심 */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 2,
              height: 2,
              background: '#fff',
              transform: 'translate(-50%, -50%)',
            }} />
            {/* 당점 마커 */}
            <div style={{
              position: 'absolute',
              top: `${50 - (shotInput.impactOffsetY / PHYSICS.BALL_RADIUS) * 45}%`,
              left: `${50 + (shotInput.impactOffsetX / PHYSICS.BALL_RADIUS) * 45}%`,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isMiscueRisk ? '#ff4444' : '#ff3333',
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 0 5px rgba(255,0,0,0.5)',
            }} />
            {/* 9분할 가이드 */}
            <div style={{
              position: 'absolute',
              left: '33%',
              top: 2,
              bottom: 2,
              width: 1,
              background: 'rgba(255,255,255,0.25)',
            }} />
            <div style={{
              position: 'absolute',
              left: '66%',
              top: 2,
              bottom: 2,
              width: 1,
              background: 'rgba(255,255,255,0.25)',
            }} />
            <div style={{
              position: 'absolute',
              top: '33%',
              left: 2,
              right: 2,
              height: 1,
              background: 'rgba(255,255,255,0.25)',
            }} />
            <div style={{
              position: 'absolute',
              top: '66%',
              left: 2,
              right: 2,
              height: 1,
              background: 'rgba(255,255,255,0.25)',
            }} />
          </div>
        </div>
      )}

      {/* 게임 종료 화면 */}
      {phase === 'SCORING' && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ fontSize: 48, fontWeight: 'bold', color: '#ffd700', marginBottom: 20 }}>
            🏆 GAME OVER
          </div>
          <div style={{ fontSize: 24, marginBottom: 30 }}>
            {currentPlayer.toUpperCase()} WINS!
          </div>
          <div style={{ display: 'flex', gap: 40, marginBottom: 40 }}>
            {Object.entries(scores).map(([player, score]) => (
              <div key={player} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, fontWeight: 'bold', color: '#00ff88' }}>{score}</div>
                <div>{player}</div>
              </div>
            ))}
          </div>
          <button
            onClick={resetGame}
            style={{
              padding: '15px 40px',
              fontSize: 20,
              background: '#00ff88',
              color: '#000',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Play Again
          </button>
        </div>
      )}
      
      {/* CSS 애니메이션 */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.05); }
        }
      `}</style>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { INPUT_LIMITS, PHYSICS, RULES } from '../lib/constants';

export function GameUI() {
  const [showGlossary, setShowGlossary] = useState(false);
  const gameStore = useGameStore();
  const { 
    phase, 
    shotInput, 
    isDragging,
    currentPlayer, 
    scores, 
    turnMessage,
    cushionContacts,
    objectBallsHit,
    setAimControlMode,
    resetGame,
  } = gameStore;
  
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
  const inputConstraintCode =
    phase !== 'AIMING' ? 'SHOT_LOCKED_PHASE' : isDragging ? 'SHOT_LOCKED_DRAGGING' : 'SHOT_READY';
  const normalizedX = shotInput.impactOffsetX / PHYSICS.BALL_RADIUS;
  const normalizedY = shotInput.impactOffsetY / PHYSICS.BALL_RADIUS;

  const zoneX = normalizedX < -0.33 ? -1 : normalizedX > 0.33 ? 1 : 0;
  const zoneY = normalizedY < -0.33 ? -1 : normalizedY > 0.33 ? 1 : 0;
  const activeZoneKey = `${zoneX},${zoneY}`;

  const spinGuideLabel =
    zoneX < 0 && zoneY > 0 ? '좌상(좌회전 + 밀어치기)'
    : zoneX === 0 && zoneY > 0 ? '상(밀어치기)'
    : zoneX > 0 && zoneY > 0 ? '우상(우회전 + 밀어치기)'
    : zoneX < 0 && zoneY === 0 ? '좌(좌회전)'
    : zoneX === 0 && zoneY === 0 ? '중앙(무회전)'
    : zoneX > 0 && zoneY === 0 ? '우(우회전)'
    : zoneX < 0 && zoneY < 0 ? '좌하(좌회전 + 끌어치기)'
    : zoneX === 0 && zoneY < 0 ? '하(끌어치기)'
    : '우하(우회전 + 끌어치기)';

  const overlapRows = useMemo(() => {
    const cueBall = gameStore.balls.find((ball) => ball.id === 'cueBall');
    const objectBalls = gameStore.balls.filter((ball) => ball.id !== 'cueBall');
    if (!cueBall) return [];

    const dirRad = (shotInput.shotDirectionDeg * Math.PI) / 180;
    const dirX = Math.sin(dirRad);
    const dirZ = Math.cos(dirRad);
    const diameter = PHYSICS.BALL_RADIUS * 2;

    return objectBalls.map((ball) => {
      const relX = ball.position.x - cueBall.position.x;
      const relZ = ball.position.z - cueBall.position.z;
      const along = relX * dirX + relZ * dirZ;
      const perp = Math.abs(relX * dirZ - relZ * dirX);
      const overlap = along <= 0 ? 0 : Math.max(0, Math.min(1, (diameter - perp) / diameter));
      return {
        id: ball.id,
        overlapPct: Math.round(overlap * 100),
        hittable: along > 0 && perp <= diameter,
      };
    });
  }, [gameStore.balls, shotInput.shotDirectionDeg]);

  const glossaryRows = [
    { term: '회전주기', meaning: '공의 좌/우를 쳐 회전을 주는 타법' },
    { term: '두번치기', meaning: '매우 근접한 배치에서 큐팁이 수구를 2회 접촉하는 반칙' },
    { term: '끌어치기', meaning: '공의 아래를 쳐 백스핀을 주는 타법' },
    { term: '밀어치기', meaning: '공의 위를 쳐 탑스핀을 주는 타법' },
    { term: '빈쿠션', meaning: '목적구보다 쿠션을 먼저 맞추는 플레이' },
    { term: '대회전', meaning: '여러 쿠션을 활용해 궤적을 크게 돌리는 공략' },
  ] as const;
  
  // 3쿠션 상태
  const hitObject1 = objectBallsHit.has('objectBall1');
  const hitObject2 = objectBallsHit.has('objectBall2');
  
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
        
        {/* 게임 상태 */}
        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 10 }}>
          Phase: <span style={{ color: '#ffd700' }}>{phase}</span>
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, opacity: 0.8 }}>Aim Mode</span>
          <button
            type="button"
            onClick={() =>
              setAimControlMode(shotInput.aimControlMode === 'AUTO_SYNC' ? 'MANUAL_AIM' : 'AUTO_SYNC')
            }
            style={{
              pointerEvents: 'auto',
              border: '1px solid rgba(255,255,255,0.25)',
              background: 'rgba(20,20,20,0.85)',
              color: '#fff',
              borderRadius: 8,
              fontSize: 11,
              padding: '4px 8px',
              cursor: 'pointer',
            }}
          >
            {shotInput.aimControlMode}
          </button>
          <button
            type="button"
            onClick={() => setShowGlossary((value) => !value)}
            style={{
              pointerEvents: 'auto',
              border: '1px solid rgba(255,255,255,0.25)',
              background: 'rgba(20,20,20,0.85)',
              color: '#fff',
              borderRadius: 8,
              fontSize: 11,
              padding: '4px 8px',
              cursor: 'pointer',
            }}
          >
            용어
          </button>
        </div>
        {showGlossary && (
          <div
            style={{
              marginTop: 10,
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8,
              overflow: 'hidden',
              fontSize: 11,
              lineHeight: 1.4,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', background: 'rgba(255,255,255,0.08)' }}>
              <div style={{ padding: '6px 8px', fontWeight: 'bold' }}>용어</div>
              <div style={{ padding: '6px 8px', fontWeight: 'bold' }}>의미</div>
            </div>
            {glossaryRows.map((row) => (
              <div
                key={row.term}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '80px 1fr',
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div style={{ padding: '6px 8px', color: '#ffd700', fontWeight: 'bold' }}>{row.term}</div>
                <div style={{ padding: '6px 8px', opacity: 0.92 }}>{row.meaning}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 10, fontSize: 11, opacity: 0.8 }}>
          회전 가이드: {spinGuideLabel}
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
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ffd700' }} />
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
            top: '35%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: turnMessage.includes('SCORE') 
              ? 'rgba(0, 255, 136, 0.95)' 
              : turnMessage.includes('WINS')
              ? 'rgba(255, 215, 0, 0.95)'
              : 'rgba(255, 100, 100, 0.9)',
            padding: '25px 50px',
            borderRadius: 16,
            fontSize: 32,
            fontWeight: 'bold',
            color: turnMessage.includes('SCORE') || turnMessage.includes('WINS') ? '#000' : '#fff',
            animation: 'pulse 0.5s ease-in-out',
            zIndex: 100,
          }}
        >
          {turnMessage}
        </div>
      )}

      {phase === 'AIMING' && (
        <div
          style={{
            position: 'absolute',
            top: '48%',
            left: 20,
            transform: 'translateY(-50%)',
            background: 'rgba(0,0,0,0.82)',
            borderRadius: 12,
            padding: '12px 14px',
            minWidth: 220,
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>큐-수구-목적구 겹침량</div>
          {overlapRows.map((row) => (
            <div key={row.id} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span>{row.id}</span>
                <span style={{ color: row.hittable ? '#00ff88' : '#ff6666' }}>{row.overlapPct}%</span>
              </div>
              <div style={{ height: 8, background: 'rgba(255,255,255,0.12)', borderRadius: 999, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${row.overlapPct}%`,
                    height: '100%',
                    background: row.hittable ? 'linear-gradient(90deg, #00d084, #00ff88)' : '#ff6666',
                  }}
                />
              </div>
            </div>
          ))}
          <div style={{ fontSize: 11, opacity: 0.65 }}>값이 높을수록 정면(얇기↓), 낮을수록 얇은 두께</div>
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
            padding: '15px 20px',
            borderRadius: 12,
            minWidth: 180,
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>IMPACT (WASD / ㅈㅁㄴㅇ)</div>
          
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
            <div style={{
              position: 'absolute',
              inset: 0,
              fontSize: 8,
              color: 'rgba(255,255,255,0.7)',
              pointerEvents: 'none',
            }}>
              {[
                { key: '-1,1', x: '17%', y: '17%', label: '좌상' },
                { key: '0,1', x: '50%', y: '17%', label: '상' },
                { key: '1,1', x: '83%', y: '17%', label: '우상' },
                { key: '-1,0', x: '17%', y: '50%', label: '좌' },
                { key: '0,0', x: '50%', y: '50%', label: '중' },
                { key: '1,0', x: '83%', y: '50%', label: '우' },
                { key: '-1,-1', x: '17%', y: '83%', label: '좌하' },
                { key: '0,-1', x: '50%', y: '83%', label: '하' },
                { key: '1,-1', x: '83%', y: '83%', label: '우하' },
              ].map((zone) => (
                <div
                  key={zone.key}
                  style={{
                    position: 'absolute',
                    left: zone.x,
                    top: zone.y,
                    transform: 'translate(-50%, -50%)',
                    color: zone.key === activeZoneKey ? '#ffd700' : 'rgba(255,255,255,0.65)',
                    fontWeight: zone.key === activeZoneKey ? 'bold' : 'normal',
                  }}
                >
                  {zone.label}
                </div>
              ))}
            </div>
          </div>
          
          <div style={{ fontSize: 12 }}>
            <div>X: {(shotInput.impactOffsetX * 1000).toFixed(1)}mm</div>
            <div>Y: {(shotInput.impactOffsetY * 1000).toFixed(1)}mm</div>
            <div style={{ 
              color: isMiscueRisk ? '#ff4444' : '#00ff88',
              fontWeight: 'bold',
              marginTop: 4,
            }}>
              {offsetPercent}% {isMiscueRisk && 'WARN_MISCUE_RISK'}
            </div>
            <div style={{ fontSize: 11, opacity: 0.8, marginTop: 6 }}>
              LIMIT_OFFSET: ±{(PHYSICS.BALL_RADIUS * 0.9 * 1000).toFixed(1)}mm
            </div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>
              LIMIT_DRAG: {INPUT_LIMITS.DRAG_MIN}~{INPUT_LIMITS.DRAG_MAX}px
            </div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>
              {inputConstraintCode}
            </div>
            <div style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>
              W/ㅈ: 상단 당점, S/ㄴ: 하단 당점
            </div>
          </div>
        </div>
      )}

      {/* 방향/고각 정보 */}
      {phase === 'AIMING' && (
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            right: 20,
            background: 'rgba(0,0,0,0.85)',
            padding: '15px 20px',
            borderRadius: 12,
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>DIRECTION</div>
          <div style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>
            {shotInput.shotDirectionDeg.toFixed(0)}°
          </div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>
            {shotInput.aimControlMode === 'MANUAL_AIM'
              ? '←/→로 방향 조절'
              : '카메라 회전에 자동 동기화'}
          </div>
        </div>
      )}

      {/* 하단 조작 가이드 */}
      {phase === 'AIMING' && (
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.7)',
            padding: '12px 24px',
            borderRadius: 20,
            fontSize: 13,
            display: 'flex',
            gap: 14,
            flexWrap: 'wrap',
            justifyContent: 'center',
            maxWidth: 'min(92vw, 860px)',
            lineHeight: 1.4,
            textAlign: 'center',
          }}
        >
          <span>1) 마우스 드래그 후 놓기: 샷</span>
          <span>2) WASD/ㅈㅁㄴㅇ: 당점</span>
          <span>3) M: 조준 모드 전환</span>
          {shotInput.aimControlMode === 'MANUAL_AIM' && <span>4) ←/→: 방향</span>}
          <span>R: 초기화</span>
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

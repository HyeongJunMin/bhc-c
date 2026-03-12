import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { INPUT_LIMITS, PHYSICS, RULES } from '../lib/constants';
import { requestReplay, endReplay, type ChatMessage } from '../lib/api-client';
import { PlaybackSlider } from './test/PlaybackSlider';
import { ChatPanel } from './ChatPanel';
import { SpeechBubble } from './SpeechBubble';

type GameUIProps = {
  mode?: 'game';
  chatMessages?: ChatMessage[];
  onSendChat?: (text: string) => void;
  currentMemberId?: string;
  members?: Array<{ memberId: string; displayName: string }>;
};

export function GameUI({ chatMessages = [], onSendChat, currentMemberId, members }: GameUIProps = {}) {
  const TURN_DURATION_MS = 20_000;
  const gameStore = useGameStore();
  const {
    phase,
    shotInput,
    activeCueBallId,
    currentPlayer,
    scores,
    turnMessage,
    turnStartedAtMs,
    cushionContacts,
    objectBallsHit,
    turnEvents,
    checkThreeCushionScore,
    replayRemainingCount,
    replayHistory,
    selectedHistoryReplayIndex,
    replayScorerMemberId,
    multiplayerContext,
    replayFrameData,
    replayCurrentFrame,
    replayIsPlaying,
    isMyTurn,
  } = gameStore;

  const [turnRemainMs, setTurnRemainMs] = useState(TURN_DURATION_MS);

  const myDisplayName = members?.find((m) => m.memberId === currentMemberId)?.displayName;

  const powerPercent = Math.round(
    ((shotInput.dragPx - INPUT_LIMITS.DRAG_MIN) /
      (INPUT_LIMITS.DRAG_MAX - INPUT_LIMITS.DRAG_MIN)) *
      100,
  );
  const speed = (
    PHYSICS.MIN_SPEED_MPS +
    (powerPercent / 100) * (PHYSICS.MAX_SPEED_MPS - PHYSICS.MIN_SPEED_MPS)
  ).toFixed(1);
  const offsetDistance = Math.sqrt(
    shotInput.impactOffsetX ** 2 + shotInput.impactOffsetY ** 2,
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

  const secondTargetId = activeCueBallId === 'cueBall' ? 'objectBall2' : 'cueBall';
  const hitObject1 = objectBallsHit.has('objectBall1');
  const hitObject2 = objectBallsHit.has(secondTargetId);
  const isScoreValid = turnEvents.length > 0 && checkThreeCushionScore();
  const isMissTurnOver = turnMessage.trim().toUpperCase().includes('MISS - TURN OVER');
  const isScoreTurnMessage = turnMessage.trim().toUpperCase().includes('SCORE');
  const isCompactTurnMessage = isMissTurnOver || isScoreTurnMessage;
  const isMissMessage = turnMessage.trim().toUpperCase().includes('MISS');

  // 리플레이: 현재 플레이어가 득점자인지 (멀티플레이어)
  const isReplayScorer = !multiplayerContext || (replayScorerMemberId === multiplayerContext.memberId);
  const roomId = multiplayerContext?.roomId;
  const memberId = multiplayerContext?.memberId;
  const ballColorMap: Record<string, string> = {
    cueBall: '#ffffff',
    objectBall1: '#ff3b30',
    objectBall2: '#ffd60a',
  };
  const overlappingRows = overlapRows.filter((row) => row.hittable && row.overlap > 0);
  const overlayBallSize = 34;
  const overlayTrackWidth = 112;

  // 말풍선: 발신자별 마지막 메시지 (members 순서 기준 인덱스)
  const speechBubbles = useMemo(() => {
    if (!members || members.length === 0) return [];
    const latestByMember = new Map<string, ChatMessage>();
    for (const msg of chatMessages) {
      latestByMember.set(msg.senderMemberId, msg);
    }
    return members.slice(0, 2).map((member, idx) => {
      const msg = latestByMember.get(member.memberId);
      return msg ? { msg, idx } : null;
    }).filter((x): x is { msg: ChatMessage; idx: number } => x !== null);
  }, [chatMessages, members]);

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

        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => gameStore.toggleBallTrail()}
            style={{
              border: 'none',
              borderRadius: 6,
              background: gameStore.showBallTrail ? '#0f9d58' : '#2e2e2e',
              color: '#fff',
              padding: '4px 8px',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            수구궤적 {gameStore.showBallTrail ? 'ON' : 'OFF'}
          </button>
        </div>

        <div style={{ marginBottom: 15 }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
            SCORE (Target: {RULES.WINNING_SCORE})
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            {Object.entries(scores).map(([player, score]) => (
              <div
                key={player}
                style={{
                  textAlign: 'center',
                  opacity: currentPlayer === player ? 1 : 0.5,
                  transform: currentPlayer === player ? 'scale(1.1)' : 'scale(1)',
                  transition: 'all 0.3s',
                  border: currentPlayer === player ? '2px solid #00ff88' : '2px solid transparent',
                  borderRadius: 8,
                  padding: '4px 8px',
                }}
              >
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 'bold',
                    color: currentPlayer === player ? '#00ff88' : 'white',
                  }}
                >
                  {score}
                </div>
                <div style={{ fontSize: 11, textTransform: 'uppercase' }}>{player}</div>
                {player === myDisplayName && (
                  <div style={{ fontSize: 10, color: '#00ff88', marginTop: 2 }}>me</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 10, fontSize: 12, opacity: 0.85 }}>
          TURN: <span style={{ color: '#ffd700', fontWeight: 700 }}>{(turnRemainMs / 1000).toFixed(1)}s</span>
        </div>

        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 10 }}>
          Phase: <span style={{ color: '#ffd700' }}>{phase}</span>
        </div>
      </div>

      {(phase === 'SHOOTING' || phase === 'SIMULATING') && (
        <div
          style={{
            position: 'absolute',
            top: 280,
            right: 20,
            background: 'rgba(0,0,0,0.85)',
            padding: '20px',
            borderRadius: 12,
            minWidth: 180,
            border: `2px solid ${isScoreValid ? '#00ff88' : '#444'}`,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 12, color: '#ffd700' }}>
            3-CUSHION TRACKER
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Cushions</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3].map((i) => (
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

          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Object Balls Hit</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: hitObject1 ? 1 : 0.4 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff0000' }} />
                <span style={{ color: hitObject1 ? '#00ff88' : 'white' }}>{hitObject1 ? '✓' : '○'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: hitObject2 ? 1 : 0.4 }}>
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: ballColorMap[secondTargetId] ?? '#ffd700',
                  }}
                />
                <span style={{ color: hitObject2 ? '#00ff88' : 'white' }}>{hitObject2 ? '✓' : '○'}</span>
              </div>
            </div>
          </div>

          {/* 득점 가능 여부 */}
          {isScoreValid && (
            <div
              style={{
                marginTop: 12,
                padding: 8,
                background: '#00ff88',
                color: '#000',
                borderRadius: 6,
                textAlign: 'center',
                fontWeight: 'bold',
              }}
            >
              SCORED! ✓
            </div>
          )}
        </div>
      )}

      {turnMessage && (
        <div
          style={{
            position: 'absolute',
            top: isMissMessage ? '5%' : (isCompactTurnMessage ? '13%' : '35%'),
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: turnMessage.includes('SCORE')
                ? 'rgba(0, 255, 136, 0.95)'
                : turnMessage.includes('WINS')
                  ? 'rgba(255, 215, 0, 0.95)'
                  : 'rgba(255, 100, 100, 0.9)',
              padding: isMissMessage ? '8px 16px' : (isCompactTurnMessage ? '10px 18px' : '25px 50px'),
              borderRadius: isMissMessage ? 10 : (isCompactTurnMessage ? 10 : 16),
              fontSize: isMissMessage ? 22 : (isCompactTurnMessage ? 18 : 32),
              fontWeight: 'bold',
              color: turnMessage.includes('SCORE') || turnMessage.includes('WINS') ? '#000' : '#fff',
              animation: 'pulse 0.5s ease-in-out',
            }}
          >
            {turnMessage}
          </div>
          {isMissMessage && isMyTurn && (
            <div
              style={{
                background: 'rgba(0, 255, 136, 0.95)',
                padding: '8px 16px',
                borderRadius: 10,
                fontSize: 22,
                fontWeight: 'bold',
                color: '#000',
                animation: 'pulse 0.5s ease-in-out',
              }}
            >
              MY TURN
            </div>
          )}
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

      {/* REPLAY_READY: 리플레이 버튼 */}
      {phase === 'REPLAY_READY' && (
        <div
          style={{
            position: 'absolute',
            top: '45%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            zIndex: 200,
            pointerEvents: 'auto',
          }}
        >
          {isReplayScorer ? (
            <>
              <button
                type="button"
                disabled={replayRemainingCount <= 0}
                onClick={() => {
                  if (replayRemainingCount <= 0) return;
                  if (multiplayerContext && roomId && memberId) {
                    requestReplay(roomId, memberId).catch(console.error);
                  } else {
                    gameStore.startReplay();
                  }
                }}
                style={{
                  background: replayRemainingCount > 0 ? '#00ff88' : '#555',
                  color: replayRemainingCount > 0 ? '#000' : '#999',
                  border: 'none',
                  borderRadius: 10,
                  padding: '14px 32px',
                  fontSize: 20,
                  fontWeight: 'bold',
                  cursor: replayRemainingCount > 0 ? 'pointer' : 'default',
                }}
              >
                ▶ REPLAY ({replayRemainingCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  if (multiplayerContext && roomId && memberId) {
                    endReplay(roomId, memberId).catch(console.error);
                  } else {
                    gameStore.finishReplay();
                  }
                }}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: 10,
                  padding: '10px 28px',
                  fontSize: 16,
                  cursor: 'pointer',
                }}
              >
                SKIP ▸
              </button>
            </>
          ) : (
            <div
              style={{
                background: 'rgba(0,0,0,0.8)',
                color: '#ffd700',
                padding: '14px 28px',
                borderRadius: 10,
                fontSize: 18,
                fontWeight: 'bold',
              }}
            >
              REPLAY...
            </div>
          )}
        </div>
      )}

      {/* REPLAYING: 리플레이 진행 중 컨트롤 */}
      {phase === 'REPLAYING' && (
        <div
          style={{
            position: 'absolute',
            top: '5%',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            zIndex: 200,
            pointerEvents: 'auto',
            minWidth: 340,
          }}
        >
          <div
            style={{
              background: 'rgba(0, 200, 255, 0.9)',
              color: '#000',
              padding: '6px 20px',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 'bold',
            }}
          >
            REPLAY
          </div>
          {replayFrameData && replayFrameData.frames.length > 0 && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => gameStore.toggleReplayPlaying()}
                  style={{
                    background: replayIsPlaying ? 'rgba(0,200,255,0.8)' : 'rgba(255,255,255,0.2)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: 6,
                    padding: '4px 16px',
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  {replayIsPlaying ? '⏸ PAUSE' : '▶ PLAY'}
                </button>
              </div>
              <PlaybackSlider
                totalFrames={replayFrameData.frames.length - 1}
                currentFrame={replayCurrentFrame}
                dtSec={0.05}
                onFrameChange={(frame) => {
                  gameStore.setReplayCurrentFrame(frame);
                  if (gameStore.replayIsPlaying) {
                    gameStore.toggleReplayPlaying();
                  }
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* SCORING: 승리 화면 리플레이 갤러리 */}
      {phase === 'SCORING' && replayHistory.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.85)',
            borderRadius: 12,
            padding: '14px 20px',
            minWidth: 300,
            maxWidth: 480,
            zIndex: 200,
            pointerEvents: 'auto',
          }}
        >
          <div style={{ fontSize: 13, color: '#ffd700', fontWeight: 'bold', marginBottom: 8 }}>
            REPLAY GALLERY
          </div>
          {selectedHistoryReplayIndex !== null ? (
            <div style={{ color: '#00cfff', fontSize: 14, textAlign: 'center', padding: '8px 0' }}>
              REPLAYING...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {replayHistory.map((entry, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => gameStore.startHistoryReplay(idx)}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 6,
                    color: '#fff',
                    padding: '6px 12px',
                    fontSize: 13,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  Shot #{entry.shotNumber} — {entry.scorerName} ({entry.scoreAtTime})
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {phase === 'AIMING' && (
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            background: 'rgba(0,0,0,0.85)',
            padding: '12px',
            borderRadius: 12,
            fontSize: 12,
            opacity: 0.92,
          }}
        >
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)',
              border: `2px solid ${isMiscueRisk ? '#ff4444' : '#fff'}`,
              position: 'relative',
              marginBottom: 10,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: 2,
                height: 2,
                background: '#fff',
                transform: 'translate(-50%, -50%)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: `${50 - (shotInput.impactOffsetY / PHYSICS.BALL_RADIUS) * 45}%`,
                left: `${50 + (shotInput.impactOffsetX / PHYSICS.BALL_RADIUS) * 45}%`,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isMiscueRisk ? '#ff4444' : '#ff3333',
                transform: 'translate(-50%, -50%)',
                boxShadow: '0 0 5px rgba(255,0,0,0.5)',
              }}
            />
            <div style={{ position: 'absolute', left: '33%', top: 2, bottom: 2, width: 1, background: 'rgba(255,255,255,0.25)' }} />
            <div style={{ position: 'absolute', left: '66%', top: 2, bottom: 2, width: 1, background: 'rgba(255,255,255,0.25)' }} />
            <div style={{ position: 'absolute', top: '33%', left: 2, right: 2, height: 1, background: 'rgba(255,255,255,0.25)' }} />
            <div style={{ position: 'absolute', top: '66%', left: 2, right: 2, height: 1, background: 'rgba(255,255,255,0.25)' }} />
          </div>
          <div>Power: {powerPercent}% ({speed} m/s)</div>
          <div>English: {offsetPercent}% {isMiscueRisk ? '(miscue risk)' : ''}</div>
          {overlappingRows.length > 0 && <div>Object overlap detected: {overlappingRows.length}</div>}
        </div>
      )}

      {/* 게임 중 채팅 패널 */}
      {currentMemberId && onSendChat && (
        <ChatPanel
          messages={chatMessages}
          onSend={onSendChat}
          currentMemberId={currentMemberId}
        />
      )}

      {/* 말풍선 */}
      {speechBubbles.map(({ msg, idx }) => (
        <SpeechBubble key={`${msg.senderMemberId}-${msg.sentAt}`} message={msg} playerIndex={idx} />
      ))}
    </div>
  );
}

import { useEffect } from 'react';
import { GameScene } from './components/GameScene';
import { GameUI } from './components/GameUI';
import { InputHandler } from './components/InputHandler';
import { useGameStore } from './hooks/useGameStore';
import { SseClient } from './net/SseClient';
import { getSharedInterpolator } from './net/SnapshotInterpolator';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const HARDCODED_ROOM_TITLE = '테스트방';
const HARDCODED_MEMBER_ID = 'player1';
let didBootstrapGameSession = false;

function App() {
  const store = useGameStore();

  useEffect(() => {
    if (didBootstrapGameSession) {
      return;
    }
    didBootstrapGameSession = true;
    let sseClient: SseClient | null = null;
    let isActive = true;

    async function setupGame(): Promise<void> {
      store.setConnectionStatus('connecting');
      const createRes = await fetch(`${API_BASE_URL}/lobby/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: HARDCODED_ROOM_TITLE }),
      });
      const createBody = (await createRes.json()) as { room: { roomId: string } };
      const roomId = createBody.room.roomId;

      await fetch(`${API_BASE_URL}/lobby/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: 'player1', displayName: 'Player 1' }),
      });
      await fetch(`${API_BASE_URL}/lobby/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: 'player2', displayName: 'Player 2' }),
      });
      await fetch(`${API_BASE_URL}/lobby/rooms/${roomId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorMemberId: 'player1' }),
      });
      if (!isActive) {
        return;
      }

      store.setRoomInfo(roomId, HARDCODED_MEMBER_ID);
      const interpolator = getSharedInterpolator();
      sseClient = new SseClient(API_BASE_URL, {
        onSnapshot: (snapshot) => {
          interpolator.pushSnapshot(snapshot);
          store.applyServerState(snapshot.state);
          store.applyTurnInfo(snapshot.turn.currentMemberId, snapshot.turn.turnDeadlineMs);
          store.applyScoreBoard(snapshot.scoreBoard);
          const allStationary = snapshot.balls.every((ball) => ball.motionState === 'STATIONARY');
          const isMyTurn = snapshot.turn.currentMemberId === HARDCODED_MEMBER_ID;
          if (allStationary && isMyTurn && !store.shotPending) {
            store.setPhase('AIMING');
          } else if (!allStationary) {
            store.setPhase('SIMULATING');
          } else if (!isMyTurn) {
            store.setPhase('WAITING');
          }
        },
        onShotStarted: () => {
          store.setShotPending(false);
          store.setPhase('SIMULATING');
        },
        onShotResolved: (event) => {
          store.applyScoreBoard(event.scoreBoard);
        },
        onTurnChanged: (event) => {
          store.applyTurnInfo(event.currentMemberId, event.turnDeadlineMs);
          store.applyScoreBoard(event.scoreBoard);
          const isMyTurn = event.currentMemberId === HARDCODED_MEMBER_ID;
          store.setPhase(isMyTurn ? 'AIMING' : 'WAITING');
        },
        onGameFinished: (event) => {
          store.setPhase('FINISHED');
          store.setTurnMessage(event.winnerMemberId === HARDCODED_MEMBER_ID ? 'YOU WIN!' : 'YOU LOSE');
        },
        onOpen: () => store.setConnectionStatus('connected'),
        onError: () => store.setConnectionStatus('disconnected'),
      });
      sseClient.connect(roomId, HARDCODED_MEMBER_ID);
    }

    void setupGame().catch(() => {
      store.setConnectionStatus('disconnected');
    });

    return () => {
      isActive = false;
      sseClient?.disconnect();
    };
  }, []);

  return (
    <>
      <GameScene />
      <GameUI />
      <InputHandler />
    </>
  );
}

export default App;

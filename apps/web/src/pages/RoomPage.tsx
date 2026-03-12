import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { getRoomDetail, leaveRoom, startGame, createRoomStream, getRoomChatMessages, sendRoomChatMessage, type LobbyRoom, type ChatMessage } from '../lib/api-client';
import { GameScene } from '../components/GameScene';
import { ChatPanel } from '../components/ChatPanel';

const POLL_INTERVAL_MS = 2000;

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { memberId, nickname } = useAuthStore();

  const [room, setRoom] = useState<LobbyRoom | null>(null);
  const [error, setError] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!roomId) {
      void navigate('/');
      return;
    }

    void fetchRoom();

    pollingRef.current = setInterval(() => { void fetchRoom(); }, POLL_INTERVAL_MS);

    if (!memberId) return;
    const es = createRoomStream(roomId, memberId);
    eventSourceRef.current = es;

    void getRoomChatMessages(roomId).then((result) => {
      setChatMessages(result.items);
    }).catch(() => { /* non-fatal */ });

    es.addEventListener('room_snapshot', (e: MessageEvent) => {
      try {
        const snapshot = JSON.parse(e.data as string) as { state: LobbyRoom['state'] };
        setRoom((prev) => {
          if (!prev) return prev;
          if (prev.state !== snapshot.state) {
            void fetchRoom();
          }
          return prev;
        });
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener('chat_message', (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data as string) as ChatMessage;
        setChatMessages((prev) => [...prev, msg]);
      } catch {
        // ignore parse errors
      }
    });

    es.onerror = () => {
      // SSE errors are non-fatal; polling handles updates
    };

    return () => {
      if (pollingRef.current !== null) {
        clearInterval(pollingRef.current);
      }
      es.close();
    };
  }, [roomId, memberId]);

  async function fetchRoom() {
    if (!roomId) return;
    try {
      const r = await getRoomDetail(roomId);
      setRoom(r);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '방 정보를 불러오지 못했습니다.');
    }
  }

  async function handleSendChat(text: string) {
    if (!roomId || !memberId) return;
    try {
      await sendRoomChatMessage(roomId, memberId, text);
    } catch {
      // non-fatal
    }
  }

  async function handleLeave() {
    if (!roomId || !memberId) return;
    setLeaving(true);
    try {
      await leaveRoom(roomId, memberId);
    } catch {
      // best-effort
    } finally {
      setLeaving(false);
      void navigate('/lobby');
    }
  }

  async function handleStart() {
    if (!roomId || !memberId) return;
    setStarting(true);
    try {
      await startGame(roomId, memberId);
      await fetchRoom();
    } catch (err) {
      alert(err instanceof Error ? err.message : '게임 시작 실패');
    } finally {
      setStarting(false);
    }
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: '#1a1a2e',
          color: '#ffffff',
          fontFamily: 'sans-serif',
          gap: '1rem',
        }}
      >
        <p style={{ color: '#ff6b6b' }}>{error}</p>
        <button
          onClick={() => { void navigate('/lobby'); }}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: '#0f3460',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          대기실로 돌아가기
        </button>
      </div>
    );
  }

  if (!room) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: '#1a1a2e',
          color: '#888',
          fontFamily: 'sans-serif',
        }}
      >
        불러오는 중...
      </div>
    );
  }

  if (room.state === 'IN_GAME') {
    return (
      <GameScene
        roomId={roomId!}
        memberId={memberId!}
        members={room.members}
        eventSource={eventSourceRef.current ?? undefined}
        chatMessages={chatMessages}
        onSendChat={(text) => { void handleSendChat(text); }}
      />
    );
  }

  const isHost = room.hostMemberId === memberId;

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#1a1a2e',
        color: '#ffffff',
        fontFamily: 'sans-serif',
        padding: '1.5rem',
      }}
    >
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: '1.4rem' }}>{room.title}</h1>
            <p style={{ margin: '0.25rem 0 0', color: '#888', fontSize: '0.85rem' }}>
              {nickname}
            </p>
          </div>
          <button
            onClick={() => { void handleLeave(); }}
            disabled={leaving}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              border: '1px solid #555',
              backgroundColor: 'transparent',
              color: '#ccc',
              cursor: leaving ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
            }}
          >
            {leaving ? '나가는 중...' : '나가기'}
          </button>
        </div>

        {/* Member List */}
        <div
          style={{
            backgroundColor: '#16213e',
            borderRadius: '8px',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            border: '1px solid #2a2a4a',
          }}
        >
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#aaa' }}>
            참가자 ({room.playerCount}/6)
          </h2>
          {room.members.length === 0 ? (
            <p style={{ color: '#666', margin: 0 }}>아직 참가자가 없습니다.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {room.members.map((member) => (
                <li
                  key={member.memberId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.95rem',
                  }}
                >
                  <span>{member.displayName}</span>
                  {member.memberId === room.hostMemberId && (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        padding: '0.1rem 0.35rem',
                        borderRadius: '3px',
                        backgroundColor: '#0f3460',
                        color: '#90caf9',
                      }}
                    >
                      방장
                    </span>
                  )}
                  {member.memberId === memberId && (
                    <span style={{ fontSize: '0.75rem', color: '#888' }}>(나)</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Start / Wait */}
        <div style={{ textAlign: 'center' }}>
          {isHost ? (
            <button
              onClick={() => { void handleStart(); }}
              disabled={starting || room.playerCount < 2}
              style={{
                padding: '0.75rem 2rem',
                fontSize: '1rem',
                fontWeight: 'bold',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: starting || room.playerCount < 2 ? '#333' : '#1a5c2e',
                color: starting || room.playerCount < 2 ? '#666' : '#fff',
                cursor: starting || room.playerCount < 2 ? 'not-allowed' : 'pointer',
              }}
            >
              {starting ? '시작 중...' : '게임 시작'}
            </button>
          ) : (
            <p style={{ color: '#888', margin: 0 }}>방장이 게임을 시작하기를 기다리는 중...</p>
          )}
          {isHost && room.playerCount < 2 && (
            <p style={{ color: '#888', fontSize: '0.85rem', marginTop: '0.5rem' }}>
              게임 시작을 위해 최소 2명이 필요합니다.
            </p>
          )}
        </div>
      </div>

      {memberId && (
        <ChatPanel
          messages={chatMessages}
          onSend={(text) => { void handleSendChat(text); }}
          currentMemberId={memberId}
        />
      )}
    </div>
  );
}

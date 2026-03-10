import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { listRooms, createRoom, joinRoom, type LobbyRoom } from '../lib/api-client';

const MAX_PLAYERS = 6;
const POLL_INTERVAL_MS = 5000;

function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '방금';
  if (diffMin < 60) return `${diffMin}분 전`;
  return `${Math.floor(diffMin / 60)}시간 전`;
}

export function LobbyPage() {
  const navigate = useNavigate();
  const { nickname, memberId, logout } = useAuthStore();

  const [rooms, setRooms] = useState<LobbyRoom[]>([]);
  const [loadError, setLoadError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void fetchRooms();
    pollingRef.current = setInterval(() => { void fetchRooms(); }, POLL_INTERVAL_MS);
    return () => {
      if (pollingRef.current !== null) {
        clearInterval(pollingRef.current);
      }
    };
  }, [memberId]);

  async function fetchRooms() {
    try {
      const result = await listRooms();
      setRooms(result.items);
      setLoadError('');
    } catch {
      setLoadError('방 목록을 불러오지 못했습니다.');
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) {
      setCreateError('방 제목을 입력하세요.');
      return;
    }
    if (!memberId || !nickname) return;
    setCreating(true);
    setCreateError('');
    try {
      const { room } = await createRoom(title, memberId, nickname);
      void navigate(`/room/${room.roomId}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : '방 만들기 실패');
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(roomId: string) {
    if (!memberId || !nickname) return;
    setJoiningRoomId(roomId);
    try {
      await joinRoom(roomId, memberId, nickname);
      void navigate(`/room/${roomId}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : '입장 실패');
    } finally {
      setJoiningRoomId(null);
    }
  }

  function handleLogout() {
    logout();
    void navigate('/');
  }

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
      <div
        style={{
          maxWidth: '800px',
          margin: '0 auto',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
          }}
        >
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>대기실</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ color: '#aaa', fontSize: '0.9rem' }}>{nickname}</span>
            <button
              onClick={handleLogout}
              style={{
                padding: '0.4rem 0.8rem',
                fontSize: '0.85rem',
                borderRadius: '4px',
                border: '1px solid #555',
                backgroundColor: 'transparent',
                color: '#ccc',
                cursor: 'pointer',
              }}
            >
              로그아웃
            </button>
          </div>
        </div>

        {/* Create Room */}
        <div style={{ marginBottom: '1.5rem' }}>
          {!showCreateForm ? (
            <button
              onClick={() => { setShowCreateForm(true); }}
              style={{
                padding: '0.6rem 1.2rem',
                fontSize: '0.95rem',
                fontWeight: 'bold',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#0f3460',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              + 방 만들기
            </button>
          ) : (
            <form
              onSubmit={(e) => { void handleCreate(e); }}
              style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
              }}
            >
              <input
                type="text"
                placeholder="방 제목"
                value={newTitle}
                onChange={(e) => { setNewTitle(e.target.value); }}
                maxLength={30}
                disabled={creating}
                autoFocus
                style={{
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.95rem',
                  borderRadius: '4px',
                  border: '1px solid #444',
                  backgroundColor: '#16213e',
                  color: '#fff',
                  width: '200px',
                }}
              />
              <button
                type="submit"
                disabled={creating}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: creating ? '#444' : '#0f3460',
                  color: '#fff',
                  cursor: creating ? 'not-allowed' : 'pointer',
                }}
              >
                {creating ? '생성 중...' : '만들기'}
              </button>
              <button
                type="button"
                onClick={() => { setShowCreateForm(false); setNewTitle(''); setCreateError(''); }}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '4px',
                  border: '1px solid #555',
                  backgroundColor: 'transparent',
                  color: '#ccc',
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
              {createError && (
                <p style={{ width: '100%', margin: 0, color: '#ff6b6b', fontSize: '0.85rem' }}>
                  {createError}
                </p>
              )}
            </form>
          )}
        </div>

        {/* Room List */}
        {loadError && (
          <p style={{ color: '#ff6b6b', marginBottom: '1rem' }}>{loadError}</p>
        )}
        {rooms.length === 0 && !loadError ? (
          <p style={{ color: '#888', textAlign: 'center', marginTop: '3rem' }}>
            현재 열린 방이 없습니다.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {rooms.map((room) => {
              const isJoinable = room.state === 'WAITING' && room.playerCount < MAX_PLAYERS;
              const isJoining = joiningRoomId === room.roomId;
              return (
                <div
                  key={room.roomId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem 1.25rem',
                    borderRadius: '8px',
                    backgroundColor: '#16213e',
                    border: '1px solid #2a2a4a',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 'bold',
                        fontSize: '1rem',
                        marginBottom: '0.25rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {room.title}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.75rem',
                        fontSize: '0.8rem',
                        color: '#888',
                        alignItems: 'center',
                      }}
                    >
                      <span
                        style={{
                          padding: '0.1rem 0.45rem',
                          borderRadius: '3px',
                          backgroundColor: room.state === 'WAITING' ? '#1a5c2e' : '#5c4a00',
                          color: room.state === 'WAITING' ? '#4caf50' : '#ffc107',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                        }}
                      >
                        {room.state === 'WAITING' ? '대기 중' : '게임 중'}
                      </span>
                      <span>{room.playerCount}/{MAX_PLAYERS}명</span>
                      <span>{formatRelativeTime(room.createdAt)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => { void handleJoin(room.roomId); }}
                    disabled={!isJoinable || isJoining}
                    style={{
                      padding: '0.5rem 1rem',
                      marginLeft: '1rem',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: isJoinable && !isJoining ? '#0f3460' : '#333',
                      color: isJoinable && !isJoining ? '#fff' : '#666',
                      cursor: isJoinable && !isJoining ? 'pointer' : 'not-allowed',
                      fontSize: '0.875rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isJoining ? '입장 중...' : '입장'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

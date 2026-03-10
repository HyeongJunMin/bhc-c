import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export function NicknamePage() {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = nickname.trim();
    if (!trimmed) {
      setError('닉네임을 입력하세요.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(trimmed);
      void navigate('/lobby');
    } catch {
      setError('입장에 실패했습니다. 다시 시도하세요.');
    } finally {
      setLoading(false);
    }
  }

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
      }}
    >
      <h1 style={{ fontSize: '2rem', marginBottom: '2rem', letterSpacing: '0.1em' }}>
        Become a Hwabaek Cho
      </h1>
      <form
        onSubmit={(e) => { void handleSubmit(e); }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          width: '300px',
        }}
      >
        <input
          type="text"
          placeholder="닉네임 입력"
          value={nickname}
          onChange={(e) => { setNickname(e.target.value); }}
          maxLength={20}
          disabled={loading}
          style={{
            padding: '0.75rem 1rem',
            fontSize: '1rem',
            borderRadius: '6px',
            border: '1px solid #444',
            backgroundColor: '#16213e',
            color: '#ffffff',
            outline: 'none',
          }}
        />
        {error && (
          <p style={{ color: '#ff6b6b', margin: 0, fontSize: '0.875rem' }}>{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '0.75rem',
            fontSize: '1rem',
            fontWeight: 'bold',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: loading ? '#444' : '#0f3460',
            color: '#ffffff',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '입장 중...' : '입장'}
        </button>
      </form>
    </div>
  );
}

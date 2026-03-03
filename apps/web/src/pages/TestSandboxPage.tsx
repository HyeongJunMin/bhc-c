import { useNavigate } from 'react-router-dom';

export function TestSandboxPage() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f172a',
        color: '#f1f5f9',
        fontFamily: 'system-ui, sans-serif',
        padding: '32px 24px',
      }}
    >
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button
            onClick={() => navigate('/test')}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#94a3b8',
              borderRadius: 6,
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            ← 목록
          </button>
          <h1 style={{ margin: 0, fontSize: 24 }}>Sandbox</h1>
        </div>
        <p style={{ color: '#94a3b8' }}>샌드박스 편집 UI는 다음 태스크에서 이어서 구현됩니다.</p>
      </div>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { scenarios } from '../test-scenarios/index';
import type { TestScenario } from '../test-scenarios/index';

const TAG_COLORS: Record<string, string> = {
  straight: '#4ade80',
  cushion: '#60a5fa',
  spin: '#f472b6',
  'ball-ball': '#fb923c',
  '3-cushion': '#a78bfa',
};

function ScenarioCard({ scenario }: { scenario: TestScenario }) {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(`/test/${scenario.id}`)}
      style={{
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: 8,
        padding: '16px 20px',
        cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#60a5fa';
        (e.currentTarget as HTMLDivElement).style.background = '#243047';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#334155';
        (e.currentTarget as HTMLDivElement).style.background = '#1e293b';
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9', marginBottom: 6 }}>
        {scenario.name}
      </div>
      <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 10, lineHeight: 1.5 }}>
        {scenario.description}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {scenario.tags.map((tag) => (
          <span
            key={tag}
            style={{
              background: (TAG_COLORS[tag] ?? '#64748b') + '22',
              color: TAG_COLORS[tag] ?? '#94a3b8',
              border: `1px solid ${TAG_COLORS[tag] ?? '#64748b'}44`,
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 500,
            }}
          >
            {tag}
          </span>
        ))}
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: '#475569' }}>
        ID: {scenario.id}
      </div>
    </div>
  );
}

export function TestListPage() {
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
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <button
            onClick={() => navigate('/')}
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
            ← 게임
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>물리엔진 테스트</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
              시나리오를 선택하여 시뮬레이션을 실행하고 baseline과 비교합니다
            </p>
          </div>
        </div>

        {/* Scenario grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          <div
            onClick={() => navigate('/test/sandbox')}
            style={{
              background: '#0b3a2b',
              border: '1px solid #0f766e',
              borderRadius: 8,
              padding: '16px 20px',
              cursor: 'pointer',
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = '#2dd4bf';
              (e.currentTarget as HTMLDivElement).style.background = '#114135';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = '#0f766e';
              (e.currentTarget as HTMLDivElement).style.background = '#0b3a2b';
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: '#99f6e4', marginBottom: 6 }}>
              Sandbox
            </div>
            <div style={{ fontSize: 13, color: '#99aeb6', marginBottom: 10, lineHeight: 1.5 }}>
              공 초기 위치와 샷 파라미터를 자유 편집해 새 테스트 입력을 생성합니다
            </div>
            <div style={{ fontSize: 11, color: '#5eead4' }}>
              JSON 내보내기 지원
            </div>
          </div>
          {scenarios.map((scenario) => (
            <ScenarioCard key={scenario.id} scenario={scenario} />
          ))}
        </div>
      </div>
    </div>
  );
}

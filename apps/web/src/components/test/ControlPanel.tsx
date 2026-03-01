import type { TestScenario } from '../../test-scenarios/index';
import type { SimulationResult } from '@physics-core/standalone-simulator';

type Props = {
  scenario: TestScenario;
  hasBaseline: boolean;
  isRunning: boolean;
  actual: SimulationResult | null;
  onExecute: () => void;
  onReset: () => void;
  onSaveBaseline: () => void;
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
      <span style={{ color: '#64748b', fontSize: 12 }}>{label}</span>
      <span style={{ color: '#cbd5e1', fontSize: 12, fontFamily: 'monospace' }}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export function ControlPanel({ scenario, hasBaseline, isRunning, actual, onExecute, onReset, onSaveBaseline }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Scenario info */}
      <Section title="시나리오">
        <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 4 }}>
          {scenario.name}
        </div>
        <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
          {scenario.description}
        </div>
      </Section>

      {/* Ball positions */}
      <Section title="공 초기 위치">
        <InfoRow label="수구"  value={`(${scenario.balls.cueBall.x.toFixed(3)}, ${scenario.balls.cueBall.z.toFixed(3)})`} />
        <InfoRow label="제1적구" value={`(${scenario.balls.objectBall1.x.toFixed(3)}, ${scenario.balls.objectBall1.z.toFixed(3)})`} />
        <InfoRow label="제2적구" value={`(${scenario.balls.objectBall2.x.toFixed(3)}, ${scenario.balls.objectBall2.z.toFixed(3)})`} />
      </Section>

      {/* Shot params */}
      <Section title="샷 파라미터">
        <InfoRow label="방향" value={`${scenario.shot.directionDeg}°`} />
        <InfoRow label="파워 (dragPx)" value={`${scenario.shot.dragPx}px`} />
        <InfoRow label="당점 X" value={`${scenario.shot.impactOffsetX.toFixed(4)}m`} />
        <InfoRow label="당점 Y" value={`${scenario.shot.impactOffsetY.toFixed(4)}m`} />
      </Section>

      {/* Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        <button
          onClick={onExecute}
          disabled={isRunning}
          style={{
            background: isRunning ? '#1e3a5f' : '#2563eb',
            color: '#f1f5f9',
            border: 'none',
            borderRadius: 6,
            padding: '8px 0',
            fontSize: 13,
            fontWeight: 600,
            cursor: isRunning ? 'not-allowed' : 'pointer',
          }}
        >
          {isRunning ? '실행 중...' : '▶ Execute'}
        </button>
        <button
          onClick={onReset}
          style={{
            background: '#1e293b',
            color: '#94a3b8',
            border: '1px solid #334155',
            borderRadius: 6,
            padding: '8px 0',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          ↺ Reset
        </button>
        <button
          onClick={onSaveBaseline}
          disabled={!actual}
          title={!actual ? '먼저 Execute를 실행하세요' : '현재 시뮬레이션 결과를 baseline으로 저장'}
          style={{
            background: !actual ? '#1a2332' : '#0f3a2a',
            color: !actual ? '#334155' : '#4ade80',
            border: `1px solid ${!actual ? '#334155' : '#16a34a'}`,
            borderRadius: 6,
            padding: '8px 0',
            fontSize: 13,
            cursor: !actual ? 'not-allowed' : 'pointer',
          }}
        >
          💾 Save Baseline
        </button>
      </div>

      {/* Baseline status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: hasBaseline ? '#4ade80' : '#ef4444',
          }}
        />
        <span style={{ color: '#64748b' }}>
          {hasBaseline ? 'Baseline 있음' : 'Baseline 없음'}
        </span>
      </div>

      {/* Simulation stats */}
      {actual && (
        <div style={{ marginTop: 12, padding: '10px 12px', background: '#1e293b', borderRadius: 6, border: '1px solid #334155' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            시뮬레이션 결과
          </div>
          <InfoRow label="총 프레임" value={`${actual.totalFrames}`} />
          <InfoRow label="시뮬레이션 시간" value={`${actual.totalTimeSec.toFixed(2)}s`} />
          <InfoRow label="이벤트 수" value={`${actual.events.length}`} />
        </div>
      )}
    </div>
  );
}

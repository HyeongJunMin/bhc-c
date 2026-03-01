import type { TrajectoryAnalysis } from '../../physics-sim/trajectory-analyzer';
import type { SimEvent } from '@physics-core/standalone-simulator';

type Props = {
  analysis: TrajectoryAnalysis | null;
  events: SimEvent[];
};

function MetricRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: 5,
        padding: '3px 0',
      }}
    >
      <span style={{ color: '#64748b', fontSize: 12 }}>{label}</span>
      <span
        style={{
          color: highlight ? '#fbbf24' : '#cbd5e1',
          fontSize: 12,
          fontFamily: 'monospace',
          fontWeight: highlight ? 600 : 400,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function EventRow({ event }: { event: SimEvent }) {
  const color =
    event.type === 'CUSHION'
      ? '#60a5fa'
      : event.type === 'BALL_BALL'
      ? '#fb923c'
      : '#94a3b8';

  const physDtSec = 0.05;
  const timeSec = event.frameIndex * physDtSec;

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
        padding: '4px 0',
        borderBottom: '1px solid #1e293b',
        fontSize: 11,
      }}
    >
      <span style={{ color: '#475569', fontFamily: 'monospace', minWidth: 44 }}>
        {timeSec.toFixed(2)}s
      </span>
      <span
        style={{
          color,
          background: color + '22',
          borderRadius: 3,
          padding: '1px 5px',
          minWidth: 68,
          textAlign: 'center',
          fontWeight: 600,
        }}
      >
        {event.type === 'CUSHION' ? `CUSH-${event.axis?.toUpperCase()}` : 'BALL'}
      </span>
      <span style={{ color: '#cbd5e1', flex: 1 }}>
        {event.ballId}
        {event.targetBallId ? ` ↔ ${event.targetBallId}` : ''}
      </span>
      <span style={{ color: '#475569', fontFamily: 'monospace' }}>
        {event.speedAfter.toFixed(2)}m/s
      </span>
    </div>
  );
}

export function AnalysisPanel({ analysis, events }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
      {/* Analysis results */}
      {analysis ? (
        <div>
          {/* PASS/FAIL badge */}
          <div
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: 4,
              fontWeight: 700,
              fontSize: 13,
              marginBottom: 10,
              background: analysis.passed ? '#0f3a2a' : '#3a0f0f',
              color: analysis.passed ? '#4ade80' : '#f87171',
              border: `1px solid ${analysis.passed ? '#16a34a' : '#b91c1c'}`,
            }}
          >
            {analysis.passed ? '✓ PASS' : '✗ FAIL'}
          </div>

          <MetricRow
            label="최대 편차"
            value={`${(analysis.maxDeviationM * 1000).toFixed(1)} mm`}
            highlight={!analysis.passed}
          />
          <MetricRow
            label="평균 편차"
            value={`${(analysis.avgDeviationM * 1000).toFixed(1)} mm`}
          />
          <MetricRow
            label="이벤트 매치율"
            value={`${(analysis.eventMatchRate * 100).toFixed(0)}%`}
          />
          {analysis.divergenceFrame !== null && (
            <MetricRow
              label="편차 시작 프레임"
              value={`#${analysis.divergenceFrame} (t=${(analysis.divergenceFrame * 0.05).toFixed(2)}s)`}
              highlight
            />
          )}
          {analysis.worstDeviation.distanceM > 0 && (
            <MetricRow
              label="최악 편차 위치"
              value={`${analysis.worstDeviation.ballId} @#${analysis.worstDeviation.frameIndex}`}
            />
          )}

          {/* Per-ball breakdown */}
          <div style={{ marginTop: 8, padding: '8px 10px', background: '#0f172a', borderRadius: 4, border: '1px solid #1e293b' }}>
            <div style={{ fontSize: 11, color: '#475569', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              공별 편차
            </div>
            {Object.entries(analysis.deviationsByBall).map(([ballId, stats]) => (
              <MetricRow
                key={ballId}
                label={ballId}
                value={`max ${(stats.max * 1000).toFixed(1)}mm avg ${(stats.avg * 1000).toFixed(1)}mm`}
              />
            ))}
          </div>
        </div>
      ) : (
        <div style={{ color: '#475569', fontSize: 12, fontStyle: 'italic' }}>
          Execute를 실행하면 baseline과 비교합니다.
        </div>
      )}

      {/* Event log */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          이벤트 로그 ({events.length})
        </div>
        <div
          style={{
            overflowY: 'auto',
            maxHeight: 200,
            border: '1px solid #1e293b',
            borderRadius: 4,
            padding: '4px 8px',
          }}
        >
          {events.length === 0 ? (
            <div style={{ color: '#334155', fontSize: 12, padding: 8 }}>이벤트 없음</div>
          ) : (
            events.map((event, i) => <EventRow key={i} event={event} />)
          )}
        </div>
      </div>
    </div>
  );
}

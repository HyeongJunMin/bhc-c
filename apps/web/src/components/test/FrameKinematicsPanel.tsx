import type { SimulationResult } from '@physics-core/standalone-simulator';

type Props = {
  result: SimulationResult | null;
  currentFrame: number;
  onFrameSelect: (frame: number) => void;
};

type BallMetrics = {
  linear: number;
  angular: number;
  spinX: number;
  spinY: number;
  spinZ: number;
};

function signedDirection(value: number, axis: 'X' | 'Y' | 'Z'): string {
  if (Math.abs(value) < 1e-6) {
    return `${axis}:0`;
  }
  return value > 0 ? `${axis}:+` : `${axis}:-`;
}

function signedValue(value: number): string {
  if (!Number.isFinite(value) || Math.abs(value) < 1e-6) {
    return '0.0000';
  }
  return `${value >= 0 ? '+' : ''}${value.toFixed(4)}`;
}

function metricsByBall(frame: SimulationResult['frames'][number]): Record<string, BallMetrics> {
  const map: Record<string, BallMetrics> = {};
  for (const ball of frame.balls) {
    map[ball.id] = {
      linear: Math.hypot(ball.vx, ball.vz),
      angular: Math.hypot(ball.spinX, ball.spinY, ball.spinZ),
      spinX: ball.spinX,
      spinY: ball.spinY,
      spinZ: ball.spinZ,
    };
  }
  return map;
}

export function FrameKinematicsPanel({ result, currentFrame, onFrameSelect }: Props) {
  if (!result) {
    return (
      <div style={{ color: '#475569', fontSize: 12, fontStyle: 'italic' }}>
        Execute를 실행하면 프레임별 선속도/각속도가 표시됩니다.
      </div>
    );
  }

  const safeFrameIndex = Math.max(0, Math.min(currentFrame, result.totalFrames - 1));
  const current = result.frames[safeFrameIndex];
  const currentByBall = metricsByBall(current);
  const rows = result.frames.map((frame, index) => {
    const byBall = metricsByBall(frame);
    const metrics = Object.values(byBall);
    const maxLinear = Math.max(...metrics.map((item) => item.linear), 0);
    const maxAngular = Math.max(...metrics.map((item) => item.angular), 0);
    return {
      index,
      timeSec: index * 0.05,
      maxLinear,
      maxAngular,
    };
  });

  return (
    <div style={{ border: '1px solid #1e293b', borderRadius: 8, padding: 10, background: '#0b1220' }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        프레임별 속도
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
        {[
          ['수구', currentByBall.cueBall],
          ['제1적구', currentByBall.objectBall1],
          ['제2적구', currentByBall.objectBall2],
        ].map(([label, item]) => (
          <div key={label} style={{ border: '1px solid #1e293b', borderRadius: 6, padding: 8, background: '#0f172a' }}>
            <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 5 }}>{label}</div>
            <div style={{ color: '#e2e8f0', fontSize: 11, fontFamily: 'monospace' }}>
              v {item?.linear.toFixed(4) ?? '0.0000'} m/s
            </div>
            <div style={{ color: '#e2e8f0', fontSize: 11, fontFamily: 'monospace' }}>
              w {item?.angular.toFixed(4) ?? '0.0000'} rad/s
            </div>
            <div style={{ color: '#93c5fd', fontSize: 11, fontFamily: 'monospace' }}>
              X {signedValue(item?.spinX ?? 0)} | Y {signedValue(item?.spinY ?? 0)} | Z {signedValue(item?.spinZ ?? 0)}
            </div>
          </div>
        ))}
      </div>

      <div style={{ maxHeight: 210, overflowY: 'auto', border: '1px solid #1e293b', borderRadius: 6 }}>
        {rows.map((row) => (
          <button
            key={row.index}
            onClick={() => onFrameSelect(row.index)}
            style={{
              width: '100%',
              textAlign: 'left',
              display: 'grid',
              gridTemplateColumns: '56px 56px 1fr 1fr',
              gap: 8,
              padding: '5px 8px',
              border: 'none',
              borderBottom: '1px solid #1e293b',
              cursor: 'pointer',
              background: row.index === safeFrameIndex ? '#13233d' : '#0b1220',
              color: '#cbd5e1',
              fontSize: 11,
              fontFamily: 'monospace',
            }}
          >
            <span>#{row.index}</span>
            <span>{row.timeSec.toFixed(2)}s</span>
            <span>v {row.maxLinear.toFixed(4)}</span>
            <span>w {row.maxAngular.toFixed(4)}</span>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        수구 프레임별 회전방향 (X/Y/Z)
      </div>
      <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #1e293b', borderRadius: 6, marginTop: 6 }}>
        {result.frames.map((frame, index) => {
          const cue = frame.balls.find((ball) => ball.id === 'cueBall');
          const spinX = cue?.spinX ?? 0;
          const spinY = cue?.spinY ?? 0;
          const spinZ = cue?.spinZ ?? 0;
          return (
            <button
              key={`cue-spin-${index}`}
              onClick={() => onFrameSelect(index)}
              style={{
                width: '100%',
                textAlign: 'left',
                display: 'grid',
                gridTemplateColumns: '56px 1fr 1fr 1fr',
                gap: 8,
                padding: '5px 8px',
                border: 'none',
                borderBottom: '1px solid #1e293b',
                cursor: 'pointer',
                background: index === safeFrameIndex ? '#13233d' : '#0b1220',
                color: '#cbd5e1',
                fontSize: 11,
                fontFamily: 'monospace',
              }}
            >
              <span>#{index}</span>
              <span>{signedDirection(spinX, 'X')} ({spinX.toFixed(4)})</span>
              <span>{signedDirection(spinY, 'Y')} ({spinY.toFixed(4)})</span>
              <span>{signedDirection(spinZ, 'Z')} ({spinZ.toFixed(4)})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

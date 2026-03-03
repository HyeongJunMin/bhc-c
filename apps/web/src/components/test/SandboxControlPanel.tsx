import { INPUT_LIMITS, PHYSICS } from '../../lib/constants';
import type { SandboxInput } from '../../test-sandbox/types';

type Props = {
  input: SandboxInput;
  onChange: (next: SandboxInput) => void;
};

type FieldProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function NumberSliderField({ label, value, min, max, step, onChange }: FieldProps) {
  const handle = (raw: string) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return;
    }
    onChange(clamp(parsed, min, max));
  };

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{label}</span>
        <span style={{ fontSize: 12, color: '#e2e8f0', fontFamily: 'monospace' }}>{value.toFixed(4)}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 84px', gap: 8, alignItems: 'center' }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => handle(e.target.value)}
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => handle(e.target.value)}
          style={{
            background: '#0f1e35',
            border: '1px solid #334155',
            color: '#f1f5f9',
            borderRadius: 4,
            padding: '4px 6px',
            fontSize: 12,
          }}
        />
      </div>
    </div>
  );
}

export function SandboxControlPanel({ input, onChange }: Props) {
  const patch = (updater: (prev: SandboxInput) => SandboxInput) => {
    onChange(updater(input));
  };

  return (
    <div>
      <div style={{ marginBottom: 14, fontSize: 11, color: '#64748b' }}>공 초기 위치</div>
      <NumberSliderField
        label="수구 X"
        value={input.balls.cueBall.x}
        min={PHYSICS.BALL_RADIUS}
        max={PHYSICS.TABLE_WIDTH - PHYSICS.BALL_RADIUS}
        step={0.001}
        onChange={(value) => patch((prev) => ({ ...prev, balls: { ...prev.balls, cueBall: { ...prev.balls.cueBall, x: value } } }))}
      />
      <NumberSliderField
        label="수구 Z"
        value={input.balls.cueBall.z}
        min={PHYSICS.BALL_RADIUS}
        max={PHYSICS.TABLE_HEIGHT - PHYSICS.BALL_RADIUS}
        step={0.001}
        onChange={(value) => patch((prev) => ({ ...prev, balls: { ...prev.balls, cueBall: { ...prev.balls.cueBall, z: value } } }))}
      />
      <NumberSliderField
        label="제1적구 X"
        value={input.balls.objectBall1.x}
        min={PHYSICS.BALL_RADIUS}
        max={PHYSICS.TABLE_WIDTH - PHYSICS.BALL_RADIUS}
        step={0.001}
        onChange={(value) => patch((prev) => ({ ...prev, balls: { ...prev.balls, objectBall1: { ...prev.balls.objectBall1, x: value } } }))}
      />
      <NumberSliderField
        label="제1적구 Z"
        value={input.balls.objectBall1.z}
        min={PHYSICS.BALL_RADIUS}
        max={PHYSICS.TABLE_HEIGHT - PHYSICS.BALL_RADIUS}
        step={0.001}
        onChange={(value) => patch((prev) => ({ ...prev, balls: { ...prev.balls, objectBall1: { ...prev.balls.objectBall1, z: value } } }))}
      />
      <NumberSliderField
        label="제2적구 X"
        value={input.balls.objectBall2.x}
        min={PHYSICS.BALL_RADIUS}
        max={PHYSICS.TABLE_WIDTH - PHYSICS.BALL_RADIUS}
        step={0.001}
        onChange={(value) => patch((prev) => ({ ...prev, balls: { ...prev.balls, objectBall2: { ...prev.balls.objectBall2, x: value } } }))}
      />
      <NumberSliderField
        label="제2적구 Z"
        value={input.balls.objectBall2.z}
        min={PHYSICS.BALL_RADIUS}
        max={PHYSICS.TABLE_HEIGHT - PHYSICS.BALL_RADIUS}
        step={0.001}
        onChange={(value) => patch((prev) => ({ ...prev, balls: { ...prev.balls, objectBall2: { ...prev.balls.objectBall2, z: value } } }))}
      />

      <div style={{ margin: '18px 0 14px', fontSize: 11, color: '#64748b' }}>샷 파라미터</div>
      <NumberSliderField
        label="방향(deg)"
        value={input.shot.directionDeg}
        min={INPUT_LIMITS.DIRECTION_MIN}
        max={INPUT_LIMITS.DIRECTION_MAX}
        step={1}
        onChange={(value) => patch((prev) => ({ ...prev, shot: { ...prev.shot, directionDeg: value } }))}
      />
      <NumberSliderField
        label="파워(dragPx)"
        value={input.shot.dragPx}
        min={INPUT_LIMITS.DRAG_MIN}
        max={INPUT_LIMITS.DRAG_MAX}
        step={1}
        onChange={(value) => patch((prev) => ({ ...prev, shot: { ...prev.shot, dragPx: value } }))}
      />
      <NumberSliderField
        label="당점 X(m)"
        value={input.shot.impactOffsetX}
        min={-INPUT_LIMITS.OFFSET_MAX}
        max={INPUT_LIMITS.OFFSET_MAX}
        step={0.0005}
        onChange={(value) => patch((prev) => ({ ...prev, shot: { ...prev.shot, impactOffsetX: value } }))}
      />
      <NumberSliderField
        label="당점 Y(m)"
        value={input.shot.impactOffsetY}
        min={-INPUT_LIMITS.OFFSET_MAX}
        max={INPUT_LIMITS.OFFSET_MAX}
        step={0.0005}
        onChange={(value) => patch((prev) => ({ ...prev, shot: { ...prev.shot, impactOffsetY: value } }))}
      />
    </div>
  );
}

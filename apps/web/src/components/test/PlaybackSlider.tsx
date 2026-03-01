type Props = {
  currentFrame: number;
  totalFrames: number;
  onFrameChange: (frame: number) => void;
};

const PHYSICS_DT_SEC = 0.05;

export function PlaybackSlider({ currentFrame, totalFrames, onFrameChange }: Props) {
  if (totalFrames === 0) {
    return null;
  }

  const timeSec = currentFrame * PHYSICS_DT_SEC;

  function stepBy(delta: number) {
    const next = Math.max(0, Math.min(totalFrames - 1, currentFrame + delta));
    onFrameChange(next);
  }

  const buttonStyle: React.CSSProperties = {
    background: '#1e293b',
    border: '1px solid #334155',
    color: '#94a3b8',
    borderRadius: 4,
    width: 32,
    height: 32,
    fontSize: 14,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 16px',
        background: '#0f1e35',
        borderTop: '1px solid #1e293b',
      }}
    >
      {/* Step buttons */}
      <button style={buttonStyle} onClick={() => onFrameChange(0)} title="처음">⏮</button>
      <button style={buttonStyle} onClick={() => stepBy(-1)} title="-1 프레임">⏪</button>

      {/* Slider */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <input
          type="range"
          min={0}
          max={totalFrames - 1}
          value={currentFrame}
          onChange={(e) => onFrameChange(Number(e.target.value))}
          style={{ width: '100%', cursor: 'pointer', accentColor: '#2563eb' }}
        />
      </div>

      <button style={buttonStyle} onClick={() => stepBy(1)} title="+1 프레임">⏩</button>
      <button style={buttonStyle} onClick={() => onFrameChange(totalFrames - 1)} title="끝">⏭</button>

      {/* Frame counter */}
      <div
        style={{
          minWidth: 120,
          textAlign: 'right',
          fontSize: 12,
          color: '#64748b',
          fontFamily: 'monospace',
        }}
      >
        프레임 {currentFrame + 1}/{totalFrames} · t={timeSec.toFixed(3)}s
      </div>
    </div>
  );
}

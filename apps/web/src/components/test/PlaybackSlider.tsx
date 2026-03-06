const styles = {
  container: {
    background: '#1a1a2e',
    border: '1px solid #0f3460',
    borderRadius: '8px',
    padding: '0.75rem 1rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  } as React.CSSProperties,
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  } as React.CSSProperties,
  slider: {
    flex: 1,
    accentColor: '#00d4ff',
  } as React.CSSProperties,
  btn: {
    background: '#0f3460',
    border: 'none',
    color: '#e0e0e0',
    padding: '0.3rem 0.6rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    minWidth: '32px',
  } as React.CSSProperties,
  timeLabel: {
    fontSize: '0.8rem',
    color: '#aaa',
    minWidth: '80px',
    textAlign: 'right' as const,
  } as React.CSSProperties,
  frameLabel: {
    fontSize: '0.75rem',
    color: '#666',
    minWidth: '90px',
  } as React.CSSProperties,
};

type Props = {
  totalFrames: number;
  currentFrame: number;
  dtSec: number;
  onFrameChange: (frame: number) => void;
};

export function PlaybackSlider({ totalFrames, currentFrame, dtSec, onFrameChange }: Props) {
  const timeSec = currentFrame * dtSec;

  return (
    <div style={styles.container}>
      <div style={styles.row}>
        <button style={styles.btn} onClick={() => onFrameChange(0)}>|&lt;</button>
        <button style={styles.btn} onClick={() => onFrameChange(Math.max(0, currentFrame - 1))}>-1</button>
        <input
          type="range"
          min={0}
          max={totalFrames}
          value={currentFrame}
          onChange={(e) => onFrameChange(Number(e.target.value))}
          style={styles.slider}
        />
        <button style={styles.btn} onClick={() => onFrameChange(Math.min(totalFrames, currentFrame + 1))}>+1</button>
        <button style={styles.btn} onClick={() => onFrameChange(totalFrames)}>&gt;|</button>
        <span style={styles.timeLabel}>{timeSec.toFixed(2)}s</span>
      </div>
      <div style={styles.row}>
        <span style={styles.frameLabel}>Frame: {currentFrame} / {totalFrames}</span>
      </div>
    </div>
  );
}

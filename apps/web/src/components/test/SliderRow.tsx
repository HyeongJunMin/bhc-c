const styles = {
  row: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' } as React.CSSProperties,
  label: { color: '#aaa', minWidth: '80px' } as React.CSSProperties,
  slider: { flex: 1, accentColor: '#00d4ff' } as React.CSSProperties,
  numberInput: {
    width: '60px',
    background: 'transparent',
    border: '1px solid #0f3460',
    borderRadius: '3px',
    color: '#00d4ff',
    fontSize: '0.75rem',
    textAlign: 'right' as const,
    padding: '0.1rem 0.2rem',
  } as React.CSSProperties,
};

export function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={styles.row}>
      <span style={styles.label}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={styles.slider}
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
        }}
        style={styles.numberInput}
      />
    </div>
  );
}

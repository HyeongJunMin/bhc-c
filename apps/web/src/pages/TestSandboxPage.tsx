import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { DEFAULT_SANDBOX_INPUT } from '../test-sandbox/presets';
import type { SandboxInput } from '../test-sandbox/types';
import { SandboxControlPanel } from '../components/test/SandboxControlPanel';

export function TestSandboxPage() {
  const navigate = useNavigate();
  const [input, setInput] = useState<SandboxInput>(DEFAULT_SANDBOX_INPUT);

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
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
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
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(320px, 420px) minmax(0, 1fr)' }}>
          <div style={{ border: '1px solid #1e293b', borderRadius: 8, background: '#0f1e35', padding: 14 }}>
            <SandboxControlPanel input={input} onChange={setInput} />
          </div>
          <pre
            style={{
              margin: 0,
              padding: 12,
              borderRadius: 8,
              background: '#0b1220',
              color: '#93c5fd',
              border: '1px solid #1e293b',
              fontSize: 12,
              overflowX: 'auto',
            }}
          >
            {JSON.stringify(input, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

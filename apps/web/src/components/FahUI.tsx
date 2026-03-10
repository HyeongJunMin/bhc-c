import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from 'react';
import { useGameStore } from '../stores/gameStore';
import {
  FAH_PHYSICS_TUNING_STORAGE_KEY,
  readFahPhysicsTuning,
  resolveFahPointCorrection,
} from '../lib/fah-physics-tuning';

type FahUIProps = {
  mode?: 'fah';
};

const FAH_ANCHOR_POINTS = [0, 10, 20, 30, 40, 45] as const;

export function FahUI({ mode = 'fah' }: FahUIProps) {
  const {
    playMode,
    setPlayMode,
    systemMode,
    setSystemMode,
    fahTestTargetPoint,
    setFahTestTargetPoint,
    showBallTrail,
    toggleBallTrail,
    fahTestCorrectionOffset,
    fahTestAutoCorrectionEnabled,
    setFahTestCorrectionOffset,
    setFahTestAutoCorrectionEnabled,
  } = useGameStore();

  const [fahTuningText, setFahTuningText] = useState('');
  const [tuningMessage, setTuningMessage] = useState('');

  const previewProfile = useMemo(
    () => (fahTuningText.trim() ? readFahPhysicsTuning(fahTuningText) : null),
    [fahTuningText],
  );

  const pointCorrectionPreview = useMemo(() => (
    previewProfile ? resolveFahPointCorrection(previewProfile, fahTestTargetPoint) : 0
  ), [previewProfile, fahTestTargetPoint]);

  const setMessage = (message: string): void => {
    setTuningMessage(message);
    if (!message.startsWith('프로필 적용 실패')) {
      setTimeout(() => {
        setTuningMessage((current) => (current === message ? '' : current));
      }, 1800);
    }
  };

  const applyProfile = (raw: string): void => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('JSON 형식이 아닙니다.');
      }
      const candidate = parsed as Record<string, unknown>;
      const looksLikeProfile = (
        'schemaVersion' in candidate ||
        'speedBoost' in candidate ||
        'pointCorrections' in candidate ||
        'overrides' in candidate ||
        'stats' in candidate
      );
      if (!looksLikeProfile) {
        throw new Error('FAH 물리 튜닝 프로필 형태가 아닙니다.');
      }
      const normalized = readFahPhysicsTuning(JSON.stringify(parsed));
      window.localStorage.setItem(FAH_PHYSICS_TUNING_STORAGE_KEY, JSON.stringify(normalized));
      window.dispatchEvent(new Event('bhc:fah-physics-tuning-updated'));
      setFahTuningText(JSON.stringify(normalized, null, 2));
      setMessage('프로필이 적용되었습니다.');
    } catch (error) {
      const reason = error instanceof Error ? error.message : '프로필 적용 실패';
      setMessage(`프로필 적용 실패: ${reason}`);
    }
  };

  const handleProfileFileSelect = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const text = await file.text();
    applyProfile(text);
    event.target.value = '';
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const syncFromStorage = () => {
      setFahTuningText(window.localStorage.getItem(FAH_PHYSICS_TUNING_STORAGE_KEY) ?? '');
    };
    syncFromStorage();
    window.addEventListener('storage', syncFromStorage);
    window.addEventListener('bhc:fah-physics-tuning-updated', syncFromStorage);
    return () => {
      window.removeEventListener('storage', syncFromStorage);
      window.removeEventListener('bhc:fah-physics-tuning-updated', syncFromStorage);
    };
  }, []);

  useEffect(() => {
    if (mode !== 'fah') {
      return;
    }
    if (playMode !== 'fahTest') {
      setPlayMode('fahTest');
    }
    if (systemMode !== 'fiveAndHalf') {
      setSystemMode('fiveAndHalf');
    }
  }, [mode, playMode, setPlayMode, systemMode, setSystemMode]);

  const canSelectPoint = true;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        color: 'white',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          background: 'rgba(0,0,0,0.88)',
          padding: 16,
          borderRadius: 12,
          minWidth: 260,
          border: '1px solid rgba(255,255,255,0.1)',
          pointerEvents: 'auto',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: '#ffd700' }}>
          FAH TEST
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button
            type="button"
            onClick={toggleBallTrail}
            style={{
              border: 'none',
              borderRadius: 6,
              background: showBallTrail ? '#0f9d58' : '#2e2e2e',
              color: '#fff',
              padding: '6px 10px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            수구궤적 {showBallTrail ? 'ON' : 'OFF'}
          </button>
        </div>

        <div style={{ marginBottom: 8, fontSize: 12, opacity: 0.8 }}>
          현재 앵커: <span style={{ color: '#ffd700', fontWeight: 700 }}>{fahTestTargetPoint}</span>
        </div>
        <div style={{ marginBottom: 10, fontSize: 12, opacity: 0.85 }}>
          프로필값: Speed {previewProfile?.speedBoost ?? 2.0}, 보정포인트 수 {Object.keys(previewProfile?.pointCorrections ?? {}).length}, 샘플 {previewProfile?.sampleCount ?? 0}
        </div>
        <div style={{ marginBottom: 10, fontSize: 11, opacity: 0.9, display: 'grid', gap: 6 }}>
          <div>
            자동 보정: {fahTestAutoCorrectionEnabled ? 'ON' : 'OFF'} / 현재 타깃 보정량 {pointCorrectionPreview.toFixed(3)}
            ({fahTestAutoCorrectionEnabled ? '활성' : '비활성'})
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={() => setFahTestAutoCorrectionEnabled(!fahTestAutoCorrectionEnabled)}
              style={{
                border: 'none',
                borderRadius: 8,
                padding: '6px 10px',
                background: fahTestAutoCorrectionEnabled ? '#0f9d58' : '#2e2e2e',
                color: '#fff',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              자동보정 {fahTestAutoCorrectionEnabled ? 'ON' : 'OFF'}
            </button>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              수동오프셋:
              <input
                type="number"
                step="0.1"
                value={fahTestCorrectionOffset}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setFahTestCorrectionOffset(Number.isFinite(next) ? next : 0);
                }}
                style={{
                  width: 64,
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.25)',
                  background: '#1f1f1f',
                  color: '#fff',
                  padding: '4px 6px',
                  fontSize: 11,
                }}
              />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => applyProfile(fahTuningText)}
              style={{
                border: 'none',
                borderRadius: 8,
                background: '#2e74ff',
                color: '#fff',
                padding: '6px 8px',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              텍스트 적용
            </button>
            <label
              style={{
                border: 'none',
                borderRadius: 8,
                background: '#5b21b6',
                color: '#fff',
                padding: '6px 8px',
                fontSize: 11,
                cursor: 'pointer',
                display: 'inline-flex',
                justifyContent: 'center',
                maxWidth: 96,
              }}
            >
              JSON 파일 적용
              <input
                type="file"
                accept="application/json,.json"
                style={{ display: 'none' }}
                onChange={async (event) => {
                  await handleProfileFileSelect(event);
                }}
              />
            </label>
          </div>
          {tuningMessage && (
            <div style={{ color: tuningMessage.startsWith('프로필 적용 실패') ? '#ff8a80' : '#8aff8a', fontSize: 11 }}>
              {tuningMessage}
            </div>
          )}
        </div>

        <textarea
          value={fahTuningText}
          onChange={(event) => setFahTuningText(event.target.value)}
          rows={8}
          spellCheck={false}
          style={{
            width: '100%',
            background: '#0f172a',
            color: '#e2e8f0',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 8,
            fontFamily: 'monospace',
            fontSize: 11,
            padding: 8,
            marginBottom: 8,
            boxSizing: 'border-box',
          }}
          placeholder='{"schemaVersion":"1.0.0","speedBoost":2.11,...}'
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          {FAH_ANCHOR_POINTS.map((point) => (
            <button
              key={point}
              type="button"
              onClick={() => setFahTestTargetPoint(point)}
              disabled={!canSelectPoint}
              style={{
                border: 'none',
                borderRadius: 8,
                padding: '8px 0',
                fontSize: 12,
                fontWeight: 700,
                background: fahTestTargetPoint === point ? '#ffd700' : '#303030',
                color: fahTestTargetPoint === point ? '#000' : '#fff',
                opacity: canSelectPoint ? 1 : 0.5,
                cursor: canSelectPoint ? 'pointer' : 'not-allowed',
              }}
            >
              P{point}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

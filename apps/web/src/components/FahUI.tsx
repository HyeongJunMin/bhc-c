import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { useGameStore } from '../stores/gameStore';
import {
  FAH_PHYSICS_TUNING_STORAGE_KEY,
  type FahPhysicsTuningProfile,
  readFahPhysicsTuning,
} from '../lib/fah-physics-tuning';
import { INPUT_LIMITS, PHYSICS } from '../lib/constants';

const FAH_ANCHOR_POINTS = [0, 10, 20, 30, 40, 45] as const;

type SliderKey =
  | 'speedBoost'
  | 'cushionRestitution'
  | 'cushionContactFriction'
  | 'clothLinearSpinCouplingPerSec'
  | 'spinDampingPerTick'
  | 'linearDampingPerTick'
  | 'cushionPostCollisionSpeedScale'
  | 'cushionSpinMonotonicRetention';

type SliderDef = {
  key: SliderKey;
  label: string;
  min: number;
  max: number;
  step: number;
};

const SLIDER_DEFS: SliderDef[] = [
  { key: 'speedBoost', label: '속도배율', min: 0.4, max: 2.5, step: 0.001 },
  { key: 'cushionRestitution', label: '쿠션반발', min: 0.84, max: 0.95, step: 0.001 },
  { key: 'cushionContactFriction', label: '쿠션마찰', min: 0.03, max: 0.11, step: 0.001 },
  { key: 'clothLinearSpinCouplingPerSec', label: '천-회전결합', min: 0.7, max: 1.8, step: 0.001 },
  { key: 'spinDampingPerTick', label: '회전감쇠', min: 0.975, max: 0.997, step: 0.0001 },
  { key: 'linearDampingPerTick', label: '직진감쇠', min: 0.975, max: 0.995, step: 0.0001 },
  { key: 'cushionPostCollisionSpeedScale', label: '충돌후속도', min: 0.985, max: 1.02, step: 0.0005 },
  { key: 'cushionSpinMonotonicRetention', label: '쿠션회전유지', min: 0.84, max: 1.0, step: 0.001 },
];

function getProfileSliderValue(profile: FahPhysicsTuningProfile, key: SliderKey): number {
  if (key === 'speedBoost') {
    return profile.speedBoost;
  }
  const value = (profile.overrides as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function FahUI() {
  const {
    fahTestTargetPoint,
    setFahTestTargetPoint,
    showBallTrail,
    toggleBallTrail,
    shotInput,
    setDragPower,
    setImpactOffset,
    requestFahTestShot,
  } = useGameStore();

  const [fahTuningText, setFahTuningText] = useState('');
  const [tuningMessage, setTuningMessage] = useState('');
  const [liveProfile, setLiveProfile] = useState<FahPhysicsTuningProfile>(() => readFahPhysicsTuning(null));
  const tipPadRef = useRef<HTMLDivElement | null>(null);
  const [isTipDragging, setIsTipDragging] = useState(false);

  const previewProfile = useMemo(
    () => (fahTuningText.trim() ? readFahPhysicsTuning(fahTuningText) : null),
    [fahTuningText],
  );

  const profileForPreview = previewProfile ?? liveProfile;
  const offsetDistance = Math.sqrt(
    shotInput.impactOffsetX ** 2 + shotInput.impactOffsetY ** 2,
  );
  const offsetPercent = Math.round((offsetDistance / PHYSICS.BALL_RADIUS) * 100);
  const isMiscueRisk = offsetPercent > 85;

  const emitLiveProfile = (profile: FahPhysicsTuningProfile): void => {
    if (typeof window === 'undefined') {
      return;
    }
    window.dispatchEvent(new CustomEvent('bhc:fah-physics-tuning-live', { detail: { profile } }));
  };

  const updateLiveValue = (key: SliderKey, value: number): void => {
    setLiveProfile((prev) => {
      const next: FahPhysicsTuningProfile = {
        ...prev,
        overrides: { ...prev.overrides },
      };
      if (key === 'speedBoost') {
        next.speedBoost = value;
      } else {
        const mutableOverrides = next.overrides as Record<string, unknown>;
        mutableOverrides[key] = value;
        next.overrides = {
          ...mutableOverrides,
        };
      }
      const normalized = readFahPhysicsTuning(JSON.stringify(next));
      emitLiveProfile(normalized);
      return normalized;
    });
  };

  const updateImpactFromClientPoint = (clientX: number, clientY: number): void => {
    const pad = tipPadRef.current;
    if (!pad) {
      return;
    }
    const rect = pad.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radiusPx = rect.width / 2;
    if (radiusPx <= 0) {
      return;
    }

    let ratioX = (clientX - centerX) / radiusPx;
    let ratioY = (centerY - clientY) / radiusPx;
    const len = Math.hypot(ratioX, ratioY);
    if (len > 1) {
      ratioX /= len;
      ratioY /= len;
    }
    setImpactOffset(ratioX * INPUT_LIMITS.OFFSET_MAX, ratioY * INPUT_LIMITS.OFFSET_MAX);
  };

  useEffect(() => {
    if (!isTipDragging) {
      return;
    }
    const onMove = (event: MouseEvent) => {
      updateImpactFromClientPoint(event.clientX, event.clientY);
    };
    const onUp = () => {
      setIsTipDragging(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isTipDragging]);

  const saveLiveProfile = (): void => {
    if (typeof window === 'undefined') {
      return;
    }
    const normalized = readFahPhysicsTuning(JSON.stringify(liveProfile));
    window.localStorage.setItem(FAH_PHYSICS_TUNING_STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new Event('bhc:fah-physics-tuning-updated'));
    setFahTuningText(JSON.stringify(normalized, null, 2));
    setMessage('저장 완료: 이후 기본값으로 사용됩니다.');
  };

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
        'overrides' in candidate ||
        'stats' in candidate
      );
      if (!looksLikeProfile) {
        throw new Error('FAH 물리 튜닝 프로필 형태가 아닙니다.');
      }
      const normalized = readFahPhysicsTuning(JSON.stringify(parsed));
      window.localStorage.setItem(FAH_PHYSICS_TUNING_STORAGE_KEY, JSON.stringify(normalized));
      window.dispatchEvent(new Event('bhc:fah-physics-tuning-updated'));
      emitLiveProfile(normalized);
      setLiveProfile(normalized);
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
      const raw = window.localStorage.getItem(FAH_PHYSICS_TUNING_STORAGE_KEY);
      setFahTuningText(raw ?? '');
      const profile = readFahPhysicsTuning(raw);
      setLiveProfile(profile);
      emitLiveProfile(profile);
    };
    syncFromStorage();
    window.addEventListener('storage', syncFromStorage);
    window.addEventListener('bhc:fah-physics-tuning-updated', syncFromStorage);
    return () => {
      window.removeEventListener('storage', syncFromStorage);
      window.removeEventListener('bhc:fah-physics-tuning-updated', syncFromStorage);
    };
  }, []);

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
          <button
            type="button"
            onClick={() => requestFahTestShot(fahTestTargetPoint)}
            style={{
              border: 'none',
              borderRadius: 6,
              background: '#2e74ff',
              color: '#fff',
              padding: '6px 10px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            샷 실행
          </button>
        </div>

        <div style={{ marginBottom: 10, padding: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.03)' }}>
          <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 6 }}>FAH 샷 입력 (게임모드와 별도)</div>
          <label style={{ display: 'grid', gap: 2, marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span>힘(큐 속도)</span>
              <span>{shotInput.dragPx.toFixed(1)} px</span>
            </div>
            <input
              type="range"
              min={INPUT_LIMITS.DRAG_MIN}
              max={INPUT_LIMITS.DRAG_MAX}
              step={1}
              value={shotInput.dragPx}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (!Number.isFinite(next)) {
                  return;
                }
                setDragPower(next);
              }}
              style={{ width: '100%' }}
            />
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              ref={tipPadRef}
              onMouseDown={(event) => {
                setIsTipDragging(true);
                updateImpactFromClientPoint(event.clientX, event.clientY);
              }}
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.08)',
                border: `2px solid ${isMiscueRisk ? '#ff4444' : '#fff'}`,
                position: 'relative',
                cursor: 'crosshair',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: 2,
                  height: 2,
                  background: '#fff',
                  transform: 'translate(-50%, -50%)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: `${50 - (shotInput.impactOffsetY / PHYSICS.BALL_RADIUS) * 45}%`,
                  left: `${50 + (shotInput.impactOffsetX / PHYSICS.BALL_RADIUS) * 45}%`,
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: isMiscueRisk ? '#ff4444' : '#ff3333',
                  transform: 'translate(-50%, -50%)',
                  boxShadow: '0 0 6px rgba(255,0,0,0.5)',
                }}
              />
              <div style={{ position: 'absolute', left: '33%', top: 2, bottom: 2, width: 1, background: 'rgba(255,255,255,0.25)' }} />
              <div style={{ position: 'absolute', left: '66%', top: 2, bottom: 2, width: 1, background: 'rgba(255,255,255,0.25)' }} />
              <div style={{ position: 'absolute', top: '33%', left: 2, right: 2, height: 1, background: 'rgba(255,255,255,0.25)' }} />
              <div style={{ position: 'absolute', top: '66%', left: 2, right: 2, height: 1, background: 'rgba(255,255,255,0.25)' }} />
            </div>
            <div style={{ fontSize: 11, lineHeight: 1.4, opacity: 0.92 }}>
              <div>당점: {offsetPercent}% {isMiscueRisk ? '(미스큐 위험)' : ''}</div>
              <div>X: {shotInput.impactOffsetX.toFixed(4)}</div>
              <div>Y: {shotInput.impactOffsetY.toFixed(4)}</div>
              <button
                type="button"
                onClick={() => setImpactOffset(0, 0)}
                style={{
                  marginTop: 4,
                  border: 'none',
                  borderRadius: 6,
                  background: '#3a3a3a',
                  color: '#fff',
                  padding: '4px 8px',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                당점 중앙
              </button>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 8, fontSize: 12, opacity: 0.8 }}>
          현재 앵커: <span style={{ color: '#ffd700', fontWeight: 700 }}>{fahTestTargetPoint}</span>
        </div>
        <div style={{ marginBottom: 10, fontSize: 12, opacity: 0.85 }}>
          프로필값: Speed {profileForPreview.speedBoost}, 샘플 {profileForPreview.sampleCount ?? 0}
        </div>
        <div style={{ marginBottom: 10, fontSize: 11, opacity: 0.9, display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={saveLiveProfile}
              style={{
                border: 'none',
                borderRadius: 8,
                background: '#0f9d58',
                color: '#fff',
                padding: '6px 8px',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              저장
            </button>
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

        <div style={{ marginBottom: 10, padding: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.03)' }}>
          <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 6 }}>실시간 게이지 (즉시 반영)</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {SLIDER_DEFS.map((def) => {
              const value = getProfileSliderValue(liveProfile, def.key);
              return (
                <label key={def.key} style={{ display: 'grid', gap: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span>{def.label}</span>
                    <span style={{ opacity: 0.9 }}>{value.toFixed(def.step < 0.001 ? 4 : 3)}</span>
                  </div>
                  <input
                    type="range"
                    min={def.min}
                    max={def.max}
                    step={def.step}
                    value={value}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (!Number.isFinite(next)) {
                        return;
                      }
                      updateLiveValue(def.key, next);
                    }}
                    style={{ width: '100%' }}
                  />
                </label>
              );
            })}
          </div>
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

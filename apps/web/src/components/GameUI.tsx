import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { INPUT_LIMITS, PHYSICS, RULES } from '../lib/constants';
import {
  calibrateFiveAndHalf,
  predictFiveAndHalf,
  simulateFiveAndHalf,
  worldToTablePoint,
} from '../lib/five-and-half-api';
import {
  FAH_HISTORY_STORAGE_KEY,
  recommendPreviewOffset,
  safeParseHistory,
  summarizeFahHistory,
  toFahHistoryCsv,
  type FahHistoryEntry,
} from '../lib/five-and-half-history';
import {
  FAH_PHYSICS_TUNING_STORAGE_KEY,
  deriveFahPhysicsTuning,
  readFahPhysicsTuning,
  resolveFahPointCorrection,
} from '../lib/fah-physics-tuning';

const FAH_CALIBRATION_STORAGE_KEY = 'bhc.fah.calibration.v1';

type FahCalibrationEntry = {
  id: string;
  createdAt: string;
  targetPoint: number;
  correctedTargetPoint?: number;
  startIndex: number;
  expectedSecondIndex?: number;
  expectedThirdIndex: number;
  startSide?: 'left' | 'right';
  firstCushionSide?: 'left' | 'right';
  secondCushionSide?: 'left' | 'right';
  thirdCushionSide?: 'left' | 'right';
  fourthCushionSide?: 'left' | 'right';
  observedFirstCushionIndex: number | null;
  observedSecondCushionIndex?: number | null;
  observedThirdCushionIndex?: number | null;
  observedFourthCushionIndex?: number | null;
  firstCushionIndexDelta: number | null;
  secondCushionIndexDelta?: number | null;
  thirdCushionIndexDelta?: number | null;
  fourthCushionIndexDelta?: number | null;
  shotDirectionDeg: number;
  physicsTuning?: {
    speedBoost?: number;
    overrides?: Record<string, unknown>;
  };
  dynamicPhysics?: {
    targetIndex?: number;
    grazingFactor?: number;
    cornerFactor?: number;
    overrides?: Record<string, unknown>;
  };
};

type GameUIMode = 'game' | 'fah';

type GameUIProps = {
  mode?: GameUIMode;
};

export function GameUI({ mode = 'game' }: GameUIProps) {
  const TURN_DURATION_MS = 20_000;
  const gameStore = useGameStore();
  const { 
    playMode,
    setPlayMode,
    requestFahTestShot,
    fahTestTargetPoint,
    fahTestCorrectionOffset,
    setFahTestCorrectionOffset,
    fahTestAutoCorrectionEnabled,
    setFahTestAutoCorrectionEnabled,
    phase, 
    shotInput, 
    isDragging,
    systemMode,
    setSystemMode,
    setFahGuide,
    currentPlayer, 
    activeCueBallId,
    scores, 
    turnMessage,
    turnStartedAtMs,
    cushionContacts,
    objectBallsHit,
    resetGame,
  } = gameStore;
  const showFahPanel = mode === 'fah';
  const enableFahDiagnostics = false;
  const [turnRemainMs, setTurnRemainMs] = useState(TURN_DURATION_MS);
  const [fahLoading, setFahLoading] = useState(false);
  const [fahError, setFahError] = useState('');
  const [fahPredict, setFahPredict] = useState<Record<string, unknown> | null>(null);
  const [fahSimulate, setFahSimulate] = useState<Record<string, unknown> | null>(null);
  const [fahCalibrate, setFahCalibrate] = useState<Record<string, unknown> | null>(null);
  const [fahHistory, setFahHistory] = useState<FahHistoryEntry[]>([]);
  const [fahCalibrationEntries, setFahCalibrationEntries] = useState<FahCalibrationEntry[]>([]);
  const [fahPhysicsTuning, setFahPhysicsTuning] = useState(() => readFahPhysicsTuning(null));
  const [fahPreviewEnabled, setFahPreviewEnabled] = useState(false);
  const [fahPreviewOffset, setFahPreviewOffset] = useState(0);
  const [fahAutoTrackEnabled, setFahAutoTrackEnabled] = useState(true);
  const [fahRepeatRemaining, setFahRepeatRemaining] = useState(0);
  const fahAutoTrackShotKeyRef = useRef('');
  const fahRepeatDispatchLockRef = useRef(false);
  
  // 파워 계산
  const powerPercent = Math.round(
    ((shotInput.dragPx - INPUT_LIMITS.DRAG_MIN) / 
     (INPUT_LIMITS.DRAG_MAX - INPUT_LIMITS.DRAG_MIN)) * 100
  );
  
  // 속도 계산
  const speed = (
    PHYSICS.MIN_SPEED_MPS + 
    (powerPercent / 100) * (PHYSICS.MAX_SPEED_MPS - PHYSICS.MIN_SPEED_MPS)
  ).toFixed(1);
  
  // 당점 거리 계산
  const offsetDistance = Math.sqrt(
    shotInput.impactOffsetX ** 2 + shotInput.impactOffsetY ** 2
  );
  const offsetPercent = Math.round((offsetDistance / PHYSICS.BALL_RADIUS) * 100);
  const isMiscueRisk = offsetPercent > 85;
  const overlapRows = useMemo(() => {
    const cueBall = gameStore.balls.find((ball) => ball.id === activeCueBallId);
    const objectBalls = gameStore.balls.filter((ball) => ball.id !== activeCueBallId);
    if (!cueBall) return [];

    const dirRad = (shotInput.shotDirectionDeg * Math.PI) / 180;
    const dirX = Math.sin(dirRad);
    const dirZ = Math.cos(dirRad);
    const diameter = PHYSICS.BALL_RADIUS * 2;

    return objectBalls.map((ball) => {
      const relX = ball.position.x - cueBall.position.x;
      const relZ = ball.position.z - cueBall.position.z;
      const along = relX * dirX + relZ * dirZ;
      const signedPerp = relX * dirZ - relZ * dirX;
      const perp = Math.abs(signedPerp);
      const overlap = along <= 0 ? 0 : Math.max(0, Math.min(1, (diameter - perp) / diameter));
      return {
        id: ball.id,
        overlap,
        hittable: along > 0 && perp <= diameter,
        signedPerp,
      };
    });
  }, [gameStore.balls, shotInput.shotDirectionDeg, activeCueBallId]);

  const ballColorMap: Record<string, string> = {
    cueBall: '#ffffff',
    objectBall1: '#ff3b30',
    objectBall2: '#ffd60a',
  };
  const overlappingRows = overlapRows.filter((row) => row.hittable && row.overlap > 0);
  const overlayBallSize = 34;
  const overlayTrackWidth = 112;
  const cueBall = gameStore.balls.find((ball) => ball.id === 'cueBall');
  const objectBall1 = gameStore.balls.find((ball) => ball.id === 'objectBall1');
  const objectBall2 = gameStore.balls.find((ball) => ball.id === 'objectBall2');
  const isMissTurnOver = turnMessage.trim().toUpperCase().includes('MISS - TURN OVER');
  const isScoreTurnMessage = turnMessage.trim().toUpperCase().includes('SCORE');
  const isCompactTurnMessage = isMissTurnOver || isScoreTurnMessage;
  const cueBallForApi = gameStore.balls.find((ball) => ball.id === activeCueBallId);
  const objectBall1ForApi = gameStore.balls.find((ball) => ball.id === 'objectBall1');
  const secondTargetIdForApi = activeCueBallId === 'cueBall' ? 'objectBall2' : 'cueBall';
  const objectBall2ForApi = gameStore.balls.find((ball) => ball.id === secondTargetIdForApi);
  const fahSummary = useMemo(() => summarizeFahHistory(fahHistory), [fahHistory]);
  const fahRecommendation = useMemo(() => recommendPreviewOffset(fahHistory), [fahHistory]);
  const fahAnchorTargets = [0, 5, 8, 10, 20, 23, 30, 40, 45];
  const tenPointCalibrationStats = useMemo(() => {
    const source = fahCalibrationEntries
      .filter((entry) => entry.targetPoint === 10 && typeof entry.firstCushionIndexDelta === 'number')
      .slice(-10);
    if (source.length === 0) {
      return {
        sampleCount: 0,
        avgDelta: 0,
        avgAbsDelta: 0,
        maxAbsDelta: 0,
        recommendedOffset: 0,
      };
    }
    const cushionWeights = [1, 0.9, 0.75, 0.6];
    const perSample = source
      .map((entry) => {
        const deltas = [
          { value: entry.firstCushionIndexDelta, weight: cushionWeights[0] },
          { value: entry.secondCushionIndexDelta, weight: cushionWeights[1] },
          { value: entry.thirdCushionIndexDelta, weight: cushionWeights[2] },
          { value: entry.fourthCushionIndexDelta, weight: cushionWeights[3] },
        ];
        let weightSum = 0;
        let weightedDelta = 0;
        let weightedAbs = 0;
        for (const item of deltas) {
          if (typeof item.value !== 'number') {
            continue;
          }
          weightSum += item.weight;
          weightedDelta += item.value * item.weight;
          weightedAbs += Math.abs(item.value) * item.weight;
        }
        if (weightSum <= 0) {
          return null;
        }
        return {
          weightedDelta: weightedDelta / weightSum,
          weightedAbsDelta: weightedAbs / weightSum,
        };
      })
      .filter((item): item is { weightedDelta: number; weightedAbsDelta: number } => item !== null);
    if (perSample.length === 0) {
      return {
        sampleCount: 0,
        avgDelta: 0,
        avgAbsDelta: 0,
        maxAbsDelta: 0,
        recommendedOffset: 0,
      };
    }
    const avgDelta = perSample.reduce((acc, item) => acc + item.weightedDelta, 0) / perSample.length;
    const avgAbsDelta = perSample.reduce((acc, item) => acc + item.weightedAbsDelta, 0) / perSample.length;
    const maxAbsDelta = Math.max(...perSample.map((item) => item.weightedAbsDelta));
    return {
      sampleCount: perSample.length,
      avgDelta: Math.round(avgDelta * 1000) / 1000,
      avgAbsDelta: Math.round(avgAbsDelta * 1000) / 1000,
      maxAbsDelta: Math.round(maxAbsDelta * 1000) / 1000,
      recommendedOffset: Math.round(-avgDelta * 1000) / 1000,
    };
  }, [fahCalibrationEntries]);
  const targetPointCalibrationOffset = useMemo(() => {
    if (playMode !== 'fahTest') {
      return 0;
    }
    return resolveFahPointCorrection(fahPhysicsTuning, fahTestTargetPoint);
  }, [playMode, fahPhysicsTuning, fahTestTargetPoint]);
  const latestFahCalibration = useMemo(
    () => (fahCalibrationEntries.length === 0 ? null : fahCalibrationEntries[fahCalibrationEntries.length - 1]),
    [fahCalibrationEntries],
  );

  useEffect(() => {
    if (mode === 'fah') {
      if (playMode !== 'fahTest') {
        setPlayMode('fahTest');
      }
      if (systemMode !== 'fiveAndHalf') {
        setSystemMode('fiveAndHalf');
      }
      return;
    }

    if (playMode !== 'game') {
      setPlayMode('game');
    }
    if (systemMode === 'fiveAndHalf') {
      setSystemMode('half');
      setFahGuide(null);
    }
  }, [mode, playMode, setPlayMode, systemMode, setSystemMode, setFahGuide]);

  const startTenPointRepeat = () => {
    fahRepeatDispatchLockRef.current = false;
    setFahRepeatRemaining(10);
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const parsed = safeParseHistory(window.localStorage.getItem(FAH_HISTORY_STORAGE_KEY));
    setFahHistory(parsed);
    setFahPhysicsTuning(readFahPhysicsTuning(window.localStorage.getItem(FAH_PHYSICS_TUNING_STORAGE_KEY)));
    try {
      const raw = window.localStorage.getItem(FAH_CALIBRATION_STORAGE_KEY);
      const parsedCalibration = raw ? (JSON.parse(raw) as unknown) : [];
      setFahCalibrationEntries(Array.isArray(parsedCalibration) ? (parsedCalibration as FahCalibrationEntry[]) : []);
    } catch {
      setFahCalibrationEntries([]);
    }
  }, []);

  useEffect(() => {
    const syncCalibration = () => {
      if (typeof window === 'undefined') {
        return;
      }
      try {
        const raw = window.localStorage.getItem(FAH_CALIBRATION_STORAGE_KEY);
        const parsedCalibration = raw ? (JSON.parse(raw) as unknown) : [];
        setFahCalibrationEntries(Array.isArray(parsedCalibration) ? (parsedCalibration as FahCalibrationEntry[]) : []);
      } catch {
        setFahCalibrationEntries([]);
      }
      setFahPhysicsTuning(readFahPhysicsTuning(window.localStorage.getItem(FAH_PHYSICS_TUNING_STORAGE_KEY)));
    };
    window.addEventListener('bhc:fah-calibration-updated', syncCalibration);
    window.addEventListener('bhc:fah-physics-tuning-updated', syncCalibration);
    window.addEventListener('storage', syncCalibration);
    return () => {
      window.removeEventListener('bhc:fah-calibration-updated', syncCalibration);
      window.removeEventListener('bhc:fah-physics-tuning-updated', syncCalibration);
      window.removeEventListener('storage', syncCalibration);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(FAH_HISTORY_STORAGE_KEY, JSON.stringify(fahHistory.slice(-100)));
  }, [fahHistory]);

  useEffect(() => {
    if (!fahPredict) {
      return;
    }
    const correctedAim = Number(fahPredict.correctedAim ?? 0);
    const expectedThirdCushion = Number(fahPredict.expectedThirdCushion ?? 0);
    if (!Number.isFinite(correctedAim) || !Number.isFinite(expectedThirdCushion)) {
      return;
    }
    const previewedAim = fahPreviewEnabled ? correctedAim + fahPreviewOffset : correctedAim;
    setFahGuide({
      correctedAim: previewedAim,
      expectedThirdCushion,
      indexScale: 100,
    });
  }, [fahPredict, fahPreviewEnabled, fahPreviewOffset, setFahGuide]);

  useEffect(() => {
    const update = () => {
      if (phase !== 'AIMING') {
        setTurnRemainMs(TURN_DURATION_MS);
        return;
      }
      setTurnRemainMs(Math.max(0, TURN_DURATION_MS - (Date.now() - turnStartedAtMs)));
    };
    update();
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [phase, turnStartedAtMs]);

  useEffect(() => {
    if (
      playMode !== 'fahTest' ||
      phase !== 'AIMING' ||
      fahRepeatRemaining <= 0 ||
      fahLoading ||
      fahRepeatDispatchLockRef.current
    ) {
      return;
    }
    fahRepeatDispatchLockRef.current = true;
    requestFahTestShot(10);
    setFahRepeatRemaining((prev) => Math.max(0, prev - 1));
  }, [playMode, phase, fahRepeatRemaining, fahLoading, requestFahTestShot]);

  useEffect(() => {
    if (phase !== 'AIMING') {
      fahRepeatDispatchLockRef.current = false;
    }
  }, [phase]);

  useEffect(() => {
    if (fahTestAutoCorrectionEnabled) {
      const recommended = targetPointCalibrationOffset;
      const fallback = tenPointCalibrationStats.recommendedOffset;
      const bounded = Math.max(-20, Math.min(20, Number.isFinite(recommended) ? recommended : fallback));
      setFahTestCorrectionOffset(Number.isFinite(bounded) ? bounded : 0);
    }
  }, [
    fahTestAutoCorrectionEnabled,
    targetPointCalibrationOffset,
    tenPointCalibrationStats.recommendedOffset,
    setFahTestCorrectionOffset,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined' || playMode !== 'fahTest') {
      return;
    }
    const recommendation = deriveFahPhysicsTuning(fahCalibrationEntries);
    if (recommendation.sampleCount < 8) {
      return;
    }
    const prev = readFahPhysicsTuning(window.localStorage.getItem(FAH_PHYSICS_TUNING_STORAGE_KEY));
    if (
      Math.abs(prev.speedBoost - recommendation.speedBoost) < 0.001 &&
      Math.abs((prev.stats.meanDelta ?? 0) - recommendation.stats.meanDelta) < 0.001 &&
      Math.abs((prev.stats.meanAbsDelta ?? 0) - recommendation.stats.meanAbsDelta) < 0.001
    ) {
      return;
    }
    window.localStorage.setItem(FAH_PHYSICS_TUNING_STORAGE_KEY, JSON.stringify(recommendation));
    window.dispatchEvent(new Event('bhc:fah-physics-tuning-updated'));
    setFahPhysicsTuning(recommendation);
  }, [fahCalibrationEntries, playMode]);

  const requestFiveAndHalfPredictAndSimulate = async () => {
    if (!cueBallForApi) {
      setFahError('공 좌표를 찾을 수 없습니다.');
      return;
    }
    setFahLoading(true);
    setFahError('');
    setFahCalibrate(null);
    try {
      const cuePoint = worldToTablePoint(cueBallForApi.position);
      const directionRad = (shotInput.shotDirectionDeg * Math.PI) / 180;
      const fallbackObj1 = {
        x: cuePoint.x + Math.sin(directionRad) * 0.7,
        y: cuePoint.y + Math.cos(directionRad) * 0.35,
      };
      const fallbackObj2 = {
        x: cuePoint.x + Math.sin(directionRad + Math.PI / 3) * 0.9,
        y: cuePoint.y + Math.cos(directionRad + Math.PI / 3) * 0.45,
      };
      const obj1Point = objectBall1ForApi ? worldToTablePoint(objectBall1ForApi.position) : fallbackObj1;
      const obj2Point = objectBall2ForApi ? worldToTablePoint(objectBall2ForApi.position) : fallbackObj2;
      const speedBand = shotInput.dragPx >= 280 ? 'high' : shotInput.dragPx >= 140 ? 'mid' : 'low';
      const spinMagnitude = Math.hypot(shotInput.impactOffsetX, shotInput.impactOffsetY);
      const spinBand =
        spinMagnitude >= PHYSICS.BALL_RADIUS * 0.65 ? 'strong' : spinMagnitude >= PHYSICS.BALL_RADIUS * 0.2 ? 'light' : 'none';
      const angleBand = shotInput.cueElevationDeg >= 60 ? 'steep' : shotInput.cueElevationDeg <= 15 ? 'shallow' : 'mid';

      const predictResponse = await predictFiveAndHalf({
        tableProfile: {
          id: 'local-match-table',
          widthM: PHYSICS.TABLE_WIDTH,
          heightM: PHYSICS.TABLE_HEIGHT,
          indexScale: 100,
          condition: 'normal',
        },
        layout: {
          cueBall: cuePoint,
          objectBall1: obj1Point,
          objectBall2: obj2Point,
        },
        intent: {
          routeType: 'five_and_half',
          targetThirdRail: 'long',
        },
        shotHint: {
          speedBand,
          spinBand,
          angleBand,
        },
      });
      setFahPredict(predictResponse.payload);
      const correctedAim = Number(predictResponse.payload.correctedAim ?? 0);
      const expectedThirdCushion = Number(predictResponse.payload.expectedThirdCushion ?? 0);
      if (Number.isFinite(correctedAim) && Number.isFinite(expectedThirdCushion)) {
        const previewedAim = fahPreviewEnabled ? correctedAim + fahPreviewOffset : correctedAim;
        setFahGuide({
          correctedAim: previewedAim,
          expectedThirdCushion,
          indexScale: 100,
        });
      }
      setSystemMode('fiveAndHalf');

      const simulateResponse = await simulateFiveAndHalf({
        predict: predictResponse.payload,
        shotInput: {
          schemaName: 'shot_input',
          schemaVersion: '1.0.0',
          roomId: 'local-room',
          matchId: 'local-match',
          turnId: `turn-${Date.now()}`,
          playerId: currentPlayer,
          clientTsMs: Date.now(),
          shotDirectionDeg: shotInput.shotDirectionDeg,
          cueElevationDeg: shotInput.cueElevationDeg,
          dragPx: shotInput.dragPx,
          impactOffsetX: shotInput.impactOffsetX,
          impactOffsetY: shotInput.impactOffsetY,
          inputSeq: 1,
        },
        physicsProfile: {
          clothFriction: PHYSICS.SLIDING_FRICTION,
          cushionRestitution: PHYSICS.BALL_CUSHION_RESTITUTION,
          spinDecay: 0.12,
        },
      });
      setFahSimulate(simulateResponse.payload);
      const correctedAimNum = Number(predictResponse.payload.correctedAim ?? 0);
      const expectedThirdNum = Number(predictResponse.payload.expectedThirdCushion ?? 0);
      const confidenceNum = Number(predictResponse.payload.confidence ?? 0);
      const metrics = simulateResponse.payload.errorMetrics as Record<string, unknown> | undefined;
      const indexDeltaNum = Number(metrics?.thirdCushionIndexDelta ?? 0);
      const landingDistanceNum = Number(metrics?.landingDistanceM ?? 0);
      const nextEntry: FahHistoryEntry = {
        id: `fah-${Date.now()}`,
        createdAt: new Date().toISOString(),
        playerId: currentPlayer,
        systemMode: 'fiveAndHalf',
        correctedAim: Number.isFinite(correctedAimNum) ? correctedAimNum : 0,
        expectedThirdCushion: Number.isFinite(expectedThirdNum) ? expectedThirdNum : 0,
        confidence: Number.isFinite(confidenceNum) ? confidenceNum : 0,
        thirdCushionIndexDelta: Number.isFinite(indexDeltaNum) ? indexDeltaNum : 0,
        landingDistanceM: Number.isFinite(landingDistanceNum) ? landingDistanceNum : 0,
        calibrationOffset: null,
        sampleCount: null,
      };
      setFahHistory((prev) => [...prev.slice(-99), nextEntry]);
    } catch (error) {
      setFahError(error instanceof Error ? error.message : '파이브앤하프 API 호출 실패');
    } finally {
      setFahLoading(false);
    }
  };

  const requestFiveAndHalfCalibrate = async () => {
    if (!fahPredict || !fahSimulate) {
      setFahError('먼저 예측/시뮬레이션을 실행하세요.');
      return;
    }
    setFahLoading(true);
    setFahError('');
    try {
      const calibrateResponse = await calibrateFiveAndHalf({
        profileId: `local-${currentPlayer}`,
        strategy: 'ema',
        samples: [
          {
            predict: fahPredict,
            simulate: fahSimulate,
            success: true,
          },
        ],
      });
      setFahCalibrate(calibrateResponse.payload);
      const updatedProfile = calibrateResponse.payload.updatedProfile as Record<string, unknown> | undefined;
      const appliedSampleCountNum = Number(calibrateResponse.payload.appliedSampleCount ?? 0);
      const correctionOffsetNum = Number(updatedProfile?.correctionOffset ?? 0);
      setFahHistory((prev) => {
        if (prev.length === 0) {
          return prev;
        }
        const next = [...prev];
        const lastIndex = next.length - 1;
        next[lastIndex] = {
          ...next[lastIndex],
          calibrationOffset: Number.isFinite(correctionOffsetNum) ? correctionOffsetNum : 0,
          sampleCount: Number.isFinite(appliedSampleCountNum) ? appliedSampleCountNum : 0,
        };
        return next;
      });
    } catch (error) {
      setFahError(error instanceof Error ? error.message : '파이브앤하프 보정 API 호출 실패');
    } finally {
      setFahLoading(false);
    }
  };

  const exportFahHistory = () => {
    if (typeof window === 'undefined' || fahHistory.length === 0) {
      return;
    }
    const csv = toFahHistoryCsv(fahHistory);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fah-history-${new Date().toISOString().split(':').join('-')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportFahCalibrationJson = () => {
    if (typeof window === 'undefined' || fahCalibrationEntries.length === 0) {
      return;
    }
    const payload = {
      schema: 'bhc_fah_calibration',
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      sampleCount: fahCalibrationEntries.length,
      samples: fahCalibrationEntries,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fah-calibration.json';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const clearFahHistory = () => {
    setFahHistory([]);
  };

  const refreshFahPreviewRecommendation = () => {
    setFahPreviewOffset(fahRecommendation.offset);
  };

  const runFahBatchSampling = async () => {
    if (!cueBallForApi || !objectBall1ForApi || !objectBall2ForApi) {
      setFahError('공 좌표를 찾을 수 없습니다.');
      return;
    }
    setFahLoading(true);
    setFahError('');
    const variants = [
      { dragPx: shotInput.dragPx, directionDeg: shotInput.shotDirectionDeg, impactX: shotInput.impactOffsetX, impactY: shotInput.impactOffsetY },
      { dragPx: Math.min(INPUT_LIMITS.DRAG_MAX, shotInput.dragPx + 25), directionDeg: shotInput.shotDirectionDeg + 4, impactX: shotInput.impactOffsetX * 0.85, impactY: shotInput.impactOffsetY },
      { dragPx: Math.max(INPUT_LIMITS.DRAG_MIN, shotInput.dragPx - 20), directionDeg: shotInput.shotDirectionDeg - 5, impactX: shotInput.impactOffsetX, impactY: shotInput.impactOffsetY * 0.85 },
    ];

    try {
      for (const [index, variant] of variants.entries()) {
        const cuePoint = worldToTablePoint(cueBallForApi.position);
        const obj1Point = worldToTablePoint(objectBall1ForApi.position);
        const obj2Point = worldToTablePoint(objectBall2ForApi.position);
        const speedBand = variant.dragPx >= 280 ? 'high' : variant.dragPx >= 140 ? 'mid' : 'low';
        const spinMagnitude = Math.hypot(variant.impactX, variant.impactY);
        const spinBand = spinMagnitude >= PHYSICS.BALL_RADIUS * 0.65 ? 'strong' : spinMagnitude >= PHYSICS.BALL_RADIUS * 0.2 ? 'light' : 'none';

        const predictResponse = await predictFiveAndHalf({
          tableProfile: {
            id: 'local-match-table',
            widthM: PHYSICS.TABLE_WIDTH,
            heightM: PHYSICS.TABLE_HEIGHT,
            indexScale: 100,
            condition: 'normal',
          },
          layout: {
            cueBall: cuePoint,
            objectBall1: obj1Point,
            objectBall2: obj2Point,
          },
          intent: {
            routeType: 'five_and_half',
            targetThirdRail: 'long',
          },
          shotHint: {
            speedBand,
            spinBand,
            angleBand: 'mid',
          },
        });
        const simulateResponse = await simulateFiveAndHalf({
          predict: predictResponse.payload,
          shotInput: {
            schemaName: 'shot_input',
            schemaVersion: '1.0.0',
            roomId: 'local-room',
            matchId: `batch-${Date.now()}`,
            turnId: `batch-turn-${index}`,
            playerId: currentPlayer,
            clientTsMs: Date.now(),
            shotDirectionDeg: variant.directionDeg,
            cueElevationDeg: shotInput.cueElevationDeg,
            dragPx: variant.dragPx,
            impactOffsetX: variant.impactX,
            impactOffsetY: variant.impactY,
            inputSeq: index + 1,
          },
          physicsProfile: {
            clothFriction: PHYSICS.SLIDING_FRICTION,
            cushionRestitution: PHYSICS.BALL_CUSHION_RESTITUTION,
            spinDecay: 0.12,
          },
        });
        const metrics = simulateResponse.payload.errorMetrics as Record<string, unknown> | undefined;
        setFahHistory((prev) => [
          ...prev.slice(-99),
          {
            id: `fah-batch-${Date.now()}-${index}`,
            createdAt: new Date().toISOString(),
            playerId: currentPlayer,
            systemMode: 'fiveAndHalf',
            correctedAim: Number(predictResponse.payload.correctedAim ?? 0),
            expectedThirdCushion: Number(predictResponse.payload.expectedThirdCushion ?? 0),
            confidence: Number(predictResponse.payload.confidence ?? 0),
            thirdCushionIndexDelta: Number(metrics?.thirdCushionIndexDelta ?? 0),
            landingDistanceM: Number(metrics?.landingDistanceM ?? 0),
            calibrationOffset: null,
            sampleCount: null,
          },
        ]);
      }
    } catch (error) {
      setFahError(error instanceof Error ? error.message : 'FAH 배치 실행 실패');
    } finally {
      setFahLoading(false);
    }
  };

  useEffect(() => {
    if (!enableFahDiagnostics || !fahAutoTrackEnabled || systemMode !== 'fiveAndHalf' || phase !== 'SHOOTING') {
      return;
    }
    const shotKey = `${currentPlayer}:${turnStartedAtMs}`;
    if (fahAutoTrackShotKeyRef.current === shotKey) {
      return;
    }
    fahAutoTrackShotKeyRef.current = shotKey;
    void requestFiveAndHalfPredictAndSimulate();
  }, [enableFahDiagnostics, fahAutoTrackEnabled, systemMode, phase, currentPlayer, turnStartedAtMs]);

  // 3쿠션 상태
  const secondTargetId = activeCueBallId === 'cueBall' ? 'objectBall2' : 'cueBall';
  const hitObject1 = objectBallsHit.has('objectBall1');
  const hitObject2 = objectBallsHit.has(secondTargetId);
  
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
      {/* 상단 정보 패널 */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          background: 'rgba(0,0,0,0.85)',
          padding: '20px',
          borderRadius: 12,
          minWidth: 240,
          border: '1px solid rgba(255,255,255,0.1)',
          pointerEvents: 'auto',
        }}
      >
        <h2 style={{ margin: '0 0 15px 0', fontSize: 20, color: '#00ff88' }}>
          3-Cushion Billiards
        </h2>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => gameStore.toggleBallTrail()}
            style={{
              border: 'none',
              borderRadius: 6,
              background: gameStore.showBallTrail ? '#0f9d58' : '#2e2e2e',
              color: '#fff',
              padding: '4px 8px',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            수구궤적 {gameStore.showBallTrail ? 'ON' : 'OFF'}
          </button>
        </div>
        {/* 점수판 */}
        {mode !== 'fah' && (
        <div style={{ marginBottom: 15 }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>SCORE (Target: {RULES.WINNING_SCORE})</div>
          <div style={{ display: 'flex', gap: 20 }}>
            {Object.entries(scores).map(([player, score]) => (
              <div 
                key={player} 
                style={{ 
                  textAlign: 'center',
                  opacity: currentPlayer === player ? 1 : 0.5,
                  transform: currentPlayer === player ? 'scale(1.1)' : 'scale(1)',
                  transition: 'all 0.3s',
                }}
              >
                <div style={{ 
                  fontSize: 28, 
                  fontWeight: 'bold',
                  color: currentPlayer === player ? '#00ff88' : 'white',
                }}>
                  {score}
                </div>
                <div style={{ fontSize: 11, textTransform: 'uppercase' }}>
                  {player}
                </div>
              </div>
            ))}
          </div>
        </div>
        )}

        {mode !== 'fah' && (
        <div style={{ marginBottom: 10, fontSize: 12, opacity: 0.85 }}>
          TURN: <span style={{ color: '#ffd700', fontWeight: 700 }}>{(turnRemainMs / 1000).toFixed(1)}s</span>
        </div>
        )}
        
        {/* 게임 상태 */}
        <div style={{ fontSize: 11, opacity: 0.6, marginTop: mode === 'fah' ? 0 : 10 }}>
          Phase: <span style={{ color: '#ffd700' }}>{phase}</span>
        </div>
      </div>

      {/* Five & Half API 패널 */}
      {showFahPanel && (
      <div
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          background: 'rgba(0,0,0,0.85)',
          padding: '16px',
          borderRadius: 12,
          width: 320,
          border: '1px solid rgba(255,255,255,0.1)',
          pointerEvents: 'auto',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: '#8be9fd', marginBottom: 10 }}>
          FAH Anchors
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {fahAnchorTargets.map((targetPoint) => (
              <button
                key={targetPoint}
                type="button"
                onClick={() => requestFahTestShot(targetPoint)}
                disabled={phase !== 'AIMING' || fahLoading}
                style={{
                  minWidth: 60,
                  border: 'none',
                  borderRadius: 8,
                  background:
                    phase !== 'AIMING' || fahLoading
                      ? '#3b3b3b'
                      : fahTestTargetPoint === targetPoint
                        ? '#ff3d00'
                        : '#ff7043',
                  color: '#fff',
                  padding: '7px 10px',
                  cursor: phase !== 'AIMING' || fahLoading ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                A{targetPoint}
              </button>
            ))}
        </div>
        <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.5 }}>
          <div>현재 앵커: <span style={{ color: '#ffd700', fontWeight: 700 }}>{fahTestTargetPoint}</span></div>
          <div style={{ opacity: 0.8 }}>세팅: 수구(1,1) / 당점 10시 2팁 / 파워 30%</div>
        </div>
      </div>
      )}
      
      {/* 3쿠션 상태 패널 */}
      {(phase === 'SHOOTING' || phase === 'SIMULATING') && (
        <div
          style={{
            position: 'absolute',
            top: 280,
            right: 20,
            background: 'rgba(0,0,0,0.85)',
            padding: '20px',
            borderRadius: 12,
            minWidth: 180,
            border: `2px solid ${cushionContacts >= 3 ? '#00ff88' : '#444'}`,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 12, color: '#ffd700' }}>
            3-CUSHION TRACKER
          </div>
          
          {/* 쿠션 카운터 */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Cushions</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    background: cushionContacts >= i ? '#00ff88' : '#333',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    color: cushionContacts >= i ? '#000' : '#666',
                    transition: 'all 0.3s',
                  }}
                >
                  {i}
                </div>
              ))}
            </div>
          </div>
          
          {/* 목적구 히트 */}
          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Object Balls Hit</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 6,
                opacity: hitObject1 ? 1 : 0.4,
              }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff0000' }} />
                <span style={{ color: hitObject1 ? '#00ff88' : 'white' }}>
                  {hitObject1 ? '✓' : '○'}
                </span>
              </div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 6,
                opacity: hitObject2 ? 1 : 0.4,
              }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: ballColorMap[secondTargetId] ?? '#ffd700' }} />
                <span style={{ color: hitObject2 ? '#00ff88' : 'white' }}>
                  {hitObject2 ? '✓' : '○'}
                </span>
              </div>
            </div>
          </div>
          
          {/* 득점 가능 여부 */}
          {cushionContacts >= 3 && hitObject1 && hitObject2 && (
            <div style={{ 
              marginTop: 12, 
              padding: 8, 
              background: '#00ff88', 
              color: '#000',
              borderRadius: 6,
              textAlign: 'center',
              fontWeight: 'bold',
            }}>
              SCORED! ✓
            </div>
          )}
        </div>
      )}

      {/* 턴 결과 메시지 */}
      {turnMessage && (
        <div
          style={{
            position: 'absolute',
            top: isCompactTurnMessage ? '13%' : '35%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: turnMessage.includes('SCORE') 
              ? 'rgba(0, 255, 136, 0.95)' 
              : turnMessage.includes('WINS')
              ? 'rgba(255, 215, 0, 0.95)'
              : 'rgba(255, 100, 100, 0.9)',
            padding: isCompactTurnMessage ? '10px 18px' : '25px 50px',
            borderRadius: isCompactTurnMessage ? 10 : 16,
            fontSize: isCompactTurnMessage ? 18 : 32,
            fontWeight: 'bold',
            color: turnMessage.includes('SCORE') || turnMessage.includes('WINS') ? '#000' : '#fff',
            animation: 'pulse 0.5s ease-in-out',
            zIndex: 100,
          }}
        >
          {turnMessage}
        </div>
      )}

      {phase === 'AIMING' && overlappingRows.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '48%',
            left: 20,
            transform: 'translateY(-50%)',
            background: 'rgba(0,0,0,0.82)',
            borderRadius: 12,
            padding: '14px 16px',
            minWidth: 120,
          }}
        >
          {overlappingRows.map((row) => (
            <div key={row.id} style={{ marginBottom: 10 }}>
              {(() => {
                const overlapPx = overlayBallSize;
                const centerDistancePx = (1 - row.overlap) * overlapPx;
                const sideSign = row.signedPerp >= 0 ? -1 : 1;
                const centerX = (overlayTrackWidth - overlayBallSize) / 2;
                const cueLeft = Math.round(centerX - (sideSign * centerDistancePx) / 2);
                const objectLeft = Math.round(centerX + (sideSign * centerDistancePx) / 2);

                return (
                  <div
                    style={{
                      position: 'relative',
                      height: overlayBallSize,
                      width: overlayTrackWidth,
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: `${cueLeft}px`,
                        width: overlayBallSize,
                        height: overlayBallSize,
                        borderRadius: '50%',
                        background: ballColorMap[activeCueBallId] ?? '#ffffff',
                        border: '1px solid rgba(0,0,0,0.35)',
                        zIndex: 2,
                        boxShadow: '0 0 0 1px rgba(255,255,255,0.15) inset',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: `${objectLeft}px`,
                        width: overlayBallSize,
                        height: overlayBallSize,
                        borderRadius: '50%',
                        background: ballColorMap[row.id] ?? '#00bcd4',
                        border: '1px solid rgba(0,0,0,0.35)',
                        opacity: 0.95,
                        zIndex: 1,
                        boxShadow: '0 0 10px rgba(0,255,136,0.35)',
                      }}
                    />
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      {/* 샷 정보 (드래그 중) */}
      {phase === 'AIMING' && isDragging && (
        <>
          {/* 파워 게이지 */}
          <div
            style={{
              position: 'absolute',
              bottom: 140,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 320,
              background: 'rgba(0,0,0,0.8)',
              padding: '15px 20px',
              borderRadius: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 14 }}>Power</span>
              <span style={{ 
                fontSize: 18, 
                fontWeight: 'bold',
                color: powerPercent > 80 ? '#ff4444' : powerPercent > 50 ? '#ffff00' : '#00ff88',
              }}>
                {powerPercent}%
              </span>
            </div>
            <div style={{ 
              height: 12, 
              background: '#333', 
              borderRadius: 6,
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${powerPercent}%`,
                height: '100%',
                background: powerPercent > 80 
                  ? 'linear-gradient(90deg, #ffff00, #ff4444)' 
                  : powerPercent > 50 
                    ? 'linear-gradient(90deg, #00ff88, #ffff00)'
                    : '#00ff88',
                transition: 'width 0.05s',
              }} />
            </div>
            <div style={{ 
              textAlign: 'center', 
              marginTop: 8,
              fontSize: 14,
              color: '#aaa',
            }}>
              Speed: {speed} m/s
            </div>
          </div>
        </>
      )}
      
      {/* 당점 정보 */}
      {phase === 'AIMING' && (
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            background: 'rgba(0,0,0,0.85)',
            padding: '12px',
            borderRadius: 12,
          }}
        >
          {/* 당점 시각화 */}
          <div style={{ 
            width: 60, 
            height: 60, 
            borderRadius: '50%', 
            background: 'rgba(255,255,255,0.1)',
            border: `2px solid ${isMiscueRisk ? '#ff4444' : '#fff'}`,
            position: 'relative',
            marginBottom: 10,
          }}>
            {/* 중심 */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 2,
              height: 2,
              background: '#fff',
              transform: 'translate(-50%, -50%)',
            }} />
            {/* 당점 마커 */}
            <div style={{
              position: 'absolute',
              top: `${50 - (shotInput.impactOffsetY / PHYSICS.BALL_RADIUS) * 45}%`,
              left: `${50 + (shotInput.impactOffsetX / PHYSICS.BALL_RADIUS) * 45}%`,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isMiscueRisk ? '#ff4444' : '#ff3333',
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 0 5px rgba(255,0,0,0.5)',
            }} />
            {/* 9분할 가이드 */}
            <div style={{
              position: 'absolute',
              left: '33%',
              top: 2,
              bottom: 2,
              width: 1,
              background: 'rgba(255,255,255,0.25)',
            }} />
            <div style={{
              position: 'absolute',
              left: '66%',
              top: 2,
              bottom: 2,
              width: 1,
              background: 'rgba(255,255,255,0.25)',
            }} />
            <div style={{
              position: 'absolute',
              top: '33%',
              left: 2,
              right: 2,
              height: 1,
              background: 'rgba(255,255,255,0.25)',
            }} />
            <div style={{
              position: 'absolute',
              top: '66%',
              left: 2,
              right: 2,
              height: 1,
              background: 'rgba(255,255,255,0.25)',
            }} />
          </div>
        </div>
      )}

      {/* 게임 종료 화면 */}
      {phase === 'SCORING' && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ fontSize: 48, fontWeight: 'bold', color: '#ffd700', marginBottom: 20 }}>
            🏆 GAME OVER
          </div>
          <div style={{ fontSize: 24, marginBottom: 30 }}>
            {currentPlayer.toUpperCase()} WINS!
          </div>
          <div style={{ display: 'flex', gap: 40, marginBottom: 40 }}>
            {Object.entries(scores).map(([player, score]) => (
              <div key={player} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, fontWeight: 'bold', color: '#00ff88' }}>{score}</div>
                <div>{player}</div>
              </div>
            ))}
          </div>
          <button
            onClick={resetGame}
            style={{
              padding: '15px 40px',
              fontSize: 20,
              background: '#00ff88',
              color: '#000',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Play Again
          </button>
        </div>
      )}
      
      {/* CSS 애니메이션 */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.05); }
        }
      `}</style>
    </div>
  );
}

import { useEffect, useRef, Suspense, useMemo } from 'react';
import { submitShot, requestReplay, endReplay, sendRoomChatMessage, signalVARReplayEnd, type ChatMessage } from '../lib/api-client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { SpeechBubble } from './SpeechBubble';
import * as THREE from 'three';

import { CueStick } from '../ammo/CueStick';
import { ImpactPoint } from '../ammo/ImpactPoint';
import { useGameStore, type CueBallId, type ReplayFrameData } from '../stores/gameStore';
import { PHYSICS, INPUT_LIMITS } from '../lib/constants';
import { GameUI } from './GameUI';
import { AIM_CONTROL_CONTRACT } from '../../../../packages/shared-types/src/aim-control.ts';
import { createRoomPhysicsStepConfig } from '../../../../packages/physics-core/src/room-physics-config.ts';
import { stepRoomPhysicsWorld, type PhysicsBallState, type CushionId } from '../../../../packages/physics-core/src/room-physics-step.ts';
import { computeShotInitialization } from '../../../../packages/physics-core/src/shot-init.ts';
import { isMiscue } from '../../../../packages/physics-core/src/miscue.ts';
import { applyCushionContactThrow } from '../../../../packages/physics-core/src/cushion-contact-throw.ts';

// 테이블 스펙 (Unit: meters)
const TABLE_WIDTH = PHYSICS.TABLE_WIDTH;
const TABLE_HEIGHT = PHYSICS.TABLE_HEIGHT;
const BALL_RADIUS = PHYSICS.BALL_RADIUS;
const DIAMOND_STEP_X = TABLE_WIDTH / 8;
const DIAMOND_STEP_Z = TABLE_HEIGHT / 4;
const MAX_DEBUG_TRACE_EVENTS = 40;
const CUSHION_TRACE_DEDUPE_WINDOW_MS = 120;
const CUE_DEBUG_X = -TABLE_WIDTH / 2 + DIAMOND_STEP_X * 3;
const CUE_DEBUG_Z = -TABLE_HEIGHT / 2 + DIAMOND_STEP_Z * 3;
const DEBUG_PRESET_ENABLED = false;
const TURN_DURATION_MS = 20_000;
const DEBUG_PRESETS = {
  CENTER: {
    cueX: CUE_DEBUG_X,
    cueZ: CUE_DEBUG_Z,
    obj1X: 0.0,
    obj1Z: 0.0,
    obj2X: 0.7110,
    obj2Z: -0.45,
    directionDeg: 180.0,
    dragPx: 400.0,
    impactOffsetX: 0.0,
    impactOffsetY: 0.0,
    cueElevationDeg: 0,
  },
  TOPSPIN: {
    cueX: CUE_DEBUG_X,
    cueZ: CUE_DEBUG_Z,
    obj1X: 0.0,
    obj1Z: 0.0,
    obj2X: 0.7110,
    obj2Z: -0.45,
    directionDeg: 180.0,
    dragPx: 400.0,
    impactOffsetX: 0.0,
    impactOffsetY: 0.0180,
    cueElevationDeg: 0,
  },
  BACKSPIN: {
    cueX: CUE_DEBUG_X,
    cueZ: CUE_DEBUG_Z,
    obj1X: 0.0,
    obj1Z: 0.0,
    obj2X: 0.7110,
    obj2Z: -0.45,
    directionDeg: 180.0,
    dragPx: 400.0,
    impactOffsetX: 0.0,
    impactOffsetY: -0.0180,
    cueElevationDeg: 0,
  },
} as const;
type DebugPresetName = keyof typeof DEBUG_PRESETS;

function readCaptureParams(): { capture: boolean; cam: 'play' | 'top' | 'side' } {
  if (typeof window === 'undefined') {
    return { capture: false, cam: 'play' };
  }
  const params = new URLSearchParams(window.location.search);
  const capture = params.get('capture') === '1';
  const camRaw = params.get('cam');
  if (camRaw === 'top' || camRaw === 'side') {
    return { capture, cam: camRaw };
  }
  return { capture, cam: 'play' };
}

function worldToPhysicsXY(x: number, z: number): { x: number; y: number } {
  return {
    x: x + TABLE_WIDTH / 2,
    y: z + TABLE_HEIGHT / 2,
  };
}

function physicsToWorldXZ(x: number, y: number): { x: number; z: number } {
  return {
    x: x - TABLE_WIDTH / 2,
    z: y - TABLE_HEIGHT / 2,
  };
}

function headingDeg(vx: number, vy: number): number {
  const deg = (Math.atan2(vy, vx) * 180) / Math.PI;
  return deg >= 0 ? deg : deg + 360;
}

function signedDeltaDeg(beforeDeg: number, afterDeg: number): number {
  let delta = afterDeg - beforeDeg;
  while (delta > 180) delta -= 360;
  while (delta <= -180) delta += 360;
  return delta;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

function directionDegFromCueToTarget(cue: THREE.Vector3, target: THREE.Vector3): number {
  const dx = target.x - cue.x;
  const dz = target.z - cue.z;
  const deg = (Math.atan2(dx, dz) * 180) / Math.PI;
  return (deg + 360) % 360;
}

function createPhysicsConfigForMode() {
  return createRoomPhysicsStepConfig('default');
}

type SnapshotBall = {
  id: 'cueBall' | 'objectBall1' | 'objectBall2';
  x: number;
  y: number;
  vx: number;
  vy: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  isPocketed: boolean;
};

type GameWorldProps = {
  roomId?: string;
  memberId?: string;
  members?: Array<{ memberId: string; displayName: string }>;
  eventSource?: EventSource;
};

/**
 * 3D 게임 월드
 */
function GameWorld({ roomId, memberId, members, eventSource }: GameWorldProps) {
  const { scene, camera } = useThree();
  const captureParams = readCaptureParams();
  const gameStore = useGameStore();

  const physicsConfigRef = useRef(createPhysicsConfigForMode());
  const physicsAccumulatorRef = useRef(0);
  const physicsBallsRef = useRef<PhysicsBallState[]>([]);
  const cueStickRef = useRef<CueStick | null>(null);
  const impactPointRef = useRef<ImpactPoint | null>(null);
  const ballsRef = useRef<Map<string, { mesh: THREE.Mesh }>>(new Map());
  const cueBallRingRef = useRef<THREE.Mesh | null>(null);
  const guideCuePathRef = useRef<THREE.Line | null>(null);
  const guidePostCuePathRef = useRef<THREE.Line | null>(null);
  const guideObjectPathRef = useRef<THREE.Line | null>(null);
  const debugTracePartsRef = useRef<string[]>([]);
  const traceEventIndexRef = useRef(0);
  const traceWasTruncatedRef = useRef(false);
  const lastCueCushionEventRef = useRef<{ cushionId: CushionId; atMs: number } | null>(null);
  const turnEndHandledRef = useRef(false);
  const ballTrailLastPosRef = useRef<Map<string, THREE.Vector3>>(new Map());
  const ballTrailSegmentsRef = useRef<Map<string, THREE.Mesh[]>>(new Map());
  const substepPositionsRef = useRef<Map<string, Array<{ x: number; y: number }>>>(new Map());

  const serverBallsRef = useRef<SnapshotBall[]>([]);
  const opponentFiredThisTurnRef = useRef(false);
  const hasSetupTurnRef = useRef(false);
  const replayRecordingRef = useRef<{ activeCueBallId: CueBallId; frames: Array<{ balls: Array<{ id: string; x: number; y: number }> }> } | null>(null);
  const lastReplayFrameIndexRef = useRef(-1);

  const dragState = useRef<{
    isDragging: boolean;
    startY: number;
    currentPower: number;
  }>({
    isDragging: false,
    startY: 0,
    currentPower: INPUT_LIMITS.DRAG_MIN,
  });

  const shiftPressedRef = useRef(false);
  const orbitControlsRef = useRef<any>(null);
  const lastAutoAimTurnRef = useRef(0);

  const tempDir = useRef(new THREE.Vector3());
  const prevPhaseRef = useRef(gameStore.phase);
  const activeDebugPresetRef = useRef<DebugPresetName>('CENTER');

  const clearBallTrails = () => {
    ballTrailLastPosRef.current.clear();
    ballTrailSegmentsRef.current.forEach((segments) => {
      segments.forEach((mesh) => {
        scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      });
    });
    ballTrailSegmentsRef.current.clear();
    substepPositionsRef.current.clear();
  };

  useEffect(() => {
    createVisualTable(scene);
    if (DEBUG_PRESET_ENABLED) {
      applyDebugPreset();
    }

    cueStickRef.current = new CueStick(scene);
    impactPointRef.current = new ImpactPoint(scene, BALL_RADIUS);
    const createGuideLine = (color: number): THREE.Line => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
      const material = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.85,
      });
      const line = new THREE.Line(geometry, material);
      line.visible = false;
      scene.add(line);
      return line;
    };
    guideCuePathRef.current = createGuideLine(0x8be9fd);
    guidePostCuePathRef.current = createGuideLine(0x50fa7b);
    guideObjectPathRef.current = createGuideLine(0xffb86c);
    console.log('[GameWorld] Initialized (physics-core runtime)');

    return () => {
      cueStickRef.current?.dispose();
      impactPointRef.current?.dispose();
      const disposeLine = (line: THREE.Line | null) => {
        if (!line) return;
        scene.remove(line);
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      };
      disposeLine(guideCuePathRef.current);
      disposeLine(guidePostCuePathRef.current);
      disposeLine(guideObjectPathRef.current);
      guideCuePathRef.current = null;
      guidePostCuePathRef.current = null;
      guideObjectPathRef.current = null;
      clearBallTrails();
    };
  }, [scene]);

  useEffect(() => {
    clearBalls();
    createBalls();
    physicsAccumulatorRef.current = 0;
  }, [scene]);

  useEffect(() => {
    physicsConfigRef.current = createPhysicsConfigForMode();
    physicsAccumulatorRef.current = 0;
  }, []);

  useEffect(() => {
    if (gameStore.phase === 'SHOOTING') {
      clearBallTrails();
      turnEndHandledRef.current = false;
    }
  }, [gameStore.phase]);

  useEffect(() => {
    if (gameStore.phase !== 'AIMING') {
      return;
    }
    const timerId = window.setInterval(() => {
      if (gameStore.phase !== 'AIMING') {
        return;
      }
      const elapsedMs = Date.now() - gameStore.turnStartedAtMs;
      if (elapsedMs >= TURN_DURATION_MS) {
        gameStore.handleTurnEnd();
      }
    }, 120);
    return () => {
      window.clearInterval(timerId);
    };
  }, [gameStore.phase, gameStore.turnStartedAtMs, gameStore.currentPlayer]);

  useEffect(() => {
    const message = gameStore.turnMessage.trim();
    if (!message) {
      return;
    }
    if (message.includes('WINS')) {
      return;
    }
    const timerId = window.setTimeout(() => {
      if (useGameStore.getState().turnMessage === message) {
        useGameStore.getState().setTurnMessage('');
      }
    }, 5000);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [gameStore.turnMessage]);

  const applyDebugPreset = (presetName?: DebugPresetName) => {
    const name = presetName ?? activeDebugPresetRef.current;
    const preset = DEBUG_PRESETS[name];
    activeDebugPresetRef.current = name;
    const cuePos = new THREE.Vector3(preset.cueX, BALL_RADIUS, preset.cueZ);
    const obj1Pos = new THREE.Vector3(preset.obj1X, BALL_RADIUS, preset.obj1Z);
    const obj2Pos = new THREE.Vector3(preset.obj2X, BALL_RADIUS, preset.obj2Z);

    const setBall = (id: 'cueBall' | 'objectBall1' | 'objectBall2', pos: THREE.Vector3) => {
      const meshRef = ballsRef.current.get(id);
      if (meshRef) {
        meshRef.mesh.position.copy(pos);
      }
      const physicsPos = worldToPhysicsXY(pos.x, pos.z);
      const physicsBall = physicsBallsRef.current.find((ball) => ball.id === id);
      if (physicsBall) {
        physicsBall.x = physicsPos.x;
        physicsBall.y = physicsPos.y;
        physicsBall.vx = 0;
        physicsBall.vy = 0;
        physicsBall.spinX = 0;
        physicsBall.spinY = 0;
        physicsBall.spinZ = 0;
      }
      gameStore.updateBall(id, {
        position: pos.clone(),
        velocity: new THREE.Vector3(0, 0, 0),
        angularVelocity: new THREE.Vector3(0, 0, 0),
        isPocketed: false,
      });
    };

    setBall('cueBall', cuePos);
    setBall('objectBall1', obj1Pos);
    setBall('objectBall2', obj2Pos);
    physicsAccumulatorRef.current = 0;

    gameStore.setPhase('AIMING');
    gameStore.setAimControlMode('MANUAL_AIM');
    const alignedDirectionDeg = directionDegFromCueToTarget(cuePos, obj1Pos);
    gameStore.setShotDirection(alignedDirectionDeg);
    gameStore.setDragPower(preset.dragPx);
    gameStore.setImpactOffset(preset.impactOffsetX, preset.impactOffsetY);
    gameStore.setCueElevation(preset.cueElevationDeg);
    gameStore.setTurnMessage(`DEBUG ${name} PRESET APPLIED (HEAD-ON LOCK)`);
  };

  useEffect(() => {
    if (!DEBUG_PRESET_ENABLED) {
      prevPhaseRef.current = gameStore.phase;
      return;
    }

    const prevPhase = prevPhaseRef.current;
    const enteredAimingFromShot =
      gameStore.phase === 'AIMING' && (prevPhase === 'SHOOTING' || prevPhase === 'SIMULATING' || prevPhase === 'SCORING');

    if (enteredAimingFromShot) {
      applyDebugPreset();
    }

    prevPhaseRef.current = gameStore.phase;
  }, [gameStore.phase]);

  useEffect(() => {
    if (captureParams.cam === 'top') {
      camera.up.set(0, 0, -1);
      camera.position.set(0, 4.4, 0.001);
      camera.lookAt(0, 0, 0);
      return;
    }
    if (captureParams.cam === 'side') {
      camera.position.set(0, 1.5, 3.5);
      camera.lookAt(0, 0.25, 0);
    }
  }, [camera, captureParams.cam]);

  const clearBalls = () => {
    for (const { mesh } of ballsRef.current.values()) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    ballsRef.current.clear();
    physicsBallsRef.current = [];
    if (cueBallRingRef.current) {
      scene.remove(cueBallRingRef.current);
      cueBallRingRef.current.geometry.dispose();
      (cueBallRingRef.current.material as THREE.Material).dispose();
      cueBallRingRef.current = null;
    }
  };

  const createBalls = () => {
    const colorById: Record<string, number> = {
      cueBall: 0xffffff,
      objectBall1: 0xff0000,
      objectBall2: 0xffd700,
    };

    const physicsBalls: PhysicsBallState[] = [];
    gameStore.balls.forEach(({ id, position: pos }) => {
      const color = colorById[id] ?? 0xffffff;
      const geometry = new THREE.SphereGeometry(BALL_RADIUS, 32, 32);
      const material = new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.05,
        metalness: 0.1,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(pos.x, pos.y, pos.z);
      scene.add(mesh);

      ballsRef.current.set(id, { mesh });

      const physicsPos = worldToPhysicsXY(pos.x, pos.z);
      physicsBalls.push({
        id: id as PhysicsBallState['id'],
        x: physicsPos.x,
        y: physicsPos.y,
        vx: 0,
        vy: 0,
        spinX: 0,
        spinY: 0,
        spinZ: 0,
        isPocketed: false,
      });
    });

    physicsBallsRef.current = physicsBalls;

    // 상대 수구 표시 링
    const ringGeo = new THREE.TorusGeometry(BALL_RADIUS * 1.5, 0.003, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    scene.add(ring);
    cueBallRingRef.current = ring;
  };

  const createVisualTable = (scene3d: THREE.Scene) => {
    const clothGeo = new THREE.PlaneGeometry(TABLE_WIDTH, TABLE_HEIGHT);
    const clothMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      roughness: 0.9,
    });
    const cloth = new THREE.Mesh(clothGeo, clothMat);
    cloth.rotation.x = -Math.PI / 2;
    cloth.position.y = 0.001;
    cloth.receiveShadow = true;
    scene3d.add(cloth);

    const frameThickness = 0.15;
    const cushionHeight = PHYSICS.CUSHION_HEIGHT;
    const cushionThickness = PHYSICS.CUSHION_THICKNESS;
    const frameOuterOffset = cushionThickness + frameThickness / 2;
    const totalWidth = TABLE_WIDTH + (cushionThickness + frameThickness) * 2;
    const totalHeight = TABLE_HEIGHT + (cushionThickness + frameThickness) * 2;

    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x3a2a1f,
      roughness: 0.62,
      metalness: 0.06,
    });
    const frameY = cushionHeight / 2;
    const frameConfigs = [
      {
        pos: [0, frameY, -TABLE_HEIGHT / 2 - frameOuterOffset],
        size: [totalWidth, cushionHeight, frameThickness],
      },
      {
        pos: [0, frameY, TABLE_HEIGHT / 2 + frameOuterOffset],
        size: [totalWidth, cushionHeight, frameThickness],
      },
      {
        pos: [-TABLE_WIDTH / 2 - frameOuterOffset, frameY, 0],
        size: [frameThickness, cushionHeight, totalHeight],
      },
      {
        pos: [TABLE_WIDTH / 2 + frameOuterOffset, frameY, 0],
        size: [frameThickness, cushionHeight, totalHeight],
      },
    ];

    frameConfigs.forEach((cfg) => {
      const geo = new THREE.BoxGeometry(cfg.size[0], cfg.size[1], cfg.size[2]);
      const mesh = new THREE.Mesh(geo, frameMat);
      mesh.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      mesh.castShadow = true;
      scene3d.add(mesh);
    });

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x2b1d15,
      roughness: 0.7,
      metalness: 0.04,
    });
    const bodyGeo = new THREE.BoxGeometry(TABLE_WIDTH + 0.42, 0.44, TABLE_HEIGHT * 0.42);
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.set(0, -0.28, 0);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    scene3d.add(bodyMesh);

    const apronGeo = new THREE.BoxGeometry(TABLE_WIDTH + 0.36, 0.16, 0.08);
    const frontApron = new THREE.Mesh(apronGeo, bodyMat);
    frontApron.position.set(0, -0.1, TABLE_HEIGHT * 0.21);
    frontApron.castShadow = true;
    scene3d.add(frontApron);

    const backApron = new THREE.Mesh(apronGeo, bodyMat);
    backApron.position.set(0, -0.1, -TABLE_HEIGHT * 0.21);
    backApron.castShadow = true;
    scene3d.add(backApron);

    const cushionMat = new THREE.MeshStandardMaterial({
      color: 0x2d57dc,
      roughness: 0.6,
      metalness: 0.04,
    });
    const cushionConfigs = [
      { pos: [0, cushionHeight / 2, -TABLE_HEIGHT / 2 - cushionThickness / 2], size: [TABLE_WIDTH, cushionHeight, cushionThickness] },
      { pos: [0, cushionHeight / 2, TABLE_HEIGHT / 2 + cushionThickness / 2], size: [TABLE_WIDTH, cushionHeight, cushionThickness] },
      { pos: [-TABLE_WIDTH / 2 - cushionThickness / 2, cushionHeight / 2, 0], size: [cushionThickness, cushionHeight, TABLE_HEIGHT] },
      { pos: [TABLE_WIDTH / 2 + cushionThickness / 2, cushionHeight / 2, 0], size: [cushionThickness, cushionHeight, TABLE_HEIGHT] },
      // Corner fillers: close visual gaps between long/short cushion segments.
      {
        pos: [-TABLE_WIDTH / 2 - cushionThickness / 2, cushionHeight / 2, -TABLE_HEIGHT / 2 - cushionThickness / 2],
        size: [cushionThickness, cushionHeight, cushionThickness],
      },
      {
        pos: [TABLE_WIDTH / 2 + cushionThickness / 2, cushionHeight / 2, -TABLE_HEIGHT / 2 - cushionThickness / 2],
        size: [cushionThickness, cushionHeight, cushionThickness],
      },
      {
        pos: [-TABLE_WIDTH / 2 - cushionThickness / 2, cushionHeight / 2, TABLE_HEIGHT / 2 + cushionThickness / 2],
        size: [cushionThickness, cushionHeight, cushionThickness],
      },
      {
        pos: [TABLE_WIDTH / 2 + cushionThickness / 2, cushionHeight / 2, TABLE_HEIGHT / 2 + cushionThickness / 2],
        size: [cushionThickness, cushionHeight, cushionThickness],
      },
    ];

    cushionConfigs.forEach((cfg) => {
      const geo = new THREE.BoxGeometry(cfg.size[0], cfg.size[1], cfg.size[2]);
      const mesh = new THREE.Mesh(geo, cushionMat);
      mesh.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene3d.add(mesh);
    });

    createDiamondMarkers(scene3d);
  };

  const createDiamondMarkers = (scene3d: THREE.Scene) => {
    const cushionThickness = PHYSICS.CUSHION_THICKNESS;
    const cushionHeight = PHYSICS.CUSHION_HEIGHT;
    const frameThickness = 0.15;
    const frameOuterOffset = cushionThickness + frameThickness / 2;
    const markerRadius = 0.008;
    const markerDepth = 0.002;
    const markerGeo = new THREE.CylinderGeometry(markerRadius, markerRadius, markerDepth, 16);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0xd7d0c2 });
    const markerY = cushionHeight + markerDepth / 2 + 0.0005;
    const longRailZ = TABLE_HEIGHT / 2 + frameOuterOffset;
    const shortRailX = TABLE_WIDTH / 2 + frameOuterOffset;

    const longRailMarkers = 9;
    for (let i = 0; i < longRailMarkers; i += 1) {
      const t = i / (longRailMarkers - 1);
      const x = (t - 0.5) * TABLE_WIDTH;

      const top = new THREE.Mesh(markerGeo, markerMat);
      top.rotation.x = -Math.PI / 2;
      top.position.set(x, markerY, -longRailZ);
      scene3d.add(top);

      const bottom = new THREE.Mesh(markerGeo, markerMat);
      bottom.rotation.x = -Math.PI / 2;
      bottom.position.set(x, markerY, longRailZ);
      scene3d.add(bottom);
    }

    const shortRailMarkers = 5;
    for (let i = 0; i < shortRailMarkers; i += 1) {
      const t = i / (shortRailMarkers - 1);
      const z = (t - 0.5) * TABLE_HEIGHT;

      const left = new THREE.Mesh(markerGeo, markerMat);
      left.rotation.x = -Math.PI / 2;
      left.position.set(-shortRailX, markerY, z);
      scene3d.add(left);

      const right = new THREE.Mesh(markerGeo, markerMat);
      right.rotation.x = -Math.PI / 2;
      right.position.set(shortRailX, markerY, z);
      scene3d.add(right);
    }
  };

  const executeShot = (overrideShotInput?: {
    shotDirectionDeg?: number;
    cueElevationDeg?: number;
    dragPx?: number;
    impactOffsetX?: number;
    impactOffsetY?: number;
  }) => {
    const shotInput = {
      ...gameStore.shotInput,
      ...(overrideShotInput ?? {}),
    };
    const shotCueBallId = gameStore.activeCueBallId;
    const cueBall = physicsBallsRef.current.find((ball) => ball.id === shotCueBallId);
    if (!cueBall) {
      return;
    }
    const impactOffsetXForPhysics = -shotInput.impactOffsetX;

    if (isMiscue(impactOffsetXForPhysics, shotInput.impactOffsetY, BALL_RADIUS)) {
      gameStore.setTurnMessage('MISCUE!');
    }

    const shotInit = computeShotInitialization({
      dragPx: shotInput.dragPx,
      impactOffsetX: impactOffsetXForPhysics,
      impactOffsetY: shotInput.impactOffsetY,
    });
    let initialBallSpeedMps = shotInit.initialBallSpeedMps;
    let omegaX = shotInit.omegaX;
    let omegaZ = shotInit.omegaZ;
    if (typeof window !== 'undefined') {
      const cue = gameStore.balls.find((ball) => ball.id === shotCueBallId)?.position;
      const obj1 = gameStore.balls.find((ball) => ball.id === 'objectBall1')?.position;
      const obj2 = gameStore.balls.find((ball) => ball.id !== shotCueBallId && ball.id !== 'objectBall1')?.position;
      const playableWidth = PHYSICS.TABLE_WIDTH - PHYSICS.BALL_RADIUS * 2;
      const playableHeight = PHYSICS.TABLE_HEIGHT - PHYSICS.BALL_RADIUS * 2;
      const startRatioX = cue
        ? Math.max(0, Math.min(1, (cue.x + PHYSICS.TABLE_WIDTH / 2 - PHYSICS.BALL_RADIUS) / playableWidth))
        : 0.5;
      const startRatioY = cue
        ? Math.max(0, Math.min(1, (cue.z + PHYSICS.TABLE_HEIGHT / 2 - PHYSICS.BALL_RADIUS) / playableHeight))
        : 0.5;
      const lastShotLine =
        `startRatioX:${startRatioX.toFixed(3)} ` +
        `startRatioY:${startRatioY.toFixed(3)} ` +
        `directionDeg:${shotInput.shotDirectionDeg.toFixed(1)} ` +
        `speedMps:${initialBallSpeedMps.toFixed(3)} ` +
        `spinZ:${omegaZ.toFixed(3)} ` +
        `speedBoost:1.000 ` +
        `dragPx:${shotInput.dragPx.toFixed(1)} ` +
        `impactOffsetX(UI):${shotInput.impactOffsetX.toFixed(4)} ` +
        `impactOffsetX(phys):${impactOffsetXForPhysics.toFixed(4)} ` +
        `impactOffsetY:${shotInput.impactOffsetY.toFixed(4)} ` +
        `dynProfile:N dynBlend:g0.000_c0.000 dynRest:0.000 dynFric:0.000 ` +
        `cueX:${(cue?.x ?? 0).toFixed(4)} ` +
        `cueZ:${(cue?.z ?? 0).toFixed(4)} ` +
        `obj1X:${(obj1?.x ?? 0).toFixed(4)} ` +
        `obj1Z:${(obj1?.z ?? 0).toFixed(4)} ` +
        `obj2X:${(obj2?.x ?? 0).toFixed(4)} ` +
        `obj2Z:${(obj2?.z ?? 0).toFixed(4)}`;
      window.sessionStorage.setItem('bhc.lastShotDebugLine', lastShotLine);
    }
    clearBallTrails();
    debugTracePartsRef.current = [];
    traceEventIndexRef.current = 0;
    traceWasTruncatedRef.current = false;
    lastCueCushionEventRef.current = null;

    const directionRad = (shotInput.shotDirectionDeg * Math.PI) / 180;
    const forwardX = Math.sin(directionRad);
    const forwardY = Math.cos(directionRad);
    cueBall.vx = forwardX * initialBallSpeedMps;
    cueBall.vy = forwardY * initialBallSpeedMps;
    cueBall.spinX = omegaX * forwardY;
    cueBall.spinY = -omegaX * forwardX;
    cueBall.spinZ = omegaZ;

    const initialBalls = physicsBallsRef.current.map((b) => ({ id: b.id, x: b.x, y: b.y }));
    replayRecordingRef.current = {
      activeCueBallId: shotCueBallId as CueBallId,
      frames: [{ balls: initialBalls }],
    };

    gameStore.executeShot();
    cueStickRef.current?.animateShot();

    // 멀티플레이어: 서버에 샷 전송 (fire-and-forget)
    if (roomId && memberId && gameStore.multiplayerContext) {
      const serverDeg = ((90 - shotInput.shotDirectionDeg) % 360 + 360) % 360;
      submitShot(roomId, memberId, {
        shotDirectionDeg: serverDeg,
        cueElevationDeg: Math.max(0, Math.min(89, shotInput.cueElevationDeg ?? 0)),
        dragPx: shotInput.dragPx,
        impactOffsetX: -shotInput.impactOffsetX,
        impactOffsetY: shotInput.impactOffsetY,
      }).catch(console.error);
    }
  };

  // 멀티플레이어 컨텍스트 초기화
  useEffect(() => {
    if (!roomId || !memberId || !members) return;
    gameStore.setMultiplayerContext({ roomId, memberId, members });
    hasSetupTurnRef.current = false;
    return () => {
      gameStore.setMultiplayerContext(null);
    };
  }, [roomId, memberId]);

  // SSE 이벤트 리스너
  useEffect(() => {
    if (!eventSource || !roomId || !memberId) return;

    const handleSnapshot = (e: MessageEvent) => {
      try {
        const snap = JSON.parse(e.data as string) as {
          balls?: SnapshotBall[];
          turn?: { currentMemberId: string | null; turnDeadlineMs: number | null; activeCueBallId?: 'cueBall' | 'objectBall2'; shotState?: string };
          scoreBoard?: Record<string, number>;
          events?: Array<{
            type: 'BALL_COLLISION' | 'CUSHION_COLLISION' | 'SHOT_END';
            sourceBallId: string;
            targetBallId?: string;
            cushionId?: string;
          }>;
        };
        if (snap.balls) {
          serverBallsRef.current = snap.balls;
        }

        // 멀티플레이어: 서버 공 위치를 물리+메시에 즉시 적용
        const state = useGameStore.getState();
        if (state.multiplayerContext && snap.balls) {
          const isMyShot = state.isMyTurn &&
            (state.phase === 'SHOOTING' || state.phase === 'SIMULATING');
          // 리플레이 중에는 서버 스냅샷 위치 업데이트 무시 (로컬 물리 시뮬 사용)
          const isReplaying = state.phase === 'REPLAYING';
          if (!isMyShot && !isReplaying) {
            for (const sb of snap.balls) {
              const worldPos = physicsToWorldXZ(sb.x, sb.y);
              const meshRef = ballsRef.current.get(sb.id);
              if (meshRef) {
                meshRef.mesh.position.set(worldPos.x, BALL_RADIUS, worldPos.z);
              }
              const physBall = physicsBallsRef.current.find(b => b.id === sb.id);
              if (physBall) {
                physBall.x = sb.x; physBall.y = sb.y;
                physBall.vx = sb.vx; physBall.vy = sb.vy;
                physBall.spinX = sb.spinX; physBall.spinY = sb.spinY;
                physBall.spinZ = sb.spinZ;
                physBall.isPocketed = sb.isPocketed;
              }
            }
          }
        }

        // 상대 턴 충돌 이벤트 처리
        if (state.multiplayerContext && snap.events && snap.events.length > 0) {
          const isMyShot = state.isMyTurn &&
            (state.phase === 'SHOOTING' || state.phase === 'SIMULATING');
          if (!isMyShot) {
            for (const evt of snap.events) {
              if (evt.type === 'CUSHION_COLLISION' && evt.cushionId) {
                useGameStore.getState().addCushionContact(evt.cushionId);
              } else if (evt.type === 'BALL_COLLISION' && evt.targetBallId) {
                useGameStore.getState().addBallCollision(evt.targetBallId);
              }
            }
          }
        }

        // 초기 턴 설정 (turn_changed 이벤트 전)
        if (!hasSetupTurnRef.current && snap.turn?.currentMemberId !== undefined) {
          hasSetupTurnRef.current = true;
          useGameStore.getState().applyServerTurnChanged({
            currentMemberId: snap.turn.currentMemberId,
            turnDeadlineMs: snap.turn.turnDeadlineMs ?? null,
            activeCueBallId: snap.turn.activeCueBallId,
          });
          // mid-shot 감지: 접속 시 상대가 이미 샷 중이면 SIMULATING 전환
          if (snap.turn.currentMemberId !== memberId && snap.turn.shotState === 'running') {
            opponentFiredThisTurnRef.current = true;
            useGameStore.getState().resetTurnEvents();
            useGameStore.getState().setPhase('SIMULATING');
          }
        }
      } catch {
        // ignore parse errors
      }
    };

    const handleShotStarted = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data as string) as { playerId?: string; activeCueBallId?: 'cueBall' | 'objectBall2' };
        useGameStore.getState().setCanRequestVAR(false);
        // 상대방 샷이면 시뮬레이션 시작
        if (data.playerId !== memberId) {
          opponentFiredThisTurnRef.current = true;
          if (data.activeCueBallId) {
            useGameStore.getState().setActiveCueBallId(data.activeCueBallId);
          }
          useGameStore.getState().setPhase('SIMULATING');
        }
      } catch {
        // ignore
      }
    };

    const handleTurnChanged = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data as string) as {
          currentMemberId: string | null;
          turnDeadlineMs: number | null;
          activeCueBallId?: 'cueBall' | 'objectBall2';
        };
        // 서버 공 위치를 물리/메시에 동기화
        const serverBalls = serverBallsRef.current;
        for (const sb of serverBalls) {
          const worldPos = physicsToWorldXZ(sb.x, sb.y);
          const meshRef = ballsRef.current.get(sb.id);
          if (meshRef) {
            meshRef.mesh.position.set(worldPos.x, BALL_RADIUS, worldPos.z);
          }
          const physBall = physicsBallsRef.current.find((b) => b.id === sb.id);
          if (physBall) {
            physBall.x = sb.x;
            physBall.y = sb.y;
            physBall.vx = 0;
            physBall.vy = 0;
            physBall.spinX = 0;
            physBall.spinY = 0;
            physBall.spinZ = 0;
          }
        }
        turnEndHandledRef.current = false;
        opponentFiredThisTurnRef.current = false;
        hasSetupTurnRef.current = true;
        clearBallTrails();
        useGameStore.getState().applyServerTurnChanged(data);
      } catch {
        // ignore
      }
    };

    const handleShotResolved = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data as string) as {
          scored?: boolean;
          scoreBoard?: Record<string, number>;
          replayAvailable?: boolean;
          scorerMemberId?: string;
          missedByMemberId?: string;
        };
        const state = useGameStore.getState();
        const ctx = state.multiplayerContext;
        if (ctx && data.scoreBoard) {
          const newScores: Record<string, number> = {};
          for (const member of ctx.members) {
            newScores[member.displayName] = data.scoreBoard[member.memberId] ?? 0;
          }
          useGameStore.setState({ scores: newScores });
        }
        const msg = data.scored ? 'SCORED! +1 Point' : 'MISS';
        useGameStore.getState().setTurnMessage(msg);
        if (data.replayAvailable && data.scorerMemberId) {
          useGameStore.setState({
            phase: 'REPLAY_READY',
            replayScorerMemberId: data.scorerMemberId,
            replayRemainingCount: 3,
          });
        }
        // VAR: 내가 MISS를 낸 경우 VAR 요청 가능 상태로
        if (!data.scored && data.missedByMemberId && memberId && data.missedByMemberId === memberId) {
          useGameStore.getState().setCanRequestVAR(true);
        }
      } catch {
        // ignore
      }
    };

    const handleReplayRequested = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data as string) as {
          frames: Array<{ balls: Array<{ id: string; x: number; y: number }> }>;
          activeCueBallId: 'cueBall' | 'objectBall2';
          remainingReplays: number;
        };
        const frameData: ReplayFrameData = {
          frames: data.frames,
          activeCueBallId: data.activeCueBallId,
        };
        // 첫 프레임 위치를 즉시 메시에 적용 (시각적 점프 방지)
        if (frameData.frames.length > 0) {
          for (const ball of frameData.frames[0].balls) {
            const worldPos = physicsToWorldXZ(ball.x, ball.y);
            const meshRef = ballsRef.current.get(ball.id);
            if (meshRef) {
              meshRef.mesh.position.set(worldPos.x, BALL_RADIUS, worldPos.z);
            }
            const physBall = physicsBallsRef.current.find((b) => b.id === ball.id);
            if (physBall) {
              physBall.x = ball.x;
              physBall.y = ball.y;
              physBall.vx = 0;
              physBall.vy = 0;
              physBall.spinX = 0;
              physBall.spinY = 0;
              physBall.spinZ = 0;
            }
          }
        }
        turnEndHandledRef.current = false;
        useGameStore.setState({
          phase: 'REPLAYING',
          replayRemainingCount: data.remainingReplays,
          replayFrameData: frameData,
          replayCurrentFrame: 0,
          replayIsPlaying: true,
        });
      } catch {
        // ignore
      }
    };

    const handleGameFinished = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data as string) as {
          winnerMemberId: string | null;
          memberGameStates: Record<string, string>;
        };
        useGameStore.getState().applyServerGameFinished(data);
      } catch {
        // ignore
      }
    };

    const handleVarVoteStarted = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data as string) as {
          requesterMemberId: string;
          stage: 'VOTE_REPLAY' | 'REPLAYING' | 'VOTE_SCORE';
          totalVoters: number;
        };
        useGameStore.getState().applyVarVoteStarted(data);
        useGameStore.getState().setCanRequestVAR(false);
      } catch {
        // ignore
      }
    };

    const handleVarVoteUpdate = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data as string) as {
          votesReceived: number;
          totalVoters: number;
        };
        useGameStore.getState().applyVarVoteUpdate(data);
      } catch {
        // ignore
      }
    };

    const handleVarReplayStart = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data as string) as {
          frames: Array<{ balls: Array<{ id: string; x: number; y: number }> }>;
          activeCueBallId: 'cueBall' | 'objectBall2';
        };
        // Apply first frame positions
        if (data.frames.length > 0) {
          for (const ball of data.frames[0].balls) {
            const worldPos = physicsToWorldXZ(ball.x, ball.y);
            const meshRef = ballsRef.current.get(ball.id);
            if (meshRef) {
              meshRef.mesh.position.set(worldPos.x, BALL_RADIUS, worldPos.z);
            }
            const physBall = physicsBallsRef.current.find((b) => b.id === ball.id);
            if (physBall) {
              physBall.x = ball.x;
              physBall.y = ball.y;
              physBall.vx = 0;
              physBall.vy = 0;
              physBall.spinX = 0;
              physBall.spinY = 0;
              physBall.spinZ = 0;
            }
          }
        }
        useGameStore.getState().applyVarReplayStart(data);
      } catch {
        // ignore
      }
    };

    const handleVarScoreAwarded = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data as string) as {
          scoreBoard: Record<string, number>;
          currentMemberId: string | null;
          turnDeadlineMs: number | null;
          activeCueBallId?: 'cueBall' | 'objectBall2';
          balls?: Array<{ id: string; x: number; y: number; vx: number; vy: number; spinX: number; spinY: number; spinZ: number; isPocketed: boolean }>;
        };
        // Restore ball positions if provided
        if (data.balls) {
          for (const ball of data.balls) {
            const worldPos = physicsToWorldXZ(ball.x, ball.y);
            const meshRef = ballsRef.current.get(ball.id);
            if (meshRef) {
              meshRef.mesh.position.set(worldPos.x, BALL_RADIUS, worldPos.z);
            }
            const physBall = physicsBallsRef.current.find((b) => b.id === ball.id);
            if (physBall) {
              Object.assign(physBall, ball);
            }
          }
        }
        useGameStore.getState().applyVarScoreAwarded(data);
      } catch {
        // ignore
      }
    };

    const handleVarDismissed = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data as string) as {
          currentMemberId?: string | null;
          turnDeadlineMs?: number | null;
          activeCueBallId?: 'cueBall' | 'objectBall2';
        };
        useGameStore.getState().applyVarDismissed({
          currentMemberId: data.currentMemberId ?? null,
          turnDeadlineMs: data.turnDeadlineMs ?? null,
          activeCueBallId: data.activeCueBallId,
        });
      } catch {
        // ignore
      }
    };

    eventSource.addEventListener('room_snapshot', handleSnapshot);
    eventSource.addEventListener('shot_started', handleShotStarted);
    eventSource.addEventListener('turn_changed', handleTurnChanged);
    eventSource.addEventListener('shot_resolved', handleShotResolved);
    eventSource.addEventListener('game_finished', handleGameFinished);
    eventSource.addEventListener('replay_requested', handleReplayRequested);
    eventSource.addEventListener('var_vote_started', handleVarVoteStarted);
    eventSource.addEventListener('var_vote_update', handleVarVoteUpdate);
    eventSource.addEventListener('var_replay_start', handleVarReplayStart);
    eventSource.addEventListener('var_score_awarded', handleVarScoreAwarded);
    eventSource.addEventListener('var_dismissed', handleVarDismissed);

    return () => {
      eventSource.removeEventListener('room_snapshot', handleSnapshot);
      eventSource.removeEventListener('shot_started', handleShotStarted);
      eventSource.removeEventListener('turn_changed', handleTurnChanged);
      eventSource.removeEventListener('shot_resolved', handleShotResolved);
      eventSource.removeEventListener('game_finished', handleGameFinished);
      eventSource.removeEventListener('replay_requested', handleReplayRequested);
      eventSource.removeEventListener('var_vote_started', handleVarVoteStarted);
      eventSource.removeEventListener('var_vote_update', handleVarVoteUpdate);
      eventSource.removeEventListener('var_replay_start', handleVarReplayStart);
      eventSource.removeEventListener('var_score_awarded', handleVarScoreAwarded);
      eventSource.removeEventListener('var_dismissed', handleVarDismissed);
    };
  }, [eventSource, roomId, memberId]);

  // phase가 REPLAYING으로 전환될 때: 첫 프레임 위치 적용 + trail 클리어
  useEffect(() => {
    if (gameStore.phase !== 'REPLAYING') return;
    const frameData = gameStore.replayFrameData;
    if (!frameData || frameData.frames.length === 0) return;
    // 첫 프레임 위치 복원
    const firstFrame = frameData.frames[0];
    for (const ball of firstFrame.balls) {
      const worldPos = physicsToWorldXZ(ball.x, ball.y);
      const meshRef = ballsRef.current.get(ball.id);
      if (meshRef) {
        meshRef.mesh.position.set(worldPos.x, BALL_RADIUS, worldPos.z);
      }
      const physBall = physicsBallsRef.current.find((b) => b.id === ball.id);
      if (physBall) {
        physBall.x = ball.x;
        physBall.y = ball.y;
        physBall.vx = 0;
        physBall.vy = 0;
        physBall.spinX = 0;
        physBall.spinY = 0;
        physBall.spinZ = 0;
      }
    }
    // trail 클리어
    clearBallTrails();
    turnEndHandledRef.current = false;
    lastReplayFrameIndexRef.current = -1;
    physicsAccumulatorRef.current = 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStore.phase]);


  const fixedViewDragRef = useRef<{ lastX: number } | null>(null);


  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      if (gameStore.fixedViewMode) e.preventDefault();
    };

    const handleMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest?.('[data-chat-panel]')) return;
      if (gameStore.multiplayerContext && !gameStore.isMyTurn) return;
      if (gameStore.phase !== 'AIMING') return;

      if (e.button === 2 && gameStore.fixedViewMode) {
        fixedViewDragRef.current = { lastX: e.clientX };
        return;
      }

      if (e.button !== 0) return;

      dragState.current.isDragging = true;
      dragState.current.startY = e.clientY;
      dragState.current.currentPower = INPUT_LIMITS.DRAG_MIN;
      gameStore.setIsDragging(true);
      gameStore.setDragPower(INPUT_LIMITS.DRAG_MIN);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (fixedViewDragRef.current !== null) {
        const deltaX = e.clientX - fixedViewDragRef.current.lastX;
        fixedViewDragRef.current.lastX = e.clientX;
        const sensitivity = shiftPressedRef.current ? 0.06 : 0.3;
        const current = gameStore.shotInput.shotDirectionDeg;
        const next = ((current + deltaX * sensitivity) % 360 + 360) % 360;
        gameStore.setShotDirection(next);
        return;
      }


      if (!dragState.current.isDragging) return;

      const deltaY = e.clientY - dragState.current.startY;
      const newPower = Math.max(
        INPUT_LIMITS.DRAG_MIN,
        Math.min(INPUT_LIMITS.DRAG_MAX, INPUT_LIMITS.DRAG_MIN + deltaY),
      );
      dragState.current.currentPower = newPower;
      gameStore.setDragPower(newPower as number);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 2 && fixedViewDragRef.current !== null) {
        fixedViewDragRef.current = null;
        return;
      }


      if (!dragState.current.isDragging) return;

      dragState.current.isDragging = false;
      gameStore.setIsDragging(false);

      // 턴이 넘어갔으면 샷 무효화 (버저비터 방지)
      if (gameStore.multiplayerContext && !gameStore.isMyTurn) {
        gameStore.setDragPower(INPUT_LIMITS.DRAG_MIN);
        return;
      }

      if (dragState.current.currentPower >= INPUT_LIMITS.DRAG_MIN + 5) {
        executeShot();
      } else {
        gameStore.setDragPower(INPUT_LIMITS.DRAG_MIN);
      }
    };

    const handleShiftDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftPressedRef.current = true;
    };
    const handleShiftUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftPressedRef.current = false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameStore.phase !== 'AIMING') return;
      if (gameStore.multiplayerContext && !gameStore.isMyTurn) return;
      const activeTag = (document.activeElement as HTMLElement)?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

      const baseStep = 0.002;
      const step = e.shiftKey ? baseStep * 0.2 : baseStep;
      const maxOffset = INPUT_LIMITS.OFFSET_MAX * 0.85;

      switch (e.key.toLowerCase()) {
        case 'w':
        case 'ㅈ':
          gameStore.setImpactOffset(
            gameStore.shotInput.impactOffsetX,
            Math.min(maxOffset, gameStore.shotInput.impactOffsetY + step),
          );
          break;
        case 's':
        case 'ㄴ':
          gameStore.setImpactOffset(
            gameStore.shotInput.impactOffsetX,
            Math.max(-maxOffset, gameStore.shotInput.impactOffsetY - step),
          );
          break;
        case 'a':
        case 'ㅁ':
          gameStore.setImpactOffset(
            Math.max(-maxOffset, gameStore.shotInput.impactOffsetX - step),
            gameStore.shotInput.impactOffsetY,
          );
          break;
        case 'd':
        case 'ㅇ':
          gameStore.setImpactOffset(
            Math.min(maxOffset, gameStore.shotInput.impactOffsetX + step),
            gameStore.shotInput.impactOffsetY,
          );
          break;
        case 'r':
          gameStore.resetShot();
          break;
        case '7':
          if (DEBUG_PRESET_ENABLED) {
            applyDebugPreset('TOPSPIN');
          }
          break;
        case '8':
          if (DEBUG_PRESET_ENABLED) {
            applyDebugPreset('BACKSPIN');
          }
          break;
        case '6':
          if (DEBUG_PRESET_ENABLED) {
            applyDebugPreset('CENTER');
          }
          break;
        case 'm':
        case 'ㅡ':
          gameStore.setAimControlMode('AUTO_SYNC');
          break;
        case '1':
          gameStore.setSystemMode('half');
          break;
        case '2':
          gameStore.setSystemMode('fiveAndHalf');
          break;
        case '3':
          gameStore.setSystemMode('plusTwo');
          break;
        case 'arrowleft':
          if (gameStore.shotInput.aimControlMode === 'MANUAL_AIM') {
            gameStore.setShotDirection(gameStore.shotInput.shotDirectionDeg - AIM_CONTROL_CONTRACT.manualArrowStepDeg);
          }
          break;
        case 'arrowright':
          if (gameStore.shotInput.aimControlMode === 'MANUAL_AIM') {
            gameStore.setShotDirection(gameStore.shotInput.shotDirectionDeg + AIM_CONTROL_CONTRACT.manualArrowStepDeg);
          }
          break;
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keydown', handleShiftDown);
    window.addEventListener('keyup', handleShiftUp);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keydown', handleShiftDown);
      window.removeEventListener('keyup', handleShiftUp);
    };
  }, [gameStore.phase, gameStore.shotInput, gameStore.fixedViewMode]);

  const topDownPos = useRef(new THREE.Vector3(0, 4.4, 0.001)).current;

  useFrame((_, delta) => {
    if (orbitControlsRef.current) {
      orbitControlsRef.current.rotateSpeed = shiftPressedRef.current ? 0.2 : 1.0;
    }

    const balls = physicsBallsRef.current;
    if (balls.length === 0) {
      return;
    }

    const cfg = physicsConfigRef.current;
    const activeCueBallId = gameStore.activeCueBallId;

    // ★ 수구 링 가시성 (early return 전에 반드시 처리)
    if (cueBallRingRef.current) {
      const showRing = !!gameStore.multiplayerContext && !gameStore.isMyTurn && gameStore.phase === 'AIMING' && !opponentFiredThisTurnRef.current;
      cueBallRingRef.current.visible = showRing;
      if (showRing) {
        const cueBallMesh = ballsRef.current.get(activeCueBallId);
        if (cueBallMesh) {
          const pos = cueBallMesh.mesh.position;
          cueBallRingRef.current.position.set(pos.x, 0.002, pos.z);
          cueBallRingRef.current.rotation.z += delta * 2;
        }
      }
    }

    // 멀티플레이어: 상대방 턴일 때 서버 스냅샷 위치 적용, 로컬 물리 스킵
    if (
      gameStore.multiplayerContext &&
      !gameStore.isMyTurn &&
      (gameStore.phase === 'SHOOTING' || gameStore.phase === 'SIMULATING')
    ) {
      const serverBalls = serverBallsRef.current;
      for (const sb of serverBalls) {
        const worldPos = physicsToWorldXZ(sb.x, sb.y);
        const meshRef = ballsRef.current.get(sb.id);
        if (meshRef) {
          meshRef.mesh.position.set(worldPos.x, BALL_RADIUS, worldPos.z);
        }
        const physBall = balls.find((b) => b.id === sb.id);
        if (physBall) {
          physBall.x = sb.x;
          physBall.y = sb.y;
          physBall.vx = sb.vx;
          physBall.vy = sb.vy;
          physBall.spinX = sb.spinX;
          physBall.spinY = sb.spinY;
          physBall.spinZ = sb.spinZ;
          physBall.isPocketed = sb.isPocketed;
        }
      }

      // ★ 서버 스냅샷 기반 궤적 데이터 수집
      if (gameStore.showBallTrail) {
        for (const sb of serverBalls) {
          if (sb.isPocketed || sb.id !== activeCueBallId) continue;
          const arr = substepPositionsRef.current.get(sb.id);
          if (arr) {
            arr.push({ x: sb.x, y: sb.y });
          } else {
            substepPositionsRef.current.set(sb.id, [{ x: sb.x, y: sb.y }]);
          }
        }

        // ★ 궤적 렌더링
        const trailColorById: Record<string, number> = { cueBall: 0xffffff };
        substepPositionsRef.current.forEach((positions, ballId) => {
          for (const phys of positions) {
            const world = physicsToWorldXZ(phys.x, phys.y);
            const pos = new THREE.Vector3(world.x, BALL_RADIUS, world.z);
            const lastPos = ballTrailLastPosRef.current.get(ballId);

            if (!lastPos || lastPos.distanceTo(pos) > BALL_RADIUS * 0.5) {
              const color = trailColorById[ballId] ?? 0xffffff;
              const tubeMat = new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: 0.3,
                depthWrite: false,
                stencilWrite: true,
                stencilRef: 1,
                stencilFunc: THREE.NotEqualStencilFunc,
                stencilZPass: THREE.ReplaceStencilOp,
              });
              if (lastPos) {
                const curve = new THREE.LineCurve3(lastPos.clone(), pos.clone());
                const tubeGeo = new THREE.TubeGeometry(curve, 1, BALL_RADIUS, 8, false);
                const mesh = new THREE.Mesh(tubeGeo, tubeMat);
                scene.add(mesh);
                const segments = ballTrailSegmentsRef.current.get(ballId) ?? [];
                segments.push(mesh);
                ballTrailSegmentsRef.current.set(ballId, segments);
              }
              // SphereGeometry cap to fill gaps at direction changes
              const capGeo = new THREE.SphereGeometry(BALL_RADIUS, 8, 8);
              const capMesh = new THREE.Mesh(capGeo, tubeMat);
              capMesh.position.copy(pos);
              scene.add(capMesh);
              const capSegments = ballTrailSegmentsRef.current.get(ballId) ?? [];
              capSegments.push(capMesh);
              ballTrailSegmentsRef.current.set(ballId, capSegments);

              ballTrailLastPosRef.current.set(ballId, pos.clone());
            }
          }
        });
        substepPositionsRef.current.clear();
      }

      return;
    }

    if (gameStore.phase === 'REPLAYING') {
      const frameData = gameStore.replayFrameData;
      const currentFrameIdx = useGameStore.getState().replayCurrentFrame;
      const isPlaying = gameStore.replayIsPlaying;

      if (frameData && frameData.frames.length > 0) {
        const frameIdx = Math.min(currentFrameIdx, frameData.frames.length - 1);
        const frame = frameData.frames[frameIdx];

        // 역방향 탐색 시 trail 클리어 + turnEndHandled 리셋
        if (currentFrameIdx < lastReplayFrameIndexRef.current) {
          clearBallTrails();
          turnEndHandledRef.current = false;
        }
        lastReplayFrameIndexRef.current = currentFrameIdx;

        // 프레임 위치를 메시에 적용
        for (const ball of frame.balls) {
          const worldPos = physicsToWorldXZ(ball.x, ball.y);
          const meshRef = ballsRef.current.get(ball.id);
          if (meshRef) {
            meshRef.mesh.position.set(worldPos.x, BALL_RADIUS, worldPos.z);
          }
        }

        // 수구 위치를 trail용 substepPositionsRef에 추가
        const cueBallFrameBall = frame.balls.find((b) => b.id === activeCueBallId);
        if (cueBallFrameBall) {
          const arr = substepPositionsRef.current.get(activeCueBallId);
          if (arr) {
            arr.push({ x: cueBallFrameBall.x, y: cueBallFrameBall.y });
          } else {
            substepPositionsRef.current.set(activeCueBallId, [{ x: cueBallFrameBall.x, y: cueBallFrameBall.y }]);
          }
        }

        // 재생 중이면 physicsAccumulator로 프레임 진행
        if (isPlaying) {
          physicsAccumulatorRef.current += delta;
          while (physicsAccumulatorRef.current >= cfg.dtSec) {
            const latestFrameIdx = useGameStore.getState().replayCurrentFrame;
            const nextFrameIdx = latestFrameIdx + 1;
            if (nextFrameIdx >= frameData.frames.length) {
              if (!turnEndHandledRef.current) {
                turnEndHandledRef.current = true;
                clearBallTrails();
                if (gameStore.selectedHistoryReplayIndex !== null) {
                  gameStore.finishHistoryReplay();
                } else if (gameStore.multiplayerContext) {
                  gameStore.finishReplaySimulation();
                  const currentState = useGameStore.getState();
                  // VAR 리플레이 완료 시 자동으로 서버에 종료 신호
                  if (
                    roomId &&
                    memberId &&
                    currentState.varPhase?.stage === 'REPLAYING' &&
                    currentState.varPhase.requesterMemberId === memberId
                  ) {
                    signalVARReplayEnd(roomId, memberId).catch(console.error);
                  } else if (
                    roomId &&
                    memberId &&
                    currentState.replayRemainingCount === 0 &&
                    currentState.replayScorerMemberId === memberId
                  ) {
                    endReplay(roomId, memberId).catch(console.error);
                  }
                } else {
                  gameStore.finishReplaySimulation();
                }
              }
              physicsAccumulatorRef.current = 0;
              break;
            } else {
              useGameStore.setState({ replayCurrentFrame: nextFrameIdx });
            }
            physicsAccumulatorRef.current -= cfg.dtSec;
          }
        }
      }
    } else {
    physicsAccumulatorRef.current += delta;

    while (physicsAccumulatorRef.current >= cfg.dtSec) {
      const substepOrderedEvents: Array<{ type: 'cushion'; id: string } | { type: 'ball'; id: string }> = [];
      const seenBalls = new Set<string>();

      stepRoomPhysicsWorld(balls, cfg, {
        onCushionCollision: (ball, cushionId) => {
          if (gameStore.showBallTrail && ball.id === activeCueBallId) {
            const arr = substepPositionsRef.current.get(ball.id);
            if (arr) {
              arr.push({ x: ball.x, y: ball.y });
            } else {
              substepPositionsRef.current.set(ball.id, [{ x: ball.x, y: ball.y }]);
            }
          }
          if (ball.id === activeCueBallId) {
            const nowMs = performance.now();
            const prev = lastCueCushionEventRef.current;
            if (
              prev &&
              prev.cushionId === cushionId &&
              nowMs - prev.atMs < CUSHION_TRACE_DEDUPE_WINDOW_MS
            ) {
              return;
            }
            lastCueCushionEventRef.current = { cushionId, atMs: nowMs };
            substepOrderedEvents.push({ type: 'cushion', id: cushionId });
            if (debugTracePartsRef.current.length >= MAX_DEBUG_TRACE_EVENTS) {
              traceWasTruncatedRef.current = true;
              return;
            }
            traceEventIndexRef.current += 1;
            debugTracePartsRef.current.push(
              `E${traceEventIndexRef.current}:CUSH(${cushionId})` +
                `[v:${Math.hypot(ball.vx, ball.vy).toFixed(3)}` +
                ` hd:${headingDeg(ball.vx, ball.vy).toFixed(1)}` +
                ` spinX:${ball.spinX.toFixed(1)}` +
                ` spinY:${ball.spinY.toFixed(1)}` +
                ` spinZ:${ball.spinZ.toFixed(1)}]`,
            );
          }
        },
        onBallCollision: (first, second) => {
          if (gameStore.showBallTrail) {
            for (const b of [first, second]) {
              if (b.id !== activeCueBallId) continue;
              const arr = substepPositionsRef.current.get(b.id);
              if (arr) {
                arr.push({ x: b.x, y: b.y });
              } else {
                substepPositionsRef.current.set(b.id, [{ x: b.x, y: b.y }]);
              }
            }
          }
          if (first.id === activeCueBallId && second.id !== activeCueBallId) {
            if (!seenBalls.has(second.id)) {
              seenBalls.add(second.id);
              substepOrderedEvents.push({ type: 'ball', id: second.id });
            }
            if (debugTracePartsRef.current.length >= MAX_DEBUG_TRACE_EVENTS) {
              traceWasTruncatedRef.current = true;
              return;
            }
            traceEventIndexRef.current += 1;
            debugTracePartsRef.current.push(
              `E${traceEventIndexRef.current}:BALL(${second.id})` +
                `[v:${Math.hypot(first.vx, first.vy).toFixed(3)}` +
                ` hd:${headingDeg(first.vx, first.vy).toFixed(1)}` +
                ` spinX:${first.spinX.toFixed(1)}` +
                ` spinZ:${first.spinZ.toFixed(1)}]`,
            );
          } else if (second.id === activeCueBallId && first.id !== activeCueBallId) {
            if (!seenBalls.has(first.id)) {
              seenBalls.add(first.id);
              substepOrderedEvents.push({ type: 'ball', id: first.id });
            }
            if (debugTracePartsRef.current.length >= MAX_DEBUG_TRACE_EVENTS) {
              traceWasTruncatedRef.current = true;
              return;
            }
            traceEventIndexRef.current += 1;
            debugTracePartsRef.current.push(
              `E${traceEventIndexRef.current}:BALL(${first.id})` +
                `[v:${Math.hypot(second.vx, second.vy).toFixed(3)}` +
                ` hd:${headingDeg(second.vx, second.vy).toFixed(1)}` +
                ` spinX:${second.spinX.toFixed(1)}` +
                ` spinZ:${second.spinZ.toFixed(1)}]`,
            );
          }
        },
        onSubstepEnd: (snapshotBalls) => {
          if (!gameStore.showBallTrail) return;
          for (const ball of snapshotBalls) {
            if (ball.isPocketed) continue;
            if (ball.id !== activeCueBallId) continue;
            const arr = substepPositionsRef.current.get(ball.id);
            if (arr) {
              arr.push({ x: ball.x, y: ball.y });
            } else {
              substepPositionsRef.current.set(ball.id, [{ x: ball.x, y: ball.y }]);
            }
          }
        },
      });

      substepOrderedEvents.forEach((e) => {
        if (e.type === 'cushion') gameStore.addCushionContact(e.id);
        else gameStore.addBallCollision(e.id);
      });

      // 리플레이용 프레임 녹화
      if (replayRecordingRef.current) {
        replayRecordingRef.current.frames.push({
          balls: balls.map((b) => ({ id: b.id, x: b.x, y: b.y })),
        });
      }

      physicsAccumulatorRef.current -= cfg.dtSec;
    }

    balls.forEach((ball) => {
      const ref = ballsRef.current.get(ball.id);
      if (!ref) {
        return;
      }
      const world = physicsToWorldXZ(ball.x, ball.y);
      ref.mesh.position.set(world.x, BALL_RADIUS, world.z);

      gameStore.updateBall(ball.id, {
        position: ref.mesh.position.clone(),
        velocity: new THREE.Vector3(ball.vx, 0, ball.vy),
        angularVelocity: new THREE.Vector3(ball.spinX, ball.spinY, ball.spinZ),
      });
    });
    } // end else (not REPLAYING)

    const shouldRenderTrail = gameStore.phase === 'REPLAYING' ||
      (gameStore.showBallTrail && (gameStore.phase === 'SHOOTING' || gameStore.phase === 'SIMULATING'));
    if (shouldRenderTrail) {
      const trailColorById: Record<string, number> = {
        cueBall: 0xffffff,
      };
      substepPositionsRef.current.forEach((positions, ballId) => {
        for (const phys of positions) {
          const world = physicsToWorldXZ(phys.x, phys.y);
          const pos = new THREE.Vector3(world.x, BALL_RADIUS, world.z);
          const lastPos = ballTrailLastPosRef.current.get(ballId);

          if (!lastPos || lastPos.distanceTo(pos) > BALL_RADIUS * 0.5) {
            const color = trailColorById[ballId] ?? 0xffffff;
            const tubeMat = new THREE.MeshBasicMaterial({
              color,
              transparent: true,
              opacity: 0.3,
              depthWrite: false,
              stencilWrite: true,
              stencilRef: 1,
              stencilFunc: THREE.NotEqualStencilFunc,
              stencilZPass: THREE.ReplaceStencilOp,
            });
            if (lastPos) {
              const curve = new THREE.LineCurve3(lastPos.clone(), pos.clone());
              const tubeGeo = new THREE.TubeGeometry(curve, 1, BALL_RADIUS, 8, false);
              const mesh = new THREE.Mesh(tubeGeo, tubeMat);
              scene.add(mesh);

              const segments = ballTrailSegmentsRef.current.get(ballId) ?? [];
              segments.push(mesh);
              ballTrailSegmentsRef.current.set(ballId, segments);
            }
            // SphereGeometry cap to fill gaps at direction changes
            const capGeo = new THREE.SphereGeometry(BALL_RADIUS, 8, 8);
            const capMesh = new THREE.Mesh(capGeo, tubeMat);
            capMesh.position.copy(pos);
            scene.add(capMesh);
            const capSegments = ballTrailSegmentsRef.current.get(ballId) ?? [];
            capSegments.push(capMesh);
            ballTrailSegmentsRef.current.set(ballId, capSegments);

            ballTrailLastPosRef.current.set(ballId, pos.clone());
          }
        }
      });
      substepPositionsRef.current.clear();
    }

    if (gameStore.phase === 'SHOOTING' || gameStore.phase === 'SIMULATING') {
      const allStopped = balls.every((ball) => ball.isPocketed || Math.hypot(ball.vx, ball.vy) < cfg.shotEndLinearSpeedThresholdMps);
      if (allStopped && !turnEndHandledRef.current) {
        turnEndHandledRef.current = true;
        // 잔상 클리어
        clearBallTrails();
        // 프레임 녹화 저장
        if (replayRecordingRef.current) {
          gameStore.saveReplayFrameData({
            frames: replayRecordingRef.current.frames,
            activeCueBallId: replayRecordingRef.current.activeCueBallId,
          });
          replayRecordingRef.current = null;
        }
        // 멀티플레이어: 서버 이벤트(turn_changed) 대기
        if (!gameStore.multiplayerContext) {
          gameStore.handleTurnEnd();
        }
      } else if (!allStopped) {
        gameStore.setPhase('SIMULATING');
      }
    }

    const cueBallRef = ballsRef.current.get(activeCueBallId);

    const showCue = cueBallRef &&
      gameStore.phase === 'AIMING' &&
      !captureParams.capture &&
      (!gameStore.multiplayerContext || gameStore.isMyTurn);
    if (showCue) {
      if (gameStore.fixedViewMode) {
        // FahScene cam=top 패턴: OrbitControls는 enabled=false로 두고 카메라만 직접 제어
        // saveState()/reset() 호출 제거 — reset() 내부 update()가 camera.up을 덮어쓰는 버그 방지
        camera.position.lerp(topDownPos, 0.25);
        camera.up.set(0, 0, -1);
        camera.lookAt(0, 0, 0);
        // fixedViewMode 해제 시 불필요한 auto-aim 카메라 점프 방지
        lastAutoAimTurnRef.current = gameStore.turnStartedAtMs;
      } else {
        // fixedViewMode 해제 시 camera.up 복원 (OrbitControls 기본 up 벡터)
        if (camera.up.z !== 0) {
          camera.up.set(0, 1, 0);
        }
      }
      if (!gameStore.fixedViewMode && gameStore.turnStartedAtMs !== lastAutoAimTurnRef.current) {
        // 새 턴 시작 시 가장 가까운 적구 방향으로 카메라 자동 조준
        lastAutoAimTurnRef.current = gameStore.turnStartedAtMs;

        const cueBallPos = cueBallRef.mesh.position;
        const activeCueBallId = gameStore.activeCueBallId;
        const objectBallIds: string[] = activeCueBallId === 'cueBall'
          ? ['objectBall1', 'objectBall2']
          : ['objectBall1', 'cueBall'];

        let nearestBallPos: THREE.Vector3 | null = null;
        let nearestDistSq = Infinity;
        for (const id of objectBallIds) {
          const ballRef = ballsRef.current.get(id);
          if (!ballRef) continue;
          const distSq = cueBallPos.distanceToSquared(ballRef.mesh.position);
          if (distSq < nearestDistSq) {
            nearestDistSq = distSq;
            nearestBallPos = ballRef.mesh.position;
          }
        }

        if (nearestBallPos) {
          const nearestDir = directionDegFromCueToTarget(cueBallPos, nearestBallPos);
          const dirRad = nearestDir * Math.PI / 180;
          const distFromBall = camera.position.distanceTo(cueBallPos);
          const height = camera.position.y;
          const horizontalDist = Math.sqrt(Math.max(0, distFromBall * distFromBall - height * height));
          camera.position.set(
            cueBallPos.x - Math.sin(dirRad) * horizontalDist,
            height,
            cueBallPos.z - Math.cos(dirRad) * horizontalDist,
          );
          if (orbitControlsRef.current) {
            orbitControlsRef.current.target.copy(cueBallPos);
            orbitControlsRef.current.update();
          }
        }
      }
      tempDir.current.copy(cueBallRef.mesh.position).sub(camera.position);
      tempDir.current.y = 0;
      if (
        tempDir.current.lengthSq() > 1e-6 &&
        !gameStore.isDragging &&
        gameStore.shotInput.aimControlMode === 'AUTO_SYNC' &&
        !gameStore.fixedViewMode
      ) {
        tempDir.current.normalize();
        const cameraSyncedDeg = ((Math.atan2(tempDir.current.x, tempDir.current.z) * 180) / Math.PI + 360) % 360;
        if (Math.abs(cameraSyncedDeg - gameStore.shotInput.shotDirectionDeg) > AIM_CONTROL_CONTRACT.cameraSyncEpsilonDeg) {
          gameStore.setShotDirection(cameraSyncedDeg);
        }
      }

      cueStickRef.current?.update(
        cueBallRef.mesh.position,
        gameStore.shotInput.shotDirectionDeg,
        gameStore.shotInput.cueElevationDeg,
        -gameStore.shotInput.impactOffsetX,
        gameStore.shotInput.impactOffsetY,
        gameStore.shotInput.dragPx,
        gameStore.isDragging,
      );
      cueStickRef.current?.setVisible(true);
    } else {
      cueStickRef.current?.setVisible(false);
    }

    const setGuideLinePoints = (line: THREE.Line | null, points: THREE.Vector3[]) => {
      if (!line) return;
      if (points.length < 2) {
        line.visible = false;
        return;
      }
      const positions = points.flatMap((p) => [p.x, p.y, p.z]);
      line.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      line.geometry.computeBoundingSphere();
      line.visible = true;
    };

    if (showCue) {
      const cue = cueBallRef!.mesh.position;
      const object1 = ballsRef.current.get('objectBall1')?.mesh.position;
      const object2Id = gameStore.activeCueBallId === 'cueBall' ? 'objectBall2' : 'cueBall';
      const object2 = ballsRef.current.get(object2Id)?.mesh.position;
      if (object1 && object2) {
        const guideY = BALL_RADIUS + 0.01;
        const directionRad = (gameStore.shotInput.shotDirectionDeg * Math.PI) / 180;
        const dir = new THREE.Vector3(Math.sin(directionRad), 0, Math.cos(directionRad)).normalize();
        const start = new THREE.Vector3(cue.x, guideY, cue.z);
        const minX = -TABLE_WIDTH / 2 + BALL_RADIUS;
        const maxX = TABLE_WIDTH / 2 - BALL_RADIUS;
        const minZ = -TABLE_HEIGHT / 2 + BALL_RADIUS;
        const maxZ = TABLE_HEIGHT / 2 - BALL_RADIUS;

        const findBoundaryHit = (): { t: number; point: THREE.Vector3; axis: 'x' | 'y' } => {
          let bestT = Number.POSITIVE_INFINITY;
          let bestPoint = start.clone();
          let bestAxis: 'x' | 'y' = 'x';
          if (Math.abs(dir.x) > 1e-8) {
            const txMin = (minX - start.x) / dir.x;
            if (txMin > 0 && txMin < bestT) {
              bestT = txMin;
              bestPoint = new THREE.Vector3(minX, guideY, start.z + dir.z * txMin);
              bestAxis = 'x';
            }
            const txMax = (maxX - start.x) / dir.x;
            if (txMax > 0 && txMax < bestT) {
              bestT = txMax;
              bestPoint = new THREE.Vector3(maxX, guideY, start.z + dir.z * txMax);
              bestAxis = 'x';
            }
          }
          if (Math.abs(dir.z) > 1e-8) {
            const tzMin = (minZ - start.z) / dir.z;
            if (tzMin > 0 && tzMin < bestT) {
              bestT = tzMin;
              bestPoint = new THREE.Vector3(start.x + dir.x * tzMin, guideY, minZ);
              bestAxis = 'y';
            }
            const tzMax = (maxZ - start.z) / dir.z;
            if (tzMax > 0 && tzMax < bestT) {
              bestT = tzMax;
              bestPoint = new THREE.Vector3(start.x + dir.x * tzMax, guideY, maxZ);
              bestAxis = 'y';
            }
          }
          return { t: bestT, point: bestPoint, axis: bestAxis };
        };

        const rayCircleHit = (center: THREE.Vector3, radius: number): number | null => {
          const relX = start.x - center.x;
          const relZ = start.z - center.z;
          const b = 2 * (dir.x * relX + dir.z * relZ);
          const c = relX * relX + relZ * relZ - radius * radius;
          const disc = b * b - 4 * c;
          if (disc < 0) return null;
          const s = Math.sqrt(disc);
          const t1 = (-b - s) / 2;
          const t2 = (-b + s) / 2;
          const t = t1 > 1e-6 ? t1 : t2 > 1e-6 ? t2 : Number.NaN;
          return Number.isFinite(t) ? t : null;
        };

        const objects = [
          { id: 'objectBall1', pos: object1 },
          { id: object2Id, pos: object2 },
        ];
        const objectRadius = BALL_RADIUS * 2;
        let bestObject: { id: string; pos: THREE.Vector3; t: number } | null = null;
        for (const obj of objects) {
          const t = rayCircleHit(obj.pos, objectRadius);
          if (t !== null && (bestObject === null || t < bestObject.t)) {
            bestObject = { ...obj, t };
          }
        }

        const boundaryHit = findBoundaryHit();
        const willHitObject = bestObject !== null && bestObject.t < boundaryHit.t;

        if (willHitObject && bestObject) {
          const hitPoint = start.clone().addScaledVector(dir, bestObject.t);
          const normal = bestObject.pos.clone().setY(guideY).sub(hitPoint).normalize();
          let cueOut = dir.clone().sub(normal.clone().multiplyScalar(dir.dot(normal)));
          if (cueOut.lengthSq() < 1e-8) {
            cueOut = new THREE.Vector3(-normal.z, 0, normal.x);
          }
          cueOut.normalize();
          const objectOut = normal.clone().normalize();
          setGuideLinePoints(guideCuePathRef.current, [start, hitPoint]);
          setGuideLinePoints(
            guidePostCuePathRef.current,
            [hitPoint, hitPoint.clone().addScaledVector(cueOut, 0.6)],
          );
          setGuideLinePoints(
            guideObjectPathRef.current,
            [bestObject.pos.clone().setY(guideY), bestObject.pos.clone().setY(guideY).addScaledVector(objectOut, 0.8)],
          );
        } else {
          const hitPoint = boundaryHit.point;
          const shotInit = computeShotInitialization({
            dragPx: gameStore.shotInput.dragPx,
            impactOffsetX: -gameStore.shotInput.impactOffsetX,
            impactOffsetY: gameStore.shotInput.impactOffsetY,
          });
          const speedForGuide = Math.max(5, shotInit.initialBallSpeedMps);
          const cfg = physicsConfigRef.current;
          const collision = applyCushionContactThrow({
            axis: boundaryHit.axis,
            vx: dir.x * speedForGuide,
            vy: dir.z * speedForGuide,
            spinX: shotInit.omegaX * dir.z,
            spinY: -shotInit.omegaX * dir.x,
            spinZ: shotInit.omegaZ,
            restitution: cfg.cushionRestitution,
            contactFriction: cfg.cushionContactFriction,
            referenceNormalSpeedMps: cfg.cushionReferenceSpeedMps,
            contactTimeExponent: cfg.cushionContactTimeExponent,
            maxSpinMagnitude: cfg.cushionMaxSpinMagnitude,
            maxThrowAngleDeg: cfg.cushionMaxThrowAngleDeg,
            ballMassKg: cfg.ballMassKg,
            ballRadiusM: cfg.ballRadiusM,
            cushionHeightM: cfg.cushionHeightM,
            rollingSpinHeightFactor: cfg.cushionRollingSpinHeightFactor,
            cushionTorqueDamping: cfg.cushionTorqueDamping,
            maxSpeedScale: cfg.cushionMaxSpeedScale,
            frictionSpinDamping: cfg.cushionFrictionSpinDamping,
            restitutionLow: cfg.cushionRestitutionLow,
            restitutionHigh: cfg.cushionRestitutionHigh,
            restitutionMidSpeedMps: cfg.cushionRestitutionMidSpeedMps,
            restitutionSigmoidK: cfg.cushionRestitutionSigmoidK,
          });
          const post = new THREE.Vector3(collision.vx, 0, collision.vy);
          if (post.lengthSq() > 1e-8) {
            post.normalize();
          }
          setGuideLinePoints(guideCuePathRef.current, [start, hitPoint]);
          setGuideLinePoints(
            guidePostCuePathRef.current,
            [hitPoint, hitPoint.clone().addScaledVector(post, 0.9)],
          );
          setGuideLinePoints(guideObjectPathRef.current, []);
        }
      }
    } else {
      setGuideLinePoints(guideCuePathRef.current, []);
      setGuideLinePoints(guidePostCuePathRef.current, []);
      setGuideLinePoints(guideObjectPathRef.current, []);
    }

    if (showCue) {
      impactPointRef.current?.update(
        -gameStore.shotInput.impactOffsetX,
        gameStore.shotInput.impactOffsetY,
        cueBallRef!.mesh.position,
        gameStore.shotInput.shotDirectionDeg,
        gameStore.shotInput.cueElevationDeg,
      );
      impactPointRef.current?.setVisible(true);
    } else {
      impactPointRef.current?.setVisible(false);
    }
  });

  return (
    <>
      <ambientLight intensity={0.4} />
      <spotLight
        position={[0, 10, 0]}
        angle={Math.PI / 3}
        penumbra={0.3}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.00012}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[5, 5, 5]} intensity={0.5} />

      <OrbitControls
        ref={orbitControlsRef}
        enabled={!captureParams.capture && gameStore.phase === 'AIMING' && !gameStore.isDragging && !gameStore.fixedViewMode}
        mouseButtons={{ LEFT: undefined, MIDDLE: undefined, RIGHT: 0 }}
        enablePan={false}
        minDistance={2}
        maxDistance={8}
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2.5}
        target={[0, 0, 0]}
      />
    </>
  );
}

/**
 * 로딩 화면
 */
function LoadingScreen() {
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, width: '100vw', height: '100vh',
      background: '#1a1a2e',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      color: 'white',
      zIndex: 9999,
    }}>
      <div style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 20, color: '#00ff88' }}>
        3-Cushion Billiards
      </div>
      <div style={{ fontSize: 16, opacity: 0.7 }}>Loading Physics Engine...</div>
    </div>
  );
}

type SpeechBubbles3DProps = {
  chatMessages: ChatMessage[];
  members: Array<{ memberId: string; displayName: string }>;
};

function seededRandom(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return (h >>> 0) / 0xffffffff;
}

function SpeechBubbles3D({ chatMessages, members }: SpeechBubbles3DProps) {
  const bubbles = useMemo(() => {
    if (members.length === 0) return [];
    const latestByMember = new Map<string, ChatMessage>();
    for (const msg of chatMessages) {
      latestByMember.set(msg.senderMemberId, msg);
    }
    const raw = members.slice(0, 2).map((member, idx) => {
      const msg = latestByMember.get(member.memberId);
      return msg ? { msg, idx } : null;
    }).filter((x): x is { msg: ChatMessage; idx: number } => x !== null);

    const usedSlots: number[] = [];
    return raw.map(({ msg, idx }) => {
      const available = [0, 1, 2, 3].filter(s => !usedSlots.includes(s));
      const r = seededRandom(msg.sentAt);
      const slotIndex = available[Math.floor(r * available.length)];
      usedSlots.push(slotIndex);
      return { msg, idx, slotIndex };
    });
  }, [chatMessages, members]);

  return (
    <>
      {bubbles.map(({ msg, idx, slotIndex }) => (
        <SpeechBubble key={`${msg.senderMemberId}-${msg.sentAt}`} message={msg} slotIndex={slotIndex} />
      ))}
    </>
  );
}

type GameSceneProps = {
  roomId?: string;
  memberId?: string;
  members?: Array<{ memberId: string; displayName: string }>;
  eventSource?: EventSource;
  chatMessages?: ChatMessage[];
  onSendChat?: (text: string) => void;
};

/**
 * 메인 게임 씬
 */
export function GameScene({ roomId, memberId, members, eventSource, chatMessages = [], onSendChat }: GameSceneProps = {}) {
  const captureParams = readCaptureParams();
  const cameraPosition: [number, number, number] =
    captureParams.cam === 'top'
      ? [0, 4.4, 0.001]
      : captureParams.cam === 'side'
        ? [0, 1.5, 3.5]
        : [0, 4, 0];

  function handleSendChat(text: string) {
    if (onSendChat) {
      onSendChat(text);
    } else if (roomId && memberId) {
      sendRoomChatMessage(roomId, memberId, text).catch(() => { /* non-fatal */ });
    }
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Suspense fallback={<LoadingScreen />}>
        <Canvas
          shadows
          gl={{ antialias: true, alpha: false }}
          style={{ width: '100%', height: '100%' }}
          onCreated={({ gl }) => {
            gl.setClearColor('#1a1a2e');
          }}
        >
          <PerspectiveCamera makeDefault fov={captureParams.cam === 'side' ? 42 : 50} position={cameraPosition} />
          <GameWorld roomId={roomId} memberId={memberId} members={members} eventSource={eventSource} />
          {!captureParams.capture && (
            <SpeechBubbles3D chatMessages={chatMessages} members={members ?? []} />
          )}
        </Canvas>
        {!captureParams.capture && (
          <GameUI
            chatMessages={chatMessages}
            onSendChat={handleSendChat}
            currentMemberId={memberId}
            members={members}
          />
        )}
      </Suspense>
    </div>
  );
}

import { useEffect, useRef, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useLocation, useNavigate } from 'react-router-dom';
import * as THREE from 'three';

import { CueStick } from '../ammo/CueStick';
import { ImpactPoint } from '../ammo/ImpactPoint';
import { useGameStore } from '../stores/gameStore';
import { useFahStore } from '../stores/fahStore';
import { PHYSICS, INPUT_LIMITS } from '../lib/constants';
import { FahUI } from './FahUI';
import {
  buildFahIndexModel,
  inferFahStartSide,
  mapFahRailRatioToIndex,
  quantizeFahIndexToNearestHalfStep,
  type FahIndexModel,
  type FahCushionSide,
  type FahRailSide,
} from '../lib/fah-index-system';
import {
  resolveFahGuidelineFromCalibration,
  type FahCalibrationEntry,
} from '../lib/fah-guideline';
import { createRoomPhysicsStepConfig } from '../../../../packages/physics-core/src/room-physics-config.ts';
import { stepRoomPhysicsWorld, type PhysicsBallState, type CushionId } from '../../../../packages/physics-core/src/room-physics-step.ts';
import { computeShotInitialization } from '../../../../packages/physics-core/src/shot-init.ts';
import { isMiscue } from '../../../../packages/physics-core/src/miscue.ts';

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
// cam=top 기준 장쿠션 9포인트: 오른쪽 0 -> 왼쪽 80 (10 단위)
const FAH_POINT_MAX = 80;
// cam=top debug alignment: fixed cue-ball anchor chosen from the calibrated guide pass.
const FAH_FIXED_CUE_WORLD_X = -TABLE_WIDTH / 2 + 0.36;
const FAH_FIXED_CUE_WORLD_Z = -0.471637;
const FAH_FIRST_RAIL_AIM_SIDE_LEAD = 0.12;
const FAH_REALISM_OVERRIDES = {
  cushionRestitution: 0.72,
  cushionContactFriction: 0.14,
  clothLinearSpinCouplingPerSec: 1.03,
  spinDampingPerTick: 0.988,
  linearDampingPerTick: 0.985,
  cushionPostCollisionSpeedScale: 1.0,
  cushionSpinMonotonicRetention: 0.93,
};
const FAH_SPEED_BOOST = 1.0;
// FAH 좌표계 기준(화면 기준 가로 테이블):
// - 하단/상단은 단쿠션, 좌측/우측은 장쿠션으로만 표기한다.
// - 1쿠션 인덱스는 0,10,20,30,40,50,70,90,110 스케일 + 구간별 반칸 인덱스 규칙을 사용한다.
const DEBUG_PRESET_ENABLED = false;
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

type FahCushionHitEvent = {
  order: number;
  cushion: FahCushionSide;
  x: number;
  z: number;
  atMs: number;
};

function normalizeFahCushionId(cushion: CushionId): FahCushionSide {
  return cushion;
}

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

/**
 * 3D 게임 월드
 */
function GameWorld() {
  const { scene, camera } = useThree();
  const captureParams = readCaptureParams();
  const gameStore = useGameStore();
  const fahStore = useFahStore();
  const fahCalibrationEntries: FahCalibrationEntry[] = [];

  const physicsConfigRef = useRef(createRoomPhysicsStepConfig('default', FAH_REALISM_OVERRIDES));
  const physicsAccumulatorRef = useRef(0);
  const physicsBallsRef = useRef<PhysicsBallState[]>([]);
  const cueStickRef = useRef<CueStick | null>(null);
  const impactPointRef = useRef<ImpactPoint | null>(null);
  const ballsRef = useRef<Map<string, { mesh: THREE.Mesh }>>(new Map());
  const guideCuePathRef = useRef<THREE.Line | null>(null);
  const guidePostCuePathRef = useRef<THREE.Line | null>(null);
  const guideObjectPathRef = useRef<THREE.Line | null>(null);
  const guideFahPathRef = useRef<THREE.Line | null>(null);
  const guideFahYellowLineRef = useRef<THREE.Line | null>(null);
  const guideFahRedLineRef = useRef<THREE.Line | null>(null);
  const guideFahFirstCushionMarkerRef = useRef<THREE.Mesh | null>(null);
  const fahTestShotTraceRef = useRef<{
    shotId: string;
    startedAtMs: number;
    shotInput: {
      shotDirectionDeg: number;
      cueElevationDeg: number;
      dragPx: number;
      impactOffsetX: number;
      impactOffsetY: number;
      requestedTargetPoint: number | null;
      correctedTargetPoint: number | null;
    };
    indexModel: FahIndexModel;
    cushionHits: FahCushionHitEvent[];
    points: Array<{ tMs: number; x: number; z: number; speedMps: number; headingDeg: number }>;
  } | null>(null);
  const fahLastIndexModelRef = useRef<FahIndexModel | null>(null);
  const debugTracePartsRef = useRef<string[]>([]);
  const traceEventIndexRef = useRef(0);
  const traceWasTruncatedRef = useRef(false);
  const lastCueCushionEventRef = useRef<{ cushionId: CushionId; atMs: number } | null>(null);
  const turnEndHandledRef = useRef(false);
  const guideStartRef = useRef<THREE.Vector3 | null>(null);
  const ballTrailLastPosRef = useRef<Map<string, THREE.Vector3>>(new Map());
  const ballTrailSegmentsRef = useRef<Map<string, THREE.Mesh[]>>(new Map());
  const substepPositionsRef = useRef<Map<string, Array<{ x: number; y: number }>>>(new Map());

  const dragState = useRef<{
    isDragging: boolean;
    startY: number;
    currentPower: number;
  }>({
    isDragging: false,
    startY: 0,
    currentPower: INPUT_LIMITS.DRAG_MIN,
  });

  const prevPhaseRef = useRef(gameStore.phase);
  const activeDebugPresetRef = useRef<DebugPresetName>('CENTER');


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
    guideFahPathRef.current = createGuideLine(0xff79c6);
    guideFahYellowLineRef.current = createGuideLine(0xffe85a);
    guideFahRedLineRef.current = createGuideLine(0xff4d4d);
    const markerGeo = new THREE.SphereGeometry(BALL_RADIUS * 0.35, 24, 24);
    const markerMat = new THREE.MeshStandardMaterial({
      color: 0xff5a5f,
      emissive: 0x661111,
      roughness: 0.25,
      metalness: 0.1,
    });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.visible = false;
    scene.add(marker);
    guideFahFirstCushionMarkerRef.current = marker;
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
      disposeLine(guideFahPathRef.current);
      disposeLine(guideFahYellowLineRef.current);
      disposeLine(guideFahRedLineRef.current);
      if (guideFahFirstCushionMarkerRef.current) {
        scene.remove(guideFahFirstCushionMarkerRef.current);
        guideFahFirstCushionMarkerRef.current.geometry.dispose();
        (guideFahFirstCushionMarkerRef.current.material as THREE.Material).dispose();
      }
      guideCuePathRef.current = null;
      guidePostCuePathRef.current = null;
      guideObjectPathRef.current = null;
      guideFahPathRef.current = null;
      guideFahYellowLineRef.current = null;
      guideFahRedLineRef.current = null;
      guideFahFirstCushionMarkerRef.current = null;
      ballTrailSegmentsRef.current.forEach((segments) => {
        segments.forEach((mesh) => {
          scene.remove(mesh);
          mesh.geometry.dispose();
          (mesh.material as THREE.Material).dispose();
        });
      });
      ballTrailSegmentsRef.current.clear();
      ballTrailLastPosRef.current.clear();
    };
  }, [scene]);

  useEffect(() => {
    clearBalls();
    createBalls();
    physicsAccumulatorRef.current = 0;
  }, [scene]);

  useEffect(() => {
    physicsConfigRef.current = createRoomPhysicsStepConfig('default', FAH_REALISM_OVERRIDES);
    physicsAccumulatorRef.current = 0;
  }, []);

  useEffect(() => {
    if (gameStore.phase === 'SHOOTING') {
      turnEndHandledRef.current = false;
    }
  }, [gameStore.phase]);

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

    const setBall = (id: 'cueBall', pos: THREE.Vector3) => {
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
    physicsAccumulatorRef.current = 0;

    gameStore.setPhase('AIMING');
    gameStore.setAimControlMode('MANUAL_AIM');
    const alignedDirectionDeg = preset.directionDeg;
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

  useEffect(() => {
    if (gameStore.phase !== 'AIMING') {
      return;
    }
    const cue = ballsRef.current.get('cueBall')?.mesh;
    const cuePhysics = physicsBallsRef.current.find((ball) => ball.id === 'cueBall');
    if (!cue || !cuePhysics) {
      return;
    }
    cue.position.set(FAH_FIXED_CUE_WORLD_X, BALL_RADIUS, FAH_FIXED_CUE_WORLD_Z);
    cuePhysics.x = FAH_FIXED_CUE_WORLD_X + TABLE_WIDTH / 2;
    cuePhysics.y = FAH_FIXED_CUE_WORLD_Z + TABLE_HEIGHT / 2;
    cuePhysics.vx = 0;
    cuePhysics.vy = 0;
    cuePhysics.spinX = 0;
    cuePhysics.spinY = 0;
    cuePhysics.spinZ = 0;
    gameStore.updateBall('cueBall', {
      position: cue.position.clone(),
      velocity: new THREE.Vector3(0, 0, 0),
      angularVelocity: new THREE.Vector3(0, 0, 0),
      isPocketed: false,
    });
    gameStore.setCueElevation(0);
  }, [gameStore.phase]);

  useEffect(() => {
    if (gameStore.phase !== 'AIMING') {
      return;
    }
    const cue = ballsRef.current.get('cueBall')?.mesh;
    if (!cue) {
      return;
    }
    const firstRailTarget = computeFahDiamondGuideTarget(fahStore.fahTestTargetPoint, cue.position.y);
    const shotDirectionDeg = directionDegFromCueToTarget(cue.position, firstRailTarget);
    if (Math.abs(shotDirectionDeg - gameStore.shotInput.shotDirectionDeg) > 0.05) {
      gameStore.setShotDirection(shotDirectionDeg);
    }
    // Keep FAH aim locked to the selected anchor so cue/guide/point stay collinear.
  }, [gameStore.phase, fahStore.fahTestTargetPoint, gameStore.shotInput.shotDirectionDeg]);

  const clearBalls = () => {
    for (const { mesh } of ballsRef.current.values()) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    ballsRef.current.clear();
    physicsBallsRef.current = [];
  };

  const createBalls = () => {
    const cueState = gameStore.balls.find((ball) => ball.id === 'cueBall');
    const cuePos = cueState?.position ?? new THREE.Vector3(FAH_FIXED_CUE_WORLD_X, BALL_RADIUS, FAH_FIXED_CUE_WORLD_Z);
    const physicsBalls: PhysicsBallState[] = [];
    const geometry = new THREE.SphereGeometry(BALL_RADIUS, 32, 32);
    const material = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.05,
      metalness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(cuePos.x, cuePos.y, cuePos.z);
    scene.add(mesh);
    ballsRef.current.set('cueBall', { mesh });

    const physicsPos = worldToPhysicsXY(cuePos.x, cuePos.z);
    physicsBalls.push({
      id: 'cueBall',
      x: physicsPos.x,
      y: physicsPos.y,
      vx: 0,
      vy: 0,
      spinX: 0,
      spinY: 0,
      spinZ: 0,
      isPocketed: false,
    });

    physicsBallsRef.current = physicsBalls;
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
    requestedTargetPoint?: number | null;
    correctedTargetPoint?: number | null;
  }) => {
    const shotInput = {
      ...gameStore.shotInput,
      ...(overrideShotInput ?? {}),
    };
    shotInput.cueElevationDeg = 0;
    const shotCueBallId = 'cueBall';
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
    initialBallSpeedMps *= FAH_SPEED_BOOST;
    omegaX *= FAH_SPEED_BOOST;
    omegaZ *= FAH_SPEED_BOOST;
    if (typeof window !== 'undefined') {
      const cue = gameStore.balls.find((ball) => ball.id === shotCueBallId)?.position;
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
        `speedBoost:${FAH_SPEED_BOOST.toFixed(3)} ` +
        `dragPx:${shotInput.dragPx.toFixed(1)} ` +
        `impactOffsetX(UI):${shotInput.impactOffsetX.toFixed(4)} ` +
        `impactOffsetX(phys):${impactOffsetXForPhysics.toFixed(4)} ` +
        `impactOffsetY:${shotInput.impactOffsetY.toFixed(4)} ` +
        `dynProfile:N dynBlend:g0.000_c0.000 dynRest:0.000 dynFric:0.000 ` +
        `cueX:${(cue?.x ?? 0).toFixed(4)} ` +
        `cueZ:${(cue?.z ?? 0).toFixed(4)} ` +
        `obj1X:${(0).toFixed(4)} ` +
        `obj1Z:${(0).toFixed(4)} ` +
        `obj2X:${(0).toFixed(4)} ` +
        `obj2Z:${(0).toFixed(4)}`;
      window.sessionStorage.setItem('bhc.lastShotDebugLine', lastShotLine);
    }
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
    const cueMesh = ballsRef.current.get('cueBall')?.mesh;
    const fallbackCue = new THREE.Vector3(FAH_FIXED_CUE_WORLD_X, BALL_RADIUS, FAH_FIXED_CUE_WORLD_Z);
    const indexModel =
      fahLastIndexModelRef.current ??
      computeFahShotIndexModel(cueMesh?.position ?? fallbackCue, fahStore.fahTestTargetPoint);
    fahTestShotTraceRef.current = {
      shotId: `fah-test-shot-${Date.now()}`,
      startedAtMs: performance.now(),
      shotInput: {
        shotDirectionDeg: shotInput.shotDirectionDeg,
        cueElevationDeg: shotInput.cueElevationDeg,
        dragPx: shotInput.dragPx,
        impactOffsetX: shotInput.impactOffsetX,
        impactOffsetY: shotInput.impactOffsetY,
        requestedTargetPoint:
          typeof shotInput.requestedTargetPoint === 'number' ? shotInput.requestedTargetPoint : null,
        correctedTargetPoint:
          typeof shotInput.correctedTargetPoint === 'number' ? shotInput.correctedTargetPoint : null,
      },
      indexModel,
      cushionHits: [],
      points: [],
    };

    gameStore.executeShot();
    cueStickRef.current?.animateShot();
  };

    const runFahTestTargetShot = (targetPoint: number) => {
    const cue = ballsRef.current.get('cueBall')?.mesh;
    const cuePhysics = physicsBallsRef.current.find((ball) => ball.id === 'cueBall');
    if (!cue || !cuePhysics) {
      return;
    }

    // 다이아 (1,1) 고정
    const cueX = FAH_FIXED_CUE_WORLD_X;
    const cueZ = FAH_FIXED_CUE_WORLD_Z;
    cue.position.set(cueX, BALL_RADIUS, cueZ);
    cuePhysics.x = cueX + TABLE_WIDTH / 2;
    cuePhysics.y = cueZ + TABLE_HEIGHT / 2;
    cuePhysics.vx = 0;
    cuePhysics.vy = 0;
    cuePhysics.spinX = 0;
    cuePhysics.spinY = 0;
    cuePhysics.spinZ = 0;
    gameStore.updateBall('cueBall', {
      position: cue.position.clone(),
      velocity: new THREE.Vector3(0, 0, 0),
      angularVelocity: new THREE.Vector3(0, 0, 0),
      isPocketed: false,
    });

    const safeTargetPoint = Number.isFinite(targetPoint) ? targetPoint : 10;
    const correctedTargetPoint = clamp(safeTargetPoint, 0, FAH_POINT_MAX);
    const correctedTargetIndex = quantizeFahIndexToNearestHalfStep(correctedTargetPoint);
    const indexModel = computeFahShotIndexModel(cue.position, correctedTargetIndex);
    fahLastIndexModelRef.current = indexModel;
    const firstRailTarget = computeFahCompensatedAimTarget(
      cue.position,
      indexModel.firstCushionSide,
      indexModel.firstCushionIndex,
    );
    const shotDirectionDeg = directionDegFromCueToTarget(cue.position, firstRailTarget);
    physicsConfigRef.current = createRoomPhysicsStepConfig('default', FAH_REALISM_OVERRIDES);
    physicsAccumulatorRef.current = 0;

    gameStore.setSystemMode('fiveAndHalf');
    gameStore.setShotDirection(shotDirectionDeg);
    gameStore.setCueElevation(0);
    gameStore.setTurnMessage(
      `FAH TEST SHOT req=${safeTargetPoint} corr=${Math.round(correctedTargetPoint * 1000) / 1000} ` +
        `S${indexModel.startIndex} - F${indexModel.firstCushionIndex} = T${indexModel.expectedThirdIndex} | ` +
        `aimX=${firstRailTarget.x.toFixed(3)} | dyn(off)`,
    );

    executeShot({
      shotDirectionDeg,
      dragPx: gameStore.shotInput.dragPx,
      cueElevationDeg: 0,
      impactOffsetX: gameStore.shotInput.impactOffsetX,
      impactOffsetY: gameStore.shotInput.impactOffsetY,
      requestedTargetPoint: safeTargetPoint,
      correctedTargetPoint: correctedTargetIndex,
    });
  };

  useEffect(() => {
    if (!fahStore.fahTestShotRequest || gameStore.phase !== 'AIMING') {
      return;
    }
    runFahTestTargetShot(fahStore.fahTestShotRequest.targetPoint);
    fahStore.clearFahTestShotRequest();
  }, [fahStore.fahTestShotRequest, gameStore.phase]);

  const computeFahStartIndexFromCue = (cue: THREE.Vector3): number => {
    const topX = TABLE_WIDTH / 2 - BALL_RADIUS;
    const bottomX = -TABLE_WIDTH / 2 + BALL_RADIUS;
    // 장쿠션 축은 상(원근 기준 x+) -> 하(x-)로 증가 방향 고정.
    const ratio = clamp((topX - cue.x) / (topX - bottomX), 0, 1);
    return quantizeFahIndexToNearestHalfStep(mapFahRailRatioToIndex(ratio));
  };

  const computeFahShotIndexModel = (cue: THREE.Vector3, firstCushionIndex: number): FahIndexModel => {
    const startIndex = computeFahStartIndexFromCue(cue);
    const startSide = inferFahStartSide(cue.x);
    return buildFahIndexModel(startIndex, firstCushionIndex, startSide);
  };

  const computeFahDiamondGuideTarget = (point: number, y: number): THREE.Vector3 => {
    const clampedPoint = clamp(point, 0, FAH_POINT_MAX);
    const x = TABLE_WIDTH / 2 - (clampedPoint / 10) * DIAMOND_STEP_X;
    const frameThickness = 0.15;
    // cam=top 화면 기준 하단 장쿠션(화면 하단)은 월드 +Z 쪽이다.
    const longRailZ = TABLE_HEIGHT / 2 + PHYSICS.CUSHION_THICKNESS + frameThickness / 2;
    return new THREE.Vector3(x, y, longRailZ);
  };

  const computeFahFirstRailTarget = (
    side: FahRailSide,
    firstCushionIndex: number,
    mode: 'aim' | 'marker' = 'aim',
  ): THREE.Vector3 => {
    const targetRatio = clamp(firstCushionIndex, 0, FAH_POINT_MAX) / FAH_POINT_MAX;
    const leftRailX = -TABLE_WIDTH / 2;
    const rightRailX = TABLE_WIDTH / 2;
    const targetX = rightRailX - targetRatio * (rightRailX - leftRailX);
    const sideZSign = side === 'right' ? 1 : -1;
    const aimTargetZ = sideZSign * (TABLE_HEIGHT / 2 - BALL_RADIUS + FAH_FIRST_RAIL_AIM_SIDE_LEAD);
    const markerTargetZ = sideZSign * (TABLE_HEIGHT / 2 + PHYSICS.CUSHION_THICKNESS / 2);

    return new THREE.Vector3(
      targetX,
      BALL_RADIUS + 0.008,
      mode === 'marker' ? markerTargetZ : aimTargetZ,
    );
  };

  const computeFahShortRailTarget = (
    side: FahRailSide,
    cushionIndex: number,
    mode: 'aim' | 'marker' = 'marker',
  ): THREE.Vector3 => {
    // cam=top 화면 기준 단쿠션 인덱스:
    // 0 = 화면 위, 40 = 화면 아래
    const topRailZ = -TABLE_HEIGHT / 2;
    const bottomRailZ = TABLE_HEIGHT / 2;
    const targetRatio = clamp(cushionIndex, 0, 40) / 40;
    const targetZ = topRailZ + targetRatio * (bottomRailZ - topRailZ);
    const sideXSign = side === 'right' ? 1 : -1;
    const aimTargetX = sideXSign * (TABLE_WIDTH / 2 - BALL_RADIUS + FAH_FIRST_RAIL_AIM_SIDE_LEAD);
    const markerTargetX = sideXSign * (TABLE_WIDTH / 2 + PHYSICS.CUSHION_THICKNESS / 2);
    return new THREE.Vector3(
      mode === 'marker' ? markerTargetX : aimTargetX,
      BALL_RADIUS + 0.008,
      targetZ,
    );
  };

  const computeFahLongRailTarget = (
    rail: 'top' | 'bottom',
    cushionIndex: number,
    mode: 'aim' | 'marker' = 'marker',
  ): THREE.Vector3 => {
    const clampedIndex = clamp(cushionIndex, 0, 110);
    const leftRailX = -TABLE_WIDTH / 2;
    const rightRailX = TABLE_WIDTH / 2;
    const targetRatio = clampedIndex / 110;
    const targetX = rightRailX - targetRatio * (rightRailX - leftRailX);
    // cam=top 화면 기준: top -> 월드 -Z, bottom -> 월드 +Z
    const railZSign = rail === 'top' ? -1 : 1;
    const aimTargetZ = railZSign * (TABLE_HEIGHT / 2 - BALL_RADIUS + FAH_FIRST_RAIL_AIM_SIDE_LEAD);
    const markerTargetZ = railZSign * (TABLE_HEIGHT / 2 + PHYSICS.CUSHION_THICKNESS / 2);
    return new THREE.Vector3(
      targetX,
      BALL_RADIUS + 0.008,
      mode === 'marker' ? markerTargetZ : aimTargetZ,
    );
  };

  // 표시 포인트(다이아 기준)와 실제 충돌면 깊이 차이를 반영해
  // 요청 포인트를 맞추기 위한 조준점을 계산한다.
  const computeFahCompensatedAimTarget = (
    cue: THREE.Vector3,
    side: FahRailSide,
    requestedFirstCushionIndex: number,
  ): THREE.Vector3 => {
    const markerPoint = computeFahFirstRailTarget(side, requestedFirstCushionIndex, 'marker');
    const collisionPoint = computeFahFirstRailTarget(side, requestedFirstCushionIndex, 'aim');
    const markerDepth = markerPoint.z - cue.z;
    const collisionDepth = collisionPoint.z - cue.z;
    if (Math.abs(markerDepth) <= 1e-6) {
      return collisionPoint;
    }
    // Keep the visual marker line and solve its intersection on the real collision plane.
    const depthRatio = collisionDepth / markerDepth;
    const compensatedX = cue.x + (markerPoint.x - cue.x) * depthRatio;
    const clampedX = clamp(compensatedX, -TABLE_WIDTH / 2, TABLE_WIDTH / 2);
    return new THREE.Vector3(clampedX, BALL_RADIUS + 0.008, collisionPoint.z);
  };

  useFrame((_, delta) => {
    const balls = physicsBallsRef.current;
    if (balls.length === 0) {
      return;
    }

    const cfg = physicsConfigRef.current;
    const activeCueBallId: PhysicsBallState['id'] = 'cueBall';
    physicsAccumulatorRef.current += delta;

    while (physicsAccumulatorRef.current >= cfg.dtSec) {
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
            if (fahTestShotTraceRef.current) {
              const nowMs = performance.now();
              const normalizedCushion = normalizeFahCushionId(cushionId);
              const existing = fahTestShotTraceRef.current.cushionHits;
              const prev = existing[existing.length - 1];
              if (!prev || prev.cushion !== normalizedCushion || nowMs - prev.atMs >= CUSHION_TRACE_DEDUPE_WINDOW_MS) {
                const hitWorld = physicsToWorldXZ(ball.x, ball.y);
                existing.push({
                  order: existing.length + 1,
                  cushion: normalizedCushion,
                  x: hitWorld.x,
                  z: hitWorld.z,
                  atMs: nowMs,
                });
              }
              if (existing.length > 8) {
                existing.length = 8;
              }
            }
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

    if (gameStore.showBallTrail && (gameStore.phase === 'SHOOTING' || gameStore.phase === 'SIMULATING')) {
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
      const trace = fahTestShotTraceRef.current;
      const cue = balls.find((ball) => ball.id === activeCueBallId);
      if (trace && cue) {
        const elapsedMs = Math.max(0, performance.now() - trace.startedAtMs);
        trace.points.push({
          tMs: Math.round(elapsedMs * 1000) / 1000,
          x: Math.round((cue.x - TABLE_WIDTH / 2) * 10000) / 10000,
          z: Math.round((cue.y - TABLE_HEIGHT / 2) * 10000) / 10000,
          speedMps: Math.round(Math.hypot(cue.vx, cue.vy) * 10000) / 10000,
          headingDeg: Math.round(headingDeg(cue.vx, cue.vy) * 1000) / 1000,
        });
      }
    }

    if (gameStore.phase === 'SHOOTING' || gameStore.phase === 'SIMULATING') {
      const allStopped = balls.every((ball) => ball.isPocketed || Math.hypot(ball.vx, ball.vy) < cfg.shotEndLinearSpeedThresholdMps);
      if (allStopped && !turnEndHandledRef.current) {
        turnEndHandledRef.current = true;
        // Keep runtime trace only in-memory for current shot. Do not persist trace in storage.
        fahTestShotTraceRef.current = null;
        // 잔상 클리어
        ballTrailLastPosRef.current.clear();
        ballTrailSegmentsRef.current.forEach((segments) => {
          segments.forEach((mesh) => {
            scene.remove(mesh);
            mesh.geometry.dispose();
            (mesh.material as THREE.Material).dispose();
          });
        });
        ballTrailSegmentsRef.current.clear();
        gameStore.resetTurnEvents();
        gameStore.setIsDragging(false);
        gameStore.setTurnMessage('FAH TEST SHOT DONE');
        gameStore.setPhase('AIMING');
      } else if (!allStopped) {
        gameStore.setPhase('SIMULATING');
      }
    }

    const cueBallRef = ballsRef.current.get(activeCueBallId);
    if (cueBallRef && gameStore.phase === 'AIMING' && !captureParams.capture) {
      if (captureParams.cam === 'top') {
        camera.position.lerp(new THREE.Vector3(0, 4.4, 0.001), 0.25);
        camera.lookAt(0, 0, 0);
      } else if (captureParams.cam === 'side') {
        camera.position.lerp(new THREE.Vector3(0, 1.5, 3.5), 0.25);
        camera.lookAt(0, 0.25, 0);
      } else {
        // 기본 FAH 시점: 오른쪽 장쿠션이 화면 우측 사선 면으로 보이도록 코너 뷰를 사용한다.
        const targetPos = new THREE.Vector3(FAH_FIXED_CUE_WORLD_X - 1.45, 1.75, FAH_FIXED_CUE_WORLD_Z + 1.35);
        camera.position.lerp(targetPos, 0.25);
        camera.lookAt(FAH_FIXED_CUE_WORLD_X + 1.15, 0.05, FAH_FIXED_CUE_WORLD_Z - 0.25);
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

    if (cueBallRef && !captureParams.capture) {
      const cue = cueBallRef.mesh.position;
      const guideY = BALL_RADIUS + 0.01;
      if (gameStore.phase === 'AIMING' || !guideStartRef.current) {
        guideStartRef.current = new THREE.Vector3(cue.x, guideY, cue.z);
      }
      const start = guideStartRef.current.clone();
      start.y = guideY;
      const anchorTarget = computeFahDiamondGuideTarget(fahStore.fahTestTargetPoint, guideY);
      const cushionZSign = anchorTarget.z >= 0 ? 1 : -1;
      const cushionZ = cushionZSign * (TABLE_HEIGHT / 2 + PHYSICS.CUSHION_THICKNESS / 2);
      const dz = anchorTarget.z - start.z;
      const tToCushion = Math.abs(dz) > 1e-6 ? (cushionZ - start.z) / dz : 1;
      const cushionContactX = start.x + (anchorTarget.x - start.x) * tToCushion;
      const firstCushionMarker = new THREE.Vector3(
        clamp(cushionContactX, -TABLE_WIDTH / 2, TABLE_WIDTH / 2),
        BALL_RADIUS + 0.008,
        cushionZ,
      );
      const { guideline } = resolveFahGuidelineFromCalibration(
        fahCalibrationEntries,
        fahStore.fahTestTargetPoint,
      );
      const secondRailSide: FahRailSide = start.x <= 0 ? 'right' : 'left';
      const secondTarget = computeFahShortRailTarget(secondRailSide, guideline.second, 'marker');
      const thirdTarget = computeFahLongRailTarget('top', guideline.third, 'marker');
      const fourthTarget = guideline.fourthRail === 'short'
        ? computeFahShortRailTarget(secondRailSide === 'right' ? 'left' : 'right', guideline.fourth, 'marker')
        : computeFahLongRailTarget('bottom', guideline.fourth, 'marker');
      setGuideLinePoints(guideCuePathRef.current, []);
      setGuideLinePoints(guidePostCuePathRef.current, []);
      setGuideLinePoints(guideObjectPathRef.current, []);
      setGuideLinePoints(guideFahPathRef.current, [firstCushionMarker, secondTarget, thirdTarget, fourthTarget]);
      if (gameStore.phase === 'AIMING') {
        setGuideLinePoints(guideFahYellowLineRef.current, [start, anchorTarget]);
        setGuideLinePoints(guideFahRedLineRef.current, [thirdTarget, fourthTarget]);
        if (guideFahFirstCushionMarkerRef.current) {
          guideFahFirstCushionMarkerRef.current.position.copy(firstCushionMarker);
          guideFahFirstCushionMarkerRef.current.visible = true;
        }
      } else {
        setGuideLinePoints(guideFahYellowLineRef.current, []);
        setGuideLinePoints(guideFahRedLineRef.current, []);
        if (guideFahFirstCushionMarkerRef.current) {
          guideFahFirstCushionMarkerRef.current.visible = false;
        }
      }
    } else {
      setGuideLinePoints(guideCuePathRef.current, []);
      setGuideLinePoints(guidePostCuePathRef.current, []);
      setGuideLinePoints(guideObjectPathRef.current, []);
      setGuideLinePoints(guideFahPathRef.current, []);
      setGuideLinePoints(guideFahYellowLineRef.current, []);
      setGuideLinePoints(guideFahRedLineRef.current, []);
      if (guideFahFirstCushionMarkerRef.current) {
        guideFahFirstCushionMarkerRef.current.visible = false;
      }
    }

    if (cueBallRef && gameStore.phase === 'AIMING' && !captureParams.capture) {
      impactPointRef.current?.update(
        -gameStore.shotInput.impactOffsetX,
        gameStore.shotInput.impactOffsetY,
        cueBallRef.mesh.position,
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
        enabled={false}
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

/**
 * 메인 게임 씬
 */
export function FahScene() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('cam')) {
      return;
    }
    params.set('cam', 'top');
    navigate(`${location.pathname}?${params.toString()}`, { replace: true });
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    const gameStore = useGameStore.getState();
    if (gameStore.systemMode !== 'fiveAndHalf') {
      gameStore.setSystemMode('fiveAndHalf');
    }

    return () => {
      const latestStore = useGameStore.getState();
      if (latestStore.systemMode !== 'half') {
        latestStore.setSystemMode('half');
      }
    };
  }, []);

  const captureParams = readCaptureParams();
  const cameraPosition: [number, number, number] =
    captureParams.cam === 'top'
      ? [0, 4.4, 0.001]
      : captureParams.cam === 'side'
        ? [0, 1.5, 3.5]
        : [0, 4, 0];

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
          <GameWorld />
        </Canvas>
        {!captureParams.capture && <FahUI />}
      </Suspense>
    </div>
  );
}

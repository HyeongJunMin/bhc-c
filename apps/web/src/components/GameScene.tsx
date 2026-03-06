import { useEffect, useRef, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

import { CueStick } from '../ammo/CueStick';
import { ImpactPoint } from '../ammo/ImpactPoint';
import { useGameStore } from '../stores/gameStore';
import { PHYSICS, INPUT_LIMITS } from '../lib/constants';
import { GameUI } from './GameUI';
import { AIM_CONTROL_CONTRACT } from '../../../../packages/shared-types/src/aim-control.ts';
import { createRoomPhysicsStepConfig } from '../../../../packages/physics-core/src/room-physics-config.ts';
import { stepRoomPhysicsWorld, type PhysicsBallState, type CushionId } from '../../../../packages/physics-core/src/room-physics-step.ts';
import { computeShotInitialization } from '../../../../packages/physics-core/src/shot-init.ts';
import { isMiscue } from '../../../../packages/physics-core/src/miscue.ts';
import { applyCushionContactThrow } from '../../../../packages/physics-core/src/cushion-contact-throw.ts';
import { computeSquirtAngleRad } from '../../../../packages/physics-core/src/squirt.ts';

// 테이블 스펙 (Unit: meters)
const TABLE_WIDTH = PHYSICS.TABLE_WIDTH;
const TABLE_HEIGHT = PHYSICS.TABLE_HEIGHT;
const BALL_RADIUS = PHYSICS.BALL_RADIUS;
const DIAMOND_STEP_X = TABLE_WIDTH / 8;
const DIAMOND_STEP_Z = TABLE_HEIGHT / 4;
const MAX_DEBUG_TRACE_EVENTS = 40;
const MAX_DEBUG_TRACE_CHARS = 2000;
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

  const physicsConfigRef = useRef(createRoomPhysicsStepConfig());
  const physicsAccumulatorRef = useRef(0);
  const physicsBallsRef = useRef<PhysicsBallState[]>([]);
  const cueStickRef = useRef<CueStick | null>(null);
  const impactPointRef = useRef<ImpactPoint | null>(null);
  const ballsRef = useRef<Map<string, { mesh: THREE.Mesh }>>(new Map());
  const guideCuePathRef = useRef<THREE.Line | null>(null);
  const guidePostCuePathRef = useRef<THREE.Line | null>(null);
  const guideObjectPathRef = useRef<THREE.Line | null>(null);
  const debugTracePartsRef = useRef<string[]>([]);
  const traceEventIndexRef = useRef(0);
  const traceWasTruncatedRef = useRef(false);
  const lastCueCushionEventRef = useRef<{ cushionId: CushionId; atMs: number } | null>(null);
  const turnEndHandledRef = useRef(false);

  const dragState = useRef<{
    isDragging: boolean;
    startY: number;
    currentPower: number;
  }>({
    isDragging: false,
    startY: 0,
    currentPower: INPUT_LIMITS.DRAG_MIN,
  });

  const tempDir = useRef(new THREE.Vector3());
  const prevPhaseRef = useRef(gameStore.phase);
  const activeDebugPresetRef = useRef<DebugPresetName>('CENTER');


  useEffect(() => {
    createVisualTable(scene);
    createBalls();
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
    };
  }, [scene]);

  useEffect(() => {
    if (gameStore.phase === 'SHOOTING') {
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

  const createBalls = () => {
    const ballConfigs = [
      { id: 'cueBall', color: 0xffffff, pos: gameStore.balls[0].position },
      { id: 'objectBall1', color: 0xff0000, pos: gameStore.balls[1].position },
      { id: 'objectBall2', color: 0xffd700, pos: gameStore.balls[2].position },
    ];

    const physicsBalls: PhysicsBallState[] = [];
    ballConfigs.forEach(({ id, color, pos }) => {
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
        id,
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

  const executeShot = () => {
    const cueBall = physicsBallsRef.current.find((ball) => ball.id === gameStore.activeCueBallId);
    if (!cueBall) {
      return;
    }
    const impactOffsetXForPhysics = -gameStore.shotInput.impactOffsetX;

    if (isMiscue(impactOffsetXForPhysics, gameStore.shotInput.impactOffsetY, BALL_RADIUS)) {
      gameStore.setTurnMessage('MISCUE!');
    }

    const shotInit = computeShotInitialization({
      dragPx: gameStore.shotInput.dragPx,
      impactOffsetX: impactOffsetXForPhysics,
      impactOffsetY: gameStore.shotInput.impactOffsetY,
    });

    if (typeof window !== 'undefined') {
      const cue = gameStore.balls.find((ball) => ball.id === gameStore.activeCueBallId)?.position;
      const obj1 = gameStore.balls.find((ball) => ball.id === 'objectBall1')?.position;
      const obj2 = gameStore.balls.find((ball) => ball.id !== gameStore.activeCueBallId && ball.id !== 'objectBall1')?.position;
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
        `directionDeg:${gameStore.shotInput.shotDirectionDeg.toFixed(1)} ` +
        `speedMps:${shotInit.initialBallSpeedMps.toFixed(3)} ` +
        `spinY:${shotInit.omegaY.toFixed(3)} ` +
        `dragPx:${gameStore.shotInput.dragPx.toFixed(1)} ` +
        `impactOffsetX(UI):${gameStore.shotInput.impactOffsetX.toFixed(4)} ` +
        `impactOffsetX(phys):${impactOffsetXForPhysics.toFixed(4)} ` +
        `impactOffsetY:${gameStore.shotInput.impactOffsetY.toFixed(4)} ` +
        `cueX:${(cue?.x ?? 0).toFixed(4)} ` +
        `cueZ:${(cue?.z ?? 0).toFixed(4)} ` +
        `obj1X:${(obj1?.x ?? 0).toFixed(4)} ` +
        `obj1Z:${(obj1?.z ?? 0).toFixed(4)} ` +
        `obj2X:${(obj2?.x ?? 0).toFixed(4)} ` +
        `obj2Z:${(obj2?.z ?? 0).toFixed(4)}`;
      window.sessionStorage.setItem('bhc.lastShotDebugLine', lastShotLine);
    }
    debugTracePartsRef.current = [];
    traceEventIndexRef.current = 0;
    traceWasTruncatedRef.current = false;
    lastCueCushionEventRef.current = null;

    const directionRad = (gameStore.shotInput.shotDirectionDeg * Math.PI) / 180;
    const squirtAngleRad = computeSquirtAngleRad({
      impactOffsetX: impactOffsetXForPhysics,
      ballRadiusM: BALL_RADIUS,
    });
    const finalDirectionRad = directionRad - squirtAngleRad;
    cueBall.vx = Math.sin(finalDirectionRad) * shotInit.initialBallSpeedMps;
    cueBall.vy = Math.cos(finalDirectionRad) * shotInit.initialBallSpeedMps;
    cueBall.spinX = shotInit.omegaX;
    cueBall.spinY = shotInit.omegaY;
    cueBall.spinZ = 0;

    gameStore.executeShot();
    cueStickRef.current?.animateShot();
  };

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (gameStore.phase !== 'AIMING' || e.button !== 0) return;

      dragState.current.isDragging = true;
      dragState.current.startY = e.clientY;
      dragState.current.currentPower = INPUT_LIMITS.DRAG_MIN;
      gameStore.setIsDragging(true);
      gameStore.setDragPower(INPUT_LIMITS.DRAG_MIN);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.current.isDragging) return;

      const deltaY = e.clientY - dragState.current.startY;
      const newPower = Math.max(
        INPUT_LIMITS.DRAG_MIN,
        Math.min(INPUT_LIMITS.DRAG_MAX, INPUT_LIMITS.DRAG_MIN + deltaY),
      );
      dragState.current.currentPower = newPower;
      gameStore.setDragPower(newPower as number);
    };

    const handleMouseUp = () => {
      if (!dragState.current.isDragging) return;

      dragState.current.isDragging = false;
      gameStore.setIsDragging(false);

      if (dragState.current.currentPower >= INPUT_LIMITS.DRAG_MIN + 5) {
        executeShot();
      } else {
        gameStore.setDragPower(INPUT_LIMITS.DRAG_MIN);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameStore.phase !== 'AIMING') return;

      const step = 0.002;
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

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [gameStore.phase, gameStore.shotInput]);

  useFrame((_, delta) => {
    const balls = physicsBallsRef.current;
    if (balls.length === 0) {
      return;
    }

    const cfg = physicsConfigRef.current;
    const activeCueBallId = gameStore.activeCueBallId;
    physicsAccumulatorRef.current += delta;

    while (physicsAccumulatorRef.current >= cfg.dtSec) {
      const cueCushionContacts = new Set<CushionId>();
      const cueObjectHits = new Set<string>();

      stepRoomPhysicsWorld(balls, cfg, {
        onCushionCollision: (ball, cushionId) => {
          if (ball.id === activeCueBallId) {
            cueCushionContacts.add(cushionId);
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
          if (first.id === activeCueBallId && second.id !== activeCueBallId) {
            cueObjectHits.add(second.id);
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
            cueObjectHits.add(first.id);
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
      });

      cueCushionContacts.forEach((cushionId) => gameStore.addCushionContact(cushionId));
      cueObjectHits.forEach((ballId) => gameStore.addBallCollision(ballId));

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

    if (gameStore.phase === 'SHOOTING' || gameStore.phase === 'SIMULATING') {
      const allStopped = balls.every((ball) => ball.isPocketed || Math.hypot(ball.vx, ball.vy) < cfg.shotEndLinearSpeedThresholdMps);
      if (allStopped && !turnEndHandledRef.current) {
        turnEndHandledRef.current = true;
        if (typeof window !== 'undefined') {
          const traceSuffix = traceWasTruncatedRef.current
            ? ` | ...TRUNCATED(max=${MAX_DEBUG_TRACE_EVENTS})`
            : '';
          const rawTraceLine = debugTracePartsRef.current.join(' | ') + traceSuffix;
          const traceLine = rawTraceLine.length > MAX_DEBUG_TRACE_CHARS
            ? `${rawTraceLine.slice(0, MAX_DEBUG_TRACE_CHARS)} | ...TRUNCATED(chars=${MAX_DEBUG_TRACE_CHARS})`
            : rawTraceLine;
          window.sessionStorage.setItem('bhc.lastShotTraceLine', traceLine);
        }
        gameStore.handleTurnEnd();
      } else if (!allStopped) {
        gameStore.setPhase('SIMULATING');
      }
    }

    const cueBallRef = ballsRef.current.get(activeCueBallId);
    if (cueBallRef && gameStore.phase === 'AIMING' && !captureParams.capture) {
      tempDir.current.copy(cueBallRef.mesh.position).sub(camera.position);
      tempDir.current.y = 0;
      if (
        tempDir.current.lengthSq() > 1e-6 &&
        !gameStore.isDragging &&
        gameStore.shotInput.aimControlMode === 'AUTO_SYNC'
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

    if (cueBallRef && gameStore.phase === 'AIMING' && !captureParams.capture) {
      const cue = cueBallRef.mesh.position;
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
            impactOffsetX: gameStore.shotInput.impactOffsetX,
            impactOffsetY: gameStore.shotInput.impactOffsetY,
          });
          const speedForGuide = Math.max(5, shotInit.initialBallSpeedMps);
          const collision = applyCushionContactThrow({
            axis: boundaryHit.axis,
            vx: dir.x * speedForGuide,
            vy: dir.z * speedForGuide,
            spinX: shotInit.omegaX,
            spinY: shotInit.omegaY,
            spinZ: 0,
            restitution: physicsConfigRef.current.cushionRestitution,
            contactFriction: physicsConfigRef.current.cushionContactFriction,
            referenceNormalSpeedMps: physicsConfigRef.current.cushionReferenceSpeedMps,
            contactTimeExponent: physicsConfigRef.current.cushionContactTimeExponent,
            maxSpinMagnitude: physicsConfigRef.current.cushionMaxSpinMagnitude,
            maxThrowAngleDeg: physicsConfigRef.current.cushionMaxThrowAngleDeg,
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
        enabled={!captureParams.capture && gameStore.phase === 'AIMING' && !gameStore.isDragging}
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
export function GameScene() {
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
        {!captureParams.capture && <GameUI />}
      </Suspense>
    </div>
  );
}

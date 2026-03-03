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
import { applyCushionContactThrow } from '../../../game-server/src/game/cushion-contact-throw.ts';

// 테이블 스펙 (Unit: meters)
const TABLE_WIDTH = PHYSICS.TABLE_WIDTH;
const TABLE_HEIGHT = PHYSICS.TABLE_HEIGHT;
const BALL_RADIUS = PHYSICS.BALL_RADIUS;

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

  useEffect(() => {
    createVisualTable(scene);
    createBalls();

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
    const totalWidth = TABLE_WIDTH + frameThickness * 2;
    const totalHeight = TABLE_HEIGHT + frameThickness * 2;

    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x3a2a1f,
      roughness: 0.62,
      metalness: 0.06,
    });
    const frameConfigs = [
      { pos: [0, 0.055, -TABLE_HEIGHT / 2 - frameThickness / 2], size: [totalWidth, 0.11, frameThickness] },
      { pos: [0, 0.055, TABLE_HEIGHT / 2 + frameThickness / 2], size: [totalWidth, 0.11, frameThickness] },
      { pos: [-TABLE_WIDTH / 2 - frameThickness / 2, 0.055, 0], size: [frameThickness, 0.11, TABLE_HEIGHT] },
      { pos: [TABLE_WIDTH / 2 + frameThickness / 2, 0.055, 0], size: [frameThickness, 0.11, TABLE_HEIGHT] },
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

    const cushionThickness = PHYSICS.CUSHION_THICKNESS;
    const cushionHeight = PHYSICS.CUSHION_HEIGHT;
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
    const frameThickness = 0.15;
    const markerGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.002, 16);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0xd7d0c2 });

    const longRailMarkers = 9;
    for (let i = 0; i < longRailMarkers; i += 1) {
      const t = i / (longRailMarkers - 1);
      const x = (t - 0.5) * TABLE_WIDTH;

      const top = new THREE.Mesh(markerGeo, markerMat);
      top.rotation.x = Math.PI / 2;
      top.position.set(x, 0.112, -TABLE_HEIGHT / 2 - frameThickness / 2);
      scene3d.add(top);

      const bottom = new THREE.Mesh(markerGeo, markerMat);
      bottom.rotation.x = Math.PI / 2;
      bottom.position.set(x, 0.112, TABLE_HEIGHT / 2 + frameThickness / 2);
      scene3d.add(bottom);
    }

    const shortRailMarkers = 5;
    for (let i = 0; i < shortRailMarkers; i += 1) {
      const t = i / (shortRailMarkers - 1);
      const z = (t - 0.5) * TABLE_HEIGHT;

      const left = new THREE.Mesh(markerGeo, markerMat);
      left.rotation.z = Math.PI / 2;
      left.position.set(-TABLE_WIDTH / 2 - frameThickness / 2, 0.112, z);
      scene3d.add(left);

      const right = new THREE.Mesh(markerGeo, markerMat);
      right.rotation.z = Math.PI / 2;
      right.position.set(TABLE_WIDTH / 2 + frameThickness / 2, 0.112, z);
      scene3d.add(right);
    }
  };

  const executeShot = () => {
    const cueBall = physicsBallsRef.current.find((ball) => ball.id === 'cueBall');
    if (!cueBall) {
      return;
    }

    if (isMiscue(gameStore.shotInput.impactOffsetX, gameStore.shotInput.impactOffsetY, BALL_RADIUS)) {
      gameStore.setTurnMessage('MISCUE!');
    }

    const shotInit = computeShotInitialization({
      dragPx: gameStore.shotInput.dragPx,
      impactOffsetX: gameStore.shotInput.impactOffsetX,
      impactOffsetY: gameStore.shotInput.impactOffsetY,
    });

    const directionRad = (gameStore.shotInput.shotDirectionDeg * Math.PI) / 180;
    cueBall.vx = Math.sin(directionRad) * shotInit.initialBallSpeedMps;
    cueBall.vy = Math.cos(directionRad) * shotInit.initialBallSpeedMps;
    cueBall.spinX = shotInit.omegaX;
    cueBall.spinY = 0;
    cueBall.spinZ = shotInit.omegaZ;

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
        case 'm':
        case 'ㅡ':
          gameStore.setAimControlMode(
            gameStore.shotInput.aimControlMode === 'AUTO_SYNC' ? 'MANUAL_AIM' : 'AUTO_SYNC',
          );
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
    physicsAccumulatorRef.current += delta;

    while (physicsAccumulatorRef.current >= cfg.dtSec) {
      const cueCushionContacts = new Set<CushionId>();
      const cueObjectHits = new Set<string>();

      stepRoomPhysicsWorld(balls, cfg, {
        applyCushionContactThrow,
        onCushionCollision: (ball, cushionId) => {
          if (ball.id === 'cueBall') {
            cueCushionContacts.add(cushionId);
          }
        },
        onBallCollision: (first, second) => {
          if (first.id === 'cueBall' && second.id !== 'cueBall') {
            cueObjectHits.add(second.id);
          } else if (second.id === 'cueBall' && first.id !== 'cueBall') {
            cueObjectHits.add(first.id);
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
      if (allStopped) {
        gameStore.handleTurnEnd();
      } else {
        gameStore.setPhase('SIMULATING');
      }
    }

    const cueBallRef = ballsRef.current.get('cueBall');
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
      const object2 = ballsRef.current.get('objectBall2')?.mesh.position;
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
          { id: 'objectBall2', pos: object2 },
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
            spinZ: shotInit.omegaZ,
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
        gameStore.shotInput.impactOffsetX,
        gameStore.shotInput.impactOffsetY,
        cueBallRef.mesh.position,
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

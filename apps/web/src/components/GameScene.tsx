import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import { Vector3 } from 'three';

import { BilliardTable } from './BilliardTable';
import { Ball } from './Ball';
import { CueStick } from './CueStick';
import { GuideLine } from './GuideLine';
import { ShotGuide } from './ShotGuide';
import { useGameStore } from '../hooks/useGameStore';
import { COLORS } from '../lib/constants';

// 게임 월드 컴포넌트
function GameWorld() {
  const { camera } = useThree();
  const {
    balls,
    phase,
    shotInput,
    isDragging,
    setShotDirection,
    resetGame,
  } = useGameStore();

  const cueBall = balls.find((b) => b.id === 'cueBall')!;
  const isAiming = phase === 'AIMING';
  const controlsRef = useRef<any>(null);
  const lastAzimuthRef = useRef(0);

  // 키보드 이벤트 (스페이스바)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        resetGame();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resetGame]);

  // 침대 위치 초기화
  useEffect(() => {
    camera.position.set(0, 2.5, -2);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  // 침대 회전에 따라 큐 방향 동기화
  useFrame(() => {
    if (!isAiming || isDragging) return;
    
    // 침대 위치에서 공을 향하는 방향 계산
    // 침대 position - 공 position = 공을 향하는 벡터
    const direction = new Vector3()
      .subVectors(cueBall.position, camera.position)
      .normalize();
    
    // Y는 무시하고 XZ 평면에서의 각도 계산
    // atan2(x, z)로 각도 계산
    const angle = Math.atan2(direction.x, direction.z);
    let degrees = (angle * 180) / Math.PI;
    
    // 0~360 범위로 정규화
    degrees = ((degrees % 360) + 360) % 360;
    
    // 이전 값과 충분히 차이나면 업데이트
    if (Math.abs(degrees - lastAzimuthRef.current) > 1) {
      lastAzimuthRef.current = degrees;
      setShotDirection(degrees);
    }
  });

  return (
    <>
      {/* 조명 */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <pointLight position={[0, 5, 0]} intensity={0.5} />

      {/* 환경 */}
      <Environment preset="studio" />

      {/* 당구대 */}
      <BilliardTable />

      {/* 공들 */}
      {balls.map((ball) => (
        <Ball
          key={ball.id}
          id={ball.id}
          color={
            ball.id === 'cueBall'
              ? COLORS.CUE_BALL
              : ball.id === 'objectBall1'
              ? COLORS.OBJECT_BALL_1
              : COLORS.OBJECT_BALL_2
          }
          position={ball.position}
          isActive={ball.id === 'cueBall' && isAiming}
        />
      ))}

      {/* 큐 스틱 - 조준 중일 때 보임 */}
      <CueStick
        cueBallPosition={cueBall.position}
        directionDeg={shotInput.shotDirectionDeg}
        elevationDeg={shotInput.cueElevationDeg}
        power={(shotInput.dragPx - 10) / 390}
        isVisible={isAiming && isDragging}
      />

      {/* 샷 방향 가이드 라인 - 조준 중일 때 보임 (드래그 여부 상관없이) */}
      <ShotGuide
        cueBallPosition={cueBall.position}
        directionDeg={shotInput.shotDirectionDeg}
        isVisible={isAiming}
      />

      {/* 3쿠션 경로 예측 - 드래그 중일 때만 보임 */}
      <GuideLine
        cueBallPosition={cueBall.position}
        directionDeg={shotInput.shotDirectionDeg}
        isVisible={isAiming && isDragging}
      />

      {/* 컨트롤 - 오른쪽 마우스로만 회전 */}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enabled={isAiming}
        mouseButtons={{
          LEFT: undefined,
          MIDDLE: undefined,
          RIGHT: 0,
        }}
        enablePan={false}
        enableZoom={true}
        enableRotate={true}
        minDistance={1.5}
        maxDistance={4}
        maxPolarAngle={Math.PI / 2.5}
        minPolarAngle={Math.PI / 6}
        target={[0, 0, 0]}
      />
    </>
  );
}

// 메인 씬
export function GameScene() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas
        shadows
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor('#1a1a2e');
        }}
      >
        <PerspectiveCamera makeDefault fov={50} position={[0, 2.5, -2]} />
        <GameWorld />
      </Canvas>
    </div>
  );
}

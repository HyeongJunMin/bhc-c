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
import { COLORS, RULES } from '../lib/constants';
import { computeShotVelocity, isMiscue } from '../lib/physics-calculator';
import { simplePhysics } from '../core/SimplePhysics';
import { threeCushionRules } from '../core/ThreeCushionRules';

// 게임 월드 컴포넌트
function GameWorld() {
  const { camera } = useThree();
  const {
    balls,
    phase,
    shotInput,
    isDragging,
    currentPlayer,
    updateBall,
    setPhase,
    addScore,
    nextPlayer,
    setTurnMessage,
    setShotDirection,
    resetGame,
  } = useGameStore();

  const cueBall = balls.find((b) => b.id === 'cueBall')!;
  const isAiming = phase === 'AIMING';
  const physicsInitialized = useRef(false);
  const controlsRef = useRef<any>(null);
  const lastAzimuthRef = useRef(0);

  // 물리 엔진 초기화
  useEffect(() => {
    if (physicsInitialized.current) return;
    
    simplePhysics.init();
    
    // 공 생성
    balls.forEach((ball) => {
      simplePhysics.createBall(ball.id, ball.position);
    });
    
    // 새 턴 시작
    threeCushionRules.startTurn('cueBall', ['objectBall1', 'objectBall2']);
    
    physicsInitialized.current = true;
    console.log('[GameScene] Physics initialized');

    return () => {
      simplePhysics.cleanup();
    };
  }, []);

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

  // 샷 실행
  useEffect(() => {
    if (phase === 'SHOOTING') {
      console.log('[Game] Shooting! Direction:', shotInput.shotDirectionDeg, 'Power:', shotInput.dragPx);
      
      // 미스큐 체크
      if (isMiscue(shotInput.impactOffsetX, shotInput.impactOffsetY)) {
        console.log('[Game] Miscue!');
        setTurnMessage('MISCUE!');
        setPhase('SIMULATING');
        return;
      }
      
      const velocity = computeShotVelocity(
        shotInput.shotDirectionDeg,
        shotInput.cueElevationDeg,
        shotInput.dragPx
      );
      
      console.log('[Game] Velocity:', velocity);
      simplePhysics.applyVelocity('cueBall', velocity);
      
      // 충돌 이벤트 리스너 설정
      simplePhysics.onBallCollision = (id1, id2) => {
        threeCushionRules.recordCollision({
          type: 'BALL',
          ballId1: id1,
          ballId2: id2,
          atMs: Date.now(),
        });
      };
      
      simplePhysics.onCushionCollision = (ballId, cushionId) => {
        threeCushionRules.recordCollision({
          type: 'CUSHION',
          ballId,
          cushionId,
          atMs: Date.now(),
        });
      };
    }
  }, [phase, shotInput, setPhase, setTurnMessage]);

  // 물리 업데이트
  useFrame((_, delta) => {
    if (!physicsInitialized.current) return;

    if (phase === 'SIMULATING' || phase === 'SHOOTING') {
      // 물리 스텝
      simplePhysics.step(delta);
      
      // 상태 동기화
      const states = simplePhysics.getAllBallStates();
      states.forEach((state, id) => {
        updateBall(id, {
          position: state.position,
        });
      });
      
      // 모든 공이 멈췄는지 확인
      if (simplePhysics.areAllBallsStopped(0.02)) {
        const result = threeCushionRules.endTurn();
        
        if (result.isScore) {
          setTurnMessage('🎉 SCORE!');
          addScore(currentPlayer);
          
          // 승리 체크
          const currentScore = useGameStore.getState().scores[currentPlayer] || 0;
          if (currentScore + 1 >= RULES.WINNING_SCORE) {
            setTurnMessage(`🏆 ${currentPlayer} WINS!`);
          }
        } else {
          const cushionCount = threeCushionRules.getCushionCount();
          if (cushionCount < RULES.REQUIRED_CUSHIONS) {
            setTurnMessage(`Miss (Cushions: ${cushionCount}/3)`);
          } else {
            setTurnMessage('Miss (Need both object balls)');
          }
          nextPlayer();
        }
        
        setPhase('AIMING');
        
        // 새 턴 시작
        threeCushionRules.startTurn('cueBall', ['objectBall1', 'objectBall2']);
      }
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

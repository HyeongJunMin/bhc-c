import { Canvas } from '@react-three/fiber';
import { OrthographicCamera, Environment } from '@react-three/drei';
import { Sphere } from '@react-three/drei';
import { BilliardTable } from '../BilliardTable';
import { TrajectoryLine } from './TrajectoryLine';
import { CueBallSegmentedTrajectory } from './CueBallSegmentedTrajectory';
import { DeviationMarkers } from './DeviationMarkers';
import type { SimulationResult, TrajectoryFrameBall } from '@physics-core/standalone-simulator';
import type { TrajectoryAnalysis } from '../../physics-sim/trajectory-analyzer';
import { PHYSICS, COLORS } from '../../lib/constants';

const TABLE_W = PHYSICS.TABLE_WIDTH;
const TABLE_H = PHYSICS.TABLE_HEIGHT;
const BALL_R = PHYSICS.BALL_RADIUS;

function toThree(physX: number, physZ: number): [number, number, number] {
  return [physX - TABLE_W / 2, BALL_R, physZ - TABLE_H / 2];
}

const BALL_COLORS: Record<string, number> = {
  cueBall:     COLORS.CUE_BALL,
  objectBall1: COLORS.OBJECT_BALL_1,
  objectBall2: COLORS.OBJECT_BALL_2,
};

export type InitialBall = {
  id: string;
  x: number;
  z: number;
};

type Props = {
  actual: SimulationResult | null;
  baseline: SimulationResult | null;
  analysis: TrajectoryAnalysis | null;
  currentFrame: number;
  initialBalls?: InitialBall[];
};

function SceneContent({ actual, baseline, analysis, currentFrame, initialBalls }: Props) {
  const ballIds = ['cueBall', 'objectBall1', 'objectBall2'];

  // Current ball positions from actual simulation at the playback frame
  // If no simulation result, fall back to initialBalls for preview
  const currentBalls: TrajectoryFrameBall[] = actual?.frames[currentFrame]?.balls
    ?? initialBalls?.map((b) => ({
        id: b.id,
        x: b.x,
        z: b.z,
        vx: 0,
        vz: 0,
        spinX: 0,
        spinY: 0,
        spinZ: 0,
        speed: 0,
      }))
    ?? [];

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 8, 3]} intensity={1.2} castShadow />
      <Environment preset="studio" />

      {/* Table */}
      <BilliardTable />

      {/* Baseline trajectories (dashed, semi-transparent) */}
      {baseline && ballIds.map((id) => (
        <TrajectoryLine
          key={`base-${id}`}
          frames={baseline.frames}
          ballId={id}
          dashed
          opacity={0.45}
        />
      ))}

      {/* Actual trajectories (solid) — cue ball uses segmented trajectory */}
      {actual && ballIds.filter((id) => id !== 'cueBall').map((id) => (
        <TrajectoryLine
          key={`actual-${id}`}
          frames={actual.frames}
          ballId={id}
          dashed={false}
          opacity={1}
          currentFrame={currentFrame}
        />
      ))}
      {actual && (
        <CueBallSegmentedTrajectory
          frames={actual.frames}
          events={actual.events}
          currentFrame={currentFrame}
        />
      )}

      {/* Deviation markers */}
      {analysis && actual && (
        <DeviationMarkers analysis={analysis} actual={actual} />
      )}

      {/* Current frame ball positions */}
      {currentBalls.map((ball) => {
        const pos = toThree(ball.x, ball.z);
        const color = BALL_COLORS[ball.id] ?? 0xffffff;
        return (
          <Sphere key={ball.id} args={[BALL_R, 32, 32]} position={pos} castShadow>
            <meshPhysicalMaterial
              color={color}
              roughness={0.1}
              metalness={0.1}
              clearcoat={1}
              clearcoatRoughness={0.1}
            />
          </Sphere>
        );
      })}
    </>
  );
}

export function TestScene({ actual, baseline, analysis, currentFrame, initialBalls }: Props) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        shadows
        orthographic
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => gl.setClearColor('#0f172a')}
      >
        {/* Top-down orthographic camera */}
        <OrthographicCamera
          makeDefault
          position={[0, 4, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          zoom={200}
          near={0.1}
          far={20}
        />
        <SceneContent
          actual={actual}
          baseline={baseline}
          analysis={analysis}
          currentFrame={currentFrame}
          initialBalls={initialBalls}
        />
      </Canvas>

      <div
        style={{
          position: 'absolute',
          left: 12,
          bottom: 12,
          background: 'rgba(11, 18, 32, 0.88)',
          border: '1px solid #1e293b',
          borderRadius: 6,
          padding: '8px 10px',
          color: '#cbd5e1',
          fontSize: 11,
          fontFamily: 'monospace',
          lineHeight: 1.4,
          pointerEvents: 'none',
        }}
      >
        <div style={{ color: '#94a3b8', marginBottom: 4 }}>TABLE AXIS</div>
        <div>+X: {'->'} 오른쪽</div>
        <div>+Y: {'^'} 위쪽 (내부 z+)</div>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 12,
          bottom: 12,
          background: 'rgba(11, 18, 32, 0.88)',
          border: '1px solid #1e293b',
          borderRadius: 6,
          padding: '8px 10px',
          color: '#cbd5e1',
          fontSize: 11,
          fontFamily: 'monospace',
          lineHeight: 1.4,
          pointerEvents: 'none',
          textAlign: 'right',
        }}
      >
        <div style={{ color: '#94a3b8', marginBottom: 4 }}>SPIN AXIS (XYZ)</div>
        <div>X축: {'->'} 기준 회전 (오른손법칙 +)</div>
        <div>Y축: 테이블 수직축 회전</div>
        <div>Z축: {'^'} 기준 회전 (오른손법칙 +)</div>
      </div>
    </div>
  );
}

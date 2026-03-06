import { Canvas } from '@react-three/fiber';
import { OrthographicCamera, Line } from '@react-three/drei';
import type { SimResult, SimFrame } from '../../../../../packages/physics-core/src/standalone-simulator.ts';
import { TrajectoryLine } from './TrajectoryLine.tsx';
import { DeviationMarkers } from './DeviationMarkers.tsx';

const TABLE_WIDTH = 2.844;
const TABLE_HEIGHT = 1.422;
const BALL_RADIUS = 0.03075;

const BALL_COLORS: Record<string, string> = {
  cueBall: '#ffffff',
  objectBall1: '#ff4444',
  objectBall2: '#ffd700',
};
const DEFAULT_COLOR = '#88aaff';

type BallMeshProps = {
  ballId: string;
  frame: SimFrame | null;
};

function BallMesh({ ballId, frame }: BallMeshProps) {
  if (!frame) return null;
  const ball = frame.balls.find((b) => b.id === ballId);
  if (!ball) return null;
  const tx = ball.x - TABLE_WIDTH / 2;
  const tz = ball.y - TABLE_HEIGHT / 2;
  const color = BALL_COLORS[ballId] ?? DEFAULT_COLOR;

  return (
    <mesh position={[tx, BALL_RADIUS, tz]}>
      <sphereGeometry args={[BALL_RADIUS, 16, 16]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

type DirectionLineProps = {
  cueBallX: number;
  cueBallY: number;
  directionDeg: number;
};

function DirectionLine({ cueBallX, cueBallY, directionDeg }: DirectionLineProps) {
  const rad = (directionDeg * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dz = Math.cos(rad);
  const tx = cueBallX - TABLE_WIDTH / 2;
  const tz = cueBallY - TABLE_HEIGHT / 2;
  const y = BALL_RADIUS + 0.005;
  const len = 0.5;

  return (
    <Line
      points={[[tx, y, tz], [tx + dx * len, y, tz + dz * len]]}
      color="#00d4ff"
      lineWidth={1.5}
      dashed
      dashSize={0.04}
      gapSize={0.03}
    />
  );
}

type StaticBallMeshProps = {
  id: string;
  x: number;
  y: number;
};

function StaticBallMesh({ id, x, y }: StaticBallMeshProps) {
  const tx = x - TABLE_WIDTH / 2;
  const tz = y - TABLE_HEIGHT / 2;
  const color = BALL_COLORS[id] ?? DEFAULT_COLOR;

  return (
    <mesh position={[tx, BALL_RADIUS, tz]}>
      <sphereGeometry args={[BALL_RADIUS, 16, 16]} />
      <meshStandardMaterial color={color} opacity={0.7} transparent />
    </mesh>
  );
}

function TableMesh() {
  return (
    <group>
      <mesh position={[0, 0, 0]} receiveShadow>
        <boxGeometry args={[TABLE_WIDTH, 0.01, TABLE_HEIGHT]} />
        <meshStandardMaterial color="#2d8a4e" roughness={1} />
      </mesh>
      {/* cushions */}
      {[
        { pos: [0, 0.02, -TABLE_HEIGHT / 2] as [number, number, number], size: [TABLE_WIDTH, 0.04, 0.05] as [number, number, number] },
        { pos: [0, 0.02, TABLE_HEIGHT / 2] as [number, number, number], size: [TABLE_WIDTH, 0.04, 0.05] as [number, number, number] },
        { pos: [-TABLE_WIDTH / 2, 0.02, 0] as [number, number, number], size: [0.05, 0.04, TABLE_HEIGHT] as [number, number, number] },
        { pos: [TABLE_WIDTH / 2, 0.02, 0] as [number, number, number], size: [0.05, 0.04, TABLE_HEIGHT] as [number, number, number] },
      ].map((c, i) => (
        <mesh key={i} position={c.pos}>
          <boxGeometry args={c.size} />
          <meshStandardMaterial color="#2d5a2d" />
        </mesh>
      ))}
    </group>
  );
}

type SceneContentProps = {
  result: SimResult | null;
  baselineResult: SimResult | null;
  currentFrame: number;
  showBaseline: boolean;
  showDeviation: boolean;
  initialBalls?: Array<{ id: string; x: number; y: number }>;
  shotDirection?: { directionDeg: number; cueBallId: string };
};

function SceneContent({ result, baselineResult, currentFrame, showBaseline, showDeviation, initialBalls, shotDirection }: SceneContentProps) {
  const frame = result?.frames[currentFrame] ?? null;

  const ballIds = frame ? frame.balls.map((b) => b.id) : [];

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[2, 5, 3]} intensity={0.5} />
      <TableMesh />

      {/* Ball positions at current frame */}
      {ballIds.map((id) => (
        <BallMesh key={id} ballId={id} frame={frame} />
      ))}

      {/* Trajectories */}
      {result && ballIds.map((id) => (
        <TrajectoryLine
          key={id}
          ballId={id}
          frames={result.frames}
          tableWidthM={TABLE_WIDTH}
          tableHeightM={TABLE_HEIGHT}
          ballRadiusM={BALL_RADIUS}
          opacity={0.5}
        />
      ))}

      {/* Baseline trajectories */}
      {showBaseline && baselineResult && ballIds.map((id) => (
        <TrajectoryLine
          key={`baseline-${id}`}
          ballId={id}
          frames={baselineResult.frames}
          tableWidthM={TABLE_WIDTH}
          tableHeightM={TABLE_HEIGHT}
          ballRadiusM={BALL_RADIUS}
          dashed
          opacity={0.4}
        />
      ))}

      {/* Static ball positions before run */}
      {!result && initialBalls && initialBalls.map((b) => (
        <StaticBallMesh key={b.id} id={b.id} x={b.x} y={b.y} />
      ))}

      {/* Direction line before run */}
      {!result && initialBalls && shotDirection && (() => {
        const cb = initialBalls.find((b) => b.id === shotDirection.cueBallId);
        return cb ? <DirectionLine cueBallX={cb.x} cueBallY={cb.y} directionDeg={shotDirection.directionDeg} /> : null;
      })()}

      {/* Deviation markers */}
      {showDeviation && result && baselineResult && (
        <DeviationMarkers
          actualFrames={result.frames}
          baselineFrames={baselineResult.frames}
          tableWidthM={TABLE_WIDTH}
          tableHeightM={TABLE_HEIGHT}
          ballRadiusM={BALL_RADIUS}
        />
      )}
    </>
  );
}

type Props = {
  result: SimResult | null;
  baselineResult: SimResult | null;
  currentFrame: number;
  showBaseline?: boolean;
  showDeviation?: boolean;
  height?: string;
  initialBalls?: Array<{ id: string; x: number; y: number }>;
  shotDirection?: { directionDeg: number; cueBallId: string };
};

export function TestScene({
  result,
  baselineResult,
  currentFrame,
  showBaseline = false,
  showDeviation = false,
  height = '400px',
  initialBalls,
  shotDirection,
}: Props) {
  const zoom = Math.min(window.innerWidth / TABLE_WIDTH, 300) * 0.85;

  return (
    <div style={{ height, background: '#0a0a1a', borderRadius: '8px', overflow: 'hidden' }}>
      <Canvas gl={{ antialias: true }} style={{ width: '100%', height: '100%' }}>
        <OrthographicCamera
          makeDefault
          position={[0, 5, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          zoom={zoom}
          near={0.1}
          far={100}
        />
        <SceneContent
          result={result}
          baselineResult={baselineResult}
          currentFrame={currentFrame}
          showBaseline={showBaseline}
          showDeviation={showDeviation}
          initialBalls={initialBalls}
          shotDirection={shotDirection}
        />
      </Canvas>
    </div>
  );
}


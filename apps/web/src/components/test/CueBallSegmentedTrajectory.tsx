/**
 * Renders the cue ball trajectory as segments separated by collision events.
 * Each segment is color-coded (white -> yellow -> orange -> red) to show
 * collision count. Hovering a segment highlights it in cyan and shows a
 * tooltip with speed, spin, and collision info.
 */

import { useMemo, useState, useCallback } from 'react';
import { Line, Html, Sphere } from '@react-three/drei';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { TrajectoryFrame, SimEvent, TrajectoryFrameBall } from '@physics-core/standalone-simulator';
import { PHYSICS } from '../../lib/constants';

const TABLE_W = PHYSICS.TABLE_WIDTH;
const TABLE_H = PHYSICS.TABLE_HEIGHT;
const BALL_Y = PHYSICS.BALL_RADIUS;

function toThree(physX: number, physZ: number): [number, number, number] {
  return [physX - TABLE_W / 2, BALL_Y, physZ - TABLE_H / 2];
}

// Gradient: white (first segment) -> yellow -> orange -> red (last segment)
const GRADIENT = ['#ffffff', '#ffee00', '#ffaa00', '#ff5500', '#ff0000'];

function segmentColor(index: number, total: number): string {
  if (total <= 1) return GRADIENT[0];
  const t = index / (total - 1);
  const i = Math.min(Math.round(t * (GRADIENT.length - 1)), GRADIENT.length - 1);
  return GRADIENT[i];
}

function getSpinLabel(ball: TrajectoryFrameBall): string {
  const { spinX, spinY, spinZ, vx, vz, speed } = ball;
  const total = Math.sqrt(spinX ** 2 + spinY ** 2 + spinZ ** 2);
  if (total < 0.5) return '무회전';

  const absX = Math.abs(spinX);
  const absY = Math.abs(spinY);
  const absZ = Math.abs(spinZ);

  // Side spin (English) is dominant
  if (absY > absX && absY > absZ) {
    return spinY > 0 ? '우회전' : '좌회전';
  }

  // Rolling: project spin onto forward rolling axis (uz, 0, -ux)
  if (speed < 0.01) return '회전';
  const ux = vx / speed;
  const uz = vz / speed;
  const forwardSpin = spinX * uz - spinZ * ux;
  return forwardSpin > 0 ? '톱스핀' : '백스핀';
}

function getTotalSpin(ball: TrajectoryFrameBall): number {
  return Math.sqrt(ball.spinX ** 2 + ball.spinY ** 2 + ball.spinZ ** 2);
}

function eventLabel(ev: SimEvent | undefined, isStart: boolean): string {
  if (!ev) return isStart ? '출발' : '정지';
  if (ev.type === 'CUSHION') return '쿠션 충돌';
  return '공 충돌';
}

// --- Types ---

type Segment = {
  startFrame: number;
  endFrame: number;
  startEvent?: SimEvent;
  endEvent?: SimEvent;
  points: [number, number, number][];
  frameBalls: TrajectoryFrameBall[];
};

type HoverInfo = {
  segIndex: number;
  ball: TrajectoryFrameBall;
  pos3d: [number, number, number];
  startEvent?: SimEvent;
  endEvent?: SimEvent;
};

// --- Hit-mesh per segment ---

type HitMeshProps = {
  seg: Segment;
  segIndex: number;
  onOver: (si: number) => void;
  onOut: () => void;
  onMove: (e: ThreeEvent<PointerEvent>, si: number, seg: Segment) => void;
};

function SegmentHitMesh({ seg, segIndex, onOver, onOut, onMove }: HitMeshProps) {
  const curve = useMemo(() => {
    const vecs = seg.points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    return new THREE.CatmullRomCurve3(vecs);
  }, [seg.points]);

  const tubeSegments = Math.max(seg.points.length * 2, 8);

  return (
    <mesh
      onPointerOver={(e) => { e.stopPropagation(); onOver(segIndex); }}
      onPointerOut={() => onOut()}
      onPointerMove={(e) => onMove(e, segIndex, seg)}
    >
      <tubeGeometry args={[curve, tubeSegments, 0.04, 6, false]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

// --- Tooltip ---

function Tooltip({ info }: { info: HoverInfo }) {
  const { ball, startEvent, endEvent, segIndex } = info;
  const spinLabel = getSpinLabel(ball);
  const spinSpeed = getTotalSpin(ball);

  return (
    <div
      style={{
        background: 'rgba(15, 23, 42, 0.93)',
        border: '1px solid #334155',
        borderRadius: 6,
        padding: '8px 10px',
        fontSize: 11,
        color: '#e2e8f0',
        minWidth: 155,
        fontFamily: 'system-ui, sans-serif',
        lineHeight: 1.65,
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        whiteSpace: 'nowrap',
      }}
    >
      <div style={{ fontWeight: 700, color: '#00ccff', marginBottom: 4 }}>
        구간 {segIndex + 1}
      </div>
      <div>이동속도: <b>{ball.speed.toFixed(2)} m/s</b></div>
      <div>회전방향: <b>{spinLabel}</b></div>
      <div>회전속도: <b>{spinSpeed.toFixed(1)} rad/s</b></div>
      <div
        style={{
          borderTop: '1px solid #1e293b',
          marginTop: 4,
          paddingTop: 4,
          color: '#94a3b8',
        }}
      >
        출발: {eventLabel(startEvent, true)}
      </div>
      <div style={{ color: '#94a3b8' }}>
        도착: {eventLabel(endEvent, false)}
      </div>
    </div>
  );
}

// --- Main component ---

type Props = {
  frames: TrajectoryFrame[];
  events: SimEvent[];
  currentFrame?: number;
};

export function CueBallSegmentedTrajectory({ frames, events, currentFrame }: Props) {
  const [hoveredSeg, setHoveredSeg] = useState<number | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

  // Build segments: split cue ball path at each collision frameIndex.
  // Adjacent segments share the boundary frame so the trajectory is continuous.
  const segments = useMemo<Segment[]>(() => {
    const limit = currentFrame !== undefined ? currentFrame + 1 : frames.length;

    const cueEvents = events
      .filter((e) => e.ballId === 'cueBall' && e.frameIndex < limit)
      .sort((a, b) => a.frameIndex - b.frameIndex);

    // Build break-points array: [0, ev1.frameIndex, ev2.frameIndex, ..., limit-1]
    const raw = [0, ...cueEvents.map((e) => e.frameIndex), limit - 1];
    const breaks = raw.filter((v, i) => i === 0 || v !== raw[i - 1]);

    return breaks
      .slice(0, -1)
      .map((startF, si) => {
        const endF = breaks[si + 1];
        const startEvent = cueEvents.find((e) => e.frameIndex === startF);
        const endEvent   = cueEvents.find((e) => e.frameIndex === endF);

        const pts: [number, number, number][] = [];
        const balls: TrajectoryFrameBall[] = [];

        // If segment starts at a collision: use collision position with
        // post-collision ball data (from the collision frame snapshot).
        if (startEvent) {
          const ball = frames[startF]?.balls.find((b) => b.id === 'cueBall');
          if (ball) {
            pts.push(toThree(startEvent.position.x, startEvent.position.z));
            balls.push(ball);
          }
        }

        // Add intermediate frames (exclude collision boundary frames so each
        // segment owns its own boundary data — pre vs post collision).
        const loopStart = startEvent ? startF + 1 : startF;
        const loopEnd   = endEvent   ? endF   - 1 : endF;

        for (let fi = loopStart; fi <= loopEnd && fi < frames.length; fi++) {
          const ball = frames[fi]?.balls.find((b) => b.id === 'cueBall');
          if (ball) {
            pts.push(toThree(ball.x, ball.z));
            balls.push(ball);
          }
        }

        // If segment ends at a collision: use collision position with
        // pre-collision ball data (from the frame just before collision).
        if (endEvent) {
          const preFrame = endF - 1 >= 0 ? endF - 1 : 0;
          const ball = frames[preFrame]?.balls.find((b) => b.id === 'cueBall');
          if (ball) {
            pts.push(toThree(endEvent.position.x, endEvent.position.z));
            balls.push(ball);
          }
        }

        return {
          startFrame: startF,
          endFrame: endF,
          startEvent,
          endEvent,
          points: pts,
          frameBalls: balls,
        };
      })
      .filter((s) => s.points.length >= 2);
  }, [frames, events, currentFrame]);

  // Collision marker positions (small cyan spheres at each collision point)
  const markerPositions = useMemo(() => {
    const limit = currentFrame !== undefined ? currentFrame + 1 : frames.length;
    return events
      .filter((e) => e.ballId === 'cueBall' && e.frameIndex < limit)
      .map((e) => toThree(e.position.x, e.position.z));
  }, [events, frames.length, currentFrame]);

  const handleOver = useCallback((si: number) => setHoveredSeg(si), []);

  const handleOut = useCallback(() => {
    setHoveredSeg(null);
    setHoverInfo(null);
  }, []);

  const handleMove = useCallback((e: ThreeEvent<PointerEvent>, si: number, seg: Segment) => {
    const pt = e.point;
    let minDist = Infinity;
    let closestBall: TrajectoryFrameBall | null = null;
    let closestPos: [number, number, number] = seg.points[0];

    seg.points.forEach((p, i) => {
      const dist = Math.sqrt((p[0] - pt.x) ** 2 + (p[2] - pt.z) ** 2);
      if (dist < minDist) {
        minDist = dist;
        closestBall = seg.frameBalls[i];
        closestPos = p;
      }
    });

    if (closestBall) {
      setHoverInfo({
        segIndex: si,
        ball: closestBall,
        pos3d: closestPos,
        startEvent: seg.startEvent,
        endEvent: seg.endEvent,
      });
    }
  }, []);

  if (segments.length === 0) return null;

  const total = segments.length;

  return (
    <>
      {/* Visible segment lines */}
      {segments.map((seg, si) => (
        <Line
          key={`cue-seg-${si}`}
          points={seg.points}
          color={hoveredSeg === si ? '#00ffff' : segmentColor(si, total)}
          lineWidth={hoveredSeg === si ? 4 : 2.5}
          transparent
          opacity={1}
        />
      ))}

      {/* Invisible tube meshes for pointer event hit-testing */}
      {segments.map((seg, si) => (
        <SegmentHitMesh
          key={`cue-hit-${si}`}
          seg={seg}
          segIndex={si}
          onOver={handleOver}
          onOut={handleOut}
          onMove={handleMove}
        />
      ))}

      {/* Cyan dot markers at each collision point */}
      {markerPositions.map((pos, i) => (
        <Sphere key={`cue-mk-${i}`} args={[0.007, 8, 8]} position={pos}>
          <meshBasicMaterial color="#00ccff" />
        </Sphere>
      ))}

      {/* Hover tooltip (rendered as HTML overlay via drei Html) */}
      {hoverInfo && (
        <Html
          position={hoverInfo.pos3d}
          style={{ pointerEvents: 'none', transform: 'translate(14px, -50%)' }}
          zIndexRange={[100, 200]}
        >
          <Tooltip info={hoverInfo} />
        </Html>
      )}
    </>
  );
}

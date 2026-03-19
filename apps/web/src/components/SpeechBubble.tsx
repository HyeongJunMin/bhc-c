import { useEffect, useMemo, useState } from 'react';
import { Html } from '@react-three/drei';
import type { ChatMessage } from '../lib/api-client';

type SpeechBubbleProps = {
  message: ChatMessage;
  slotIndex: number;
};

// 테이블 외각 4 코너 3D 슬롯 (X, Y, Z)
// 테이블 outer rail: X ±1.55m, Z ±0.85m → 슬롯은 그보다 바깥
const SLOTS: [number, number, number][] = [
  [-1.9, 0.15, -1.1], // TL
  [ 1.9, 0.15, -1.1], // TR
  [-1.9, 0.15,  1.1], // BL
  [ 1.9, 0.15,  1.1], // BR
];

function seededRandom(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return ((h >>> 0) / 0xffffffff);
}

export function SpeechBubble({ message, slotIndex }: SpeechBubbleProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => { setVisible(false); }, 5000);
    return () => { clearTimeout(timer); };
  }, [message]);

  const position = useMemo((): [number, number, number] => {
    const slot = SLOTS[slotIndex];
    const offsetR = seededRandom(message.sentAt + '2');
    const offset = (offsetR - 0.5) * 0.3; // ±0.15m
    return [slot[0] + offset, slot[1], slot[2] + offset];
  }, [message.sentAt, slotIndex]);

  const truncated =
    message.message.length > 60 ? message.message.slice(0, 60) + '…' : message.message;

  return (
    <Html position={position} center style={{ pointerEvents: 'none' }}>
      <div
        style={{
          background: 'rgba(0,0,0,0.8)',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.15)',
          padding: '8px 14px',
          width: 158,
          transition: 'opacity 0.5s ease',
          opacity: visible ? 1 : 0,
          whiteSpace: 'nowrap',
          userSelect: 'none',
        }}
      >
        <div style={{ fontSize: 11, color: '#ffd700', marginBottom: 4, fontWeight: 'bold' }}>
          {message.senderDisplayName}
        </div>
        <div style={{ fontSize: 13, color: '#ffffff', wordBreak: 'break-word', whiteSpace: 'normal' }}>
          {truncated}
        </div>
      </div>
    </Html>
  );
}

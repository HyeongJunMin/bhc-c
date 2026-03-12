import { useEffect, useState } from 'react';
import type { ChatMessage } from '../lib/api-client';

type SpeechBubbleProps = {
  message: ChatMessage;
  playerIndex: number; // 0 = left, 1 = right
};

export function SpeechBubble({ message, playerIndex }: SpeechBubbleProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => { setVisible(false); }, 5000);
    return () => { clearTimeout(timer); };
  }, [message]);

  const truncated =
    message.message.length > 60 ? message.message.slice(0, 60) + '…' : message.message;

  const posStyle: React.CSSProperties =
    playerIndex === 0
      ? { bottom: 80, left: 20 }
      : { bottom: 80, right: 340 };

  return (
    <div
      style={{
        position: 'fixed',
        ...posStyle,
        background: 'rgba(0,0,0,0.8)',
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.15)',
        padding: '8px 14px',
        maxWidth: 220,
        transition: 'opacity 0.5s ease',
        opacity: visible ? 1 : 0,
        pointerEvents: 'none',
        zIndex: 50,
      }}
    >
      <div style={{ fontSize: 11, color: '#ffd700', marginBottom: 4, fontWeight: 'bold' }}>
        {message.senderDisplayName}
      </div>
      <div style={{ fontSize: 13, color: '#ffffff', wordBreak: 'break-word' }}>
        {truncated}
      </div>
    </div>
  );
}

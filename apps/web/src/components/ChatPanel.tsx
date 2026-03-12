import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import type { ChatMessage } from '../lib/api-client';

type ChatPanelProps = {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  currentMemberId: string;
  initialPosition?: { right: number; bottom: number };
};

const MIN_W = 240;
const MAX_W = 600;
const MIN_H = 200;
const MAX_H = 500;

export function ChatPanel({ messages, onSend, currentMemberId, initialPosition = { right: 20, bottom: 20 } }: ChatPanelProps) {
  const [text, setText] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(messages.length);

  const [pos, setPos] = useState(() => ({
    x: window.innerWidth - 320 - initialPosition.right,
    y: window.innerHeight - 280 - initialPosition.bottom,
  }));
  const [size, setSize] = useState({ width: 320, height: 280 });

  // refs for use in event handlers to avoid stale closures
  const posRef = useRef(pos);
  posRef.current = pos;
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const dragRef = useRef({ active: false, startMouseX: 0, startMouseY: 0, startX: 0, startY: 0 });
  const resizeRef = useRef({ active: false, startMouseX: 0, startMouseY: 0, startW: 0, startH: 0 });

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (dragRef.current.active) {
        const dx = e.clientX - dragRef.current.startMouseX;
        const dy = e.clientY - dragRef.current.startMouseY;
        const { width, height } = sizeRef.current;
        const newX = Math.max(0, Math.min(window.innerWidth - width, dragRef.current.startX + dx));
        const newY = Math.max(0, Math.min(window.innerHeight - height, dragRef.current.startY + dy));
        setPos({ x: newX, y: newY });
      } else if (resizeRef.current.active) {
        const dx = e.clientX - resizeRef.current.startMouseX;
        const dy = e.clientY - resizeRef.current.startMouseY;
        const newW = Math.max(MIN_W, Math.min(MAX_W, resizeRef.current.startW + dx));
        const newH = Math.max(MIN_H, Math.min(MAX_H, resizeRef.current.startH + dy));
        setSize({ width: newW, height: newH });
      }
    };
    const onMouseUp = () => {
      dragRef.current.active = false;
      resizeRef.current.active = false;
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  useEffect(() => {
    if (!collapsed) {
      setUnreadCount(0);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      const newCount = messages.length - prevMessageCountRef.current;
      if (newCount > 0) setUnreadCount((prev) => prev + newCount);
    }
    prevMessageCountRef.current = messages.length;
  }, [messages, collapsed]);

  function handleHeaderMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    dragRef.current = {
      active: true,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: posRef.current.x,
      startY: posRef.current.y,
    };
  }

  function handleResizeMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = {
      active: true,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startW: sizeRef.current.width,
      startH: sizeRef.current.height,
    };
  }

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || rateLimited) return;
    onSend(trimmed);
    setText('');
    setRateLimited(true);
    setTimeout(() => { setRateLimited(false); }, 3000);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSend();
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => { setCollapsed(false); setUnreadCount(0); }}
        style={{
          position: 'fixed',
          bottom: initialPosition.bottom,
          right: initialPosition.right,
          zIndex: 200,
          pointerEvents: 'auto',
          background: 'rgba(0,0,0,0.85)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
          color: '#fff',
          padding: '8px 16px',
          cursor: 'pointer',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        채팅
        {unreadCount > 0 && (
          <span
            style={{
              background: '#ffd700',
              color: '#000',
              borderRadius: '50%',
              width: 18,
              height: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 'bold',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      data-chat-panel
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: size.width,
        height: size.height,
        zIndex: 200,
        pointerEvents: 'auto',
        background: 'rgba(0,0,0,0.85)',
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      {/* Header (drag handle) */}
      <div
        onMouseDown={handleHeaderMouseDown}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
          cursor: 'grab',
          userSelect: 'none',
        }}
      >
        <span style={{ color: '#00ff88', fontWeight: 'bold', fontSize: 13 }}>채팅</span>
        <button
          type="button"
          onMouseDown={(e) => { e.stopPropagation(); }}
          onClick={() => { setCollapsed(true); }}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#aaa',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            padding: '0 2px',
          }}
        >
          −
        </button>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {messages.length === 0 && (
          <div style={{ color: '#555', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
            아직 메시지가 없습니다.
          </div>
        )}
        {messages.map((msg, idx) => {
          const isMe = msg.senderMemberId === currentMemberId;
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isMe ? 'flex-end' : 'flex-start',
              }}
            >
              {!isMe && (
                <span style={{ fontSize: 10, color: '#ffd700', marginBottom: 2 }}>
                  {msg.senderDisplayName}
                </span>
              )}
              <div
                style={{
                  background: isMe ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255,255,255,0.08)',
                  border: isMe ? '1px solid rgba(0,255,136,0.3)' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  padding: '4px 10px',
                  maxWidth: '85%',
                  fontSize: 13,
                  color: isMe ? '#00ff88' : '#ffffff',
                  wordBreak: 'break-word',
                }}
              >
                {msg.message}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          padding: '8px 10px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}
      >
        <input
          type="text"
          value={text}
          onChange={(e) => { setText(e.target.value.slice(0, 100)); }}
          onKeyDown={handleKeyDown}
          disabled={rateLimited}
          placeholder={rateLimited ? '잠시 후 다시 입력...' : '메시지 입력...'}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 6,
            color: '#fff',
            padding: '5px 8px',
            fontSize: 13,
            outline: 'none',
            opacity: rateLimited ? 0.5 : 1,
          }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={rateLimited || !text.trim()}
          style={{
            background: rateLimited || !text.trim() ? '#333' : '#0f3460',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            padding: '5px 12px',
            fontSize: 13,
            cursor: rateLimited || !text.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          전송
        </button>
      </div>

      {/* Resize handle (bottom-right) */}
      <div
        onMouseDown={handleResizeMouseDown}
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: 16,
          height: 16,
          cursor: 'nwse-resize',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
          padding: 2,
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M9 3L3 9M9 6L6 9M9 9L9 9" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

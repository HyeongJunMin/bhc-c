import { useEffect } from 'react';

type HelpOverlayProps = {
  onClose: () => void;
};

const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  background: 'rgba(0,0,0,0.12)',
  border: '1px solid rgba(0,0,0,0.2)',
  borderRadius: 4,
  padding: '1px 5px',
  fontSize: 12,
  fontFamily: 'monospace',
  fontWeight: 600,
  lineHeight: '18px',
};

const cardStyle: React.CSSProperties = {
  position: 'absolute',
  background: 'rgba(255, 255, 255, 0.88)',
  color: '#222',
  borderRadius: 10,
  padding: '12px 16px',
  maxWidth: 260,
  fontSize: 13,
  boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
};

function Kbd({ children }: { children: React.ReactNode }) {
  return <span style={kbdStyle}>{children}</span>;
}

export function HelpOverlay({ onClose }: HelpOverlayProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 300,
      }}
    >
      {/* 1. 당점 조절 */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ ...cardStyle, bottom: 100, left: 20 }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>당점 조절</div>
        <div>
          <Kbd>W</Kbd><Kbd>A</Kbd><Kbd>S</Kbd><Kbd>D</Kbd>로 이동
          <br />
          <Kbd>Shift</Kbd>+<Kbd>WASD</Kbd> 미세조정
          <br />
          원형 패드 드래그로 직접 조절
        </div>
      </div>

      {/* 2. 파워 & 샷 */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ ...cardStyle, bottom: 220, left: 20 }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>파워 &amp; 샷</div>
        <div>
          좌클릭 + 아래로 드래그 → 파워 조절
          <br />
          놓으면 샷 실행
        </div>
      </div>

      {/* 3. 카메라 조작 */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ ...cardStyle, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>카메라 조작</div>
        <div>
          우클릭 + 드래그 → 회전
          <br />
          마우스 휠 → 줌
        </div>
      </div>

      {/* 4. 설정 */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ ...cardStyle, top: 70, right: 200 }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>설정</div>
        <div>
          시점고정모드, 수구궤적 토글
        </div>
      </div>

      {/* 5. 채팅 */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ ...cardStyle, bottom: 20, right: 360 }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>채팅</div>
        <div>
          <Kbd>Enter</Kbd> → 전송
          <br />
          헤더 드래그 → 이동
          <br />
          우하단 → 크기 조절
        </div>
      </div>

      {/* 6. 공 방향 */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ ...cardStyle, bottom: 140, left: '50%', transform: 'translateX(-50%)' }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>공 방향</div>
        <div>
          <Kbd>←</Kbd> <Kbd>→</Kbd> 방향 조절
          <br />
          <Kbd>M</Kbd> → AUTO_SYNC 전환
        </div>
      </div>

    </div>
  );
}

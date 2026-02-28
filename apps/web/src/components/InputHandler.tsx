import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../hooks/useGameStore';
import { INPUT_LIMITS } from '../lib/constants';

/**
 * 새로운 입력 처리 컴포넌트
 * - 마우스 이동: 당구대 회전 (OrbitControls)
 * - 마우스 왼쪽 클릭 + 드래그: 큐 파워 조절 + 샷 실행
 * - 마우스 클릭 상태: WASD로 당점 조절 가능
 * - 마우스 클릭 상태: 당구대 회전 고정
 */
export function InputHandler() {
  const {
    phase,
    shotInput,
    isDragging,
    shotPending,
    memberId,
    setDragPower,
    setImpactOffset,
    setIsDragging,
    executeShot,
    resetShot,
  } = useGameStore();

  const isAiming = phase === 'AIMING' && !shotPending && !!memberId;
  const dragState = useRef({
    startY: 0,
    currentPower: 10,
  });

  // 마우스 다운 - 드래그/샷 준비 시작
  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (!isAiming || e.button !== 0) return;
    
    // 드래그 모드 시작
    setIsDragging(true);
    dragState.current.startY = e.clientY;
    dragState.current.currentPower = 10;
    setDragPower(10);
  }, [isAiming, setIsDragging, setDragPower]);

  // 마우스 이동 - 파워 조절 (드래그 중일 때만)
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isAiming || !isDragging) return;
      
      // 드래그 중 - 파워 조절
      const deltaY = e.clientY - dragState.current.startY;
      const newPower = Math.max(
        INPUT_LIMITS.DRAG_MIN,
        Math.min(INPUT_LIMITS.DRAG_MAX, 10 + deltaY)
      );
      dragState.current.currentPower = newPower;
      setDragPower(newPower);
    },
    [isAiming, isDragging, setDragPower]
  );

  // 마우스 업 - 샷 실행
  const handleMouseUp = useCallback(() => {
    if (!isAiming || !isDragging) return;
    
    console.log('[Input] Mouse up, power:', dragState.current.currentPower);
    
    setIsDragging(false);
    
    // 클릭만 해도 최소 파워 샷이 나가도록 허용
    console.log('[Input] Executing shot!');
    executeShot();
  }, [isAiming, isDragging, setIsDragging, executeShot]);

  // 키보드 입력 - 당점 조절 (드래그 중일 때만 가능)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isAiming || !isDragging) return;
      
      const step = 0.002;
      const maxOffset = INPUT_LIMITS.OFFSET_MAX * 0.9; // 미스큐 여유
      
      switch (e.key.toLowerCase()) {
        case 'w':
          setImpactOffset(
            shotInput.impactOffsetX,
            Math.max(-maxOffset, shotInput.impactOffsetY - step)
          );
          break;
        case 's':
          setImpactOffset(
            shotInput.impactOffsetX,
            Math.min(maxOffset, shotInput.impactOffsetY + step)
          );
          break;
        case 'a':
          setImpactOffset(
            Math.max(-maxOffset, shotInput.impactOffsetX - step),
            shotInput.impactOffsetY
          );
          break;
        case 'd':
          setImpactOffset(
            Math.min(maxOffset, shotInput.impactOffsetX + step),
            shotInput.impactOffsetY
          );
          break;
        case 'r':
          resetShot();
          break;
      }
    },
    [isAiming, isDragging, shotInput, setImpactOffset, resetShot]
  );

  // 이벤트 리스너 등록
  useEffect(() => {
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
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleKeyDown]);

  return null;
}

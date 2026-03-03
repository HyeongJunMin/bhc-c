import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../hooks/useGameStore';
import { INPUT_LIMITS } from '../lib/constants';

/**
 * 입력 처리 컴포넌트
 */
export function InputHandler() {
  const {
    phase,
    isDragging,
    shotInput,
    setDragPower,
    setImpactOffset,
    setIsDragging,
    executeShot,
    resetShot,
  } = useGameStore();

  const isAiming = phase === 'AIMING';
  const dragState = useRef({
    startY: 0,
    currentPower: 10,
  });

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (!isAiming || e.button !== 0) return;
    
    setIsDragging(true);
    dragState.current.startY = e.clientY;
    dragState.current.currentPower = 10;
    setDragPower(10);
  }, [isAiming, setIsDragging, setDragPower]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isAiming || !isDragging) return;
      
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

  const handleMouseUp = useCallback(() => {
    if (!isAiming || !isDragging) return;
    
    setIsDragging(false);
    
    if (dragState.current.currentPower >= INPUT_LIMITS.DRAG_MIN + 5) {
      executeShot();
    } else {
      setDragPower(10);
    }
  }, [isAiming, isDragging, setIsDragging, executeShot, setDragPower]);

  // 키보드 입력 - e.code로 물리적 키 위치 인식 (한글/영문 모드 무관)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isAiming) return;
      
      const step = 0.005;
      const maxOffset = INPUT_LIMITS.OFFSET_MAX * 0.9;
      
      // e.code로 물리적 키 위치 확인 (KeyW, KeyA, KeyS, KeyD)
      switch (e.code) {
        case 'KeyW':
          setImpactOffset(
            shotInput.impactOffsetX,
            Math.max(-maxOffset, shotInput.impactOffsetY - step)
          );
          break;
        case 'KeyS':
          setImpactOffset(
            shotInput.impactOffsetX,
            Math.min(maxOffset, shotInput.impactOffsetY + step)
          );
          break;
        case 'KeyA':
          setImpactOffset(
            Math.max(-maxOffset, shotInput.impactOffsetX - step),
            shotInput.impactOffsetY
          );
          break;
        case 'KeyD':
          setImpactOffset(
            Math.min(maxOffset, shotInput.impactOffsetX + step),
            shotInput.impactOffsetY
          );
          break;
        case 'KeyR':
          resetShot();
          break;
      }
    },
    [isAiming, shotInput, setImpactOffset, resetShot]
  );

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

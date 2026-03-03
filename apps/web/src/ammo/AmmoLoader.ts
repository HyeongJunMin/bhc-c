/**
 * Ammo.js Loader - Script Tag 방식
 * 
 * index.html에서 ammo.js를 먼저 로드하고,
 * window.Ammo를 통해 접근합니다.
 */

// Ammo.js 타입 - 모듈 전체를 타입으로 가져옴
import AmmoModule from 'ammo.js';

// 전역 Ammo 타입 선언
declare global {
  interface Window {
    Ammo?: typeof AmmoModule;
  }
}

let ammoModule: typeof AmmoModule | null = null;
let loadPromise: Promise<typeof AmmoModule> | null = null;

/**
 * Ammo.js 초기화 완료 대기
 */
function waitForAmmo(maxWait: number = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const check = () => {
      // window.Ammo가 존재하고 함수들이 있는지 확인
      if (typeof window.Ammo !== 'undefined' && window.Ammo !== null) {
        const ammo = window.Ammo;
        // 주요 클래스가 있는지 확인
        if (ammo.btDefaultCollisionConfiguration && 
            ammo.btDbvtBroadphase && 
            ammo.btSequentialImpulseConstraintSolver) {
          console.log('[AmmoLoader] Ammo.js ready');
          resolve();
          return;
        }
      }
      
      if (Date.now() - startTime > maxWait) {
        reject(new Error('Ammo.js load timeout'));
        return;
      }
      
      setTimeout(check, 100);
    };
    
    check();
  });
}

/**
 * Ammo.js 초기화
 */
export async function loadAmmo(): Promise<typeof AmmoModule> {
  if (ammoModule) {
    return ammoModule;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise(async (resolve, reject) => {
    try {
      // Ammo.js 로드 대기
      await waitForAmmo();
      
      if (!window.Ammo) {
        throw new Error('Ammo.js not loaded');
      }

      ammoModule = window.Ammo;
      console.log('[AmmoLoader] Ammo.js initialized successfully');
      resolve(ammoModule);
    } catch (error) {
      console.error('[AmmoLoader] Failed to load Ammo.js:', error);
      reject(error);
    }
  });

  return loadPromise;
}

/**
 * Ammo.js 모듈 가져오기 (이미 로드된 경우)
 */
export function getAmmo(): typeof AmmoModule | null {
  return ammoModule;
}

/**
 * 로드 상태 확인
 */
export function isAmmoLoaded(): boolean {
  return ammoModule !== null;
}

// React Hook용
import { useState, useEffect } from 'react';

export function useAmmoLoader() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    loadAmmo()
      .then(() => setIsLoading(false))
      .catch((err) => {
        setError(err);
        setIsLoading(false);
      });
  }, []);

  return {
    ammo: ammoModule,
    isLoading,
    error,
  };
}

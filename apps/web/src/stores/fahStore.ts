import { create } from 'zustand';

type FahShotRequest = {
  targetPoint: number;
  requestedAt: number;
};

interface FahStore {
  fahTestTargetPoint: number;
  fahTestShotRequest: FahShotRequest | null;
  setFahTestTargetPoint: (targetPoint: number) => void;
  requestFahTestShot: (targetPoint: number) => void;
  clearFahTestShotRequest: () => void;
  resetFahStore: () => void;
}

const DEFAULT_TARGET_POINT = 10;

export const useFahStore = create<FahStore>((set) => ({
  fahTestTargetPoint: DEFAULT_TARGET_POINT,
  fahTestShotRequest: null,
  setFahTestTargetPoint: (targetPoint) => set({ fahTestTargetPoint: targetPoint }),
  requestFahTestShot: (targetPoint) =>
    set({
      fahTestTargetPoint: targetPoint,
      fahTestShotRequest: {
        targetPoint,
        requestedAt: Date.now(),
      },
    }),
  clearFahTestShotRequest: () => set({ fahTestShotRequest: null }),
  resetFahStore: () =>
    set({
      fahTestTargetPoint: DEFAULT_TARGET_POINT,
      fahTestShotRequest: null,
    }),
}));

import { readFileSync } from 'node:fs';

const source = readFileSync('apps/web/src/components/GameScene.tsx', 'utf8');

if (!source.includes("gameStore.shotInput.aimControlMode === 'AUTO_SYNC'")) {
  throw new Error('missing AUTO_SYNC guard in camera-shot direction sync');
}

if (!source.includes('cameraSyncedDeg') || !source.includes('gameStore.setShotDirection(cameraSyncedDeg)')) {
  throw new Error('missing camera synced shotDirection update');
}

if (!source.includes('AIM_CONTROL_CONTRACT.cameraSyncEpsilonDeg')) {
  throw new Error('missing camera sync epsilon contract usage');
}

console.log('QA-PLAY-001C pass: camera-shot direction sync contract verified');


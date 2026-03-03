import { readFileSync } from 'node:fs';

const source = readFileSync('apps/web/src/components/GameScene.tsx', 'utf8');

const requiredKeys = ['ㅈ', 'ㅁ', 'ㄴ', 'ㅇ'];
for (const key of requiredKeys) {
  if (!source.includes(`'${key}'`)) {
    throw new Error(`missing korean key mapping: ${key}`);
  }
}

const requiredCases = ["case 'w':", "case 'a':", "case 's':", "case 'd':"];
for (const syntax of requiredCases) {
  if (!source.includes(syntax)) {
    throw new Error(`missing latin key mapping: ${syntax}`);
  }
}

if (!source.includes("case 'm':") || !source.includes("case 'ㅡ':")) {
  throw new Error('missing aim mode toggle mapping for latin/korean m key');
}

console.log('QA-PLAY-001B pass: korean/latin key input mapping contract verified');


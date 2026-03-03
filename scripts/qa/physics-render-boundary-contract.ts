import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function assertIncludes(source: string, pattern: string, message: string): void {
  if (!source.includes(pattern)) {
    throw new Error(message + ` (missing: ${pattern})`);
  }
}

function main(): void {
  const gameScene = readFileSync(join(root, 'apps/web/src/components/GameScene.tsx'), 'utf8');
  const billiardTable = readFileSync(join(root, 'apps/web/src/components/BilliardTable.tsx'), 'utf8');

  // Render cushions must be placed outside by half thickness so the inner face matches physics boundary.
  assertIncludes(
    gameScene,
    '-TABLE_HEIGHT / 2 - cushionThickness / 2',
    'GameScene top cushion boundary contract broken',
  );
  assertIncludes(
    gameScene,
    'TABLE_HEIGHT / 2 + cushionThickness / 2',
    'GameScene bottom cushion boundary contract broken',
  );
  assertIncludes(
    gameScene,
    '-TABLE_WIDTH / 2 - cushionThickness / 2',
    'GameScene left cushion boundary contract broken',
  );
  assertIncludes(
    gameScene,
    'TABLE_WIDTH / 2 + cushionThickness / 2',
    'GameScene right cushion boundary contract broken',
  );

  assertIncludes(
    billiardTable,
    '-(TABLE_HEIGHT / 2 + CUSHION_THICKNESS / 2)',
    'BilliardTable top cushion boundary contract broken',
  );
  assertIncludes(
    billiardTable,
    '(TABLE_HEIGHT / 2 + CUSHION_THICKNESS / 2)',
    'BilliardTable bottom cushion boundary contract broken',
  );
  assertIncludes(
    billiardTable,
    '-(TABLE_WIDTH / 2 + CUSHION_THICKNESS / 2)',
    'BilliardTable left cushion boundary contract broken',
  );
  assertIncludes(
    billiardTable,
    '(TABLE_WIDTH / 2 + CUSHION_THICKNESS / 2)',
    'BilliardTable right cushion boundary contract broken',
  );

  console.log('PHYS-GEO-QA contract pass: render cushion boundaries align with physics inner-face model');
}

main();

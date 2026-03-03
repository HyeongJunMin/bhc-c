import { GameScene } from './components/GameScene';

/**
 * 3-Cushion Billiards Game
 * 
 * Features:
 * - Realistic 3D physics with Ammo.js (Bullet)
 * - Proper 3-cushion scoring rules
 * - Cue stick visualization with power gauge
 * - Impact point visualization (WASD control)
 * - Drag-to-shoot mechanics
 * 
 * Physics based on Physics-Spec.md:
 * - Ball diameter: 61.5mm
 * - Table: 2.844m x 1.422m (International Match Table)
 * - Ball-ball restitution: 0.95
 * - Ball-cushion restitution: 0.72
 * - Proper spin calculation
 */
function App() {
  return <GameScene />;
}

export default App;

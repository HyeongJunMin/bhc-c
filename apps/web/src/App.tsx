import { GameScene } from './components/GameScene';
import { GameUI } from './components/GameUI';
import { InputHandler } from './components/InputHandler';

function App() {
  return (
    <>
      <GameScene />
      <GameUI />
      <InputHandler />
    </>
  );
}

export default App;

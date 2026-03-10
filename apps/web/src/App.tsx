import { Routes, Route } from 'react-router-dom';
import { GameScene } from './components/GameScene';
import { FahScene } from './components/FahScene';
import { TestListPage } from './pages/TestListPage';
import { TestRunPage } from './pages/TestRunPage';
import { TestSandboxPage } from './pages/TestSandboxPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<GameScene />} />
      <Route path="/fah" element={<FahScene />} />
      <Route path="/test" element={<TestListPage />} />
      <Route path="/test/sandbox" element={<TestSandboxPage />} />
      <Route path="/test/:id" element={<TestRunPage />} />
    </Routes>
  );
}

export default App;

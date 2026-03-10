import { Routes, Route } from 'react-router-dom';
import { TestListPage } from './pages/TestListPage';
import { TestRunPage } from './pages/TestRunPage';
import { TestSandboxPage } from './pages/TestSandboxPage';
import { NicknamePage } from './pages/NicknamePage';
import { LobbyPage } from './pages/LobbyPage';
import { RoomPage } from './pages/RoomPage';
import { RequireAuth } from './components/RequireAuth';

function App() {
  return (
    <Routes>
      <Route path="/" element={<NicknamePage />} />
      <Route element={<RequireAuth />}>
        <Route path="/lobby" element={<LobbyPage />} />
        <Route path="/room/:roomId" element={<RoomPage />} />
      </Route>
      <Route path="/test" element={<TestListPage />} />
      <Route path="/test/sandbox" element={<TestSandboxPage />} />
      <Route path="/test/:id" element={<TestRunPage />} />
    </Routes>
  );
}

export default App;

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import { TestListPage } from './pages/TestListPage';
import { TestRunPage } from './pages/TestRunPage';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/test" element={<TestListPage />} />
        <Route path="/test/:id" element={<TestRunPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

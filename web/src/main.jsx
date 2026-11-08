import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import './index.css';
import { getToken } from './api.js';
import { ToastProvider } from './ui.jsx';
import Layout from './Layout.jsx';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import AddPerson from './pages/AddPerson.jsx';
import People from './pages/People.jsx';
import Review from './pages/Review.jsx';
import Studio from './pages/Studio.jsx';
import Approvals from './pages/Approvals.jsx';
import Outreach from './pages/Outreach.jsx';
import Leads from './pages/Leads.jsx';
import Settings from './pages/Settings.jsx';

function RequireAuth({ children }) {
  const nav = useNavigate();
  useEffect(() => {
    const out = () => nav('/login', { replace: true });
    window.addEventListener('ge:logout', out);
    return () => window.removeEventListener('ge:logout', out);
  }, [nav]);
  return getToken() ? children : <Navigate to="/login" replace />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RequireAuth><Layout /></RequireAuth>}>
            <Route index element={<Home />} />
            <Route path="add" element={<AddPerson />} />
            <Route path="people" element={<People />} />
            <Route path="people/:id/review" element={<Review />} />
            <Route path="people/:id/studio" element={<Studio />} />
            <Route path="approvals" element={<Approvals />} />
            <Route path="send" element={<Outreach />} />
            <Route path="leads" element={<Leads />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

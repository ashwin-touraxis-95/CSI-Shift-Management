import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Schedule from './pages/Schedule';
import Availability from './pages/Availability';
import ClockLogs from './pages/ClockLogs';
import ManageShifts from './pages/ManageShifts';
import Team from './pages/Team';

function PrivateRoute({ children, managerOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 18, color: '#999' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (managerOnly && user.role !== 'manager') return <Navigate to="/dashboard" />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return null;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/schedule" element={<PrivateRoute><Schedule /></PrivateRoute>} />
      <Route path="/availability" element={<PrivateRoute><Availability /></PrivateRoute>} />
      <Route path="/logs" element={<PrivateRoute managerOnly><ClockLogs /></PrivateRoute>} />
      <Route path="/manage-shifts" element={<PrivateRoute managerOnly><ManageShifts /></PrivateRoute>} />
      <Route path="/team" element={<PrivateRoute managerOnly><Team /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

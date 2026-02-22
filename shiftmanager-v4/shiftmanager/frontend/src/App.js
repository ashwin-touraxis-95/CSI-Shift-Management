import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MySchedule from './pages/MySchedule';
import Schedule from './pages/Schedule';
import Availability from './pages/Availability';
import ClockLogs from './pages/ClockLogs';
import ManageShifts from './pages/ManageShifts';
import Team from './pages/Team';
import AdminPanel from './pages/AdminPanel';

function PrivateRoute({ children, requirePerm, requireRole }) {
  const { user, loading, can, isAdmin } = useAuth();
  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'#999', fontSize:16 }}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (requireRole && !requireRole.includes(user.role)) return <Navigate to="/dashboard" />;
  if (requirePerm && !can(requirePerm) && !isAdmin) return <Navigate to="/dashboard" />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { user, loading, can } = useAuth();
  if (loading) return null;
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/my-schedule" element={<PrivateRoute><MySchedule /></PrivateRoute>} />
      <Route path="/availability" element={<PrivateRoute><Availability /></PrivateRoute>} />
      <Route path="/schedule" element={<PrivateRoute requirePerm="manage_shifts"><Schedule /></PrivateRoute>} />
      <Route path="/logs" element={<PrivateRoute requirePerm="view_clock_logs"><ClockLogs /></PrivateRoute>} />
      <Route path="/manage-shifts" element={<PrivateRoute requirePerm="manage_shifts"><ManageShifts /></PrivateRoute>} />
      <Route path="/team" element={<PrivateRoute><Team /></PrivateRoute>} />
      <Route path="/admin" element={<PrivateRoute requireRole={['account_admin']}><AdminPanel /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider><BrowserRouter><AppRoutes /></BrowserRouter></AuthProvider>
  );
}

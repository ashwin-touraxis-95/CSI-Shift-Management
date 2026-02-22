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
import Settings from './pages/Settings';

function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontSize:16, color:'#999' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/my-schedule" element={<PrivateRoute><MySchedule /></PrivateRoute>} />
      <Route path="/schedule" element={<PrivateRoute roles={['manager','team_leader']}><Schedule /></PrivateRoute>} />
      <Route path="/availability" element={<PrivateRoute><Availability /></PrivateRoute>} />
      <Route path="/logs" element={<PrivateRoute roles={['manager','team_leader']}><ClockLogs /></PrivateRoute>} />
      <Route path="/manage-shifts" element={<PrivateRoute roles={['manager','team_leader']}><ManageShifts /></PrivateRoute>} />
      <Route path="/team" element={<PrivateRoute roles={['manager']}><Team /></PrivateRoute>} />
      <Route path="/settings" element={<PrivateRoute roles={['manager']}><Settings /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider><BrowserRouter><AppRoutes /></BrowserRouter></AuthProvider>
  );
}

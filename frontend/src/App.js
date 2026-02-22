import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import MySchedule from './pages/MySchedule';
import Schedule from './pages/Schedule';
import ClockLogs from './pages/ClockLogs';
import ManageShifts from './pages/ManageShifts';
import Team from './pages/Team';
import AdminPanel from './pages/AdminPanel';

function PrivateRoute({ children, requirePerm: perm, requireUserType }) {
  const { user, loading, can, isAdmin, needsOnboarding } = useAuth();
  if (loading) return <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'#999' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (needsOnboarding) return <Navigate to="/onboarding" />;
  if (requireUserType && !requireUserType.includes(user.user_type)) return <Navigate to="/dashboard" />;
  if (perm && !can(perm) && !isAdmin) return <Navigate to="/dashboard" />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { user, loading, needsOnboarding } = useAuth();
  if (loading) return null;
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={needsOnboarding ? '/onboarding' : '/dashboard'} /> : <Login />} />
      <Route path="/onboarding" element={!user ? <Navigate to="/login" /> : <Onboarding />} />
      <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/my-schedule" element={<PrivateRoute><MySchedule /></PrivateRoute>} />
      <Route path="/schedule" element={<PrivateRoute requirePerm="manage_shifts"><Schedule /></PrivateRoute>} />
      <Route path="/logs" element={<PrivateRoute requirePerm="view_clock_logs"><ClockLogs /></PrivateRoute>} />
      <Route path="/manage-shifts" element={<PrivateRoute requirePerm="manage_shifts"><ManageShifts /></PrivateRoute>} />
      <Route path="/team" element={<PrivateRoute><Team /></PrivateRoute>} />
      <Route path="/admin" element={<PrivateRoute requireUserType={['account_admin']}><AdminPanel /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

export default function App() {
  return <AuthProvider><BrowserRouter><AppRoutes /></BrowserRouter></AuthProvider>;
}

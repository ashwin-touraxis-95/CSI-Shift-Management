import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('Page crashed:', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding:40, textAlign:'center' }}>
          <div style={{ fontSize:48, marginBottom:16 }}>⚠️</div>
          <h2 style={{ marginBottom:8, color:'#111827' }}>Something went wrong</h2>
          <p style={{ color:'#6B7280', marginBottom:24 }}>{this.state.error?.message || 'An unexpected error occurred'}</p>
          <button onClick={() => { this.setState({ hasError:false, error:null }); window.location.reload(); }}
            style={{ padding:'10px 24px', background:'#C0392B', color:'white', border:'none', borderRadius:8, cursor:'pointer', fontWeight:600, fontSize:14 }}>
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import MySchedule from './pages/MySchedule';
import Schedule from './pages/Schedule';
import ClockLogs from './pages/ClockLogs';
import ManageShifts from './pages/ManageShifts';
import Team from './pages/Team';
import AdminPanel from './pages/AdminPanel';

function PrivateRoute({ children, requirePerm: perm, requireUserType }) {
  const { user, loading, can, isAdmin, needsOnboarding } = useAuth();
  if (loading) return <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'#999',fontSize:14 }}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (user.force_password_change) return <Navigate to="/change-password" />;
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
      <Route path="/login" element={user ? <Navigate to={user.force_password_change ? '/change-password' : needsOnboarding ? '/onboarding' : '/dashboard'} /> : <Login />} />
      <Route path="/onboarding" element={!user ? <Navigate to="/login" /> : <Onboarding />} />
      <Route path="/change-password" element={!user ? <Navigate to="/login" /> : <ChangePassword forced={!!user.force_password_change} />} />
      <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/my-schedule" element={<PrivateRoute><MySchedule /></PrivateRoute>} />
      <Route path="/schedule" element={<PrivateRoute requirePerm="manage_shifts"><Schedule /></PrivateRoute>} />
      <Route path="/logs" element={<PrivateRoute requirePerm="view_clock_logs"><ClockLogs /></PrivateRoute>} />
      <Route path="/manage-shifts" element={<PrivateRoute requirePerm="manage_shifts"><ManageShifts /></PrivateRoute>} />
      <Route path="/team" element={<PrivateRoute><Team /></PrivateRoute>} />
      <Route path="/admin" element={<PrivateRoute requireUserType={['account_admin','manager','team_leader']}><AdminPanel /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

export default function App() {
  return <AuthProvider><BrowserRouter><AppRoutes /></BrowserRouter></AuthProvider>;
}

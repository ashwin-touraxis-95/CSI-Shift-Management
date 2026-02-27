import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

axios.defaults.baseURL = process.env.NODE_ENV === 'production' ? 'https://csi-shift-app.up.railway.app' : 'http://localhost:5000';
axios.defaults.withCredentials = true;

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [theme, setTheme] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/auth/me').then(r => {
      setUser(r.data.user);
      setPermissions(r.data.permissions);
      setTheme(r.data.theme);
      if (r.data.theme) applyTheme(r.data.theme);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const applyTheme = (t) => {
    if (!t) return;
    const root = document.documentElement;
    root.style.setProperty('--red', t.primary_color || '#C0392B');
    root.style.setProperty('--sidebar-bg', t.sidebar_bg || '#111827');
    root.style.setProperty('--sidebar-active', t.sidebar_active || '#C0392B');
    root.style.setProperty('--app-bg', t.app_bg || '#F1F5F9');
    root.style.setProperty('--card-bg', t.card_bg || '#FFFFFF');
    root.style.setProperty('--heading-color', t.heading_color || '#111827');
    root.style.setProperty('--body-color', t.body_color || '#334155');
    root.style.setProperty('--online-color', t.online_color || '#22C55E');
    root.style.setProperty('--offline-color', t.offline_color || '#94A3B8');
    root.style.setProperty('--draft-color', t.draft_color || '#FCD34D');
    root.style.setProperty('--published-color', t.published_color || '#22C55E');
    document.body.style.background = t.app_bg || '#F1F5F9';
  };

  const login = (userData, perms, themeData) => {
    setUser(userData); setPermissions(perms); setTheme(themeData);
    if (themeData) applyTheme(themeData);
  };

  const logout = async () => {
    try { await axios.post('/api/auth/logout'); } catch(e) {}
    setUser(null); setPermissions(null);
  };

  const updateTheme = (newTheme) => { setTheme(newTheme); applyTheme(newTheme); };
  const updateUser = (userData) => setUser(userData);

  const can = (perm) => {
    if (!user) return false;
    if (user.user_type === 'account_admin') return true;
    return !!permissions?.[perm];
  };

  const isAdmin = user?.user_type === 'account_admin';
  const isManager = user?.user_type === 'manager' || isAdmin;
  const isLeader = user?.user_type === 'team_leader' || isManager;
  const needsOnboarding = user && user.user_type === 'agent' && !user.onboarded;

  return (
    <AuthContext.Provider value={{ user, permissions, theme, loading, login, logout, can, isAdmin, isManager, isLeader, needsOnboarding, updateTheme, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

axios.defaults.baseURL = 'http://localhost:5000';
axios.defaults.withCredentials = true;

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/auth/me').then(r => {
      setUser(r.data.user);
      setPermissions(r.data.permissions);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const login = (userData, perms) => { setUser(userData); setPermissions(perms); };

  const logout = async () => {
    try { await axios.post('/api/auth/logout'); } catch(e) {}
    setUser(null); setPermissions(null);
  };

  // Helper — always true for account_admin
  const can = (perm) => {
    if (!user) return false;
    if (user.role === 'account_admin') return true;
    return !!permissions?.[perm];
  };

  const isAdmin = user?.role === 'account_admin';
  const isManager = user?.role === 'manager' || isAdmin;
  const isLeader = user?.role === 'team_leader' || isManager;

  return (
    <AuthContext.Provider value={{ user, permissions, loading, login, logout, can, isAdmin, isManager, isLeader }}>
      {children}
    </AuthContext.Provider>
  );
}

import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/dashboard', icon: '⚡', label: 'Dashboard' },
  { to: '/schedule', icon: '📅', label: 'Schedule' },
  { to: '/availability', icon: '👥', label: 'Availability' },
];
const managerItems = [
  { to: '/logs', icon: '📋', label: 'Clock Logs' },
  { to: '/manage-shifts', icon: '✏️', label: 'Manage Shifts' },
  { to: '/team', icon: '⚙️', label: 'Team' },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, background: '#111827', color: 'white',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100
      }}>
        {/* Brand */}
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, background: 'var(--red)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
            }}>🇿🇦</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>ShiftManager</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>South Africa</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '16px 12px', flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: 1.5, padding: '4px 8px 10px', textTransform: 'uppercase' }}>
            Main
          </div>
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 8, marginBottom: 2,
              textDecoration: 'none', fontSize: 14, fontWeight: 500,
              color: isActive ? 'white' : 'rgba(255,255,255,0.55)',
              background: isActive ? 'rgba(192,57,43,0.7)' : 'transparent',
              transition: 'all 0.15s'
            })}>
              <span>{item.icon}</span> {item.label}
            </NavLink>
          ))}

          {user?.role === 'manager' && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: 1.5, padding: '16px 8px 10px', textTransform: 'uppercase' }}>
                Management
              </div>
              {managerItems.map(item => (
                <NavLink key={item.to} to={item.to} style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 8, marginBottom: 2,
                  textDecoration: 'none', fontSize: 14, fontWeight: 500,
                  color: isActive ? 'white' : 'rgba(255,255,255,0.55)',
                  background: isActive ? 'rgba(192,57,43,0.7)' : 'transparent',
                  transition: 'all 0.15s'
                })}>
                  <span>{item.icon}</span> {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* User */}
        <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            {user?.avatar
              ? <img src={user.avatar} alt="" style={{ width: 36, height: 36, borderRadius: '50%' }} />
              : <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  {user?.name?.[0]}
                </div>
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'capitalize' }}>{user?.role} · {user?.department}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ marginLeft: 220, flex: 1, padding: '32px 36px', minHeight: '100vh' }}>
        <div className="fade-in">{children}</div>
      </main>
    </div>
  );
}

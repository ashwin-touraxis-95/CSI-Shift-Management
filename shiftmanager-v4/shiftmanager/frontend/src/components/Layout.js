import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }) {
  const { user, logout, can, isAdmin, isManager, isLeader } = useAuth();
  const navigate = useNavigate();

  const buildNav = () => {
    const items = [];
    // Everyone
    items.push({ to:'/dashboard', icon:'⚡', label:'Dashboard' });
    items.push({ to:'/availability', icon:'👥', label:'Availability' });
    // Agent schedule view (non-managers)
    if (!isManager) items.push({ to:'/my-schedule', icon:'📅', label:'My Schedule' });
    // Shift management — if they have permission
    if (can('manage_shifts')) items.push({ to:'/manage-shifts', icon:'✏️', label:'Manage Shifts' });
    // Clock logs
    if (can('view_clock_logs')) items.push({ to:'/logs', icon:'📋', label:'Clock Logs' });
    // Team schedule — managers/leaders only
    if (isLeader) items.push({ to:'/schedule', icon:'📊', label:'Team Schedule' });
    return items;
  };

  const buildAdmin = () => {
    const items = [];
    if (can('manage_users') || isManager) items.push({ to:'/team', icon:'👤', label:'Team' });
    if (isAdmin) items.push({ to:'/admin', icon:'🛡️', label:'Admin Panel' });
    return items;
  };

  const navItems = buildNav();
  const adminItems = buildAdmin();

  const roleLabel = { account_admin:'Account Admin', manager:'Manager', team_leader:'Team Leader', agent:'Agent' };
  const roleColor = { account_admin:'#C0392B', manager:'#2980B9', team_leader:'#8E44AD', agent:'#27AE60' };

  const NavItem = ({ to, icon, label }) => (
    <NavLink to={to} style={({ isActive }) => ({
      display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:8, marginBottom:2,
      textDecoration:'none', fontSize:14, fontWeight:500, transition:'all 0.15s',
      color: isActive ? 'white' : 'rgba(255,255,255,0.5)',
      background: isActive ? 'var(--red)' : 'transparent',
    })}>
      <span>{icon}</span>{label}
    </NavLink>
  );

  return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      <aside style={{ width:224, background:'#111827', color:'white', display:'flex', flexDirection:'column', position:'fixed', top:0, left:0, bottom:0, zIndex:100 }}>
        {/* Logo */}
        <div style={{ padding:'18px 16px', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:9, background:'var(--red)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🏢</div>
            <div>
              <div style={{ fontWeight:700, fontSize:14, lineHeight:1.2 }}>ShiftManager</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', marginTop:2 }}>TourAxis · South Africa</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding:'12px 10px', flex:1, overflowY:'auto' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.25)', letterSpacing:1.5, padding:'4px 8px 8px', textTransform:'uppercase' }}>Menu</div>
          {navItems.map(item => <NavItem key={item.to} {...item} />)}

          {adminItems.length > 0 && <>
            <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.25)', letterSpacing:1.5, padding:'14px 8px 8px', textTransform:'uppercase' }}>Admin</div>
            {adminItems.map(item => <NavItem key={item.to} {...item} />)}
          </>}
        </nav>

        {/* User info */}
        <div style={{ padding:14, borderTop:'1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            {user?.avatar
              ? <img src={user.avatar} alt="" style={{ width:34, height:34, borderRadius:'50%' }} />
              : <div style={{ width:34, height:34, borderRadius:'50%', background:'var(--red)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:14 }}>{user?.name?.[0]}</div>}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:600, fontSize:13, color:'white', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{user?.name}</div>
              <div style={{ fontSize:10, marginTop:2 }}>
                <span style={{ background:roleColor[user?.role]+'30', color:roleColor[user?.role], padding:'1px 7px', borderRadius:8, fontWeight:700 }}>
                  {roleLabel[user?.role] || user?.role}
                </span>
              </div>
            </div>
          </div>
          <button onClick={async () => { await logout(); navigate('/login'); }} style={{ width:'100%', padding:'7px', borderRadius:8, border:'1px solid rgba(255,255,255,0.12)', background:'transparent', color:'rgba(255,255,255,0.5)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Sign Out</button>
        </div>
      </aside>

      <main style={{ marginLeft:224, flex:1, padding:'28px 32px', minHeight:'100vh', background:'var(--gray-50)' }}>
        <div className="fade-in">{children}</div>
      </main>
    </div>
  );
}

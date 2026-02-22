import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isManager = user?.role === 'manager';
  const isLeader = user?.role === 'team_leader';

  const agentNav = [
    { to:'/dashboard', icon:'⚡', label:'Dashboard' },
    { to:'/my-schedule', icon:'📅', label:'My Schedule' },
    { to:'/availability', icon:'👥', label:'Availability' },
  ];
  const leaderNav = [
    { to:'/dashboard', icon:'⚡', label:'Dashboard' },
    { to:'/availability', icon:'👥', label:'Availability' },
    { to:'/manage-shifts', icon:'✏️', label:'Manage Shifts' },
    { to:'/logs', icon:'📋', label:'Clock Logs' },
  ];
  const managerNav = [
    { to:'/dashboard', icon:'⚡', label:'Dashboard' },
    { to:'/availability', icon:'👥', label:'Availability' },
    { to:'/schedule', icon:'📊', label:'Team Schedule' },
  ];
  const managerAdmin = [
    { to:'/manage-shifts', icon:'✏️', label:'Manage Shifts' },
    { to:'/logs', icon:'📋', label:'Clock Logs' },
    { to:'/team', icon:'👤', label:'Team' },
    { to:'/settings', icon:'⚙️', label:'Settings' },
  ];

  const navItems = isManager ? managerNav : isLeader ? leaderNav : agentNav;
  const adminItems = isManager ? managerAdmin : [];

  const NavItem = ({ to, icon, label }) => (
    <NavLink to={to} style={({ isActive }) => ({
      display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:8, marginBottom:2,
      textDecoration:'none', fontSize:14, fontWeight:500, transition:'all 0.15s',
      color: isActive ? 'white' : 'rgba(255,255,255,0.55)',
      background: isActive ? 'var(--red)' : 'transparent',
    })}>
      <span>{icon}</span>{label}
    </NavLink>
  );

  return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      <aside style={{ width:220, background:'#111827', color:'white', display:'flex', flexDirection:'column', position:'fixed', top:0, left:0, bottom:0, zIndex:100 }}>
        <div style={{ padding:'20px 16px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:9, background:'var(--red)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🏢</div>
            <div><div style={{ fontWeight:700, fontSize:14 }}>ShiftManager</div><div style={{ fontSize:10, color:'rgba(255,255,255,0.35)' }}>South Africa</div></div>
          </div>
        </div>

        <nav style={{ padding:'12px 10px', flex:1, overflowY:'auto' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.3)', letterSpacing:1.5, padding:'4px 8px 8px', textTransform:'uppercase' }}>Menu</div>
          {navItems.map(item => <NavItem key={item.to} {...item} />)}

          {adminItems.length > 0 && <>
            <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.3)', letterSpacing:1.5, padding:'16px 8px 8px', textTransform:'uppercase' }}>Admin</div>
            {adminItems.map(item => <NavItem key={item.to} {...item} />)}
          </>}
        </nav>

        <div style={{ padding:14, borderTop:'1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            {user?.avatar ? <img src={user.avatar} alt="" style={{ width:34, height:34, borderRadius:'50%' }} />
              : <div style={{ width:34, height:34, borderRadius:'50%', background:'var(--red)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>{user?.name?.[0]}</div>}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:600, fontSize:12, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{user?.name}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', textTransform:'capitalize' }}>{user?.role?.replace('_',' ')} · {user?.department}</div>
            </div>
          </div>
          <button onClick={async()=>{ await logout(); navigate('/login'); }} className="btn btn-secondary btn-sm" style={{ width:'100%', justifyContent:'center', fontSize:11 }}>Sign Out</button>
        </div>
      </aside>
      <main style={{ marginLeft:220, flex:1, padding:'28px 32px', minHeight:'100vh' }}>
        <div className="fade-in">{children}</div>
      </main>
    </div>
  );
}

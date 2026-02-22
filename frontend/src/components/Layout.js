import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }) {
  const { user, logout, can, isAdmin, isManager, isLeader, theme } = useAuth();
  const navigate = useNavigate();

  const buildNav = () => {
    const items = [{ to:'/dashboard', icon:'⚡', label:'Dashboard' }];
    if (!isManager) items.push({ to:'/my-schedule', icon:'📅', label:'My Schedule' });
    if (can('manage_shifts')) items.push({ to:'/manage-shifts', icon:'✏️', label:'Manage Shifts' });
    if (can('view_clock_logs')) items.push({ to:'/logs', icon:'📋', label:'Clock Logs' });
    if (isLeader) items.push({ to:'/schedule', icon:'📊', label:'Team Schedule' });
    return items;
  };

  const buildAdmin = () => {
    const items = [];
    if (isManager || isLeader) items.push({ to:'/team', icon:'👤', label:'Team' });
    if (isAdmin) items.push({ to:'/admin', icon:'🛡️', label:'Admin Panel' });
    return items;
  };

  const USER_TYPE_LABELS = { account_admin:'Account Admin', manager:'Manager', team_leader:'Team Leader', agent:'Agent' };
  const USER_TYPE_COLORS = { account_admin:'#C0392B', manager:'#2980B9', team_leader:'#8E44AD', agent:'#27AE60' };

  const sidebarBg = theme?.sidebar_bg || '#111827';
  const sidebarActive = theme?.sidebar_active || 'var(--red)';
  const sidebarText = theme?.sidebar_text || 'rgba(255,255,255,0.5)';
  const primary = theme?.primary_color || '#C0392B';
  const companyName = theme?.company_name || 'ShiftManager';
  const locationLabel = theme?.location_label || 'South Africa';
  const logo = theme?.company_logo;

  const NavItem = ({ to, icon, label }) => (
    <NavLink to={to} style={({ isActive }) => ({
      display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:8, marginBottom:2,
      textDecoration:'none', fontSize:14, fontWeight:500, transition:'all 0.15s',
      color: isActive ? 'white' : sidebarText,
      background: isActive ? sidebarActive : 'transparent',
    })}>
      <span>{icon}</span>{label}
    </NavLink>
  );

  return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      <aside style={{ width:224, background:sidebarBg, color:'white', display:'flex', flexDirection:'column', position:'fixed', top:0, left:0, bottom:0, zIndex:100 }}>
        <div style={{ padding:'18px 16px', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {logo ? <img src={logo} alt="Logo" style={{ width:36,height:36,borderRadius:9,objectFit:'contain',background:'white',padding:3 }}/>
              : <div style={{ width:36,height:36,borderRadius:9,background:primary,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18 }}>🏢</div>}
            <div>
              <div style={{ fontWeight:700,fontSize:14,lineHeight:1.2,color:'white' }}>{companyName}</div>
              <div style={{ fontSize:10,color:'rgba(255,255,255,0.3)',marginTop:2 }}>{locationLabel}</div>
            </div>
          </div>
        </div>

        <nav style={{ padding:'12px 10px', flex:1, overflowY:'auto' }}>
          <div style={{ fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.25)',letterSpacing:1.5,padding:'4px 8px 8px',textTransform:'uppercase' }}>Menu</div>
          {buildNav().map(item => <NavItem key={item.to} {...item}/>)}
          {buildAdmin().length > 0 && <>
            <div style={{ fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.25)',letterSpacing:1.5,padding:'14px 8px 8px',textTransform:'uppercase' }}>Admin</div>
            {buildAdmin().map(item => <NavItem key={item.to} {...item}/>)}
          </>}
        </nav>

        <div style={{ padding:14, borderTop:'1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:10 }}>
            {user?.avatar ? <img src={user.avatar} alt="" style={{ width:34,height:34,borderRadius:'50%' }}/>
              : <div style={{ width:34,height:34,borderRadius:'50%',background:primary,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14,color:'white' }}>{user?.name?.[0]}</div>}
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ fontWeight:600,fontSize:13,color:'white',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{user?.name}</div>
              <div style={{ fontSize:10,marginTop:2 }}>
                <span style={{ background:USER_TYPE_COLORS[user?.user_type]+'30', color:USER_TYPE_COLORS[user?.user_type], padding:'1px 7px',borderRadius:8,fontWeight:700 }}>
                  {USER_TYPE_LABELS[user?.user_type]||user?.user_type}
                </span>
              </div>
            </div>
          </div>
          <button onClick={async()=>{ await logout(); navigate('/login'); }} style={{ width:'100%',padding:'7px',borderRadius:8,border:'1px solid rgba(255,255,255,0.12)',background:'transparent',color:'rgba(255,255,255,0.5)',fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>Sign Out</button>
        </div>
      </aside>
      <main style={{ marginLeft:224,flex:1,padding:'28px 32px',minHeight:'100vh',background:'var(--app-bg,#F1F5F9)' }}>
        <div className="fade-in">{children}</div>
      </main>
    </div>
  );
}

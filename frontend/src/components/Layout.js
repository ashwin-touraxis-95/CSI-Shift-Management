import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }) {
  const { user, logout, can, isAdmin, isManager, isLeader, isPH, theme } = useAuth();
  const isAgent = user?.user_type === 'agent';
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const buildNav = () => {
    const menu = [{ to:'/dashboard', icon:'⚡', label:'Dashboard' }];
    if (isLeader || isManager || isAdmin) menu.push({ to:'/schedule', icon:'📊', label:'Schedule' });
    if (isAgent) menu.push({ to:'/my-schedule', icon:'📅', label:'My Schedule' });

    const management = [];
    if (isLeader || isManager || isAdmin) management.push({ to:'/hours', icon:'⏱️', label:'Hours Tracker' });

    const logs = [];
    if (can('view_clock_logs')) logs.push({ to:'/logs', icon:'📋', label:'Logs' });

    const admin = [];
    if (isAdmin || isManager || isLeader) admin.push({ to:'/admin', icon:'🛡️', label:'Admin Panel' });
    if (isManager || isLeader || isAdmin) admin.push({ to:'/team', icon:'👤', label:'User Management' });
    if (isAdmin) admin.push({ to:'/preview', icon:'👁', label:'Preview as User' });

    return { menu, management, logs, admin };
  };

  const USER_TYPE_LABELS = { account_admin:'Account Admin', manager:'Manager', team_leader:'Team Leader', agent:'Agent' };
  const USER_TYPE_COLORS = { account_admin:'#C0392B', manager:'#2980B9', team_leader:'#8E44AD', agent:'#27AE60' };

  const sidebarBg = theme?.sidebar_bg || '#111827';
  const sidebarActive = theme?.sidebar_active || 'var(--red)';
  const sidebarText = theme?.sidebar_text || 'rgba(255,255,255,0.85)';
  const sidebarSectionLabel = theme?.sidebar_section_label || 'rgba(255,255,255,0.25)';
  const sidebarDivider = theme?.sidebar_divider || 'rgba(255,255,255,0.07)';
  const sidebarNameColor = theme?.sidebar_name_color || 'white';
  const sidebarSubColor = theme?.sidebar_sub_color || 'rgba(255,255,255,0.3)';
  const sidebarUserName = theme?.sidebar_user_name || 'white';
  const sidebarBtnBorder = theme?.sidebar_btn_border || 'rgba(255,255,255,0.12)';
  const sidebarBtnText = theme?.sidebar_btn_text || 'rgba(255,255,255,0.5)';
  const sidebarFooterText = theme?.sidebar_footer_text || 'rgba(255,255,255,0.2)';
  const primary = theme?.primary_color || '#C0392B';
  const companyName = theme?.company_name || 'ShiftManager';
  const locationLabel = theme?.location_label || 'South Africa';
  const logo = theme?.company_logo;

  const isSidebarLight = (() => {
    const bg = (theme?.sidebar_bg || '#111827').replace('#','');
    if (bg.length === 3) { const r=parseInt(bg[0]+bg[0],16),g=parseInt(bg[1]+bg[1],16),b=parseInt(bg[2]+bg[2],16); return (r*299+g*587+b*114)/1000>128; }
    if (bg.length === 6) { const r=parseInt(bg.slice(0,2),16),g=parseInt(bg.slice(2,4),16),b=parseInt(bg.slice(4,6),16); return (r*299+g*587+b*114)/1000>128; }
    return false;
  })();
  const navTextInactive = theme?.sidebar_text || (isSidebarLight ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.85)');
  const navTextActive = isSidebarLight ? '#111827' : 'white';

  const SIDEBAR_FULL = 224;
  const SIDEBAR_MINI = 60;
  const sidebarW = collapsed ? SIDEBAR_MINI : SIDEBAR_FULL;

  const NavItem = ({ to, icon, label }) => (
    <NavLink to={to} onClick={()=>setMobileOpen(false)} style={({ isActive }) => ({
      display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:8, marginBottom:2,
      textDecoration:'none', fontSize:14, fontWeight:500, transition:'all 0.15s',
      color: isActive ? navTextActive : navTextInactive,
      background: isActive ? sidebarActive : 'transparent',
      justifyContent: collapsed ? 'center' : 'flex-start',
      overflow: 'hidden',
    })} title={collapsed ? label : ''}>
      <span style={{ flexShrink:0, fontSize:16 }}>{icon}</span>
      {!collapsed && <span style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{label}</span>}
    </NavLink>
  );

  const SidebarContent = () => {
    const { menu, management, logs, admin } = buildNav();
    const SectionLabel = ({ label }) => collapsed ? null : (
      <div style={{ fontSize:10,fontWeight:700,color:sidebarSectionLabel,letterSpacing:1.5,padding:'14px 8px 8px',textTransform:'uppercase' }}>{label}</div>
    );
    return <>
      <SectionLabel label="Menu"/>
      {menu.map(item => <NavItem key={item.to} {...item}/>)}
      {management.length > 0 && <><SectionLabel label="Management"/>{management.map(item => <NavItem key={item.to} {...item}/>)}</>}
      {logs.length > 0 && <><SectionLabel label="Logs"/>{logs.map(item => <NavItem key={item.to} {...item}/>)}</>}
      {admin.length > 0 && <><SectionLabel label="Admin"/>{admin.map(item => <NavItem key={item.to} {...item}/>)}</>}
    </>;
  };

  return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div onClick={()=>setMobileOpen(false)} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:99,display:'none' }} className="mobile-overlay"/>
      )}

      {/* Sidebar */}
      <aside style={{
        width: sidebarW, background: sidebarBg, color:'white',
        display:'flex', flexDirection:'column', position:'fixed',
        top:0, left:0, bottom:0, zIndex:100,
        transition:'width 0.2s ease', overflow:'hidden',
      }}>
        {/* Header: logo + collapse button */}
        <div style={{ padding:'14px 12px', borderBottom:`1px solid ${sidebarDivider}`, display:'flex', alignItems:'center', justifyContent: collapsed ? 'center' : 'space-between', minHeight:64 }}>
          {!collapsed && (
            <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, minWidth:0 }}>
              {logo
                ? <img src={logo} alt="Logo" style={{ width:32,height:32,borderRadius:8,objectFit:'contain',background:'white',padding:2,flexShrink:0 }}/>
                : <div style={{ width:32,height:32,borderRadius:8,background:primary,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0 }}>🏢</div>}
              <div style={{ minWidth:0 }}>
                <div style={{ fontWeight:700,fontSize:13,lineHeight:1.2,color:sidebarNameColor,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{companyName}</div>
                <div style={{ fontSize:10,color:sidebarSubColor,marginTop:1 }}>{locationLabel}</div>
              </div>
            </div>
          )}
          {collapsed && (
            <div style={{ width:32,height:32,borderRadius:8,background:primary,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16 }}>🏢</div>
          )}
          <button onClick={()=>setCollapsed(c=>!c)} title={collapsed?'Expand':'Collapse'} style={{
            background:'none',border:'none',cursor:'pointer',padding:4,borderRadius:6,
            color:navTextInactive,fontSize:14,flexShrink:0,marginLeft: collapsed?0:8,
            opacity:0.6, transition:'opacity 0.15s',
          }} onMouseEnter={e=>e.target.style.opacity='1'} onMouseLeave={e=>e.target.style.opacity='0.6'}>
            {collapsed ? '▶' : '◀'}
          </button>
        </div>

        <nav style={{ padding:'10px 8px', flex:1, overflowY:'auto', overflowX:'hidden' }}>
          <SidebarContent/>
        </nav>

        {/* User footer */}
        <div style={{ padding:12, borderTop:`1px solid ${sidebarDivider}`, flexShrink:0 }}>
          {!collapsed && (
            <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:10 }}>
              <div style={{ position:'relative', flexShrink:0, cursor:'pointer' }} onClick={()=>document.getElementById('sidebar-avatar-input').click()} title="Click to change photo">
                {user?.avatar
                  ? <img src={user.avatar} alt="" style={{ width:32,height:32,borderRadius:'50%',objectFit:'cover' }}/>
                  : <div style={{ width:32,height:32,borderRadius:'50%',background:primary,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:13,color:'white' }}>{user?.name?.trim()?.[0]?.toUpperCase()}</div>}
                <div style={{ position:'absolute',bottom:-2,right:-2,width:13,height:13,borderRadius:'50%',background:'#fff',border:`1px solid ${sidebarDivider}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:7 }}>📷</div>
                <input id="sidebar-avatar-input" type="file" accept="image/*" style={{ display:'none' }} onChange={async e => {
                  const file = e.target.files[0]; if (!file) return;
                  if (file.size > 500000) return alert('Please choose an image under 500KB');
                  const reader = new FileReader();
                  reader.onload = async ev => {
                    try { const r = await import('axios').then(m=>m.default.post(`/api/users/${user.id}/avatar`, { avatar: ev.target.result })); if (r.data.ok) window.location.reload(); }
                    catch(err) { alert(err.response?.data?.error || 'Upload failed'); }
                  };
                  reader.readAsDataURL(file); e.target.value = '';
                }}/>
              </div>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontWeight:600,fontSize:12,color:sidebarUserName,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{user?.name}</div>
                <div style={{ fontSize:10,marginTop:2 }}>
                  <span style={{ background:USER_TYPE_COLORS[user?.user_type]+'30', color:USER_TYPE_COLORS[user?.user_type], padding:'1px 6px',borderRadius:8,fontWeight:700 }}>
                    {USER_TYPE_LABELS[user?.user_type]||user?.user_type}
                  </span>
                </div>
              </div>
            </div>
          )}
          {collapsed ? (
            <button onClick={async()=>{ await logout(); navigate('/login'); }} title="Sign Out" style={{ width:'100%',padding:'8px',borderRadius:8,border:`1px solid ${sidebarBtnBorder}`,background:'transparent',color:sidebarBtnText,fontSize:14,cursor:'pointer',fontFamily:'inherit' }}>↩</button>
          ) : (
            <>
              <button onClick={()=>navigate('/profile')} style={{ width:'100%',padding:'6px',borderRadius:8,border:`1px solid ${sidebarBtnBorder}`,background:'transparent',color:sidebarBtnText,fontSize:12,cursor:'pointer',fontFamily:'inherit',marginBottom:5 }}>👤 My Profile</button>
              <button onClick={async()=>{ await logout(); navigate('/login'); }} style={{ width:'100%',padding:'6px',borderRadius:8,border:`1px solid ${sidebarBtnBorder}`,background:'transparent',color:sidebarBtnText,fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>Sign Out</button>
              <div style={{ marginTop:12, paddingTop:10, borderTop:`1px solid ${sidebarDivider}`, textAlign:'center' }}>
                {theme?.footer_line1 && <div style={{ fontSize:9, color:sidebarFooterText, lineHeight:1.8 }}>{theme.footer_line1}</div>}
                <div style={{ fontSize:9, color:sidebarFooterText, lineHeight:1.6, display:'flex', alignItems:'center', justifyContent:'center', gap:4, flexWrap:'wrap' }}>
                  <span>Built by Ashwin Halford</span>
                  {theme?.footer_line3 && <><span style={{ opacity:0.5 }}>-</span><span>{theme.footer_line3}</span></>}
                </div>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Mobile hamburger bar */}
      <div className="mobile-topbar" style={{ display:'none', position:'fixed', top:0, left:0, right:0, height:52, background:sidebarBg, zIndex:101, alignItems:'center', padding:'0 16px', gap:12 }}>
        <button onClick={()=>setMobileOpen(o=>!o)} style={{ background:'none',border:'none',color:'white',fontSize:22,cursor:'pointer',padding:4 }}>☰</button>
        <div style={{ fontWeight:700, fontSize:14, color:sidebarNameColor }}>{companyName}</div>
      </div>

      {/* Mobile drawer */}
      <aside className="mobile-drawer" style={{
        position:'fixed', top:0, left:0, bottom:0, width:220,
        background:sidebarBg, zIndex:200, transform: mobileOpen?'translateX(0)':'translateX(-100%)',
        transition:'transform 0.25s ease', display:'none', flexDirection:'column',
      }}>
        <div style={{ padding:'14px 16px', borderBottom:`1px solid ${sidebarDivider}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontWeight:700, fontSize:14, color:sidebarNameColor }}>{companyName}</div>
          <button onClick={()=>setMobileOpen(false)} style={{ background:'none',border:'none',color:navTextInactive,fontSize:18,cursor:'pointer' }}>✕</button>
        </div>
        <nav style={{ padding:'10px 8px', flex:1, overflowY:'auto' }}>
          <SidebarContent/>
        </nav>
      </aside>

      <main style={{ marginLeft: sidebarW, marginRight: 'var(--drawer-offset, 0px)', flex:1, height:'100vh', overflowY:'auto', overflowX:'hidden', background:'var(--app-bg,#F1F5F9)', transition:'margin-left 0.2s ease, margin-right 0.25s ease', minWidth:0, boxSizing:'border-box' }}>
        <div className="fade-in" style={{ minHeight:'100%' }}>{children}</div>
      </main>
    </div>
  );
}

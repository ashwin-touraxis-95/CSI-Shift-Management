import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }) {
  const { user, logout, can, isAdmin, isManager, isLeader, theme } = useAuth();
  const isAgent = user?.user_type === 'agent';
  const navigate = useNavigate();

  const buildNav = () => {
    // Menu section: Dashboard + Team Schedule
    const menu = [{ to:'/dashboard', icon:'⚡', label:'Dashboard' }];
    if (isLeader || isManager || isAdmin) menu.push({ to:'/schedule', icon:'📊', label:'Team Schedule' });
    if (isAgent || isLeader) menu.push({ to:'/my-schedule', icon:'📅', label:'My Schedule' });

    // Management section: Team + Manage Shifts
    const management = [];
    if (can('manage_shifts')) management.push({ to:'/manage-shifts', icon:'✏️', label:'Manage Shifts' });
    if (can('view_clock_logs')) management.push({ to:'/logs', icon:'📋', label:'Clock Logs' });
    if (isManager || isLeader || isAdmin) management.push({ to:'/team', icon:'👤', label:'Team' });

    // Admin section
    const admin = [];
    if (isAdmin || isManager || isLeader) admin.push({ to:'/admin', icon:'🛡️', label:'Admin Panel' });

    return { menu, management, admin };
  };

  const USER_TYPE_LABELS = { account_admin:'Account Admin', manager:'Manager', team_leader:'Team Leader', agent:'Agent' };
  const USER_TYPE_COLORS = { account_admin:'#C0392B', manager:'#2980B9', team_leader:'#8E44AD', agent:'#27AE60' };

  const sidebarBg = theme?.sidebar_bg || '#111827';
  const sidebarActive = theme?.sidebar_active || 'var(--red)';
  const sidebarText = theme?.sidebar_text || 'rgba(255,255,255,0.5)';
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
        <div style={{ padding:'18px 16px', borderBottom:`1px solid ${sidebarDivider}` }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {logo ? <img src={logo} alt="Logo" style={{ width:36,height:36,borderRadius:9,objectFit:'contain',background:'white',padding:3 }}/>
              : <div style={{ width:36,height:36,borderRadius:9,background:primary,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18 }}>🏢</div>}
            <div>
              <div style={{ fontWeight:700,fontSize:14,lineHeight:1.2,color:sidebarNameColor }}>{companyName}</div>
              <div style={{ fontSize:10,color:sidebarSubColor,marginTop:2 }}>{locationLabel}</div>
            </div>
          </div>
        </div>

        <nav style={{ padding:'12px 10px', flex:1, overflowY:'auto' }}>
          {(() => {
            const { menu, management, admin } = buildNav();
            const SectionLabel = ({ label }) => (
              <div style={{ fontSize:10,fontWeight:700,color:sidebarSectionLabel,letterSpacing:1.5,padding:'14px 8px 8px',textTransform:'uppercase' }}>{label}</div>
            );
            return <>
              <SectionLabel label="Menu" />
              {menu.map(item => <NavItem key={item.to} {...item}/>)}
              {management.length > 0 && <>
                <SectionLabel label="Management" />
                {management.map(item => <NavItem key={item.to} {...item}/>)}
              </>}
              {admin.length > 0 && <>
                <SectionLabel label="Admin" />
                {admin.map(item => <NavItem key={item.to} {...item}/>)}
              </>}
            </>;
          })()}
        </nav>

        <div style={{ padding:14, borderTop:`1px solid ${sidebarDivider}` }}>
          <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:10 }}>
            {user?.avatar ? <img src={user.avatar} alt="" style={{ width:34,height:34,borderRadius:'50%' }}/>
              : <div style={{ width:34,height:34,borderRadius:'50%',background:primary,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14,color:'white' }}>{user?.name?.[0]}</div>}
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ fontWeight:600,fontSize:13,color:sidebarUserName,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{user?.name}</div>
              <div style={{ fontSize:10,marginTop:2 }}>
                <span style={{ background:USER_TYPE_COLORS[user?.user_type]+'30', color:USER_TYPE_COLORS[user?.user_type], padding:'1px 7px',borderRadius:8,fontWeight:700 }}>
                  {USER_TYPE_LABELS[user?.user_type]||user?.user_type}
                </span>
              </div>
            </div>
          </div>
          <button onClick={()=>navigate('/change-password')} style={{ width:'100%',padding:'7px',borderRadius:8,border:`1px solid ${sidebarBtnBorder}`,background:'transparent',color:sidebarBtnText,fontSize:12,cursor:'pointer',fontFamily:'inherit',marginBottom:6 }}>🔐 Change Password</button>
          <button onClick={async()=>{ await logout(); navigate('/login'); }} style={{ width:'100%',padding:'7px',borderRadius:8,border:`1px solid ${sidebarBtnBorder}`,background:'transparent',color:sidebarBtnText,fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>Sign Out</button>
          <div style={{ marginTop:14, paddingTop:12, borderTop:`1px solid ${sidebarDivider}`, textAlign:'center' }}>
            {theme?.footer_line1 && <div style={{ fontSize:10, color:sidebarFooterText, lineHeight:1.8 }}>{theme.footer_line1}</div>}
            <div style={{ fontSize:10, color:sidebarFooterText, lineHeight:1.6, display:'flex', alignItems:'center', justifyContent:'center', gap:5, flexWrap:'wrap' }}>
              <span>Built by Ashwin Halford</span>
              {theme?.footer_line3 && <><span style={{ opacity:0.5 }}>-</span><span>{theme.footer_line3}</span></>}
            </div>
          </div>
        </div>
      </aside>
      <main style={{ marginLeft:224,flex:1,padding:'28px 32px',minHeight:'100vh',background:'var(--app-bg,#F1F5F9)' }}>
        <div className="fade-in">{children}</div>
      </main>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function Preview() {
  const { theme } = useAuth();
  const primary = theme?.primary_color || '#C0392B';
  const sidebarBg = theme?.sidebar_bg || '#111827';

  const [allUsers, setAllUsers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState('dashboard');

  useEffect(() => {
    axios.get('/api/users').then(r => {
      const users = Array.isArray(r.data) ? r.data.filter(u => u.active !== 0) : [];
      setAllUsers(users);
      if (users.length > 0) setSelectedId(users[0].id);
    }).catch(() => {});
    axios.get('/api/locations').then(r => setLocations(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setPreviewData(null);
    axios.get(`/api/preview-user/${selectedId}`)
      .then(r => { setPreviewData(r.data); setActivePage('dashboard'); })
      .catch(() => setPreviewData(null))
      .finally(() => setLoading(false));
  }, [selectedId]);

  const u = previewData?.user;
  const perms = previewData?.permissions || {};

  const isAdmin = u?.user_type === 'account_admin';
  const isManager = u?.user_type === 'manager' || isAdmin;
  const isLeader = u?.user_type === 'team_leader' || isManager;
  const isAgent = u?.user_type === 'agent';
  const isPH = u?.location === 'PH';

  const USER_TYPE_LABELS = { account_admin:'Account Admin', manager:'Manager', team_leader:'Team Leader', agent:'Agent' };
  const USER_TYPE_COLORS = { account_admin:'#C0392B', manager:'#2980B9', team_leader:'#8E44AD', agent:'#27AE60' };

  // Build what nav items this user would see
  const buildNav = () => {
    const menu = [{ id:'dashboard', icon:'⚡', label:'Dashboard' }];
    if (isLeader || isManager || isAdmin) menu.push({ id:'schedule', icon:'📊', label:'Team Schedule' });
    if (isAgent) menu.push({ id:'my-schedule', icon:'📅', label:'My Schedule' });

    const management = [];
    if (perms.manage_shifts) management.push({ id:'manage-shifts', icon:'✏️', label:'Manage Shifts' });
    // Leave Tracker hidden for PH agents
    if ((isLeader || isManager || isAdmin) && !isPH) management.push({ id:'leave', icon:'🏖️', label:'Leave Tracker' });
    if (isLeader || isManager || isAdmin) management.push({ id:'hours', icon:'📊', label:'Hours Tracker' });

    const logs = [];
    if (perms.view_clock_logs) logs.push({ id:'logs', icon:'📋', label:'Logs' });

    const admin = [];
    if (isAdmin || isManager || isLeader) admin.push({ id:'admin', icon:'🛡️', label:'Admin Panel' });
    if (isManager || isLeader || isAdmin) admin.push({ id:'team', icon:'👤', label:'User Management' });

    return { menu, management, logs, admin };
  };

  const { menu, management, logs, admin } = previewData ? buildNav() : { menu:[], management:[], logs:[], admin:[] };
  const allNavItems = [...menu, ...management, ...logs, ...admin];

  const sidebarDivider = 'rgba(255,255,255,0.07)';
  const sidebarText = 'rgba(255,255,255,0.5)';
  const sidebarSectionLabel = 'rgba(255,255,255,0.25)';

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <h1 style={{ margin:0, marginBottom:4 }}>👁 Preview as User</h1>
        <p style={{ color:'var(--gray-500)', margin:0, fontSize:14 }}>
          See exactly what any user's app looks like — their navigation, access, and restrictions.
        </p>
      </div>

      {/* User selector */}
      <div className="card" style={{ padding:'16px 20px', marginBottom:24, display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
        <div style={{ fontWeight:700, fontSize:13, color:'var(--gray-600)', flexShrink:0 }}>Previewing as:</div>
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          style={{ padding:'8px 12px', borderRadius:8, border:'1.5px solid var(--gray-200)', fontSize:14, fontFamily:'inherit', minWidth:260, cursor:'pointer' }}
        >
          {allUsers.map(u => (
            <option key={u.id} value={u.id}>
              {u.name} — {u.user_type?.replace('_',' ')} · {u.department} · {u.location || 'SA'}
            </option>
          ))}
        </select>
        {u && (
          <div style={{ display:'flex', alignItems:'center', gap:8, marginLeft:'auto' }}>
            <span style={{ padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:700, background: isPH?'#FEF3C7':'#EFF6FF', color: isPH?'#92400E':'#1D4ED8' }}>
              {locations.find(l => l.code === u?.location)?.name || u?.location || 'SA'}
            </span>
            <span style={{ padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:700, background: USER_TYPE_COLORS[u.user_type]+'20', color: USER_TYPE_COLORS[u.user_type] }}>
              {USER_TYPE_LABELS[u.user_type] || u.user_type}
            </span>
            <span style={{ padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:600, background:'var(--gray-100)', color:'var(--gray-600)' }}>
              {u.department}
            </span>
          </div>
        )}
      </div>

      {loading && (
        <div style={{ textAlign:'center', padding:60, color:'var(--gray-400)' }}>Loading preview...</div>
      )}

      {!loading && previewData && (
        <div style={{ display:'flex', gap:20, alignItems:'flex-start' }}>

          {/* Simulated Sidebar */}
          <div style={{ width:220, flexShrink:0, background:sidebarBg, borderRadius:12, boxShadow:'0 4px 20px rgba(0,0,0,0.15)' }}>
            {/* Logo area */}
            <div style={{ padding:'14px 14px', borderBottom:`1px solid ${sidebarDivider}` }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:30, height:30, borderRadius:7, background:primary, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15 }}>🏢</div>
                <div>
                  <div style={{ fontWeight:700, fontSize:13, color:'white' }}>{previewData.theme?.company_name || 'ShiftManager'}</div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', marginTop:1 }}>{previewData.theme?.location_label || 'South Africa'}</div>
                </div>
              </div>
            </div>

            {/* Nav */}
            <nav style={{ padding:'10px 8px' }}>
              {[
                { label:'Menu', items: menu },
                { label:'Management', items: management },
                { label:'Logs', items: logs },
                { label:'Admin', items: admin },
              ].filter(s => s.items.length > 0).map(section => (
                <div key={section.label}>
                  <div style={{ fontSize:9, fontWeight:700, color:sidebarSectionLabel, letterSpacing:1.5, padding:'12px 8px 6px', textTransform:'uppercase' }}>{section.label}</div>
                  {section.items.map(item => (
                    <div key={item.id}
                      onClick={() => setActivePage(item.id)}
                      style={{
                        display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:7, marginBottom:1,
                        cursor:'pointer', fontSize:13, fontWeight:500, transition:'all 0.12s',
                        color: activePage === item.id ? 'white' : sidebarText,
                        background: activePage === item.id ? primary : 'transparent',
                      }}
                    >
                      <span style={{ fontSize:13 }}>{item.icon}</span>{item.label}
                    </div>
                  ))}
                </div>
              ))}
            </nav>

            {/* User footer */}
            <div style={{ padding:12, borderTop:`1px solid ${sidebarDivider}`, marginTop:'auto' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:30, height:30, borderRadius:'50%', background:USER_TYPE_COLORS[u.user_type]||primary, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:13, color:'white', flexShrink:0 }}>
                  {u.name?.trim()?.[0]?.toUpperCase()}
                </div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:12, color:'white', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.name}</div>
                  <div style={{ fontSize:10, marginTop:1 }}>
                    <span style={{ background:USER_TYPE_COLORS[u.user_type]+'30', color:USER_TYPE_COLORS[u.user_type], padding:'1px 6px', borderRadius:8, fontWeight:700 }}>
                      {USER_TYPE_LABELS[u.user_type]||u.user_type}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right panel: access summary */}
          <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:16 }}>

            {/* Access summary */}
            <div className="card" style={{ padding:20 }}>
              <div style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>Access Summary for {u.name}</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:10 }}>
                {[
                  { label:'Team Schedule', allowed: isLeader || isManager || isAdmin, note: !isAdmin ? `Defaults to ${u.department}` : 'All departments' },
                  { label:'My Schedule', allowed: isAgent, note:'Own shifts only' },
                  { label:'Manage Shifts', allowed: !!perms.manage_shifts, note:'Assign & remove shifts' },
                  { label:'Leave Tracker', allowed: (isLeader || isManager || isAdmin) && !isPH, note: isPH ? 'Hidden — PH location' : '' },
                  { label:'Hours Tracker', allowed: isLeader || isManager || isAdmin, note:'' },
                  { label:'Clock Logs', allowed: !!perms.view_clock_logs, note:'' },
                  { label:'Admin Panel', allowed: isAdmin || isManager || isLeader, note:'' },
                  { label:'User Management', allowed: isManager || isLeader || isAdmin, note:'' },
                  { label:'Payroll Export', allowed: !isPH && (isLeader || isManager || isAdmin), note: isPH ? 'Hidden — PH location' : '' },
                  { label:'Preview as User', allowed: isAdmin, note:'Admin only' },
                ].map(item => (
                  <div key={item.label} style={{
                    display:'flex', alignItems:'flex-start', gap:10, padding:'10px 12px',
                    borderRadius:8, border:'1px solid var(--gray-100)',
                    background: item.allowed ? '#f0fdf4' : '#fef2f2'
                  }}>
                    <span style={{ fontSize:16, flexShrink:0 }}>{item.allowed ? '✅' : '❌'}</span>
                    <div>
                      <div style={{ fontWeight:600, fontSize:13 }}>{item.label}</div>
                      {item.note && <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:2 }}>{item.note}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* PH notice */}
            {isPH && (
              <div style={{ background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:10, padding:'12px 16px', fontSize:13, color:'#92400e' }}>
                🇵🇭 <strong>Philippines location:</strong> This user's hours are tracked but they are excluded from payroll exports and cannot see the Leave Tracker.
                Their shifts display in PHT (UTC+8).
              </div>
            )}

            {/* Department default notice */}
            {!isAdmin && (
              <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, padding:'12px 16px', fontSize:13, color:'#1e40af' }}>
                📁 <strong>Department default:</strong> When this user logs in, Team Schedule and other views will automatically filter to <strong>{u.department}</strong>.
                {isLeader || isManager ? ' They can manually switch to other departments.' : ' They cannot browse other departments.'}
              </div>
            )}

            {/* Active page indicator */}
            <div className="card" style={{ padding:16, textAlign:'center', color:'var(--gray-400)', fontSize:13 }}>
              <span style={{ fontSize:20, display:'block', marginBottom:6 }}>
                {allNavItems.find(i => i.id === activePage)?.icon || '📄'}
              </span>
              Click any item in the sidebar to see what this user can access.
              Currently selected: <strong style={{ color:'var(--gray-600)' }}>{allNavItems.find(i => i.id === activePage)?.label || activePage}</strong>
              {!allNavItems.find(i => i.id === activePage) && activePage !== 'dashboard' &&
                <div style={{ marginTop:8, color:'var(--red)', fontWeight:600 }}>⚠️ This page is not in this user's navigation</div>
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

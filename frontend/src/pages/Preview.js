import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const USER_TYPE_LABELS = { account_admin:'Account Admin', manager:'Manager', team_leader:'Team Leader', agent:'Agent' };
const USER_TYPE_COLORS = { account_admin:'#C0392B', manager:'#2980B9', team_leader:'#8E44AD', agent:'#27AE60' };

const ALL_MODULES = [
  { id:'dashboard',     icon:'⚡', label:'Dashboard',        section:'menu',       roles:['all'] },
  { id:'my-schedule',   icon:'📅', label:'My Schedule',       section:'menu',       roles:['agent'] },
  { id:'schedule',      icon:'📊', label:'Team Schedule',     section:'menu',       roles:['team_leader','manager','account_admin'] },
  { id:'manage-shifts', icon:'✏️', label:'Manage Shifts',     section:'management', perm:'manage_shifts' },
  { id:'leave',         icon:'🏖️', label:'Leave Tracker',     section:'management', roles:['team_leader','manager','account_admin'], hidePH:true },
  { id:'hours',         icon:'⏱️', label:'Hours Tracker',     section:'management', roles:['team_leader','manager','account_admin'] },
  { id:'logs',          icon:'📋', label:'Clock Logs',        section:'logs',       perm:'view_clock_logs' },
  { id:'admin',         icon:'🛡️', label:'Admin Panel',       section:'admin',      roles:['team_leader','manager','account_admin'] },
  { id:'team',          icon:'👤', label:'User Management',   section:'admin',      roles:['team_leader','manager','account_admin'] },
  { id:'preview',       icon:'👁',  label:'Preview as User',  section:'admin',      roles:['account_admin'] },
];

function canSee(mod, userType, perms, isPH) {
  if (mod.hidePH && isPH) return false;
  if (mod.perm && !perms[mod.perm]) return false;
  if (!mod.roles) return true;
  if (mod.roles.includes('all')) return true;
  if (userType === 'account_admin') return true;
  if (userType === 'manager' && mod.roles.some(r => ['manager','team_leader','agent'].includes(r))) return true;
  if (userType === 'team_leader' && mod.roles.some(r => ['team_leader','agent'].includes(r))) return true;
  return mod.roles.includes(userType);
}

// Simulated page previews
function PagePreview({ pageId, user }) {
  const u = user;
  const isManager = ['manager','account_admin'].includes(u.user_type);
  const isLeader = u.user_type === 'team_leader' || isManager;

  const card = (children, extra={}) => (
    <div style={{ background:'white', borderRadius:10, border:'1px solid #e5e7eb', padding:20, ...extra }}>{children}</div>
  );

  const tile = (label, value, color='#C0392B') => (
    <div style={{ background:'#f9fafb', borderRadius:10, padding:'16px 18px', border:'1px solid #e5e7eb' }}>
      <div style={{ fontSize:11, color:'#9ca3af', fontWeight:600, textTransform:'uppercase', letterSpacing:0.5, marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:26, fontWeight:800, color }}>{value}</div>
    </div>
  );

  const fakeShifts = [
    { name: u.name, time:'08:00 – 17:00', dept: u.department, status:'published' },
    { name:'Sample Agent', time:'09:00 – 18:00', dept: u.department, status:'published' },
    { name:'Another Agent', time:'12:00 – 21:00', dept: u.department, status:'draft' },
  ];

  const fakeUsers = [
    { name: u.name, role: USER_TYPE_LABELS[u.user_type], dept: u.department, status:'Active' },
    { name:'Sample Agent A', role:'Agent', dept: u.department, status:'Active' },
    { name:'Sample Agent B', role:'Agent', dept: u.department, status:'Active' },
  ];

  switch(pageId) {
    case 'dashboard': return (
      <div>
        <p style={{ color:'#6b7280', marginBottom:16, fontSize:14 }}>Welcome back, <strong>{u.name}</strong>.</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:12, marginBottom:20 }}>
          {tile('Shifts This Month','12')}
          {tile('Total Hours','96h','#2980B9')}
          {tile('On Leave','2','#E67E22')}
          {tile('This Week','5','#27AE60')}
        </div>
        {card(<div style={{ color:'#9ca3af', fontSize:13, textAlign:'center', padding:20 }}>📊 Live availability board — agents from {u.department}</div>)}
      </div>
    );

    case 'my-schedule': return (
      <div>
        <p style={{ color:'#6b7280', marginBottom:16, fontSize:14 }}>Your upcoming shifts — <strong>{u.department}</strong></p>
        {card(
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
            <thead><tr style={{ borderBottom:'2px solid #f3f4f6' }}>
              {['Date','Shift','Hours','Status'].map(h=><th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:12, color:'#9ca3af', fontWeight:600, textTransform:'uppercase' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {[['Mon 10 Mar','08:00 – 17:00','9h','Published'],['Tue 11 Mar','08:00 – 17:00','9h','Published'],['Wed 12 Mar','Day Off','—','—']].map(([d,s,h,st])=>(
                <tr key={d} style={{ borderBottom:'1px solid #f3f4f6' }}>
                  <td style={{ padding:'10px 12px', fontWeight:600 }}>{d}</td>
                  <td style={{ padding:'10px 12px', color:'#374151' }}>{s}</td>
                  <td style={{ padding:'10px 12px', color:'#6b7280' }}>{h}</td>
                  <td style={{ padding:'10px 12px' }}><span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700, background: st==='Published'?'#d1fae5':'#f3f4f6', color: st==='Published'?'#065f46':'#6b7280' }}>{st}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );

    case 'schedule': return (
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
          <span style={{ padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:700, background:'#e5e7eb', color:'#374151' }}>{u.department}</span>
          {isManager && <span style={{ fontSize:12, color:'#9ca3af' }}>Switch: CS · Sales · Travel Agents · Management</span>}
          {!isManager && isLeader && <span style={{ fontSize:12, color:'#9ca3af' }}>Can switch departments</span>}
        </div>
        {card(
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
            <thead><tr style={{ borderBottom:'2px solid #f3f4f6' }}>
              {['Agent','Mon','Tue','Wed','Thu','Fri'].map(h=><th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:12, color:'#9ca3af', fontWeight:600 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {fakeShifts.map(s=>(
                <tr key={s.name} style={{ borderBottom:'1px solid #f3f4f6' }}>
                  <td style={{ padding:'10px 12px', fontWeight:600 }}>{s.name}</td>
                  {['08–17','08–17','OFF','08–17','08–17'].map((t,i)=>(
                    <td key={i} style={{ padding:'8px 12px' }}>
                      <span style={{ padding:'3px 8px', borderRadius:6, fontSize:11, fontWeight:600, background: t==='OFF'?'#f3f4f6':'#dbeafe', color: t==='OFF'?'#9ca3af':'#1d4ed8' }}>{t}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );

    case 'manage-shifts': return (
      <div>
        <div style={{ display:'flex', gap:10, marginBottom:16 }}>
          <button style={{ padding:'7px 16px', borderRadius:8, border:'none', background:'#C0392B', color:'white', fontFamily:'inherit', fontSize:13, fontWeight:600, cursor:'pointer' }}>+ New Shift</button>
          <button style={{ padding:'7px 16px', borderRadius:8, border:'1px solid #e5e7eb', background:'white', fontFamily:'inherit', fontSize:13, cursor:'pointer' }}>Publish Draft</button>
        </div>
        {card(
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
            <thead><tr style={{ borderBottom:'2px solid #f3f4f6' }}>
              {['Agent','Date','Time','Status','Actions'].map(h=><th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:12, color:'#9ca3af', fontWeight:600, textTransform:'uppercase' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {fakeShifts.map(s=>(
                <tr key={s.name} style={{ borderBottom:'1px solid #f3f4f6' }}>
                  <td style={{ padding:'10px 12px', fontWeight:600 }}>{s.name}</td>
                  <td style={{ padding:'10px 12px', color:'#6b7280' }}>Mon 10 Mar</td>
                  <td style={{ padding:'10px 12px' }}>{s.time}</td>
                  <td style={{ padding:'10px 12px' }}><span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700, background: s.status==='published'?'#d1fae5':'#fef3c7', color: s.status==='published'?'#065f46':'#92400e' }}>{s.status}</span></td>
                  <td style={{ padding:'10px 12px' }}><button style={{ padding:'3px 10px', borderRadius:6, border:'1px solid #e5e7eb', background:'white', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );

    case 'leave': return (
      <div>
        <div style={{ display:'flex', gap:12, marginBottom:16 }}>
          {tile('Pending','3','#E67E22')}
          {tile('Approved This Month','8','#27AE60')}
          {tile('On Leave Today','1','#2980B9')}
        </div>
        {card(
          <div>
            {[{name:'Sample Agent',type:'Annual Leave',dates:'12 Mar – 14 Mar',status:'Pending'},{name:'Another Agent',type:'Sick Leave',dates:'10 Mar',status:'Approved'}].map(l=>(
              <div key={l.name} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0', borderBottom:'1px solid #f3f4f6' }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:14 }}>{l.name}</div>
                  <div style={{ fontSize:12, color:'#6b7280' }}>{l.type} · {l.dates}</div>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, background: l.status==='Pending'?'#fef3c7':'#d1fae5', color: l.status==='Pending'?'#92400e':'#065f46' }}>{l.status}</span>
                  {l.status==='Pending' && <><button style={{ padding:'3px 10px', borderRadius:6, border:'none', background:'#27AE60', color:'white', fontSize:12, cursor:'pointer' }}>✓</button><button style={{ padding:'3px 10px', borderRadius:6, border:'none', background:'#fef2f2', color:'#dc2626', fontSize:12, cursor:'pointer' }}>✗</button></>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );

    case 'hours': return (
      <div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
          {tile('This Week','44h / 45h','#27AE60')}
          {tile('Overtime','2h','#E67E22')}
          {tile('This Month','176h','#2980B9')}
        </div>
        {card(<div style={{ color:'#9ca3af', fontSize:13, textAlign:'center', padding:20 }}>⏱️ Detailed hours breakdown for {u.department} — filtered to {isManager ? 'all departments' : u.department}</div>)}
      </div>
    );

    case 'logs': return (
      <div>
        {card(
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
            <thead><tr style={{ borderBottom:'2px solid #f3f4f6' }}>
              {['Agent','Date','Clock In','Clock Out','Duration'].map(h=><th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:12, color:'#9ca3af', fontWeight:600, textTransform:'uppercase' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {[[u.name,'10 Mar','08:02','17:05','9h 3m'],['Sample Agent','10 Mar','08:55','18:01','9h 6m']].map(([n,d,ci,co,dur])=>(
                <tr key={n+d} style={{ borderBottom:'1px solid #f3f4f6' }}>
                  <td style={{ padding:'10px 12px', fontWeight:600 }}>{n}</td>
                  <td style={{ padding:'10px 12px', color:'#6b7280' }}>{d}</td>
                  <td style={{ padding:'10px 12px', color:'#27AE60', fontFamily:'DM Mono' }}>{ci}</td>
                  <td style={{ padding:'10px 12px', color:'#C0392B', fontFamily:'DM Mono' }}>{co}</td>
                  <td style={{ padding:'10px 12px', fontFamily:'DM Mono', fontWeight:600 }}>{dur}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );

    case 'admin': return card(
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10 }}>
        {['🎨 Theme','📺 Display','🏢 Structure','👁 Visibility','📍 Locations','☕ Breaks','📊 Hours','🗓 Holidays','📋 Audit'].map(t=>(
          <div key={t} style={{ padding:'14px 16px', borderRadius:8, border:'1px solid #e5e7eb', background:'#f9fafb', fontSize:13, fontWeight:600, cursor:'pointer' }}>{t}</div>
        ))}
      </div>
    );

    case 'team': return (
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontSize:14, color:'#6b7280' }}>{isManager ? 'All users' : `Users in ${u.department}`}</span>
          <button style={{ padding:'7px 16px', borderRadius:8, border:'none', background:'#C0392B', color:'white', fontFamily:'inherit', fontSize:13, fontWeight:600, cursor:'pointer' }}>+ Add User</button>
        </div>
        {card(
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
            <thead><tr style={{ borderBottom:'2px solid #f3f4f6' }}>
              {['Name','Role','Department','Status'].map(h=><th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:12, color:'#9ca3af', fontWeight:600, textTransform:'uppercase' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {fakeUsers.map(fu=>(
                <tr key={fu.name} style={{ borderBottom:'1px solid #f3f4f6' }}>
                  <td style={{ padding:'10px 12px', fontWeight:600 }}>{fu.name}</td>
                  <td style={{ padding:'10px 12px', color:'#6b7280' }}>{fu.role}</td>
                  <td style={{ padding:'10px 12px' }}><span style={{ padding:'3px 8px', borderRadius:20, fontSize:11, fontWeight:600, background:'#f3f4f6' }}>{fu.dept}</span></td>
                  <td style={{ padding:'10px 12px' }}><span style={{ color:'#27AE60', fontWeight:600, fontSize:13 }}>● Active</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );

    default: return <div style={{ color:'#9ca3af', textAlign:'center', padding:40 }}>Select a page from the sidebar</div>;
  }
}

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
      if (users.length > 0) setSelectedId(String(users[0].id));
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
  const isPH = u?.location === 'PH';
  const locationName = locations.find(l => l.code === u?.location)?.name || u?.location || 'SA';
  const navModules = u ? ALL_MODULES.filter(m => canSee(m, u.user_type, perms, isPH)) : [];
  const sections = ['menu','management','logs','admin'];

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ margin:0, marginBottom:4 }}>👁 Preview as User</h1>
        <p style={{ color:'var(--gray-500)', margin:0, fontSize:14 }}>See exactly what any user experiences. Click sidebar items to preview each page.</p>
      </div>

      {/* Selector */}
      <div className="card" style={{ padding:'14px 20px', marginBottom:20, display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
        <div style={{ fontWeight:600, fontSize:13, color:'var(--gray-600)', flexShrink:0 }}>Previewing as:</div>
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
          style={{ padding:'7px 12px', borderRadius:8, border:'1.5px solid var(--gray-200)', fontSize:14, fontFamily:'inherit', flex:1, minWidth:240, cursor:'pointer' }}>
          {allUsers.map(u => (
            <option key={u.id} value={String(u.id)}>
              {u.name} — {USER_TYPE_LABELS[u.user_type]||u.user_type} · {u.department} · {u.location||'SA'}
            </option>
          ))}
        </select>
        {u && (
          <div style={{ display:'flex', gap:8, flexShrink:0 }}>
            <span style={{ padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:700, background:'#EFF6FF', color:'#1D4ED8' }}>{locationName}</span>
            <span style={{ padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:700, background:USER_TYPE_COLORS[u.user_type]+'20', color:USER_TYPE_COLORS[u.user_type] }}>{USER_TYPE_LABELS[u.user_type]}</span>
            <span style={{ padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:600, background:'var(--gray-100)', color:'var(--gray-600)' }}>{u.department}</span>
          </div>
        )}
      </div>

      {loading && <div style={{ textAlign:'center', padding:60, color:'var(--gray-400)' }}>Loading preview...</div>}

      {!loading && previewData && u && (
        <div style={{ display:'flex', gap:16, alignItems:'flex-start' }}>

          {/* Sidebar */}
          <div style={{ width:210, flexShrink:0, borderRadius:12, overflow:'hidden', boxShadow:'0 4px 20px rgba(0,0,0,0.15)', background:sidebarBg }}>
            <div style={{ padding:'14px 14px 12px', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:28, height:28, borderRadius:7, background:primary, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>🏢</div>
                <div>
                  <div><span style={{ fontWeight:700, fontSize:13, color:'#ffffff' }}>{previewData.theme?.company_name||'ShiftManager'}</span></div>
                  <div><span style={{ fontSize:10, color:'rgba(255,255,255,0.35)' }}>{locationName}</span></div>
                </div>
              </div>
            </div>
            <nav style={{ padding:'8px 8px' }}>
              {sections.map(section => {
                const items = navModules.filter(m => m.section === section);
                if (!items.length) return null;
                const label = { menu:'Menu', management:'Management', logs:'Logs', admin:'Admin' }[section];
                return (
                  <div key={section}>
                    <div style={{ padding:'10px 8px 4px' }}>
                      <span style={{ fontSize:9, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:'rgba(255,255,255,0.25)' }}>{label}</span>
                    </div>
                    {items.map(item => (
                      <div key={item.id} onClick={() => setActivePage(item.id)}
                        style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 10px', borderRadius:7, marginBottom:1, cursor:'pointer',
                          background: activePage === item.id ? primary : 'transparent' }}>
                        <span style={{ fontSize:14, flexShrink:0 }}>{item.icon}</span>
                        <span style={{ fontSize:13, fontWeight: activePage===item.id?700:500, color: activePage===item.id?'#ffffff':'rgba(255,255,255,0.72)' }}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </nav>
            <div style={{ padding:'10px 12px', borderTop:'1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:USER_TYPE_COLORS[u.user_type]||primary, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:13, flexShrink:0 }}>
                  <span style={{ color:'#ffffff' }}>{u.name?.trim()?.[0]?.toUpperCase()}</span>
                </div>
                <div style={{ minWidth:0 }}>
                  <div><span style={{ fontWeight:600, fontSize:12, color:'#ffffff' }}>{u.name}</span></div>
                  <span style={{ background:USER_TYPE_COLORS[u.user_type]+'40', color:USER_TYPE_COLORS[u.user_type], padding:'1px 6px', borderRadius:8, fontWeight:700, fontSize:10 }}>
                    {USER_TYPE_LABELS[u.user_type]}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Page content */}
          <div style={{ flex:1, minWidth:0 }}>
            {isPH && (
              <div style={{ background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:8, padding:'8px 14px', fontSize:13, color:'#92400e', marginBottom:12 }}>
                🇵🇭 <strong>Philippines user</strong> — Leave Tracker and Payroll Export are hidden.
              </div>
            )}
            <div style={{ background:'#f3f4f6', border:'1px solid #e5e7eb', borderRadius:10, padding:'10px 16px', marginBottom:16, fontSize:13, color:'#374151' }}>
              📁 Views default to <strong>{u.department}</strong>
              {['manager','account_admin'].includes(u.user_type) ? ' — can switch to any department' : u.user_type==='team_leader' ? ' — can switch departments' : ' — cannot browse other departments'}
            </div>

            {/* Simulated app frame */}
            <div style={{ background:'#f9fafb', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden' }}>
              {/* Fake top bar */}
              <div style={{ background:'white', borderBottom:'1px solid #e5e7eb', padding:'12px 20px', display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:18 }}>{ALL_MODULES.find(m=>m.id===activePage)?.icon||'📄'}</span>
                <span style={{ fontWeight:700, fontSize:16 }}>{ALL_MODULES.find(m=>m.id===activePage)?.label||activePage}</span>
                <span style={{ marginLeft:'auto', fontSize:12, color:'#9ca3af' }}>Previewing as {u.name}</span>
              </div>
              {/* Page content */}
              <div style={{ padding:20 }}>
                <PagePreview pageId={activePage} user={u} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const USER_TYPE_LABELS = { account_admin:'Account Admin', manager:'Manager', team_leader:'Team Leader', agent:'Agent' };
const USER_TYPE_COLORS = { account_admin:'#C0392B', manager:'#2980B9', team_leader:'#8E44AD', agent:'#27AE60' };

const ALL_MODULES = [
  { id:'dashboard',      icon:'⚡', label:'Dashboard',         section:'menu',       roles:['all'] },
  { id:'my-schedule',    icon:'📅', label:'My Schedule',        section:'menu',       roles:['agent'] },
  { id:'schedule',       icon:'📊', label:'Team Schedule',      section:'menu',       roles:['team_leader','manager','account_admin'] },
  { id:'manage-shifts',  icon:'✏️', label:'Manage Shifts',      section:'management', perm:'manage_shifts' },
  { id:'leave',          icon:'🏖️', label:'Leave Tracker',      section:'management', roles:['team_leader','manager','account_admin'], hidePH:true },
  { id:'hours',          icon:'⏱️', label:'Hours Tracker',      section:'management', roles:['team_leader','manager','account_admin'] },
  { id:'logs',           icon:'📋', label:'Clock Logs',         section:'logs',       perm:'view_clock_logs' },
  { id:'admin',          icon:'🛡️', label:'Admin Panel',        section:'admin',      roles:['team_leader','manager','account_admin'] },
  { id:'team',           icon:'👤', label:'User Management',    section:'admin',      roles:['team_leader','manager','account_admin'] },
  { id:'preview',        icon:'👁',  label:'Preview as User',   section:'admin',      roles:['account_admin'] },
];

function canSee(mod, userType, perms, isPH) {
  if (mod.hidePH && isPH) return false;
  if (mod.perm && !perms[mod.perm]) return false;
  if (mod.roles) {
    if (mod.roles.includes('all')) return true;
    if (userType === 'account_admin') return true;
    if (userType === 'manager' && mod.roles.some(r => ['manager','team_leader','agent'].includes(r))) return true;
    if (userType === 'team_leader' && mod.roles.some(r => ['team_leader','agent'].includes(r))) return true;
    return mod.roles.includes(userType);
  }
  return true;
}

const PAGE_CONTENT = {
  dashboard: { title:'Dashboard', render:(u) => (
    <div>
      <p style={{color:'var(--gray-500)',marginBottom:20}}>Welcome back, {u.name}. Here's your overview.</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12}}>
        {['Shifts This Month','Total Hours','On Leave','Upcoming'].map(t=>(
          <div key={t} style={{background:'var(--gray-50)',borderRadius:10,padding:'16px 18px',border:'1px solid var(--gray-200)'}}>
            <div style={{fontSize:11,color:'var(--gray-400)',fontWeight:600,textTransform:'uppercase',letterSpacing:0.5}}>{t}</div>
            <div style={{fontSize:28,fontWeight:800,marginTop:6,color:'var(--gray-700)'}}>—</div>
          </div>
        ))}
      </div>
    </div>
  )},
  'my-schedule': { title:'My Schedule', render:(u)=>(
    <div>
      <p style={{color:'var(--gray-500)',marginBottom:16}}>Shifts for <strong>{u.name}</strong> — {u.department}</p>
      <div style={{border:'1px solid var(--gray-200)',borderRadius:10,padding:24,textAlign:'center',color:'var(--gray-400)'}}>📅 Personal shift calendar</div>
    </div>
  )},
  schedule: { title:'Team Schedule', render:(u)=>(
    <div>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
        <span style={{padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:700,background:'var(--gray-100)'}}>Dept: {u.department}</span>
        {['manager','account_admin'].includes(u.user_type) && <span style={{fontSize:12,color:'var(--gray-400)'}}>+ can switch to any department</span>}
      </div>
      <div style={{border:'1px solid var(--gray-200)',borderRadius:10,padding:24,textAlign:'center',color:'var(--gray-400)'}}>📊 Schedule grid — defaults to {u.department}</div>
    </div>
  )},
  'manage-shifts': { title:'Manage Shifts', render:()=>(
    <div style={{border:'1px solid var(--gray-200)',borderRadius:10,padding:24,textAlign:'center',color:'var(--gray-400)'}}>✏️ Shift assignment interface</div>
  )},
  leave: { title:'Leave Tracker', render:(u)=>(
    <div>
      <p style={{color:'var(--gray-500)',marginBottom:16}}>Leave for <strong>{u.department}</strong></p>
      <div style={{border:'1px solid var(--gray-200)',borderRadius:10,padding:24,textAlign:'center',color:'var(--gray-400)'}}>🏖️ Leave requests and approvals</div>
    </div>
  )},
  hours: { title:'Hours Tracker', render:(u)=>(
    <div>
      <p style={{color:'var(--gray-500)',marginBottom:16}}>Hours for <strong>{u.department}</strong></p>
      <div style={{border:'1px solid var(--gray-200)',borderRadius:10,padding:24,textAlign:'center',color:'var(--gray-400)'}}>⏱️ Time tracking and overtime reports</div>
    </div>
  )},
  logs: { title:'Clock Logs', render:()=>(
    <div style={{border:'1px solid var(--gray-200)',borderRadius:10,padding:24,textAlign:'center',color:'var(--gray-400)'}}>📋 Clock in/out history</div>
  )},
  admin: { title:'Admin Panel', render:()=>(
    <div style={{border:'1px solid var(--gray-200)',borderRadius:10,padding:24,textAlign:'center',color:'var(--gray-400)'}}>🛡️ Admin settings — theme, structure, permissions</div>
  )},
  team: { title:'User Management', render:(u)=>(
    <div>
      <p style={{color:'var(--gray-500)',marginBottom:16}}>
        {['account_admin','manager'].includes(u.user_type) ? 'Can manage all users' : `Can manage agents in ${u.department}`}
      </p>
      <div style={{border:'1px solid var(--gray-200)',borderRadius:10,padding:24,textAlign:'center',color:'var(--gray-400)'}}>👤 User list and management</div>
    </div>
  )},
  preview: { title:'Preview as User', render:()=>(
    <div style={{border:'1px solid var(--gray-200)',borderRadius:10,padding:24,textAlign:'center',color:'var(--gray-400)'}}>👁 Admin-only — preview any user's experience</div>
  )},
};

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
  const activeModule = ALL_MODULES.find(m => m.id === activePage);
  const pageContent = PAGE_CONTENT[activePage];

  return (
    <div>
      <div style={{marginBottom:20}}>
        <h1 style={{margin:0,marginBottom:4}}>👁 Preview as User</h1>
        <p style={{color:'var(--gray-500)',margin:0,fontSize:14}}>See exactly what any user experiences — click sidebar items to preview each page.</p>
      </div>

      <div className="card" style={{padding:'14px 20px',marginBottom:20,display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
        <div style={{fontWeight:600,fontSize:13,color:'var(--gray-600)',flexShrink:0}}>Previewing as:</div>
        <select value={selectedId} onChange={e=>setSelectedId(e.target.value)}
          style={{padding:'7px 12px',borderRadius:8,border:'1.5px solid var(--gray-200)',fontSize:14,fontFamily:'inherit',flex:1,minWidth:240,cursor:'pointer'}}>
          {allUsers.map(u=>(
            <option key={u.id} value={String(u.id)}>
              {u.name} — {USER_TYPE_LABELS[u.user_type]||u.user_type} · {u.department} · {u.location||'SA'}
            </option>
          ))}
        </select>
        {u && (
          <div style={{display:'flex',gap:8,flexShrink:0}}>
            <span style={{padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:700,background:'#EFF6FF',color:'#1D4ED8'}}>{locationName}</span>
            <span style={{padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:700,background:USER_TYPE_COLORS[u.user_type]+'20',color:USER_TYPE_COLORS[u.user_type]}}>{USER_TYPE_LABELS[u.user_type]}</span>
            <span style={{padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:600,background:'var(--gray-100)',color:'var(--gray-600)'}}>{u.department}</span>
          </div>
        )}
      </div>

      {loading && <div style={{textAlign:'center',padding:60,color:'var(--gray-400)'}}>Loading preview...</div>}

      {!loading && previewData && u && (
        <div style={{display:'flex',gap:16,alignItems:'flex-start'}}>

          {/* Sidebar */}
          <div style={{width:210,flexShrink:0,borderRadius:12,boxShadow:'0 4px 20px rgba(0,0,0,0.15)',background:sidebarBg,overflow:'hidden'}}>
            <div style={{padding:'14px 14px 12px',borderBottom:'1px solid rgba(255,255,255,0.07)'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:28,height:28,borderRadius:7,background:primary,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>🏢</div>
                <div>
                  <div><span style={{fontWeight:700,fontSize:13,color:'#ffffff'}}>{previewData.theme?.company_name||'ShiftManager'}</span></div>
                  <div><span style={{fontSize:10,color:'rgba(255,255,255,0.35)'}}>{locationName}</span></div>
                </div>
              </div>
            </div>
            <nav style={{padding:'8px 8px'}}>
              {sections.map(section => {
                const items = navModules.filter(m=>m.section===section);
                if (!items.length) return null;
                const sectionLabel = {menu:'Menu',management:'Management',logs:'Logs',admin:'Admin'}[section];
                return (
                  <div key={section}>
                    <div style={{padding:'10px 8px 4px'}}>
                      <span style={{fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'rgba(255,255,255,0.25)'}}>{sectionLabel}</span>
                    </div>
                    {items.map(item=>(
                      <div key={item.id} onClick={()=>setActivePage(item.id)}
                        style={{display:'flex',alignItems:'center',gap:9,padding:'8px 10px',borderRadius:7,marginBottom:1,cursor:'pointer',
                          background:activePage===item.id?primary:'transparent'}}>
                        <span style={{fontSize:14,flexShrink:0}}>{item.icon}</span>
                        <span style={{fontSize:13,fontWeight:500,color:activePage===item.id?'#ffffff':'rgba(255,255,255,0.7)'}}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </nav>
            <div style={{padding:'10px 12px',borderTop:'1px solid rgba(255,255,255,0.07)'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:28,height:28,borderRadius:'50%',background:USER_TYPE_COLORS[u.user_type]||primary,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:13,flexShrink:0}}>
                  <span style={{color:'#ffffff'}}>{u.name?.trim()?.[0]?.toUpperCase()}</span>
                </div>
                <div style={{minWidth:0}}>
                  <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    <span style={{fontWeight:600,fontSize:12,color:'#ffffff'}}>{u.name}</span>
                  </div>
                  <span style={{background:USER_TYPE_COLORS[u.user_type]+'30',color:USER_TYPE_COLORS[u.user_type],padding:'1px 6px',borderRadius:8,fontWeight:700,fontSize:10}}>
                    {USER_TYPE_LABELS[u.user_type]}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:12}}>
            {isPH && (
              <div style={{background:'#fffbeb',border:'1px solid #fcd34d',borderRadius:8,padding:'8px 14px',fontSize:13,color:'#92400e'}}>
                🇵🇭 <strong>Philippines user</strong> — Leave Tracker and Payroll Export are hidden. Hours tracked only.
              </div>
            )}
            <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:8,padding:'8px 14px',fontSize:13,color:'#1e40af'}}>
              📁 Views default to <strong>{u.department}</strong>
              {['manager','account_admin'].includes(u.user_type) ? ' — can switch to any department' : u.user_type==='team_leader' ? ' — can switch departments' : ' — cannot browse other departments'}
            </div>

            {/* Page preview */}
            <div className="card" style={{padding:24,minHeight:260}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20,paddingBottom:16,borderBottom:'1px solid var(--gray-100)'}}>
                <span style={{fontSize:20}}>{activeModule?.icon||'📄'}</span>
                <h2 style={{margin:0,fontSize:18}}>{pageContent?.title||activePage}</h2>
                {!navModules.find(m=>m.id===activePage) && (
                  <span style={{marginLeft:'auto',padding:'3px 10px',borderRadius:20,background:'#fef2f2',color:'#dc2626',fontSize:12,fontWeight:600}}>❌ No access</span>
                )}
              </div>
              {pageContent ? pageContent.render(u) : (
                <div style={{textAlign:'center',padding:40,color:'var(--gray-400)'}}>Select a page from the sidebar</div>
              )}
            </div>

            {/* Access grid */}
            <div>
              <div style={{fontWeight:600,fontSize:13,color:'var(--gray-500)',marginBottom:8}}>All pages — click to preview</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(165px,1fr))',gap:8}}>
                {ALL_MODULES.map(mod=>{
                  const allowed = canSee(mod, u.user_type, perms, isPH);
                  return (
                    <div key={mod.id} onClick={()=>allowed&&setActivePage(mod.id)}
                      style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderRadius:8,
                        border:`1px solid ${activePage===mod.id?primary:allowed?'#d1fae5':'var(--gray-100)'}`,
                        background:activePage===mod.id?primary+'18':allowed?'#f0fdf4':'#fafafa',
                        cursor:allowed?'pointer':'default',opacity:allowed?1:0.5}}>
                      <span style={{fontSize:14}}>{mod.icon}</span>
                      <span style={{fontSize:12,fontWeight:600,color:allowed?'var(--gray-700)':'var(--gray-400)',flex:1}}>{mod.label}</span>
                      <span style={{fontSize:11}}>{allowed?'✅':'❌'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

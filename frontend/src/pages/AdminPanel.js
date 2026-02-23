import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

const USER_TYPE_LABELS = { manager:'Manager', team_leader:'Team Leader', agent:'Agent' };
const USER_TYPE_COLORS = { manager:'#2980B9', team_leader:'#8E44AD', agent:'#27AE60' };

const PERMISSION_LABELS = {
  view_availability:       { label:'View Availability Board',         desc:'See who is online/offline' },
  view_all_departments:    { label:'View All Departments',            desc:'See agents across all departments' },
  manage_shifts:           { label:'Manage Shifts',                   desc:'Create, edit and delete shifts' },
  publish_shifts:          { label:'Publish Shifts',                  desc:'Publish drafts so agents can see them' },
  view_clock_logs:         { label:'View Clock Logs',                 desc:'Access clock in/out history' },
  view_own_logs_only:      { label:'Clock Logs — Own Team Only',      desc:'Only sees logs for assigned agents' },
  manage_users:            { label:'Manage Users',                    desc:'Add, edit, deactivate user accounts' },
  view_drafts:             { label:'View Draft Shifts',               desc:'See unpublished shifts' },
  show_shifts_this_month:  { label:'Show "Shifts This Month" Tile',   desc:'Display shifts count tile on dashboard' },
  show_total_hours:        { label:'Show "Total Hours" Tile',         desc:'Display hours tile on dashboard' },
  can_set_active_status:   { label:'Can Set Agent Active/Inactive',   desc:'Toggle agent login access' },
};

const USER_TYPES = [
  { key:'manager',     label:'Manager',     color:'#2980B9', desc:'Senior staff, full team access' },
  { key:'team_leader', label:'Team Leader', color:'#8E44AD', desc:'Lead specific agents' },
  { key:'agent',       label:'Agent',       color:'#27AE60', desc:'Front-line staff' },
];

const THEME_SECTIONS = [
  { title:'Brand',       fields:[
    { key:'primary_color',  label:'Primary / Accent Colour' },
    { key:'button_color',   label:'Button Colour' },
  ]},
  { title:'Sidebar',     fields:[
    { key:'sidebar_bg',     label:'Sidebar Background' },
    { key:'sidebar_active', label:'Active Nav Item' },
    { key:'sidebar_text',   label:'Sidebar Text' },
  ]},
  { title:'App',         fields:[
    { key:'app_bg',         label:'Page Background' },
    { key:'card_bg',        label:'Card Background' },
    { key:'heading_color',  label:'Heading Text' },
    { key:'body_color',     label:'Body Text' },
  ]},
  { title:'Status',      fields:[
    { key:'online_color',    label:'Online / Active' },
    { key:'offline_color',   label:'Offline' },
    { key:'published_color', label:'Published Shift' },
    { key:'draft_color',     label:'Draft Shift' },
  ]},
  { title:'Login Page',  fields:[
    { key:'login_bg',       label:'Login Background' },
    { key:'login_card_bg',  label:'Login Card' },
  ]},
];

const PRESET_COLORS = ['#C0392B','#2980B9','#27AE60','#8E44AD','#E67E22','#16A085','#2C3E50','#F39C12','#0F172A','#1E293B','#F1F5F9','#FFFFFF'];

export default function AdminPanel() {
  const { updateTheme } = useAuth();
  const [tab, setTab] = useState('theme');
  const [permissions, setPermissions] = useState({});
  const [theme, setTheme] = useState({});
  const [departments, setDepartments] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [jobRoles, setJobRoles] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [saved, setSaved] = useState('');
  const [newJobRole, setNewJobRole] = useState({ name:'', department_id:'', description:'' });
  const logoRef = useRef();

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    socket.on('theme_update', (t) => { setTheme(t); updateTheme(t); });
    return () => socket.off('theme_update');
  }, []);

  const fetchAll = async () => {
    const [pr, th, dr, ur, jr] = await Promise.all([
      axios.get('/api/permissions'),
      axios.get('/api/theme'),
      axios.get('/api/departments'),
      axios.get('/api/users'),
      axios.get('/api/job-roles'),
    ]);
    setPermissions(pr.data);
    setTheme(th.data);
    setDepartments(dr.data);
    setAllUsers(ur.data);
    setJobRoles(jr.data);
  };

  const fetchAudit = async () => { const r = await axios.get('/api/audit-log'); setAuditLog(r.data); };
  const msg = (m) => { setSaved(m); setTimeout(() => setSaved(''), 3000); };

  const saveTheme = async () => {
    await axios.put('/api/theme', theme);
    updateTheme(theme);
    msg('Theme saved and applied to all users!');
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setTheme(t => ({ ...t, company_logo: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const togglePerm = (role, perm) => setPermissions(p => ({ ...p, [role]: { ...p[role], [perm]: !p[role]?.[perm] } }));
  const savePerms = async (role) => { await axios.put(`/api/permissions/${role}`, permissions[role]); msg(`${USER_TYPE_LABELS[role]} permissions saved!`); };

  const addJobRole = async () => {
    if (!newJobRole.name || !newJobRole.department_id) return;
    await axios.post('/api/job-roles', newJobRole);
    setNewJobRole({ name:'', department_id:'', description:'' });
    fetchAll(); msg('Job role added!');
  };

  const deleteJobRole = async (id) => {
    if (!window.confirm('Remove this job role?')) return;
    await axios.delete(`/api/job-roles/${id}`);
    fetchAll();
  };

  const assignLeader = async (jobRoleId, leaderId) => {
    await axios.post(`/api/job-roles/${jobRoleId}/leaders`, { leader_id: leaderId });
    fetchAll();
  };
  const removeLeader = async (jobRoleId, leaderId) => {
    await axios.delete(`/api/job-roles/${jobRoleId}/leaders`, { data: { leader_id: leaderId } });
    fetchAll();
  };

  const assignDeptManager = async (deptId, managerId) => {
    await axios.post(`/api/departments/${deptId}/managers`, { manager_id: managerId });
    fetchAll();
  };
  const removeDeptManager = async (deptId, managerId) => {
    await axios.delete(`/api/departments/${deptId}/managers`, { data: { manager_id: managerId } });
    fetchAll();
  };

  const managers = allUsers.filter(u => u.user_type === 'manager' && u.active !== 0);
  const leaders = allUsers.filter(u => u.user_type === 'team_leader' && u.active !== 0);
  const ACTION_LABELS = { user_created:'➕ Created', user_deleted:'🗑 Deleted', user_activated:'✅ Activated', user_deactivated:'⏸ Deactivated' };

  const tabs = [
    { id:'theme',       label:'🎨 Theme & Branding' },
    { id:'structure',   label:'🏢 Org Structure' },
    { id:'permissions', label:'🔐 Permissions' },
    { id:'audit',       label:'📋 Audit Log' },
  ];

  const ColorPicker = ({ label, themeKey }) => (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid var(--gray-100)' }}>
      <div>
        <div style={{ fontWeight:600, fontSize:13 }}>{label}</div>
        <div style={{ fontSize:11, color:'var(--gray-400)', fontFamily:'DM Mono' }}>{theme[themeKey]}</div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        {PRESET_COLORS.map(c => (
          <button key={c} onClick={() => setTheme(t => ({ ...t, [themeKey]: c }))}
            style={{ width:22, height:22, borderRadius:5, background:c, border:`2px solid ${theme[themeKey]===c?'#000':'rgba(0,0,0,0.1)'}`, cursor:'pointer', padding:0, transform:theme[themeKey]===c?'scale(1.2)':'scale(1)', transition:'all 0.1s', flexShrink:0 }} />
        ))}
        <input type="color" value={theme[themeKey]||'#000000'} onChange={e => setTheme(t => ({ ...t, [themeKey]: e.target.value }))}
          style={{ width:32, height:32, padding:2, borderRadius:8, cursor:'pointer', border:'1px solid var(--gray-300)' }} />
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ background:'linear-gradient(135deg,#1a1a2e,#C0392B)', borderRadius:14, padding:'22px 28px', marginBottom:24, color:'white', display:'flex', alignItems:'center', gap:14 }}>
        <div style={{ fontSize:36 }}>🛡️</div>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:800 }}>Account Admin Panel</h1>
          <p style={{ margin:'4px 0 0', opacity:0.6, fontSize:13 }}>Full control over theme, structure, permissions and audit trail</p>
        </div>
      </div>

      {saved && <div style={{ background:'#d4edda', border:'1px solid #c3e6cb', borderRadius:8, padding:'10px 16px', marginBottom:20, color:'#155724', fontSize:14 }}>✓ {saved}</div>}

      <div style={{ display:'flex', gap:4, marginBottom:24, borderBottom:'2px solid var(--gray-200)' }}>
        {tabs.map(t => <button key={t.id} onClick={() => { setTab(t.id); if(t.id==='audit') fetchAudit(); }}
          style={{ padding:'10px 20px', border:'none', background:'none', cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:600, color:tab===t.id?'var(--red)':'var(--gray-500)', borderBottom:tab===t.id?'2px solid var(--red)':'2px solid transparent', marginBottom:-2 }}>{t.label}</button>)}
      </div>

      {/* ── THEME & BRANDING ── */}
      {tab === 'theme' && (
        <div className="fade-in" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, alignItems:'start' }}>
          <div>
            {/* Company info */}
            <div className="card" style={{ padding:24, marginBottom:20 }}>
              <h3 style={{ fontWeight:700, marginBottom:16 }}>Company Info</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div><label>Company / App Name</label><input value={theme.company_name||''} onChange={e=>setTheme(t=>({...t,company_name:e.target.value}))} /></div>
                <div><label>Location Label</label><input value={theme.location_label||''} onChange={e=>setTheme(t=>({...t,location_label:e.target.value}))} /></div>
                <div>
                  <label>Company Logo</label>
                  <div style={{ marginTop:8 }}>
                    {theme.company_logo && <div style={{ marginBottom:10, display:'flex', alignItems:'center', gap:10 }}>
                      <img src={theme.company_logo} alt="Logo" style={{ width:52,height:52,objectFit:'contain',borderRadius:8,border:'1px solid var(--gray-200)',padding:4,background:'white' }}/>
                      <button className="btn btn-danger btn-sm" onClick={()=>setTheme(t=>({...t,company_logo:null}))}>Remove</button>
                    </div>}
                    <button className="btn btn-secondary" onClick={()=>logoRef.current.click()}>📁 Upload Logo</button>
                    <input ref={logoRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleLogoUpload}/>
                    <p style={{ fontSize:11,color:'var(--gray-400)',marginTop:4 }}>Square PNG/JPG recommended</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Colour sections */}
            {THEME_SECTIONS.map(section => (
              <div key={section.title} className="card" style={{ padding:24, marginBottom:16 }}>
                <h3 style={{ fontWeight:700, marginBottom:4 }}>{section.title}</h3>
                {section.fields.map(f => <ColorPicker key={f.key} label={f.label} themeKey={f.key} />)}
              </div>
            ))}
          </div>

          {/* Live preview */}
          <div style={{ position:'sticky', top:20 }}>
            <div className="card" style={{ padding:24, marginBottom:16 }}>
              <h3 style={{ fontWeight:700, marginBottom:16 }}>Live Preview</h3>
              <div style={{ borderRadius:12, overflow:'hidden', border:'1px solid var(--gray-200)', display:'flex', height:320 }}>
                {/* Sidebar preview */}
                <div style={{ width:120, background:theme.sidebar_bg||'#111827', padding:12, display:'flex', flexDirection:'column', gap:4 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12, paddingBottom:10, borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                    {theme.company_logo ? <img src={theme.company_logo} alt="" style={{ width:22,height:22,borderRadius:4,objectFit:'contain',background:'white' }}/> : <div style={{ width:22,height:22,borderRadius:4,background:theme.primary_color||'#C0392B' }}/>}
                    <div style={{ color:'white',fontSize:9,fontWeight:700,lineHeight:1.1 }}>{(theme.company_name||'ShiftManager').slice(0,10)}</div>
                  </div>
                  {['Dashboard','Availability','Team','Admin'].map((item, i) => (
                    <div key={item} style={{ padding:'5px 8px', borderRadius:6, background:i===0?theme.sidebar_active||'#C0392B':'transparent', color:i===0?'white':theme.sidebar_text||'rgba(255,255,255,0.5)', fontSize:10, fontWeight:500 }}>{item}</div>
                  ))}
                </div>
                {/* Main area preview */}
                <div style={{ flex:1, background:theme.app_bg||'#F1F5F9', padding:12, overflow:'hidden' }}>
                  <div style={{ fontWeight:700, fontSize:11, color:theme.heading_color||'#111827', marginBottom:8 }}>Dashboard</div>
                  <div style={{ background:theme.card_bg||'#FFFFFF', borderRadius:8, padding:10, marginBottom:8, boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
                    <div style={{ fontSize:9, color:theme.body_color||'#334155' }}>Live Availability</div>
                    <div style={{ display:'flex', gap:4, marginTop:6 }}>
                      <div style={{ width:28,height:28,borderRadius:'50%',background:theme.online_color||'#22C55E',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:8,fontWeight:700 }}>🟢</div>
                      <div style={{ width:28,height:28,borderRadius:'50%',background:theme.offline_color||'#94A3B8',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:8 }}>⚫</div>
                    </div>
                  </div>
                  <div style={{ background:theme.card_bg||'#FFFFFF', borderRadius:8, padding:10, boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
                    <div style={{ fontSize:8, padding:'3px 8px', borderRadius:4, background:theme.published_color||'#22C55E', color:'white', display:'inline-block', marginBottom:4 }}>Published</div>
                    <div style={{ fontSize:8, padding:'3px 8px', borderRadius:4, background:theme.draft_color||'#FCD34D', color:'#333', display:'inline-block', marginLeft:4 }}>Draft</div>
                    <div style={{ marginTop:8 }}>
                      <div style={{ background:theme.button_color||theme.primary_color||'#C0392B', color:'white', padding:'4px 10px', borderRadius:4, fontSize:9, fontWeight:600, display:'inline-block' }}>Button</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }} onClick={saveTheme}>
              💾 Save & Apply Theme to All Users
            </button>
          </div>
        </div>
      )}

      {/* ── ORG STRUCTURE ── */}
      {tab === 'structure' && (
        <div className="fade-in">
          <p style={{ color:'var(--gray-500)',fontSize:14,marginBottom:24 }}>
            Set up your organisation: assign Managers to Departments, create Job Roles, and assign Team Leaders to each Job Role.
          </p>

          {/* Add job role */}
          <div className="card" style={{ padding:24, marginBottom:24 }}>
            <h3 style={{ fontWeight:700, marginBottom:16 }}>Add Job Role</h3>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'flex-end' }}>
              <div style={{ flex:2, minWidth:160 }}><label>Job Role Name</label><input placeholder="e.g. Inbound Calls" value={newJobRole.name} onChange={e=>setNewJobRole(r=>({...r,name:e.target.value}))}/></div>
              <div style={{ flex:1, minWidth:140 }}><label>Department</label>
                <select value={newJobRole.department_id} onChange={e=>setNewJobRole(r=>({...r,department_id:e.target.value}))}>
                  <option value="">Select...</option>
                  {departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div style={{ flex:2, minWidth:160 }}><label>Description (optional)</label><input placeholder="Brief description" value={newJobRole.description} onChange={e=>setNewJobRole(r=>({...r,description:e.target.value}))}/></div>
              <button className="btn btn-primary" onClick={addJobRole}>+ Add</button>
            </div>
          </div>

          {/* Department cards */}
          {departments.map(dept => (
            <div key={dept.id} className="card" style={{ padding:24, marginBottom:20, borderLeft:`4px solid ${dept.color}` }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
                <div style={{ width:12,height:12,borderRadius:'50%',background:dept.color }}/>
                <h3 style={{ margin:0, fontWeight:800, fontSize:17 }}>{dept.name}</h3>

                {/* Managers for this dept */}
                <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:12, color:'var(--gray-400)', fontWeight:600 }}>MANAGERS:</span>
                  {dept.managers?.map(m => (
                    <span key={m.id} style={{ display:'flex', alignItems:'center', gap:4, background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:20, padding:'3px 10px', fontSize:12, fontWeight:600, color:'#1D4ED8' }}>
                      {m.name}
                      <button onClick={()=>removeDeptManager(dept.id,m.id)} style={{ background:'none',border:'none',cursor:'pointer',color:'#ef4444',fontSize:14,padding:'0 2px',lineHeight:1 }}>×</button>
                    </span>
                  ))}
                  <select onChange={e=>{if(e.target.value){assignDeptManager(dept.id,e.target.value);e.target.value='';}}} style={{ fontSize:12, padding:'4px 8px', borderRadius:8 }}>
                    <option value="">+ Add Manager</option>
                    {managers.filter(m=>!dept.managers?.find(dm=>dm.id===m.id)).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Job roles in this dept */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
                {jobRoles.filter(jr=>jr.department_id===dept.id).map(jr => (
                  <div key={jr.id} style={{ background:'var(--gray-50)', borderRadius:10, padding:16, border:'1px solid var(--gray-200)' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                      <div>
                        <div style={{ fontWeight:700, fontSize:14 }}>{jr.name}</div>
                        {jr.description && <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:2 }}>{jr.description}</div>}
                      </div>
                      <button onClick={()=>deleteJobRole(jr.id)} style={{ background:'none',border:'none',cursor:'pointer',color:'#ef4444',fontSize:18 }}>×</button>
                    </div>

                    {/* Team leaders */}
                    <div style={{ marginBottom:8 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'#8E44AD', textTransform:'uppercase', letterSpacing:0.5, marginBottom:4 }}>Team Leaders</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                        {jr.leaders?.map(l=>(
                          <span key={l.id} style={{ display:'flex',alignItems:'center',gap:4,background:'#F3E8FF',border:'1px solid #DDD6FE',borderRadius:12,padding:'2px 8px',fontSize:11,fontWeight:600,color:'#7C3AED' }}>
                            {l.name}
                            <button onClick={()=>removeLeader(jr.id,l.id)} style={{ background:'none',border:'none',cursor:'pointer',color:'#ef4444',fontSize:12,padding:0 }}>×</button>
                          </span>
                        ))}
                        <select onChange={e=>{if(e.target.value){assignLeader(jr.id,e.target.value);e.target.value=''}}} style={{ fontSize:11,padding:'2px 6px',borderRadius:8 }}>
                          <option value="">+ Leader</option>
                          {leaders.filter(l=>!jr.leaders?.find(jl=>jl.id===l.id)).map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Agent count */}
                    <div style={{ fontSize:11,color:'var(--gray-400)' }}>{jr.agent_count||0} agent{jr.agent_count!==1?'s':''} in this role</div>
                  </div>
                ))}
                {jobRoles.filter(jr=>jr.department_id===dept.id).length===0 && (
                  <div style={{ padding:20,color:'var(--gray-400)',fontSize:13,fontStyle:'italic' }}>No job roles yet — add one above</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── PERMISSIONS ── */}
      {tab === 'permissions' && (
        <div className="fade-in">
          <p style={{ color:'var(--gray-500)',fontSize:14,marginBottom:20 }}>Configure what each User Type can see and do. Changes take effect immediately.</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20 }}>
            {USER_TYPES.map(ut => (
              <div key={ut.key} className="card" style={{ padding:24, borderTop:`4px solid ${ut.color}` }}>
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontWeight:800, fontSize:16 }}>{ut.label}</div>
                  <div style={{ fontSize:12,color:'var(--gray-500)',marginTop:2 }}>{ut.desc}</div>
                </div>
                <div style={{ display:'flex',flexDirection:'column',gap:3 }}>
                  {Object.entries(PERMISSION_LABELS).map(([perm,info]) => {
                    const enabled = !!permissions[ut.key]?.[perm];
                    return (
                      <div key={perm} onClick={()=>togglePerm(ut.key,perm)}
                        style={{ display:'flex',alignItems:'flex-start',gap:10,padding:'9px 10px',borderRadius:8,cursor:'pointer',background:enabled?`${ut.color}12`:'transparent',border:`1px solid ${enabled?ut.color+'40':'transparent'}`,transition:'all 0.15s',marginBottom:2 }}>
                        <div style={{ width:18,height:18,borderRadius:4,border:`2px solid ${enabled?ut.color:'var(--gray-300)'}`,background:enabled?ut.color:'white',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1 }}>
                          {enabled && <span style={{ color:'white',fontSize:11,fontWeight:700 }}>✓</span>}
                        </div>
                        <div>
                          <div style={{ fontSize:12,fontWeight:600,color:enabled?'var(--gray-900)':'var(--gray-500)' }}>{info.label}</div>
                          <div style={{ fontSize:10,color:'var(--gray-400)',marginTop:1 }}>{info.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button className="btn btn-sm" style={{ marginTop:14,width:'100%',justifyContent:'center',background:ut.color,color:'white',border:'none' }} onClick={()=>savePerms(ut.key)}>
                  Save {ut.label} Permissions
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── AUDIT LOG ── */}
      {tab === 'audit' && (
        <div className="fade-in">
          <p style={{ color:'var(--gray-500)',fontSize:14,marginBottom:20 }}>Full record of all user account changes.</p>
          <div className="card" style={{ overflow:'auto' }}>
            <table style={{ width:'100%',borderCollapse:'collapse',fontSize:13 }}>
              <thead><tr style={{ background:'var(--gray-50)',borderBottom:'2px solid var(--gray-200)' }}>
                {['Action','User Affected','User Type','Department','Performed By','Date & Time'].map(h=><th key={h} style={{ padding:'12px 16px',textAlign:'left',fontSize:12,fontWeight:600,color:'var(--gray-500)',textTransform:'uppercase' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {auditLog.length===0 && <tr><td colSpan={6} style={{ padding:40,textAlign:'center',color:'var(--gray-400)' }}>No audit events yet</td></tr>}
                {auditLog.map(log=>(
                  <tr key={log.id} style={{ borderBottom:'1px solid var(--gray-100)' }}>
                    <td style={{ padding:'10px 16px',fontWeight:600 }}>{ACTION_LABELS[log.action]||log.action}</td>
                    <td style={{ padding:'10px 16px' }}><div style={{ fontWeight:600 }}>{log.target_user_name||'—'}</div><div style={{ fontSize:12,color:'var(--gray-400)' }}>{log.target_user_email}</div></td>
                    <td style={{ padding:'10px 16px',fontSize:12,color:USER_TYPE_COLORS[log.target_user_role]||'var(--gray-500)',fontWeight:600,textTransform:'capitalize' }}>{log.target_user_role?.replace('_',' ')||'—'}</td>
                    <td style={{ padding:'10px 16px',fontSize:12,color:'var(--gray-500)' }}>{log.target_user_department||'—'}</td>
                    <td style={{ padding:'10px 16px',fontSize:13 }}>{log.performed_by_name||'—'}</td>
                    <td style={{ padding:'10px 16px',fontFamily:'DM Mono',fontSize:12,color:'var(--gray-500)' }}>{log.created_at?new Date(log.created_at).toLocaleString('en-ZA'):'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

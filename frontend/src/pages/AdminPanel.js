import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import io from 'socket.io-client';

const socket = io(process.env.NODE_ENV === 'production' ? 'https://csi-shift-app.up.railway.app' : 'http://localhost:5000');

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
    { key:'sidebar_bg',            label:'Sidebar Background' },
    { key:'sidebar_active',        label:'Active Nav Item Background' },
    { key:'sidebar_text',          label:'Nav Link Text' },
    { key:'sidebar_section_label', label:'Section Labels (MENU, MANAGEMENT)' },
    { key:'sidebar_divider',       label:'Divider Lines' },
    { key:'sidebar_name_color',    label:'App Name Text' },
    { key:'sidebar_sub_color',     label:'Location Label Text' },
    { key:'sidebar_user_name',     label:'Logged-in User Name' },
    { key:'sidebar_btn_border',    label:'Button Borders (Sign Out / Change Password)' },
    { key:'sidebar_btn_text',      label:'Button Text (Sign Out / Change Password)' },
    { key:'sidebar_footer_text',   label:'Footer Credits Text' },
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
    { key:'login_btn_color', label:'Login Button Colour' },
    { key:'login_btn_text', label:'Login Button Text Colour' },
  ]},
];

const PRESET_COLORS = ['#C0392B','#2980B9','#27AE60','#8E44AD','#E67E22','#16A085','#2C3E50','#F39C12','#0F172A','#1E293B','#F1F5F9','#FFFFFF'];

export default function AdminPanel() {
  const { updateTheme, user } = useAuth();
  const isAccountAdmin = user?.user_type === 'account_admin';
  const isManager = user?.user_type === 'manager';
  const isTeamLeader = user?.user_type === 'team_leader';
  const canManageHolidays = isAccountAdmin || isManager || isTeamLeader;
  const [tab, setTab] = useState(isAccountAdmin || isManager ? 'theme' : 'holidays');
  const [permissions, setPermissions] = useState({});
  const [theme, setTheme] = useState({});
  const [departments, setDepartments] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [jobRoles, setJobRoles] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [breakTypes, setBreakTypes] = useState([]);
  const [newBreak, setNewBreak] = useState({ name:'', icon:'⏸️', color:'#6B7280', max_minutes:'' });
  const [editingBreak, setEditingBreak] = useState(null);
  const [saved, setSaved] = useState('');
  const [newJobRole, setNewJobRole] = useState({ name:'', department_id:'', description:'' });
  const [previewPage, setPreviewPage] = useState('app');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showEditEmojiPicker, setShowEditEmojiPicker] = useState(false);
  // Public holidays state
  const [holidays, setHolidays] = useState([]);
  const [newHoliday, setNewHoliday] = useState({ date:'', name:'' });
  const [holidayYear, setHolidayYear] = useState(new Date().getFullYear());
  const [holidayLoading, setHolidayLoading] = useState(false);
  const [visibility, setVisibility] = useState({});
  const [locations, setLocations] = useState([]);
  const [newLocation, setNewLocation] = useState({ code:'', name:'', timezone:'Africa/Johannesburg' });
  const [locationMsg, setLocationMsg] = useState({ text:'', type:'' });
  const [editingLocation, setEditingLocation] = useState(null); // { id, name, timezone }

  const BREAK_EMOJIS = [
    '🍽️','☕','🚻','📋','📚','🙏','💤','🏃','🎮','📱',
    '🍕','🍔','🥗','🍜','🧃','🥤','🍵','🧋','🍫','🍎',
    '💊','🩺','🏥','✈️','🚗','🛁','🧹','📞','💻','🎵',
    '⏸️','⏰','🔔','💬','🤝','🌟','❤️','🧘','🏋️','⚽',
  ];
  const logoRef = useRef();

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    socket.on('theme_update', (t) => { setTheme(t); updateTheme(t); });
    return () => socket.off('theme_update');
  }, []);

  const fetchAll = async () => {
    try {
      const [pr, th, dr, ur, jr, br, lr] = await Promise.all([
        axios.get('/api/permissions').catch(() => ({ data: {} })),
        axios.get('/api/theme').catch(() => ({ data: {} })),
        axios.get('/api/departments').catch(() => ({ data: [] })),
        axios.get('/api/users').catch(() => ({ data: [] })),
        axios.get('/api/job-roles').catch(() => ({ data: [] })),
        axios.get('/api/break-types?all=true').catch(() => ({ data: [] })),
        axios.get('/api/locations').catch(() => ({ data: [] })),
      ]);
      setPermissions(pr.data);
      setTheme(th.data);
      // Load visibility settings stored in theme
      if (th.data?.dept_visibility) {
        try { setVisibility(JSON.parse(th.data.dept_visibility)); } catch(e) { setVisibility({}); }
      }
      setDepartments(Array.isArray(dr.data) ? dr.data : []);
      setAllUsers(Array.isArray(ur.data) ? ur.data : []);
      setJobRoles(Array.isArray(jr.data) ? jr.data : []);
      console.log('break-types raw response:', br.data, 'isArray:', Array.isArray(br.data), 'length:', br.data?.length);
      setBreakTypes(Array.isArray(br.data) ? br.data : []);
      setLocations(Array.isArray(lr.data) ? lr.data : []);
    } catch(e) {
      console.error('AdminPanel fetchAll error:', e);
    }
  };

  const fetchAudit = async () => { const r = await axios.get('/api/audit-log'); setAuditLog(r.data); };

  const fetchHolidays = async (year) => {
    const r = await axios.get(`/api/public-holidays?year=${year}`).catch(()=>({data:[]}));
    setHolidays(r.data);
  };

  useEffect(() => { fetchHolidays(holidayYear); }, [holidayYear]);

  const addHoliday = async () => {
    if (!newHoliday.date || !newHoliday.name) return;
    try {
      await axios.post('/api/public-holidays', newHoliday);
      setNewHoliday({ date:'', name:'' });
      fetchHolidays(holidayYear);
    } catch(e) { alert(e.response?.data?.error||'Error'); }
  };

  const deleteHoliday = async (id) => {
    if (!window.confirm('Remove this public holiday?')) return;
    await axios.delete(`/api/public-holidays/${id}`);
    fetchHolidays(holidayYear);
  };

  const loadPresetHolidays = async (country) => {
    setHolidayLoading(true);
    const SA_HOLIDAYS = [
      { date:`${holidayYear}-01-01`, name:'New Year\'s Day' },
      { date:`${holidayYear}-03-21`, name:'Human Rights Day' },
      { date:`${holidayYear}-04-18`, name:'Good Friday' },
      { date:`${holidayYear}-04-21`, name:'Family Day' },
      { date:`${holidayYear}-04-27`, name:'Freedom Day' },
      { date:`${holidayYear}-05-01`, name:'Workers\' Day' },
      { date:`${holidayYear}-06-16`, name:'Youth Day' },
      { date:`${holidayYear}-08-09`, name:'National Women\'s Day' },
      { date:`${holidayYear}-09-24`, name:'Heritage Day' },
      { date:`${holidayYear}-12-16`, name:'Day of Reconciliation' },
      { date:`${holidayYear}-12-25`, name:'Christmas Day' },
      { date:`${holidayYear}-12-26`, name:'Day of Goodwill' },
    ];
    const PH_HOLIDAYS = [
      { date:`${holidayYear}-01-01`, name:'New Year\'s Day' },
      { date:`${holidayYear}-04-09`, name:'Araw ng Kagitingan' },
      { date:`${holidayYear}-04-17`, name:'Maundy Thursday' },
      { date:`${holidayYear}-04-18`, name:'Good Friday' },
      { date:`${holidayYear}-05-01`, name:'Labour Day' },
      { date:`${holidayYear}-06-12`, name:'Independence Day' },
      { date:`${holidayYear}-08-25`, name:'National Heroes Day' },
      { date:`${holidayYear}-11-01`, name:'All Saints\' Day' },
      { date:`${holidayYear}-11-30`, name:'Bonifacio Day' },
      { date:`${holidayYear}-12-08`, name:'Feast of the Immaculate Conception' },
      { date:`${holidayYear}-12-25`, name:'Christmas Day' },
      { date:`${holidayYear}-12-30`, name:'Rizal Day' },
    ];
    const list = (country === 'SA' ? SA_HOLIDAYS : PH_HOLIDAYS).map(h => ({ ...h, location: country }));
    let added = 0;
    for (const h of list) {
      try { await axios.post('/api/public-holidays', h); added++; } catch {}
    }
    await fetchHolidays(holidayYear);
    setHolidayLoading(false);
    setSaved(`Loaded ${added} ${country === 'SA' ? 'South African' : 'Philippine'} public holidays for ${holidayYear}`);
    setTimeout(()=>setSaved(''),4000);
  };
  const msg = (m) => { setSaved(m); setTimeout(() => setSaved(''), 3000); };

  const saveTheme = async () => {
    await axios.put('/api/theme', theme);
    updateTheme(theme);
    msg('Theme saved and applied to all users!');
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('File too large. Please upload an image under 2MB.'); return; }
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
    { id:'theme',       label:'🎨 Theme & Branding',  show: isAccountAdmin },
    { id:'display',     label:'📺 Display Screen',     show: isAccountAdmin },
    { id:'structure',   label:'🏢 Org Structure',      show: isAccountAdmin || isManager },
    { id:'visibility',  label:'👁 Module Visibility',  show: isAccountAdmin },
    { id:'locations',   label:'📍 Locations',           show: isAccountAdmin },
    { id:'breaks',      label:'☕ Break Types',         show: isAccountAdmin || isManager },
    { id:'hours',       label:'📊 Hours Targets',       show: isAccountAdmin || isManager },
    { id:'holidays',    label:'🗓 Public Holidays',     show: canManageHolidays },
    { id:'bigquery',    label:'📊 Sheets Sync',         show: isAccountAdmin },
    { id:'permissions', label:'🔐 Permissions',         show: isAccountAdmin },
    { id:'audit',       label:'📋 Audit Log',           show: isAccountAdmin },
  ].filter(t => t.show);

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
                  <label>Browser Tab Title</label>
                  <input placeholder="e.g. ShiftManager — South Africa" value={theme.tab_title||''} onChange={e=>setTheme(t=>({...t,tab_title:e.target.value}))} />
                  <p style={{ fontSize:11,color:'var(--gray-400)',marginTop:4 }}>This is the text shown in the browser tab. Independent of the app name.</p>
                </div>
                <div><label>Login Page Subtitle</label><input placeholder="e.g. Operations Platform" value={theme.login_subtitle||''} onChange={e=>setTheme(t=>({...t,login_subtitle:e.target.value}))} /></div>
                <div style={{ gridColumn:'1/-1', borderTop:'1px solid var(--gray-100)', paddingTop:16, marginTop:4 }}>
                  <label style={{ fontWeight:700, fontSize:13, color:'var(--gray-600)', display:'block', marginBottom:12 }}>Sidebar Footer Credits</label>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                    <div><label>Version Label</label><input placeholder="e.g. ShiftManager v7.5" value={theme.footer_line1||''} onChange={e=>setTheme(t=>({...t,footer_line1:e.target.value}))} /></div>
                    <div><label>Credits (after your name)</label><input placeholder="e.g. Powered by TourAxis" value={theme.footer_line3||''} onChange={e=>setTheme(t=>({...t,footer_line3:e.target.value}))} /></div>
                    <div style={{ display:'flex',alignItems:'flex-end',paddingBottom:8 }}>
                      <p style={{ fontSize:12,color:'var(--gray-400)',fontStyle:'italic' }}>"Built by Ashwin Halford" is permanent and cannot be changed.</p>
                    </div>
                  </div>
                </div>
                <div>
                  <label>Company Logo</label>
                  <div style={{ marginTop:8 }}>
                    {theme.company_logo && <div style={{ marginBottom:10, display:'flex', alignItems:'center', gap:10 }}>
                      <img src={theme.company_logo} alt="Logo" style={{ width:52,height:52,objectFit:'contain',borderRadius:8,border:'1px solid var(--gray-200)',padding:4,background:'white' }}/>
                      <button className="btn btn-danger btn-sm" onClick={()=>setTheme(t=>({...t,company_logo:null}))}>Remove</button>
                    </div>}
                    <button className="btn btn-secondary" onClick={()=>logoRef.current.click()}>📁 Upload Logo</button>
                    <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" style={{ display:'none' }} onChange={handleLogoUpload}/>
                    <p style={{ fontSize:11,color:'var(--gray-400)',marginTop:6,lineHeight:1.6 }}>
                      Accepted: PNG, JPG, SVG, WebP<br/>
                      Recommended: Square, at least 128×128px<br/>
                      Max size: 2MB
                    </p>
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
              <h3 style={{ fontWeight:700, marginBottom:12 }}>Live Preview</h3>
              <div style={{ display:'flex', gap:6, marginBottom:16 }}>
                {['app','login'].map(p=>(
                  <button key={p} onClick={()=>setPreviewPage(p)}
                    style={{ padding:'5px 14px',borderRadius:8,border:'none',background:previewPage===p?'var(--red)':'var(--gray-100)',color:previewPage===p?'white':'var(--gray-600)',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',textTransform:'capitalize' }}>
                    {p==='app'?'🖥 App':'🔑 Login'}
                  </button>
                ))}
              </div>
              {previewPage === 'app' && <div style={{ borderRadius:12, overflow:'hidden', border:'1px solid var(--gray-200)', display:'flex', height:320 }}>
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
              </div>}

              {/* Login page preview */}
              {previewPage === 'login' && (
                <div style={{ borderRadius:12, overflow:'hidden', border:'1px solid var(--gray-200)', height:320, background:theme.login_bg||'#0F172A', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
                  <div style={{ width:'100%', maxWidth:220 }}>
                    <div style={{ textAlign:'center', marginBottom:12 }}>
                      {theme.company_logo
                        ? <img src={theme.company_logo} alt='' style={{ width:32,height:32,objectFit:'contain',borderRadius:8,background:'white',padding:3,marginBottom:6 }}/>
                        : <div style={{ width:32,height:32,borderRadius:8,background:theme.primary_color||'#C0392B',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:16,marginBottom:6 }}>🏢</div>}
                      <div style={{ color:'white',fontSize:13,fontWeight:800 }}>{(theme.company_name||'ShiftManager').slice(0,14)}</div>
                      <div style={{ color:'rgba(255,255,255,0.4)',fontSize:10,marginTop:2 }}>{(theme.login_subtitle||'Operations Platform').slice(0,24)}</div>
                    </div>
                    <div style={{ background:theme.login_card_bg||'#1E293B', borderRadius:10, padding:14, border:'1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ color:'white',fontSize:11,fontWeight:700,marginBottom:8 }}>Sign in</div>
                      <div style={{ background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:6,padding:'6px 10px',fontSize:10,color:'rgba(255,255,255,0.3)',marginBottom:6 }}>your@email.com</div>
                      <div style={{ background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:6,padding:'6px 10px',fontSize:10,color:'rgba(255,255,255,0.3)',marginBottom:10 }}>••••••••</div>
                      <div style={{ background:theme.primary_color||'#C0392B',borderRadius:6,padding:'7px 10px',fontSize:10,color:'white',fontWeight:700,textAlign:'center' }}>Sign In</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }} onClick={saveTheme}>
              💾 Save & Apply Theme to All Users
            </button>
          </div>
        </div>
      )}

      {/* ── ORG STRUCTURE ── */}
      {tab === 'display' && (() => {
        const displayUrl = `${window.location.origin}/display`;
        return (
          <div className="fade-in">
            <div className="card" style={{ padding:28, marginBottom:20 }}>
              <h3 style={{ fontWeight:700, marginBottom:6 }}>📺 Display Screen</h3>
              <p style={{ fontSize:13, color:'var(--gray-500)', marginBottom:20 }}>
                A public live availability board for office TVs or remote monitoring. Protected by a PIN — no login required.
              </p>

              {/* URL section */}
              <div style={{ background:'var(--gray-50,#F9FAFB)', border:'1px solid var(--gray-200)', borderRadius:10, padding:16, marginBottom:20 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:0.8, marginBottom:8 }}>Display URL</div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <code style={{ flex:1, fontSize:13, color:'var(--gray-700)', background:'white', border:'1px solid var(--gray-200)', borderRadius:8, padding:'8px 12px', wordBreak:'break-all' }}>{displayUrl}</code>
                  <button className="btn btn-secondary" onClick={() => { navigator.clipboard.writeText(displayUrl); setSaved('URL copied!'); setTimeout(()=>setSaved(''),2000); }}>📋 Copy</button>
                  <a href="/display" target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ textDecoration:'none' }}>🔗 Open</a>
                </div>
              </div>

              {/* PIN section */}
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:0.8, marginBottom:10 }}>Display PIN</div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    value={theme.display_pin || ''}
                    onChange={e => setTheme(t => ({ ...t, display_pin: e.target.value.replace(/\D/g,'') }))}
                    placeholder="e.g. 1234"
                    style={{ width:160 }}
                  />
                  <button className="btn btn-primary" onClick={async () => { await axios.put('/api/theme', theme); updateTheme(theme); msg('PIN saved!'); }}>Save PIN</button>
                </div>
                <p style={{ fontSize:11, color:'var(--gray-400)', marginTop:8 }}>
                  Numbers only, 4–8 digits. Anyone with this PIN can view the display screen.
                </p>
              </div>
            </div>

            {/* Display Screen Colours */}
            <div className="card" style={{ padding:28, marginBottom:20 }}>
              <h3 style={{ fontWeight:700, marginBottom:4 }}>Display Screen Colours</h3>
              <p style={{ fontSize:12, color:'var(--gray-500)', marginBottom:16 }}>These colours only affect the /display screen. Defaults are dark so text is always readable on a TV.</p>
              {[
                { key:'display_bg',         label:'Background' },
                { key:'display_header_bg',  label:'Header / Footer Background' },
                { key:'display_text',       label:'Main Text' },
                { key:'display_muted',      label:'Muted / Subtitle Text' },
                { key:'display_card_bg',    label:'Agent Card Background' },
                { key:'display_border',     label:'Borders & Dividers' },
              ].map(f => <ColorPicker key={f.key} label={f.label} themeKey={f.key}/>)}
              <div style={{ marginTop:16 }}>
                <button className="btn btn-primary" onClick={async () => { await axios.put('/api/theme', theme); updateTheme(theme); msg('Display colours saved!'); }}>
                  💾 Save Display Colours
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div className="card" style={{ padding:28 }}>
              <h3 style={{ fontWeight:700, marginBottom:14 }}>How to use</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {[
                  { icon:'📺', title:'Office TV', desc:'Open the Display URL on a TV browser in fullscreen (F11). The screen updates live as agents clock in and out.' },
                  { icon:'🔗', title:'Remote monitoring', desc:'Share the Display URL with anyone who needs to monitor availability. They will need the PIN to access it.' },
                  { icon:'🔒', title:'Change PIN', desc:'Update the PIN above at any time. Anyone currently viewing the display will not be affected until they reload.' },
                ].map(item => (
                  <div key={item.title} style={{ display:'flex', gap:14, padding:14, background:'var(--gray-50,#F9FAFB)', borderRadius:10, border:'1px solid var(--gray-100)' }}>
                    <div style={{ fontSize:24, flexShrink:0 }}>{item.icon}</div>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14, marginBottom:3 }}>{item.title}</div>
                      <div style={{ fontSize:13, color:'var(--gray-500)' }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

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
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20, flexWrap:'wrap' }}>
                <div style={{ width:12,height:12,borderRadius:'50%',background:dept.color }}/>
                <h3 style={{ margin:0, fontWeight:800, fontSize:17 }}>{dept.name}</h3>

                {/* Colour pickers */}
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <label style={{ fontSize:11, color:'var(--gray-400)', fontWeight:600, margin:0 }}>TEXT</label>
                  <input type="color" value={dept.color||'#333333'}
                    onChange={e => setDepartments(ds => ds.map(d => d.id===dept.id ? {...d,color:e.target.value} : d))}
                    onBlur={e => axios.put('/api/departments/'+dept.id, { name:dept.name, color:e.target.value, bg_color:dept.bg_color })}
                    style={{ width:32, height:28, padding:2, borderRadius:6, border:'1px solid var(--gray-200)', cursor:'pointer' }}/>
                  <label style={{ fontSize:11, color:'var(--gray-400)', fontWeight:600, margin:0 }}>BG</label>
                  <input type="color" value={dept.bg_color||'#f0f0f0'}
                    onChange={e => setDepartments(ds => ds.map(d => d.id===dept.id ? {...d,bg_color:e.target.value} : d))}
                    onBlur={e => axios.put('/api/departments/'+dept.id, { name:dept.name, color:dept.color, bg_color:e.target.value })}
                    style={{ width:32, height:28, padding:2, borderRadius:6, border:'1px solid var(--gray-200)', cursor:'pointer' }}/>
                  <div style={{ padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:700, background:dept.bg_color||'#f0f0f0', color:dept.color||'#333' }}>Preview</div>
                </div>

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


      {/* ── BREAK TYPES ── */}
      {tab === 'hours' && (() => {
        let cycleDays = {};
        try { cycleDays = JSON.parse(theme.pay_cycle_days || '{}'); } catch {}
        const setCycleDay = (deptName, val) => {
          const updated = { ...cycleDays, [deptName]: Number(val) };
          setTheme(t => ({ ...t, pay_cycle_days: JSON.stringify(updated) }));
        };
        const today = new Date();
        const fmtDate = (d) => d.toLocaleDateString('en-ZA',{day:'numeric',month:'long',year:'numeric'});
        const getPreview = (cycleDay) => {
          const day = today.getDate();
          let s, e;
          if (day >= cycleDay) {
            s = new Date(today.getFullYear(), today.getMonth(), cycleDay);
            e = new Date(today.getFullYear(), today.getMonth()+1, cycleDay-1);
          } else {
            s = new Date(today.getFullYear(), today.getMonth()-1, cycleDay);
            e = new Date(today.getFullYear(), today.getMonth(), cycleDay-1);
          }
          return { s, e };
        };
        return (
          <div className="fade-in">
            <div className="card" style={{ padding:28, marginBottom:16 }}>
              <h3 style={{ fontWeight:800, marginBottom:4 }}>Pay Cycle — Per Department</h3>
              <p style={{ color:'var(--gray-500)', fontSize:14, marginBottom:24 }}>
                Set the day of month each department's pay cycle starts. The Hours Tracker uses this as the period boundary instead of calendar month.
              </p>
              <div style={{ display:'grid', gap:14 }}>
                {departments.map(dept => {
                  const cycleDay = Number(cycleDays[dept.name] || 1);
                  const { s, e } = getPreview(cycleDay);
                  return (
                    <div key={dept.id} style={{ padding:'16px 20px', borderRadius:10, border:'1.5px solid var(--gray-200)', background:'white' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
                        <div style={{ width:14, height:14, borderRadius:4, background:dept.bg_color, border:`2px solid ${dept.color}`, flexShrink:0 }}/>
                        <div style={{ fontWeight:700, fontSize:14, minWidth:140 }}>{dept.name}</div>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{ fontSize:13, color:'var(--gray-500)' }}>Cycle starts day</span>
                          <input
                            type="number" min={1} max={28} step={1}
                            value={cycleDay}
                            onChange={e => setCycleDay(dept.name, Math.min(28, Math.max(1, Number(e.target.value))))}
                            style={{ width:70, padding:'7px 10px', borderRadius:8, border:'1.5px solid var(--gray-200)', fontSize:16, fontFamily:'inherit', fontWeight:700, textAlign:'center' }}
                          />
                          <span style={{ fontSize:13, color:'var(--gray-500)' }}>of each month</span>
                        </div>
                      </div>
                      <div style={{ marginTop:10, padding:'8px 12px', borderRadius:7, background:'#f0f9ff', border:'1px solid #bae6fd', fontSize:12, color:'#0369a1' }}>
                        📅 Current period: <strong>{fmtDate(s)}</strong> → <strong>{fmtDate(e)}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop:20 }}>
                <button className="btn btn-primary" onClick={saveTheme}>Save Pay Cycles</button>
                <span style={{ marginLeft:12, fontSize:12, color:'var(--gray-400)' }}>Saved with theme settings</span>
              </div>
            </div>

            <div className="card" style={{ padding:20, background:'#f0f9ff', border:'1.5px solid #bae6fd' }}>
              <div style={{ fontWeight:700, fontSize:13, marginBottom:6, color:'#0369a1' }}>ℹ️ How hours are calculated</div>
              <div style={{ fontSize:13, color:'#0c4a6e', lineHeight:1.7 }}>
                <strong>Normal hours</strong> — scheduled weekday (Mon–Fri) shifts<br/>
                <strong>OT @ 1.5</strong> — weekend shifts, or any shift marked as authorised OT<br/>
                <strong>OT @ 2</strong> — SA public holidays (auto-detected) or shifts marked as public holiday OT<br/>
                <strong>Leave hours</strong> — full-day leave = 8 hrs, half-day leave = 4 hrs<br/>
                <strong>No targets shown</strong> — hours vary by month length, so totals are shown without a benchmark
              </div>
            </div>
          </div>
        );
      })()}


      {tab === 'holidays' && (
        <div className="fade-in">
          <div style={{ marginBottom:20, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <div>
              <h2 style={{ margin:0, fontSize:18, fontWeight:800 }}>🗓 Public Holidays</h2>
              <p style={{ margin:'4px 0 0', color:'var(--gray-500)', fontSize:13 }}>Shifts on these dates auto-classify as OT @ 2 in Hours Tracker.</p>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <button onClick={()=>setHolidayYear(y=>y-1)} style={{ padding:'6px 12px', borderRadius:8, border:'1px solid var(--gray-300)', background:'white', cursor:'pointer', fontWeight:700 }}>‹</button>
              <span style={{ fontWeight:800, fontSize:16, minWidth:60, textAlign:'center' }}>{holidayYear}</span>
              <button onClick={()=>setHolidayYear(y=>y+1)} style={{ padding:'6px 12px', borderRadius:8, border:'1px solid var(--gray-300)', background:'white', cursor:'pointer', fontWeight:700 }}>›</button>
            </div>
          </div>
          <div className="card" style={{ padding:20, marginBottom:20 }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>⚡ Quick Load Presets for {holidayYear}</div>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
              <button onClick={()=>loadPresetHolidays('SA')} disabled={holidayLoading}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 18px', borderRadius:10, border:'2px solid #16a34a', background:'#f0fdf4', color:'#15803d', fontFamily:'inherit', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                🇿🇦 Load SA Public Holidays
              </button>
              <button onClick={()=>loadPresetHolidays('PH')} disabled={holidayLoading}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 18px', borderRadius:10, border:'2px solid #2563eb', background:'#eff6ff', color:'#1d4ed8', fontFamily:'inherit', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                🇵🇭 Load Philippine Public Holidays
              </button>
            </div>
            <p style={{ margin:'10px 0 0', fontSize:12, color:'var(--gray-400)' }}>Presets skip any dates already added. Edit or remove entries below.</p>
          </div>
          <div className="card" style={{ padding:20, marginBottom:20 }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>➕ Add Custom Holiday</div>
            <div style={{ display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap' }}>
              <div>
                <label style={{ fontSize:12, fontWeight:600, display:'block', marginBottom:4 }}>Date</label>
                <input type="date" value={newHoliday.date} onChange={e=>setNewHoliday(h=>({...h,date:e.target.value}))}
                  style={{ padding:'8px 12px', borderRadius:8, border:'1px solid var(--gray-300)', fontFamily:'inherit', fontSize:13 }}/>
              </div>
              <div style={{ flex:1, minWidth:200 }}>
                <label style={{ fontSize:12, fontWeight:600, display:'block', marginBottom:4 }}>Holiday Name</label>
                <input value={newHoliday.name} onChange={e=>setNewHoliday(h=>({...h,name:e.target.value}))}
                  placeholder="e.g. Company Anniversary"
                  style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:'1px solid var(--gray-300)', fontFamily:'inherit', fontSize:13 }}/>
              </div>
              <button onClick={addHoliday} disabled={!newHoliday.date||!newHoliday.name}
                className="btn btn-primary" style={{ whiteSpace:'nowrap' }}>Add Holiday</button>
            </div>
          </div>
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <div style={{ padding:'14px 20px', background:'#1a1a2e', color:'white', fontWeight:700, fontSize:13 }}>
              {holidays.length} Public Holiday{holidays.length!==1?'s':''} in {holidayYear}
            </div>
            {holidays.length === 0 ? (
              <div style={{ padding:40, textAlign:'center', color:'var(--gray-400)', fontSize:14 }}>
                No public holidays for {holidayYear}. Use presets above or add manually.
              </div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'var(--gray-50)', borderBottom:'1px solid var(--gray-200)' }}>
                    <th style={{ padding:'10px 16px', textAlign:'left', fontSize:12, fontWeight:700, color:'var(--gray-500)' }}>Date</th>
                    <th style={{ padding:'10px 16px', textAlign:'left', fontSize:12, fontWeight:700, color:'var(--gray-500)' }}>Day</th>
                    <th style={{ padding:'10px 16px', textAlign:'left', fontSize:12, fontWeight:700, color:'var(--gray-500)' }}>Name</th>
                    <th style={{ padding:'10px 16px', textAlign:'left', fontSize:12, fontWeight:700, color:'var(--gray-500)' }}>Region</th>
                    <th style={{ padding:'10px 16px', textAlign:'right', fontSize:12, fontWeight:700, color:'var(--gray-500)' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.map((h,i) => {
                    const d = new Date(h.date+'T12:00:00');
                    const isWeekend = [0,6].includes(d.getDay());
                    const locCode = h.location || 'SA';
                    const locLabel = locCode === 'SA' ? '🇿🇦 South Africa' : locCode === 'PH' ? '🇵🇭 Philippines' : locCode;
                    const locStyle = locCode === 'SA'
                      ? { background:'#f0fdf4', color:'#15803d' }
                      : locCode === 'PH'
                      ? { background:'#eff6ff', color:'#1d4ed8' }
                      : { background:'#f3f4f6', color:'#374151' };
                    return (
                      <tr key={h.id} style={{ borderBottom:'1px solid var(--gray-100)', background:i%2===0?'white':'var(--gray-50)' }}>
                        <td style={{ padding:'10px 16px', fontFamily:'DM Mono', fontSize:13, fontWeight:600 }}>{h.date}</td>
                        <td style={{ padding:'10px 16px', fontSize:13, color: isWeekend?'#d97706':'var(--gray-700)' }}>
                          {d.toLocaleDateString('en-ZA',{weekday:'long'})}
                          {isWeekend && <span style={{ marginLeft:6, fontSize:11, background:'#fffbeb', color:'#d97706', padding:'1px 6px', borderRadius:4, fontWeight:600 }}>Weekend</span>}
                        </td>
                        <td style={{ padding:'10px 16px', fontSize:13, fontWeight:500 }}>{h.name}</td>
                        <td style={{ padding:'10px 16px', fontSize:13 }}>
                          <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'2px 8px', borderRadius:6, fontSize:12, fontWeight:600, ...locStyle }}>{locLabel}</span>
                        </td>
                        <td style={{ padding:'10px 16px', textAlign:'right' }}>
                          <button onClick={()=>deleteHoliday(h.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#dc2626', fontSize:16 }}>🗑</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'breaks' && (
        <div>
          {/* Add break type */}
          <div className="card" style={{ padding:24, marginBottom:24 }}>
            <h3 style={{ fontWeight:700, marginBottom:16 }}>Add Break Type</h3>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'flex-end' }}>
              <div style={{ minWidth:40, position:'relative' }}>
                <label>Icon</label>
                <button onClick={()=>setShowEmojiPicker(s=>!s)} style={{ width:56,height:42,fontSize:24,background:'var(--gray-50)',border:'1px solid var(--gray-300)',borderRadius:8,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
                  {newBreak.icon}
                </button>
                {showEmojiPicker && (
                  <div style={{ position:'absolute',top:70,left:0,zIndex:100,background:'white',border:'1px solid var(--gray-200)',borderRadius:12,padding:12,boxShadow:'0 8px 24px rgba(0,0,0,0.15)',display:'grid',gridTemplateColumns:'repeat(8,1fr)',gap:4,width:280 }}>
                    {BREAK_EMOJIS.map(e=>(
                      <button key={e} onClick={()=>{ setNewBreak(b=>({...b,icon:e})); setShowEmojiPicker(false); }}
                        style={{ fontSize:20,padding:6,background:'none',border:'none',cursor:'pointer',borderRadius:6,transition:'background 0.1s' }}
                        onMouseOver={ev=>ev.target.style.background='var(--gray-100)'}
                        onMouseOut={ev=>ev.target.style.background='none'}>
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ flex:2, minWidth:140 }}>
                <label>Break Name</label>
                <input placeholder="e.g. Prayer Break" value={newBreak.name} onChange={e=>setNewBreak(b=>({...b,name:e.target.value}))}/>
              </div>
              <div style={{ minWidth:120 }}>
                <label>Colour</label>
                <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:4 }}>
                  {['#F59E0B','#8B5CF6','#06B6D4','#3B82F6','#10B981','#EF4444','#EC4899','#F97316'].map(c=>(
                    <button key={c} onClick={()=>setNewBreak(b=>({...b,color:c}))}
                      style={{ width:24,height:24,borderRadius:6,background:c,border:newBreak.color===c?'3px solid #000':'2px solid transparent',cursor:'pointer',padding:0 }}/>
                  ))}
                  <input type="color" value={newBreak.color} onChange={e=>setNewBreak(b=>({...b,color:e.target.value}))} style={{ width:32,height:32,padding:2,borderRadius:8,cursor:'pointer',border:'1px solid var(--gray-300)' }}/>
                </div>
              </div>
              <div style={{ minWidth:120 }}>
                <label>Max Duration (minutes)</label>
                <input type="number" placeholder="No limit" value={newBreak.max_minutes} onChange={e=>setNewBreak(b=>({...b,max_minutes:e.target.value}))} style={{ maxWidth:120 }}/>
              </div>
              <button className="btn btn-primary" onClick={async()=>{
                if(!newBreak.name) return;
                try {
                  await axios.post('/api/break-types', { ...newBreak, max_minutes: newBreak.max_minutes||null });
                  setNewBreak({ name:'', icon:'⏸️', color:'#6B7280', max_minutes:'' });
                  await fetchAll();
                  msg('Break type added!');
                } catch(e) {
                  alert('Error adding break type: ' + (e.response?.data?.error || e.message));
                }
              }}>+ Add</button>
            </div>
          </div>

          {/* Break types list */}
          <div className="card" style={{ overflow:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
              <thead><tr style={{ background:'var(--gray-50)', borderBottom:'2px solid var(--gray-200)' }}>
                {['Icon','Name','Colour','Max Duration','Status','Actions'].map(h=>(
                  <th key={h} style={{ padding:'12px 16px',textAlign:'left',fontSize:12,fontWeight:600,color:'var(--gray-500)',textTransform:'uppercase' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                { console.log('rendering breakTypes:', breakTypes?.length, breakTypes) }
                {(Array.isArray(breakTypes) && breakTypes.length===0) && <tr><td colSpan={6} style={{ padding:40,textAlign:'center',color:'var(--gray-400)' }}>No break types yet</td></tr>}
                {(Array.isArray(breakTypes) ? breakTypes : []).map(bt=>(
                  <tr key={bt.id} style={{ borderBottom:'1px solid var(--gray-100)' }}>
                    {editingBreak?.id === bt.id ? (
                      <>
                        <td style={{ padding:'8px 16px', position:'relative' }}>
                          <button onClick={()=>setShowEditEmojiPicker(s=>!s)} style={{ width:48,height:40,fontSize:22,background:'var(--gray-50)',border:'1px solid var(--gray-300)',borderRadius:8,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
                            {editingBreak.icon}
                          </button>
                          {showEditEmojiPicker && (
                            <div style={{ position:'absolute',top:48,left:0,zIndex:100,background:'white',border:'1px solid var(--gray-200)',borderRadius:12,padding:12,boxShadow:'0 8px 24px rgba(0,0,0,0.15)',display:'grid',gridTemplateColumns:'repeat(8,1fr)',gap:4,width:280 }}>
                              {BREAK_EMOJIS.map(e=>(
                                <button key={e} onClick={()=>{ setEditingBreak(b=>({...b,icon:e})); setShowEditEmojiPicker(false); }}
                                  style={{ fontSize:20,padding:6,background:'none',border:'none',cursor:'pointer',borderRadius:6 }}
                                  onMouseOver={ev=>ev.target.style.background='var(--gray-100)'}
                                  onMouseOut={ev=>ev.target.style.background='none'}>
                                  {e}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                        <td style={{ padding:'8px 16px' }}><input value={editingBreak.name} onChange={e=>setEditingBreak(b=>({...b,name:e.target.value}))} style={{ minWidth:120 }}/></td>
                        <td style={{ padding:'8px 16px' }}>
                          <div style={{ display:'flex',gap:5,alignItems:'center',flexWrap:'wrap' }}>
                            {['#F59E0B','#8B5CF6','#06B6D4','#3B82F6','#10B981','#EF4444','#EC4899','#F97316'].map(c=>(
                              <button key={c} onClick={()=>setEditingBreak(b=>({...b,color:c}))} style={{ width:22,height:22,borderRadius:5,background:c,border:editingBreak.color===c?'3px solid #000':'2px solid transparent',cursor:'pointer',padding:0 }}/>
                            ))}
                            <input type="color" value={editingBreak.color} onChange={e=>setEditingBreak(b=>({...b,color:e.target.value}))} style={{ width:28,height:28,padding:2,borderRadius:6,cursor:'pointer',border:'1px solid var(--gray-300)' }}/>
                          </div>
                        </td>
                        <td style={{ padding:'8px 16px' }}><input type="number" placeholder="No limit" value={editingBreak.max_minutes||''} onChange={e=>setEditingBreak(b=>({...b,max_minutes:e.target.value}))} style={{ width:90 }}/></td>
                        <td style={{ padding:'8px 16px' }}>
                          <span style={{ padding:'3px 10px',borderRadius:20,fontSize:12,fontWeight:600,background:bt.active?'#D1FAE5':'#F1F5F9',color:bt.active?'#065F46':'var(--gray-500)' }}>
                            {bt.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ padding:'8px 16px' }}>
                          <div style={{ display:'flex',gap:6 }}>
                            <button className="btn btn-primary btn-sm" onClick={async()=>{
                              await axios.put('/api/break-types/'+bt.id, { name:editingBreak.name, icon:editingBreak.icon, color:editingBreak.color, max_minutes:editingBreak.max_minutes||null, active:bt.active });
                              setEditingBreak(null); fetchAll(); msg('Saved!');
                            }}>Save</button>
                            <button className="btn btn-secondary btn-sm" onClick={()=>setEditingBreak(null)}>Cancel</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding:'12px 16px',fontSize:22 }}>{bt.icon}</td>
                        <td style={{ padding:'12px 16px',fontWeight:600 }}>{bt.name}</td>
                        <td style={{ padding:'12px 16px' }}>
                          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                            <div style={{ width:20,height:20,borderRadius:5,background:bt.color }}/>
                            <span style={{ fontFamily:'monospace',fontSize:12,color:'var(--gray-400)' }}>{bt.color}</span>
                          </div>
                        </td>
                        <td style={{ padding:'12px 16px',color:'var(--gray-500)',fontSize:13 }}>{bt.max_minutes ? bt.max_minutes+' min' : 'No limit'}</td>
                        <td style={{ padding:'12px 16px' }}>
                          <span style={{ padding:'3px 10px',borderRadius:20,fontSize:12,fontWeight:600,background:bt.active?'#D1FAE5':'#F1F5F9',color:bt.active?'#065F46':'var(--gray-500)' }}>
                            {bt.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ padding:'12px 16px' }}>
                          <div style={{ display:'flex',gap:6 }}>
                            <button className="btn btn-secondary btn-sm" onClick={()=>setEditingBreak({...bt, max_minutes:bt.max_minutes||''})}>Edit</button>
                            <button className="btn btn-secondary btn-sm" onClick={async()=>{
                              await axios.put('/api/break-types/'+bt.id, {...bt, active: bt.active?0:1});
                              fetchAll();
                            }}>{bt.active ? 'Deactivate' : 'Activate'}</button>
                            <button className="btn btn-danger btn-sm" onClick={async()=>{
                              if(!window.confirm('Remove this break type?')) return;
                              await axios.delete('/api/break-types/'+bt.id);
                              fetchAll();
                            }}>Remove</button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODULE VISIBILITY ── */}
      {tab === 'visibility' && (() => {
        const MODULES = [
          { key:'leave',         label:'Leave Tracker',              desc:'View and request leave' },
          { key:'payroll_export',label:'Payroll Export',             desc:'Download payroll-ready hours export' },
          { key:'manage_shifts', label:'Manage Shifts (assign/remove)', desc:'Assign and remove shifts for agents' },
          { key:'hours',         label:'Hours Tracker',              desc:'View tracked hours and OT' },
          { key:'browse_other_depts', label:'Browse Other Departments', desc:'Switch to view another department\'s schedule' },
        ];
        const saveVisibility = async (newVis) => {
          try {
            await axios.put('/api/theme', { dept_visibility: JSON.stringify(newVis) });
            setSaved('Visibility settings saved!');
            setTimeout(() => setSaved(''), 2500);
          } catch(e) { setSaved('Error saving'); setTimeout(() => setSaved(''), 2500); }
        };
        const toggle = (dept, key) => {
          setVisibility(prev => {
            const updated = {
              ...prev,
              [dept]: { ...(prev[dept] || {}), [key]: !(prev[dept]?.[key] ?? true) }
            };
            saveVisibility(updated);
            return updated;
          });
        };
        const getVal = (dept, key) => visibility[dept]?.[key] ?? true;
        const deptList = departments.length > 0 ? departments : [{ name:'CS' }, { name:'Sales' }];
        return (
          <div className="fade-in">
            <p style={{ color:'var(--gray-500)', fontSize:14, marginBottom:20 }}>
              Control which modules are visible per department. These settings affect all non-admin users in that department.
              PH agents are always excluded from payroll exports regardless of this setting.
            </p>
            {saved && <div style={{ background:'#d4edda', border:'1px solid #c3e6cb', borderRadius:8, padding:'10px 16px', marginBottom:16, color:'#155724', fontSize:14 }}>{saved}</div>}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))', gap:16 }}>
              {deptList.map(dept => (
                <div key={dept.name} className="card" style={{ padding:20 }}>
                  <div style={{ fontWeight:700, fontSize:15, marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ width:10, height:10, borderRadius:'50%', background: dept.color || 'var(--red)', display:'inline-block' }}/>
                    {dept.name}
                  </div>
                  {MODULES.map(mod => (
                    <div key={mod.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid var(--gray-100)' }}>
                      <div>
                        <div style={{ fontWeight:600, fontSize:13 }}>{mod.label}</div>
                        <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:2 }}>{mod.desc}</div>
                      </div>
                      <label style={{ position:'relative', display:'inline-block', width:40, height:22, flexShrink:0 }}>
                        <input type="checkbox" checked={getVal(dept.name, mod.key)} onChange={() => toggle(dept.name, mod.key)} style={{ opacity:0, width:0, height:0 }}/>
                        <span onClick={() => toggle(dept.name, mod.key)} style={{
                          position:'absolute', cursor:'pointer', top:0, left:0, right:0, bottom:0,
                          background: getVal(dept.name, mod.key) ? 'var(--red)' : '#CBD5E1',
                          borderRadius:22, transition:'.2s'
                        }}>
                          <span style={{
                            position:'absolute', content:'', height:16, width:16,
                            left: getVal(dept.name, mod.key) ? 21 : 3, bottom:3,
                            background:'white', borderRadius:'50%', transition:'.2s', display:'block'
                          }}/>
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ marginTop:20, padding:14, background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, fontSize:13, color:'#1e40af' }}>
              💡 <strong>PH agents</strong> — Payroll Export and Leave Tracker are always hidden for agents with location set to PH, regardless of department settings.
              Change an agent's location in <strong>User Management → Edit user</strong>.
            </div>

            {/* Dashboard widget visibility — moved here from Dashboard tab */}
            <div style={{ marginTop:24 }}>
              <div style={{ fontWeight:700, fontSize:14, marginBottom:4 }}>Live Availability Dashboard</div>
              <p style={{ fontSize:13, color:'var(--gray-500)', marginBottom:14 }}>
                Control which user types appear in the Live Availability dashboard's ONLINE / AWAY / OFFLINE columns.
              </p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:10 }}>
                {[
                  { key:'dash_show_agents', label:'Agents', desc:'Front-line staff who clock in and out', default:true },
                  { key:'dash_show_leaders', label:'Team Leaders', desc:'Supervisors managing teams', default:false },
                  { key:'dash_show_managers', label:'Managers', desc:'Department managers', default:false },
                ].map(item => {
                  const enabled = item.default
                    ? theme[item.key] !== false && theme[item.key] !== 'false'
                    : theme[item.key] === true || theme[item.key] === 'true';
                  return (
                    <div key={item.key} onClick={async () => {
                      const newVal = !enabled;
                      await axios.put('/api/theme', { [item.key]: newVal });
                      setTheme(t => ({ ...t, [item.key]: newVal }));
                    }} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 14px', borderRadius:10, cursor:'pointer',
                      background: enabled ? '#fef2f2' : 'var(--gray-50)', border: '1.5px solid ' + (enabled ? 'var(--red)' : 'var(--gray-200)') }}>
                      <div style={{ width:22, height:22, borderRadius:6, border:'2px solid ' + (enabled ? 'var(--red)' : 'var(--gray-300)'),
                        background: enabled ? 'var(--red)' : 'white', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {enabled && <span style={{ color:'white', fontSize:13, fontWeight:700 }}>&#10003;</span>}
                      </div>
                      <div>
                        <div style={{ fontWeight:600, fontSize:14 }}>{item.label}</div>
                        <div style={{ fontSize:12, color:'var(--gray-400)' }}>{item.desc}</div>
                      </div>
                      {item.default && <span style={{ marginLeft:'auto', fontSize:11, color:'var(--gray-400)', fontStyle:'italic' }}>default on</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── LOCATIONS ── */}
      {tab === 'locations' && (() => {
        const TIMEZONES = [
          { value:'Africa/Johannesburg', label:'Africa/Johannesburg (SAST, UTC+2)' },
          { value:'Asia/Manila',         label:'Asia/Manila (PHT, UTC+8)' },
          { value:'Europe/London',       label:'Europe/London (GMT/BST)' },
          { value:'America/New_York',    label:'America/New_York (EST/EDT)' },
          { value:'America/Chicago',     label:'America/Chicago (CST/CDT)' },
          { value:'America/Los_Angeles', label:'America/Los_Angeles (PST/PDT)' },
          { value:'Europe/Paris',        label:'Europe/Paris (CET/CEST)' },
          { value:'Asia/Dubai',          label:'Asia/Dubai (GST, UTC+4)' },
          { value:'Asia/Kolkata',        label:'Asia/Kolkata (IST, UTC+5:30)' },
          { value:'Australia/Sydney',    label:'Australia/Sydney (AEST)' },
          { value:'UTC',                 label:'UTC' },
        ];
        const handleAddLocation = async () => {
          if (!newLocation.code || !newLocation.name) return setLocationMsg({ text:'Code and name are required', type:'error' });
          try {
            await axios.post('/api/locations', newLocation);
            setNewLocation({ code:'', name:'', timezone:'Africa/Johannesburg' });
            fetchAll();
            setLocationMsg({ text:'Location added!', type:'success' });
            setTimeout(() => setLocationMsg({ text:'', type:'' }), 2500);
          } catch(e) {
            setLocationMsg({ text: e.response?.data?.error || 'Error adding location', type:'error' });
            setTimeout(() => setLocationMsg({ text:'', type:'' }), 3000);
          }
        };
        const handleSaveLocation = async () => {
          if (!editingLocation) return;
          try {
            await axios.put(`/api/locations/${editingLocation.id}`, { name: editingLocation.name, timezone: editingLocation.timezone });
            setEditingLocation(null);
            fetchAll();
            setLocationMsg({ text:'Location updated!', type:'success' });
            setTimeout(() => setLocationMsg({ text:'', type:'' }), 2000);
          } catch(e) {
            setLocationMsg({ text: e.response?.data?.error || 'Error saving', type:'error' });
          }
        };
        const handleDeleteLocation = async (id) => {
          if (!window.confirm('Remove this location? Users assigned to it will be defaulted to South Africa.')) return;
          try { await axios.delete(`/api/locations/${id}`); fetchAll(); setLocationMsg({ text:'Location removed', type:'success' }); setTimeout(() => setLocationMsg({ text:'', type:'' }), 2000); } catch(e) {}
        };
        return (
          <div className="fade-in">
            <p style={{ color:'var(--gray-500)', fontSize:14, marginBottom:20 }}>
              Manage locations used across the app. Each location has a short code, a display name, and a timezone.
              When a user is assigned a location, their timezone is set automatically.
            </p>
            {locationMsg.text && (<div style={{ background: locationMsg.type==='error'?'#fef2f2':'#d4edda', border:`1px solid ${locationMsg.type==='error'?'#fca5a5':'#c3e6cb'}`, borderRadius:8, padding:'10px 16px', marginBottom:16, color: locationMsg.type==='error'?'#dc2626':'#155724', fontSize:14 }}>{locationMsg.type==='error'?'❌ ':'✅ '}{locationMsg.text}</div>)}
            <div className="card" style={{ padding:20, marginBottom:20 }}>
              <div style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>Current Locations</div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
                <thead>
                  <tr style={{ background:'var(--gray-50)', borderBottom:'2px solid var(--gray-200)' }}>
                    {['Code','Name','Timezone','Users',''].map(h => (
                      <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:600, fontSize:12, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {locations.length === 0 && <tr><td colSpan={5} style={{ padding:30, textAlign:'center', color:'var(--gray-400)' }}>No locations yet</td></tr>}
                  {locations.map(loc => {
                    const userCount = allUsers.filter(u => (u.location || 'SA') === loc.code).length;
                    const isEditing = editingLocation?.id === loc.id;
                    return (
                      <tr key={loc.id} style={{ borderBottom:'1px solid var(--gray-100)', background: isEditing?'#fffbeb':'white' }}>
                        <td style={{ padding:'10px 14px' }}>
                          <span style={{ padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:700, background:'#EFF6FF', color:'#1D4ED8' }}>{loc.code}</span>
                        </td>
                        <td style={{ padding:'10px 14px', fontWeight:600 }}>
                          {isEditing
                            ? <input value={editingLocation.name} onChange={e=>setEditingLocation(p=>({...p,name:e.target.value}))} style={{ maxWidth:200, padding:'4px 8px' }}/>
                            : loc.name}
                        </td>
                        <td style={{ padding:'10px 14px', color:'var(--gray-500)', fontSize:13, fontFamily:'DM Mono' }}>
                          {isEditing
                            ? <select value={editingLocation.timezone} onChange={e=>setEditingLocation(p=>({...p,timezone:e.target.value}))} style={{ fontSize:12 }}>
                                {[
                                  'Africa/Johannesburg','Asia/Manila','Europe/London','America/New_York',
                                  'America/Chicago','America/Los_Angeles','Europe/Paris','Asia/Dubai',
                                  'Asia/Kolkata','Australia/Sydney','UTC'
                                ].map(tz=><option key={tz} value={tz}>{tz}</option>)}
                              </select>
                            : loc.timezone}
                        </td>
                        <td style={{ padding:'10px 14px', color:'var(--gray-500)', fontSize:13 }}>{userCount} user{userCount !== 1 ? 's' : ''}</td>
                        <td style={{ padding:'10px 14px' }}>
                          {isEditing
                            ? <div style={{ display:'flex', gap:6 }}>
                                <button onClick={handleSaveLocation} className="btn btn-success btn-sm">Save</button>
                                <button onClick={()=>setEditingLocation(null)} className="btn btn-secondary btn-sm">Cancel</button>
                              </div>
                            : <div style={{ display:'flex', gap:6 }}>
                                <button onClick={() => setEditingLocation({ id:loc.id, name:loc.name, timezone:loc.timezone })}
                                  style={{ padding:'4px 12px', borderRadius:6, border:'1px solid var(--gray-200)', background:'white', color:'var(--gray-600)', fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
                                  Edit
                                </button>
                                {loc.code !== 'SA' && (
                                  <button onClick={() => handleDeleteLocation(loc.id)}
                                    style={{ padding:'4px 12px', borderRadius:6, border:'1px solid #fca5a5', background:'#fef2f2', color:'#dc2626', fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
                                    Remove
                                  </button>
                                )}
                              </div>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="card" style={{ padding:20 }}>
              <div style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>Add New Location</div>
              <div style={{ display:'grid', gridTemplateColumns:'120px 1fr 1fr auto', gap:12, alignItems:'flex-end' }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'var(--gray-500)', display:'block', marginBottom:4 }}>Code *</label>
                  <input placeholder="SA, PH, UK…" value={newLocation.code} onChange={e => setNewLocation(p => ({ ...p, code: e.target.value.toUpperCase().slice(0,5) }))}
                    style={{ textTransform:'uppercase', fontFamily:'DM Mono', fontWeight:700, borderColor: !newLocation.code ? '#fca5a5' : undefined }}/>
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'var(--gray-500)', display:'block', marginBottom:4 }}>Name *</label>
                  <input placeholder="e.g. United Kingdom" value={newLocation.name} onChange={e => setNewLocation(p => ({ ...p, name: e.target.value }))}/>
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'var(--gray-500)', display:'block', marginBottom:4 }}>Timezone *</label>
                  <select value={newLocation.timezone} onChange={e => setNewLocation(p => ({ ...p, timezone: e.target.value }))}>
                    {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                  </select>
                </div>
                <button className="btn btn-primary" onClick={handleAddLocation}>Add</button>
              </div>
            </div>
          </div>
        );
      })()}

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

      {tab === 'bigquery' && (
        <div className="fade-in" style={{ maxWidth:600 }}>
          <div className="card" style={{ padding:32 }}>
            <h3 style={{ marginBottom:8 }}>📗 Google Sheets Sync</h3>
            <p style={{ color:'var(--gray-500)', fontSize:13, marginBottom:20, lineHeight:1.7 }}>
              Sync ShiftManager data to Google Sheets. New records are appended — existing data is never deleted. Auto-syncs every hour.
            </p>
            <div style={{ background:'#F0FDF4', border:'1px solid #A7F3D0', borderRadius:10, padding:14, marginBottom:16, fontSize:13 }}>
              <div style={{ fontWeight:700, color:'#065F46', marginBottom:6 }}>Tabs synced to your Sheet</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {['users','shifts','clock_logs','break_logs','departments'].map(t => (
                  <span key={t} style={{ background:'#D1FAE5', color:'#065F46', padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:600 }}>{t}</span>
                ))}
              </div>
            </div>
            <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:10, padding:14, marginBottom:24, fontSize:13, color:'#1D4ED8' }}>
              ⏰ Auto-syncs every hour
            </div>
            <button className="btn btn-primary" onClick={async (e) => {
              const btn = e.target;
              btn.disabled = true;
              btn.textContent = 'Syncing...';
              try {
                const r = await axios.post('/api/admin/sheets-sync');
                if (r.data.ok) {
                  const total = Object.values(r.data.tables||{}).reduce((s,t)=>s+(t.appended||0),0);
                  btn.textContent = '✅ Done in ' + r.data.duration + 's — ' + total + ' new rows added';
                } else {
                  const failed = Object.entries(r.data.tables||{}).filter(([,v])=>!v.ok).map(([k])=>k).join(', ');
                  btn.textContent = failed ? '⚠️ Failed: ' + failed : '❌ Sync failed';
                }
                setTimeout(() => { btn.disabled=false; btn.textContent='🔄 Sync Now'; }, 5000);
              } catch(e) {
                btn.textContent = '❌ ' + (e.response?.data?.error || e.message);
                setTimeout(() => { btn.disabled=false; btn.textContent='🔄 Sync Now'; }, 5000);
              }
            }}>
              🔄 Sync Now
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

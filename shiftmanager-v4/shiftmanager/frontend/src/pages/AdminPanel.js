import React, { useState, useEffect } from 'react';
import axios from 'axios';

const PERMISSION_LABELS = {
  view_availability: { label: 'View Availability Board', desc: 'See who is online/offline in real time' },
  view_all_departments: { label: 'View All Departments', desc: 'See agents across all departments, not just their own' },
  manage_shifts: { label: 'Manage Shifts', desc: 'Create, edit and delete shifts' },
  publish_shifts: { label: 'Publish Shifts', desc: 'Publish draft shifts so agents can see them' },
  view_clock_logs: { label: 'View Clock Logs', desc: 'Access the clock in/out history log' },
  view_own_logs_only: { label: 'Clock Logs — Own Team Only', desc: 'When enabled, only sees logs for assigned agents' },
  manage_users: { label: 'Manage Users', desc: 'Add, edit, deactivate user accounts' },
  manage_settings: { label: 'App Settings', desc: 'Change branding, departments and schedule defaults' },
  view_drafts: { label: 'View Draft Shifts', desc: 'See shifts that have not been published yet' },
  assign_team_leaders: { label: 'Assign Agents to Team Leaders', desc: 'Control which agents a team leader manages' },
};

const ROLES = [
  { key: 'manager', label: 'Manager', color: '#2980B9', desc: 'Senior staff who oversee teams and scheduling' },
  { key: 'team_leader', label: 'Team Leader', color: '#8E44AD', desc: 'Lead specific agents, limited admin access' },
  { key: 'agent', label: 'Agent', color: '#27AE60', desc: 'Front-line staff — clock in/out and view schedule' },
];

export default function AdminPanel() {
  const [permissions, setPermissions] = useState({});
  const [assignments, setAssignments] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [tab, setTab] = useState('permissions');
  const [saved, setSaved] = useState('');
  const [settings, setSettings] = useState({ company_name:'', location_label:'', primary_color:'#C0392B' });
  const [depts, setDepts] = useState([]);
  const [newDept, setNewDept] = useState({ name:'', color:'#333333', bg_color:'#F0F0F0' });
  const [editDept, setEditDept] = useState(null);

  const PRESET_COLORS = ['#C0392B','#2980B9','#27AE60','#8E44AD','#E67E22','#16A085','#2C3E50','#F39C12','#D35400','#E91E63'];

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const [pr, ar, ur, sr, dr] = await Promise.all([
      axios.get('/api/permissions'),
      axios.get('/api/team-leader-assignments'),
      axios.get('/api/users'),
      axios.get('/api/settings'),
      axios.get('/api/settings/departments'),
    ]);
    setPermissions(pr.data);
    setAssignments(ar.data);
    setAllUsers(ur.data);
    setSettings(s => ({ ...s, ...sr.data }));
    setDepts(dr.data);
  };

  const msg = (m) => { setSaved(m); setTimeout(() => setSaved(''), 3000); };

  const togglePerm = (role, perm) => {
    setPermissions(p => ({ ...p, [role]: { ...p[role], [perm]: !p[role]?.[perm] } }));
  };

  const savePerms = async (role) => {
    await axios.put(`/api/permissions/${role}`, permissions[role]);
    msg(`${ROLES.find(r=>r.key===role)?.label} permissions saved!`);
  };

  const assignAgent = async (leaderId, agentId) => {
    await axios.post('/api/team-leader-assignments', { leader_id: leaderId, agent_id: agentId });
    fetchAll();
  };

  const unassignAgent = async (leaderId, agentId) => {
    await axios.delete('/api/team-leader-assignments', { data: { leader_id: leaderId, agent_id: agentId } });
    fetchAll();
  };

  const saveSettings = async () => {
    await axios.put('/api/settings', settings);
    document.documentElement.style.setProperty('--red', settings.primary_color);
    msg('App settings saved!');
  };

  const addDept = async () => {
    if (!newDept.name.trim()) return;
    await axios.post('/api/settings/departments', newDept);
    setNewDept({ name:'', color:'#333333', bg_color:'#F0F0F0' });
    fetchAll(); msg('Department added!');
  };

  const updateDept = async (id) => {
    await axios.put(`/api/settings/departments/${id}`, editDept);
    setEditDept(null); fetchAll(); msg('Department updated!');
  };

  const deleteDept = async (id) => {
    if (!window.confirm('Remove this department?')) return;
    await axios.delete(`/api/settings/departments/${id}`);
    fetchAll();
  };

  const freeAgents = allUsers.filter(u => u.role === 'agent' && u.active !== 0);
  const leaders = allUsers.filter(u => u.role === 'team_leader' && u.active !== 0);
  const tabs = [
    { id:'permissions', label:'🔐 Role Permissions' },
    { id:'assignments', label:'👥 Team Leader Assignments' },
    { id:'branding', label:'🎨 Branding & Departments' },
  ];

  return (
    <div>
      <div style={{ background:'linear-gradient(135deg,#1a1a2e,#C0392B)', borderRadius:14, padding:'24px 28px', marginBottom:28, color:'white' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ fontSize:36 }}>🛡️</div>
          <div>
            <h1 style={{ fontSize:24, fontWeight:800, margin:0 }}>Account Admin Panel</h1>
            <p style={{ opacity:0.7, margin:0, fontSize:14 }}>Full control over roles, permissions, team assignments, and app configuration</p>
          </div>
        </div>
      </div>

      {saved && <div style={{ background:'#d4edda', border:'1px solid #c3e6cb', borderRadius:8, padding:'10px 16px', marginBottom:20, color:'#155724', fontSize:14 }}>✓ {saved}</div>}

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:28, borderBottom:'2px solid var(--gray-200)' }}>
        {tabs.map(t => <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:'10px 20px', border:'none', background:'none', cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:600, color:tab===t.id?'var(--red)':'var(--gray-500)', borderBottom:tab===t.id?'2px solid var(--red)':'2px solid transparent', marginBottom:-2 }}>{t.label}</button>)}
      </div>

      {/* ── PERMISSIONS TAB ── */}
      {tab === 'permissions' && (
        <div className="fade-in">
          <p style={{ color:'var(--gray-500)', fontSize:14, marginBottom:24 }}>
            Configure exactly what each role can see and do. Changes take effect immediately for all users of that role.
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20 }}>
            {ROLES.map(role => (
              <div key={role.key} className="card" style={{ padding:24, borderTop:`4px solid ${role.color}` }}>
                <div style={{ marginBottom:20 }}>
                  <div style={{ fontWeight:800, fontSize:16 }}>{role.label}</div>
                  <div style={{ fontSize:12, color:'var(--gray-500)', marginTop:3 }}>{role.desc}</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                  {Object.entries(PERMISSION_LABELS).map(([perm, info]) => {
                    const enabled = !!permissions[role.key]?.[perm];
                    return (
                      <div key={perm} onClick={() => togglePerm(role.key, perm)}
                        style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 10px', borderRadius:8, cursor:'pointer', background: enabled ? `${role.color}12` : 'transparent', border:`1px solid ${enabled?role.color+'40':'transparent'}`, transition:'all 0.15s', marginBottom:2 }}>
                        <div style={{ width:20, height:20, borderRadius:5, border:`2px solid ${enabled?role.color:'var(--gray-300)'}`, background:enabled?role.color:'white', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>
                          {enabled && <span style={{ color:'white', fontSize:12, fontWeight:700 }}>✓</span>}
                        </div>
                        <div>
                          <div style={{ fontSize:13, fontWeight:600, color: enabled?'var(--gray-900)':'var(--gray-500)' }}>{info.label}</div>
                          <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:1 }}>{info.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button className="btn btn-primary btn-sm" style={{ marginTop:16, width:'100%', justifyContent:'center', background:role.color, border:'none' }} onClick={() => savePerms(role.key)}>
                  Save {role.label} Permissions
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ASSIGNMENTS TAB ── */}
      {tab === 'assignments' && (
        <div className="fade-in">
          <p style={{ color:'var(--gray-500)', fontSize:14, marginBottom:24 }}>
            Assign specific agents to each Team Leader. Team Leaders can only manage and view their assigned agents.
          </p>
          {leaders.length === 0 && (
            <div className="card" style={{ padding:40, textAlign:'center', color:'var(--gray-400)' }}>
              No Team Leaders yet — go to Team Management and promote someone to Team Leader first.
            </div>
          )}
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            {assignments.map(leader => {
              const assignedIds = leader.agents.map(a => a.id);
              const available = freeAgents.filter(a => !assignedIds.includes(a.id));
              return (
                <div key={leader.id} className="card" style={{ padding:24 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
                    <div style={{ width:40, height:40, borderRadius:'50%', background:'#8E44AD', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:16 }}>{leader.name[0]}</div>
                    <div><div style={{ fontWeight:700, fontSize:15 }}>{leader.name}</div><div style={{ fontSize:12, color:'var(--gray-500)' }}>Team Leader</div></div>
                    <div style={{ marginLeft:'auto', fontSize:13, color:'var(--gray-500)' }}>{leader.agents.length} agent{leader.agents.length!==1?'s':''} assigned</div>
                  </div>

                  <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                    {/* Assigned agents */}
                    <div style={{ flex:1, minWidth:200 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 }}>Assigned Agents</div>
                      {leader.agents.length === 0 ? <div style={{ fontSize:13, color:'var(--gray-400)', padding:'8px 0' }}>No agents assigned yet</div>
                        : leader.agents.map(agent => (
                          <div key={agent.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 10px', background:'#f0fdf4', borderRadius:8, marginBottom:4, border:'1px solid #bbf7d0' }}>
                            <div style={{ width:26, height:26, borderRadius:'50%', background:'var(--green)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700 }}>{agent.name[0]}</div>
                            <span style={{ fontSize:13, fontWeight:500, flex:1 }}>{agent.name}</span>
                            <span style={{ fontSize:11, color:'var(--gray-400)' }}>{agent.department}</span>
                            <button onClick={() => unassignAgent(leader.id, agent.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', fontSize:16, padding:'0 4px' }}>×</button>
                          </div>
                        ))}
                    </div>

                    {/* Available to assign */}
                    {available.length > 0 && (
                      <div style={{ flex:1, minWidth:200 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 }}>Add Agent</div>
                        {available.map(agent => (
                          <div key={agent.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 10px', background:'var(--gray-50)', borderRadius:8, marginBottom:4, border:'1px solid var(--gray-200)', cursor:'pointer' }} onClick={() => assignAgent(leader.id, agent.id)}>
                            <div style={{ width:26, height:26, borderRadius:'50%', background:'var(--gray-300)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700 }}>{agent.name[0]}</div>
                            <span style={{ fontSize:13, fontWeight:500, flex:1 }}>{agent.name}</span>
                            <span style={{ fontSize:11, color:'var(--gray-400)' }}>{agent.department}</span>
                            <span style={{ fontSize:12, color:'var(--green)', fontWeight:700 }}>+ Assign</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── BRANDING TAB ── */}
      {tab === 'branding' && (
        <div className="fade-in" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, alignItems:'start' }}>
          <div className="card" style={{ padding:28 }}>
            <h2 style={{ fontSize:17, fontWeight:700, marginBottom:24 }}>App Branding</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
              <div><label>Company / App Name</label><input value={settings.company_name} onChange={e=>setSettings(s=>({...s,company_name:e.target.value}))} /></div>
              <div><label>Location Label</label><input value={settings.location_label} onChange={e=>setSettings(s=>({...s,location_label:e.target.value}))} /><p style={{ fontSize:12, color:'var(--gray-500)', marginTop:4 }}>Shown on the schedule header</p></div>
              <div>
                <label>Primary Brand Colour</label>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8, alignItems:'center' }}>
                  {PRESET_COLORS.map(c => <button key={c} onClick={()=>setSettings(s=>({...s,primary_color:c}))} style={{ width:34, height:34, borderRadius:8, background:c, border:'none', cursor:'pointer', outline:settings.primary_color===c?'3px solid #000':'none', outlineOffset:2, transform:settings.primary_color===c?'scale(1.2)':'scale(1)', transition:'all 0.15s' }} />)}
                  <input type="color" value={settings.primary_color} onChange={e=>setSettings(s=>({...s,primary_color:e.target.value}))} style={{ width:34, height:34, padding:2, borderRadius:8, cursor:'pointer' }} />
                </div>
                {/* Live preview */}
                <div style={{ marginTop:16, background:'#111827', borderRadius:10, padding:16 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                    <div style={{ width:32, height:32, borderRadius:8, background:settings.primary_color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15 }}>🏢</div>
                    <div><div style={{ color:'white', fontWeight:700, fontSize:13 }}>{settings.company_name||'ShiftManager'}</div><div style={{ color:'rgba(255,255,255,0.35)', fontSize:10 }}>{settings.location_label||'South Africa'}</div></div>
                  </div>
                  <div style={{ background:settings.primary_color, color:'white', padding:'6px 14px', borderRadius:6, display:'inline-block', fontSize:12, fontWeight:600 }}>Sample Button</div>
                </div>
              </div>
            </div>
            <button className="btn btn-primary" style={{ marginTop:20, width:'100%', justifyContent:'center' }} onClick={saveSettings}>Save Branding</button>
          </div>

          <div>
            <div className="card" style={{ padding:24, marginBottom:20 }}>
              <h3 style={{ fontWeight:700, marginBottom:16 }}>Add Department</h3>
              <div style={{ display:'flex', gap:10, alignItems:'flex-end', flexWrap:'wrap' }}>
                <div style={{ flex:1 }}><label>Name</label><input placeholder="e.g. Finance" value={newDept.name} onChange={e=>setNewDept(d=>({...d,name:e.target.value}))} /></div>
                <div><label>Text</label><input type="color" value={newDept.color} onChange={e=>setNewDept(d=>({...d,color:e.target.value}))} style={{ width:44, height:40, borderRadius:8, padding:2 }} /></div>
                <div><label>Background</label><input type="color" value={newDept.bg_color} onChange={e=>setNewDept(d=>({...d,bg_color:e.target.value}))} style={{ width:44, height:40, borderRadius:8, padding:2 }} /></div>
                <button className="btn btn-primary" onClick={addDept}>+ Add</button>
              </div>
            </div>

            <div className="card" style={{ overflow:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
                <thead><tr style={{ background:'var(--gray-50)', borderBottom:'2px solid var(--gray-200)' }}>
                  {['Department','Preview','Actions'].map(h=><th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {depts.map(d => {
                    const isEditing = editDept?.id === d.id;
                    return <tr key={d.id} style={{ borderBottom:'1px solid var(--gray-100)' }}>
                      <td style={{ padding:'10px 14px' }}>{isEditing ? <input value={editDept.name} onChange={e=>setEditDept(p=>({...p,name:e.target.value}))} style={{ maxWidth:140 }} /> : <span style={{ fontWeight:600 }}>{d.name}</span>}</td>
                      <td style={{ padding:'10px 14px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{ padding:'3px 10px', borderRadius:20, background:isEditing?editDept.bg_color:d.bg_color, color:isEditing?editDept.color:d.color, fontSize:12, fontWeight:700 }}>{isEditing?editDept.name:d.name}</span>
                          {isEditing && <><input type="color" value={editDept.color} onChange={e=>setEditDept(p=>({...p,color:e.target.value}))} style={{ width:30, height:30, borderRadius:6, padding:2 }} /><input type="color" value={editDept.bg_color} onChange={e=>setEditDept(p=>({...p,bg_color:e.target.value}))} style={{ width:30, height:30, borderRadius:6, padding:2 }} /></>}
                        </div>
                      </td>
                      <td style={{ padding:'10px 14px' }}>
                        {isEditing ? <div style={{ display:'flex', gap:6 }}>
                          <button className="btn btn-success btn-sm" onClick={()=>updateDept(d.id)}>Save</button>
                          <button className="btn btn-secondary btn-sm" onClick={()=>setEditDept(null)}>Cancel</button>
                        </div> : <div style={{ display:'flex', gap:6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={()=>setEditDept({...d})}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={()=>deleteDept(d.id)}>Remove</button>
                        </div>}
                      </td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

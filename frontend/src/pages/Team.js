import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function Team() {
  const { user: me, isAdmin, isManager } = useAuth();
  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState({ name:'', email:'', user_type:'agent', department:'CS', timezone:'Africa/Johannesburg', location:'SA', jobRoleId:'' });
  const [message, setMessage] = useState({ text:'', type:'success' });
  const [showInactive, setShowInactive] = useState(false);
  const [depts, setDepts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [jobRoles, setJobRoles] = useState([]);
  const [agentRoles, setAgentRoles] = useState({}); // { userId: [roleId, ...] }
  const [tempPasswordModal, setTempPasswordModal] = useState(null); // { name, tempPassword }

  const isTeamLeader = me?.user_type === 'team_leader';
  const [filterDept, setFilterDept] = useState('all');
  const [filterLocation, setFilterLocation] = useState('all');
  const [filterUserType, setFilterUserType] = useState('all');
  const [filterJobRole, setFilterJobRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('active');
  const [deactivateModal, setDeactivateModal] = useState(null); // { id, name }
  const [deactivateEndDate, setDeactivateEndDate] = useState('');

  const assignableRoles = () => {
    if (isAdmin || isManager) return [
      { value:'agent', label:'Agent' },
      { value:'team_leader', label:'Team Leader' },
      { value:'manager', label:'Manager' },
    ];
    return [
      { value:'agent', label:'Agent' },
      { value:'team_leader', label:'Team Leader' },
    ];
  };

  useEffect(() => { fetchUsers(); fetchDepts(); fetchLocations(); fetchJobRoles(); }, []);

  const fetchLocations = async () => {
    try { const r = await axios.get('/api/locations'); setLocations(Array.isArray(r.data) ? r.data : []); }
    catch { setLocations([{ code:'SA', name:'South Africa', timezone:'Africa/Johannesburg' }, { code:'PH', name:'Philippines', timezone:'Asia/Manila' }]); }
  };

  const fetchUsers = async () => {
    try {
      const r = await axios.get('/api/users');
      const userList = Array.isArray(r.data) ? r.data : [];
      setUsers(userList);
      // Pre-load roles for all agents
      userList.filter(u => u.user_type === 'agent').forEach(u => fetchAgentRoles(u.id));
    } catch(e) {
      msg('Failed to load users: ' + (e.response?.data?.error || e.message));
    }
  };
  const fetchDepts = async () => {
    try { const r = await axios.get('/api/departments'); setDepts(Array.isArray(r.data) ? r.data.map(d=>d.name).filter(n=>n!=='Trainees') : []); }
    catch { setDepts(['CS','Sales','Travel Agents','Management']); }
  };

  const fetchJobRoles = async () => {
    try {
      const r = await axios.get('/api/job-roles');
      setJobRoles(Array.isArray(r.data) ? r.data : []);
    } catch {}
  };

  const fetchAgentRoles = async (userId) => {
    try {
      const r = await axios.get(`/api/users/${userId}/job-roles`);
      const roleIds = Array.isArray(r.data) ? r.data.map(jr => jr.id) : [];
      setAgentRoles(prev => ({ ...prev, [userId]: roleIds }));
      return roleIds;
    } catch { return []; }
  };

  const handleToggleAgentRole = async (userId, roleId, currentRoles) => {
    const hasRole = currentRoles.includes(roleId);
    try {
      if (hasRole) {
        await axios.delete(`/api/job-roles/${roleId}/agents`, { data: { agent_id: userId } });
      } else {
        await axios.post(`/api/job-roles/${roleId}/agents`, { agent_id: userId });
        await axios.post(`/api/users/${userId}/set-onboarded`).catch(() => {});
      }
      await fetchAgentRoles(userId);
    } catch(e) { msg(e.response?.data?.error || 'Error updating role', 'error'); }
  };

  const msg = (text, type='success') => { setMessage({text,type}); setTimeout(()=>setMessage({text:'',type:'success'}),4000); };

  const handleAdd = async () => {
    if (!newUser.email || !newUser.name) return msg('Name and email are required','error');
    try {
      const r = await axios.post('/api/users', newUser);
      if (r.data.temp_password) {
        setTempPasswordModal({ name: newUser.name, email: newUser.email, tempPassword: r.data.temp_password, isNew: true });
      }
      // Assign job role if selected
      if (newUser.jobRoleId && r.data.id) {
        await axios.post(`/api/job-roles/${newUser.jobRoleId}/agents`, { agent_id: r.data.id }).catch(()=>{});
      }
      setShowAdd(false);
      setNewUser({ name:'', email:'', user_type:'agent', department:'CS', timezone:'Africa/Johannesburg', location:'SA', jobRoleId:'' });
      fetchUsers();
    } catch(e) { msg(e.response?.data?.error||'Error adding user','error'); }
  };

  const handleSave = async (user) => {
    try {
      const loc = user.location && user.location !== 'null' && user.location !== '' ? user.location : 'SA';
      // Look up timezone from locations list; fall back to stored timezone or SA default
      const locObj = locations.find(l => l.code === loc);
      const tz = locObj?.timezone || user.timezone || 'Africa/Johannesburg';
      await axios.put(`/api/users/${user.id}`, { user_type:user.user_type, department:user.department, name:user.name, timezone:tz, location:loc });
      setEditing(null); fetchUsers(); msg('User updated!');
    } catch(e) { msg(e.response?.data?.error||'Error','error'); }
  };

  const handleSetActive = async (id, active, endDate) => {
    try {
      await axios.post(`/api/users/${id}/set-active`, { active, end_date: endDate || null });
      fetchUsers(); msg(active ? 'User reactivated!' : 'User deactivated.');
    } catch(e) { msg(e.response?.data?.error||'Error','error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Permanently delete this user? This will be logged in the audit trail and cannot be undone.')) return;
    try {
      await axios.delete(`/api/users/${id}`);
      fetchUsers(); msg('User deleted and logged to audit trail.');
    } catch(e) { msg(e.response?.data?.error||'Error','error'); }
  };

  const handleResetPassword = async (user) => {
    if (!window.confirm(`Reset password for ${user.name}? They will receive a temporary password and be forced to create a new one on their next login.`)) return;
    try {
      const r = await axios.post(`/api/users/${user.id}/reset-password`);
      setTempPasswordModal({ name: user.name, email: user.email, tempPassword: r.data.temp_password, isNew: false });
    } catch(e) { msg(e.response?.data?.error||'Error resetting password','error'); }
  };

  const active = users.filter(u => u.active !== 0);
  const inactive = users.filter(u => u.active === 0);
  const allDisplayed = filterStatus === 'inactive' ? inactive : active;
  const displayed = allDisplayed.filter(u =>
    (filterDept === 'all' || u.department === filterDept) &&
    (filterLocation === 'all' || (u.location||'SA') === filterLocation) &&
    (filterUserType === 'all' || u.user_type === filterUserType) &&
    (filterJobRole === 'all' || (agentRoles[u.id]||[]).some(rId => String(rId)===String(filterJobRole)))
  );
  const roleColor = { manager:'#2980B9', team_leader:'#8E44AD', agent:'#27AE60' };

  const DeactivateModal = () => {
    const doDeactivate = async () => {
      await handleSetActive(deactivateModal.id, false, deactivateEndDate);
      setDeactivateModal(null);
      setDeactivateEndDate('');
    };
    return (
      <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000 }}>
        <div className="card fade-in" style={{ width:400,padding:32 }}>
          <h2 style={{ marginBottom:8 }}>Deactivate User</h2>
          <p style={{ color:'var(--gray-500)',fontSize:14,marginBottom:20 }}>
            Deactivating <strong>{deactivateModal?.name}</strong> will prevent them from logging in. Set an end date for hours tracking.
          </p>
          <div style={{ marginBottom:20 }}>
            <label>End Date <span style={{ color:'var(--gray-400)',fontSize:12,fontWeight:400 }}>(last day to track hours)</span></label>
            <input type="date" value={deactivateEndDate} onChange={e=>setDeactivateEndDate(e.target.value)} style={{ width:'100%' }}/>
          </div>
          <div style={{ display:'flex',gap:8 }}>
            <button className="btn btn-danger" onClick={doDeactivate}>Deactivate</button>
            <button className="btn btn-secondary" onClick={()=>{ setDeactivateModal(null); setDeactivateEndDate(''); }}>Cancel</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div><h1 style={{ margin:0 }}>User Management</h1><p style={{ color:'var(--gray-500)', marginTop:4 }}>Manage user accounts, roles and access</p></div>
        <button className="btn btn-primary" onClick={()=>setShowAdd(true)}>+ Add User</button>
      </div>

      {message.text && <div style={{ background:message.type==='error'?'#fef2f2':'#d4edda', border:`1px solid ${message.type==='error'?'#fca5a5':'#c3e6cb'}`, borderRadius:8, padding:'10px 16px', marginBottom:20, color:message.type==='error'?'#dc2626':'#155724', fontSize:14 }}>{message.text}</div>}

      {/* Temp Password Modal */}
      {tempPasswordModal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000 }}>
          <div className="card fade-in" style={{ width:440,padding:32,textAlign:'center' }}>
            <div style={{ fontSize:48,marginBottom:12 }}>{tempPasswordModal.isNew ? '✅' : '🔑'}</div>
            <h2 style={{ fontWeight:800,marginBottom:6 }}>{tempPasswordModal.isNew ? 'User Created!' : 'Password Reset'}</h2>
            <p style={{ color:'var(--gray-500)',fontSize:14,marginBottom:20 }}>
              {tempPasswordModal.isNew
                ? <>Share this temporary password with <strong>{tempPasswordModal.name}</strong>. They will be asked to create a new password on their first login.</>
                : <>Give this password to <strong>{tempPasswordModal.name}</strong>. They will be forced to create a new password on their next login.</>}
            </p>
            <div style={{ background:'#1a1a2e',borderRadius:12,padding:'16px 20px',marginBottom:20,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12 }}>
              <span style={{ fontFamily:'DM Mono',fontSize:22,fontWeight:700,color:'#22c55e',letterSpacing:2 }}>{tempPasswordModal.tempPassword}</span>
              <button onClick={()=>navigator.clipboard.writeText(tempPasswordModal.tempPassword)} style={{ padding:'6px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.1)',color:'white',fontSize:12,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap' }}>📋 Copy</button>
            </div>
            <div style={{ background:'#fffbeb',border:'1px solid #fcd34d',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#92400e',marginBottom:20,textAlign:'left' }}>
              ⚠️ Save this password now — it will not be shown again.
            </div>
            <button className="btn btn-primary" onClick={()=>setTempPasswordModal(null)} style={{ width:'100%',justifyContent:'center' }}>Done</button>
          </div>
        </div>
      )}

      {/* Role guide */}
      {(isAdmin||isManager) && (
        <div style={{ background:'#f0f9ff',border:'1px solid #bae6fd',borderRadius:10,padding:'14px 20px',marginBottom:20 }}>
          <div style={{ fontWeight:700,fontSize:13,marginBottom:8 }}>👥 User Type Guide</div>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:10,fontSize:13 }}>
            <div><strong style={{color:'#C0392B'}}>Account Admin</strong> — Full system control</div>
            <div><strong style={{color:'#2980B9'}}>Manager</strong> — Full team access, can assign Manager user type</div>
            <div><strong style={{color:'#8E44AD'}}>Team Leader</strong> — Can add agents, cannot assign Manager</div>
            <div><strong style={{color:'#27AE60'}}>Agent</strong> — Clock in/out, view own schedule</div>
          </div>
        </div>
      )}

      {/* Status tabs */}
      <div style={{ display:'flex',gap:8,marginBottom:12 }}>
        <button onClick={()=>setFilterStatus('active')} style={{ padding:'7px 18px',borderRadius:20,border:'none',background:filterStatus==='active'?'var(--red)':'var(--gray-200)',color:filterStatus==='active'?'white':'var(--gray-700)',fontFamily:'inherit',fontSize:13,fontWeight:600,cursor:'pointer' }}>Active ({active.length})</button>
        <button onClick={()=>setFilterStatus('inactive')} style={{ padding:'7px 18px',borderRadius:20,border:'none',background:filterStatus==='inactive'?'var(--red)':'var(--gray-200)',color:filterStatus==='inactive'?'white':'var(--gray-700)',fontFamily:'inherit',fontSize:13,fontWeight:600,cursor:'pointer' }}>Deactivated ({inactive.length})</button>
      </div>
      {/* Filter bar */}
      <div style={{ display:'flex',gap:8,flexWrap:'wrap',marginBottom:16,padding:'10px 14px',background:'var(--gray-50)',borderRadius:10,border:'1px solid var(--gray-200)' }}>
        <select value={filterDept} onChange={e=>setFilterDept(e.target.value)} style={{ padding:'5px 10px',borderRadius:7,border:'1px solid var(--gray-200)',fontSize:12,fontFamily:'inherit' }}>
          <option value="all">All Departments</option>
          {depts.map(d=><option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterLocation} onChange={e=>setFilterLocation(e.target.value)} style={{ padding:'5px 10px',borderRadius:7,border:'1px solid var(--gray-200)',fontSize:12,fontFamily:'inherit' }}>
          <option value="all">All Locations</option>
          {locations.map(l=><option key={l.code} value={l.code}>{l.name} ({l.code})</option>)}
        </select>
        <select value={filterUserType} onChange={e=>setFilterUserType(e.target.value)} style={{ padding:'5px 10px',borderRadius:7,border:'1px solid var(--gray-200)',fontSize:12,fontFamily:'inherit' }}>
          <option value="all">All User Types</option>
          <option value="account_admin">Account Admin</option>
          <option value="manager">Manager</option>
          <option value="team_leader">Team Leader</option>
          <option value="agent">Agent</option>
        </select>
        <select value={filterJobRole} onChange={e=>setFilterJobRole(e.target.value)} style={{ padding:'5px 10px',borderRadius:7,border:'1px solid var(--gray-200)',fontSize:12,fontFamily:'inherit' }}>
          <option value="all">All Job Roles</option>
          {jobRoles.map(jr=><option key={jr.id} value={jr.id}>{jr.name}</option>)}
        </select>
        {(filterDept!=='all'||filterLocation!=='all'||filterUserType!=='all'||filterJobRole!=='all') && (
          <button onClick={()=>{setFilterDept('all');setFilterLocation('all');setFilterUserType('all');setFilterJobRole('all');}} style={{ padding:'5px 12px',borderRadius:7,border:'1px solid var(--gray-200)',background:'white',fontSize:12,fontFamily:'inherit',cursor:'pointer',color:'var(--gray-600)' }}>✕ Clear</button>
        )}
        <span style={{ marginLeft:'auto',fontSize:12,color:'var(--gray-500)',alignSelf:'center' }}>{displayed.length} user{displayed.length!==1?'s':''}</span>
      </div>

      {/* Add User Modal */}
      {showAdd && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000 }}>
          <div className="card fade-in" style={{ width:460,padding:32 }}>
            <h2 style={{ marginBottom:20 }}>Add New User</h2>
            <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
              <div><label>Full Name *</label><input placeholder="e.g. Brandon Smith" value={newUser.name} onChange={e=>setNewUser(u=>({...u,name:e.target.value}))} /></div>
              <div><label>Email Address *</label><input placeholder="brandon@touraxis.com" value={newUser.email} onChange={e=>setNewUser(u=>({...u,email:e.target.value}))} /></div>
              <div><label>User Type</label>
                <select value={newUser.user_type} onChange={e=>setNewUser(u=>({...u,user_type:e.target.value}))}>
                  {assignableRoles().map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div><label>Department</label>
                <select value={newUser.department} onChange={e=>setNewUser(u=>({...u,department:e.target.value,jobRoleId:''}))}>
                  {depts.map(d=><option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div><label>Location</label>
                <select value={newUser.location||'SA'} onChange={e => {
                  const loc = locations.find(l => l.code === e.target.value);
                  setNewUser(u => ({ ...u, location: e.target.value, timezone: loc?.timezone || u.timezone }));
                }}>
                  {locations.length > 0
                    ? locations.map(l => <option key={l.code} value={l.code}>{l.name} ({l.code})</option>)
                    : <><option value="SA">South Africa (SA)</option><option value="PH">Philippines (PH)</option></>
                  }
                </select>
              </div>
              {newUser.user_type === 'agent' && (
                <div>
                  <label>Job Role <span style={{ fontWeight:400, color:'var(--gray-400)', fontSize:12 }}>(optional)</span></label>
                  <select value={newUser.jobRoleId||''} onChange={e=>setNewUser(u=>({...u,jobRoleId:e.target.value}))}>
                    <option value="">— No role assigned yet —</option>
                    {jobRoles.filter(jr => jr.department_name === newUser.department).map(jr => (
                      <option key={jr.id} value={jr.id}>{jr.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#1e40af' }}>
                💡 The user will be prompted to create their own password the first time they log in with this email address.
              </div>
              {isTeamLeader && <div style={{ background:'#fffbeb',border:'1px solid #fcd34d',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#92400e' }}>⚠️ As a Team Leader you can assign Agent or Team Leader roles only.</div>}
            </div>
            <div style={{ display:'flex',gap:10,marginTop:20 }}>
              <button className="btn btn-primary" onClick={handleAdd}>Add User</button>
              <button className="btn btn-secondary" onClick={()=>setShowAdd(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ overflow:'auto' }}>
        <table style={{ width:'100%',borderCollapse:'collapse',fontSize:14 }}>
          <thead><tr style={{ background:'var(--gray-50)',borderBottom:'2px solid var(--gray-200)' }}>
            {['User','Email','Department','Location','User Type','Job Roles','Status','Actions'].map(h=><th key={h} style={{ padding:'12px 16px',textAlign:'left',fontWeight:600,fontSize:12,color:'var(--gray-500)',textTransform:'uppercase',letterSpacing:0.5 }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {displayed.length===0 && <tr><td colSpan={6} style={{ padding:40,textAlign:'center',color:'var(--gray-400)' }}>No users found</td></tr>}
            {displayed.map(user => {
              const isEditing = editing?.id===user.id;
              const cur = isEditing ? editing : user;
              const currentRoles = agentRoles[user.id] || [];
              const deptRoles = jobRoles.filter(jr => jr.department_name === cur.department);
              return (
                <tr key={user.id} style={{ borderBottom:'1px solid var(--gray-100)',background:isEditing?'#fffbeb':'white',opacity:user.active===0?0.65:1 }}>
                  <td style={{ padding:'12px 16px' }}>
                    <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                    <div style={{ position:'relative', flexShrink:0 }}>
                      {user.avatar ? <img src={user.avatar} alt="" style={{ width:34,height:34,borderRadius:'50%',objectFit:'cover' }}/>
                        : <div style={{ width:34,height:34,borderRadius:'50%',background:roleColor[user.user_type]||'var(--gray-300)',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700 }}>{user.name?.trim()?.[0]?.toUpperCase()}</div>}
                      <label htmlFor={'avatar-'+user.id} title="Upload photo" style={{ position:'absolute',bottom:-2,right:-2,width:16,height:16,borderRadius:'50%',background:'white',border:'1px solid var(--gray-200)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,cursor:'pointer' }}>📷</label>
                      <input id={'avatar-'+user.id} type="file" accept="image/*" style={{ display:'none' }} onChange={async e => {
                        const file = e.target.files[0]; if (!file) return;
                        if (file.size > 500000) return msg('Please choose an image under 500KB', 'error');
                        const reader = new FileReader();
                        reader.onload = async ev => { try { await axios.post('/api/users/'+user.id+'/avatar', { avatar: ev.target.result }); fetchUsers(); } catch(err) { msg(err.response?.data?.error||'Upload failed','error'); } };
                        reader.readAsDataURL(file); e.target.value='';
                      }}/>
                    </div>
                      {isEditing ? <input value={editing.name} onChange={e=>setEditing(p=>({...p,name:e.target.value}))} style={{ maxWidth:160 }}/>
                        : <span style={{ fontWeight:600 }}>{user.name}</span>}
                    </div>
                  </td>
                  <td style={{ padding:'12px 16px',color:'var(--gray-500)',fontSize:13 }}>{user.email}</td>
                  <td style={{ padding:'12px 16px' }}>
                    {isEditing ? <select value={cur.department} onChange={e=>setEditing(p=>({...p,department:e.target.value}))} style={{ maxWidth:160 }}>
                      {depts.map(d=><option key={d} value={d}>{d}</option>)}
                    </select> : <span style={{ padding:'3px 10px',borderRadius:20,fontSize:12,fontWeight:600,background:'var(--gray-100)' }}>{user.department}</span>}
                  </td>
                  <td style={{ padding:'12px 16px' }}>
                    {isEditing
                      ? <select value={cur.location||'SA'} onChange={e => {
                          const loc = locations.find(l => l.code === e.target.value);
                          setEditing(p => ({ ...p, location: e.target.value, timezone: loc?.timezone || p.timezone }));
                        }} style={{ maxWidth:140 }}>
                          {locations.length > 0
                            ? locations.map(l => <option key={l.code} value={l.code}>{l.name} ({l.code})</option>)
                            : <><option value="SA">South Africa (SA)</option><option value="PH">Philippines (PH)</option></>
                          }
                        </select>
                      : (() => { const locObj = locations.find(l=>l.code===(user.location||'SA')); const isSA=(user.location||'SA')==='SA'; return <span style={{ padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:700, background:isSA?'#ECFDF5':'#EFF6FF', color:isSA?'#065F46':'#1D4ED8' }}>{locObj?.name||user.location||'SA'}</span>; })()
                    }
                  </td>
                  <td style={{ padding:'12px 16px' }}>
                    {isEditing ? <select value={cur.user_type} onChange={e=>setEditing(p=>({...p,user_type:e.target.value}))} style={{ maxWidth:140 }}>
                      {assignableRoles().map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
                    </select> : <span style={{ fontWeight:600,fontSize:13,color:roleColor[user.user_type]||'var(--gray-600)',textTransform:'capitalize' }}>{user.user_type?.replace('_',' ')}</span>}
                  </td>
                  <td style={{ padding:'8px 16px', maxWidth:220 }}>
                    {cur.user_type === 'agent' ? (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                        {isEditing ? (
                          deptRoles.length === 0
                            ? <span style={{ fontSize:11,color:'var(--gray-400)' }}>No roles in {cur.department}</span>
                            : deptRoles.map(jr => {
                                const assigned = currentRoles.includes(jr.id);
                                return (
                                  <button key={jr.id} onClick={() => handleToggleAgentRole(user.id, jr.id, currentRoles)}
                                    style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', border:`1.5px solid ${assigned?'var(--red)':'var(--gray-300)'}`, background:assigned?'#fef2f2':'white', color:assigned?'var(--red)':'var(--gray-500)' }}>
                                    {assigned ? '✓ ' : '+ '}{jr.name}
                                  </button>
                                );
                              })
                        ) : (
                          currentRoles.length === 0
                            ? <span style={{ fontSize:11,color:'var(--gray-400)' }}>—</span>
                            : jobRoles.filter(jr => currentRoles.includes(jr.id)).map(jr => (
                                <span key={jr.id} style={{ padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:600,background:'#fef2f2',color:'var(--red)',border:'1px solid #fecaca' }}>{jr.name}</span>
                              ))
                        )}
                      </div>
                    ) : <span style={{ fontSize:11,color:'var(--gray-300)' }}>—</span>}
                  </td>
                  <td style={{ padding:'12px 16px' }}>
                    <span style={{ display:'flex',alignItems:'center',gap:6,fontSize:13,fontWeight:600,color:user.active!==0?'#16a34a':'#94a3b8' }}>
                      <span style={{ width:8,height:8,borderRadius:'50%',background:user.active!==0?'#22c55e':'#94a3b8',display:'inline-block' }}/>
                      {user.active!==0?'Active':'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding:'12px 16px' }}>
                    {isEditing ? (
                      <div style={{ display:'flex',gap:6 }}>
                        <button className="btn btn-success btn-sm" onClick={()=>handleSave(editing)}>Save</button>
                        <button className="btn btn-secondary btn-sm" onClick={()=>setEditing(null)}>Cancel</button>
                      </div>
                    ) : (
                      <div style={{ display:'flex',gap:5,flexWrap:'wrap' }}>
                        <button className="btn btn-secondary btn-sm" onClick={()=>{ setEditing({...user}); fetchAgentRoles(user.id); }}>Edit</button>
                        <button className="btn btn-secondary btn-sm" onClick={()=>handleResetPassword(user)} title="Reset password">🔑 Reset</button>
                        {user.active!==0
                          ? <button className="btn btn-warning btn-sm" onClick={()=>{ const today=new Date().toISOString().slice(0,10); setDeactivateEndDate(today); setDeactivateModal({id:user.id,name:user.name}); }}>Deactivate</button>
                          : <button className="btn btn-success btn-sm" onClick={()=>handleSetActive(user.id,true)}>Activate</button>}
                        {isAdmin && <button className="btn btn-danger btn-sm" onClick={()=>handleDelete(user.id)}>Delete</button>}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
    {deactivateModal && <DeactivateModal/>}
    </>
  );
}

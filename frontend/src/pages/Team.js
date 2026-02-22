import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function Team() {
  const { user: me, isAdmin, isManager } = useAuth();
  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState({ name:'', email:'', user_type:'agent', department:'CS' });
  const [message, setMessage] = useState({ text:'', type:'success' });
  const [showInactive, setShowInactive] = useState(false);
  const [depts, setDepts] = useState([]);
  const [tempPasswordModal, setTempPasswordModal] = useState(null); // { name, tempPassword }

  const isTeamLeader = me?.user_type === 'team_leader';

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

  useEffect(() => { fetchUsers(); fetchDepts(); }, []);

  const fetchUsers = async () => { const r = await axios.get('/api/users'); setUsers(r.data); };
  const fetchDepts = async () => {
    try { const r = await axios.get('/api/settings/departments'); setDepts(r.data.map(d=>d.name)); }
    catch { setDepts(['CS','Sales','Travel Agents','Trainees','Management']); }
  };

  const msg = (text, type='success') => { setMessage({text,type}); setTimeout(()=>setMessage({text:'',type:'success'}),4000); };

  const handleAdd = async () => {
    if (!newUser.email || !newUser.name) return msg('Name and email are required','error');
    try {
      await axios.post('/api/users', newUser);
      setShowAdd(false);
      setNewUser({ name:'', email:'', user_type:'agent', department:'CS' });
      fetchUsers();
      msg('User added! They can now log in and will be prompted to create their password on first login.');
    } catch(e) { msg(e.response?.data?.error||'Error adding user','error'); }
  };

  const handleSave = async (user) => {
    try {
      await axios.put(`/api/users/${user.id}`, { user_type:user.user_type, department:user.department, name:user.name });
      setEditing(null); fetchUsers(); msg('User updated!');
    } catch(e) { msg(e.response?.data?.error||'Error','error'); }
  };

  const handleSetActive = async (id, active) => {
    if (!active && !window.confirm('Deactivate this user? They will not be able to log in.')) return;
    try {
      await axios.post(`/api/users/${id}/set-active`, { active });
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
      setTempPasswordModal({ name: user.name, email: user.email, tempPassword: r.data.tempPassword });
      msg(`Password reset for ${user.name}`);
    } catch(e) { msg(e.response?.data?.error||'Error resetting password','error'); }
  };

  const active = users.filter(u => u.active !== 0);
  const inactive = users.filter(u => u.active === 0);
  const displayed = showInactive ? inactive : active;
  const roleColor = { manager:'#2980B9', team_leader:'#8E44AD', agent:'#27AE60' };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div><h1 style={{ margin:0 }}>Team Management</h1><p style={{ color:'var(--gray-500)', marginTop:4 }}>Manage user accounts, roles and access</p></div>
        <button className="btn btn-primary" onClick={()=>setShowAdd(true)}>+ Add User</button>
      </div>

      {message.text && <div style={{ background:message.type==='error'?'#fef2f2':'#d4edda', border:`1px solid ${message.type==='error'?'#fca5a5':'#c3e6cb'}`, borderRadius:8, padding:'10px 16px', marginBottom:20, color:message.type==='error'?'#dc2626':'#155724', fontSize:14 }}>{message.text}</div>}

      {/* Temp Password Modal */}
      {tempPasswordModal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000 }}>
          <div className="card fade-in" style={{ width:440,padding:32,textAlign:'center' }}>
            <div style={{ fontSize:48,marginBottom:12 }}>🔑</div>
            <h2 style={{ fontWeight:800,marginBottom:6 }}>Temporary Password</h2>
            <p style={{ color:'var(--gray-500)',fontSize:14,marginBottom:20 }}>Give this password to <strong>{tempPasswordModal.name}</strong> ({tempPasswordModal.email}). They will be forced to create a new password when they log in.</p>
            <div style={{ background:'#1a1a2e',borderRadius:12,padding:'16px 20px',marginBottom:20,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12 }}>
              <span style={{ fontFamily:'DM Mono',fontSize:22,fontWeight:700,color:'#22c55e',letterSpacing:2 }}>{tempPasswordModal.tempPassword}</span>
              <button onClick={()=>navigator.clipboard.writeText(tempPasswordModal.tempPassword)} style={{ padding:'6px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.1)',color:'white',fontSize:12,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap' }}>Copy</button>
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

      <div style={{ display:'flex',gap:8,marginBottom:16 }}>
        <button onClick={()=>setShowInactive(false)} style={{ padding:'7px 18px',borderRadius:20,border:'none',background:!showInactive?'var(--red)':'var(--gray-200)',color:!showInactive?'white':'var(--gray-700)',fontFamily:'inherit',fontSize:13,fontWeight:600,cursor:'pointer' }}>Active ({active.length})</button>
        <button onClick={()=>setShowInactive(true)} style={{ padding:'7px 18px',borderRadius:20,border:'none',background:showInactive?'var(--red)':'var(--gray-200)',color:showInactive?'white':'var(--gray-700)',fontFamily:'inherit',fontSize:13,fontWeight:600,cursor:'pointer' }}>Deactivated ({inactive.length})</button>
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
                <select value={newUser.department} onChange={e=>setNewUser(u=>({...u,department:e.target.value}))}>
                  {depts.map(d=><option key={d} value={d}>{d}</option>)}
                </select>
              </div>
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
            {['User','Email','Department','User Type','Status','Actions'].map(h=><th key={h} style={{ padding:'12px 16px',textAlign:'left',fontWeight:600,fontSize:12,color:'var(--gray-500)',textTransform:'uppercase',letterSpacing:0.5 }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {displayed.length===0 && <tr><td colSpan={6} style={{ padding:40,textAlign:'center',color:'var(--gray-400)' }}>No users found</td></tr>}
            {displayed.map(user => {
              const isEditing = editing?.id===user.id;
              const cur = isEditing ? editing : user;
              return (
                <tr key={user.id} style={{ borderBottom:'1px solid var(--gray-100)',background:isEditing?'#fffbeb':'white',opacity:user.active===0?0.65:1 }}>
                  <td style={{ padding:'12px 16px' }}>
                    <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                      {user.avatar ? <img src={user.avatar} alt="" style={{ width:34,height:34,borderRadius:'50%' }}/>
                        : <div style={{ width:34,height:34,borderRadius:'50%',background:roleColor[user.user_type]||'var(--gray-300)',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700 }}>{user.name?.[0]}</div>}
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
                    {isEditing ? <select value={cur.user_type} onChange={e=>setEditing(p=>({...p,user_type:e.target.value}))} style={{ maxWidth:140 }}>
                      {assignableRoles().map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
                    </select> : <span style={{ fontWeight:600,fontSize:13,color:roleColor[user.user_type]||'var(--gray-600)',textTransform:'capitalize' }}>{user.user_type?.replace('_',' ')}</span>}
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
                        <button className="btn btn-secondary btn-sm" onClick={()=>setEditing({...user})}>Edit</button>
                        <button className="btn btn-secondary btn-sm" onClick={()=>handleResetPassword(user)} title="Reset password">🔑 Reset</button>
                        {user.active!==0
                          ? <button className="btn btn-warning btn-sm" onClick={()=>handleSetActive(user.id,false)}>Deactivate</button>
                          : <button className="btn btn-success btn-sm" onClick={()=>handleSetActive(user.id,true)}>Activate</button>}
                        {(isAdmin||isManager) && <button className="btn btn-danger btn-sm" onClick={()=>handleDelete(user.id)}>Delete</button>}
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
  );
}

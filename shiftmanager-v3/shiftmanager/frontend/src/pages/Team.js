import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const DEPARTMENTS = ['CS','Sales','Travel Agents','Trainees','Management'];
const ROLES = [
  { value:'agent', label:'Agent', desc:'Clock in/out, view own schedule' },
  { value:'team_leader', label:'Team Leader', desc:'View team logs, manage shifts for their dept' },
  { value:'manager', label:'Manager', desc:'Full access to everything' },
];

export default function Team() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState({ name:'', email:'', role:'agent', department:'CS' });
  const [message, setMessage] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [depts, setDepts] = useState([]);

  useEffect(() => { fetchUsers(); fetchDepts(); }, []);

  const fetchUsers = async () => { const r = await axios.get('/api/users'); setUsers(r.data); };
  const fetchDepts = async () => { try { const r = await axios.get('/api/settings/departments'); setDepts(r.data.map(d=>d.name)); } catch { setDepts(DEPARTMENTS); } };

  const msg = (m) => { setMessage(m); setTimeout(() => setMessage(''), 4000); };

  const handleAdd = async () => {
    if (!newUser.email || !newUser.name) return msg('Name and email are required');
    try {
      await axios.post('/api/users', newUser);
      setShowAdd(false); setNewUser({ name:'', email:'', role:'agent', department:'CS' });
      fetchUsers(); msg('User added! They can log in with demo mode using their email.');
    } catch(e) { msg(e.response?.data?.error || 'Error adding user'); }
  };

  const handleSave = async (user) => {
    await axios.put(`/api/users/${user.id}`, { role:user.role, department:user.department, name:user.name, active:user.active });
    setEditing(null); fetchUsers(); msg('User updated!');
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm('Deactivate this user? They will no longer be able to log in.')) return;
    await axios.delete(`/api/users/${id}`);
    fetchUsers(); msg('User deactivated.');
  };

  const handleActivate = async (id) => {
    await axios.post(`/api/users/${id}/activate`);
    fetchUsers(); msg('User reactivated!');
  };

  const active = users.filter(u => u.active !== 0);
  const inactive = users.filter(u => u.active === 0);
  const displayed = showInactive ? inactive : active;

  return (
    <div>
      <div className="page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div><h1>Team Management</h1><p>Add, remove, and manage roles for all team members</p></div>
        {me?.role === 'manager' && <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add User</button>}
      </div>

      {message && <div style={{ background:'#d4edda', border:'1px solid #c3e6cb', borderRadius:8, padding:'10px 16px', marginBottom:20, color:'#155724', fontSize:14 }}>✓ {message}</div>}

      {/* Role permissions info */}
      <div className="card" style={{ padding:20, marginBottom:24, background:'#f0f9ff', border:'1px solid #bae6fd' }}>
        <div style={{ fontWeight:700, marginBottom:12, fontSize:14 }}>👥 Role Permissions</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
          {ROLES.map(r => <div key={r.value} style={{ padding:'10px 14px', background:'white', borderRadius:8, border:'1px solid #e0f2fe' }}>
            <div style={{ fontWeight:700, fontSize:13, marginBottom:4 }}>{r.label}</div>
            <div style={{ fontSize:12, color:'var(--gray-500)' }}>{r.desc}</div>
          </div>)}
        </div>
      </div>

      {/* Toggle active/inactive */}
      <div style={{ display:'flex', gap:10, marginBottom:16 }}>
        <button className="btn btn-sm" onClick={() => setShowInactive(false)} style={{ background: !showInactive ? 'var(--red)' : 'var(--gray-200)', color: !showInactive ? 'white' : 'var(--gray-700)', border:'none' }}>Active ({active.length})</button>
        <button className="btn btn-sm" onClick={() => setShowInactive(true)} style={{ background: showInactive ? 'var(--red)' : 'var(--gray-200)', color: showInactive ? 'white' : 'var(--gray-700)', border:'none' }}>Deactivated ({inactive.length})</button>
      </div>

      {/* Add User Modal */}
      {showAdd && <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
        <div className="card fade-in" style={{ width:460, padding:32 }}>
          <h2 style={{ marginBottom:24, fontSize:20 }}>Add New User</h2>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div><label>Full Name *</label><input placeholder="e.g. Brandon Smith" value={newUser.name} onChange={e=>setNewUser(u=>({...u,name:e.target.value}))} /></div>
            <div><label>Email Address *</label><input placeholder="brandon@company.com" value={newUser.email} onChange={e=>setNewUser(u=>({...u,email:e.target.value}))} /></div>
            <div><label>Role</label>
              <select value={newUser.role} onChange={e=>setNewUser(u=>({...u,role:e.target.value}))}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select></div>
            <div><label>Department</label>
              <select value={newUser.department} onChange={e=>setNewUser(u=>({...u,department:e.target.value}))}>
                {depts.map(d => <option key={d} value={d}>{d}</option>)}
              </select></div>
            <div style={{ background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:8, padding:'10px 14px', fontSize:12 }}>
              💡 The user will log in using <strong>Demo Mode</strong> with this email address, or via Google if their Gmail matches.
            </div>
          </div>
          <div style={{ display:'flex', gap:10, marginTop:20 }}>
            <button className="btn btn-primary" onClick={handleAdd}>Add User</button>
            <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      </div>}

      {/* Users table */}
      <div className="card" style={{ overflow:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
          <thead><tr style={{ background:'var(--gray-50)', borderBottom:'2px solid var(--gray-200)' }}>
            {['User','Email','Department','Role','Status','Actions'].map(h => <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontWeight:600, fontSize:12, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:0.5 }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {displayed.length === 0 && <tr><td colSpan={6} style={{ padding:40, textAlign:'center', color:'var(--gray-400)' }}>No users found</td></tr>}
            {displayed.map(user => {
              const isEditing = editing?.id === user.id;
              const cur = isEditing ? editing : user;
              return <tr key={user.id} style={{ borderBottom:'1px solid var(--gray-100)', background: isEditing ? '#fffbeb' : 'white', opacity: user.active === 0 ? 0.6 : 1 }}>
                <td style={{ padding:'12px 16px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    {user.avatar ? <img src={user.avatar} alt="" style={{ width:34, height:34, borderRadius:'50%' }} />
                      : <div style={{ width:34, height:34, borderRadius:'50%', background:'var(--red)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>{user.name?.[0]}</div>}
                    {isEditing ? <input value={editing.name} onChange={e=>setEditing(p=>({...p,name:e.target.value}))} style={{ maxWidth:160 }} /> : <span style={{ fontWeight:600 }}>{user.name}</span>}
                  </div>
                </td>
                <td style={{ padding:'12px 16px', color:'var(--gray-500)', fontSize:13 }}>{user.email}</td>
                <td style={{ padding:'12px 16px' }}>
                  {isEditing ? <select value={cur.department} onChange={e=>setEditing(p=>({...p,department:e.target.value}))} style={{ maxWidth:160 }}>
                    {depts.map(d => <option key={d} value={d}>{d}</option>)}
                  </select> : <span className={`badge dept-${user.department?.replace(' ','')}`}>{user.department||'—'}</span>}
                </td>
                <td style={{ padding:'12px 16px' }}>
                  {isEditing ? <select value={cur.role} onChange={e=>setEditing(p=>({...p,role:e.target.value}))} style={{ maxWidth:140 }}>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select> : <span style={{ textTransform:'capitalize', fontWeight:500 }}>{user.role?.replace('_',' ')}</span>}
                </td>
                <td style={{ padding:'12px 16px' }}>
                  <span className={`badge badge-${user.active !== 0 ? 'available' : 'offline'}`}>
                    <span className={`status-dot ${user.active !== 0 ? 'available' : 'offline'}`} />
                    {user.active !== 0 ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding:'12px 16px' }}>
                  {me?.role === 'manager' && (isEditing
                    ? <div style={{ display:'flex', gap:6 }}>
                        <button className="btn btn-success btn-sm" onClick={() => handleSave(editing)}>Save</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                      </div>
                    : <div style={{ display:'flex', gap:6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditing({...user})}>Edit</button>
                        {user.active !== 0
                          ? <button className="btn btn-danger btn-sm" onClick={() => handleDeactivate(user.id)}>Deactivate</button>
                          : <button className="btn btn-success btn-sm" onClick={() => handleActivate(user.id)}>Reactivate</button>}
                      </div>
                  )}
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

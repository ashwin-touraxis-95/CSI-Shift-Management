import React, { useState, useEffect } from 'react';
import axios from 'axios';

const DEPARTMENTS = ['CS', 'Sales', 'Travel Agents', 'Trainees', 'Management'];

export default function Team() {
  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    const res = await axios.get('/api/users');
    setUsers(res.data);
  };

  const handleSave = async (user) => {
    await axios.put(`/api/users/${user.id}`, { role: user.role, department: user.department });
    setEditing(null);
    setMessage('User updated!');
    fetchUsers();
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div>
      <div className="page-header">
        <h1>Team Management</h1>
        <p>Manage roles and departments for all team members</p>
      </div>

      {message && (
        <div style={{ background: '#d4edda', border: '1px solid #c3e6cb', borderRadius: 8, padding: '10px 16px', marginBottom: 20, color: '#155724', fontSize: 14 }}>
          ✓ {message}
        </div>
      )}

      <div className="card" style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: 'var(--gray-50)', borderBottom: '2px solid var(--gray-200)' }}>
              {['Agent', 'Email', 'Department', 'Role', 'Actions'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(user => {
              const isEditing = editing?.id === user.id;
              const current = isEditing ? editing : user;
              return (
                <tr key={user.id} style={{ borderBottom: '1px solid var(--gray-100)', background: isEditing ? '#fffbeb' : 'white' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {user.avatar
                        ? <img src={user.avatar} alt="" style={{ width: 36, height: 36, borderRadius: '50%' }} />
                        : <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--red)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                            {user.name?.[0]}
                          </div>
                      }
                      <span style={{ fontWeight: 600 }}>{user.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--gray-500)', fontSize: 13 }}>{user.email}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {isEditing ? (
                      <select value={current.department} onChange={e => setEditing(prev => ({ ...prev, department: e.target.value }))} style={{ maxWidth: 180 }}>
                        {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    ) : (
                      <span className={`badge dept-${user.department?.replace(' ', '')}`}>{user.department || '—'}</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {isEditing ? (
                      <select value={current.role} onChange={e => setEditing(prev => ({ ...prev, role: e.target.value }))} style={{ maxWidth: 140 }}>
                        <option value="agent">Agent</option>
                        <option value="manager">Manager</option>
                      </select>
                    ) : (
                      <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{user.role}</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-success btn-sm" onClick={() => handleSave(editing)}>Save</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                      </div>
                    ) : (
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditing({ ...user })}>Edit</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ padding: 20, marginTop: 20, background: '#fffbeb', border: '1px solid #fcd34d' }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>💡 How agents get added</div>
        <p style={{ fontSize: 13, color: 'var(--gray-600)', lineHeight: 1.6 }}>
          Agents are automatically added to the system the first time they sign in with their Gmail account. You can then assign them to a department and set their role here. To grant manager access, change their role to "Manager".
        </p>
      </div>
    </div>
  );
}

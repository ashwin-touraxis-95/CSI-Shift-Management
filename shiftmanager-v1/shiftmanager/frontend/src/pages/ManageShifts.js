import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format, addDays, startOfMonth, endOfMonth, addMonths } from 'date-fns';

const DEPARTMENTS = ['CS', 'Sales', 'Travel Agents', 'Trainees', 'Management'];

export default function ManageShifts() {
  const [users, setUsers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editShift, setEditShift] = useState(null);
  const [message, setMessage] = useState('');
  const [viewMonth, setViewMonth] = useState(new Date());

  const [form, setForm] = useState({
    user_id: '', date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '07:00', end_time: '15:00',
    department: 'CS', notes: ''
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchShifts();
  }, [viewMonth]);

  const fetchUsers = async () => {
    const res = await axios.get('/api/users');
    setUsers(res.data.filter(u => u.role === 'agent'));
  };

  const fetchShifts = async () => {
    const start = format(startOfMonth(viewMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(viewMonth), 'yyyy-MM-dd');
    const res = await axios.get(`/api/shifts?start=${start}&end=${end}`);
    setShifts(res.data);
  };

  const handleSubmit = async () => {
    if (!form.user_id || !form.date) return setMessage('Please fill all required fields');
    try {
      if (editShift) {
        await axios.put(`/api/shifts/${editShift.id}`, form);
        setMessage('Shift updated!');
      } else {
        await axios.post('/api/shifts', form);
        setMessage('Shift created!');
      }
      setShowForm(false);
      setEditShift(null);
      resetForm();
      fetchShifts();
    } catch (e) {
      setMessage(e.response?.data?.error || 'Error saving shift');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this shift?')) return;
    await axios.delete(`/api/shifts/${id}`);
    fetchShifts();
    setMessage('Shift deleted.');
  };

  const handleEdit = (shift) => {
    setForm({
      user_id: shift.user_id, date: shift.date,
      start_time: shift.start_time, end_time: shift.end_time,
      department: shift.department, notes: shift.notes || ''
    });
    setEditShift(shift);
    setShowForm(true);
  };

  const resetForm = () => {
    setForm({ user_id: '', date: format(new Date(), 'yyyy-MM-dd'), start_time: '07:00', end_time: '15:00', department: 'CS', notes: '' });
  };

  // Bulk shift creation
  const handleBulkCreate = async () => {
    if (!form.user_id) return setMessage('Select an agent first');
    const days = [];
    for (let i = 0; i < 30; i++) {
      const d = addDays(new Date(form.date), i);
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) days.push(format(d, 'yyyy-MM-dd')); // Mon-Fri
    }
    if (!window.confirm(`Create ${days.length} weekday shifts?`)) return;
    for (const date of days) {
      await axios.post('/api/shifts', { ...form, date });
    }
    setMessage(`Created ${days.length} shifts!`);
    fetchShifts();
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Manage Shifts</h1>
          <p>Create, edit, or bulk-assign shifts up to 2 months in advance</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditShift(null); resetForm(); }}>
          + New Shift
        </button>
      </div>

      {message && (
        <div style={{ background: '#d4edda', border: '1px solid #c3e6cb', borderRadius: 8, padding: '10px 16px', marginBottom: 20, color: '#155724', fontSize: 14 }}>
          ✓ {message}
        </div>
      )}

      {/* Shift Form Modal */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card fade-in" style={{ width: 500, padding: 32, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: 24, fontSize: 20 }}>{editShift ? 'Edit Shift' : 'New Shift'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label>Agent *</label>
                <select value={form.user_id} onChange={e => {
                  const u = users.find(u => u.id === e.target.value);
                  setForm(f => ({ ...f, user_id: e.target.value, department: u?.department || f.department }));
                }}>
                  <option value="">Select agent...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.department})</option>)}
                </select>
              </div>
              <div>
                <label>Date *</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label>Start Time *</label>
                  <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
                </div>
                <div>
                  <label>End Time *</label>
                  <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
                </div>
              </div>
              <div>
                <label>Department</label>
                <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label>Notes (optional)</label>
                <input placeholder="e.g. Public holiday cover" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button className="btn btn-primary" onClick={handleSubmit}>
                {editShift ? 'Save Changes' : 'Create Shift'}
              </button>
              {!editShift && (
                <button className="btn btn-secondary" onClick={handleBulkCreate} title="Creates same shift Mon-Fri for 30 days from the selected date">
                  📅 Bulk (30 weekdays)
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditShift(null); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => setViewMonth(m => addMonths(m, -1))}>← Prev Month</button>
        <strong style={{ fontSize: 16 }}>{format(viewMonth, 'MMMM yyyy')}</strong>
        <button className="btn btn-secondary btn-sm" onClick={() => setViewMonth(m => addMonths(m, 1))}>Next Month →</button>
      </div>

      {/* Shifts table */}
      <div className="card" style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: 'var(--gray-50)', borderBottom: '2px solid var(--gray-200)' }}>
              {['Agent', 'Date', 'Start', 'End', 'Department', 'Notes', 'Actions'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shifts.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>No shifts this month. Click "New Shift" to add one.</td></tr>
            ) : shifts.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                <td style={{ padding: '10px 16px', fontWeight: 600 }}>{s.name}</td>
                <td style={{ padding: '10px 16px', fontFamily: 'DM Mono', fontSize: 13 }}>{s.date}</td>
                <td style={{ padding: '10px 16px', fontFamily: 'DM Mono', fontSize: 13 }}>{s.start_time}</td>
                <td style={{ padding: '10px 16px', fontFamily: 'DM Mono', fontSize: 13 }}>{s.end_time}</td>
                <td style={{ padding: '10px 16px' }}><span className={`badge dept-${s.department.replace(' ', '')}`}>{s.department}</span></td>
                <td style={{ padding: '10px 16px', color: 'var(--gray-500)', maxWidth: 200 }}>{s.notes || '—'}</td>
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(s)}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

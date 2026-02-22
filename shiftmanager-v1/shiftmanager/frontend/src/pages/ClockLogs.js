import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format, parseISO } from 'date-fns';

export default function ClockLogs() {
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterUser, setFilterUser] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [filterDate, filterUser]);

  const fetchUsers = async () => {
    const res = await axios.get('/api/users');
    setUsers(res.data.filter(u => u.role === 'agent'));
  };

  const fetchLogs = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterDate) params.append('date', filterDate);
    if (filterUser) params.append('user_id', filterUser);
    const res = await axios.get(`/api/logs?${params}`);
    setLogs(res.data);
    setLoading(false);
  };

  const formatTime = (dt) => {
    if (!dt) return '—';
    try { return format(parseISO(dt.replace(' ', 'T')), 'HH:mm:ss'); } catch { return dt; }
  };

  const calcDuration = (clockIn, clockOut) => {
    if (!clockIn || !clockOut) return '—';
    try {
      const diff = new Date(clockOut.replace(' ', 'T')) - new Date(clockIn.replace(' ', 'T'));
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      return `${h}h ${m}m`;
    } catch { return '—'; }
  };

  const totalHours = logs.reduce((acc, log) => {
    if (!log.clock_in || !log.clock_out) return acc;
    try {
      const diff = new Date(log.clock_out.replace(' ', 'T')) - new Date(log.clock_in.replace(' ', 'T'));
      return acc + diff / 3600000;
    } catch { return acc; }
  }, 0);

  return (
    <div>
      <div className="page-header">
        <h1>Clock Logs</h1>
        <p>Management view — all clock in/out records. Confidential.</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Entries" value={logs.length} icon="📋" />
        <StatCard label="Clocked In Now" value={logs.filter(l => !l.clock_out).length} icon="🟢" />
        <StatCard label="Total Hours" value={`${totalHours.toFixed(1)}h`} icon="⏱" />
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label>Date</label>
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label>Agent</label>
            <select value={filterUser} onChange={e => setFilterUser(e.target.value)}>
              <option value="">All Agents</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <button className="btn btn-secondary" onClick={() => { setFilterDate(''); setFilterUser(''); }}>
            Clear Filters
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: 'var(--gray-50)', borderBottom: '2px solid var(--gray-200)' }}>
              {['Agent', 'Department', 'Date', 'Clock In', 'Clock Out', 'Duration', 'Status'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>Loading...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>No logs found for selected filters</td></tr>
            ) : logs.map(log => (
              <tr key={log.id} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontWeight: 600 }}>{log.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{log.email}</div>
                </td>
                <td style={{ padding: '12px 16px' }}><span className={`badge dept-${log.department?.replace(' ', '')}`}>{log.department}</span></td>
                <td style={{ padding: '12px 16px', fontFamily: 'DM Mono', fontSize: 13 }}>{log.date}</td>
                <td style={{ padding: '12px 16px', fontFamily: 'DM Mono', fontSize: 13, color: 'var(--green)' }}>{formatTime(log.clock_in)}</td>
                <td style={{ padding: '12px 16px', fontFamily: 'DM Mono', fontSize: 13, color: log.clock_out ? 'var(--red)' : 'var(--gray-400)' }}>{formatTime(log.clock_out)}</td>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{calcDuration(log.clock_in, log.clock_out)}</td>
                <td style={{ padding: '12px 16px' }}>
                  {!log.clock_out
                    ? <span className="badge badge-available"><span className="status-dot available" />Active</span>
                    : <span className="badge badge-offline"><span className="status-dot offline" />Completed</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
          <div style={{ fontSize: 30, fontWeight: 700, marginTop: 4 }}>{value}</div>
        </div>
        <div style={{ fontSize: 32 }}>{icon}</div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';

export default function ClockLogs() {
  const [tab, setTab] = useState('clock');
  const [logs, setLogs] = useState([]);
  const [breakLogs, setBreakLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterUser, setFilterUser] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchUsers(); }, []);
  useEffect(() => { fetchLogs(); }, [filterDate, filterUser]);

  const fetchUsers = async () => {
    const res = await axios.get('/api/users');
    setUsers(res.data.filter(u => u.user_type === 'agent'));
  };

  const fetchLogs = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterDate) params.append('date', filterDate);
    if (filterUser) params.append('user_id', filterUser);
    const [clockRes, breakRes] = await Promise.all([
      axios.get('/api/logs?' + params),
      axios.get('/api/break-logs?' + params).catch(() => ({ data: [] })),
    ]);
    setLogs(clockRes.data);
    setBreakLogs(breakRes.data);
    setLoading(false);
  };

  const parseTS = (dt) => {
    if (!dt) return null;
    const cleaned = dt.toString().replace(' ', 'T').replace(/\+\d{2}(:\d{2})?$/, '+00:00');
    const d = new Date(cleaned);
    return isNaN(d.getTime()) ? null : d;
  };

  const formatTime = (dt) => {
    if (!dt) return '\u2014';
    const d = parseTS(dt);
    if (!d) return '\u2014';
    return d.toLocaleTimeString('en-ZA', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
  };

  const calcDuration = (clockIn, clockOut) => {
    if (!clockIn || !clockOut) return '\u2014';
    const a = parseTS(clockIn), b = parseTS(clockOut);
    if (!a || !b) return '\u2014';
    const diff = b - a;
    if (diff < 0) return '\u2014';
    return Math.floor(diff/3600000) + 'h ' + Math.floor((diff%3600000)/60000) + 'm';
  };

  const totalHours = logs.reduce((acc, log) => {
    if (!log.clock_in || !log.clock_out) return acc;
    const a = parseTS(log.clock_in), b = parseTS(log.clock_out);
    if (!a || !b) return acc;
    return acc + (b - a) / 3600000;
  }, 0);

  const totalBreakMins = breakLogs.reduce((a, l) => a + (l.duration_minutes || 0), 0);

  return (
    <div>
      <div className="page-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div><h1>Logs</h1><p>Management view \u2014 all activity records. Confidential.</p></div>
        <div style={{ display:'flex', borderRadius:8, overflow:'hidden', border:'1.5px solid var(--gray-200)' }}>
          {[{id:'clock',label:'\u{1F550} Clock Logs'},{id:'breaks',label:'\u2615 Breaks'}].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding:'8px 20px', border:'none', cursor:'pointer', fontWeight:600, fontSize:13,
              background: tab===t.id ? 'var(--red)' : 'white', color: tab===t.id ? 'white' : 'var(--gray-600)'
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {tab === 'clock' ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16, marginBottom:24 }}>
          <StatCard label="Total Entries" value={logs.length} icon="\u{1F4CB}" />
          <StatCard label="Clocked In Now" value={logs.filter(l => !l.clock_out).length} icon="\u{1F7E2}" />
          <StatCard label="Total Hours" value={totalHours.toFixed(1) + 'h'} icon="\u23F1" />
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16, marginBottom:24 }}>
          <StatCard label="Total Entries" value={breakLogs.length} icon="\u2615" />
          <StatCard label="On Break Now" value={breakLogs.filter(l => !l.ended_at).length} icon="\u{1F7E1}" />
          <StatCard label="Total Break Time" value={totalBreakMins + 'm'} icon="\u23F1" />
        </div>
      )}

      <div className="card" style={{ padding:20, marginBottom:20 }}>
        <div style={{ display:'flex', gap:16, alignItems:'flex-end', flexWrap:'wrap' }}>
          <div style={{ flex:1, minWidth:200 }}>
            <label>Date</label>
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
          </div>
          <div style={{ flex:1, minWidth:200 }}>
            <label>Agent</label>
            <select value={filterUser} onChange={e => setFilterUser(e.target.value)}>
              <option value="">All Agents</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <button className="btn btn-secondary" onClick={() => { setFilterDate(''); setFilterUser(''); }}>Clear Filters</button>
        </div>
      </div>

      {tab === 'clock' && (
        <div className="card" style={{ overflow:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
            <thead><tr style={{ background:'var(--gray-50)', borderBottom:'2px solid var(--gray-200)' }}>
              {['Agent','Department','Date','Clock In','Clock Out','Duration','Status'].map(h => (
                <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontWeight:600, fontSize:12, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:0.5, whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} style={{ padding:40, textAlign:'center', color:'var(--gray-400)' }}>Loading...</td></tr>
              : logs.length === 0 ? <tr><td colSpan={7} style={{ padding:40, textAlign:'center', color:'var(--gray-400)' }}>No logs found</td></tr>
              : logs.map(log => (
                <tr key={log.id} style={{ borderBottom:'1px solid var(--gray-100)' }}>
                  <td style={{ padding:'12px 16px' }}><div style={{ fontWeight:600 }}>{log.name}</div><div style={{ fontSize:11, color:'var(--gray-400)' }}>{log.email}</div></td>
                  <td style={{ padding:'12px 16px' }}><span className={'badge dept-' + log.department?.replace(' ','')}>{log.department}</span></td>
                  <td style={{ padding:'12px 16px', fontFamily:'DM Mono', fontSize:13 }}>{log.date}</td>
                  <td style={{ padding:'12px 16px', fontFamily:'DM Mono', fontSize:13, color:'var(--green)' }}>{formatTime(log.clock_in)}</td>
                  <td style={{ padding:'12px 16px', fontFamily:'DM Mono', fontSize:13, color:log.clock_out?'var(--red)':'var(--gray-400)' }}>{formatTime(log.clock_out)}</td>
                  <td style={{ padding:'12px 16px', fontWeight:600 }}>{calcDuration(log.clock_in, log.clock_out)}</td>
                  <td style={{ padding:'12px 16px' }}>
                    {!log.clock_out ? <span className="badge badge-available"><span className="status-dot available" />Active</span>
                    : <span className="badge badge-offline"><span className="status-dot offline" />Completed</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'breaks' && (
        <div className="card" style={{ overflow:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
            <thead><tr style={{ background:'var(--gray-50)', borderBottom:'2px solid var(--gray-200)' }}>
              {['Agent','Department','Date','Break Type','Started','Ended','Duration','Status'].map(h => (
                <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontWeight:600, fontSize:12, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:0.5, whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8} style={{ padding:40, textAlign:'center', color:'var(--gray-400)' }}>Loading...</td></tr>
              : breakLogs.length === 0 ? <tr><td colSpan={8} style={{ padding:40, textAlign:'center', color:'var(--gray-400)' }}>No break logs found</td></tr>
              : breakLogs.map(log => (
                <tr key={log.id} style={{ borderBottom:'1px solid var(--gray-100)' }}>
                  <td style={{ padding:'12px 16px' }}><div style={{ fontWeight:600 }}>{log.name}</div><div style={{ fontSize:11, color:'var(--gray-400)' }}>{log.email}</div></td>
                  <td style={{ padding:'12px 16px' }}><span className={'badge dept-' + log.department?.replace(' ','')}>{log.department}</span></td>
                  <td style={{ padding:'12px 16px', fontFamily:'DM Mono', fontSize:13 }}>{log.date}</td>
                  <td style={{ padding:'12px 16px' }}>
                    <span style={{ padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:600, background: log.break_type_color ? log.break_type_color+'22' : '#f3f4f6', color: log.break_type_color || '#374151' }}>
                      {log.break_type_icon} {log.break_type_name}
                    </span>
                  </td>
                  <td style={{ padding:'12px 16px', fontFamily:'DM Mono', fontSize:13, color:'var(--green)' }}>{formatTime(log.started_at)}</td>
                  <td style={{ padding:'12px 16px', fontFamily:'DM Mono', fontSize:13, color:log.ended_at?'var(--red)':'var(--gray-400)' }}>{formatTime(log.ended_at)}</td>
                  <td style={{ padding:'12px 16px', fontWeight:600 }}>{log.duration_minutes != null ? log.duration_minutes+'m' : '\u2014'}</td>
                  <td style={{ padding:'12px 16px' }}>
                    {!log.ended_at ? <span className="badge badge-available"><span className="status-dot available" />Active</span>
                    : <span className="badge badge-offline"><span className="status-dot offline" />Completed</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div className="card" style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontSize:12, color:'var(--gray-500)', fontWeight:600, textTransform:'uppercase', letterSpacing:0.5 }}>{label}</div>
          <div style={{ fontSize:30, fontWeight:700, marginTop:4 }}>{value}</div>
        </div>
        <div style={{ fontSize:32 }}>{icon}</div>
      </div>
    </div>
  );
}

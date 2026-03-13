import React, { useState, useEffect } from 'react';
import { RangePickerPopup } from '../components/RangePicker';
import axios from 'axios';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useAuth } from '../context/AuthContext';

export default function ClockLogs() {
  const [tab, setTab] = useState('clock');
  const [logs, setLogs] = useState([]);
  const [breakLogs, setBreakLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [filterDateFrom, setFilterDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [filterDateTo, setFilterDateTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [filterUser, setFilterUser] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [loading, setLoading] = useState(false);
  const [leaveData, setLeaveData] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [depts, setDepts] = useState([]);
  const { user: me } = useAuth();
  const [expandedAgents, setExpandedAgents] = useState({});
  const toggleAgent = (name) => setExpandedAgents(p => ({ ...p, [name]: !p[name] }));
  const expandAll = (groups) => { const s = {}; groups.forEach(g => s[g.name] = true); setExpandedAgents(s); };
  const collapseAll = () => setExpandedAgents({});

  useEffect(() => { fetchUsers(); fetchLeaveData(); }, []);
  useEffect(() => { fetchLogs(); }, [filterDateFrom, filterDateTo, filterUser]);

  const fetchLeaveData = async () => {
    try {
      const [lr, ltr] = await Promise.all([axios.get('/api/leave'), axios.get('/api/leave-types')]);
      setLeaveData(lr.data);
      setLeaveTypes(ltr.data.filter(t => t.active));
    } catch(e) { console.error(e); }
  };

  const fetchUsers = async () => {
    const res = await axios.get('/api/users');
    const active = res.data.filter(u => u.active !== 0);
    setUsers(active.filter(u => u.user_type === 'agent'));
    const uniqueDepts = [...new Set(active.map(u => u.department).filter(Boolean))].sort();
    setDepts(uniqueDepts);
  };

  const fetchLogs = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterDateFrom) params.append('date_from', filterDateFrom);
    if (filterDateTo) params.append('date_to', filterDateTo);
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
    if (!dt) return '—';
    const d = parseTS(dt);
    if (!d) return '—';
    return d.toLocaleTimeString('en-ZA', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
  };

  const calcDuration = (a, b) => {
    if (!a || !b) return '—';
    const pa = parseTS(a), pb = parseTS(b);
    if (!pa || !pb) return '—';
    const diff = pb - pa;
    if (diff < 0) return '—';
    return Math.floor(diff/3600000) + 'h ' + Math.floor((diff%3600000)/60000) + 'm';
  };

  const clearFilters = () => {
    setFilterDateFrom(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    setFilterDateTo(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
    setFilterUser(''); setFilterDept('');
  };

  // Group logs by agent
  const groupByAgent = (entries, nameKey = 'name') => {
    const map = {};
    entries.forEach(e => {
      const k = e.user_id || e[nameKey];
      if (!map[k]) map[k] = { name: e[nameKey] || e.name, department: e.department, entries: [] };
      map[k].entries.push(e);
    });
    return Object.values(map);
  };

  const filteredLogs = logs.filter(l => !filterDept || l.department === filterDept);
  const filteredBreaks = breakLogs.filter(l => !filterDept || l.department === filterDept);

  const filteredLeave = leaveData
    .filter(l => !filterDept || l.user_department === filterDept)
    .filter(l => !filterUser || l.user_id === filterUser);

  // Count days for a leave record: half_day = 0.5, otherwise count weekdays between date_from and date_to
  const countLeaveDays = (l) => {
    if (l.half_day && l.half_day !== '') return 0.5;
    if (!l.date_from || !l.date_to) return 1;
    const from = new Date(l.date_from + 'T00:00');
    const to = new Date(l.date_to + 'T00:00');
    let days = 0;
    const d = new Date(from);
    while (d <= to) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) days++;
      d.setDate(d.getDate() + 1);
    }
    return days;
  };

  const clockGroups = groupByAgent(filteredLogs);
  const breakGroups = groupByAgent(filteredBreaks);
  const leaveGroups = groupByAgent(filteredLeave, 'user_name');

  const inputStyle = { padding:'6px 12px', borderRadius:8, border:'1.5px solid var(--gray-200)', fontFamily:'inherit', fontSize:13, background:'white' };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* STICKY HEADER */}
      <div style={{ position:'sticky', top:0, zIndex:50, background:'var(--app-bg,#F1F5F9)', padding:'28px 32px 0' }}>
      <div className="page-header">
        <h1>Logs</h1>
        <p>Management view — all activity records. Confidential.</p>
      </div>

      {/* Compact filter bar — date range as single tile */}
      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:12, flexWrap:'wrap' }}>
        <RangePickerPopup
          dateFrom={filterDateFrom}
          dateTo={filterDateTo}
          onChange={(from,to)=>{ if(from) setFilterDateFrom(from); if(to) setFilterDateTo(to); if(!from&&!to){ setFilterDateFrom(''); setFilterDateTo(''); } }}
          placeholder="📅 Date range"
        />
        <select value={filterDept} onChange={e=>setFilterDept(e.target.value)} style={{ padding:'6px 11px', borderRadius:8, border:`1.5px solid ${filterDept?'var(--red)':'var(--gray-200)'}`, fontSize:12, fontFamily:'inherit', background:filterDept?'#fef2f2':'white', color:filterDept?'var(--red)':'var(--gray-700)', fontWeight:filterDept?700:400, cursor:'pointer' }}>
          <option value="">All Departments</option>
          {depts.map(d=><option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterUser} onChange={e=>setFilterUser(e.target.value)} style={{ padding:'6px 11px', borderRadius:8, border:`1.5px solid ${filterUser?'var(--red)':'var(--gray-200)'}`, fontSize:12, fontFamily:'inherit', background:filterUser?'#fef2f2':'white', color:filterUser?'var(--red)':'var(--gray-700)', fontWeight:filterUser?700:400, cursor:'pointer' }}>
          <option value="">All Agents</option>
          {users.filter(u=>!filterDept||u.department===filterDept).map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <button className="btn btn-secondary btn-sm" onClick={clearFilters}>Clear</button>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:0, borderBottom:'2px solid var(--gray-200)' }}>
        {[{id:'clock',label:'🕐 Clock Logs'},{id:'breaks',label:'☕ Breaks'},{id:'leave',label:'🏖️ Leave'}].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:'10px 20px', border:'none', background:'none', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600,
            color: tab===t.id ? 'var(--red)' : 'var(--gray-500)',
            borderBottom: tab===t.id ? '2px solid var(--red)' : '2px solid transparent', marginBottom:-2
          }}>{t.label}</button>
        ))}
      </div>
      </div>{/* end sticky header */}

      {/* SCROLLABLE CONTENT */}
      <div style={{ flex:1, overflowY:'auto', padding:'20px 32px 32px' }}>
      {tab === 'clock' && (
        loading ? <div className="card" style={{ padding:40, textAlign:'center', color:'var(--gray-400)' }}>Loading...</div>
        : clockGroups.length === 0 ? <div className="card" style={{ padding:40, textAlign:'center', color:'var(--gray-400)' }}>No logs found</div>
        : <>
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            <button className="btn btn-secondary btn-sm" onClick={()=>expandAll(clockGroups)}>Expand All</button>
            <button className="btn btn-secondary btn-sm" onClick={collapseAll}>Collapse All</button>
          </div>
          {clockGroups.map(group => {
            const isOpen = !!expandedAgents[group.name];
            return (
              <div key={group.name} className="card" style={{ marginBottom:10, overflow:'hidden' }}>
                <div onClick={()=>toggleAgent(group.name)} style={{ padding:'10px 16px', background:'var(--gray-50)', display:'flex', alignItems:'center', gap:10, cursor:'pointer', userSelect:'none' }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--red)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:12, flexShrink:0 }}>{group.name?.[0]?.toUpperCase()}</div>
                  <div style={{ fontWeight:700, fontSize:14 }}>{group.name}</div>
                  <span style={{ fontSize:12, color:'var(--gray-500)', marginLeft:4 }}>{group.department}</span>
                  <span style={{ marginLeft:'auto', fontSize:12, color:'var(--gray-400)' }}>{group.entries.length} entr{group.entries.length===1?'y':'ies'}</span>
                  <span style={{ fontSize:12, color:'var(--gray-400)', marginLeft:8 }}>{isOpen ? '▲' : '▼'}</span>
                </div>
                {isOpen && (
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                    <thead><tr style={{ borderBottom:'1px solid var(--gray-200)' }}>
                      {['Date','Clock In','Clock Out','Duration','Status'].map(h=>(
                        <th key={h} style={{ padding:'8px 16px', textAlign:'left', fontWeight:600, fontSize:11, color:'var(--gray-500)', textTransform:'uppercase' }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {group.entries.map(log => (
                        <tr key={log.id} style={{ borderBottom:'1px solid var(--gray-100)' }}>
                          <td style={{ padding:'10px 16px', fontFamily:'DM Mono', fontSize:12 }}>{log.date}</td>
                          <td style={{ padding:'10px 16px', fontFamily:'DM Mono', fontSize:12, color:'var(--green)' }}>{formatTime(log.clock_in)}</td>
                          <td style={{ padding:'10px 16px', fontFamily:'DM Mono', fontSize:12, color:log.clock_out?'var(--red)':'var(--gray-400)' }}>{formatTime(log.clock_out)}</td>
                          <td style={{ padding:'10px 16px', fontWeight:600 }}>{calcDuration(log.clock_in, log.clock_out)}</td>
                          <td style={{ padding:'10px 16px' }}>
                            {!log.clock_out
                              ? <span className="badge badge-available"><span className="status-dot available"/>Active</span>
                              : <span className="badge badge-offline"><span className="status-dot offline"/>Completed</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* Breaks — grouped by agent, collapsible */}
      {tab === 'breaks' && (
        loading ? <div className="card" style={{ padding:40, textAlign:'center', color:'var(--gray-400)' }}>Loading...</div>
        : breakGroups.length === 0 ? <div className="card" style={{ padding:40, textAlign:'center', color:'var(--gray-400)' }}>No break logs found</div>
        : <>
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            <button className="btn btn-secondary btn-sm" onClick={()=>expandAll(breakGroups)}>Expand All</button>
            <button className="btn btn-secondary btn-sm" onClick={collapseAll}>Collapse All</button>
          </div>
          {breakGroups.map(group => {
            const isOpen = !!expandedAgents[group.name];
            return (
          <div key={group.name} className="card" style={{ marginBottom:10, overflow:'hidden' }}>
            <div onClick={()=>toggleAgent(group.name)} style={{ padding:'10px 16px', background:'var(--gray-50)', display:'flex', alignItems:'center', gap:10, cursor:'pointer', userSelect:'none' }}>
              <div style={{ width:28, height:28, borderRadius:'50%', background:'#F59E0B', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:12, flexShrink:0 }}>{group.name?.[0]?.toUpperCase()}</div>
              <div style={{ fontWeight:700, fontSize:14 }}>{group.name}</div>
              <span style={{ fontSize:12, color:'var(--gray-500)', marginLeft:4 }}>{group.department}</span>
              <span style={{ marginLeft:'auto', fontSize:12, color:'var(--gray-400)' }}>{group.entries.length} break{group.entries.length===1?'':'s'}</span>
              <span style={{ fontSize:12, color:'var(--gray-400)', marginLeft:8 }}>{isOpen ? '▲' : '▼'}</span>
            </div>
            {isOpen && (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ borderBottom:'1px solid var(--gray-200)' }}>
                {['Date','Break Type','Started','Ended','Duration','Status'].map(h=>(
                  <th key={h} style={{ padding:'8px 16px', textAlign:'left', fontWeight:600, fontSize:11, color:'var(--gray-500)', textTransform:'uppercase' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {group.entries.map(log => (
                  <tr key={log.id} style={{ borderBottom:'1px solid var(--gray-100)' }}>
                    <td style={{ padding:'10px 16px', fontFamily:'DM Mono', fontSize:12 }}>{log.date}</td>
                    <td style={{ padding:'10px 16px' }}>
                      <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600, background:log.break_type_color?log.break_type_color+'22':'#f3f4f6', color:log.break_type_color||'#374151' }}>
                        {log.break_type_icon} {log.break_type_name}
                      </span>
                    </td>
                    <td style={{ padding:'10px 16px', fontFamily:'DM Mono', fontSize:12, color:'var(--green)' }}>{formatTime(log.started_at)}</td>
                    <td style={{ padding:'10px 16px', fontFamily:'DM Mono', fontSize:12, color:log.ended_at?'var(--red)':'var(--gray-400)' }}>{formatTime(log.ended_at)}</td>
                    <td style={{ padding:'10px 16px', fontWeight:600 }}>{log.duration_minutes!=null?log.duration_minutes+'m':'—'}</td>
                    <td style={{ padding:'10px 16px' }}>
                      {!log.ended_at
                        ? <span className="badge badge-available"><span className="status-dot available"/>Active</span>
                        : <span className="badge badge-offline"><span className="status-dot offline"/>Completed</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
            );
          })}
        </>
      )}

      {/* Leave — grouped by agent, collapsible */}
      {tab === 'leave' && (
        leaveGroups.length === 0 ? <div className="card" style={{ padding:40, textAlign:'center', color:'var(--gray-400)' }}>No leave records found</div>
        : <>
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            <button className="btn btn-secondary btn-sm" onClick={()=>expandAll(leaveGroups)}>Expand All</button>
            <button className="btn btn-secondary btn-sm" onClick={collapseAll}>Collapse All</button>
          </div>
          {leaveGroups.map(group => {
            const isOpen = !!expandedAgents[group.name];

            // Per-category totals
            const categoryTotals = {};
            group.entries.forEach(l => {
              const key = l.leave_type_name || 'Unknown';
              const lt = leaveTypes.find(t => String(t.id)===String(l.leave_type_id));
              if (!categoryTotals[key]) categoryTotals[key] = { days: 0, color: lt?.color||'#6366f1', bg: lt?.bg_color||'#ede9fe' };
              categoryTotals[key].days += countLeaveDays(l);
            });

            return (
          <div key={group.name} className="card" style={{ marginBottom:10, overflow:'hidden' }}>
            <div onClick={()=>toggleAgent(group.name)} style={{ padding:'10px 16px', background:'var(--gray-50)', display:'flex', alignItems:'center', gap:10, cursor:'pointer', userSelect:'none', flexWrap:'wrap' }}>
              <div style={{ width:28, height:28, borderRadius:'50%', background:'#6366f1', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:12, flexShrink:0 }}>{group.name?.[0]?.toUpperCase()}</div>
              <div style={{ fontWeight:700, fontSize:14 }}>{group.name}</div>
              <span style={{ fontSize:12, color:'var(--gray-500)', marginLeft:4 }}>{group.department}</span>
              {/* Per-category totals chips */}
              <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginLeft:8 }}>
                {Object.entries(categoryTotals).map(([name, { days, color, bg }]) => (
                  <span key={name} style={{ padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:700, background:bg, color, whiteSpace:'nowrap' }}>
                    {name}: {days} day{days !== 1 ? 's' : ''}
                  </span>
                ))}
              </div>
              <span style={{ marginLeft:'auto', fontSize:12, color:'var(--gray-400)', flexShrink:0 }}>{group.entries.length} record{group.entries.length===1?'':'s'}</span>
              <span style={{ fontSize:12, color:'var(--gray-400)', marginLeft:8 }}>{isOpen ? '▲' : '▼'}</span>
            </div>
            {isOpen && (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ borderBottom:'1px solid var(--gray-200)' }}>
                {['Leave Type','From','To','Days','Half Day','Notes'].map(h=>(
                  <th key={h} style={{ padding:'8px 16px', textAlign:'left', fontWeight:600, fontSize:11, color:'var(--gray-500)', textTransform:'uppercase' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {group.entries.map(l => {
                  const lt = leaveTypes.find(t => String(t.id)===String(l.leave_type_id));
                  const days = countLeaveDays(l);
                  return (
                    <tr key={l.id} style={{ borderBottom:'1px solid var(--gray-100)' }}>
                      <td style={{ padding:'10px 16px' }}>
                        <span style={{ padding:'2px 10px', borderRadius:20, fontSize:12, fontWeight:600, background:lt?.bg_color||'#ede9fe', color:lt?.color||'#6366f1' }}>{l.leave_type_name||'—'}</span>
                      </td>
                      <td style={{ padding:'10px 16px', fontFamily:'DM Mono', fontSize:12 }}>{l.date_from?.slice(0,10)||'—'}</td>
                      <td style={{ padding:'10px 16px', fontFamily:'DM Mono', fontSize:12 }}>{l.date_to?.slice(0,10)||'—'}</td>
                      <td style={{ padding:'10px 16px', fontWeight:700, fontSize:13 }}>{days}</td>
                      <td style={{ padding:'10px 16px', color:'var(--gray-500)', fontSize:12 }}>{l.half_day||'—'}</td>
                      <td style={{ padding:'10px 16px', color:'var(--gray-500)', fontSize:12 }}>{l.notes||'—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            )}
          </div>
            );
          })}
        </>
      )}
      </div>{/* end scrollable content */}
    </div>
  );
}

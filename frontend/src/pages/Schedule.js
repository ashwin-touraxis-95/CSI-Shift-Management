import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format, startOfWeek, endOfWeek, addWeeks, addDays, startOfMonth, endOfMonth, addMonths, eachDayOfInterval, getDay, isToday, getWeek, isSameMonth } from 'date-fns';
import { useAuth } from '../context/AuthContext';
const DEPT_COLORS = { CS:'#856404', Sales:'#383D41', 'Travel Agents':'#0C5460', Trainees:'#721C24', Management:'#155724' };
const DEPT_BG = { CS:'#FFF3CD', Sales:'#E2E3E5', 'Travel Agents':'#D1ECF1', Trainees:'#F8D7DA', Management:'#D4EDDA' };

export default function Schedule() {
  const { user, isLeader, isManager, isAdmin } = useAuth();
  const canEditAgent = (agent) => {
    if (isAdmin) return true;
    if (isManager || isLeader) return agent.department === user?.department;
    return false;
  };
  const [view, setView] = useState('week');
  const [current, setCurrent] = useState(new Date());
  const [shifts, setShifts] = useState([]);
  const [users, setUsers] = useState([]);
  const [depts, setDepts] = useState([]);
  const [settings, setSettings] = useState({});
  const [leaves, setLeaves] = useState([]);
  const [filterDept, setFilterDept] = useState('all');
  const [filterAgent, setFilterAgent] = useState('all');
  const [publicHolidays, setPublicHolidays] = useState([]);
  const [editCell, setEditCell] = useState(null);
  const [editForm, setEditForm] = useState({ start_time:'07:00', end_time:'15:00' });
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => { fetchData(); }, [view, current]);

  const getRange = () => {
    if (view === 'day') return { start: format(current,'yyyy-MM-dd'), end: format(current,'yyyy-MM-dd') };
    if (view === 'week') {
      const s = startOfWeek(current, { weekStartsOn:1 });
      return { start: format(s,'yyyy-MM-dd'), end: format(addDays(s,6),'yyyy-MM-dd') };
    }
    return { start: format(startOfMonth(current),'yyyy-MM-dd'), end: format(endOfMonth(current),'yyyy-MM-dd') };
  };

  const fetchData = async () => {
    const { start, end } = getRange();
    const year = format(current, 'yyyy');
    const [sr, ur, depr, setr, lr, phr] = await Promise.all([
      axios.get(`/api/shifts?start=${start}&end=${end}`),
      axios.get('/api/users'),
      axios.get('/api/departments'),
      axios.get('/api/theme'),
      axios.get(`/api/leave?start=${start}&end=${end}`).catch(()=>({data:[]})),
      axios.get(`/api/public-holidays?year=${year}`).catch(()=>({data:[]})),
    ]);
    setShifts(sr.data);
    setUsers(ur.data.filter(u => u.active !== 0));
    setDepts(depr.data);
    setSettings(setr.data);
    setLeaves(lr.data || []);
    setPublicHolidays(phr.data || []);
  };

  const navigate = (dir) => {
    if (view==='day') setCurrent(d => addDays(d, dir));
    else if (view==='week') setCurrent(d => addWeeks(d, dir));
    else setCurrent(d => addMonths(d, dir));
  };

  const openEditCell = (agent, date, shift) => {
    if (!canEditAgent(agent)) return;
    setEditCell({ agent, date, shift });
    setEditForm({ start_time: shift?.start_time||'07:00', end_time: shift?.end_time||'15:00', shift_type: shift?.shift_type||'normal' });
  };

  const handleEditSave = async () => {
    setEditSaving(true);
    try {
      if (editCell.shift) {
        await axios.put(`/api/shifts/${editCell.shift.id}`, { ...editCell.shift, start_time: editForm.start_time, end_time: editForm.end_time, shift_type: editForm.shift_type, status:'published' });
      } else {
        await axios.post('/api/shifts', { user_id: editCell.agent.id, date: editCell.date, start_time: editForm.start_time, end_time: editForm.end_time, shift_type: editForm.shift_type||'normal', status:'published' });
      }
      await fetchData();
      setEditCell(null);
    } catch(e) { alert(e.response?.data?.error || 'Error saving shift'); }
    setEditSaving(false);
  };

  const handleEditDelete = async () => {
    if (!editCell.shift) return;
    if (!window.confirm('Remove this shift?')) return;
    setEditSaving(true);
    try { await axios.delete(`/api/shifts/${editCell.shift.id}`); await fetchData(); setEditCell(null); }
    catch(e) { alert(e.response?.data?.error||'Error'); }
    setEditSaving(false);
  };

  const getTitle = () => {
    if (view==='day') return format(current,'EEEE, d MMMM yyyy');
    if (view==='week') {
      const s = startOfWeek(current,{weekStartsOn:1});
      return `Week ${getWeek(current)} · ${format(s,'d MMM')} – ${format(addDays(s,6),'d MMM yyyy')}`;
    }
    return format(current,'MMMM yyyy');
  };

  const ShiftPill = ({ shift }) => {
    const dc = depts.find(d=>d.name===shift.department);
    return (
      <div title={`${shift.name} · ${shift.start_time}-${shift.end_time}`}
        style={{ fontSize:12, padding:'6px 8px', borderRadius:6, background:dc?dc.bg_color:DEPT_BG[shift.department]||'#eee', color:dc?dc.color:DEPT_COLORS[shift.department]||'#333', marginBottom:3, fontWeight:700, lineHeight:1.5, textAlign:'center' }}>
        <div style={{ textAlign:'center' }}>{shift.start_time?.slice(0,5)}–{shift.end_time?.slice(0,5)}</div>
        {shift.status==='draft' && <span style={{ fontSize:9 }}>📝</span>}
      </div>
    );
  };

  // ── DAY VIEW ──
  const DayView = () => {
    const dayStr = format(current,'yyyy-MM-dd');
    const agents = users.filter(u => u.user_type === 'agent'
      && (filterDept === 'all' || u.department === filterDept)
      && (filterAgent === 'all' || u.id === filterAgent));
    const byDept = agents.reduce((acc,u) => { if(!acc[u.department])acc[u.department]=[]; acc[u.department].push(u); return acc; },{});
    const hasAnything = agents.length > 0;
    return (
      <div className="card" style={{ overflow:'auto' }}>
        {!hasAnything
          ? <div style={{ padding:60, textAlign:'center', color:'var(--gray-400)' }}>No agents match the current filter</div>
          : Object.entries(byDept).map(([dept, dagents]) => {
            const dc = depts.find(d=>d.name===dept);
            return (
              <div key={dept}>
                <div style={{ padding:'10px 20px', background:dc?dc.bg_color:DEPT_BG[dept]||'#f8f9fa', borderBottom:'1px solid var(--gray-200)' }}>
                  <span style={{ fontWeight:700, fontSize:13, color:dc?dc.color:DEPT_COLORS[dept]||'#333' }}>{dept}</span>
                </div>
                {dagents.map(agent => {
                  const agentShifts = shifts.filter(s => s.user_id===agent.id && s.date===dayStr);
                  const agentLeave = leaves.find(l => l.user_id===agent.id && l.date_from<=dayStr && l.date_to>=dayStr);
                  return (
                    <div key={agent.id} style={{ display:'flex', alignItems:'center', gap:16, padding:'12px 20px', borderBottom:'1px solid var(--gray-100)', background:'white' }}>
                      <div style={{ width:30,height:30,borderRadius:'50%',background:'var(--red)',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:12,flexShrink:0 }}>
                        {agent.name?.trim()?.[0]?.toUpperCase()}
                      </div>
                      <div style={{ fontWeight:600, minWidth:140 }}>{agent.name}</div>
                      {agentShifts.length > 0
                        ? agentShifts.map(s => (
                          <div key={s.id} style={{ fontFamily:'DM Mono', fontSize:13, color:'var(--green)', fontWeight:700, background:'#f0fdf4', padding:'4px 12px', borderRadius:6, border:'1px solid #86efac' }}>
                            {s.start_time.slice(0,5)} – {s.end_time.slice(0,5)}
                            {s.status==='draft' && <span style={{ marginLeft:6, fontSize:10, background:'#fcd34d', color:'#92400e', padding:'1px 6px', borderRadius:4 }}>Draft</span>}
                          </div>
                        ))
                        : <div style={{ fontSize:13, color:'var(--gray-400)', fontStyle:'italic' }}>No shift</div>
                      }
                      {agentLeave && (
                        <div style={{ fontSize:12, fontWeight:700, padding:'4px 12px', borderRadius:6,
                          background:agentLeave.leave_type_bg||'#ede9fe', color:agentLeave.leave_type_color||'#6366f1',
                          border:`1px solid ${agentLeave.leave_type_color||'#6366f1'}40` }}>
                          🏖️ {agentLeave.leave_type_name}
                        </div>
                      )}
                      {agentShifts.length === 0 && !agentLeave && (
                        <div style={{ fontSize:12, color:'var(--gray-300)' }}>—</div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })
        }
      </div>
    );
  };

  // ── WEEK VIEW ──
  const WeekView = () => {
    const weekStart = startOfWeek(current,{weekStartsOn:1});
    const days = Array.from({length:7},(_,i)=>addDays(weekStart,i));
    const agents = users.filter(u=>u.user_type==='agent'
      && (filterDept==='all' || u.department===filterDept)
      && (filterAgent==='all' || u.id===filterAgent));
    const byDept = agents.reduce((acc,u)=>{if(!acc[u.department])acc[u.department]=[];acc[u.department].push(u);return acc;},{});
    return (
      <div className="card" style={{ overflow:'auto' }}>
        <div style={{ background:'var(--red)', padding:'10px 0', textAlign:'center', color:'white', fontWeight:700, fontSize:14 }}>
          🇿🇦 {settings.location_label||'South Africa'} — Week {getWeek(current)}
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth:700 }}>
          <thead>
            <tr style={{ background:'#1a1a2e' }}>
              <th style={{ padding:'10px 14px', textAlign:'left', color:'rgba(255,255,255,0.7)', fontSize:12, fontWeight:600, width:160 }}>Agent</th>
              {days.map(d => {
                const isWeekend = [0,6].includes(d.getDay());
                return (
                  <th key={d} style={{ padding:'10px 8px', textAlign:'center', color: isToday(d)?'white':'rgba(255,255,255,0.7)', fontSize:12, fontWeight: isToday(d)?800:600, background: isToday(d)?'var(--red)':isWeekend?'rgba(255,255,255,0.05)':'transparent', minWidth:100 }}>
                    <div>{format(d,'EEE')}</div><div style={{ opacity: isWeekend?0.6:1 }}>{format(d,'d MMM')}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {Object.entries(byDept).map(([dept,dagents]) => {
              const dc = depts.find(d=>d.name===dept);
              return [
                <tr key={`dept-${dept}`}>
                  <td colSpan={8} style={{ padding:'8px 14px', background:dc?dc.bg_color:DEPT_BG[dept]||'#f8f9fa', fontWeight:700, fontSize:12, color:dc?dc.color:DEPT_COLORS[dept]||'#333' }}>{dept}</td>
                </tr>,
                ...dagents.map((agent,i) => (
                  <tr key={agent.id} style={{ background:i%2===0?'white':'var(--gray-50)', borderBottom:'1px solid var(--gray-100)' }}>
                    <td style={{ padding:'8px 14px', fontWeight:500, fontSize:13 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:26,height:26,borderRadius:'50%',background:'var(--red)',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:11 }}>{agent.name[0]}</div>
                        {agent.name}
                      </div>
                    </td>
                    {days.map(d => {
                      const dayStr = format(d,'yyyy-MM-dd');
                      const dayShifts = shifts.filter(s=>s.user_id===agent.id&&s.date===dayStr);
                      const shift = dayShifts[0] || null;
                      const editable = canEditAgent(agent);
                      const isWeekend = [0,6].includes(d.getDay());
                      // Leave on this day for this agent
                      const dayLeave = leaves.find(l => l.user_id===agent.id && l.date_from<=dayStr && l.date_to>=dayStr);
                      return <td key={dayStr} onClick={() => openEditCell(agent, dayStr, shift)}
                        style={{ padding:'4px 4px', verticalAlign:'top', background:isToday(d)?'rgba(192,57,43,0.04)':isWeekend?'#f8f9fa':undefined, cursor:editable?'pointer':undefined, position:'relative' }}>
                        {dayShifts.map(s=><ShiftPill key={s.id} shift={s}/>)}
                        {dayLeave && (
                          <div title={dayLeave.leave_type_name} style={{
                            fontSize:10, fontWeight:700, borderRadius:5, padding:'3px 6px', marginTop:2,
                            background: dayLeave.leave_type_bg || '#ede9fe',
                            color: dayLeave.leave_type_color || '#6366f1',
                            border: `1px solid ${dayLeave.leave_type_color || '#6366f1'}40`,
                            textAlign:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'
                          }}>
                            🏖️ {dayLeave.leave_type_name}
                          </div>
                        )}
                        {editable && !shift && !dayLeave && <div style={{ width:'100%', height:28, borderRadius:6, border:'1.5px dashed #e2e8f0', display:'flex', alignItems:'center', justifyContent:'center', color:'#cbd5e1', fontSize:11 }}>+</div>}
                      </td>;
                    })}
                  </tr>
                ))
              ];
            })}
          </tbody>
        </table>
        {/* Legend */}
        <div style={{ padding:'12px 16px', display:'flex', gap:16, flexWrap:'wrap', borderTop:'1px solid var(--gray-200)' }}>
          {depts.map(d=><div key={d.id} style={{ display:'flex', alignItems:'center', gap:6 }}><div style={{ width:12,height:12,borderRadius:3,background:d.bg_color,border:`1px solid ${d.color}` }}/><span style={{ fontSize:12,color:'var(--gray-600)' }}>{d.name}</span></div>)}
        </div>
      </div>
    );
  };

  // ── MONTH VIEW — grid style like ManageShifts ──
  const MonthView = () => {
    const allDates = eachDayOfInterval({ start:startOfMonth(current), end:endOfMonth(current) });
    const filteredAgents = users.filter(u => u.user_type==='agent'
      && (filterDept==='all' || u.department===filterDept)
      && (filterAgent==='all' || u.id===filterAgent));
    const agentIds = new Set(filteredAgents.map(u=>u.id));
    const filteredLeaves = leaves.filter(l => agentIds.has(l.user_id));

    // Leave summary bar (when agent filtered)
    const leaveTypeCount = {};
    filteredLeaves.forEach(l => {
      leaveTypeCount[l.leave_type_name] = (leaveTypeCount[l.leave_type_name]||0) + 1;
    });

    const byDept = filteredAgents.reduce((acc,u) => {
      if (!acc[u.department]) acc[u.department] = [];
      acc[u.department].push(u);
      return acc;
    }, {});

    return (
      <div>
        {/* Leave summary bar */}
        {filterAgent !== 'all' && filteredLeaves.length > 0 && (
          <div className="card" style={{ padding:'14px 20px', marginBottom:16, display:'flex', gap:16, alignItems:'center', flexWrap:'wrap' }}>
            <span style={{ fontWeight:700, fontSize:13 }}>📊 This month:</span>
            {Object.entries(leaveTypeCount).map(([type,count]) => {
              const lt = filteredLeaves.find(l=>l.leave_type_name===type);
              return (
                <span key={type} style={{ padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:600,
                  background:lt?.leave_type_bg||'#ede9fe', color:lt?.leave_type_color||'#6366f1',
                  border:`1px solid ${lt?.leave_type_color||'#6366f1'}30` }}>
                  🏖️ {type}: {count} {count===1?'entry':'entries'}
                </span>
              );
            })}
          </div>
        )}

        <div className="card" style={{ overflow:'auto', padding:0 }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:900 }}>
            <thead>
              <tr style={{ background:'#1a1a2e' }}>
                <th style={{ padding:'10px 16px', textAlign:'left', fontWeight:600, fontSize:12, color:'rgba(255,255,255,0.7)', whiteSpace:'nowrap', position:'sticky', left:0, background:'#1a1a2e', zIndex:2, minWidth:160 }}>Agent</th>
                {allDates.map(day => {
                  const ds = format(day,'yyyy-MM-dd');
                  const isWeekend = [0,6].includes(day.getDay());
                  const todayStr = ds === format(new Date(),'yyyy-MM-dd');
                  return (
                    <th key={ds} style={{ padding:'6px 2px', textAlign:'center', fontWeight:600, fontSize:10,
                      color: todayStr?'white':isWeekend?'rgba(255,255,255,0.3)':'rgba(255,255,255,0.7)',
                      minWidth:46, background: todayStr?'var(--red)':isWeekend?'rgba(255,255,255,0.04)':'transparent',
                      borderLeft: isWeekend?'1px solid rgba(255,255,255,0.08)':undefined }}>
                      <div style={{ fontWeight:todayStr?800:600 }}>{format(day,'d')}</div>
                      <div style={{ fontWeight:400, opacity:0.8 }}>{format(day,'EEE')}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {Object.entries(byDept).map(([dept, dagents]) => {
                const dc = depts.find(d=>d.name===dept);
                return (
                  <React.Fragment key={dept}>
                    <tr>
                      <td colSpan={allDates.length + 1} style={{ padding:'6px 16px', background:dc?dc.bg_color:'#f1f5f9', fontWeight:700, fontSize:11, color:dc?dc.color:'#334155', letterSpacing:0.5, position:'sticky', left:0 }}>
                        {dept}
                      </td>
                    </tr>
                    {dagents.map((agent, i) => (
                      <tr key={agent.id} style={{ borderBottom:'1px solid var(--gray-100)', background:i%2===0?'white':'var(--gray-50)' }}>
                        <td style={{ padding:'8px 16px', fontWeight:600, whiteSpace:'nowrap', position:'sticky', left:0, background:i%2===0?'white':'var(--gray-50)', zIndex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div style={{ width:22,height:22,borderRadius:'50%',background:'var(--red)',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:10,flexShrink:0 }}>
                              {agent.name?.trim()?.[0]?.toUpperCase()}
                            </div>
                            {agent.name}
                          </div>
                        </td>
                        {allDates.map(day => {
                          const ds = format(day,'yyyy-MM-dd');
                          const isWeekend = [0,6].includes(day.getDay());
                          const dayShifts = shifts.filter(s=>s.user_id===agent.id&&s.date===ds);
                          const dayLeave = filteredLeaves.find(l=>l.user_id===agent.id&&l.date_from<=ds&&l.date_to>=ds);
                          return (
                            <td key={ds} style={{ padding:'3px 2px', textAlign:'center', verticalAlign:'middle',
                              background:isWeekend?'#f8fafc':undefined,
                              borderLeft:isWeekend?'1px solid #e8edf2':undefined }}>
                              {dayShifts.map(s => {
                                const dc2 = depts.find(d=>d.name===s.department);
                                const bgColor = s.status==='draft' ? '#fcd34d' : (dc2?dc2.bg_color:'#22c55e');
                                const txtColor = s.status==='draft' ? '#92400e' : (dc2?dc2.color:'white');
                                return (
                                  <div key={s.id} title={`${s.start_time}-${s.end_time} ${s.department}`}
                                    style={{ fontSize:9,padding:'2px 4px',borderRadius:3,background:bgColor,color:txtColor,marginBottom:2,fontWeight:600,lineHeight:1.3 }}>
                                    {s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}
                                    {s.status==='draft' && <span> 📝</span>}
                                  </div>
                                );
                              })}
                              {dayLeave && (
                                <div title={dayLeave.leave_type_name}
                                  style={{ fontSize:9,fontWeight:700,borderRadius:3,padding:'2px 4px',marginTop:dayShifts.length?2:0,
                                    background:dayLeave.leave_type_bg||'#ede9fe',
                                    color:dayLeave.leave_type_color||'#6366f1',
                                    overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                                  🏖️ {dayLeave.leave_type_name}
                                </div>
                              )}
                              {!dayShifts.length && !dayLeave && !isWeekend && (
                                <div style={{ color:'#e2e8f0', fontSize:10 }}>·</div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
              {filteredAgents.length === 0 && (
                <tr><td colSpan={allDates.length+1} style={{ padding:40, textAlign:'center', color:'var(--gray-400)' }}>No agents match the current filter</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop:12, display:'flex', gap:16, fontSize:13 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}><div style={{ width:14,height:14,borderRadius:3,background:'var(--green)' }}/>Published</div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}><div style={{ width:14,height:14,borderRadius:3,background:'#fcd34d' }}/>Draft</div>
        </div>
      </div>
    );
  };
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:800 }}>Team Schedule</h1>
          <p style={{ margin:'4px 0 0', color:'var(--gray-500)', fontSize:14 }}>{getTitle()}</p>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
          {/* View toggle */}
          <div style={{ display:'flex', background:'var(--gray-100)', borderRadius:10, padding:3 }}>
            {[{v:'day',l:'Day'},{v:'week',l:'Week'},{v:'month',l:'Month'}].map(m=>(
              <button key={m.v} onClick={()=>{setView(m.v); setCurrent(new Date());}} style={{ padding:'6px 14px', borderRadius:8, border:'none', fontFamily:'inherit', fontSize:13, fontWeight:600, cursor:'pointer', background:view===m.v?'white':'transparent', color:view===m.v?'var(--gray-900)':'var(--gray-500)', boxShadow:view===m.v?'0 1px 3px rgba(0,0,0,0.12)':'none', transition:'all 0.15s' }}>{m.l}</button>
            ))}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={()=>navigate(-1)}>← Prev</button>
          <button className="btn btn-secondary btn-sm" onClick={()=>setCurrent(new Date())}>Today</button>
          <button className="btn btn-secondary btn-sm" onClick={()=>navigate(1)}>Next →</button>
          {/* Dept filter */}
          <select value={filterDept} onChange={e=>{ setFilterDept(e.target.value); setFilterAgent('all'); }}
            style={{ padding:'7px 12px', borderRadius:8, border:'1.5px solid var(--gray-200)', fontSize:13, fontFamily:'inherit' }}>
            <option value="all">All Departments</option>
            {depts.map(d=><option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
          {/* Agent filter */}
          <select value={filterAgent} onChange={e=>setFilterAgent(e.target.value)}
            style={{ padding:'7px 12px', borderRadius:8, border:'1.5px solid var(--gray-200)', fontSize:13, fontFamily:'inherit' }}>
            <option value="all">All Agents</option>
            {users.filter(u=>u.user_type==='agent'&&(filterDept==='all'||u.department===filterDept)).map(u=>(
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
      </div>
      {view==='day' && <DayView/>}
      {view==='week' && <WeekView/>}
      {view==='month' && <MonthView/>}

      {/* Quick shift change modal */}
      {editCell && (() => {
        const cellLeave = leaves.find(l => l.user_id===editCell.agent.id && l.date_from<=editCell.date && l.date_to>=editCell.date);
        return (
          <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000 }} onClick={()=>setEditCell(null)}>
            <div className="card" style={{ padding:28,width:380 }} onClick={e=>e.stopPropagation()}>
              <div style={{ fontWeight:800,fontSize:16,marginBottom:4 }}>
                {editCell.shift ? '✏️ Change Shift' : '➕ Add Shift'}
              </div>
              <div style={{ fontSize:13,color:'var(--gray-500)',marginBottom: cellLeave ? 8 : 20 }}>
                {editCell.agent.name} · {editCell.date}
              </div>
              {cellLeave && (
                <div style={{ padding:'10px 14px', borderRadius:8, background:'#fffbeb', border:'1px solid #fcd34d', marginBottom:16, fontSize:13 }}>
                  ⚠️ <strong>{editCell.agent.name}</strong> has <strong style={{ color: cellLeave.leave_type_color||'#6366f1' }}>{cellLeave.leave_type_name}</strong> on this day.
                  {cellLeave.half_day && <span style={{ color:'var(--gray-500)' }}> ({cellLeave.half_day} half-day)</span>}
                  <div style={{ fontSize:12, color:'var(--gray-500)', marginTop:4 }}>You can still save the shift — useful for half-day scenarios.</div>
                </div>
              )}
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14 }}>
                <div>
                  <label style={{ fontSize:12,fontWeight:600,color:'var(--gray-600)',display:'block',marginBottom:6 }}>Start Time</label>
                  <input type="time" value={editForm.start_time} onChange={e=>setEditForm(f=>({...f,start_time:e.target.value}))} style={{ width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid var(--gray-200)',fontSize:14,fontFamily:'inherit' }}/>
                </div>
                <div>
                  <label style={{ fontSize:12,fontWeight:600,color:'var(--gray-600)',display:'block',marginBottom:6 }}>End Time</label>
                  <input type="time" value={editForm.end_time} onChange={e=>setEditForm(f=>({...f,end_time:e.target.value}))} style={{ width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid var(--gray-200)',fontSize:14,fontFamily:'inherit' }}/>
                </div>
              </div>
              <div style={{ marginBottom:20 }}>
                <label style={{ fontSize:12,fontWeight:600,color:'var(--gray-600)',display:'block',marginBottom:6 }}>Shift Type</label>
                <select value={editForm.shift_type||'normal'} onChange={e=>setEditForm(f=>({...f,shift_type:e.target.value}))}
                  style={{ width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid var(--gray-200)',fontSize:14,fontFamily:'inherit' }}>
                  <option value="normal">Normal Shift</option>
                  <option value="ot_1_5">Overtime @ 1.5 (Weekend)</option>
                  <option value="ot_2">Overtime @ 2 (Public Holiday)</option>
                  <option value="ot_auth">Authorised OT @ 1.5</option>
                </select>
              </div>
              <div style={{ display:'flex',gap:8 }}>
                <button className="btn btn-primary" style={{ flex:1,justifyContent:'center' }} onClick={handleEditSave} disabled={editSaving}>
                  {editSaving ? 'Saving...' : editCell.shift ? 'Update Shift' : 'Add Shift'}
                </button>
                {editCell.shift && (
                  <button className="btn btn-secondary" onClick={handleEditDelete} disabled={editSaving} style={{ color:'#dc2626',borderColor:'#fca5a5' }}>
                    🗑
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── HOURS VIEW ────────────────────────────────────────────────────────────────
function HoursView({ current, setCurrent, users, shifts, leaves, publicHolidays, filterDept, filterAgent, depts }) {
  const [viewMonth, setViewMonth] = React.useState(current || new Date());

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);

  // Get all weeks that overlap this month (Mon-Sun)
  const weeks = [];
  let wStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  while (wStart <= monthEnd) {
    const wEnd = endOfWeek(wStart, { weekStartsOn: 1 });
    weeks.push({ start: wStart, end: wEnd, days: eachDayOfInterval({ start: wStart, end: wEnd }) });
    wStart = addDays(wStart, 7);
  }

  const holidayDates = new Set(publicHolidays.map(h => h.date));

  const calcHours = (start, end) => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60; // overnight
    return Math.round((mins / 60) * 10) / 10;
  };

  const agents = users.filter(u => u.user_type === 'agent'
    && (filterDept === 'all' || u.department === filterDept)
    && (filterAgent === 'all' || u.id === filterAgent));

  // Per agent per week: normal, ot1.5, ot2, leave hours, total
  const getAgentWeekData = (agentId, week) => {
    const weekDays = week.days.map(d => format(d, 'yyyy-MM-dd'));
    let normal = 0, ot15 = 0, ot2 = 0, leaveHrs = 0;

    for (const day of weekDays) {
      const dayShifts = shifts.filter(s => s.user_id === agentId && s.date === day);
      const isWeekendDay = [0,6].includes(new Date(day + 'T00:00').getDay());
      const isHoliday = holidayDates.has(day);

      for (const s of dayShifts) {
        const hrs = calcHours(s.start_time, s.end_time);
        const type = s.shift_type || 'normal';
        if (type === 'ot_2' || isHoliday) ot2 += hrs;
        else if (type === 'ot_1_5' || type === 'ot_auth' || isWeekendDay) ot15 += hrs;
        else normal += hrs;
      }

      // Leave hours — full day = 8hrs, half day = 4hrs
      const agentLeave = leaves.find(l => l.user_id === agentId && l.date_from <= day && l.date_to >= day);
      if (agentLeave && !isWeekendDay) {
        leaveHrs += agentLeave.half_day ? 4 : 8;
      }
    }

    return {
      normal: Math.round(normal * 10) / 10,
      ot15: Math.round(ot15 * 10) / 10,
      ot2: Math.round(ot2 * 10) / 10,
      leave: Math.round(leaveHrs * 10) / 10,
      total: Math.round((normal + ot15 + ot2 + leaveHrs) * 10) / 10,
    };
  };

  const getAgentMonthTotals = (agentId) => {
    let normal = 0, ot15 = 0, ot2 = 0, leave = 0;
    for (const week of weeks) {
      const d = getAgentWeekData(agentId, week);
      normal += d.normal; ot15 += d.ot15; ot2 += d.ot2; leave += d.leave;
    }
    return {
      normal: Math.round(normal * 10) / 10,
      ot15: Math.round(ot15 * 10) / 10,
      ot2: Math.round(ot2 * 10) / 10,
      leave: Math.round(leave * 10) / 10,
      total: Math.round((normal + ot15 + ot2 + leave) * 10) / 10,
    };
  };

  const downloadCSV = () => {
    const monthLabel = format(viewMonth, 'MMMM yyyy');
    const weekLabels = weeks.map(w => `Wk ${getWeek(w.start)} (${format(w.start,'d MMM')}-${format(w.end,'d MMM')})`);

    const headers = ['Agent', 'Department',
      ...weekLabels.flatMap(w => [`${w} Normal`, `${w} OT@1.5`, `${w} OT@2`, `${w} Leave`, `${w} Total`]),
      'Month Normal', 'Month OT@1.5', 'Month OT@2', 'Month Leave', 'Month Total'
    ];

    const rows = agents.map(agent => {
      const weekData = weeks.map(w => getAgentWeekData(agent.id, w));
      const month = getAgentMonthTotals(agent.id);
      return [
        agent.name, agent.department,
        ...weekData.flatMap(d => [d.normal, d.ot15, d.ot2, d.leave, d.total]),
        month.normal, month.ot15, month.ot2, month.leave, month.total
      ];
    });

    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `hours-${format(viewMonth,'yyyy-MM')}.csv`; a.click();
  };

  const th = (txt, style={}) => (
    <th style={{ padding:'8px 12px', fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.8)', textAlign:'center', whiteSpace:'nowrap', borderRight:'1px solid rgba(255,255,255,0.1)', ...style }}>{txt}</th>
  );

  const byDept = {};
  agents.forEach(a => { if (!byDept[a.department]) byDept[a.department] = []; byDept[a.department].push(a); });

  return (
    <div>
      {/* Header bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={()=>setViewMonth(m=>addMonths(m,-1))} className="btn btn-secondary" style={{ fontSize:13, padding:'6px 12px' }}>← Prev</button>
          <span style={{ fontWeight:700, fontSize:16, minWidth:140, textAlign:'center' }}>{format(viewMonth,'MMMM yyyy')}</span>
          <button onClick={()=>setViewMonth(m=>addMonths(m,1))} className="btn btn-secondary" style={{ fontSize:13, padding:'6px 12px' }}>Next →</button>
          <button onClick={()=>setViewMonth(new Date())} className="btn btn-secondary" style={{ fontSize:13, padding:'6px 12px' }}>This Month</button>
        </div>
        <button onClick={downloadCSV} className="btn btn-primary" style={{ fontSize:13, gap:6 }}>⬇ Download CSV</button>
      </div>

      {/* Legend */}
      <div style={{ display:'flex', gap:16, marginBottom:12, flexWrap:'wrap', fontSize:12 }}>
        {[['Normal','#f0fdf4','#16a34a'],['OT @ 1.5 (Weekend/Auth)','#fffbeb','#d97706'],['OT @ 2 (Public Holiday)','#fef2f2','#dc2626'],['Leave Hours','#ede9fe','#7c3aed']].map(([l,bg,c])=>(
          <div key={l} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ width:12, height:12, borderRadius:3, background:bg, border:`1.5px solid ${c}` }}/>
            <span style={{ color:'var(--gray-600)' }}>{l}</span>
          </div>
        ))}
        <span style={{ color:'var(--gray-400)', fontStyle:'italic' }}>· SA public holidays auto-detected as OT@2</span>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow:'auto', padding:0 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth: 900 }}>
          <thead>
            <tr style={{ background:'#1a1a2e' }}>
              {th('Agent', { textAlign:'left', width:150 })}
              {weeks.map(w => (
                <th key={w.start} colSpan={5} style={{ padding:'8px 12px', fontSize:11, fontWeight:700, color:'white', textAlign:'center', borderRight:'2px solid rgba(255,255,255,0.2)', background: isSameMonth(w.start, viewMonth) && isSameMonth(w.end, viewMonth) ? '#1a1a2e' : '#2d3748' }}>
                  Wk {getWeek(w.start)}<br/>
                  <span style={{ fontSize:10, opacity:0.7 }}>{format(w.start,'d MMM')}–{format(w.end,'d MMM')}</span>
                </th>
              ))}
              <th colSpan={5} style={{ padding:'8px 12px', fontSize:11, fontWeight:700, color:'white', textAlign:'center', background:'var(--red)' }}>
                Month Total<br/><span style={{ fontSize:10, opacity:0.8 }}>{format(viewMonth,'MMMM')}</span>
              </th>
            </tr>
            <tr style={{ background:'#2d3748' }}>
              <th style={{ padding:'6px 12px', textAlign:'left', color:'rgba(255,255,255,0.6)', fontSize:10 }}>Name</th>
              {weeks.map(w => (
                <React.Fragment key={w.start}>
                  {[['Norm','#bbf7d0','#166534'],['OT 1.5','#fed7aa','#c2410c'],['OT 2','#fecaca','#dc2626'],['Leave','#ddd6fe','#7c3aed'],['Total','white','#1a1a2e']].map(([l,bg,c])=>(
                    <th key={l} style={{ padding:'5px 6px', fontSize:9, fontWeight:700, color:c, textAlign:'center', background:bg+'33', borderRight:'1px solid rgba(255,255,255,0.1)', minWidth:48 }}>{l}</th>
                  ))}
                </React.Fragment>
              ))}
              {[['Norm','#bbf7d0','#166534'],['OT 1.5','#fed7aa','#c2410c'],['OT 2','#fecaca','#dc2626'],['Leave','#ddd6fe','#7c3aed'],['Total','white','#1a1a2e']].map(([l,bg,c])=>(
                <th key={`m-${l}`} style={{ padding:'5px 6px', fontSize:9, fontWeight:700, color:c, textAlign:'center', background:'rgba(192,57,43,0.2)', borderRight:'1px solid rgba(255,255,255,0.1)', minWidth:48 }}>{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(byDept).map(([dept, dagents]) => {
              const dc = depts.find(d=>d.name===dept);
              return (
                <React.Fragment key={dept}>
                  <tr>
                    <td colSpan={5 * weeks.length + 6} style={{ padding:'6px 14px', background:dc?dc.bg_color:'#f1f5f9', fontWeight:700, fontSize:11, color:dc?dc.color:'#334155', letterSpacing:0.5 }}>
                      {dept}
                    </td>
                  </tr>
                  {dagents.map((agent, i) => {
                    const month = getAgentMonthTotals(agent.id);
                    return (
                      <tr key={agent.id} style={{ background: i%2===0?'white':'#f8fafc', borderBottom:'1px solid #f1f5f9' }}>
                        <td style={{ padding:'8px 12px', fontWeight:600, whiteSpace:'nowrap' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div style={{ width:22, height:22, borderRadius:'50%', background:'var(--red)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 }}>
                              {agent.name?.trim()?.[0]?.toUpperCase()}
                            </div>
                            {agent.name}
                          </div>
                        </td>
                        {weeks.map(week => {
                          const d = getAgentWeekData(agent.id, week);
                          const hasData = d.total > 0;
                          return (
                            <React.Fragment key={week.start}>
                              <td style={{ padding:'6px 8px', textAlign:'center', background: d.normal>0?'#f0fdf4':undefined, color:'#16a34a', fontWeight: d.normal>0?700:400 }}>{d.normal||'—'}</td>
                              <td style={{ padding:'6px 8px', textAlign:'center', background: d.ot15>0?'#fffbeb':undefined, color:'#d97706', fontWeight: d.ot15>0?700:400 }}>{d.ot15||'—'}</td>
                              <td style={{ padding:'6px 8px', textAlign:'center', background: d.ot2>0?'#fef2f2':undefined, color:'#dc2626', fontWeight: d.ot2>0?700:400 }}>{d.ot2||'—'}</td>
                              <td style={{ padding:'6px 8px', textAlign:'center', background: d.leave>0?'#ede9fe':undefined, color:'#7c3aed', fontWeight: d.leave>0?700:400 }}>{d.leave||'—'}</td>
                              <td style={{ padding:'6px 8px', textAlign:'center', fontWeight:700, color: hasData?'#1a1a2e':'var(--gray-300)', borderRight:'2px solid #e2e8f0' }}>{hasData?d.total:'—'}</td>
                            </React.Fragment>
                          );
                        })}
                        <td style={{ padding:'6px 8px', textAlign:'center', background: month.normal>0?'#f0fdf4':undefined, color:'#16a34a', fontWeight:700 }}>{month.normal||'—'}</td>
                        <td style={{ padding:'6px 8px', textAlign:'center', background: month.ot15>0?'#fffbeb':undefined, color:'#d97706', fontWeight:700 }}>{month.ot15||'—'}</td>
                        <td style={{ padding:'6px 8px', textAlign:'center', background: month.ot2>0?'#fef2f2':undefined, color:'#dc2626', fontWeight:700 }}>{month.ot2||'—'}</td>
                        <td style={{ padding:'6px 8px', textAlign:'center', background: month.leave>0?'#ede9fe':undefined, color:'#7c3aed', fontWeight:700 }}>{month.leave||'—'}</td>
                        <td style={{ padding:'6px 8px', textAlign:'center', fontWeight:800, fontSize:13, background:'#fef2f2', color:'var(--red)' }}>{month.total||'—'}</td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
            {agents.length === 0 && (
              <tr><td colSpan={5 * weeks.length + 6} style={{ padding:40, textAlign:'center', color:'var(--gray-400)' }}>No agents match the current filter</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop:10, fontSize:12, color:'var(--gray-400)' }}>
        Normal hours = 40hrs/week (Mon–Fri). Weekend shifts auto-classify as OT@1.5. SA public holidays auto-classify as OT@2. Half-day leave = 4hrs.
      </div>
    </div>
  );
}

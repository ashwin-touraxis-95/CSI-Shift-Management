import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { format, parseISO, eachDayOfInterval, isSameMonth, startOfMonth, endOfMonth, addMonths, subMonths, getDay } from 'date-fns';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function LeaveTracker() {
  const { user } = useAuth();
  const isAgent = user?.user_type === 'agent';
  const canEdit = !isAgent;
  const isAdminOrManager = ['account_admin','manager'].includes(user?.user_type);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [leaves, setLeaves] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [users, setUsers] = useState([]);
  const [deptFilter, setDeptFilter] = useState(user?.department || 'all');
  const [depts, setDepts] = useState([]);
  const [view, setView] = useState('list'); // 'list' | 'calendar'
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showTypeManager, setShowTypeManager] = useState(false);
  const [flash, setFlash] = useState('');

  const [form, setForm] = useState({ user_id:'', leave_type_id:'', date_from:'', date_to:'', half_day:'', notes:'' });
  const [newType, setNewType] = useState({ name:'', color:'#6366f1', bg_color:'#ede9fe', paid_hours:8 });

  const msg = (text) => { setFlash(text); setTimeout(()=>setFlash(''),3000); };

  const fetchAll = useCallback(async () => {
    const month = currentMonth.getMonth() + 1;
    const year = currentMonth.getFullYear();
    const params = new URLSearchParams({ month, year });
    if (deptFilter !== 'all') params.append('department', deptFilter);
    const [lr, ltr, ur, dr] = await Promise.all([
      axios.get('/api/leave?' + params),
      axios.get('/api/leave-types'),
      isAgent ? Promise.resolve({data:[]}) : axios.get('/api/users'),
      axios.get('/api/departments'),
    ]);
    setLeaves(lr.data);
    setLeaveTypes(ltr.data.filter(t=>t.active));
    setUsers(ur.data.filter ? ur.data.filter(u=>u.active!==0) : []);
    setDepts(dr.data);
  }, [currentMonth, deptFilter, isAgent]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSubmit = async () => {
    if (!form.user_id || !form.leave_type_id || !form.date_from || !form.date_to) return msg('Please fill in all required fields');
    try {
      if (editing) { await axios.put(`/api/leave/${editing.id}`, form); msg('Leave updated'); }
      else { await axios.post('/api/leave', form); msg('Leave added'); }
      setShowAdd(false); setEditing(null);
      setForm({ user_id:'', leave_type_id:'', date_from:'', date_to:'', half_day:'', notes:'' });
      fetchAll();
    } catch(e) { msg(e.response?.data?.error||'Error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this leave entry?')) return;
    await axios.delete(`/api/leave/${id}`);
    fetchAll();
  };

  const openEdit = (leave) => {
    setForm({ user_id:leave.user_id, leave_type_id:leave.leave_type_id, date_from:leave.date_from, date_to:leave.date_to, half_day:leave.half_day||'', notes:leave.notes||'' });
    setEditing(leave);
    setShowAdd(true);
  };

  const handleAddType = async () => {
    if (!newType.name) return;
    await axios.post('/api/leave-types', newType);
    setNewType({ name:'', color:'#6366f1', bg_color:'#ede9fe', paid_hours:8 });
    fetchAll();
  };

  const handleDeleteType = async (id) => {
    if (!window.confirm('Delete this leave type?')) return;
    await axios.delete(`/api/leave-types/${id}`);
    fetchAll();
  };

  // Calendar helpers
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart) === 0 ? 6 : getDay(monthStart) - 1; // Mon start

  const getLeavesForDay = (day) => {
    const d = format(day, 'yyyy-MM-dd');
    return leaves.filter(l => l.date_from <= d && l.date_to >= d);
  };

  const leaveTypeMap = Object.fromEntries(leaveTypes.map(t=>[t.id,t]));
  const userMap = Object.fromEntries(users.map(u=>[u.id,u]));

  // Summary stats
  const totalDays = leaves.reduce((acc,l) => {
    if (!l.date_from || !l.date_to) return acc;
    try {
      const days = eachDayOfInterval({ start: parseISO(l.date_from), end: parseISO(l.date_to) });
      return acc + (l.half_day ? 0.5 : days.length);
    } catch { return acc; }
  }, 0);

  const byType = leaveTypes.map(lt => ({
    ...lt,
    count: leaves.filter(l=>l.leave_type_id===lt.id).length,
    days: leaves.filter(l=>l.leave_type_id===lt.id).reduce((acc,l) => {
      try { return acc + (l.half_day?0.5:eachDayOfInterval({start:parseISO(l.date_from),end:parseISO(l.date_to)}).length); } catch{return acc;}
    }, 0)
  })).filter(lt=>lt.count>0);

  const inputStyle = { width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid var(--gray-200)', fontSize:14, fontFamily:'inherit', boxSizing:'border-box' };
  const labelStyle = { fontSize:12, fontWeight:600, color:'var(--gray-600)', display:'block', marginBottom:5 };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* STICKY HEADER */}
      <div style={{ position:'sticky', top:0, zIndex:50, background:'var(--app-bg,#F1F5F9)', padding:'28px 32px 16px' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:0 }}>
        <div>
          <h1 style={{ margin:0 }}>Leave Tracker</h1>
          <p style={{ margin:'4px 0 0', color:'var(--gray-500)', fontSize:14 }}>
            {isAgent ? 'Your personal leave history' : 'Track and manage team leave'}
          </p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          {isAdminOrManager && (
            <button onClick={()=>setShowTypeManager(v=>!v)} className="btn btn-secondary" style={{ fontSize:13 }}>
              ⚙️ Leave Types
            </button>
          )}
          {canEdit && (
            <button onClick={()=>{ setEditing(null); setForm({user_id:'',leave_type_id:'',date_from:'',date_to:'',half_day:'',notes:''}); setShowAdd(true); }}
              className="btn btn-primary" style={{ fontSize:13 }}>+ Add Leave</button>
          )}
        </div>
      </div>
      </div>{/* end sticky header */}

      {/* SCROLLABLE CONTENT */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 32px 32px' }}>
      {flash && <div style={{ padding:'10px 16px', borderRadius:8, background:'#f0fdf4', border:'1px solid #bbf7d0', color:'#16a34a', marginBottom:16, fontSize:14 }}>✅ {flash}</div>}

      {/* Leave Type Manager */}
      {showTypeManager && isAdminOrManager && (
        <div className="card" style={{ padding:24, marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <div>
              <h3 style={{ fontWeight:700, margin:0 }}>⚙️ Manage Leave Types</h3>
              <p style={{ fontSize:13, color:'var(--gray-500)', margin:'4px 0 0' }}>Add custom types like Maternity, Study, Bereavement — anything you need.</p>
            </div>
          </div>
          {/* Existing types */}
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
            {leaveTypes.map(lt => (
              <div key={lt.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 14px', borderRadius:10, background:'var(--gray-50)', border:'1px solid var(--gray-200)', flexWrap:'wrap' }}>
                <div style={{ width:14, height:14, borderRadius:3, background:lt.bg_color, border:`2px solid ${lt.color}`, flexShrink:0 }}/>
                <span style={{ flex:1, fontWeight:600, fontSize:14, minWidth:160 }}>{lt.name}</span>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:11, color:'var(--gray-500)' }}>Paid hrs/day:</span>
                  <input
                    type="number" min={0} max={24} step={0.5}
                    defaultValue={lt.paid_hours ?? 8}
                    onBlur={e => {
                      const val = Math.min(24, Math.max(0, Number(e.target.value)));
                      axios.put(`/api/leave-types/${lt.id}`, { ...lt, paid_hours: val }).then(fetchAll);
                    }}
                    style={{ width:60, padding:'3px 6px', borderRadius:6, border:'1.5px solid var(--gray-200)', fontSize:13, fontFamily:'inherit', fontWeight:700, textAlign:'center' }}
                  />
                  {(lt.paid_hours ?? 8) === 0 && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:4, background:'#fef3c7', color:'#92400e', fontWeight:700 }}>UNPAID</span>}
                </div>
                <label style={{ display:'flex', alignItems:'center', gap:5, cursor:'pointer', fontSize:12, fontWeight:600, color: lt.is_ph_off ? '#b45309' : 'var(--gray-500)', background: lt.is_ph_off ? '#fef3c7' : 'var(--gray-100)', border: lt.is_ph_off ? '1.5px solid #f59e0b' : '1.5px solid var(--gray-200)', borderRadius:6, padding:'3px 8px', userSelect:'none' }}>
                  <input type="checkbox" checked={!!lt.is_ph_off}
                    onChange={e => axios.put(`/api/leave-types/${lt.id}`, { ...lt, is_ph_off: e.target.checked ? 1 : 0 }).then(fetchAll)}
                    style={{ accentColor:'#f59e0b' }}/>
                  PH-Off
                </label>
                <button onClick={()=>handleDeleteType(lt.id)} style={{ padding:'3px 10px', borderRadius:6, border:'1px solid #fecaca', background:'#fef2f2', color:'#dc2626', cursor:'pointer', fontSize:12, fontWeight:600 }}>Delete</button>
              </div>
            ))}
          </div>
          {/* Add new type */}
          <div style={{ borderTop:'1px solid var(--gray-200)', paddingTop:16 }}>
            <label style={{ ...labelStyle, marginBottom:10 }}>Add New Leave Type</label>
            <div style={{ display:'flex', gap:10, alignItems:'flex-end', flexWrap:'wrap' }}>
              <div style={{ flex:2, minWidth:200 }}>
                <label style={labelStyle}>Name</label>
                <input value={newType.name} onChange={e=>setNewType(p=>({...p,name:e.target.value}))}
                  onKeyDown={e=>e.key==='Enter'&&handleAddType()}
                  style={inputStyle} placeholder="e.g. Maternity Leave, Bereavement..."/>
              </div>
              <div>
                <label style={labelStyle}>Text</label>
                <input type="color" value={newType.color} onChange={e=>setNewType(p=>({...p,color:e.target.value}))} style={{ height:38, width:52, borderRadius:8, border:'1.5px solid var(--gray-200)', cursor:'pointer', padding:2 }}/>
              </div>
              <div>
                <label style={labelStyle}>Background</label>
                <input type="color" value={newType.bg_color} onChange={e=>setNewType(p=>({...p,bg_color:e.target.value}))} style={{ height:38, width:52, borderRadius:8, border:'1.5px solid var(--gray-200)', cursor:'pointer', padding:2 }}/>
              </div>
              <div>
                <label style={labelStyle}>Paid hrs/day</label>
                <input type="number" min={0} max={24} step={0.5}
                  value={newType.paid_hours ?? 8}
                  onChange={e=>setNewType(p=>({...p,paid_hours:Math.min(24,Math.max(0,Number(e.target.value)))}))}
                  style={{ ...inputStyle, width:80, textAlign:'center', fontWeight:700 }}/>
              </div>
              <div style={{ padding:'6px 14px', borderRadius:20, background:newType.bg_color, color:newType.color, fontSize:13, fontWeight:600, border:`1px solid ${newType.color}40`, alignSelf:'flex-end', marginBottom:2 }}>
                {newType.name||'Preview'}
              </div>
              <button onClick={handleAddType} className="btn btn-primary" style={{ fontSize:13, alignSelf:'flex-end' }}>+ Add Type</button>
            </div>
          </div>
        </div>
      )}

      {/* Controls Row */}
      <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:20, flexWrap:'wrap' }}>
        {/* Month nav */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={()=>setCurrentMonth(m=>subMonths(m,1))} className="btn btn-secondary" style={{ padding:'6px 12px', fontSize:13 }}>← Prev</button>
          <span style={{ fontWeight:700, fontSize:15, minWidth:140, textAlign:'center' }}>{MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
          <button onClick={()=>setCurrentMonth(m=>addMonths(m,1))} className="btn btn-secondary" style={{ padding:'6px 12px', fontSize:13 }}>Next →</button>
          <button onClick={()=>setCurrentMonth(new Date())} className="btn btn-secondary" style={{ padding:'6px 12px', fontSize:13 }}>Today</button>
        </div>

        {/* Dept filter */}
        {!isAgent && (
          <select value={deptFilter} onChange={e=>setDeptFilter(e.target.value)} style={{ padding:'7px 12px', borderRadius:8, border:'1.5px solid var(--gray-200)', fontSize:13, fontFamily:'inherit' }}>
            <option value="all">All Departments</option>
            {depts.map(d=><option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
        )}

        {/* View toggle */}
        <div style={{ display:'flex', borderRadius:8, overflow:'hidden', border:'1.5px solid var(--gray-200)', marginLeft:'auto' }}>
          {[{id:'list',label:'📋 List'},{id:'calendar',label:'📅 Calendar'}].map(v=>(
            <button key={v.id} onClick={()=>setView(v.id)} style={{ padding:'7px 16px', border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
              background:view===v.id?'var(--red)':'white', color:view===v.id?'white':'var(--gray-600)' }}>{v.label}</button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:12, marginBottom:20 }}>
        <div className="card" style={{ padding:'16px 20px' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:0.5 }}>Total Entries</div>
          <div style={{ fontSize:28, fontWeight:700, marginTop:4 }}>{leaves.length}</div>
        </div>
        <div className="card" style={{ padding:'16px 20px' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:0.5 }}>Total Days</div>
          <div style={{ fontSize:28, fontWeight:700, marginTop:4 }}>{totalDays}</div>
        </div>
        {byType.slice(0,3).map(lt=>(
          <div key={lt.id} className="card" style={{ padding:'16px 20px', borderLeft:`4px solid ${lt.color}` }}>
            <div style={{ fontSize:11, fontWeight:700, color:lt.color, textTransform:'uppercase', letterSpacing:0.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lt.name}</div>
            <div style={{ fontSize:28, fontWeight:700, marginTop:4 }}>{lt.days}<span style={{ fontSize:13, color:'var(--gray-400)', marginLeft:4 }}>days</span></div>
          </div>
        ))}
      </div>

      {/* LIST VIEW */}
      {view === 'list' && (
        <div className="card" style={{ overflow:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
            <thead>
              <tr style={{ background:'var(--gray-50)', borderBottom:'2px solid var(--gray-200)' }}>
                {!isAgent && <th style={{ padding:'12px 16px', textAlign:'left', fontSize:12, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:0.5 }}>Agent</th>}
                {!isAgent && <th style={{ padding:'12px 16px', textAlign:'left', fontSize:12, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:0.5 }}>Dept</th>}
                <th style={{ padding:'12px 16px', textAlign:'left', fontSize:12, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:0.5 }}>Leave Type</th>
                <th style={{ padding:'12px 16px', textAlign:'left', fontSize:12, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:0.5 }}>Date(s)</th>
                <th style={{ padding:'12px 16px', textAlign:'left', fontSize:12, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:0.5 }}>Days</th>
                <th style={{ padding:'12px 16px', textAlign:'left', fontSize:12, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:0.5 }}>Notes</th>
                {canEdit && <th style={{ padding:'12px 16px' }}></th>}
              </tr>
            </thead>
            <tbody>
              {leaves.length === 0
                ? <tr><td colSpan={7} style={{ padding:40, textAlign:'center', color:'var(--gray-400)' }}>No leave records this month</td></tr>
                : leaves.map(l => {
                  let days = '—';
                  try { days = l.half_day ? '0.5' : eachDayOfInterval({start:parseISO(l.date_from),end:parseISO(l.date_to)}).length; } catch{}
                  const sameDay = l.date_from === l.date_to;
                  const dateStr = sameDay ? l.date_from : `${l.date_from} → ${l.date_to}`;
                  return (
                    <tr key={l.id} style={{ borderBottom:'1px solid var(--gray-100)' }}>
                      {!isAgent && <td style={{ padding:'12px 16px', fontWeight:600 }}>{l.user_name}</td>}
                      {!isAgent && <td style={{ padding:'12px 16px' }}><span style={{ padding:'2px 10px', borderRadius:20, fontSize:12, fontWeight:600, background:'var(--gray-100)' }}>{l.user_department}</span></td>}
                      <td style={{ padding:'12px 16px' }}>
                        <span style={{ padding:'3px 12px', borderRadius:20, fontSize:12, fontWeight:600, background:l.leave_type_bg||'#ede9fe', color:l.leave_type_color||'#6366f1' }}>
                          {l.leave_type_name}
                        </span>
                      </td>
                      <td style={{ padding:'12px 16px', fontFamily:'DM Mono', fontSize:13 }}>{dateStr}{l.half_day ? <span style={{ marginLeft:6, fontSize:11, color:'var(--gray-400)' }}>({l.half_day})</span> : ''}</td>
                      <td style={{ padding:'12px 16px', fontWeight:700 }}>{days}</td>
                      <td style={{ padding:'12px 16px', color:'var(--gray-500)', fontSize:13 }}>{l.notes||'—'}</td>
                      {canEdit && (
                        <td style={{ padding:'12px 16px' }}>
                          <div style={{ display:'flex', gap:6 }}>
                            <button onClick={()=>openEdit(l)} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid var(--gray-300)', background:'white', cursor:'pointer', fontSize:12 }}>Edit</button>
                            <button onClick={()=>handleDelete(l.id)} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid #fecaca', background:'#fef2f2', color:'#dc2626', cursor:'pointer', fontSize:12 }}>Delete</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {/* CALENDAR VIEW */}
      {view === 'calendar' && (
        <div className="card" style={{ padding:20 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:8 }}>
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>(
              <div key={d} style={{ textAlign:'center', fontSize:12, fontWeight:700, color:'var(--gray-500)', padding:'4px 0' }}>{d}</div>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
            {Array(startPad).fill(null).map((_,i)=><div key={'pad'+i}/>)}
            {monthDays.map(day => {
              const dayLeaves = getLeavesForDay(day);
              const isToday = format(day,'yyyy-MM-dd') === format(new Date(),'yyyy-MM-dd');
              return (
                <div key={day} style={{ minHeight:80, border:'1px solid var(--gray-200)', borderRadius:6, padding:4,
                  background:isToday?'#fef2f2':isSameMonth(day,currentMonth)?'white':'var(--gray-50)' }}>
                  <div style={{ fontSize:12, fontWeight:isToday?700:400, color:isToday?'var(--red)':'var(--gray-600)', marginBottom:3 }}>
                    {format(day,'d')}
                  </div>
                  {dayLeaves.slice(0,3).map(l=>(
                    <div key={l.id} style={{ fontSize:10, fontWeight:600, borderRadius:3, padding:'1px 5px', marginBottom:2,
                      background:l.leave_type_bg||'#ede9fe', color:l.leave_type_color||'#6366f1',
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={`${l.user_name} — ${l.leave_type_name}`}>
                      {isAgent ? l.leave_type_name : l.user_name}
                    </div>
                  ))}
                  {dayLeaves.length > 3 && <div style={{ fontSize:10, color:'var(--gray-400)' }}>+{dayLeaves.length-3} more</div>}
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginTop:16, paddingTop:12, borderTop:'1px solid var(--gray-200)' }}>
            {leaveTypes.map(lt=>(
              <div key={lt.id} style={{ display:'flex', alignItems:'center', gap:5 }}>
                <div style={{ width:10, height:10, borderRadius:2, background:lt.bg_color, border:`1px solid ${lt.color}` }}/>
                <span style={{ fontSize:12, color:'var(--gray-600)' }}>{lt.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ADD/EDIT MODAL */}
      {showAdd && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }}>
          <div className="card" style={{ width:'100%', maxWidth:480, padding:28, maxHeight:'90vh', overflowY:'auto' }}>
            <h2 style={{ marginBottom:20 }}>{editing ? 'Edit Leave' : 'Add Leave'}</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {!isAgent && (
                <div>
                  <label style={labelStyle}>Agent *</label>
                  <select value={form.user_id} onChange={e=>setForm(p=>({...p,user_id:e.target.value}))} style={inputStyle}>
                    <option value="">— Select Agent —</option>
                    {users.filter(u=>u.user_type!=='account_admin').map(u=>(
                      <option key={u.id} value={u.id}>{u.name} ({u.department})</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label style={labelStyle}>Leave Type *</label>
                <select value={form.leave_type_id} onChange={e=>setForm(p=>({...p,leave_type_id:e.target.value}))} style={inputStyle}>
                  <option value="">— Select Type —</option>
                  {leaveTypes.map(lt=><option key={lt.id} value={lt.id}>{lt.name}</option>)}
                </select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={labelStyle}>From *</label>
                  <input type="date" value={form.date_from} onChange={e=>setForm(p=>({...p,date_from:e.target.value,date_to:p.date_to||e.target.value}))} style={inputStyle}/>
                </div>
                <div>
                  <label style={labelStyle}>To *</label>
                  <input type="date" value={form.date_to} min={form.date_from} onChange={e=>setForm(p=>({...p,date_to:e.target.value}))} style={inputStyle}/>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Half Day <span style={{ fontWeight:400, color:'var(--gray-400)' }}>(optional)</span></label>
                <select value={form.half_day} onChange={e=>setForm(p=>({...p,half_day:e.target.value}))} style={inputStyle}>
                  <option value="">— Full Day(s) —</option>
                  <option value="AM">Morning (AM)</option>
                  <option value="PM">Afternoon (PM)</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Notes <span style={{ fontWeight:400, color:'var(--gray-400)' }}>(optional)</span></label>
                <textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} style={{ ...inputStyle, minHeight:70, resize:'vertical' }} placeholder="Any additional notes..."/>
              </div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button onClick={handleSubmit} className="btn btn-primary">{editing ? 'Save Changes' : 'Add Leave'}</button>
              <button onClick={()=>{ setShowAdd(false); setEditing(null); }} className="btn btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
      </div>{/* end scrollable content */}
    </div>
  );
}

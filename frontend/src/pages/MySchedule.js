import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format, startOfWeek, addWeeks, addDays, startOfMonth, endOfMonth, addMonths, eachDayOfInterval, isToday, getWeek, getDay } from 'date-fns';
import { useAuth } from '../context/AuthContext';

const DEPT_COLORS = { CS:'#856404', Sales:'#383D41', 'Travel Agents':'#0C5460', Trainees:'#721C24', Management:'#155724' };
const DEPT_BG    = { CS:'#FFF3CD', Sales:'#E2E3E5', 'Travel Agents':'#D1ECF1', Trainees:'#F8D7DA', Management:'#D4EDDA' };

export default function MySchedule() {
  const { user, theme } = useAuth();
  const primary = theme?.primary_color || '#C0392B';
  const [view, setView]         = useState('week');
  const [current, setCurrent]   = useState(new Date());
  const [shifts, setShifts]     = useState([]);
  const [allShifts, setAllShifts] = useState([]);
  const [users, setUsers]       = useState([]);
  const [depts, setDepts]       = useState([]);
  const [settings, setSettings] = useState({});
  const [leaves, setLeaves]     = useState([]);
  const [showTeam, setShowTeam] = useState(false);
  const [publicHolidays, setPublicHolidays] = useState([]);

  useEffect(() => { fetchData(); }, [view, current]);

  const getRange = () => {
    if (view === 'day') return { start: format(current,'yyyy-MM-dd'), end: format(current,'yyyy-MM-dd') };
    if (view === 'week') {
      const s = startOfWeek(current,{weekStartsOn:1});
      return { start: format(s,'yyyy-MM-dd'), end: format(addDays(s,6),'yyyy-MM-dd') };
    }
    return { start: format(startOfMonth(current),'yyyy-MM-dd'), end: format(endOfMonth(current),'yyyy-MM-dd') };
  };

  const fetchData = async () => {
    const { start, end } = getRange();
    const [sr, teamSr, ur, depr, setr, lr, phr] = await Promise.all([
      axios.get(`/api/shifts?start=${start}&end=${end}`),
      axios.get(`/api/shifts?start=${start}&end=${end}&team=true`),
      axios.get('/api/users'),
      axios.get('/api/departments'),
      axios.get('/api/theme'),
      axios.get(`/api/leave?start=${start}&end=${end}`).catch(()=>({data:[]})),
      axios.get(`/api/public-holidays?year=${new Date(start).getFullYear()}`).catch(()=>({data:[]})),
    ]);
    setShifts(sr.data.filter(s => s.status !== 'draft'));
    setAllShifts(teamSr.data.filter(s => s.status !== 'draft'));
    setUsers(ur.data.filter(u => u.active !== 0));
    setDepts(depr.data);
    setSettings(setr.data);
    setLeaves(lr.data || []);
    setPublicHolidays(phr.data || []);
  };

  const navigate = (dir) => {
    if (view==='week') setCurrent(d => addWeeks(d, dir));
    else setCurrent(d => addMonths(d, dir));
  };

  const getTitle = () => {
    if (view==='week') {
      const s = startOfWeek(current,{weekStartsOn:1});
      return `Week ${getWeek(current)} · ${format(s,'d MMM')} – ${format(addDays(s,6),'d MMM yyyy')}`;
    }
    return format(current,'MMMM yyyy');
  };

  const ShiftPill = ({ shift, highlight }) => {
    const dc = depts.find(d=>d.name===shift.department);
    return (
      <div style={{
        fontSize:12, padding:'6px 8px', borderRadius:6, marginBottom:3, fontWeight:700,
        lineHeight:1.5, textAlign:'center',
        background: highlight ? primary : (dc?dc.bg_color:DEPT_BG[shift.department]||'#eee'),
        color: highlight ? 'white' : (dc?dc.color:DEPT_COLORS[shift.department]||'#333'),
      }}>
        {shift.start_time?.slice(0,5)}–{shift.end_time?.slice(0,5)}
      </div>
    );
  };

  const WeekView = () => {
    const weekStart = startOfWeek(current,{weekStartsOn:1});
    const days = Array.from({length:7},(_,i)=>addDays(weekStart,i));
    const deptAgents = users.filter(u => u.department === user?.department);
    const displayShifts = showTeam ? allShifts.filter(s=>s.status!=='draft') : shifts;
    const dc = depts.find(d=>d.name===user?.department);

    const rows = showTeam ? deptAgents : [user];

    return (
      <div className="card" style={{ overflow:'auto' }}>
        <div style={{ background:'#1a1a2e', padding:'10px 0', textAlign:'center', color:'white', fontWeight:700, fontSize:14 }}>
          🇿🇦 {settings.location_label||'All Around the World'} — Week {getWeek(current)}
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth:700 }}>
          <thead>
            <tr style={{ background:'#1a1a2e' }}>
              <th style={{ padding:'10px 14px', textAlign:'left', color:'rgba(255,255,255,0.7)', fontSize:12, fontWeight:600, width:160 }}>Agent</th>
              {days.map(d => {
                const ds = format(d,'yyyy-MM-dd');
                const holiday = publicHolidays.find(h => h.date === ds);
                const SA_NAMES = ['Human Rights Day','Family Day','Freedom Day',"Workers' Day",'Youth Day',"National Women's Day",'Heritage Day','Day of Reconciliation','Day of Goodwill'];
                const PH_NAMES = ['Araw ng Kagitingan','Maundy Thursday','Labour Day','Independence Day','National Heroes Day',"All Saints' Day",'Bonifacio Day','Feast of the Immaculate Conception','Rizal Day'];
                const holidayFlag = holiday ? (SA_NAMES.includes(holiday.name) ? '🇿🇦' : PH_NAMES.includes(holiday.name) ? '🇵🇭' : '🌍') : null;
                return (
                  <th key={String(d)} style={{ padding:'10px 8px', textAlign:'center', color:isToday(d)?'white':holiday?'#fef08a':'rgba(255,255,255,0.7)', fontSize:12, fontWeight:isToday(d)?800:600, background:isToday(d)?primary:holiday?'rgba(234,179,8,0.25)':'transparent', minWidth:100 }}>
                    <div>{format(d,'EEE')}</div>
                    <div style={{fontWeight:400,fontSize:11}}>{format(d,'d MMM')}</div>
                    {holiday && <div style={{ fontSize:9, marginTop:2, color:'#fef08a', fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:90 }}>{holidayFlag} {holiday.name}</div>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {showTeam && (
              <tr>
                <td colSpan={8} style={{ padding:'8px 14px', background:dc?dc.bg_color:DEPT_BG[user?.department]||'#f8f9fa', fontWeight:700, fontSize:12, color:dc?dc.color:DEPT_COLORS[user?.department]||'#333' }}>
                  {user?.department}
                </td>
              </tr>
            )}
            {rows.map((agent, i) => (
              <tr key={agent.id} style={{ background:i%2===0?'white':'#F8FAFC', borderBottom:'1px solid #F1F5F9' }}>
                <td style={{ padding:'10px 14px', fontWeight:500, fontSize:13 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:30,height:30,borderRadius:'50%',background:agent.id===user?.id?primary:'#64748B',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:13 }}>
                      {agent.name?.[0]}
                    </div>
                    <span style={{ fontWeight:agent.id===user?.id?700:500 }}>{agent.name}</span>
                    {agent.id===user?.id && showTeam && (
                      <span style={{ fontSize:10, background:`${primary}20`, color:primary, padding:'1px 6px', borderRadius:8, fontWeight:700 }}>You</span>
                    )}
                  </div>
                </td>
                {days.map(d => {
                  const dayStr = format(d,'yyyy-MM-dd');
                  const dayShifts = displayShifts.filter(s=>s.user_id===agent.id&&s.date===dayStr);
                  const dayLeave = leaves.find(l => l.user_id===agent.id && l.date_from<=dayStr && l.date_to>=dayStr);
                  return (
                    <td key={dayStr} style={{ padding:'6px 4px', verticalAlign:'top', background:isToday(d)?`${primary}08`:undefined, textAlign:'center' }}>
                      {dayShifts.map(s=><ShiftPill key={s.id} shift={s} highlight={agent.id===user?.id}/>)}
                      {dayLeave && (
                        <div title={dayLeave.leave_type_name} style={{
                          fontSize:10, fontWeight:700, borderRadius:5, padding:'3px 6px', marginTop:2,
                          background: dayLeave.leave_type_bg || '#ede9fe',
                          color: dayLeave.leave_type_color || '#6366f1',
                          border: `1px solid ${dayLeave.leave_type_color || '#6366f1'}40`,
                          textAlign:'center', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'
                        }}>
                          🏖️ {dayLeave.leave_type_name}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding:'12px 16px', display:'flex', gap:16, flexWrap:'wrap', borderTop:'1px solid #F1F5F9' }}>
          {depts.map(d=><div key={d.id} style={{ display:'flex', alignItems:'center', gap:6 }}><div style={{ width:12,height:12,borderRadius:3,background:d.bg_color,border:`1px solid ${d.color}` }}/><span style={{ fontSize:12,color:'#6B7280' }}>{d.name}</span></div>)}
        </div>
      </div>
    );
  };

  const MonthView = () => {
    const days = eachDayOfInterval({ start:startOfMonth(current), end:endOfMonth(current) });
    const blanks = Array(getDay(startOfMonth(current))===0?6:getDay(startOfMonth(current))-1).fill(null);
    const displayShifts = showTeam ? allShifts.filter(s=>s.status!=='draft') : shifts;
    const deptAgents = users.filter(u => u.department === user?.department && u.active !== 0);
    const [expandedDay, setExpandedDay] = React.useState(null);
    const [groupBy, setGroupBy] = React.useState('shift'); // 'shift' | 'person'

    const getDayData = (dayStr) => {
      const dayShifts = displayShifts.filter(s => s.date === dayStr);
      const dayLeaves = leaves.filter(l => l.date_from <= dayStr && l.date_to >= dayStr &&
        (showTeam || l.user_id === user?.id));
      return { dayShifts, dayLeaves };
    };

    // Group shifts by time slot, then list agents under each
    const groupByShift = (dayShifts) => {
      const groups = {};
      dayShifts.forEach(s => {
        const key = `${s.start_time.slice(0,5)}–${s.end_time.slice(0,5)}`;
        if (!groups[key]) groups[key] = { time: key, agents: [] };
        groups[key].agents.push(s);
      });
      return Object.values(groups).sort((a,b) => a.time.localeCompare(b.time));
    };

    // Group by department then person
    const groupByPerson = (dayShifts) => {
      const byDept = {};
      dayShifts.forEach(s => {
        const dept = s.department || 'Other';
        if (!byDept[dept]) byDept[dept] = [];
        byDept[dept].push(s);
      });
      return byDept;
    };

    return (
      <div>
        {/* Group-by toggle */}
        <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:12 }}>
          <span style={{ fontSize:12, color:'var(--gray-500)', fontWeight:600 }}>Group by:</span>
          <div style={{ display:'flex', background:'var(--gray-100)', borderRadius:8, padding:2 }}>
            {[{v:'shift',l:'🕐 Shift Time'},{v:'person',l:'👤 Person'}].map(m=>(
              <button key={m.v} onClick={()=>setGroupBy(m.v)}
                style={{ padding:'5px 12px', borderRadius:6, border:'none', fontFamily:'inherit', fontSize:12, fontWeight:600, cursor:'pointer',
                  background:groupBy===m.v?'white':'transparent', color:groupBy===m.v?'#111':'var(--gray-500)',
                  boxShadow:groupBy===m.v?'0 1px 3px rgba(0,0,0,0.1)':'none', transition:'all 0.1s' }}>
                {m.l}
              </button>
            ))}
          </div>
          {expandedDay && (
            <button onClick={()=>setExpandedDay(null)} style={{ marginLeft:'auto', fontSize:12, color:'var(--gray-500)', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>
              ✕ Close detail
            </button>
          )}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:8 }}>
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>(
            <div key={d} style={{ textAlign:'center', fontSize:12, fontWeight:700, color:'var(--gray-500)', padding:'4px 0' }}>{d}</div>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
          {blanks.map((_,i)=><div key={`b${i}`}/>)}
          {days.map(day=>{
            const dayStr = format(day,'yyyy-MM-dd');
            const { dayShifts, dayLeaves } = getDayData(dayStr);
            const today = isToday(day);
            const isWeekend = [0,6].includes(day.getDay());
            const isExpanded = expandedDay === dayStr;
            const myShift = dayShifts.find(s=>s.user_id===user?.id);
            const myLeave = dayLeaves.find(l=>l.user_id===user?.id);
            const totalPeople = new Set(dayShifts.map(s=>s.user_id)).size;
            const holiday = publicHolidays.find(h => h.date === dayStr);
            const SA_NAMES = ['Human Rights Day','Family Day','Freedom Day',"Workers' Day",'Youth Day',"National Women's Day",'Heritage Day','Day of Reconciliation','Day of Goodwill'];
            const PH_NAMES = ['Araw ng Kagitingan','Maundy Thursday','Labour Day','Independence Day','National Heroes Day',"All Saints' Day",'Bonifacio Day','Feast of the Immaculate Conception','Rizal Day'];
            const holidayFlag = holiday ? (SA_NAMES.includes(holiday.name) ? '🇿🇦' : PH_NAMES.includes(holiday.name) ? '🇵🇭' : '🌍') : null;

            return (
              <div key={dayStr}
                onClick={()=>setExpandedDay(isExpanded ? null : dayStr)}
                style={{ minHeight:80, padding:6, borderRadius:8, cursor:'pointer',
                  border:`1.5px solid ${isExpanded?primary:today?primary:holiday?'#ca8a04':isWeekend?'#e8edf2':'#E2E8F0'}`,
                  background: isExpanded?`${primary}08`:today?`${primary}06`:holiday?'#fefce8':isWeekend?'#f8fafc':'white',
                  transition:'all 0.15s', position:'relative' }}>

                {/* Date number */}
                <div style={{ fontSize:12, fontWeight:today?800:500, color:today?primary:holiday?'#92400e':isWeekend?'var(--gray-400)':'#374151', marginBottom:4 }}>
                  {format(day,'d')}
                </div>

                {/* Public holiday banner */}
                {holiday && (
                  <div style={{ fontSize:9, fontWeight:700, borderRadius:4, padding:'2px 5px', marginBottom:3,
                    background:'#fef08a', color:'#78350f', textAlign:'center',
                    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {holidayFlag} {holiday.name}
                  </div>
                )}

                {/* My own shift — always shown */}
                {myShift && (
                  <div style={{ fontSize:10, fontWeight:700, borderRadius:5, padding:'3px 6px', marginBottom:2,
                    background:primary, color:'white', textAlign:'center' }}>
                    {myShift.start_time.slice(0,5)}–{myShift.end_time.slice(0,5)}
                  </div>
                )}

                {/* My leave */}
                {myLeave && (
                  <div style={{ fontSize:9, fontWeight:700, borderRadius:4, padding:'2px 5px', marginBottom:2,
                    background:myLeave.leave_type_bg||'#ede9fe', color:myLeave.leave_type_color||'#6366f1',
                    textAlign:'center', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    🏖️ {myLeave.leave_type_name}
                  </div>
                )}

                {/* Team summary pill (when in team view) */}
                {showTeam && totalPeople > 0 && (
                  <div style={{ fontSize:9, color:'var(--gray-500)', fontWeight:600, marginTop:2 }}>
                    {totalPeople} agent{totalPeople!==1?'s':''} working
                    {dayLeaves.length>0 && ` · ${dayLeaves.length} on leave`}
                  </div>
                )}

                {/* Not working indicator */}
                {!myShift && !myLeave && !isWeekend && !showTeam && (
                  <div style={{ fontSize:9, color:'var(--gray-300)', textAlign:'center', marginTop:8 }}>—</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Expanded day detail panel */}
        {expandedDay && (() => {
          const { dayShifts, dayLeaves } = getDayData(expandedDay);
          const dayObj = new Date(expandedDay + 'T00:00');
          const isWeekend = [0,6].includes(dayObj.getDay());

          return (
            <div className="card" style={{ marginTop:16, padding:24, border:`2px solid ${primary}20` }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
                <div>
                  <h3 style={{ margin:0, fontSize:17, fontWeight:800 }}>{format(dayObj,'EEEE, d MMMM yyyy')}</h3>
                  <div style={{ fontSize:13, color:'var(--gray-500)', marginTop:2 }}>
                    {dayShifts.length} shift{dayShifts.length!==1?'s':''} · {new Set(dayShifts.map(s=>s.user_id)).size} agents working
                    {dayLeaves.length>0 && ` · ${dayLeaves.length} on leave`}
                  </div>
                </div>
              </div>

              {dayShifts.length === 0 && dayLeaves.length === 0 && (
                <div style={{ textAlign:'center', color:'var(--gray-400)', padding:'24px 0' }}>
                  {isWeekend ? '📅 Weekend — no shifts scheduled' : 'No shifts or leave on this day'}
                </div>
              )}

              {/* Grouped by shift time */}
              {groupBy === 'shift' && dayShifts.length > 0 && (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {groupByShift(dayShifts).map(group => (
                    <div key={group.time}>
                      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                        <div style={{ padding:'4px 14px', borderRadius:20, background:primary, color:'white', fontSize:12, fontWeight:700 }}>
                          🕐 {group.time}
                        </div>
                        <span style={{ fontSize:12, color:'var(--gray-400)' }}>{group.agents.length} agent{group.agents.length!==1?'s':''}</span>
                      </div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:8, paddingLeft:8 }}>
                        {group.agents.map(s => {
                          const agentLeave = dayLeaves.find(l=>l.user_id===s.user_id);
                          return (
                            <div key={s.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:8,
                              background: s.user_id===user?.id?`${primary}12`:'#f8fafc',
                              border:`1px solid ${s.user_id===user?.id?primary:'#e2e8f0'}` }}>
                              <div style={{ width:22,height:22,borderRadius:'50%',background:s.user_id===user?.id?primary:'#94a3b8',color:'white',
                                display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,flexShrink:0 }}>
                                {(s.user_name||s.name||'?')[0].toUpperCase()}
                              </div>
                              <span style={{ fontSize:12, fontWeight:s.user_id===user?.id?700:500 }}>
                                {s.user_name || s.name}
                                {s.user_id===user?.id && <span style={{ color:primary, fontSize:10, marginLeft:4 }}>You</span>}
                              </span>
                              {agentLeave && (
                                <span style={{ fontSize:9, padding:'1px 6px', borderRadius:4,
                                  background:agentLeave.leave_type_bg||'#ede9fe', color:agentLeave.leave_type_color||'#6366f1', fontWeight:700 }}>
                                  🏖️ {agentLeave.leave_type_name}
                                </span>
                              )}
                              {s.status==='draft' && <span style={{ fontSize:9, background:'#fcd34d', color:'#92400e', padding:'1px 5px', borderRadius:4, fontWeight:700 }}>Draft</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Grouped by person → dept */}
              {groupBy === 'person' && dayShifts.length > 0 && (() => {
                const byDept = groupByPerson(dayShifts);
                return (
                  <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                    {Object.entries(byDept).map(([dept, dShifts]) => {
                      const dc = depts.find(d=>d.name===dept);
                      return (
                        <div key={dept}>
                          <div style={{ padding:'4px 12px', borderRadius:6, display:'inline-block', marginBottom:8,
                            background:dc?dc.bg_color:'#f1f5f9', color:dc?dc.color:'#334155', fontSize:11, fontWeight:700 }}>
                            {dept}
                          </div>
                          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                            {dShifts.map(s => {
                              const agentLeave = dayLeaves.find(l=>l.user_id===s.user_id);
                              return (
                                <div key={s.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 14px', borderRadius:8,
                                  background: s.user_id===user?.id?`${primary}08`:'white',
                                  border:`1px solid ${s.user_id===user?.id?primary+'40':'#e2e8f0'}` }}>
                                  <div style={{ width:28,height:28,borderRadius:'50%',background:s.user_id===user?.id?primary:'#94a3b8',
                                    color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,flexShrink:0 }}>
                                    {(s.user_name||s.name||'?')[0].toUpperCase()}
                                  </div>
                                  <div style={{ flex:1, fontWeight:s.user_id===user?.id?700:500, fontSize:13 }}>
                                    {s.user_name || s.name}
                                    {s.user_id===user?.id && <span style={{ color:primary, fontSize:11, marginLeft:6 }}>· You</span>}
                                  </div>
                                  <div style={{ fontFamily:'DM Mono', fontSize:13, color:'#22c55e', fontWeight:700, background:'#f0fdf4', padding:'3px 10px', borderRadius:6 }}>
                                    {s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}
                                  </div>
                                  {agentLeave && (
                                    <div style={{ fontSize:11, padding:'3px 8px', borderRadius:6, fontWeight:700,
                                      background:agentLeave.leave_type_bg||'#ede9fe', color:agentLeave.leave_type_color||'#6366f1' }}>
                                      🏖️ {agentLeave.leave_type_name}
                                    </div>
                                  )}
                                  {s.status==='draft' && <span style={{ fontSize:10, background:'#fcd34d', color:'#92400e', padding:'2px 8px', borderRadius:4, fontWeight:700 }}>Draft</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Leave section */}
              {dayLeaves.length > 0 && (
                <div style={{ marginTop:16, paddingTop:16, borderTop:'1px solid var(--gray-100)' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-500)', marginBottom:8 }}>ON LEAVE TODAY</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                    {dayLeaves.map(l => (
                      <div key={l.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', borderRadius:8,
                        background:l.leave_type_bg||'#ede9fe', border:`1px solid ${l.leave_type_color||'#6366f1'}30` }}>
                        <span style={{ fontSize:11, fontWeight:700, color:l.leave_type_color||'#6366f1' }}>🏖️ {l.user_name}</span>
                        <span style={{ fontSize:10, color:'var(--gray-500)' }}>{l.leave_type_name}{l.half_day?` (${l.half_day})`:''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Legend */}
        <div style={{ marginTop:12, display:'flex', gap:16, flexWrap:'wrap', fontSize:11, color:'var(--gray-500)' }}>
          {depts.map(d=>(
            <div key={d.id} style={{ display:'flex', alignItems:'center', gap:5 }}>
              <div style={{ width:10,height:10,borderRadius:3,background:d.bg_color,border:`1px solid ${d.color}` }}/>
              {d.name}
            </div>
          ))}
          <span>· Click any day to expand</span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* STICKY HEADER */}
      <div style={{ position:'sticky', top:0, zIndex:50, background:'var(--app-bg,#F1F5F9)', padding:'28px 32px 16px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:0, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:800 }}>My Schedule</h1>
          <p style={{ margin:'4px 0 0', color:'#6B7280', fontSize:14 }}>{getTitle()}</p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ display:'flex', background:'#F1F5F9', borderRadius:10, padding:3 }}>
            {[{id:false,l:'👤 My Shifts'},{id:true,l:`👥 ${user?.department} Team`}].map(m=>(
              <button key={String(m.id)} onClick={()=>setShowTeam(m.id)}
                style={{ padding:'6px 14px', borderRadius:8, border:'none', fontFamily:'inherit', fontSize:12, fontWeight:600, cursor:'pointer',
                  background:showTeam===m.id?'white':'transparent', color:showTeam===m.id?'#111':'#6B7280',
                  boxShadow:showTeam===m.id?'0 1px 3px rgba(0,0,0,0.12)':'none' }}>
                {m.l}
              </button>
            ))}
          </div>
          <div style={{ display:'flex', background:'#F1F5F9', borderRadius:10, padding:3 }}>
            {[{v:'week',l:'Week'},{v:'month',l:'Month'}].map(m=>(
              <button key={m.v} onClick={()=>{setView(m.v);setCurrent(new Date());}}
                style={{ padding:'6px 14px', borderRadius:8, border:'none', fontFamily:'inherit', fontSize:13, fontWeight:600, cursor:'pointer',
                  background:view===m.v?'white':'transparent', color:view===m.v?'#111':'#6B7280',
                  boxShadow:view===m.v?'0 1px 3px rgba(0,0,0,0.12)':'none' }}>
                {m.l}
              </button>
            ))}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={()=>navigate(-1)}>← Prev</button>
          <button className="btn btn-secondary btn-sm" onClick={()=>setCurrent(new Date())}>Today</button>
          <button className="btn btn-secondary btn-sm" onClick={()=>navigate(1)}>Next →</button>
        </div>
      </div>
      </div>{/* end sticky header */}

      {/* SCROLLABLE CONTENT */}
      <div style={{ flex:1, overflowY:'auto', padding:'20px 32px 32px' }}>
      {view==='week'  && <WeekView/>}
      {view==='month' && <MonthView/>}
      </div>{/* end scrollable content */}
    </div>
  );
}

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
  const [showTeam, setShowTeam] = useState(false);

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
    const [sr, ur, depr, setr] = await Promise.all([
      axios.get(`/api/shifts?start=${start}&end=${end}`),
      axios.get('/api/users'),
      axios.get('/api/departments'),
      axios.get('/api/theme'),
    ]);
    setAllShifts(sr.data);
    setShifts(sr.data.filter(s => s.user_id === user?.id && s.status !== 'draft'));
    setUsers(ur.data.filter(u => u.active !== 0));
    setDepts(depr.data);
    setSettings(setr.data);
  };

  const navigate = (dir) => {
    if (view==='day') setCurrent(d => addDays(d, dir));
    else if (view==='week') setCurrent(d => addWeeks(d, dir));
    else setCurrent(d => addMonths(d, dir));
  };

  const getTitle = () => {
    if (view==='week') {
      const s = startOfWeek(current,{weekStartsOn:1});
      return `Week ${getWeek(current)} · ${format(s,'d MMM')} – ${format(addDays(s,6),'d MMM yyyy')}`;
    }
    if (view==='day') return format(current,'EEEE, d MMMM yyyy');
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
    const deptAgents = users.filter(u => u.department === user?.department && u.user_type === 'agent');
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
              {days.map(d => (
                <th key={String(d)} style={{ padding:'10px 8px', textAlign:'center', color:isToday(d)?'white':'rgba(255,255,255,0.7)', fontSize:12, fontWeight:isToday(d)?800:600, background:isToday(d)?primary:'transparent', minWidth:100 }}>
                  <div>{format(d,'EEE')}</div><div style={{fontWeight:400,fontSize:11}}>{format(d,'d MMM')}</div>
                </th>
              ))}
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
                  return (
                    <td key={dayStr} style={{ padding:'6px 4px', verticalAlign:'top', background:isToday(d)?`${primary}08`:undefined, textAlign:'center' }}>
                      {dayShifts.map(s=><ShiftPill key={s.id} shift={s} highlight={agent.id===user?.id}/>)}
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
    return (
      <div className="card" style={{ padding:20 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:8 }}>
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=><div key={d} style={{ textAlign:'center',fontSize:12,fontWeight:700,color:'#6B7280',padding:'4px 0' }}>{d}</div>)}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
          {blanks.map((_,i)=><div key={`b${i}`}/>)}
          {days.map(day=>{
            const dayStr = format(day,'yyyy-MM-dd');
            const ds = displayShifts.filter(s=>s.date===dayStr);
            const today = isToday(day);
            return (
              <div key={dayStr} style={{ minHeight:80, padding:6, borderRadius:8, border:`1.5px solid ${today?primary:'#E2E8F0'}`, background:today?`${primary}08`:'white' }}>
                <div style={{ fontSize:12,fontWeight:today?800:500,color:today?primary:'#374151',marginBottom:4 }}>{format(day,'d')}</div>
                {ds.slice(0,3).map(s=><ShiftPill key={s.id} shift={s} highlight={s.user_id===user?.id}/>)}
                {ds.length>3&&<div style={{ fontSize:9,color:'#9CA3AF',fontWeight:600 }}>+{ds.length-3} more</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
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
            {[{v:'day',l:'Day'},{v:'week',l:'Week'},{v:'month',l:'Month'}].map(m=>(
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
      {view==='week'  && <WeekView/>}
      {view==='month' && <MonthView/>}
      {view==='day'   && (
        <div className="card" style={{ padding:24 }}>
          {(showTeam ? allShifts : shifts).length === 0
            ? <div style={{ textAlign:'center', color:'#9CA3AF', padding:40 }}>No shifts on this day</div>
            : (showTeam ? allShifts.filter(s=>s.status!=='draft') : shifts).map(s => (
                <div key={s.id} style={{ display:'flex', gap:16, padding:'12px 0', borderBottom:'1px solid #F8FAFC', alignItems:'center' }}>
                  <div style={{ fontFamily:'DM Mono', fontSize:14, color:'#22C55E', fontWeight:700, minWidth:130 }}>{s.start_time} – {s.end_time}</div>
                  <div style={{ fontWeight:600 }}>{showTeam ? s.user_name : s.department}</div>
                  {s.notes && <div style={{ fontSize:13, color:'#9CA3AF' }}>{s.notes}</div>}
                </div>
              ))
          }
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format, startOfWeek, endOfWeek, addWeeks, addDays, startOfMonth, endOfMonth, addMonths, eachDayOfInterval, getDay, isToday, getWeek } from 'date-fns';

const DEPT_COLORS = { CS:'#856404', Sales:'#383D41', 'Travel Agents':'#0C5460', Trainees:'#721C24', Management:'#155724' };
const DEPT_BG = { CS:'#FFF3CD', Sales:'#E2E3E5', 'Travel Agents':'#D1ECF1', Trainees:'#F8D7DA', Management:'#D4EDDA' };

export default function Schedule() {
  const [view, setView] = useState('week'); // day | week | month
  const [current, setCurrent] = useState(new Date());
  const [shifts, setShifts] = useState([]);
  const [users, setUsers] = useState([]);
  const [depts, setDepts] = useState([]);
  const [settings, setSettings] = useState({});

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
    const [sr, ur, depr, setr] = await Promise.all([
      axios.get(`/api/shifts?start=${start}&end=${end}`),
      axios.get('/api/users'),
      axios.get('/api/departments'),
      axios.get('/api/theme'),
    ]);
    setShifts(sr.data);
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
        style={{ fontSize:10, padding:'2px 6px', borderRadius:4, background:dc?dc.bg_color:DEPT_BG[shift.department]||'#eee', color:dc?dc.color:DEPT_COLORS[shift.department]||'#333', marginBottom:2, fontWeight:600, lineHeight:1.4, display:'flex', justifyContent:'space-between', alignItems:'center', gap:4 }}>
        <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{shift.name?.split(' ')[0]}</span>
        <span style={{ opacity:0.7, flexShrink:0 }}>{shift.start_time.slice(0,5)}</span>
        {shift.status==='draft' && <span>📝</span>}
      </div>
    );
  };

  // ── DAY VIEW ──
  const DayView = () => {
    const dayShifts = shifts.filter(s => s.date === format(current,'yyyy-MM-dd'));
    const byDept = dayShifts.reduce((acc,s) => { if(!acc[s.department])acc[s.department]=[]; acc[s.department].push(s); return acc; },{});
    return (
      <div className="card" style={{ overflow:'auto' }}>
        {Object.keys(byDept).length === 0 ? <div style={{ padding:60, textAlign:'center', color:'var(--gray-400)' }}>No shifts scheduled for this day</div>
        : Object.entries(byDept).map(([dept, dShifts]) => {
          const dc = depts.find(d=>d.name===dept);
          return (
            <div key={dept}>
              <div style={{ padding:'10px 20px', background:dc?dc.bg_color:DEPT_BG[dept]||'#f8f9fa', borderBottom:'1px solid var(--gray-200)' }}>
                <span style={{ fontWeight:700, fontSize:13, color:dc?dc.color:DEPT_COLORS[dept]||'#333' }}>{dept}</span>
              </div>
              {dShifts.map(s => (
                <div key={s.id} style={{ display:'flex', alignItems:'center', gap:16, padding:'12px 20px', borderBottom:'1px solid var(--gray-100)' }}>
                  <div style={{ fontFamily:'DM Mono', fontSize:14, color:'var(--green)', fontWeight:700, minWidth:130 }}>{s.start_time} – {s.end_time}</div>
                  <div style={{ fontWeight:600 }}>{s.name}</div>
                  {s.status==='draft' && <span style={{ fontSize:11, background:'#fcd34d', color:'#92400e', padding:'2px 8px', borderRadius:6, fontWeight:600 }}>Draft</span>}
                  {s.notes && <div style={{ fontSize:13, color:'var(--gray-500)' }}>{s.notes}</div>}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  };

  // ── WEEK VIEW ──
  const WeekView = () => {
    const weekStart = startOfWeek(current,{weekStartsOn:1});
    const days = Array.from({length:7},(_,i)=>addDays(weekStart,i));
    const agents = users.filter(u=>u.user_type==='agent');
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
              {days.map(d => (
                <th key={d} style={{ padding:'10px 8px', textAlign:'center', color: isToday(d)?'white':'rgba(255,255,255,0.7)', fontSize:12, fontWeight: isToday(d)?800:600, background: isToday(d)?'var(--red)':'transparent', minWidth:100 }}>
                  <div>{format(d,'EEE')}</div><div>{format(d,'d MMM')}</div>
                </th>
              ))}
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
                      return <td key={dayStr} style={{ padding:'4px 4px', verticalAlign:'top', background:isToday(d)?'rgba(192,57,43,0.04)':undefined }}>
                        {dayShifts.map(s=><ShiftPill key={s.id} shift={s}/>)}
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

  // ── MONTH VIEW ──
  const MonthView = () => {
    const days = eachDayOfInterval({ start:startOfMonth(current), end:endOfMonth(current) });
    const blanks = Array(startOfMonth(current).getDay()===0?6:startOfMonth(current).getDay()-1).fill(null);
    return (
      <div className="card" style={{ padding:20 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:8 }}>
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=><div key={d} style={{ textAlign:'center',fontSize:12,fontWeight:700,color:'var(--gray-500)',padding:'4px 0' }}>{d}</div>)}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
          {blanks.map((_,i)=><div key={`b${i}`}/>)}
          {days.map(day=>{
            const ds = shifts.filter(s=>s.date===format(day,'yyyy-MM-dd'));
            const today = isToday(day);
            return (
              <div key={day} style={{ minHeight:80, padding:6, borderRadius:8, border:`1.5px solid ${today?'var(--red)':'var(--gray-200)'}`, background:today?'#fef2f2':'white' }}>
                <div style={{ fontSize:12,fontWeight:today?800:500,color:today?'var(--red)':'var(--gray-700)',marginBottom:4 }}>{format(day,'d')}</div>
                {ds.slice(0,3).map(s=><ShiftPill key={s.id} shift={s}/>)}
                {ds.length>3&&<div style={{ fontSize:9,color:'var(--gray-400)',fontWeight:600 }}>+{ds.length-3} more</div>}
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
          <h1 style={{ margin:0, fontSize:22, fontWeight:800 }}>Team Schedule</h1>
          <p style={{ margin:'4px 0 0', color:'var(--gray-500)', fontSize:14 }}>{getTitle()}</p>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
          {/* View toggle */}
          <div style={{ display:'flex', background:'var(--gray-100)', borderRadius:10, padding:3 }}>
            {[{v:'day',l:'Day'},{v:'week',l:'Week'},{v:'month',l:'Month'}].map(m=>(
              <button key={m.v} onClick={()=>{setView(m.v);setCurrent(new Date());}} style={{ padding:'6px 14px', borderRadius:8, border:'none', fontFamily:'inherit', fontSize:13, fontWeight:600, cursor:'pointer', background:view===m.v?'white':'transparent', color:view===m.v?'var(--gray-900)':'var(--gray-500)', boxShadow:view===m.v?'0 1px 3px rgba(0,0,0,0.12)':'none', transition:'all 0.15s' }}>{m.l}</button>
            ))}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={()=>navigate(-1)}>← Prev</button>
          <button className="btn btn-secondary btn-sm" onClick={()=>setCurrent(new Date())}>Today</button>
          <button className="btn btn-secondary btn-sm" onClick={()=>navigate(1)}>Next →</button>
        </div>
      </div>
      {view==='day' && <DayView/>}
      {view==='week' && <WeekView/>}
      {view==='month' && <MonthView/>}
    </div>
  );
}

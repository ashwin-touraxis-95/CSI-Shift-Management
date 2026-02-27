import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format, startOfMonth, endOfMonth, addMonths, eachDayOfInterval, getDay, isToday, isSameDay } from 'date-fns';
import { useAuth } from '../context/AuthContext';

export default function MySchedule() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [viewMonth, setViewMonth] = useState(new Date());
  const [showAll, setShowAll] = useState(false);
  const [allUsers, setAllUsers] = useState([]);

  useEffect(() => { fetchShifts(); }, [viewMonth, showAll]);

  const fetchShifts = async () => {
    const start = format(startOfMonth(viewMonth),'yyyy-MM-dd');
    const end = format(endOfMonth(viewMonth),'yyyy-MM-dd');
    const r = await axios.get(`/api/shifts?start=${start}&end=${end}`);
    setShifts(r.data);
    if (showAll) {
      try { const u = await axios.get('/api/users'); setAllUsers(u.data); } catch(e) {}
    }
  };

  const myShifts = showAll ? shifts : shifts.filter(s => s.user_id === user?.id);

  const days = eachDayOfInterval({ start: startOfMonth(viewMonth), end: endOfMonth(viewMonth) });
  const firstDayOfMonth = getDay(startOfMonth(viewMonth)); // 0=Sun
  const blanks = Array(firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1).fill(null); // Mon-start

  const getShiftsForDay = (day) => myShifts.filter(s => {
    try { return isSameDay(new Date(s.date + 'T00:00'), day); } catch { return false; }
  });

  const totalShifts = myShifts.length;
  const totalHours = myShifts.reduce((acc,s) => {
    try {
      const [sh,sm] = s.start_time.split(':').map(Number);
      const [eh,em] = s.end_time.split(':').map(Number);
      let h = (eh*60+em - sh*60-sm)/60;
      if (h < 0) h += 24;
      return acc + h;
    } catch { return acc; }
  }, 0);

  const WEEKDAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  return (
    <div>
      <div className="page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div><h1>My Schedule</h1><p>Your published shifts for {format(viewMonth,'MMMM yyyy')}{user?.timezone && user.timezone !== 'Africa/Johannesburg' && <span style={{fontSize:11,marginLeft:8,color:'#6B7280'}}>({user.timezone})</span>}</p></div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <button onClick={()=>setShowAll(s=>!s)} style={{ padding:'6px 14px', borderRadius:8, border:'none', background:showAll?'#C0392B':'#F1F5F9', color:showAll?'white':'#374151', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
            {showAll ? '👥 Team View' : '👤 My Shifts'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={()=>setViewMonth(m=>addMonths(m,-1))}>← Prev</button>
          <button className="btn btn-secondary btn-sm" onClick={()=>setViewMonth(new Date())}>This Month</button>
          <button className="btn btn-secondary btn-sm" onClick={()=>setViewMonth(m=>addMonths(m,1))}>Next →</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'flex', gap:16, marginBottom:24 }}>
        {[{ label:'Shifts This Month', value:totalShifts, icon:'📅' }, { label:'Total Hours', value:`${totalHours.toFixed(1)}h`, icon:'⏱' }, { label:'Department', value:user?.department, icon:'🏢' }].map(s =>
          <div key={s.label} className="card" style={{ padding:'16px 20px', flex:1 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:0.5 }}>{s.label}</div>
            <div style={{ fontSize:26, fontWeight:700, marginTop:4 }}>{s.icon} {s.value||'—'}</div>
          </div>
        )}
      </div>

      {/* Calendar */}
      <div className="card" style={{ padding:24 }}>
        {/* Header */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:8 }}>
          {WEEKDAYS.map(d => <div key={d} style={{ textAlign:'center', fontSize:12, fontWeight:700, color:'var(--gray-500)', padding:'6px 0' }}>{d}</div>)}
        </div>

        {/* Days grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
          {blanks.map((_,i) => <div key={`b${i}`} />)}
          {days.map(day => {
            const dayShifts = getShiftsForDay(day);
            const today = isToday(day);
            const isWeekend = getDay(day) === 0 || getDay(day) === 6;
            return (
              <div key={day.toString()} style={{ minHeight:80, padding:8, borderRadius:8, border:`1.5px solid ${today?'var(--red)':'var(--gray-200)'}`, background:today?'#fef2f2':isWeekend?'var(--gray-50)':'white', position:'relative' }}>
                <div style={{ fontSize:13, fontWeight: today?700:500, color: today?'var(--red)':'var(--gray-700)', marginBottom:4 }}>
                  {format(day,'d')}
                  {today && <span style={{ fontSize:9, marginLeft:4, background:'var(--red)', color:'white', padding:'1px 5px', borderRadius:8 }}>TODAY</span>}
                </div>
                {dayShifts.map(s => (
                  <div key={s.id} style={{ fontSize:10, padding:'3px 6px', borderRadius:4, background: s.user_id === user?.id ? 'var(--green)' : '#6366F1', color:'white', marginBottom:2, fontWeight:600, lineHeight:1.4 }}>
                    {showAll && <div style={{ opacity:0.9, fontWeight:700 }}>{s.user_name || 'Agent'}</div>}
                    <div>{s.start_time} – {s.end_time}</div>
                    <div style={{ opacity:0.85 }}>{s.department}</div>
                    {s.notes && <div style={{ opacity:0.7, fontStyle:'italic' }}>{s.notes}</div>}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming list view */}
      <div className="card" style={{ padding:24, marginTop:20 }}>
        <h3 style={{ fontWeight:700, marginBottom:16 }}>Upcoming Shifts — {format(viewMonth,'MMMM yyyy')}</h3>
        {shifts.length === 0
          ? <p style={{ color:'var(--gray-400)', textAlign:'center', padding:20 }}>No shifts scheduled this month</p>
          : <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
              <thead><tr style={{ borderBottom:'2px solid var(--gray-200)' }}>
                {['Date','Day','Start','End','Department','Notes'].map(h=><th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:12, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {[...shifts].sort((a,b)=>a.date.localeCompare(b.date)).map(s=>(
                  <tr key={s.id} style={{ borderBottom:'1px solid var(--gray-100)', background: isToday(new Date(s.date+'T00:00'))?'#fef2f2':'white' }}>
                    <td style={{ padding:'10px 12px', fontFamily:'DM Mono', fontSize:13 }}>{s.date}</td>
                    <td style={{ padding:'10px 12px' }}>{format(new Date(s.date+'T00:00'),'EEEE')}</td>
                    <td style={{ padding:'10px 12px', fontFamily:'DM Mono', color:'var(--green)', fontWeight:600 }}>{s.start_time}</td>
                    <td style={{ padding:'10px 12px', fontFamily:'DM Mono', color:'var(--red)', fontWeight:600 }}>{s.end_time}</td>
                    <td style={{ padding:'10px 12px' }}><span className={`badge dept-${s.department?.replace(' ','')}`}>{s.department}</span></td>
                    <td style={{ padding:'10px 12px', color:'var(--gray-500)' }}>{s.notes||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        }
      </div>
    </div>
  );
}

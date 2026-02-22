import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

export default function Dashboard() {
  const { user, can, isAdmin, isManager } = useAuth();
  const [clockStatus, setClockStatus] = useState({ clockedIn: false });
  const [clockMsg, setClockMsg] = useState('');
  const [stats, setStats] = useState({});
  const [todayShifts, setTodayShifts] = useState([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const [cs, shifts] = await Promise.all([
        axios.get('/api/clock/status'),
        axios.get(`/api/shifts?start=${today}&end=${today}`),
      ]);
      setClockStatus(cs.data);
      setTodayShifts(shifts.data);
      if (can('view_clock_logs')) {
        const avail = await axios.get('/api/availability');
        const online = avail.data.filter(u => u.status === 'available').length;
        setStats({ online, total: avail.data.length });
      }
    } catch(e) {}
  };

  const handleClock = async (action) => {
    try {
      const r = await axios.post(`/api/clock/${action}`);
      setClockMsg(r.data.message);
      fetchData();
      setTimeout(() => setClockMsg(''), 4000);
    } catch(e) { setClockMsg(e.response?.data?.error || 'Error'); }
  };

  const roleInfo = {
    account_admin: { greeting:'Welcome, Account Admin', sub:'You have full control over ShiftManager', icon:'🛡️', color:'#C0392B' },
    manager: { greeting:`Welcome back, ${user?.name?.split(' ')[0]}`, sub:'Manage your team\'s shifts and availability', icon:'👔', color:'#2980B9' },
    team_leader: { greeting:`Hi, ${user?.name?.split(' ')[0]}`, sub:'View your team\'s schedule and attendance', icon:'👥', color:'#8E44AD' },
    agent: { greeting:`Hi, ${user?.name?.split(' ')[0]}`, sub:'Clock in/out and view your schedule below', icon:'⚡', color:'#27AE60' },
  };
  const info = roleInfo[user?.role] || roleInfo.agent;

  return (
    <div>
      {/* Welcome banner */}
      <div style={{ background:`linear-gradient(135deg, #1a1a2e, ${info.color})`, borderRadius:14, padding:'24px 28px', marginBottom:24, color:'white', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ fontSize:40 }}>{info.icon}</div>
          <div>
            <h1 style={{ margin:0, fontSize:22, fontWeight:800 }}>{info.greeting}</h1>
            <p style={{ margin:'4px 0 0', opacity:0.7, fontSize:14 }}>{info.sub}</p>
          </div>
        </div>
        <div style={{ textAlign:'right', opacity:0.6, fontSize:13 }}>
          <div style={{ fontWeight:600 }}>{format(new Date(), 'EEEE')}</div>
          <div>{format(new Date(), 'd MMMM yyyy')}</div>
        </div>
      </div>

      {/* Stats row — admin/manager */}
      {(isManager || can('view_clock_logs')) && stats.total > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
          {[
            { label:'Online Now', value:`${stats.online} / ${stats.total}`, icon:'🟢', color:'var(--green)' },
            { label:"Today's Shifts", value:todayShifts.length, icon:'📅', color:'var(--red)' },
            { label:'Department', value:user?.department, icon:'🏢', color:'#8E44AD' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding:'18px 20px', borderLeft:`4px solid ${s.color}` }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:0.5 }}>{s.label}</div>
              <div style={{ fontSize:28, fontWeight:800, marginTop:6 }}>{s.icon} {s.value || '—'}</div>
            </div>
          ))}
        </div>
      )}

      {/* Clock in/out — for non-admin */}
      {user?.role !== 'account_admin' && (
        <div className="card" style={{ padding:28, marginBottom:24 }}>
          <h2 style={{ fontSize:17, fontWeight:700, marginBottom:6 }}>Clock In / Out</h2>
          <p style={{ color:'var(--gray-500)', fontSize:14, marginBottom:20 }}>
            {clockStatus.clockedIn ? `You clocked in at ${clockStatus.log?.clock_in ? new Date(clockStatus.log.clock_in).toLocaleTimeString('en-ZA', { hour:'2-digit', minute:'2-digit' }) : '—'}` : 'You are currently not clocked in.'}
          </p>
          {clockMsg && <div style={{ background:'#d4edda', border:'1px solid #c3e6cb', borderRadius:8, padding:'10px 14px', marginBottom:16, color:'#155724', fontSize:14 }}>✓ {clockMsg}</div>}
          <div style={{ display:'flex', gap:12 }}>
            <button className="btn btn-success" onClick={() => handleClock('in')} disabled={clockStatus.clockedIn} style={{ opacity:clockStatus.clockedIn?0.4:1 }}>⏱ Clock In</button>
            <button className="btn btn-danger" onClick={() => handleClock('out')} disabled={!clockStatus.clockedIn} style={{ opacity:!clockStatus.clockedIn?0.4:1 }}>⏹ Clock Out</button>
          </div>
        </div>
      )}

      {/* Today's shifts */}
      {todayShifts.length > 0 && (
        <div className="card" style={{ padding:24 }}>
          <h3 style={{ fontWeight:700, marginBottom:16 }}>Today's Shifts</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {todayShifts.map(s => (
              <div key={s.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', background:'var(--gray-50)', borderRadius:10, border:'1px solid var(--gray-200)' }}>
                <div style={{ fontFamily:'DM Mono', fontSize:14, color:'var(--green)', fontWeight:700, minWidth:110 }}>{s.start_time} – {s.end_time}</div>
                {isManager && <div style={{ fontWeight:600, fontSize:14 }}>{s.name}</div>}
                <div className={`badge dept-${s.department?.replace(' ','')}`}>{s.department}</div>
                {s.notes && <div style={{ fontSize:13, color:'var(--gray-500)' }}>{s.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin shortcuts */}
      {isAdmin && (
        <div className="card" style={{ padding:24, marginTop:20, background:'linear-gradient(135deg,#1a1a2e,#2d1b44)', color:'white' }}>
          <h3 style={{ fontWeight:700, marginBottom:16, color:'white' }}>🛡️ Admin Quick Actions</h3>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            {[
              { label:'Manage Permissions', link:'/admin', icon:'🔐' },
              { label:'Team Assignments', link:'/admin', icon:'👥' },
              { label:'Branding & Departments', link:'/admin', icon:'🎨' },
              { label:'Manage Team', link:'/team', icon:'👤' },
            ].map(a => (
              <a key={a.label} href={a.link} style={{ padding:'10px 16px', borderRadius:10, border:'1px solid rgba(255,255,255,0.15)', color:'white', textDecoration:'none', fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.07)' }}>
                {a.icon} {a.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

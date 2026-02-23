import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

export default function Dashboard() {
  const { user, can, isAdmin, isManager, isLeader } = useAuth();
  const [clockStatus, setClockStatus] = useState({ clockedIn: false });
  const [clockMsg, setClockMsg] = useState('');
  const [availability, setAvailability] = useState([]);
  const [viewMode, setViewMode] = useState('bubble'); // bubble | list
  const [todayShifts, setTodayShifts] = useState([]);
  const [perms, setPerms] = useState({});

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const [cs, av, sh] = await Promise.all([
        axios.get('/api/clock/status'),
        axios.get('/api/availability'),
        axios.get(`/api/shifts?start=${today}&end=${today}`),
      ]);
      setClockStatus(cs.data);
      setAvailability(av.data);
      setTodayShifts(sh.data);
      // get role permissions for stats display
      if (isAdmin) {
        setPerms({ show_shifts_this_month: true, show_total_hours: true });
      } else {
        const r = await axios.get('/api/settings/my-permissions');
        setPerms(r.data || {});
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

  const online = availability.filter(u => u.status === 'available');
  const offline = availability.filter(u => u.status !== 'available');
  const roleInfo = {
    account_admin: { greeting:'Welcome, Account Admin', sub:'Full control over ShiftManager', icon:'🛡️', color:'#C0392B' },
    manager: { greeting:`Welcome back, ${user?.name?.split(' ')[0]}`, sub:"Manage your team's shifts and availability", icon:'👔', color:'#2980B9' },
    team_leader: { greeting:`Hi, ${user?.name?.split(' ')[0]}`, sub:"View and manage your team", icon:'👥', color:'#8E44AD' },
    agent: { greeting:`Hi, ${user?.name?.split(' ')[0]}`, sub:'Clock in/out and see who\'s available', icon:'⚡', color:'#27AE60' },
  };
  const info = roleInfo[user?.user_type] || roleInfo.agent;
  const isAgent = user?.user_type === 'agent';

  const StatusCard = ({ u }) => (
    <div style={{ padding:'14px 16px', borderRadius:12, background:'white', border:'1px solid var(--gray-200)', display:'flex', alignItems:'center', gap:12, boxShadow:'0 1px 3px rgba(0,0,0,0.05)' }}>
      {u.avatar ? <img src={u.avatar} alt="" style={{ width:40, height:40, borderRadius:'50%' }} />
        : <div style={{ width:40, height:40, borderRadius:'50%', background: u.status==='available'?'var(--green)':'var(--gray-300)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:16 }}>{u.name?.[0]}</div>}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:600, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{u.name}</div>
        <div style={{ fontSize:12, color:'var(--gray-500)' }}>{u.department}</div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <div style={{ width:8, height:8, borderRadius:'50%', background: u.status==='available'?'var(--green)':'var(--gray-400)' }} />
        <span style={{ fontSize:12, fontWeight:600, color: u.status==='available'?'var(--green)':'var(--gray-400)' }}>
          {u.status==='available' ? 'Online' : 'Offline'}
        </span>
      </div>
    </div>
  );

  const StatusRow = ({ u }) => (
    <div style={{ display:'flex', alignItems:'center', gap:14, padding:'10px 16px', borderBottom:'1px solid var(--gray-100)', background:'white' }}>
      {u.avatar ? <img src={u.avatar} alt="" style={{ width:32, height:32, borderRadius:'50%' }} />
        : <div style={{ width:32, height:32, borderRadius:'50%', background: u.status==='available'?'var(--green)':'var(--gray-300)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:13 }}>{u.name?.[0]}</div>}
      <div style={{ flex:1 }}><span style={{ fontWeight:600, fontSize:14 }}>{u.name}</span></div>
      <div style={{ fontSize:13, color:'var(--gray-500)', minWidth:120 }}>{u.department}</div>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <div style={{ width:8, height:8, borderRadius:'50%', background: u.status==='available'?'var(--green)':'var(--gray-400)' }} />
        <span style={{ fontSize:13, fontWeight:600, color: u.status==='available'?'var(--green)':'var(--gray-400)', minWidth:60 }}>
          {u.status==='available' ? 'Online' : 'Offline'}
        </span>
      </div>
      {u.clocked_in_at && u.status==='available' && (
        <div style={{ fontSize:11, color:'var(--gray-400)', fontFamily:'DM Mono' }}>
          since {new Date(u.clocked_in_at).toLocaleTimeString('en-ZA',{hour:'2-digit',minute:'2-digit'})}
        </div>
      )}
    </div>
  );

  return (
    <div>
      {/* Welcome banner */}
      <div style={{ background:`linear-gradient(135deg, #1a1a2e, ${info.color})`, borderRadius:14, padding:'22px 28px', marginBottom:24, color:'white', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ fontSize:38 }}>{info.icon}</div>
          <div>
            <h1 style={{ margin:0, fontSize:22, fontWeight:800 }}>{info.greeting}</h1>
            <p style={{ margin:'4px 0 0', opacity:0.7, fontSize:14 }}>{info.sub}</p>
          </div>
        </div>
        <div style={{ textAlign:'right', opacity:0.6, fontSize:13 }}>
          <div style={{ fontWeight:600 }}>{format(new Date(),'EEEE')}</div>
          <div>{format(new Date(),'d MMMM yyyy')}</div>
        </div>
      </div>

      {/* Stats — controlled by permissions */}
      {(!isAgent || perms.show_shifts_this_month || perms.show_total_hours) && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
          <div className="card" style={{ padding:'16px 20px', borderLeft:'4px solid var(--green)' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:0.5 }}>Online Now</div>
            <div style={{ fontSize:26, fontWeight:800, marginTop:6 }}>🟢 {online.length} / {availability.length}</div>
          </div>
          {(isAdmin || perms.show_shifts_this_month) && (
            <div className="card" style={{ padding:'16px 20px', borderLeft:'4px solid var(--red)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:0.5 }}>Today's Shifts</div>
              <div style={{ fontSize:26, fontWeight:800, marginTop:6 }}>📅 {todayShifts.length}</div>
            </div>
          )}
          {(isAdmin || perms.show_total_hours) && (
            <div className="card" style={{ padding:'16px 20px', borderLeft:'4px solid #8E44AD' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:0.5 }}>Department</div>
              <div style={{ fontSize:26, fontWeight:800, marginTop:6 }}>🏢 {user?.department}</div>
            </div>
          )}
        </div>
      )}

      {/* Clock in/out */}
      {user?.user_type !== 'account_admin' && (
        <div className="card" style={{ padding:24, marginBottom:24 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <div>
              <h2 style={{ fontSize:16, fontWeight:700, margin:'0 0 4px' }}>Clock In / Out</h2>
              <p style={{ color:'var(--gray-500)', fontSize:13, margin:0 }}>
                {clockStatus.clockedIn
                  ? `✅ You clocked in at ${clockStatus.log?.clock_in ? new Date(clockStatus.log.clock_in).toLocaleTimeString('en-ZA',{hour:'2-digit',minute:'2-digit'}) : '—'}`
                  : '⭕ You are not clocked in'}
              </p>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-success" onClick={() => handleClock('in')} disabled={clockStatus.clockedIn} style={{ opacity:clockStatus.clockedIn?0.4:1 }}>⏱ Clock In</button>
              <button className="btn btn-danger" onClick={() => handleClock('out')} disabled={!clockStatus.clockedIn} style={{ opacity:!clockStatus.clockedIn?0.4:1 }}>⏹ Clock Out</button>
            </div>
          </div>
          {clockMsg && <div style={{ background:'#d4edda', borderRadius:8, padding:'8px 14px', marginTop:12, color:'#155724', fontSize:13 }}>✓ {clockMsg}</div>}
        </div>
      )}

      {/* Availability Board */}
      <div className="card" style={{ padding:24 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
          <div>
            <h2 style={{ fontSize:16, fontWeight:700, margin:'0 0 2px' }}>Team Availability</h2>
            <p style={{ fontSize:13, color:'var(--gray-500)', margin:0 }}>{online.length} online · {offline.length} offline · {availability.length} total</p>
          </div>
          {/* View toggle */}
          <div style={{ display:'flex', background:'var(--gray-100)', borderRadius:10, padding:3 }}>
            {[{v:'bubble',l:'⬜ Bubbles'},{v:'list',l:'☰ List'}].map(m => (
              <button key={m.v} onClick={() => setViewMode(m.v)} style={{ padding:'6px 16px', borderRadius:8, border:'none', fontFamily:'inherit', fontSize:13, fontWeight:600, cursor:'pointer', background:viewMode===m.v?'white':'transparent', color:viewMode===m.v?'var(--gray-900)':'var(--gray-500)', boxShadow:viewMode===m.v?'0 1px 3px rgba(0,0,0,0.12)':'none', transition:'all 0.15s' }}>{m.l}</button>
            ))}
          </div>
        </div>

        {availability.length === 0 ? (
          <div style={{ textAlign:'center', padding:40, color:'var(--gray-400)' }}>No team members found</div>
        ) : viewMode === 'bubble' ? (
          <div>
            {online.length > 0 && <>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--green)', textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>● Online ({online.length})</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:10, marginBottom:20 }}>
                {online.map(u => <StatusCard key={u.id} u={u} />)}
              </div>
            </>}
            {offline.length > 0 && <>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>● Offline ({offline.length})</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:10 }}>
                {offline.map(u => <StatusCard key={u.id} u={u} />)}
              </div>
            </>}
          </div>
        ) : (
          <div style={{ borderRadius:10, overflow:'hidden', border:'1px solid var(--gray-200)' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 120px 120px', padding:'8px 16px', background:'var(--gray-50)', borderBottom:'2px solid var(--gray-200)' }}>
              {['Name','Department','Status','Clocked In'].map(h => <div key={h} style={{ fontSize:11, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:0.5 }}>{h}</div>)}
            </div>
            {[...online,...offline].map(u => (
              <div key={u.id} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 120px 120px', padding:'10px 16px', borderBottom:'1px solid var(--gray-100)', background:'white', alignItems:'center' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  {u.avatar ? <img src={u.avatar} alt="" style={{ width:30, height:30, borderRadius:'50%' }} />
                    : <div style={{ width:30, height:30, borderRadius:'50%', background:u.status==='available'?'var(--green)':'var(--gray-300)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:12 }}>{u.name?.[0]}</div>}
                  <span style={{ fontWeight:600, fontSize:14 }}>{u.name}</span>
                </div>
                <div style={{ fontSize:13, color:'var(--gray-600)' }}>{u.department}</div>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:7, height:7, borderRadius:'50%', background:u.status==='available'?'var(--green)':'var(--gray-400)' }} />
                  <span style={{ fontSize:13, fontWeight:600, color:u.status==='available'?'var(--green)':'var(--gray-400)' }}>{u.status==='available'?'Online':'Offline'}</span>
                </div>
                <div style={{ fontSize:12, color:'var(--gray-400)', fontFamily:'DM Mono' }}>
                  {u.clocked_in_at && u.status==='available' ? new Date(u.clocked_in_at).toLocaleTimeString('en-ZA',{hour:'2-digit',minute:'2-digit'}) : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Admin quick actions */}
      {isAdmin && (
        <div className="card" style={{ padding:24, marginTop:20, background:'linear-gradient(135deg,#1a1a2e,#2d1b44)', color:'white' }}>
          <h3 style={{ fontWeight:700, marginBottom:16, color:'white', fontSize:15 }}>🛡️ Admin Quick Actions</h3>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {[{label:'Permissions',link:'/admin',icon:'🔐'},{label:'Team Assignments',link:'/admin',icon:'👥'},{label:'Branding',link:'/admin',icon:'🎨'},{label:'Manage Team',link:'/team',icon:'👤'}].map(a => (
              <a key={a.label} href={a.link} style={{ padding:'9px 16px', borderRadius:10, border:'1px solid rgba(255,255,255,0.15)', color:'white', textDecoration:'none', fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.07)' }}>{a.icon} {a.label}</a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

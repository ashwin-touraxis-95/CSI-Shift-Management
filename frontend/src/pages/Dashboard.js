import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import io from 'socket.io-client';

const socket = io(process.env.NODE_ENV === 'production' ? 'https://csi-shift-app.up.railway.app' : 'http://localhost:5000');

export default function Dashboard() {
  const { user, can, theme } = useAuth();
  const [availability, setAvailability] = useState([]);
  const [clockStatus, setClockStatus] = useState({ clockedIn: false });
  const [breakStatus, setBreakStatus] = useState({ onBreak: false, currentBreak: null, todayBreaks: [] });
  const [breakTypes, setBreakTypes] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [viewMode, setViewMode] = useState('list');
  const [deptFilter, setDeptFilter] = useState('all');
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [openOverride, setOpenOverride] = useState(null);
  const overrideRef = useRef(null);

  const isAdmin = user?.user_type === 'account_admin';
  const isManager = user?.user_type === 'manager';
  const isLeader = user?.user_type === 'team_leader';
  const isAgent = user?.user_type === 'agent';
  const canOverride = isAdmin || isManager || isLeader;
  const showClockPanel = !isAdmin && !isManager;
  const primary = theme?.primary_color || '#C0392B';

  const showMsg = (text, type = 'success') => { setMsg({ text, type }); setTimeout(() => setMsg(''), 3500); };

  const fetchAll = useCallback(async () => {
    try {
      const [av, bt, sh, dept] = await Promise.all([
        axios.get('/api/availability'),
        axios.get('/api/break-types'),
        axios.get('/api/shifts'),
        axios.get('/api/departments'),
      ]);
      setAvailability(av.data);
      setBreakTypes(bt.data);
      setShifts(sh.data);
      setDepartments(dept.data);
      if (!isAdmin && !isManager) {
        const [cs, bs] = await Promise.all([
          axios.get('/api/clock/status'),
          axios.get('/api/breaks/status'),
        ]);
        setClockStatus(cs.data);
        setBreakStatus(bs.data);
      }
    } catch (e) {}
  }, [isAdmin, isManager]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => {
    socket.on('availability_update', fetchAll);
    return () => socket.off('availability_update', fetchAll);
  }, [fetchAll]);

  // Close override popup on outside click - track both the popup and all override buttons
  const overrideContainerRef = useRef(null);
  useEffect(() => {
    const handle = (e) => {
      // Close if clicking outside any override-related element
      if (openOverride && overrideRef.current && !overrideRef.current.contains(e.target) &&
          !e.target.closest('[data-override-btn]')) {
        setOpenOverride(null);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [openOverride]);

  const handleClockIn = async () => {
    if (loading) return; setLoading(true);
    try { await axios.post('/api/clock/in'); fetchAll(); showMsg('Clocked in! ✅'); }
    catch (e) { showMsg(e.response?.data?.error || 'Error', 'error'); }
    setLoading(false);
  };
  const handleClockOut = async () => {
    if (loading) return;
    if (breakStatus.onBreak) return showMsg('End your break before clocking out', 'error');
    setLoading(true);
    try { await axios.post('/api/clock/out'); fetchAll(); showMsg('Clocked out 👋'); }
    catch (e) { showMsg(e.response?.data?.error || 'Error', 'error'); }
    setLoading(false);
  };
  const handleStartBreak = async (btId) => {
    if (loading) return; setLoading(true);
    try { const r = await axios.post('/api/breaks/start', { break_type_id: btId }); fetchAll(); showMsg(`${r.data.breakType.icon} ${r.data.breakType.name} started`); }
    catch (e) { showMsg(e.response?.data?.error || 'Error', 'error'); }
    setLoading(false);
  };
  const handleEndBreak = async () => {
    if (loading) return; setLoading(true);
    try { const r = await axios.post('/api/breaks/end'); fetchAll(); showMsg(`Break ended — ${r.data.durationMinutes} min`); }
    catch (e) { showMsg(e.response?.data?.error || 'Error', 'error'); }
    setLoading(false);
  };

  // Override actions - keep popup open so manager can take multiple actions
  const overrideAction = async (endpoint, body, successMsg) => {
    try { 
      await axios.post(endpoint, body); 
      await fetchAll(); 
      showMsg(successMsg); 
      // Don't close popup - let manager keep working on same agent
    }
    catch (e) { showMsg(e.response?.data?.error || 'Error', 'error'); }
  };

  const statusColor = (u) => {
    if (u.status === 'available') return theme?.online_color || '#22C55E';
    if (u.status === 'on_break') return u.break_type_color || '#F59E0B';
    return theme?.offline_color || '#94A3B8';
  };

  const today = new Date().toISOString().split('T')[0];
  const filtered = deptFilter === 'all' ? availability : availability.filter(u => u.department === deptFilter);
  const online = filtered.filter(u => u.status === 'available');
  const onBreak = filtered.filter(u => u.status === 'on_break');
  const offline = filtered.filter(u => !u.status || u.status === 'offline');

  const OverridePopup = ({ agent }) => {
    const isOffline = !agent.status || agent.status === 'offline';
    const isOnline = agent.status === 'available';
    const isBreaking = agent.status === 'on_break';
    return (
      <div ref={overrideRef} style={{ position:'absolute', right:0, top:36, background:'white', border:'1px solid #E2E8F0', borderRadius:12, padding:14, boxShadow:'0 8px 28px rgba(0,0,0,0.12)', zIndex:200, minWidth:230 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:0.5, marginBottom:10 }}>
          Override — {agent.name?.split(' ')[0]}
        </div>

        {/* Active break indicator */}
        {isBreaking && (
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', background:`${agent.break_type_color}15`, borderRadius:8, marginBottom:10, fontSize:12, fontWeight:600, color:agent.break_type_color }}>
            <span style={{ fontSize:16 }}>{agent.break_type_icon}</span>
            <span>{agent.break_type_name} in progress</span>
          </div>
        )}

        {/* Clock In */}
        {isOffline && (
          <button onClick={() => overrideAction('/api/override/clock-in', { user_id: agent.id }, `${agent.name?.split(' ')[0]} clocked in ✅`)}
            style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:'none', background:'#F0FDF4', color:'#16A34A', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', textAlign:'left', display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
            🟢 Clock In Agent
          </button>
        )}

        {/* Break types — shown when online OR on break (switch break) */}
        {(isOnline || isBreaking) && (
          <div style={{ marginBottom:8 }}>
            <div style={{ fontSize:10, fontWeight:700, color:primary, textTransform:'uppercase', letterSpacing:0.5, marginBottom:6 }}>
              {isBreaking ? 'Switch Break' : 'Mark on Break'}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
              {breakTypes.filter(bt => isBreaking ? bt.id !== agent.break_type_id : true).map(bt => (
                <button key={bt.id} onClick={() => overrideAction('/api/override/start-break', { user_id: agent.id, break_type_id: bt.id }, `${agent.name?.split(' ')[0]} on ${bt.name}`)}
                  style={{ padding:'7px 10px', borderRadius:8, border:`1.5px solid ${bt.color}30`, background:`${bt.color}10`, color:'#374151', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
                  <span>{bt.icon}</span><span>{bt.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* End break — if on break */}
        {isBreaking && (
          <>
            <div style={{ height:1, background:'#F1F5F9', margin:'8px 0' }}/>
            <button onClick={() => overrideAction('/api/override/end-break', { user_id: agent.id }, `Break ended for ${agent.name?.split(' ')[0]}`)}
              style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:'none', background:'#F0FDF4', color:'#16A34A', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', textAlign:'left', display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              ✅ End Break — Mark Available
            </button>
          </>
        )}

        {/* Clock Out — always at the bottom */}
        {(isOnline || isBreaking) && (
          <>
            <div style={{ height:1, background:'#F1F5F9', margin:'8px 0' }}/>
            <button onClick={() => overrideAction('/api/override/clock-out', { user_id: agent.id }, `${agent.name?.split(' ')[0]} clocked out`)}
              style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:'none', background:'#FFF5F5', color:'#DC2626', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', textAlign:'left', display:'flex', alignItems:'center', gap:8 }}>
              🔴 Clock Out Agent
            </button>
          </>
        )}
      </div>
    );
  };

  const AgentRow = ({ agent }) => {
    const isBreaking = agent.status === 'on_break';
    const breakMins = isBreaking && agent.break_started_at
      ? Math.round((new Date() - new Date(agent.break_started_at)) / 60000) : null;
    return (
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 20px', borderBottom:'1px solid #F9FAFB', background: isBreaking ? `${agent.break_type_color}08` : 'white' }}>
        <div style={{ position:'relative', flexShrink:0 }}>
          {agent.avatar
            ? <img src={agent.avatar} alt="" style={{ width:36, height:36, borderRadius:'50%' }}/>
            : <div style={{ width:36, height:36, borderRadius:'50%', background:primary, color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:14 }}>{agent.name?.[0]}</div>}
          <div style={{ position:'absolute', bottom:0, right:0, width:11, height:11, borderRadius:'50%', background:statusColor(agent), border:'2px solid white' }}/>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:600, fontSize:13 }}>{agent.name}</div>
          <div style={{ fontSize:11, color:'#9CA3AF', marginTop:1 }}>
            {agent.department}
            {isBreaking && agent.break_type_name && (
              canOverride
                ? ` · ${agent.break_type_icon || ''} ${agent.break_type_name}${breakMins !== null ? ` · ${breakMins} min` : ''}`
                : ` · ${agent.break_type_icon || ''} ${agent.break_type_name}`
            )}
          </div>
        </div>
        <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600, background:'#F1F5F9', color:'#6B7280' }}>{agent.department}</span>
        {isBreaking
          ? <span style={{ padding:'4px 10px', borderRadius:20, fontSize:12, fontWeight:700, background:`${agent.break_type_color}20`, color:agent.break_type_color }}>{agent.break_type_icon} {agent.break_type_name}{canOverride && breakMins !== null ? ` · ${breakMins}m` : ''}</span>
          : <span style={{ fontSize:12, fontWeight:600, color:statusColor(agent) }}>{agent.status === 'available' ? 'Available' : 'Offline'}</span>}
        {canOverride && (
          <div style={{ position:'relative' }}>
            <button data-override-btn="true" onClick={() => setOpenOverride(openOverride === agent.id ? null : agent.id)}
              style={{ padding:'5px 10px', borderRadius:7, border:'1px solid #E2E8F0', background:'white', fontSize:11, fontWeight:600, cursor:'pointer', color:'#6B7280', fontFamily:'inherit' }}>
              ⚙ Override
            </button>
            {openOverride === agent.id && <OverridePopup agent={agent}/>}
          </div>
        )}
      </div>
    );
  };

  const BubbleUser = ({ agent }) => (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, padding:'12px 8px', borderRadius:12, background:'white', border:'1px solid #F1F5F9', minWidth:80, maxWidth:90, textAlign:'center' }}>
      <div style={{ position:'relative' }}>
        {agent.avatar ? <img src={agent.avatar} alt="" style={{ width:44, height:44, borderRadius:'50%' }}/>
          : <div style={{ width:44, height:44, borderRadius:'50%', background:primary, color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:17 }}>{agent.name?.[0]}</div>}
        <div style={{ position:'absolute', bottom:0, right:0, width:13, height:13, borderRadius:'50%', background:statusColor(agent), border:'2px solid white' }}/>
      </div>
      <div style={{ fontSize:11, fontWeight:600, lineHeight:1.2, wordBreak:'break-word' }}>{agent.name?.split(' ')[0]}</div>
      {agent.status === 'on_break' && <div style={{ fontSize:10, color:agent.break_type_color }}>{agent.break_type_name}</div>}
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ background:`linear-gradient(135deg,#1a1a2e,${primary})`, borderRadius:14, padding:'22px 28px', marginBottom:24, color:'white', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:800 }}>
            {isAdmin ? '🛡️ Admin Dashboard' : isManager ? '👔 Manager Dashboard' : isLeader ? '👥 Team Leader Dashboard' : '⚡ My Dashboard'}
          </h1>
          <p style={{ margin:'4px 0 0', opacity:0.6, fontSize:13 }}>
            {new Date().toLocaleDateString('en-ZA', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
          </p>
        </div>
        <div style={{ textAlign:'right', fontSize:13, opacity:0.7 }}>
          <div>{user?.name}</div>
          <div style={{ fontSize:11, marginTop:2, opacity:0.7, textTransform:'capitalize' }}>{user?.user_type?.replace('_', ' ')}</div>
        </div>
      </div>

      {msg && (
        <div style={{ background:msg.type==='error'?'#FEE2E2':'#D1FAE5', border:`1px solid ${msg.type==='error'?'#FECACA':'#A7F3D0'}`, borderRadius:10, padding:'12px 18px', marginBottom:16, color:msg.type==='error'?'#991B1B':'#065F46', fontWeight:600, fontSize:14 }}>
          {msg.text}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:showClockPanel ? '1fr 320px' : '1fr', gap:24, alignItems:'start' }}>

        {/* Availability board */}
        <div>
          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:12, marginBottom:20 }}>
            {[
              { label:'Online', value:online.length, color:theme?.online_color||'#22C55E', icon:'Online' },
              { label:'On Break', value:onBreak.length, color:'#F59E0B', icon:'On Break' },
              { label:'Offline', value:offline.length, color:theme?.offline_color||'#94A3B8', icon:'Offline' },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding:'14px 18px', borderLeft:`4px solid ${s.color}` }}>
                <div style={{ fontSize:22, fontWeight:800, color:s.color }}>{s.value}</div>
                <div style={{ fontSize:12, color:'#6B7280', marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Board */}
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #F1F5F9', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
              <h3 style={{ margin:0, fontWeight:700, fontSize:16 }}>Live Availability</h3>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
                  style={{ padding:'5px 12px', borderRadius:8, border:'1px solid #E2E8F0', fontSize:12, fontFamily:'inherit', background:'white', color:'#374151' }}>
                  <option value="all">All Departments</option>
                  {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
                {['list','bubble'].map(m => (
                  <button key={m} onClick={() => setViewMode(m)}
                    style={{ padding:'5px 12px', borderRadius:8, border:'none', background:viewMode===m?primary:'#F1F5F9', color:viewMode===m?'white':'#6B7280', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>
                    {m === 'list' ? '☰ List' : 'Bubbles'}
                  </button>
                ))}
              </div>
            </div>

            {viewMode === 'list' ? (
              <div>
                {online.length > 0 && <><div style={{ padding:'10px 20px 4px', fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:0.8 }}>Online ({online.length})</div>{online.map(u => <AgentRow key={u.id} agent={u}/>)}</>}
                {onBreak.length > 0 && <><div style={{ padding:'10px 20px 4px', fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:0.8 }}>On Break ({onBreak.length})</div>{onBreak.map(u => <AgentRow key={u.id} agent={u}/>)}</>}
                {offline.length > 0 && <><div style={{ padding:'10px 20px 4px', fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:0.8 }}>Offline ({offline.length})</div>{offline.map(u => <AgentRow key={u.id} agent={u}/>)}</>}
                {filtered.length === 0 && <div style={{ padding:40, textAlign:'center', color:'#9CA3AF' }}>No team members found</div>}
              </div>
            ) : (
              <div style={{ padding:16 }}>
                {online.length > 0 && <><div style={{ fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', marginBottom:8 }}>Online</div><div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16 }}>{online.map(u => <BubbleUser key={u.id} agent={u}/>)}</div></>}
                {onBreak.length > 0 && <><div style={{ fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', marginBottom:8 }}>On Break</div><div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16 }}>{onBreak.map(u => <BubbleUser key={u.id} agent={u}/>)}</div></>}
                {offline.length > 0 && <><div style={{ fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', marginBottom:8 }}>Offline</div><div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>{offline.map(u => <BubbleUser key={u.id} agent={u}/>)}</div></>}
              </div>
            )}
          </div>
        </div>

        {/* Clock + break panel (agents and team leaders only) */}
        {showClockPanel && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div className="card" style={{ padding:24 }}>
              <h3 style={{ margin:'0 0 16px', fontWeight:700, fontSize:16 }}>Time & Attendance</h3>
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderRadius:10, background:clockStatus.clockedIn?'#D1FAE5':'#F1F5F9', marginBottom:16, border:`1px solid ${clockStatus.clockedIn?'#A7F3D0':'#E2E8F0'}` }}>
                <div style={{ width:10, height:10, borderRadius:'50%', background:clockStatus.clockedIn?'#22C55E':'#94A3B8' }}/>
                <span style={{ fontWeight:700, fontSize:14, color:clockStatus.clockedIn?'#065F46':'#6B7280' }}>
                  {clockStatus.clockedIn ? 'You are clocked in' : 'You are clocked out'}
                </span>
              </div>
              {!clockStatus.clockedIn
                ? <button onClick={handleClockIn} disabled={loading} style={{ width:'100%', padding:14, borderRadius:10, background:'#22C55E', color:'white', border:'none', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>🟢 Clock In</button>
                : <button onClick={handleClockOut} disabled={loading || breakStatus.onBreak} style={{ width:'100%', padding:14, borderRadius:10, background:breakStatus.onBreak?'#94A3B8':primary, color:'white', border:'none', fontSize:15, fontWeight:700, cursor:breakStatus.onBreak?'not-allowed':'pointer', fontFamily:'inherit' }} title={breakStatus.onBreak?'End your break first':''}>
                    🔴 Clock Out{breakStatus.onBreak ? ' (end break first)' : ''}
                  </button>}
            </div>

            {clockStatus.clockedIn && (
              <div className="card" style={{ padding:24 }}>
                <h3 style={{ margin:'0 0 4px', fontWeight:700, fontSize:16 }}>Breaks</h3>
                <p style={{ margin:'0 0 16px', fontSize:12, color:'#9CA3AF' }}>
                  {breakStatus.onBreak ? `On ${breakStatus.currentBreak?.break_type_name} — click End Break when done` : 'Select a break to start'}
                </p>
                {breakStatus.onBreak ? (
                  <div>
                    <div style={{ padding:'14px 16px', borderRadius:10, background:`${breakStatus.currentBreak?.break_type_color}15`, border:`2px solid ${breakStatus.currentBreak?.break_type_color}`, marginBottom:14, textAlign:'center' }}>
                      <div style={{ fontSize:28, marginBottom:4 }}>{breakStatus.currentBreak?.break_type_icon}</div>
                      <div style={{ fontWeight:700, fontSize:15, color:breakStatus.currentBreak?.break_type_color }}>{breakStatus.currentBreak?.break_type_name}</div>
                      <div style={{ fontSize:12, color:'#9CA3AF', marginTop:4 }}>
                        Started {new Date(breakStatus.currentBreak?.started_at).toLocaleTimeString('en-ZA', { hour:'2-digit', minute:'2-digit' })}
                      </div>
                    </div>
                    <button onClick={handleEndBreak} disabled={loading} style={{ width:'100%', padding:12, borderRadius:10, background:'#22C55E', color:'white', border:'none', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                      End Break
                    </button>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {breakTypes.map(bt => (
                      <button key={bt.id} onClick={() => handleStartBreak(bt.id)} disabled={loading}
                        style={{ padding:'11px 16px', borderRadius:10, border:`2px solid ${bt.color}20`, background:`${bt.color}10`, color:'#374151', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:10, textAlign:'left' }}>
                        <span style={{ fontSize:18 }}>{bt.icon}</span>
                        <span>{bt.name}</span>
                        {bt.max_minutes && <span style={{ marginLeft:'auto', fontSize:11, color:'#9CA3AF' }}>max {bt.max_minutes}m</span>}
                      </button>
                    ))}
                  </div>
                )}
                {breakStatus.todayBreaks?.filter(b => b.ended_at).length > 0 && (
                  <div style={{ marginTop:16, paddingTop:16, borderTop:'1px solid #F1F5F9' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', marginBottom:8 }}>Today</div>
                    {breakStatus.todayBreaks.filter(b => b.ended_at).map(b => (
                      <div key={b.id} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'#6B7280', marginBottom:4 }}>
                        <span>{b.break_type_icon}</span><span>{b.break_type_name}</span>
                        <span style={{ marginLeft:'auto' }}>{b.duration_minutes}m</span>
                      </div>
                    ))}
                    <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginTop:6, paddingTop:6, borderTop:'1px solid #F1F5F9', display:'flex', justifyContent:'space-between' }}>
                      <span>Total</span>
                      <span>{breakStatus.todayBreaks.filter(b => b.ended_at).reduce((a, b) => a + (b.duration_minutes || 0), 0)}m</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

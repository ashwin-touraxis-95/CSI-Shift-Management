import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

const socket = io(process.env.NODE_ENV === 'production' ? 'https://csi-shift-app.up.railway.app' : 'http://localhost:5000');

export default function Display() {
  const [pinInput, setPinInput] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState('');
  const [agents, setAgents] = useState([]);
  const [theme, setTheme] = useState({});
  const [time, setTime] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const pinRef = useRef();

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    axios.get('/api/theme').then(r => setTheme(r.data)).catch(() => {});
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      const r = await axios.get('/api/display/availability');
      setAgents(Array.isArray(r.data) ? r.data : []);
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    fetchAgents();
    socket.on('availability_update', fetchAgents);
    return () => socket.off('availability_update', fetchAgents);
  }, [unlocked, fetchAgents]);

  const handlePin = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const r = await axios.post('/api/display/verify-pin', { pin: pinInput });
      if (r.data.ok) setUnlocked(true);
      else { setError('Incorrect PIN'); setPinInput(''); pinRef.current?.focus(); }
    } catch { setError('Incorrect PIN'); setPinInput(''); }
    setLoading(false);
  };

  const primary = theme.primary_color || '#C0392B';
  const bg = theme.sidebar_bg || '#0D1117';
  const online = agents.filter(a => a.status === 'available');
  const onBreak = agents.filter(a => a.status === 'on_break');
  const offline = agents.filter(a => !a.status || a.status === 'offline');
  const AVATAR_COLORS = ['#C0392B','#2980B9','#8E44AD','#16A085','#E67E22','#27AE60','#E74C3C','#1ABC9C'];
  const avatarColor = (name) => AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];

  if (!unlocked) {
    return (
      <div style={{ minHeight:'100vh', background:bg, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:'inherit' }}>
        <div style={{ textAlign:'center', marginBottom:40 }}>
          {theme.company_logo
            ? <img src={theme.company_logo} alt="" style={{ width:80, height:80, borderRadius:16, objectFit:'contain', background:'white', padding:8, marginBottom:20, display:'block', margin:'0 auto 20px' }}/>
            : <div style={{ width:80, height:80, borderRadius:16, background:primary, display:'flex', alignItems:'center', justifyContent:'center', fontSize:36, margin:'0 auto 20px' }}>🏢</div>}
          <h1 style={{ color:'white', fontSize:28, fontWeight:800, margin:'0 0 6px' }}>{theme.company_name || 'ShiftManager'}</h1>
          <p style={{ color:'rgba(255,255,255,0.4)', fontSize:15, margin:0 }}>Display Screen</p>
        </div>
        <form onSubmit={handlePin} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:16, padding:40, width:320, textAlign:'center' }}>
          <p style={{ color:'rgba(255,255,255,0.5)', fontSize:14, marginTop:0, marginBottom:20 }}>Enter display PIN to continue</p>
          <input ref={pinRef} type="password" inputMode="numeric" maxLength={8} value={pinInput}
            onChange={e => setPinInput(e.target.value)} placeholder="••••" autoFocus
            style={{ width:'100%', padding:'14px', borderRadius:10, border:'1.5px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.07)', color:'white', fontSize:22, textAlign:'center', letterSpacing:8, outline:'none', fontFamily:'inherit', marginBottom:16, boxSizing:'border-box' }}/>
          {error && <div style={{ color:'#f87171', fontSize:13, marginBottom:12 }}>{error}</div>}
          <button type="submit" disabled={loading||!pinInput} style={{ width:'100%', padding:13, borderRadius:10, background:primary, color:'white', border:'none', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit', opacity:loading||!pinInput?0.5:1 }}>
            {loading ? 'Checking...' : 'Enter'}
          </button>
        </form>
      </div>
    );
  }

  const AgentCard = ({ agent, statusColor }) => (
    <div style={{ padding:'14px 16px', borderRadius:12, marginBottom:10, border:'1px solid rgba(255,255,255,0.07)', borderLeft:`3px solid ${statusColor}`, background:'rgba(255,255,255,0.04)', display:'flex', alignItems:'center', gap:14 }}>
      <div style={{ width:44, height:44, borderRadius:'50%', background:avatarColor(agent.name), color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:17, flexShrink:0, border:`2px solid ${statusColor}`, overflow:'hidden' }}>
        {agent.avatar ? <img src={agent.avatar} alt="" style={{ width:44, height:44, borderRadius:'50%' }}/> : agent.name?.[0]}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:700, fontSize:16, color:'white', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{agent.name}</div>
        <div style={{ fontSize:12, marginTop:3 }}>
          {agent.status === 'on_break'
            ? <span style={{ color:'#F59E0B', fontWeight:600 }}>{agent.break_type_icon} {agent.break_type_name}</span>
            : <span style={{ color:'rgba(255,255,255,0.35)' }}>{agent.department}</span>}
        </div>
      </div>
    </div>
  );

  const ColHeader = ({ label, count, color, pulse }) => (
    <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', gap:10 }}>
      <div style={{ width:11, height:11, borderRadius:'50%', background:color, boxShadow:pulse?`0 0 8px ${color}`:'none', animation:pulse?'pulse 2s infinite':'none', flexShrink:0 }}/>
      <div style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:1.5, color:'rgba(255,255,255,0.35)' }}>{label}</div>
      <div style={{ marginLeft:'auto', fontSize:12, fontWeight:700, fontFamily:'monospace', background:'rgba(255,255,255,0.07)', padding:'2px 10px', borderRadius:10, color:'rgba(255,255,255,0.4)' }}>{count}</div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:bg, display:'flex', flexDirection:'column', fontFamily:'inherit' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 32px', background:'rgba(255,255,255,0.03)', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          {theme.company_logo
            ? <img src={theme.company_logo} alt="" style={{ width:44, height:44, borderRadius:10, objectFit:'contain', background:'white', padding:4 }}/>
            : <div style={{ width:44, height:44, borderRadius:10, background:primary, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>🏢</div>}
          <div>
            <div style={{ fontWeight:700, fontSize:20, color:'white' }}>{theme.company_name || 'ShiftManager'}</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.3)', marginTop:2 }}>Live Availability</div>
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontFamily:'monospace', fontSize:38, fontWeight:500, color:'white', letterSpacing:2, lineHeight:1 }}>
            {time.toLocaleTimeString('en-ZA', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false })}
          </div>
          <div style={{ fontSize:13, color:'rgba(255,255,255,0.3)', marginTop:4 }}>
            {time.toLocaleDateString('en-ZA', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
          </div>
        </div>
      </div>

      <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', overflow:'hidden' }}>
        <div style={{ borderRight:'1px solid rgba(255,255,255,0.06)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <ColHeader label="Online" count={online.length} color={theme.online_color||'#22C55E'} pulse/>
          <div style={{ flex:1, padding:'12px 16px', overflowY:'auto' }}>
            {online.map(a => <AgentCard key={a.id} agent={a} statusColor={theme.online_color||'#22C55E'}/>)}
            {online.length===0 && <div style={{ padding:40, textAlign:'center', color:'rgba(255,255,255,0.15)', fontSize:13 }}>No one online</div>}
          </div>
        </div>
        <div style={{ borderRight:'1px solid rgba(255,255,255,0.06)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <ColHeader label="Away" count={onBreak.length} color="#F59E0B"/>
          <div style={{ flex:1, padding:'12px 16px', overflowY:'auto' }}>
            {onBreak.map(a => <AgentCard key={a.id} agent={a} statusColor="#F59E0B"/>)}
            {onBreak.length===0 && <div style={{ padding:40, textAlign:'center', color:'rgba(255,255,255,0.15)', fontSize:13 }}>No one away</div>}
          </div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <ColHeader label="Offline" count={offline.length} color={theme.offline_color||'#6B7280'}/>
          <div style={{ flex:1, padding:'12px 16px', overflowY:'auto' }}>
            {offline.map(a => <AgentCard key={a.id} agent={a} statusColor={theme.offline_color||'#6B7280'}/>)}
            {offline.length===0 && <div style={{ padding:40, textAlign:'center', color:'rgba(255,255,255,0.15)', fontSize:13 }}>No one offline</div>}
          </div>
        </div>
      </div>

      <div style={{ padding:'10px 32px', background:'rgba(255,255,255,0.02)', borderTop:'1px solid rgba(255,255,255,0.05)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'rgba(255,255,255,0.25)' }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:'#22C55E', animation:'pulse 1.5s infinite' }}/>
          Live · Updates automatically
        </div>
        <div style={{ fontSize:11, color:'rgba(255,255,255,0.15)' }}>{theme.company_name||'ShiftManager'} · Built by Ashwin Halford</div>
      </div>
    </div>
  );
}

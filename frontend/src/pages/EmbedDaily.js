import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const STORAGE_KEY = 'embed_daily_pin_ok';
const REFRESH_MS  = 5 * 60 * 1000; // refresh data every 5 minutes

const HOURS = Array.from({length:25},(_,i)=>i);
const TIMELINE_START = 0;
const TIMELINE_END   = 24;
const NAME_COL       = 170;
const ROW_H          = 52;

const toMinutes = (t) => { const [h,m]=(t||'00:00').split(':').map(Number); return h*60+(m||0); };
const pct       = (mins) => `${((mins - TIMELINE_START*60)/((TIMELINE_END-TIMELINE_START)*60))*100}%`;

const DEPT_COLORS = { 'Sales':'#0891b2', 'Travel Agents':'#d97706' };
const DEPT_BG     = { 'Sales':'#ecfeff', 'Travel Agents':'#fffbeb' };

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(()=>setNow(new Date()),1000); return ()=>clearInterval(t); },[]);
  const pad = (n) => String(n).padStart(2,'0');
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return (
    <div style={{ textAlign:'right' }}>
      <div style={{ fontSize:36, fontWeight:800, fontFamily:'DM Mono', letterSpacing:2, color:'#1a1a2e' }}>
        {pad(now.getHours())} : {pad(now.getMinutes())} : {pad(now.getSeconds())}
      </div>
      <div style={{ fontSize:13, color:'#64748b', marginTop:2 }}>
        {days[now.getDay()]}, {now.getDate()} {months[now.getMonth()]} {now.getFullYear()}
      </div>
    </div>
  );
}

function PinScreen({ onUnlock }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!pin) return;
    setLoading(true); setError('');
    try {
      const r = await axios.post('/api/embed/verify-pin', { pin });
      if (r.data.ok) {
        sessionStorage.setItem(STORAGE_KEY, '1');
        onUnlock();
      }
    } catch {
      setError('Incorrect PIN. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f8fafc' }}>
      <div style={{ background:'white', borderRadius:16, padding:48, boxShadow:'0 4px 24px rgba(0,0,0,0.08)', width:340, textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:16 }}>🔒</div>
        <h2 style={{ margin:'0 0 8px', fontSize:20, fontWeight:800, color:'#1a1a2e' }}>Daily Schedule</h2>
        <p style={{ margin:'0 0 28px', color:'#64748b', fontSize:14 }}>Enter the PIN to view today's shifts</p>
        <input
          type="password"
          value={pin}
          onChange={e=>setPin(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&submit()}
          placeholder="Enter PIN"
          style={{ width:'100%', padding:'12px 16px', borderRadius:10, border:'2px solid #e2e8f0', fontSize:18, textAlign:'center', outline:'none', fontFamily:'DM Mono', letterSpacing:4, boxSizing:'border-box', marginBottom:12 }}
          autoFocus
        />
        {error && <p style={{ color:'#dc2626', fontSize:13, margin:'0 0 12px' }}>{error}</p>}
        <button onClick={submit} disabled={loading}
          style={{ width:'100%', padding:'12px', borderRadius:10, border:'none', background:'#1a1a2e', color:'white', fontSize:15, fontWeight:700, cursor:'pointer' }}>
          {loading ? 'Checking…' : 'View Schedule'}
        </button>
      </div>
    </div>
  );
}

export default function EmbedDaily() {
  const [unlocked, setUnlocked] = useState(!!sessionStorage.getItem(STORAGE_KEY));
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [deptFilter, setDeptFilter] = useState('all'); // 'all' | 'Sales' | 'Travel Agents'

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get('/api/embed/daily');
      setData(r.data);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    fetchData();
    const t = setInterval(fetchData, REFRESH_MS);
    return () => clearInterval(t);
  }, [unlocked, fetchData]);

  if (!unlocked) return <PinScreen onUnlock={() => { setUnlocked(true); }} />;
  if (loading && !data) return <div style={{ padding:60, textAlign:'center', color:'#94a3b8', fontSize:16 }}>Loading today's schedule…</div>;
  if (!data) return null;

  const { today, users, shifts, leaves, depts } = data;

  // Format today nicely
  const todayDate = new Date(today + 'T00:00:00');
  const dayNames  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const monNames  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const todayLabel = `${dayNames[todayDate.getDay()]}, ${todayDate.getDate()} ${monNames[todayDate.getMonth()]} ${todayDate.getFullYear()}`;

  const DEPTS = ['Sales','Travel Agents'];
  const visibleDepts = DEPTS.filter(d => deptFilter === 'all' || deptFilter === d);

  return (
    <div style={{ minHeight:'100vh', background:'white', fontFamily:'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ padding:'20px 32px', borderBottom:'2px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between', background:'white', position:'sticky', top:0, zIndex:10 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'#C0392B', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ fontSize:18 }}>📅</span>
            </div>
            <div>
              <h1 style={{ margin:0, fontSize:20, fontWeight:800, color:'#1a1a2e' }}>Daily Schedule</h1>
              <p style={{ margin:0, fontSize:13, color:'#64748b' }}>{todayLabel}</p>
            </div>
          </div>
          {/* Dept filter buttons */}
          <div style={{ display:'flex', gap:8, marginTop:14 }}>
            {[['all','All Departments'],['Sales','Sales'],['Travel Agents','Travel Agents']].map(([v,l]) => (
              <button key={v} onClick={()=>setDeptFilter(v)}
                style={{ padding:'6px 14px', borderRadius:20, border:`1.5px solid ${deptFilter===v?DEPT_COLORS[v]||'#1a1a2e':'#e2e8f0'}`,
                  background: deptFilter===v ? (DEPT_BG[v]||'#1a1a2e') : 'white',
                  color: deptFilter===v ? (DEPT_COLORS[v]||'#1a1a2e') : '#64748b',
                  fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <Clock />
      </div>

      {/* Schedule */}
      <div style={{ padding:'24px 32px' }}>
        {visibleDepts.map(deptName => {
          const dc = depts.find(d=>d.name===deptName);
          const deptColor  = dc?.color  || DEPT_COLORS[deptName] || '#333';
          const deptBg     = dc?.bg_color || DEPT_BG[deptName]   || '#f8f9fa';
          const dagents = users.filter(u => u.department === deptName);
          if (!dagents.length) return null;

          return (
            <div key={deptName} style={{ marginBottom:32, borderRadius:12, overflow:'hidden', border:'1px solid #e2e8f0', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
              {/* Dept header */}
              <div style={{ padding:'12px 20px', background:deptBg, borderBottom:`2px solid ${deptColor}` }}>
                <span style={{ fontWeight:800, fontSize:14, color:deptColor, textTransform:'uppercase', letterSpacing:0.5 }}>{deptName}</span>
                <span style={{ marginLeft:10, fontSize:12, color:deptColor, opacity:0.7 }}>{dagents.length} agent{dagents.length!==1?'s':''}</span>
              </div>

              {/* Timeline header */}
              <div style={{ display:'flex', borderBottom:'1px solid #f1f5f9', background:'#f8fafc' }}>
                <div style={{ width:NAME_COL, flexShrink:0, padding:'4px 20px', fontSize:10, fontWeight:700, color:'#94a3b8', borderRight:'1px solid #f1f5f9', textTransform:'uppercase', letterSpacing:1 }}>Agent</div>
                <div style={{ flex:1, position:'relative', height:26 }}>
                  {HOURS.filter(h=>h%2===0).map(h => (
                    <div key={h} style={{ position:'absolute', left:pct(h*60), transform:'translateX(-50%)', fontSize:10, color:'#94a3b8', fontWeight:600, top:5, fontFamily:'DM Mono' }}>
                      {h===0?'12am':h<12?`${h}am`:h===12?'12pm':h===24?'12am':`${h-12}pm`}
                    </div>
                  ))}
                </div>
              </div>

              {/* Agent rows */}
              {dagents.map((agent, idx) => {
                const agentShifts = shifts.filter(s => s.user_id===agent.id && s.date===today);
                const agentLeave  = leaves.find(l => l.user_id===agent.id);
                const rowBg = idx%2===0 ? 'white' : '#fafafa';

                return (
                  <div key={agent.id} style={{ display:'flex', borderBottom:'1px solid #f1f5f9', background:rowBg, minHeight:ROW_H }}>
                    {/* Name */}
                    <div style={{ width:NAME_COL, flexShrink:0, display:'flex', alignItems:'center', gap:8, padding:'0 12px 0 20px', borderRight:'1px solid #f1f5f9' }}>
                      <div style={{ width:28, height:28, borderRadius:'50%', background:deptColor, color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:12, flexShrink:0 }}>
                        {agent.name?.trim()?.[0]?.toUpperCase()}
                      </div>
                      <span style={{ fontWeight:600, fontSize:13, lineHeight:1.2, color:'#1a1a2e' }}>{agent.name}</span>
                    </div>

                    {/* Timeline */}
                    <div style={{ flex:1, position:'relative', minHeight:ROW_H }}>
                      {/* Grid lines */}
                      {HOURS.filter(h=>h>0&&h<24).map(h => (
                        <div key={h} style={{ position:'absolute', top:0, bottom:0, left:pct(h*60), width:1, background:h%6===0?'#e2e8f0':'#f1f5f9', zIndex:0 }}/>
                      ))}

                      {/* Leave */}
                      {agentLeave && (
                        <div style={{ position:'absolute', top:'20%', height:'60%', left:'0%', right:'0%', background:'#ede9fe', opacity:0.5, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', zIndex:1 }}>
                          <span style={{ fontSize:11, fontWeight:700, color:'#6366f1' }}>🏖️ {agentLeave.leave_type_name}</span>
                        </div>
                      )}

                      {/* Shifts */}
                      {agentShifts.map(s => {
                        const startM  = toMinutes(s.start_time);
                        const rawEnd  = toMinutes(s.end_time);
                        const endM    = rawEnd <= startM && rawEnd !== 0 ? 24*60 : (rawEnd || 24*60);
                        const isOvernight = rawEnd < startM && rawEnd !== 0;
                        const isDraft = s.status === 'draft';
                        const bubbleBg    = isDraft ? '#fef9c3' : (s.color || deptColor);
                        const bubbleBorder= isDraft ? '#fbbf24' : (s.color || deptColor);
                        const bubbleColor = isDraft ? '#92400e' : (s.text_color || '#ffffff');
                        const label = `${s.start_time.slice(0,5)}–${s.end_time.slice(0,5)}`;
                        const seg1Width = `${((endM-startM)/((TIMELINE_END-TIMELINE_START)*60))*100}%`;

                        return (
                          <React.Fragment key={s.id}>
                            <div style={{ position:'absolute', top:'10%', height:'80%', left:pct(startM), width:seg1Width,
                              background:bubbleBg, border:`1.5px solid ${bubbleBorder}`,
                              borderRadius: isOvernight ? '6px 0 0 6px' : 6,
                              zIndex:2, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', minWidth:2 }}
                              title={label}>
                              <span style={{ fontSize:11, fontWeight:700, color:bubbleColor, whiteSpace:'nowrap', padding:'0 6px', overflow:'hidden', textOverflow:'ellipsis', fontFamily:'DM Mono' }}>
                                {label}{isOvernight?' 🌙':''}
                              </span>
                            </div>
                            {isOvernight && (
                              <div style={{ position:'absolute', top:'10%', height:'80%', left:'0%', width:pct(rawEnd),
                                background:bubbleBg, border:`1.5px solid ${bubbleBorder}`,
                                borderRadius:'0 6px 6px 0', borderLeft:'none',
                                zIndex:2, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', minWidth:2, opacity:0.75 }}
                                title={`Continues · ends ${s.end_time.slice(0,5)}`}>
                                <span style={{ fontSize:10, fontWeight:600, color:bubbleColor, whiteSpace:'nowrap', padding:'0 4px', fontFamily:'DM Mono' }}>
                                  ↩ {s.end_time.slice(0,5)}
                                </span>
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}

                      {agentShifts.length===0 && !agentLeave && (
                        <div style={{ position:'absolute', top:'50%', transform:'translateY(-50%)', left:12, fontSize:12, color:'#cbd5e1' }}>—</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Footer */}
        <div style={{ textAlign:'center', fontSize:11, color:'#cbd5e1', marginTop:8 }}>
          Auto-refreshes every 5 minutes · {today}
        </div>
      </div>
    </div>
  );
}

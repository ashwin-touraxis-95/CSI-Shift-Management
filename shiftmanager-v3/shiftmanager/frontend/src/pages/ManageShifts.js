import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format, addDays, startOfMonth, endOfMonth, addMonths, eachDayOfInterval, startOfWeek, endOfWeek, getDay } from 'date-fns';

export default function ManageShifts() {
  const [users, setUsers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [depts, setDepts] = useState([]);
  const [viewMonth, setViewMonth] = useState(new Date());
  const [tab, setTab] = useState('bulk');
  const [message, setMessage] = useState({ text:'', type:'success' });

  // Bulk assign form
  const [bulk, setBulk] = useState({ name:'', start_time:'07:00', end_time:'15:00', department:'CS', notes:'', status:'draft', selected_users:[], date_from:'', date_to:'', days_of_week:[1,2,3,4,5] });
  const [saving, setSaving] = useState(false);

  // Template form
  const [tplForm, setTplForm] = useState({ name:'', start_time:'07:00', end_time:'15:00', department:'CS', notes:'' });

  // Draft management
  const [selectedDrafts, setSelectedDrafts] = useState([]);

  const DAYS = [{v:0,l:'Sun'},{v:1,l:'Mon'},{v:2,l:'Tue'},{v:3,l:'Wed'},{v:4,l:'Thu'},{v:5,l:'Fri'},{v:6,l:'Sat'}];

  useEffect(() => { fetchAll(); }, [viewMonth]);

  const fetchAll = async () => {
    const [ur, tr, dr, depr] = await Promise.all([
      axios.get('/api/users'), axios.get('/api/templates'),
      axios.get(`/api/shifts?start=${format(startOfMonth(viewMonth),'yyyy-MM-dd')}&end=${format(endOfMonth(viewMonth),'yyyy-MM-dd')}`),
      axios.get('/api/settings/departments'),
    ]);
    setUsers(ur.data.filter(u => u.role === 'agent' && u.active !== 0));
    setTemplates(tr.data); setShifts(dr.data); setDepts(depr.data.map(d=>d.name));
  };

  const msg = (text, type='success') => { setMessage({text,type}); setTimeout(() => setMessage({text:'',type:'success'}), 4000); };

  const applyTemplate = (tpl) => {
    setBulk(b => ({...b, start_time:tpl.start_time, end_time:tpl.end_time, department:tpl.department, notes:tpl.notes||'', name:tpl.name}));
  };

  // Generate dates from range + day filter
  const generateDates = () => {
    if (!bulk.date_from || !bulk.date_to) return [];
    const days = eachDayOfInterval({ start: new Date(bulk.date_from+'T00:00'), end: new Date(bulk.date_to+'T00:00') });
    return days.filter(d => bulk.days_of_week.includes(getDay(d))).map(d => format(d,'yyyy-MM-dd'));
  };

  const handleBulkSubmit = async () => {
    if (!bulk.selected_users.length) return msg('Select at least one agent','error');
    const dates = generateDates();
    if (!dates.length) return msg('No dates match your selection','error');
    setSaving(true);
    try {
      const r = await axios.post('/api/shifts/bulk', { user_ids:bulk.selected_users, dates, start_time:bulk.start_time, end_time:bulk.end_time, department:bulk.department, notes:bulk.notes, status:bulk.status });
      msg(`✓ Created ${r.data.created} shifts for ${bulk.selected_users.length} agent(s) across ${dates.length} day(s)${bulk.status==='draft'?' — saved as draft':''}!`);
      setBulk(b => ({...b, selected_users:[]}));
      fetchAll();
    } catch(e) { msg(e.response?.data?.error||'Error','error'); }
    setSaving(false);
  };

  const handleSaveTemplate = async () => {
    if (!tplForm.name) return msg('Template name required','error');
    await axios.post('/api/templates', tplForm);
    setTplForm({name:'',start_time:'07:00',end_time:'15:00',department:'CS',notes:''});
    fetchAll(); msg('Template saved!');
  };

  const deleteTemplate = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    await axios.delete(`/api/templates/${id}`); fetchAll();
  };

  const publishSelected = async () => {
    await axios.post('/api/shifts/publish', { shift_ids: selectedDrafts });
    setSelectedDrafts([]); fetchAll(); msg(`Published ${selectedDrafts.length} shifts!`);
  };

  const publishAll = async () => {
    if (!window.confirm('Publish ALL draft shifts? Agents will be able to see them.')) return;
    await axios.post('/api/shifts/publish-all');
    setSelectedDrafts([]); fetchAll(); msg('All drafts published!');
  };

  const deleteShift = async (id) => {
    await axios.delete(`/api/shifts/${id}`); fetchAll();
  };

  const dates = generateDates();
  const drafts = shifts.filter(s => s.status === 'draft');
  const published = shifts.filter(s => s.status === 'published');
  const agentsByDept = users.reduce((acc, u) => { if (!acc[u.department]) acc[u.department]=[]; acc[u.department].push(u); return acc; }, {});

  return (
    <div>
      <div className="page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div><h1>Manage Shifts</h1><p>Build shifts, assign to agents, publish when ready</p></div>
      </div>

      {message.text && <div style={{ background: message.type==='error'?'#fef2f2':'#d4edda', border:`1px solid ${message.type==='error'?'#fca5a5':'#c3e6cb'}`, borderRadius:8, padding:'10px 16px', marginBottom:20, color: message.type==='error'?'#dc2626':'#155724', fontSize:14 }}>{message.text}</div>}

      {/* Draft banner */}
      {drafts.length > 0 && (
        <div style={{ background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:10, padding:'14px 20px', marginBottom:24, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
          <div><strong>📝 {drafts.length} draft shift{drafts.length>1?'s':''}</strong> <span style={{ color:'var(--gray-600)', fontSize:13 }}>— agents cannot see these yet</span></div>
          <div style={{ display:'flex', gap:10 }}>
            {selectedDrafts.length > 0 && <button className="btn btn-primary btn-sm" onClick={publishSelected}>Publish Selected ({selectedDrafts.length})</button>}
            <button className="btn btn-success btn-sm" onClick={publishAll}>Publish All Drafts</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:24, borderBottom:'2px solid var(--gray-200)' }}>
        {[{id:'bulk',l:'📋 Assign Shifts'},{id:'templates',l:'🗂 Templates'},{id:'view',l:'📅 Monthly View'}].map(t =>
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:'10px 20px', border:'none', background:'none', cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:600, color:tab===t.id?'var(--red)':'var(--gray-500)', borderBottom:tab===t.id?'2px solid var(--red)':'2px solid transparent', marginBottom:-2 }}>{t.l}</button>
        )}
      </div>

      {/* ── BULK ASSIGN TAB ── */}
      {tab === 'bulk' && (
        <div className="fade-in" style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:20, alignItems:'start' }}>
          <div className="card" style={{ padding:28 }}>
            <h2 style={{ fontSize:17, fontWeight:700, marginBottom:20 }}>Shift Details</h2>

            {/* Quick apply from template */}
            {templates.length > 0 && <div style={{ marginBottom:20 }}>
              <label>Quick Apply from Template</label>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:6 }}>
                {templates.map(t => <button key={t.id} className="btn btn-secondary btn-sm" onClick={() => applyTemplate(t)}>{t.name}</button>)}
              </div>
            </div>}

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              <div><label>Start Time</label><input type="time" value={bulk.start_time} onChange={e=>setBulk(b=>({...b,start_time:e.target.value}))} /></div>
              <div><label>End Time</label><input type="time" value={bulk.end_time} onChange={e=>setBulk(b=>({...b,end_time:e.target.value}))} /></div>
              <div style={{ gridColumn:'1/-1' }}><label>Department</label>
                <select value={bulk.department} onChange={e=>setBulk(b=>({...b,department:e.target.value}))}>
                  {depts.map(d=><option key={d} value={d}>{d}</option>)}
                </select></div>
              <div style={{ gridColumn:'1/-1' }}><label>Notes (optional)</label><input placeholder="e.g. Public holiday cover" value={bulk.notes} onChange={e=>setBulk(b=>({...b,notes:e.target.value}))} /></div>
            </div>

            <div style={{ marginTop:20 }}>
              <label>Date Range</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:6 }}>
                <div><label style={{ fontSize:11 }}>From</label><input type="date" value={bulk.date_from} onChange={e=>setBulk(b=>({...b,date_from:e.target.value}))} /></div>
                <div><label style={{ fontSize:11 }}>To</label><input type="date" value={bulk.date_to} onChange={e=>setBulk(b=>({...b,date_to:e.target.value}))} /></div>
              </div>
            </div>

            <div style={{ marginTop:16 }}>
              <label>Days of Week</label>
              <div style={{ display:'flex', gap:8, marginTop:6 }}>
                {DAYS.map(d => <button key={d.v} onClick={() => setBulk(b => ({ ...b, days_of_week: b.days_of_week.includes(d.v) ? b.days_of_week.filter(x=>x!==d.v) : [...b.days_of_week,d.v] }))} style={{ padding:'6px 10px', borderRadius:6, border:'1.5px solid', borderColor: bulk.days_of_week.includes(d.v)?'var(--red)':'var(--gray-300)', background: bulk.days_of_week.includes(d.v)?'var(--red)':'white', color: bulk.days_of_week.includes(d.v)?'white':'var(--gray-700)', fontSize:12, fontWeight:600, cursor:'pointer' }}>{d.l}</button>)}
              </div>
            </div>

            {dates.length > 0 && <div style={{ marginTop:12, padding:'8px 14px', background:'var(--gray-50)', borderRadius:8, fontSize:13, color:'var(--gray-600)' }}>
              📅 <strong>{dates.length} dates</strong> selected ({dates[0]} → {dates[dates.length-1]})
            </div>}

            <div style={{ marginTop:16 }}>
              <label>Save As</label>
              <div style={{ display:'flex', gap:10, marginTop:6 }}>
                <button onClick={()=>setBulk(b=>({...b,status:'draft'}))} style={{ flex:1, padding:'10px', borderRadius:8, border:'1.5px solid', borderColor:bulk.status==='draft'?'var(--red)':'var(--gray-300)', background:bulk.status==='draft'?'#fef2f2':'white', fontFamily:'inherit', fontSize:13, fontWeight:600, cursor:'pointer', color:bulk.status==='draft'?'var(--red)':'var(--gray-600)' }}>
                  📝 Draft <span style={{ display:'block', fontSize:11, fontWeight:400, color:'var(--gray-500)' }}>Only you can see it</span>
                </button>
                <button onClick={()=>setBulk(b=>({...b,status:'published'}))} style={{ flex:1, padding:'10px', borderRadius:8, border:'1.5px solid', borderColor:bulk.status==='published'?'var(--green)':'var(--gray-300)', background:bulk.status==='published'?'#d4edda':'white', fontFamily:'inherit', fontSize:13, fontWeight:600, cursor:'pointer', color:bulk.status==='published'?'var(--green)':'var(--gray-600)' }}>
                  ✅ Published <span style={{ display:'block', fontSize:11, fontWeight:400, color:'var(--gray-500)' }}>Agents see immediately</span>
                </button>
              </div>
            </div>
          </div>

          {/* Agent selector */}
          <div className="card" style={{ padding:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <h3 style={{ fontWeight:700, fontSize:15 }}>Select Agents</h3>
              <div style={{ display:'flex', gap:6 }}>
                <button className="btn btn-secondary btn-sm" onClick={()=>setBulk(b=>({...b,selected_users:users.map(u=>u.id)}))}>All</button>
                <button className="btn btn-secondary btn-sm" onClick={()=>setBulk(b=>({...b,selected_users:[]}))}>None</button>
              </div>
            </div>
            <div style={{ maxHeight:400, overflowY:'auto' }}>
              {Object.entries(agentsByDept).map(([dept, agents]) => (
                <div key={dept} style={{ marginBottom:12 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:1, marginBottom:6, display:'flex', justifyContent:'space-between' }}>
                    {dept}
                    <button style={{ fontSize:10, fontWeight:600, color:'var(--red)', background:'none', border:'none', cursor:'pointer' }} onClick={()=>setBulk(b=>({...b,selected_users:[...new Set([...b.selected_users,...agents.map(u=>u.id)])]}))}>Select all</button>
                  </div>
                  {agents.map(u => (
                    <div key={u.id} onClick={()=>setBulk(b=>({...b,selected_users:b.selected_users.includes(u.id)?b.selected_users.filter(x=>x!==u.id):[...b.selected_users,u.id]}))}
                      style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, cursor:'pointer', background:bulk.selected_users.includes(u.id)?'#fef2f2':'transparent', border:`1px solid ${bulk.selected_users.includes(u.id)?'var(--red)':'transparent'}`, marginBottom:4 }}>
                      <div style={{ width:22, height:22, borderRadius:4, border:`2px solid ${bulk.selected_users.includes(u.id)?'var(--red)':'var(--gray-300)'}`, background:bulk.selected_users.includes(u.id)?'var(--red)':'white', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {bulk.selected_users.includes(u.id) && <span style={{ color:'white', fontSize:12 }}>✓</span>}
                      </div>
                      {u.avatar ? <img src={u.avatar} alt="" style={{ width:28, height:28, borderRadius:'50%' }} />
                        : <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--gray-300)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700 }}>{u.name[0]}</div>}
                      <span style={{ fontSize:13, fontWeight:500 }}>{u.name}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ borderTop:'1px solid var(--gray-200)', paddingTop:14, marginTop:8 }}>
              <div style={{ fontSize:13, color:'var(--gray-600)', marginBottom:10 }}>
                <strong>{bulk.selected_users.length}</strong> agent{bulk.selected_users.length!==1?'s':''} · <strong>{dates.length}</strong> date{dates.length!==1?'s':''} = <strong>{bulk.selected_users.length*dates.length}</strong> shifts
              </div>
              <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }} onClick={handleBulkSubmit} disabled={saving||!bulk.selected_users.length||!dates.length}>
                {saving ? 'Creating...' : `${bulk.status==='draft'?'Save as Draft':'Publish'} Shifts`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TEMPLATES TAB ── */}
      {tab === 'templates' && (
        <div className="fade-in">
          <div className="card" style={{ padding:24, marginBottom:20, maxWidth:580 }}>
            <h3 style={{ fontWeight:700, marginBottom:16 }}>Save New Template</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div style={{ gridColumn:'1/-1' }}><label>Template Name</label><input placeholder="e.g. Morning Shift, Night Shift..." value={tplForm.name} onChange={e=>setTplForm(f=>({...f,name:e.target.value}))} /></div>
              <div><label>Start Time</label><input type="time" value={tplForm.start_time} onChange={e=>setTplForm(f=>({...f,start_time:e.target.value}))} /></div>
              <div><label>End Time</label><input type="time" value={tplForm.end_time} onChange={e=>setTplForm(f=>({...f,end_time:e.target.value}))} /></div>
              <div style={{ gridColumn:'1/-1' }}><label>Department</label>
                <select value={tplForm.department} onChange={e=>setTplForm(f=>({...f,department:e.target.value}))}>
                  {depts.map(d=><option key={d} value={d}>{d}</option>)}
                </select></div>
              <div style={{ gridColumn:'1/-1' }}><label>Notes</label><input placeholder="Optional notes" value={tplForm.notes} onChange={e=>setTplForm(f=>({...f,notes:e.target.value}))} /></div>
            </div>
            <button className="btn btn-primary" style={{ marginTop:16 }} onClick={handleSaveTemplate}>Save Template</button>
          </div>

          <div className="card" style={{ overflow:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
              <thead><tr style={{ background:'var(--gray-50)', borderBottom:'2px solid var(--gray-200)' }}>
                {['Name','Time','Department','Notes','Actions'].map(h=><th key={h} style={{ padding:'12px 16px', textAlign:'left', fontSize:12, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {templates.length===0 && <tr><td colSpan={5} style={{ padding:40, textAlign:'center', color:'var(--gray-400)' }}>No templates yet — save one above to reuse shifts quickly</td></tr>}
                {templates.map(t=><tr key={t.id} style={{ borderBottom:'1px solid var(--gray-100)' }}>
                  <td style={{ padding:'12px 16px', fontWeight:600 }}>{t.name}</td>
                  <td style={{ padding:'12px 16px', fontFamily:'DM Mono', fontSize:13 }}>{t.start_time} – {t.end_time}</td>
                  <td style={{ padding:'12px 16px' }}>{t.department}</td>
                  <td style={{ padding:'12px 16px', color:'var(--gray-500)' }}>{t.notes||'—'}</td>
                  <td style={{ padding:'12px 16px', display:'flex', gap:6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={()=>{setTab('bulk');applyTemplate(t);}}>Use</button>
                    <button className="btn btn-danger btn-sm" onClick={()=>deleteTemplate(t.id)}>Delete</button>
                  </td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MONTHLY VIEW TAB ── */}
      {tab === 'view' && (
        <div className="fade-in">
          <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:20 }}>
            <button className="btn btn-secondary btn-sm" onClick={()=>setViewMonth(m=>addMonths(m,-1))}>← Prev</button>
            <strong style={{ fontSize:16 }}>{format(viewMonth,'MMMM yyyy')}</strong>
            <button className="btn btn-secondary btn-sm" onClick={()=>setViewMonth(m=>addMonths(m,1))}>Next →</button>
            <span style={{ fontSize:13, color:'var(--gray-500)', marginLeft:8 }}>
              {published.length} published · {drafts.length} draft
            </span>
          </div>

          <div className="card" style={{ overflow:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:900 }}>
              <thead>
                <tr style={{ background:'var(--gray-50)', borderBottom:'2px solid var(--gray-200)' }}>
                  <th style={{ padding:'10px 16px', textAlign:'left', fontWeight:600, fontSize:12, color:'var(--gray-500)', whiteSpace:'nowrap' }}>Agent</th>
                  {shifts.length>0 && [...new Set(shifts.map(s=>s.date))].sort().slice(0,31).map(date=>(
                    <th key={date} style={{ padding:'6px 4px', textAlign:'center', fontWeight:600, fontSize:10, color:'var(--gray-500)', minWidth:40 }}>
                      <div>{format(new Date(date+'T00:00'),'d')}</div>
                      <div style={{ fontWeight:400 }}>{format(new Date(date+'T00:00'),'EEE')}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u,i)=>{
                  const uShifts = shifts.filter(s=>s.user_id===u.id);
                  const dates = [...new Set(shifts.map(s=>s.date))].sort().slice(0,31);
                  return <tr key={u.id} style={{ borderBottom:'1px solid var(--gray-100)', background:i%2===0?'white':'var(--gray-50)' }}>
                    <td style={{ padding:'8px 16px', fontWeight:600, whiteSpace:'nowrap' }}>{u.name}</td>
                    {dates.map(date=>{
                      const dayShifts = uShifts.filter(s=>s.date===date);
                      return <td key={date} style={{ padding:'4px 2px', textAlign:'center', verticalAlign:'middle' }}>
                        {dayShifts.map(s=>(
                          <div key={s.id} title={`${s.start_time}-${s.end_time} ${s.department}`}
                            style={{ fontSize:9, padding:'2px 4px', borderRadius:3, background:s.status==='draft'?'#fcd34d':'var(--green)', color:s.status==='draft'?'#92400e':'white', marginBottom:2, cursor:'pointer', fontWeight:600, lineHeight:1.3 }}
                            onClick={()=>{if(s.status==='draft'&&window.confirm('Publish this shift?'))axios.post('/api/shifts/publish',{shift_ids:[s.id]}).then(fetchAll);}}>
                            {s.start_time.slice(0,5)}
                            {s.status==='draft'&&<span> 📝</span>}
                          </div>
                        ))}
                      </td>;
                    })}
                  </tr>;
                })}
                {users.length===0&&<tr><td colSpan={32} style={{ padding:40, textAlign:'center', color:'var(--gray-400)' }}>No agents yet. Add agents in Team Management.</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop:12, display:'flex', gap:16, fontSize:13 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}><div style={{ width:14, height:14, borderRadius:3, background:'var(--green)' }}/>Published (visible to agents)</div>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}><div style={{ width:14, height:14, borderRadius:3, background:'#fcd34d' }}/>Draft (manager only) — click to publish</div>
          </div>
        </div>
      )}
    </div>
  );
}

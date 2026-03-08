import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format, addDays, startOfMonth, endOfMonth, addMonths, eachDayOfInterval, startOfWeek, endOfWeek, getDay } from 'date-fns';

export default function ManageShifts() {
  const [users, setUsers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [depts, setDepts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [locationFilter, setLocationFilter] = useState('all');
  const [viewMonth, setViewMonth] = useState(new Date());
  const [tab, setTab] = useState('bulk');
  const [message, setMessage] = useState({ text:'', type:'success' });

  // Bulk assign form
  const [bulk, setBulk] = useState({ name:'', start_time:'07:00', end_time:'15:00', department:'CS', notes:'', status:'draft', shift_type:'normal', selected_users:[], date_from:'', date_to:'', selected_dates:[] });
  const [saving, setSaving] = useState(false);

  // Remove shifts form
  const [remove, setRemove] = useState({ selected_users:[], selected_dates:[], _deptFilter:'all' });
  const [removing, setRemoving] = useState(false);

  // Template form
  const [tplForm, setTplForm] = useState({ name:'', start_time:'07:00', end_time:'15:00', notes:'' });

  // Draft management
  const [selectedDrafts, setSelectedDrafts] = useState([]);

  const DAYS = [{v:0,l:'Sun'},{v:1,l:'Mon'},{v:2,l:'Tue'},{v:3,l:'Wed'},{v:4,l:'Thu'},{v:5,l:'Fri'},{v:6,l:'Sat'}];

  const [leaveUsers, setLeaveUsers] = useState([]);

  useEffect(() => { fetchAll(); }, [viewMonth]);

  const fetchAll = async () => {
    const [ur, tr, dr, depr, locr, lr] = await Promise.all([
      axios.get('/api/users'), axios.get('/api/templates'),
      axios.get(`/api/shifts?start=${format(startOfMonth(viewMonth),'yyyy-MM-dd')}&end=${format(endOfMonth(viewMonth),'yyyy-MM-dd')}`),
      axios.get('/api/departments'),
      axios.get('/api/locations').catch(()=>({data:[]})),
      axios.get(`/api/leave?start=${format(startOfMonth(viewMonth),'yyyy-MM-dd')}&end=${format(endOfMonth(viewMonth),'yyyy-MM-dd')}`).catch(()=>({data:[]})),
    ]);
    const activeAgents = ur.data.filter(u => u.user_type === 'agent' && u.active !== 0);
    setUsers(activeAgents);
    setTemplates(tr.data); setShifts(dr.data); setDepts(depr.data.map(d=>d.name).filter(n=>n!=='Management'));
    setLocations(Array.isArray(locr?.data) ? locr.data : []);
    // Build leave users list (unique users with leave in this month)
    const leaveUserIds = [...new Set((lr.data||[]).map(l => l.user_id))];
    const leaveAgents = activeAgents.filter(u => leaveUserIds.includes(u.id));
    setLeaveUsers(leaveAgents);
  };

  const msg = (text, type='success') => { setMessage({text,type}); setTimeout(() => setMessage({text:'',type:'success'}), 4000); };

  const applyTemplate = (tpl) => {
    setBulk(b => ({...b, start_time:tpl.start_time, end_time:tpl.end_time, department:tpl.department, notes:tpl.notes||'', name:tpl.name}));
  };

  const generateDates = () => bulk.selected_dates || [];

  const handleBulkSubmit = async () => {
    if (!bulk.selected_users.length) return msg('Select at least one agent','error');
    const dates = generateDates();
    if (!dates.length) return msg('No dates match your selection','error');
    setSaving(true);
    try {
      const r = await axios.post('/api/shifts/bulk', { user_ids:bulk.selected_users, dates, start_time:bulk.start_time, end_time:bulk.end_time, notes:bulk.notes, status:bulk.status, shift_type:bulk.shift_type||'normal' });
      const skipNote = r.data.skipped ? ` (${r.data.skipped} skipped — already had a shift)` : '';
      msg(`✓ Created ${r.data.created} shifts for ${bulk.selected_users.length} agent(s) across ${dates.length} day(s)${bulk.status==='draft'?' — saved as draft':''}!${skipNote}`);
      setBulk({ name:'', start_time:'07:00', end_time:'15:00', department:'CS', notes:'', status:'draft', shift_type:'normal', selected_users:[], date_from:'', date_to:'', selected_dates:[], _deptFilter:'all' });
      fetchAll();
    } catch(e) { msg(e.response?.data?.error||'Error','error'); }
    setSaving(false);
  };

  const handleBulkRemove = async () => {
    if (!remove.selected_users.length) return msg('Select at least one agent','error');
    if (!remove.selected_dates.length) return msg('Select at least one date','error');
    const total = remove.selected_users.length * remove.selected_dates.length;
    if (!window.confirm(`Remove up to ${total} shift(s) for ${remove.selected_users.length} agent(s) across ${remove.selected_dates.length} date(s)? This cannot be undone.`)) return;
    setRemoving(true);
    try {
      const r = await axios.post('/api/shifts/bulk-delete', { user_ids:remove.selected_users, dates:remove.selected_dates });
      msg(`🗑 Removed ${r.data.deleted} shift(s)`);
      setRemove(r => ({...r, selected_users:[], selected_dates:[]}));
      fetchAll();
    } catch(e) { msg(e.response?.data?.error||'Error','error'); }
    setRemoving(false);
  };

  const handleSaveTemplate = async () => {
    if (!tplForm.name) return msg('Template name required','error');
    await axios.post('/api/templates', tplForm);
    setTplForm({name:'',start_time:'07:00',end_time:'15:00',notes:''});
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
  const filteredByLocation = locationFilter === 'all' ? users : users.filter(u => (u.location||'SA') === locationFilter);
  const agentsByDept = filteredByLocation.reduce((acc, u) => { if (!acc[u.department]) acc[u.department]=[]; acc[u.department].push(u); return acc; }, {});

  return (
    <div>
      <div className="page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div><h1>Manage Shifts</h1><p>Build shifts, assign to agents, publish when ready</p></div>
      </div>

      {message.text && <div style={{ background: message.type==='error'?'#fef2f2':'#d4edda', border:`1px solid ${message.type==='error'?'#fca5a5':'#c3e6cb'}`, borderRadius:8, padding:'10px 16px', marginBottom:20, color: message.type==='error'?'#dc2626':'#155724', fontSize:14 }}>{message.text}</div>}


      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:24, borderBottom:'2px solid var(--gray-200)' }}>
        {[{id:'bulk',l:'➕ Assign Shifts'},{id:'remove',l:'🗑 Remove Shifts'},{id:'templates',l:'🗂 Templates'}].map(t =>
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
              <div style={{ gridColumn:'1/-1' }}>
                <label>Shift Type</label>
                <div style={{ display:'flex', gap:8, marginTop:6, flexWrap:'wrap' }}>
                  {[
                    { v:'normal',  l:'Normal',          color:'#16a34a', bg:'#f0fdf4' },
                    { v:'ot_1_5',  l:'OT @ 1.5',        color:'#d97706', bg:'#fffbeb' },
                    { v:'ot_2',    l:'OT @ 2 (Public Holiday)', color:'#dc2626', bg:'#fef2f2' },
                    { v:'ot_auth', l:'Authorised OT',   color:'#7c3aed', bg:'#ede9fe' },
                  ].map(t => (
                    <button key={t.v} onClick={()=>setBulk(b=>({...b,shift_type:t.v}))}
                      style={{ padding:'7px 14px', borderRadius:8, border:`1.5px solid ${bulk.shift_type===t.v?t.color:'var(--gray-300)'}`, background:bulk.shift_type===t.v?t.bg:'white', color:bulk.shift_type===t.v?t.color:'var(--gray-600)', fontFamily:'inherit', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                      {t.l}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ gridColumn:'1/-1' }}><label>Notes (optional)</label><input placeholder="e.g. Public holiday cover" value={bulk.notes} onChange={e=>setBulk(b=>({...b,notes:e.target.value}))} /></div>
            </div>

            <div style={{ marginTop:20 }}>
              <label>Select Dates</label>
              <CalendarPicker
                selectedDates={bulk.selected_dates || []}
                onChange={dates => setBulk(b=>({ ...b, selected_dates: dates,
                  date_from: dates.length ? dates[0] : '',
                  date_to: dates.length ? dates[dates.length-1] : ''
                }))}
              />
            </div>

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
            {/* Location filter — only shown if multiple locations exist */}
            {locations.length > 1 && (
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
                <span style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', alignSelf:'center', textTransform:'uppercase', letterSpacing:0.5 }}>Location:</span>
                <button onClick={()=>setLocationFilter('all')} style={{ padding:'3px 10px', borderRadius:6, border:'1.5px solid', borderColor:locationFilter==='all'?'#2563eb':'var(--gray-300)', background:locationFilter==='all'?'#2563eb':'white', color:locationFilter==='all'?'white':'var(--gray-700)', fontSize:11, fontWeight:600, cursor:'pointer' }}>All</button>
                {locations.map(l => (
                  <button key={l.code} onClick={()=>setLocationFilter(l.code)} style={{ padding:'3px 10px', borderRadius:6, border:'1.5px solid', borderColor:locationFilter===l.code?'#2563eb':'var(--gray-300)', background:locationFilter===l.code?'#2563eb':'white', color:locationFilter===l.code?'white':'var(--gray-700)', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                    {l.code==='SA'?'🇿🇦':l.code==='PH'?'🇵🇭':'📍'} {l.name}
                  </button>
                ))}
              </div>
            )}
            {/* Department filter */}
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
              <button onClick={()=>setBulk(b=>({...b,_deptFilter:'all'}))} style={{ padding:'4px 10px', borderRadius:6, border:'1.5px solid', borderColor:(bulk._deptFilter||'all')==='all'?'var(--red)':'var(--gray-300)', background:(bulk._deptFilter||'all')==='all'?'var(--red)':'white', color:(bulk._deptFilter||'all')==='all'?'white':'var(--gray-700)', fontSize:11, fontWeight:600, cursor:'pointer' }}>All</button>
              {depts.map(d => (
                <button key={d} onClick={()=>setBulk(b=>({...b,_deptFilter:d}))} style={{ padding:'4px 10px', borderRadius:6, border:'1.5px solid', borderColor:bulk._deptFilter===d?'var(--red)':'var(--gray-300)', background:bulk._deptFilter===d?'var(--red)':'white', color:bulk._deptFilter===d?'white':'var(--gray-700)', fontSize:11, fontWeight:600, cursor:'pointer' }}>{d}</button>
              ))}
              {leaveUsers.length > 0 && (
                <button onClick={()=>setBulk(b=>({...b,_deptFilter:'__leave__'}))} style={{ padding:'4px 10px', borderRadius:6, border:'1.5px solid', borderColor:bulk._deptFilter==='__leave__'?'#d97706':'var(--gray-300)', background:bulk._deptFilter==='__leave__'?'#d97706':'white', color:bulk._deptFilter==='__leave__'?'white':'var(--gray-700)', fontSize:11, fontWeight:600, cursor:'pointer' }}>🏖️ Leave Tracker</button>
              )}
            </div>
            <div style={{ maxHeight:400, overflowY:'auto' }}>
              {bulk._deptFilter === '__leave__' ? (
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#d97706', textTransform:'uppercase', letterSpacing:1, marginBottom:6, display:'flex', justifyContent:'space-between' }}>
                    🏖️ On Leave This Month
                    <button style={{ fontSize:10, fontWeight:600, color:'var(--red)', background:'none', border:'none', cursor:'pointer' }} onClick={()=>setBulk(b=>({...b,selected_users:[...new Set([...b.selected_users,...leaveUsers.map(u=>u.id)])]}))}>Select all</button>
                  </div>
                  {leaveUsers.length === 0 ? <div style={{ color:'var(--gray-400)', fontSize:13, padding:12 }}>No agents on leave this month</div> : leaveUsers.map(u => (
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
              ) : (
                Object.entries(agentsByDept).filter(([dept]) => !bulk._deptFilter || bulk._deptFilter === 'all' || dept === bulk._deptFilter).map(([dept, agents]) => (
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
                        {(u.location||'SA') !== 'SA' && <span style={{ fontSize:10, fontWeight:700, background:'#dbeafe', color:'#1d4ed8', padding:'1px 5px', borderRadius:4, marginLeft:'auto' }}>{u.location}</span>}
                      </div>
                    ))}
                  </div>
                ))
              )}
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

      {/* ── REMOVE SHIFTS TAB ── */}
      {tab === 'remove' && (
        <div className="fade-in" style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:20, alignItems:'start' }}>
          <div className="card" style={{ padding:28 }}>
            <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:10, padding:'12px 16px', marginBottom:20 }}>
              <div style={{ fontWeight:700, fontSize:14, color:'#dc2626', marginBottom:4 }}>⚠️ Remove Shifts</div>
              <div style={{ fontSize:13, color:'#7f1d1d' }}>Select the agents and dates whose shifts you want to delete. Only existing shifts on those dates will be removed — no error if a date has no shift.</div>
            </div>
            <label>Select Dates to Remove</label>
            <CalendarPicker
              selectedDates={remove.selected_dates || []}
              onChange={dates => setRemove(r=>({ ...r, selected_dates: dates }))}
            />
            <div style={{ marginTop:16, padding:'12px 16px', background:'var(--gray-50)', borderRadius:8, fontSize:13, color:'var(--gray-600)' }}>
              <strong>{remove.selected_users.length}</strong> agent{remove.selected_users.length!==1?'s':''} · <strong>{remove.selected_dates.length}</strong> date{remove.selected_dates.length!==1?'s':''} = up to <strong style={{ color:'#dc2626' }}>{remove.selected_users.length * remove.selected_dates.length}</strong> shifts removed
            </div>
            <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center', marginTop:12, background:'#dc2626', borderColor:'#dc2626' }}
              onClick={handleBulkRemove} disabled={removing||!remove.selected_users.length||!remove.selected_dates.length}>
              {removing ? 'Removing...' : `🗑 Remove ${remove.selected_users.length * remove.selected_dates.length || ''} Shift(s)`}
            </button>
          </div>

          {/* Agent selector */}
          <div className="card" style={{ padding:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <h3 style={{ fontWeight:700, fontSize:15 }}>Select Agents</h3>
              <div style={{ display:'flex', gap:6 }}>
                <button className="btn btn-secondary btn-sm" onClick={()=>setRemove(r=>({...r,selected_users:users.map(u=>u.id)}))}>All</button>
                <button className="btn btn-secondary btn-sm" onClick={()=>setRemove(r=>({...r,selected_users:[]}))}>None</button>
              </div>
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
              <button onClick={()=>setRemove(r=>({...r,_deptFilter:'all'}))} style={{ padding:'4px 10px', borderRadius:6, border:'1.5px solid', borderColor:(remove._deptFilter||'all')==='all'?'#dc2626':'var(--gray-300)', background:(remove._deptFilter||'all')==='all'?'#dc2626':'white', color:(remove._deptFilter||'all')==='all'?'white':'var(--gray-700)', fontSize:11, fontWeight:600, cursor:'pointer' }}>All</button>
              {depts.map(d => (
                <button key={d} onClick={()=>setRemove(r=>({...r,_deptFilter:d}))} style={{ padding:'4px 10px', borderRadius:6, border:'1.5px solid', borderColor:remove._deptFilter===d?'#dc2626':'var(--gray-300)', background:remove._deptFilter===d?'#dc2626':'white', color:remove._deptFilter===d?'white':'var(--gray-700)', fontSize:11, fontWeight:600, cursor:'pointer' }}>{d}</button>
              ))}
            </div>
            <div style={{ maxHeight:420, overflowY:'auto' }}>
              {Object.entries(users.reduce((acc,u)=>{ if(!acc[u.department])acc[u.department]=[];acc[u.department].push(u);return acc;},{}))
                .filter(([dept]) => !remove._deptFilter || remove._deptFilter==='all' || dept===remove._deptFilter)
                .map(([dept, agents]) => (
                <div key={dept} style={{ marginBottom:12 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:1, marginBottom:6, display:'flex', justifyContent:'space-between' }}>
                    {dept}
                    <button style={{ fontSize:10, fontWeight:600, color:'#dc2626', background:'none', border:'none', cursor:'pointer' }} onClick={()=>setRemove(r=>({...r,selected_users:[...new Set([...r.selected_users,...agents.map(u=>u.id)])]}))}>Select all</button>
                  </div>
                  {agents.map(u => (
                    <div key={u.id} onClick={()=>setRemove(r=>({...r,selected_users:r.selected_users.includes(u.id)?r.selected_users.filter(x=>x!==u.id):[...r.selected_users,u.id]}))}
                      style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, cursor:'pointer', background:remove.selected_users.includes(u.id)?'#fef2f2':'transparent', border:`1px solid ${remove.selected_users.includes(u.id)?'#dc2626':'transparent'}`, marginBottom:4 }}>
                      <div style={{ width:22, height:22, borderRadius:4, border:`2px solid ${remove.selected_users.includes(u.id)?'#dc2626':'var(--gray-300)'}`, background:remove.selected_users.includes(u.id)?'#dc2626':'white', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {remove.selected_users.includes(u.id) && <span style={{ color:'white', fontSize:12 }}>✓</span>}
                      </div>
                      <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--gray-300)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 }}>{u.name[0]}</div>
                      <span style={{ fontSize:13, fontWeight:500 }}>{u.name}</span>
                    </div>
                  ))}
                </div>
              ))}
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
              <div style={{ gridColumn:'1/-1' }}><label>Notes</label><input placeholder="Optional notes" value={tplForm.notes} onChange={e=>setTplForm(f=>({...f,notes:e.target.value}))} /></div>
            </div>
            <button className="btn btn-primary" style={{ marginTop:16 }} onClick={handleSaveTemplate}>Save Template</button>
          </div>

          <div className="card" style={{ overflow:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
              <thead><tr style={{ background:'var(--gray-50)', borderBottom:'2px solid var(--gray-200)' }}>
                {['Name','Time','Notes','Actions'].map(h=><th key={h} style={{ padding:'12px 16px', textAlign:'left', fontSize:12, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {templates.length===0 && <tr><td colSpan={5} style={{ padding:40, textAlign:'center', color:'var(--gray-400)' }}>No templates yet — save one above to reuse shifts quickly</td></tr>}
                {templates.map(t=><tr key={t.id} style={{ borderBottom:'1px solid var(--gray-100)' }}>
                  <td style={{ padding:'12px 16px', fontWeight:600 }}>{t.name}</td>
                  <td style={{ padding:'12px 16px', fontFamily:'DM Mono', fontSize:13 }}>{t.start_time} – {t.end_time}</td>
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

      {/* ── DRAFT MANAGEMENT TABLE ── */}
      {tab === 'bulk' && drafts.length > 0 && (() => {
        // Consolidate drafts: group by agent + time + type + notes
        const groups = [];
        [...drafts].sort((a,b) => a.date.localeCompare(b.date)).forEach(s => {
          const key = `${s.user_id}|${s.start_time}|${s.end_time}|${s.shift_type}|${s.notes||''}`;
          const existing = groups.find(g => g.key === key);
          if (existing) { existing.ids.push(s.id); existing.dates.push(s.date); }
          else {
            const agent = users.find(u => u.id === s.user_id);
            groups.push({ key, ids:[s.id], dates:[s.date], agent, s });
          }
        });
        const allGroupIds = groups.flatMap(g => g.ids);
        const TYPE_LABELS = { normal:'Normal', ot_1_5:'OT @ 1.5', ot_2:'OT @ 2 (PH)', ot_auth:'Auth OT' };
        const TYPE_COLORS = { normal:'#16a34a', ot_1_5:'#d97706', ot_2:'#dc2626', ot_auth:'#7c3aed' };
        const TYPE_BG    = { normal:'#f0fdf4', ot_1_5:'#fffbeb', ot_2:'#fef2f2', ot_auth:'#ede9fe' };
        return (
          <div className="card" style={{ padding:0, overflow:'hidden', marginTop:28 }}>
            <div style={{ padding:'14px 20px', background:'#1a1a2e', color:'white', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ fontWeight:700, fontSize:14 }}>📝 {drafts.length} Draft Shift{drafts.length>1?'s':''}</span>
                <span style={{ fontSize:12, color:'rgba(255,255,255,0.5)' }}>Agents cannot see these yet</span>
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {selectedDrafts.length > 0 && (
                  <>
                    <button className="btn btn-primary btn-sm" onClick={publishSelected}>✅ Publish Selected ({selectedDrafts.length})</button>
                    <button className="btn btn-danger btn-sm" onClick={async () => {
                      if (!window.confirm(`Delete ${selectedDrafts.length} draft shift(s)?`)) return;
                      await Promise.all(selectedDrafts.map(id => axios.delete(`/api/shifts/${id}`)));
                      setSelectedDrafts([]); fetchAll(); msg(`Deleted ${selectedDrafts.length} draft(s)`);
                    }}>🗑 Delete Selected</button>
                  </>
                )}
                <button className="btn btn-success btn-sm" onClick={publishAll}>✅ Publish All</button>
                <button className="btn btn-secondary btn-sm" onClick={() =>
                  setSelectedDrafts(selectedDrafts.length === allGroupIds.length ? [] : allGroupIds)
                }>{selectedDrafts.length === allGroupIds.length ? 'Deselect All' : 'Select All'}</button>
              </div>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:'var(--gray-50)', borderBottom:'2px solid var(--gray-200)' }}>
                    <th style={{ padding:'10px 14px', width:40 }}>
                      <input type="checkbox"
                        checked={selectedDrafts.length === allGroupIds.length && allGroupIds.length > 0}
                        onChange={e => setSelectedDrafts(e.target.checked ? allGroupIds : [])} />
                    </th>
                    {['Agent','Dept','Dates','Time','Type','Notes','Actions'].map(h => (
                      <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g, i) => {
                    const allSelected = g.ids.every(id => selectedDrafts.includes(id));
                    const someSelected = g.ids.some(id => selectedDrafts.includes(id));
                    const dateRange = g.dates.length === 1
                      ? g.dates[0]
                      : `${g.dates[0]} – ${g.dates[g.dates.length-1]} (${g.dates.length}d)`;
                    return (
                      <tr key={g.key} style={{ borderBottom:'1px solid var(--gray-100)', background: someSelected ? '#fef9f0' : i%2===0 ? 'white' : 'var(--gray-50)' }}>
                        <td style={{ padding:'10px 14px' }}>
                          <input type="checkbox" checked={allSelected}
                            onChange={e => setSelectedDrafts(prev =>
                              e.target.checked ? [...new Set([...prev, ...g.ids])] : prev.filter(x => !g.ids.includes(x))
                            )} />
                        </td>
                        <td style={{ padding:'10px 14px', fontWeight:600 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--red)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:11, flexShrink:0 }}>
                              {(g.agent?.name || g.s.user_name || '?')[0].toUpperCase()}
                            </div>
                            {g.agent?.name || g.s.user_name || '—'}
                          </div>
                        </td>
                        <td style={{ padding:'10px 14px', color:'var(--gray-600)' }}>{g.s.department || g.agent?.department || '—'}</td>
                        <td style={{ padding:'10px 14px', fontFamily:'DM Mono', fontSize:12, fontWeight:600 }}>{dateRange}</td>
                        <td style={{ padding:'10px 14px', fontFamily:'DM Mono', fontSize:12 }}>{g.s.start_time?.slice(0,5)} – {g.s.end_time?.slice(0,5)}</td>
                        <td style={{ padding:'10px 14px' }}>
                          <span style={{ background:TYPE_BG[g.s.shift_type]||'#f0fdf4', color:TYPE_COLORS[g.s.shift_type]||'#16a34a', padding:'2px 8px', borderRadius:5, fontSize:11, fontWeight:700 }}>
                            {TYPE_LABELS[g.s.shift_type] || 'Normal'}
                          </span>
                        </td>
                        <td style={{ padding:'10px 14px', color:'var(--gray-500)', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{g.s.notes || '—'}</td>
                        <td style={{ padding:'10px 14px' }}>
                          <div style={{ display:'flex', gap:6 }}>
                            <button className="btn btn-primary btn-sm" onClick={async () => {
                              await axios.post('/api/shifts/publish', { shift_ids: g.ids });
                              fetchAll(); msg(`Published ${g.ids.length} shift${g.ids.length>1?'s':''}!`);
                            }}>Publish</button>
                            <button className="btn btn-danger btn-sm" onClick={async () => {
                              if (!window.confirm(`Delete ${g.ids.length} draft shift${g.ids.length>1?'s':''}?`)) return;
                              await Promise.all(g.ids.map(id => axios.delete(`/api/shifts/${id}`)));
                              setSelectedDrafts(p => p.filter(x => !g.ids.includes(x)));
                              fetchAll(); msg(`Deleted ${g.ids.length} draft${g.ids.length>1?'s':''}`);
                            }}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function CalendarPicker({ selectedDates, onChange }) {
  const [viewMonth, setViewMonth] = React.useState(new Date());
  const [rangeStart, setRangeStart] = React.useState(null);
  const [hoverDay, setHoverDay] = React.useState(null);
  const [mode, setMode] = React.useState('range'); // 'range' | 'individual'

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const allDays = eachDayOfInterval({ start: calStart, end: calEnd });

  const fmt = d => format(d, 'yyyy-MM-dd');
  const isThisMonth = d => format(d,'MM-yyyy') === format(viewMonth,'MM-yyyy');
  const isSelected = d => selectedDates.includes(fmt(d));
  const isToday = d => fmt(d) === fmt(new Date());

  const daysBetween = (a, b) => {
    const [from, to] = a <= b ? [a, b] : [b, a];
    try {
      return eachDayOfInterval({ start: new Date(from+'T00:00'), end: new Date(to+'T00:00') }).map(fmt);
    } catch { return []; }
  };

  // Days currently in the hover preview range
  const previewRange = (mode === 'range' && rangeStart && hoverDay)
    ? daysBetween(rangeStart, fmt(hoverDay))
    : [];

  const isWeekend = (d) => [0, 6].includes(new Date(d + 'T00:00').getDay());

  const handleDayClick = (day) => {
    if (!isThisMonth(day)) return;
    const ds = fmt(day);

    if (mode === 'individual') {
      // Individual mode — weekends ARE toggleable
      const next = isSelected(day)
        ? selectedDates.filter(d => d !== ds)
        : [...selectedDates, ds].sort();
      onChange(next);
      return;
    }

    // Range mode — weekends are not clickable
    if (isWeekend(ds)) return;

    if (!rangeStart) {
      setRangeStart(ds);
    } else {
      // Build range excluding weekends
      const range = daysBetween(rangeStart, ds).filter(d => !isWeekend(d));
      const allSelected = range.every(d => selectedDates.includes(d));
      let next;
      if (allSelected) {
        next = selectedDates.filter(d => !range.includes(d));
      } else {
        next = [...new Set([...selectedDates, ...range])].sort();
      }
      onChange(next);
      setRangeStart(null);
      setHoverDay(null);
    }
  };

  const clearAll = () => { onChange([]); setRangeStart(null); setHoverDay(null); };

  const selectWorkdays = () => {
    const workdays = allDays.filter(d => isThisMonth(d) && ![0,6].includes(getDay(d))).map(fmt);
    onChange([...new Set([...selectedDates, ...workdays])].sort());
  };

  const WEEKDAYS = [
    {l:'Mon',v:1},{l:'Tue',v:2},{l:'Wed',v:3},{l:'Thu',v:4},{l:'Fri',v:5},{l:'Sat',v:6},{l:'Sun',v:0}
  ];

  const totalSelected = selectedDates.length;
  const primary = 'var(--red)';

  return (
    <div style={{ marginTop:8, border:'1.5px solid var(--gray-200)', borderRadius:12, overflow:'hidden' }}>

      {/* Top bar: month nav + mode toggle */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'var(--gray-50)', borderBottom:'1px solid var(--gray-200)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={()=>setViewMonth(m=>addMonths(m,-1))}
            style={{ border:'1px solid var(--gray-300)', background:'white', cursor:'pointer', borderRadius:6, padding:'3px 10px', fontSize:14, color:'var(--gray-700)' }}>‹</button>
          <span style={{ fontWeight:700, fontSize:14, minWidth:130, textAlign:'center' }}>
            {format(viewMonth,'MMMM yyyy')}
          </span>
          <button onClick={()=>setViewMonth(m=>addMonths(m,1))}
            style={{ border:'1px solid var(--gray-300)', background:'white', cursor:'pointer', borderRadius:6, padding:'3px 10px', fontSize:14, color:'var(--gray-700)' }}>›</button>
        </div>

        {/* Mode toggle */}
        <div style={{ display:'flex', borderRadius:8, overflow:'hidden', border:'1.5px solid var(--gray-200)' }}>
          {[{id:'range',label:'📅 Range'},{id:'individual',label:'✦ Individual'}].map(m=>(
            <button key={m.id} onClick={()=>{ setMode(m.id); setRangeStart(null); setHoverDay(null); }}
              style={{ padding:'5px 12px', border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
                background: mode===m.id ? 'var(--red)' : 'white',
                color: mode===m.id ? 'white' : 'var(--gray-600)' }}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Weekday headers — clickable to select whole column */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', background:'white', borderBottom:'1px solid var(--gray-200)' }}>
        {WEEKDAYS.map(wd => {
          const col = allDays.filter(d => isThisMonth(d) && getDay(d)===wd.v);
          const allOn = col.length > 0 && col.every(d => selectedDates.includes(fmt(d)));
          return (
            <button key={wd.v} onClick={()=>{
              const fmted = col.map(fmt);
              if (allOn) onChange(selectedDates.filter(d=>!fmted.includes(d)));
              else onChange([...new Set([...selectedDates,...fmted])].sort());
            }} style={{ padding:'7px 0', border:'none', background:'none', cursor:'pointer', fontSize:11,
              fontWeight:700, color: allOn ? 'var(--red)' : 'var(--gray-500)',
              textAlign:'center', textDecoration: allOn ? 'underline' : 'none' }}>
              {wd.l}
            </button>
          );
        })}
      </div>

      {/* Calendar grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', background:'white', padding:'4px 6px 8px' }}>
        {allDays.map((day, i) => {
          const ds = fmt(day);
          const inMonth = isThisMonth(day);
          const selected = selectedDates.includes(ds);
          const inPreview = previewRange.filter(d => !isWeekend(d)).includes(ds);
          const isStart = rangeStart === ds;
          const today = isToday(day);
          const weekend = [0,6].includes(day.getDay());
          const blockedInRange = mode === 'range' && weekend;

          let bg = 'transparent';
          let color = inMonth ? 'var(--gray-800)' : 'var(--gray-300)';
          let border = '1.5px solid transparent';
          let fontWeight = today ? 700 : 400;
          let cursor = 'default';
          let opacity = inMonth ? 1 : 0.3;

          if (blockedInRange && inMonth) {
            // Weekend in range mode — locked out
            bg = '#f1f5f9';
            color = '#cbd5e1';
            cursor = 'not-allowed';
          } else if (selected) {
            bg = 'var(--red)'; color = 'white'; fontWeight = 700;
            cursor = inMonth ? 'pointer' : 'default';
          } else if (inPreview) {
            bg = '#fecaca'; color = 'var(--red)';
            cursor = 'pointer';
          } else if (isStart) {
            bg = '#fecaca'; color = 'var(--red)';
            cursor = 'pointer';
          } else if (inMonth && weekend && mode === 'individual') {
            // Weekend in individual mode — selectable but tinted
            bg = '#fafafa';
            color = '#94a3b8';
            cursor = 'pointer';
          } else if (inMonth) {
            cursor = 'pointer';
          }

          if (today && !selected && !blockedInRange) border = '1.5px solid var(--red)';

          return (
            <div key={i}
              onClick={() => inMonth && handleDayClick(day)}
              onMouseEnter={() => { if (mode==='range' && rangeStart && inMonth && !weekend) setHoverDay(day); }}
              onMouseLeave={() => { if (mode==='range') setHoverDay(null); }}
              title={blockedInRange ? 'Weekends excluded in Range mode — switch to Individual to select' : undefined}
              style={{ display:'flex', alignItems:'center', justifyContent:'center',
                height:36, margin:'1px', borderRadius:8, cursor,
                background:bg, color, border, fontWeight, fontSize:13, transition:'background 0.1s',
                opacity }}>
              {format(day,'d')}
            </div>
          );
        })}
      </div>

      {/* Footer: quick actions + status */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 14px', background:'var(--gray-50)', borderTop:'1px solid var(--gray-200)', flexWrap:'wrap', gap:8 }}>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={selectWorkdays} className="btn btn-secondary" style={{ fontSize:11, padding:'4px 10px' }}>
            Mon–Fri
          </button>
          <button onClick={clearAll} className="btn btn-secondary" style={{ fontSize:11, padding:'4px 10px', color:'var(--red)' }}>
            Clear
          </button>
        </div>
        <div style={{ fontSize:12, color:'var(--gray-500)', fontWeight:500 }}>
          {mode === 'range' && rangeStart
            ? <span style={{ color:'var(--red)', fontWeight:600 }}>📅 Click a second date to complete the range — weekends excluded</span>
            : mode === 'individual'
              ? <span>{totalSelected > 0 ? <><strong style={{ color:'var(--red)' }}>{totalSelected}</strong> day{totalSelected!==1?'s':''} selected</> : 'Click individual days to select — weekends included'}</span>
              : totalSelected > 0
                ? <span><strong style={{ color:'var(--red)' }}>{totalSelected}</strong> day{totalSelected!==1?'s':''} selected</span>
                : <span>Click a date to start a range — weekends auto-excluded</span>
          }
        </div>
      </div>
    </div>
  );
}


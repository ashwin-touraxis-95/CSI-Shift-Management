import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { RangePickerInline } from '../components/RangePicker';
import { format, startOfWeek, endOfWeek, addWeeks, addDays, startOfMonth, endOfMonth, addMonths, eachDayOfInterval, getDay, isToday, getWeek, isSameMonth } from 'date-fns';
import { useAuth } from '../context/AuthContext';
const DEPT_COLORS = { CS:'#856404', Sales:'#383D41', 'Travel Agents':'#0C5460', Trainees:'#721C24', Management:'#155724' };
const DEPT_BG = { CS:'#FFF3CD', Sales:'#E2E3E5', 'Travel Agents':'#D1ECF1', Trainees:'#F8D7DA', Management:'#D4EDDA' };

export default function Schedule() {
  const { user, isLeader, isManager, isAdmin } = useAuth();
  const canEditAgent = (agent) => {
    if (isAdmin) return true;
    if (isManager || isLeader) return agent.department === user?.department;
    return false;
  };
  const [view, setView] = useState('week'); // will be overridden by settings on load
  const [current, setCurrent] = useState(new Date());
  const [shifts, setShifts] = useState([]);
  const [users, setUsers] = useState([]);
  const [depts, setDepts] = useState([]);
  const [settings, setSettings] = useState({});
  const [leaves, setLeaves] = useState([]);
  const [filterDepts, setFilterDepts] = useState(isAdmin ? [] : (user?.department ? [user.department] : [])); // [] = all
  const [filterAgent, setFilterAgent] = useState('all');
  const [filterLocation, setFilterLocation] = useState('all');
  const [locations, setLocations] = useState([]);
  const [publicHolidays, setPublicHolidays] = useState([]);
  const [editCell, setEditCell] = useState(null);
  const [editForm, setEditForm] = useState({ start_time:'07:00', end_time:'15:00' });
  const [editSaving, setEditSaving] = useState(false);
  const [shiftTemplates, setShiftTemplates] = useState([]);
  // Page tabs
  const [pageTab, setPageTab] = useState('schedule');
  // Bulk assign drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState('assign'); // 'assign' | 'remove' | 'leave'
  const [drawerAgents, setDrawerAgents] = useState([]);
  const [drawerForm, setDrawerForm] = useState({ start_time:'07:00', end_time:'15:00', date_from:'', date_to:'', status:'published', color:null, text_color:null });
  const [drawerSkipWeekends, setDrawerSkipWeekends] = useState(true); // matches Mon-Fri calendar mode
  const [drawerReplace, setDrawerReplace] = useState(false);
  const [drawerSubMode, setDrawerSubMode] = useState('assign'); // 'assign' | 'replace' | 'remove'
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [drawerMsg, setDrawerMsg] = useState('');
  // Templates tab
  const [tplForm, setTplForm] = useState({ name:'', start_time:'07:00', end_time:'15:00', notes:'', color:'', text_color:'' });
  const [editTpl, setEditTpl] = useState(null); // { id, name, start_time, end_time, notes, color, text_color }
  const [tplColorOpen, setTplColorOpen] = useState(false);
  const [editTplColorOpen, setEditTplColorOpen] = useState(false);
  const [tplTextColorOpen, setTplTextColorOpen] = useState(false);
  const [editTplTextColorOpen, setEditTplTextColorOpen] = useState(false);
  // Upload Shifts tab
  const [importFile, setImportFile] = useState(null);
  const [importRows, setImportRows] = useState([]); // parsed preview rows
  const [importResult, setImportResult] = useState(null); // { created, skipped, errors }
  const [importSaving, setImportSaving] = useState(false);
  const [importDragOver, setImportDragOver] = useState(false);
  // Leave tab
  const [allLeaves, setAllLeaves] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [leaveForm, setLeaveForm] = useState({ user_id:'', leave_type_id:'', date_from:'', date_to:'', half_day:'', notes:'' });
  const [leaveEditing, setLeaveEditing] = useState(null);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveMsg, setLeaveMsg] = useState('');

  useEffect(() => { fetchData(); }, [view, current]);
  useEffect(() => {
    const root = document.documentElement;
    if (drawerOpen && pageTab === 'schedule') {
      root.style.setProperty('--drawer-offset', '440px');
    } else {
      root.style.setProperty('--drawer-offset', '0px');
    }
    return () => root.style.setProperty('--drawer-offset', '0px');
  }, [drawerOpen, pageTab]);

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
    const year = format(current, 'yyyy');
    const [sr, ur, depr, setr, lr, phr, tr, locr] = await Promise.all([
      axios.get(`/api/shifts?start=${start}&end=${end}`),
      axios.get('/api/users'),
      axios.get('/api/departments'),
      axios.get('/api/theme'),
      axios.get(`/api/leave?start=${start}&end=${end}`).catch(()=>({data:[]})),
      axios.get(`/api/public-holidays?year=${year}`).catch(()=>({data:[]})),
      axios.get('/api/templates').catch(()=>({data:[]})),
      axios.get('/api/locations').catch(()=>({data:[]})),
    ]);
    setShifts(sr.data);
    setUsers(ur.data.filter(u => u.active !== 0));
    setDepts(depr.data.filter(d=>d.name!=='Trainees'));
    setSettings(setr.data);
    // Apply schedule default view for this user's role (only on first load, not for admins)
    if (user?.user_type !== 'account_admin') {
      const roleKey = user?.user_type === 'manager' ? 'manager'
                    : user?.user_type === 'team_leader' ? 'team_leader'
                    : 'agent';
      const defaultV = setr.data?.[`schedule_default_view_${roleKey}`] || 'week';
      setView(v => v === 'week' ? defaultV : v);
    }
    setLeaves(lr.data || []);
    setPublicHolidays(phr.data || []);
    setShiftTemplates(tr.data || []);
    setLocations(Array.isArray(locr?.data) ? locr.data : []);
    // Fetch leave types for Leave tab
    try {
      const [allLr, ltypes] = await Promise.all([
        axios.get('/api/leave'),
        axios.get('/api/leave-types'),
      ]);
      setAllLeaves(allLr.data || []);
      setLeaveTypes(ltypes.data.filter(t => t.active) || []);
    } catch {}
  };

  const navigate = (dir) => {
    if (view==='day') setCurrent(d => addDays(d, dir));
    else if (view==='week') setCurrent(d => addWeeks(d, dir));
    else setCurrent(d => addMonths(d, dir));
  };

  const openEditCell = (agent, date, shift) => {
    if (!canEditAgent(agent)) return;
    setEditCell({ agent, date, shift });
    setEditForm({ start_time: shift?.start_time||'07:00', end_time: shift?.end_time||'15:00', shift_type: shift?.shift_type||'normal' });
  };

  const handleEditSave = async () => {
    setEditSaving(true);
    try {
      if (editCell.shift) {
        await axios.put(`/api/shifts/${editCell.shift.id}`, { ...editCell.shift, start_time: editForm.start_time, end_time: editForm.end_time, shift_type: editForm.shift_type, status:'published' });
      } else {
        await axios.post('/api/shifts', { user_id: editCell.agent.id, date: editCell.date, start_time: editForm.start_time, end_time: editForm.end_time, shift_type: editForm.shift_type||'normal', status:'published' });
      }
      await fetchData();
      setEditCell(null);
    } catch(e) { alert(e.response?.data?.error || 'Error saving shift'); }
    setEditSaving(false);
  };

  const handleEditDelete = async () => {
    if (!editCell.shift) return;
    if (!window.confirm('Remove this shift?')) return;
    setEditSaving(true);
    try { await axios.delete(`/api/shifts/${editCell.shift.id}`); await fetchData(); setEditCell(null); }
    catch(e) { alert(e.response?.data?.error||'Error'); }
    setEditSaving(false);
  };

  // Bulk assign drawer toggle agent
  const toggleDrawerAgent = (agentId) => {
    setDrawerAgents(prev => prev.includes(agentId) ? prev.filter(id=>id!==agentId) : [...prev, agentId]);
  };

  const handleBulkAssign = async () => {
    if (!drawerAgents.length) return setDrawerMsg('Select at least one agent');
    if (!drawerForm.date_from || !drawerForm.date_to) return setDrawerMsg('Set a date range');
    setDrawerSaving(true); setDrawerMsg('');
    try {
      const dates = [];
      let d = new Date(drawerForm.date_from + 'T00:00');
      const end = new Date(drawerForm.date_to + 'T00:00');
      while (d <= end) {
        const dow = d.getDay();
        if (!drawerSkipWeekends || (dow !== 0 && dow !== 6)) dates.push(format(d,'yyyy-MM-dd'));
        d.setDate(d.getDate()+1);
      }
      await axios.post('/api/shifts/bulk', {
        user_ids: drawerAgents,
        dates,
        start_time: drawerForm.start_time,
        end_time: drawerForm.end_time,
        status: drawerForm.status,
        shift_type: 'normal',
        notes: '',
        color: drawerForm.color || null,
        text_color: drawerForm.text_color || null,
        replace: drawerSubMode === 'replace',
      });
      await fetchData();
      setDrawerMsg('✓ Shifts assigned!');
      setDrawerAgents([]);
      setTimeout(()=>setDrawerMsg(''),3000);
    } catch(e) { setDrawerMsg(e.response?.data?.error||'Error'); }
    setDrawerSaving(false);
  };

  const handleBulkRemove = async () => {
    if (!drawerAgents.length) return setDrawerMsg('Select at least one agent');
    if (!drawerForm.date_from || !drawerForm.date_to) return setDrawerMsg('Set a date range');
    setDrawerSaving(true); setDrawerMsg('');
    try {
      const dates = [];
      let d = new Date(drawerForm.date_from + 'T00:00');
      const end = new Date(drawerForm.date_to + 'T00:00');
      while (d <= end) {
        const dow = d.getDay();
        if (!drawerSkipWeekends || (dow !== 0 && dow !== 6)) dates.push(format(d,'yyyy-MM-dd'));
        d.setDate(d.getDate()+1);
      }
      const toDelete = shifts.filter(s => drawerAgents.includes(s.user_id) && dates.includes(s.date));
      await Promise.all(toDelete.map(s => axios.delete(`/api/shifts/${s.id}`)));
      await fetchData();
      setDrawerMsg(`✓ Removed ${toDelete.length} shift${toDelete.length!==1?'s':''}`);
      setDrawerAgents([]);
      setTimeout(()=>setDrawerMsg(''),3000);
    } catch(e) { setDrawerMsg(e.response?.data?.error||'Error'); }
    setDrawerSaving(false);
  };

  const handleSaveTemplate = async () => {
    if (!tplForm.name) return;
    await axios.post('/api/templates', tplForm);
    setTplForm({name:'',start_time:'07:00',end_time:'15:00',notes:'',color:'',text_color:''});
    setTplColorOpen(false);
    setTplTextColorOpen(false);
    await fetchData();
  };

  const handleSaveEditTemplate = async () => {
    if (!editTpl?.name) return;
    await axios.put(`/api/templates/${editTpl.id}`, editTpl);
    setEditTpl(null);
    setEditTplColorOpen(false);
    setEditTplTextColorOpen(false);
    await fetchData();
  };

  const handleDeleteTemplate = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    await axios.delete(`/api/templates/${id}`);
    await fetchData();
  };

  // ── IMPORT HANDLERS ────────────────────────────────────────────────────────
  const parseCSV = (text) => {
    const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,'').toLowerCase());
    return lines.slice(1).map((line, i) => {
      // Handle quoted fields with commas inside
      const cols = [];
      let cur = '', inQ = false;
      for (let c of line) {
        if (c==='"') { inQ=!inQ; }
        else if (c===',' && !inQ) { cols.push(cur.trim()); cur=''; }
        else { cur+=c; }
      }
      cols.push(cur.trim());
      const row = {};
      headers.forEach((h,idx) => { row[h] = (cols[idx]||'').replace(/^"|"$/g,'').trim(); });
      row._rowNum = i + 2;
      // Validate and determine status
      const email = (row.agent_email||'').toLowerCase();
      const date  = row.date||'';
      const start = row.start_time||'';
      const end   = row.end_time||'';
      if (!email || !date || !start || !end) {
        row._status = 'error'; row._error = 'Missing required fields';
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        row._status = 'error'; row._error = `Invalid date "${date}" — use YYYY-MM-DD`;
      } else if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
        row._status = 'error'; row._error = 'Invalid time — use HH:MM';
      } else {
        row._status = 'ready';
      }
      // Match agent name from loaded users
      const matched = users.find(u => u.email?.toLowerCase()===email);
      row._agentName = matched ? matched.name : null;
      row._agentDept = matched ? matched.department : null;
      if (row._status==='ready' && !matched) {
        row._status='error'; row._error=`Agent not found: ${email}`;
      }
      return row;
    });
  };

  const handleImportFile = (file) => {
    if (!file || !file.name.endsWith('.csv')) return;
    setImportResult(null);
    setImportFile(file);
    const reader = new FileReader();
    reader.onload = e => setImportRows(parseCSV(e.target.result));
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const headers = ['agent_email','date','start_time','end_time','shift_type','notes','status'];
    const hints = [
      ['# Required: agent email address','YYYY-MM-DD','HH:MM','HH:MM','normal | ot_1_5 | ot_2 | ot_auth','Optional','published | draft'],
    ];
    const examples = [
      ['agent@company.com','2026-03-17','07:00','15:00','normal','','published'],
      ['agent2@company.com','2026-03-17','15:00','23:00','normal','Weekend','published'],
      ['agent3@company.com','2026-03-18','07:00','15:00','ot_1_5','Public holiday coverage','draft'],
    ];
    const csv = [headers, ...hints, ...examples].map(r=>r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
    a.download = 'shift_upload_template.csv';
    a.click();
  };

  const handleImport = async () => {
    const readyRows = importRows.filter(r=>r._status==='ready');
    if (!readyRows.length) return;
    setImportSaving(true);
    try {
      const payload = readyRows.map(r=>({
        agent_email: r.agent_email,
        date: r.date,
        start_time: r.start_time,
        end_time: r.end_time,
        shift_type: r.shift_type||'normal',
        notes: r.notes||'',
        status: r.status||'published',
      }));
      const res = await axios.post('/api/shifts/import', { rows: payload });
      setImportResult(res.data);
      // Mark skipped rows
      setImportRows(prev => prev.map(r => {
        if (r._status!=='ready') return r;
        return { ...r, _status:'done' };
      }));
      await fetchData();
    } catch(e) { setImportResult({ error: e.response?.data?.error||'Import failed' }); }
    setImportSaving(false);
  };
  // ── END IMPORT HANDLERS ───────────────────────────────────────────────────

  const handleLeaveSubmit = async () => {
    if (!leaveForm.user_id || !leaveForm.leave_type_id || !leaveForm.date_from || !leaveForm.date_to) return setLeaveMsg('Fill in all required fields');
    try {
      if (leaveEditing) { await axios.put(`/api/leave/${leaveEditing.id}`, leaveForm); }
      else { await axios.post('/api/leave', leaveForm); }
      setShowLeaveForm(false); setLeaveEditing(null);
      setLeaveForm({ user_id:'', leave_type_id:'', date_from:'', date_to:'', half_day:'', notes:'' });
      await fetchData();
      setLeaveMsg('Saved!'); setTimeout(()=>setLeaveMsg(''),3000);
    } catch(e) { setLeaveMsg(e.response?.data?.error||'Error'); }
  };

  const handleLeaveDelete = async (id) => {
    if (!window.confirm('Delete this leave entry?')) return;
    await axios.delete(`/api/leave/${id}`);
    await fetchData();
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
    const bgColor = shift.status==='draft' ? '#fcd34d' : (shift.color || '#1e293b');
    const txtColor = shift.status==='draft' ? '#92400e' : (shift.text_color || '#ffffff');
    return (
      <div title={`${shift.name} · ${shift.start_time}-${shift.end_time}`}
        style={{ fontSize:12, padding:'6px 8px', borderRadius:6, background:bgColor, color:txtColor, marginBottom:3, fontWeight:700, lineHeight:1.5, textAlign:'center' }}>
        <div style={{ textAlign:'center' }}>{shift.start_time?.slice(0,5)}–{shift.end_time?.slice(0,5)}</div>
      </div>
    );
  };

  // ── DAY VIEW ──
  const DayView = () => {
    const dayStr = format(current,'yyyy-MM-dd');
    const agents = users.filter(u => (u.user_type === 'agent' || u.user_type === 'team_leader')
      && (filterDepts.length===0 || filterDepts.includes(u.department) || (filterDepts.includes('Management') && u.user_type==='team_leader'))
      && (filterAgent === 'all' || u.id === filterAgent)
      && (filterLocation === 'all' || (u.location||'SA') === filterLocation));
    const byDept = agents.reduce((acc,u) => { if(!acc[u.department])acc[u.department]=[]; acc[u.department].push(u); return acc; },{});
    const hasAnything = agents.length > 0;

    // 24-hr timeline helpers
    const HOURS = Array.from({length:25},(_,i)=>i); // 0..24
    const TIMELINE_START = 0; // 00:00
    const TIMELINE_END = 24;  // 24:00
    const toMinutes = (t) => { const [h,m]=(t||'00:00').split(':').map(Number); return h*60+(m||0); };
    const pct = (mins) => `${((mins - TIMELINE_START*60)/((TIMELINE_END-TIMELINE_START)*60))*100}%`;
    const AGENT_ROW_H = 48;
    const NAME_COL = 160;

    return (
      <div className="card" style={{ overflow:'auto' }}>
        {!hasAnything
          ? <div style={{ padding:60, textAlign:'center', color:'var(--gray-400)' }}>No agents match the current filter</div>
          : Object.entries(byDept).map(([dept, dagents]) => {
            const dc = depts.find(d=>d.name===dept);
            return (
              <div key={dept} style={{ marginBottom:0 }}>
                {/* Dept header */}
                <div style={{ padding:'10px 20px', background:dc?dc.bg_color:DEPT_BG[dept]||'#f8f9fa', borderBottom:'1px solid var(--gray-200)' }}>
                  <span style={{ fontWeight:700, fontSize:13, color:dc?dc.color:DEPT_COLORS[dept]||'#333' }}>{dept}</span>
                </div>

                {/* Timeline header row */}
                <div style={{ display:'flex', borderBottom:'1px solid var(--gray-200)', background:'#f8fafc', position:'sticky', top:0, zIndex:2 }}>
                  <div style={{ width:NAME_COL, flexShrink:0, padding:'4px 20px', fontSize:10, fontWeight:700, color:'var(--gray-400)', borderRight:'1px solid var(--gray-200)', textTransform:'uppercase', letterSpacing:1 }}>Agent</div>
                  <div style={{ flex:1, position:'relative', height:24 }}>
                    {HOURS.filter(h=>h%2===0).map(h => (
                      <div key={h} style={{ position:'absolute', left:pct(h*60), transform:'translateX(-50%)', fontSize:10, color:'var(--gray-400)', fontWeight:600, top:4, fontFamily:'DM Mono' }}>
                        {h===0?'12am':h<12?`${h}am`:h===12?'12pm':h===24?'12am':`${h-12}pm`}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Agent rows */}
                {dagents.map((agent,idx) => {
                  const agentShifts = shifts.filter(s => s.user_id===agent.id && s.date===dayStr);
                  const agentLeave = leaves.find(l => l.user_id===agent.id && l.date_from<=dayStr && l.date_to>=dayStr);
                  const rowBg = idx%2===0 ? 'white' : '#fafafa';
                  return (
                    <div key={agent.id} style={{ display:'flex', borderBottom:'1px solid var(--gray-100)', background:rowBg, minHeight:AGENT_ROW_H }}>
                      {/* Name column */}
                      <div style={{ width:NAME_COL, flexShrink:0, display:'flex', alignItems:'center', gap:8, padding:'0 12px 0 20px', borderRight:'1px solid var(--gray-100)' }}>
                        <div style={{ width:26,height:26,borderRadius:'50%',background:'var(--red)',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:11,flexShrink:0 }}>
                          {agent.name?.trim()?.[0]?.toUpperCase()}
                        </div>
                        <span style={{ fontWeight:600, fontSize:13, lineHeight:1.2 }}>{agent.name}</span>
                      </div>

                      {/* Timeline area */}
                      <div style={{ flex:1, position:'relative', minHeight:AGENT_ROW_H }}>
                        {/* Hour grid lines */}
                        {HOURS.filter(h=>h>0&&h<24).map(h => (
                          <div key={h} style={{ position:'absolute', top:0, bottom:0, left:pct(h*60), width:1, background:h%6===0?'var(--gray-200)':'var(--gray-100)', zIndex:0 }}/>
                        ))}

                        {/* Leave bar */}
                        {agentLeave && (
                          <div style={{ position:'absolute', top:'20%', height:'60%', left:'0%', right:'0%',
                            background:agentLeave.leave_type_bg||'#ede9fe', opacity:0.5, borderRadius:4,
                            display:'flex', alignItems:'center', justifyContent:'center', zIndex:1 }}>
                            <span style={{ fontSize:11, fontWeight:700, color:agentLeave.leave_type_color||'#6366f1' }}>🏖️ {agentLeave.leave_type_name}</span>
                          </div>
                        )}

                        {/* Shift bubbles — supports overnight shifts wrapping past midnight */}
                        {agentShifts.map(s => {
                          const startM = toMinutes(s.start_time);
                          const rawEnd = toMinutes(s.end_time);
                          const endM = rawEnd <= startM && rawEnd !== 0 ? 24*60 : (rawEnd || 24*60);
                          const isOvernight = rawEnd < startM && rawEnd !== 0;
                          const isDraft = s.status==='draft';
                          const shiftCol = s.color || '#1e293b';
                          const bubbleBg = isDraft ? '#fef9c3' : shiftCol;
                          const bubbleBorder = isDraft ? '#fbbf24' : shiftCol;
                          const bubbleColor = isDraft ? '#92400e' : (s.text_color || '#ffffff');
                          const label = `${s.start_time.slice(0,5)}–${s.end_time.slice(0,5)}`;
                          // Segment 1: from start to midnight (or end if not overnight)
                          const seg1Left = pct(startM);
                          const seg1Width = `${((endM-startM)/((TIMELINE_END-TIMELINE_START)*60))*100}%`;
                          return (
                            <React.Fragment key={s.id}>
                              <div style={{
                                position:'absolute', top:'10%', height:'80%',
                                left:seg1Left, width:seg1Width,
                                background:bubbleBg, border:`1.5px solid ${bubbleBorder}`,
                                borderRadius: isOvernight ? '6px 0 0 6px' : 6,
                                zIndex:2, display:'flex', alignItems:'center', justifyContent:'center',
                                overflow:'hidden', cursor:'pointer', minWidth:2
                              }}
                              title={`${label}${isDraft?' (draft)':''}${isOvernight?' · overnight':''}`}
                              onClick={()=>setEditCell({ agent, date:dayStr, shift:s })}
                              >
                                <span style={{ fontSize:11, fontWeight:700, color:bubbleColor, whiteSpace:'nowrap', padding:'0 4px', overflow:'hidden', textOverflow:'ellipsis', fontFamily:'DM Mono' }}>
                                  {label}{isOvernight?' 🌙':''}
                                </span>
                              </div>
                              {/* Overnight continuation: 00:00 to end time */}
                              {isOvernight && (
                                <div style={{
                                  position:'absolute', top:'10%', height:'80%',
                                  left:'0%', width:pct(rawEnd),
                                  background:bubbleBg, border:`1.5px solid ${bubbleBorder}`,
                                  borderRadius:'0 6px 6px 0', borderLeft:'none',
                                  zIndex:2, display:'flex', alignItems:'center', justifyContent:'center',
                                  overflow:'hidden', cursor:'pointer', minWidth:2,
                                  opacity:0.75
                                }}
                                title={`Continues from previous day · ends ${s.end_time.slice(0,5)}`}
                                onClick={()=>setEditCell({ agent, date:dayStr, shift:s })}
                                >
                                  <span style={{ fontSize:10, fontWeight:600, color:bubbleColor, whiteSpace:'nowrap', padding:'0 4px', fontFamily:'DM Mono' }}>
                                    ↩ {s.end_time.slice(0,5)}
                                  </span>
                                </div>
                              )}
                            </React.Fragment>
                          );
                        })}

                        {/* No shift / no leave indicator */}
                        {agentShifts.length === 0 && !agentLeave && (
                          <div style={{ position:'absolute', top:'50%', transform:'translateY(-50%)', left:8, fontSize:12, color:'var(--gray-300)' }}>—</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })
        }
      </div>
    );
  };

  // ── WEEK VIEW ──
  const WeekView = () => {
    const weekStart = startOfWeek(current,{weekStartsOn:1});
    const days = Array.from({length:7},(_,i)=>addDays(weekStart,i));
    const agents = users.filter(u=>(u.user_type==='agent' || u.user_type==='team_leader')
      && (filterDepts.length===0 || filterDepts.includes(u.department) || (filterDepts.includes('Management') && u.user_type==='team_leader'))
      && (filterAgent==='all' || u.id===filterAgent)
      && (filterLocation==='all' || (u.location||'SA')===filterLocation));
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
              {days.map(d => {
                const isWeekend = [0,6].includes(d.getDay());
                const ds = format(d,'yyyy-MM-dd');
                const holiday = publicHolidays.find(h => h.date === ds);
                const SA_NAMES = ['Human Rights Day','Family Day','Freedom Day',"Workers' Day",'Youth Day',"National Women's Day",'Heritage Day','Day of Reconciliation','Day of Goodwill'];
                const PH_NAMES = ['Araw ng Kagitingan','Maundy Thursday','Labour Day','Independence Day','National Heroes Day',"All Saints' Day",'Bonifacio Day','Feast of the Immaculate Conception','Rizal Day'];
                const holidayFlag = holiday ? (SA_NAMES.includes(holiday.name) ? '🇿🇦' : PH_NAMES.includes(holiday.name) ? '🇵🇭' : '🌍') : null;
                return (
                  <th key={d} style={{ padding:'10px 8px', textAlign:'center', color: isToday(d)?'white':holiday?'#fef08a':'rgba(255,255,255,0.7)', fontSize:12, fontWeight: isToday(d)?800:600, background: isToday(d)?'var(--red)':holiday?'rgba(234,179,8,0.25)':isWeekend?'rgba(255,255,255,0.05)':'transparent', minWidth:100 }}>
                    <div>{format(d,'EEE')}</div>
                    <div style={{ opacity: isWeekend?0.6:1 }}>{format(d,'d MMM')}</div>
                    {holiday && <div style={{ fontSize:9, marginTop:2, color:'#fef08a', fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:90 }}>{holidayFlag} {holiday.name}</div>}
                  </th>
                );
              })}
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
                      const shift = dayShifts[0] || null;
                      const editable = canEditAgent(agent);
                      const isWeekend = [0,6].includes(d.getDay());
                      // Leave on this day for this agent
                      const dayLeave = leaves.find(l => l.user_id===agent.id && l.date_from<=dayStr && l.date_to>=dayStr);
                      return <td key={dayStr} onClick={() => openEditCell(agent, dayStr, shift)}
                        style={{ padding:'4px 4px', verticalAlign:'top', background:isToday(d)?'rgba(192,57,43,0.04)':isWeekend?'#f8f9fa':undefined, cursor:editable?'pointer':undefined, position:'relative' }}>
                        {dayShifts.map(s=><ShiftPill key={s.id} shift={s}/>)}
                        {dayLeave && (
                          <div title={dayLeave.leave_type_name} style={{
                            fontSize:10, fontWeight:700, borderRadius:5, padding:'3px 6px', marginTop:2,
                            background: dayLeave.leave_type_bg || '#ede9fe',
                            color: dayLeave.leave_type_color || '#6366f1',
                            border: `1px solid ${dayLeave.leave_type_color || '#6366f1'}40`,
                            textAlign:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'
                          }}>
                            🏖️ {dayLeave.leave_type_name}
                          </div>
                        )}
                        {editable && !shift && !dayLeave && <div style={{ width:'100%', height:28, borderRadius:6, border:'1.5px dashed #e2e8f0', display:'flex', alignItems:'center', justifyContent:'center', color:'#cbd5e1', fontSize:11 }}>+</div>}
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

  // ── MONTH VIEW — grid style like ManageShifts ──
  const MonthView = () => {
    const allDates = eachDayOfInterval({ start:startOfMonth(current), end:endOfMonth(current) });
    const filteredAgents = users.filter(u => (u.user_type==='agent' || u.user_type==='team_leader')
      && (filterDepts.length===0 || filterDepts.includes(u.department) || (filterDepts.includes('Management') && u.user_type==='team_leader'))
      && (filterAgent==='all' || u.id===filterAgent)
      && (filterLocation==='all' || (u.location||'SA')===filterLocation));
    const agentIds = new Set(filteredAgents.map(u=>u.id));
    const filteredLeaves = leaves.filter(l => agentIds.has(l.user_id));

    // Leave summary bar (when agent filtered)
    const leaveTypeCount = {};
    filteredLeaves.forEach(l => {
      leaveTypeCount[l.leave_type_name] = (leaveTypeCount[l.leave_type_name]||0) + 1;
    });

    const byDept = filteredAgents.reduce((acc,u) => {
      if (!acc[u.department]) acc[u.department] = [];
      acc[u.department].push(u);
      return acc;
    }, {});

    return (
      <div>
        {/* Leave summary bar */}
        {filterAgent !== 'all' && filteredLeaves.length > 0 && (
          <div className="card" style={{ padding:'14px 20px', marginBottom:16, display:'flex', gap:16, alignItems:'center', flexWrap:'wrap' }}>
            <span style={{ fontWeight:700, fontSize:13 }}>📊 This month:</span>
            {Object.entries(leaveTypeCount).map(([type,count]) => {
              const lt = filteredLeaves.find(l=>l.leave_type_name===type);
              return (
                <span key={type} style={{ padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:600,
                  background:lt?.leave_type_bg||'#ede9fe', color:lt?.leave_type_color||'#6366f1',
                  border:`1px solid ${lt?.leave_type_color||'#6366f1'}30` }}>
                  🏖️ {type}: {count} {count===1?'entry':'entries'}
                </span>
              );
            })}
          </div>
        )}

        <div className="card" style={{ overflow:'auto', padding:0 }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:900 }}>
            <thead>
              <tr style={{ background:'#1a1a2e' }}>
                <th style={{ padding:'10px 16px', textAlign:'left', fontWeight:600, fontSize:12, color:'rgba(255,255,255,0.7)', whiteSpace:'nowrap', position:'sticky', left:0, background:'#1a1a2e', zIndex:2, minWidth:160 }}>Agent</th>
                {allDates.map(day => {
                  const ds = format(day,'yyyy-MM-dd');
                  const isWeekend = [0,6].includes(day.getDay());
                  const todayStr = ds === format(new Date(),'yyyy-MM-dd');
                  const holiday = publicHolidays.find(h => h.date === ds);
                  const SA_NAMES = ['Human Rights Day','Family Day','Freedom Day',"Workers' Day",'Youth Day',"National Women's Day",'Heritage Day','Day of Reconciliation','Day of Goodwill'];
                  const PH_NAMES = ['Araw ng Kagitingan','Maundy Thursday','Labour Day','Independence Day','National Heroes Day',"All Saints' Day",'Bonifacio Day','Feast of the Immaculate Conception','Rizal Day'];
                  const holidayFlag = holiday ? (SA_NAMES.includes(holiday.name) ? '🇿🇦' : PH_NAMES.includes(holiday.name) ? '🇵🇭' : '🌍') : null;
                  return (
                    <th key={ds} title={holiday ? holiday.name : undefined} style={{ padding:'4px 2px', textAlign:'center', fontWeight:600, fontSize:10,
                      color: todayStr?'white':holiday?'#fef08a':isWeekend?'rgba(255,255,255,0.3)':'rgba(255,255,255,0.7)',
                      minWidth:46, background: todayStr?'var(--red)':holiday?'rgba(234,179,8,0.3)':isWeekend?'rgba(255,255,255,0.04)':'transparent',
                      borderLeft: isWeekend?'1px solid rgba(255,255,255,0.08)':undefined }}>
                      <div style={{ fontWeight:todayStr?800:600 }}>{format(day,'d')}</div>
                      <div style={{ fontWeight:400, opacity:0.8 }}>{format(day,'EEE')}</div>
                      {holiday && <div style={{ fontSize:8, marginTop:1, color:'#fef08a', lineHeight:1.1 }}>{holidayFlag}</div>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {Object.entries(byDept).map(([dept, dagents]) => {
                const dc = depts.find(d=>d.name===dept);
                return (
                  <React.Fragment key={dept}>
                    <tr>
                      <td colSpan={allDates.length + 1} style={{ padding:'6px 16px', background:dc?dc.bg_color:'#f1f5f9', fontWeight:700, fontSize:11, color:dc?dc.color:'#334155', letterSpacing:0.5, position:'sticky', left:0 }}>
                        {dept}
                      </td>
                    </tr>
                    {dagents.map((agent, i) => (
                      <tr key={agent.id} style={{ borderBottom:'1px solid var(--gray-100)', background:i%2===0?'white':'var(--gray-50)' }}>
                        <td style={{ padding:'8px 16px', fontWeight:600, whiteSpace:'nowrap', position:'sticky', left:0, background:i%2===0?'white':'var(--gray-50)', zIndex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div style={{ width:22,height:22,borderRadius:'50%',background:'var(--red)',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:10,flexShrink:0 }}>
                              {agent.name?.trim()?.[0]?.toUpperCase()}
                            </div>
                            {agent.name}
                          </div>
                        </td>
                        {allDates.map(day => {
                          const ds = format(day,'yyyy-MM-dd');
                          const isWeekend = [0,6].includes(day.getDay());
                          const dayShifts = shifts.filter(s=>s.user_id===agent.id&&s.date===ds);
                          const dayLeave = filteredLeaves.find(l=>l.user_id===agent.id&&l.date_from<=ds&&l.date_to>=ds);
                          return (
                            <td key={ds} style={{ padding:'3px 2px', textAlign:'center', verticalAlign:'middle',
                              background:isWeekend?'#f8fafc':undefined,
                              borderLeft:isWeekend?'1px solid #e8edf2':undefined }}>
                              {dayShifts.map(s => {
                                const dc2 = depts.find(d=>d.name===s.department);
                                const bgColor = s.status==='draft' ? '#fcd34d' : (s.color || '#1e293b');
                                const txtColor = s.status==='draft' ? '#92400e' : (s.text_color || '#ffffff');
                                return (
                                  <div key={s.id} title={`${s.start_time}-${s.end_time} ${s.department}`}
                                    style={{ fontSize:9,padding:'2px 4px',borderRadius:3,background:bgColor,color:txtColor,marginBottom:2,fontWeight:600,lineHeight:1.3 }}>
                                    {s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}
                                    
                                  </div>
                                );
                              })}
                              {dayLeave && (
                                <div title={dayLeave.leave_type_name}
                                  style={{ fontSize:9,fontWeight:700,borderRadius:3,padding:'2px 4px',marginTop:dayShifts.length?2:0,
                                    background:dayLeave.leave_type_bg||'#ede9fe',
                                    color:dayLeave.leave_type_color||'#6366f1',
                                    overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                                  🏖️ {dayLeave.leave_type_name}
                                </div>
                              )}
                              {!dayShifts.length && !dayLeave && !isWeekend && (
                                <div style={{ color:'#e2e8f0', fontSize:10 }}>·</div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
              {filteredAgents.length === 0 && (
                <tr><td colSpan={allDates.length+1} style={{ padding:40, textAlign:'center', color:'var(--gray-400)' }}>No agents match the current filter</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop:12, display:'flex', gap:16, fontSize:13 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}><div style={{ width:14,height:14,borderRadius:3,background:'var(--green)' }}/>Published</div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}><div style={{ width:14,height:14,borderRadius:3,background:'#fcd34d' }}/>Draft</div>
        </div>
      </div>
    );
  };
  // Agents visible to current user for bulk assign
  const assignableAgents = users.filter(u => (u.user_type === 'agent' || u.user_type === 'team_leader')
    && (!isAdmin && !isManager ? u.department === user?.department : true)
    && (filterDepts.length===0 || filterDepts.includes(u.department) || (filterDepts.includes('Management') && u.user_type==='team_leader'))
    && (filterLocation === 'all' || (u.location||'SA') === filterLocation));

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'clip' }}>
      {/* STICKY HEADER */}
      <div style={{ flexShrink:0, zIndex:50, background:'var(--app-bg,#F1F5F9)', padding:'28px 32px 0', borderBottom:'2px solid var(--gray-200)' }}>
      {/* Page Header + Tabs */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12, gap:12 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:800 }}>Schedule</h1>
          <p style={{ margin:'4px 0 0', color:'var(--gray-500)', fontSize:14 }}>{getTitle()}</p>
        </div>
        {/* View toggle + nav — always on one line, no wrap */}
        <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
          <div style={{ display:'flex', background:'var(--gray-100)', borderRadius:10, padding:3 }}>
            {[{v:'day',l:'Day'},{v:'week',l:'Week'},{v:'month',l:'Month'}].map(m=>(
              <button key={m.v} onClick={()=>{setView(m.v); setCurrent(new Date());}} style={{ padding:'6px 14px', borderRadius:8, border:'none', fontFamily:'inherit', fontSize:13, fontWeight:600, cursor:'pointer', background:view===m.v?'white':'transparent', color:view===m.v?'var(--gray-900)':'var(--gray-500)', boxShadow:view===m.v?'0 1px 3px rgba(0,0,0,0.12)':'none', transition:'all 0.15s' }}>{m.l}</button>
            ))}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={()=>navigate(-1)}>← Prev</button>
          <button className="btn btn-secondary btn-sm" onClick={()=>setCurrent(new Date())}>Today</button>
          <button className="btn btn-secondary btn-sm" onClick={()=>navigate(1)}>Next →</button>
        </div>
      </div>
      {/* Filters row */}
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:8 }}>
        <select value={filterLocation} onChange={e=>{setFilterLocation(e.target.value);setFilterAgent('all');}}
          style={{ padding:'6px 11px', borderRadius:8, border:`1.5px solid ${filterLocation!=='all'?'var(--red)':'var(--gray-200)'}`, fontSize:12, fontFamily:'inherit', background:filterLocation!=='all'?'#fef2f2':'white', color:filterLocation!=='all'?'var(--red)':'var(--gray-700)', fontWeight:filterLocation!=='all'?700:400, cursor:'pointer' }}>
          <option value="all">🌍 All Locations</option>
          {locations.map(l=><option key={l.code} value={l.code}>{l.code==='SA'?'🇿🇦':l.code==='PH'?'🇵🇭':'📍'} {l.name}</option>)}
        </select>
        {/* Dept chips — Management always last */}
        <div style={{ display:'flex', gap:4, flexWrap:'wrap', alignItems:'center' }}>
          <button onClick={()=>{setFilterDepts([]);setFilterAgent('all');}} style={{ padding:'5px 10px', borderRadius:20, border:`1.5px solid ${filterDepts.length===0?'var(--red)':'var(--gray-200)'}`, background:filterDepts.length===0?'var(--red)':'white', color:filterDepts.length===0?'white':'var(--gray-700)', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>All Depts</button>
          {[...depts.filter(d=>d.name!=='Management'), ...depts.filter(d=>d.name==='Management')].map(d=>{const sel=filterDepts.includes(d.name); return <button key={d.id} onClick={()=>{setFilterDepts(prev=>sel?prev.filter(x=>x!==d.name):[...prev,d.name]);setFilterAgent('all');}} style={{ padding:'5px 10px', borderRadius:20, border:`1.5px solid ${sel?'var(--red)':'var(--gray-200)'}`, background:sel?'#fef2f2':'white', color:sel?'var(--red)':'var(--gray-700)', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>{d.name}</button>;})}
        </div>
        <select value={filterAgent} onChange={e=>setFilterAgent(e.target.value)}
          style={{ padding:'6px 11px', borderRadius:8, border:`1.5px solid ${filterAgent!=='all'?'var(--red)':'var(--gray-200)'}`, fontSize:12, fontFamily:'inherit', background:filterAgent!=='all'?'#fef2f2':'white', color:filterAgent!=='all'?'var(--red)':'var(--gray-700)', fontWeight:filterAgent!=='all'?700:400, cursor:'pointer' }}>
          <option value="all">All Agents</option>
          {users.filter(u=>
            (u.user_type==='agent' || u.user_type==='team_leader') &&
            (filterDepts.length===0 || filterDepts.includes(u.department) || (filterDepts.includes('Management') && u.user_type==='team_leader')) &&
            (filterLocation==='all'||(u.location||'SA')===filterLocation)
          ).map(u=>(
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>

      {/* Tabs + Action buttons */}
      <div style={{ display:'flex', alignItems:'center', borderBottom:'2px solid var(--gray-200)', marginBottom:20, marginTop:16, gap:0 }}>
        {[{id:'schedule',l:'📊 Schedule'},{id:'templates',l:'🗂 Templates'},{id:'upload',l:'⬆️ Upload Shifts'}].map(t=>(
          <button key={t.id} onClick={()=>{setPageTab(t.id);setDrawerOpen(false);}} style={{
            padding:'10px 20px', border:'none', background:'none', cursor:'pointer', fontFamily:'inherit',
            fontSize:13, fontWeight:600,
            color: pageTab===t.id ? 'var(--red)' : 'var(--gray-500)',
            borderBottom: pageTab===t.id ? '2px solid var(--red)' : '2px solid transparent', marginBottom:-2
          }}>{t.l}</button>
        ))}
        <div style={{ flex:1 }}/>
        {pageTab === 'schedule' && (
          <div style={{ display:'flex', gap:6, paddingBottom:2 }}>
            {[
              { mode:'assign', label:'✏️ Manage Shifts' },
              { mode:'leave',  label:'🏖️ Submit Leave'  },
            ].map(btn => {
              const isActive = drawerOpen && drawerMode===btn.mode;
              return (
                <button key={btn.mode} onClick={()=>{ if(drawerOpen && drawerMode===btn.mode){ setDrawerOpen(false); } else { setDrawerMode(btn.mode); setDrawerOpen(true); setDrawerAgents([]); setDrawerMsg(''); } }} style={{
                  padding:'9px 18px', borderRadius:8, fontFamily:'inherit', fontSize:13, fontWeight:700, cursor:'pointer',
                  border: isActive ? '2px solid var(--red)' : '2px solid var(--gray-800)',
                  background: isActive ? 'white' : 'var(--gray-800)',
                  color: isActive ? 'var(--gray-900)' : 'white',
                  transition:'all 0.15s',
                }}>{btn.label}</button>
              );
            })}
          </div>
        )}
      </div>

      </div>{/* end sticky header */}

      {/* BODY ROW */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
      <div style={{ flex:1, overflowY:'auto', padding:'20px 32px 32px', minWidth:0 }}>

      {/* ── SCHEDULE TAB ── */}
      {pageTab === 'schedule' && (
        <div>
          <div style={{ minWidth:0 }}>
      {view==='day' && <DayView/>}
      {view==='week' && <WeekView/>}
      {view==='month' && <MonthView/>}
          </div>{/* end schedule content */}
        </div>
      )}{/* end schedule tab */}

      {/* ── TEMPLATES TAB ── */}
      {pageTab === 'templates' && (
        <div className="fade-in">
          <div className="card" style={{ padding:24, marginBottom:20, maxWidth:580 }}>
            <h3 style={{ fontWeight:700, marginBottom:16 }}>Save New Template</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div style={{ gridColumn:'1/-1' }}><label>Template Name</label><input placeholder="e.g. Morning Shift..." value={tplForm.name} onChange={e=>setTplForm(f=>({...f,name:e.target.value}))}/></div>
              <div><label>Start Time</label><input type="text" placeholder="HH:MM" maxLength={5} value={tplForm.start_time} onChange={e=>setTplForm(f=>({...f,start_time:e.target.value.replace(/[^0-9:]/g,'')}))}/></div>
              <div><label>End Time</label><input type="text" placeholder="HH:MM" maxLength={5} value={tplForm.end_time} onChange={e=>setTplForm(f=>({...f,end_time:e.target.value.replace(/[^0-9:]/g,'')}))}/></div>
              <div style={{ gridColumn:'1/-1' }}><label>Notes</label><input placeholder="Optional notes" value={tplForm.notes} onChange={e=>setTplForm(f=>({...f,notes:e.target.value}))}/></div>
              <div style={{ gridColumn:'1/-1' }}>
                <label>Shift Colour</label>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:6 }}>
                  <div style={{ width:36, height:36, borderRadius:8, background:tplForm.color||'#22c55e', border:'2px solid var(--gray-200)', cursor:'pointer', flexShrink:0 }} onClick={()=>{setTplColorOpen(o=>!o);setTplTextColorOpen(false);}}/>
                  <span style={{ fontSize:12, color:'var(--gray-500)' }}>{tplForm.color||'Default (dept colour)'}</span>
                  {tplForm.color && <button onClick={()=>setTplForm(f=>({...f,color:''}))} style={{ fontSize:11, background:'none', border:'none', cursor:'pointer', color:'var(--gray-400)', textDecoration:'underline' }}>Reset</button>}
                </div>
                {tplColorOpen && (
                  <div style={{ marginTop:10, padding:16, background:'white', border:'1.5px solid var(--gray-200)', borderRadius:12, display:'inline-block', boxShadow:'0 4px 20px rgba(0,0,0,0.1)' }}>
                    <div style={{ position:'relative', marginBottom:12 }}>
                      <input type="color" value={tplForm.color||'#22c55e'} onChange={e=>setTplForm(f=>({...f,color:e.target.value}))}
                        style={{ width:240, height:160, border:'none', cursor:'pointer', borderRadius:8, display:'block', padding:0 }}/>
                    </div>
                    <div style={{ display:'flex', gap:7, flexWrap:'wrap', marginBottom:12 }}>
                      {['#22c55e','#3b82f6','#8b5cf6','#f97316','#ef4444','#06b6d4','#ec4899','#eab308','#14b8a6','#6366f1','#1e40af','#0e7490','#dc2626','#16a34a','#0284c7','#7c3aed'].map(c=>(
                        <div key={c} onClick={()=>setTplForm(f=>({...f,color:c}))} style={{ width:26,height:26,borderRadius:6,background:c,cursor:'pointer',border:tplForm.color===c?'3px solid #000':'2px solid transparent',boxShadow:tplForm.color===c?'0 0 0 1px #fff inset':undefined,transition:'transform 0.1s',transform:tplForm.color===c?'scale(1.15)':'scale(1)' }}/>
                      ))}
                    </div>
                    <button onClick={()=>setTplColorOpen(false)} style={{ width:'100%', padding:'7px', borderRadius:7, border:'none', background:'var(--gray-800)', color:'white', fontSize:12, cursor:'pointer', fontWeight:700 }}>✓ Done</button>
                  </div>
                )}
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label>Text Colour</label>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:6 }}>
                  <div style={{ width:36, height:36, borderRadius:8, background:tplForm.text_color||'#ffffff', border:'2px solid var(--gray-200)', cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={()=>{setTplTextColorOpen(o=>!o);setTplColorOpen(false);}}>
                    <span style={{ fontSize:14, color: tplForm.text_color ? 'transparent' : '#94a3b8' }}>A</span>
                  </div>
                  <span style={{ fontSize:12, color:'var(--gray-500)' }}>{tplForm.text_color||'Default (white)'}</span>
                  {tplForm.text_color && <button onClick={()=>setTplForm(f=>({...f,text_color:''}))} style={{ fontSize:11, background:'none', border:'none', cursor:'pointer', color:'var(--gray-400)', textDecoration:'underline' }}>Reset</button>}
                </div>
                {/* Preview pill */}
                {(tplForm.color||tplForm.text_color) && (
                  <div style={{ marginTop:8, display:'inline-flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:20, background:tplForm.color||'#1e293b', color:tplForm.text_color||'#ffffff', fontSize:12, fontWeight:700 }}>
                    {tplForm.name||'Preview'} · {tplForm.start_time}–{tplForm.end_time}
                  </div>
                )}
                {tplTextColorOpen && (
                  <div style={{ marginTop:10, padding:16, background:'white', border:'1.5px solid var(--gray-200)', borderRadius:12, display:'inline-block', boxShadow:'0 4px 20px rgba(0,0,0,0.1)' }}>
                    <div style={{ marginBottom:12 }}>
                      <input type="color" value={tplForm.text_color||'#ffffff'} onChange={e=>setTplForm(f=>({...f,text_color:e.target.value}))}
                        style={{ width:240, height:160, border:'none', cursor:'pointer', borderRadius:8, display:'block', padding:0 }}/>
                    </div>
                    <div style={{ display:'flex', gap:7, flexWrap:'wrap', marginBottom:12 }}>
                      {['#ffffff','#000000','#1e293b','#f8fafc','#fef9c3','#fde68a','#fdba74','#fca5a5','#86efac','#93c5fd','#c4b5fd','#f9a8d4'].map(c=>(
                        <div key={c} onClick={()=>setTplForm(f=>({...f,text_color:c}))} style={{ width:26,height:26,borderRadius:6,background:c,cursor:'pointer',border:tplForm.text_color===c?'3px solid #6366f1':'1.5px solid var(--gray-200)',boxShadow:tplForm.text_color===c?'0 0 0 1px #fff inset':undefined,transition:'transform 0.1s',transform:tplForm.text_color===c?'scale(1.15)':'scale(1)' }}/>
                      ))}
                    </div>
                    <button onClick={()=>setTplTextColorOpen(false)} style={{ width:'100%', padding:'7px', borderRadius:7, border:'none', background:'var(--gray-800)', color:'white', fontSize:12, cursor:'pointer', fontWeight:700 }}>✓ Done</button>
                  </div>
                )}
              </div>
            </div>
            <button className="btn btn-primary" style={{ marginTop:16 }} onClick={handleSaveTemplate}>Save Template</button>
          </div>

          {/* Edit modal */}
          {editTpl && (
            <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={()=>setEditTpl(null)}>
              <div style={{ background:'white', borderRadius:12, padding:28, width:480, maxWidth:'95vw', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }} onClick={e=>e.stopPropagation()}>
                <h3 style={{ fontWeight:700, marginBottom:16 }}>Edit Template</h3>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div style={{ gridColumn:'1/-1' }}><label>Template Name</label><input value={editTpl.name} onChange={e=>setEditTpl(f=>({...f,name:e.target.value}))}/></div>
                  <div><label>Start Time</label><input type="text" maxLength={5} value={editTpl.start_time} onChange={e=>setEditTpl(f=>({...f,start_time:e.target.value.replace(/[^0-9:]/g,'')}))}/></div>
                  <div><label>End Time</label><input type="text" maxLength={5} value={editTpl.end_time} onChange={e=>setEditTpl(f=>({...f,end_time:e.target.value.replace(/[^0-9:]/g,'')}))}/></div>
                  <div style={{ gridColumn:'1/-1' }}><label>Notes</label><input value={editTpl.notes||''} onChange={e=>setEditTpl(f=>({...f,notes:e.target.value}))}/></div>
                  <div style={{ gridColumn:'1/-1' }}>
                    <label>Shift Colour</label>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:6 }}>
                      <div style={{ width:36, height:36, borderRadius:8, background:editTpl.color||'#22c55e', border:'2px solid var(--gray-200)', cursor:'pointer', flexShrink:0 }} onClick={()=>setEditTplColorOpen(o=>!o)}/>
                      <span style={{ fontSize:12, color:'var(--gray-500)' }}>{editTpl.color||'Default (dept colour)'}</span>
                      {editTpl.color && <button onClick={()=>setEditTpl(f=>({...f,color:''}))} style={{ fontSize:11, background:'none', border:'none', cursor:'pointer', color:'var(--gray-400)', textDecoration:'underline' }}>Reset</button>}
                    </div>
                    {editTplColorOpen && (
                      <div style={{ marginTop:10, padding:16, background:'white', border:'1.5px solid var(--gray-200)', borderRadius:12, display:'inline-block', boxShadow:'0 4px 20px rgba(0,0,0,0.1)' }}>
                        <div style={{ position:'relative', marginBottom:12 }}>
                          <input type="color" value={editTpl.color||'#22c55e'} onChange={e=>setEditTpl(f=>({...f,color:e.target.value}))}
                            style={{ width:240, height:160, border:'none', cursor:'pointer', borderRadius:8, display:'block', padding:0 }}/>
                        </div>
                        <div style={{ display:'flex', gap:7, flexWrap:'wrap', marginBottom:12 }}>
                          {['#22c55e','#3b82f6','#8b5cf6','#f97316','#ef4444','#06b6d4','#ec4899','#eab308','#14b8a6','#6366f1','#1e40af','#0e7490','#dc2626','#16a34a','#0284c7','#7c3aed'].map(c=>(
                            <div key={c} onClick={()=>setEditTpl(f=>({...f,color:c}))} style={{ width:26,height:26,borderRadius:6,background:c,cursor:'pointer',border:editTpl.color===c?'3px solid #000':'2px solid transparent',boxShadow:editTpl.color===c?'0 0 0 1px #fff inset':undefined,transition:'transform 0.1s',transform:editTpl.color===c?'scale(1.15)':'scale(1)' }}/>
                          ))}
                        </div>
                        <button onClick={()=>setEditTplColorOpen(false)} style={{ width:'100%', padding:'7px', borderRadius:7, border:'none', background:'var(--gray-800)', color:'white', fontSize:12, cursor:'pointer', fontWeight:700 }}>✓ Done</button>
                      </div>
                    )}
                  </div>
                  <div style={{ gridColumn:'1/-1' }}>
                    <label>Text Colour</label>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:6 }}>
                      <div style={{ width:36, height:36, borderRadius:8, background:editTpl.text_color||'#ffffff', border:'2px solid var(--gray-200)', cursor:'pointer', flexShrink:0 }} onClick={()=>{setEditTplTextColorOpen(o=>!o);setEditTplColorOpen(false);}}/>
                      <span style={{ fontSize:12, color:'var(--gray-500)' }}>{editTpl.text_color||'Default (white)'}</span>
                      {editTpl.text_color && <button onClick={()=>setEditTpl(f=>({...f,text_color:''}))} style={{ fontSize:11, background:'none', border:'none', cursor:'pointer', color:'var(--gray-400)', textDecoration:'underline' }}>Reset</button>}
                    </div>
                    {/* Preview pill */}
                    {(editTpl.color||editTpl.text_color) && (
                      <div style={{ marginTop:8, display:'inline-flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:20, background:editTpl.color||'#1e293b', color:editTpl.text_color||'#ffffff', fontSize:12, fontWeight:700 }}>
                        {editTpl.name||'Preview'} · {editTpl.start_time}–{editTpl.end_time}
                      </div>
                    )}
                    {editTplTextColorOpen && (
                      <div style={{ marginTop:10, padding:16, background:'white', border:'1.5px solid var(--gray-200)', borderRadius:12, display:'inline-block', boxShadow:'0 4px 20px rgba(0,0,0,0.1)' }}>
                        <div style={{ marginBottom:12 }}>
                          <input type="color" value={editTpl.text_color||'#ffffff'} onChange={e=>setEditTpl(f=>({...f,text_color:e.target.value}))}
                            style={{ width:240, height:160, border:'none', cursor:'pointer', borderRadius:8, display:'block', padding:0 }}/>
                        </div>
                        <div style={{ display:'flex', gap:7, flexWrap:'wrap', marginBottom:12 }}>
                          {['#ffffff','#000000','#1e293b','#f8fafc','#fef9c3','#fde68a','#fdba74','#fca5a5','#86efac','#93c5fd','#c4b5fd','#f9a8d4'].map(c=>(
                            <div key={c} onClick={()=>setEditTpl(f=>({...f,text_color:c}))} style={{ width:26,height:26,borderRadius:6,background:c,cursor:'pointer',border:editTpl.text_color===c?'3px solid #6366f1':'1.5px solid var(--gray-200)',transition:'transform 0.1s',transform:editTpl.text_color===c?'scale(1.15)':'scale(1)' }}/>
                          ))}
                        </div>
                        <button onClick={()=>setEditTplTextColorOpen(false)} style={{ width:'100%', padding:'7px', borderRadius:7, border:'none', background:'var(--gray-800)', color:'white', fontSize:12, cursor:'pointer', fontWeight:700 }}>✓ Done</button>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, marginTop:20 }}>
                  <button className="btn btn-primary" onClick={handleSaveEditTemplate}>Save Changes</button>
                  <button className="btn btn-secondary" onClick={()=>{ setEditTpl(null); setEditTplColorOpen(false); setEditTplTextColorOpen(false); }}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          <div className="card" style={{ overflow:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
              <thead><tr style={{ background:'var(--gray-50)', borderBottom:'2px solid var(--gray-200)' }}>
                {['Colour','Name','Time','Notes','Actions'].map(h=><th key={h} style={{ padding:'12px 16px', textAlign:'left', fontSize:12, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {shiftTemplates.length===0 && <tr><td colSpan={5} style={{ padding:40, textAlign:'center', color:'var(--gray-400)' }}>No templates yet</td></tr>}
                {shiftTemplates.map(t=>(
                  <tr key={t.id} style={{ borderBottom:'1px solid var(--gray-100)' }}>
                    <td style={{ padding:'12px 16px' }}>
                      <div style={{ display:'inline-flex', alignItems:'center', padding:'3px 10px', borderRadius:12, background:t.color||'#1e293b', color:t.text_color||'#ffffff', fontSize:11, fontWeight:700 }}>
                        {t.name}
                      </div>
                    </td>
                    <td style={{ padding:'12px 16px', fontWeight:600 }}>{t.name}</td>
                    <td style={{ padding:'12px 16px', fontFamily:'DM Mono,monospace', fontSize:13 }}>{t.start_time} – {t.end_time}</td>
                    <td style={{ padding:'12px 16px', color:'var(--gray-500)' }}>{t.notes||'—'}</td>
                    <td style={{ padding:'12px 16px' }}>
                      <div style={{ display:'flex', gap:6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={()=>{setDrawerForm(f=>({...f,start_time:t.start_time,end_time:t.end_time,color:t.color||null,text_color:t.text_color||null}));setPageTab('schedule');setDrawerOpen(true);}}>Use</button>
                        <button className="btn btn-secondary btn-sm" onClick={()=>{ setEditTpl({...t}); setEditTplColorOpen(false); }}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={()=>handleDeleteTemplate(t.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── UPLOAD SHIFTS TAB ── */}
      {pageTab === 'upload' && (
        <div className="fade-in" style={{ maxWidth:960 }}>

          {/* Steps indicator */}
          <div style={{ display:'flex', alignItems:'center', gap:0, marginBottom:24 }}>
            {[
              { n:1, label:'Download Template', done: true },
              { n:2, label:'Upload CSV',        done: !!importFile },
              { n:3, label:'Review & Import',   done: !!importResult },
            ].map((s,i,arr)=>(
              <React.Fragment key={s.n}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:26, height:26, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, background: s.done?'#059669':'var(--gray-200)', color: s.done?'white':'var(--gray-500)', flexShrink:0 }}>
                    {s.done ? '✓' : s.n}
                  </div>
                  <span style={{ fontSize:13, fontWeight:600, color: s.done?'#059669':'var(--gray-400)', whiteSpace:'nowrap' }}>{s.label}</span>
                </div>
                {i < arr.length-1 && <div style={{ height:2, width:32, background: s.done?'#059669':'var(--gray-200)', margin:'0 8px', flexShrink:0 }}/>}
              </React.Fragment>
            ))}
          </div>

          {/* Step 1 — Download template */}
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:1.2, color:'var(--gray-400)', marginBottom:10 }}>Step 1 — Get the template</div>
          <div className="card" style={{ padding:'20px 24px', marginBottom:20, display:'flex', alignItems:'center', justifyContent:'space-between', gap:20 }}>
            <div>
              <div style={{ fontWeight:700, fontSize:15, marginBottom:6 }}>📄 Shift Upload Template (CSV)</div>
              <div style={{ fontSize:13, color:'var(--gray-500)', marginBottom:10, lineHeight:1.5 }}>
                Fill this in, then upload below. Works with Google Sheets — <em>File → Download → CSV.</em>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {[{col:'agent_email',req:true},{col:'date',req:true},{col:'start_time',req:true},{col:'end_time',req:true},{col:'shift_type',req:false},{col:'notes',req:false},{col:'status',req:false}].map(c=>(
                  <span key={c.col} style={{ padding:'3px 9px', borderRadius:6, fontSize:11, fontWeight:600, fontFamily:'DM Mono,monospace', background:c.req?'#fef2f2':'var(--gray-100)', color:c.req?'var(--red)':'var(--gray-600)', border:`1px solid ${c.req?'#fca5a5':'var(--gray-200)'}` }}>{c.col}{c.req?' *':''}</span>
                ))}
              </div>
              <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:8 }}>
                shift_type: <code>normal</code> · <code>ot_1_5</code> · <code>ot_2</code> · <code>ot_auth</code> &nbsp;|&nbsp; status: <code>published</code> · <code>draft</code> &nbsp;|&nbsp; date: <code>YYYY-MM-DD</code> &nbsp;|&nbsp; time: <code>HH:MM</code>
              </div>
            </div>
            <button onClick={downloadTemplate} style={{ display:'flex', alignItems:'center', gap:8, padding:'11px 20px', background:'var(--gray-800)', color:'white', border:'none', borderRadius:9, fontSize:13, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', fontFamily:'inherit', flexShrink:0 }}>
              ⬇ Download Template
            </button>
          </div>

          {/* Step 2 — Upload */}
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:1.2, color:'var(--gray-400)', marginBottom:10 }}>Step 2 — Upload your filled CSV</div>
          <div className="card" style={{ padding:'20px 24px', marginBottom:20 }}>
            <div
              onDragOver={e=>{e.preventDefault();setImportDragOver(true);}}
              onDragLeave={()=>setImportDragOver(false)}
              onDrop={e=>{e.preventDefault();setImportDragOver(false);handleImportFile(e.dataTransfer.files[0]);}}
              style={{ border:`2px dashed ${importDragOver?'var(--red)':'var(--gray-300)'}`, borderRadius:10, padding:'32px 24px', textAlign:'center', background:importDragOver?'#fff5f5':'var(--gray-50)', transition:'all 0.2s', position:'relative' }}
            >
              <input type="file" accept=".csv" onChange={e=>handleImportFile(e.target.files[0])} style={{ position:'absolute', inset:0, opacity:0, cursor:'pointer', width:'100%', height:'100%' }}/>
              <div style={{ fontSize:30, marginBottom:8 }}>📂</div>
              {importFile ? (
                <>
                  <div style={{ fontWeight:700, fontSize:14, color:'var(--gray-700)', marginBottom:4 }}>📄 {importFile.name}</div>
                  <div style={{ fontSize:12, color:'var(--gray-400)' }}>Click or drag to replace</div>
                </>
              ) : (
                <>
                  <div style={{ fontWeight:700, fontSize:14, color:'var(--gray-700)', marginBottom:4 }}>Drag & drop your CSV here</div>
                  <div style={{ fontSize:12, color:'var(--gray-400)' }}>or <span style={{ color:'var(--red)', fontWeight:600, textDecoration:'underline' }}>browse to choose a file</span></div>
                </>
              )}
            </div>
            <div style={{ fontSize:12, color:'var(--gray-400)', marginTop:8 }}>📌 .csv only · Dates: <strong>YYYY-MM-DD</strong> · Times: <strong>HH:MM</strong></div>
          </div>

          {/* Step 3 — Preview table */}
          {importRows.length > 0 && (() => {
            const ready = importRows.filter(r=>r._status==='ready'||r._status==='done');
            const errors = importRows.filter(r=>r._status==='error');
            const stLabel = t=>({normal:'Normal',ot_1_5:'OT @1.5',ot_2:'OT @2',ot_auth:'Auth OT'}[t]||'Normal');
            const stStyle = t=>({normal:'#f0fdf4|#16a34a',ot_1_5:'#fff7ed|#c2410c',ot_2:'#fdf4ff|#9333ea',ot_auth:'#eff6ff|#1d4ed8'}[t]||'#f0fdf4|#16a34a').split('|');
            return (
              <>
                <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:1.2, color:'var(--gray-400)', marginBottom:10 }}>Step 3 — Review before importing</div>
                <div className="card" style={{ overflow:'hidden', marginBottom:20 }}>
                  <div style={{ padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid var(--gray-100)' }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14 }}>{importFile?.name}</div>
                      <div style={{ fontSize:12, color:'var(--gray-400)', marginTop:2 }}>{importRows.length} rows parsed</div>
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <span style={{ padding:'4px 10px', borderRadius:20, fontSize:12, fontWeight:700, background:'#eff6ff', color:'#1d4ed8' }}>{importRows.length} total</span>
                      <span style={{ padding:'4px 10px', borderRadius:20, fontSize:12, fontWeight:700, background:'#d1fae5', color:'#065f46' }}>✓ {ready.length} ready</span>
                      {errors.length>0 && <span style={{ padding:'4px 10px', borderRadius:20, fontSize:12, fontWeight:700, background:'#fee2e2', color:'#991b1b' }}>✕ {errors.length} error{errors.length!==1?'s':''}</span>}
                    </div>
                  </div>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                      <thead>
                        <tr style={{ background:'var(--gray-50)', borderBottom:'1px solid var(--gray-200)' }}>
                          {['Row','Agent','Email','Date','Time','Type','Status','Notes',''].map(h=>(
                            <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:0.5, whiteSpace:'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.map((r,i)=>{
                          const isErr=r._status==='error';
                          const [bg,fg]=stStyle(r.shift_type);
                          return (
                            <tr key={i} style={{ borderBottom:'1px solid var(--gray-100)', background:isErr?'#fff5f5':'white' }}>
                              <td style={{ padding:'9px 14px', color:'var(--gray-400)', fontSize:12 }}>{r._rowNum}</td>
                              <td style={{ padding:'9px 14px', fontWeight:600, color:isErr?'var(--gray-400)':'var(--gray-800)' }}>{r._agentName||'—'}</td>
                              <td style={{ padding:'9px 14px', fontFamily:'DM Mono,monospace', fontSize:11, color:isErr?'#dc2626':'var(--gray-500)' }}>{r.agent_email||'—'}</td>
                              <td style={{ padding:'9px 14px', fontFamily:'DM Mono,monospace', fontSize:12 }}>{r.date||'—'}</td>
                              <td style={{ padding:'9px 14px', fontFamily:'DM Mono,monospace', fontSize:12, whiteSpace:'nowrap' }}>{r.start_time&&r.end_time?`${r.start_time} → ${r.end_time}`:'—'}</td>
                              <td style={{ padding:'9px 14px' }}><span style={{ padding:'2px 7px', borderRadius:5, fontSize:11, fontWeight:600, background:bg, color:fg }}>{stLabel(r.shift_type)}</span></td>
                              <td style={{ padding:'9px 14px', fontSize:12 }}>
                                {r.status==='draft'?<span style={{ color:'#d97706', fontWeight:600 }}>◐ Draft</span>:<span style={{ color:'#059669', fontWeight:600 }}>● Published</span>}
                              </td>
                              <td style={{ padding:'9px 14px', color:'var(--gray-400)', fontSize:12, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.notes||'—'}</td>
                              <td style={{ padding:'9px 14px', whiteSpace:'nowrap' }}>
                                {r._status==='ready' && <span style={{ padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:700, background:'#d1fae5', color:'#065f46' }}>✓ Ready</span>}
                                {r._status==='done'  && <span style={{ padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:700, background:'#eff6ff', color:'#1d4ed8' }}>✓ Imported</span>}
                                {r._status==='error' && <span title={r._error} style={{ padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:700, background:'#fee2e2', color:'#991b1b', cursor:'help' }}>✕ {r._error}</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {!importResult && (
                    <div style={{ padding:'14px 20px', borderTop:'2px solid var(--gray-100)', background:'var(--gray-50)', display:'flex', alignItems:'center', justifyContent:'space-between', borderRadius:'0 0 12px 12px' }}>
                      <div style={{ fontSize:13, color:'var(--gray-500)' }}>
                        <strong style={{ color:'var(--gray-800)' }}>{ready.length} shift{ready.length!==1?'s':''}</strong> will be created
                        {errors.length>0 && <> · <strong style={{ color:'#dc2626' }}>{errors.length} row{errors.length!==1?'s':''}</strong> will be skipped</>}
                      </div>
                      <div style={{ display:'flex', gap:10 }}>
                        <button onClick={()=>{setImportFile(null);setImportRows([]);setImportResult(null);}} style={{ padding:'8px 16px', borderRadius:8, border:'1.5px solid var(--gray-200)', background:'white', fontFamily:'inherit', fontSize:13, cursor:'pointer', color:'var(--gray-600)', fontWeight:600 }}>✕ Clear</button>
                        <button onClick={handleImport} disabled={importSaving||!ready.length} style={{ padding:'9px 20px', borderRadius:8, border:'none', background:ready.length?'var(--red)':'var(--gray-200)', color:ready.length?'white':'var(--gray-500)', fontFamily:'inherit', fontSize:13, fontWeight:700, cursor:ready.length?'pointer':'not-allowed' }}>
                          {importSaving?'⏳ Importing...':`⬆️ Import ${ready.length} Shift${ready.length!==1?'s':''}`}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}

          {/* Result banner */}
          {importResult && !importResult.error && (
            <div style={{ padding:'18px 24px', borderRadius:12, background:importResult.errors?.length?'#fef3c7':'#d1fae5', border:`1px solid ${importResult.errors?.length?'#fcd34d':'#6ee7b7'}`, display:'flex', alignItems:'flex-start', gap:14, marginBottom:20 }}>
              <div style={{ fontSize:24 }}>{importResult.errors?.length?'⚠️':'🎉'}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:800, fontSize:15, marginBottom:4 }}>Import complete!</div>
                <div style={{ fontSize:13, color:'var(--gray-600)', marginBottom:12 }}>Your shifts have been added to the schedule.</div>
                <div style={{ display:'flex', gap:24 }}>
                  <div><span style={{ fontSize:22, fontWeight:800, color:'#059669', display:'block' }}>{importResult.created}</span><span style={{ fontSize:12, color:'var(--gray-500)', fontWeight:600 }}>Created</span></div>
                  <div><span style={{ fontSize:22, fontWeight:800, color:'#d97706', display:'block' }}>{importResult.skipped}</span><span style={{ fontSize:12, color:'var(--gray-500)', fontWeight:600 }}>Skipped</span></div>
                  {importResult.errors?.length>0 && <div><span style={{ fontSize:22, fontWeight:800, color:'#dc2626', display:'block' }}>{importResult.errors.length}</span><span style={{ fontSize:12, color:'var(--gray-500)', fontWeight:600 }}>Errors</span></div>}
                </div>
                {importResult.errors?.length>0 && (
                  <div style={{ marginTop:12, padding:'10px 14px', borderRadius:8, background:'rgba(0,0,0,0.05)', fontSize:12 }}>
                    <strong>Error details:</strong>
                    <ul style={{ marginTop:4, paddingLeft:16 }}>{importResult.errors.map((e,i)=><li key={i}>{e}</li>)}</ul>
                  </div>
                )}
              </div>
              <button onClick={()=>{setImportFile(null);setImportRows([]);setImportResult(null);}} style={{ padding:'7px 14px', borderRadius:8, border:'1.5px solid rgba(0,0,0,0.1)', background:'white', fontFamily:'inherit', fontSize:12, cursor:'pointer', fontWeight:600, flexShrink:0 }}>Upload Another</button>
            </div>
          )}
          {importResult?.error && (
            <div style={{ padding:'14px 20px', borderRadius:10, background:'#fee2e2', border:'1px solid #fca5a5', color:'#991b1b', fontWeight:600, fontSize:13 }}>✕ {importResult.error}</div>
          )}

        </div>
      )}{/* end upload tab */}

      {/* ── LEAVE TAB ── */}
      {pageTab === 'leave' && (
        <div className="fade-in">
          {leaveMsg && <div style={{ padding:'10px 16px', borderRadius:8, background: leaveMsg==='Saved!'?'#d1fae5':'#fef2f2', color: leaveMsg==='Saved!'?'#065f46':'#dc2626', marginBottom:16, fontSize:13, fontWeight:600 }}>{leaveMsg}</div>}

          {showLeaveForm && (
            <div className="card" style={{ padding:24, marginBottom:20, maxWidth:560 }}>
              <h3 style={{ fontWeight:700, marginBottom:16 }}>{leaveEditing ? 'Edit Leave' : 'Add Leave'}</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div><label>Agent *</label>
                  <select value={leaveForm.user_id} onChange={e=>setLeaveForm(f=>({...f,user_id:e.target.value}))}>
                    <option value="">Select agent...</option>
                    {users.filter(u=>u.user_type==='agent').map(u=><option key={u.id} value={u.id}>{u.name} ({u.department})</option>)}
                  </select>
                </div>
                <div><label>Leave Type *</label>
                  <select value={leaveForm.leave_type_id} onChange={e=>setLeaveForm(f=>({...f,leave_type_id:e.target.value}))}>
                    <option value="">Select type...</option>
                    {leaveTypes.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div><label>From *</label><input type="date" value={leaveForm.date_from} onChange={e=>setLeaveForm(f=>({...f,date_from:e.target.value,date_to:f.date_to||e.target.value}))}/></div>
                  <div><label>To *</label><input type="date" value={leaveForm.date_to} min={leaveForm.date_from} onChange={e=>setLeaveForm(f=>({...f,date_to:e.target.value}))}/></div>
                </div>
                <div><label>Half Day</label>
                  <select value={leaveForm.half_day} onChange={e=>setLeaveForm(f=>({...f,half_day:e.target.value}))}>
                    <option value="">Full day(s)</option>
                    <option value="morning">Morning half</option>
                    <option value="afternoon">Afternoon half</option>
                  </select>
                </div>
                <div><label>Notes</label><input placeholder="Optional notes" value={leaveForm.notes} onChange={e=>setLeaveForm(f=>({...f,notes:e.target.value}))}/></div>
              </div>
              <div style={{ display:'flex', gap:8, marginTop:16 }}>
                <button className="btn btn-primary" onClick={handleLeaveSubmit}>{leaveEditing?'Save Changes':'Add Leave'}</button>
                <button className="btn btn-secondary" onClick={()=>{setShowLeaveForm(false);setLeaveEditing(null);}}>Cancel</button>
              </div>
            </div>
          )}

          <div className="card" style={{ overflow:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
              <thead><tr style={{ background:'var(--gray-50)', borderBottom:'2px solid var(--gray-200)' }}>
                {['Agent','Dept','Type','From','To','Half Day','Notes','Actions'].map(h=>(
                  <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontSize:12, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {allLeaves.length===0 && <tr><td colSpan={8} style={{ padding:40, textAlign:'center', color:'var(--gray-400)' }}>No leave records</td></tr>}
                {allLeaves.filter(l => filterDepts.length===0 || filterDepts.includes(l.user_department)).map(l => {
                  const lt = leaveTypes.find(t=>String(t.id)===String(l.leave_type_id));
                  return (
                    <tr key={l.id} style={{ borderBottom:'1px solid var(--gray-100)' }}>
                      <td style={{ padding:'12px 16px', fontWeight:600 }}>{l.user_name||'—'}</td>
                      <td style={{ padding:'12px 16px', color:'var(--gray-500)' }}>{l.user_department||'—'}</td>
                      <td style={{ padding:'12px 16px' }}>
                        <span style={{ padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:600, background:lt?.bg_color||'#ede9fe', color:lt?.color||'#6366f1' }}>{l.leave_type_name||'—'}</span>
                      </td>
                      <td style={{ padding:'12px 16px', fontFamily:'DM Mono,monospace', fontSize:13 }}>{l.date_from?.slice(0,10)||'—'}</td>
                      <td style={{ padding:'12px 16px', fontFamily:'DM Mono,monospace', fontSize:13 }}>{l.date_to?.slice(0,10)||'—'}</td>
                      <td style={{ padding:'12px 16px', color:'var(--gray-500)', fontSize:12 }}>{l.half_day||'—'}</td>
                      <td style={{ padding:'12px 16px', color:'var(--gray-500)', fontSize:12 }}>{l.notes||'—'}</td>
                      <td style={{ padding:'12px 16px' }}>
                        <div style={{ display:'flex', gap:5 }}>
                          <button className="btn btn-secondary btn-sm" onClick={()=>{ setLeaveEditing(l); setLeaveForm({user_id:l.user_id,leave_type_id:l.leave_type_id,date_from:l.date_from,date_to:l.date_to,half_day:l.half_day||'',notes:l.notes||''}); setShowLeaveForm(true); }}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={()=>handleLeaveDelete(l.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick shift change modal */}
      {editCell && (() => {
        const cellLeave = leaves.find(l => l.user_id===editCell.agent.id && l.date_from<=editCell.date && l.date_to>=editCell.date);
        return (
          <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000 }} onClick={()=>setEditCell(null)}>
            <div className="card" style={{ padding:28,width:420 }} onClick={e=>e.stopPropagation()}>
              <div style={{ fontWeight:800,fontSize:16,marginBottom:4 }}>
                {editCell.shift ? '✏️ Change Shift' : '➕ Add Shift'}
              </div>
              <div style={{ fontSize:13,color:'var(--gray-500)',marginBottom: cellLeave ? 8 : 16 }}>
                {editCell.agent.name} · {editCell.date}
              </div>
              {cellLeave && (
                <div style={{ padding:'10px 14px', borderRadius:8, background:'#fffbeb', border:'1px solid #fcd34d', marginBottom:16, fontSize:13 }}>
                  ⚠️ <strong>{editCell.agent.name}</strong> has <strong style={{ color: cellLeave.leave_type_color||'#6366f1' }}>{cellLeave.leave_type_name}</strong> on this day.
                  {cellLeave.half_day && <span style={{ color:'var(--gray-500)' }}> ({cellLeave.half_day} half-day)</span>}
                  <div style={{ fontSize:12, color:'var(--gray-500)', marginTop:4 }}>You can still save the shift — useful for half-day scenarios.</div>
                </div>
              )}
              {shiftTemplates.length > 0 && (
                <div style={{ marginBottom:16 }}>
                  <label style={{ fontSize:12,fontWeight:600,color:'var(--gray-600)',display:'block',marginBottom:8 }}>Quick Apply from Template</label>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {shiftTemplates.map(t => (
                      <button key={t.id} onClick={() => setEditForm(f => ({ ...f, start_time:t.start_time, end_time:t.end_time, shift_type: t.shift_type || f.shift_type }))}
                        style={{ padding:'5px 12px', borderRadius:7, border:'1.5px solid var(--gray-300)', background:'white', color:'var(--gray-700)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}
                        title={`${t.start_time}–${t.end_time}${t.notes?' · '+t.notes:''}`}>
                        {t.name} <span style={{ opacity:0.5, fontWeight:400 }}>{t.start_time?.slice(0,5)}–{t.end_time?.slice(0,5)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14 }}>
                <div>
                  <label style={{ fontSize:12,fontWeight:600,color:'var(--gray-600)',display:'block',marginBottom:6 }}>Start Time</label>
                  <input type="time" value={editForm.start_time} onChange={e=>setEditForm(f=>({...f,start_time:e.target.value}))} style={{ width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid var(--gray-200)',fontSize:14,fontFamily:'inherit' }}/>
                </div>
                <div>
                  <label style={{ fontSize:12,fontWeight:600,color:'var(--gray-600)',display:'block',marginBottom:6 }}>End Time</label>
                  <input type="time" value={editForm.end_time} onChange={e=>setEditForm(f=>({...f,end_time:e.target.value}))} style={{ width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid var(--gray-200)',fontSize:14,fontFamily:'inherit' }}/>
                </div>
              </div>
              <div style={{ marginBottom:20 }}>
                <label style={{ fontSize:12,fontWeight:600,color:'var(--gray-600)',display:'block',marginBottom:6 }}>Shift Type</label>
                <select value={editForm.shift_type||'normal'} onChange={e=>setEditForm(f=>({...f,shift_type:e.target.value}))}
                  style={{ width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid var(--gray-200)',fontSize:14,fontFamily:'inherit' }}>
                  <option value="normal">Normal Shift</option>
                  <option value="ot_1_5">Overtime @ 1.5 (Weekend)</option>
                  <option value="ot_2">Overtime @ 2 (Public Holiday)</option>
                  <option value="ot_auth">Authorised OT @ 1.5</option>
                </select>
              </div>
              <div style={{ display:'flex',gap:8 }}>
                <button className="btn btn-primary" style={{ flex:1,justifyContent:'center' }} onClick={handleEditSave} disabled={editSaving}>
                  {editSaving ? 'Saving...' : editCell.shift ? 'Update Shift' : 'Add Shift'}
                </button>
                {editCell.shift && (
                  <button className="btn btn-secondary" onClick={handleEditDelete} disabled={editSaving} style={{ color:'#dc2626',borderColor:'#fca5a5' }}>
                    🗑
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
      </div>{/* end scrollable content */}
      </div>{/* end body row */}

      {/* ── FIXED FULL-HEIGHT DRAWER ── */}
      {drawerOpen && pageTab === 'schedule' && (
        <div style={{ position:'fixed', top:0, right:0, bottom:0, width:440, background:'white', borderLeft:'2px solid var(--gray-200)', boxShadow:'-6px 0 32px rgba(0,0,0,0.12)', zIndex:300, display:'flex', flexDirection:'column', overflowY:'auto' }}>

          {/* Drawer Header */}
          <div style={{ padding:'16px 20px 0', borderBottom:'2px solid var(--gray-100)', flexShrink:0, position:'sticky', top:0, background:'white', zIndex:1 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div style={{ fontWeight:800, fontSize:16, color:'var(--gray-900)' }}>
                {drawerMode==='assign' ? '✏️ Manage Shifts' : '🏖️ Submit Leave'}
              </div>
              <button onClick={()=>setDrawerOpen(false)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--gray-400)', padding:4, lineHeight:1 }}>✕</button>
            </div>
            {/* Sub-mode tabs for Manage Shifts */}
            {drawerMode==='assign' && (
              <div style={{ display:'flex', gap:0, marginBottom:0 }}>
                {[
                  { key:'assign',  label:'Assign' },
                  { key:'replace', label:'Replace' },
                  { key:'remove',  label:'Remove' },
                ].map(tab => (
                  <button key={tab.key} onClick={()=>{ setDrawerSubMode(tab.key); setDrawerMsg(''); }} style={{
                    flex:1, padding:'8px 4px', border:'none', borderBottom: drawerSubMode===tab.key ? '3px solid var(--red)' : '3px solid transparent',
                    background:'transparent', fontFamily:'inherit', fontSize:13, fontWeight: drawerSubMode===tab.key ? 700 : 500,
                    color: drawerSubMode===tab.key ? 'var(--red)' : 'var(--gray-500)', cursor:'pointer',
                    transition:'all 0.15s',
                  }}>{tab.label}</button>
                ))}
              </div>
            )}
          </div>

          {/* Drawer Body */}
          <div style={{ flex:1, padding:'16px 20px', display:'flex', flexDirection:'column', gap:18 }}>

            {/* AGENTS */}
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1, color:'var(--gray-400)' }}>Agents</div>
                <button onClick={()=>drawerAgents.length===assignableAgents.length ? setDrawerAgents([]) : setDrawerAgents(assignableAgents.map(a=>a.id))} style={{ fontSize:11, background:'none', border:'none', cursor:'pointer', color:'var(--red)', fontFamily:'inherit', fontWeight:600 }}>
                  {drawerAgents.length===assignableAgents.length ? 'Clear All' : 'Select All'}
                </button>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                {assignableAgents.map(a => {
                  const selected = drawerAgents.includes(a.id);
                  return (
                    <button key={a.id} onClick={()=>toggleDrawerAgent(a.id)} style={{ padding:'5px 11px', borderRadius:20, border:`2px solid ${selected?'var(--red)':'var(--gray-200)'}`, background:selected?'#fef2f2':'white', color:selected?'var(--red)':'var(--gray-700)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'all 0.12s' }}>
                      {a.name}
                      {(a.location||'SA')!=='SA' && <span style={{ marginLeft:5, fontSize:10, background:'#eff6ff', color:'#1d4ed8', padding:'1px 5px', borderRadius:8, fontWeight:700 }}>{a.location}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SHIFT TIME + TEMPLATES */}
            {drawerMode !== 'leave' && drawerSubMode !== 'remove' && (
              <div>
                <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1, color:'var(--gray-400)', marginBottom:8 }}>Shift Time</div>
                <div style={{ display:'flex', gap:8, marginBottom:10, alignItems:'center' }}>
                  <input value={drawerForm.start_time} onChange={e=>setDrawerForm(f=>({...f,start_time:e.target.value}))} placeholder="07:00" maxLength={5} style={{ width:72, padding:'7px 9px', borderRadius:7, border:'1.5px solid var(--gray-200)', fontFamily:'DM Mono,monospace', fontSize:13 }}/>
                  <span style={{ color:'var(--gray-400)', fontSize:13 }}>—</span>
                  <input value={drawerForm.end_time} onChange={e=>setDrawerForm(f=>({...f,end_time:e.target.value}))} placeholder="15:00" maxLength={5} style={{ width:72, padding:'7px 9px', borderRadius:7, border:'1.5px solid var(--gray-200)', fontFamily:'DM Mono,monospace', fontSize:13 }}/>
                </div>
                {shiftTemplates.length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:10 }}>
                    {shiftTemplates.map(t=>(
                      <button key={t.id} onClick={()=>setDrawerForm(f=>({...f,start_time:t.start_time,end_time:t.end_time,color:t.color||null,text_color:t.text_color||null}))}
                        style={{ padding:'4px 10px', borderRadius:20, border:`1.5px solid ${drawerForm.color===t.color&&drawerForm.start_time===t.start_time?'var(--red)':'var(--gray-200)'}`, background:'white', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5 }}>
                        {t.color && <span style={{ width:8,height:8,borderRadius:'50%',background:t.color,display:'inline-block',flexShrink:0 }}/>}
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ display:'flex', gap:6 }}>
                  {['published','draft'].map(s=>(
                    <button key={s} onClick={()=>setDrawerForm(f=>({...f,status:s}))} style={{ flex:1, padding:'6px', borderRadius:7, border:`1.5px solid ${drawerForm.status===s?'var(--red)':'var(--gray-200)'}`, background:drawerForm.status===s?'#fef2f2':'white', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', color:drawerForm.status===s?'var(--red)':'var(--gray-600)', textTransform:'capitalize' }}>{s}</button>
                  ))}
                </div>
              </div>
            )}

            {/* DATE RANGE */}
            {drawerMode !== 'leave' && (
              <div>
                <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1, color:'var(--gray-400)', marginBottom:8 }}>Date Range</div>
                <RangePickerInline dateFrom={drawerForm.date_from} dateTo={drawerForm.date_to} onChange={(from,to)=>setDrawerForm(f=>({...f,date_from:from,date_to:to}))} showModeToggle={true} onModeChange={(m)=>setDrawerSkipWeekends(m==='week')}/>
              </div>
            )}

            {/* LEAVE FIELDS */}
            {drawerMode === 'leave' && (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div>
                  <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1, color:'var(--gray-400)', marginBottom:6 }}>Leave Type *</div>
                  <select value={leaveForm.leave_type_id} onChange={e=>setLeaveForm(f=>({...f,leave_type_id:e.target.value}))} style={{ width:'100%', padding:'7px 10px', borderRadius:7, border:'1.5px solid var(--gray-200)', fontFamily:'inherit', fontSize:13 }}>
                    <option value="">Select type...</option>
                    {leaveTypes.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1, color:'var(--gray-400)', marginBottom:6 }}>Date Range *</div>
                  <RangePickerInline dateFrom={leaveForm.date_from} dateTo={leaveForm.date_to} onChange={(from,to)=>setLeaveForm(f=>({...f,date_from:from,date_to:to}))} showModeToggle={true}/>
                </div>
                <div>
                  <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1, color:'var(--gray-400)', marginBottom:6 }}>Half Day</div>
                  <select value={leaveForm.half_day} onChange={e=>setLeaveForm(f=>({...f,half_day:e.target.value}))} style={{ width:'100%', padding:'7px 10px', borderRadius:7, border:'1.5px solid var(--gray-200)', fontFamily:'inherit', fontSize:13 }}>
                    <option value="">Full day(s)</option>
                    <option value="morning">Morning half</option>
                    <option value="afternoon">Afternoon half</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1, color:'var(--gray-400)', marginBottom:6 }}>Notes</div>
                  <input placeholder="Optional" value={leaveForm.notes} onChange={e=>setLeaveForm(f=>({...f,notes:e.target.value}))} style={{ width:'100%', padding:'7px 10px', borderRadius:7, border:'1.5px solid var(--gray-200)', fontFamily:'inherit', fontSize:13, boxSizing:'border-box' }}/>
                </div>
              </div>
            )}

            {/* SUBMIT */}
            <div style={{ marginTop:'auto', paddingTop:16, borderTop:'1px solid var(--gray-100)', display:'flex', flexDirection:'column', gap:8 }}>
              {drawerMsg && <div style={{ padding:'8px 12px', borderRadius:7, background:drawerMsg.startsWith('✓')?'#d1fae5':'#fef2f2', color:drawerMsg.startsWith('✓')?'#065f46':'#dc2626', fontSize:12, fontWeight:600 }}>{drawerMsg}</div>}
              <div style={{ fontSize:12, color:'var(--gray-400)' }}>{drawerAgents.length} agent{drawerAgents.length!==1?'s':''} selected</div>
              {drawerMode==='assign' && drawerSubMode !== 'remove' && (
                <button onClick={handleBulkAssign} disabled={drawerSaving||!drawerAgents.length} style={{ width:'100%', padding:'11px', borderRadius:8, border:'none', background:drawerAgents.length?(drawerSubMode==='replace'?'#b45309':'var(--red)'):'var(--gray-200)', color:drawerAgents.length?'white':'var(--gray-500)', fontFamily:'inherit', fontSize:14, fontWeight:700, cursor:drawerAgents.length?'pointer':'not-allowed' }}>
                  {drawerSaving ? (drawerSubMode==='replace'?'Replacing...':'Assigning...') : (drawerSubMode==='replace'?'Replace Shifts':'Assign Shifts')}
                </button>
              )}
              {drawerMode==='assign' && drawerSubMode === 'remove' && (
                <button onClick={handleBulkRemove} disabled={drawerSaving||!drawerAgents.length} style={{ width:'100%', padding:'11px', borderRadius:8, border:'none', background:drawerAgents.length?'#991b1b':'var(--gray-200)', color:drawerAgents.length?'white':'var(--gray-500)', fontFamily:'inherit', fontSize:14, fontWeight:700, cursor:drawerAgents.length?'pointer':'not-allowed' }}>
                  {drawerSaving?'Removing...':'Remove Shifts'}
                </button>
              )}
              {drawerMode==='leave' && (
                <button onClick={async()=>{
                  if(!drawerAgents.length) return setDrawerMsg('Select at least one agent');
                  if(!leaveForm.leave_type_id) return setDrawerMsg('Please select a leave type');
                  if(!leaveForm.date_from) return setDrawerMsg('Please select a date range');
                  const submitForm={...leaveForm,date_to:leaveForm.date_to||leaveForm.date_from};
                  setDrawerSaving(true); setDrawerMsg('');
                  try {
                    await Promise.all(drawerAgents.map(uid=>axios.post('/api/leave',{...submitForm,user_id:uid})));
                    await fetchData();
                    setDrawerMsg('✓ Leave submitted!');
                    setDrawerAgents([]); setLeaveForm({user_id:'',leave_type_id:'',date_from:'',date_to:'',half_day:'',notes:''});
                    setTimeout(()=>setDrawerMsg(''),3000);
                  } catch(e){ setDrawerMsg(e.response?.data?.error||'Error'); }
                  setDrawerSaving(false);
                }} disabled={drawerSaving||!drawerAgents.length} style={{ width:'100%', padding:'11px', borderRadius:8, border:'none', background:drawerAgents.length?'#1e3a5f':'var(--gray-200)', color:drawerAgents.length?'white':'var(--gray-500)', fontFamily:'inherit', fontSize:14, fontWeight:700, cursor:drawerAgents.length?'pointer':'not-allowed' }}>
                  {drawerSaving?'Submitting...':'Submit Leave'}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

// ── HOURS VIEW ────────────────────────────────────────────────────────────────
function HoursView({ current, setCurrent, users, shifts, leaves, publicHolidays, filterDepts, filterAgent, depts }) {
  const [viewMonth, setViewMonth] = React.useState(current || new Date());

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);

  // Get all weeks that overlap this month (Mon-Sun)
  const weeks = [];
  let wStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  while (wStart <= monthEnd) {
    const wEnd = endOfWeek(wStart, { weekStartsOn: 1 });
    weeks.push({ start: wStart, end: wEnd, days: eachDayOfInterval({ start: wStart, end: wEnd }) });
    wStart = addDays(wStart, 7);
  }

  const holidayDates = new Set(publicHolidays.map(h => h.date));

  const calcHours = (start, end) => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60; // overnight
    return Math.round((mins / 60) * 10) / 10;
  };

  const agents = users.filter(u => u.user_type === 'agent'
    && (filterDepts.length===0 || filterDepts.includes(u.department))
    && (filterAgent === 'all' || u.id === filterAgent));

  // Per agent per week: normal, ot1.5, ot2, leave hours, total
  const getAgentWeekData = (agentId, week) => {
    const weekDays = week.days.map(d => format(d, 'yyyy-MM-dd'));
    let normal = 0, ot15 = 0, ot2 = 0, leaveHrs = 0;

    for (const day of weekDays) {
      const dayShifts = shifts.filter(s => s.user_id === agentId && s.date === day);
      const isWeekendDay = [0,6].includes(new Date(day + 'T00:00').getDay());
      const isHoliday = holidayDates.has(day);

      for (const s of dayShifts) {
        const hrs = calcHours(s.start_time, s.end_time);
        const type = s.shift_type || 'normal';
        if (type === 'ot_2' || isHoliday) ot2 += hrs;
        else if (type === 'ot_1_5' || type === 'ot_auth' || isWeekendDay) ot15 += hrs;
        else normal += hrs;
      }

      // Leave hours — full day = 8hrs, half day = 4hrs
      const agentLeave = leaves.find(l => l.user_id === agentId && l.date_from <= day && l.date_to >= day);
      if (agentLeave && !isWeekendDay) {
        leaveHrs += agentLeave.half_day ? 4 : 8;
      }
    }

    return {
      normal: Math.round(normal * 10) / 10,
      ot15: Math.round(ot15 * 10) / 10,
      ot2: Math.round(ot2 * 10) / 10,
      leave: Math.round(leaveHrs * 10) / 10,
      total: Math.round((normal + ot15 + ot2 + leaveHrs) * 10) / 10,
    };
  };

  const getAgentMonthTotals = (agentId) => {
    let normal = 0, ot15 = 0, ot2 = 0, leave = 0;
    for (const week of weeks) {
      const d = getAgentWeekData(agentId, week);
      normal += d.normal; ot15 += d.ot15; ot2 += d.ot2; leave += d.leave;
    }
    return {
      normal: Math.round(normal * 10) / 10,
      ot15: Math.round(ot15 * 10) / 10,
      ot2: Math.round(ot2 * 10) / 10,
      leave: Math.round(leave * 10) / 10,
      total: Math.round((normal + ot15 + ot2 + leave) * 10) / 10,
    };
  };

  const downloadCSV = () => {
    const monthLabel = format(viewMonth, 'MMMM yyyy');
    const weekLabels = weeks.map(w => `Wk ${getWeek(w.start)} (${format(w.start,'d MMM')}-${format(w.end,'d MMM')})`);

    const headers = ['Agent', 'Department',
      ...weekLabels.flatMap(w => [`${w} Normal`, `${w} OT@1.5`, `${w} OT@2`, `${w} Leave`, `${w} Total`]),
      'Month Normal', 'Month OT@1.5', 'Month OT@2', 'Month Leave', 'Month Total'
    ];

    const rows = agents.map(agent => {
      const weekData = weeks.map(w => getAgentWeekData(agent.id, w));
      const month = getAgentMonthTotals(agent.id);
      return [
        agent.name, agent.department,
        ...weekData.flatMap(d => [d.normal, d.ot15, d.ot2, d.leave, d.total]),
        month.normal, month.ot15, month.ot2, month.leave, month.total
      ];
    });

    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `hours-${format(viewMonth,'yyyy-MM')}.csv`; a.click();
  };

  const th = (txt, style={}) => (
    <th style={{ padding:'8px 12px', fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.8)', textAlign:'center', whiteSpace:'nowrap', borderRight:'1px solid rgba(255,255,255,0.1)', ...style }}>{txt}</th>
  );

  const byDept = {};
  agents.forEach(a => { if (!byDept[a.department]) byDept[a.department] = []; byDept[a.department].push(a); });

  return (
    <div>
      {/* Header bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={()=>setViewMonth(m=>addMonths(m,-1))} className="btn btn-secondary" style={{ fontSize:13, padding:'6px 12px' }}>← Prev</button>
          <span style={{ fontWeight:700, fontSize:16, minWidth:140, textAlign:'center' }}>{format(viewMonth,'MMMM yyyy')}</span>
          <button onClick={()=>setViewMonth(m=>addMonths(m,1))} className="btn btn-secondary" style={{ fontSize:13, padding:'6px 12px' }}>Next →</button>
          <button onClick={()=>setViewMonth(new Date())} className="btn btn-secondary" style={{ fontSize:13, padding:'6px 12px' }}>This Month</button>
        </div>
        <button onClick={downloadCSV} className="btn btn-primary" style={{ fontSize:13, gap:6 }}>⬇ Download CSV</button>
      </div>

      {/* Legend */}
      <div style={{ display:'flex', gap:16, marginBottom:12, flexWrap:'wrap', fontSize:12 }}>
        {[['Normal','#f0fdf4','#16a34a'],['OT @ 1.5 (Weekend/Auth)','#fffbeb','#d97706'],['OT @ 2 (Public Holiday)','#fef2f2','#dc2626'],['Leave Hours','#ede9fe','#7c3aed']].map(([l,bg,c])=>(
          <div key={l} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ width:12, height:12, borderRadius:3, background:bg, border:`1.5px solid ${c}` }}/>
            <span style={{ color:'var(--gray-600)' }}>{l}</span>
          </div>
        ))}
        <span style={{ color:'var(--gray-400)', fontStyle:'italic' }}>· SA public holidays auto-detected as OT@2</span>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow:'auto', padding:0 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth: 900 }}>
          <thead>
            <tr style={{ background:'#1a1a2e' }}>
              {th('Agent', { textAlign:'left', width:150 })}
              {weeks.map(w => (
                <th key={w.start} colSpan={5} style={{ padding:'8px 12px', fontSize:11, fontWeight:700, color:'white', textAlign:'center', borderRight:'2px solid rgba(255,255,255,0.2)', background: isSameMonth(w.start, viewMonth) && isSameMonth(w.end, viewMonth) ? '#1a1a2e' : '#2d3748' }}>
                  Wk {getWeek(w.start)}<br/>
                  <span style={{ fontSize:10, opacity:0.7 }}>{format(w.start,'d MMM')}–{format(w.end,'d MMM')}</span>
                </th>
              ))}
              <th colSpan={5} style={{ padding:'8px 12px', fontSize:11, fontWeight:700, color:'white', textAlign:'center', background:'var(--red)' }}>
                Month Total<br/><span style={{ fontSize:10, opacity:0.8 }}>{format(viewMonth,'MMMM')}</span>
              </th>
            </tr>
            <tr style={{ background:'#2d3748' }}>
              <th style={{ padding:'6px 12px', textAlign:'left', color:'rgba(255,255,255,0.6)', fontSize:10 }}>Name</th>
              {weeks.map(w => (
                <React.Fragment key={w.start}>
                  {[['Norm','#bbf7d0','#166534'],['OT 1.5','#fed7aa','#c2410c'],['OT 2','#fecaca','#dc2626'],['Leave','#ddd6fe','#7c3aed'],['Total','white','#1a1a2e']].map(([l,bg,c])=>(
                    <th key={l} style={{ padding:'5px 6px', fontSize:9, fontWeight:700, color:c, textAlign:'center', background:bg+'33', borderRight:'1px solid rgba(255,255,255,0.1)', minWidth:48 }}>{l}</th>
                  ))}
                </React.Fragment>
              ))}
              {[['Norm','#bbf7d0','#166534'],['OT 1.5','#fed7aa','#c2410c'],['OT 2','#fecaca','#dc2626'],['Leave','#ddd6fe','#7c3aed'],['Total','white','#1a1a2e']].map(([l,bg,c])=>(
                <th key={`m-${l}`} style={{ padding:'5px 6px', fontSize:9, fontWeight:700, color:c, textAlign:'center', background:'rgba(192,57,43,0.2)', borderRight:'1px solid rgba(255,255,255,0.1)', minWidth:48 }}>{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(byDept).map(([dept, dagents]) => {
              const dc = depts.find(d=>d.name===dept);
              return (
                <React.Fragment key={dept}>
                  <tr>
                    <td colSpan={5 * weeks.length + 6} style={{ padding:'6px 14px', background:dc?dc.bg_color:'#f1f5f9', fontWeight:700, fontSize:11, color:dc?dc.color:'#334155', letterSpacing:0.5 }}>
                      {dept}
                    </td>
                  </tr>
                  {dagents.map((agent, i) => {
                    const month = getAgentMonthTotals(agent.id);
                    return (
                      <tr key={agent.id} style={{ background: i%2===0?'white':'#f8fafc', borderBottom:'1px solid #f1f5f9' }}>
                        <td style={{ padding:'8px 12px', fontWeight:600, whiteSpace:'nowrap' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div style={{ width:22, height:22, borderRadius:'50%', background:'var(--red)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 }}>
                              {agent.name?.trim()?.[0]?.toUpperCase()}
                            </div>
                            {agent.name}
                          </div>
                        </td>
                        {weeks.map(week => {
                          const d = getAgentWeekData(agent.id, week);
                          const hasData = d.total > 0;
                          return (
                            <React.Fragment key={week.start}>
                              <td style={{ padding:'6px 8px', textAlign:'center', background: d.normal>0?'#f0fdf4':undefined, color:'#16a34a', fontWeight: d.normal>0?700:400 }}>{d.normal||'—'}</td>
                              <td style={{ padding:'6px 8px', textAlign:'center', background: d.ot15>0?'#fffbeb':undefined, color:'#d97706', fontWeight: d.ot15>0?700:400 }}>{d.ot15||'—'}</td>
                              <td style={{ padding:'6px 8px', textAlign:'center', background: d.ot2>0?'#fef2f2':undefined, color:'#dc2626', fontWeight: d.ot2>0?700:400 }}>{d.ot2||'—'}</td>
                              <td style={{ padding:'6px 8px', textAlign:'center', background: d.leave>0?'#ede9fe':undefined, color:'#7c3aed', fontWeight: d.leave>0?700:400 }}>{d.leave||'—'}</td>
                              <td style={{ padding:'6px 8px', textAlign:'center', fontWeight:700, color: hasData?'#1a1a2e':'var(--gray-300)', borderRight:'2px solid #e2e8f0' }}>{hasData?d.total:'—'}</td>
                            </React.Fragment>
                          );
                        })}
                        <td style={{ padding:'6px 8px', textAlign:'center', background: month.normal>0?'#f0fdf4':undefined, color:'#16a34a', fontWeight:700 }}>{month.normal||'—'}</td>
                        <td style={{ padding:'6px 8px', textAlign:'center', background: month.ot15>0?'#fffbeb':undefined, color:'#d97706', fontWeight:700 }}>{month.ot15||'—'}</td>
                        <td style={{ padding:'6px 8px', textAlign:'center', background: month.ot2>0?'#fef2f2':undefined, color:'#dc2626', fontWeight:700 }}>{month.ot2||'—'}</td>
                        <td style={{ padding:'6px 8px', textAlign:'center', background: month.leave>0?'#ede9fe':undefined, color:'#7c3aed', fontWeight:700 }}>{month.leave||'—'}</td>
                        <td style={{ padding:'6px 8px', textAlign:'center', fontWeight:800, fontSize:13, background:'#fef2f2', color:'var(--red)' }}>{month.total||'—'}</td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
            {agents.length === 0 && (
              <tr><td colSpan={5 * weeks.length + 6} style={{ padding:40, textAlign:'center', color:'var(--gray-400)' }}>No agents match the current filter</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop:10, fontSize:12, color:'var(--gray-400)' }}>
        Normal hours = 40hrs/week (Mon–Fri). Weekend shifts auto-classify as OT@1.5. SA public holidays auto-classify as OT@2. Half-day leave = 4hrs.
      </div>
    </div>
  );
}

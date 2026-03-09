import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, eachDayOfInterval, getWeek, isSameMonth } from 'date-fns';
import { useAuth } from '../context/AuthContext';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function HoursTracker() {
  const { user, isAdmin, isManager, isLeader, isPH, theme } = useAuth();
  const primary = theme?.primary_color || '#C0392B';

  // Pay cycle: anchor date per dept navigation; cycle day per dept
  const [cycleAnchor, setCycleAnchor] = useState(new Date());
  const [payCycleDays, setPayCycleDays] = useState({}); // { deptName: dayNum }
  const [users, setUsers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [publicHolidays, setPublicHolidays] = useState([]);
  const [depts, setDepts] = useState([]);
  const [filterDept, setFilterDept] = useState('all');
  const [filterAgent, setFilterAgent] = useState('all');
  const [filterLocation, setFilterLocation] = useState('all'); // 'all' | 'SA' | 'PH' | etc
  const [hoursTargets, setHoursTargets] = useState({});
  const [leaveTypes, setLeaveTypes] = useState([]); // { id, name, paid_hours }
  const [loading, setLoading] = useState(true);
  const [viewMonth, setViewMonth] = useState(new Date());
  const [locations, setLocations] = useState([]);
  const payCycleDaysRef = useRef({});
  const [hoursColors, setHoursColors] = useState({
    normal: { bg: '#f0fdf4', text: '#16a34a' },
    ot15:   { bg: '#fffbeb', text: '#d97706' },
    ot2:    { bg: '#fef2f2', text: '#dc2626' },
    leave:  { bg: '#ede9fe', text: '#7c3aed' },
  });
  const [showColorEditor, setShowColorEditor] = useState(false);
  const [headingColors, setHeadingColors] = useState({
    headerBg:    '#1a1a2e',
    headerText:  '#ffffff',
    subHeaderBg: '#2d3748',
    norm:        '#86efac',
    ot15:        '#fcd34d',
    ot2:         '#fca5a5',
    leave:       '#c4b5fd',
    total:       '#e2e8f0',
    periodBg:    primary,
    periodText:  '#ffffff',
  });

  // Dept restriction: TL/Manager sees only their dept
  const restrictedToDept = (!isAdmin) ? user?.department : null;

  useEffect(() => {
    if (restrictedToDept) setFilterDept(restrictedToDept);
  }, [restrictedToDept]);

  // Compute pay period start/end from anchor date + cycleDay
  const getPeriod = (anchor, cycleDay) => {
    const d = anchor instanceof Date ? anchor : new Date(anchor);
    const day = d.getDate();
    let pStart, pEnd;
    if (day >= cycleDay) {
      pStart = new Date(d.getFullYear(), d.getMonth(), cycleDay);
      pEnd = new Date(d.getFullYear(), d.getMonth()+1, cycleDay-1);
    } else {
      pStart = new Date(d.getFullYear(), d.getMonth()-1, cycleDay);
      pEnd = new Date(d.getFullYear(), d.getMonth(), cycleDay-1);
    }
    return { pStart, pEnd };
  };

  // Use the first dept's cycle day for navigation display (or default 1)
  const defaultCycleDay = Object.values(payCycleDays)[0] || 1;
  const saResult = getPeriod(cycleAnchor, defaultCycleDay);
  // PH users always see 1st–last of month. Admin filtering by PH also sees PH cycle. Others see SA.
  const viewingAsNonSA = isPH || (filterLocation !== 'all' && filterLocation !== 'SA');
  const { pStart, pEnd } = viewingAsNonSA ? getMonthPeriod(cycleAnchor) : saResult;

  const navigatePeriod = (dir) => {
    setCycleAnchor(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + dir);
      return d;
    });
  };

  useEffect(() => { fetchData(); }, [cycleAnchor]);

  const fetchData = async () => {
    setLoading(true);
    const cd = Object.values(payCycleDaysRef.current)[0] || 1;
    const { pStart: saSt, pEnd: saEn } = getPeriod(cycleAnchor, cd);
    // Always fetch a window covering both SA cycle and any non-SA 1st-last-of-month
    // so mixed-location teams load correctly
    const d = cycleAnchor instanceof Date ? cycleAnchor : new Date(cycleAnchor);
    const phSt = new Date(d.getFullYear(), d.getMonth(), 1);
    const phEn = new Date(d.getFullYear(), d.getMonth()+1, 0);
    const s = saSt < phSt ? saSt : phSt;
    const e = saEn > phEn ? saEn : phEn;
    const start = format(s, 'yyyy-MM-dd');
    const end = format(e, 'yyyy-MM-dd');
    const year = format(s, 'yyyy');
    const year2 = format(e, 'yyyy');
    try {
      const [sr, ur, dr, lr, phr, phr2, tr, ltr, locr] = await Promise.all([
        axios.get(`/api/shifts?start=${start}&end=${end}`),
        axios.get('/api/users'),
        axios.get('/api/departments'),
        axios.get(`/api/leave?start=${start}&end=${end}`).catch(()=>({data:[]})),
        axios.get(`/api/public-holidays?year=${year}`).catch(()=>({data:[]})),
        year2!==year ? axios.get(`/api/public-holidays?year=${year2}`).catch(()=>({data:[]})) : Promise.resolve({data:[]}),
        axios.get('/api/theme').catch(()=>({data:{}})),
        axios.get('/api/leave-types').catch(()=>({data:[]})),
        axios.get('/api/locations').catch(()=>({data:[]})),
      ]);
      setShifts(sr.data);
      setUsers(ur.data.filter(u=>u.active!==0));
      setDepts(dr.data.filter(d=>d.name!=='Trainees'));
      setLeaves(lr.data||[]);
      setPublicHolidays([...(phr.data||[]), ...(phr2.data||[])]);
      setLeaveTypes(ltr.data||[]);
      setLocations(Array.isArray(locr.data) ? locr.data : []);
      try {
        const newTargets = JSON.parse(tr.data.hours_targets||'{}');
        const newCycleDays = JSON.parse(tr.data.pay_cycle_days||'{}');
        setHoursTargets(newTargets);
        // Store in ref (no re-render) AND state for display
        payCycleDaysRef.current = newCycleDays;
        setPayCycleDays(newCycleDays);
      } catch { setHoursTargets({}); payCycleDaysRef.current = {}; setPayCycleDays({}); }
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  // Per-location holiday sets — SA agents use SA holidays, PH agents use PH holidays, etc.
  const holidayDatesByLocation = {};
  for (const h of publicHolidays) {
    const loc = h.location || 'SA';
    if (!holidayDatesByLocation[loc]) holidayDatesByLocation[loc] = new Set();
    holidayDatesByLocation[loc].add(h.date);
  }
  const getHolidayDates = (agentLocation) => holidayDatesByLocation[agentLocation || 'SA'] || holidayDatesByLocation['SA'] || new Set();

  // PH agents always use 1st–last of month pay cycle regardless of dept setting
  const getMonthPeriod = (anchor) => {
    const d = anchor instanceof Date ? anchor : new Date(anchor);
    const pStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const pEnd = new Date(d.getFullYear(), d.getMonth()+1, 0);
    return { pStart, pEnd };
  };

  // Helper: is a given agent on PH location?
  const isAgentPH = (agentId) => {
    const agent = users.find(u => u.id === agentId);
    return (agent?.location || 'SA') !== 'SA';
  };

  // Get PH-specific period weeks
  const { pStart: monthPStart, pEnd: monthPEnd } = getMonthPeriod(cycleAnchor);
  const monthWeeks = [];
  let monthWStart = startOfWeek(monthPStart, { weekStartsOn:1 });
  while (monthWStart <= monthPEnd) {
    const monthWEnd = endOfWeek(monthWStart, { weekStartsOn:1 });
    const clippedStart = monthWStart < monthPStart ? monthPStart : monthWStart;
    const clippedEnd = monthWEnd > monthPEnd ? monthPEnd : monthWEnd;
    monthWeeks.push({ start:monthWStart, end:monthWEnd, clippedStart, clippedEnd, days:eachDayOfInterval({start:clippedStart,end:clippedEnd}) });
    monthWStart = addDays(monthWStart,7);
  }

  // All weeks overlapping this pay period
  const weeks = [];
  let wStart = startOfWeek(pStart, { weekStartsOn:1 });
  while (wStart <= pEnd) {
    const wEnd = endOfWeek(wStart, { weekStartsOn:1 });
    // Clip days to pay period boundaries
    const clippedStart = wStart < pStart ? pStart : wStart;
    const clippedEnd = wEnd > pEnd ? pEnd : wEnd;
    weeks.push({ start:wStart, end:wEnd, clippedStart, clippedEnd, days:eachDayOfInterval({start:clippedStart,end:clippedEnd}) });
    wStart = addDays(wStart,7);
  }

  const calcHours = (start, end) => {
    const [sh,sm] = start.split(':').map(Number);
    const [eh,em] = end.split(':').map(Number);
    let mins = (eh*60+em)-(sh*60+sm);
    if (mins<0) mins+=24*60;
    return Math.round((mins/60)*10)/10;
  };

  const getAgentWeekData = (agentId, week, agentLocation) => {
    let normal=0, ot1=0, ot15=0, ot2=0, leaveHrs=0;
    const agentHolidayDates = getHolidayDates(agentLocation || 'SA');

    for (const day of week.days) {
      const ds = format(day,'yyyy-MM-dd');
      const isWeekendDay = [0,6].includes(day.getDay());
      const isHoliday = agentHolidayDates.has(ds);

      // Leave for this day (weekdays only)
      const leave = !isWeekendDay ? leaves.find(l=>l.user_id===agentId&&l.date_from<=ds&&l.date_to>=ds) : null;
      const lt = leave ? leaveTypes.find(t=>t.id===leave.leave_type_id) : null;
      const dayLeaveHrs = leave ? (leave.half_day ? (lt?.paid_hours??8)/2 : (lt?.paid_hours??8)) : 0;

      // Shifts for this day
      let dayNormal = 0;
      for (const s of shifts.filter(s=>s.user_id===agentId&&s.date===ds)) {
        const hrs = calcHours(s.start_time, s.end_time);
        const type = s.shift_type||'normal';
        if (type==='ot_2'||isHoliday) ot2+=hrs;
        else if (type==='ot_1_5'||type==='ot_auth'||isWeekendDay) ot15+=hrs;
        else dayNormal+=hrs;
      }

      if (leave && !isWeekendDay) {
        // Leave hours are deducted from the day's shift hours.
        // e.g. 8hr shift + 8hr sick leave = 8 total (0 normal + 8 leave), not 16.
        // For half-day: 8hr shift + 4hr leave = 4 normal + 4 leave = 8 total.
        const normalAfterLeave = Math.max(0, dayNormal - dayLeaveHrs);
        normal += normalAfterLeave;
        leaveHrs += dayLeaveHrs;
      } else {
        normal += dayNormal;
      }
    }

    // OT@1: normal hours in the 41-45hr band
    const excess = Math.max(0, normal - 40);
    const ot1Final = Math.round(Math.min(excess, 5)*10)/10;
    const normalCapped = Math.round(Math.min(normal, 40)*10)/10;

    const total = Math.round((normalCapped + ot1Final + ot15 + ot2 + leaveHrs)*10)/10;

    return {
      normal: normalCapped,
      ot1:    ot1Final,
      ot15:   Math.round(ot15*10)/10,
      ot2:    Math.round(ot2*10)/10,
      leave:  Math.round(leaveHrs*10)/10,
      total,
      worked: Math.round((normalCapped+ot1Final+ot15+ot2)*10)/10,
    };
  };

  const getAgentMonthTotals = (agentId) => {
    const agent = users.find(u => u.id === agentId);
    const agentLoc = agent?.location || 'SA';
    const agentWeeks = agentLoc !== 'SA' ? monthWeeks : weeks;
    let normal=0, ot1=0, ot15=0, ot2=0, leave=0;
    for (const week of agentWeeks) {
      const d = getAgentWeekData(agentId, week, agentLoc);
      normal+=d.normal; ot1+=d.ot1; ot15+=d.ot15; ot2+=d.ot2; leave+=d.leave;
    }
    const worked = Math.round((normal+ot1+ot15+ot2)*10)/10;
    const total  = Math.round((worked+leave)*10)/10;
    return {
      normal: Math.round(normal*10)/10,
      ot1:    Math.round(ot1*10)/10,
      ot15:   Math.round(ot15*10)/10,
      ot2:    Math.round(ot2*10)/10,
      leave:  Math.round(leave*10)/10,
      worked,
      total,
      // Balance check: total - normal - ot1 - ot15 - ot2 - leave = should be 0
      balance: Math.round((total - normal - ot1 - ot15 - ot2 - leave)*10)/10,
    };
  };

  // Per-dept periods
  const getDeptPeriod = (deptName) => {
    // PH-located users (or admin filtering by PH) always see 1st–last of month
    if (isPH || (filterLocation !== 'all' && filterLocation !== 'SA')) return getMonthPeriod(cycleAnchor);
    const cd = payCycleDays[deptName] || defaultCycleDay;
    return getPeriod(cycleAnchor, cd);
  };

  const getDeptWeeks = (deptName) => {
    // PH user or admin filtered to PH — return PH weeks
    if (isPH || (filterLocation !== 'all' && filterLocation !== 'SA')) return monthWeeks;
    const { pStart: ds, pEnd: de } = getDeptPeriod(deptName);
    const wks = [];
    let wStart = startOfWeek(ds, { weekStartsOn:1 });
    while (wStart <= de) {
      const wEnd = endOfWeek(wStart, { weekStartsOn:1 });
      const clippedStart = wStart < ds ? ds : wStart;
      const clippedEnd = wEnd > de ? de : wEnd;
      wks.push({ start:wStart, end:wEnd, clippedStart, clippedEnd, days:eachDayOfInterval({start:clippedStart,end:clippedEnd}) });
      wStart = addDays(wStart,7);
    }
    return wks;
  };

  // Filter agents
  const visibleDepts = restrictedToDept
    ? depts.filter(d=>d.name===restrictedToDept)
    : filterDept==='all' ? depts : depts.filter(d=>d.name===filterDept);

  const getAgentsForDept = (deptName) => users.filter(u=>
    u.user_type==='agent' && u.department===deptName &&
    (filterAgent==='all'||u.id===filterAgent) &&
    (filterLocation==='all'||(u.location||'SA')===filterLocation)
  );

  const downloadPDF = () => {
    const el = document.getElementById('hours-summary-print');
    if (!el) return;
    const style = document.createElement('style');
    style.textContent = `
      @media print {
        body > *:not(#pdf-print-root) { display: none !important; }
        #pdf-print-root { display: block !important; }
        @page { margin: 15mm; size: A4 landscape; }
        table { border-collapse: collapse; width: 100%; font-size: 11px; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; }
        thead tr { background: #1a1a2e !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `;
    const printRoot = document.createElement('div');
    printRoot.id = 'pdf-print-root';
    const header = document.createElement('div');
    header.innerHTML = `<h2 style="font-family:sans-serif;margin-bottom:4px">Hours Summary — ${format(pStart,'MMMM yyyy')}</h2><p style="font-family:sans-serif;color:#666;margin-top:0">Pay period: ${format(pStart,'d MMMM')} – ${format(pEnd,'d MMMM yyyy')}</p>`;
    printRoot.appendChild(header);
    printRoot.appendChild(el.cloneNode(true));
    document.body.appendChild(style);
    document.body.appendChild(printRoot);
    window.print();
    document.body.removeChild(style);
    document.body.removeChild(printRoot);
  };

  // includePH=false = SA payroll export (no PH staff). includePH=true = full record export
  const downloadCSV = (includePH = false) => {
    const wkLabels = weeks.map(w=>`Wk${getWeek(w.start)} ${format(w.start,'d/M')}-${format(w.end,'d/M')}`);
    const headers = ['Agent','Department','Location',
      ...wkLabels.flatMap(w=>[`${w} Norm`,`${w} OT1.5`,`${w} OT2`,`${w} Leave`,`${w} Total`]),
      'Mth Norm','Mth OT1.5','Mth OT2','Mth Leave','Mth Total','Target','vs Target'
    ];
    const rows = [];
    for (const dept of visibleDepts) {
      for (const agent of getAgentsForDept(dept.name)) {
        const agentLoc = agent.location || 'SA';
        if (!includePH && agentLoc !== 'SA') continue; // exclude non-SA agents from SA payroll export
        const agentWeeks = agentLoc !== 'SA' ? monthWeeks : weeks;
        const wData = agentWeeks.map(w=>getAgentWeekData(agent.id, w, agentLoc));
        const m = getAgentMonthTotals(agent.id);
        const target = hoursTargets[dept.name]||160;
        const vs = m.total - target;
        rows.push([
          agent.name, dept.name, agentLoc,
          ...wData.flatMap(d=>[d.normal,d.ot15,d.ot2,d.leave,d.total]),
          m.normal,m.ot15,m.ot2,m.leave,m.total, target, vs>=0?`+${vs}`:vs
        ]);
      }
    }
    const csv = [headers,...rows].map(r=>r.map(v=>`"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv],{type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url;
    a.download = includePH
      ? `hours-full-record-${format(pStart,'yyyy-MM-dd')}.csv`
      : `hours-payroll-SA-${format(pStart,'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const Cell = ({val, bg, color, bold, right}) => (
    <td style={{ padding:'6px 8px', textAlign:'center', background:val&&val!=='—'?bg:undefined,
      color:val&&val!=='—'?color:'var(--gray-300)', fontWeight:bold?700:400,
      borderRight:right?'2px solid #e2e8f0':'1px solid #f1f5f9', fontSize:12 }}>
      {val||'—'}
    </td>
  );

  const hc = hoursColors; // shorthand

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ margin:0 }}>Hours Tracker</h1>
          <p style={{ margin:'4px 0 0', color:'var(--gray-500)', fontSize:14 }}>
            {restrictedToDept ? `${restrictedToDept} department` : 'All departments'}{filterLocation !== 'all' ? ` · ${locations.find(l=>l.code===filterLocation)?.name || filterLocation}` : ''} — monthly hours breakdown
          </p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {isAdmin && (
            <button onClick={()=>setShowColorEditor(p=>!p)} className="btn btn-secondary" style={{ fontSize:13 }}>
              🎨 {showColorEditor ? 'Hide' : 'Edit'} Colours
            </button>
          )}
          {(isAdmin || isManager) && (
            <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end' }}>
              <button onClick={()=>downloadCSV(false)} className="btn btn-primary" style={{ fontSize:13 }}>
                ⬇ Payroll CSV <span style={{ fontSize:11, opacity:0.8, marginLeft:4 }}>(SA only)</span>
              </button>
              <button onClick={()=>downloadCSV(true)} className="btn btn-secondary" style={{ fontSize:12, padding:'4px 10px' }}>
                📋 Full Record CSV <span style={{ fontSize:11, opacity:0.7, marginLeft:2 }}>(all locations)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Admin Colour Editor */}
      {isAdmin && showColorEditor && (
        <div className="card" style={{ marginBottom:20, padding:18 }}>
          <h3 style={{ margin:'0 0 4px', fontWeight:700, fontSize:15 }}>🎨 Hours Tab Colour Settings</h3>
          <p style={{ margin:'0 0 16px', fontSize:12, color:'var(--gray-400)' }}>Changes apply instantly — refresh to reset to defaults.</p>

          {/* Section 1: Cell colours */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontWeight:700, fontSize:13, marginBottom:10, color:'var(--gray-600)', textTransform:'uppercase', letterSpacing:0.5 }}>Cell Colours</div>
            <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
              {[
                { key:'normal', label:'Normal Hours' },
                { key:'ot15',   label:'OT @ 1.5' },
                { key:'ot2',    label:'OT @ 2' },
                { key:'leave',  label:'Leave Hours' },
              ].map(({ key, label }) => (
                <div key={key} style={{ display:'flex', flexDirection:'column', gap:6, minWidth:140 }}>
                  <span style={{ fontWeight:600, fontSize:13 }}>{label}</span>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div>
                      <div style={{ fontSize:11, color:'var(--gray-500)', marginBottom:2 }}>Background</div>
                      <input type="color" value={hoursColors[key].bg}
                        onChange={e => setHoursColors(p => ({ ...p, [key]: { ...p[key], bg: e.target.value } }))}
                        style={{ width:40, height:30, border:'none', cursor:'pointer', borderRadius:4 }}/>
                    </div>
                    <div>
                      <div style={{ fontSize:11, color:'var(--gray-500)', marginBottom:2 }}>Text</div>
                      <input type="color" value={hoursColors[key].text}
                        onChange={e => setHoursColors(p => ({ ...p, [key]: { ...p[key], text: e.target.value } }))}
                        style={{ width:40, height:30, border:'none', cursor:'pointer', borderRadius:4 }}/>
                    </div>
                    <div style={{ padding:'4px 10px', borderRadius:6, background:hoursColors[key].bg, color:hoursColors[key].text, fontWeight:700, fontSize:13, marginTop:14 }}>
                      Preview
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop:'1px solid var(--gray-200)', marginBottom:16 }}/>

          {/* Section 2: Heading colours */}
          <div>
            <div style={{ fontWeight:700, fontSize:13, marginBottom:10, color:'var(--gray-600)', textTransform:'uppercase', letterSpacing:0.5 }}>Heading Colours</div>
            <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>

              {/* Main header row */}
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <span style={{ fontWeight:600, fontSize:13 }}>Main Header Row</span>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div>
                    <div style={{ fontSize:11, color:'var(--gray-500)', marginBottom:2 }}>Background</div>
                    <input type="color" value={headingColors.headerBg}
                      onChange={e => setHeadingColors(p=>({...p, headerBg:e.target.value}))}
                      style={{ width:40, height:30, border:'none', cursor:'pointer', borderRadius:4 }}/>
                  </div>
                  <div>
                    <div style={{ fontSize:11, color:'var(--gray-500)', marginBottom:2 }}>Text</div>
                    <input type="color" value={headingColors.headerText}
                      onChange={e => setHeadingColors(p=>({...p, headerText:e.target.value}))}
                      style={{ width:40, height:30, border:'none', cursor:'pointer', borderRadius:4 }}/>
                  </div>
                  <div style={{ padding:'4px 10px', borderRadius:6, background:headingColors.headerBg, color:headingColors.headerText, fontWeight:700, fontSize:13, marginTop:14 }}>
                    Wk 8
                  </div>
                </div>
              </div>

              {/* Sub-header row */}
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <span style={{ fontWeight:600, fontSize:13 }}>Sub-Header Row</span>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div>
                    <div style={{ fontSize:11, color:'var(--gray-500)', marginBottom:2 }}>Background</div>
                    <input type="color" value={headingColors.subHeaderBg}
                      onChange={e => setHeadingColors(p=>({...p, subHeaderBg:e.target.value}))}
                      style={{ width:40, height:30, border:'none', cursor:'pointer', borderRadius:4 }}/>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4, marginTop:2 }}>
                    <div style={{ fontSize:11, color:'var(--gray-500)' }}>Label colours</div>
                    <div style={{ display:'flex', gap:4 }}>
                      {[['norm','Norm'],['ot15','OT1.5'],['ot2','OT2'],['leave','Leave'],['total','Total']].map(([k,l])=>(
                        <div key={k} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                          <input type="color" value={headingColors[k]}
                            onChange={e => setHeadingColors(p=>({...p, [k]:e.target.value}))}
                            style={{ width:28, height:24, border:'none', cursor:'pointer', borderRadius:3 }}/>
                          <span style={{ fontSize:9, color:'var(--gray-400)' }}>{l}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ padding:'4px 8px', borderRadius:6, background:headingColors.subHeaderBg, marginTop:14, display:'flex', gap:4 }}>
                    {[['norm','Norm'],['ot15','OT1.5'],['ot2','OT2'],['leave','Leave'],['total','Total']].map(([k,l])=>(
                      <span key={k} style={{ color:headingColors[k], fontSize:10, fontWeight:700 }}>{l}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Period / month total header */}
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <span style={{ fontWeight:600, fontSize:13 }}>Period Total Header</span>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div>
                    <div style={{ fontSize:11, color:'var(--gray-500)', marginBottom:2 }}>Background</div>
                    <input type="color" value={headingColors.periodBg}
                      onChange={e => setHeadingColors(p=>({...p, periodBg:e.target.value}))}
                      style={{ width:40, height:30, border:'none', cursor:'pointer', borderRadius:4 }}/>
                  </div>
                  <div>
                    <div style={{ fontSize:11, color:'var(--gray-500)', marginBottom:2 }}>Text</div>
                    <input type="color" value={headingColors.periodText}
                      onChange={e => setHeadingColors(p=>({...p, periodText:e.target.value}))}
                      style={{ width:40, height:30, border:'none', cursor:'pointer', borderRadius:4 }}/>
                  </div>
                  <div style={{ padding:'4px 10px', borderRadius:6, background:headingColors.periodBg, color:headingColors.periodText, fontWeight:700, fontSize:13, marginTop:14 }}>
                    Feb Total
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:8, flexWrap:'wrap' }}>
        <button onClick={()=>navigatePeriod(-1)} className="btn btn-secondary" style={{ fontSize:13, padding:'6px 12px' }}>← Prev</button>
        <div style={{ textAlign:'center', minWidth:220 }}>
          <div style={{ fontWeight:800, fontSize:15 }}>
            {format(pStart,'d MMM')} – {format(pEnd,'d MMM yyyy')}
          </div>
          <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:1 }}>Pay period</div>
        </div>
        <button onClick={()=>navigatePeriod(1)} className="btn btn-secondary" style={{ fontSize:13, padding:'6px 12px' }}>Next →</button>
        <button onClick={()=>setCycleAnchor(new Date())} className="btn btn-secondary" style={{ fontSize:13, padding:'6px 12px' }}>Current</button>

        {/* Location filter — admin and manager */}
        {(isAdmin || isManager) && locations.length > 1 && (
          <select value={filterLocation} onChange={e=>{setFilterLocation(e.target.value);setFilterAgent('all');}}
            style={{ padding:'7px 12px', borderRadius:8, border:'1.5px solid var(--gray-200)', fontSize:13, fontFamily:'inherit', background: filterLocation==='SA'?'#f0fdf4': filterLocation!=='all'?'#eff6ff':'white' }}>
            <option value="all">🌍 All Locations</option>
            {locations.map(l=><option key={l.code} value={l.code}>{l.code === 'SA' ? '🇿🇦' : l.code === 'PH' ? '🇵🇭' : '📍'} {l.name}</option>)}
          </select>
        )}
        {/* Dept filter — admin only (managers locked to their dept) */}
        {isAdmin && (
          <select value={filterDept} onChange={e=>{setFilterDept(e.target.value);setFilterAgent('all');}}
            style={{ padding:'7px 12px', borderRadius:8, border:'1.5px solid var(--gray-200)', fontSize:13, fontFamily:'inherit' }}>
            <option value="all">All Departments</option>
            {depts.map(d=><option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
        )}
        {/* Agent filter — admin and manager */}
        {(isAdmin || isManager) && (
          <select value={filterAgent} onChange={e=>setFilterAgent(e.target.value)}
            style={{ padding:'7px 12px', borderRadius:8, border:'1.5px solid var(--gray-200)', fontSize:13, fontFamily:'inherit' }}>
            <option value="all">All Agents</option>
            {users.filter(u=>u.user_type==='agent'
              && (filterDept==='all'||u.department===filterDept)
              && (filterLocation==='all'||(u.location||'SA')===filterLocation)
            ).map(u=>(
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        )}
        {/* Non-admin non-manager: read-only dept label */}
        {!isAdmin && !isManager && (
          <span style={{ padding:'7px 14px', borderRadius:8, background:'var(--gray-100)', fontSize:13, fontWeight:600, color:'var(--gray-600)' }}>
            🏢 {restrictedToDept}
          </span>
        )}
      </div>

      {/* === MONTHLY SUMMARY ON TOP === */}
      {!loading && (
        <div style={{ marginBottom:28 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, flexWrap:'wrap', gap:10 }}>
            <div>
              <h2 style={{ margin:0, fontSize:18, fontWeight:800 }}>Monthly Summary</h2>
              <p style={{ margin:'2px 0 0', color:'var(--gray-500)', fontSize:13 }}>
                Pay period: {format(pStart,'d MMMM')} – {format(pEnd,'d MMMM yyyy')}
              </p>
            </div>
            <button onClick={downloadPDF} className="btn btn-secondary" style={{ fontSize:13 }}>🖨 Print / Save PDF</button>
          </div>
          <div id="hours-summary-print" className="card" style={{ overflow:'auto', padding:0 }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#1a1a2e' }}>
                  <th style={{ padding:'12px 16px', textAlign:'left', color:'rgba(255,255,255,0.7)', fontSize:12, width:180 }}>Employee Name</th>
                  <th style={{ padding:'12px 10px', textAlign:'right', color:'rgba(255,255,255,0.95)', fontSize:12 }}>Total Hours<br/><span style={{fontSize:10,opacity:0.6}}>(incl. OT + Leave)</span></th>
                  <th style={{ padding:'12px 10px', textAlign:'right', color:'#bbf7d0', fontSize:12 }}>Normal Hours<br/><span style={{fontSize:10,opacity:0.7}}>(40hrs/week)</span></th>
                  <th style={{ padding:'12px 10px', textAlign:'right', color:'#fed7aa', fontSize:12 }}>OT @ 1<br/><span style={{fontSize:10,opacity:0.7}}>(41–45hrs)</span></th>
                  <th style={{ padding:'12px 10px', textAlign:'right', color:'#fde68a', fontSize:12 }}>OT @ 1.5<br/><span style={{fontSize:10,opacity:0.7}}>(Weekend/Auth)</span></th>
                  <th style={{ padding:'12px 10px', textAlign:'right', color:'#fecaca', fontSize:12 }}>OT @ 2<br/><span style={{fontSize:10,opacity:0.7}}>(Public Holiday)</span></th>
                  <th style={{ padding:'12px 10px', textAlign:'right', color:'#ddd6fe', fontSize:12 }}>Annual/Sick Leave<br/><span style={{fontSize:10,opacity:0.7}}>(deduction)</span></th>
                </tr>
              </thead>
              <tbody>
                {visibleDepts.map(dept => {
                  const dagents = getAgentsForDept(dept.name);
                  if (!dagents.length) return null;
                  return (
                    <React.Fragment key={dept.id}>
                      <tr>
                        {(() => {
                          const { pStart:ds, pEnd:de } = getDeptPeriod(dept.name);
                          return <td colSpan={7} style={{ padding:'6px 16px', background:dept.bg_color||'#f1f5f9', fontWeight:700, fontSize:11, color:dept.color||'#334155', letterSpacing:0.5 }}>
                            {dept.name} <span style={{ fontWeight:400, opacity:0.7, marginLeft:8 }}>📅 {format(ds,'d MMM')} – {format(de,'d MMM yyyy')}</span>
                          </td>;
                        })()}
                      </tr>
                      {(() => {
                        // Sort SA agents first, PH agents after, with a separator row between them
                        // Sort SA first, then group non-SA by location code
                        const saAgents = dagents.filter(a => (a.location||'SA') === 'SA');
                        const nonSAGroups = {};
                        dagents.filter(a => (a.location||'SA') !== 'SA').forEach(a => {
                          const loc = a.location || '??';
                          if (!nonSAGroups[loc]) nonSAGroups[loc] = [];
                          nonSAGroups[loc].push(a);
                        });
                        const nonSAAgents = Object.values(nonSAGroups).flat();
                        const hasMixed = saAgents.length > 0 && nonSAAgents.length > 0;
                        const ordered = [...saAgents, ...nonSAAgents];
                        // Track which agent is the first in each non-SA location group
                        const firstOfLoc = {};
                        Object.entries(nonSAGroups).forEach(([loc, agents]) => { firstOfLoc[agents[0].id] = loc; });
                        return ordered.map((agent, i) => {
                          const agentLoc = agent.location || 'SA';
                          const isPHAgent = agentLoc !== 'SA';
                          const isLocHeader = firstOfLoc[agent.id];
                          const locName = locations.find(l => l.code === agentLoc)?.name || agentLoc;
                          const m = getAgentMonthTotals(agent.id);
                          const hasData = m.total > 0;
                          return (
                            <React.Fragment key={agent.id}>
                              {isLocHeader && (
                                <tr>
                                  <td colSpan={7} style={{ padding:'5px 16px 5px 24px', background:'#dbeafe', fontSize:11, fontWeight:700, color:'#1d4ed8', letterSpacing:0.3 }}>
                                    📍 {locName} — Record Only · excluded from SA Payroll CSV · pay cycle: 1st – last of month
                                  </td>
                                </tr>
                              )}
                              <tr style={{ background: isPHAgent ? '#f0f4ff' : i%2===0?'white':'#f8fafc', borderBottom:'1px solid #f1f5f9', opacity: isPHAgent ? 0.85 : 1 }}>
                                <td style={{ padding:'10px 16px', fontWeight:600 }}>
                                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                    <div style={{ width:26,height:26,borderRadius:'50%',background: isPHAgent?'#3B82F6':primary,color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,flexShrink:0 }}>
                                      {agent.name?.trim()?.[0]?.toUpperCase()}
                                    </div>
                                    <span>{agent.name}</span>
                                    {isPHAgent && <span title={`${agentLoc} — record only, excluded from SA payroll export`} style={{ fontSize:10, fontWeight:700, background:'#dbeafe', color:'#1d4ed8', padding:'1px 6px', borderRadius:4, letterSpacing:0.3 }}>{agentLoc}</span>}
                                  </div>
                                </td>
                                <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:800, fontSize:14, color:'#1a1a2e', background:'#f8fafc' }}>{hasData?m.total:'—'}</td>
                                <td style={{ padding:'10px 12px', textAlign:'right', color:hc.normal.text, fontWeight:600, background:m.normal>0?hc.normal.bg:undefined }}>{m.normal||'—'}</td>
                                <td style={{ padding:'10px 12px', textAlign:'right', color:'#c2410c', fontWeight:600, background:m.ot1>0?'#fff7ed':undefined }}>{m.ot1||'—'}</td>
                                <td style={{ padding:'10px 12px', textAlign:'right', color:hc.ot15.text, fontWeight:600, background:m.ot15>0?hc.ot15.bg:undefined }}>{m.ot15||'—'}</td>
                                <td style={{ padding:'10px 12px', textAlign:'right', color:hc.ot2.text, fontWeight:600, background:m.ot2>0?hc.ot2.bg:undefined }}>{m.ot2||'—'}</td>
                                <td style={{ padding:'10px 12px', textAlign:'right', color:hc.leave.text, fontWeight:600, background:m.leave>0?hc.leave.bg:undefined }}>
                                  {m.leave?`(${m.leave})`:'—'}
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        });
                      })()}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* === LEGEND === */}
      <div style={{ display:'flex', gap:16, marginBottom:12, flexWrap:'wrap', fontSize:12 }}>
        {[
          ['Normal', hc.normal.bg, hc.normal.text],
          ['OT @ 1.5', hc.ot15.bg, hc.ot15.text],
          ['OT @ 2 (Holiday)', hc.ot2.bg, hc.ot2.text],
          ['Leave Hours', hc.leave.bg, hc.leave.text],
          ['vs Target','#f0f9ff','#0369a1']
        ].map(([l,bg,c])=>(
          <div key={l} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ width:12, height:12, borderRadius:3, background:bg, border:`1.5px solid ${c}` }}/>
            <span style={{ color:'var(--gray-600)' }}>{l}</span>
          </div>
        ))}
        <span style={{ color:'var(--gray-400)', fontStyle:'italic' }}>· Weekend = OT@1.5 · Public holidays = OT@2 auto · Half-day leave = 4hrs</span>
      </div>

      {/* === PER WEEK / DAY BREAKDOWN (below summary) === */}
      {loading ? (
        <div className="card" style={{ padding:60, textAlign:'center', color:'var(--gray-400)' }}>Loading hours data...</div>
      ) : (
        <div className="card" style={{ overflow:'auto', padding:0 }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:900 }}>
            <thead>
              <tr style={{ background: headingColors.headerBg }}>
                <th style={{ padding:'10px 14px', textAlign:'left', color: headingColors.headerText, fontSize:12, width:160, position:'sticky', left:0, background: headingColors.headerBg, zIndex:2, opacity:0.8 }}>Agent</th>
                {weeks.map(w=>(
                  <th key={w.start} colSpan={5} style={{ padding:'8px 6px', fontSize:11, fontWeight:700, color: headingColors.headerText, textAlign:'center',
                    borderRight:'2px solid rgba(255,255,255,0.15)',
                    background: headingColors.headerBg }}>
                    Wk {getWeek(w.start)}<br/>
                    <span style={{ fontSize:9, opacity:0.6 }}>{format(w.start,'d MMM')}–{format(w.end,'d MMM')}</span>
                  </th>
                ))}
                <th colSpan={5} style={{ padding:'8px 6px', fontSize:11, fontWeight:700, color: headingColors.periodText, textAlign:'center', background: headingColors.periodBg }}>
                  {format(pStart,'MMMM')} Total
                </th>
              </tr>
              <tr style={{ background: headingColors.subHeaderBg }}>
                <th style={{ padding:'5px 14px', textAlign:'left', color: headingColors.headerText, fontSize:10, position:'sticky', left:0, background: headingColors.subHeaderBg, zIndex:2, opacity:0.7 }}>Name</th>
                {weeks.map(w=>(
                  <React.Fragment key={w.start}>
                    {[
                      ['Norm',  'norm'],
                      ['OT1.5', 'ot15'],
                      ['OT2',   'ot2'],
                      ['Leave', 'leave'],
                      ['Total', 'total'],
                    ].map(([l,k])=>(
                      <th key={l} style={{ padding:'4px 4px', fontSize:9, fontWeight:700, color: headingColors[k], textAlign:'center', background:'rgba(255,255,255,0.05)', borderRight:'1px solid rgba(255,255,255,0.08)', minWidth:44 }}>{l}</th>
                    ))}
                  </React.Fragment>
                ))}
                {[
                  ['Norm',   'norm'],
                  ['OT1.5',  'ot15'],
                  ['OT2',    'ot2'],
                  ['Leave',  'leave'],
                  ['Worked', 'total'],
                ].map(([l,k])=>(
                  <th key={`m-${l}`} style={{ padding:'4px 4px', fontSize:9, fontWeight:700, color: headingColors[k], textAlign:'center', background:'rgba(192,57,43,0.25)', borderRight:'1px solid rgba(255,255,255,0.08)', minWidth:44 }}>{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleDepts.map(dept => {
                const dagents = getAgentsForDept(dept.name);
                if (dagents.length===0) return null;
                        return (
                  <React.Fragment key={dept.id}>
                    <tr>
                      {(() => {
                        const { pStart:ds, pEnd:de } = getDeptPeriod(dept.name);
                        const dWeeks = getDeptWeeks(dept.name);
                        return <td colSpan={5*dWeeks.length+6} style={{ padding:'6px 14px', background:dept.bg_color||'#f1f5f9', fontWeight:700, fontSize:11, color:dept.color||'#334155', letterSpacing:0.5 }}>
                          {dept.name}
                          <span style={{ marginLeft:10, fontWeight:400, fontSize:11, opacity:0.8 }}>
                            📅 {format(ds,'d MMM')} – {format(de,'d MMM yyyy')}
                          </span>
                        </td>;
                      })()}
                    </tr>
                    {dagents.map((agent,i) => {
                      const deptWks = getDeptWeeks(dept.name);
                    const month = (() => {
                      let normal=0,ot1=0,ot15=0,ot2=0,leave=0;
                      for (const week of deptWks) {
                        const d = getAgentWeekData(agent.id,week,agent.location||'SA');
                        normal+=d.normal; ot1+=d.ot1; ot15+=d.ot15; ot2+=d.ot2; leave+=d.leave;
                      }
                      const worked=Math.round((normal+ot1+ot15+ot2)*10)/10;
                      const total=Math.round((worked+leave)*10)/10;
                      return { normal:Math.round(normal*10)/10, ot1:Math.round(ot1*10)/10, ot15:Math.round(ot15*10)/10, ot2:Math.round(ot2*10)/10, leave:Math.round(leave*10)/10, worked, total, balance:Math.round((total-normal-ot1-ot15-ot2-leave)*10)/10 };
                    })();
                      const diff = Math.round((month.worked - (hoursTargets[dept.name]||160))*10)/10;
                      const diffColor = diff>=0?'#16a34a':'#dc2626';
                      const isPHAgentW = (agent.location || 'SA') !== 'SA';
                      const wRowBg = isPHAgentW ? '#f0f4ff' : i%2===0?'white':'#f8fafc';
                      return (
                        <tr key={agent.id} style={{ background:wRowBg, borderBottom:'1px solid #f1f5f9', opacity: isPHAgentW?0.85:1 }}>
                          <td style={{ padding:'8px 14px', fontWeight:600, whiteSpace:'nowrap', position:'sticky', left:0, background:wRowBg, zIndex:1 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                              <div style={{ width:24,height:24,borderRadius:'50%',background:isPHAgentW?'#3B82F6':primary,color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,flexShrink:0 }}>
                                {agent.name?.trim()?.[0]?.toUpperCase()}
                              </div>
                              <span>{agent.name}</span>
                              {isPHAgentW && <span title={`${agent.location} — record only`} style={{ fontSize:10, fontWeight:700, background:'#dbeafe', color:'#1d4ed8', padding:'1px 5px', borderRadius:4 }}>{agent.location}</span>}
                            </div>
                          </td>
                          {getDeptWeeks(dept.name).map(week=>{
                            const d = getAgentWeekData(agent.id, week, agent.location || 'SA');
                            return (
                              <React.Fragment key={week.start}>
                                <Cell val={d.normal||null} bg={hc.normal.bg} color={hc.normal.text}/>
                                <Cell val={d.ot15||null} bg={hc.ot15.bg} color={hc.ot15.text}/>
                                <Cell val={d.ot2||null} bg={hc.ot2.bg} color={hc.ot2.text}/>
                                <Cell val={d.leave?`(${d.leave})`:null} bg={hc.leave.bg} color={hc.leave.text}/>
                                <Cell val={d.total||null} bg='#f8fafc' color='#1a1a2e' bold right/>
                              </React.Fragment>
                            );
                          })}
                          <Cell val={month.normal||null} bg={hc.normal.bg} color={hc.normal.text} bold/>
                          <Cell val={month.ot15||null} bg={hc.ot15.bg} color={hc.ot15.text} bold/>
                          <Cell val={month.ot2||null} bg={hc.ot2.bg} color={hc.ot2.text} bold/>
                          <Cell val={month.leave||null} bg={hc.leave.bg} color={hc.leave.text} bold/>
                          <td style={{ padding:'6px 8px', textAlign:'center', fontWeight:800, fontSize:13, background:'#f1f5f9', color:'#1a1a2e' }}>{month.total||'—'}</td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
              {visibleDepts.every(d=>getAgentsForDept(d.name).length===0) && (
                <tr><td colSpan={5*weeks.length+8} style={{ padding:40, textAlign:'center', color:'var(--gray-400)' }}>No agents match the current filter</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ marginTop:10, fontSize:11, color:'var(--gray-400)' }}>
        Normal = scheduled weekday hours · Weekend = OT@1.5 · Public holidays = OT@2 (per agent's location) · Half-day leave = 4hrs · Full-day leave = 8hrs
        <br/><span style={{ color:'#1d4ed8' }}>Non-SA rows</span> are shown for record only — excluded from the Payroll CSV export. Use "Full Record CSV" to include all locations.
      </p>
    </div>
  );
}

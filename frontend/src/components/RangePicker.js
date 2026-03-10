import React, { useState, useRef, useEffect } from 'react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Mo','Tu','We','Th','Fr','Sa','Su'];

function pad(n) { return String(n).padStart(2,'0'); }
function toStr(y,m,d) { return `${y}-${pad(m+1)}-${pad(d)}`; }
function todayStr() {
  const n = new Date();
  return toStr(n.getFullYear(), n.getMonth(), n.getDate());
}

// Core calendar body — used by both inline and popup
export function CalendarBody({ dateFrom, dateTo, onChange }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(dateFrom ? parseInt(dateFrom.slice(0,4)) : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(dateFrom ? parseInt(dateFrom.slice(5,7))-1 : today.getMonth());
  const [hovered, setHovered] = useState(null);

  const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate();
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const offset = (firstDow + 6) % 7;
  const td = todayStr();

  const inRange = (str) => {
    const lo = dateFrom, hi = dateTo || hovered;
    if (!lo || !hi) return false;
    const [a,b] = lo<=hi ? [lo,hi] : [hi,lo];
    return str > a && str < b;
  };

  const handleDay = (str) => {
    if (!dateFrom || (dateFrom && dateTo)) {
      onChange(str, '');
    } else {
      if (str < dateFrom) onChange(str, dateFrom);
      else onChange(dateFrom, str);
    }
  };

  const prevMonth = () => { if(viewMonth===0){setViewMonth(11);setViewYear(y=>y-1);}else setViewMonth(m=>m-1); };
  const nextMonth = () => { if(viewMonth===11){setViewMonth(0);setViewYear(y=>y+1);}else setViewMonth(m=>m+1); };

  const cells = [];
  for(let i=0;i<offset;i++) cells.push(null);
  for(let d=1;d<=daysInMonth;d++) cells.push(d);

  return (
    <div style={{ background:'white', border:'1.5px solid var(--gray-200)', borderRadius:10, padding:12, userSelect:'none', width:'100%', boxSizing:'border-box' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <button onClick={prevMonth} style={{ border:'none', background:'none', cursor:'pointer', fontSize:18, color:'var(--gray-600)', padding:'2px 8px', borderRadius:6 }}>‹</button>
        <span style={{ fontWeight:700, fontSize:13, color:'var(--gray-900)' }}>{MONTHS[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} style={{ border:'none', background:'none', cursor:'pointer', fontSize:18, color:'var(--gray-600)', padding:'2px 8px', borderRadius:6 }}>›</button>
      </div>
      {/* Day labels */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:4 }}>
        {DAYS.map(d=><div key={d} style={{ textAlign:'center', fontSize:10, fontWeight:700, color:'var(--gray-400)', padding:'2px 0' }}>{d}</div>)}
      </div>
      {/* Cells */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
        {cells.map((d,i) => {
          if(!d) return <div key={'e'+i}/>;
          const str = toStr(viewYear, viewMonth, d);
          const isStart = str===dateFrom, isEnd = str===dateTo;
          const range = inRange(str);
          const isToday = str===td;
          return (
            <div key={str}
              onClick={()=>handleDay(str)}
              onMouseEnter={()=>{ if(dateFrom&&!dateTo) setHovered(str); }}
              onMouseLeave={()=>setHovered(null)}
              style={{
                textAlign:'center', padding:'6px 2px', borderRadius:6, fontSize:12,
                fontWeight: isStart||isEnd ? 700 : 400,
                cursor:'pointer',
                background: isStart||isEnd ? 'var(--red)' : range ? '#fef2f2' : 'transparent',
                color: isStart||isEnd ? 'white' : range ? 'var(--red)' : isToday ? 'var(--red)' : 'var(--gray-800)',
                border: isToday&&!isStart&&!isEnd ? '1px solid var(--red)' : '1px solid transparent',
                transition:'background 0.1s'
              }}>{d}</div>
          );
        })}
      </div>
      {/* Footer */}
      {(dateFrom||dateTo) && (
        <div style={{ marginTop:8, padding:'6px 10px', background:'var(--gray-50)', borderRadius:7, fontSize:11, color:'var(--gray-600)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontFamily:'DM Mono,monospace' }}>{dateFrom||'—'} → {dateTo||'...'}</span>
          <button onClick={()=>onChange('','')} style={{ border:'none', background:'none', cursor:'pointer', color:'var(--red)', fontSize:11, fontWeight:700, fontFamily:'inherit' }}>✕ Clear</button>
        </div>
      )}
    </div>
  );
}

// Inline — always visible (used in Schedule drawer)
export function RangePickerInline({ dateFrom, dateTo, onChange }) {
  return <CalendarBody dateFrom={dateFrom} dateTo={dateTo} onChange={onChange}/>;
}

// Popup — tile that opens a dropdown calendar (used everywhere else)
export function RangePickerPopup({ dateFrom, dateTo, onChange, placeholder='📅 Select dates' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isActive = !!(dateFrom || dateTo);

  useEffect(() => {
    const handler = (e) => { if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return ()=>document.removeEventListener('mousedown', handler);
  }, []);

  const label = dateFrom && dateTo
    ? `${dateFrom} → ${dateTo}`
    : dateFrom
    ? `From ${dateFrom}`
    : placeholder;

  return (
    <div ref={ref} style={{ position:'relative', display:'inline-block' }}>
      <button
        onClick={()=>setOpen(o=>!o)}
        style={{
          padding:'6px 11px', borderRadius:8, fontFamily:'inherit', fontSize:12, fontWeight: isActive?700:400,
          border:`1.5px solid ${isActive?'var(--red)':'var(--gray-200)'}`,
          background: isActive?'#fef2f2':'white',
          color: isActive?'var(--red)':'var(--gray-700)',
          cursor:'pointer', whiteSpace:'nowrap',
          display:'flex', alignItems:'center', gap:6
        }}
      >
        {label}
        <span style={{ fontSize:10, color: isActive?'var(--red)':'var(--gray-400)' }}>▼</span>
      </button>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, zIndex:9999, width:260, boxShadow:'0 8px 32px rgba(0,0,0,0.15)', borderRadius:10 }}>
          <CalendarBody
            dateFrom={dateFrom}
            dateTo={dateTo}
            onChange={(from,to)=>{ onChange(from,to); if(from&&to) setOpen(false); }}
          />
        </div>
      )}
    </div>
  );
}

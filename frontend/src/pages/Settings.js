import React, { useState, useEffect } from 'react';
import axios from 'axios';

const PRESET_COLORS = ['#C0392B','#2980B9','#27AE60','#8E44AD','#E67E22','#16A085','#2C3E50','#F39C12','#D35400','#E91E63'];

export default function Settings() {
  const [settings, setSettings] = useState({ company_name:'ShiftManager', location_label:'South Africa', primary_color:'#C0392B', week_start:'monday', time_format:'24h', default_shift_start:'07:00', default_shift_end:'15:00' });
  const [departments, setDepartments] = useState([]);
  const [saved, setSaved] = useState('');
  const [tab, setTab] = useState('branding');
  const [newDept, setNewDept] = useState({ name:'', color:'#333333', bg_color:'#F0F0F0' });
  const [editDept, setEditDept] = useState(null);

  useEffect(() => { fetchSettings(); fetchDepts(); }, []);

  const fetchSettings = async () => { const r = await axios.get('/api/settings'); setSettings(p => ({...p,...r.data})); };
  const fetchDepts = async () => { const r = await axios.get('/api/settings/departments'); setDepartments(r.data); };

  const save = async () => {
    await axios.put('/api/settings', settings);
    document.documentElement.style.setProperty('--red', settings.primary_color);
    document.documentElement.style.setProperty('--red-dark', settings.primary_color);
    setSaved('Settings saved!'); setTimeout(() => setSaved(''), 3000);
  };

  const addDept = async () => {
    if (!newDept.name.trim()) return;
    await axios.post('/api/settings/departments', newDept);
    setNewDept({ name:'', color:'#333333', bg_color:'#F0F0F0' });
    fetchDepts(); setSaved('Department added!'); setTimeout(() => setSaved(''), 3000);
  };

  const updateDept = async (id) => {
    await axios.put(`/api/settings/departments/${id}`, editDept);
    setEditDept(null); fetchDepts(); setSaved('Updated!'); setTimeout(() => setSaved(''), 3000);
  };

  const deleteDept = async (id) => {
    if (!window.confirm('Remove this department?')) return;
    await axios.delete(`/api/settings/departments/${id}`);
    fetchDepts();
  };

  const tabs = [{ id:'branding', label:'🎨 Branding' }, { id:'departments', label:'🏢 Departments' }, { id:'schedule', label:'📅 Schedule Defaults' }];

  return (
    <div>
      <div className="page-header"><h1>App Settings</h1><p>Changes apply instantly for all users</p></div>

      {saved && <div style={{ background:'#d4edda', border:'1px solid #c3e6cb', borderRadius:8, padding:'10px 16px', marginBottom:20, color:'#155724', fontSize:14 }}>✓ {saved}</div>}

      <div style={{ display:'flex', gap:4, marginBottom:24, borderBottom:'2px solid var(--gray-200)' }}>
        {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} style={{ padding:'10px 20px', border:'none', background:'none', cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:600, color: tab===t.id ? 'var(--red)' : 'var(--gray-500)', borderBottom: tab===t.id ? '2px solid var(--red)' : '2px solid transparent', marginBottom:-2 }}>{t.label}</button>)}
      </div>

      {tab === 'branding' && (
        <div className="card fade-in" style={{ padding:32, maxWidth:620 }}>
          <h2 style={{ fontSize:18, fontWeight:700, marginBottom:24 }}>Branding & Identity</h2>
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <div><label>Company / App Name</label><input value={settings.company_name} onChange={e => setSettings(s=>({...s,company_name:e.target.value}))} /></div>
            <div><label>Location Label</label><input value={settings.location_label} onChange={e => setSettings(s=>({...s,location_label:e.target.value}))} /><p style={{ fontSize:12, color:'var(--gray-500)', marginTop:4 }}>Shown on the schedule header</p></div>
            <div>
              <label>Primary Brand Colour</label>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8, alignItems:'center' }}>
                {PRESET_COLORS.map(c => <button key={c} onClick={() => setSettings(s=>({...s,primary_color:c}))} style={{ width:36, height:36, borderRadius:8, background:c, border:'none', cursor:'pointer', outline: settings.primary_color===c ? '3px solid #000' : 'none', outlineOffset:2, transform: settings.primary_color===c ? 'scale(1.2)' : 'scale(1)', transition:'all 0.15s' }} />)}
                <input type="color" value={settings.primary_color} onChange={e => setSettings(s=>({...s,primary_color:e.target.value}))} style={{ width:36, height:36, padding:2, borderRadius:8, cursor:'pointer' }} />
                <span style={{ fontFamily:'DM Mono', fontSize:13, color:'var(--gray-600)' }}>{settings.primary_color}</span>
              </div>
              <div style={{ marginTop:16, padding:16, background:'#111827', borderRadius:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:32, height:32, borderRadius:8, background:settings.primary_color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🏢</div>
                  <div><div style={{ color:'white', fontWeight:700, fontSize:14 }}>{settings.company_name}</div><div style={{ color:'rgba(255,255,255,0.4)', fontSize:11 }}>{settings.location_label}</div></div>
                </div>
                <div style={{ marginTop:12 }}><div style={{ background:settings.primary_color, color:'white', padding:'6px 16px', borderRadius:6, display:'inline-block', fontSize:12, fontWeight:600 }}>Sample Button</div></div>
              </div>
            </div>
          </div>
          <button className="btn btn-primary" style={{ marginTop:24 }} onClick={save}>Save Branding</button>
        </div>
      )}

      {tab === 'departments' && (
        <div className="fade-in">
          <div className="card" style={{ padding:24, marginBottom:20 }}>
            <h3 style={{ fontWeight:700, marginBottom:16 }}>Add New Department</h3>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'flex-end' }}>
              <div style={{ flex:1, minWidth:180 }}><label>Name</label><input placeholder="e.g. Finance" value={newDept.name} onChange={e=>setNewDept(d=>({...d,name:e.target.value}))} /></div>
              <div><label>Text Colour</label><input type="color" value={newDept.color} onChange={e=>setNewDept(d=>({...d,color:e.target.value}))} style={{ width:50, height:40, padding:2, borderRadius:8 }} /></div>
              <div><label>Background</label><input type="color" value={newDept.bg_color} onChange={e=>setNewDept(d=>({...d,bg_color:e.target.value}))} style={{ width:50, height:40, padding:2, borderRadius:8 }} /></div>
              <div style={{ paddingBottom:1 }}><div style={{ display:'inline-flex', padding:'4px 12px', borderRadius:20, background:newDept.bg_color, color:newDept.color, fontSize:12, fontWeight:700, marginRight:12 }}>{newDept.name||'Preview'}</div></div>
              <button className="btn btn-primary" onClick={addDept}>+ Add</button>
            </div>
          </div>

          <div className="card" style={{ overflow:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
              <thead><tr style={{ background:'var(--gray-50)', borderBottom:'2px solid var(--gray-200)' }}>
                {['Department','Preview','Colours','Actions'].map(h => <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontSize:12, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:0.5 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {departments.map(d => {
                  const isEditing = editDept?.id === d.id;
                  return <tr key={d.id} style={{ borderBottom:'1px solid var(--gray-100)', background: isEditing ? '#fffbeb' : 'white' }}>
                    <td style={{ padding:'12px 16px', fontWeight:600 }}>{isEditing ? <input value={editDept.name} onChange={e=>setEditDept(p=>({...p,name:e.target.value}))} style={{ maxWidth:160 }} /> : d.name}</td>
                    <td style={{ padding:'12px 16px' }}><span style={{ padding:'3px 12px', borderRadius:20, background: isEditing?editDept.bg_color:d.bg_color, color: isEditing?editDept.color:d.color, fontSize:12, fontWeight:700 }}>{isEditing?editDept.name:d.name}</span></td>
                    <td style={{ padding:'12px 16px' }}>
                      {isEditing ? <div style={{ display:'flex', gap:8 }}>
                        <input type="color" value={editDept.color} onChange={e=>setEditDept(p=>({...p,color:e.target.value}))} style={{ width:36, height:36, borderRadius:6, padding:2 }} />
                        <input type="color" value={editDept.bg_color} onChange={e=>setEditDept(p=>({...p,bg_color:e.target.value}))} style={{ width:36, height:36, borderRadius:6, padding:2 }} />
                      </div> : <div style={{ display:'flex', gap:8 }}>
                        <div style={{ width:20, height:20, borderRadius:4, background:d.color }} title="Text" />
                        <div style={{ width:20, height:20, borderRadius:4, background:d.bg_color, border:'1px solid #ddd' }} title="Background" />
                      </div>}
                    </td>
                    <td style={{ padding:'12px 16px' }}>
                      {isEditing ? <div style={{ display:'flex', gap:8 }}>
                        <button className="btn btn-success btn-sm" onClick={() => updateDept(d.id)}>Save</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditDept(null)}>Cancel</button>
                      </div> : <div style={{ display:'flex', gap:8 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditDept({...d})}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteDept(d.id)}>Remove</button>
                      </div>}
                    </td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'schedule' && (
        <div className="card fade-in" style={{ padding:32, maxWidth:480 }}>
          <h2 style={{ fontSize:18, fontWeight:700, marginBottom:24 }}>Schedule Defaults</h2>
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <div><label>Week Starts On</label>
              <select value={settings.week_start} onChange={e=>setSettings(s=>({...s,week_start:e.target.value}))}>
                <option value="monday">Monday</option><option value="sunday">Sunday</option>
              </select></div>
            <div><label>Time Format</label>
              <select value={settings.time_format} onChange={e=>setSettings(s=>({...s,time_format:e.target.value}))}>
                <option value="24h">24-hour (07:00)</option><option value="12h">12-hour (7:00 AM)</option>
              </select></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div><label>Default Shift Start</label><input type="time" value={settings.default_shift_start} onChange={e=>setSettings(s=>({...s,default_shift_start:e.target.value}))} /></div>
              <div><label>Default Shift End</label><input type="time" value={settings.default_shift_end} onChange={e=>setSettings(s=>({...s,default_shift_end:e.target.value}))} /></div>
            </div>
          </div>
          <button className="btn btn-primary" style={{ marginTop:24 }} onClick={save}>Save Defaults</button>
        </div>
      )}
    </div>
  );
}

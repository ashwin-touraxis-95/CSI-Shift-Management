import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Onboarding() {
  const { user, theme, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [jobRoles, setJobRoles] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get('/api/departments').then(r => {
      // Hide Management — that's for managers only
      setDepartments(r.data.filter(d => d.name !== 'Management'));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedDept) {
      axios.get(`/api/job-roles?department_id=${selectedDept}`).then(r => setJobRoles(r.data)).catch(() => {});
      setSelectedRoles([]);
    }
  }, [selectedDept]);

  const toggleRole = (id) => setSelectedRoles(r => r.includes(id) ? r.filter(x => x !== id) : [...r, id]);

  const handleComplete = async () => {
    if (!selectedRoles.length) return setError('Please select at least one job role');
    setSaving(true);
    try {
      const r = await axios.post('/api/onboarding/complete', { job_role_ids: selectedRoles });
      updateUser(r.data.user);
      navigate('/dashboard');
    } catch(e) { setError(e.response?.data?.error || 'Something went wrong'); }
    setSaving(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const bg = theme?.login_bg || '#0f172a';
  const cardBg = theme?.login_card_bg || '#1e293b';
  const primary = theme?.primary_color || '#C0392B';
  const dept = departments.find(d => d.id === selectedDept);

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:bg, padding:20 }}>
      <div style={{ width:'100%', maxWidth:520 }}>
        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          {theme?.company_logo
            ? <img src={theme.company_logo} alt="Logo" style={{ width:60,height:60,objectFit:'contain',borderRadius:14,background:'white',padding:6,marginBottom:14 }}/>
            : <div style={{ width:60,height:60,borderRadius:16,background:primary,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:28,marginBottom:14 }}>🏢</div>}
          <h1 style={{ color:'white',fontSize:24,fontWeight:800,margin:0 }}>Welcome, {user?.name?.split(' ')[0]}!</h1>
          <p style={{ color:'rgba(255,255,255,0.4)',fontSize:14,marginTop:6 }}>Let's get you set up — just takes a minute</p>
        </div>

        <div style={{ background:cardBg, borderRadius:16, padding:32, border:'1px solid rgba(255,255,255,0.08)' }}>
          {/* Progress */}
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:28 }}>
            {[1,2].map(s => (
              <React.Fragment key={s}>
                <div style={{ width:28,height:28,borderRadius:'50%',background:step>=s?primary:'rgba(255,255,255,0.1)',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,flexShrink:0 }}>
                  {step>s?'✓':s}
                </div>
                {s<2 && <div style={{ flex:1,height:2,background:step>s?primary:'rgba(255,255,255,0.1)',borderRadius:2 }}/>}
              </React.Fragment>
            ))}
          </div>

          {/* Step 1 — Department */}
          {step === 1 && (
            <div>
              <h2 style={{ color:'white',fontSize:18,fontWeight:700,marginBottom:6 }}>Which department are you in?</h2>
              <p style={{ color:'rgba(255,255,255,0.4)',fontSize:13,marginBottom:20 }}>This helps us show you the right team and schedule</p>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {departments.map(d => (
                  <div key={d.id} onClick={()=>setSelectedDept(d.id)}
                    style={{ padding:'14px 18px',borderRadius:10,border:`2px solid ${selectedDept===d.id?primary:'rgba(255,255,255,0.1)'}`,background:selectedDept===d.id?`${primary}20`:'rgba(255,255,255,0.04)',cursor:'pointer',display:'flex',alignItems:'center',gap:12,transition:'all 0.15s' }}>
                    <div style={{ width:10,height:10,borderRadius:'50%',background:d.color,flexShrink:0 }}/>
                    <span style={{ color:'white',fontWeight:600,fontSize:15 }}>{d.name}</span>
                    {d.job_roles?.length > 0 && <span style={{ marginLeft:'auto',fontSize:12,color:'rgba(255,255,255,0.3)' }}>{d.job_roles.length} role{d.job_roles.length!==1?'s':''}</span>}
                  </div>
                ))}
              </div>
              {error && <div style={{ marginTop:14,color:'#f87171',fontSize:13 }}>{error}</div>}
              <button onClick={()=>{if(!selectedDept)return setError('Please select a department');setError('');setStep(2);}}
                style={{ width:'100%',padding:13,borderRadius:10,background:primary,color:'white',border:'none',fontSize:15,fontWeight:700,cursor:'pointer',marginTop:20,fontFamily:'inherit' }}>
                Continue →
              </button>
            </div>
          )}

          {/* Step 2 — Job Role */}
          {step === 2 && (
            <div>
              <h2 style={{ color:'white',fontSize:18,fontWeight:700,marginBottom:6 }}>What is your job role?</h2>
              <p style={{ color:'rgba(255,255,255,0.4)',fontSize:13,marginBottom:20 }}>
                In <strong style={{ color:'white' }}>{dept?.name}</strong> — select all that apply
              </p>
              {jobRoles.length === 0
                ? <div style={{ padding:30,textAlign:'center',color:'rgba(255,255,255,0.3)',fontSize:14,lineHeight:1.6 }}>
                    No job roles have been set up for this department yet.<br/>Your administrator will assign you shortly.
                  </div>
                : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {jobRoles.map(jr => {
                      const selected = selectedRoles.includes(jr.id);
                      return (
                        <div key={jr.id} onClick={()=>toggleRole(jr.id)}
                          style={{ padding:'14px 18px',borderRadius:10,border:`2px solid ${selected?primary:'rgba(255,255,255,0.1)'}`,background:selected?`${primary}20`:'rgba(255,255,255,0.04)',cursor:'pointer',display:'flex',alignItems:'center',gap:12,transition:'all 0.15s' }}>
                          <div style={{ width:18,height:18,borderRadius:5,border:`2px solid ${selected?primary:'rgba(255,255,255,0.3)'}`,background:selected?primary:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                            {selected && <span style={{ color:'white',fontSize:11,fontWeight:700 }}>✓</span>}
                          </div>
                          <div>
                            <div style={{ color:'white',fontWeight:600,fontSize:14 }}>{jr.name}</div>
                            {jr.description && <div style={{ color:'rgba(255,255,255,0.35)',fontSize:12,marginTop:2 }}>{jr.description}</div>}
                          </div>
                          {jr.leaders?.length > 0 && <div style={{ marginLeft:'auto',fontSize:12,color:'rgba(255,255,255,0.3)' }}>TL: {jr.leaders.map(l=>l.name).join(', ')}</div>}
                        </div>
                      );
                    })}
                  </div>}
              {error && <div style={{ marginTop:14,color:'#f87171',fontSize:13 }}>{error}</div>}
              <div style={{ display:'flex',gap:10,marginTop:20 }}>
                <button onClick={()=>{ setStep(1); setError(''); }}
                  style={{ padding:13,borderRadius:10,background:'rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.6)',border:'none',fontSize:14,cursor:'pointer',fontFamily:'inherit',minWidth:90 }}>← Back</button>
                <button onClick={handleComplete} disabled={saving}
                  style={{ flex:1,padding:13,borderRadius:10,background:primary,color:'white',border:'none',fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'inherit',opacity:saving?0.7:1 }}>
                  {saving ? 'Saving...' : "Let's go! 🎉"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Return to login */}
        <div style={{ textAlign:'center', marginTop:16 }}>
          <button onClick={handleLogout}
            style={{ background:'none',border:'none',color:'rgba(255,255,255,0.3)',fontSize:13,cursor:'pointer',fontFamily:'inherit',textDecoration:'underline' }}>
            ← Return to login
          </button>
        </div>

        <p style={{ color:'rgba(255,255,255,0.15)',textAlign:'center',fontSize:12,marginTop:12 }}>
          {theme?.company_name || 'ShiftManager'} · {theme?.location_label || 'South Africa'}
        </p>
      </div>
    </div>
  );
}

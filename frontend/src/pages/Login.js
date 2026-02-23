import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const STEPS = { EMAIL: 'email', PASSWORD: 'password', SETUP: 'setup', FORCE_CHANGE: 'force_change' };

export default function Login() {
  const [step, setStep] = useState(STEPS.EMAIL);
  const [email, setEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState({});
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    axios.get('/api/theme').then(r => setTheme(r.data)).catch(() => {});
  }, []);

  const primary = theme.primary_color || '#C0392B';
  const bg = theme.login_bg || '#0f172a';
  const cardBg = theme.login_card_bg || '#1e293b';

  const inputStyle = {
    width:'100%', padding:'12px 14px', borderRadius:10,
    border:'1.5px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.06)',
    color:'white', fontSize:14, outline:'none', boxSizing:'border-box', fontFamily:'inherit'
  };
  const labelStyle = { color:'rgba(255,255,255,0.6)', fontSize:13, fontWeight:600, display:'block', marginBottom:6 };
  const btnStyle = (bg2=primary) => ({
    width:'100%', padding:13, borderRadius:10, background:bg2, color:'white',
    border:'none', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
    opacity:loading?0.7:1, marginTop:4
  });

  // Step 1 — Enter email
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return setError('Please enter your email address');
    setLoading(true); setError('');
    try {
      const r = await axios.post('/api/auth/check-email', { email: email.trim().toLowerCase() });
      if (!r.data.exists) return setError('No account found with that email. Contact your administrator.');
      setUserName(r.data.name);
      setStep(r.data.hasPassword ? STEPS.PASSWORD : STEPS.SETUP);
    } catch(e) { setError(e.response?.data?.error || 'Something went wrong'); }
    setLoading(false);
  };

  // Step 2a — Enter password
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!password) return setError('Please enter your password');
    setLoading(true); setError('');
    try {
      const r = await axios.post('/api/auth/login', { email: email.trim().toLowerCase(), password });
      login(r.data.user, r.data.permissions, r.data.theme);
      if (r.data.forcePasswordChange) { setStep(STEPS.FORCE_CHANGE); setPassword(''); }
      else navigate(r.data.user.onboarded ? '/dashboard' : '/onboarding');
    } catch(e) { setError(e.response?.data?.error || 'Invalid email or password'); }
    setLoading(false);
  };

  // Step 2b — First time setup (no password yet)
  const handleSetup = async (e) => {
    e.preventDefault();
    if (!newPassword) return setError('Please enter a password');
    if (newPassword.length < 8) return setError('Password must be at least 8 characters');
    if (newPassword !== confirmPassword) return setError('Passwords do not match');
    setLoading(true); setError('');
    try {
      const r = await axios.post('/api/auth/setup-password', { email: email.trim().toLowerCase(), password: newPassword });
      login(r.data.user, r.data.permissions, r.data.theme);
      navigate(r.data.user.onboarded ? '/dashboard' : '/onboarding');
    } catch(e) { setError(e.response?.data?.error || 'Something went wrong'); }
    setLoading(false);
  };

  // Step 3 — Forced password change (temp password used)
  const handleForceChange = async (e) => {
    e.preventDefault();
    if (!newPassword) return setError('Please enter a new password');
    if (newPassword.length < 8) return setError('Password must be at least 8 characters');
    if (newPassword !== confirmPassword) return setError('Passwords do not match');
    setLoading(true); setError('');
    try {
      const r = await axios.post('/api/auth/change-password', { new_password: newPassword });
      login(r.data.user, null, theme);
      navigate('/dashboard');
    } catch(e) { setError(e.response?.data?.error || 'Something went wrong'); }
    setLoading(false);
  };

  const PasswordInput = ({ value, onChange, placeholder='Enter password' }) => (
    <div style={{ position:'relative' }}>
      <input type={showPassword?'text':'password'} value={value} onChange={onChange} placeholder={placeholder}
        style={inputStyle}
        onFocus={e=>e.target.style.borderColor=primary} onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.12)'}/>
      <button type="button" onClick={()=>setShowPassword(s=>!s)}
        style={{ position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:16,padding:0 }}>
        {showPassword ? '🙈' : '👁️'}
      </button>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:bg, padding:20 }}>
      <div style={{ width:'100%', maxWidth:420 }}>
        {/* Logo & company */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          {theme.company_logo
            ? <img src={theme.company_logo} alt="Logo" style={{ width:64,height:64,objectFit:'contain',borderRadius:16,background:'white',padding:8,marginBottom:14 }}/>
            : <div style={{ width:64,height:64,borderRadius:18,background:primary,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:32,marginBottom:14 }}>🏢</div>}
          <h1 style={{ color:'white',fontSize:26,fontWeight:800,margin:0 }}>{theme.company_name||'ShiftManager'}</h1>
          <p style={{ color:'rgba(255,255,255,0.35)',margin:'6px 0 0',fontSize:14 }}>Operations Platform</p>
        </div>

        <div style={{ background:cardBg,borderRadius:16,padding:32,border:'1px solid rgba(255,255,255,0.08)' }}>

          {/* ── EMAIL STEP ── */}
          {step === STEPS.EMAIL && (
            <form onSubmit={handleEmailSubmit}>
              <h2 style={{ color:'white',fontSize:18,fontWeight:700,marginBottom:6 }}>Sign in</h2>
              <p style={{ color:'rgba(255,255,255,0.4)',fontSize:13,marginBottom:22 }}>Enter your work email to continue</p>
              <div style={{ marginBottom:16 }}>
                <label style={labelStyle}>Work Email</label>
                <input type="email" placeholder="your@touraxis.com" value={email} onChange={e=>setEmail(e.target.value)}
                  style={inputStyle} autoFocus
                  onFocus={e=>e.target.style.borderColor=primary} onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.12)'}/>
              </div>
              {error && <div style={{ background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,padding:'10px 14px',color:'#f87171',fontSize:13,marginBottom:16 }}>{error}</div>}
              <button type="submit" disabled={loading} style={btnStyle()}>{loading?'Checking...':'Continue →'}</button>
            </form>
          )}

          {/* ── PASSWORD STEP ── */}
          {step === STEPS.PASSWORD && (
            <form onSubmit={handleLogin}>
              <button type="button" onClick={()=>{setStep(STEPS.EMAIL);setError('');setPassword('');}}
                style={{ background:'none',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:13,padding:'0 0 16px',fontFamily:'inherit' }}>← Back</button>
              <h2 style={{ color:'white',fontSize:18,fontWeight:700,marginBottom:4 }}>Welcome back{userName?`, ${userName.split(' ')[0]}`:''}</h2>
              <p style={{ color:'rgba(255,255,255,0.4)',fontSize:13,marginBottom:22 }}>{email}</p>
              <div style={{ marginBottom:16 }}>
                <label style={labelStyle}>Password</label>
                <PasswordInput value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password"/>
              </div>
              {error && <div style={{ background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,padding:'10px 14px',color:'#f87171',fontSize:13,marginBottom:16 }}>{error}</div>}
              <button type="submit" disabled={loading} style={btnStyle()}>{loading?'Signing in...':'Sign In'}</button>
            </form>
          )}

          {/* ── FIRST TIME SETUP ── */}
          {step === STEPS.SETUP && (
            <form onSubmit={handleSetup}>
              <div style={{ background:`${primary}20`,border:`1px solid ${primary}40`,borderRadius:8,padding:'10px 14px',marginBottom:20 }}>
                <div style={{ color:'white',fontWeight:600,fontSize:13 }}>👋 First time signing in{userName?`, ${userName.split(' ')[0]}`:''}</div>
                <div style={{ color:'rgba(255,255,255,0.5)',fontSize:12,marginTop:3 }}>Create your password to get started</div>
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={labelStyle}>New Password</label>
                <PasswordInput value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="At least 8 characters"/>
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={labelStyle}>Confirm Password</label>
                <PasswordInput value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Repeat your password"/>
              </div>
              <div style={{ fontSize:11,color:'rgba(255,255,255,0.3)',marginBottom:14 }}>
                Must be at least 8 characters. Use a mix of letters and numbers for security.
              </div>
              {error && <div style={{ background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,padding:'10px 14px',color:'#f87171',fontSize:13,marginBottom:16 }}>{error}</div>}
              <button type="submit" disabled={loading} style={btnStyle()}>{loading?'Setting up...':'Create Password & Sign In'}</button>
            </form>
          )}

          {/* ── FORCED PASSWORD CHANGE ── */}
          {step === STEPS.FORCE_CHANGE && (
            <form onSubmit={handleForceChange}>
              <div style={{ background:'rgba(234,179,8,0.15)',border:'1px solid rgba(234,179,8,0.3)',borderRadius:8,padding:'10px 14px',marginBottom:20 }}>
                <div style={{ color:'#FCD34D',fontWeight:600,fontSize:13 }}>🔑 Password reset required</div>
                <div style={{ color:'rgba(255,255,255,0.5)',fontSize:12,marginTop:3 }}>Your administrator has reset your password. Please create a new one to continue.</div>
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={labelStyle}>New Password</label>
                <PasswordInput value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="At least 8 characters"/>
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={labelStyle}>Confirm New Password</label>
                <PasswordInput value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Repeat your new password"/>
              </div>
              {error && <div style={{ background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,padding:'10px 14px',color:'#f87171',fontSize:13,marginBottom:16 }}>{error}</div>}
              <button type="submit" disabled={loading} style={btnStyle()}>{loading?'Saving...':'Set New Password & Continue'}</button>
            </form>
          )}

        </div>
        <p style={{ color:'rgba(255,255,255,0.15)',textAlign:'center',fontSize:12,marginTop:18 }}>
          ShiftManager v7 · TourAxis · {theme.location_label||'South Africa'}
        </p>
      </div>
    </div>
  );
}

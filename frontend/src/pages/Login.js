import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const inputStyle = {
  width:'100%', padding:'12px 14px', borderRadius:10,
  border:'1.5px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.06)',
  color:'white', fontSize:14, outline:'none', boxSizing:'border-box', fontFamily:'inherit'
};
const labelStyle = {
  color:'rgba(255,255,255,0.6)', fontSize:13, fontWeight:600, display:'block', marginBottom:6
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState({});
  const [setupMode, setSetupMode] = useState(false);
  const [setupUserId, setSetupUserId] = useState(null);
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');
  const [setupName, setSetupName] = useState('');
  const [showForgot, setShowForgot] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    axios.get('/api/theme').then(r => setTheme(r.data)).catch(() => {});
  }, []);

  const primary = theme.primary_color || '#C0392B';
  const bg = theme.login_bg || '#0f172a';
  const cardBg = theme.login_card_bg || '#1e293b';
  const subtitle = theme.login_subtitle || 'Operations Platform';
  const btnColor = theme.login_btn_color || theme.button_color || theme.primary_color || '#C0392B';
  const btnTextColor = theme.login_btn_text || '#ffffff';

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return setError('Email and password are required');
    setLoading(true); setError('');
    try {
      const r = await axios.post('/api/auth/login', { email: email.trim().toLowerCase(), password });
      if (r.data.requiresPasswordSetup) {
        setSetupUserId(r.data.userId);
        setSetupName(r.data.userName || email.split('@')[0]);
        setSetupMode(true);
        setLoading(false);
        return;
      }
      login(r.data.user, r.data.permissions, r.data.theme);
      if (r.data.forcePasswordChange) return navigate('/change-password');
      navigate(r.data.user.onboarded ? '/dashboard' : '/onboarding');
    } catch(e) { setError(e.response?.data?.error || 'Login failed. Please try again.'); }
    setLoading(false);
  };

  const handleSetupPassword = async (e) => {
    e.preventDefault();
    if (setupPassword.length < 8) return setError('Password must be at least 8 characters');
    if (setupPassword !== setupConfirm) return setError('Passwords do not match');
    setLoading(true); setError('');
    try {
      const r = await axios.post('/api/auth/setup-password', { userId: setupUserId, password: setupPassword });
      login(r.data.user, r.data.permissions, r.data.theme);
      navigate(r.data.user.onboarded ? '/dashboard' : '/onboarding');
    } catch(e) { setError(e.response?.data?.error || 'Something went wrong'); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:bg, padding:20 }}>
      <div style={{ width:'100%', maxWidth:420 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          {theme.company_logo
            ? <img src={theme.company_logo} alt="Logo" style={{ width:64,height:64,objectFit:'contain',borderRadius:16,background:'white',padding:8,marginBottom:14 }}/>
            : <div style={{ width:64,height:64,borderRadius:18,background:primary,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:32,marginBottom:14 }}>🏢</div>}
          <h1 style={{ color:'white',fontSize:26,fontWeight:800,margin:0 }}>{theme.company_name||'ShiftManager'}</h1>
          <p style={{ color:'rgba(255,255,255,0.35)',margin:'6px 0 0',fontSize:14 }}>{subtitle}</p>
        </div>

        <div style={{ background:cardBg, borderRadius:16, padding:32, border:'1px solid rgba(255,255,255,0.08)' }}>

          {/* ── SETUP PASSWORD (first time) ── */}
          {setupMode ? (
            <form onSubmit={handleSetupPassword}>
              <h2 style={{ color:'white',fontSize:18,fontWeight:700,marginBottom:4 }}>Create your password</h2>
              <p style={{ color:'rgba(255,255,255,0.4)',fontSize:13,marginBottom:22 }}>
                Welcome, <strong style={{ color:'white' }}>{setupName}</strong>! Set a secure password to continue.
              </p>
              <div style={{ marginBottom:14 }}>
                <label style={labelStyle}>New Password</label>
                <input type="password" placeholder="Minimum 8 characters" value={setupPassword} onChange={e=>setSetupPassword(e.target.value)} style={inputStyle}/>
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={labelStyle}>Confirm Password</label>
                <input type="password" placeholder="Repeat your password" value={setupConfirm} onChange={e=>setSetupConfirm(e.target.value)} style={inputStyle}/>
              </div>
              {error && <div style={{ background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,padding:'10px 14px',color:'#f87171',fontSize:13,marginBottom:16 }}>{error}</div>}
              <button type="submit" disabled={loading} style={{ width:'100%',padding:13,borderRadius:10,background:btnColor,color:btnTextColor,border:'none',fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'inherit',opacity:loading?0.7:1 }}>
                {loading ? 'Setting up...' : 'Create Password & Sign In'}
              </button>
              <button type="button" onClick={()=>{ setSetupMode(false); setError(''); }} style={{ width:'100%',marginTop:10,padding:10,borderRadius:10,background:'transparent',color:'rgba(255,255,255,0.3)',border:'none',fontSize:13,cursor:'pointer',fontFamily:'inherit' }}>
                ← Back to login
              </button>
            </form>

          ) : (
            /* ── NORMAL LOGIN — email + password together ── */
            <form onSubmit={handleLogin}>
              <h2 style={{ color:'white',fontSize:18,fontWeight:700,marginBottom:6 }}>Sign in</h2>
              <p style={{ color:'rgba(255,255,255,0.4)',fontSize:13,marginBottom:22 }}>Enter your work email and password to continue</p>
              <div style={{ marginBottom:14 }}>
                <label style={labelStyle}>Work Email</label>
                <input type="email" placeholder="your@touraxis.com" value={email} onChange={e=>setEmail(e.target.value)} style={inputStyle}/>
              </div>
              <div style={{ marginBottom:20 }}>
                <label style={labelStyle}>Password</label>
                <input type="password" placeholder="Your password" value={password} onChange={e=>setPassword(e.target.value)} style={inputStyle}/>
              </div>
              {error && <div style={{ background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,padding:'10px 14px',color:'#f87171',fontSize:13,marginBottom:16 }}>{error}</div>}
              <button type="submit" disabled={loading} style={{ width:'100%',padding:13,borderRadius:10,background:btnColor,color:btnTextColor,border:'none',fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'inherit',opacity:loading?0.7:1 }}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
              <div style={{ textAlign:'center',marginTop:14 }}>
                <button type="button" onClick={()=>setShowForgot(true)} style={{ background:'none',border:'none',color:'rgba(255,255,255,0.35)',fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>
                  Forgot password?
                </button>
              </div>
            </form>
          )}
        </div>

        {showForgot && (
          <div style={{ position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20 }}>
            <div style={{ background:'#1E293B',borderRadius:16,padding:32,maxWidth:380,width:'100%',border:'1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize:32,textAlign:'center',marginBottom:12 }}>🔒</div>
              <h3 style={{ color:'white',textAlign:'center',marginBottom:10,fontWeight:700 }}>Forgot your password?</h3>
              <p style={{ color:'rgba(255,255,255,0.5)',fontSize:13,textAlign:'center',lineHeight:1.7,marginBottom:20 }}>
                Passwords can only be reset by your Team Leader, Manager or Admin.<br/><br/>
                Please contact your manager and ask them to reset your password. They will provide you with a temporary password to log in with.
              </p>
              <button onClick={()=>setShowForgot(false)} style={{ width:'100%',padding:12,borderRadius:10,background:btnColor,color:btnTextColor,border:'none',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit' }}>
                Got it
              </button>
            </div>
          </div>
        )}
        <p style={{ color:'rgba(255,255,255,0.15)',textAlign:'center',fontSize:11,marginTop:18,lineHeight:1.6 }}>
          {theme.company_name||'ShiftManager'} · {theme.location_label||'South Africa'}<br/>
          <span style={{ fontSize:10,opacity:0.7 }}>Built by Ashwin Halford with Claude's assistance</span>
        </p>
      </div>
    </div>
  );
}

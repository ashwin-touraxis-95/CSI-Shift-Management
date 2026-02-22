import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
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

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim()) return setError('Please enter your email address');
    setLoading(true); setError('');
    try {
      const r = await axios.post('/api/auth/demo', { email: email.trim() });
      login(r.data.user, r.data.permissions, r.data.theme);
      navigate(r.data.user.onboarded ? '/dashboard' : '/onboarding');
    } catch(e) { setError(e.response?.data?.error || 'Login failed. Please try again.'); }
    setLoading(false);
  };

  const quickLogin = async (em) => {
    setLoading(true); setError('');
    try {
      const r = await axios.post('/api/auth/demo', { email: em });
      login(r.data.user, r.data.permissions, r.data.theme);
      navigate('/dashboard');
    } catch(e) { setError(e.response?.data?.error || 'Login failed'); }
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
          <p style={{ color:'rgba(255,255,255,0.35)',margin:'6px 0 0',fontSize:14 }}>TourAxis Operations Platform</p>
        </div>

        <div style={{ background:cardBg,borderRadius:16,padding:32,border:'1px solid rgba(255,255,255,0.08)' }}>
          <h2 style={{ color:'white',fontSize:18,fontWeight:700,marginBottom:6 }}>Sign in</h2>
          <p style={{ color:'rgba(255,255,255,0.4)',fontSize:13,marginBottom:22 }}>Enter your work email to continue</p>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom:16 }}>
              <label style={{ color:'rgba(255,255,255,0.6)',fontSize:13,fontWeight:600,display:'block',marginBottom:6 }}>Work Email</label>
              <input type="email" placeholder="your@touraxis.com" value={email} onChange={e=>setEmail(e.target.value)}
                style={{ width:'100%',padding:'12px 14px',borderRadius:10,border:'1.5px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.06)',color:'white',fontSize:14,outline:'none',boxSizing:'border-box',fontFamily:'inherit' }}
                onFocus={e=>e.target.style.borderColor=primary} onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.12)'}/>
            </div>
            {error && <div style={{ background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,padding:'10px 14px',color:'#f87171',fontSize:13,marginBottom:16 }}>{error}</div>}
            <button type="submit" disabled={loading} style={{ width:'100%',padding:'13px',borderRadius:10,background:primary,color:'white',border:'none',fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'inherit',opacity:loading?0.7:1 }}>
              {loading?'Signing in...':'Sign In'}
            </button>
          </form>

          <div style={{ marginTop:22,paddingTop:18,borderTop:'1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ color:'rgba(255,255,255,0.25)',fontSize:11,textAlign:'center',marginBottom:10,textTransform:'uppercase',letterSpacing:1 }}>Quick Demo Access</p>
            <div style={{ display:'flex',flexDirection:'column',gap:7 }}>
              {[
                { label:'🛡️ Account Admin', email:'admin@demo.com', color:'#C0392B' },
                { label:'👔 Manager', email:'manager@demo.com', color:'#2980B9' },
              ].map(q=>(
                <button key={q.email} onClick={()=>quickLogin(q.email)} disabled={loading}
                  style={{ padding:'9px 14px',borderRadius:8,border:`1px solid ${q.color}40`,background:`${q.color}15`,color:q.color,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',textAlign:'left',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                  <span>{q.label}</span><span style={{ fontSize:11,opacity:0.6 }}>{q.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <p style={{ color:'rgba(255,255,255,0.15)',textAlign:'center',fontSize:12,marginTop:18 }}>ShiftManager v6 · TourAxis · South Africa</p>
      </div>
    </div>
  );
}

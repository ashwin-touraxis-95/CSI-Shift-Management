import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleDemo = async (e) => {
    e.preventDefault();
    if (!email.trim()) return setError('Please enter your email address');
    setLoading(true); setError('');
    try {
      const r = await axios.post('/api/auth/demo', { email: email.trim() });
      login(r.data.user, r.data.permissions);
      navigate('/dashboard');
    } catch(e) {
      setError(e.response?.data?.error || 'Login failed. Please try again.');
    }
    setLoading(false);
  };

  const quickLogin = async (em) => {
    setLoading(true); setError('');
    try {
      const r = await axios.post('/api/auth/demo', { email: em });
      login(r.data.user, r.data.permissions);
      navigate('/dashboard');
    } catch(e) { setError(e.response?.data?.error || 'Login failed'); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0f172a', padding:20 }}>
      <div style={{ width:'100%', maxWidth:420 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={{ width:64, height:64, borderRadius:18, background:'#C0392B', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:32, marginBottom:16 }}>🏢</div>
          <h1 style={{ color:'white', fontSize:26, fontWeight:800, margin:0 }}>ShiftManager</h1>
          <p style={{ color:'rgba(255,255,255,0.4)', margin:'6px 0 0', fontSize:14 }}>TourAxis Operations Platform</p>
        </div>

        {/* Login card */}
        <div style={{ background:'#1e293b', borderRadius:16, padding:32, border:'1px solid rgba(255,255,255,0.08)' }}>
          <h2 style={{ color:'white', fontSize:18, fontWeight:700, marginBottom:6 }}>Sign in</h2>
          <p style={{ color:'rgba(255,255,255,0.4)', fontSize:13, marginBottom:24 }}>Enter your work email to continue</p>

          <form onSubmit={handleDemo}>
            <div style={{ marginBottom:16 }}>
              <label style={{ color:'rgba(255,255,255,0.6)', fontSize:13, fontWeight:600, display:'block', marginBottom:6 }}>Work Email</label>
              <input
                type="email"
                placeholder="your@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ width:'100%', padding:'12px 14px', borderRadius:10, border:'1.5px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.06)', color:'white', fontSize:14, outline:'none', boxSizing:'border-box', fontFamily:'inherit' }}
                onFocus={e => e.target.style.borderColor='#C0392B'}
                onBlur={e => e.target.style.borderColor='rgba(255,255,255,0.12)'}
              />
            </div>

            {error && <div style={{ background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'10px 14px', color:'#f87171', fontSize:13, marginBottom:16 }}>{error}</div>}

            <button type="submit" disabled={loading} style={{ width:'100%', padding:'13px', borderRadius:10, background:'#C0392B', color:'white', border:'none', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit', opacity:loading?0.7:1 }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Quick access for demo */}
          <div style={{ marginTop:24, paddingTop:20, borderTop:'1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ color:'rgba(255,255,255,0.3)', fontSize:11, textAlign:'center', marginBottom:12, textTransform:'uppercase', letterSpacing:1 }}>Quick Demo Access</p>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[
                { label:'🛡️ Account Admin', email:'admin@demo.com', color:'#C0392B' },
                { label:'👔 Manager', email:'manager@demo.com', color:'#2980B9' },
              ].map(q => (
                <button key={q.email} onClick={() => quickLogin(q.email)} disabled={loading}
                  style={{ padding:'9px 14px', borderRadius:8, border:`1px solid ${q.color}40`, background:`${q.color}15`, color:q.color, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', textAlign:'left', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span>{q.label}</span>
                  <span style={{ fontSize:11, opacity:0.6 }}>{q.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p style={{ color:'rgba(255,255,255,0.2)', textAlign:'center', fontSize:12, marginTop:20 }}>
          ShiftManager v4 · TourAxis · South Africa
        </p>
      </div>
    </div>
  );
}

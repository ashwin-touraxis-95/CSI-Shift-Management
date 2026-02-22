import React, { useState } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID';

export default function Login() {
  const { setUser } = useAuth();
  const [demoEmail, setDemoEmail] = useState('');
  const [showDemo, setShowDemo] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSuccess = async (cred) => {
    try {
      const res = await axios.post('/api/auth/google', { credential: cred.credential });
      setUser(res.data.user);
    } catch (e) {
      setError('Google login failed. Check your Client ID setup.');
    }
  };

  const handleDemoLogin = async () => {
    if (!demoEmail) return;
    try {
      const res = await axios.post('/api/auth/demo', { email: demoEmail });
      setUser(res.data.user);
    } catch (e) {
      setError('Demo login failed.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
    }}>
      <div className="fade-in" style={{ width: 420, padding: 48, textAlign: 'center' }}>
        {/* Logo */}
        <div style={{ marginBottom: 40 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20, background: 'var(--red)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', boxShadow: '0 8px 32px rgba(192,57,43,0.4)'
          }}>
            <span style={{ fontSize: 32 }}>🇿🇦</span>
          </div>
          <h1 style={{ color: 'white', fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px' }}>
            ShiftManager
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: 8, fontSize: 14 }}>
            South Africa Operations · Week Scheduling
          </p>
        </div>

        <div className="card" style={{ padding: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Sign in to continue</h2>
          <p style={{ color: 'var(--gray-500)', fontSize: 13, marginBottom: 28 }}>
            Use your Gmail account to access your schedule and clock in/out
          </p>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 20, color: '#dc2626', fontSize: 13 }}>
              {error}
            </div>
          )}

          <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google login failed')}
                size="large"
                text="signin_with"
                shape="rectangular"
              />
            </div>
          </GoogleOAuthProvider>

          <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: 20, marginTop: 4 }}>
            <button
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}
              onClick={() => setShowDemo(!showDemo)}
            >
              🧪 Demo Mode (No Google Setup Required)
            </button>

            {showDemo && (
              <div style={{ marginTop: 14 }} className="fade-in">
                <p style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 10 }}>
                  Enter any email. Use <strong>manager@demo.com</strong> for manager access.
                </p>
                <input
                  placeholder="your@email.com"
                  value={demoEmail}
                  onChange={e => setDemoEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleDemoLogin()}
                  style={{ marginBottom: 10 }}
                />
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleDemoLogin}>
                  Enter Demo
                </button>
              </div>
            )}
          </div>
        </div>

        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 24 }}>
          Secure • Locally Hosted • South Africa Team
        </p>
      </div>
    </div>
  );
}

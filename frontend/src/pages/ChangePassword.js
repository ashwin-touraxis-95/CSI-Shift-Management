import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function ChangePassword({ forced = false }) {
  const { user, theme, updateUser } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const primary = theme?.primary_color || '#C0392B';
  const isForced = forced || user?.force_password_change;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPass.length < 8) return setError('New password must be at least 8 characters');
    if (newPass !== confirm) return setError('Passwords do not match');
    setSaving(true); setError('');
    try {
      const r = await axios.post('/api/auth/change-password', { currentPassword: current, newPassword: newPass });
      updateUser(r.data.user);
      setSuccess(true);
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch(e) { setError(e.response?.data?.error || 'Something went wrong'); }
    setSaving(false);
  };

  const inputStyle = { width:'100%', padding:'11px 14px', borderRadius:9, border:'1.5px solid var(--gray-300)', background:'white', fontSize:14, outline:'none', boxSizing:'border-box', fontFamily:'inherit' };

  return (
    <div style={{ maxWidth:440, margin:'60px auto', padding:20 }}>
      <div className="card" style={{ padding:32 }}>
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ fontSize:36, marginBottom:8 }}>🔐</div>
          <h2 style={{ margin:0, fontWeight:800, fontSize:20 }}>
            {isForced ? 'Create your new password' : 'Change Password'}
          </h2>
          {isForced && <p style={{ color:'var(--gray-500)', fontSize:13, marginTop:8 }}>
            You're using a temporary password. Please create a new one to continue.
          </p>}
        </div>

        {success ? (
          <div style={{ textAlign:'center', padding:20 }}>
            <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
            <div style={{ fontWeight:700, fontSize:16 }}>Password updated!</div>
            <div style={{ color:'var(--gray-500)', fontSize:13, marginTop:6 }}>Taking you to the dashboard...</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontWeight:600, fontSize:13, display:'block', marginBottom:6 }}>
                {isForced ? 'Temporary Password' : 'Current Password'}
              </label>
              <input type="password" placeholder="Enter current / temp password" value={current} onChange={e=>setCurrent(e.target.value)} style={inputStyle}/>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontWeight:600, fontSize:13, display:'block', marginBottom:6 }}>New Password</label>
              <input type="password" placeholder="Minimum 8 characters" value={newPass} onChange={e=>setNewPass(e.target.value)} style={inputStyle}/>
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ fontWeight:600, fontSize:13, display:'block', marginBottom:6 }}>Confirm New Password</label>
              <input type="password" placeholder="Repeat new password" value={confirm} onChange={e=>setConfirm(e.target.value)} style={inputStyle}/>
            </div>
            {error && <div style={{ background:'#FEE2E2', border:'1px solid #FECACA', borderRadius:8, padding:'10px 14px', color:'#991B1B', fontSize:13, marginBottom:16 }}>{error}</div>}
            <button type="submit" disabled={saving} style={{ width:'100%', padding:13, borderRadius:10, background:primary, color:'white', border:'none', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit', opacity:saving?0.7:1 }}>
              {saving ? 'Saving...' : 'Update Password'}
            </button>
            {!isForced && (
              <button type="button" onClick={()=>navigate(-1)} style={{ width:'100%', marginTop:10, padding:10, borderRadius:10, background:'transparent', color:'var(--gray-500)', border:'1px solid var(--gray-300)', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                Cancel
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

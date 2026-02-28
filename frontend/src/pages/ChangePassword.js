import React, { useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const styles = {
  input: {
    width:'100%', padding:'11px 14px', borderRadius:9,
    border:'1.5px solid #E2E8F0', background:'white',
    fontSize:14, outline:'none', boxSizing:'border-box', fontFamily:'inherit',
    display:'block'
  },
  label: { fontWeight:600, fontSize:13, display:'block', marginBottom:6, color:'#374151' }
};

export default function ChangePassword({ forced = false }) {
  const { user, theme, updateUser } = useAuth();
  const navigate = useNavigate();
  const [fields, setFields] = useState({ current:'', newPass:'', confirm:'' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const primary = theme?.primary_color || '#C0392B';
  const isForced = forced || user?.force_password_change;

  const handleChange = useCallback((field) => (e) => {
    const val = e.target.value;
    setFields(prev => ({ ...prev, [field]: val }));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!fields.newPass) return setError('Please enter a new password');
    if (fields.newPass !== fields.confirm) return setError('Passwords do not match');
    setSaving(true);
    try {
      const r = await axios.post('/api/auth/change-password', {
        currentPassword: fields.current,
        newPassword: fields.newPass
      });
      updateUser(r.data.user);
      setSuccess(true);
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch(e) {
      setError(e.response?.data?.error || 'Something went wrong. Please try again.');
    }
    setSaving(false);
  };

  if (success) return (
    <div style={{ maxWidth:440, margin:'60px auto', padding:20 }}>
      <div className="card" style={{ padding:40, textAlign:'center' }}>
        <div style={{ fontSize:52, marginBottom:16 }}>✅</div>
        <div style={{ fontWeight:800, fontSize:18 }}>Password updated!</div>
        <div style={{ color:'#6B7280', fontSize:14, marginTop:8 }}>Taking you to the dashboard...</div>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth:440, margin:'60px auto', padding:20 }}>
      <div className="card" style={{ padding:32 }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ fontSize:40, marginBottom:10 }}>🔐</div>
          <h2 style={{ margin:0, fontWeight:800, fontSize:20 }}>
            {isForced ? 'Create your new password' : 'Change Password'}
          </h2>
          {isForced && (
            <p style={{ color:'#6B7280', fontSize:13, marginTop:10, lineHeight:1.6 }}>
              You're using a temporary password.<br/>Please create a new one to continue.
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom:16 }}>
            <label style={styles.label}>{isForced ? 'Temporary Password' : 'Current Password'}</label>
            <input
              type="password"
              value={fields.current}
              onChange={handleChange('current')}
              placeholder="Enter current / temp password"
              style={styles.input}
            />
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={styles.label}>New Password</label>
            <input
              type="password"
              value={fields.newPass}
              onChange={handleChange('newPass')}
              placeholder="Enter new password"
              style={styles.input}
            />
          </div>
          <div style={{ marginBottom:22 }}>
            <label style={styles.label}>Confirm New Password</label>
            <input
              type="password"
              value={fields.confirm}
              onChange={handleChange('confirm')}
              placeholder="Repeat new password"
              style={styles.input}
            />
          </div>

          {error && (
            <div style={{ background:'#FEE2E2', border:'1px solid #FECACA', borderRadius:8, padding:'10px 14px', color:'#991B1B', fontSize:13, marginBottom:16 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={saving}
            style={{ width:'100%', padding:13, borderRadius:10, background:primary, color:'white', border:'none', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit', opacity:saving?0.7:1 }}>
            {saving ? 'Saving...' : 'Update Password'}
          </button>

          {!isForced && (
            <button type="button" onClick={() => navigate(-1)}
              style={{ width:'100%', marginTop:10, padding:10, borderRadius:10, background:'transparent', color:'#6B7280', border:'1px solid #E2E8F0', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
              Cancel
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

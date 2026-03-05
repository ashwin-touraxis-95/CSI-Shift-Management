import React, { useState, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef();

  const [name, setName] = useState(user?.name || '');
  const [preview, setPreview] = useState(user?.avatar || null);
  const [pendingFile, setPendingFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('success');

  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  const flash = (text, type='success') => { setMsg(text); setMsgType(type); setTimeout(() => setMsg(''), 3500); };

  const AVATAR_COLORS = ['#C0392B','#2980B9','#8E44AD','#16A085','#E67E22','#27AE60','#E74C3C','#1ABC9C'];
  const avatarColor = (n) => AVATAR_COLORS[((n?.trim()||'').charCodeAt(0)||0) % AVATAR_COLORS.length];

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500000) return flash('Please choose an image under 500KB', 'error');
    setPendingFile(file);
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      // Save name if changed
      if (name.trim() !== user.name) {
        await axios.put(`/api/users/${user.id}`, { name: name.trim(), user_type: user.user_type, department: user.department });
      }
      // Upload avatar if a new file was picked
      if (pendingFile) {
        const dataUrl = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = ev => res(ev.target.result);
          r.onerror = rej;
          r.readAsDataURL(pendingFile);
        });
        await axios.post(`/api/users/${user.id}/avatar`, { avatar: dataUrl });
      }
      // Refresh user session
      const r = await axios.get('/api/auth/me');
      if (updateUser) updateUser(r.data.user);
      setPendingFile(null);
      flash('Profile updated!');
    } catch(e) {
      flash(e.response?.data?.error || 'Save failed', 'error');
    }
    setSaving(false);
  };

  const handleRemovePhoto = async () => {
    try {
      await axios.delete(`/api/users/${user.id}/avatar`);
      setPreview(null);
      setPendingFile(null);
      const r = await axios.get('/api/auth/me');
      if (updateUser) updateUser(r.data.user);
      flash('Photo removed');
    } catch(e) { flash('Failed to remove photo', 'error'); }
  };

  const handleChangePassword = async () => {
    if (!oldPw || !newPw || !confirmPw) return flash('Please fill in all password fields', 'error');
    if (newPw !== confirmPw) return flash('New passwords do not match', 'error');
    if (newPw.length < 8) return flash('Password must be at least 8 characters', 'error');
    setPwSaving(true);
    try {
      await axios.post('/api/auth/change-password', { currentPassword: oldPw, newPassword: newPw });
      setOldPw(''); setNewPw(''); setConfirmPw('');
      flash('Password changed successfully!');
    } catch(e) { flash(e.response?.data?.error || 'Failed to change password', 'error'); }
    setPwSaving(false);
  };

  const inputStyle = { width:'100%', padding:'10px 12px', borderRadius:8, border:'1.5px solid var(--gray-200)', fontSize:14, fontFamily:'inherit', boxSizing:'border-box' };
  const labelStyle = { fontSize:13, fontWeight:600, color:'var(--gray-600)', display:'block', marginBottom:6 };

  return (
    <div style={{ maxWidth:560 }}>
      <div className="page-header">
        <h1>My Profile</h1>
        <p>Update your name, photo and password.</p>
      </div>

      {msg && (
        <div style={{ padding:'12px 16px', borderRadius:10, marginBottom:20, fontSize:14, fontWeight:500,
          background: msgType==='error' ? '#fef2f2' : '#f0fdf4',
          color: msgType==='error' ? '#dc2626' : '#16a34a',
          border: `1px solid ${msgType==='error' ? '#fecaca' : '#bbf7d0'}` }}>
          {msgType==='error' ? '❌' : '✅'} {msg}
        </div>
      )}

      {/* PHOTO + NAME */}
      <div className="card" style={{ padding:28, marginBottom:20 }}>
        <h3 style={{ fontWeight:700, marginBottom:20 }}>Profile Info</h3>

        {/* Avatar */}
        <div style={{ display:'flex', alignItems:'center', gap:20, marginBottom:24 }}>
          <div style={{ position:'relative', flexShrink:0 }}>
            {preview
              ? <img src={preview} alt="avatar" style={{ width:80, height:80, borderRadius:'50%', objectFit:'cover', border:'3px solid var(--gray-200)' }}/>
              : <div style={{ width:80, height:80, borderRadius:'50%', background:avatarColor(name), display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:700, color:'white', border:'3px solid var(--gray-200)' }}>
                  {name?.trim()?.[0]?.toUpperCase()}
                </div>
            }
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <button onClick={() => fileRef.current.click()} style={{ padding:'8px 16px', borderRadius:8, border:'1.5px solid var(--gray-300)', background:'white', cursor:'pointer', fontSize:13, fontWeight:600 }}>
              📷 {preview ? 'Change Photo' : 'Upload Photo'}
            </button>
            {preview && (
              <button onClick={handleRemovePhoto} style={{ padding:'6px 16px', borderRadius:8, border:'1.5px solid #fecaca', background:'#fef2f2', color:'#dc2626', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                🗑 Remove Photo
              </button>
            )}
            <span style={{ fontSize:11, color:'var(--gray-400)' }}>JPG, PNG or GIF · Max 500KB</span>
            <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleFileChange}/>
          </div>
        </div>

        {/* Name */}
        <div style={{ marginBottom:20 }}>
          <label style={labelStyle}>Full Name</label>
          <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="Your full name"/>
        </div>

        {/* Read-only info */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:24 }}>
          <div>
            <label style={labelStyle}>Email</label>
            <div style={{ ...inputStyle, background:'var(--gray-50)', color:'var(--gray-400)', cursor:'not-allowed' }}>{user?.email}</div>
          </div>
          <div>
            <label style={labelStyle}>Department</label>
            <div style={{ ...inputStyle, background:'var(--gray-50)', color:'var(--gray-400)', cursor:'not-allowed' }}>{user?.department}</div>
          </div>
        </div>

        <button onClick={handleSaveProfile} disabled={saving}
          style={{ padding:'10px 24px', borderRadius:8, background:'var(--red)', color:'white', border:'none', cursor:'pointer', fontWeight:700, fontSize:14, opacity:saving?0.7:1 }}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {/* CHANGE PASSWORD */}
      <div className="card" style={{ padding:28 }}>
        <h3 style={{ fontWeight:700, marginBottom:20 }}>Change Password</h3>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={labelStyle}>Current Password</label>
            <div style={{ position:'relative' }}>
              <input type={showOld?'text':'password'} value={oldPw} onChange={e=>setOldPw(e.target.value)} style={inputStyle} placeholder="Enter current password"/>
              <span onClick={()=>setShowOld(v=>!v)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', cursor:'pointer', fontSize:16 }}>{showOld?'🙈':'👁'}</span>
            </div>
          </div>
          <div>
            <label style={labelStyle}>New Password</label>
            <div style={{ position:'relative' }}>
              <input type={showNew?'text':'password'} value={newPw} onChange={e=>setNewPw(e.target.value)} style={inputStyle} placeholder="At least 8 characters"/>
              <span onClick={()=>setShowNew(v=>!v)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', cursor:'pointer', fontSize:16 }}>{showNew?'🙈':'👁'}</span>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Confirm New Password</label>
            <input type="password" value={confirmPw} onChange={e=>setConfirmPw(e.target.value)} style={inputStyle} placeholder="Repeat new password"/>
          </div>
        </div>
        <button onClick={handleChangePassword} disabled={pwSaving}
          style={{ marginTop:20, padding:'10px 24px', borderRadius:8, background:'#1e293b', color:'white', border:'none', cursor:'pointer', fontWeight:700, fontSize:14, opacity:pwSaving?0.7:1 }}>
          {pwSaving ? 'Updating…' : '🔐 Update Password'}
        </button>
      </div>
    </div>
  );
}

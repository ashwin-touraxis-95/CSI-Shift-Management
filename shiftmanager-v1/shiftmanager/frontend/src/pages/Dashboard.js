import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

export default function Dashboard() {
  const { user } = useAuth();
  const [clockStatus, setClockStatus] = useState(null);
  const [todayShifts, setTodayShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchClockStatus();
    fetchTodayShifts();
  }, []);

  const fetchClockStatus = async () => {
    const res = await axios.get('/api/clock/status');
    setClockStatus(res.data);
  };

  const fetchTodayShifts = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const res = await axios.get(`/api/shifts?start=${today}&end=${today}`);
    setTodayShifts(res.data);
  };

  const handleClock = async (action) => {
    setLoading(true);
    setMessage('');
    try {
      const res = await axios.post(`/api/clock/${action}`);
      setMessage(res.data.message);
      fetchClockStatus();
    } catch (e) {
      setMessage(e.response?.data?.error || 'Error');
    }
    setLoading(false);
  };

  const myShifts = todayShifts.filter(s => s.user_id === user?.id);
  const isClockedIn = clockStatus?.clockedIn;

  const clockInTime = clockStatus?.log?.clock_in
    ? format(new Date(clockStatus.log.clock_in), 'HH:mm')
    : null;

  return (
    <div>
      <div className="page-header">
        <h1>Good {getGreeting()}, {user?.name?.split(' ')[0]} 👋</h1>
        <p>{format(time, "EEEE, d MMMM yyyy")}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 28 }}>
        {/* Clock Card */}
        <div className="card" style={{
          padding: 32, textAlign: 'center', gridColumn: '1',
          border: isClockedIn ? '2px solid var(--green)' : '1px solid var(--gray-200)',
          position: 'relative', overflow: 'hidden'
        }}>
          {isClockedIn && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--green)' }} />
          )}
          <div style={{ fontSize: 48, marginBottom: 4 }}>{isClockedIn ? '🟢' : '⚫'}</div>
          <div style={{ fontSize: 42, fontWeight: 700, fontFamily: 'DM Mono', color: 'var(--gray-900)', marginBottom: 4 }}>
            {format(time, 'HH:mm:ss')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 20 }}>
            {isClockedIn ? `Clocked in since ${clockInTime}` : 'Not clocked in'}
          </div>

          {!isClockedIn ? (
            <button className="btn btn-success" style={{ width: '100%', justifyContent: 'center', fontSize: 16, padding: '14px 24px' }}
              onClick={() => handleClock('in')} disabled={loading}>
              ⏱ Clock In
            </button>
          ) : (
            <button className="btn btn-danger" style={{ width: '100%', justifyContent: 'center', fontSize: 16, padding: '14px 24px' }}
              onClick={() => handleClock('out')} disabled={loading}>
              🔴 Clock Out
            </button>
          )}

          {message && (
            <div style={{ marginTop: 12, fontSize: 13, color: isClockedIn ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
              ✓ {message}
            </div>
          )}
        </div>

        {/* My Shifts Today */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>📅 My Shifts Today</div>
          {myShifts.length === 0 ? (
            <div style={{ color: 'var(--gray-400)', fontSize: 14, textAlign: 'center', paddingTop: 20 }}>
              No shifts scheduled today
            </div>
          ) : (
            myShifts.map(s => (
              <div key={s.id} style={{ padding: '12px 14px', background: 'var(--gray-50)', borderRadius: 8, marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{s.start_time} – {s.end_time}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{s.department}</div>
                {s.notes && <div style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 4 }}>{s.notes}</div>}
              </div>
            ))
          )}
        </div>

        {/* Status card */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>👤 My Status</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Row label="Department" value={user?.department || '—'} />
            <Row label="Role" value={<span style={{ textTransform: 'capitalize' }}>{user?.role}</span>} />
            <Row label="Status" value={
              <span className={`badge badge-${isClockedIn ? 'available' : 'offline'}`}>
                <span className={`status-dot ${isClockedIn ? 'available' : 'offline'}`} />
                {isClockedIn ? 'Available' : 'Offline'}
              </span>
            } />
            {clockInTime && <Row label="Clocked in" value={<span className="mono">{clockInTime}</span>} />}
          </div>
        </div>
      </div>

      {/* All shifts today */}
      {user?.role === 'manager' && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>📋 All Shifts Today ({format(new Date(), 'd MMM')})</div>
          {todayShifts.length === 0 ? (
            <p style={{ color: 'var(--gray-400)', fontSize: 14 }}>No shifts scheduled today.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--gray-200)' }}>
                  {['Agent', 'Department', 'Start', 'End', 'Notes'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {todayShifts.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{s.name}</td>
                    <td style={{ padding: '10px 12px' }}><span className={`badge dept-${s.department.replace(' ', '')}`}>{s.department}</span></td>
                    <td style={{ padding: '10px 12px', fontFamily: 'DM Mono' }}>{s.start_time}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'DM Mono' }}>{s.end_time}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--gray-500)' }}>{s.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

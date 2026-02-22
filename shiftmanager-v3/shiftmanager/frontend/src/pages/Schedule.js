import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay } from 'date-fns';

const DEPT_COLORS = {
  'CS': { bg: '#FFF3CD', color: '#856404', border: '#F0C040' },
  'Sales': { bg: '#E2E3E5', color: '#383D41', border: '#999' },
  'Travel Agents': { bg: '#D1ECF1', color: '#0C5460', border: '#17a2b8' },
  'Trainees': { bg: '#F8D7DA', color: '#721C24', border: '#f5c6cb' },
  'Management': { bg: '#D4EDDA', color: '#155724', border: '#c3e6cb' },
};

export default function Schedule() {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [shifts, setShifts] = useState([]);
  const [users, setUsers] = useState([]);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  useEffect(() => {
    fetchShifts();
    fetchUsers();
  }, [currentWeek]);

  const fetchShifts = async () => {
    const start = format(weekStart, 'yyyy-MM-dd');
    const end = format(weekEnd, 'yyyy-MM-dd');
    const res = await axios.get(`/api/shifts?start=${start}&end=${end}`);
    setShifts(res.data);
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/api/users');
      setUsers(res.data);
    } catch {}
  };

  const getShiftsForDayAndUser = (day, userId) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return shifts.filter(s => s.date === dateStr && s.user_id === userId);
  };

  // Group agents by department
  const agents = users.filter(u => u.role === 'agent');
  const deptGroups = {};
  agents.forEach(a => {
    if (!deptGroups[a.department]) deptGroups[a.department] = [];
    deptGroups[a.department].push(a);
  });

  const weekNum = format(weekStart, 'ww');
  const isToday = (day) => isSameDay(day, new Date());

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Week Schedule</h1>
          <p>Week {weekNum} · {format(weekStart, 'd MMM')} – {format(weekEnd, 'd MMM yyyy')}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>← Prev</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setCurrentWeek(new Date())}>Today</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>Next →</button>
        </div>
      </div>

      <div className="card" style={{ overflow: 'auto' }}>
        {/* Header */}
        <div style={{
          background: 'var(--red)', color: 'white',
          padding: '12px 16px', fontWeight: 700, fontSize: 16, letterSpacing: 0.5,
          textAlign: 'center'
        }}>
          🇿🇦 South Africa — Week {weekNum}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 900 }}>
          <thead>
            <tr style={{ background: '#1e3a5f', color: 'white' }}>
              <th style={{ padding: '10px 16px', textAlign: 'left', width: 160 }}>Agent</th>
              {days.slice(0,5).map(day => (
                <th key={day} style={{
                  padding: '10px 12px', textAlign: 'center', fontWeight: 600,
                  background: isToday(day) ? 'var(--red)' : '#1e3a5f'
                }}>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>{format(day, 'EEE')}</div>
                  <div>{format(day, 'd MMM')}</div>
                </th>
              ))}
              {days.slice(5).map(day => (
                <th key={day} style={{
                  padding: '10px 12px', textAlign: 'center', fontWeight: 600,
                  background: isToday(day) ? 'var(--red)' : '#2d5016'
                }}>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>{format(day, 'EEE')}</div>
                  <div>{format(day, 'd MMM')}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(deptGroups).map(([dept, deptAgents]) => (
              <React.Fragment key={dept}>
                {/* Dept header */}
                <tr>
                  <td colSpan={8} style={{
                    background: DEPT_COLORS[dept]?.bg || '#f0f0f0',
                    color: DEPT_COLORS[dept]?.color || '#333',
                    padding: '6px 16px', fontWeight: 700, fontSize: 12,
                    borderTop: `2px solid ${DEPT_COLORS[dept]?.border || '#ccc'}`,
                    letterSpacing: 0.5, textTransform: 'uppercase'
                  }}>
                    {dept}
                  </td>
                </tr>
                {deptAgents.map((agent, idx) => (
                  <tr key={agent.id} style={{ background: idx % 2 === 0 ? 'white' : 'var(--gray-50)', borderBottom: '1px solid var(--gray-100)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {agent.avatar
                          ? <img src={agent.avatar} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                          : <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--red)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                              {agent.name[0]}
                            </div>
                        }
                        {agent.name}
                      </div>
                    </td>
                    {days.map(day => {
                      const dayShifts = getShiftsForDayAndUser(day, agent.id);
                      return (
                        <td key={day} style={{
                          padding: '6px 8px', verticalAlign: 'top', minHeight: 60,
                          background: isToday(day) ? 'rgba(192,57,43,0.04)' : 'transparent'
                        }}>
                          {dayShifts.map(s => (
                            <div key={s.id} style={{
                              background: DEPT_COLORS[s.department]?.bg || '#f0f0f0',
                              color: DEPT_COLORS[s.department]?.color || '#333',
                              borderLeft: `3px solid ${DEPT_COLORS[s.department]?.border || '#ccc'}`,
                              borderRadius: 4, padding: '4px 8px', marginBottom: 4, fontSize: 11
                            }}>
                              <div style={{ fontWeight: 700 }}>{s.start_time} – {s.end_time}</div>
                              {s.notes && <div style={{ opacity: 0.8 }}>{s.notes}</div>}
                            </div>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
            {Object.keys(deptGroups).length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>
                  No agents yet. Add agents via Team Management and assign shifts.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Legend */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--gray-200)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {Object.entries(DEPT_COLORS).map(([dept, colors]) => (
            <div key={dept} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: colors.bg, border: `1.5px solid ${colors.border}` }} />
              <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>{dept}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

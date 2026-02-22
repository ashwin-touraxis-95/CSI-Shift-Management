import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { format } from 'date-fns';

const socket = io('http://localhost:5000');
const DEPARTMENTS = ['All', 'CS', 'Sales', 'Travel Agents', 'Trainees'];

export default function Availability() {
  const [agents, setAgents] = useState([]);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  const fetchAvailability = async () => {
    const res = await axios.get('/api/availability');
    setAgents(res.data);
  };

  useEffect(() => {
    fetchAvailability();
    socket.on('availability_update', fetchAvailability);
    const interval = setInterval(fetchAvailability, 30000);
    return () => {
      socket.off('availability_update', fetchAvailability);
      clearInterval(interval);
    };
  }, []);

  const filtered = agents.filter(a => {
    const deptMatch = filter === 'All' || a.department === filter;
    const searchMatch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.email.toLowerCase().includes(search.toLowerCase());
    return deptMatch && searchMatch;
  });

  const available = filtered.filter(a => a.status === 'available').length;
  const offline = filtered.filter(a => a.status !== 'available').length;

  return (
    <div>
      <div className="page-header">
        <h1>Live Availability</h1>
        <p>Real-time status of all agents — updates automatically</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <StatPill color="var(--green)" label="Available" count={available} />
        <StatPill color="var(--gray-400)" label="Offline" count={offline} />
        <StatPill color="#3b82f6" label="Total" count={filtered.length} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
        <input
          placeholder="Search agents..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 240 }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          {DEPARTMENTS.map(d => (
            <button key={d}
              onClick={() => setFilter(d)}
              className="btn btn-sm"
              style={{
                background: filter === d ? 'var(--red)' : 'white',
                color: filter === d ? 'white' : 'var(--gray-700)',
                border: `1.5px solid ${filter === d ? 'var(--red)' : 'var(--gray-300)'}`,
              }}>
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {filtered.map(agent => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, color: 'var(--gray-400)' }}>
            No agents match your filters
          </div>
        )}
      </div>
    </div>
  );
}

function AgentCard({ agent }) {
  const isAvailable = agent.status === 'available';
  const clockedInAt = agent.clocked_in_at ? format(new Date(agent.clocked_in_at), 'HH:mm') : null;

  return (
    <div className="card" style={{
      padding: 20,
      borderLeft: `4px solid ${isAvailable ? 'var(--green)' : 'var(--gray-300)'}`,
      transition: 'all 0.2s'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        {agent.avatar
          ? <img src={agent.avatar} alt="" style={{ width: 44, height: 44, borderRadius: '50%', border: `2px solid ${isAvailable ? 'var(--green)' : 'var(--gray-300)'}` }} />
          : <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: isAvailable ? 'var(--green)' : 'var(--gray-300)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 18, color: 'white'
            }}>{agent.name?.[0]}</div>
        }
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{agent.name}</div>
          <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{agent.department}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className={`badge badge-${isAvailable ? 'available' : 'offline'}`}>
          <span className={`status-dot ${isAvailable ? 'available' : 'offline'}`} />
          {isAvailable ? 'Available' : 'Offline'}
        </span>
        {clockedInAt && isAvailable && (
          <span style={{ fontSize: 11, color: 'var(--gray-400)', fontFamily: 'DM Mono' }}>
            since {clockedInAt}
          </span>
        )}
      </div>
    </div>
  );
}

function StatPill({ color, label, count }) {
  return (
    <div style={{
      background: 'white', border: '1px solid var(--gray-200)', borderRadius: 10,
      padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10
    }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
      <span style={{ fontSize: 13, color: 'var(--gray-600)' }}>{label}</span>
      <span style={{ fontWeight: 700, fontSize: 20 }}>{count}</span>
    </div>
  );
}

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const session = require('express-session');
const { OAuth2Client } = require('google-auth-library');
const { v4: uuidv4 } = require('uuid');
const { initDb, run, get, all } = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: 'http://localhost:3000', credentials: true } });
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID';
const oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID);

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'shiftmanager-secret-2024',
  resave: false, saveUninitialized: false,
  cookie: { secure: false, maxAge: 24*60*60*1000 }
}));

// ── HELPERS ─────────────────────────────────────────────────────────────────
function getPermissions(role) {
  if (role === 'account_admin') return null; // admin bypasses all checks
  const row = get('SELECT permissions FROM role_permissions WHERE role=?', [role]);
  if (!row) return {};
  try { return JSON.parse(row.permissions); } catch { return {}; }
}

function getUser(id) { return get('SELECT * FROM users WHERE id=?', [id]); }

// ── MIDDLEWARE ───────────────────────────────────────────────────────────────
const requireAuth = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const user = getUser(req.session.userId);
  if (!user || !user.active) return res.status(401).json({ error: 'Account inactive' });
  req.user = user;
  req.perms = getPermissions(user.role);
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const user = getUser(req.session.userId);
  if (!user || user.role !== 'account_admin') return res.status(403).json({ error: 'Account Admin only' });
  req.user = user; next();
};

const requirePerm = (perm) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.user.role === 'account_admin') return next(); // admin always allowed
  if (!req.perms?.[perm]) return res.status(403).json({ error: `Permission denied: ${perm}` });
  next();
};

// ── AUTH ─────────────────────────────────────────────────────────────────────
app.post('/api/auth/google', async (req, res) => {
  try {
    const ticket = await oauthClient.verifyIdToken({ idToken: req.body.credential, audience: GOOGLE_CLIENT_ID });
    const { email, name, picture } = ticket.getPayload();
    let user = get('SELECT * FROM users WHERE email=?', [email]);
    if (!user) {
      const id = uuidv4();
      run("INSERT INTO users(id,email,name,avatar,role,active) VALUES(?,?,?,?,'agent',1)", [id, email, name, picture]);
      user = getUser(id);
    } else {
      run('UPDATE users SET name=?,avatar=? WHERE id=?', [name, picture, user.id]);
      user = getUser(user.id);
    }
    if (!user.active) return res.status(403).json({ error: 'Account deactivated' });
    run("INSERT OR IGNORE INTO availability(user_id,status) VALUES(?,'offline')", [user.id]);
    req.session.userId = user.id;
    res.json({ user, permissions: getPermissions(user.role) });
  } catch(e) { res.status(401).json({ error: 'Invalid token' }); }
});

app.post('/api/auth/demo', (req, res) => {
  const { email } = req.body;
  let user = get('SELECT * FROM users WHERE email=?', [email]);
  if (!user) {
    const id = uuidv4();
    run("INSERT INTO users(id,email,name,role,department,active) VALUES(?,?,?,'agent','CS',1)", [id, email, email.split('@')[0]]);
    run("INSERT OR IGNORE INTO availability(user_id,status) VALUES(?,'offline')", [id]);
    user = getUser(id);
  }
  if (!user.active) return res.status(403).json({ error: 'Account has been deactivated. Contact your administrator.' });
  run("INSERT OR IGNORE INTO availability(user_id,status) VALUES(?,'offline')", [user.id]);
  req.session.userId = user.id;
  res.json({ user, permissions: getPermissions(user.role) });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  const { userId } = req.session;
  const today = new Date().toISOString().split('T')[0];
  const open = get("SELECT * FROM clock_logs WHERE user_id=? AND date=? AND clock_out IS NULL", [userId, today]);
  if (open) run("UPDATE clock_logs SET clock_out=datetime('now') WHERE id=?", [open.id]);
  run("UPDATE availability SET status='offline',last_updated=datetime('now') WHERE user_id=?", [userId]);
  io.emit('availability_update');
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null, permissions: null });
  const user = getUser(req.session.userId);
  res.json({ user, permissions: getPermissions(user?.role) });
});

// ── CLOCK ─────────────────────────────────────────────────────────────────────
app.post('/api/clock/in', requireAuth, (req, res) => {
  const { userId } = req.session;
  const today = new Date().toISOString().split('T')[0];
  if (get("SELECT id FROM clock_logs WHERE user_id=? AND date=? AND clock_out IS NULL", [userId, today]))
    return res.status(400).json({ error: 'Already clocked in' });
  run("INSERT INTO clock_logs(id,user_id,clock_in,date,ip_address) VALUES(?,?,datetime('now'),?,?)", [uuidv4(), userId, today, req.ip]);
  run("UPDATE availability SET status='available',clocked_in_at=datetime('now'),last_updated=datetime('now') WHERE user_id=?", [userId]);
  io.emit('availability_update');
  res.json({ ok: true, message: 'Clocked in successfully' });
});

app.post('/api/clock/out', requireAuth, (req, res) => {
  const { userId } = req.session;
  const today = new Date().toISOString().split('T')[0];
  const open = get("SELECT id FROM clock_logs WHERE user_id=? AND date=? AND clock_out IS NULL", [userId, today]);
  if (!open) return res.status(400).json({ error: 'Not clocked in' });
  run("UPDATE clock_logs SET clock_out=datetime('now') WHERE id=?", [open.id]);
  run("UPDATE availability SET status='offline',last_updated=datetime('now') WHERE user_id=?", [userId]);
  io.emit('availability_update');
  res.json({ ok: true, message: 'Clocked out successfully' });
});

app.get('/api/clock/status', requireAuth, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const log = get("SELECT * FROM clock_logs WHERE user_id=? AND date=? AND clock_out IS NULL", [req.session.userId, today]);
  res.json({ clockedIn: !!log, log });
});

// ── AVAILABILITY ──────────────────────────────────────────────────────────────
app.get('/api/availability', requireAuth, (req, res) => {
  res.json(all(`SELECT u.id,u.name,u.email,u.avatar,u.department,u.role,a.status,a.clocked_in_at,a.last_updated
    FROM users u LEFT JOIN availability a ON u.id=a.user_id
    WHERE u.role NOT IN ('account_admin') AND u.active=1 ORDER BY u.department,u.name`));
});

// ── SHIFTS ────────────────────────────────────────────────────────────────────
app.get('/api/shifts', requireAuth, (req, res) => {
  const { start, end, user_id } = req.query;
  const u = req.user;
  let query = `SELECT s.*,u.name,u.email,u.department FROM shifts s JOIN users u ON s.user_id=u.id WHERE 1=1`;
  const params = [];
  if (u.role === 'agent') { query += ` AND s.user_id=? AND s.status='published'`; params.push(u.id); }
  else if (u.role === 'team_leader') {
    const myAgents = all('SELECT agent_id FROM team_leader_agents WHERE leader_id=?', [u.id]).map(r => r.agent_id);
    if (myAgents.length) { query += ` AND s.user_id IN (${myAgents.map(()=>'?').join(',')}) AND s.status='published'`; params.push(...myAgents); }
    else { query += ` AND 1=0`; }
  }
  if (user_id && u.role !== 'agent') { query += ` AND s.user_id=?`; params.push(user_id); }
  if (start && end) { query += ` AND s.date>=? AND s.date<=?`; params.push(start, end); }
  if (u.role === 'account_admin' || u.role === 'manager') {
    // show drafts to admins/managers — filter by status if requested
    if (req.query.status) { query += ` AND s.status=?`; params.push(req.query.status); }
  }
  query += ` ORDER BY s.date,s.start_time`;
  res.json(all(query, params));
});

app.post('/api/shifts', requireAuth, requirePerm('manage_shifts'), (req, res) => {
  const { user_id, date, start_time, end_time, department, notes, status='published' } = req.body;
  const canPublish = req.user.role === 'account_admin' || req.perms?.publish_shifts;
  const finalStatus = canPublish ? status : 'draft';
  const id = uuidv4();
  run('INSERT INTO shifts(id,user_id,date,start_time,end_time,department,notes,status,created_by) VALUES(?,?,?,?,?,?,?,?,?)',
    [id, user_id, date, start_time, end_time, department, notes, finalStatus, req.session.userId]);
  res.json({ id, ok: true });
});

app.post('/api/shifts/bulk', requireAuth, requirePerm('manage_shifts'), (req, res) => {
  const { user_ids, dates, start_time, end_time, department, notes, status='published' } = req.body;
  const canPublish = req.user.role === 'account_admin' || req.perms?.publish_shifts;
  const finalStatus = canPublish ? status : 'draft';
  let count = 0;
  for (const user_id of user_ids) {
    for (const date of dates) {
      run('INSERT INTO shifts(id,user_id,date,start_time,end_time,department,notes,status,created_by) VALUES(?,?,?,?,?,?,?,?,?)',
        [uuidv4(), user_id, date, start_time, end_time, department, notes, finalStatus, req.session.userId]);
      count++;
    }
  }
  res.json({ ok: true, created: count });
});

app.post('/api/shifts/publish', requireAuth, requirePerm('publish_shifts'), (req, res) => {
  for (const id of req.body.shift_ids) run("UPDATE shifts SET status='published' WHERE id=?", [id]);
  io.emit('shifts_updated');
  res.json({ ok: true });
});

app.post('/api/shifts/publish-all', requireAuth, requirePerm('publish_shifts'), (req, res) => {
  run("UPDATE shifts SET status='published' WHERE status='draft'");
  io.emit('shifts_updated');
  res.json({ ok: true });
});

app.put('/api/shifts/:id', requireAuth, requirePerm('manage_shifts'), (req, res) => {
  const { date, start_time, end_time, department, notes, status } = req.body;
  const shift = get('SELECT * FROM shifts WHERE id=?', [req.params.id]);
  if (!shift) return res.status(404).json({ error: 'Not found' });
  const canPublish = req.user.role === 'account_admin' || req.perms?.publish_shifts;
  const finalStatus = canPublish ? (status || shift.status) : shift.status;
  run('UPDATE shifts SET date=?,start_time=?,end_time=?,department=?,notes=?,status=? WHERE id=?',
    [date, start_time, end_time, department, notes, finalStatus, req.params.id]);
  res.json({ ok: true });
});

app.delete('/api/shifts/:id', requireAuth, requirePerm('manage_shifts'), (req, res) => {
  run('DELETE FROM shifts WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ── TEMPLATES ─────────────────────────────────────────────────────────────────
app.get('/api/templates', requireAuth, requirePerm('manage_shifts'), (req, res) => {
  res.json(all('SELECT * FROM shift_templates ORDER BY name'));
});
app.post('/api/templates', requireAuth, requirePerm('manage_shifts'), (req, res) => {
  const { name, start_time, end_time, department, notes } = req.body;
  const id = uuidv4();
  run('INSERT INTO shift_templates(id,name,start_time,end_time,department,notes,created_by) VALUES(?,?,?,?,?,?,?)',
    [id, name, start_time, end_time, department, notes, req.session.userId]);
  res.json({ id, ok: true });
});
app.delete('/api/templates/:id', requireAuth, requirePerm('manage_shifts'), (req, res) => {
  run('DELETE FROM shift_templates WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ── USERS ─────────────────────────────────────────────────────────────────────
app.get('/api/users', requireAuth, (req, res) => {
  const u = req.user;
  if (u.role === 'account_admin' || u.perms?.manage_users || u.role === 'manager') {
    return res.json(all('SELECT id,email,name,avatar,role,department,active FROM users WHERE role != "account_admin" ORDER BY role,name'));
  }
  if (u.role === 'team_leader') {
    const agentIds = all('SELECT agent_id FROM team_leader_agents WHERE leader_id=?', [u.id]).map(r => r.agent_id);
    if (!agentIds.length) return res.json([]);
    return res.json(all(`SELECT id,email,name,avatar,role,department,active FROM users WHERE id IN (${agentIds.map(()=>'?').join(',')})`, agentIds));
  }
  res.json([]);
});

app.post('/api/users', requireAuth, (req, res) => {
  const u = req.user;
  if (u.role !== 'account_admin' && !u.perms?.manage_users && u.role !== 'manager')
    return res.status(403).json({ error: 'Permission denied' });
  const { email, name, role, department } = req.body;
  if (!email || !name) return res.status(400).json({ error: 'Email and name required' });
  if (get('SELECT id FROM users WHERE email=?', [email])) return res.status(400).json({ error: 'Email already exists' });
  // Prevent creating account_admin via API
  if (role === 'account_admin') return res.status(403).json({ error: 'Cannot create admin via this form' });
  const id = uuidv4();
  run('INSERT INTO users(id,email,name,role,department,active) VALUES(?,?,?,?,?,1)', [id, email, name, role||'agent', department||'CS']);
  run("INSERT OR IGNORE INTO availability(user_id,status) VALUES(?,'offline')", [id]);
  res.json({ id, ok: true });
});

app.put('/api/users/:id', requireAuth, (req, res) => {
  const u = req.user;
  if (u.role !== 'account_admin' && !u.perms?.manage_users && u.role !== 'manager')
    return res.status(403).json({ error: 'Permission denied' });
  const target = get('SELECT * FROM users WHERE id=?', [req.params.id]);
  if (!target) return res.status(404).json({ error: 'Not found' });
  if (target.role === 'account_admin') return res.status(403).json({ error: 'Cannot modify account admin' });
  // Only account_admin can set/change role to manager
  const { role, department, name, active } = req.body;
  const finalRole = (u.role === 'account_admin') ? (role ?? target.role) : (role === 'account_admin' ? target.role : (role ?? target.role));
  run('UPDATE users SET role=?,department=?,name=?,active=? WHERE id=?',
    [finalRole, department??target.department, name??target.name, active??target.active, req.params.id]);
  res.json({ ok: true });
});

app.delete('/api/users/:id', requireAuth, (req, res) => {
  const u = req.user;
  if (u.role !== 'account_admin' && !u.perms?.manage_users && u.role !== 'manager')
    return res.status(403).json({ error: 'Permission denied' });
  const target = get('SELECT * FROM users WHERE id=?', [req.params.id]);
  if (target?.role === 'account_admin') return res.status(403).json({ error: 'Cannot deactivate account admin' });
  run('UPDATE users SET active=0 WHERE id=?', [req.params.id]);
  run("UPDATE availability SET status='offline' WHERE user_id=?", [req.params.id]);
  io.emit('availability_update');
  res.json({ ok: true });
});

app.post('/api/users/:id/activate', requireAuth, (req, res) => {
  const u = req.user;
  if (u.role !== 'account_admin' && !u.perms?.manage_users && u.role !== 'manager')
    return res.status(403).json({ error: 'Permission denied' });
  run('UPDATE users SET active=1 WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ── TEAM LEADER ASSIGNMENTS ───────────────────────────────────────────────────
app.get('/api/team-leader-assignments', requireAuth, (req, res) => {
  const leaders = all("SELECT id,name,department FROM users WHERE role='team_leader' AND active=1 ORDER BY name");
  const result = leaders.map(l => ({
    ...l,
    agents: all(`SELECT u.id,u.name,u.department FROM users u
      JOIN team_leader_agents tla ON u.id=tla.agent_id
      WHERE tla.leader_id=? AND u.active=1`, [l.id])
  }));
  res.json(result);
});

app.post('/api/team-leader-assignments', requireAdmin, (req, res) => {
  const { leader_id, agent_id } = req.body;
  try { run('INSERT OR IGNORE INTO team_leader_agents(leader_id,agent_id) VALUES(?,?)', [leader_id, agent_id]); }
  catch(e) {}
  res.json({ ok: true });
});

app.delete('/api/team-leader-assignments', requireAdmin, (req, res) => {
  const { leader_id, agent_id } = req.body;
  run('DELETE FROM team_leader_agents WHERE leader_id=? AND agent_id=?', [leader_id, agent_id]);
  res.json({ ok: true });
});

// ── LOGS ──────────────────────────────────────────────────────────────────────
app.get('/api/logs', requireAuth, requirePerm('view_clock_logs'), (req, res) => {
  const { date, user_id } = req.query;
  let query = `SELECT cl.*,u.name,u.email,u.department FROM clock_logs cl JOIN users u ON cl.user_id=u.id WHERE 1=1`;
  const params = [];
  if (req.user.role === 'team_leader' && req.perms?.view_own_logs_only) {
    const agentIds = all('SELECT agent_id FROM team_leader_agents WHERE leader_id=?', [req.user.id]).map(r => r.agent_id);
    if (agentIds.length) { query += ` AND cl.user_id IN (${agentIds.map(()=>'?').join(',')}) `; params.push(...agentIds); }
    else { query += ` AND 1=0`; }
  }
  if (date) { query += ` AND cl.date=?`; params.push(date); }
  if (user_id) { query += ` AND cl.user_id=?`; params.push(user_id); }
  query += ` ORDER BY cl.date DESC,cl.clock_in DESC`;
  res.json(all(query, params));
});

// ── PERMISSIONS (account admin only) ─────────────────────────────────────────
app.get('/api/permissions', requireAdmin, (req, res) => {
  const rows = all('SELECT role,permissions FROM role_permissions');
  const result = {};
  rows.forEach(r => { try { result[r.role] = JSON.parse(r.permissions); } catch { result[r.role] = {}; } });
  res.json(result);
});

app.put('/api/permissions/:role', requireAdmin, (req, res) => {
  const { role } = req.params;
  if (role === 'account_admin') return res.status(403).json({ error: 'Cannot modify admin permissions' });
  const existing = get('SELECT role FROM role_permissions WHERE role=?', [role]);
  if (existing) run('UPDATE role_permissions SET permissions=? WHERE role=?', [JSON.stringify(req.body), role]);
  else run('INSERT INTO role_permissions(role,permissions) VALUES(?,?)', [role, JSON.stringify(req.body)]);
  res.json({ ok: true });
});

// ── SETTINGS ──────────────────────────────────────────────────────────────────
app.get('/api/settings', requireAuth, (req, res) => {
  const rows = all('SELECT key,value FROM settings');
  const s = {}; rows.forEach(r => { try { s[r.key] = JSON.parse(r.value); } catch { s[r.key] = r.value; } });
  res.json(s);
});
app.put('/api/settings', requireAdmin, (req, res) => {
  for (const [k,v] of Object.entries(req.body)) {
    if (get('SELECT key FROM settings WHERE key=?',[k])) run('UPDATE settings SET value=? WHERE key=?',[JSON.stringify(v),k]);
    else run('INSERT INTO settings(key,value) VALUES(?,?)',[k,JSON.stringify(v)]);
  }
  io.emit('settings_update');
  res.json({ ok: true });
});

app.get('/api/settings/departments', requireAuth, (req, res) => {
  res.json(all('SELECT * FROM departments WHERE active=1 ORDER BY name'));
});
app.post('/api/settings/departments', requireAdmin, (req, res) => {
  const { name, color, bg_color } = req.body;
  run('INSERT INTO departments(id,name,color,bg_color) VALUES(?,?,?,?)', [uuidv4(), name, color||'#333', bg_color||'#f0f0f0']);
  res.json({ ok: true });
});
app.put('/api/settings/departments/:id', requireAdmin, (req, res) => {
  const { name, color, bg_color } = req.body;
  run('UPDATE departments SET name=?,color=?,bg_color=? WHERE id=?', [name, color, bg_color, req.params.id]);
  io.emit('settings_update');
  res.json({ ok: true });
});
app.delete('/api/settings/departments/:id', requireAdmin, (req, res) => {
  run('UPDATE departments SET active=0 WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ── SOCKET ─────────────────────────────────────────────────────────────────────
io.on('connection', socket => {
  socket.on('request_availability', () => socket.emit('availability_update'));
});

// ── START ──────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
initDb().then(() => server.listen(PORT, () => console.log(`✅ ShiftManager backend running on http://localhost:${PORT}`)));

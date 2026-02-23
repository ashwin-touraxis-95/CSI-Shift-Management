const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { initDb, run, get, all } = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: 'http://localhost:3000', credentials: true } });
const SALT_ROUNDS = 12;

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'shiftmanager-secret-2024',
  resave: false, saveUninitialized: false,
  cookie: { secure: false, maxAge: 24*60*60*1000 }
}));

// ── HELPERS ──────────────────────────────────────────────────────────────────
function getPermissions(userType) {
  if (userType === 'account_admin') return null;
  const row = get('SELECT permissions FROM role_permissions WHERE role=?', [userType]);
  if (!row) return {};
  try { return JSON.parse(row.permissions); } catch { return {}; }
}
function getUser(id) { return get('SELECT * FROM users WHERE id=?', [id]); }
function getTheme() {
  const rows = all('SELECT key,value FROM theme');
  const t = {}; rows.forEach(r => { try { t[r.key] = JSON.parse(r.value); } catch { t[r.key] = r.value; } });
  return t;
}
function auditLog(action, performedBy, target, details='') {
  const performer = getUser(performedBy);
  run('INSERT INTO audit_log(id,action,performed_by,performed_by_name,target_user_id,target_user_email,target_user_name,target_user_role,target_user_department,details) VALUES(?,?,?,?,?,?,?,?,?,?)',
    [uuidv4(),action,performedBy,performer?.name,target?.id,target?.email,target?.name,target?.user_type,target?.department,details]);
}
function generateTempPassword() {
  const words = ['Shift','Tour','Axis','Team','Lead','Star','Wave','Bolt'];
  const w = words[Math.floor(Math.random()*words.length)];
  const n = Math.floor(1000+Math.random()*9000);
  const s = ['!','@','#','$','%'][Math.floor(Math.random()*5)];
  return `${w}${n}${s}`;
}
function safeUser(u) {
  if (!u) return null;
  const { password_hash, ...safe } = u;
  return safe;
}

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────
const requireAuth = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const user = getUser(req.session.userId);
  if (!user || !user.active) return res.status(401).json({ error: 'Your account has been deactivated.' });
  req.user = user;
  req.perms = getPermissions(user.user_type);
  next();
};
const requireAdmin = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const user = getUser(req.session.userId);
  if (!user || user.user_type !== 'account_admin') return res.status(403).json({ error: 'Account Admin only' });
  req.user = user; next();
};
const requirePerm = (perm) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.user.user_type === 'account_admin') return next();
  if (!req.perms?.[perm]) return res.status(403).json({ error: `Permission denied: ${perm}` });
  next();
};
const canManageUsers = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (['account_admin','manager','team_leader'].includes(req.user.user_type)) return next();
  return res.status(403).json({ error: 'Permission denied' });
};

// ── AUTH ──────────────────────────────────────────────────────────────────────

// Check if a user has a password set (for first-time setup detection)
app.post('/api/auth/check-email', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  const user = get('SELECT id, email, name, user_type, active, password_hash FROM users WHERE email=?', [email.trim().toLowerCase()]);
  if (!user) return res.json({ exists: false });
  if (!user.active) return res.status(403).json({ error: 'Your account has been deactivated. Please contact your administrator.' });
  res.json({ exists: true, hasPassword: !!user.password_hash, name: user.name });
});

// Login with email + password
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const user = get('SELECT * FROM users WHERE email=?', [email.trim().toLowerCase()]);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });
  if (!user.active) return res.status(403).json({ error: 'Your account has been deactivated. Please contact your administrator.' });
  if (!user.password_hash) return res.status(401).json({ error: 'No password set. Please use the setup link on the login page.' });
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ error: 'Invalid email or password' });
  run("INSERT OR IGNORE INTO availability(user_id,status) VALUES(?,'offline')", [user.id]);
  req.session.userId = user.id;
  res.json({ user: safeUser(user), permissions: getPermissions(user.user_type), theme: getTheme(), forcePasswordChange: !!user.force_password_change });
});

// First-time password setup (no auth required — for accounts with no password yet)
app.post('/api/auth/setup-password', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  const user = get('SELECT * FROM users WHERE email=?', [email.trim().toLowerCase()]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.password_hash) return res.status(403).json({ error: 'Password already set. Please use the login page.' });
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  run('UPDATE users SET password_hash=?, force_password_change=0 WHERE id=?', [hash, user.id]);
  run("INSERT OR IGNORE INTO availability(user_id,status) VALUES(?,'offline')", [user.id]);
  req.session.userId = user.id;
  res.json({ user: safeUser(getUser(user.id)), permissions: getPermissions(user.user_type), theme: getTheme() });
});

// Change password (must be logged in, or forced change with temp password)
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!new_password || new_password.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  const user = getUser(req.user.id);
  // If force_password_change, skip current password check
  if (!user.force_password_change) {
    if (!current_password) return res.status(400).json({ error: 'Current password required' });
    const match = await bcrypt.compare(current_password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });
  }
  const hash = await bcrypt.hash(new_password, SALT_ROUNDS);
  run('UPDATE users SET password_hash=?, force_password_change=0 WHERE id=?', [hash, req.user.id]);
  res.json({ ok: true, user: safeUser(getUser(req.user.id)) });
});

// Admin reset password — generates temp, shows it once
app.post('/api/users/:id/reset-password', requireAuth, canManageUsers, async (req, res) => {
  const target = get('SELECT * FROM users WHERE id=?', [req.params.id]);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.user_type === 'account_admin' && req.user.user_type !== 'account_admin')
    return res.status(403).json({ error: 'Cannot reset admin password' });
  const temp = generateTempPassword();
  const hash = await bcrypt.hash(temp, SALT_ROUNDS);
  run('UPDATE users SET password_hash=?, force_password_change=1 WHERE id=?', [hash, req.params.id]);
  auditLog('password_reset', req.user.id, target, `Temporary password issued by ${req.user.name}`);
  res.json({ ok: true, temp_password: temp });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  const { userId } = req.session;
  const today = new Date().toISOString().split('T')[0];
  const open = get("SELECT id FROM clock_logs WHERE user_id=? AND date=? AND clock_out IS NULL", [userId, today]);
  if (open) run("UPDATE clock_logs SET clock_out=datetime('now') WHERE id=?", [open.id]);
  run("UPDATE availability SET status='offline',last_updated=datetime('now') WHERE user_id=?", [userId]);
  io.emit('availability_update');
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null, permissions: null, theme: getTheme() });
  const user = getUser(req.session.userId);
  if (!user) return res.json({ user: null, permissions: null, theme: getTheme() });
  res.json({ user: safeUser(user), permissions: getPermissions(user?.user_type), theme: getTheme(), forcePasswordChange: !!user?.force_password_change });
});

// ── THEME ─────────────────────────────────────────────────────────────────────
app.get('/api/theme', (req, res) => res.json(getTheme()));
app.put('/api/theme', requireAdmin, (req, res) => {
  for (const [k,v] of Object.entries(req.body)) {
    if (get('SELECT key FROM theme WHERE key=?',[k])) run('UPDATE theme SET value=? WHERE key=?',[JSON.stringify(v),k]);
    else run('INSERT INTO theme(key,value) VALUES(?,?)',[k,JSON.stringify(v)]);
  }
  io.emit('theme_update', getTheme());
  res.json({ ok: true });
});

// ── CLOCK ─────────────────────────────────────────────────────────────────────
app.post('/api/clock/in', requireAuth, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  if (get("SELECT id FROM clock_logs WHERE user_id=? AND date=? AND clock_out IS NULL",[req.session.userId,today]))
    return res.status(400).json({ error: 'Already clocked in' });
  run("INSERT INTO clock_logs(id,user_id,clock_in,date,ip_address) VALUES(?,?,datetime('now'),?,?)",[uuidv4(),req.session.userId,today,req.ip]);
  run("UPDATE availability SET status='available',clocked_in_at=datetime('now'),last_updated=datetime('now') WHERE user_id=?",[req.session.userId]);
  io.emit('availability_update');
  res.json({ ok: true, message: 'Clocked in successfully' });
});
app.post('/api/clock/out', requireAuth, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const open = get("SELECT id FROM clock_logs WHERE user_id=? AND date=? AND clock_out IS NULL",[req.session.userId,today]);
  if (!open) return res.status(400).json({ error: 'Not clocked in' });
  run("UPDATE clock_logs SET clock_out=datetime('now') WHERE id=?",[open.id]);
  run("UPDATE availability SET status='offline',last_updated=datetime('now') WHERE user_id=?",[req.session.userId]);
  io.emit('availability_update');
  res.json({ ok: true, message: 'Clocked out successfully' });
});
app.get('/api/clock/status', requireAuth, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const log = get("SELECT * FROM clock_logs WHERE user_id=? AND date=? AND clock_out IS NULL",[req.session.userId,today]);
  res.json({ clockedIn: !!log, log });
});

// ── AVAILABILITY ──────────────────────────────────────────────────────────────
app.get('/api/availability', requireAuth, (req, res) => {
  res.json(all(`SELECT u.id,u.name,u.email,u.avatar,u.department,u.user_type,a.status,a.clocked_in_at,a.last_updated
    FROM users u LEFT JOIN availability a ON u.id=a.user_id
    WHERE u.user_type NOT IN ('account_admin') AND u.active=1 ORDER BY u.department,u.name`));
});

// ── DEPARTMENTS ───────────────────────────────────────────────────────────────
app.get('/api/departments', requireAuth, (req, res) => {
  const depts = all('SELECT * FROM departments WHERE active=1 ORDER BY name');
  res.json(depts.map(d => ({
    ...d,
    managers: all(`SELECT u.id,u.name FROM users u JOIN department_managers dm ON u.id=dm.manager_id WHERE dm.department_id=?`,[d.id]),
    job_roles: all(`SELECT jr.*,(SELECT COUNT(*) FROM agent_job_roles WHERE job_role_id=jr.id) as agent_count FROM job_roles jr WHERE jr.department_id=? AND jr.active=1 ORDER BY jr.name`,[d.id])
  })));
});
app.post('/api/departments', requireAdmin, (req, res) => {
  const { name, color, bg_color } = req.body;
  const id = uuidv4();
  run('INSERT INTO departments(id,name,color,bg_color) VALUES(?,?,?,?)',[id,name,color||'#333',bg_color||'#f0f0f0']);
  res.json({ id, ok: true });
});
app.put('/api/departments/:id', requireAdmin, (req, res) => {
  const { name, color, bg_color } = req.body;
  run('UPDATE departments SET name=?,color=?,bg_color=? WHERE id=?',[name,color,bg_color,req.params.id]);
  res.json({ ok: true });
});
app.delete('/api/departments/:id', requireAdmin, (req, res) => {
  run('UPDATE departments SET active=0 WHERE id=?',[req.params.id]); res.json({ ok: true });
});
app.post('/api/departments/:id/managers', requireAdmin, (req, res) => {
  try { run('INSERT OR IGNORE INTO department_managers(department_id,manager_id) VALUES(?,?)',[req.params.id,req.body.manager_id]); } catch(e) {}
  res.json({ ok: true });
});
app.delete('/api/departments/:id/managers', requireAdmin, (req, res) => {
  run('DELETE FROM department_managers WHERE department_id=? AND manager_id=?',[req.params.id,req.body.manager_id]);
  res.json({ ok: true });
});

// ── JOB ROLES ─────────────────────────────────────────────────────────────────
app.get('/api/job-roles', requireAuth, (req, res) => {
  const { department_id } = req.query;
  let q = `SELECT jr.*,d.name as department_name FROM job_roles jr JOIN departments d ON jr.department_id=d.id WHERE jr.active=1`;
  const p = [];
  if (department_id) { q+=' AND jr.department_id=?'; p.push(department_id); }
  q+=' ORDER BY d.name,jr.name';
  res.json(all(q,p).map(r => ({
    ...r,
    leaders: all(`SELECT u.id,u.name FROM users u JOIN job_role_leaders jrl ON u.id=jrl.leader_id WHERE jrl.job_role_id=?`,[r.id]),
    agents: all(`SELECT u.id,u.name FROM users u JOIN agent_job_roles ajr ON u.id=ajr.agent_id WHERE ajr.job_role_id=? AND u.active=1`,[r.id])
  })));
});
app.post('/api/job-roles', requireAuth, canManageUsers, (req, res) => {
  const { name, department_id, description } = req.body;
  if (!name||!department_id) return res.status(400).json({ error:'Name and department required' });
  const id = uuidv4();
  run('INSERT INTO job_roles(id,name,department_id,description) VALUES(?,?,?,?)',[id,name,department_id,description||'']);
  res.json({ id, ok: true });
});
app.put('/api/job-roles/:id', requireAuth, canManageUsers, (req, res) => {
  run('UPDATE job_roles SET name=?,description=? WHERE id=?',[req.body.name,req.body.description||'',req.params.id]);
  res.json({ ok: true });
});
app.delete('/api/job-roles/:id', requireAuth, canManageUsers, (req, res) => {
  run('UPDATE job_roles SET active=0 WHERE id=?',[req.params.id]); res.json({ ok: true });
});
app.post('/api/job-roles/:id/leaders', requireAuth, canManageUsers, (req, res) => {
  try { run('INSERT OR IGNORE INTO job_role_leaders(job_role_id,leader_id) VALUES(?,?)',[req.params.id,req.body.leader_id]); } catch(e) {}
  res.json({ ok: true });
});
app.delete('/api/job-roles/:id/leaders', requireAuth, canManageUsers, (req, res) => {
  run('DELETE FROM job_role_leaders WHERE job_role_id=? AND leader_id=?',[req.params.id,req.body.leader_id]);
  res.json({ ok: true });
});
app.post('/api/job-roles/:id/agents', requireAuth, canManageUsers, (req, res) => {
  const { agent_id } = req.body;
  try { run('INSERT OR IGNORE INTO agent_job_roles(agent_id,job_role_id) VALUES(?,?)',[agent_id,req.params.id]); } catch(e) {}
  const leaders = all('SELECT leader_id FROM job_role_leaders WHERE job_role_id=?',[req.params.id]);
  for (const l of leaders) { try { run('INSERT OR IGNORE INTO team_leader_agents(leader_id,agent_id) VALUES(?,?)',[l.leader_id,agent_id]); } catch(e) {} }
  res.json({ ok: true });
});
app.delete('/api/job-roles/:id/agents', requireAuth, canManageUsers, (req, res) => {
  run('DELETE FROM agent_job_roles WHERE agent_id=? AND job_role_id=?',[req.body.agent_id,req.params.id]);
  res.json({ ok: true });
});

// Onboarding complete
app.post('/api/onboarding/complete', requireAuth, (req, res) => {
  const { job_role_ids } = req.body;
  if (!job_role_ids?.length) return res.status(400).json({ error:'Select at least one job role' });
  for (const jrId of job_role_ids) {
    try { run('INSERT OR IGNORE INTO agent_job_roles(agent_id,job_role_id) VALUES(?,?)',[req.user.id,jrId]); } catch(e) {}
    const leaders = all('SELECT leader_id FROM job_role_leaders WHERE job_role_id=?',[jrId]);
    for (const l of leaders) { try { run('INSERT OR IGNORE INTO team_leader_agents(leader_id,agent_id) VALUES(?,?)',[l.leader_id,req.user.id]); } catch(e) {} }
  }
  run('UPDATE users SET onboarded=1 WHERE id=?',[req.user.id]);
  res.json({ ok: true, user: safeUser(getUser(req.user.id)) });
});

// ── SHIFTS ────────────────────────────────────────────────────────────────────
app.get('/api/shifts', requireAuth, (req, res) => {
  const { start, end, user_id } = req.query;
  const u = req.user;
  let q = `SELECT s.*,u.name,u.email,u.department FROM shifts s JOIN users u ON s.user_id=u.id WHERE 1=1`;
  const p = [];
  if (u.user_type==='agent') { q+=` AND s.user_id=? AND s.status='published'`; p.push(u.id); }
  else if (u.user_type==='team_leader') {
    const ids = all('SELECT agent_id FROM team_leader_agents WHERE leader_id=?',[u.id]).map(r=>r.agent_id);
    if (ids.length) { q+=` AND s.user_id IN (${ids.map(()=>'?').join(',')}) AND s.status='published'`; p.push(...ids); }
    else q+=` AND 1=0`;
  }
  if (user_id && u.user_type!=='agent') { q+=` AND s.user_id=?`; p.push(user_id); }
  if (start && end) { q+=` AND s.date>=? AND s.date<=?`; p.push(start,end); }
  if (req.query.status && ['account_admin','manager'].includes(u.user_type)) { q+=` AND s.status=?`; p.push(req.query.status); }
  res.json(all(q+` ORDER BY s.date,s.start_time`,p));
});
app.post('/api/shifts', requireAuth, requirePerm('manage_shifts'), (req, res) => {
  const { user_id, date, start_time, end_time, department, notes, status='published' } = req.body;
  const canPublish = req.user.user_type==='account_admin'||req.perms?.publish_shifts;
  const id = uuidv4();
  run('INSERT INTO shifts(id,user_id,date,start_time,end_time,department,notes,status,created_by) VALUES(?,?,?,?,?,?,?,?,?)',
    [id,user_id,date,start_time,end_time,department,notes,canPublish?status:'draft',req.session.userId]);
  res.json({ id, ok: true });
});
app.post('/api/shifts/bulk', requireAuth, requirePerm('manage_shifts'), (req, res) => {
  const { user_ids, dates, start_time, end_time, department, notes, status='published' } = req.body;
  const canPublish = req.user.user_type==='account_admin'||req.perms?.publish_shifts;
  let count = 0;
  for (const uid of user_ids) for (const date of dates) {
    run('INSERT INTO shifts(id,user_id,date,start_time,end_time,department,notes,status,created_by) VALUES(?,?,?,?,?,?,?,?,?)',
      [uuidv4(),uid,date,start_time,end_time,department,notes,canPublish?status:'draft',req.session.userId]);
    count++;
  }
  res.json({ ok: true, created: count });
});
app.post('/api/shifts/publish', requireAuth, requirePerm('publish_shifts'), (req, res) => {
  for (const id of req.body.shift_ids) run("UPDATE shifts SET status='published' WHERE id=?",[id]);
  io.emit('shifts_updated'); res.json({ ok: true });
});
app.post('/api/shifts/publish-all', requireAuth, requirePerm('publish_shifts'), (req, res) => {
  run("UPDATE shifts SET status='published' WHERE status='draft'");
  io.emit('shifts_updated'); res.json({ ok: true });
});
app.put('/api/shifts/:id', requireAuth, requirePerm('manage_shifts'), (req, res) => {
  const { date, start_time, end_time, department, notes, status } = req.body;
  const shift = get('SELECT * FROM shifts WHERE id=?',[req.params.id]);
  if (!shift) return res.status(404).json({ error:'Not found' });
  const canPublish = req.user.user_type==='account_admin'||req.perms?.publish_shifts;
  run('UPDATE shifts SET date=?,start_time=?,end_time=?,department=?,notes=?,status=? WHERE id=?',
    [date,start_time,end_time,department,notes,canPublish?(status||shift.status):shift.status,req.params.id]);
  res.json({ ok: true });
});
app.delete('/api/shifts/:id', requireAuth, requirePerm('manage_shifts'), (req, res) => {
  run('DELETE FROM shifts WHERE id=?',[req.params.id]); res.json({ ok: true });
});

// Templates
app.get('/api/templates', requireAuth, requirePerm('manage_shifts'), (req, res) => res.json(all('SELECT * FROM shift_templates ORDER BY name')));
app.post('/api/templates', requireAuth, requirePerm('manage_shifts'), (req, res) => {
  const { name, start_time, end_time, department, notes } = req.body;
  const id = uuidv4();
  run('INSERT INTO shift_templates(id,name,start_time,end_time,department,notes,created_by) VALUES(?,?,?,?,?,?,?)',[id,name,start_time,end_time,department,notes,req.session.userId]);
  res.json({ id, ok: true });
});
app.delete('/api/templates/:id', requireAuth, requirePerm('manage_shifts'), (req, res) => {
  run('DELETE FROM shift_templates WHERE id=?',[req.params.id]); res.json({ ok: true });
});

// ── USERS ─────────────────────────────────────────────────────────────────────
app.get('/api/users', requireAuth, canManageUsers, (req, res) => {
  const u = req.user;
  if (['account_admin','manager'].includes(u.user_type))
    return res.json(all("SELECT id,email,name,avatar,user_type,department,active,onboarded,force_password_change FROM users WHERE user_type!='account_admin' ORDER BY user_type,name"));
  res.json(all("SELECT id,email,name,avatar,user_type,department,active,onboarded FROM users WHERE user_type IN ('agent','team_leader') AND active=1 ORDER BY name"));
});
app.post('/api/users', requireAuth, canManageUsers, async (req, res) => {
  const u = req.user;
  const { email, name, user_type, department } = req.body;
  if (!email||!name) return res.status(400).json({ error:'Email and name required' });
  if (get('SELECT id FROM users WHERE email=?',[email])) return res.status(400).json({ error:'Email already exists' });
  if (user_type==='account_admin') return res.status(403).json({ error:'Cannot create admin via this form' });
  if (u.user_type==='team_leader'&&!['agent','team_leader'].includes(user_type))
    return res.status(403).json({ error:'Team Leaders can only create Agent or Team Leader accounts' });
  if (user_type==='manager'&&!['account_admin','manager'].includes(u.user_type))
    return res.status(403).json({ error:'Only Admin or Manager can assign Manager user type' });

  // Generate temp password
  const temp = generateTempPassword();
  const hash = await bcrypt.hash(temp, SALT_ROUNDS);
  const id = uuidv4();
  run('INSERT INTO users(id,email,name,user_type,department,active,onboarded,password_hash,force_password_change) VALUES(?,?,?,?,?,1,0,?,1)',
    [id,email,name,user_type||'agent',department||'CS',hash]);
  run("INSERT OR IGNORE INTO availability(user_id,status) VALUES(?,'offline')",[id]);
  const newUser = getUser(id);
  auditLog('user_created', u.id, newUser);
  res.json({ id, ok: true, temp_password: temp });
});
app.put('/api/users/:id', requireAuth, canManageUsers, (req, res) => {
  const u = req.user;
  const target = get('SELECT * FROM users WHERE id=?',[req.params.id]);
  if (!target) return res.status(404).json({ error:'Not found' });
  if (target.user_type==='account_admin') return res.status(403).json({ error:'Cannot modify account admin' });
  const { user_type, department, name, active } = req.body;
  if (user_type==='manager'&&!['account_admin','manager'].includes(u.user_type))
    return res.status(403).json({ error:'Only Admin or Manager can assign Manager user type' });
  if (u.user_type==='team_leader'&&user_type&&!['agent','team_leader'].includes(user_type))
    return res.status(403).json({ error:'Team Leaders can only assign Agent or Team Leader user types' });
  const finalActive = active??target.active;
  run('UPDATE users SET user_type=?,department=?,name=?,active=? WHERE id=?',
    [user_type??target.user_type,department??target.department,name??target.name,finalActive,req.params.id]);
  if (active!==undefined&&active!==target.active) {
    auditLog(active?'user_activated':'user_deactivated',u.id,target);
    if (!active) { run("UPDATE availability SET status='offline' WHERE user_id=?",[req.params.id]); io.emit('availability_update'); }
  }
  res.json({ ok: true });
});
app.post('/api/users/:id/set-active', requireAuth, (req, res) => {
  const u = req.user;
  if (!['account_admin','manager','team_leader'].includes(u.user_type)) return res.status(403).json({ error:'Permission denied' });
  const target = get('SELECT * FROM users WHERE id=?',[req.params.id]);
  if (!target||target.user_type==='account_admin') return res.status(403).json({ error:'Cannot modify admin' });
  const { active } = req.body;
  run('UPDATE users SET active=? WHERE id=?',[active?1:0,req.params.id]);
  if (!active) { run("UPDATE availability SET status='offline' WHERE user_id=?",[req.params.id]); io.emit('availability_update'); }
  auditLog(active?'user_activated':'user_deactivated',u.id,target);
  res.json({ ok: true });
});
app.delete('/api/users/:id', requireAuth, (req, res) => {
  const u = req.user;
  if (!['account_admin','manager'].includes(u.user_type)) return res.status(403).json({ error:'Only Admin or Manager can delete users' });
  const target = get('SELECT * FROM users WHERE id=?',[req.params.id]);
  if (!target||target.user_type==='account_admin') return res.status(403).json({ error:'Cannot delete admin' });
  auditLog('user_deleted',u.id,target,`Permanently deleted by ${u.name}`);
  run('DELETE FROM users WHERE id=?',[req.params.id]);
  run('DELETE FROM availability WHERE user_id=?',[req.params.id]);
  run('DELETE FROM team_leader_agents WHERE agent_id=? OR leader_id=?',[req.params.id,req.params.id]);
  run('DELETE FROM agent_job_roles WHERE agent_id=?',[req.params.id]);
  io.emit('availability_update');
  res.json({ ok: true });
});

// ── LOGS ──────────────────────────────────────────────────────────────────────
app.get('/api/logs', requireAuth, requirePerm('view_clock_logs'), (req, res) => {
  const { date, user_id } = req.query;
  let q = `SELECT cl.*,u.name,u.email,u.department FROM clock_logs cl JOIN users u ON cl.user_id=u.id WHERE 1=1`;
  const p = [];
  if (req.user.user_type==='team_leader'&&req.perms?.view_own_logs_only) {
    const ids = all('SELECT agent_id FROM team_leader_agents WHERE leader_id=?',[req.user.id]).map(r=>r.agent_id);
    if (ids.length) { q+=` AND cl.user_id IN (${ids.map(()=>'?').join(',')}) `; p.push(...ids); }
    else q+=` AND 1=0`;
  }
  if (date) { q+=` AND cl.date=?`; p.push(date); }
  if (user_id) { q+=` AND cl.user_id=?`; p.push(user_id); }
  res.json(all(q+` ORDER BY cl.date DESC,cl.clock_in DESC`,p));
});
app.get('/api/audit-log', requireAdmin, (req, res) => res.json(all('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 200')));

// ── PERMISSIONS ───────────────────────────────────────────────────────────────
app.get('/api/permissions', requireAdmin, (req, res) => {
  const rows = all('SELECT role,permissions FROM role_permissions');
  const result = {}; rows.forEach(r => { try { result[r.role]=JSON.parse(r.permissions); } catch { result[r.role]={}; } });
  res.json(result);
});
app.put('/api/permissions/:role', requireAdmin, (req, res) => {
  const { role } = req.params;
  if (role==='account_admin') return res.status(403).json({ error:'Cannot modify admin permissions' });
  if (get('SELECT role FROM role_permissions WHERE role=?',[role]))
    run('UPDATE role_permissions SET permissions=? WHERE role=?',[JSON.stringify(req.body),role]);
  else run('INSERT INTO role_permissions(role,permissions) VALUES(?,?)',[role,JSON.stringify(req.body)]);
  res.json({ ok: true });
});

// ── TEAM LEADER ASSIGNMENTS ───────────────────────────────────────────────────
app.get('/api/team-leader-assignments', requireAuth, (req, res) => {
  const leaders = all("SELECT id,name,department FROM users WHERE user_type='team_leader' AND active=1 ORDER BY name");
  res.json(leaders.map(l => ({
    ...l,
    agents: all(`SELECT u.id,u.name,u.department FROM users u JOIN team_leader_agents tla ON u.id=tla.agent_id WHERE tla.leader_id=? AND u.active=1`,[l.id])
  })));
});

// ── SOCKET ────────────────────────────────────────────────────────────────────
io.on('connection', socket => {
  socket.on('request_availability', () => socket.emit('availability_update'));
});

const PORT = process.env.PORT || 5000;
initDb().then(() => server.listen(PORT, () => console.log(`✅ ShiftManager v7 running on http://localhost:${PORT}`)));

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { initDb, run, get, all, pool } = require('./db');
const { runSync } = require('./sheets-sync');
const cron = require('node-cron');

const app = express();
const server = http.createServer(app);
const isProduction = process.env.NODE_ENV === 'production';
const clientOrigin = isProduction ? process.env.CLIENT_URL || true : 'http://localhost:3000';

const io = new Server(server, { cors: { origin: clientOrigin, credentials: true } });
const SALT_ROUNDS = 12;

app.use(cors({
  origin: isProduction ? 'https://csi-shift-app.up.railway.app' : 'http://localhost:3000',
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use(express.json({ limit: '10mb' }));

// Use PostgreSQL session store in production
let sessionStore;
if (isProduction) {
  const pgSession = require('connect-pg-simple')(session);
  sessionStore = new pgSession({ pool, createTableIfMissing: true });
}

// Trust Railway's proxy so secure cookies work on HTTPS
app.set('trust proxy', 1);

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'shiftmanager-secret-2024',
  resave: true,
  saveUninitialized: false,
  name: 'shiftmanager.sid',
  rolling: true,
  cookie: {
    secure: false,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
  }
}));

// Serve built React frontend in production
if (isProduction) {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
}

// ── HELPERS ──────────────────────────────────────────────────────────────────
async function getPermissions(userType) {
  if (userType === 'account_admin') return null;
  const row = await get('SELECT permissions FROM role_permissions WHERE role=$1', [userType]);
  if (!row) return {};
  try { return JSON.parse(row.permissions); } catch { return {}; }
}
async function getUser(id) { return await get('SELECT * FROM users WHERE id=$1', [id]); }
async function getTheme() {
  const rows = await all('SELECT key,value FROM theme');
  const t = {}; rows.forEach(r => { try { t[r.key] = JSON.parse(r.value); } catch { t[r.key] = r.value; } });
  return t;
}
async function auditLog(action, performedBy, target, details='') {
  const performer = await getUser(performedBy);
  await run('INSERT INTO audit_log(id,action,performed_by,performed_by_name,target_user_id,target_user_email,target_user_name,target_user_role,target_user_department,details) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
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
const requireAuth = async (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const user = await getUser(req.session.userId);
  if (!user || !user.active) return res.status(401).json({ error: 'Your account has been deactivated.' });
  req.user = user;
  req.perms = await getPermissions(user.user_type);
  next();
};
const requireAdmin = async (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const user = await getUser(req.session.userId);
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
app.post('/api/auth/check-email', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  const user = await get('SELECT id, email, name, user_type, active, password_hash FROM users WHERE email=$1', [email.trim().toLowerCase()]);
  if (!user) return res.json({ exists: false });
  if (!user.active) return res.status(403).json({ error: 'Your account has been deactivated. Please contact your administrator.' });
  res.json({ exists: true, hasPassword: !!user.password_hash, name: user.name });
});

// Login with email + password
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  const user = await get('SELECT * FROM users WHERE email=$1', [email.trim().toLowerCase()]);
  if (!user) return res.status(401).json({ error: 'No account found with that email. Contact your administrator.' });
  if (!user.active) return res.status(403).json({ error: 'Your account has been deactivated. Please contact your administrator.' });
  // No password set yet — first time setup
  if (!user.password_hash) {
    return res.status(200).json({ requiresPasswordSetup: true, userId: user.id, userName: user.name });
  }
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ error: 'Incorrect password. Please try again.' });
  await run("INSERT INTO availability(user_id,status) VALUES($1,'offline') ON CONFLICT DO NOTHING", [user.id]);
  req.session.userId = user.id;
  req.session.save(async (err) => {
    if (err) return res.status(500).json({ error: 'Session save failed' });
    res.json({ user: safeUser(user), permissions: await getPermissions(user.user_type), theme: await getTheme(), forcePasswordChange: !!user.force_password_change });
  });
});

// First-time password setup (no auth required — for accounts with no password yet)
app.post('/api/auth/setup-password', async (req, res) => {
  const { userId, password } = req.body;
  if (!userId || !password) return res.status(400).json({ error: 'Missing required fields' });
  
  const user = await get('SELECT * FROM users WHERE id=$1', [userId]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.password_hash) return res.status(403).json({ error: 'Password already set. Please use the login page.' });
  const hash = await bcrypt.hash(password, 12);
  await run('UPDATE users SET password_hash=$1, force_password_change=0 WHERE id=$2', [hash, userId]);
  await run("INSERT INTO availability(user_id,status) VALUES($1,'offline') ON CONFLICT DO NOTHING", [userId]);
  req.session.userId = userId;
  const updated = await getUser(userId);
  req.session.save(async (err) => {
    if (err) return res.status(500).json({ error: 'Session save failed' });
    res.json({ user: safeUser(updated), permissions: await getPermissions(updated.user_type), theme: await getTheme() });
  });
});

// Change password (must be logged in, or forced change with temp password)
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const new_password = req.body.newPassword || req.body.new_password;
  const current_password = req.body.currentPassword || req.body.current_password;
  if (!new_password) return res.status(400).json({ error: 'New password is required' });
  const user = await getUser(req.user.id);
  // Always verify current/temp password
  if (!current_password) return res.status(400).json({ error: 'Current password is required' });
  const match = await bcrypt.compare(current_password, user.password_hash);
  if (!match) return res.status(401).json({ error: 'Incorrect password. Please try again.' });
  const hash = await bcrypt.hash(new_password, SALT_ROUNDS);
  await run('UPDATE users SET password_hash=$1, force_password_change=0 WHERE id=$2', [hash, req.user.id]);
  res.json({ ok: true, user: safeUser(await getUser(req.user.id)) });
});

// Admin reset password — generates temp, shows it once
app.post('/api/users/:id/reset-password', requireAuth, canManageUsers, async (req, res) => {
  const target = await get('SELECT * FROM users WHERE id=$1', [req.params.id]);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.user_type === 'account_admin' && req.user.user_type !== 'account_admin')
    return res.status(403).json({ error: 'Cannot reset admin password' });
  const temp = generateTempPassword();
  const hash = await bcrypt.hash(temp, SALT_ROUNDS);
  await run('UPDATE users SET password_hash=$1, force_password_change=1 WHERE id=$2', [hash, req.params.id]);
  await auditLog('password_reset', req.user.id, target, `Temporary password issued by ${req.user.name}`);
  res.json({ ok: true, temp_password: temp });
});

app.post('/api/auth/logout', requireAuth, async (req, res) => {
  const { userId } = req.session;
  // Do NOT clock out on logout — agent must manually clock out
  // Just update availability to offline visually but keep clock log open
  await run("UPDATE availability SET status='offline',last_updated=NOW() WHERE user_id=$1", [userId]);
  io.emit('availability_update');
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/auth/me', async (req, res) => {
  if (!req.session.userId) return res.json({ user: null, permissions: null, theme: await getTheme() });
  const user = await getUser(req.session.userId);
  if (!user) return res.json({ user: null, permissions: null, theme: await getTheme() });
  res.json({ user: safeUser(user), permissions: await getPermissions(user.user_type), theme: await getTheme(), forcePasswordChange: !!user.force_password_change });
});

// ── THEME ─────────────────────────────────────────────────────────────────────
app.get('/api/theme', async (req, res) => res.json(await getTheme()));
app.put('/api/theme', requireAdmin, async (req, res) => {
  for (const [k,v] of Object.entries(req.body)) {
    if (await get('SELECT key FROM theme WHERE key=$1',[k])) await run('UPDATE theme SET value=$1 WHERE key=$2',[JSON.stringify(v),k]);
    else await run('INSERT INTO theme(key,value) VALUES($1,$2)',[k,JSON.stringify(v)]);
  }
  io.emit('theme_update', await getTheme());
  res.json({ ok: true });
});

// ── CLOCK ─────────────────────────────────────────────────────────────────────
app.post('/api/clock/in', requireAuth, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  if (await get("SELECT id FROM clock_logs WHERE user_id=$1 AND date=$2 AND clock_out IS NULL",[req.session.userId,today]))
    return res.status(400).json({ error: 'Already clocked in' });
  await run("INSERT INTO clock_logs(id,user_id,clock_in,date,ip_address) VALUES($1,$2,NOW(),$3,$4)",[uuidv4(),req.session.userId,today,req.ip||'unknown']);
  await run("UPDATE availability SET status='available',clocked_in_at=NOW(),last_updated=NOW() WHERE user_id=$1",[req.session.userId]);
  io.emit('availability_update');
  res.json({ ok: true, message: 'Clocked in successfully' });
});
app.post('/api/clock/out', requireAuth, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const open = await get("SELECT id FROM clock_logs WHERE user_id=$1 AND date=$2 AND clock_out IS NULL",[req.session.userId,today]);
  if (!open) return res.status(400).json({ error: 'Not clocked in' });
  await run("UPDATE clock_logs SET clock_out=NOW() WHERE id=$1",[open.id]);
  await run("UPDATE availability SET status='offline',last_updated=NOW() WHERE user_id=$1",[req.session.userId]);
  io.emit('availability_update');
  res.json({ ok: true, message: 'Clocked out successfully' });
});
app.get('/api/clock/status', requireAuth, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const log = await get("SELECT * FROM clock_logs WHERE user_id=$1 AND date=$2 AND clock_out IS NULL",[req.session.userId,today]);
  res.json({ clockedIn: !!log, log });
});

// ── AVAILABILITY ──────────────────────────────────────────────────────────────
app.get('/api/availability', requireAuth, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const users = await all(`SELECT u.id,u.name,u.email,u.avatar,u.department,u.user_type,
    a.status,a.clocked_in_at,a.last_updated,
    a.break_type_id,a.break_type_name,a.break_type_icon,a.break_type_color
    FROM users u LEFT JOIN availability a ON u.id=a.user_id
    WHERE u.user_type NOT IN ('account_admin') AND u.active=1 ORDER BY u.department,u.name`);
  // Attach current break start time for timer display
  const result = await Promise.all(users.map(async u => {
    if (u.status === 'on_break') {
      const bl = await get('SELECT started_at FROM break_logs WHERE user_id=$1 AND date=$2 AND ended_at IS NULL', [u.id, today]);
      return { ...u, break_started_at: bl ? bl.started_at : null };
    }
    return u;
  }));
  res.json(result);
});

// ── DEPARTMENTS ───────────────────────────────────────────────────────────────
app.get('/api/departments', requireAuth, async (req, res) => {
  const depts = await all('SELECT * FROM departments WHERE active=1 ORDER BY name');
  const deptsWithDetails = await Promise.all(depts.map(async d => ({
    ...d,
    managers: await all(`SELECT u.id,u.name FROM users u JOIN department_managers dm ON u.id=dm.manager_id WHERE dm.department_id=$1`,[d.id]),
    job_roles: await all(`SELECT jr.*,(SELECT COUNT(*) FROM agent_job_roles WHERE job_role_id=jr.id) as agent_count FROM job_roles jr WHERE jr.department_id=$1 AND jr.active=1 ORDER BY jr.name`,[d.id])
  })));
  res.json(deptsWithDetails);
});
app.post('/api/departments', requireAdmin, async (req, res) => {
  const { name, color, bg_color } = req.body;
  const id = uuidv4();
  await run('INSERT INTO departments(id,name,color,bg_color) VALUES($1,$2,$3,$4)',[id,name,color||'#333',bg_color||'#f0f0f0']);
  res.json({ id, ok: true });
});
app.put('/api/departments/:id', requireAdmin, async (req, res) => {
  const { name, color, bg_color } = req.body;
  await run('UPDATE departments SET name=$1,color=$2,bg_color=$3 WHERE id=$4',[name,color,bg_color,req.params.id]);
  res.json({ ok: true });
});
app.delete('/api/departments/:id', requireAdmin, async (req, res) => {
  await run('UPDATE departments SET active=0 WHERE id=$1',[req.params.id]); res.json({ ok: true });
});
app.post('/api/departments/:id/managers', requireAdmin, async (req, res) => {
  try { await run('INSERT INTO department_managers(department_id,manager_id) VALUES($1,$2)',[req.params.id,req.body.manager_id]); } catch(e) {}
  res.json({ ok: true });
});
app.delete('/api/departments/:id/managers', requireAdmin, async (req, res) => {
  await run('DELETE FROM department_managers WHERE department_id=$1 AND manager_id=$2',[req.params.id,req.body.manager_id]);
  res.json({ ok: true });
});

// ── JOB ROLES ─────────────────────────────────────────────────────────────────
app.get('/api/job-roles', requireAuth, async (req, res) => {
  const { department_id } = req.query;
  let q = `SELECT jr.*,d.name as department_name FROM job_roles jr JOIN departments d ON jr.department_id=d.id WHERE jr.active=1`;
  const p = [];
  if (department_id) { q+=' AND jr.department_id=$1'; p.push(department_id); }
  q+=' ORDER BY d.name,jr.name';
  const roles = await all(q,p);
  const rolesWithDetails = await Promise.all(roles.map(async r => ({
    ...r,
    leaders: await all(`SELECT u.id,u.name FROM users u JOIN job_role_leaders jrl ON u.id=jrl.leader_id WHERE jrl.job_role_id=$1`,[r.id]),
    agents: await all(`SELECT u.id,u.name FROM users u JOIN agent_job_roles ajr ON u.id=ajr.agent_id WHERE ajr.job_role_id=$1 AND u.active=1`,[r.id])
  })));
  res.json(rolesWithDetails);
});
app.post('/api/job-roles', requireAuth, canManageUsers, async (req, res) => {
  const { name, department_id, description } = req.body;
  if (!name||!department_id) return res.status(400).json({ error:'Name and department required' });
  const id = uuidv4();
  await run('INSERT INTO job_roles(id,name,department_id,description) VALUES($1,$2,$3,$4)',[id,name,department_id,description||'']);
  res.json({ id, ok: true });
});
app.put('/api/job-roles/:id', requireAuth, canManageUsers, async (req, res) => {
  await run('UPDATE job_roles SET name=$1,description=$2 WHERE id=$3',[req.body.name,req.body.description||'',req.params.id]);
  res.json({ ok: true });
});
app.delete('/api/job-roles/:id', requireAuth, canManageUsers, async (req, res) => {
  await run('UPDATE job_roles SET active=0 WHERE id=$1',[req.params.id]); res.json({ ok: true });
});
app.post('/api/job-roles/:id/leaders', requireAuth, canManageUsers, async (req, res) => {
  try { await run('INSERT INTO job_role_leaders(job_role_id,leader_id) VALUES($1,$2)',[req.params.id,req.body.leader_id]); } catch(e) {}
  res.json({ ok: true });
});
app.delete('/api/job-roles/:id/leaders', requireAuth, canManageUsers, async (req, res) => {
  await run('DELETE FROM job_role_leaders WHERE job_role_id=$1 AND leader_id=$2',[req.params.id,req.body.leader_id]);
  res.json({ ok: true });
});
app.post('/api/job-roles/:id/agents', requireAuth, canManageUsers, async (req, res) => {
  const { agent_id } = req.body;
  try { await run('INSERT INTO agent_job_roles(agent_id,job_role_id) VALUES($1,$2)',[agent_id,req.params.id]); } catch(e) {}
  const leaders = await all('SELECT leader_id FROM job_role_leaders WHERE job_role_id=$1',[req.params.id]);
  for (const l of leaders) { try { await run('INSERT INTO team_leader_agents(leader_id,agent_id) VALUES($1,$2)',[l.leader_id,agent_id]); } catch(e) {} }
  res.json({ ok: true });
});
app.delete('/api/job-roles/:id/agents', requireAuth, canManageUsers, async (req, res) => {
  await run('DELETE FROM agent_job_roles WHERE agent_id=$1 AND job_role_id=$2',[req.body.agent_id,req.params.id]);
  res.json({ ok: true });
});

// Onboarding complete
app.post('/api/onboarding/complete', requireAuth, async (req, res) => {
  const { job_role_ids } = req.body;
  if (!job_role_ids || !job_role_ids.length) return res.status(400).json({ error:'Select at least one job role' });
  for (const jrId of job_role_ids) {
    try { await run('INSERT INTO agent_job_roles(agent_id,job_role_id) VALUES($1,$2)',[req.user.id,jrId]); } catch(e) {}
    const leaders = await all('SELECT leader_id FROM job_role_leaders WHERE job_role_id=$1',[jrId]);
    for (const l of leaders) { try { await run('INSERT INTO team_leader_agents(leader_id,agent_id) VALUES($1,$2)',[l.leader_id,req.user.id]); } catch(e) {} }
  }
  await run('UPDATE users SET onboarded=1 WHERE id=$1',[req.user.id]);
  res.json({ ok: true, user: safeUser(await getUser(req.user.id)) });
});

// ── SHIFTS ────────────────────────────────────────────────────────────────────
app.get('/api/shifts', requireAuth, async (req, res) => {
  const { start, end, user_id } = req.query;
  const u = req.user;
  let q = `SELECT s.*,u.name as user_name,u.email,u.department FROM shifts s JOIN users u ON s.user_id=u.id WHERE 1=1`;
  const p = [];
  const nxt = () => `$${p.length + 1}`;

  if (u.user_type==='agent') {
    p.push(u.id);
    q += ` AND s.user_id=$${p.length} AND s.status='published'`;
  } else if (u.user_type==='team_leader') {
    const rows = await all('SELECT agent_id FROM team_leader_agents WHERE leader_id=$1',[u.id]);
    const ids = rows.map(r=>r.agent_id);
    if (ids.length) {
      ids.forEach(id => p.push(id));
      const ph = ids.map((_,i)=>`$${i+1}`).join(',');
      q += ` AND s.user_id IN (${ph}) AND s.status='published'`;
    } else {
      q += ` AND 1=0`;
    }
  }
  if (user_id && u.user_type!=='agent') { p.push(user_id); q += ` AND s.user_id=$${p.length}`; }
  if (start && end) { p.push(start); q += ` AND s.date>=$${p.length}`; p.push(end); q += ` AND s.date<=$${p.length}`; }
  if (req.query.status && ['account_admin','manager'].includes(u.user_type)) { p.push(req.query.status); q += ` AND s.status=$${p.length}`; }
  res.json(await all(q+` ORDER BY s.date,s.start_time`,p));
});
app.post('/api/shifts', requireAuth, requirePerm('manage_shifts'), async (req, res) => {
  const { user_id, date, start_time, end_time, notes, status='published' } = req.body;
  // Auto-fill department from agent profile
  const agent = await get('SELECT department FROM users WHERE id=$1', [user_id]);
  const department = agent?.department || 'CS';
  const canPublish = req.user.user_type==='account_admin'||req.perms?.publish_shifts;
  const id = uuidv4();
  await run('INSERT INTO shifts(id,user_id,date,start_time,end_time,department,notes,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [id,user_id,date,start_time,end_time,department,notes,canPublish?status:'draft',req.session.userId]);
  res.json({ id, ok: true });
});
app.post('/api/shifts/bulk', requireAuth, requirePerm('manage_shifts'), async (req, res) => {
  const { user_ids, dates, start_time, end_time, notes, status='published' } = req.body;
  const canPublish = req.user.user_type==='account_admin'||req.perms?.publish_shifts;
  let count = 0;
  for (const uid of user_ids) {
    const agent = await get('SELECT department FROM users WHERE id=$1', [uid]);
    const department = agent?.department || 'CS';
    for (const date of dates) {
      await run('INSERT INTO shifts(id,user_id,date,start_time,end_time,department,notes,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [uuidv4(),uid,date,start_time,end_time,department,notes,canPublish?status:'draft',req.session.userId]);
      count++;
    }
  }
  res.json({ ok: true, created: count });
});
app.post('/api/shifts/publish', requireAuth, requirePerm('publish_shifts'), async (req, res) => {
  for (const id of req.body.shift_ids) await run("UPDATE shifts SET status='published' WHERE id=$1",[id]);
  io.emit('shifts_updated'); res.json({ ok: true });
});
app.post('/api/shifts/publish-all', requireAuth, requirePerm('publish_shifts'), async (req, res) => {
  await run("UPDATE shifts SET status='published' WHERE status='draft'");
  io.emit('shifts_updated'); res.json({ ok: true });
});
app.put('/api/shifts/:id', requireAuth, requirePerm('manage_shifts'), async (req, res) => {
  const { date, start_time, end_time, department, notes, status } = req.body;
  const shift = await get('SELECT * FROM shifts WHERE id=$1',[req.params.id]);
  if (!shift) return res.status(404).json({ error:'Not found' });
  const canPublish = req.user.user_type==='account_admin'||req.perms?.publish_shifts;
  await run('UPDATE shifts SET date=$1,start_time=$2,end_time=$3,department=$4,notes=$5,status=$6 WHERE id=$7',
    [date,start_time,end_time,department,notes,canPublish?(status||shift.status):shift.status,req.params.id]);
  res.json({ ok: true });
});
app.delete('/api/shifts/:id', requireAuth, requirePerm('manage_shifts'), async (req, res) => {
  await run('DELETE FROM shifts WHERE id=$1',[req.params.id]); res.json({ ok: true });
});

// Templates
app.get('/api/templates', requireAuth, requirePerm('manage_shifts'), async (req, res) => res.json(await all('SELECT * FROM shift_templates ORDER BY name')));
app.post('/api/templates', requireAuth, requirePerm('manage_shifts'), async (req, res) => {
  const { name, start_time, end_time, notes } = req.body;
  const id = uuidv4();
  await run('INSERT INTO shift_templates(id,name,start_time,end_time,notes,created_by) VALUES($1,$2,$3,$4,$5,$6)',[id,name,start_time,end_time,notes||'',req.session.userId]);
  res.json({ id, ok: true });
});
app.delete('/api/templates/:id', requireAuth, requirePerm('manage_shifts'), async (req, res) => {
  await run('DELETE FROM shift_templates WHERE id=$1',[req.params.id]); res.json({ ok: true });
});

// ── USERS ─────────────────────────────────────────────────────────────────────
app.get('/api/users', requireAuth, canManageUsers, async (req, res) => {
  const u = req.user;
  if (['account_admin','manager'].includes(u.user_type))
    return res.json(await all("SELECT id,email,name,avatar,user_type,department,active,onboarded,force_password_change FROM users WHERE user_type!='account_admin' ORDER BY user_type,name"));
  res.json(await all("SELECT id,email,name,avatar,user_type,department,active,onboarded FROM users WHERE user_type IN ('agent','team_leader') AND active=1 ORDER BY name"));
});
app.post('/api/users', requireAuth, canManageUsers, async (req, res) => {
  const u = req.user;
  const { email, name, user_type, department } = req.body;
  if (!email||!name) return res.status(400).json({ error:'Email and name required' });
  if (await get('SELECT id FROM users WHERE email=$1',[email])) return res.status(400).json({ error:'Email already exists' });
  if (user_type==='account_admin') return res.status(403).json({ error:'Cannot create admin via this form' });
  if (u.user_type==='team_leader'&&!['agent','team_leader'].includes(user_type))
    return res.status(403).json({ error:'Team Leaders can only create Agent or Team Leader accounts' });
  if (user_type==='manager'&&!['account_admin','manager'].includes(u.user_type))
    return res.status(403).json({ error:'Only Admin or Manager can assign Manager user type' });

  // Generate temp password
  const temp = generateTempPassword();
  const hash = await bcrypt.hash(temp, SALT_ROUNDS);
  const id = uuidv4();
  await run('INSERT INTO users(id,email,name,user_type,department,active,onboarded,password_hash,force_password_change) VALUES($1,$2,$3,$4,$5,1,0,$6,1)',
    [id,email,name,user_type||'agent',department||'CS',hash]);
  await run("INSERT INTO availability(user_id,status) VALUES($1,'offline') ON CONFLICT DO NOTHING",[id]);
  const newUser = await getUser(id);
  await auditLog('user_created', u.id, newUser);
  res.json({ id, ok: true, temp_password: temp });
});
app.put('/api/users/:id', requireAuth, canManageUsers, async (req, res) => {
  const u = req.user;
  const target = await get('SELECT * FROM users WHERE id=$1',[req.params.id]);
  if (!target) return res.status(404).json({ error:'Not found' });
  if (target.user_type==='account_admin') return res.status(403).json({ error:'Cannot modify account admin' });
  const { user_type, department, name, active } = req.body;
  if (user_type==='manager'&&!['account_admin','manager'].includes(u.user_type))
    return res.status(403).json({ error:'Only Admin or Manager can assign Manager user type' });
  if (u.user_type==='team_leader'&&user_type&&!['agent','team_leader'].includes(user_type))
    return res.status(403).json({ error:'Team Leaders can only assign Agent or Team Leader user types' });
  const finalActive = active!==undefined ? active : target.active;
  const { timezone } = req.body;  
  await run('UPDATE users SET user_type=$1,department=$2,name=$3,active=$4,timezone=$5 WHERE id=$6',
    [user_type!==undefined?user_type:target.user_type, department||target.department, name||target.name, finalActive, timezone||target.timezone||'Africa/Johannesburg', req.params.id]);
  if (active!==undefined&&active!==target.active) {
    await auditLog(active?'user_activated':'user_deactivated',u.id,target);
    if (!active) { await run("UPDATE availability SET status='offline' WHERE user_id=$1",[req.params.id]); io.emit('availability_update'); }
  }
  res.json({ ok: true });
});
app.post('/api/users/:id/set-active', requireAuth, async (req, res) => {
  const u = req.user;
  if (!['account_admin','manager','team_leader'].includes(u.user_type)) return res.status(403).json({ error:'Permission denied' });
  const target = await get('SELECT * FROM users WHERE id=$1',[req.params.id]);
  if (!target||target.user_type==='account_admin') return res.status(403).json({ error:'Cannot modify admin' });
  const { active } = req.body;
  await run('UPDATE users SET active=$1 WHERE id=$2',[active?1:0,req.params.id]);
  if (!active) { await run("UPDATE availability SET status='offline' WHERE user_id=$1",[req.params.id]); io.emit('availability_update'); }
  await auditLog(active?'user_activated':'user_deactivated',u.id,target);
  res.json({ ok: true });
});
app.delete('/api/users/:id', requireAuth, async (req, res) => {
  const u = req.user;
  if (!['account_admin','manager'].includes(u.user_type)) return res.status(403).json({ error:'Only Admin or Manager can delete users' });
  const target = await get('SELECT * FROM users WHERE id=$1',[req.params.id]);
  if (!target||target.user_type==='account_admin') return res.status(403).json({ error:'Cannot delete admin' });
  await auditLog('user_deleted',u.id,target,`Permanently deleted by ${u.name}`);
  await run('DELETE FROM users WHERE id=$1',[req.params.id]);
  await run('DELETE FROM availability WHERE user_id=$1',[req.params.id]);
  await run('DELETE FROM team_leader_agents WHERE agent_id=$1 OR leader_id=$2',[req.params.id,req.params.id]);
  await run('DELETE FROM agent_job_roles WHERE agent_id=$1',[req.params.id]);
  io.emit('availability_update');
  res.json({ ok: true });
});

// ── LOGS ──────────────────────────────────────────────────────────────────────
app.get('/api/logs', requireAuth, requirePerm('view_clock_logs'), async (req, res) => {
  const { date, user_id } = req.query;
  let q = `SELECT cl.*,u.name,u.email,u.department FROM clock_logs cl JOIN users u ON cl.user_id=u.id WHERE 1=1`;
  const p = [];
  if (req.user.user_type==='team_leader'&&req.perms?.view_own_logs_only) {
    const ids = await all('SELECT agent_id FROM team_leader_agents WHERE leader_id=$1',[req.user.id]).map(r=>r.agent_id);
    if (ids.length) { q+=` AND cl.user_id IN (${ids.map(()=>'$1').join(',')}) `; p.push(...ids); }
    else q+=` AND 1=0`;
  }
  if (date) { q+=` AND cl.date=$1`; p.push(date); }
  if (user_id) { q+=` AND cl.user_id=$2`; p.push(user_id); }
  res.json(await all(q+` ORDER BY cl.date DESC,cl.clock_in DESC`,p));
});
app.get('/api/audit-log', requireAdmin, async (req, res) => res.json(await all('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 200')));

// ── PERMISSIONS ───────────────────────────────────────────────────────────────
app.get('/api/permissions', requireAdmin, async (req, res) => {
  const rows = await all('SELECT role,permissions FROM role_permissions');
  const result = {}; rows.forEach(r => { try { result[r.role]=JSON.parse(r.permissions); } catch { result[r.role]={}; } });
  res.json(result);
});
app.put('/api/permissions/:role', requireAdmin, async (req, res) => {
  const { role } = req.params;
  if (role==='account_admin') return res.status(403).json({ error:'Cannot modify admin permissions' });
  if (await get('SELECT role FROM role_permissions WHERE role=$1',[role]))
    await run('UPDATE role_permissions SET permissions=$1 WHERE role=$2',[JSON.stringify(req.body),role]);
  else await run('INSERT INTO role_permissions(role,permissions) VALUES($1,$2)',[role,JSON.stringify(req.body)]);
  res.json({ ok: true });
});

// ── TEAM LEADER ASSIGNMENTS ───────────────────────────────────────────────────
app.get('/api/team-leader-assignments', requireAuth, async (req, res) => {
  const leaders = await all("SELECT id,name,department FROM users WHERE user_type='team_leader' AND active=1 ORDER BY name");
  const leadersWithAgents = await Promise.all(leaders.map(async l => ({
    ...l,
    agents: await all(`SELECT u.id,u.name,u.department FROM users u JOIN team_leader_agents tla ON u.id=tla.agent_id WHERE tla.leader_id=$1 AND u.active=1`,[l.id])
  })));
  res.json(leadersWithAgents);
});

// ── SOCKET ────────────────────────────────────────────────────────────────────
io.on('connection', socket => {
  socket.on('request_availability', () => socket.emit('availability_update'));
});

const PORT = process.env.PORT || 5000;
// ── DATA SYNC ─────────────────────────────────────────────────────────────────
// Google Sheets sync
app.post('/api/admin/sheets-sync', requireAdmin, async (req, res) => {
  const result = await runSync();
  res.json(result);
});

// BigQuery sync (kept for backwards compat)
app.post('/api/admin/bigquery-sync', requireAdmin, async (req, res) => {
  const result = await runSync();
  res.json(result);
});

app.get('/api/admin/bigquery-status', requireAdmin, async (req, res) => {
  const keySet = !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  res.json({ configured: keySet, project: process.env.BIGQUERY_PROJECT_ID, dataset: process.env.BIGQUERY_DATASET });
});


initDb().then(async () => {
  // Log break_types state on startup for debugging
  try {
    const btCount = await get('SELECT COUNT(*) as c FROM break_types');
    const btActive = await get('SELECT COUNT(*) as c FROM break_types WHERE active = 1');
    console.log(`📋 break_types: ${btCount?.c} total, ${btActive?.c} active`);
  } catch(e) { console.log('Could not check break_types:', e.message); }

  server.listen(PORT, () => {
    console.log('✅ ShiftManager v16 running on port', PORT);
    if (!isProduction) console.log('   Frontend: http://localhost:3000');
  });
  
  // Schedule Sheets sync - every hour automatically
  if (isProduction && process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    cron.schedule('0 22 * * *', async () => { // midnight SAST (UTC+2)
      console.log('⏰ Running hourly Sheets sync...');
      await runSync();
    }, { timezone: 'UTC' });
    console.log('📅 Google Sheets sync scheduled daily at midnight SAST');

    // Run on startup after 30 seconds
    setTimeout(async () => {
      console.log('🔄 Running initial Sheets sync...');
      await runSync();
    }, 30000);
  }
}).catch(err => { console.error('❌ Failed to start:', err); process.exit(1); });

// ── BREAK TYPES ───────────────────────────────────────────────────────────────
app.get('/api/break-types', async (req, res) => {
  try {
    const showAll = req.query.all === 'true';
    const rows = await all(showAll
      ? 'SELECT * FROM break_types ORDER BY sort_order,name'
      : 'SELECT * FROM break_types WHERE active=1 ORDER BY sort_order,name');
    res.json(rows);
  } catch(e) {
    console.error('break-types GET error:', e.message);
    res.json([]);
  }
});

// Debug endpoint - check break_types table state
app.get('/api/debug/break-types', async (req, res) => {
  try {
    const all_rows = await all('SELECT id,name,active,sort_order FROM break_types ORDER BY sort_order');
    const count = await get('SELECT COUNT(*) as c FROM break_types');
    res.json({ total: count?.c, rows: all_rows });
  } catch(e) {
    res.json({ error: e.message });
  }
});

app.post('/api/break-types', requireAuth, async (req, res) => {
  const u = req.user;
  if (!['account_admin','manager','team_leader'].includes(u.user_type)) return res.status(403).json({ error: 'Permission denied' });
  const { name, icon, color, max_minutes } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const countRow = await get('SELECT COUNT(*) as c FROM break_types'); const count = parseInt(countRow?.c) || 0;
  const id = uuidv4();
  await run('INSERT INTO break_types(id,name,icon,color,max_minutes,sort_order,active) VALUES($1,$2,$3,$4,$5,$6,1)',
    [id, name, icon||'⏸️', color||'#6B7280', max_minutes||null, count]);
  res.json({ id, ok: true });
});

app.put('/api/break-types/:id', requireAuth, async (req, res) => {
  const u = req.user;
  if (!['account_admin','manager','team_leader'].includes(u.user_type)) return res.status(403).json({ error: 'Permission denied' });
  const { name, icon, color, max_minutes, active } = req.body;
  await run('UPDATE break_types SET name=$1,icon=$2,color=$3,max_minutes=$4,active=$5 WHERE id=$6',
    [name, icon||'⏸️', color||'#6B7280', max_minutes||null, active!==undefined?active:1, req.params.id]);
  res.json({ ok: true });
});

app.delete('/api/break-types/:id', requireAuth, async (req, res) => {
  const u = req.user;
  if (!['account_admin','manager','team_leader'].includes(u.user_type)) return res.status(403).json({ error: 'Permission denied' });
  await run('DELETE FROM break_types WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ── BREAKS ────────────────────────────────────────────────────────────────────
app.post('/api/breaks/start', requireAuth, async (req, res) => {
  const { break_type_id } = req.body;
  const userId = req.session.userId;

  // Must be clocked in
  const today = new Date().toISOString().split('T')[0];
  const clockedIn = await get("SELECT id FROM clock_logs WHERE user_id=$1 AND date=$2 AND clock_out IS NULL", [userId, today]);
  if (!clockedIn) return res.status(400).json({ error: 'You must be clocked in to take a break' });

  // Cannot already be on break
  const onBreak = await get("SELECT id FROM break_logs WHERE user_id=$1 AND date=$2 AND ended_at IS NULL", [userId, today]);
  if (onBreak) return res.status(400).json({ error: 'You are already on a break. End your current break first.' });

  const bt = await get('SELECT * FROM break_types WHERE id=$1', [break_type_id]);
  if (!bt) return res.status(404).json({ error: 'Break type not found' });

  const id = uuidv4();
  await run('INSERT INTO break_logs(id,user_id,break_type_id,break_type_name,break_type_icon,break_type_color,started_at,date) VALUES($1,$2,$3,$4,$5,$6,NOW(),$7)',
    [id, userId, bt.id, bt.name, bt.icon, bt.color, today]);

  await run(`UPDATE availability SET status='on_break', break_type_id=$1, break_type_name=$2, break_type_icon=$3, break_type_color=$4, last_updated=NOW() WHERE user_id=$5`,
    [bt.id, bt.name, bt.icon, bt.color, userId]);

  io.emit('availability_update');
  res.json({ ok: true, breakLogId: id, breakType: bt });
});

app.post('/api/breaks/end', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const today = new Date().toISOString().split('T')[0];

  const openBreak = await get("SELECT * FROM break_logs WHERE user_id=$1 AND date=$2 AND ended_at IS NULL", [userId, today]);
  if (!openBreak) return res.status(400).json({ error: 'No active break found' });

  const startedAt = new Date(openBreak.started_at);
  const now = new Date();
  const durationMinutes = Math.round((now - startedAt) / 60000);

  await run("UPDATE break_logs SET ended_at=NOW(), duration_minutes=$1 WHERE id=$2", [durationMinutes, openBreak.id]);
  await run(`UPDATE availability SET status='available', break_type_id=NULL, break_type_name=NULL, break_type_icon=NULL, break_type_color=NULL, last_updated=NOW() WHERE user_id=$1`, [userId]);

  io.emit('availability_update');
  res.json({ ok: true, durationMinutes });
});

app.get('/api/breaks/status', requireAuth, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const openBreak = await get("SELECT * FROM break_logs WHERE user_id=$1 AND date=$2 AND ended_at IS NULL", [req.session.userId, today]);
  const todayBreaks = await all("SELECT * FROM break_logs WHERE user_id=$1 AND date=$2 ORDER BY started_at", [req.session.userId, today]);
  res.json({ onBreak: !!openBreak, currentBreak: openBreak, todayBreaks });
});

app.get('/api/breaks/logs', requireAuth, async (req, res) => {
  const u = req.user;
  if (!['account_admin','manager','team_leader'].includes(u.user_type)) return res.status(403).json({ error: 'Permission denied' });
  const { date, user_id } = req.query;
  let query = `SELECT bl.*,u.name,u.department FROM break_logs bl JOIN users u ON bl.user_id=u.id WHERE 1=1`;
  const params = [];
  if (u.user_type === 'team_leader') {
    const agentIds = await all('SELECT agent_id FROM team_leader_agents WHERE leader_id=$1', [u.id]).map(r => r.agent_id);
    if (agentIds.length) { query += ` AND bl.user_id IN (${agentIds.map(()=>'$1').join(',')}) `; params.push(...agentIds); }
    else query += ` AND 1=0`;
  }
  if (date) { query += ` AND bl.date=$1`; params.push(date); }
  if (user_id) { query += ` AND bl.user_id=$2`; params.push(user_id); }
  query += ` ORDER BY bl.started_at DESC`;
  res.json(await all(query, params));
});

// ── MANAGER OVERRIDE ──────────────────────────────────────────────────────────
app.post('/api/override/clock-in', requireAuth, async (req, res) => {
  const u = req.user;
  if (!['account_admin','manager','team_leader'].includes(u.user_type)) return res.status(403).json({ error: 'Permission denied' });
  const { user_id } = req.body;
  const today = new Date().toISOString().split('T')[0];
  const existing = await get("SELECT id FROM clock_logs WHERE user_id=$1 AND date=$2 AND clock_out IS NULL", [user_id, today]);
  if (existing) return res.status(400).json({ error: 'Agent is already clocked in' });
  await run("INSERT INTO clock_logs(id,user_id,clock_in,date,ip_address) VALUES($1,$2,NOW(),$3,$4)", [require('uuid').v4(), user_id, today, 'manager-override']);
  await run("UPDATE availability SET status='available',clocked_in_at=NOW(),last_updated=NOW() WHERE user_id=$1", [user_id]);
  io.emit('availability_update');
  res.json({ ok: true });
});

app.post('/api/override/clock-out', requireAuth, async (req, res) => {
  const u = req.user;
  if (!['account_admin','manager','team_leader'].includes(u.user_type)) return res.status(403).json({ error: 'Permission denied' });
  const { user_id } = req.body;
  const today = new Date().toISOString().split('T')[0];
  // End any open break first
  const openBreak = await get("SELECT id FROM break_logs WHERE user_id=$1 AND date=$2 AND ended_at IS NULL", [user_id, today]);
  if (openBreak) {
    const startedAt = new Date(openBreak.started_at);
    const durationMinutes = Math.round((new Date() - startedAt) / 60000);
    await run("UPDATE break_logs SET ended_at=NOW(), duration_minutes=$1 WHERE id=$2", [durationMinutes, openBreak.id]);
  }
  const open = await get("SELECT id FROM clock_logs WHERE user_id=$1 AND date=$2 AND clock_out IS NULL", [user_id, today]);
  if (!open) return res.status(400).json({ error: 'Agent is not clocked in' });
  await run("UPDATE clock_logs SET clock_out=NOW() WHERE id=$1", [open.id]);
  await run("UPDATE availability SET status='offline',break_type_id=NULL,break_type_name=NULL,break_type_icon=NULL,break_type_color=NULL,last_updated=NOW() WHERE user_id=$1", [user_id]);
  io.emit('availability_update');
  res.json({ ok: true });
});

app.post('/api/override/start-break', requireAuth, async (req, res) => {
  const u = req.user;
  if (!['account_admin','manager','team_leader'].includes(u.user_type)) return res.status(403).json({ error: 'Permission denied' });
  const { user_id, break_type_id } = req.body;
  const today = new Date().toISOString().split('T')[0];
  const clockedIn = await get("SELECT id FROM clock_logs WHERE user_id=$1 AND date=$2 AND clock_out IS NULL", [user_id, today]);
  if (!clockedIn) return res.status(400).json({ error: 'Agent must be clocked in first' });
  const onBreak = await get("SELECT id FROM break_logs WHERE user_id=$1 AND date=$2 AND ended_at IS NULL", [user_id, today]);
  if (onBreak) {
    const durationMinutes = Math.round((new Date() - new Date(onBreak.started_at)) / 60000);
    await run("UPDATE break_logs SET ended_at=NOW(), duration_minutes=$1 WHERE id=$2", [durationMinutes, onBreak.id]);
  }
  const bt = await get('SELECT * FROM break_types WHERE id=$1', [break_type_id]);
  if (!bt) return res.status(404).json({ error: 'Break type not found' });
  const newBreakId = require('uuid').v4();
  await run("INSERT INTO break_logs(id,user_id,break_type_id,break_type_name,break_type_icon,break_type_color,started_at,date) VALUES($1,$2,$3,$4,$5,$6,NOW(),$7)",
    [newBreakId, user_id, bt.id, bt.name, bt.icon, bt.color, today]);
  await run("UPDATE availability SET status='on_break',break_type_id=$1,break_type_name=$2,break_type_icon=$3,break_type_color=$4,last_updated=NOW() WHERE user_id=$5",
    [bt.id, bt.name, bt.icon, bt.color, user_id]);
  io.emit('availability_update');
  res.json({ ok: true, breakType: bt });
});

app.post('/api/override/end-break', requireAuth, async (req, res) => {
  const u = req.user;
  if (!['account_admin','manager','team_leader'].includes(u.user_type)) return res.status(403).json({ error: 'Permission denied' });
  const { user_id } = req.body;
  const today = new Date().toISOString().split('T')[0];
  const openBreak = await get("SELECT * FROM break_logs WHERE user_id=$1 AND date=$2 AND ended_at IS NULL", [user_id, today]);
  if (!openBreak) return res.status(400).json({ error: 'No active break found' });
  const durationMinutes = Math.round((new Date() - new Date(openBreak.started_at)) / 60000);
  await run("UPDATE break_logs SET ended_at=NOW(), duration_minutes=$1 WHERE id=$2", [durationMinutes, openBreak.id]);
  await run("UPDATE availability SET status='available',break_type_id=NULL,break_type_name=NULL,break_type_icon=NULL,break_type_color=NULL,last_updated=NOW() WHERE user_id=$1", [user_id]);
  io.emit('availability_update');
  res.json({ ok: true });
});

// ── CATCH-ALL: must be LAST - serves React frontend for all non-API routes ────
if (isProduction) {
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
  });
}

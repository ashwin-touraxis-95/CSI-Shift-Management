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
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'shiftmanager-secret-2024',
  resave: false, saveUninitialized: false,
  cookie: { secure: false, maxAge: 24*60*60*1000 }
}));

// ── MIDDLEWARE ──────────────────────────────────────────────────────────────
const requireAuth = (req,res,next) => {
  if (!req.session.userId) return res.status(401).json({error:'Unauthorized'});
  const user = get('SELECT * FROM users WHERE id=?',[req.session.userId]);
  if (!user || !user.active) return res.status(401).json({error:'Account inactive'});
  req.user = user; next();
};
const requireRole = (...roles) => (req,res,next) => {
  if (!req.session.userId) return res.status(401).json({error:'Unauthorized'});
  const user = get('SELECT * FROM users WHERE id=?',[req.session.userId]);
  if (!user || !roles.includes(user.role)) return res.status(403).json({error:'Forbidden'});
  req.user = user; next();
};
const requireManager = requireRole('manager');
const requireManagerOrLeader = requireRole('manager','team_leader');

// ── AUTH ────────────────────────────────────────────────────────────────────
app.post('/api/auth/google', async (req,res) => {
  try {
    const ticket = await client.verifyIdToken({idToken:req.body.credential,audience:GOOGLE_CLIENT_ID});
    const {email,name,picture} = ticket.getPayload();
    let user = get('SELECT * FROM users WHERE email=?',[email]);
    if (!user) {
      const id = uuidv4();
      run("INSERT INTO users(id,email,name,avatar,role) VALUES(?,?,?,?,'agent')",[id,email,name,picture]);
      user = get('SELECT * FROM users WHERE id=?',[id]);
    } else { run('UPDATE users SET name=?,avatar=? WHERE id=?',[name,picture,user.id]); user=get('SELECT * FROM users WHERE id=?',[user.id]); }
    run("INSERT OR IGNORE INTO availability(user_id,status) VALUES(?,'offline')",[user.id]);
    req.session.userId = user.id;
    res.json({user});
  } catch(e) { res.status(401).json({error:'Invalid token'}); }
});

app.post('/api/auth/demo', (req,res) => {
  const {email} = req.body;
  let user = get('SELECT * FROM users WHERE email=?',[email]);
  if (!user) {
    const id = uuidv4();
    run("INSERT INTO users(id,email,name,role,department,active) VALUES(?,?,?,'agent','CS',1)",[id,email,email.split('@')[0]]);
    run("INSERT OR IGNORE INTO availability(user_id,status) VALUES(?,'offline')",[id]);
    user = get('SELECT * FROM users WHERE id=?',[id]);
  }
  if (!user.active) return res.status(403).json({error:'Account has been deactivated'});
  run("INSERT OR IGNORE INTO availability(user_id,status) VALUES(?,'offline')",[user.id]);
  req.session.userId = user.id;
  res.json({user});
});

app.post('/api/auth/logout', requireAuth, (req,res) => {
  const {userId} = req.session;
  const today = new Date().toISOString().split('T')[0];
  const open = get("SELECT * FROM clock_logs WHERE user_id=? AND date=? AND clock_out IS NULL",[userId,today]);
  if (open) run("UPDATE clock_logs SET clock_out=datetime('now') WHERE id=?",[open.id]);
  run("UPDATE availability SET status='offline',last_updated=datetime('now') WHERE user_id=?",[userId]);
  io.emit('availability_update');
  req.session.destroy();
  res.json({ok:true});
});

app.get('/api/auth/me', (req,res) => {
  if (!req.session.userId) return res.json({user:null});
  res.json({user: get('SELECT * FROM users WHERE id=?',[req.session.userId])});
});

// ── CLOCK ───────────────────────────────────────────────────────────────────
app.post('/api/clock/in', requireAuth, (req,res) => {
  const {userId} = req.session;
  const today = new Date().toISOString().split('T')[0];
  if (get("SELECT * FROM clock_logs WHERE user_id=? AND date=? AND clock_out IS NULL",[userId,today]))
    return res.status(400).json({error:'Already clocked in'});
  run("INSERT INTO clock_logs(id,user_id,clock_in,date,ip_address) VALUES(?,?,datetime('now'),?,?)",
    [uuidv4(),userId,today,req.ip]);
  run("UPDATE availability SET status='available',clocked_in_at=datetime('now'),last_updated=datetime('now') WHERE user_id=?",[userId]);
  io.emit('availability_update');
  res.json({ok:true,message:'Clocked in successfully'});
});

app.post('/api/clock/out', requireAuth, (req,res) => {
  const {userId} = req.session;
  const today = new Date().toISOString().split('T')[0];
  const open = get("SELECT * FROM clock_logs WHERE user_id=? AND date=? AND clock_out IS NULL",[userId,today]);
  if (!open) return res.status(400).json({error:'Not clocked in'});
  run("UPDATE clock_logs SET clock_out=datetime('now') WHERE id=?",[open.id]);
  run("UPDATE availability SET status='offline',last_updated=datetime('now') WHERE user_id=?",[userId]);
  io.emit('availability_update');
  res.json({ok:true,message:'Clocked out successfully'});
});

app.get('/api/clock/status', requireAuth, (req,res) => {
  const today = new Date().toISOString().split('T')[0];
  const log = get("SELECT * FROM clock_logs WHERE user_id=? AND date=? AND clock_out IS NULL",[req.session.userId,today]);
  res.json({clockedIn:!!log,log});
});

// ── AVAILABILITY ────────────────────────────────────────────────────────────
app.get('/api/availability', requireAuth, (req,res) => {
  res.json(all(`SELECT u.id,u.name,u.email,u.avatar,u.department,u.role,
    a.status,a.clocked_in_at,a.last_updated
    FROM users u LEFT JOIN availability a ON u.id=a.user_id
    WHERE u.role!='manager' AND u.active=1 ORDER BY u.department,u.name`));
});

// ── SHIFTS ──────────────────────────────────────────────────────────────────
app.get('/api/shifts', requireAuth, (req,res) => {
  const {start,end,user_id} = req.query;
  const user = get('SELECT * FROM users WHERE id=?',[req.session.userId]);
  let query = `SELECT s.*,u.name,u.email,u.department FROM shifts s JOIN users u ON s.user_id=u.id WHERE 1=1`;
  const params = [];
  // Agents only see published shifts for themselves
  if (user.role === 'agent') { query += ` AND s.user_id=? AND s.status='published'`; params.push(user.id); }
  // Team leaders see published only
  else if (user.role === 'team_leader') { query += ` AND s.status='published'`; }
  // Managers see everything, optionally filter
  if (user_id && user.role !== 'agent') { query += ` AND s.user_id=?`; params.push(user_id); }
  if (start && end) { query += ` AND s.date>=? AND s.date<=?`; params.push(start,end); }
  query += ` ORDER BY s.date,s.start_time`;
  res.json(all(query,params));
});

app.post('/api/shifts', requireManagerOrLeader, (req,res) => {
  const {user_id,date,start_time,end_time,department,notes,status='published'} = req.body;
  // Team leaders can only create published shifts
  const finalStatus = req.user.role === 'team_leader' ? 'published' : status;
  const id = uuidv4();
  run('INSERT INTO shifts(id,user_id,date,start_time,end_time,department,notes,status,created_by) VALUES(?,?,?,?,?,?,?,?,?)',
    [id,user_id,date,start_time,end_time,department,notes,finalStatus,req.session.userId]);
  res.json({id,ok:true});
});

// Bulk assign shift to multiple agents
app.post('/api/shifts/bulk', requireManagerOrLeader, (req,res) => {
  const {user_ids,dates,start_time,end_time,department,notes,status='published'} = req.body;
  const finalStatus = req.user.role === 'team_leader' ? 'published' : status;
  const created = [];
  for (const user_id of user_ids) {
    for (const date of dates) {
      const id = uuidv4();
      run('INSERT INTO shifts(id,user_id,date,start_time,end_time,department,notes,status,created_by) VALUES(?,?,?,?,?,?,?,?,?)',
        [id,user_id,date,start_time,end_time,department,notes,finalStatus,req.session.userId]);
      created.push(id);
    }
  }
  res.json({ok:true,created:created.length});
});

// Publish draft shifts
app.post('/api/shifts/publish', requireManager, (req,res) => {
  const {shift_ids} = req.body;
  for (const id of shift_ids) run("UPDATE shifts SET status='published' WHERE id=?",[id]);
  io.emit('shifts_updated');
  res.json({ok:true});
});

// Publish ALL drafts
app.post('/api/shifts/publish-all', requireManager, (req,res) => {
  run("UPDATE shifts SET status='published' WHERE status='draft'");
  io.emit('shifts_updated');
  res.json({ok:true});
});

app.put('/api/shifts/:id', requireManagerOrLeader, (req,res) => {
  const {date,start_time,end_time,department,notes,status} = req.body;
  const shift = get('SELECT * FROM shifts WHERE id=?',[req.params.id]);
  if (!shift) return res.status(404).json({error:'Not found'});
  // Team leaders cannot change status
  const finalStatus = req.user.role === 'team_leader' ? shift.status : (status || shift.status);
  run('UPDATE shifts SET date=?,start_time=?,end_time=?,department=?,notes=?,status=? WHERE id=?',
    [date,start_time,end_time,department,notes,finalStatus,req.params.id]);
  res.json({ok:true});
});

app.delete('/api/shifts/:id', requireManagerOrLeader, (req,res) => {
  run('DELETE FROM shifts WHERE id=?',[req.params.id]);
  res.json({ok:true});
});

// ── SHIFT TEMPLATES ─────────────────────────────────────────────────────────
app.get('/api/templates', requireManagerOrLeader, (req,res) => {
  res.json(all('SELECT * FROM shift_templates ORDER BY name'));
});

app.post('/api/templates', requireManagerOrLeader, (req,res) => {
  const {name,start_time,end_time,department,notes} = req.body;
  const id = uuidv4();
  run('INSERT INTO shift_templates(id,name,start_time,end_time,department,notes,created_by) VALUES(?,?,?,?,?,?,?)',
    [id,name,start_time,end_time,department,notes,req.session.userId]);
  res.json({id,ok:true});
});

app.delete('/api/templates/:id', requireManager, (req,res) => {
  run('DELETE FROM shift_templates WHERE id=?',[req.params.id]);
  res.json({ok:true});
});

// ── USERS ───────────────────────────────────────────────────────────────────
app.get('/api/users', requireManagerOrLeader, (req,res) => {
  // Team leaders only see agents in their department
  if (req.user.role === 'team_leader') {
    return res.json(all('SELECT id,email,name,avatar,role,department,active FROM users WHERE department=? AND role="agent" ORDER BY name',[req.user.department]));
  }
  res.json(all('SELECT id,email,name,avatar,role,department,active FROM users ORDER BY name'));
});

// Manager manually creates a user
app.post('/api/users', requireManager, (req,res) => {
  const {email,name,role,department} = req.body;
  if (get('SELECT id FROM users WHERE email=?',[email]))
    return res.status(400).json({error:'Email already exists'});
  const id = uuidv4();
  run('INSERT INTO users(id,email,name,role,department,active) VALUES(?,?,?,?,?,1)',[id,email,name,role||'agent',department||'CS']);
  run("INSERT OR IGNORE INTO availability(user_id,status) VALUES(?,'offline')",[id]);
  res.json({id,ok:true});
});

app.put('/api/users/:id', requireManager, (req,res) => {
  const {role,department,name,active} = req.body;
  const user = get('SELECT * FROM users WHERE id=?',[req.params.id]);
  if (!user) return res.status(404).json({error:'Not found'});
  run('UPDATE users SET role=?,department=?,name=?,active=? WHERE id=?',
    [role??user.role, department??user.department, name??user.name, active??user.active, req.params.id]);
  res.json({ok:true});
});

// Deactivate user (soft delete)
app.delete('/api/users/:id', requireManager, (req,res) => {
  run('UPDATE users SET active=0 WHERE id=?',[req.params.id]);
  run("UPDATE availability SET status='offline' WHERE user_id=?",[req.params.id]);
  io.emit('availability_update');
  res.json({ok:true});
});

// Reactivate user
app.post('/api/users/:id/activate', requireManager, (req,res) => {
  run('UPDATE users SET active=1 WHERE id=?',[req.params.id]);
  res.json({ok:true});
});

// ── LOGS ────────────────────────────────────────────────────────────────────
app.get('/api/logs', requireManagerOrLeader, (req,res) => {
  const {date,user_id} = req.query;
  let query = `SELECT cl.*,u.name,u.email,u.department FROM clock_logs cl JOIN users u ON cl.user_id=u.id WHERE 1=1`;
  const params = [];
  // Team leaders only see their department
  if (req.user.role === 'team_leader') { query += ` AND u.department=?`; params.push(req.user.department); }
  if (date) { query += ` AND cl.date=?`; params.push(date); }
  if (user_id) { query += ` AND cl.user_id=?`; params.push(user_id); }
  query += ` ORDER BY cl.date DESC,cl.clock_in DESC`;
  res.json(all(query,params));
});

// ── SETTINGS ────────────────────────────────────────────────────────────────
app.get('/api/settings', requireAuth, (req,res) => {
  const rows = all('SELECT key,value FROM settings');
  const s = {}; rows.forEach(r => { try { s[r.key]=JSON.parse(r.value); } catch { s[r.key]=r.value; } });
  res.json(s);
});

app.put('/api/settings', requireManager, (req,res) => {
  for (const [k,v] of Object.entries(req.body)) {
    if (get('SELECT key FROM settings WHERE key=?',[k])) run('UPDATE settings SET value=? WHERE key=?',[JSON.stringify(v),k]);
    else run('INSERT INTO settings(key,value) VALUES(?,?)',[k,JSON.stringify(v)]);
  }
  io.emit('settings_update');
  res.json({ok:true});
});

app.get('/api/settings/departments', requireAuth, (req,res) => {
  res.json(all('SELECT * FROM departments WHERE active=1 ORDER BY name'));
});

app.post('/api/settings/departments', requireManager, (req,res) => {
  const {name,color,bg_color} = req.body;
  const id = uuidv4();
  run('INSERT INTO departments(id,name,color,bg_color) VALUES(?,?,?,?)',[id,name,color||'#333',bg_color||'#f0f0f0']);
  res.json({id,ok:true});
});

app.put('/api/settings/departments/:id', requireManager, (req,res) => {
  const {name,color,bg_color} = req.body;
  run('UPDATE departments SET name=?,color=?,bg_color=? WHERE id=?',[name,color,bg_color,req.params.id]);
  io.emit('settings_update');
  res.json({ok:true});
});

app.delete('/api/settings/departments/:id', requireManager, (req,res) => {
  run('UPDATE departments SET active=0 WHERE id=?',[req.params.id]);
  res.json({ok:true});
});

// ── SOCKET ──────────────────────────────────────────────────────────────────
io.on('connection', socket => {
  socket.on('request_availability', () => socket.emit('availability_update'));
});

// ── START ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
initDb().then(() => server.listen(PORT, () => console.log(`✅ ShiftManager backend running on http://localhost:${PORT}`)));

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
const io = new Server(server, {
  cors: { origin: 'http://localhost:3000', credentials: true }
});

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID';
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'shiftmanager-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

const requireAuth = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

const requireManager = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const user = get('SELECT role FROM users WHERE id = ?', [req.session.userId]);
  if (!user || user.role !== 'manager') return res.status(403).json({ error: 'Forbidden' });
  next();
};

app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body;
    const ticket = await client.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    const { email, name, picture } = ticket.getPayload();
    let user = get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      const id = uuidv4();
      run("INSERT INTO users (id, email, name, avatar, role) VALUES (?, ?, ?, ?, 'agent')", [id, email, name, picture]);
      user = get('SELECT * FROM users WHERE id = ?', [id]);
    } else {
      run('UPDATE users SET name = ?, avatar = ? WHERE id = ?', [name, picture, user.id]);
      user = get('SELECT * FROM users WHERE id = ?', [user.id]);
    }
    run("INSERT OR IGNORE INTO availability (user_id, status) VALUES (?, 'offline')", [user.id]);
    req.session.userId = user.id;
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: 'Invalid Google token' });
  }
});

app.post('/api/auth/demo', (req, res) => {
  const { email } = req.body;
  let user = get('SELECT * FROM users WHERE email = ?', [email]);
  if (!user) {
    const id = uuidv4();
    run("INSERT INTO users (id, email, name, role, department) VALUES (?, ?, ?, 'agent', 'CS')",
      [id, email, email.split('@')[0]]);
    run("INSERT OR IGNORE INTO availability (user_id, status) VALUES (?, 'offline')", [id]);
    user = get('SELECT * FROM users WHERE id = ?', [id]);
  }
  run("INSERT OR IGNORE INTO availability (user_id, status) VALUES (?, 'offline')", [user.id]);
  req.session.userId = user.id;
  res.json({ user });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const today = new Date().toISOString().split('T')[0];
  const openLog = get("SELECT * FROM clock_logs WHERE user_id = ? AND date = ? AND clock_out IS NULL", [userId, today]);
  if (openLog) run("UPDATE clock_logs SET clock_out = datetime('now') WHERE id = ?", [openLog.id]);
  run("UPDATE availability SET status = 'offline', last_updated = datetime('now') WHERE user_id = ?", [userId]);
  io.emit('availability_update');
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = get('SELECT * FROM users WHERE id = ?', [req.session.userId]);
  res.json({ user });
});

app.post('/api/clock/in', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const today = new Date().toISOString().split('T')[0];
  const ip = req.ip || req.connection.remoteAddress;
  const existing = get("SELECT * FROM clock_logs WHERE user_id = ? AND date = ? AND clock_out IS NULL", [userId, today]);
  if (existing) return res.status(400).json({ error: 'Already clocked in' });
  run("INSERT INTO clock_logs (id, user_id, clock_in, date, ip_address) VALUES (?, ?, datetime('now'), ?, ?)",
    [uuidv4(), userId, today, ip]);
  run("UPDATE availability SET status = 'available', clocked_in_at = datetime('now'), last_updated = datetime('now') WHERE user_id = ?", [userId]);
  io.emit('availability_update');
  res.json({ ok: true, message: 'Clocked in successfully' });
});

app.post('/api/clock/out', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const today = new Date().toISOString().split('T')[0];
  const openLog = get("SELECT * FROM clock_logs WHERE user_id = ? AND date = ? AND clock_out IS NULL", [userId, today]);
  if (!openLog) return res.status(400).json({ error: 'Not clocked in' });
  run("UPDATE clock_logs SET clock_out = datetime('now') WHERE id = ?", [openLog.id]);
  run("UPDATE availability SET status = 'offline', last_updated = datetime('now') WHERE user_id = ?", [userId]);
  io.emit('availability_update');
  res.json({ ok: true, message: 'Clocked out successfully' });
});

app.get('/api/clock/status', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const today = new Date().toISOString().split('T')[0];
  const openLog = get("SELECT * FROM clock_logs WHERE user_id = ? AND date = ? AND clock_out IS NULL", [userId, today]);
  res.json({ clockedIn: !!openLog, log: openLog });
});

app.get('/api/availability', requireAuth, (req, res) => {
  const data = all(`SELECT u.id, u.name, u.email, u.avatar, u.department, u.role,
    a.status, a.clocked_in_at, a.last_updated
    FROM users u LEFT JOIN availability a ON u.id = a.user_id
    WHERE u.role = 'agent' ORDER BY u.department, u.name`);
  res.json(data);
});

app.get('/api/shifts', requireAuth, (req, res) => {
  const { start, end } = req.query;
  let query = `SELECT s.*, u.name, u.email, u.department FROM shifts s JOIN users u ON s.user_id = u.id`;
  const params = [];
  if (start && end) { query += ` WHERE s.date >= ? AND s.date <= ?`; params.push(start, end); }
  query += ` ORDER BY s.date, s.start_time`;
  res.json(all(query, params));
});

app.post('/api/shifts', requireManager, (req, res) => {
  const { user_id, date, start_time, end_time, department, notes } = req.body;
  const id = uuidv4();
  run(`INSERT INTO shifts (id, user_id, date, start_time, end_time, department, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, user_id, date, start_time, end_time, department, notes, req.session.userId]);
  res.json({ id, ok: true });
});

app.put('/api/shifts/:id', requireManager, (req, res) => {
  const { date, start_time, end_time, department, notes } = req.body;
  run(`UPDATE shifts SET date = ?, start_time = ?, end_time = ?, department = ?, notes = ? WHERE id = ?`,
    [date, start_time, end_time, department, notes, req.params.id]);
  res.json({ ok: true });
});

app.delete('/api/shifts/:id', requireManager, (req, res) => {
  run(`DELETE FROM shifts WHERE id = ?`, [req.params.id]);
  res.json({ ok: true });
});

app.get('/api/users', requireManager, (req, res) => {
  res.json(all(`SELECT id, email, name, avatar, role, department FROM users ORDER BY name`));
});

app.put('/api/users/:id', requireManager, (req, res) => {
  const { role, department } = req.body;
  run(`UPDATE users SET role = ?, department = ? WHERE id = ?`, [role, department, req.params.id]);
  res.json({ ok: true });
});

app.get('/api/logs', requireManager, (req, res) => {
  const { date, user_id } = req.query;
  let query = `SELECT cl.*, u.name, u.email, u.department FROM clock_logs cl JOIN users u ON cl.user_id = u.id WHERE 1=1`;
  const params = [];
  if (date) { query += ` AND cl.date = ?`; params.push(date); }
  if (user_id) { query += ` AND cl.user_id = ?`; params.push(user_id); }
  query += ` ORDER BY cl.date DESC, cl.clock_in DESC`;
  res.json(all(query, params));
});

io.on('connection', (socket) => {
  socket.on('request_availability', () => socket.emit('availability_update'));
});

const PORT = process.env.PORT || 5000;
initDb().then(() => {
  server.listen(PORT, () => console.log(`✅ ShiftManager backend running on http://localhost:${PORT}`));
});

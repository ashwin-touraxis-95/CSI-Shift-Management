const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'shiftmanager.db');

let db;

function saveDb() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
    avatar TEXT, role TEXT DEFAULT 'agent', department TEXT DEFAULT 'CS',
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS shifts (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, date TEXT NOT NULL,
    start_time TEXT NOT NULL, end_time TEXT NOT NULL, department TEXT NOT NULL,
    notes TEXT, created_by TEXT, created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS clock_logs (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, clock_in TEXT, clock_out TEXT,
    date TEXT NOT NULL, ip_address TEXT, notes TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS availability (
    user_id TEXT PRIMARY KEY, status TEXT DEFAULT 'offline',
    clocked_in_at TEXT, last_updated TEXT DEFAULT (datetime('now'))
  )`);
  saveDb();

  const existing = get('SELECT id FROM users WHERE email = ?', ['manager@demo.com']);
  if (!existing) {
    run(`INSERT INTO users (id, email, name, role, department) VALUES (?, ?, ?, ?, ?)`,
      [uuidv4(), 'manager@demo.com', 'Demo Manager', 'manager', 'Management']);
  }
  console.log('✅ Database ready');
}

module.exports = { initDb, run, get, all, saveDb };

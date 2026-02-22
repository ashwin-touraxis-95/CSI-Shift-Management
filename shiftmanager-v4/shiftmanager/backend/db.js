const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'shiftmanager.db');
let db;

function saveDb() { const data = db.export(); fs.writeFileSync(DB_PATH, Buffer.from(data)); }
function run(sql, params = []) { db.run(sql, params); saveDb(); }
function get(sql, params = []) {
  const stmt = db.prepare(sql); stmt.bind(params);
  if (stmt.step()) { const row = stmt.getAsObject(); stmt.free(); return row; }
  stmt.free(); return null;
}
function all(sql, params = []) {
  const stmt = db.prepare(sql); stmt.bind(params);
  const rows = []; while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free(); return rows;
}

// Default permissions per role
const DEFAULT_PERMISSIONS = {
  manager: {
    view_availability: true, view_all_departments: true,
    manage_shifts: true, publish_shifts: true,
    view_clock_logs: true, view_own_logs_only: false,
    manage_users: false, manage_settings: false,
    view_drafts: true, assign_team_leaders: false,
  },
  team_leader: {
    view_availability: true, view_all_departments: false,
    manage_shifts: true, publish_shifts: false,
    view_clock_logs: true, view_own_logs_only: true,
    manage_users: false, manage_settings: false,
    view_drafts: true, assign_team_leaders: false,
  },
  agent: {
    view_availability: true, view_all_departments: true,
    manage_shifts: false, publish_shifts: false,
    view_clock_logs: false, view_own_logs_only: true,
    manage_users: false, manage_settings: false,
    view_drafts: false, assign_team_leaders: false,
  }
};

async function initDb() {
  const SQL = await initSqlJs();
  db = fs.existsSync(DB_PATH) ? new SQL.Database(fs.readFileSync(DB_PATH)) : new SQL.Database();

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
    avatar TEXT, role TEXT DEFAULT 'agent', department TEXT DEFAULT 'CS',
    active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS shifts (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, date TEXT NOT NULL,
    start_time TEXT NOT NULL, end_time TEXT NOT NULL, department TEXT NOT NULL,
    notes TEXT, status TEXT DEFAULT 'published', created_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS shift_templates (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, start_time TEXT NOT NULL,
    end_time TEXT NOT NULL, department TEXT NOT NULL, notes TEXT,
    created_by TEXT, created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS clock_logs (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, clock_in TEXT, clock_out TEXT,
    date TEXT NOT NULL, ip_address TEXT, notes TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS availability (
    user_id TEXT PRIMARY KEY, status TEXT DEFAULT 'offline',
    clocked_in_at TEXT, last_updated TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY, value TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY, name TEXT NOT NULL,
    color TEXT DEFAULT '#333333', bg_color TEXT DEFAULT '#F0F0F0', active INTEGER DEFAULT 1
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS role_permissions (
    role TEXT PRIMARY KEY, permissions TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS team_leader_agents (
    leader_id TEXT NOT NULL, agent_id TEXT NOT NULL,
    PRIMARY KEY (leader_id, agent_id)
  )`);
  saveDb();

  // Safe migrations
  for (const m of [
    'ALTER TABLE users ADD COLUMN active INTEGER DEFAULT 1',
    'ALTER TABLE shifts ADD COLUMN status TEXT DEFAULT "published"',
  ]) { try { db.run(m); saveDb(); } catch(e) {} }

  // Seed account admin
  if (!get('SELECT id FROM users WHERE email=?', ['admin@demo.com'])) {
    run('INSERT INTO users(id,email,name,role,department,active) VALUES(?,?,?,?,?,1)',
      [uuidv4(),'admin@demo.com','Account Admin','account_admin','Management']);
  }
  if (!get('SELECT id FROM users WHERE email=?', ['admin@touraxis.com'])) {
    run('INSERT INTO users(id,email,name,role,department,active) VALUES(?,?,?,?,?,1)',
      [uuidv4(),'admin@touraxis.com','TourAxis Admin','account_admin','Management']);
  }
  // Seed demo manager
  if (!get('SELECT id FROM users WHERE email=?', ['manager@demo.com'])) {
    run('INSERT INTO users(id,email,name,role,department,active) VALUES(?,?,?,?,?,1)',
      [uuidv4(),'manager@demo.com','Demo Manager','manager','Management']);
  }

  // Seed default permissions
  for (const [role, perms] of Object.entries(DEFAULT_PERMISSIONS)) {
    if (!get('SELECT role FROM role_permissions WHERE role=?', [role]))
      db.run('INSERT INTO role_permissions(role,permissions) VALUES(?,?)', [role, JSON.stringify(perms)]);
  }

  // Seed settings
  for (const [k,v] of [
    ['company_name','"ShiftManager"'],['location_label','"South Africa"'],
    ['primary_color','"#C0392B"'],['week_start','"monday"'],
    ['time_format','"24h"'],['default_shift_start','"07:00"'],['default_shift_end','"15:00"'],
  ]) { if (!get('SELECT key FROM settings WHERE key=?',[k])) db.run('INSERT INTO settings(key,value) VALUES(?,?)',[k,v]); }

  // Seed departments
  for (const [name,color,bg] of [
    ['CS','#856404','#FFF3CD'],['Sales','#383D41','#E2E3E5'],
    ['Travel Agents','#0C5460','#D1ECF1'],['Trainees','#721C24','#F8D7DA'],['Management','#155724','#D4EDDA'],
  ]) { if (!get('SELECT id FROM departments WHERE name=?',[name]))
    db.run('INSERT INTO departments(id,name,color,bg_color) VALUES(?,?,?,?)',[uuidv4(),name,color,bg]); }

  saveDb();
  console.log('✅ Database ready');
}

module.exports = { initDb, run, get, all, saveDb, DEFAULT_PERMISSIONS };

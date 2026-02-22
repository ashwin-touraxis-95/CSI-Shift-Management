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

const DEFAULT_PERMISSIONS = {
  manager: {
    view_availability: true, view_all_departments: true,
    manage_shifts: true, publish_shifts: true,
    view_clock_logs: true, view_own_logs_only: false,
    manage_users: true, manage_settings: false,
    view_drafts: true, assign_team_leaders: true,
    show_shifts_this_month: true, show_total_hours: true,
    can_set_active_status: true,
  },
  team_leader: {
    view_availability: true, view_all_departments: true,
    manage_shifts: true, publish_shifts: false,
    view_clock_logs: true, view_own_logs_only: true,
    manage_users: true, manage_settings: false,
    view_drafts: true, assign_team_leaders: false,
    show_shifts_this_month: true, show_total_hours: true,
    can_set_active_status: true,
  },
  agent: {
    view_availability: true, view_all_departments: true,
    manage_shifts: false, publish_shifts: false,
    view_clock_logs: false, view_own_logs_only: true,
    manage_users: false, manage_settings: false,
    view_drafts: false, assign_team_leaders: false,
    show_shifts_this_month: false, show_total_hours: false,
    can_set_active_status: false,
  }
};

const DEFAULT_THEME = {
  primary_color: '#C0392B',
  sidebar_bg: '#111827',
  sidebar_active: '#C0392B',
  sidebar_text: 'rgba(255,255,255,0.5)',
  app_bg: '#F1F5F9',
  card_bg: '#FFFFFF',
  heading_color: '#111827',
  body_color: '#334155',
  button_color: '#C0392B',
  online_color: '#22C55E',
  offline_color: '#94A3B8',
  draft_color: '#FCD34D',
  published_color: '#22C55E',
  login_bg: '#0F172A',
  login_card_bg: '#1E293B',
  company_name: 'ShiftManager',
  location_label: 'South Africa',
  company_logo: null,
};

async function initDb() {
  const SQL = await initSqlJs();
  db = fs.existsSync(DB_PATH) ? new SQL.Database(fs.readFileSync(DB_PATH)) : new SQL.Database();

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
    avatar TEXT, user_type TEXT DEFAULT 'agent', department TEXT DEFAULT 'CS',
    active INTEGER DEFAULT 1, onboarded INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY, name TEXT NOT NULL,
    color TEXT DEFAULT '#333333', bg_color TEXT DEFAULT '#F0F0F0', active INTEGER DEFAULT 1
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS department_managers (
    department_id TEXT NOT NULL, manager_id TEXT NOT NULL,
    PRIMARY KEY (department_id, manager_id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS job_roles (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, department_id TEXT NOT NULL,
    description TEXT, active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS job_role_leaders (
    job_role_id TEXT NOT NULL, leader_id TEXT NOT NULL,
    PRIMARY KEY (job_role_id, leader_id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS agent_job_roles (
    agent_id TEXT NOT NULL, job_role_id TEXT NOT NULL,
    PRIMARY KEY (agent_id, job_role_id)
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
  db.run(`CREATE TABLE IF NOT EXISTS theme (
    key TEXT PRIMARY KEY, value TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS role_permissions (
    role TEXT PRIMARY KEY, permissions TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS team_leader_agents (
    leader_id TEXT NOT NULL, agent_id TEXT NOT NULL,
    PRIMARY KEY (leader_id, agent_id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY, action TEXT NOT NULL, performed_by TEXT NOT NULL,
    performed_by_name TEXT, target_user_id TEXT, target_user_email TEXT,
    target_user_name TEXT, target_user_role TEXT, target_user_department TEXT,
    details TEXT, created_at TEXT DEFAULT (datetime('now'))
  )`);
  saveDb();

  // Safe migrations
  for (const m of [
    'ALTER TABLE users ADD COLUMN user_type TEXT DEFAULT "agent"',
    'ALTER TABLE users ADD COLUMN onboarded INTEGER DEFAULT 0',
    // Copy old role column to user_type if exists
  ]) { try { db.run(m); saveDb(); } catch(e) {} }

  // Migrate role -> user_type
  try { db.run('UPDATE users SET user_type = role WHERE user_type IS NULL OR user_type = "agent"'); saveDb(); } catch(e) {}

  // Seed admins
  if (!get('SELECT id FROM users WHERE email=?', ['admin@demo.com']))
    run('INSERT INTO users(id,email,name,user_type,department,active,onboarded) VALUES(?,?,?,?,?,1,1)',
      [uuidv4(),'admin@demo.com','Account Admin','account_admin','Management']);
  if (!get('SELECT id FROM users WHERE email=?', ['admin@touraxis.com']))
    run('INSERT INTO users(id,email,name,user_type,department,active,onboarded) VALUES(?,?,?,?,?,1,1)',
      [uuidv4(),'admin@touraxis.com','TourAxis Admin','account_admin','Management']);
  if (!get('SELECT id FROM users WHERE email=?', ['manager@demo.com']))
    run('INSERT INTO users(id,email,name,user_type,department,active,onboarded) VALUES(?,?,?,?,?,1,1)',
      [uuidv4(),'manager@demo.com','Demo Manager','manager','Management']);

  // Seed permissions
  for (const [role, perms] of Object.entries(DEFAULT_PERMISSIONS)) {
    if (!get('SELECT role FROM role_permissions WHERE role=?', [role]))
      db.run('INSERT INTO role_permissions(role,permissions) VALUES(?,?)', [role, JSON.stringify(perms)]);
    else {
      const existing = get('SELECT permissions FROM role_permissions WHERE role=?', [role]);
      try {
        const merged = { ...perms, ...JSON.parse(existing.permissions) };
        db.run('UPDATE role_permissions SET permissions=? WHERE role=?', [JSON.stringify(merged), role]);
      } catch(e) {}
    }
  }

  // Seed theme
  for (const [k, v] of Object.entries(DEFAULT_THEME)) {
    if (!get('SELECT key FROM theme WHERE key=?', [k]))
      db.run('INSERT INTO theme(key,value) VALUES(?,?)', [k, JSON.stringify(v)]);
  }

  // Seed departments
  for (const [name,color,bg] of [
    ['CS','#856404','#FFF3CD'],['Sales','#383D41','#E2E3E5'],
    ['Travel Agents','#0C5460','#D1ECF1'],['Trainees','#721C24','#F8D7DA'],['Management','#155724','#D4EDDA'],
  ]) { if (!get('SELECT id FROM departments WHERE name=?',[name]))
    db.run('INSERT INTO departments(id,name,color,bg_color) VALUES(?,?,?,?)',[uuidv4(),name,color,bg]); }

  saveDb();
  console.log('✅ Database ready');
}

module.exports = { initDb, run, get, all, saveDb, DEFAULT_PERMISSIONS, DEFAULT_THEME };

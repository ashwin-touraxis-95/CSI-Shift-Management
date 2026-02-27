const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

async function get(sql, params = []) {
  const result = await query(sql, params);
  return result.rows[0] || null;
}

async function all(sql, params = []) {
  const result = await query(sql, params);
  return result.rows;
}

async function run(sql, params = []) {
  return await query(sql, params);
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
  primary_color: '#C0392B', sidebar_bg: '#111827', sidebar_active: '#C0392B',
  sidebar_text: 'rgba(255,255,255,0.5)', app_bg: '#F1F5F9', card_bg: '#FFFFFF',
  heading_color: '#111827', body_color: '#334155', button_color: '#C0392B',
  online_color: '#22C55E', offline_color: '#94A3B8', draft_color: '#FCD34D',
  published_color: '#22C55E', login_bg: '#0F172A', login_card_bg: '#1E293B',
  company_name: 'ShiftManager', location_label: 'South Africa',
  login_subtitle: 'Operations Platform', company_logo: null,
  footer_line1: 'ShiftManager v12', footer_line2: 'Built by Ashwin Halford', footer_line3: '',
};

const DEFAULT_BREAK_TYPES = [
  { name: 'Lunch',         icon: '🍽️', color: '#F59E0B', max_minutes: 60 },
  { name: 'Tea',           icon: '☕',  color: '#8B5CF6', max_minutes: 15 },
  { name: 'Comfort Break', icon: '🚻', color: '#06B6D4', max_minutes: 10 },
  { name: 'Meeting',       icon: '📋', color: '#3B82F6', max_minutes: null },
  { name: 'Training',      icon: '📚', color: '#10B981', max_minutes: null },
];

async function initDb() {
  console.log('🔄 Connecting to PostgreSQL...');

  await query(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
    avatar TEXT, user_type TEXT DEFAULT 'agent', department TEXT DEFAULT 'CS',
    active INTEGER DEFAULT 1, onboarded INTEGER DEFAULT 0,
    password_hash TEXT DEFAULT NULL, force_password_change INTEGER DEFAULT 0,
    timezone TEXT DEFAULT 'Africa/Johannesburg',
    created_at TEXT DEFAULT (NOW())
  )`);

  await query(`CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY, name TEXT NOT NULL,
    color TEXT DEFAULT '#333333', bg_color TEXT DEFAULT '#F0F0F0', active INTEGER DEFAULT 1
  )`);

  await query(`CREATE TABLE IF NOT EXISTS department_managers (
    department_id TEXT NOT NULL, manager_id TEXT NOT NULL,
    PRIMARY KEY (department_id, manager_id)
  )`);

  await query(`CREATE TABLE IF NOT EXISTS job_roles (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, department_id TEXT NOT NULL,
    description TEXT, active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (NOW())
  )`);

  await query(`CREATE TABLE IF NOT EXISTS job_role_leaders (
    job_role_id TEXT NOT NULL, leader_id TEXT NOT NULL,
    PRIMARY KEY (job_role_id, leader_id)
  )`);

  await query(`CREATE TABLE IF NOT EXISTS agent_job_roles (
    agent_id TEXT NOT NULL, job_role_id TEXT NOT NULL,
    PRIMARY KEY (agent_id, job_role_id)
  )`);

  await query(`CREATE TABLE IF NOT EXISTS shifts (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, date TEXT NOT NULL,
    start_time TEXT NOT NULL, end_time TEXT NOT NULL, department TEXT NOT NULL,
    notes TEXT, status TEXT DEFAULT 'published', created_by TEXT,
    created_at TEXT DEFAULT (NOW())
  )`);

  await query(`CREATE TABLE IF NOT EXISTS shift_templates (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, start_time TEXT NOT NULL,
    end_time TEXT NOT NULL, department TEXT, notes TEXT,
    created_by TEXT, created_at TEXT DEFAULT (NOW())
  )`);

  await query(`CREATE TABLE IF NOT EXISTS clock_logs (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, clock_in TEXT, clock_out TEXT,
    date TEXT NOT NULL, ip_address TEXT, notes TEXT
  )`);

  await query(`CREATE TABLE IF NOT EXISTS break_types (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, icon TEXT DEFAULT '⏸️',
    color TEXT DEFAULT '#6B7280', max_minutes INTEGER DEFAULT NULL,
    active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (NOW())
  )`);

  await query(`CREATE TABLE IF NOT EXISTS break_logs (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, break_type_id TEXT NOT NULL,
    break_type_name TEXT NOT NULL, break_type_icon TEXT, break_type_color TEXT,
    started_at TEXT NOT NULL, ended_at TEXT,
    duration_minutes INTEGER DEFAULT NULL, date TEXT NOT NULL
  )`);

  await query(`CREATE TABLE IF NOT EXISTS availability (
    user_id TEXT PRIMARY KEY, status TEXT DEFAULT 'offline',
    break_type_id TEXT DEFAULT NULL, break_type_name TEXT DEFAULT NULL,
    break_type_icon TEXT DEFAULT NULL, break_type_color TEXT DEFAULT NULL,
    clocked_in_at TEXT, last_updated TEXT DEFAULT (NOW())
  )`);

  await query(`CREATE TABLE IF NOT EXISTS theme (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
  await query(`CREATE TABLE IF NOT EXISTS role_permissions (role TEXT PRIMARY KEY, permissions TEXT NOT NULL)`);
  await query(`CREATE TABLE IF NOT EXISTS team_leader_agents (leader_id TEXT NOT NULL, agent_id TEXT NOT NULL, PRIMARY KEY (leader_id, agent_id))`);

  await query(`CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY, action TEXT NOT NULL, performed_by TEXT NOT NULL,
    performed_by_name TEXT, target_user_id TEXT, target_user_email TEXT,
    target_user_name TEXT, target_user_role TEXT, target_user_department TEXT,
    details TEXT, created_at TEXT DEFAULT (NOW())
  )`);

  // Safe migrations for existing deployments
  try { await query("ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT 'Africa/Johannesburg'"); } catch(e) {}
  // Make shift_templates.department nullable (was NOT NULL in earlier versions)
  try { await query("ALTER TABLE shift_templates ALTER COLUMN department DROP NOT NULL"); } catch(e) {}
  // Set default empty string for any existing null departments
  try { await query("UPDATE shift_templates SET department='' WHERE department IS NULL"); } catch(e) {}
  // Ensure all active users have an availability record
  try {
    await query("INSERT INTO availability(user_id,status) SELECT id,'offline' FROM users WHERE active=1 ON CONFLICT DO NOTHING");
  } catch(e) {}

  // Seed admin accounts
  for (const [email, name, user_type, dept] of [
    ['admin@touraxis.com', 'TourAxis Admin', 'account_admin', 'Management'],
    ['admin@demo.com',     'Account Admin',  'account_admin', 'Management'],
    ['manager@demo.com',   'Demo Manager',   'manager',       'Management'],
  ]) {
    const existing = await get('SELECT id FROM users WHERE email=$1', [email]);
    if (!existing) {
      const id = uuidv4();
      await run('INSERT INTO users(id,email,name,user_type,department,active,onboarded,force_password_change) VALUES($1,$2,$3,$4,$5,1,1,1)',
        [id, email, name, user_type, dept]);
      await run("INSERT INTO availability(user_id,status) VALUES($1,'offline') ON CONFLICT DO NOTHING", [id]);
    }
  }

  // Seed permissions
  for (const [role, perms] of Object.entries(DEFAULT_PERMISSIONS)) {
    const existing = await get('SELECT role FROM role_permissions WHERE role=$1', [role]);
    if (!existing) {
      await run('INSERT INTO role_permissions(role,permissions) VALUES($1,$2)', [role, JSON.stringify(perms)]);
    } else {
      const current = await get('SELECT permissions FROM role_permissions WHERE role=$1', [role]);
      try {
        const merged = { ...perms, ...JSON.parse(current.permissions) };
        await run('UPDATE role_permissions SET permissions=$1 WHERE role=$2', [JSON.stringify(merged), role]);
      } catch(e) {}
    }
  }

  // Seed theme
  for (const [k, v] of Object.entries(DEFAULT_THEME)) {
    const existing = await get('SELECT key FROM theme WHERE key=$1', [k]);
    if (!existing) await run('INSERT INTO theme(key,value) VALUES($1,$2)', [k, JSON.stringify(v)]);
  }

  // Seed break types
  for (let i = 0; i < DEFAULT_BREAK_TYPES.length; i++) {
    const bt = DEFAULT_BREAK_TYPES[i];
    const existing = await get('SELECT id FROM break_types WHERE name=$1', [bt.name]);
    if (!existing) {
      await run('INSERT INTO break_types(id,name,icon,color,max_minutes,sort_order,active) VALUES($1,$2,$3,$4,$5,$6,1)',
        [uuidv4(), bt.name, bt.icon, bt.color, bt.max_minutes, i]);
    } else {
      // Ensure existing ones are active
      await run('UPDATE break_types SET active=1 WHERE name=$1 AND active=0', [bt.name]);
    }
  }

  // Seed departments
  for (const [name, color, bg] of [
    ['CS','#856404','#FFF3CD'], ['Sales','#383D41','#E2E3E5'],
    ['Travel Agents','#0C5460','#D1ECF1'], ['Trainees','#721C24','#F8D7DA'], ['Management','#155724','#D4EDDA'],
  ]) {
    const existing = await get('SELECT id FROM departments WHERE name=$1', [name]);
    if (!existing) await run('INSERT INTO departments(id,name,color,bg_color) VALUES($1,$2,$3,$4)', [uuidv4(), name, color, bg]);
  }

  console.log('✅ ShiftManager v12 database ready');
}

module.exports = { initDb, run, get, all, query, pool, DEFAULT_PERMISSIONS, DEFAULT_THEME };

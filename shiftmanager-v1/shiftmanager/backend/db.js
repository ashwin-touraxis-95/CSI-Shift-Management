const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'shiftmanager.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    avatar TEXT,
    role TEXT DEFAULT 'agent',
    department TEXT DEFAULT 'CS',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS shifts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    department TEXT NOT NULL,
    notes TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS clock_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    clock_in DATETIME,
    clock_out DATETIME,
    date TEXT NOT NULL,
    ip_address TEXT,
    notes TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS availability (
    user_id TEXT PRIMARY KEY,
    status TEXT DEFAULT 'offline',
    clocked_in_at DATETIME,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Seed a demo manager account
const existing = db.prepare('SELECT id FROM users WHERE email = ?').get('manager@demo.com');
if (!existing) {
  const { v4: uuidv4 } = require('uuid');
  db.prepare(`
    INSERT INTO users (id, email, name, role, department)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), 'manager@demo.com', 'Demo Manager', 'manager', 'Management');
}

module.exports = db;

const { google } = require('googleapis');
const { all } = require('./db');

const SHEET_ID = () => process.env.GOOGLE_SHEET_ID;

function getClient() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) return null;
  try {
    const credentials = JSON.parse(keyJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return google.sheets({ version: 'v4', auth });
  } catch(e) {
    console.error('❌ Sheets credentials error:', e.message);
    return null;
  }
}

// Ensure a sheet/tab exists, create if not
async function ensureSheet(sheets, title) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID() });
  const exists = meta.data.sheets.some(s => s.properties.title === title);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID(),
      requestBody: {
        requests: [{ addSheet: { properties: { title } } }]
      }
    });
    console.log(`  ✅ Created sheet tab: ${title}`);
  }
}

// Get existing IDs already in the sheet to avoid duplicates
async function getExistingIds(sheets, tabName) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID(),
      range: `${tabName}!A:A`,
    });
    const rows = res.data.values || [];
    // Skip header row (first row)
    return new Set(rows.slice(1).map(r => r[0]).filter(Boolean));
  } catch(e) {
    return new Set();
  }
}

// Add header row if sheet is empty
async function ensureHeader(sheets, tabName, headers) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID(),
      range: `${tabName}!A1:Z1`,
    });
    const firstRow = (res.data.values || [])[0];
    if (!firstRow || firstRow.length === 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID(),
        range: `${tabName}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [headers] },
      });
      console.log(`  ✅ Added headers to ${tabName}`);
    }
  } catch(e) {
    console.error(`  ⚠️  Header error for ${tabName}:`, e.message);
  }
}

// Append only NEW rows (not already in sheet)
async function appendNewRows(sheets, tabName, headers, rows) {
  if (!rows.length) {
    console.log(`  ⚠️  ${tabName}: 0 rows`);
    return { appended: 0 };
  }

  const existingIds = await getExistingIds(sheets, tabName);
  const newRows = rows.filter(r => !existingIds.has(String(r.id || '')));

  if (!newRows.length) {
    console.log(`  ✅ ${tabName}: ${rows.length} rows (no new data)`);
    return { appended: 0 };
  }

  // Convert to array format matching headers
  const values = newRows.map(row => headers.map(h => {
    const v = row[h];
    if (v === null || v === undefined) return '';
    return String(v);
  }));

  // Append in batches of 500
  const batchSize = 500;
  for (let i = 0; i < values.length; i += batchSize) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID(),
      range: `${tabName}!A1`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: values.slice(i, i + batchSize) },
    });
  }

  console.log(`  ✅ ${tabName}: +${newRows.length} new rows (${rows.length - newRows.length} already existed)`);
  return { appended: newRows.length };
}

const TABLES = [
  {
    tab: 'users',
    headers: ['id','email','name','user_type','department','location','timezone','active','created_at'],
    query: `SELECT id,email,name,user_type,department,
            COALESCE(location,'SA') as location,
            COALESCE(timezone,'Africa/Johannesburg') as timezone,
            COALESCE(active,1) as active,
            COALESCE(created_at,'') as created_at FROM users`,
  },
  {
    tab: 'shifts',
    headers: ['id','user_name','user_email','department','location','date','start_time','end_time','status','color','notes','created_at'],
    query: `SELECT s.id, COALESCE(u.name,'Unknown') as user_name,
            COALESCE(u.email,'') as user_email,
            s.department, COALESCE(u.location,'SA') as location,
            s.date, s.start_time, s.end_time, s.status,
            COALESCE(s.color,'') as color,
            COALESCE(s.notes,'') as notes,
            COALESCE(s.created_at,'') as created_at
            FROM shifts s LEFT JOIN users u ON s.user_id=u.id`,
  },
  {
    tab: 'leave',
    headers: ['id','user_name','user_email','department','leave_type','start_date','end_date','status','notes','created_at'],
    query: `SELECT l.id, COALESCE(u.name,'Unknown') as user_name,
            COALESCE(u.email,'') as user_email,
            COALESCE(u.department,'') as department,
            COALESCE(l.leave_type,'') as leave_type,
            l.start_date, l.end_date,
            COALESCE(l.status,'pending') as status,
            COALESCE(l.notes,'') as notes,
            COALESCE(l.created_at,'') as created_at
            FROM leaves l LEFT JOIN users u ON l.user_id=u.id`,
  },
  {
    tab: 'shift_templates',
    headers: ['id','name','start_time','end_time','color','text_color','created_at'],
    query: `SELECT id, COALESCE(name,'') as name, start_time, end_time,
            COALESCE(color,'') as color, COALESCE(text_color,'') as text_color,
            COALESCE(created_at,'') as created_at FROM shift_templates`,
  },
  {
    tab: 'public_holidays',
    headers: ['id','name','date','location','created_at'],
    query: `SELECT id, name, date,
            COALESCE(location,'SA') as location,
            COALESCE(created_at,'') as created_at FROM public_holidays ORDER BY date`,
  },
  {
    tab: 'audit_log',
    headers: ['id','action','performed_by_name','target_user_name','target_user_email','target_user_role','target_user_department','details','created_at'],
    query: `SELECT id, action, COALESCE(performed_by_name,'') as performed_by_name,
            COALESCE(target_user_name,'') as target_user_name,
            COALESCE(target_user_email,'') as target_user_email,
            COALESCE(target_user_role,'') as target_user_role,
            COALESCE(target_user_department,'') as target_user_department,
            COALESCE(details,'') as details,
            COALESCE(created_at,'') as created_at FROM audit_log ORDER BY created_at ASC`,
  },
  {
    tab: 'clock_logs',
    headers: ['id','user_name','clock_in','clock_out','date'],
    query: `SELECT cl.id, COALESCE(u.name,'Unknown') as user_name,
            TO_CHAR(cl.clock_in::timestamptz, 'HH24:MI:SS') as clock_in,
            COALESCE(TO_CHAR(cl.clock_out::timestamptz, 'HH24:MI:SS'),'') as clock_out,
            cl.date FROM clock_logs cl LEFT JOIN users u ON cl.user_id=u.id ORDER BY cl.date DESC LIMIT 10000`,
  },
  {
    tab: 'break_logs',
    headers: ['id','user_name','break_type_name','started_at','ended_at','duration_minutes','date'],
    query: `SELECT bl.id, COALESCE(u.name,'Unknown') as user_name,
            COALESCE(bl.break_type_name,'') as break_type_name,
            TO_CHAR(bl.started_at::timestamptz, 'HH24:MI:SS') as started_at,
            COALESCE(TO_CHAR(bl.ended_at::timestamptz, 'HH24:MI:SS'),'') as ended_at,
            COALESCE(bl.duration_minutes,0) as duration_minutes,
            bl.date FROM break_logs bl LEFT JOIN users u ON bl.user_id=u.id ORDER BY bl.date DESC LIMIT 10000`,
  },
  {
    tab: 'break_types',
    headers: ['id','name','icon','color','max_minutes','active'],
    query: `SELECT id,name,icon,color,COALESCE(max_minutes::text,'') as max_minutes,active FROM break_types ORDER BY sort_order,name`,
  },
  {
    tab: 'departments',
    headers: ['id','name','color'],
    query: `SELECT id,name,COALESCE(color,'#333333') as color FROM departments WHERE active=1`,
  },
];

async function runSync() {
  const sheetId = SHEET_ID();
  if (!sheetId) return { ok: false, error: 'GOOGLE_SHEET_ID not set in Railway Variables' };

  const sheets = getClient();
  if (!sheets) return { ok: false, error: 'GOOGLE_SERVICE_ACCOUNT_KEY not configured' };

  console.log('🔄 Google Sheets sync starting...');
  const t0 = Date.now();
  const results = {};

  for (const t of TABLES) {
    try {
      await ensureSheet(sheets, t.tab);
      await ensureHeader(sheets, t.tab, t.headers);
      const rows = await all(t.query);
      const result = await appendNewRows(sheets, t.tab, t.headers, rows);
      results[t.tab] = { ok: true, rows: rows.length, appended: result.appended };
    } catch(e) {
      console.error(`  ❌ ${t.tab} failed:`, e.message);
      results[t.tab] = { ok: false, error: e.message };
    }
  }

  const allOk = Object.values(results).every(r => r.ok);
  const duration = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`${allOk ? '✅' : '⚠️'} Sheets sync complete in ${duration}s`);
  return { ok: allOk, duration, synced_at: new Date().toISOString(), tables: results };
}

module.exports = { runSync };

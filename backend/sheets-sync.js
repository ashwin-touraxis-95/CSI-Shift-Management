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
    headers: ['id','email','name','user_type','department','timezone','active','created_at'],
    query: `SELECT id,email,name,user_type,department,
            COALESCE(timezone,'Africa/Johannesburg') as timezone,
            COALESCE(active,1) as active,
            COALESCE(created_at,'') as created_at FROM users`,
  },
  {
    tab: 'shifts',
    headers: ['id','user_id','date','start_time','end_time','department','notes','status','created_at'],
    query: `SELECT id,user_id,date,start_time,end_time,department,
            COALESCE(notes,'') as notes,status,
            COALESCE(created_at,'') as created_at FROM shifts`,
  },
  {
    tab: 'clock_logs',
    headers: ['id','user_id','clock_in','clock_out','date'],
    query: `SELECT id,user_id,
            COALESCE(clock_in,'') as clock_in,
            COALESCE(clock_out,'') as clock_out,
            date FROM clock_logs ORDER BY date DESC LIMIT 10000`,
  },
  {
    tab: 'break_logs',
    headers: ['id','user_id','break_type_name','started_at','ended_at','duration_minutes','date'],
    query: `SELECT id,user_id,
            COALESCE(break_type_name,'') as break_type_name,
            started_at,
            COALESCE(ended_at,'') as ended_at,
            COALESCE(duration_minutes,0) as duration_minutes,
            date FROM break_logs ORDER BY date DESC LIMIT 10000`,
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

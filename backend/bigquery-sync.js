const { BigQuery } = require('@google-cloud/bigquery');
const { all } = require('./db');

let bigqueryClient = null;

function getClient() {
  if (bigqueryClient) return bigqueryClient;
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) return null;
  try {
    bigqueryClient = new BigQuery({
      projectId: process.env.BIGQUERY_PROJECT_ID || 'touraxis-shiftmanager',
      credentials: JSON.parse(keyJson),
    });
    return bigqueryClient;
  } catch (e) {
    console.error('❌ BigQuery credentials parse error:', e.message);
    return null;
  }
}

const DATASET = () => process.env.BIGQUERY_DATASET || 'shiftmanager';

const SCHEMAS = {
  users: [
    { name: 'id',         type: 'STRING' },
    { name: 'email',      type: 'STRING' },
    { name: 'name',       type: 'STRING' },
    { name: 'user_type',  type: 'STRING' },
    { name: 'department', type: 'STRING' },
    { name: 'timezone',   type: 'STRING' },
    { name: 'active',     type: 'INTEGER' },
    { name: 'created_at', type: 'STRING' },
  ],
  shifts: [
    { name: 'id',         type: 'STRING' },
    { name: 'user_id',    type: 'STRING' },
    { name: 'date',       type: 'STRING' },
    { name: 'start_time', type: 'STRING' },
    { name: 'end_time',   type: 'STRING' },
    { name: 'department', type: 'STRING' },
    { name: 'notes',      type: 'STRING' },
    { name: 'status',     type: 'STRING' },
    { name: 'created_at', type: 'STRING' },
  ],
  clock_logs: [
    { name: 'id',        type: 'STRING' },
    { name: 'user_id',   type: 'STRING' },
    { name: 'clock_in',  type: 'STRING' },
    { name: 'clock_out', type: 'STRING' },
    { name: 'date',      type: 'STRING' },
  ],
  break_logs: [
    { name: 'id',               type: 'STRING' },
    { name: 'user_id',          type: 'STRING' },
    { name: 'break_type_name',  type: 'STRING' },
    { name: 'started_at',       type: 'STRING' },
    { name: 'ended_at',         type: 'STRING' },
    { name: 'duration_minutes', type: 'INTEGER' },
    { name: 'date',             type: 'STRING' },
  ],
  departments: [
    { name: 'id',    type: 'STRING' },
    { name: 'name',  type: 'STRING' },
    { name: 'color', type: 'STRING' },
  ],
};

// Convert rows to newline-delimited JSON string for load job
function rowsToNDJSON(rows) {
  return rows.map(r => JSON.stringify(r)).join('\n');
}

async function syncTable(client, tableName, rows) {
  const dataset = client.dataset(DATASET());
  const table = dataset.table(tableName);

  // Drop and recreate table for clean full-replace
  try {
    const [exists] = await table.exists();
    if (exists) await table.delete();
  } catch(e) { /* ignore */ }

  await dataset.createTable(tableName, { schema: SCHEMAS[tableName] });

  if (!rows.length) {
    console.log(`  ⚠️  ${tableName}: 0 rows`);
    return;
  }

  // Use load job with NDJSON — works on BigQuery free tier (Sandbox)
  // Unlike streaming inserts, load jobs are always free
  const ndjson = rowsToNDJSON(rows);
  const { Readable } = require('stream');
  const stream = new Readable();
  stream.push(ndjson);
  stream.push(null);

  const [job] = await table.createLoadJob(stream, {
    sourceFormat: 'NEWLINE_DELIMITED_JSON',
    schema: { fields: SCHEMAS[tableName] },
    writeDisposition: 'WRITE_TRUNCATE',
    createDisposition: 'CREATE_IF_NEEDED',
  });

  // Wait for job to complete
  await job.promise();
  const [metadata] = await job.getMetadata();

  if (metadata.status.errorResult) {
    throw new Error(metadata.status.errorResult.message);
  }

  console.log(`  ✅ ${tableName}: ${rows.length} rows loaded`);
}

async function runSync() {
  const client = getClient();
  if (!client) return { ok: false, error: 'GOOGLE_SERVICE_ACCOUNT_KEY not set in Railway Variables' };

  console.log('🔄 BigQuery sync starting...');
  const t0 = Date.now();
  const results = {};

  try {
    // Ensure dataset exists
    const dataset = client.dataset(DATASET());
    const [dsExists] = await dataset.exists();
    if (!dsExists) {
      await client.createDataset(DATASET(), { location: 'US' });
      console.log(`  ✅ Created dataset: ${DATASET()}`);
    }
  } catch(e) {
    return { ok: false, error: `Dataset error: ${e.message}` };
  }

  const tables = [
    {
      name: 'users',
      query: `SELECT id,email,name,user_type,department,
               COALESCE(timezone,'Africa/Johannesburg') as timezone,
               COALESCE(active,1) as active,
               COALESCE(created_at,'') as created_at
               FROM users`
    },
    {
      name: 'shifts',
      query: `SELECT id,user_id,date,start_time,end_time,department,
               COALESCE(notes,'') as notes,status,
               COALESCE(created_at,'') as created_at
               FROM shifts`
    },
    {
      name: 'clock_logs',
      query: `SELECT id,user_id,
               COALESCE(clock_in,'') as clock_in,
               COALESCE(clock_out,'') as clock_out,
               date FROM clock_logs ORDER BY date DESC LIMIT 10000`
    },
    {
      name: 'break_logs',
      query: `SELECT id,user_id,
               COALESCE(break_type_name,'') as break_type_name,
               started_at,
               COALESCE(ended_at,'') as ended_at,
               COALESCE(duration_minutes,0) as duration_minutes,
               date FROM break_logs ORDER BY date DESC LIMIT 10000`
    },
    {
      name: 'departments',
      query: `SELECT id,name,COALESCE(color,'#333333') as color FROM departments WHERE active=1`
    },
  ];

  for (const t of tables) {
    try {
      const rows = await all(t.query);
      await syncTable(client, t.name, rows);
      results[t.name] = { ok: true, rows: rows.length };
    } catch(e) {
      console.error(`  ❌ ${t.name} failed:`, e.message);
      results[t.name] = { ok: false, error: e.message };
    }
  }

  const allOk = Object.values(results).every(r => r.ok);
  const duration = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`${allOk ? '✅' : '⚠️'} BigQuery sync complete in ${duration}s`);
  return { ok: allOk, duration, synced_at: new Date().toISOString(), tables: results };
}

module.exports = { runSync };

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
const PROJECT = () => process.env.BIGQUERY_PROJECT_ID || 'touraxis-shiftmanager';

const SCHEMAS = {
  users:       [
    {name:'id',type:'STRING'},{name:'email',type:'STRING'},{name:'name',type:'STRING'},
    {name:'user_type',type:'STRING'},{name:'department',type:'STRING'},
    {name:'timezone',type:'STRING'},{name:'active',type:'INTEGER'},{name:'created_at',type:'STRING'},
  ],
  shifts:      [
    {name:'id',type:'STRING'},{name:'user_id',type:'STRING'},{name:'date',type:'STRING'},
    {name:'start_time',type:'STRING'},{name:'end_time',type:'STRING'},
    {name:'department',type:'STRING'},{name:'notes',type:'STRING'},
    {name:'status',type:'STRING'},{name:'created_at',type:'STRING'},
  ],
  clock_logs:  [
    {name:'id',type:'STRING'},{name:'user_id',type:'STRING'},
    {name:'clock_in',type:'STRING'},{name:'clock_out',type:'STRING'},{name:'date',type:'STRING'},
  ],
  break_logs:  [
    {name:'id',type:'STRING'},{name:'user_id',type:'STRING'},
    {name:'break_type_name',type:'STRING'},{name:'started_at',type:'STRING'},
    {name:'ended_at',type:'STRING'},{name:'duration_minutes',type:'INTEGER'},{name:'date',type:'STRING'},
  ],
  departments: [
    {name:'id',type:'STRING'},{name:'name',type:'STRING'},{name:'color',type:'STRING'},
  ],
};

async function ensureTable(client, tableName) {
  const dataset = client.dataset(DATASET());
  const table = dataset.table(tableName);
  const [exists] = await table.exists();
  if (!exists) {
    await dataset.createTable(tableName, { schema: SCHEMAS[tableName] });
    console.log(`  ✅ Created table: ${tableName}`);
  }
}

// Use SQL INSERT via query jobs - works on free tier sandbox
async function syncTableViaSQL(client, tableName, rows) {
  if (!rows.length) {
    console.log(`  ⚠️  ${tableName}: 0 rows`);
    return;
  }

  const fullTable = `\`${PROJECT()}.${DATASET()}.${tableName}\``;
  const fields = SCHEMAS[tableName].map(f => f.name);

  // Step 1: Delete all existing rows via DML (works in sandbox)
  try {
    const [deleteJob] = await client.createQueryJob({
      query: `DELETE FROM ${fullTable} WHERE TRUE`,
      useLegacySql: false,
    });
    await deleteJob.promise();
  } catch(e) {
    // Table might be empty, ignore
  }

  // Step 2: INSERT in batches of 50 rows using VALUES
  const batchSize = 50;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values = batch.map(row => {
      const vals = fields.map(f => {
        const v = row[f];
        if (v === null || v === undefined) return 'NULL';
        if (typeof v === 'number') return v;
        // Escape single quotes
        return `'${String(v).replace(/'/g, "\\'")}'`;
      });
      return `(${vals.join(',')})`;
    }).join(',\n');

    const insertSQL = `INSERT INTO ${fullTable} (${fields.join(',')}) VALUES\n${values}`;
    const [job] = await client.createQueryJob({ query: insertSQL, useLegacySql: false });
    await job.promise();
  }
  console.log(`  ✅ ${tableName}: ${rows.length} rows synced`);
}

async function runSync() {
  const client = getClient();
  if (!client) return { ok: false, error: 'GOOGLE_SERVICE_ACCOUNT_KEY not set in Railway Variables' };

  console.log('🔄 BigQuery sync starting...');
  const t0 = Date.now();
  const results = {};

  // Ensure dataset exists
  try {
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
               COALESCE(created_at,'') as created_at FROM users`
    },
    {
      name: 'shifts',
      query: `SELECT id,user_id,date,start_time,end_time,department,
               COALESCE(notes,'') as notes,status,
               COALESCE(created_at,'') as created_at FROM shifts`
    },
    {
      name: 'clock_logs',
      query: `SELECT id,user_id,COALESCE(clock_in,'') as clock_in,
               COALESCE(clock_out,'') as clock_out,date FROM clock_logs
               ORDER BY date DESC LIMIT 10000`
    },
    {
      name: 'break_logs',
      query: `SELECT id,user_id,COALESCE(break_type_name,'') as break_type_name,
               started_at,COALESCE(ended_at,'') as ended_at,
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
      await ensureTable(client, t.name);
      const rows = await all(t.query);
      await syncTableViaSQL(client, t.name, rows);
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

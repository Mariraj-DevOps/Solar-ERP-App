import pg from 'pg';
import Database from 'better-sqlite3';
import { db } from './db';

const { Pool } = pg;

export const TABLES: Array<{ name: string; pk: string }> = [
  { name: 'users',                          pk: 'id' },
  { name: 'labour_categories',              pk: 'id' },
  { name: 'teams',                          pk: 'id' },
  { name: 'team_role_templates',            pk: 'id' },
  { name: 'team_week_assignments',          pk: 'id' },
  { name: 'attendance_entries',             pk: 'id' },
  { name: 'attendance_lines',               pk: 'id' },
  { name: 'additional_charges',             pk: 'id' },
  { name: 'financial_adjustments',          pk: 'id' },
  { name: 'supplier_bills',                 pk: 'id' },
  { name: 'summary_merge_groups',           pk: 'id' },
  { name: 'audit_logs',                     pk: 'id' },
  { name: 'company_settings',               pk: 'key' },
  { name: 'secondary_admin_assignments',    pk: 'id' },
  { name: 'notifications',                  pk: 'id' },
  { name: 'attachments',                    pk: 'id' },
  { name: 'weekly_payments',                pk: 'id' },
  { name: 'office_ledger_entries',          pk: 'id' },
  { name: 'petty_cash_entries',             pk: 'id' },
  { name: 'worksites',                      pk: 'id' },
  { name: 'labourer_attendance_records',    pk: 'id' },
  { name: 'attendance_verification_requests', pk: 'id' },
  { name: 'attendance_supervisors',         pk: 'id' },
  { name: 'otp_verifications',              pk: 'id' },
  { name: 'user_push_tokens',               pk: 'id' },
  { name: 'geofence_change_requests',       pk: 'id' },
];

let pool: pg.Pool | null = null;
let isSyncing = false;
let syncTimeout: NodeJS.Timeout | null = null;

// Embedded cloud connection string to ensure Render container always connects even if environment vars are unconfigured
const DEFAULT_SUPABASE_URL = 'postgresql://postgres:Candy%4018suba@db.owcydqnfzjjfootlhoux.supabase.co:5432/postgres';

function getPool(): pg.Pool | null {
  if (pool) return pool;
  const cs = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL || DEFAULT_SUPABASE_URL;
  if (!cs) return null;

  try {
    pool = new Pool({
      connectionString: cs,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 30000,
      max: 5,
    });
    return pool;
  } catch (err) {
    console.warn('[Postgres Sync] Could not create pool:', err);
    return null;
  }
}

/**
 * Remove a deleted record from remote PostgreSQL
 */
export async function deleteFromPostgres(tableName: string, pkValue: string): Promise<void> {
  const p = getPool();
  if (!p) return;
  try {
    const client = await p.connect();
    try {
      await client.query(`DELETE FROM public."${tableName}" WHERE id = $1`, [pkValue]);
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.warn(`[Postgres Sync] Could not delete ${pkValue} from ${tableName}:`, err.message);
  }
}

/**
 * Pull all data from PostgreSQL into SQLite (Runs on server startup to restore state after sleep)
 */
export async function restoreFromPostgres(): Promise<boolean> {
  const p = getPool();
  if (!p) return false;

  console.log('[Postgres Sync] Attempting to restore database state from PostgreSQL...');
  let client: pg.PoolClient | null = null;

  try {
    client = await p.connect();

    // Check if PostgreSQL has the users table and has rows
    const checkTbl = await client.query(`SELECT to_regclass('public."users"') AS tbl`);
    if (!checkTbl.rows[0]?.tbl) {
      console.log('[Postgres Sync] PostgreSQL tables do not exist yet. Initial push will be performed.');
      client.release();
      await pushToPostgres();
      return true;
    }

    const checkCount = await client.query('SELECT COUNT(*) as c FROM public."users"');
    const userCount = Number(checkCount.rows[0]?.c || 0);

    if (userCount === 0) {
      console.log('[Postgres Sync] PostgreSQL is empty. Pushing current SQLite state...');
      client.release();
      await pushToPostgres();
      return true;
    }

    // Pull from PostgreSQL into SQLite for each table
    for (const t of TABLES) {
      try {
        const tblExists = await client.query(`SELECT to_regclass('public."${t.name}"') AS tbl`);
        if (!tblExists.rows[0]?.tbl) continue;

        const pgRes = await client.query(`SELECT * FROM public."${t.name}"`);
        if (!pgRes.rows || pgRes.rows.length === 0) continue;

        const cols = Object.keys(pgRes.rows[0]);
        const colList = cols.map(c => `"${c}"`).join(', ');
        const placeholders = cols.map(() => '?').join(', ');
        const insertSQL = `INSERT OR REPLACE INTO ${t.name} (${colList}) VALUES (${placeholders})`;

        const stmt = db.prepare(insertSQL);
        const insertMany = db.transaction((rows: any[]) => {
          for (const row of rows) {
            const vals = cols.map(c => row[c]);
            try {
              stmt.run(...vals);
            } catch (e) {
              // Ignore row restore mismatch
            }
          }
        });

        insertMany(pgRes.rows);
        console.log(`[Postgres Sync] Restored ${pgRes.rows.length} rows for table "${t.name}"`);
      } catch (err) {
        console.warn(`[Postgres Sync] Failed to restore table ${t.name}:`, err);
      }
    }

    console.log('✅ [Postgres Sync] Successfully restored SQLite database from PostgreSQL!');
    return true;
  } catch (err: any) {
    console.warn('[Postgres Sync] Failed to connect/restore from PostgreSQL:', err.message);
    return false;
  } finally {
    if (client) {
      try { client.release(); } catch {}
    }
  }
}

/**
 * Push SQLite state to PostgreSQL (Runs after writes and on a recurring schedule)
 */
export async function pushToPostgres(): Promise<void> {
  if (isSyncing) return;
  const p = getPool();
  if (!p) return;

  isSyncing = true;
  let client: pg.PoolClient | null = null;

  try {
    client = await p.connect();
    await client.query('SET session_replication_role = replica');

    for (const t of TABLES) {
      // Check if table exists in SQLite
      const tableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(t.name);
      if (!tableExists) continue;

      const colsInfo = db.prepare(`PRAGMA table_info("${t.name}")`).all() as Array<{ name: string; type: string; pk: number }>;
      if (colsInfo.length === 0) continue;

      // Ensure table exists in PostgreSQL
      const pgTableCheck = await client.query(`SELECT to_regclass($1) AS tbl`, [`public."${t.name}"`]);
      if (!pgTableCheck.rows[0]?.tbl) {
        const colDefs = colsInfo.map(c => {
          let typeStr = 'TEXT';
          const u = c.type.toUpperCase();
          if (u.includes('INT')) typeStr = 'INTEGER';
          else if (u.includes('REAL') || u.includes('NUM') || u.includes('DEC') || u.includes('FLOAT')) typeStr = 'NUMERIC';
          const pkDef = c.name === t.pk ? ' PRIMARY KEY' : '';
          return `"${c.name}" ${typeStr}${pkDef}`;
        }).join(', ');
        await client.query(`CREATE TABLE IF NOT EXISTS public."${t.name}" (${colDefs})`);
      } else {
        // Ensure columns match
        const existingColsRes = await client.query(
          `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
          [t.name]
        );
        const existingCols = new Set(existingColsRes.rows.map(r => r.column_name));
        for (const c of colsInfo) {
          if (!existingCols.has(c.name)) {
            let typeStr = 'TEXT';
            const u = c.type.toUpperCase();
            if (u.includes('INT')) typeStr = 'INTEGER';
            else if (u.includes('REAL') || u.includes('NUM') || u.includes('DEC') || u.includes('FLOAT')) typeStr = 'NUMERIC';
            await client.query(`ALTER TABLE public."${t.name}" ADD COLUMN IF NOT EXISTS "${c.name}" ${typeStr}`);
          }
        }
      }

      // Upsert rows
      const rows = db.prepare(`SELECT * FROM ${t.name}`).all() as Record<string, unknown>[];
      if (rows.length === 0) continue;

      const cols = Object.keys(rows[0]);
      const colList = cols.map(c => `"${c}"`).join(', ');
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      const updateSet = cols.filter(c => c !== t.pk).map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');

      const upsertSQL = `
        INSERT INTO public."${t.name}" (${colList})
        VALUES (${placeholders})
        ON CONFLICT ("${t.pk}") DO UPDATE SET ${updateSet}
      `;

      for (const row of rows) {
        const vals = cols.map(c => (row[c] === null ? null : row[c]));
        try {
          await client.query(upsertSQL, vals);
        } catch {
          // Ignore row failure
        }
      }
    }

    await client.query('SET session_replication_role = DEFAULT');
  } catch (err: any) {
    console.warn('[Postgres Sync] Push error:', err.message);
  } finally {
    if (client) {
      try { client.release(); } catch {}
    }
    isSyncing = false;
  }
}

/**
 * Debounced trigger to sync SQLite changes to PostgreSQL
 */
export function triggerPgSync(delayMs = 4000): void {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    pushToPostgres().catch(() => {});
  }, delayMs);
}

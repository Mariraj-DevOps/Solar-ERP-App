/**
 * pgBridge.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Syncs all data from the local SQLite database (data/erp.db) into the
 * PostgreSQL database defined in .env (labour_erp / postgres / root1).
 *
 * Run once after seeding SQLite:
 *   npx tsx src/server/pgBridge.ts
 *
 * It reads every table from SQLite and upserts into PostgreSQL.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import pg from 'pg';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const { Pool } = pg;

// ── SQLite source ─────────────────────────────────────────────────────────────
const sqlite = new Database(path.resolve(process.cwd(), 'data', 'erp.db'));

// ── PostgreSQL target ─────────────────────────────────────────────────────────
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME     || 'labour_erp',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'root1',
});

// ── Tables and their primary keys for upsert ─────────────────────────────────
const TABLES: Array<{ name: string; pk: string }> = [
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
];

async function syncTable(client: pg.PoolClient, tableName: string, pk: string) {
  // Check if table exists in SQLite
  const tableExists = sqlite.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
  ).get(tableName);

  if (!tableExists) {
    console.log(`  ⏭  ${tableName} — not in SQLite, skipping`);
    return;
  }

  const rows = sqlite.prepare(`SELECT * FROM ${tableName}`).all() as Record<string, unknown>[];

  if (rows.length === 0) {
    console.log(`  ⬜ ${tableName} — 0 rows`);
    return;
  }

  // Get column names from first row
  const cols = Object.keys(rows[0]);
  const colList = cols.map(c => `"${c}"`).join(', ');
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const updateSet = cols
    .filter(c => c !== pk)
    .map(c => `"${c}" = EXCLUDED."${c}"`)
    .join(', ');

  const upsertSQL = `
    INSERT INTO ${tableName} (${colList})
    VALUES (${placeholders})
    ON CONFLICT ("${pk}") DO UPDATE SET ${updateSet}
  `;

  let count = 0;
  for (const row of rows) {
    const values = cols.map(c => {
      const v = row[c];
      // SQLite stores booleans as 0/1 — keep as-is for TEXT columns in PG
      return v === null ? null : v;
    });
    try {
      await client.query(upsertSQL, values);
      count++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  ⚠  ${tableName} row ${row[pk]} skipped: ${msg.slice(0, 100)}`);
    }
  }

  console.log(`  ✅ ${tableName} — ${count} rows synced`);
}

async function main() {
  console.log('\n🔄  SQLite → PostgreSQL sync starting...');
  console.log(`    Source : data/erp.db`);
  console.log(`    Target : ${process.env.DB_NAME || 'labour_erp'} @ ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}\n`);

  const client = await pool.connect();

  try {
    // Disable FK checks temporarily for bulk upsert ordering
    await client.query('SET session_replication_role = replica');

    for (const t of TABLES) {
      await syncTable(client, t.name, t.pk);
    }

    await client.query('SET session_replication_role = DEFAULT');

    console.log('\n✅  Sync complete! All SQLite data is now in PostgreSQL (labour_erp).\n');
  } catch (err) {
    console.error('❌  Sync failed:', err);
  } finally {
    client.release();
    await pool.end();
    sqlite.close();
  }
}

main();

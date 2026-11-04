/**
 * Archived Finance Database Schema & Initial Benchmark Seed Reference
 * Originally part of src/server/db.ts
 */

export const FINANCE_TABLE_SCHEMAS = `
  -- Office Ledger (Double-Entry Restricted Corporate Ledger)
  CREATE TABLE IF NOT EXISTS office_ledger_entries (
    id TEXT PRIMARY KEY,
    entry_date TEXT NOT NULL,
    reference_no TEXT,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    entry_type TEXT NOT NULL CHECK(entry_type IN ('credit', 'debit')),
    amount REAL NOT NULL,
    payment_mode TEXT DEFAULT 'Bank Transfer',
    related_team_id TEXT,
    related_staff_id TEXT,
    notes TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    secondary_admin_id TEXT,
    office_name TEXT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
  );

  -- Petty Cash Entries (Excel-Structured Imprest Register)
  CREATE TABLE IF NOT EXISTS petty_cash_entries (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    serial_no TEXT,
    description TEXT NOT NULL,
    credit_amount REAL NOT NULL DEFAULT 0,
    debit_amount REAL NOT NULL DEFAULT 0,
    online_amount REAL NOT NULL DEFAULT 0,
    channel TEXT NOT NULL DEFAULT 'cash' CHECK(channel IN ('cash', 'online', 'account')),
    day_balance REAL NOT NULL DEFAULT 0,
    cash_in_hand_balance REAL NOT NULL DEFAULT 0,
    cash_in_account_balance REAL NOT NULL DEFAULT 0,
    related_team_id TEXT,
    related_staff_id TEXT,
    notes TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    secondary_admin_id TEXT,
    office_name TEXT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
  );

  CREATE INDEX IF NOT EXISTS idx_petty_date ON petty_cash_entries(date);
`;

export const FINANCE_BENCHMARK_SEED = [
  {
    table: 'petty_cash_entries',
    entries: [
      { id: 'pc-demo-01', date: '2026-10-01', serialNo: 'PC-001', desc: 'Office stationery, ledger books & printing supplies', credit: 0, debit: 1250, online: 0, channel: 'cash' },
      { id: 'pc-demo-02', date: '2026-10-05', serialNo: 'PC-002', desc: 'Head office imprest replenishment via RTGS transfer', credit: 50000, debit: 0, online: 50000, channel: 'online' },
      { id: 'pc-demo-03', date: '2026-10-12', serialNo: 'PC-003', desc: 'Site diesel generator fuel 60 litres in cash', credit: 0, debit: 5400, online: 0, channel: 'cash' },
      { id: 'pc-demo-04', date: '2026-10-18', serialNo: 'PC-004', desc: 'Municipal curing water tanker delivery (2 tankers)', credit: 0, debit: 3200, online: 0, channel: 'cash' },
      { id: 'pc-demo-05', date: '2026-10-22', serialNo: 'PC-005', desc: 'Electrical conduit pipes and switches paid via UPI', credit: 0, debit: 7650, online: 7650, channel: 'online' },
    ]
  },
  {
    table: 'office_ledger_entries',
    entries: [
      { id: 'ledg-demo-01', date: '2026-10-01', ref: 'CAP-2026-01', cat: 'Capital Injection', desc: 'Director initial working capital injection for Q4 operations', type: 'credit', amount: 500000, mode: 'NEFT' },
      { id: 'ledg-demo-02', date: '2026-10-08', ref: 'ADV-LUMIA-01', cat: 'Contractor Advance', desc: 'Mobilization advance disbursed to Lumia Civil Works', type: 'debit', amount: 150000, mode: 'Cheque' },
      { id: 'ledg-demo-03', date: '2026-10-15', ref: 'MAT-STL-01', cat: 'Material Purchase', desc: 'Pankaj Steel Traders batch advance for TMT rebar', type: 'debit', amount: 210000, mode: 'RTGS' },
      { id: 'ledg-demo-04', date: '2026-10-22', ref: 'CLT-BIL-01', cat: 'Client Billing', desc: 'Interim Client RA Bill #03 received from Lumia Infrastructure', type: 'credit', amount: 380000, mode: 'Wire' },
    ]
  }
];

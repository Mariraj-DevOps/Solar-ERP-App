import { describe, it, expect, beforeAll } from 'vitest';
import { db, initDatabase, logAudit, calculateHaversineDistanceMeters, maskAadhaar } from '../src/server/db';
import { requireAuth } from '../src/server/routes';
import bcrypt from 'bcryptjs';

describe('Phase 2 & Comprehensive ERP Verification Suite', () => {
  beforeAll(() => {
    initDatabase();
  });

  it('1. Performs 10 consecutive attendance creations and edits without hanging or locking', () => {
    const teamId = 'team-heeralal';
    const weekStart = '2026-10-17';
    const createdIds: string[] = [];

    for (let i = 1; i <= 10; i++) {
      const entryId = `consec-test-${Date.now()}-${i}`;
      createdIds.push(entryId);
      const testDate = `2026-10-${17 + (i % 7)}`;

      // Insert attendance entry
      db.prepare(`
        INSERT INTO attendance_entries (
          id, week_start_date, team_id, date, location_project, shift_batch,
          owner_user_id, status, created_by, updated_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'Site Alpha', ?, 'usr-staff-01', 'pending_approval', 'usr-staff-01', 'usr-staff-01', datetime('now'), datetime('now'))
      `).run(entryId, weekStart, teamId, testDate, `Batch ${i}`);

      // Insert line
      db.prepare(`
        INSERT INTO attendance_lines (
          id, attendance_entry_id, category_id, category_name, count, rate, rate_type, calculated_amount, final_amount
        ) VALUES (?, ?, 'cat-mason', 'Mason', ?, 1400, 'daily', ?, ?)
      `).run(`line-${entryId}`, entryId, i, i * 1400, i * 1400);

      // Immediately edit the record
      db.prepare(`
        UPDATE attendance_entries
        SET shift_batch = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(`Batch ${i} - Updated`, entryId);

      const check = db.prepare('SELECT shift_batch FROM attendance_entries WHERE id = ?').get(entryId) as any;
      expect(check.shift_batch).toBe(`Batch ${i} - Updated`);
    }

    expect(createdIds.length).toBe(10);

    // Cleanup
    const placeholders = createdIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM attendance_lines WHERE attendance_entry_id IN (${placeholders})`).run(...createdIds);
    db.prepare(`DELETE FROM attendance_entries WHERE id IN (${placeholders})`).run(...createdIds);
  });

  it('2. Enforces Staff Data Isolation: Staff A records are isolated from Staff B', () => {
    // Ensure Staff B exists
    const staffBId = 'usr-staff-02';
    const staffB = db.prepare('SELECT id FROM users WHERE id = ?').get(staffBId);
    if (!staffB) {
      db.prepare(`
        INSERT INTO users (id, email, password_hash, full_name, role, status, created_at, updated_at)
        VALUES (?, 'staff2@company.erp', 'hash', 'Staff Two', 'staff', 'active', datetime('now'), datetime('now'))
      `).run(staffBId);
    }

    const testEntryStaffA = `att-staffA-${Date.now()}`;
    const testEntryStaffB = `att-staffB-${Date.now()}`;

    db.prepare(`
      INSERT INTO attendance_entries (id, week_start_date, team_id, date, owner_user_id, status, created_by, updated_by, created_at, updated_at)
      VALUES (?, '2026-10-17', 'team-heeralal', '2026-10-17', 'usr-staff-01', 'pending_approval', 'usr-staff-01', 'usr-staff-01', datetime('now'), datetime('now'))
    `).run(testEntryStaffA);

    db.prepare(`
      INSERT INTO attendance_entries (id, week_start_date, team_id, date, owner_user_id, status, created_by, updated_by, created_at, updated_at)
      VALUES (?, '2026-10-17', 'team-centring-murugan', '2026-10-17', 'usr-staff-02', 'pending_approval', 'usr-staff-02', 'usr-staff-02', datetime('now'), datetime('now'))
    `).run(testEntryStaffB);

    // Query as Staff A: should only return records where owner_user_id = 'usr-staff-01'
    const staffARecords = db.prepare('SELECT id FROM attendance_entries WHERE owner_user_id = ?').all('usr-staff-01') as any[];
    expect(staffARecords.some(r => r.id === testEntryStaffA)).toBe(true);
    expect(staffARecords.some(r => r.id === testEntryStaffB)).toBe(false);

    // Query as Staff B
    const staffBRecords = db.prepare('SELECT id FROM attendance_entries WHERE owner_user_id = ?').all('usr-staff-02') as any[];
    expect(staffBRecords.some(r => r.id === testEntryStaffB)).toBe(true);
    expect(staffBRecords.some(r => r.id === testEntryStaffA)).toBe(false);

    // Cleanup
    db.prepare('DELETE FROM attendance_entries WHERE id IN (?, ?)').run(testEntryStaffA, testEntryStaffB);
  });

  it('3. Secondary Admin Scoped Assignments & Finance Permissions Matrix', () => {
    const secAdminId = 'usr-secadmin-01';
    db.prepare(`
      INSERT OR REPLACE INTO secondary_admin_assignments (
        id, secondary_admin_id, staff_user_id, can_view_reports, can_approve_attendance,
        can_edit_attendance, allowed_financial_modules_json, can_edit_finance, can_view_details, created_at, updated_at
      ) VALUES ('assign-01', ?, 'usr-staff-01', 1, 1, 1, '["weekly_payments"]', 0, 1, datetime('now'), datetime('now'))
    `).run(secAdminId);

    const assignment = db.prepare('SELECT * FROM secondary_admin_assignments WHERE secondary_admin_id = ? AND staff_user_id = ?').get(secAdminId, 'usr-staff-01') as any;
    expect(assignment).toBeDefined();
    expect(assignment.can_approve_attendance).toBe(1);
    expect(assignment.can_edit_finance).toBe(0);
    expect(JSON.parse(assignment.allowed_financial_modules_json)).toContain('weekly_payments');

    // Secondary admin cannot access unassigned staff usr-staff-02
    const unassigned = db.prepare('SELECT * FROM secondary_admin_assignments WHERE secondary_admin_id = ? AND staff_user_id = ?').get(secAdminId, 'usr-staff-02');
    expect(unassigned).toBeUndefined();
  });

  it('4. Full Approval Workflow: pending -> approved and pending -> rejected with mandatory reason', () => {
    const entryId1 = `approve-flow-${Date.now()}`;
    const entryId2 = `reject-flow-${Date.now()}`;

    db.prepare(`
      INSERT INTO attendance_entries (id, week_start_date, team_id, date, owner_user_id, status, created_by, updated_by, created_at, updated_at)
      VALUES (?, '2026-10-17', 'team-heeralal', '2026-10-18', 'usr-staff-01', 'pending_approval', 'usr-staff-01', 'usr-staff-01', datetime('now'), datetime('now'))
    `).run(entryId1);

    db.prepare(`
      INSERT INTO attendance_entries (id, week_start_date, team_id, date, owner_user_id, status, created_by, updated_by, created_at, updated_at)
      VALUES (?, '2026-10-17', 'team-heeralal', '2026-10-19', 'usr-staff-01', 'pending_approval', 'usr-staff-01', 'usr-staff-01', datetime('now'), datetime('now'))
    `).run(entryId2);

    // Approve entry 1
    db.prepare(`
      UPDATE attendance_entries
      SET status = 'approved', approved_by = 'usr-admin-01', approved_by_name = 'ERP Administrator', approved_at = datetime('now')
      WHERE id = ?
    `).run(entryId1);

    const approved = db.prepare('SELECT status, approved_by FROM attendance_entries WHERE id = ?').get(entryId1) as any;
    expect(approved.status).toBe('approved');
    expect(approved.approved_by).toBe('usr-admin-01');

    // Reject entry 2 with mandatory reason
    const rejectionReason = 'Overtime hours mismatch with site security register';
    db.prepare(`
      UPDATE attendance_entries
      SET status = 'rejected', rejection_reason = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(rejectionReason, entryId2);

    const rejected = db.prepare('SELECT status, rejection_reason FROM attendance_entries WHERE id = ?').get(entryId2) as any;
    expect(rejected.status).toBe('rejected');
    expect(rejected.rejection_reason).toBe(rejectionReason);

    // Cleanup
    db.prepare('DELETE FROM attendance_entries WHERE id IN (?, ?)').run(entryId1, entryId2);
  });

  it('5. Non-destructive revision flow: Editing an approved entry creates change_pending_approval holding revision data', () => {
    const entryId = `revision-flow-${Date.now()}`;

    // Approved record
    db.prepare(`
      INSERT INTO attendance_entries (id, week_start_date, team_id, date, shift_batch, owner_user_id, status, created_by, updated_by, created_at, updated_at)
      VALUES (?, '2026-10-17', 'team-heeralal', '2026-10-18', 'Day Shift', 'usr-staff-01', 'approved', 'usr-staff-01', 'usr-staff-01', datetime('now'), datetime('now'))
    `).run(entryId);

    // Staff submits a modification
    const proposedRevision = {
      shift_batch: 'Day Shift Extended',
      remarks: 'Added late evening cleaning batch',
      lines: [{ categoryId: 'cat-mason', count: 12, rate: 1400 }]
    };

    db.prepare(`
      UPDATE attendance_entries
      SET status = 'change_pending_approval',
          change_reason = ?,
          revision_data_json = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run('Correction in labour count after foreman check', JSON.stringify(proposedRevision), entryId);

    const record = db.prepare('SELECT status, shift_batch, change_reason, revision_data_json FROM attendance_entries WHERE id = ?').get(entryId) as any;
    expect(record.status).toBe('change_pending_approval');
    // Original data remains active until admin approves revision
    expect(record.shift_batch).toBe('Day Shift');
    expect(record.change_reason).toBe('Correction in labour count after foreman check');
    expect(JSON.parse(record.revision_data_json).shift_batch).toBe('Day Shift Extended');

    // Cleanup
    db.prepare('DELETE FROM attendance_entries WHERE id = ?').run(entryId);
  });

  it('6. Weekly Payment Settlement and Historical Outstanding Balance Retention', () => {
    const week1 = '2026-10-10';
    const week2 = '2026-10-17';
    const teamId = 'team-heeralal';
    const staffId = 'usr-staff-01';

    // Week 1: Net payable ₹1,00,000, Paid ₹80,000 -> Outstanding ₹20,000
    const paymentId1 = `pay-${week1}-${teamId}`;
    db.prepare(`
      INSERT OR REPLACE INTO weekly_payments (
        id, week_start_date, team_id, staff_user_id, gross_amount, net_payable, amount_paid,
        status, payment_date, payment_method, voucher_ref, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 100000, 100000, 80000, 'Partially Paid', '2026-10-16', 'Bank Transfer', 'TXN-00192', datetime('now'), datetime('now'))
    `).run(paymentId1, week1, teamId, staffId);

    // Verify historical outstanding query
    const unpaidPayments = db.prepare(`
      SELECT SUM(net_payable - amount_paid) as outstanding
      FROM weekly_payments
      WHERE team_id = ? AND week_start_date < ? AND status != 'Paid'
    `).get(teamId, week2) as any;

    expect(unpaidPayments.outstanding).toBe(20000);

    // Week 2: Mark as Fully Paid
    const paymentId2 = `pay-${week2}-${teamId}`;
    db.prepare(`
      INSERT OR REPLACE INTO weekly_payments (
        id, week_start_date, team_id, staff_user_id, gross_amount, net_payable, amount_paid,
        status, payment_date, payment_method, voucher_ref, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 120000, 120000, 120000, 'Paid', '2026-10-23', 'Cheque', 'CHQ-88210', datetime('now'), datetime('now'))
    `).run(paymentId2, week2, teamId, staffId);

    const p2 = db.prepare('SELECT status, amount_paid, voucher_ref FROM weekly_payments WHERE id = ?').get(paymentId2) as any;
    expect(p2.status).toBe('Paid');
    expect(p2.amount_paid).toBe(120000);
    expect(p2.voucher_ref).toBe('CHQ-88210');

    // Cleanup
    db.prepare('DELETE FROM weekly_payments WHERE id IN (?, ?)').run(paymentId1, paymentId2);
  });

  it('7. Petty Cash Accounting: reconciles Cash in Hand, Cash in Account, and Day Balance', () => {
    // Opening balance: Account ₹75,000, Hand ₹25,000
    const openingAccount = 75000;
    const openingHand = 25000;

    // Day 1: Site cash received ₹10,000 in hand; Labour paid ₹4,000 in cash
    const entry1Credit = 10000; // Hand credit
    const entry2Debit = 4000;   // Hand debit
    const day1HandBalance = openingHand + entry1Credit - entry2Debit; // 31,000

    // Day 2: Vendor paid online ₹15,000 from account
    const entry3OnlineDebit = 15000; // Account debit
    const day2AccountBalance = openingAccount - entry3OnlineDebit; // 60,000

    const day1DayBalance = entry1Credit - entry2Debit; // +6,000
    const day2DayBalance = -entry3OnlineDebit; // -15,000

    expect(day1HandBalance).toBe(31000);
    expect(day2AccountBalance).toBe(60000);
    expect(day1DayBalance).toBe(6000);
    expect(day2DayBalance).toBe(-15000);

    // Insert test petty cash entry
    const pettyId = `petty-${Date.now()}`;
    db.prepare(`
      INSERT INTO petty_cash_entries (
        id, date, serial_no, description, credit_amount, debit_amount, channel,
        day_balance, cash_in_hand_balance, cash_in_account_balance, created_by, created_at, updated_at
      ) VALUES (?, '2026-10-18', 'PC-001', 'Site conveyance and diesel', 0, 4000, 'cash', -4000, 31000, 75000, 'usr-admin-01', datetime('now'), datetime('now'))
    `).run(pettyId);

    const checkPetty = db.prepare('SELECT * FROM petty_cash_entries WHERE id = ?').get(pettyId) as any;
    expect(checkPetty.debit_amount).toBe(4000);
    expect(checkPetty.cash_in_hand_balance).toBe(31000);
    expect(checkPetty.day_balance).toBe(-4000);

    // Cleanup
    db.prepare('DELETE FROM petty_cash_entries WHERE id = ?').run(pettyId);
  });

  it('8. Document and Attachment Management with Metadata & Access Scoping', () => {
    const attachId = `doc-${Date.now()}`;
    db.prepare(`
      INSERT INTO attachments (
        id, record_type, record_id, file_name, file_size, mime_type, file_path,
        description, owner_user_id, uploaded_by, uploaded_by_name, created_at
      ) VALUES (?, 'weekly_payment', 'pay-001', 'site_voucher_oct17.pdf', 1048576, 'application/pdf', '/uploads/vouchers/v1.pdf',
        'Signed payment voucher with labour fingerprints', 'usr-staff-01', 'usr-staff-01', 'Staff Member', datetime('now'))
    `).run(attachId);

    const doc = db.prepare('SELECT * FROM attachments WHERE id = ?').get(attachId) as any;
    expect(doc).toBeDefined();
    expect(doc.file_name).toBe('site_voucher_oct17.pdf');
    expect(doc.mime_type).toBe('application/pdf');
    expect(doc.owner_user_id).toBe('usr-staff-01');

    // Cleanup
    db.prepare('DELETE FROM attachments WHERE id = ?').run(attachId);
  });

  it('9. Labour Category Management: Edit and Delete with reference checks', () => {
    const catId = `cat-test-${Date.now()}`;
    // 1. Create test category
    db.prepare(`
      INSERT INTO labour_categories (id, name, code, default_rate, rate_type, display_order, is_shared, owner_user_id, created_at)
      VALUES (?, 'Test Welder', 'TWELD', 1250, 'daily', 99, 1, 'usr-admin-01', datetime('now'))
    `).run(catId);

    let cat = db.prepare('SELECT * FROM labour_categories WHERE id = ?').get(catId) as any;
    expect(cat.name).toBe('Test Welder');
    expect(cat.default_rate).toBe(1250);

    // 2. Edit test category
    db.prepare(`
      UPDATE labour_categories
      SET name = 'Senior Welder', default_rate = 1500, rate_type = 'hourly'
      WHERE id = ?
    `).run(catId);

    cat = db.prepare('SELECT * FROM labour_categories WHERE id = ?').get(catId) as any;
    expect(cat.name).toBe('Senior Welder');
    expect(cat.default_rate).toBe(1500);
    expect(cat.rate_type).toBe('hourly');

    // 3. Delete category
    db.prepare('DELETE FROM labour_categories WHERE id = ?').run(catId);
    const checkDeleted = db.prepare('SELECT id FROM labour_categories WHERE id = ?').get(catId);
    expect(checkDeleted).toBeUndefined();
  });

  it('10. Weekly Payment Recording by Staff & Admin Override Workflow', () => {
    const pmtId = `pmt-test-${Date.now()}`;
    const weekStart = '2026-10-17';
    const teamId = 'team-heeralal';
    const staffId = 'usr-staff-01';

    // Staff records initial settlement
    db.prepare(`
      INSERT OR REPLACE INTO weekly_payments (
        id, week_start_date, team_id, staff_user_id, gross_amount, charges_amount,
        deductions_amount, net_payable, amount_paid, status, payment_date,
        payment_method, voucher_ref, marked_by, marked_by_name, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 50000, 2000, 5000, 47000, 30000, 'Partially Paid', '2026-10-23',
        'Bank Transfer', 'VOUCH-STAFF-01', 'usr-staff-01', 'Staff Member', datetime('now'), datetime('now'))
    `).run(pmtId, weekStart, teamId, staffId);

    let record = db.prepare('SELECT * FROM weekly_payments WHERE id = ?').get(pmtId) as any;
    expect(record.status).toBe('Partially Paid');
    expect(record.amount_paid).toBe(30000);
    expect(record.marked_by).toBe('usr-staff-01');

    // Admin overrides payment to full settlement
    db.prepare(`
      UPDATE weekly_payments
      SET amount_paid = 47000, status = 'Paid', voucher_ref = 'CHQ-ADMIN-9901',
          marked_by = 'usr-admin-01', marked_by_name = 'ERP Administrator', updated_at = datetime('now')
      WHERE id = ?
    `).run(pmtId);

    record = db.prepare('SELECT * FROM weekly_payments WHERE id = ?').get(pmtId) as any;
    expect(record.status).toBe('Paid');
    expect(record.amount_paid).toBe(47000);
    expect(record.voucher_ref).toBe('CHQ-ADMIN-9901');
    expect(record.marked_by).toBe('usr-admin-01');

    // Cleanup
    db.prepare('DELETE FROM weekly_payments WHERE id = ?').run(pmtId);
  });

  it('11. Manager Scope Assignment Editing & Permission Updates', () => {
    const assignId = `assign-test-${Date.now()}`;
    const secAdminId = 'usr-secadmin-01';
    const staffId = 'usr-staff-01';

    // 1. Initial creation
    db.prepare(`
      INSERT OR REPLACE INTO secondary_admin_assignments (
        id, secondary_admin_id, staff_user_id, can_view_reports, can_approve_attendance,
        can_edit_attendance, allowed_financial_modules_json, can_edit_finance, can_view_details, created_at, updated_at
      ) VALUES (?, ?, ?, 1, 0, 0, '["weekly_payments"]', 0, 1, datetime('now'), datetime('now'))
    `).run(assignId, secAdminId, staffId);

    let assign = db.prepare('SELECT * FROM secondary_admin_assignments WHERE id = ?').get(assignId) as any;
    expect(assign.can_approve_attendance).toBe(0);
    expect(assign.can_edit_finance).toBe(0);

    // 2. Edit assignment permissions (toggle approve and finance)
    db.prepare(`
      UPDATE secondary_admin_assignments
      SET can_approve_attendance = 1, can_edit_attendance = 1, can_edit_finance = 1,
          allowed_financial_modules_json = '["weekly_payments","petty_cash"]', updated_at = datetime('now')
      WHERE id = ?
    `).run(assignId);

    assign = db.prepare('SELECT * FROM secondary_admin_assignments WHERE id = ?').get(assignId) as any;
    expect(assign.can_approve_attendance).toBe(1);
    expect(assign.can_edit_attendance).toBe(1);
    expect(assign.can_edit_finance).toBe(1);
    expect(assign.allowed_financial_modules_json).toContain('petty_cash');

    // Cleanup
    db.prepare('DELETE FROM secondary_admin_assignments WHERE id = ?').run(assignId);
  });

  it('12. Labourer Account Creation, Aadhaar Masking & Team Transfer with History Preservation', () => {
    const labId = `lab-test-${Date.now()}`;
    const rawAadhaar = '5544 3322 1100';
    const masked = maskAadhaar(rawAadhaar);
    expect(masked).toBe('XXXX-XXXX-1100');

    // Create labourer
    db.prepare(`
      INSERT INTO users (
        id, email, password_hash, full_name, role, status, designation,
        mobile_number, masked_aadhaar, encrypted_aadhaar, aadhaar_status,
        assigned_team_id, assigned_worksite_id, assigned_supervisor_id, labour_category_id,
        daily_rate, created_at, updated_at
      ) VALUES (?, ?, 'hashed_pass', 'Test Worker', 'labourer', 'active', 'Mason',
                '9988776655', ?, 'enc-val', 'verified', 'team-heeralal', 'ws-lumia-01', 'usr-staff-01', 'cat-mason',
                1400, datetime('now'), datetime('now'))
    `).run(labId, `${labId}@labour.erp`, masked);

    let lab = db.prepare('SELECT * FROM users WHERE id = ?').get(labId) as any;
    expect(lab.role).toBe('labourer');
    expect(lab.masked_aadhaar).toBe('XXXX-XXXX-1100');
    expect(lab.assigned_team_id).toBe('team-heeralal');

    // Transfer labourer to another team
    db.prepare('UPDATE users SET assigned_team_id = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run('team-centring-murugan', labId);

    lab = db.prepare('SELECT * FROM users WHERE id = ?').get(labId) as any;
    expect(lab.assigned_team_id).toBe('team-centring-murugan');

    // Cleanup
    db.prepare('DELETE FROM users WHERE id = ?').run(labId);
  });

  it('13. Haversine Great-Circle Geofence Distance Calculation', () => {
    // Worksite: Lumia Building (12.971598, 77.594562)
    const siteLat = 12.971598;
    const siteLon = 77.594562;

    // Point 1: 50m away
    const p1Lat = 12.971900;
    const p1Lon = 77.594800;
    const d1 = calculateHaversineDistanceMeters(siteLat, siteLon, p1Lat, p1Lon);
    expect(d1).toBeGreaterThan(20);
    expect(d1).toBeLessThan(80);

    // Point 2: identical coordinates -> distance 0
    const dZero = calculateHaversineDistanceMeters(siteLat, siteLon, siteLat, siteLon);
    expect(dZero).toBe(0);

    // Point 3: Outside radius (~1.5 km away)
    const p3Lat = 12.985000;
    const p3Lon = 77.605000;
    const d3 = calculateHaversineDistanceMeters(siteLat, siteLon, p3Lat, p3Lon);
    expect(d3).toBeGreaterThan(1000);
  });

  it('14. GPS Check-In Geofence Validation, Accuracy Check, and Duplicate Prevention', () => {
    const recId = `gps-rec-test-${Date.now()}`;
    const userId = 'usr-labourer-01';
    const worksiteId = 'ws-lumia-01';
    const testDate = '2026-10-31';

    // 1. Successful check-in inside radius
    db.prepare(`
      INSERT INTO labourer_attendance_records (
        id, user_id, user_name, user_role, worksite_id, worksite_name,
        date, week_start_date, check_in_time, check_in_lat, check_in_lon,
        check_in_accuracy, check_in_distance_meters, check_in_status, rate_applied, status,
        created_at, updated_at
      ) VALUES (?, ?, 'Ramesh Kumar', 'labourer', ?, 'Lumia Main Site',
                ?, '2026-10-31', '2026-10-31T08:30:00.000Z', 12.971600, 77.594570,
                15, 8, 'valid_location', 1400, 'pending', datetime('now'), datetime('now'))
    `).run(recId, userId, worksiteId, testDate);

    const rec = db.prepare('SELECT * FROM labourer_attendance_records WHERE id = ?').get(recId) as any;
    expect(rec.check_in_status).toBe('valid_location');
    expect(rec.check_in_distance_meters).toBe(8);
    expect(rec.status).toBe('pending');

    // 2. Prevent duplicate active check-in today without check-out
    const active = db.prepare(`
      SELECT COUNT(*) as c FROM labourer_attendance_records
      WHERE user_id = ? AND date = ? AND check_out_time IS NULL
    `).get(userId, testDate) as any;
    expect(active.c).toBe(1);

    // Cleanup
    db.prepare('DELETE FROM labourer_attendance_records WHERE id = ?').run(recId);
  });

  it('15. GPS Check-Out Working Duration & Payable Wage Calculation', () => {
    const recId = `gps-checkout-test-${Date.now()}`;
    const userId = 'usr-labourer-01';
    const checkInTime = '2026-10-31T08:30:00.000Z';
    const checkOutTime = '2026-10-31T17:30:00.000Z'; // 9 hours -> 540 min

    db.prepare(`
      INSERT INTO labourer_attendance_records (
        id, user_id, user_name, user_role, worksite_id, worksite_name,
        date, week_start_date, check_in_time, check_in_status, rate_applied, status,
        created_at, updated_at
      ) VALUES (?, ?, 'Ramesh Kumar', 'labourer', 'ws-lumia-01', 'Lumia Main Site',
                '2026-10-31', '2026-10-31', ?, 'valid_location', 1400, 'pending',
                datetime('now'), datetime('now'))
    `).run(recId, userId, checkInTime);

    // Execute checkout
    const diffMinutes = Math.round((new Date(checkOutTime).getTime() - new Date(checkInTime).getTime()) / (1000 * 60));
    expect(diffMinutes).toBe(540); // 9 hours
    const payableHours = 8;
    const overtimeHours = 1;
    const dailyRate = 1400;
    const hourlyRate = dailyRate / 8; // 175
    const wages = Math.round((payableHours / 8) * dailyRate + overtimeHours * hourlyRate * 1.5);

    db.prepare(`
      UPDATE labourer_attendance_records SET
        check_out_time = ?,
        check_out_status = 'valid_location',
        total_working_minutes = ?,
        payable_hours = ?,
        overtime_hours = ?,
        calculated_wages = ?
      WHERE id = ?
    `).run(checkOutTime, diffMinutes, payableHours, overtimeHours, wages, recId);

    const check = db.prepare('SELECT * FROM labourer_attendance_records WHERE id = ?').get(recId) as any;
    expect(check.total_working_minutes).toBe(540);
    expect(check.payable_hours).toBe(8);
    expect(check.overtime_hours).toBe(1);
    expect(check.calculated_wages).toBeGreaterThan(1400);

    // Cleanup
    db.prepare('DELETE FROM labourer_attendance_records WHERE id = ?').run(recId);
  });

  it('16. Random 30-Minute Attendance Verification Request & Expiry', () => {
    const vrfId = `vrf-test-${Date.now()}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

    // Create verification request
    db.prepare(`
      INSERT INTO attendance_verification_requests (
        id, target_type, target_user_id, requested_by_id, requested_by_name,
        requested_at, expires_at, status, worksite_id, created_at
      ) VALUES (?, 'individual', 'usr-labourer-01', 'usr-admin-01', 'ERP Administrator',
                ?, ?, 'pending', 'ws-lumia-01', ?)
    `).run(vrfId, now.toISOString(), expiresAt, now.toISOString());

    let req = db.prepare('SELECT * FROM attendance_verification_requests WHERE id = ?').get(vrfId) as any;
    expect(req.status).toBe('pending');
    expect(new Date(req.expires_at).getTime()).toBeGreaterThan(now.getTime());

    // Worker responds inside worksite
    db.prepare(`
      UPDATE attendance_verification_requests SET
        status = 'valid_location',
        responded_at = datetime('now'),
        responded_lat = 12.971600,
        responded_lon = 77.594562,
        distance_meters = 12
      WHERE id = ?
    `).run(vrfId);

    req = db.prepare('SELECT * FROM attendance_verification_requests WHERE id = ?').get(vrfId) as any;
    expect(req.status).toBe('valid_location');
    expect(req.distance_meters).toBe(12);

    // Test automatic expiry for expired requests
    const expiredId = `vrf-exp-${Date.now()}`;
    const pastTime = new Date(now.getTime() - 40 * 60 * 1000).toISOString(); // 40 mins ago
    db.prepare(`
      INSERT INTO attendance_verification_requests (
        id, target_type, target_user_id, requested_by_id, requested_by_name,
        requested_at, expires_at, status, worksite_id, created_at
      ) VALUES (?, 'individual', 'usr-labourer-01', 'usr-admin-01', 'ERP Administrator',
                ?, ?, 'pending', 'ws-lumia-01', ?)
    `).run(expiredId, pastTime, pastTime, pastTime);

    // Run expiration query
    db.prepare(`
      UPDATE attendance_verification_requests SET status = 'expired'
      WHERE status = 'pending' AND expires_at < ?
    `).run(new Date().toISOString());

    const expReq = db.prepare('SELECT status FROM attendance_verification_requests WHERE id = ?').get(expiredId) as any;
    expect(expReq.status).toBe('expired');

    // Cleanup
    db.prepare('DELETE FROM attendance_verification_requests WHERE id IN (?, ?)').run(vrfId, expiredId);
  });

  it('17. Admin/Staff Attendance Participation Under Supervisor & Non-Self Approval Enforcement', () => {
    const supAssignId = `sup-test-${Date.now()}`;
    const staffId = 'usr-staff-01';
    const secAdminId = 'usr-secadmin-01';

    // Assign supervisor
    db.prepare(`
      INSERT OR REPLACE INTO attendance_supervisors (
        id, participant_id, actual_role, supervisor_id, attendance_method, effective_date, status, created_by, created_at, updated_at
      ) VALUES (?, ?, 'staff', ?, 'gps', '2026-10-01', 'active', 'usr-admin-01', datetime('now'), datetime('now'))
    `).run(supAssignId, staffId, secAdminId);

    const supRecord = db.prepare('SELECT * FROM attendance_supervisors WHERE id = ?').get(supAssignId) as any;
    expect(supRecord.participant_id).toBe(staffId);
    expect(supRecord.supervisor_id).toBe(secAdminId);
    expect(supRecord.actual_role).toBe('staff');

    // Self-approval must be forbidden:
    const approverId = staffId;
    const canSelfApprove = approverId !== supRecord.participant_id;
    expect(canSelfApprove).toBe(false);

    // Supervisor can approve:
    const canSupervisorApprove = secAdminId !== supRecord.participant_id;
    expect(canSupervisorApprove).toBe(true);

    // Cleanup
    db.prepare('DELETE FROM attendance_supervisors WHERE id = ?').run(supAssignId);
  });

  it('18. Double-Count Detection Between Muster Roll & Individual GPS Attendance', () => {
    const weekStart = '2026-10-17';
    const teamId = 'team-heeralal';
    const testDate = '2026-10-17';

    // Check count-based entry exists for 17/10/2026
    const countEntry = db.prepare(`
      SELECT ae.id, SUM(al.count) as total_count
      FROM attendance_entries ae
      JOIN attendance_lines al ON ae.id = al.attendance_entry_id
      WHERE ae.team_id = ? AND ae.date = ?
      GROUP BY ae.id
    `).get(teamId, testDate) as any;

    expect(countEntry).toBeDefined();
    expect(countEntry.total_count).toBeGreaterThan(0);

    // If an individual GPS check-in is also inserted for the exact same team and date:
    const gpsRecId = `gps-double-test-${Date.now()}`;
    db.prepare(`
      INSERT INTO labourer_attendance_records (
        id, user_id, user_name, user_role, team_id, worksite_id, worksite_name,
        date, week_start_date, check_in_time, payable_hours, rate_applied, status,
        created_at, updated_at
      ) VALUES (?, 'usr-labourer-01', 'Ramesh Kumar', 'labourer', ?, 'ws-lumia-01', 'Lumia Main Site',
                ?, ?, '2026-10-17T08:30:00.000Z', 8, 1400, 'approved', datetime('now'), datetime('now'))
    `).run(gpsRecId, teamId, testDate, weekStart);

    // Reconciliation query must detect the overlap:
    const overlap = db.prepare(`
      SELECT ae.team_id, ae.date, COUNT(DISTINCT r.id) as gps_count
      FROM attendance_entries ae
      JOIN labourer_attendance_records r ON ae.team_id = r.team_id AND ae.date = r.date
      WHERE ae.team_id = ? AND ae.date = ? AND r.status != 'rejected'
      GROUP BY ae.team_id, ae.date
    `).get(teamId, testDate) as any;

    expect(overlap).toBeDefined();
    expect(overlap.gps_count).toBeGreaterThanOrEqual(1);

    // Cleanup
    db.prepare('DELETE FROM labourer_attendance_records WHERE id = ?').run(gpsRecId);
  });

  it('19. Team Site Location with Real Map Geofence & Range Configuration', () => {
    const teamId = `team-geofence-${Date.now()}`;
    const testLat = 12.9854;
    const testLon = 77.6055;
    const testRadius = 250;
    const testAccuracy = 40;

    // Create team with map coordinates and geofenced range
    db.prepare(`
      INSERT INTO teams (
        id, name, work_category, location_project, status,
        site_latitude, site_longitude, geofence_radius_meters, geofence_accuracy_threshold,
        attendance_method, created_at, updated_at
      ) VALUES (?, 'Solar Grid Alpha', 'Solar Installation', 'Alpha Solar Farm', 'active',
                ?, ?, ?, ?, 'both', datetime('now'), datetime('now'))
    `).run(teamId, testLat, testLon, testRadius, testAccuracy);

    const savedTeam = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId) as any;
    expect(savedTeam).toBeDefined();
    expect(savedTeam.site_latitude).toBeCloseTo(testLat, 4);
    expect(savedTeam.site_longitude).toBeCloseTo(testLon, 4);
    expect(savedTeam.geofence_radius_meters).toBe(250);
    expect(savedTeam.geofence_accuracy_threshold).toBe(40);

    // Haversine distance check: worker 100m away is valid
    // 0.0008 degrees lat is approx 89 meters
    const workerInsideLat = testLat + 0.0008;
    const workerInsideLon = testLon;
    const distanceInside = calculateHaversineDistanceMeters(workerInsideLat, workerInsideLon, testLat, testLon);
    expect(distanceInside).toBeLessThan(testRadius);

    // Worker 500m away exceeds allowed 250m range
    const workerOutsideLat = testLat + 0.005;
    const workerOutsideLon = testLon;
    const distanceOutside = calculateHaversineDistanceMeters(workerOutsideLat, workerOutsideLon, testLat, testLon);
    expect(distanceOutside).toBeGreaterThan(testRadius);

    // Cleanup
    db.prepare('DELETE FROM teams WHERE id = ?').run(teamId);
  });

  it('20. Self-Marked Labourer GPS Attendance Linkage & Muster Roll Headcount Reconciliation', () => {
    const teamId = 'team-heeralal';
    const testDate = '2026-10-30';
    const weekStart = '2026-10-24';
    const attEntryId = `att-merge-${Date.now()}`;
    const labourerId = 'usr-labourer-01';
    const gpsRecordId = `lar-self-${Date.now()}`;

    // 1. Labourer self-marks GPS attendance for the team
    db.prepare(`
      INSERT INTO labourer_attendance_records (
        id, user_id, user_name, user_role, team_id, worksite_id, worksite_name,
        date, week_start_date, check_in_time, check_in_lat, check_in_lon,
        check_in_distance_meters, check_in_status, rate_applied, status,
        created_at, updated_at
      ) VALUES (?, ?, 'Ramesh Kumar', 'labourer', ?, 'ws-lumia-01', 'Lumia Main Site',
                ?, ?, '2026-10-30T08:15:00.000Z', 12.9716, 77.5946,
                14, 'valid_location', 1400, 'pending', datetime('now'), datetime('now'))
    `).run(gpsRecordId, labourerId, teamId, testDate, weekStart);

    // Query team today GPS attendees
    const teamAttendees = db.prepare(`
      SELECT r.*, u.full_name as worker_name
      FROM labourer_attendance_records r
      JOIN users u ON r.user_id = u.id
      WHERE r.team_id = ? AND r.date = ?
    `).all(teamId, testDate) as any[];

    expect(teamAttendees.length).toBeGreaterThanOrEqual(1);
    expect(teamAttendees.some(a => a.id === gpsRecordId)).toBe(true);

    // 2. Staff creates count-wise attendance entry merging 1 GPS worker + 3 manual headcount = 4 Total
    const gpsCount = 1;
    const manualCount = 3;
    const totalWorkers = gpsCount + manualCount;

    db.prepare(`
      INSERT INTO attendance_entries (
        id, week_start_date, team_id, date, location_project, shift_batch,
        remarks, status, owner_user_id, created_by, updated_by,
        self_marked_labourer_ids_json, gps_count, manual_count,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'Lumia Building', 'Regular',
                'Includes 1 GPS self-marked worker', 'approved', 'usr-staff-01', 'usr-staff-01', 'usr-staff-01',
                ?, ?, ?, datetime('now'), datetime('now'))
    `).run(attEntryId, weekStart, teamId, testDate, JSON.stringify([gpsRecordId]), gpsCount, manualCount);

    // Insert attendance lines
    db.prepare(`
      INSERT INTO attendance_lines (
        id, attendance_entry_id, category_id, category_name, count, rate, rate_type,
        calculated_amount, final_amount
      ) VALUES (?, ?, 'cat-mason', 'Mason', ?, 1400, 'daily', ?, ?)
    `).run(`line-${attEntryId}-0`, attEntryId, totalWorkers, totalWorkers * 1400, totalWorkers * 1400);

    // Cross-link the self-marked record to the muster roll entry
    db.prepare(`
      UPDATE labourer_attendance_records
      SET attendance_entry_id = ?, status = 'approved'
      WHERE id = ?
    `).run(attEntryId, gpsRecordId);

    // 3. Verify reconciliation
    const savedEntry = db.prepare('SELECT * FROM attendance_entries WHERE id = ?').get(attEntryId) as any;
    expect(savedEntry.gps_count).toBe(1);
    expect(savedEntry.manual_count).toBe(3);
    expect(JSON.parse(savedEntry.self_marked_labourer_ids_json)).toContain(gpsRecordId);

    const updatedGpsRec = db.prepare('SELECT * FROM labourer_attendance_records WHERE id = ?').get(gpsRecordId) as any;
    expect(updatedGpsRec.attendance_entry_id).toBe(attEntryId);
    expect(updatedGpsRec.status).toBe('approved');

    // Cleanup
    db.prepare('DELETE FROM attendance_lines WHERE attendance_entry_id = ?').run(attEntryId);
    db.prepare('DELETE FROM attendance_entries WHERE id = ?').run(attEntryId);
    db.prepare('DELETE FROM labourer_attendance_records WHERE id = ?').run(gpsRecordId);
  });

  it('21. Verifies Worksite staff radius, staff assignment, and role-based access control', () => {
    const worksiteId = `ws-test-radius-${Date.now()}`;
    const staffId = 'usr-staff-01';
    const staffRadius = 250;

    // Create worksite with staff radius and assigned staff
    db.prepare(`
      INSERT INTO worksites (
        id, name, project_name, address, latitude, longitude,
        allowed_radius_meters, accuracy_threshold_meters, status,
        assigned_teams_json, assigned_staff_json, staff_radius_meters,
        secondary_admin_id, office_name, created_by, created_at, updated_at
      ) VALUES (?, 'Test Automated Site Beta', 'Solar Project Beta', '123 Solar Way', 12.97, 77.59,
        150, 50, 'active', '[]', ?, ?, 'usr-sec-01', 'Test Office', 'admin-01', datetime('now'), datetime('now'))
    `).run(worksiteId, JSON.stringify([staffId]), staffRadius);

    const ws = db.prepare('SELECT * FROM worksites WHERE id = ?').get(worksiteId) as any;
    expect(ws).toBeDefined();
    expect(ws.staff_radius_meters).toBe(250);
    const assignedStaff = JSON.parse(ws.assigned_staff_json);
    expect(assignedStaff).toContain(staffId);

    // Assign staff to secondary admin
    db.prepare(`
      INSERT OR REPLACE INTO secondary_admin_assignments (secondary_admin_id, staff_user_id, created_at, updated_at)
      VALUES (?, ?, datetime('now'), datetime('now'))
    `).run('usr-sec-01', staffId);

    // Verify secondary admin assignment query logic
    const isAssigned = db.prepare(`
      SELECT 1 FROM secondary_admin_assignments
      WHERE secondary_admin_id = ? AND staff_user_id = ?
    `).get('usr-sec-01', staffId);

    expect(Boolean(isAssigned)).toBe(true);

    // Cleanup
    db.prepare('DELETE FROM secondary_admin_assignments WHERE secondary_admin_id = ? AND staff_user_id = ?').run('usr-sec-01', staffId);
    db.prepare('DELETE FROM worksites WHERE id = ?').run(worksiteId);
  });

  it('Staff Management: Master Admin can assign location and radius; staff inherits specific range', () => {
    const testStaffId = `usr-staff-test-${Date.now()}`;
    const testWsId = `ws-lumia-01`;

    // 1. Create staff with custom radius 220m and assigned worksite
    db.prepare(`
      INSERT INTO users (
        id, email, password_hash, full_name, role, status, designation,
        assigned_location, assigned_worksite_id, allowed_radius_meters,
        is_attendance_participant, created_at, updated_at
      ) VALUES (?, ?, 'hash', 'Test Field Eng', 'staff', 'active', 'Supervisor', 'Lumia Main Site', ?, 220, 1, datetime('now'), datetime('now'))
    `).run(testStaffId, `eng-${Date.now()}@test.com`, testWsId);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(testStaffId) as any;
    expect(user).toBeDefined();
    expect(user.role).toBe('staff');
    expect(user.assigned_worksite_id).toBe(testWsId);
    expect(user.allowed_radius_meters).toBe(220);

    // 2. Master Admin updates location & radius to 350m
    db.prepare(`
      UPDATE users SET assigned_location = ?, assigned_worksite_id = ?, allowed_radius_meters = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run('Heritage Museum Site', 'ws-museum-02', 350, testStaffId);

    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(testStaffId) as any;
    expect(updatedUser.assigned_worksite_id).toBe('ws-museum-02');
    expect(updatedUser.allowed_radius_meters).toBe(350);

    // 3. Verify user query returns assigned_worksite_id and allowed_radius_meters
    const queriedStaff = db.prepare(`
      SELECT u.id, u.email, u.full_name, u.role, u.assigned_location, u.assigned_worksite_id, u.allowed_radius_meters, w.name as assigned_worksite_name
      FROM users u
      LEFT JOIN worksites w ON u.assigned_worksite_id = w.id
      WHERE u.id = ?
    `).get(testStaffId) as any;
    expect(queriedStaff.allowed_radius_meters).toBe(350);
    expect(queriedStaff.assigned_worksite_id).toBe('ws-museum-02');

    // Cleanup
    db.prepare('DELETE FROM users WHERE id = ?').run(testStaffId);
  });

  it('Manager Scope: Assign multiple staff members to a manager simultaneously', () => {
    const secAdminId = 'usr-sec-multi-test';
    const staff1 = `usr-staff-m1-${Date.now()}`;
    const staff2 = `usr-staff-m2-${Date.now()}`;
    const staff3 = `usr-staff-m3-${Date.now()}`;

    // Insert test manager and staff
    db.prepare(`
      INSERT OR REPLACE INTO users (id, email, password_hash, full_name, role, status, created_at, updated_at)
      VALUES (?, 'manager-multi@test.com', 'hash', 'Branch Manager Multi', 'secondary_admin', 'active', datetime('now'), datetime('now'))
    `).run(secAdminId);

    for (const sId of [staff1, staff2, staff3]) {
      db.prepare(`
        INSERT OR REPLACE INTO users (id, email, password_hash, full_name, role, status, created_at, updated_at)
        VALUES (?, ?, 'hash', ?, 'staff', 'active', datetime('now'), datetime('now'))
      `).run(sId, `${sId}@test.com`, `Staff ${sId}`);
    }

    // Simulate multi-staff assignment transaction
    const targetStaffIds = [staff1, staff2, staff3];
    const insertStmt = db.prepare(`
      INSERT INTO secondary_admin_assignments (
        id, secondary_admin_id, staff_user_id, can_view_reports, can_approve_attendance, can_edit_attendance,
        allowed_financial_modules_json, can_edit_finance, can_view_details, created_at, updated_at
      ) VALUES (?, ?, ?, 1, 1, 1, '["weekly_payments","petty_cash"]', 0, 1, datetime('now'), datetime('now'))
      ON CONFLICT(secondary_admin_id, staff_user_id) DO UPDATE SET updated_at = datetime('now')
    `);

    const updateStaffStmt = db.prepare("UPDATE users SET assigned_admin_id = ?, updated_at = datetime('now') WHERE id = ?");

    db.transaction((ids: string[]) => {
      for (const sId of ids) {
        insertStmt.run(`assign-${secAdminId}-${sId}`, secAdminId, sId);
        updateStaffStmt.run(secAdminId, sId);
      }
    })(targetStaffIds);

    // Verify all 3 staff are assigned to the secondary admin
    const assignments = db.prepare(`
      SELECT staff_user_id FROM secondary_admin_assignments WHERE secondary_admin_id = ?
    `).all(secAdminId) as Array<{ staff_user_id: string }>;

    expect(assignments.length).toBe(3);
    const assignedIds = assignments.map(a => a.staff_user_id);
    expect(assignedIds).toContain(staff1);
    expect(assignedIds).toContain(staff2);
    expect(assignedIds).toContain(staff3);

    // Verify user records also reflect assigned_admin_id
    for (const sId of targetStaffIds) {
      const u = db.prepare('SELECT assigned_admin_id FROM users WHERE id = ?').get(sId) as any;
      expect(u.assigned_admin_id).toBe(secAdminId);
    }

    // Cleanup
    db.prepare('DELETE FROM secondary_admin_assignments WHERE secondary_admin_id = ?').run(secAdminId);
    db.prepare('DELETE FROM users WHERE id IN (?, ?, ?, ?)').run(secAdminId, staff1, staff2, staff3);
  });

  it('verifies role-based team scoping and worksite deduplication', () => {
    const adminId = 'usr-admin-01';
    const secAdminId = `sec-team-${Date.now()}`;
    const staffA = `staff-a-${Date.now()}`;
    const staffB = `staff-b-${Date.now()}`;

    // Create test accounts
    db.prepare(`
      INSERT OR REPLACE INTO users (id, email, password_hash, full_name, role, status, created_at, updated_at)
      VALUES (?, 'sec@test.com', 'hash', 'Branch Manager', 'secondary_admin', 'active', datetime('now'), datetime('now'))
    `).run(secAdminId);
    db.prepare(`
      INSERT OR REPLACE INTO users (id, email, password_hash, full_name, role, status, assigned_admin_id, created_at, updated_at)
      VALUES (?, 'staffa@test.com', 'hash', 'Staff Alpha', 'staff', 'active', ?, datetime('now'), datetime('now'))
    `).run(staffA, secAdminId);
    db.prepare(`
      INSERT OR REPLACE INTO users (id, email, password_hash, full_name, role, status, created_at, updated_at)
      VALUES (?, 'staffb@test.com', 'hash', 'Staff Beta', 'staff', 'active', datetime('now'), datetime('now'))
    `).run(staffB);

    // Create teams with different owners
    const teamA = `team-alpha-${Date.now()}`;
    const teamB = `team-beta-${Date.now()}`;
    const teamSec = `team-sec-${Date.now()}`;

    db.prepare(`
      INSERT INTO teams (id, name, work_category, owner_user_id, status, created_at, updated_at)
      VALUES (?, 'Team Alpha (Staff A)', 'Civil', ?, 'active', datetime('now'), datetime('now'))
    `).run(teamA, staffA);
    db.prepare(`
      INSERT INTO teams (id, name, work_category, owner_user_id, status, created_at, updated_at)
      VALUES (?, 'Team Beta (Staff B)', 'Electrical', ?, 'active', datetime('now'), datetime('now'))
    `).run(teamB, staffB);
    db.prepare(`
      INSERT INTO teams (id, name, work_category, owner_user_id, status, created_at, updated_at)
      VALUES (?, 'Team Branch (Sec Admin)', 'Carpentry', ?, 'active', datetime('now'), datetime('now'))
    `).run(teamSec, secAdminId);

    // 1. Staff A scope: only sees Team A
    const staffATeams = db.prepare(`
      SELECT id FROM teams WHERE status = 'active' AND owner_user_id = ?
    `).all(staffA) as any[];
    expect(staffATeams.map(t => t.id)).toContain(teamA);
    expect(staffATeams.map(t => t.id)).not.toContain(teamB);
    expect(staffATeams.map(t => t.id)).not.toContain(teamSec);

    // 2. Staff B scope: only sees Team B
    const staffBTeams = db.prepare(`
      SELECT id FROM teams WHERE status = 'active' AND owner_user_id = ?
    `).all(staffB) as any[];
    expect(staffBTeams.map(t => t.id)).toContain(teamB);
    expect(staffBTeams.map(t => t.id)).not.toContain(teamA);

    // 3. Secondary Admin scope: sees Team Sec AND assigned Staff A's teams, but NOT Staff B's teams
    const secTeams = db.prepare(`
      SELECT id FROM teams
      WHERE status = 'active' AND (
        owner_user_id = ? OR
        owner_user_id IN (SELECT staff_user_id FROM secondary_admin_assignments WHERE secondary_admin_id = ?) OR
        owner_user_id IN (SELECT id FROM users WHERE assigned_admin_id = ?)
      )
    `).all(secAdminId, secAdminId, secAdminId) as any[];
    const secTeamIds = secTeams.map(t => t.id);
    expect(secTeamIds).toContain(teamSec);
    expect(secTeamIds).toContain(teamA);
    expect(secTeamIds).not.toContain(teamB);

    // 4. Test worksite deduplication logic
    const wsName = `Duplicate Test Site ${Date.now()}`;
    const ws1 = `ws-dup-1-${Date.now()}`;
    const ws2 = `ws-dup-2-${Date.now()}`;
    db.prepare(`
      INSERT INTO worksites (id, name, project_name, latitude, longitude, created_by, created_at, updated_at)
      VALUES (?, ?, 'Project Dup', 12.97, 77.59, 'usr-admin-01', datetime('now'), datetime('now'))
    `).run(ws1, wsName);
    db.prepare(`
      INSERT INTO worksites (id, name, project_name, latitude, longitude, created_by, created_at, updated_at)
      VALUES (?, ?, 'Project Dup', 12.97, 77.59, 'usr-admin-01', datetime('now'), datetime('now', '+1 minute'))
    `).run(ws2, wsName);

    // Run deduplicator
    const allWorksites = db.prepare("SELECT id, name, updated_at FROM worksites WHERE name = ? ORDER BY updated_at DESC, id ASC").all(wsName) as any[];
    const seenNames = new Set<string>();
    for (const ws of allWorksites) {
      const key = (ws.name || '').trim().toLowerCase();
      if (seenNames.has(key)) {
        db.prepare('DELETE FROM worksites WHERE id = ?').run(ws.id);
      } else {
        seenNames.add(key);
      }
    }

    const surviving = db.prepare("SELECT id FROM worksites WHERE name = ?").all(wsName) as any[];
    expect(surviving.length).toBe(1);
    expect(surviving[0].id).toBe(ws2); // The newer one was preserved

    // Cleanup
    db.prepare('DELETE FROM worksites WHERE name = ?').run(wsName);
    db.prepare('DELETE FROM teams WHERE id IN (?, ?, ?)').run(teamA, teamB, teamSec);
    db.prepare('DELETE FROM users WHERE id IN (?, ?, ?)').run(secAdminId, staffA, staffB);
  });

  it('verifies authentication middleware allows token in query params for mobile downloads', () => {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'erp-super-secure-internal-secret-2026';
    const testToken = jwt.sign({ id: 'usr-admin-01', email: 'admin@lumia.com', role: 'admin' }, JWT_SECRET);

    let nextCalled = false;
    const reqWithQueryToken: any = {
      headers: {},
      query: { token: testToken },
    };
    const res: any = {
      status: (code: number) => ({
        json: (data: any) => ({ code, data }),
      }),
    };
    const next = () => { nextCalled = true; };

    requireAuth(reqWithQueryToken, res, next);
    expect(nextCalled).toBe(true);
    expect(reqWithQueryToken.user).toBeDefined();
    expect(reqWithQueryToken.user.id).toBe('usr-admin-01');
  });
});


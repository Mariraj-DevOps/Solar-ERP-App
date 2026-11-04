/**
 * Archived Finance Routes (/office-ledger and /petty-cash)
 * Originally part of src/server/routes.ts
 */

import { Router, Request, Response } from 'express';

export function registerFinanceRoutes(apiRouter: Router, db: any, authHelpers: {
  requireAuth: any;
  isMasterAdmin: (user: any) => boolean;
  isSecondaryAdmin: (user: any) => boolean;
  canAccessFinanceModule: (user: any, mod: string) => boolean;
  round2: (val: number) => number;
  logAudit: (data: any) => void;
}) {
  const { requireAuth, isMasterAdmin, isSecondaryAdmin, canAccessFinanceModule, round2, logAudit } = authHelpers;

  // =========================================================================
  // MASTER-ADMIN & OFFICE-WISE ACCOUNTS LEDGER (ROLE-BASED & OFFICE ISOLATION)
  // =========================================================================
  apiRouter.get('/office-ledger', requireAuth, (req: Request, res: Response) => {
    if (!isMasterAdmin(req.user) && !canAccessFinanceModule(req.user!, 'office_ledger')) {
      return res.status(403).json({ error: 'Access restricted to Master Administrator or authorized accounts managers.' });
    }

    const { startDate, endDate, category, secondaryAdminId } = req.query;
    let query = `
      SELECT l.*,
             COALESCE(l.office_name, 'Head Office (Central)') as office_name,
             COALESCE(u.full_name, 'Administrator') as created_by_name,
             COALESCE(sec.full_name, 'Head Office / Master Admin') as secondary_admin_name
      FROM office_ledger_entries l
      LEFT JOIN users u ON l.created_by = u.id
      LEFT JOIN users sec ON l.secondary_admin_id = sec.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (isSecondaryAdmin(req.user)) {
      query += ' AND (l.secondary_admin_id = ? OR (l.created_by = ? AND (l.secondary_admin_id IS NULL OR l.secondary_admin_id = ?)))';
      params.push(req.user!.id, req.user!.id, req.user!.id);
    } else if (secondaryAdminId && secondaryAdminId !== 'all') {
      if (secondaryAdminId === 'head_office') {
        query += " AND (l.secondary_admin_id = 'head_office' OR l.secondary_admin_id IS NULL)";
      } else {
        query += ' AND l.secondary_admin_id = ?';
        params.push(secondaryAdminId);
      }
    }

    if (startDate) {
      query += ' AND l.entry_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND l.entry_date <= ?';
      params.push(endDate);
    }
    if (category) {
      query += ' AND l.category = ?';
      params.push(category);
    }

    query += ' ORDER BY l.entry_date ASC, l.created_at ASC';
    const entries = db.prepare(query).all(...params) as Array<any>;

    let running = 0;
    const withRunning = entries.map(e => {
      if (e.entry_type === 'credit') {
        running = round2(running + e.amount);
      } else {
        running = round2(running - e.amount);
      }
      return { ...e, runningBalance: running };
    });

    let officeBreakdowns: any[] = [];
    if (isMasterAdmin(req.user)) {
      const allOfficeRows = db.prepare(`
        SELECT l.secondary_admin_id, l.entry_type, l.amount, l.office_name, sec.full_name as sec_name
        FROM office_ledger_entries l
        LEFT JOIN users sec ON l.secondary_admin_id = sec.id
      `).all() as Array<any>;

      const breakdownMap = new Map<string, any>();

      breakdownMap.set('head_office', {
        officeId: 'head_office',
        officeName: 'Head Office (Central)',
        adminName: 'Master Administrator',
        totalCredit: 0,
        totalDebit: 0,
        netBalance: 0,
        count: 0,
      });

      const secAdmins = db.prepare("SELECT id, full_name, assigned_location FROM users WHERE role = 'secondary_admin'").all() as Array<any>;
      secAdmins.forEach(s => {
        breakdownMap.set(s.id, {
          officeId: s.id,
          officeName: s.assigned_location ? `${s.assigned_location} Office (${s.full_name})` : `${s.full_name} Office`,
          adminName: s.full_name,
          totalCredit: 0,
          totalDebit: 0,
          netBalance: 0,
          count: 0,
        });
      });

      allOfficeRows.forEach(row => {
        const key = (row.secondary_admin_id && row.secondary_admin_id !== 'head_office') ? row.secondary_admin_id : 'head_office';
        if (!breakdownMap.has(key)) {
          breakdownMap.set(key, {
            officeId: key,
            officeName: row.office_name || 'Branch Office',
            adminName: row.sec_name || 'Secondary Admin',
            totalCredit: 0,
            totalDebit: 0,
            netBalance: 0,
            count: 0,
          });
        }
        const b = breakdownMap.get(key)!;
        b.count++;
        if (row.entry_type === 'credit') {
          b.totalCredit = round2(b.totalCredit + row.amount);
          b.netBalance = round2(b.netBalance + row.amount);
        } else {
          b.totalDebit = round2(b.totalDebit + row.amount);
          b.netBalance = round2(b.netBalance - row.amount);
        }
      });

      officeBreakdowns = Array.from(breakdownMap.values());
    }

    res.json({
      entries: withRunning,
      officeBreakdowns: isMasterAdmin(req.user) ? officeBreakdowns : undefined,
      currentBalance: running,
    });
  });

  apiRouter.post('/office-ledger', requireAuth, (req: Request, res: Response) => {
    if (!isMasterAdmin(req.user) && !canAccessFinanceModule(req.user!, 'office_ledger')) {
      return res.status(403).json({ error: 'Access restricted to Master Administrator or authorized accounts managers.' });
    }

    const {
      entryDate,
      referenceNo,
      category,
      description,
      entryType,
      amount,
      paymentMode,
      relatedTeamId,
      relatedStaffId,
      notes,
      secondaryAdminId,
      officeName: customOfficeName,
    } = req.body;

    if (!entryDate || !category || !description || !entryType || amount === undefined) {
      return res.status(400).json({ error: 'Date, category, description, entry type, and amount are required.' });
    }

    const id = `ledg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    let targetSecAdminId = 'head_office';
    let targetOfficeName = 'Head Office (Central)';

    if (isSecondaryAdmin(req.user)) {
      targetSecAdminId = req.user!.id;
      targetOfficeName = req.user!.assignedLocation ? `${req.user!.assignedLocation} Office` : `${req.user!.fullName} Office`;
    } else if (secondaryAdminId && secondaryAdminId !== 'head_office') {
      targetSecAdminId = secondaryAdminId;
      const secUser = db.prepare('SELECT full_name, assigned_location FROM users WHERE id = ?').get(secondaryAdminId) as any;
      if (secUser) {
        targetOfficeName = secUser.assigned_location ? `${secUser.assigned_location} Office (${secUser.full_name})` : `${secUser.full_name} Office`;
      }
    }
    if (customOfficeName) targetOfficeName = customOfficeName;

    db.prepare(`
      INSERT INTO office_ledger_entries (
        id, entry_date, reference_no, category, description, entry_type, amount,
        payment_mode, related_team_id, related_staff_id, notes, created_by, created_at,
        secondary_admin_id, office_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      entryDate,
      referenceNo || null,
      category.trim(),
      description.trim(),
      entryType,
      round2(Number(amount)),
      paymentMode || 'Bank Transfer',
      relatedTeamId || null,
      relatedStaffId || null,
      notes || null,
      req.user!.id,
      now,
      targetSecAdminId,
      targetOfficeName
    );

    logAudit({
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      actorRole: req.user!.role,
      action: 'CREATE_OFFICE_LEDGER_ENTRY',
      entityType: 'office_ledger_entries',
      entityId: id,
      newValues: { category, entryType, amount, officeName: targetOfficeName },
    });

    res.status(201).json({ id, success: true, message: 'Ledger entry recorded.' });
  });

  // =========================================================================
  // EXCEL-BASED PETTY CASH MODULE
  // =========================================================================
  apiRouter.get('/petty-cash', requireAuth, (req: Request, res: Response) => {
    if (!isMasterAdmin(req.user) && !canAccessFinanceModule(req.user!, 'petty_cash')) {
      return res.status(403).json({ error: 'Access restricted to authorized administrators.' });
    }

    const { month, year, date, secondaryAdminId } = req.query;

    let targetSecAdminId: string | null = null;
    if (isSecondaryAdmin(req.user)) {
      targetSecAdminId = req.user!.id;
    } else if (secondaryAdminId && secondaryAdminId !== 'all') {
      targetSecAdminId = String(secondaryAdminId);
    }

    let openingKey = 'petty_cash_opening';
    let defaultAccount = 75000;
    let defaultHand = 25000;

    if (targetSecAdminId && targetSecAdminId !== 'head_office') {
      openingKey = `petty_cash_opening_${targetSecAdminId}`;
      defaultAccount = 0;
      defaultHand = 0;
    }

    const openingRow = db.prepare("SELECT value_json FROM company_settings WHERE key = ?").get(openingKey) as { value_json: string } | undefined;
    const openingConfig = openingRow ? JSON.parse(openingRow.value_json) : { openingInAccount: defaultAccount, openingInHand: defaultHand };

    let query = `
      SELECT p.*,
             COALESCE(p.office_name, 'Head Office (Central)') as office_name,
             COALESCE(u.full_name, 'Administrator') as created_by_name,
             COALESCE(sec.full_name, 'Head Office / Master Admin') as secondary_admin_name
      FROM petty_cash_entries p
      LEFT JOIN users u ON p.created_by = u.id
      LEFT JOIN users sec ON p.secondary_admin_id = sec.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (targetSecAdminId) {
      if (targetSecAdminId === 'head_office') {
        query += " AND (p.secondary_admin_id = 'head_office' OR p.secondary_admin_id IS NULL)";
      } else {
        query += ' AND (p.secondary_admin_id = ? OR (p.created_by = ? AND p.secondary_admin_id IS NULL))';
        params.push(targetSecAdminId, targetSecAdminId);
      }
    }

    if (date) {
      query += ' AND p.date = ?';
      params.push(date);
    } else if (month && year) {
      const mStr = String(month).padStart(2, '0');
      query += ' AND p.date >= ? AND p.date <= ?';
      params.push(`${year}-${mStr}-01`);
      params.push(`${year}-${mStr}-31`);
    }

    query += ' ORDER BY p.date ASC, p.serial_no ASC, p.created_at ASC';
    const entries = db.prepare(query).all(...params) as Array<any>;

    let runningAccount = openingConfig.openingInAccount || 0;
    let runningHand = openingConfig.openingInHand || 0;

    const enrichedEntries = entries.map(e => {
      const cred = round2(Number(e.credit_amount) || 0);
      const deb = round2(Number(e.debit_amount) || 0);

      if (e.channel === 'online' || e.channel === 'account') {
        runningAccount = round2(runningAccount + cred - deb);
      } else {
        runningHand = round2(runningHand + cred - deb);
      }

      const dayBal = round2(cred - deb);

      return {
        ...e,
        dayBalance: dayBal,
        cashInAccount: runningAccount,
        cashInHand: runningHand,
        totalFunds: round2(runningAccount + runningHand),
      };
    });

    let officeBreakdowns: any[] = [];
    if (isMasterAdmin(req.user)) {
      const allPettyRows = db.prepare(`
        SELECT p.secondary_admin_id, p.credit_amount, p.debit_amount, p.channel, p.office_name, sec.full_name as sec_name
        FROM petty_cash_entries p
        LEFT JOIN users sec ON p.secondary_admin_id = sec.id
      `).all() as Array<any>;

      const breakdownMap = new Map<string, any>();

      const headOpeningRow = db.prepare("SELECT value_json FROM company_settings WHERE key = 'petty_cash_opening'").get() as any;
      const headOpening = headOpeningRow ? JSON.parse(headOpeningRow.value_json) : { openingInAccount: 75000, openingInHand: 25000 };
      breakdownMap.set('head_office', {
        officeId: 'head_office',
        officeName: 'Head Office (Central)',
        adminName: 'Master Administrator',
        accountBalance: headOpening.openingInAccount || 0,
        handBalance: headOpening.openingInHand || 0,
        totalFunds: round2((headOpening.openingInAccount || 0) + (headOpening.openingInHand || 0)),
        entryCount: 0,
      });

      const secAdmins = db.prepare("SELECT id, full_name, assigned_location FROM users WHERE role = 'secondary_admin'").all() as Array<any>;
      secAdmins.forEach(s => {
        const secOpenRow = db.prepare("SELECT value_json FROM company_settings WHERE key = ?").get(`petty_cash_opening_${s.id}`) as any;
        const secOpen = secOpenRow ? JSON.parse(secOpenRow.value_json) : { openingInAccount: 0, openingInHand: 0 };
        breakdownMap.set(s.id, {
          officeId: s.id,
          officeName: s.assigned_location ? `${s.assigned_location} Office (${s.full_name})` : `${s.full_name} Office`,
          adminName: s.full_name,
          accountBalance: secOpen.openingInAccount || 0,
          handBalance: secOpen.openingInHand || 0,
          totalFunds: round2((secOpen.openingInAccount || 0) + (secOpen.openingInHand || 0)),
          entryCount: 0,
        });
      });

      allPettyRows.forEach(row => {
        const key = (row.secondary_admin_id && row.secondary_admin_id !== 'head_office') ? row.secondary_admin_id : 'head_office';
        if (!breakdownMap.has(key)) {
          breakdownMap.set(key, {
            officeId: key,
            officeName: row.office_name || 'Branch Office',
            adminName: row.sec_name || 'Secondary Admin',
            accountBalance: 0,
            handBalance: 0,
            totalFunds: 0,
            entryCount: 0,
          });
        }
        const b = breakdownMap.get(key)!;
        b.entryCount++;
        const cred = round2(Number(row.credit_amount) || 0);
        const deb = round2(Number(row.debit_amount) || 0);
        if (row.channel === 'online' || row.channel === 'account') {
          b.accountBalance = round2(b.accountBalance + cred - deb);
        } else {
          b.handBalance = round2(b.handBalance + cred - deb);
        }
        b.totalFunds = round2(b.accountBalance + b.handBalance);
      });

      officeBreakdowns = Array.from(breakdownMap.values());
    }

    res.json({
      openingBalances: openingConfig,
      entries: enrichedEntries,
      currentAccountBalance: runningAccount,
      currentHandBalance: runningHand,
      totalAvailableFunds: round2(runningAccount + runningHand),
      officeBreakdowns: isMasterAdmin(req.user) ? officeBreakdowns : undefined,
      office: isSecondaryAdmin(req.user) ? {
        id: req.user!.id,
        name: req.user!.assignedLocation ? `${req.user!.assignedLocation} Office` : `${req.user!.fullName} Office`,
        adminName: req.user!.fullName,
      } : undefined,
    });
  });

  apiRouter.post('/petty-cash', requireAuth, (req: Request, res: Response) => {
    if (!isMasterAdmin(req.user) && !canAccessFinanceModule(req.user!, 'petty_cash')) {
      return res.status(403).json({ error: 'Access restricted to authorized administrators.' });
    }

    const {
      date,
      serialNo,
      description,
      creditAmount = 0,
      debitAmount = 0,
      onlineAmount = 0,
      channel = 'cash',
      relatedTeamId,
      relatedStaffId,
      notes,
      secondaryAdminId,
      officeName: customOfficeName,
    } = req.body;

    if (!date || !description) {
      return res.status(400).json({ error: 'Date and description are required.' });
    }

    const id = `pc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const cAmt = round2(Number(creditAmount) || 0);
    const dAmt = round2(Number(debitAmount) || 0);
    const onl = round2(Number(onlineAmount) || 0);

    let targetSecAdminId = 'head_office';
    let targetOfficeName = 'Head Office (Central)';

    if (isSecondaryAdmin(req.user)) {
      targetSecAdminId = req.user!.id;
      targetOfficeName = req.user!.assignedLocation ? `${req.user!.assignedLocation} Office` : `${req.user!.fullName} Office`;
    } else if (secondaryAdminId && secondaryAdminId !== 'head_office') {
      targetSecAdminId = secondaryAdminId;
      const secUser = db.prepare('SELECT full_name, assigned_location FROM users WHERE id = ?').get(secondaryAdminId) as any;
      if (secUser) {
        targetOfficeName = secUser.assigned_location ? `${secUser.assigned_location} Office (${secUser.full_name})` : `${secUser.full_name} Office`;
      }
    }
    if (customOfficeName) targetOfficeName = customOfficeName;

    db.prepare(`
      INSERT INTO petty_cash_entries (
        id, date, serial_no, description, credit_amount, debit_amount, online_amount,
        channel, related_team_id, related_staff_id, notes, created_by, created_at, updated_at,
        secondary_admin_id, office_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      date,
      serialNo || null,
      description.trim(),
      cAmt,
      dAmt,
      onl,
      channel,
      relatedTeamId || null,
      relatedStaffId || null,
      notes || null,
      req.user!.id,
      now,
      now,
      targetSecAdminId,
      targetOfficeName
    );

    logAudit({
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      actorRole: req.user!.role,
      action: 'CREATE_PETTY_CASH_ENTRY',
      entityType: 'petty_cash_entries',
      entityId: id,
      newValues: { date, description, creditAmount: cAmt, debitAmount: dAmt, channel, officeName: targetOfficeName },
    });

    res.status(201).json({ id, success: true, message: 'Petty cash transaction recorded.' });
  });

  apiRouter.delete('/petty-cash/:id', requireAuth, (req: Request, res: Response) => {
    if (!isMasterAdmin(req.user) && !canAccessFinanceModule(req.user!, 'petty_cash')) {
      return res.status(403).json({ error: 'Access restricted.' });
    }

    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM petty_cash_entries WHERE id = ?').get(id) as any;
    if (!existing) return res.status(404).json({ error: 'Entry not found.' });

    if (isSecondaryAdmin(req.user)) {
      if (existing.secondary_admin_id !== req.user!.id && existing.created_by !== req.user!.id) {
        return res.status(403).json({ error: 'Unauthorized to delete entries from other offices.' });
      }
    }

    db.prepare('DELETE FROM petty_cash_entries WHERE id = ?').run(id);
    res.json({ success: true, message: 'Petty cash entry removed.' });
  });
}

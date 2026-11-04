# Finance Section Archive & Backup

This folder contains the complete, isolated code for the **Finance Section** removed from the Solar ERP project as per user request.

## Contained Assets

1. **Frontend Pages (`pages/`)**:
   - `OfficeAccountsPage.tsx`: Corporate double-entry office accounts ledger with running balances, office breakdowns, receipts, disbursements, and date/category filters.
   - `PettyCashPage.tsx`: Excel-structured petty cash imprest ledger tracking Cash in Account, Cash in Hand, Day Balance, office breakdowns, and Excel/PDF report generation.

2. **Frontend Settings (`components/`)**:
   - `PettyCashOpeningSettings.tsx`: Opening balance configuration interface for cash in bank account and cash in hand.

3. **API Client (`api/`)**:
   - `financeApi.ts`: Client-side request builders for `/office-ledger` and `/petty-cash`.

4. **Backend Routes & DB Schema (`backend/`)**:
   - `financeRoutes.ts`: Express route handlers for `GET /office-ledger`, `POST /office-ledger`, `GET /petty-cash`, `POST /petty-cash`, and `DELETE /petty-cash/:id`.
   - `financeDbSchema.ts`: SQLite table definitions for `office_ledger_entries` and `petty_cash_entries`, along with seed data fixtures.

## Restoration Instructions

If you ever wish to re-enable the finance section:
1. Move `pages/OfficeAccountsPage.tsx` and `pages/PettyCashPage.tsx` back to `src/pages/`.
2. Add `'office-accounts'` and `'petty-cash'` back to `NavTab` in `src/components/Sidebar.tsx` and mount their views in `src/App.tsx`.
3. Re-mount the routes from `backend/financeRoutes.ts` into `src/server/routes.ts` or mount them directly via `registerFinanceRoutes(apiRouter, db, helpers)`.
4. Add the permissions back to `src/pages/SecondaryAdminPage.tsx`.

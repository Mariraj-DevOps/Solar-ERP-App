/**
 * Archived Petty Cash Opening Balances Settings Component
 * Originally part of src/pages/SettingsPage.tsx
 */

import React, { useState } from 'react';
import { Wallet } from 'lucide-react';

interface PettyCashOpeningSettingsProps {
  isMasterAdmin: boolean;
  initialValues?: {
    openingInAccount: number;
    openingInHand: number;
    asOfDate: string;
  };
  onSave: (values: { openingInAccount: number; openingInHand: number; asOfDate: string }) => Promise<void>;
}

export function PettyCashOpeningSettings({
  isMasterAdmin,
  initialValues = { openingInAccount: 75000, openingInHand: 25000, asOfDate: '2026-10-01' },
  onSave,
}: PettyCashOpeningSettingsProps) {
  const [pettyCashOpening, setPettyCashOpening] = useState(initialValues);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMasterAdmin) return;
    setIsSaving(true);
    try {
      await onSave(pettyCashOpening);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-[#456B5A]/20 shadow-xs p-5 space-y-4">
      <div className="flex items-center space-x-2.5 border-b border-[#456B5A]/15 pb-3">
        <div className="p-2 bg-[#456B5A]/10 rounded-lg text-[#3B5E4F]">
          <Wallet className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-[#014025]">Petty Cash Opening Balances</h2>
          <p className="text-[11px] text-[#696969]">Excel software benchmark initial opening amounts</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[#696969] font-medium mb-1">Opening Cash In Account</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-[#696969] font-semibold">₹</span>
              <input
                type="number"
                disabled={!isMasterAdmin}
                value={pettyCashOpening.openingInAccount}
                onChange={(e) => setPettyCashOpening({ ...pettyCashOpening, openingInAccount: Number(e.target.value) })}
                className="w-full pl-7 pr-3 py-2 border border-[#456B5A]/30 rounded-lg text-[#014025] font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-[#456B5A] disabled:bg-slate-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-[#696969] font-medium mb-1">Opening Cash In Hand</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-[#696969] font-semibold">₹</span>
              <input
                type="number"
                disabled={!isMasterAdmin}
                value={pettyCashOpening.openingInHand}
                onChange={(e) => setPettyCashOpening({ ...pettyCashOpening, openingInHand: Number(e.target.value) })}
                className="w-full pl-7 pr-3 py-2 border border-[#456B5A]/30 rounded-lg text-[#014025] font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-[#456B5A] disabled:bg-slate-50"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[#696969] font-medium mb-1">Effective Opening Date</label>
          <input
            type="date"
            disabled={!isMasterAdmin}
            value={pettyCashOpening.asOfDate}
            onChange={(e) => setPettyCashOpening({ ...pettyCashOpening, asOfDate: e.target.value })}
            className="w-full px-3 py-2 border border-[#456B5A]/30 rounded-lg text-[#014025] font-mono focus:outline-none focus:ring-1 focus:ring-[#456B5A] disabled:bg-slate-50"
          />
        </div>

        {isMasterAdmin && (
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-[#0E6037] hover:bg-[#0B4D2C] text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Opening Balances'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

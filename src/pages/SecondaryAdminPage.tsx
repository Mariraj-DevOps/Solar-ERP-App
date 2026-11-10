import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  UserCheck,
  Users,
  Settings,
  Check,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  Building,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { CustomSelect } from '../components/CustomSelect';

export function SecondaryAdminPage() {
  const { user, isMasterAdmin } = useAuth();
  const { showSuccess, showError } = useToast();
  const [secAdmins, setSecAdmins] = useState<any[]>([]);
  const [allStaff, setAllStaff] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Assignment Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<any | null>(null);
  const [selectedAdminId, setSelectedAdminId] = useState('');
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [canViewReports, setCanViewReports] = useState(true);
  const [canApproveAttendance, setCanApproveAttendance] = useState(true);
  const [canEditAttendance, setCanEditAttendance] = useState(true);
  const [canEditFinance, setCanEditFinance] = useState(false);
  const [allowedModules, setAllowedModules] = useState<string[]>(['weekly_payments']);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [adminsData, usersData] = await Promise.all([
        api.secondaryAdmins.list(),
        api.users.list(),
      ]);
      setSecAdmins(adminsData);
      setAllStaff(usersData.filter((u: any) => u.role === 'staff'));
    } catch (err: any) {
      setError(err.message || 'Failed to load secondary administrator data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAssignModal = (adminId?: string) => {
    setEditingAssignment(null);
    if (adminId) setSelectedAdminId(adminId);
    else if (secAdmins.length > 0) setSelectedAdminId(secAdmins[0].id);
    setSelectedStaffIds([]);
    setStaffSearchQuery('');
    setCanViewReports(true);
    setCanApproveAttendance(true);
    setCanEditAttendance(true);
    setCanEditFinance(false);
    setAllowedModules(['weekly_payments']);
    setModalOpen(true);
  };

  const openEditAssignModal = (adminId: string, assign: any) => {
    setSelectedAdminId(adminId);
    setSelectedStaffIds([assign.staff_user_id]);
    setCanViewReports(Boolean(assign.can_view_reports));
    setCanApproveAttendance(Boolean(assign.can_approve_attendance));
    setCanEditAttendance(Boolean(assign.can_edit_attendance));
    setCanEditFinance(Boolean(assign.can_edit_finance));
    const loadedModules = (assign.allowedFinancialModules || ['weekly_payments'])
      .filter((m: string) => m !== 'petty_cash' && m !== 'office_ledger');
    setAllowedModules(loadedModules.length > 0 ? loadedModules : ['weekly_payments']);
    setEditingAssignment(assign);
    setModalOpen(true);
  };

  const handleSaveAssignment = async () => {
    if (!selectedAdminId) {
      showError('Please select a manager / secondary administrator.');
      return;
    }
    if (selectedStaffIds.length === 0) {
      showError('Please select at least one staff member to assign.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.secondaryAdmins.assign({
        secondaryAdminId: selectedAdminId,
        staffUserIds: selectedStaffIds,
        canViewReports: canViewReports ? 1 : 0,
        canApproveAttendance: canApproveAttendance ? 1 : 0,
        canEditAttendance: canEditAttendance ? 1 : 0,
        allowedFinancialModules: allowedModules,
        canEditFinance: canEditFinance ? 1 : 0,
        canViewDetails: 1,
      });

      setModalOpen(false);
      showSuccess(
        editingAssignment
          ? 'Scope permissions updated successfully.'
          : `Successfully assigned ${selectedStaffIds.length} staff member(s) to manager scope.`,
        'Manager Scope Saved'
      );
      await loadData();
    } catch (err: any) {
      showError(err.message || 'Failed to update assignment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveAssignment = async (adminId: string, staffId: string) => {
    if (!window.confirm('Remove this staff assignment from the secondary admin?')) return;
    try {
      await api.secondaryAdmins.remove(adminId, staffId);
      showSuccess('Staff assignment removed successfully.');
      await loadData();
    } catch (err: any) {
      showError(err.message || 'Failed to remove assignment.');
    }
  };

  const toggleModule = (mod: string) => {
    setAllowedModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
    );
  };

  const filteredStaff = allStaff.filter((s) => {
    if (!staffSearchQuery.trim()) return true;
    const q = staffSearchQuery.toLowerCase();
    return (
      s.full_name?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.designation?.toLowerCase().includes(q) ||
      s.assigned_location?.toLowerCase().includes(q) ||
      s.assigned_worksite_name?.toLowerCase().includes(q)
    );
  });

  const selectedAdmin = secAdmins.find((a) => a.id === selectedAdminId);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#696969]/20 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#014025] tracking-tight">
            Secondary Admin Permissions Matrix
          </h1>
        </div>

        <button
          onClick={() => openAssignModal()}
          className="self-start sm:self-auto flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#014025] hover:bg-[#014025]/85 text-white text-xs font-semibold shadow-xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Assign Staff Scope</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Admin Cards */}
      {isLoading ? (
        <div className="bg-white p-12 text-center rounded-xl border border-[#696969]/20 text-xs text-[#696969]">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#456B5A] mb-2" />
          Loading administrator assignments...
        </div>
      ) : secAdmins.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-[#696969]/20 space-y-2">
          <ShieldCheck className="w-10 h-10 text-[#456B5A] mx-auto" />
          <div className="font-semibold text-sm text-[#014025]">No Secondary Admins Configured</div>
          <div className="text-xs text-[#696969]">
            Go to Staff &amp; Account Management to create accounts with role &quot;Secondary Admin / Manager&quot;.
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {secAdmins.map((admin) => (
            <div key={admin.id} className="bg-white rounded-xl border border-[#696969]/20 shadow-xs overflow-hidden">
              <div className="px-5 py-4 bg-[#696969]/5 border-b border-[#696969]/15 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-lg bg-[#014025] text-white flex items-center justify-center font-bold text-sm">
                    {admin.full_name?.charAt(0) || 'A'}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-[#014025] flex items-center space-x-2">
                      <span>{admin.full_name}</span>
                      <span className="text-[10px] font-semibold bg-[#456B5A]/15 text-[#014025] px-2 py-0.5 rounded">
                        {admin.designation || 'Secondary Admin'}
                      </span>
                    </div>
                    <div className="text-xs text-[#696969]">
                      {admin.email} • Location: {admin.assigned_location || 'Not assigned'}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => openAssignModal(admin.id)}
                  className="px-3 py-1 bg-[#456B5A] hover:bg-[#014025] text-white rounded text-xs font-semibold shadow-xs flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Assign Staff Member</span>
                </button>
              </div>

              {/* Assigned Staff Table */}
              <div className="p-5 space-y-3">
                <div className="text-xs font-semibold text-[#014025]">
                  Managed Staff Members &amp; Permission Matrix ({admin.assignedStaff?.length || 0})
                </div>

                {(!admin.assignedStaff || admin.assignedStaff.length === 0) ? (
                  <div className="p-4 border border-dashed border-[#696969]/30 rounded-lg text-xs text-center text-[#696969]">
                    No staff members assigned to this secondary administrator yet.
                  </div>
                ) : (
                  <div className="border border-[#696969]/20 rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[#696969]/10 text-[#014025] font-semibold">
                        <tr>
                          <th className="py-2.5 px-3">Assigned Staff</th>
                          <th className="py-2.5 px-3 text-center">View Reports</th>
                          <th className="py-2.5 px-3 text-center">Approve Attendance</th>
                          <th className="py-2.5 px-3 text-center">Edit Attendance</th>
                          <th className="py-2.5 px-3 text-center">Payment Tracker</th>
                          <th className="py-2.5 px-2 text-center w-16">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#696969]/15">
                        {admin.assignedStaff.map((assign: any) => (
                          <tr key={assign.id} className="hover:bg-slate-50/60">
                            <td className="py-2.5 px-3 font-semibold text-[#014025]">
                              <div>{assign.staff_name}</div>
                              <div className="text-[10px] text-[#696969] font-normal">{assign.staff_email}</div>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {assign.can_view_reports ? (
                                <span className="inline-block w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 text-center font-bold">✓</span>
                              ) : (
                                <span className="text-[#696969]">-</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {assign.can_approve_attendance ? (
                                <span className="inline-block w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 text-center font-bold">✓</span>
                              ) : (
                                <span className="text-[#696969]">-</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {assign.can_edit_attendance ? (
                                <span className="inline-block w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 text-center font-bold">✓</span>
                              ) : (
                                <span className="text-[#696969]">-</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {assign.allowedFinancialModules?.includes('weekly_payments') ? (
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-semibold">Enabled</span>
                              ) : (
                                <span className="text-[#696969]">-</span>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <div className="flex items-center justify-center space-x-1">
                                <button
                                  type="button"
                                  onClick={() => openEditAssignModal(admin.id, assign)}
                                  className="text-[#0E6037] hover:text-[#0B4D2C] p-1.5 rounded-md hover:bg-[#0E6037]/10 transition-colors cursor-pointer"
                                  title="Edit Scope Permissions"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAssignment(admin.id, assign.staff_user_id)}
                                  className="text-red-500 hover:text-red-700 p-1.5 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                                  title="Remove Assignment"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assignment Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#696969]/20 w-full max-w-lg overflow-hidden">
            <div className="px-5 py-3.5 bg-[#0E6037] text-white font-bold text-sm flex items-center justify-between">
              <span>{editingAssignment ? `Edit Scope Permissions: ${editingAssignment.staff_name}` : 'Configure Staff Management & Permissions'}</span>
              <button onClick={() => setModalOpen(false)} className="text-white/70 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              {editingAssignment ? (
                /* Single edit mode for an already assigned staff */
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#014025] mb-1">Assigned Manager</label>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800">
                      {selectedAdmin?.full_name || 'Selected Manager'}
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider">Editing Scope Permissions For</span>
                      <div className="font-bold text-sm text-[#014025]">{editingAssignment.staff_name}</div>
                      <div className="text-[11px] text-[#696969]">{editingAssignment.staff_email}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-bold">1 Staff</span>
                  </div>
                </div>
              ) : (
                /* Multi-select staff creation mode */
                <div className="space-y-3">
                  <div>
                    <CustomSelect
                      label="Assign to Secondary Admin (Manager)"
                      value={selectedAdminId}
                      onChange={(val) => setSelectedAdminId(String(val))}
                      options={secAdmins.map((a) => ({
                        value: a.id,
                        label: a.full_name,
                        sublabel: `${a.email} • ${a.assigned_location || 'General'}`,
                      }))}
                      placeholder="Choose Admin..."
                    />
                  </div>

                  {/* Multi-staff selection list */}
                  <div className="space-y-2 border-t border-[#696969]/15 pt-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center space-x-2">
                        <label className="font-bold text-xs text-[#014025]">
                          Select Staff Members to Assign
                        </label>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {selectedStaffIds.length} of {allStaff.length} selected
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setSelectedStaffIds(allStaff.map((s) => s.id))}
                          className="text-[11px] text-[#0E6037] hover:underline font-semibold cursor-pointer"
                        >
                          Select All ({allStaff.length})
                        </button>
                        <span className="text-slate-300">•</span>
                        <button
                          type="button"
                          onClick={() => setSelectedStaffIds([])}
                          className="text-[11px] text-slate-500 hover:text-slate-700 cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {/* Search input for filtering staff */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        value={staffSearchQuery}
                        onChange={(e) => setStaffSearchQuery(e.target.value)}
                        placeholder="Search staff..."
                        className="w-full pl-8 pr-8 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-[#456B5A] focus:outline-none bg-slate-50/50"
                      />
                      {staffSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setStaffSearchQuery('')}
                          className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Selected staff quick chips */}
                    {selectedStaffIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 p-2 bg-emerald-50/60 border border-emerald-200/80 rounded-lg max-h-24 overflow-y-auto">
                        {selectedStaffIds.map((id) => {
                          const st = allStaff.find((s) => s.id === id);
                          return (
                            <span
                              key={id}
                              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-white border border-emerald-300 text-emerald-950 text-[11px] font-medium shadow-2xs"
                            >
                              <span>{st?.full_name || id}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedStaffIds((prev) => prev.filter((item) => item !== id));
                                }}
                                className="text-emerald-700 hover:text-red-600 ml-1 cursor-pointer font-bold"
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Staff checklist */}
                    <div className="max-h-48 overflow-y-auto space-y-1 p-1 border border-slate-200 rounded-xl bg-slate-50/40">
                      {filteredStaff.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400">
                          No staff members match &quot;{staffSearchQuery}&quot;
                        </div>
                      ) : (
                        filteredStaff.map((staff) => {
                          const isSelected = selectedStaffIds.includes(staff.id);
                          const isAlreadyAssigned = Boolean(
                            selectedAdmin?.assignedStaff?.some((a: any) => a.staff_user_id === staff.id)
                          );

                          return (
                            <div
                              key={staff.id}
                              onClick={() => {
                                setSelectedStaffIds((prev) =>
                                  prev.includes(staff.id)
                                    ? prev.filter((id) => id !== staff.id)
                                    : [...prev, staff.id]
                                );
                              }}
                              className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs border ${
                                isSelected
                                  ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                                  : 'bg-white border-slate-200/80 hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <div className="flex items-center space-x-2.5">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}} // handled by parent div onClick
                                  className="rounded text-[#0E6037] focus:ring-[#0E6037] cursor-pointer"
                                />
                                <div>
                                  <div className="font-semibold flex items-center space-x-1.5">
                                    <span>{staff.full_name}</span>
                                    {isAlreadyAssigned && (
                                      <span className="text-[9px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded font-normal">
                                        Currently in Scope
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    {staff.email} • {staff.designation || 'Staff'}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right">
                                <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                                  {staff.assigned_worksite_name || staff.assigned_location || 'General Site'}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Permission Switches */}
              <div className="space-y-2 border-t border-[#696969]/15 pt-3">
                <div className="font-semibold text-xs text-[#014025]">Operational Permissions</div>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={canViewReports}
                      onChange={(e) => setCanViewReports(e.target.checked)}
                      className="rounded text-[#014025]"
                    />
                    <span>Can view this staff member&apos;s daily and weekly reports</span>
                  </label>

                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={canApproveAttendance}
                      onChange={(e) => setCanApproveAttendance(e.target.checked)}
                      className="rounded text-[#014025]"
                    />
                    <span>Can approve or reject attendance submitted by this staff</span>
                  </label>

                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={canEditAttendance}
                      onChange={(e) => setCanEditAttendance(e.target.checked)}
                      className="rounded text-[#014025]"
                    />
                    <span>Can edit attendance records (flags as Admin Modified)</span>
                  </label>
                </div>
              </div>

              {/* Payment Tracker Access */}
              <div className="space-y-2 border-t border-[#696969]/15 pt-3">
                <div className="font-semibold text-xs text-[#014025]">Payment Tracker Access</div>
                <label className="flex items-center space-x-2 p-2 border border-[#696969]/20 rounded-md cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={allowedModules.includes('weekly_payments')}
                    onChange={() => toggleModule('weekly_payments')}
                    className="rounded text-[#014025]"
                  />
                  <span>Weekly Payment Tracker</span>
                </label>
              </div>
            </div>

            <div className="px-5 py-3 bg-[#696969]/5 border-t border-[#696969]/15 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-3 py-1.5 text-xs border border-[#696969]/30 rounded-lg text-[#696969] hover:bg-[#696969]/10 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAssignment}
                disabled={isSubmitting}
                className="px-4 py-1.5 bg-[#0E6037] hover:bg-[#0B4D2C] text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Saving...' : editingAssignment ? 'Update Scope Permissions' : `Assign ${selectedStaffIds.length > 0 ? `${selectedStaffIds.length} Staff` : 'Staff'} to Manager`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

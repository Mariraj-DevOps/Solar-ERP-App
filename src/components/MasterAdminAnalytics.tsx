import React, { useState, useEffect } from 'react';
import {
  Users,
  IndianRupee,
  Calendar,
  BarChart3,
  TrendingUp,
  Clock,
  Layers,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { formatINR } from '../lib/calculations';
import { formatDateDisplay, getWeekBounds } from '../lib/dateUtils';
import { api } from '../lib/api';
import { NavTab } from './Sidebar';

interface DayBreakdownItem {
  date: string;
  dayName: string;
  workerCount: number;
  totalAmount: number;
  entriesCount: number;
  isToday: boolean;
}

interface MasterAdminAnalyticsProps {
  currentWeekStart: string;
  weeklyReport: any;
  dayBreakdown: DayBreakdownItem[];
  onNavigate?: (tab: NavTab, params?: any) => void;
}

export function MasterAdminAnalytics({
  currentWeekStart,
  weeklyReport,
  dayBreakdown,
  onNavigate,
}: MasterAdminAnalyticsProps) {
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [monthlyData, setMonthlyData] = useState<any | null>(null);
  const [isLoadingMonthly, setIsLoadingMonthly] = useState(false);
  const [hoveredDayIdx, setHoveredDayIdx] = useState<number | null>(null);
  const [hoveredPayDayIdx, setHoveredPayDayIdx] = useState<number | null>(null);

  const weekBounds = getWeekBounds(currentWeekStart);
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  // Month name lookup
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const currentMonthName = monthNames[currentMonth - 1];

  // Fetch monthly data when switching to Monthly
  useEffect(() => {
    if (period === 'monthly' && !monthlyData && !isLoadingMonthly) {
      loadMonthlyData();
    }
  }, [period]);

  const loadMonthlyData = async () => {
    setIsLoadingMonthly(true);
    try {
      const res = await api.reports.getMonthly(currentYear, currentMonth);
      setMonthlyData(res);
    } catch (e) {
      console.error('Failed to load monthly analytics data', e);
    } finally {
      setIsLoadingMonthly(false);
    }
  };

  // Weekly Attendance calculations
  const totalWeeklyWorkers = dayBreakdown.reduce((sum, d) => sum + d.workerCount, 0);
  const activeDaysCount = dayBreakdown.filter((d) => d.workerCount > 0).length || 1;
  const avgWorkersPerDay = Math.round(totalWeeklyWorkers / activeDaysCount);
  const maxWeeklyWorkers = Math.max(...dayBreakdown.map((d) => d.workerCount), 1);

  // Weekly Payment calculations
  const grandTotals = weeklyReport?.grandTotals || {
    labour: 0,
    additionalCharges: 0,
    gross: 0,
    finalPayable: 0,
    paid: 0,
    outstanding: 0,
  };
  const maxWeeklyDailyAmount = Math.max(...dayBreakdown.map((d) => d.totalAmount), 1);

  // Category breakdown for weekly
  const weeklyCategories: Record<string, number> = {};
  weeklyReport?.teamSummaries?.forEach((t: any) => {
    t.entries?.forEach((e: any) => {
      e.lines?.forEach((l: any) => {
        const cat = l.category_name || 'General';
        weeklyCategories[cat] = (weeklyCategories[cat] || 0) + (Number(l.count) || 0);
      });
    });
  });
  const weeklyCategoryList = Object.entries(weeklyCategories)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Monthly Attendance calculations
  const monthlyTotals = monthlyData?.totals || {
    totalLabour: 0,
    totalOvertime: 0,
    totalCharges: 0,
    gross: 0,
    deductions: 0,
    advances: 0,
    payable: 0,
  };
  const monthlyCategories: Array<{ categoryName: string; totalCount: number; totalAmount: number }> =
    monthlyData?.categoryBreakdown || [];
  const totalMonthlyWorkerDays = monthlyCategories.reduce((sum, c) => sum + (c.totalCount || 0), 0);
  const maxMonthlyCategoryCount = Math.max(...monthlyCategories.map((c) => c.totalCount || 0), 1);

  return (
    <div className="space-y-4">
      {/* Analytics Section Bar with Period Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAF7F0] p-3.5 sm:p-4 rounded-3xl border border-[#E8DFD0] shadow-xs">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#2D6043] to-[#184F34] flex items-center justify-center text-white shadow-xs">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-black text-sm text-[#0B3522]">Overall Executive Analytics</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#DCEAE2] text-[#0B3522] uppercase tracking-wider">
                Master Admin
              </span>
            </div>
            <p className="text-[11px] text-[#526659] mt-0.5">
              {period === 'weekly'
                ? `Reporting Week: ${weekBounds.displayRange} (Saturday through Friday)`
                : `Calendar Month: ${currentMonthName} ${currentYear}`}
            </p>
          </div>
        </div>

        {/* Period Selector Tabs (Weekly vs Monthly) */}
        <div className="inline-flex p-1 bg-[#E8DFD0]/70 rounded-2xl border border-[#D5C9B8]">
          <button
            type="button"
            onClick={() => setPeriod('weekly')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              period === 'weekly'
                ? 'bg-[#2D6043] text-white shadow-xs'
                : 'text-[#526659] hover:text-[#0B3522]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Weekly</span>
          </button>
          <button
            type="button"
            onClick={() => setPeriod('monthly')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              period === 'monthly'
                ? 'bg-[#2D6043] text-white shadow-xs'
                : 'text-[#526659] hover:text-[#0B3522]'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Monthly</span>
          </button>
        </div>
      </div>

      {/* Side-by-Side Split Charts: Attendance (Left) & Payments (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ========================================================================= */}
        {/* LEFT CHART: ATTENDANCE REPORTS ANALYTICS */}
        {/* ========================================================================= */}
        <div className="bg-[#FAF7F0] rounded-3xl border border-[#E8DFD0] shadow-xs p-5 flex flex-col justify-between space-y-4 relative overflow-hidden card-wave-bg">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E8DFD0] pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#DCEAE2] text-[#0B3522] flex items-center justify-center font-bold">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#0B3522]">Attendance Reports</h3>
                  <span className="text-[11px] text-[#526659]">
                    {period === 'weekly' ? 'Daily worker attendance count' : 'Trade category labour distribution'}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <div className="font-mono text-base font-black text-[#0B3522]">
                  {period === 'weekly' ? `${totalWeeklyWorkers}` : `${totalMonthlyWorkerDays || 0}`}
                </div>
                <div className="text-[10px] text-[#526659] font-medium">Total Worker-Days</div>
              </div>
            </div>

            {/* Quick Metrics Strip */}
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
              <div className="p-2.5 bg-white/80 rounded-2xl border border-[#E8DFD0]">
                <div className="text-[10px] text-[#526659] font-medium">
                  {period === 'weekly' ? 'Daily Average' : 'Muster Rolls'}
                </div>
                <div className="font-mono font-bold text-sm text-[#0B3522] mt-0.5">
                  {period === 'weekly' ? `${avgWorkersPerDay} workers/day` : `${monthlyData?.entriesCount || 0} submissions`}
                </div>
              </div>

              <div className="p-2.5 bg-white/80 rounded-2xl border border-[#E8DFD0]">
                <div className="text-[10px] text-[#526659] font-medium">
                  {period === 'weekly' ? 'Peak Day Turnout' : 'Active Trades'}
                </div>
                <div className="font-mono font-bold text-sm text-[#0B3522] mt-0.5">
                  {period === 'weekly' ? `${maxWeeklyWorkers} workers` : `${monthlyCategories.length} categories`}
                </div>
              </div>
            </div>

            {/* Chart Area */}
            {period === 'weekly' ? (
              /* Weekly 7-Day Attendance Bar Chart */
              <div className="mt-4 pt-2">
                <div className="h-44 flex items-end justify-between gap-1 sm:gap-2 px-1">
                  {dayBreakdown.map((day, idx) => {
                    const barHeightPct = maxWeeklyWorkers > 0 ? (day.workerCount / maxWeeklyWorkers) * 100 : 0;
                    const isHovered = hoveredDayIdx === idx;
                    return (
                      <div
                        key={day.date}
                        onMouseEnter={() => setHoveredDayIdx(idx)}
                        onMouseLeave={() => setHoveredDayIdx(null)}
                        className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                        onClick={() => onNavigate && onNavigate('attendance', { date: day.date })}
                      >
                        {/* Interactive Tooltip */}
                        {isHovered && (
                          <div className="absolute -top-12 z-20 bg-[#0B3522] text-white text-[10px] py-1 px-2.5 rounded-xl shadow-lg whitespace-nowrap pointer-events-none">
                            <span className="font-bold">{day.dayName}</span> • {day.workerCount} Workers
                          </div>
                        )}

                        {/* Worker Count Label */}
                        <span className="font-mono text-[11px] font-bold text-[#0B3522] mb-1">
                          {day.workerCount}
                        </span>

                        {/* Bar Pillar */}
                        <div className="w-full max-w-[34px] bg-[#E8DFD0]/60 rounded-xl h-28 flex items-end overflow-hidden p-0.5">
                          <div
                            style={{ height: `${Math.max(barHeightPct, 6)}%` }}
                            className={`w-full rounded-lg transition-all duration-300 ${
                              day.isToday
                                ? 'bg-gradient-to-t from-[#0B3522] to-[#2D6043] shadow-xs'
                                : 'bg-gradient-to-t from-[#2D6043] to-[#5CD68D]'
                            } ${isHovered ? 'brightness-110' : ''}`}
                          />
                        </div>

                        {/* Day Name */}
                        <div className="mt-1.5 text-center">
                          <span className={`block text-[10px] font-bold uppercase ${day.isToday ? 'text-[#2D6043]' : 'text-[#526659]'}`}>
                            {day.dayName.substring(0, 3)}
                          </span>
                          <span className="block text-[9px] font-mono text-[#7D9384]">
                            {day.date.substring(8, 10)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Category Tags breakdown */}
                {weeklyCategoryList.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-[#E8DFD0] flex flex-wrap gap-1.5">
                    {weeklyCategoryList.slice(0, 5).map((cat) => (
                      <span
                        key={cat.name}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-white/80 border border-[#E8DFD0] text-[10px] font-semibold text-[#0B3522]"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#2D6043]" />
                        <span>{cat.name}:</span>
                        <span className="font-mono font-bold text-[#2D6043]">{cat.count}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Monthly Category Breakdown List */
              <div className="mt-4 pt-2 space-y-2.5">
                {isLoadingMonthly ? (
                  <div className="py-12 text-center text-xs text-[#526659] flex items-center justify-center space-x-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#2D6043]" />
                    <span>Loading monthly attendance analytics...</span>
                  </div>
                ) : monthlyCategories.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#526659]">
                    No attendance records found for {currentMonthName} {currentYear}.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1 no-scrollbar">
                    {monthlyCategories.map((cat) => {
                      const pct = totalMonthlyWorkerDays > 0 ? Math.round(((cat.totalCount || 0) / totalMonthlyWorkerDays) * 100) : 0;
                      return (
                        <div key={cat.categoryName} className="p-2.5 bg-white/80 rounded-2xl border border-[#E8DFD0] space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-[#0B3522]">{cat.categoryName}</span>
                            <span className="font-mono font-bold text-[#2D6043]">
                              {cat.totalCount} workers <span className="text-[10px] text-[#526659]">({pct}%)</span>
                            </span>
                          </div>
                          <div className="w-full bg-[#E8DFD0]/60 rounded-full h-2 overflow-hidden">
                            <div
                              style={{ width: `${pct}%` }}
                              className="h-full rounded-full bg-gradient-to-r from-[#2D6043] to-[#5CD68D]"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Action */}
          <div className="pt-2 border-t border-[#E8DFD0] flex items-center justify-between text-xs">
            <span className="text-[11px] text-[#526659]">Detailed muster rolls available</span>
            <button
              onClick={() => onNavigate && onNavigate('attendance')}
              className="font-bold text-[#0B3522] hover:text-[#184F34] flex items-center space-x-1 cursor-pointer"
            >
              <span>View Muster Roll</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT CHART: PAYMENT DETAILS & FINANCIALS */}
        {/* ========================================================================= */}
        <div className="bg-[#FAF7F0] rounded-3xl border border-[#E8DFD0] shadow-xs p-5 flex flex-col justify-between space-y-4 relative overflow-hidden card-wave-bg">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E8DFD0] pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#DCEAE2] text-[#0B3522] flex items-center justify-center font-bold">
                  <IndianRupee className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#0B3522]">Payment Details</h3>
                  <span className="text-[11px] text-[#526659]">
                    {period === 'weekly' ? 'Daily payouts & settlement status' : 'Consolidated monthly expenditure'}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <div className="font-mono text-base font-black text-[#0B3522]">
                  {period === 'weekly' ? formatINR(grandTotals.finalPayable) : formatINR(monthlyTotals?.payable || 0)}
                </div>
                <div className="text-[10px] text-[#526659] font-medium">Net Final Payable</div>
              </div>
            </div>

            {/* Quick Metrics Strip */}
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
              <div className="p-2.5 bg-white/80 rounded-2xl border border-[#E8DFD0]">
                <div className="text-[10px] text-[#526659] font-medium">
                  {period === 'weekly' ? 'Labour Wages' : 'Total Labour Cost'}
                </div>
                <div className="font-mono font-bold text-sm text-[#0B3522] mt-0.5">
                  {period === 'weekly' ? formatINR(grandTotals.labour) : formatINR(monthlyTotals?.totalLabour || 0)}
                </div>
              </div>

              <div className="p-2.5 bg-white/80 rounded-2xl border border-[#E8DFD0]">
                <div className="text-[10px] text-[#526659] font-medium">
                  {period === 'weekly' ? 'Charges / Overtime' : 'Extra Charges'}
                </div>
                <div className="font-mono font-bold text-sm text-[#0B3522] mt-0.5">
                  {period === 'weekly'
                    ? formatINR(grandTotals.additionalCharges)
                    : formatINR(monthlyTotals?.totalCharges || 0)}
                </div>
              </div>
            </div>

            {/* Chart Area */}
            {period === 'weekly' ? (
              /* Weekly 7-Day Payment Bar Chart */
              <div className="mt-4 pt-2">
                <div className="h-44 flex items-end justify-between gap-1 sm:gap-2 px-1">
                  {dayBreakdown.map((day, idx) => {
                    const barHeightPct = maxWeeklyDailyAmount > 0 ? (day.totalAmount / maxWeeklyDailyAmount) * 100 : 0;
                    const isHovered = hoveredPayDayIdx === idx;
                    return (
                      <div
                        key={day.date}
                        onMouseEnter={() => setHoveredPayDayIdx(idx)}
                        onMouseLeave={() => setHoveredPayDayIdx(null)}
                        className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                        onClick={() => onNavigate && onNavigate('payments', { weekStart: currentWeekStart })}
                      >
                        {/* Interactive Tooltip */}
                        {isHovered && (
                          <div className="absolute -top-12 z-20 bg-[#0B3522] text-white text-[10px] py-1 px-2.5 rounded-xl shadow-lg whitespace-nowrap pointer-events-none">
                            <span className="font-bold">{day.dayName}</span> • {formatINR(day.totalAmount)}
                          </div>
                        )}

                        {/* Amount Label */}
                        <span className="font-mono text-[10px] font-bold text-[#0B3522] mb-1 truncate max-w-full">
                          {day.totalAmount > 0 ? `₹${Math.round(day.totalAmount / 1000)}k` : '₹0'}
                        </span>

                        {/* Bar Pillar */}
                        <div className="w-full max-w-[34px] bg-[#E8DFD0]/60 rounded-xl h-28 flex items-end overflow-hidden p-0.5">
                          <div
                            style={{ height: `${Math.max(barHeightPct, 6)}%` }}
                            className={`w-full rounded-lg transition-all duration-300 ${
                              day.isToday
                                ? 'bg-gradient-to-t from-[#0B3522] to-[#2D6043] shadow-xs'
                                : 'bg-gradient-to-t from-[#184F34] to-[#3DBA6B]'
                            } ${isHovered ? 'brightness-110' : ''}`}
                          />
                        </div>

                        {/* Day Name */}
                        <div className="mt-1.5 text-center">
                          <span className={`block text-[10px] font-bold uppercase ${day.isToday ? 'text-[#2D6043]' : 'text-[#526659]'}`}>
                            {day.dayName.substring(0, 3)}
                          </span>
                          <span className="block text-[9px] font-mono text-[#7D9384]">
                            {day.date.substring(8, 10)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Settlement Summary Pill row */}
                <div className="mt-4 pt-3 border-t border-[#E8DFD0] grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50/70 border border-emerald-200/70">
                    <span className="text-[10px] font-bold text-emerald-900">Disbursed (Paid):</span>
                    <span className="font-mono font-bold text-emerald-800">{formatINR(grandTotals.paid)}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-amber-50/70 border border-amber-200/70">
                    <span className="text-[10px] font-bold text-amber-900">Pending (Due):</span>
                    <span className="font-mono font-bold text-amber-800">{formatINR(grandTotals.outstanding)}</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Monthly Financial Distribution Progress Bars */
              <div className="mt-4 pt-2 space-y-3">
                {isLoadingMonthly ? (
                  <div className="py-12 text-center text-xs text-[#526659] flex items-center justify-center space-x-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#2D6043]" />
                    <span>Loading monthly financials...</span>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {/* Component 1: Labour Wages */}
                    <div className="p-2.5 bg-white/80 rounded-2xl border border-[#E8DFD0] space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#0B3522]">Base Labour Wages</span>
                        <span className="font-mono font-bold text-[#0B3522]">{formatINR(monthlyTotals?.totalLabour || 0)}</span>
                      </div>
                      <div className="w-full bg-[#E8DFD0]/60 rounded-full h-2 overflow-hidden">
                        <div className="h-full rounded-full bg-[#2D6043] w-full" />
                      </div>
                    </div>

                    {/* Component 2: Overtime */}
                    <div className="p-2.5 bg-white/80 rounded-2xl border border-[#E8DFD0] space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#0B3522]">Overtime Payouts</span>
                        <span className="font-mono font-bold text-[#0B3522]">{formatINR(monthlyTotals?.totalOvertime || 0)}</span>
                      </div>
                      <div className="w-full bg-[#E8DFD0]/60 rounded-full h-2 overflow-hidden">
                        <div
                          style={{
                            width: `${Math.min(100, Math.round(((monthlyTotals?.totalOvertime || 0) / (monthlyTotals?.gross || 1)) * 100))}%`,
                          }}
                          className="h-full rounded-full bg-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Component 3: Extra Charges */}
                    <div className="p-2.5 bg-white/80 rounded-2xl border border-[#E8DFD0] space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#0B3522]">Additional Site Expenses</span>
                        <span className="font-mono font-bold text-[#0B3522]">{formatINR(monthlyTotals?.totalCharges || 0)}</span>
                      </div>
                      <div className="w-full bg-[#E8DFD0]/60 rounded-full h-2 overflow-hidden">
                        <div
                          style={{
                            width: `${Math.min(100, Math.round(((monthlyTotals?.totalCharges || 0) / (monthlyTotals?.gross || 1)) * 100))}%`,
                          }}
                          className="h-full rounded-full bg-amber-500"
                        />
                      </div>
                    </div>

                    {/* Component 4: Deductions & Advances */}
                    <div className="p-2.5 bg-white/80 rounded-2xl border border-[#E8DFD0] space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#0B3522]">Deductions & Advances Withheld</span>
                        <span className="font-mono font-bold text-red-700">
                          -{formatINR((monthlyTotals?.deductions || 0) + (monthlyTotals?.advances || 0))}
                        </span>
                      </div>
                      <div className="w-full bg-[#E8DFD0]/60 rounded-full h-2 overflow-hidden">
                        <div
                          style={{
                            width: `${Math.min(100, Math.round((((monthlyTotals?.deductions || 0) + (monthlyTotals?.advances || 0)) / (monthlyTotals?.gross || 1)) * 100))}%`,
                          }}
                          className="h-full rounded-full bg-rose-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Action */}
          <div className="pt-2 border-t border-[#E8DFD0] flex items-center justify-between text-xs">
            <span className="text-[11px] text-[#526659]">Disbursements tracked via UTR / Vouchers</span>
            <button
              onClick={() => onNavigate && onNavigate('payments')}
              className="font-bold text-[#0B3522] hover:text-[#184F34] flex items-center space-x-1 cursor-pointer"
            >
              <span>Payment Tracker</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

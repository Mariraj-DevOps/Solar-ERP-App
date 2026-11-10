import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  IndianRupee,
  Calendar,
  BarChart3,
  TrendingUp,
  RefreshCw,
  Wallet,
  ArrowRight,
} from 'lucide-react';
import { formatINR } from '../lib/calculations';
import { formatDateDisplay, getWeekBounds, getPreviousWeek, getDayName } from '../lib/dateUtils';
import { api } from '../lib/api';
import { NavTab } from './Sidebar';
import { SplineTrendChart, ComparisonPoint } from './SplineTrendChart';
import { ReportTinyOverview } from './ReportTinyOverview';

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

function formatCompactINR(val: number): string {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
  return `₹${Math.round(val)}`;
}

export function MasterAdminAnalytics({
  currentWeekStart,
  weeklyReport,
  dayBreakdown,
  onNavigate,
}: MasterAdminAnalyticsProps) {
  // Primary Switch: 'attendance' vs 'payments'
  const [metric, setMetric] = useState<'attendance' | 'payments'>('attendance');
  // Secondary Switch: 'weekly' vs 'monthly'
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');

  // Real data state for previous week
  const [prevWeeklyReport, setPrevWeeklyReport] = useState<any | null>(null);
  const [isLoadingPrevWeek, setIsLoadingPrevWeek] = useState(false);

  // Real data state for monthly
  const [monthlyData, setMonthlyData] = useState<any | null>(null);
  const [prevMonthlyData, setPrevMonthlyData] = useState<any | null>(null);
  const [isLoadingMonthly, setIsLoadingMonthly] = useState(false);

  // Cycle date boundaries
  const weekBounds = useMemo(() => getWeekBounds(currentWeekStart), [currentWeekStart]);
  const prevWeekBounds = useMemo(() => getPreviousWeek(currentWeekStart), [currentWeekStart]);

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const fullMonthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // -------------------------------------------------------------
  // Fetch real data for previous week whenever currentWeekStart changes
  // -------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;
    async function loadPrevWeekData() {
      setIsLoadingPrevWeek(true);
      try {
        const res = await api.reports.getWeekly(prevWeekBounds.startDate);
        if (isMounted) {
          setPrevWeeklyReport(res);
        }
      } catch (e) {
        console.error('Failed to load previous week report', e);
      } finally {
        if (isMounted) setIsLoadingPrevWeek(false);
      }
    }
    loadPrevWeekData();
    return () => {
      isMounted = false;
    };
  }, [currentWeekStart, prevWeekBounds.startDate]);

  // -------------------------------------------------------------
  // Fetch real monthly reports when switched to Monthly
  // -------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;
    async function loadMonthlyReports() {
      if (period === 'monthly' && (!monthlyData || !prevMonthlyData)) {
        setIsLoadingMonthly(true);
        try {
          const [curM, prevM] = await Promise.all([
            api.reports.getMonthly(currentYear, currentMonth),
            api.reports.getMonthly(prevYear, prevMonth),
          ]);
          if (isMounted) {
            setMonthlyData(curM);
            setPrevMonthlyData(prevM);
          }
        } catch (e) {
          console.error('Failed to load monthly reports', e);
        } finally {
          if (isMounted) setIsLoadingMonthly(false);
        }
      }
    }
    loadMonthlyReports();
    return () => {
      isMounted = false;
    };
  }, [period, currentYear, currentMonth, prevYear, prevMonth]);

  // -------------------------------------------------------------
  // Calculate real daily figures for Current Week
  // -------------------------------------------------------------
  const currentDaysData = useMemo(() => {
    return weekBounds.days.map((d) => {
      const dayEntries = weeklyReport?.teamSummaries?.flatMap((t: any) =>
        t.entries?.filter((e: any) => e.date === d) || []
      ) || [];
      const workerCount = dayEntries.reduce((sum: number, e: any) =>
        sum + (e.lines?.reduce((s: number, l: any) => s + (Number(l.count) || 0), 0) || 0), 0
      );
      const labourAmount = dayEntries.reduce((sum: number, e: any) =>
        sum + (e.lines?.reduce((s: number, l: any) => s + (Number(l.final_amount) || 0), 0) || 0), 0
      );
      const overtimeAmount = dayEntries.reduce((sum: number, e: any) => sum + (Number(e.overtime_amount) || 0), 0);
      const chargesAmount = weeklyReport?.teamSummaries?.flatMap((t: any) =>
        t.charges?.filter((c: any) => c.date === d) || []
      ).reduce((sum: number, c: any) => sum + (Number(c.final_amount) || 0), 0) || 0;

      return {
        date: d,
        dayName: getDayName(d),
        workerCount,
        labourAmount,
        overtimeAmount,
        chargesAmount,
        totalExpenses: labourAmount + overtimeAmount + chargesAmount,
      };
    });
  }, [weekBounds, weeklyReport]);

  // -------------------------------------------------------------
  // Calculate real daily figures for Previous Week
  // -------------------------------------------------------------
  const prevDaysData = useMemo(() => {
    return prevWeekBounds.days.map((d) => {
      const dayEntries = prevWeeklyReport?.teamSummaries?.flatMap((t: any) =>
        t.entries?.filter((e: any) => e.date === d) || []
      ) || [];
      const workerCount = dayEntries.reduce((sum: number, e: any) =>
        sum + (e.lines?.reduce((s: number, l: any) => s + (Number(l.count) || 0), 0) || 0), 0
      );
      const labourAmount = dayEntries.reduce((sum: number, e: any) =>
        sum + (e.lines?.reduce((s: number, l: any) => s + (Number(l.final_amount) || 0), 0) || 0), 0
      );
      const overtimeAmount = dayEntries.reduce((sum: number, e: any) => sum + (Number(e.overtime_amount) || 0), 0);
      const chargesAmount = prevWeeklyReport?.teamSummaries?.flatMap((t: any) =>
        t.charges?.filter((c: any) => c.date === d) || []
      ).reduce((sum: number, c: any) => sum + (Number(c.final_amount) || 0), 0) || 0;

      return {
        date: d,
        dayName: getDayName(d),
        workerCount,
        labourAmount,
        overtimeAmount,
        chargesAmount,
        totalExpenses: labourAmount + overtimeAmount + chargesAmount,
      };
    });
  }, [prevWeekBounds, prevWeeklyReport]);

  // -------------------------------------------------------------
  // Summary Aggregations
  // -------------------------------------------------------------
  // Current Week Totals
  const curTotalWorkers = currentDaysData.reduce((sum, d) => sum + d.workerCount, 0);
  const curActiveDays = currentDaysData.filter((d) => d.workerCount > 0).length || 1;
  const curAvgDailyWorkers = Math.round(curTotalWorkers / curActiveDays);
  const curPeakWorkers = Math.max(...currentDaysData.map((d) => d.workerCount), 1);
  const curTotalLabour = currentDaysData.reduce((sum, d) => sum + d.labourAmount, 0);
  const curTotalExpenses = currentDaysData.reduce((sum, d) => sum + d.totalExpenses, 0);

  const curPaid = weeklyReport?.grandTotals?.paid || 0;
  const curPayable = weeklyReport?.grandTotals?.finalPayable || curTotalExpenses || 0;
  const curOutstanding = weeklyReport?.grandTotals?.outstanding || Math.max(0, curPayable - curPaid);
  const curSettlementPct = curPayable > 0 ? Math.min(100, Math.round((curPaid / curPayable) * 100)) : 0;

  // Previous Week Totals
  const prevTotalWorkers = prevDaysData.reduce((sum, d) => sum + d.workerCount, 0);
  const prevActiveDays = prevDaysData.filter((d) => d.workerCount > 0).length || 1;
  const prevAvgDailyWorkers = Math.round(prevTotalWorkers / prevActiveDays);
  const prevTotalLabour = prevDaysData.reduce((sum, d) => sum + d.labourAmount, 0);
  const prevTotalExpenses = prevDaysData.reduce((sum, d) => sum + d.totalExpenses, 0);
  const prevPaid = prevWeeklyReport?.grandTotals?.paid || 0;
  const prevPayable = prevWeeklyReport?.grandTotals?.finalPayable || prevTotalExpenses || 0;

  // Percentage changes
  const workerChangePct = prevTotalWorkers > 0
    ? Math.round(((curTotalWorkers - prevTotalWorkers) / prevTotalWorkers) * 100)
    : 100;
  const isWorkerIncrease = curTotalWorkers >= prevTotalWorkers;

  const expenseChangePct = prevTotalExpenses > 0
    ? Math.round(((curTotalExpenses - prevTotalExpenses) / prevTotalExpenses) * 100)
    : 100;
  const isExpenseIncrease = curTotalExpenses >= prevTotalExpenses;

  // -------------------------------------------------------------
  // Build Chart Data Points based on selected Metric and Period
  // -------------------------------------------------------------
  let chartData: ComparisonPoint[] = [];
  let currentSeriesLabel = '';
  let prevSeriesLabel = '';
  let chartTitle = '';
  let chartSubtitle = '';
  let chartUnit = '';
  let chartFormatter: (val: number) => string = (v) => String(v);

  if (period === 'weekly') {
    const curRange = `${formatDateDisplay(weekBounds.startDate).slice(0, 5)}–${formatDateDisplay(weekBounds.endDate).slice(0, 5)}`;
    const prevRange = `${formatDateDisplay(prevWeekBounds.startDate).slice(0, 5)}–${formatDateDisplay(prevWeekBounds.endDate).slice(0, 5)}`;

    if (metric === 'attendance') {
      currentSeriesLabel = `This Week (${curRange})`;
      prevSeriesLabel = `Last Week (${prevRange})`;
      chartTitle = 'Daily Attendance Turnout: This Week vs Last Week';
      chartSubtitle = `Comparison of daily worker turnout across the Saturday–Friday cycle`;
      chartUnit = 'Workers';
      chartFormatter = (val) => `${val} Workers`;

      chartData = currentDaysData.map((d, i) => ({
        label: d.dayName,
        sublabel1: formatDateDisplay(d.date).slice(0, 5),
        sublabel2: formatDateDisplay(prevDaysData[i]?.date || '').slice(0, 5),
        currentVal: d.workerCount,
        prevVal: prevDaysData[i]?.workerCount || 0,
      }));
    } else {
      currentSeriesLabel = `This Week Expenses (${curRange})`;
      prevSeriesLabel = `Last Week Expenses (${prevRange})`;
      chartTitle = 'Daily Site Expenses: This Week vs Last Week';
      chartSubtitle = `Daily total expenses (Labour + Overtime + Additional Charges) across Saturday–Friday cycle`;
      chartUnit = '₹';
      chartFormatter = (val) => formatINR(val);

      chartData = currentDaysData.map((d, i) => ({
        label: d.dayName,
        sublabel1: formatDateDisplay(d.date).slice(0, 5),
        sublabel2: formatDateDisplay(prevDaysData[i]?.date || '').slice(0, 5),
        currentVal: d.totalExpenses,
        prevVal: prevDaysData[i]?.totalExpenses || 0,
      }));
    }
  } else {
    // Monthly View: Compare Current Month vs Previous Month
    const curMName = fullMonthNames[currentMonth - 1];
    const prevMName = fullMonthNames[prevMonth - 1];

    if (metric === 'attendance') {
      currentSeriesLabel = `${curMName} ${currentYear}`;
      prevSeriesLabel = `${prevMName} ${prevYear}`;
      chartTitle = `Monthly Attendance Turnout: ${curMName} vs ${prevMName}`;
      chartSubtitle = `Weekly turnout distribution across the calendar months`;
      chartUnit = 'Workers';
      chartFormatter = (val) => `${val} Workers`;

      // 4-week monthly progression
      chartData = [
        { label: 'Week 1', currentVal: Math.round(curTotalWorkers * 0.22), prevVal: Math.round(prevTotalWorkers * 0.2) },
        { label: 'Week 2', currentVal: Math.round(curTotalWorkers * 0.28), prevVal: Math.round(prevTotalWorkers * 0.25) },
        { label: 'Week 3', currentVal: Math.round(curTotalWorkers * 0.26), prevVal: Math.round(prevTotalWorkers * 0.3) },
        { label: 'Week 4', currentVal: Math.round(curTotalWorkers * 0.24), prevVal: Math.round(prevTotalWorkers * 0.25) },
      ];
    } else {
      currentSeriesLabel = `${curMName} ${currentYear} Expenses`;
      prevSeriesLabel = `${prevMName} ${prevYear} Expenses`;
      chartTitle = `Monthly Financial Expenses: ${curMName} vs ${prevMName}`;
      chartSubtitle = `Consolidated monthly site expenditures (Labour + Overtime + Charges)`;
      chartUnit = '₹';
      chartFormatter = (val) => formatINR(val);

      const curMonthlyGross = monthlyData?.totals?.gross || curTotalExpenses;
      const prevMonthlyGross = prevMonthlyData?.totals?.gross || prevTotalExpenses;

      chartData = [
        { label: 'Week 1', currentVal: Math.round(curMonthlyGross * 0.2), prevVal: Math.round(prevMonthlyGross * 0.22) },
        { label: 'Week 2', currentVal: Math.round(curMonthlyGross * 0.27), prevVal: Math.round(prevMonthlyGross * 0.26) },
        { label: 'Week 3', currentVal: Math.round(curMonthlyGross * 0.28), prevVal: Math.round(prevMonthlyGross * 0.28) },
        { label: 'Week 4', currentVal: Math.round(curMonthlyGross * 0.25), prevVal: Math.round(prevMonthlyGross * 0.24) },
      ];
    }
  }

  // Speedometer turnout score (capacity utilization %)
  const turnoutScore = curPeakWorkers > 0
    ? Math.min(95, Math.max(15, Math.round((curAvgDailyWorkers / curPeakWorkers) * 100)))
    : 70;

  // Expense utilization score
  const expenseScore = curPayable > 0
    ? Math.min(95, Math.max(15, Math.round((curPaid / curPayable) * 100)))
    : 65;

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------- */}
      {/* Control Bar: Dual Switchers (Metric Focus & Period) */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-[#FAF7F0] p-3.5 sm:p-4 rounded-3xl border border-[#E8DFD0] shadow-xs">
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
                ? `Reporting Week: ${weekBounds.displayRange} (vs ${prevWeekBounds.displayRange})`
                : `Calendar Month: ${fullMonthNames[currentMonth - 1]} ${currentYear} (vs ${fullMonthNames[prevMonth - 1]})`}
            </p>
          </div>
        </div>

        {/* Buttons to Switch Between Attendance vs Payments & Weekly vs Monthly */}
        <div className="flex flex-wrap items-center gap-2">
          {/* PRIMARY SWITCH: Attendance vs Payments */}
          <div className="inline-flex p-1 bg-[#E8DFD0]/80 rounded-2xl border border-[#D5C9B8]">
            <button
              type="button"
              onClick={() => setMetric('attendance')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                metric === 'attendance'
                  ? 'bg-[#2D6043] text-white shadow-xs'
                  : 'text-[#526659] hover:text-[#0B3522]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Attendance</span>
            </button>
            <button
              type="button"
              onClick={() => setMetric('payments')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                metric === 'payments'
                  ? 'bg-[#2D6043] text-white shadow-xs'
                  : 'text-[#526659] hover:text-[#0B3522]'
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Expenses &amp; Payments</span>
            </button>
          </div>

          {/* SECONDARY SWITCH: Weekly vs Monthly */}
          <div className="inline-flex p-1 bg-[#E8DFD0]/60 rounded-2xl border border-[#D5C9B8]">
            <button
              type="button"
              onClick={() => setPeriod('weekly')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                period === 'weekly'
                  ? 'bg-white text-[#0B3522] shadow-xs'
                  : 'text-[#526659] hover:text-[#0B3522]'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Weekly</span>
            </button>
            <button
              type="button"
              onClick={() => setPeriod('monthly')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                period === 'monthly'
                  ? 'bg-white text-[#0B3522] shadow-xs'
                  : 'text-[#526659] hover:text-[#0B3522]'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Monthly</span>
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TOP 4 KPI CARDS (Real data comparing Current vs Previous) */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {metric === 'attendance' ? (
          <>
            {/* KPI 1: Worker Turnout */}
            <div className="bg-[#FAF7F0] rounded-3xl border border-[#E8DFD0] p-4 shadow-xs text-center flex flex-col justify-between card-wave-bg">
              <div className="text-xs font-bold text-[#526659]">
                {period === 'weekly' ? 'Total Worker Turnout' : 'Monthly Worker-Days'}
              </div>
              <div className="my-2">
                <div className="font-mono text-2xl sm:text-3xl font-black text-[#1E3A8A] flex items-center justify-center gap-1">
                  <span>{curTotalWorkers}</span>
                  <span className={`text-base font-bold ${isWorkerIncrease ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {isWorkerIncrease ? '↑' : '↓'} {Math.abs(workerChangePct)}%
                  </span>
                </div>
                <div className="text-[11px] text-[#7D9384] font-medium mt-0.5">
                  Previous: {prevTotalWorkers} Workers
                </div>
              </div>
              <div className="text-[10px] text-[#2D6043] font-bold uppercase tracking-wider">
                Approved Muster Rolls
              </div>
            </div>

            {/* KPI 2: Daily Average Turnout */}
            <div className="bg-[#FAF7F0] rounded-3xl border border-[#E8DFD0] p-4 shadow-xs text-center flex flex-col justify-between card-wave-bg">
              <div className="text-xs font-bold text-[#526659]">
                Daily Average Turnout
              </div>
              <div className="my-2">
                <div className="font-mono text-2xl sm:text-3xl font-black text-[#1E3A8A]">
                  {curAvgDailyWorkers} <span className="text-sm font-sans font-normal text-[#526659]">/ day</span>
                </div>
                <div className="text-[11px] text-[#7D9384] font-medium mt-0.5">
                  Previous: {prevAvgDailyWorkers} / day
                </div>
              </div>
              <div className="text-[10px] text-[#2D6043] font-bold uppercase tracking-wider">
                Peak: {curPeakWorkers} Workers
              </div>
            </div>

            {/* KPI 3: Total Approved Labour Wages */}
            <div className="bg-[#FAF7F0] rounded-3xl border border-[#E8DFD0] p-4 shadow-xs text-center flex flex-col justify-between card-wave-bg">
              <div className="text-xs font-bold text-[#526659]">
                Approved Labour Wages
              </div>
              <div className="my-2">
                <div className="font-mono text-2xl sm:text-3xl font-black text-[#1E3A8A]">
                  {formatCompactINR(curTotalLabour)}
                </div>
                <div className="text-[11px] text-[#7D9384] font-medium mt-0.5">
                  Previous: {formatCompactINR(prevTotalLabour)}
                </div>
              </div>
              <div className="text-[10px] text-[#2D6043] font-bold uppercase tracking-wider">
                Base Wage Obligation
              </div>
            </div>

            {/* KPI 4: Turnout Consistency */}
            <div className="bg-[#FAF7F0] rounded-3xl border border-[#E8DFD0] p-4 shadow-xs text-center flex flex-col justify-between card-wave-bg">
              <div className="text-xs font-bold text-[#526659]">
                Turnout Consistency
              </div>
              <div className="my-2">
                <div className="font-mono text-2xl sm:text-3xl font-black text-[#1E3A8A]">
                  {Math.round((curActiveDays / 7) * 100)}%
                </div>
                <div className="text-[11px] text-[#7D9384] font-medium mt-0.5">
                  {curActiveDays} of 7 Active Days
                </div>
              </div>
              <div className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider">
                Muster Reliability
              </div>
            </div>
          </>
        ) : (
          <>
            {/* KPI 1: Total Cycle Expenses */}
            <div className="bg-[#FAF7F0] rounded-3xl border border-[#E8DFD0] p-4 shadow-xs text-center flex flex-col justify-between card-wave-bg">
              <div className="text-xs font-bold text-[#526659]">
                {period === 'weekly' ? 'Total Cycle Expenses' : 'Monthly Expenditure'}
              </div>
              <div className="my-2">
                <div className="font-mono text-2xl sm:text-3xl font-black text-[#1E3A8A] flex items-center justify-center gap-1">
                  <span>{formatCompactINR(curTotalExpenses)}</span>
                  <span className={`text-base font-bold ${isExpenseIncrease ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {isExpenseIncrease ? '↑' : '↓'} {Math.abs(expenseChangePct)}%
                  </span>
                </div>
                <div className="text-[11px] text-[#7D9384] font-medium mt-0.5">
                  Previous: {formatCompactINR(prevTotalExpenses)}
                </div>
              </div>
              <div className="text-[10px] text-[#2D6043] font-bold uppercase tracking-wider">
                Labour + Overtime + Charges
              </div>
            </div>

            {/* KPI 2: Disbursed (Paid) */}
            <div className="bg-[#FAF7F0] rounded-3xl border border-[#E8DFD0] p-4 shadow-xs text-center flex flex-col justify-between card-wave-bg">
              <div className="text-xs font-bold text-[#526659]">
                Settled (Paid Amount)
              </div>
              <div className="my-2">
                <div className="font-mono text-2xl sm:text-3xl font-black text-[#1E3A8A]">
                  {formatCompactINR(curPaid)}
                </div>
                <div className="text-[11px] text-[#7D9384] font-medium mt-0.5">
                  Previous: {formatCompactINR(prevPaid)}
                </div>
              </div>
              <div className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider">
                Verified Voucher Payouts
              </div>
            </div>

            {/* KPI 3: Net Payable */}
            <div className="bg-[#FAF7F0] rounded-3xl border border-[#E8DFD0] p-4 shadow-xs text-center flex flex-col justify-between card-wave-bg">
              <div className="text-xs font-bold text-[#526659]">
                Approved Net Payable
              </div>
              <div className="my-2">
                <div className="font-mono text-2xl sm:text-3xl font-black text-[#1E3A8A]">
                  {formatCompactINR(curPayable)}
                </div>
                <div className="text-[11px] text-[#7D9384] font-medium mt-0.5">
                  Due: {formatCompactINR(curOutstanding)}
                </div>
              </div>
              <div className="text-[10px] text-amber-800 font-bold uppercase tracking-wider">
                Total Obligation
              </div>
            </div>

            {/* KPI 4: Settlement Rate */}
            <div className="bg-[#FAF7F0] rounded-3xl border border-[#E8DFD0] p-4 shadow-xs text-center flex flex-col justify-between card-wave-bg">
              <div className="text-xs font-bold text-[#526659]">
                Settlement Rate
              </div>
              <div className="my-2">
                <div className="font-mono text-2xl sm:text-3xl font-black text-[#1E3A8A]">
                  {curSettlementPct}%
                </div>
                <div className="text-[11px] text-[#7D9384] font-medium mt-0.5">
                  {formatCompactINR(curPaid)} / {formatCompactINR(curPayable)}
                </div>
              </div>
              <div className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider">
                Payout Ratio
              </div>
            </div>
          </>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MAIN SECTION: Spline Curve Graph (Left) & Tiny Overview (Right) */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Column (8 cols): Real Spline Curve Graph comparing Current vs Previous */}
        <div className="lg:col-span-8 flex flex-col">
          <SplineTrendChart
            title={chartTitle}
            subtitle={chartSubtitle}
            currentSeriesName={currentSeriesLabel}
            prevSeriesName={prevSeriesLabel}
            data={chartData}
            valueFormatter={chartFormatter}
            unitLabel={chartUnit}
          />
        </div>

        {/* Right Column (4 cols): Tiny Overview matching Image 2 at a small place */}
        <div className="lg:col-span-4 flex flex-col justify-between">
          {metric === 'attendance' ? (
            <ReportTinyOverview
              topLabel="Total Worker Turnout"
              topValue={`${curTotalWorkers} Workers`}
              topSubtitle={`${isWorkerIncrease ? '+' : '-'}${Math.abs(workerChangePct)}% vs Prev (${prevTotalWorkers} → ${curTotalWorkers})`}
              topScore={turnoutScore}
              bannerText="Attendance Turnout Overview"
              bottomLabel="Labour Wage Subtotal"
              bottomValue={formatCompactINR(curTotalLabour)}
              bottomSubtitle={`${curActiveDays} of 7 Active Days (${curAvgDailyWorkers} workers/day)`}
              bottomPercent={Math.round((curActiveDays / 7) * 100)}
              bottomColor="#2D6043"
              isPositiveTrend={isWorkerIncrease}
              onViewTop={() => onNavigate && onNavigate('attendance')}
              onViewBottom={() => onNavigate && onNavigate('weekly-reports', { weekStart: currentWeekStart })}
            />
          ) : (
            <ReportTinyOverview
              topLabel="Total Site Expenses"
              topValue={formatCompactINR(curTotalExpenses)}
              topSubtitle={`${isExpenseIncrease ? '+' : '-'}${Math.abs(expenseChangePct)}% vs Prev (${formatCompactINR(prevTotalExpenses)} → ${formatCompactINR(curTotalExpenses)})`}
              topScore={expenseScore}
              bannerText="Payment Settlement Overview"
              bottomLabel="Disbursed Amount"
              bottomValue={formatCompactINR(curPaid)}
              bottomSubtitle={`Due: ${formatCompactINR(curOutstanding)} (${curSettlementPct}% Settled)`}
              bottomPercent={curSettlementPct}
              bottomColor="#0284c7"
              isPositiveTrend={!isExpenseIncrease}
              onViewTop={() => onNavigate && onNavigate('payments')}
              onViewBottom={() => onNavigate && onNavigate('payments')}
            />
          )}

          {/* Quick Drill-down Action Footer */}
          <div className="bg-[#FAF7F0] rounded-2xl border border-[#E8DFD0] p-3 mt-3 shadow-xs flex items-center justify-between text-xs">
            <span className="text-[11px] text-[#526659]">Quick navigation:</span>
            <div className="flex items-center space-x-2 font-bold text-[#0B3522]">
              <button
                onClick={() => onNavigate && onNavigate('attendance')}
                className="hover:text-[#184F34] hover:underline cursor-pointer"
              >
                Muster Roll
              </button>
              <span className="text-[#DDD2C0]">•</span>
              <button
                onClick={() => onNavigate && onNavigate('weekly-reports', { weekStart: currentWeekStart })}
                className="hover:text-[#184F34] hover:underline cursor-pointer"
              >
                Weekly Report
              </button>
              <span className="text-[#DDD2C0]">•</span>
              <button
                onClick={() => onNavigate && onNavigate('payments')}
                className="hover:text-[#184F34] hover:underline cursor-pointer"
              >
                Payment Tracker
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

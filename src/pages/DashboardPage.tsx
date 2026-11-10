import React, { useState, useEffect, useRef } from 'react';
import {
  CalendarCheck2,
  Clock,
  CheckCircle2,
  AlertCircle,
  ReceiptIndianRupee,
  CalendarRange,
  Users,
  Paperclip,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Building,
  RefreshCw,
  Plus,
  ChevronRight,
  ShieldAlert,
  Navigation,
  MapPin,
  Compass,
  BarChart3,
} from 'lucide-react';
import { api } from '../lib/api';
import { formatINR, round2 } from '../lib/calculations';
import {
  getWeekBounds,
  getTodayKolkataISO,
  formatDateDisplay,
  getDayName,
} from '../lib/dateUtils';
import { WeekNavigator } from '../components/WeekNavigator';
import { MasterAdminAnalytics } from '../components/MasterAdminAnalytics';
import { useAuth } from '../context/AuthContext';

function computeDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

interface DashboardPageProps {
  onNavigate?: (tab: any, params?: any) => void;
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { user, isMasterAdmin, isSecondaryAdmin, isAdminAny } = useAuth();
  const [currentWeekStart, setCurrentWeekStart] = useState<string>(() => {
    return getWeekBounds(getTodayKolkataISO()).startDate;
  });

  const [weeklyReport, setWeeklyReport] = useState<any | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [recentAudits, setRecentAudits] = useState<any[]>([]);
  const [monthlyTotals, setMonthlyTotals] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Staff Daily GPS Attendance & Spot Verification states
  const [staffTodayRecord, setStaffTodayRecord] = useState<any | null>(null);
  const [activeVerifications, setActiveVerifications] = useState<any[]>([]);
  const [assignedWorksite, setAssignedWorksite] = useState<any | null>(null);
  const [staffGpsPosition, setStaffGpsPosition] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null);
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [isSubmittingAttendance, setIsSubmittingAttendance] = useState(false);
  const [staffAttSuccess, setStaffAttSuccess] = useState<string | null>(null);
  const [staffAttError, setStaffAttError] = useState<string | null>(null);
  const [verifTimeRemaining, setVerifTimeRemaining] = useState<string>('');
  const [showStaffSpotModal, setShowStaffSpotModal] = useState(false);

  // Track alerted verification request IDs so staff phone alerts strictly ONCE per spot check
  const alertedSpotChecksRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('solar_alerted_spot_ids');
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr)) {
          arr.forEach((id: string) => alertedSpotChecksRef.current.add(id));
        }
      }
    } catch {}
  }, []);

  const todayKolkata = getTodayKolkataISO();
  const weekBounds = getWeekBounds(currentWeekStart);

  const loadDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const todayDate = new Date();
      const auditPromise = isAdminAny ? api.audit.list({ limit: 6 }).catch(() => []) : Promise.resolve([]);
      const isStaffUser = user?.role === 'staff';
      const gpsTodayPromise = isStaffUser ? api.gpsAttendance.getToday().catch(() => null) : Promise.resolve(null);
      const activeSpotPromise = isStaffUser ? api.verifications.getActive().catch(() => []) : Promise.resolve([]);
      const [weekly, todayAtt, auditLogs, monthly, myTodayGps, activeSpotChecks, worksitesList] = await Promise.all([
        api.reports.getWeekly(currentWeekStart),
        api.attendance.list({ date: todayKolkata }),
        auditPromise,
        api.reports.getMonthly(todayDate.getFullYear(), todayDate.getMonth() + 1),
        gpsTodayPromise,
        activeSpotPromise,
        api.worksites.list().catch(() => []),
      ]);

      setWeeklyReport(weekly);
      setTodayAttendance(todayAtt);
      setRecentAudits(auditLogs);
      setMonthlyTotals(monthly?.totals || null);
      setStaffTodayRecord(myTodayGps?.todayRecord || null);
      setActiveVerifications(activeSpotChecks || []);

      // Trigger immediate vibration and native notification strictly ONCE per spot verification request
      if (Array.isArray(activeSpotChecks) && activeSpotChecks.length > 0) {
        const latestSpot = activeSpotChecks[0];
        const spotId = latestSpot?.id;
        if (spotId && !alertedSpotChecksRef.current.has(spotId)) {
          alertedSpotChecksRef.current.add(spotId);
          try {
            sessionStorage.setItem(
              'solar_alerted_spot_ids',
              JSON.stringify(Array.from(alertedSpotChecksRef.current))
            );
          } catch {}

          if ((window as any).ReactNativeWebView) {
            (window as any).ReactNativeWebView.postMessage(JSON.stringify({
              type: 'LOCAL_NOTIFICATION',
              title: '🚨 Attendance Spot Verification Requested',
              body: `Verification dispatched by ${latestSpot.requested_by_name || 'Supervisor'}. Please confirm your physical location.`,
            }));
          }
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate([400, 200, 400, 200, 600]); } catch (e) {}
          }

          if (typeof Notification !== 'undefined') {
            if (Notification.permission === 'granted') {
              try {
                new Notification('🚨 Attendance Spot Verification Requested', {
                  body: `Verification dispatched by ${latestSpot.requested_by_name || 'Supervisor'}. Please confirm your physical location.`,
                  icon: '/assets/aistudio/solar_designs_clean_logo_bf464b07.png',
                });
              } catch (e) {}
            } else if (Notification.permission === 'default') {
              try { Notification.requestPermission().catch(() => {}); } catch (e) {}
            }
          }
        }
      }

      if (Array.isArray(worksitesList) && worksitesList.length > 0) {
        const found = user?.assignedWorksiteId ? worksitesList.find((w: any) => w.id === user.assignedWorksiteId) : worksitesList[0];
        setAssignedWorksite(found || worksitesList[0]);
      }

      if (isAdminAny) {
        try {
          const queue = await api.attendance.getQueue();
          setPendingApprovals(queue);
        } catch {}
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard analytics');
    } finally {
      setIsLoading(false);
    }
  };

  const getDeviceLocation = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      const nativeGps = (window as any).__NATIVE_GPS__;
      if (nativeGps?.latitude && nativeGps?.longitude) {
        return resolve({
          coords: {
            latitude: nativeGps.latitude,
            longitude: nativeGps.longitude,
            accuracy: nativeGps.accuracy || 10,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: nativeGps.timestamp || Date.now(),
        } as GeolocationPosition);
      }

      if (!navigator.geolocation) {
        return reject(new Error('Geolocation is not supported by your browser or device.'));
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        () => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos),
            (err) => reject(new Error('Unable to capture GPS location. Please ensure location is enabled.')),
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
          );
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 }
      );
    });
  };

  const handleRefreshGps = async () => {
    setIsLocatingGps(true);
    try {
      if ((window as any).ReactNativeWebView?.postMessage) {
        (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: 'REQUEST_LOCATION' }));
      }
      const pos = await getDeviceLocation();
      setStaffGpsPosition({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
    } catch (e: any) {
      console.warn('GPS refresh error:', e);
    } finally {
      setIsLocatingGps(false);
    }
  };

  useEffect(() => {
    handleRefreshGps();
  }, []);

  useEffect(() => {
    if (activeVerifications.length === 0) return;
    const targetExpiry = new Date(activeVerifications[0].expires_at).getTime();

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = targetExpiry - now;
      if (diff <= 0) {
        setVerifTimeRemaining('Expired');
        clearInterval(interval);
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setVerifTimeRemaining(`${mins}m ${secs < 10 ? '0' : ''}${secs}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeVerifications]);

  useEffect(() => {
    if (activeVerifications.length > 0) {
      const activeId = activeVerifications[0]?.id;
      let dismissed = false;
      try {
        dismissed = sessionStorage.getItem(`solar_dismissed_spot_${activeId}`) === 'true';
      } catch {}
      if (!dismissed) {
        setShowStaffSpotModal(true);
      }
    } else {
      setShowStaffSpotModal(false);
    }
  }, [activeVerifications]);

  const handleStaffCheckIn = async () => {
    setIsSubmittingAttendance(true);
    setStaffAttError(null);
    setStaffAttSuccess(null);
    try {
      const pos = await getDeviceLocation();
      const { latitude, longitude, accuracy } = pos.coords;
      setStaffGpsPosition({ latitude, longitude, accuracy });
      const res = await api.gpsAttendance.checkIn({
        latitude,
        longitude,
        accuracy: Math.round(accuracy),
        deviceTimestamp: new Date(pos.timestamp).toISOString(),
      });
      setStaffAttSuccess(res.message || 'Check-in recorded successfully!');
      const todayRes = await api.gpsAttendance.getToday();
      setStaffTodayRecord(todayRes?.todayRecord || null);
    } catch (err: any) {
      setStaffAttError(err.message || 'Check-in failed');
    } finally {
      setIsSubmittingAttendance(false);
    }
  };

  const handleStaffCheckOut = async () => {
    setIsSubmittingAttendance(true);
    setStaffAttError(null);
    setStaffAttSuccess(null);
    try {
      const pos = await getDeviceLocation();
      const { latitude, longitude, accuracy } = pos.coords;
      setStaffGpsPosition({ latitude, longitude, accuracy });
      const res = await api.gpsAttendance.checkOut({
        latitude,
        longitude,
        accuracy: Math.round(accuracy),
        deviceTimestamp: new Date(pos.timestamp).toISOString(),
      });
      setStaffAttSuccess(res.message || 'Check-out recorded successfully!');
      const todayRes = await api.gpsAttendance.getToday();
      setStaffTodayRecord(todayRes?.todayRecord || null);
    } catch (err: any) {
      setStaffAttError(err.message || 'Check-out failed');
    } finally {
      setIsSubmittingAttendance(false);
    }
  };

  const handleStaffRespondVerification = async (verifId: string) => {
    setIsSubmittingAttendance(true);
    setStaffAttError(null);
    setStaffAttSuccess(null);
    try {
      const pos = await getDeviceLocation();
      const { latitude, longitude, accuracy } = pos.coords;
      setStaffGpsPosition({ latitude, longitude, accuracy });
      const res = await api.verifications.respond(verifId, {
        latitude,
        longitude,
        accuracy: Math.round(accuracy),
        deviceTimestamp: new Date(pos.timestamp).toISOString(),
      });
      setStaffAttSuccess(res.message || 'Spot verification confirmed successfully!');
      const active = await api.verifications.getActive();
      setActiveVerifications(active || []);
    } catch (err: any) {
      setStaffAttError(err.message || 'Spot verification response failed');
    } finally {
      setIsSubmittingAttendance(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [currentWeekStart]);

  // Day by day breakdown for the 7 days of the selected Saturday–Friday week
  const dayBreakdown = weekBounds.days.map((d) => {
    const dayEntries = weeklyReport?.teamSummaries?.flatMap((t: any) =>
      t.entries?.filter((e: any) => e.date === d) || []
    ) || [];

    const dayLabourAmt = dayEntries.reduce((sum: number, e: any) => {
      const linesAmt = e.lines?.reduce((lSum: number, l: any) => lSum + (l.final_amount || 0), 0) || 0;
      return sum + linesAmt + (e.overtime_amount || 0);
    }, 0);

    const workerCount = dayEntries.reduce((sum: number, e: any) => {
      return sum + (e.lines?.reduce((cnt: number, l: any) => cnt + (l.count || 0), 0) || 0);
    }, 0);

    return {
      date: d,
      dayName: getDayName(d),
      entriesCount: dayEntries.length,
      workerCount,
      totalAmount: round2(dayLabourAmt),
      isToday: d === todayKolkata,
    };
  });

  const grandTotals = weeklyReport?.grandTotals || {
    labour: 0,
    additionalCharges: 0,
    gross: 0,
    finalPayable: 0,
    paid: 0,
    outstanding: 0,
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner & Header matching Image 1 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E8DFD0] pb-4">
        <div>
          <div className="flex items-center space-x-2.5 flex-wrap gap-1">
            <h1 className="text-2xl sm:text-3xl font-black text-[#0B3522] tracking-tight">
              {isMasterAdmin ? 'Company Executive Dashboard' : isSecondaryAdmin ? 'Manager Operations Dashboard' : 'Company Executive Dashboard'}
            </h1>
            <span className="text-xs uppercase font-bold px-2.5 py-0.5 rounded-full bg-[#D5E3DB] text-[#1E4D38]">
              {user?.role === 'master_admin' ? 'Master Admin' : user?.role === 'secondary_admin' ? 'Manager' : 'Staff'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#506657] mt-1 font-medium">
            Saturday–Friday reporting cycle analytics • Today: <span className="text-[#0B3522] font-bold font-mono">{formatDateDisplay(todayKolkata)}</span>
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <WeekNavigator currentWeekStart={currentWeekStart} onWeekChange={setCurrentWeekStart} />
          <button
            onClick={loadDashboardData}
            disabled={isLoading}
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#FAF7F0] border border-[#E8DFD0] flex items-center justify-center text-[#0B3522] shadow-xs hover:bg-white transition-colors cursor-pointer shrink-0"
            title="Refresh analytics"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Action Shortcuts Bar */}
      <div className="bg-[#FAF7F0] p-3.5 sm:p-4 rounded-3xl border border-[#E8DFD0] shadow-xs">
        {/* Mobile View: Exactly 4 shortcuts in a 2x2 grid to fit the box perfectly */}
        <div className="grid grid-cols-2 gap-2.5 sm:hidden text-xs">
          <button
            onClick={() => onNavigate && onNavigate('attendance', { date: todayKolkata })}
            className="flex items-center justify-center space-x-1.5 px-3 py-3 bg-[#2D6043] hover:bg-[#205035] text-white rounded-2xl font-semibold shadow-xs transition-transform active:scale-95 cursor-pointer text-center"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Attendance</span>
          </button>

          {isAdminAny ? (
            <button
              onClick={() => onNavigate && onNavigate('approvals')}
              className="flex items-center justify-center space-x-1.5 px-3 py-3 bg-[#DCEAE2] hover:bg-[#CFE2D7] text-[#0B3522] rounded-2xl font-semibold shadow-xs transition-transform active:scale-95 cursor-pointer relative text-center"
            >
              <Clock className="w-4 h-4 text-[#0B3522]" />
              <span>Review Queue</span>
              {pendingApprovals.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-[#0B3522] text-white font-bold rounded-full text-[10px]">
                  {pendingApprovals.length}
                </span>
              )}
            </button>
          ) : (
            <button
              onClick={() => onNavigate && onNavigate('my-reports')}
              className="flex items-center justify-center space-x-1.5 px-3 py-3 bg-[#DCEAE2] hover:bg-[#CFE2D7] text-[#0B3522] rounded-2xl font-semibold shadow-xs transition-transform active:scale-95 cursor-pointer text-center"
            >
              <Users className="w-4 h-4 text-[#0B3522]" />
              <span>My Workspace</span>
            </button>
          )}

          <button
            onClick={() => onNavigate && onNavigate('weekly-reports', { weekStart: currentWeekStart })}
            className="flex items-center justify-center space-x-1.5 px-3 py-3 bg-white/90 hover:bg-white text-[#0B3522] border border-[#E2D8C6] rounded-2xl font-semibold shadow-xs transition-transform active:scale-95 cursor-pointer text-center"
          >
            <span>Weekly Report</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => onNavigate && onNavigate('payments', { weekStart: currentWeekStart })}
            className="flex items-center justify-center space-x-1.5 px-3 py-3 bg-white/90 hover:bg-white text-[#0B3522] border border-[#E2D8C6] rounded-2xl font-semibold shadow-xs transition-transform active:scale-95 cursor-pointer text-center"
          >
            <span>Payment Status</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Tablet & Desktop View: 6 shortcuts filling the row completely */}
        <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
          <button
            onClick={() => onNavigate && onNavigate('attendance', { date: todayKolkata })}
            className="flex items-center justify-center space-x-1.5 px-3.5 py-2.5 bg-[#2D6043] hover:bg-[#205035] text-white rounded-2xl font-semibold shadow-xs transition-transform active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Attendance</span>
          </button>

          {isAdminAny ? (
            <button
              onClick={() => onNavigate && onNavigate('approvals')}
              className="flex items-center justify-center space-x-1.5 px-3.5 py-2.5 bg-[#DCEAE2] hover:bg-[#CFE2D7] text-[#0B3522] rounded-2xl font-semibold shadow-xs transition-transform active:scale-95 cursor-pointer relative"
            >
              <Clock className="w-4 h-4 text-[#0B3522]" />
              <span>Review Queue</span>
              {pendingApprovals.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-[#0B3522] text-white font-bold rounded-full text-[10px]">
                  {pendingApprovals.length}
                </span>
              )}
            </button>
          ) : (
            <button
              onClick={() => onNavigate && onNavigate('my-reports')}
              className="flex items-center justify-center space-x-1.5 px-3.5 py-2.5 bg-[#DCEAE2] hover:bg-[#CFE2D7] text-[#0B3522] rounded-2xl font-semibold shadow-xs transition-transform active:scale-95 cursor-pointer"
            >
              <Users className="w-4 h-4 text-[#0B3522]" />
              <span>My Workspace</span>
            </button>
          )}

          <button
            onClick={() => onNavigate && onNavigate('weekly-reports', { weekStart: currentWeekStart })}
            className="flex items-center justify-center space-x-1.5 px-3.5 py-2.5 bg-white/90 hover:bg-white text-[#0B3522] border border-[#E2D8C6] rounded-2xl font-semibold shadow-xs transition-transform active:scale-95 cursor-pointer"
          >
            <span>Weekly Report</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => onNavigate && onNavigate('payments', { weekStart: currentWeekStart })}
            className="flex items-center justify-center space-x-1.5 px-3.5 py-2.5 bg-white/90 hover:bg-white text-[#0B3522] border border-[#E2D8C6] rounded-2xl font-semibold shadow-xs transition-transform active:scale-95 cursor-pointer"
          >
            <span>Payment Status</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => onNavigate && onNavigate('attachments')}
            className="flex items-center justify-center space-x-1.5 px-3.5 py-2.5 bg-white/90 hover:bg-white text-[#0B3522] border border-[#E2D8C6] rounded-2xl font-semibold shadow-xs transition-transform active:scale-95 cursor-pointer"
          >
            <Paperclip className="w-4 h-4 text-[#0B3522]" />
            <span>Attachments</span>
          </button>

          <button
            onClick={() => onNavigate && onNavigate('monthly-reports')}
            className="flex items-center justify-center space-x-1.5 px-3.5 py-2.5 bg-white/90 hover:bg-white text-[#0B3522] border border-[#E2D8C6] rounded-2xl font-semibold shadow-xs transition-transform active:scale-95 cursor-pointer"
          >
            <BarChart3 className="w-4 h-4 text-[#0B3522]" />
            <span>Monthly Reports</span>
          </button>
        </div>
      </div>

      {/* 30-Minute Random Spot Verification Alert Banner (Staff Only - Dispatched to Current User) */}
      {user?.role === 'staff' && activeVerifications.length > 0 && (
        <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-white rounded-2xl p-4 sm:p-5 shadow-lg border-2 border-amber-400 animate-pulse-subtle">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start space-x-3">
              <ShieldAlert className="w-6 h-6 text-white shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider">Attendance Spot Verification Requested</h3>
                  <span className="bg-white text-amber-900 font-mono text-xs font-bold px-2.5 py-0.5 rounded-full shadow-xs">
                    ⏳ {verifTimeRemaining || '30m 00s'}
                  </span>
                </div>
                <p className="text-xs text-amber-100 mt-1">
                  Spot presence verification dispatched by <strong>{activeVerifications[0].requested_by_name}</strong>. Please confirm your physical location.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isSubmittingAttendance}
              onClick={() => handleStaffRespondVerification(activeVerifications[0].id)}
              className="w-full sm:w-auto px-5 py-2.5 bg-white text-amber-900 hover:bg-amber-50 font-bold rounded-xl text-xs shadow-md flex items-center justify-center space-x-2 cursor-pointer transition-transform active:scale-95 disabled:opacity-50"
            >
              <Navigation className="w-4 h-4 text-amber-700" />
              <span>{isSubmittingAttendance ? 'Capturing Location...' : 'Verify My Attendance Now'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Staff Daily Attendance & Worksite Geofence Widget (Staff Only - Excluded for Master Admin & Secondary Admins) */}
      {user?.role === 'staff' && (() => {
        const isCheckedIn = Boolean(staffTodayRecord?.check_in_time && !staffTodayRecord?.check_out_time);
        const isCheckedOut = Boolean(staffTodayRecord?.check_out_time);
        const siteLat = assignedWorksite?.latitude || 12.9715987;
        const siteLng = assignedWorksite?.longitude || 77.5945627;
        const allowedRadius = (user as any)?.allowedRadiusMeters || (user as any)?.allowed_radius_meters || assignedWorksite?.staff_radius_meters || assignedWorksite?.allowed_radius_meters || assignedWorksite?.radius_meters || 150;
        const distanceM = staffGpsPosition
          ? computeDistanceMeters(staffGpsPosition.latitude, staffGpsPosition.longitude, siteLat, siteLng)
          : null;
        const isInside = distanceM !== null ? distanceM <= allowedRadius : false;

        return (
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#0E6037] flex items-center justify-center font-bold">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-bold text-slate-900">My Daily Attendance & Geofence</h3>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-mono">
                      {todayKolkata}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Assigned Site: <strong className="text-slate-700">{assignedWorksite?.name || user?.assignedLocation || 'General Site'}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleRefreshGps}
                  disabled={isLocatingGps}
                  className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg flex items-center space-x-1 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                  title="Refresh GPS Coordinates"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLocatingGps ? 'animate-spin text-[#0E6037]' : ''}`} />
                  <span>{isLocatingGps ? 'Locating...' : 'Refresh GPS'}</span>
                </button>
              </div>
            </div>

            {/* Attendance Status & Action Area */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
              {/* Status Box */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Today's Status</span>
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${
                    isCheckedOut
                      ? 'bg-blue-500'
                      : isCheckedIn
                      ? 'bg-emerald-500 animate-pulse'
                      : 'bg-slate-400'
                  }`} />
                  <span className="text-xs font-bold text-slate-900">
                    {isCheckedOut
                      ? 'Attendance Completed'
                      : isCheckedIn
                      ? 'Checked In (Active)'
                      : 'Not Checked In'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 pt-0.5 space-y-0.5 font-mono">
                  {staffTodayRecord?.check_in_time && (
                    <p>In: {new Date(staffTodayRecord.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  )}
                  {staffTodayRecord?.check_out_time && (
                    <p>Out: {new Date(staffTodayRecord.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  )}
                </div>
              </div>

              {/* Live Location Box */}
              <div className={`p-3 rounded-xl border space-y-1 ${
                staffGpsPosition
                  ? isInside
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                    : 'bg-amber-50/70 border-amber-200 text-amber-950'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <span className="text-[10px] uppercase font-bold tracking-wider opacity-75">GPS Verification</span>
                <p className="text-xs font-semibold">
                  {staffGpsPosition
                    ? isInside
                      ? 'Within Worksite Geofence ✅'
                      : 'Outside Allowed Radius ⚠️'
                    : 'Awaiting Location Fix'}
                </p>
                {staffGpsPosition ? (
                  <p className="text-[11px] font-mono opacity-85">
                    {distanceM !== null ? `${distanceM}m to center` : ''}
                  </p>
                ) : (
                  <p className="text-[11px] opacity-75">Turn on GPS to verify position</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                {!isCheckedIn && !isCheckedOut && (
                  <button
                    type="button"
                    disabled={isSubmittingAttendance}
                    onClick={handleStaffCheckIn}
                    className="flex-1 py-2.5 px-4 bg-[#0E6037] hover:bg-[#0E6037]/90 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50 transition-transform active:scale-95"
                  >
                    <Navigation className="w-4 h-4" />
                    <span>{isSubmittingAttendance ? 'Recording...' : 'Check In Attendance'}</span>
                  </button>
                )}

                {isCheckedIn && (
                  <button
                    type="button"
                    disabled={isSubmittingAttendance}
                    onClick={handleStaffCheckOut}
                    className="flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50 transition-transform active:scale-95"
                  >
                    <Clock className="w-4 h-4" />
                    <span>{isSubmittingAttendance ? 'Recording...' : 'Check Out Attendance'}</span>
                  </button>
                )}

                {isCheckedOut && (
                  <div className="flex-1 py-2.5 px-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold text-center flex items-center justify-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Day Completed</span>
                  </div>
                )}
              </div>
            </div>

            {/* Success & Error Feedback */}
            {staffAttSuccess && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{staffAttSuccess}</span>
              </div>
            )}
            {staffAttError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{staffAttError}</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* KPI Cards: Current Week Financial Snapshot matching Image 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#FAF7F0] p-4 sm:p-5 rounded-3xl border border-[#E8DFD0] shadow-xs relative overflow-hidden card-wave-bg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#4B6152]">Reporting Week</span>
            <CalendarRange className="w-5 h-5 text-[#0B3522]" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-[#0B3522] mt-2.5 tracking-tight">
            {weekBounds.displayRange}
          </div>
        </div>

        <div className="bg-[#FAF7F0] p-4 sm:p-5 rounded-3xl border border-[#E8DFD0] shadow-xs relative overflow-hidden card-wave-bg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#4B6152]">Approved Payable</span>
            <CheckCircle2 className="w-5 h-5 text-[#0B3522]" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-[#0B3522] mt-2.5 tracking-tight">
            {formatINR(grandTotals.finalPayable)}
          </div>
        </div>

        <div className="bg-[#FAF7F0] p-4 sm:p-5 rounded-3xl border border-[#E8DFD0] shadow-xs relative overflow-hidden card-wave-bg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#4B6152]">Week Settled (Paid)</span>
            <ReceiptIndianRupee className="w-5 h-5 text-[#0B3522]" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-[#0B3522] mt-2.5 tracking-tight">
            {formatINR(grandTotals.paid)}
          </div>
        </div>

        <div className="bg-[#FAF7F0] p-4 sm:p-5 rounded-3xl border border-[#E8DFD0] shadow-xs relative overflow-hidden card-wave-bg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#4B6152]">Current Week Outstanding</span>
            <Clock className="w-5 h-5 text-amber-700" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-amber-800 mt-2.5 tracking-tight">
            {formatINR(grandTotals.outstanding)}
          </div>
        </div>
      </div>

      {/* Master Admin Analytics Component: Split Charts for Attendance & Payments with Weekly/Monthly toggle */}
      {isMasterAdmin && (
        <MasterAdminAnalytics
          currentWeekStart={currentWeekStart}
          weeklyReport={weeklyReport}
          dayBreakdown={dayBreakdown}
          onNavigate={onNavigate}
        />
      )}

      {/* Day by Day Payment & Worker Summary for the Week */}
      <div className="bg-[#FAF7F0] rounded-3xl border border-[#E8DFD0] shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-black text-sm text-[#0B3522]">Day-by-Day Attendance &amp; Amount Breakdown</h2>
          </div>
          <button
            onClick={() => onNavigate && onNavigate('weekly-reports', { weekStart: currentWeekStart })}
            className="text-xs text-[#0B3522] hover:text-[#184F34] font-bold flex items-center space-x-1 cursor-pointer"
          >
            <span>Full Weekly Report</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-7 gap-2.5">
          {dayBreakdown.map((day) => (
            <div
              key={day.date}
              onClick={() => onNavigate && onNavigate('attendance', { date: day.date })}
              className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                day.isToday
                  ? 'bg-[#0B3522] text-white border-[#0B3522] shadow-sm'
                  : 'bg-white/80 border-[#E8DFD0] hover:bg-white'
              }`}
            >
              <div className={`text-[11px] font-bold uppercase ${day.isToday ? 'text-emerald-200' : 'text-[#526659]'}`}>
                {day.dayName.substring(0, 3)}
              </div>
              <div className={`font-mono text-xs font-bold mt-0.5 ${day.isToday ? 'text-white' : 'text-[#0B3522]'}`}>
                {formatDateDisplay(day.date).substring(0, 5)}
              </div>
              <div className={`font-mono text-xs font-black mt-2 ${day.isToday ? 'text-white' : 'text-[#0B3522]'}`}>
                {formatINR(day.totalAmount)}
              </div>
              <div className={`text-[10px] font-medium mt-0.5 ${day.isToday ? 'text-emerald-200' : 'text-[#526659]'}`}>
                {day.workerCount} Workers
              </div>
              {day.isToday && (
                <div className="mt-1 text-[9px] font-bold text-[#0B3522] bg-[#D5E3DB] px-1.5 py-0.2 rounded-md">
                  Today
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Today's Attendance Snapshot & Admin Audit Feed */}
      <div className={`grid grid-cols-1 ${isAdminAny ? 'lg:grid-cols-2' : ''} gap-6`}>
        {/* Today's Attendance Snapshot */}
        <div className="bg-[#FAF7F0] rounded-3xl border border-[#E8DFD0] shadow-xs p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-[#E8DFD0] pb-2.5">
            <div className="flex items-center space-x-2">
              <CalendarCheck2 className="w-4 h-4 text-[#0B3522]" />
              <h2 className="font-bold text-sm text-[#0B3522]">Today&apos;s Attendance Submissions</h2>
            </div>
            <span className="text-xs text-[#526659] font-mono">{formatDateDisplay(todayKolkata)}</span>
          </div>

          {todayAttendance.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#526659]">
              No attendance entries submitted yet for today. Click &quot;Add Attendance&quot; to begin.
            </div>
          ) : (
            <div className="space-y-2">
              {todayAttendance.slice(0, 5).map((entry) => (
                <div
                  key={entry.id}
                  className="p-3 rounded-2xl border border-[#E8DFD0] bg-white/70 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-[#0B3522]">{entry.team_name}</div>
                    <div className="text-[11px] text-[#526659] mt-0.5">
                      Staff: {entry.staff_name} • Shift: {entry.shift_batch}
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        entry.status === 'approved'
                          ? 'bg-[#D5E3DB] text-[#1E4D38]'
                          : entry.status === 'change_pending_approval'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-50 text-emerald-800'
                      }`}
                    >
                      {entry.status === 'approved' ? 'Approved' : 'Pending Review'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Audit History & Admin Alterations — STRICTLY FOR ADMINS ONLY */}
        {isAdminAny && (
          <div className="bg-[#FAF7F0] rounded-3xl border border-[#E8DFD0] shadow-xs p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-[#E8DFD0] pb-2.5">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-[#0B3522]" />
                <h2 className="font-bold text-sm text-[#0B3522]">Recent Audit &amp; Activity Log</h2>
              </div>
              <button
                onClick={() => onNavigate && onNavigate('audit')}
                className="text-xs text-[#0B3522] hover:text-[#184F34] font-bold flex items-center space-x-1 cursor-pointer"
              >
                <span>Full Audit</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentAudits.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#526659]">No recent activity entries recorded.</div>
            ) : (
              <div className="space-y-2">
                {recentAudits.map((log) => (
                  <div key={log.id} className="p-2.5 rounded-2xl border border-[#E8DFD0] bg-white/70 text-xs space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#0B3522]">{log.action.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] text-[#526659] font-mono">{formatDateDisplay(log.created_at)}</span>
                    </div>
                    <div className="text-[11px] text-[#526659]">
                      By <span className="font-semibold text-[#0B3522]">{log.actor_name}</span> ({log.actor_role})
                      {log.reason && <span className="italic ml-1">— &quot;{log.reason}&quot;</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 🚨 High-Priority Staff Spot Verification Modal Dialog */}
      {showStaffSpotModal && activeVerifications.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border-2 border-amber-400 text-center relative overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600" />

            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/30">
              <ShieldAlert className="w-9 h-9 animate-pulse" />
            </div>

            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 font-mono text-xs font-bold mb-2">
              <Clock className="w-3.5 h-3.5 text-amber-700" />
              <span>Expires in: {verifTimeRemaining || '30m 00s'}</span>
            </div>

            <h3 className="text-base font-black text-slate-900 tracking-tight">
              Attendance Verification Requested
            </h3>

            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Dispatched by <strong className="text-slate-900">{activeVerifications[0].requested_by_name || 'Admin'}</strong>. Please confirm your physical location within 30 minutes.
            </p>

            <div className="mt-5 space-y-2">
              <button
                type="button"
                disabled={isSubmittingAttendance}
                onClick={async () => {
                  await handleStaffCheckIn();
                  setShowStaffSpotModal(false);
                }}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-[#0E6037] to-[#127a46] hover:from-[#0c522f] hover:to-[#0E6037] active:scale-[0.98] text-white font-bold rounded-2xl text-xs shadow-lg shadow-emerald-900/20 flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <Navigation className={`w-4 h-4 ${isSubmittingAttendance ? 'animate-spin' : ''}`} />
                <span>{isSubmittingAttendance ? 'Capturing Location...' : '📍 Confirm Physical Presence'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowStaffSpotModal(false);
                  if (activeVerifications[0]?.id) {
                    try {
                      sessionStorage.setItem(`solar_dismissed_spot_${activeVerifications[0].id}`, 'true');
                    } catch {}
                  }
                }}
                className="w-full py-2 px-4 text-slate-500 hover:text-slate-800 text-xs font-semibold rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Dismiss & View Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
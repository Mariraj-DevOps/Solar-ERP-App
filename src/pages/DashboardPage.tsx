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
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#696969]/20 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-bold text-[#014025] tracking-tight">
              {isMasterAdmin ? 'Company Executive Dashboard' : isSecondaryAdmin ? 'Manager Operations Dashboard' : 'Staff Operations Dashboard'}
            </h1>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#456B5A]/20 text-[#014025]">
              {user?.role === 'master_admin' ? 'Master Admin' : user?.role === 'secondary_admin' ? 'Manager' : 'Staff'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#696969] mt-0.5">
            Saturday–Friday reporting cycle analytics • Today: <span className="text-[#014025] font-semibold font-mono">{formatDateDisplay(todayKolkata)}</span>
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <WeekNavigator currentWeekStart={currentWeekStart} onWeekChange={setCurrentWeekStart} />
          <button
            onClick={loadDashboardData}
            disabled={isLoading}
            className="p-2 rounded-lg border border-[#696969]/20 text-[#014025] hover:bg-[#696969]/10"
            title="Refresh analytics"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Action Shortcuts Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-[#456B5A]/20 shadow-xs flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-[#3B5E4F] mr-1 hidden sm:inline">Shortcuts:</span>

        <button
          onClick={() => onNavigate && onNavigate('attendance', { date: todayKolkata })}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#014025] hover:bg-[#014025]/90 text-white rounded-lg font-semibold shadow-xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Attendance</span>
        </button>

        {isAdminAny && (
          <button
            onClick={() => onNavigate && onNavigate('approvals')}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#456B5A] hover:bg-[#3B5E4F] text-white rounded-lg font-semibold shadow-xs transition-colors relative"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Review Queue</span>
            {pendingApprovals.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-amber-400 text-[#014025] font-bold rounded-full text-[10px]">
                {pendingApprovals.length}
              </span>
            )}
          </button>
        )}

        <button
          onClick={() => onNavigate && onNavigate('weekly-reports', { weekStart: currentWeekStart })}
          className="flex items-center space-x-1.5 px-3 py-1.5 border border-[#456B5A]/30 text-[#3B5E4F] hover:bg-[#456B5A]/10 rounded-lg font-medium transition-colors"
        >
          <span>Weekly Report</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onNavigate && onNavigate('payments', { weekStart: currentWeekStart })}
          className="flex items-center space-x-1.5 px-3 py-1.5 border border-[#456B5A]/30 text-[#3B5E4F] hover:bg-[#456B5A]/10 rounded-lg font-medium transition-colors"
        >
          <span>Payment Status</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onNavigate && onNavigate('attachments')}
          className="flex items-center space-x-1.5 px-3 py-1.5 border border-[#456B5A]/30 text-[#3B5E4F] hover:bg-[#456B5A]/10 rounded-lg font-medium transition-colors"
        >
          <Paperclip className="w-3.5 h-3.5 text-[#456B5A]" />
          <span>Attachments</span>
        </button>

        {isMasterAdmin && (
          <button
            onClick={() => onNavigate && onNavigate('petty-cash')}
            className="flex items-center space-x-1.5 px-3 py-1.5 border border-[#456B5A]/30 text-[#3B5E4F] hover:bg-[#456B5A]/10 rounded-lg font-medium transition-colors"
          >
            <span>Petty Cash</span>
          </button>
        )}
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
        const allowedRadius = assignedWorksite?.allowed_radius_meters || assignedWorksite?.radius_meters || 150;
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
                    Assigned Site: <strong className="text-slate-700">{assignedWorksite?.name || user?.assignedLocation || 'General Site'}</strong> ({allowedRadius}m boundary)
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
                    {distanceM !== null ? `${distanceM}m to center` : ''} (±{Math.round(staffGpsPosition.accuracy || 10)}m accuracy)
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

      {/* KPI Cards: Current Week Financial Snapshot */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[#696969]/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#696969] font-medium">Reporting Week</span>
            <CalendarRange className="w-4 h-4 text-[#456B5A]" />
          </div>
          <div className="text-sm font-bold font-mono text-[#014025] mt-2">{weekBounds.displayRange}</div>
          <div className="text-[11px] text-[#696969] mt-1">Saturday through Friday cycle</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#696969]/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#696969] font-medium">Approved Payable</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#014025] mt-1">{formatINR(grandTotals.finalPayable)}</div>
          <div className="text-[11px] text-[#696969] mt-1">
            Labour: {formatINR(grandTotals.labour)} | Charges: {formatINR(grandTotals.additionalCharges)}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#696969]/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#696969] font-medium">Week Settled (Paid)</span>
            <ReceiptIndianRupee className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">{formatINR(grandTotals.paid)}</div>
          <div className="text-[11px] text-emerald-600 mt-1">Disbursed with voucher refs</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#696969]/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#696969] font-medium">Current Week Outstanding</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-600 mt-1">{formatINR(grandTotals.outstanding)}</div>
          <div className="text-[11px] text-amber-700 mt-1">Pending payment disbursement</div>
        </div>
      </div>

      {/* Day by Day Payment & Worker Summary for the Week */}
      <div className="bg-white rounded-xl border border-[#696969]/20 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-sm text-[#014025]">Day-by-Day Attendance &amp; Amount Breakdown</h2>
            <p className="text-xs text-[#696969]">Saturday to Friday distribution for reporting week {weekBounds.displayRange}</p>
          </div>
          <button
            onClick={() => onNavigate && onNavigate('weekly-reports', { weekStart: currentWeekStart })}
            className="text-xs text-[#456B5A] hover:text-[#014025] font-semibold flex items-center space-x-1"
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
              className={`p-3 rounded-lg border text-center transition-all cursor-pointer ${
                day.isToday
                  ? 'bg-[#456B5A]/10 border-[#456B5A] ring-1 ring-[#456B5A]'
                  : 'bg-[#696969]/5 border-[#696969]/15 hover:bg-[#696969]/10'
              }`}
            >
              <div className="text-[11px] font-semibold uppercase text-[#696969]">{day.dayName.substring(0, 3)}</div>
              <div className="font-mono text-xs font-bold text-[#014025] mt-0.5">{formatDateDisplay(day.date).substring(0, 5)}</div>
              <div className="font-mono text-xs font-bold text-[#014025] mt-2">{formatINR(day.totalAmount)}</div>
              <div className="text-[10px] text-[#696969] mt-0.5">{day.workerCount} Workers</div>
              {day.isToday && (
                <div className="mt-1 text-[9px] font-bold text-[#014025] bg-[#456B5A]/20 px-1 py-0.2 rounded">
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
        <div className="bg-white rounded-xl border border-[#696969]/20 shadow-xs p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-[#696969]/15 pb-2.5">
            <div className="flex items-center space-x-2">
              <CalendarCheck2 className="w-4 h-4 text-[#0E6037]" />
              <h2 className="font-bold text-sm text-[#0E6037]">Today&apos;s Attendance Submissions</h2>
            </div>
            <span className="text-xs text-[#696969] font-mono">{formatDateDisplay(todayKolkata)}</span>
          </div>

          {todayAttendance.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#696969]">
              No attendance entries submitted yet for today. Click &quot;Add Attendance&quot; to begin.
            </div>
          ) : (
            <div className="space-y-2">
              {todayAttendance.slice(0, 5).map((entry) => (
                <div
                  key={entry.id}
                  className="p-2.5 rounded-lg border border-[#696969]/15 bg-[#696969]/5 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-semibold text-[#014025]">{entry.team_name}</div>
                    <div className="text-[11px] text-[#696969]">
                      Staff: {entry.staff_name} • Shift: {entry.shift_batch}
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        entry.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : entry.status === 'change_pending_approval'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
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
          <div className="bg-white rounded-xl border border-[#696969]/20 shadow-xs p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-[#696969]/15 pb-2.5">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-[#0E6037]" />
                <h2 className="font-bold text-sm text-[#0E6037]">Recent Audit &amp; Activity Log</h2>
              </div>
              <button
                onClick={() => onNavigate && onNavigate('audit')}
                className="text-xs text-[#0E6037] hover:text-[#0B4D2C] font-semibold flex items-center space-x-1 cursor-pointer"
              >
                <span>Full Audit</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentAudits.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#696969]">No recent activity entries recorded.</div>
            ) : (
              <div className="space-y-2">
                {recentAudits.map((log) => (
                  <div key={log.id} className="p-2 rounded-lg border border-[#696969]/15 text-xs space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">{log.action.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{formatDateDisplay(log.created_at)}</span>
                    </div>
                    <div className="text-[11px] text-[#696969]">
                      By <span className="font-medium text-[#0E6037]">{log.actor_name}</span> ({log.actor_role})
                      {log.reason && <span className="italic ml-1">— &quot;{log.reason}&quot;</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Check,
  RefreshCw,
  Info,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../lib/api';
import { formatDateDisplay } from '../lib/dateUtils';
import { useAuth } from '../context/AuthContext';

export function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const notifiedIdsRef = useRef<Set<string>>(new Set());

  const loadNotifications = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.notifications.list();
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);

      if (res.unreadCount > 0 && (window as any).ReactNativeWebView) {
        const unreadList = (res.notifications || []).filter((n: any) => !n.is_read);
        if (unreadList.length > 0) {
          const first = unreadList[0];
          if (first?.id && !notifiedIdsRef.current.has(first.id)) {
            notifiedIdsRef.current.add(first.id);
            if ((window as any).ReactNativeWebView) {
              (window as any).ReactNativeWebView.postMessage(JSON.stringify({
                type: 'LOCAL_NOTIFICATION',
                title: first.title || 'Solar ERP Update',
                body: first.message,
              }));
            }
            if (typeof Notification !== 'undefined') {
              if (Notification.permission === 'granted') {
                try {
                  new Notification(first.title || 'Solar ERP Update', {
                    body: first.message,
                    icon: '/assets/aistudio/solar_designs_clean_logo_bf464b07.png',
                  });
                } catch (e) {}
              } else if (Notification.permission === 'default') {
                try { Notification.requestPermission().catch(() => {}); } catch (e) {}
              }
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load notifications.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await api.notifications.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.warn('Failed to mark read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.notifications.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch (err) {
      console.warn('Failed to mark all read:', err);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'approval':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case 'rejection':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'modification':
        return <ShieldAlert className="w-5 h-5 text-amber-600" />;
      default:
        return <Info className="w-5 h-5 text-[#456B5A]" />;
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E8DFD0] pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-[#DCEAE2] text-[#0B3522] flex items-center justify-center relative shadow-xs">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#2D6043] text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-xs">
                {unreadCount}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#0B3522] tracking-tight">
              In-App Notifications
            </h1>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/90 hover:bg-white text-[#0B3522] border border-[#E2D8C6] text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Mark All as Read</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Listing */}
      {isLoading ? (
        <div className="bg-[#FAF7F0] p-12 text-center rounded-3xl border border-[#E8DFD0] text-xs text-[#526659]">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#2D6043] mb-2" />
          Loading notifications...
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-[#FAF7F0] p-12 text-center rounded-3xl border border-[#E8DFD0] space-y-2">
          <Bell className="w-10 h-10 text-[#7D9384]/50 mx-auto" />
          <div className="font-bold text-sm text-[#0B3522]">No Notifications</div>
          <div className="text-xs text-[#526659]">You do not have any notification records yet.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => {
                if (!n.is_read) handleMarkRead(n.id);
              }}
              className={`p-4 rounded-2xl border transition-all flex items-start justify-between gap-3 cursor-pointer ${
                n.is_read
                  ? 'bg-[#FAF7F0]/85 border-[#E8DFD0] opacity-80 hover:opacity-100'
                  : 'bg-[#FAF7F0] border-[#2D6043]/35 shadow-xs ring-1 ring-[#2D6043]/20'
              }`}
            >
              <div className="flex items-start space-x-3 min-w-0">
                <div className="mt-0.5 shrink-0">{getNotificationIcon(n.type)}</div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-xs sm:text-sm text-[#0B3522]">{n.title}</span>
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-[#2D6043] shrink-0" title="Unread" />
                    )}
                  </div>
                  <p className="text-xs text-[#526659] mt-1 leading-snug">{n.message}</p>
                  <div className="text-[10px] text-[#7D9384] mt-1.5 flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatDateDisplay(n.created_at)}</span>
                  </div>
                </div>
              </div>

              {!n.is_read && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkRead(n.id);
                  }}
                  className="p-1.5 text-[#2D6043] hover:bg-[#DCEAE2]/60 rounded-xl shrink-0 text-xs font-semibold cursor-pointer"
                  title="Mark as Read"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

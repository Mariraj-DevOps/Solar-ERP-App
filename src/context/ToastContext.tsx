import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (params: { message: string; type?: ToastType; title?: string; duration?: number }) => void;
  showSuccess: (message: string, title?: string) => void;
  showError: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ message, type, title, duration = 4000 }: { message: string; type?: ToastType; title?: string; duration?: number }) => {
      // Auto-detect type if not explicitly provided
      let resolvedType: ToastType = type || 'info';
      if (!type) {
        const lower = message.toLowerCase();
        if (
          lower.includes('success') ||
          lower.includes('dispatched') ||
          lower.includes('approved') ||
          lower.includes('saved') ||
          lower.includes('created') ||
          lower.includes('completed')
        ) {
          resolvedType = 'success';
        } else if (
          lower.includes('fail') ||
          lower.includes('error') ||
          lower.includes('rejected') ||
          lower.includes('cannot') ||
          lower.includes('denied') ||
          lower.includes('forbidden') ||
          lower.includes('required')
        ) {
          resolvedType = 'error';
        } else if (lower.includes('warn') || lower.includes('pending') || lower.includes('notice')) {
          resolvedType = 'warning';
        }
      }

      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newToast: ToastItem = {
        id,
        type: resolvedType,
        title: title || (resolvedType === 'success' ? 'Success' : resolvedType === 'error' ? 'Notice' : 'Information'),
        message,
        duration,
      };

      setToasts((prev) => [...prev.slice(-3), newToast]); // Keep up to 4 toasts max

      if (duration > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, duration);
      }
    },
    [dismissToast]
  );

  const showSuccess = useCallback((message: string, title?: string) => showToast({ message, type: 'success', title }), [showToast]);
  const showError = useCallback((message: string, title?: string) => showToast({ message, type: 'error', title }), [showToast]);
  const showInfo = useCallback((message: string, title?: string) => showToast({ message, type: 'info', title }), [showToast]);

  // Safely hook window.alert so all legacy alerts render as modern in-app toasts
  useEffect(() => {
    const originalAlert = window.alert;
    (window as any)._originalAlert = originalAlert;

    window.alert = (message: any) => {
      const text = typeof message === 'string' ? message : JSON.stringify(message);
      showToast({ message: text });
    };

    return () => {
      window.alert = originalAlert;
    };
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showInfo, dismissToast }}>
      {children}

      {/* Floating Modern Toast Stack Container */}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] w-[92%] sm:w-auto sm:min-w-[360px] sm:max-w-md pointer-events-none space-y-2">
        {toasts.map((t) => {
          let bgClass = 'bg-white border-slate-200 text-slate-800';
          let icon = <Info className="w-5 h-5 text-sky-600 shrink-0" />;
          let barClass = 'bg-sky-600';

          if (t.type === 'success') {
            bgClass = 'bg-white border-emerald-500 text-emerald-950';
            icon = <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />;
            barClass = 'bg-emerald-600';
          } else if (t.type === 'error') {
            bgClass = 'bg-white border-rose-500 text-rose-950';
            icon = <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />;
            barClass = 'bg-rose-600';
          } else if (t.type === 'warning') {
            bgClass = 'bg-white border-amber-500 text-amber-950';
            icon = <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />;
            barClass = 'bg-amber-600';
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto rounded-2xl p-3.5 sm:p-4 shadow-xl border flex items-start justify-between gap-3 animate-fade-in transition-all duration-300 relative overflow-hidden backdrop-blur-md ${bgClass}`}
              style={{
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              }}
            >
              <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${barClass}`} />

              <div className="flex items-start space-x-3 pl-1">
                <div className="mt-0.5">{icon}</div>
                <div className="space-y-0.5">
                  {t.title && (
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      {t.title}
                    </h4>
                  )}
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    {t.message}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

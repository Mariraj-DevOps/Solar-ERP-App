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

      {/* Floating Modern Toast Stack Container matching #EEE5D4 / #FAF7F0 Theme */}
      <div className="fixed top-12 sm:top-5 left-1/2 -translate-x-1/2 z-[9999] w-[92%] sm:w-auto sm:min-w-[360px] sm:max-w-md pointer-events-none space-y-2 pt-1">
        {toasts.map((t) => {
          let icon = <Info className="w-5 h-5 text-[#2D6043] shrink-0" />;
          let barClass = 'bg-[#2D6043]';
          let borderAccent = 'border-[#E8DFD0]';

          if (t.type === 'success') {
            icon = <CheckCircle2 className="w-5 h-5 text-[#2D6043] shrink-0" />;
            barClass = 'bg-gradient-to-b from-[#2D6043] to-[#184F34]';
            borderAccent = 'border-[#C8DACF]';
          } else if (t.type === 'error') {
            icon = <AlertCircle className="w-5 h-5 text-rose-700 shrink-0" />;
            barClass = 'bg-rose-600';
            borderAccent = 'border-rose-200';
          } else if (t.type === 'warning') {
            icon = <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />;
            barClass = 'bg-amber-600';
            borderAccent = 'border-amber-200';
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto rounded-2xl p-3.5 sm:p-4 shadow-xl border flex items-start justify-between gap-3 animate-fade-in transition-all duration-300 relative overflow-hidden backdrop-blur-md bg-[#FAF7F0] ${borderAccent}`}
              style={{
                boxShadow: '0 12px 28px -5px rgba(11, 53, 34, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.06)',
              }}
            >
              <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${barClass}`} />

              <div className="flex items-start space-x-3 pl-1.5">
                <div className="mt-0.5">{icon}</div>
                <div className="space-y-0.5">
                  {t.title && (
                    <h4 className="text-xs font-black uppercase tracking-wider text-[#0B3522]">
                      {t.title}
                    </h4>
                  )}
                  <p className="text-xs text-[#405446] leading-snug font-medium">
                    {t.message}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                className="p-1 rounded-xl text-[#6B8072] hover:text-[#0B3522] hover:bg-[#E8DFD0]/60 transition-colors shrink-0 cursor-pointer"
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

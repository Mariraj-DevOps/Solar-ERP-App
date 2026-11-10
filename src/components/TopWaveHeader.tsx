import React from 'react';
import { X } from 'lucide-react';

interface TopWaveHeaderProps {
  title?: string;
  subtitle?: string;
  showClose?: boolean;
  onClose?: () => void;
  className?: string;
}

export function TopWaveHeader({
  title = 'Solar Designs Pvt Ltd',
  subtitle = 'Labour Attendance ERP',
  showClose = false,
  onClose,
  className = '',
}: TopWaveHeaderProps) {
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-[#082417] via-[#0E3D26] to-[#164D32] select-none ${className}`}>
      {/* Background flowing silk wave ribbons */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-20"
        preserveAspectRatio="none"
        viewBox="0 0 600 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M-50 40 C150 130 320 -20 650 80"
          stroke="url(#topWaveGrad1)"
          strokeWidth="36"
          strokeLinecap="round"
        />
        <path
          d="M-30 120 C180 30 350 190 650 40"
          stroke="url(#topWaveGrad2)"
          strokeWidth="26"
          strokeLinecap="round"
        />
        <path
          d="M-20 170 C220 90 400 130 650 140"
          stroke="url(#topWaveGrad3)"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="topWaveGrad1" x1="0" y1="0" x2="600" y2="200" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3DBA6B" stopOpacity="0.8" />
            <stop stopColor="#ffffff" stopOpacity="0.15" />
            <stop stopColor="#0B3522" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="topWaveGrad2" x1="0" y1="0" x2="600" y2="200" gradientUnits="userSpaceOnUse">
            <stop stopColor="#5CD68D" stopOpacity="0.6" />
            <stop stopColor="#1E5C3B" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="topWaveGrad3" x1="0" y1="0" x2="600" y2="200" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" stopOpacity="0.35" />
            <stop stopColor="#3DBA6B" stopOpacity="0.05" />
          </linearGradient>
        </defs>
      </svg>

      {/* Content Bar */}
      <div className="relative z-10 px-4 sm:px-6 pt-3.5 pb-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 rounded-2xl bg-white p-1.5 shadow-md flex items-center justify-center shrink-0 border border-white/30">
            <img
              src="/assets/aistudio/solar_designs_clean_logo_bf464b07.png"
              alt="Logo"
              className="w-full h-full object-contain pointer-events-none"
            />
          </div>
          <div>
            <div className="font-bold text-sm sm:text-base text-white tracking-tight leading-tight">
              {title}
            </div>
            <div className="text-[11px] sm:text-xs text-emerald-200/90 font-medium leading-tight mt-0.5">
              {subtitle}
            </div>
          </div>
        </div>

        {showClose && (
          <button
            onClick={onClose}
            className="w-8.5 h-8.5 rounded-full bg-white text-[#0B3522] flex items-center justify-center shadow-md font-bold cursor-pointer hover:bg-emerald-50 active:scale-95 transition-all"
            aria-label="Close menu"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        )}
      </div>

      {/* Organic Curved Wave Transition to #EEE5D4 */}
      <div className="relative w-full overflow-hidden leading-none z-10 -mb-[1px]">
        <svg
          viewBox="0 0 1200 64"
          preserveAspectRatio="none"
          className="w-full h-6 sm:h-9 block text-[#EEE5D4]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0 64 C250 64 350 14 600 24 C850 34 950 56 1200 32 L1200 64 L0 64 Z"
            fill="currentColor"
          />
        </svg>
      </div>
    </div>
  );
}

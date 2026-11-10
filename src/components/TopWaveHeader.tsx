import React from 'react';
import { X, ArrowLeft } from 'lucide-react';

interface TopWaveHeaderProps {
  title?: string;
  subtitle?: string;
  showClose?: boolean;
  onClose?: () => void;
  showBack?: boolean;
  onBack?: () => void;
  className?: string;
  isScrolled?: boolean;
}

export function TopWaveHeader({
  title = 'Solar Designs Pvt Ltd',
  subtitle = 'Labour Attendance ERP',
  showClose = false,
  onClose,
  showBack = false,
  onBack,
  className = '',
  isScrolled = false,
}: TopWaveHeaderProps) {
  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-b from-[#082417] via-[#0D3823] to-[#14472F] select-none transition-all duration-300 ease-in-out ${className}`}
      style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}
    >
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
      <div
        className={`relative z-10 px-4 sm:px-6 flex items-center justify-between transition-all duration-300 ease-in-out ${
          isScrolled ? (showBack ? 'py-1.5' : 'py-0') : 'pt-2.5 pb-2.5'
        }`}
      >
        <div className="flex items-center space-x-2.5 min-w-0">
          {showBack && (
            <button
              type="button"
              onClick={onBack}
              className={`rounded-2xl bg-white/15 hover:bg-white/25 active:scale-95 text-white flex items-center justify-center shadow-xs border border-white/20 transition-all cursor-pointer shrink-0 ${
                isScrolled ? 'w-8 h-8 mr-1' : 'w-9 h-9 mr-1'
              }`}
              aria-label="Go back"
              title="Go back"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
            </button>
          )}

          {/* Logo & Branding - Hides while scrolling, reappears when scrolled back to top */}
          <div
            className={`flex items-center transition-all duration-300 ease-in-out origin-left ${
              isScrolled
                ? 'opacity-0 scale-95 -translate-y-2 pointer-events-none max-h-0 overflow-hidden'
                : 'opacity-100 scale-100 translate-y-0 max-h-16 overflow-visible'
            }`}
          >
            <div className="w-11 h-11 rounded-2xl bg-white p-1.5 shadow-md flex items-center justify-center shrink-0 border border-white/30 mr-2.5">
              <img
                src="/assets/aistudio/solar_designs_clean_logo_bf464b07.png"
                alt="Logo"
                className="w-full h-full object-contain pointer-events-none"
              />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm sm:text-base text-white tracking-tight leading-tight truncate">
                {title}
              </div>
              <div className="text-[11px] sm:text-xs text-emerald-200/90 font-medium leading-tight mt-0.5 truncate">
                {subtitle}
              </div>
            </div>
          </div>
        </div>

        {showClose && (
          <button
            onClick={onClose}
            className="w-8.5 h-8.5 rounded-full bg-white text-[#0B3522] flex items-center justify-center shadow-md font-bold cursor-pointer hover:bg-emerald-50 active:scale-95 transition-all shrink-0"
            aria-label="Close menu"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        )}
      </div>

      {/* Organic Curved Wave Transition to #EEE5D4 */}
      <div
        className={`relative w-full overflow-hidden leading-none z-10 -mb-[1px] transition-all duration-300 ease-in-out ${
          isScrolled ? 'h-3 sm:h-5' : 'h-6 sm:h-9'
        }`}
      >
        <svg
          viewBox="0 0 1200 64"
          preserveAspectRatio="none"
          className="w-full h-full block text-[#EEE5D4]"
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

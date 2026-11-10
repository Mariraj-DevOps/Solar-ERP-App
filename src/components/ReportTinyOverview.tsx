import React from 'react';
import { TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface ReportTinyOverviewProps {
  topLabel?: string;
  topValue: string;
  topSubtitle: string;
  topScore: number; // 0 to 100 for speedometer needle
  bannerText?: string;
  bottomLabel?: string;
  bottomValue: string;
  bottomSubtitle: string;
  bottomPercent: number; // 0 to 100 for radial donut
  bottomColor?: string; // default '#0284c7'
  isPositiveTrend?: boolean;
  onViewTop?: () => void;
  onViewBottom?: () => void;
}

export function ReportTinyOverview({
  topLabel,
  topValue,
  topSubtitle,
  topScore,
  bannerText = 'Attendance vs Payment Overview',
  bottomLabel,
  bottomValue,
  bottomSubtitle,
  bottomPercent,
  bottomColor = '#0284c7',
  isPositiveTrend = true,
  onViewTop,
  onViewBottom,
}: ReportTinyOverviewProps) {
  // Semicircular Speedometer Arc Geometry (Exact match to Image 2)
  const cx = 50;
  const cy = 48;
  const clampedScore = Math.max(5, Math.min(95, topScore));
  const needleRad = Math.PI - (clampedScore / 100) * Math.PI;
  const needleLength = 27;
  const needleTipX = cx + needleLength * Math.cos(needleRad);
  const needleTipY = cy - needleLength * Math.sin(needleRad);

  // Radial Progress Ring Geometry (Exact match to Image 2)
  const ringRadius = 26;
  const ringCircumference = 2 * Math.PI * ringRadius; // ~163.36
  const clampedPercent = Math.max(0, Math.min(100, Math.round(bottomPercent)));
  const ringOffset = ringCircumference * (1 - clampedPercent / 100);

  return (
    <div className="bg-[#FAF7F0] rounded-3xl border border-[#E8DFD0] shadow-xs p-4 sm:p-5 flex flex-col justify-between space-y-4 relative overflow-hidden card-wave-bg">
      {/* ------------------------------------------------------------- */}
      {/* TOP SECTION: Upper Metric with Semicircular Speedo Gauge */}
      {/* ------------------------------------------------------------- */}
      <div
        onClick={onViewTop}
        className={`flex items-center justify-between gap-3 ${
          onViewTop ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''
        }`}
      >
        <div className="min-w-0">
          <div className="font-mono text-2xl sm:text-3xl font-black text-[#0B3522] tracking-tight">
            {topValue}
          </div>
          <p className="text-xs text-[#526659] mt-0.5 flex items-center gap-1 font-medium truncate">
            {isPositiveTrend ? (
              <span className="text-[#2D6043] font-bold inline-flex items-center">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            ) : (
              <span className="text-amber-700 font-bold inline-flex items-center">
                <ArrowDownRight className="w-3.5 h-3.5" />
              </span>
            )}
            <span className="truncate">{topSubtitle}</span>
          </p>
        </div>

        {/* Speedometer Semicircular Gauge (Exact match to Image 2) */}
        <div className="shrink-0 w-24 h-14 relative flex items-center justify-center">
          <svg viewBox="0 0 100 55" className="w-full h-full overflow-visible">
            {/* Zone 1: 0% - 33% (Dark Forest Green / Black) */}
            <path
              d="M 16.0 48.0 A 34 34 0 0 1 33.0 18.6"
              fill="none"
              stroke="#0B3522"
              strokeWidth="11"
              strokeLinecap="butt"
            />
            {/* Zone 2: 33% - 66% (Medium Emerald / Charcoal) */}
            <path
              d="M 33.0 18.6 A 34 34 0 0 1 67.0 18.6"
              fill="none"
              stroke="#2D6043"
              strokeWidth="11"
              strokeLinecap="butt"
            />
            {/* Zone 3: 66% - 100% (Soft Light Beige / Sage) */}
            <path
              d="M 67.0 18.6 A 34 34 0 0 1 84.0 48.0"
              fill="none"
              stroke="#E2D8C6"
              strokeWidth="11"
              strokeLinecap="butt"
            />

            {/* Gauge Needle Pointer */}
            <line
              x1={cx}
              y1={cy}
              x2={needleTipX}
              y2={needleTipY}
              stroke="#0B3522"
              strokeWidth="2.75"
              strokeLinecap="round"
            />
            {/* Center Pivot Circle */}
            <circle cx={cx} cy={cy} r="4" fill="#0B3522" />
            <circle cx={cx} cy={cy} r="1.5" fill="#FAF7F0" />
          </svg>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MIDDLE BANNER: Full-width ribbon matching Image 2 */}
      {/* ------------------------------------------------------------- */}
      <div className="relative flex items-center justify-center py-1.5 px-4 bg-[#EDE5D8]/80 border-y border-[#DDD2C0] rounded-lg -mx-4 sm:-mx-5">
        <div className="flex items-center space-x-2 text-xs font-bold text-[#0B3522]">
          <TrendingUp className="w-3.5 h-3.5 text-[#2D6043]" />
          <span>{bannerText}</span>
        </div>
        {/* Subtle Right Arrow Point (like Image 2) */}
        <div className="absolute right-2 text-[#7D9384] text-xs">›</div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* BOTTOM SECTION: Lower Metric with Circular Donut Progress */}
      {/* ------------------------------------------------------------- */}
      <div
        onClick={onViewBottom}
        className={`flex items-center justify-between gap-3 ${
          onViewBottom ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''
        }`}
      >
        <div className="min-w-0">
          <div
            style={{ color: bottomColor }}
            className="font-mono text-2xl sm:text-3xl font-black tracking-tight"
          >
            {bottomValue}
          </div>
          <p className="text-xs text-[#526659] mt-0.5 font-medium truncate">
            {bottomSubtitle}
          </p>
        </div>

        {/* Circular Progress Ring / Donut (Exact match to Image 2) */}
        <div className="shrink-0 w-16 h-16 relative flex items-center justify-center">
          <svg viewBox="0 0 80 80" className="w-full h-full transform -rotate-90">
            {/* Background Track Circle */}
            <circle
              cx="40"
              cy="40"
              r={ringRadius}
              fill="none"
              stroke="#E8DFD0"
              strokeWidth="9"
            />
            {/* Progress Stroke Arc */}
            <circle
              cx="40"
              cy="40"
              r={ringRadius}
              fill="none"
              stroke={bottomColor}
              strokeWidth="9"
              strokeDasharray={ringCircumference}
              strokeDashoffset={ringOffset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute font-mono text-[10px] font-bold text-[#0B3522]">
            {clampedPercent}%
          </div>
        </div>
      </div>
    </div>
  );
}

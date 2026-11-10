import React, { useState } from 'react';
import { formatINR } from '../lib/calculations';

export interface TrendDataPoint {
  label: string;
  sublabel?: string;
  attendance: number;
  payment: number;
  workerCount?: number;
  isForecast?: boolean;
}

interface SplineTrendChartProps {
  title?: string;
  subtitle?: string;
  data: TrendDataPoint[];
  period: 'weekly' | 'monthly';
  unit?: string;
}

function getCubicBezierSpline(points: { x: number; y: number }[]): string {
  if (!points || points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < points.length - 2 ? points[i + 2] : p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

export function SplineTrendChart({
  title = 'Attendance vs Payment Trend by Cycle',
  subtitle,
  data,
  period,
}: SplineTrendChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Toggle state for series (matching checkboxes in Image 1)
  const [showAttendance, setShowAttendance] = useState(true);
  const [showPayment, setShowPayment] = useState(true);
  const [showForecastAttendance, setShowForecastAttendance] = useState(true);
  const [showForecastPayment, setShowForecastPayment] = useState(true);

  if (!data || data.length === 0) {
    return (
      <div className="bg-[#FAF7F0] rounded-3xl border border-[#E8DFD0] p-6 text-center text-xs text-[#526659]">
        No trend analytics data available.
      </div>
    );
  }

  // Chart dimensions
  const svgWidth = 720;
  const svgHeight = 270;
  const marginLeft = 62;
  const marginRight = 32;
  const marginTop = 30;
  const marginBottom = 48;

  const plotWidth = svgWidth - marginLeft - marginRight;
  const plotHeight = svgHeight - marginTop - marginBottom;

  // Maximum value for scaling
  const maxValRaw = Math.max(
    ...data.map((d) => Math.max(d.attendance, d.payment)),
    1000
  );
  // Round up to clean scale (e.g. 50k, 100k, 250k)
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxValRaw)));
  const normalized = maxValRaw / magnitude;
  let factor = 10;
  if (normalized <= 1.5) factor = 1.5;
  else if (normalized <= 2) factor = 2;
  else if (normalized <= 3) factor = 3;
  else if (normalized <= 5) factor = 5;
  else if (normalized <= 7.5) factor = 7.5;
  const maxScale = Math.ceil(factor * magnitude);

  // Calculate coordinates for points
  const stepX = data.length > 1 ? plotWidth / (data.length - 1) : plotWidth;

  const points = data.map((d, i) => {
    const x = marginLeft + i * stepX;
    const yAtt = marginTop + plotHeight - (Math.max(0, d.attendance) / maxScale) * plotHeight;
    const yPay = marginTop + plotHeight - (Math.max(0, d.payment) / maxScale) * plotHeight;
    return {
      x,
      yAtt,
      yPay,
      data: d,
      index: i,
    };
  });

  // Separate into solid (historical) and dashed (forecast) segments
  const firstForecastIdx = data.findIndex((d) => d.isForecast);
  const splitIdx = firstForecastIdx === -1 ? data.length : firstForecastIdx;

  // Solid points: 0 to splitIdx (includes bridge to forecast if available)
  const solidPointsAtt = points
    .slice(0, splitIdx < data.length ? splitIdx + 1 : splitIdx)
    .map((p) => ({ x: p.x, y: p.yAtt }));
  const solidPointsPay = points
    .slice(0, splitIdx < data.length ? splitIdx + 1 : splitIdx)
    .map((p) => ({ x: p.x, y: p.yPay }));

  // Forecast points: from splitIdx - 1 (for continuity) to end
  const forecastPointsAtt =
    splitIdx < data.length
      ? points.slice(Math.max(0, splitIdx - 1)).map((p) => ({ x: p.x, y: p.yAtt }))
      : [];
  const forecastPointsPay =
    splitIdx < data.length
      ? points.slice(Math.max(0, splitIdx - 1)).map((p) => ({ x: p.x, y: p.yPay }))
      : [];

  const solidPathAtt = getCubicBezierSpline(solidPointsAtt);
  const solidPathPay = getCubicBezierSpline(solidPointsPay);
  const forecastPathAtt = getCubicBezierSpline(forecastPointsAtt);
  const forecastPathPay = getCubicBezierSpline(forecastPointsPay);

  // Y-axis grid lines (4 ticks: 0, 33%, 66%, 100%)
  const yTicks = [
    { pct: 1.0, val: maxScale },
    { pct: 0.66, val: Math.round(maxScale * 0.66) },
    { pct: 0.33, val: Math.round(maxScale * 0.33) },
    { pct: 0.0, val: 0 },
  ];

  const formatYAxis = (val: number) => {
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${Math.round(val / 1000)}K`;
    return `₹${val}`;
  };

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : null;

  return (
    <div className="bg-[#FAF7F0] rounded-3xl border border-[#E8DFD0] shadow-xs p-5 relative overflow-hidden card-wave-bg">
      {/* Title & Subtitle matching Image 1 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
        <div>
          <h3 className="font-bold text-sm sm:text-base text-[#0B3522] tracking-tight">{title}</h3>
          {subtitle && <p className="text-[11px] text-[#526659] mt-0.5">{subtitle}</p>}
        </div>
        <div className="text-[11px] text-[#526659] font-medium flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-[#2D6043]" />
          <span>Interactive Spline Curve</span>
        </div>
      </div>

      {/* Main SVG Curve Area */}
      <div className="relative w-full overflow-x-auto no-scrollbar">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto min-w-[580px] select-none overflow-visible"
        >
          {/* Horizontal Grid lines */}
          {yTicks.map((tick, i) => {
            const y = marginTop + plotHeight - tick.pct * plotHeight;
            return (
              <g key={i}>
                <line
                  x1={marginLeft}
                  y1={y}
                  x2={svgWidth - marginRight}
                  y2={y}
                  stroke="#E8DFD0"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <text
                  x={marginLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className="font-mono text-[10px] fill-[#7D9384] font-medium"
                >
                  {formatYAxis(tick.val)}
                </text>
              </g>
            );
          })}

          {/* Hover guideline */}
          {activePoint && (
            <line
              x1={activePoint.x}
              y1={marginTop}
              x2={activePoint.x}
              y2={marginTop + plotHeight}
              stroke="#2D6043"
              strokeWidth="1.5"
              strokeDasharray="3 3"
              opacity={0.6}
            />
          )}

          {/* Solid Attendance Spline Curve (Teal/Emerald - Image 1) */}
          {showAttendance && solidPathAtt && (
            <path
              d={solidPathAtt}
              fill="none"
              stroke="#2D6043"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Dashed Forecast Attendance Curve */}
          {showForecastAttendance && forecastPathAtt && (
            <path
              d={forecastPathAtt}
              fill="none"
              stroke="#0D9488"
              strokeWidth="2.5"
              strokeDasharray="4 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Solid Payments Spline Curve (Warm Golden Amber - Image 1) */}
          {showPayment && solidPathPay && (
            <path
              d={solidPathPay}
              fill="none"
              stroke="#D97706"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Dashed Forecast Payments Curve */}
          {showForecastPayment && forecastPathPay && (
            <path
              d={forecastPathPay}
              fill="none"
              stroke="#FBBF24"
              strokeWidth="2.5"
              strokeDasharray="4 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Nodes (Circles with white center matching Image 1) */}
          {points.map((p, idx) => {
            const isForecast = p.data.isForecast;
            const isHovered = hoveredIdx === idx;

            return (
              <g
                key={idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                {/* Attendance Node */}
                {((!isForecast && showAttendance) || (isForecast && showForecastAttendance)) && (
                  <circle
                    cx={p.x}
                    cy={p.yAtt}
                    r={isHovered ? 6.5 : isForecast ? 4.5 : 5}
                    fill="#FFFFFF"
                    stroke={isForecast ? '#0D9488' : '#2D6043'}
                    strokeWidth={isForecast ? 2 : 2.5}
                    className="transition-all duration-150"
                  />
                )}

                {/* Payment Node */}
                {((!isForecast && showPayment) || (isForecast && showForecastPayment)) && (
                  <circle
                    cx={p.x}
                    cy={p.yPay}
                    r={isHovered ? 6.5 : isForecast ? 4.5 : 5}
                    fill="#FFFFFF"
                    stroke={isForecast ? '#F59E0B' : '#D97706'}
                    strokeWidth={isForecast ? 2 : 2.5}
                    className="transition-all duration-150"
                  />
                )}

                {/* Invisible hover hotspot */}
                <rect
                  x={p.x - stepX / 2}
                  y={marginTop}
                  width={stepX}
                  height={plotHeight}
                  fill="transparent"
                />

                {/* X-Axis Labels */}
                <text
                  x={p.x}
                  y={marginTop + plotHeight + 16}
                  textAnchor="middle"
                  className={`text-[10px] font-bold ${
                    isHovered
                      ? 'fill-[#0B3522]'
                      : isForecast
                      ? 'fill-[#7D9384] italic'
                      : 'fill-[#526659]'
                  }`}
                >
                  {p.data.label}
                </text>
                {p.data.sublabel && (
                  <text
                    x={p.x}
                    y={marginTop + plotHeight + 28}
                    textAnchor="middle"
                    className="font-mono text-[9px] fill-[#94A89C]"
                  >
                    {p.data.sublabel}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip Bubble */}
        {activePoint && (
          <div
            style={{
              left: `${(activePoint.x / svgWidth) * 100}%`,
              top: '12%',
              transform: 'translateX(-50%)',
            }}
            className="absolute z-30 pointer-events-none bg-[#0B3522] text-white rounded-2xl p-2.5 shadow-xl border border-[#2D6043] min-w-[170px]"
          >
            <div className="flex items-center justify-between text-[11px] font-bold pb-1.5 border-b border-white/15">
              <span>{activePoint.data.label}</span>
              {activePoint.data.sublabel && (
                <span className="font-mono text-emerald-200 text-[10px]">
                  {activePoint.data.sublabel}
                </span>
              )}
            </div>

            <div className="space-y-1 mt-1.5 text-[10px]">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-[#5CD68D]" />
                  <span>Labour Wages:</span>
                </span>
                <span className="font-mono font-bold text-white">
                  {formatINR(activePoint.data.attendance)}
                </span>
              </div>

              {activePoint.data.workerCount !== undefined && activePoint.data.workerCount > 0 && (
                <div className="flex items-center justify-between text-white/70 pl-3.5">
                  <span>Worker-Days:</span>
                  <span className="font-mono font-bold">{activePoint.data.workerCount} workers</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-amber-200">
                  <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                  <span>Settled (Paid):</span>
                </span>
                <span className="font-mono font-bold text-white">
                  {formatINR(activePoint.data.payment)}
                </span>
              </div>

              {activePoint.data.isForecast && (
                <div className="pt-1 mt-1 border-t border-white/10 text-[9px] text-teal-300 italic text-center">
                  Projected Estimate
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Legend with Interactive Toggles (Matching Image 1) */}
      {/* ------------------------------------------------------------- */}
      <div className="mt-2 pt-3 border-t border-[#E8DFD0] flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
        {/* Toggle 1: Attendance */}
        <label className="flex items-center space-x-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showAttendance}
            onChange={(e) => setShowAttendance(e.target.checked)}
            className="w-3.5 h-3.5 rounded accent-[#2D6043] cursor-pointer"
          />
          <span className="w-2.5 h-2.5 rounded-sm bg-[#2D6043]" />
          <span className="font-semibold text-[#0B3522] text-[11px]">Labour (Attendance)</span>
        </label>

        {/* Toggle 2: Payments */}
        <label className="flex items-center space-x-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showPayment}
            onChange={(e) => setShowPayment(e.target.checked)}
            className="w-3.5 h-3.5 rounded accent-[#D97706] cursor-pointer"
          />
          <span className="w-2.5 h-2.5 rounded-sm bg-[#D97706]" />
          <span className="font-semibold text-[#0B3522] text-[11px]">Expenses / Payments</span>
        </label>

        {/* Toggle 3: Forecasted Attendance */}
        <label className="flex items-center space-x-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showForecastAttendance}
            onChange={(e) => setShowForecastAttendance(e.target.checked)}
            className="w-3.5 h-3.5 rounded accent-[#0D9488] cursor-pointer"
          />
          <span className="w-2.5 h-2.5 rounded-sm border border-dashed border-[#0D9488] bg-teal-50" />
          <span className="font-medium text-[#526659] text-[11px]">Forecasted Labour</span>
        </label>

        {/* Toggle 4: Forecasted Payments */}
        <label className="flex items-center space-x-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showForecastPayment}
            onChange={(e) => setShowForecastPayment(e.target.checked)}
            className="w-3.5 h-3.5 rounded accent-[#F59E0B] cursor-pointer"
          />
          <span className="w-2.5 h-2.5 rounded-sm border border-dashed border-[#F59E0B] bg-amber-50" />
          <span className="font-medium text-[#526659] text-[11px]">Forecasted Payments</span>
        </label>
      </div>
    </div>
  );
}

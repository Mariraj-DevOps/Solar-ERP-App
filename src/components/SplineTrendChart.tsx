import React, { useState } from 'react';
import { formatINR } from '../lib/calculations';

export interface ComparisonPoint {
  label: string; // e.g. 'Sat', 'Sun', 'Mon', etc.
  sublabel1?: string; // Date of current period e.g. '24/10'
  sublabel2?: string; // Date of previous period e.g. '17/10'
  currentVal: number;
  prevVal: number;
}

interface SplineTrendChartProps {
  title: string;
  subtitle?: string;
  currentSeriesName: string;
  prevSeriesName: string;
  data: ComparisonPoint[];
  valueFormatter?: (val: number) => string;
  unitLabel?: string;
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
  title,
  subtitle,
  currentSeriesName,
  prevSeriesName,
  data,
  valueFormatter = (val) => String(val),
  unitLabel = '',
}: SplineTrendChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [showCurrent, setShowCurrent] = useState(true);
  const [showPrev, setShowPrev] = useState(true);

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
  const marginLeft = 64;
  const marginRight = 32;
  const marginTop = 30;
  const marginBottom = 48;

  const plotWidth = svgWidth - marginLeft - marginRight;
  const plotHeight = svgHeight - marginTop - marginBottom;

  // Maximum value for scaling (ensure minimum scale of 10 for low worker count)
  const maxValRaw = Math.max(
    ...data.map((d) => Math.max(d.currentVal, d.prevVal)),
    10
  );

  // Round up to clean scale (e.g. 50, 100, 250, 50k, 100k)
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
    const yCurrent = marginTop + plotHeight - (Math.max(0, d.currentVal) / maxScale) * plotHeight;
    const yPrev = marginTop + plotHeight - (Math.max(0, d.prevVal) / maxScale) * plotHeight;
    return {
      x,
      yCurrent,
      yPrev,
      data: d,
      index: i,
    };
  });

  const currentPoints = points.map((p) => ({ x: p.x, y: p.yCurrent }));
  const prevPoints = points.map((p) => ({ x: p.x, y: p.yPrev }));

  const currentPath = getCubicBezierSpline(currentPoints);
  const prevPath = getCubicBezierSpline(prevPoints);

  // Y-axis grid lines (4 ticks: 0, 33%, 66%, 100%)
  const yTicks = [
    { pct: 1.0, val: maxScale },
    { pct: 0.66, val: Math.round(maxScale * 0.66) },
    { pct: 0.33, val: Math.round(maxScale * 0.33) },
    { pct: 0.0, val: 0 },
  ];

  const formatYAxis = (val: number) => {
    if (unitLabel === '₹') {
      if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
      if (val >= 1000) return `₹${Math.round(val / 1000)}K`;
      return `₹${val}`;
    }
    return String(val);
  };

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : null;

  return (
    <div className="bg-[#FAF7F0] rounded-3xl border border-[#E8DFD0] shadow-xs p-5 relative overflow-hidden card-wave-bg">
      {/* Title */}
      <div className="flex items-center justify-between pb-2">
        <h3 className="font-bold text-sm sm:text-base text-[#0B3522] tracking-tight">{title}</h3>
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

          {/* Solid Current Cycle Spline Curve (Deep Emerald - #2D6043) */}
          {showCurrent && currentPath && (
            <path
              d={currentPath}
              fill="none"
              stroke="#2D6043"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Solid Previous Cycle Spline Curve (Golden Amber - #D97706) */}
          {showPrev && prevPath && (
            <path
              d={prevPath}
              fill="none"
              stroke="#D97706"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Nodes (Circles with white center matching design) */}
          {points.map((p, idx) => {
            const isHovered = hoveredIdx === idx;

            return (
              <g
                key={idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                {/* Current Cycle Node */}
                {showCurrent && (
                  <circle
                    cx={p.x}
                    cy={p.yCurrent}
                    r={isHovered ? 6.5 : 5}
                    fill="#FFFFFF"
                    stroke="#2D6043"
                    strokeWidth="2.5"
                    className="transition-all duration-150"
                  />
                )}

                {/* Previous Cycle Node */}
                {showPrev && (
                  <circle
                    cx={p.x}
                    cy={p.yPrev}
                    r={isHovered ? 6.5 : 5}
                    fill="#FFFFFF"
                    stroke="#D97706"
                    strokeWidth="2.5"
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
                    isHovered ? 'fill-[#0B3522]' : 'fill-[#526659]'
                  }`}
                >
                  {p.data.label}
                </text>
                {p.data.sublabel1 && (
                  <text
                    x={p.x}
                    y={marginTop + plotHeight + 28}
                    textAnchor="middle"
                    className="font-mono text-[9px] fill-[#94A89C]"
                  >
                    {p.data.sublabel1}
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
              top: '10%',
              transform: 'translateX(-50%)',
            }}
            className="absolute z-30 pointer-events-none bg-[#0B3522] text-white rounded-2xl p-2.5 shadow-xl border border-[#2D6043] min-w-[180px]"
          >
            <div className="flex items-center justify-between text-[11px] font-bold pb-1.5 border-b border-white/15">
              <span>{activePoint.data.label}</span>
              <span className="font-mono text-emerald-200 text-[10px]">
                {activePoint.data.sublabel1} vs {activePoint.data.sublabel2}
              </span>
            </div>

            <div className="space-y-1.5 mt-1.5 text-[10px]">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-[#5CD68D]" />
                  <span>{currentSeriesName}:</span>
                </span>
                <span className="font-mono font-bold text-white">
                  {valueFormatter(activePoint.data.currentVal)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-amber-200">
                  <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                  <span>{prevSeriesName}:</span>
                </span>
                <span className="font-mono font-bold text-white">
                  {valueFormatter(activePoint.data.prevVal)}
                </span>
              </div>

              {/* Net Difference calculation */}
              {(() => {
                const diff = activePoint.data.currentVal - activePoint.data.prevVal;
                const isPositive = diff >= 0;
                const pct =
                  activePoint.data.prevVal > 0
                    ? Math.round((Math.abs(diff) / activePoint.data.prevVal) * 100)
                    : 100;
                return (
                  <div className="pt-1 border-t border-white/10 flex items-center justify-between text-[9px]">
                    <span className="text-white/70">Difference:</span>
                    <span
                      className={`font-mono font-bold ${
                        isPositive ? 'text-emerald-300' : 'text-rose-300'
                      }`}
                    >
                      {isPositive ? '+' : '-'}
                      {valueFormatter(Math.abs(diff))} ({isPositive ? '↑' : '↓'} {pct}%)
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Legend with Interactive Toggles */}
      {/* ------------------------------------------------------------- */}
      <div className="mt-2 pt-3 border-t border-[#E8DFD0] flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs">
        {/* Toggle 1: Current Series */}
        <label className="flex items-center space-x-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showCurrent}
            onChange={(e) => setShowCurrent(e.target.checked)}
            className="w-3.5 h-3.5 rounded accent-[#2D6043] cursor-pointer"
          />
          <span className="w-2.5 h-2.5 rounded-sm bg-[#2D6043]" />
          <span className="font-semibold text-[#0B3522] text-[11px]">{currentSeriesName}</span>
        </label>

        {/* Toggle 2: Previous Series */}
        <label className="flex items-center space-x-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showPrev}
            onChange={(e) => setShowPrev(e.target.checked)}
            className="w-3.5 h-3.5 rounded accent-[#D97706] cursor-pointer"
          />
          <span className="w-2.5 h-2.5 rounded-sm bg-[#D97706]" />
          <span className="font-semibold text-[#0B3522] text-[11px]">{prevSeriesName}</span>
        </label>
      </div>
    </div>
  );
}

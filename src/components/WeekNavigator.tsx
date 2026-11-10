import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { getNextWeek, getPreviousWeek, getWeekBounds, getTodayKolkataISO } from '../lib/dateUtils';
import { CustomSelect } from './CustomSelect';

interface WeekNavigatorProps {
  currentWeekStart: string;
  onWeekChange: (newWeekStart: string) => void;
}

export function WeekNavigator({ currentWeekStart, onWeekChange }: WeekNavigatorProps) {
  const bounds = getWeekBounds(currentWeekStart);
  const todayISO = getTodayKolkataISO();
  const currentWeekBounds = getWeekBounds(todayISO);
  const isCurrentWeek = bounds.startDate === currentWeekBounds.startDate;

  const handlePrev = () => {
    const prev = getPreviousWeek(bounds.startDate);
    onWeekChange(prev.startDate);
  };

  const handleNext = () => {
    const next = getNextWeek(bounds.startDate);
    onWeekChange(next.startDate);
  };

  const handleCurrentWeek = () => {
    onWeekChange(currentWeekBounds.startDate);
  };

  // Generate 12 recent cycle options for fast jumping
  const weekOptions = useMemo(() => {
    const opts = [];
    let cur = currentWeekBounds;
    for (let i = 0; i < 12; i++) {
      const label = i === 0 ? `Current Week: ${cur.displayRange}` : `${i} Week${i > 1 ? 's' : ''} Ago: ${cur.displayRange}`;
      opts.push({
        value: cur.startDate,
        label,
        sublabel: `${cur.startDate} to ${cur.endDate}`,
      });
      cur = getPreviousWeek(cur.startDate);
    }
    // Also include currently selected if it is older than 12 weeks
    if (!opts.some((o) => o.value === bounds.startDate)) {
      opts.unshift({
        value: bounds.startDate,
        label: `Selected: ${bounds.displayRange}`,
        sublabel: `${bounds.startDate} to ${bounds.endDate}`,
      });
    }
    return opts;
  }, [currentWeekBounds.startDate, bounds.startDate, bounds.displayRange]);

  return (
    <div className="flex flex-col gap-2 bg-[#FAF7F0] border border-[#E8DFD0] rounded-2xl p-2.5 sm:p-3 shadow-xs w-full sm:w-auto">
      <div className="flex items-center justify-between gap-1.5">
        <button
          onClick={handlePrev}
          title="Previous reporting week (Saturday - Friday)"
          className="p-1.5 text-[#526659] hover:text-[#0B3522] hover:bg-black/5 rounded-xl transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center space-x-2 px-3 py-1.5 bg-white/80 border border-[#E8DFD0] rounded-xl flex-1 justify-center">
          <Calendar className="w-4 h-4 text-[#0B3522]" />
          <span className="text-xs font-bold text-[#0B3522] tracking-tight font-mono">
            {bounds.displayRange}
          </span>
          <span className="text-white bg-[#0B3522] px-2 py-0.5 rounded-lg uppercase font-bold text-[10px] tracking-wide">
            Sat–Fri
          </span>
        </div>

        <button
          onClick={handleNext}
          title="Next reporting week (Saturday - Friday)"
          className="p-1.5 text-[#526659] hover:text-[#0B3522] hover:bg-black/5 rounded-xl transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="w-full">
        <CustomSelect
          value={bounds.startDate}
          onChange={(val) => onWeekChange(String(val))}
          options={weekOptions}
          size="sm"
          placeholder="Select reporting cycle..."
        />
      </div>
    </div>
  );
}

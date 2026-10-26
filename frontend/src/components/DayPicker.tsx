import { addDays, formatDayMonth, formatWeekday } from '../lib/dates';
import type { BookingWindow } from '../lib/types';

type DayPickerProps = { window: BookingWindow; value: string; onChange: (date: string) => void };

const daysOf = (window: BookingWindow): string[] => {
  const days: string[] = [];
  for (let d = window.from; d <= window.to && days.length < 7; d = addDays(d, 1)) days.push(d);
  return days;
};

export const DayPicker = ({ window, value, onChange }: DayPickerProps) => (
  <div role="group" aria-label="Fecha" className="grid grid-cols-4 gap-2 sm:grid-cols-7">
    {daysOf(window).map((date) => {
      const selected = date === value;
      return (
        <button
          key={date}
          type="button"
          data-date={date}
          aria-pressed={selected}
          onClick={() => onChange(date)}
          className={`flex min-w-0 flex-col items-center rounded-md border px-1 py-2 text-sm ${
            selected
              ? 'border-emerald-600 bg-emerald-600 text-white'
              : 'border-slate-300 bg-white text-slate-700 hover:border-emerald-500'
          }`}
        >
          <span className="font-semibold capitalize">{formatWeekday(date)}</span>
          <span className="text-xs">{formatDayMonth(date)}</span>
        </button>
      );
    })}
  </div>
);

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react';
import {
  formatHijriDate,
  getTodayISO,
  toEnglishDigits,
} from '../domain/dateUtils';

const ARABIC_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

const WEEKDAYS = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

export interface PickerCell {
  day: number | null;
  iso: string | null;
  displayDigit: string;
}

/**
 * Pure helper returning the 7-column calendar cells for a given year/month (0-indexed)
 * with guaranteed English 0-9 day labels.
 */
export function buildPickerMonthGrid(year: number, monthIndex: number): PickerCell[] {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const cells: PickerCell[] = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({ day: null, iso: null, displayDigit: '' });
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    const iso = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({
      day: d,
      iso,
      displayDigit: toEnglishDigits(String(d)),
    });
  }
  return cells;
}

export function formatPickerTriggerValue(
  value: string | null | undefined,
  mode: 'date' | 'datetime'
): string {
  if (!value) return '';
  if (mode === 'datetime') {
    const datePart = value.slice(0, 10);
    const timePart = value.includes('T') ? value.split('T')[1]?.slice(0, 5) || '09:00' : '09:00';
    return toEnglishDigits(`${datePart} · ${timePart}`);
  }
  return toEnglishDigits(value.slice(0, 10));
}

interface ArabicDatePickerProps {
  mode?: 'date' | 'datetime';
  value: string | null | undefined;
  onChange: (nextValue: string) => void;
  disabled?: boolean;
  clearable?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  showHijri?: boolean;
}

export const ArabicDatePicker: React.FC<ArabicDatePickerProps> = ({
  mode = 'date',
  value,
  onChange,
  disabled = false,
  clearable = true,
  placeholder,
  ariaLabel,
  className = '',
  showHijri = false,
}) => {
  const today = getTodayISO();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; isMobile: boolean }>({
    top: 80,
    left: 16,
    isMobile: false,
  });

  const parsedDatePart = value && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : '';
  const parsedTimePart =
    mode === 'datetime' && value && value.includes('T')
      ? value.split('T')[1]?.slice(0, 5) || '10:00'
      : '10:00';

  const [viewYear, setViewYear] = useState(() => Number((parsedDatePart || today).slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(
    () => Number((parsedDatePart || today).slice(5, 7)) - 1
  );
  const [selectedDate, setSelectedDate] = useState(parsedDatePart || today);
  const [hour, setHour] = useState(() => Number(parsedTimePart.split(':')[0] || 10));
  const [minute, setMinute] = useState(() => Number(parsedTimePart.split(':')[1] || 0));

  useEffect(() => {
    if (!open) return;
    const base = parsedDatePart || today;
    setViewYear(Number(base.slice(0, 4)));
    setViewMonth(Number(base.slice(5, 7)) - 1);
    setSelectedDate(base);
    if (mode === 'datetime') {
      const [hh, mm] = parsedTimePart.split(':').map(Number);
      setHour(Number.isNaN(hh) ? 10 : Math.max(0, Math.min(23, hh)));
      setMinute(Number.isNaN(mm) ? 0 : Math.max(0, Math.min(59, mm)));
    }
  }, [open, parsedDatePart, parsedTimePart, mode, today]);

  const computePosition = () => {
    if (typeof window === 'undefined' || !triggerRef.current) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (vw < 640) {
      setCoords({ top: 0, left: 0, isMobile: true });
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    const popW = 312;
    const popH = mode === 'datetime' ? 405 : 345;
    let top = rect.bottom + 6;
    if (top + popH > vh - 12) {
      top = Math.max(12, rect.top - popH - 6);
    }
    let left = rect.right - popW;
    if (left < 12) left = 12;
    if (left + popW > vw - 12) left = Math.max(12, vw - popW - 12);
    setCoords({ top, left, isMobile: false });
  };

  useLayoutEffect(() => {
    if (!open) return;
    computePosition();
    const onResizeOrScroll = () => computePosition();
    window.addEventListener('resize', onResizeOrScroll);
    window.addEventListener('scroll', onResizeOrScroll, true);
    return () => {
      window.removeEventListener('resize', onResizeOrScroll);
      window.removeEventListener('scroll', onResizeOrScroll, true);
    };
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  const cells = useMemo(
    () => buildPickerMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const yearOptions = useMemo(() => {
    const start = Math.min(2020, viewYear - 5);
    const end = Math.max(2035, viewYear + 5);
    const list: number[] = [];
    for (let y = start; y <= end; y += 1) list.push(y);
    return list;
  }, [viewYear]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const emitValue = (isoDate: string, h = hour, m = minute) => {
    if (mode === 'datetime') {
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      onChange(`${isoDate}T${hh}:${mm}`);
    } else {
      onChange(isoDate);
    }
  };

  const handleSelectDay = (iso: string) => {
    setSelectedDate(iso);
    if (mode === 'date') {
      emitValue(iso);
      setOpen(false);
    } else {
      emitValue(iso, hour, minute);
    }
  };

  const displayText = formatPickerTriggerValue(value, mode);
  const hijriHint = showHijri && selectedDate ? formatHijriDate(selectedDate) : '';

  const popoverBody = (
    <div
      ref={popoverRef}
      dir="rtl"
      className="glass-panel rounded-2xl shadow-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#12141a] p-3.5 w-[312px] max-w-[calc(100vw-24px)] space-y-3"
    >
      {/* Header: Month + Year with English 0-9 digits */}
      <div className="flex items-center justify-between gap-1.5">
        <button
          type="button"
          onClick={prevMonth}
          aria-label="الشهر السابق"
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1.5">
          <select
            aria-label="الشهر"
            value={viewMonth}
            onChange={(e) => setViewMonth(Number(e.target.value))}
            className="rounded-lg border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#1a1d25] px-2 py-1 text-xs font-semibold text-slate-900 dark:text-slate-100"
          >
            {ARABIC_MONTHS.map((name, idx) => (
              <option key={name} value={idx}>
                {name} ({toEnglishDigits(String(idx + 1).padStart(2, '0'))})
              </option>
            ))}
          </select>

          <select
            aria-label="السنة"
            value={viewYear}
            onChange={(e) => setViewYear(Number(e.target.value))}
            className="rounded-lg border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#1a1d25] px-2 py-1 text-xs font-bold font-mono-tabular text-slate-900 dark:text-slate-100"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {toEnglishDigits(String(y))}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={nextMonth}
          aria-label="الشهر التالي"
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Weekdays */}
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-0.5">
            {w}
          </div>
        ))}
      </div>

      {/* Days Grid (0-9) */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, idx) => {
          if (!c.iso || !c.day) {
            return <div key={`e-${idx}`} className="h-8" />;
          }
          const isSelected = c.iso === selectedDate && !!parsedDatePart;
          const isToday = c.iso === today;
          return (
            <button
              key={c.iso}
              type="button"
              onClick={() => handleSelectDay(c.iso!)}
              className={`h-8 rounded-lg text-xs font-mono-tabular font-semibold transition-colors ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-sm'
                  : isToday
                  ? 'border border-blue-500 text-blue-700 dark:text-blue-300 bg-blue-50/70 dark:bg-blue-950/40'
                  : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10'
              }`}
            >
              {c.displayDigit}
            </button>
          );
        })}
      </div>

      {/* Time selector for datetime mode (English 0-9 digits) */}
      {mode === 'datetime' && (
        <div className="pt-2 border-t border-slate-200 dark:border-white/10 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-violet-500" />
            <span>الوقت:</span>
          </span>
          <div dir="ltr" className="flex items-center gap-1.5">
            <select
              aria-label="الساعة"
              value={hour}
              onChange={(e) => {
                const nextH = Number(e.target.value);
                setHour(nextH);
                emitValue(selectedDate || today, nextH, minute);
              }}
              className="rounded-lg border border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-[#1a1d25] px-2 py-1 text-xs font-mono-tabular text-slate-900 dark:text-slate-100"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {toEnglishDigits(String(h).padStart(2, '0'))}
                </option>
              ))}
            </select>
            <span className="font-mono-tabular text-xs font-bold">:</span>
            <select
              aria-label="الدقيقة"
              value={minute}
              onChange={(e) => {
                const nextM = Number(e.target.value);
                setMinute(nextM);
                emitValue(selectedDate || today, hour, nextM);
              }}
              className="rounded-lg border border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-[#1a1d25] px-2 py-1 text-xs font-mono-tabular text-slate-900 dark:text-slate-100"
            >
              {Array.from({ length: 60 }, (_, m) => (
                <option key={m} value={m}>
                  {toEnglishDigits(String(m).padStart(2, '0'))}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {hijriHint && (
        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-tabular text-center">
          هجري: {hijriHint}
        </div>
      )}

      {/* Footer Actions */}
      <div className="pt-2 border-t border-slate-200 dark:border-white/10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setViewYear(Number(today.slice(0, 4)));
              setViewMonth(Number(today.slice(5, 7)) - 1);
              handleSelectDay(today);
            }}
            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/15"
          >
            اليوم
          </button>
          {clearable && value && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            >
              مسح
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            if (mode === 'datetime' && !parsedDatePart) {
              emitValue(selectedDate || today, hour, minute);
            }
            setOpen(false);
          }}
          className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
        >
          تأكيد
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative w-full">
      <div className="relative flex items-center">
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-label={ariaLabel || (mode === 'datetime' ? 'اختيار التاريخ والوقت' : 'اختيار التاريخ')}
          onClick={() => {
            if (!disabled) setOpen((prev) => !prev);
          }}
          className={`w-full flex items-center justify-between gap-2 text-right rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] px-3 py-2 text-sm font-mono-tabular text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${className}`}
        >
          <span
            dir="ltr"
            className={`truncate ${
              displayText ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400'
            }`}
          >
            {displayText || placeholder || (mode === 'datetime' ? 'YYYY-MM-DD · HH:mm' : 'YYYY-MM-DD')}
          </span>
          <span className="flex items-center gap-1 shrink-0 text-slate-400">
            {clearable && value && !disabled && (
              <span
                role="button"
                tabIndex={-1}
                aria-label="مسح التاريخ"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange('');
                }}
                className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-white/15 text-slate-500"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
            <Calendar className="w-4 h-4" />
          </span>
        </button>
      </div>

      {open &&
        (coords.isMobile ? (
          <div
            className="fixed inset-0 z-[80] bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setOpen(false)}
          >
            <div onClick={(e) => e.stopPropagation()}>{popoverBody}</div>
          </div>
        ) : (
          <div
            style={{ position: 'fixed', top: coords.top, left: coords.left, zIndex: 80 }}
          >
            {popoverBody}
          </div>
        ))}
    </div>
  );
};

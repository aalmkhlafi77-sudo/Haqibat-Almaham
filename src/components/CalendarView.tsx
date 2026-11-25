import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Share2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  formatDateTime,
  formatDisplayDate,
  formatHijriDate,
  getTodayISO,
} from '../domain/dateUtils';
import { RecordType } from '../types/domain';
import { StatusBadge } from './StatusBadge';

interface CalendarEntry {
  id: string;
  dateISO: string;
  title: string;
  kindLabel: string;
  recordType: RecordType;
  recordId: string;
  tone: 'info' | 'purple' | 'warning' | 'gold' | 'danger';
  timeText?: string;
  specialistId: string | null;
}

export const CalendarView: React.FC = () => {
  const { db, openRecord, openShareModal, setShowHijri } = useApp();
  const today = getTodayISO();
  const showHijri = db.preferences.showHijri;

  const [viewDate, setViewDate] = useState(() => {
    const [y, m] = today.split('-').map(Number);
    return { year: y, month: m - 1 }; // 0-indexed month
  });
  const [selectedDay, setSelectedDay] = useState<string>(today);

  const entries = useMemo(() => {
    const list: CalendarEntry[] = [];

    for (const s of db.sessions) {
      list.push({
        id: `sess-${s.id}`,
        dateISO: s.scheduledAt.slice(0, 10),
        title: s.title,
        kindLabel: 'جلسة',
        recordType: 'session',
        recordId: s.id,
        tone: 'purple',
        timeText: s.scheduledAt.slice(11, 16),
        specialistId: s.specialistId,
      });
    }

    for (const t of db.tasks) {
      if (t.archivedAt) continue;
      list.push({
        id: `task-${t.id}`,
        dateISO: t.dueDate,
        title: t.title,
        kindLabel: `مهمة (${t.type})`,
        recordType: 'task',
        recordId: t.id,
        tone: 'info',
        specialistId: t.specialistId,
      });
    }

    for (const d of db.documents) {
      if (d.archivedAt || !d.expiryDate) continue;
      list.push({
        id: `doc-${d.id}`,
        dateISO: d.expiryDate,
        title: `انتهاء: ${d.name}`,
        kindLabel: 'استحقاق وثيقة',
        recordType: 'document',
        recordId: d.id,
        tone: d.expiryDate < today ? 'danger' : 'warning',
        specialistId: d.specialistId,
      });
    }

    for (const p of db.poas) {
      if (p.archivedAt || !p.expiryDate) continue;
      list.push({
        id: `poa-${p.id}`,
        dateISO: p.expiryDate,
        title: `انتهاء وكالة: ${p.title}`,
        kindLabel: 'استحقاق وكالة',
        recordType: 'poa',
        recordId: p.id,
        tone: 'gold',
        specialistId: p.specialistId,
      });
    }

    for (const ci of db.calendarItems) {
      list.push({
        id: `cal-${ci.id}`,
        dateISO: ci.scheduledAt.slice(0, 10),
        title: ci.title,
        kindLabel: ci.kind,
        recordType: 'calendar_item',
        recordId: ci.id,
        tone: 'purple',
        timeText: ci.isAllDay ? undefined : ci.scheduledAt.slice(11, 16),
        specialistId: ci.specialistId,
      });
    }

    return list;
  }, [db.sessions, db.tasks, db.documents, db.poas, db.calendarItems, today]);

  const monthLabel = new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(viewDate.year, viewDate.month, 1));

  const daysInMonth = new Date(viewDate.year, viewDate.month + 1, 0).getDate();
  const firstWeekday = new Date(viewDate.year, viewDate.month, 1).getDay(); // 0=Sun..6=Sat
  // Align week starting Sunday (0)
  const cells: Array<{ day: number | null; iso: string | null }> = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({ day: null, iso: null });
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    const iso = `${viewDate.year}-${String(viewDate.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, iso });
  }

  const prevMonth = () => {
    setViewDate((prev) =>
      prev.month === 0
        ? { year: prev.year - 1, month: 11 }
        : { year: prev.year, month: prev.month - 1 }
    );
  };

  const nextMonth = () => {
    setViewDate((prev) =>
      prev.month === 11
        ? { year: prev.year + 1, month: 0 }
        : { year: prev.year, month: prev.month + 1 }
    );
  };

  const dayEntries = entries.filter((e) => e.dateISO === selectedDay);
  const upcomingEntries = [...entries]
    .filter((e) => e.dateISO >= today)
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO))
    .slice(0, 12);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            <span>التقويم والأحداث والتذكيرات</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            عرض الجلسات والمهام والأحداث والتذكيرات واستحقاقات الوثائق والوكالات
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={showHijri}
              onChange={(e) => setShowHijri(e.target.checked)}
            />
            <span>إظهار التاريخ الهجري</span>
          </label>

          <button
            type="button"
            onClick={() =>
              openRecord('calendar_item', null, {
                scheduledAt: `${selectedDay}T10:00`,
              })
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 text-white hover:bg-violet-700 text-xs font-semibold whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة حدث / تذكير</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Month Grid */}
        <div className="xl:col-span-7 glass-panel rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={prevMonth}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              aria-label="الشهر السابق"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              {monthLabel}
            </div>
            <button
              type="button"
              onClick={nextMonth}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              aria-label="الشهر التالي"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            {['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, idx) => {
              if (!cell.iso || !cell.day) {
                return <div key={`empty-${idx}`} className="h-14 lg:h-16" />;
              }
              const items = entries.filter((e) => e.dateISO === cell.iso);
              const isSelected = selectedDay === cell.iso;
              const isToday = today === cell.iso;
              const hijriDay = showHijri ? formatHijriDate(cell.iso).split(' ')[0] : '';

              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => setSelectedDay(cell.iso!)}
                  className={`h-14 lg:h-16 rounded-xl p-1.5 flex flex-col justify-between text-right border transition-colors ${
                    isSelected
                      ? 'border-violet-600 bg-violet-50/80 dark:bg-violet-950/50 dark:border-violet-400'
                      : isToday
                      ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/30 dark:border-blue-600'
                      : 'border-slate-200/70 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold tabular-nums text-slate-900 dark:text-slate-100">
                      {cell.day}
                    </span>
                    {hijriDay && (
                      <span className="text-[10px] text-slate-400 tabular-nums">{hijriDay}</span>
                    )}
                  </div>
                  {items.length > 0 && (
                    <span className="text-[10px] font-semibold text-violet-700 dark:text-violet-300 truncate">
                      {items.length} {items.length === 1 ? 'موعد' : 'مواعيد'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day + Upcoming Agenda */}
        <div className="xl:col-span-5 space-y-4">
          <div className="glass-panel rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                مواعيد يوم {formatDisplayDate(selectedDay, showHijri)} ({dayEntries.length})
              </h2>
            </div>
            {dayEntries.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                لا توجد مواعيد مسجلة في هذا اليوم.
              </p>
            ) : (
              <div className="space-y-2">
                {dayEntries.map((item) => (
                  <div
                    key={item.id}
                    className="glass-surface-subtle rounded-xl p-3 flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => openRecord(item.recordType, item.recordId)}
                        className="text-right text-sm font-semibold text-slate-900 dark:text-white hover:underline block"
                      >
                        {item.title}
                      </button>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {item.kindLabel} {item.timeText ? `· ${item.timeText}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <StatusBadge label={item.kindLabel} tone={item.tone} />
                      {item.recordType === 'calendar_item' && (
                        <button
                          type="button"
                          onClick={() =>
                            openShareModal({
                              recordType: 'calendar_item',
                              recordId: item.recordId,
                              recordTitle: item.title,
                              specialistId: item.specialistId,
                              scheduledInfo: `${item.dateISO}${item.timeText ? `T${item.timeText}` : ''}`,
                              defaultMessage: `السلام عليكم، تذكير بـ (${item.kindLabel}):\n«${item.title}»\nالتاريخ: ${formatDateTime(
                                `${item.dateISO}${item.timeText ? `T${item.timeText}` : ''}`,
                                showHijri
                              )}`,
                            })
                          }
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                          title="مشاركة مع المختص"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-panel rounded-xl p-4 space-y-2.5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              أقرب المواعيد القادمة ({upcomingEntries.length})
            </h2>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {upcomingEntries.map((item) => (
                <button
                  key={`up-${item.id}`}
                  type="button"
                  onClick={() => openRecord(item.recordType, item.recordId)}
                  className="w-full text-right py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-2 hover:opacity-80"
                >
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {item.title}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                    {formatDisplayDate(item.dateISO, showHijri)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

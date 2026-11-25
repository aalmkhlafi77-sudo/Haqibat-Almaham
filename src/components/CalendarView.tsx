import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Share2,
  Trash2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { resolveTaskTypeName } from '../data/repository';
import {
  evaluateUrgentAlert,
  formatDateTime,
  formatDisplayDate,
  formatGregorianMonthHeader,
  formatHijriDayNumber,
  formatHijriMonthHeader,
  formatTimeFromDateTime,
  getTodayISO,
  getUrgentAlertMotionClass,
  toEnglishDigits,
} from '../domain/dateUtils';
import { RecordType } from '../types/domain';
import { StatusBadge } from './StatusBadge';

type HeatmapCategory = 'tasks' | 'sessions_events' | 'documents' | 'cases_poas';

interface CalendarEntry {
  id: string;
  dateISO: string;
  title: string;
  kindLabel: string;
  recordType: RecordType;
  recordId: string;
  tone: 'info' | 'purple' | 'warning' | 'gold' | 'danger';
  heatCategory: HeatmapCategory;
  timeText?: string;
  specialistId: string | null;
  isTerminal: boolean;
}

const HEATMAP_CATEGORY_META: Record<
  HeatmapCategory,
  { label: string; dotColor: string; glowColor: string; bgTint: string }
> = {
  tasks: {
    label: 'مهام',
    dotColor: '#3b82f6',
    glowColor: 'rgba(59, 130, 246, 0.7)',
    bgTint: 'rgba(59, 130, 246, 0.08)',
  },
  sessions_events: {
    label: 'جلسات وأحداث',
    dotColor: '#8b5cf6',
    glowColor: 'rgba(139, 92, 246, 0.7)',
    bgTint: 'rgba(139, 92, 246, 0.08)',
  },
  documents: {
    label: 'وثائق وتراخيص',
    dotColor: '#14b8a6',
    glowColor: 'rgba(20, 184, 166, 0.7)',
    bgTint: 'rgba(20, 184, 166, 0.08)',
  },
  cases_poas: {
    label: 'وكالات وقضايا',
    dotColor: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.7)',
    bgTint: 'rgba(245, 158, 11, 0.08)',
  },
};

export const CalendarView: React.FC = () => {
  const { db, hasPerm, openRecord, openShareModal, setShowHijri, requestDeleteRecord } = useApp();
  const canWriteRecords = hasPerm('records:write');
  const canDeleteRecords = hasPerm('records:delete');
  const today = getTodayISO();
  const showHijri = db.preferences.showHijri;

  const [viewDate, setViewDate] = useState(() => {
    const [y, m] = today.split('-').map(Number);
    return { year: y, month: m - 1 };
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
        heatCategory: 'sessions_events',
        timeText: formatTimeFromDateTime(s.scheduledAt),
        specialistId: s.specialistId,
        isTerminal: s.status === 'منعقدة' || s.status === 'ملغاة',
      });
    }

    for (const t of db.tasks) {
      if (t.archivedAt) continue;
      list.push({
        id: `task-${t.id}`,
        dateISO: t.dueDate,
        title: t.title,
        kindLabel: `مهمة (${resolveTaskTypeName(t, db.taskTypes)})`,
        recordType: 'task',
        recordId: t.id,
        tone: 'info',
        heatCategory: 'tasks',
        specialistId: t.specialistId,
        isTerminal: t.status === 'مكتملة' || t.status === 'ملغاة',
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
        heatCategory: 'documents',
        specialistId: d.specialistId,
        isTerminal: false,
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
        heatCategory: 'cases_poas',
        specialistId: p.specialistId,
        isTerminal: p.statusOverride === 'مفسوخة',
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
        heatCategory: 'sessions_events',
        timeText: ci.isAllDay ? undefined : formatTimeFromDateTime(ci.scheduledAt),
        specialistId: ci.specialistId,
        isTerminal: ci.isDone,
      });
    }

    return list;
  }, [db.sessions, db.tasks, db.taskTypes, db.documents, db.poas, db.calendarItems, today]);

  const monthLabel = formatGregorianMonthHeader(viewDate.year, viewDate.month);
  const hijriMonthLabel = showHijri
    ? formatHijriMonthHeader(viewDate.year, viewDate.month)
    : '';

  const daysInMonth = new Date(viewDate.year, viewDate.month + 1, 0).getDate();
  const firstWeekday = new Date(viewDate.year, viewDate.month, 1).getDay();

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
            <span>التقويم الحراري والأحداث والتذكيرات</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            توزيع بصري للمهام والجلسات والوثائق والوكالات بأرقام واضحة، مع النقر على أي يوم لعرض سجلاته
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={showHijri}
              onChange={(e) => setShowHijri(e.target.checked)}
            />
            <span>إظهار التاريخ الهجري</span>
          </label>

          {canWriteRecords && (
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
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Heatmap Month Grid */}
        <div className="xl:col-span-7 glass-panel rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={prevMonth}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300"
              aria-label="الشهر السابق"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="text-center">
              <div className="text-sm font-bold text-slate-900 dark:text-white font-mono-tabular">
                {monthLabel}
              </div>
              {hijriMonthLabel && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-tabular mt-0.5">
                  {hijriMonthLabel}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={nextMonth}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300"
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

          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((cell, idx) => {
              if (!cell.iso || !cell.day) {
                return <div key={`empty-${idx}`} className="h-16 lg:h-[72px]" />;
              }
              const items = entries.filter((e) => e.dateISO === cell.iso);
              const isSelected = selectedDay === cell.iso;
              const isToday = today === cell.iso;
              const hijriDay = showHijri ? formatHijriDayNumber(cell.iso) : '';

              // Distinct semantic color dots per day
              const uniqueCats = Array.from(new Set(items.map((x) => x.heatCategory)));
              const primaryCat = uniqueCats[0];
              const heatStyle =
                items.length > 0 && !isSelected && primaryCat
                  ? { backgroundColor: HEATMAP_CATEGORY_META[primaryCat].bgTint }
                  : undefined;

              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => setSelectedDay(cell.iso!)}
                  style={heatStyle}
                  aria-label={`يوم ${toEnglishDigits(String(cell.day))} — ${toEnglishDigits(
                    String(items.length)
                  )} سجلات`}
                  className={`h-16 lg:h-[72px] rounded-xl p-1.5 flex flex-col justify-between text-right border transition-all ${
                    isSelected
                      ? 'border-violet-600 bg-violet-50/90 dark:bg-violet-950/50 dark:border-violet-400 ring-1 ring-violet-500/40'
                      : isToday
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/35 dark:border-blue-400'
                      : 'border-slate-200/80 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between w-full gap-1">
                    <span className="text-xs font-bold font-mono-tabular text-slate-900 dark:text-slate-100">
                      {toEnglishDigits(String(cell.day))}
                    </span>
                    {hijriDay && (
                      <span className="text-[10px] font-mono-tabular text-slate-500 dark:text-slate-400">
                        {hijriDay}
                      </span>
                    )}
                  </div>

                  {items.length > 0 && (
                    <div className="flex items-center justify-between gap-1 w-full">
                      <div className="flex items-center gap-1 min-w-0">
                        {uniqueCats.slice(0, 3).map((cat) => {
                          const meta = HEATMAP_CATEGORY_META[cat];
                          return (
                            <span
                              key={cat}
                              className="w-2.5 h-2.5 rounded-full heatmap-glow-dot shrink-0"
                              style={{
                                backgroundColor: meta.dotColor,
                                boxShadow: `0 0 8px ${meta.glowColor}`,
                              }}
                              title={meta.label}
                            />
                          );
                        })}
                        {uniqueCats.length > 3 && (
                          <span className="text-[9px] font-bold font-mono-tabular text-slate-500 dark:text-slate-300">
                            +{toEnglishDigits(String(uniqueCats.length - 3))}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold font-mono-tabular px-1 rounded bg-slate-900/5 dark:bg-white/10 text-slate-700 dark:text-slate-200 shrink-0">
                        {toEnglishDigits(String(items.length))}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Heatmap Color Legend */}
          <div className="pt-2 border-t border-slate-200/80 dark:border-white/10 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-500 dark:text-slate-400">دلالة النقاط المضيئة:</span>
            {Object.entries(HEATMAP_CATEGORY_META).map(([key, meta]) => (
              <span key={key} className="inline-flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{
                    backgroundColor: meta.dotColor,
                    boxShadow: `0 0 6px ${meta.glowColor}`,
                  }}
                />
                <span>{meta.label}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Selected Day + Upcoming Agenda */}
        <div className="xl:col-span-5 space-y-4">
          <div className="glass-panel rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                مواعيد يوم{' '}
                <span className="font-mono-tabular">{formatDisplayDate(selectedDay, showHijri)}</span>{' '}
                (<span className="font-mono-tabular">{toEnglishDigits(String(dayEntries.length))}</span>)
              </h2>
            </div>

            {dayEntries.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                لا توجد سجلات أو مواعيد مسجلة في هذا اليوم.
              </p>
            ) : (
              <div className="space-y-2">
                {dayEntries.map((item) => {
                  const dotMeta = HEATMAP_CATEGORY_META[item.heatCategory];
                  const urgent = evaluateUrgentAlert(
                    item.dateISO,
                    item.isTerminal,
                    db.preferences.urgentAlertDays,
                    today
                  );
                  const motionClass = getUrgentAlertMotionClass(
                    urgent.isUrgentAlert,
                    db.preferences.urgentAlertMotion
                  );
                  return (
                    <div
                      key={item.id}
                      className="glass-surface-subtle rounded-xl p-3 flex items-start justify-between gap-2"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                          style={{
                            backgroundColor: dotMeta.dotColor,
                            boxShadow: `0 0 6px ${dotMeta.glowColor}`,
                          }}
                        />
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => openRecord(item.recordType, item.recordId)}
                            className="text-right text-sm font-semibold text-slate-900 dark:text-white hover:underline block"
                          >
                            {item.title}
                          </button>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono-tabular">
                            {item.kindLabel} {item.timeText ? `· ${item.timeText}` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {urgent.isUrgentAlert && urgent.badgeText && (
                          <StatusBadge
                            label={urgent.badgeText}
                            tone={
                              urgent.kind === 'overdue'
                                ? 'danger'
                                : urgent.kind === 'today'
                                ? 'today'
                                : 'warning'
                            }
                            icon={urgent.kind === 'overdue' ? 'alert' : 'clock'}
                            motionClass={motionClass}
                          />
                        )}
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
                                scheduledInfo: `${item.dateISO}${
                                  item.timeText ? `T${item.timeText}` : ''
                                }`,
                                defaultMessage: `السلام عليكم، تذكير بـ (${item.kindLabel}):\n«${item.title}»\nالتاريخ: ${formatDateTime(
                                  `${item.dateISO}${item.timeText ? `T${item.timeText}` : ''}`,
                                  showHijri
                                )}`,
                              })
                            }
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-white/15 text-slate-600 dark:text-slate-300"
                            title="مشاركة مع المختص"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {item.recordType === 'calendar_item' && canDeleteRecords && (
                          <button
                            type="button"
                            onClick={() => requestDeleteRecord('calendar_item', item.recordId)}
                            className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                            title="حذف التذكير أو الحدث"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="glass-panel rounded-xl p-4 space-y-2.5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              أقرب المواعيد القادمة (
              <span className="font-mono-tabular">{toEnglishDigits(String(upcomingEntries.length))}</span>)
            </h2>
            <div className="space-y-1.5">
              {upcomingEntries.map((item) => {
                const urgent = evaluateUrgentAlert(
                  item.dateISO,
                  item.isTerminal,
                  db.preferences.urgentAlertDays,
                  today
                );
                const motionClass = getUrgentAlertMotionClass(
                  urgent.isUrgentAlert,
                  db.preferences.urgentAlertMotion
                );
                return (
                  <button
                    key={`up-${item.id}`}
                    type="button"
                    onClick={() => openRecord(item.recordType, item.recordId)}
                    className="w-full text-right px-2.5 py-2 rounded-lg flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-white/5"
                  >
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate flex items-center gap-2 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: HEATMAP_CATEGORY_META[item.heatCategory].dotColor }}
                      />
                      <span className="truncate">{item.title}</span>
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {urgent.isUrgentAlert && urgent.badgeText && (
                        <StatusBadge
                          label={urgent.badgeText}
                          tone={urgent.kind === 'today' ? 'today' : 'warning'}
                          icon="clock"
                          motionClass={motionClass}
                        />
                      )}
                      <span className="text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400">
                        {formatDisplayDate(item.dateISO, showHijri)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckSquare,
  ChevronsDownUp,
  ChevronsUpDown,
  FileText,
  Gavel,
  Plus,
  StickyNote,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  resolveDocumentCategoryName,
  resolveTaskTypeName,
} from '../data/repository';
import {
  evaluateDocumentHealth,
  evaluateTaskDelay,
  evaluateUrgentAlert,
  formatDateTime,
  formatDisplayDate,
  getTodayISO,
  getUrgentAlertMotionClass,
} from '../domain/dateUtils';
import { CollapsibleSection } from './CollapsibleSection';
import { LabelsSection } from './LabelsSection';
import { StatusBadge } from './StatusBadge';

const TODAY_SECTION_KEYS = [
  'today_next_session',
  'today_due',
  'today_overdue',
  'today_documents',
  'today_labels',
];

export const TodayView: React.FC = () => {
  const { db, openRecord, setSectionsCollapsed, setActiveNav } = useApp();
  const today = getTodayISO();
  const showHijri = db.preferences.showHijri;
  const warningDays = db.preferences.documentWarningDays;

  const getSpecialistName = (id: string | null | undefined) =>
    db.specialists.find((s) => s.id === id)?.name || 'غير مسند';

  // 1. Closest upcoming scheduled session
  const upcomingSessions = db.sessions
    .filter((s) => s.status === 'مجدولة' && s.scheduledAt.slice(0, 10) >= today)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const closestSession = upcomingSessions[0] || null;
  const closestSessionCase = closestSession
    ? db.cases.find((c) => c.id === closestSession.caseId)
    : null;

  // 2. Due today (open tasks due today + sessions today + calendar events/reminders today)
  const tasksDueToday = db.tasks.filter(
    (t) =>
      !t.archivedAt &&
      t.status !== 'مكتملة' &&
      t.status !== 'ملغاة' &&
      t.dueDate === today
  );
  const sessionsToday = db.sessions.filter(
    (s) => s.status === 'مجدولة' && s.scheduledAt.slice(0, 10) === today
  );
  const calendarToday = db.calendarItems.filter(
    (ci) => !ci.isDone && ci.scheduledAt.slice(0, 10) === today
  );
  const dueTodayCount = tasksDueToday.length + sessionsToday.length + calendarToday.length;

  // 3. Overdue tasks
  const overdueTasks = db.tasks
    .filter((t) => !t.archivedAt && evaluateTaskDelay(t, today).isOverdue)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  // 4. Documents needing follow-up (expiring today, expiring soon, expired, no expiry date)
  const followUpDocs = db.documents
    .map((doc) => ({
      doc,
      health: evaluateDocumentHealth(doc, warningDays, today),
    }))
    .filter((x) => x.health.needsFollowUp)
    .sort((a, b) => {
      const da = a.health.daysRemaining ?? 9999;
      const dbv = b.health.daysRemaining ?? 9999;
      return da - dbv;
    });

  const todayLabelsCount = db.labels.filter((l) => l.targetType === 'today').length;

  const allCollapsed = TODAY_SECTION_KEYS.every(
    (k) => db.preferences.collapsedSections[k]
  );

  return (
    <div className="space-y-4">
      {/* Compact Workspace Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white">
            اليوم — {formatDisplayDate(today, showHijri)}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            مساحة العمل اليومية: المتأخرات، استحقاقات اليوم، أقرب جلسة، ومتابعة الوثائق
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSectionsCollapsed(TODAY_SECTION_KEYS, !allCollapsed)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            {allCollapsed ? (
              <>
                <ChevronsUpDown className="w-3.5 h-3.5" />
                <span>فتح الكل</span>
              </>
            ) : (
              <>
                <ChevronsDownUp className="w-3.5 h-3.5" />
                <span>طي الكل</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => openRecord('task', null)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>مهمة جديدة</span>
          </button>

          <button
            type="button"
            onClick={() => openRecord('calendar_item', null)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-violet-300 dark:border-violet-700/70 bg-violet-50/70 dark:bg-violet-950/40 text-violet-800 dark:text-violet-200 hover:bg-violet-100 dark:hover:bg-violet-900/50 text-xs font-semibold whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>حدث / تذكير</span>
          </button>
        </div>
      </div>

      {/* Main Two-Column Action Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        <div className="xl:col-span-7 space-y-4">
          {/* Overdue Tasks */}
          <CollapsibleSection
            sectionKey="today_overdue"
            title="المهام المتأخرة"
            count={overdueTasks.length}
            tone="tasks"
            icon={<AlertTriangle className="w-4 h-4" />}
            headerAction={
              <button
                type="button"
                onClick={() => setActiveNav('tasks')}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
              >
                عرض المهام
              </button>
            }
          >
            {overdueTasks.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                لا توجد مهام متأخرة حاليًا.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {overdueTasks.map((task) => {
                  const delay = evaluateTaskDelay(task, today);
                  const isTerminal =
                    task.status === 'مكتملة' || task.status === 'ملغاة' || !!task.archivedAt;
                  const urgent = evaluateUrgentAlert(
                    task.dueDate,
                    isTerminal,
                    db.preferences.urgentAlertDays,
                    today
                  );
                  const motionClass = getUrgentAlertMotionClass(
                    urgent.isUrgentAlert,
                    db.preferences.urgentAlertMotion
                  );
                  return (
                    <div
                      key={task.id}
                      className={`py-2.5 px-2 first:pt-2 last:pb-2 flex flex-wrap items-center justify-between gap-2 border border-transparent rounded-xl ${motionClass}`}
                    >
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => openRecord('task', task.id)}
                          className="text-right font-semibold text-sm text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 hover:underline block truncate max-w-full"
                        >
                          {task.title}
                        </button>
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span>{resolveTaskTypeName(task, db.taskTypes)}</span>
                          <span>·</span>
                          <span>{getSpecialistName(task.specialistId)}</span>
                          <span>·</span>
                          <span>الموعد: {formatDisplayDate(task.dueDate, showHijri)}</span>
                        </div>
                      </div>
                      <StatusBadge label={delay.label || 'متأخرة'} tone="danger" icon="alert" />
                    </div>
                  );
                })}
              </div>
            )}
          </CollapsibleSection>

          {/* Due Today */}
          <CollapsibleSection
            sectionKey="today_due"
            title="ما يستحق اليوم"
            count={dueTodayCount}
            tone="tasks"
            icon={<CheckSquare className="w-4 h-4" />}
          >
            {dueTodayCount === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                لا توجد مهام أو تذكيرات مستحقة بتاريخ اليوم.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {tasksDueToday.map((task) => {
                  const urgent = evaluateUrgentAlert(
                    task.dueDate,
                    false,
                    db.preferences.urgentAlertDays,
                    today
                  );
                  const motionClass = getUrgentAlertMotionClass(
                    urgent.isUrgentAlert,
                    db.preferences.urgentAlertMotion
                  );
                  return (
                    <div
                      key={task.id}
                      className={`py-2.5 px-2 first:pt-2 last:pb-2 flex flex-wrap items-center justify-between gap-2 border border-transparent rounded-xl ${motionClass}`}
                    >
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => openRecord('task', task.id)}
                          className="text-right font-semibold text-sm text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 hover:underline block truncate max-w-full"
                        >
                          {task.title}
                        </button>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          مهمة {resolveTaskTypeName(task, db.taskTypes)} ·{' '}
                          {getSpecialistName(task.specialistId)} · الأولوية: {task.priority}
                        </div>
                      </div>
                      <StatusBadge label="تستحق اليوم" tone="info" icon="clock" />
                    </div>
                  );
                })}

                {sessionsToday.map((sess) => {
                  const urgent = evaluateUrgentAlert(
                    sess.scheduledAt,
                    false,
                    db.preferences.urgentAlertDays,
                    today
                  );
                  const motionClass = getUrgentAlertMotionClass(
                    urgent.isUrgentAlert,
                    db.preferences.urgentAlertMotion
                  );
                  return (
                    <div
                      key={sess.id}
                      className={`py-2.5 px-2 first:pt-2 last:pb-2 flex flex-wrap items-center justify-between gap-2 border border-transparent rounded-xl ${motionClass}`}
                    >
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => openRecord('session', sess.id)}
                          className="text-right font-semibold text-sm text-slate-900 dark:text-slate-100 hover:text-violet-600 dark:hover:text-violet-400 hover:underline block truncate max-w-full"
                        >
                          {sess.title}
                        </button>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          جلسة · {formatDateTime(sess.scheduledAt, showHijri)} · {getSpecialistName(sess.specialistId)}
                        </div>
                      </div>
                      <StatusBadge label="جلسة اليوم" tone="purple" icon="gavel" />
                    </div>
                  );
                })}

                {calendarToday.map((ci) => {
                  const urgent = evaluateUrgentAlert(
                    ci.scheduledAt,
                    false,
                    db.preferences.urgentAlertDays,
                    today
                  );
                  const motionClass = getUrgentAlertMotionClass(
                    urgent.isUrgentAlert,
                    db.preferences.urgentAlertMotion
                  );
                  return (
                    <div
                      key={ci.id}
                      className={`py-2.5 px-2 first:pt-2 last:pb-2 flex flex-wrap items-center justify-between gap-2 border border-transparent rounded-xl ${motionClass}`}
                    >
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => openRecord('calendar_item', ci.id)}
                          className="text-right font-semibold text-sm text-slate-900 dark:text-slate-100 hover:text-violet-600 dark:hover:text-violet-400 hover:underline block truncate max-w-full"
                        >
                          {ci.title}
                        </button>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {ci.kind} · {formatDateTime(ci.scheduledAt, showHijri)} · {getSpecialistName(ci.specialistId)}
                        </div>
                      </div>
                      <StatusBadge label={`${ci.kind} اليوم`} tone="purple" icon="clock" />
                    </div>
                  );
                })}
              </div>
            )}
          </CollapsibleSection>

          {/* Documents Needing Follow-Up */}
          <CollapsibleSection
            sectionKey="today_documents"
            title="الوثائق التي تحتاج متابعة"
            count={followUpDocs.length}
            tone="documents"
            icon={<FileText className="w-4 h-4" />}
            headerAction={
              <button
                type="button"
                onClick={() => setActiveNav('documents')}
                className="text-xs font-medium text-teal-600 dark:text-teal-400 hover:underline whitespace-nowrap"
              >
                كل الوثائق
              </button>
            }
          >
            {followUpDocs.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                جميع الوثائق النشطة سارية خارج نافذة التنبيه.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {followUpDocs.map(({ doc, health }) => {
                  const badgeTone =
                    health.category === 'منتهية'
                      ? 'danger'
                      : health.category === 'تنتهي اليوم'
                      ? 'today'
                      : health.category === 'قريبة الانتهاء'
                      ? 'warning'
                      : 'neutral';
                  const urgent = evaluateUrgentAlert(
                    doc.expiryDate,
                    !!doc.archivedAt,
                    db.preferences.urgentAlertDays,
                    today
                  );
                  const motionClass = getUrgentAlertMotionClass(
                    urgent.isUrgentAlert,
                    db.preferences.urgentAlertMotion
                  );
                  return (
                    <div
                      key={doc.id}
                      className={`py-2.5 px-2 first:pt-2 last:pb-2 flex flex-wrap items-center justify-between gap-2 border border-transparent rounded-xl ${motionClass}`}
                    >
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => openRecord('document', doc.id)}
                          className="text-right font-semibold text-sm text-slate-900 dark:text-slate-100 hover:text-teal-600 dark:hover:text-teal-400 hover:underline block truncate max-w-full"
                        >
                          {doc.name}
                        </button>
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span className="font-semibold text-teal-700 dark:text-teal-300">
                            {resolveDocumentCategoryName(doc, db.documentCategories)}
                          </span>
                          <span>·</span>
                          <span>{doc.issuingAuthority}</span>
                          <span>·</span>
                          <span>المسؤول: {getSpecialistName(doc.specialistId)}</span>
                          <span>·</span>
                          <span>
                            الانتهاء:{' '}
                            {doc.expiryDate
                              ? formatDisplayDate(doc.expiryDate, showHijri)
                              : 'بلا تاريخ'}
                          </span>
                        </div>
                      </div>
                      <StatusBadge
                        label={health.badgeText}
                        tone={badgeTone}
                        icon={health.category === 'منتهية' ? 'alert' : 'clock'}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </CollapsibleSection>
        </div>

        {/* Secondary Column: Closest Session + Labels */}
        <div className="xl:col-span-5 space-y-4">
          <CollapsibleSection
            sectionKey="today_next_session"
            title="أقرب جلسة قادمة"
            count={upcomingSessions.length}
            tone="sessions"
            icon={<Gavel className="w-4 h-4" />}
            headerAction={
              <button
                type="button"
                onClick={() => setActiveNav('cases')}
                className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline whitespace-nowrap"
              >
                القضايا والجلسات
              </button>
            }
          >
            {!closestSession ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                لا توجد جلسات مجدولة قادمة.
              </p>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const sessUrgent = evaluateUrgentAlert(
                    closestSession.scheduledAt,
                    false,
                    db.preferences.urgentAlertDays,
                    today
                  );
                  const sessMotion = getUrgentAlertMotionClass(
                    sessUrgent.isUrgentAlert,
                    db.preferences.urgentAlertMotion
                  );
                  return (
                    <div className={`glass-surface-subtle rounded-xl p-3.5 space-y-2 ${sessMotion}`}>
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => openRecord('session', closestSession.id)}
                          className="text-right font-bold text-sm text-slate-900 dark:text-white hover:text-violet-600 dark:hover:text-violet-400 hover:underline"
                        >
                          {closestSession.title}
                        </button>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {sessUrgent.isUrgentAlert && sessUrgent.badgeText && (
                            <StatusBadge
                              label={sessUrgent.badgeText}
                              tone={sessUrgent.kind === 'today' ? 'today' : 'warning'}
                              icon="clock"
                            />
                          )}
                          <StatusBadge label={closestSession.status} tone="purple" icon="gavel" />
                        </div>
                      </div>

                  {closestSessionCase && (
                    <button
                      type="button"
                      onClick={() => openRecord('case', closestSessionCase.id)}
                      className="text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline block"
                    >
                      القضية: {closestSessionCase.title} (رقم {closestSessionCase.caseNumber})
                    </button>
                  )}

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <CalendarClock className="w-3.5 h-3.5 text-violet-500" />
                    <span>{formatDateTime(closestSession.scheduledAt, showHijri)}</span>
                    {closestSession.location && (
                      <>
                        <span>·</span>
                        <span>{closestSession.location}</span>
                      </>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    المختص: {getSpecialistName(closestSession.specialistId)}
                  </div>
                    </div>
                  );
                })()}

                {upcomingSessions.length > 1 && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      جلسات قادمة أخرى:
                    </span>
                    {upcomingSessions.slice(1, 4).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => openRecord('session', s.id)}
                        className="w-full text-right px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/70 flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                          {s.title}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 shrink-0">
                          {formatDateTime(s.scheduledAt, showHijri)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            sectionKey="today_labels"
            title="ملصقات اليوم والملاحظات"
            count={todayLabelsCount}
            icon={<StickyNote className="w-4 h-4" />}
          >
            <LabelsSection targetType="today" targetId={null} />
          </CollapsibleSection>
        </div>
      </div>
    </div>
  );
};

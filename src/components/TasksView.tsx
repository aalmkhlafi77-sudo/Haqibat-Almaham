import React, { useMemo } from 'react';
import { CheckSquare, Plus, RotateCcw, Search, Share2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { resolveTaskType, resolveTaskTypeName } from '../data/repository';
import {
  evaluateTaskDelay,
  evaluateUrgentAlert,
  formatDisplayDate,
  getTodayISO,
  getUrgentAlertMotionClass,
} from '../domain/dateUtils';
import { scoreArabicSearchMatch } from '../domain/searchUtils';
import { TaskItem, TaskStatus } from '../types/domain';
import { StatusBadge } from './StatusBadge';

export const TasksView: React.FC = () => {
  const { db, hasPerm, updateTaskFilters, openRecord, openShareModal } = useApp();
  const canWriteRecords = hasPerm('records:write');
  const filters = db.preferences.taskFilters;
  const today = getTodayISO();
  const showHijri = db.preferences.showHijri;

  const getSpecialistName = (id: string | null) =>
    db.specialists.find((s) => s.id === id)?.name || 'غير مسند';

  const filteredTasks = useMemo(() => {
    const q = filters.search.trim();
    return db.tasks
      .map((t) => {
        if (t.archivedAt) return null;
        if (filters.onlyMine && t.specialistId !== db.preferences.currentSpecialistId) {
          return null;
        }
        if (filters.type !== 'الكل' && t.typeId !== filters.type) return null;
        if (filters.status === 'المفتوحة') {
          if (t.status === 'مكتملة' || t.status === 'ملغاة') return null;
        } else if (filters.status !== 'الكل' && t.status !== filters.status) {
          return null;
        }
        if (filters.specialistId !== 'الكل' && t.specialistId !== filters.specialistId) {
          return null;
        }
        if (filters.dueFilter === 'اليوم' && t.dueDate !== today) return null;
        if (filters.dueFilter === 'متأخرة' && !evaluateTaskDelay(t, today).isOverdue) {
          return null;
        }
        if (
          filters.dueFilter === 'قادمة' &&
          !(t.dueDate > today && t.status !== 'مكتملة' && t.status !== 'ملغاة')
        ) {
          return null;
        }
        const typeLabel = resolveTaskTypeName(t, db.taskTypes);
        const score = q
          ? scoreArabicSearchMatch(q, t.title, [
              t.departmentName,
              t.letterNumber,
              t.authorityName,
              typeLabel,
              t.status,
              t.notes,
              getSpecialistName(t.specialistId),
            ])
          : 1;
        if (score <= 0) return null;
        return { t, score };
      })
      .filter((x): x is { t: TaskItem; score: number } => x !== null)
      .sort((a, b) =>
        q && b.score !== a.score
          ? b.score - a.score
          : a.t.dueDate.localeCompare(b.t.dueDate)
      )
      .map((x) => x.t);
  }, [db.tasks, db.taskTypes, db.specialists, db.preferences.currentSpecialistId, filters, today]);

  const currentSpecName = getSpecialistName(db.preferences.currentSpecialistId);

  const resetFilters = () => {
    updateTaskFilters({
      onlyMine: false,
      type: 'الكل',
      status: 'الكل',
      dueFilter: 'الكل',
      specialistId: 'الكل',
      search: '',
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>المهام</span>
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400 tabular-nums">
              ({filteredTasks.length})
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            إدارة المهام القضائية والإدارية ومهام التجديد مع احتساب التأخر للمهام المفتوحة والمكتملة
          </p>
        </div>

        {canWriteRecords && (
          <button
            type="button"
            onClick={() => openRecord('task', null)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>مهمة جديدة</span>
          </button>
        )}
      </div>

      {/* Persistent Filters Bar */}
      <div className="glass-panel rounded-xl p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/70">
            <button
              type="button"
              onClick={() => updateTaskFilters({ onlyMine: false })}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                !filters.onlyMine
                  ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              جميع المهام
            </button>
            <button
              type="button"
              onClick={() => updateTaskFilters({ onlyMine: true })}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                filters.onlyMine
                  ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              مهامي ({currentSpecName})
            </button>
          </div>

          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>إعادة ضبط الفلاتر</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3" />
            <input
              type="search"
              value={filters.search}
              onChange={(e) => updateTaskFilters({ search: e.target.value })}
              placeholder="بحث بالعنوان أو رقم الخطاب..."
              className="w-full h-9 pr-8 pl-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100"
            />
          </div>

          <select
            aria-label="فلتر نوع المهمة"
            value={filters.type}
            onChange={(e) => updateTaskFilters({ type: e.target.value })}
            className="h-9 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100"
          >
            <option value="الكل">النوع: الكل</option>
            {db.taskTypes.map((tt) => (
              <option key={tt.id} value={tt.id}>
                {tt.name}
              </option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) =>
              updateTaskFilters({ status: e.target.value as 'الكل' | 'المفتوحة' | TaskStatus })
            }
            className="h-9 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100"
          >
            <option value="الكل">الحالة: الكل</option>
            <option value="المفتوحة">المفتوحة فقط</option>
            <option value="جديدة">جديدة</option>
            <option value="قيد التنفيذ">قيد التنفيذ</option>
            <option value="معلقة">معلقة</option>
            <option value="مكتملة">مكتملة</option>
            <option value="ملغاة">ملغاة</option>
          </select>

          <select
            value={filters.dueFilter}
            onChange={(e) =>
              updateTaskFilters({
                dueFilter: e.target.value as 'الكل' | 'اليوم' | 'متأخرة' | 'قادمة',
              })
            }
            className="h-9 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100"
          >
            <option value="الكل">الموعد: الكل</option>
            <option value="متأخرة">متأخرة</option>
            <option value="اليوم">تستحق اليوم</option>
            <option value="قادمة">قادمة</option>
          </select>

          <select
            value={filters.specialistId}
            onChange={(e) => updateTaskFilters({ specialistId: e.target.value })}
            className="h-9 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100"
          >
            <option value="الكل">المختص: الكل</option>
            {db.specialists.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tasks List */}
      <div className="glass-panel rounded-xl overflow-hidden">
        {filteredTasks.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              لا توجد مهام مطابقة لمعايير التصفية الحالية.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              عرض جميع المهام
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {filteredTasks.map((task) => {
              const delay = evaluateTaskDelay(task, today);
              const typeObj = resolveTaskType(task, db.taskTypes);
              const typeName = typeObj?.name || task.type;
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
              const taskLabels = db.labels.filter(
                (l) => l.targetType === 'task' && l.targetId === task.id
              );

              return (
                <div
                  key={task.id}
                  className="p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/35 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openRecord('task', task.id)}
                        className="text-right font-bold text-sm lg:text-base text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                      >
                        {task.title}
                      </button>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-semibold text-blue-700 dark:text-blue-300">
                        {typeName}
                      </span>
                      <span>·</span>
                      <span>المختص: {getSpecialistName(task.specialistId)}</span>
                      <span>·</span>
                      <span>القسم: {task.departmentName}</span>
                      <span>·</span>
                      <span>الأولوية: {task.priority}</span>
                      <span>·</span>
                      <span>الموعد: {formatDisplayDate(task.dueDate, showHijri)}</span>
                      {task.actualDeliveryDate && (
                        <>
                          <span>·</span>
                          <span>
                            التسليم الفعلي: {formatDisplayDate(task.actualDeliveryDate, showHijri)}
                          </span>
                        </>
                      )}
                    </div>

                    {(typeObj?.isAdminKind || task.type === 'إدارية' || task.letterNumber || task.authorityName) &&
                      (task.letterNumber || task.authorityName) && (
                        <div className="text-xs text-slate-600 dark:text-slate-300">
                          خطاب: {task.letterNumber || '—'} · الجهة: {task.authorityName || '—'}
                          {task.receivedDate
                            ? ` · تاريخ الاستلام: ${formatDisplayDate(task.receivedDate, showHijri)}`
                            : ''}
                        </div>
                      )}

                    {taskLabels.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {taskLabels.map((lbl) => (
                          <span
                            key={lbl.id}
                            style={{ backgroundColor: lbl.bgColor, color: lbl.textColor }}
                            className="px-2 py-0.5 rounded text-[11px] font-medium border border-black/10"
                          >
                            {lbl.text}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <StatusBadge
                      label={task.status}
                      tone={
                        task.status === 'مكتملة'
                          ? 'success'
                          : task.status === 'معلقة'
                          ? 'warning'
                          : task.status === 'ملغاة'
                          ? 'neutral'
                          : 'info'
                      }
                      icon={
                        task.status === 'مكتملة'
                          ? 'check'
                          : task.status === 'معلقة'
                          ? 'pause'
                          : task.status === 'ملغاة'
                          ? 'cancel'
                          : 'clock'
                      }
                    />
                    {delay.label ? (
                      <StatusBadge
                        label={delay.label}
                        tone={delay.isOverdue ? 'danger' : 'warning'}
                        icon="alert"
                        motionClass={delay.isOverdue ? motionClass : ''}
                      />
                    ) : urgent.isUrgentAlert && urgent.badgeText ? (
                      <StatusBadge
                        label={urgent.badgeText}
                        tone={urgent.kind === 'today' ? 'today' : 'warning'}
                        icon="clock"
                        motionClass={motionClass}
                      />
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        openShareModal({
                          recordType: 'task',
                          recordId: task.id,
                          recordTitle: task.title,
                          specialistId: task.specialistId,
                          scheduledInfo: task.dueDate,
                          defaultMessage: `السلام عليكم، نرجو متابعة المهمة (${typeName}):\n«${task.title}»\nالموعد: ${formatDisplayDate(task.dueDate, showHijri)}`,
                        })
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>مشاركة</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

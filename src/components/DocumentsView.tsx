import React, { useMemo } from 'react';
import { FileText, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { resolveDocumentCategoryName } from '../data/repository';
import {
  evaluateDocumentHealth,
  evaluateUrgentAlert,
  formatDisplayDate,
  getTodayISO,
  getUrgentAlertMotionClass,
} from '../domain/dateUtils';
import { scoreArabicSearchMatch } from '../domain/searchUtils';
import { DocumentCategoryFilter } from '../types/domain';
import { StatusBadge } from './StatusBadge';

const CATEGORIES: DocumentCategoryFilter[] = [
  'الكل',
  'قريبة الانتهاء',
  'منتهية',
  'سارية',
  'بلا تاريخ',
  'مؤرشفة',
];

export const DocumentsView: React.FC = () => {
  const {
    db,
    hasPerm,
    updateDocumentFilters,
    setDocumentWarningDays,
    openRecord,
    requestDeleteRecord,
  } = useApp();
  const canWriteRecords = hasPerm('records:write');
  const canDeleteRecords = hasPerm('records:delete');
  const filters = db.preferences.documentFilters;
  const warningDays = db.preferences.documentWarningDays;
  const today = getTodayISO();
  const showHijri = db.preferences.showHijri;

  const getSpecialistName = (id: string | null) =>
    db.specialists.find((s) => s.id === id)?.name || 'غير مسند';

  const evaluatedDocs = useMemo(
    () =>
      db.documents.map((doc) => ({
        doc,
        categoryName: resolveDocumentCategoryName(doc, db.documentCategories),
        health: evaluateDocumentHealth(doc, warningDays, today),
      })),
    [db.documents, db.documentCategories, warningDays, today]
  );

  // Validity counts reflect the currently selected category & specialist filters (independent filters)
  const counts = useMemo(() => {
    const scoped = evaluatedDocs.filter(({ doc }) => {
      if (filters.categoryId === '__uncategorized__' && doc.categoryId !== null) {
        return false;
      }
      if (
        filters.categoryId !== 'الكل' &&
        filters.categoryId !== '__uncategorized__' &&
        doc.categoryId !== filters.categoryId
      ) {
        return false;
      }
      if (filters.specialistId !== 'الكل' && doc.specialistId !== filters.specialistId) {
        return false;
      }
      return true;
    });
    const map: Record<DocumentCategoryFilter, number> = {
      الكل: scoped.filter((x) => !x.doc.archivedAt).length,
      سارية: 0,
      'قريبة الانتهاء': 0,
      منتهية: 0,
      'بلا تاريخ': 0,
      مؤرشفة: 0,
    };
    for (const item of scoped) {
      map[item.health.filterBucket] += 1;
    }
    return map;
  }, [evaluatedDocs, filters.categoryId, filters.specialistId]);

  const filteredDocs = useMemo(() => {
    const q = filters.search.trim();
    return evaluatedDocs
      .map(({ doc, categoryName, health }) => {
        if (filters.category === 'الكل') {
          if (doc.archivedAt) return null;
        } else if (health.filterBucket !== filters.category) {
          return null;
        }
        if (filters.categoryId === '__uncategorized__') {
          if (doc.categoryId !== null) return null;
        } else if (filters.categoryId !== 'الكل' && doc.categoryId !== filters.categoryId) {
          return null;
        }
        if (filters.specialistId !== 'الكل' && doc.specialistId !== filters.specialistId) {
          return null;
        }
        const score = q
          ? scoreArabicSearchMatch(q, doc.name, [
              categoryName,
              doc.referenceNumber,
              doc.issuingAuthority,
              doc.notes,
              getSpecialistName(doc.specialistId),
            ])
          : 1;
        if (score <= 0) return null;
        return { doc, categoryName, health, score };
      })
      .filter(
        (
          x
        ): x is {
          doc: (typeof evaluatedDocs)[number]['doc'];
          categoryName: string;
          health: (typeof evaluatedDocs)[number]['health'];
          score: number;
        } => x !== null
      )
      .sort((a, b) => (q ? b.score - a.score : 0))
      .map(({ doc, categoryName, health }) => ({ doc, categoryName, health }));
  }, [evaluatedDocs, filters, db.specialists]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <span>الوثائق والتراخيص والتجديدات</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            تمييز الانتهاء اليوم عن المنتهية سابقًا، ومتابعة الوثائق بلا تاريخ وسجل التجديدات
          </p>
        </div>

        {canWriteRecords && (
          <button
            type="button"
            onClick={() => openRecord('document', null)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700 text-xs font-semibold whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>وثيقة جديدة</span>
          </button>
        )}
      </div>

      {/* Category Filter Tabs + Warning Window Setting */}
      <div className="glass-panel rounded-xl p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => {
              const active = filters.category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => updateDocumentFilters({ category: cat })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {cat} ({counts[cat]})
                </button>
              );
            })}
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span>نافذة قرب الانتهاء (بالأيام):</span>
            <input
              type="number"
              min={1}
              max={180}
              value={warningDays}
              onChange={(e) => {
                const v = Math.max(1, Math.min(180, Number(e.target.value) || 30));
                setDocumentWarningDays(v);
              }}
              className="w-16 h-8 px-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-center font-mono-tabular text-xs"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3" />
            <input
              type="search"
              value={filters.search}
              onChange={(e) => updateDocumentFilters({ search: e.target.value })}
              placeholder="بحث باسم الوثيقة أو المرجع أو التصنيف..."
              className="w-full h-9 pr-8 pl-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100"
            />
          </div>

          <select
            aria-label="فلتر تصنيف الوثيقة"
            value={filters.categoryId}
            onChange={(e) => updateDocumentFilters({ categoryId: e.target.value })}
            className="h-9 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100"
          >
            <option value="الكل">التصنيف: الكل</option>
            {db.documentCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
            <option value="__uncategorized__">غير مصنفة</option>
          </select>

          <select
            value={filters.specialistId}
            onChange={(e) => updateDocumentFilters({ specialistId: e.target.value })}
            className="h-9 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100"
          >
            <option value="الكل">المسؤول: الكل</option>
            {db.specialists.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Documents List */}
      <div className="glass-panel rounded-xl overflow-hidden">
        {filteredDocs.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            لا توجد وثائق مطابقة لحالة الصلاحية والتصنيف المحددين.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {filteredDocs.map(({ doc, categoryName, health }) => {
              const badgeTone =
                health.category === 'منتهية'
                  ? 'danger'
                  : health.category === 'تنتهي اليوم'
                  ? 'today'
                  : health.category === 'قريبة الانتهاء'
                  ? 'warning'
                  : health.category === 'سارية'
                  ? 'success'
                  : health.category === 'مؤرشفة'
                  ? 'neutral'
                  : 'neutral';
              const linkedRenewalCount = db.tasks.filter(
                (t) => t.documentId === doc.id && t.status !== 'مكتملة' && t.status !== 'ملغاة'
              ).length;
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
                  className="p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/35 flex flex-col lg:flex-row lg:items-center justify-between gap-3 transition-colors"
                >
                  <div className="min-w-0 space-y-1 flex-1">
                    <button
                      type="button"
                      onClick={() => openRecord('document', doc.id)}
                      className="text-right font-bold text-sm lg:text-base text-slate-900 dark:text-white hover:text-teal-600 dark:hover:text-teal-400 hover:underline"
                    >
                      {doc.name}
                    </button>

                    <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-semibold text-teal-700 dark:text-teal-300">
                        {categoryName}
                      </span>
                      <span>·</span>
                      <span>المرجع: {doc.referenceNumber}</span>
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
                      {doc.renewals.length > 0 && (
                        <>
                          <span>·</span>
                          <span>
                            سجل التجديدات: {doc.renewals.length} ({categoryName})
                          </span>
                        </>
                      )}
                      {linkedRenewalCount > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-blue-600 dark:text-blue-400 font-medium">
                            مهام تجديد مفتوحة: {linkedRenewalCount}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {urgent.isUrgentAlert && urgent.badgeText && health.category === 'سارية' && (
                      <StatusBadge
                        label={urgent.badgeText}
                        tone="warning"
                        icon="clock"
                        motionClass={motionClass}
                      />
                    )}
                    <StatusBadge
                      label={health.badgeText}
                      tone={badgeTone}
                      icon={
                        health.category === 'منتهية'
                          ? 'alert'
                          : health.category === 'سارية'
                          ? 'doc'
                          : health.category === 'مؤرشفة'
                          ? 'archive'
                          : 'clock'
                      }
                      motionClass={health.category !== 'سارية' ? motionClass : ''}
                    />
                    <button
                      type="button"
                      onClick={() => openRecord('document', doc.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-teal-200 dark:border-teal-800 text-xs font-medium text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/60"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>تفاصيل وتجديد</span>
                    </button>
                    {canDeleteRecords && (
                      <button
                        type="button"
                        onClick={() => requestDeleteRecord('document', doc.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 text-xs font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                        title="حذف الوثيقة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف</span>
                      </button>
                    )}
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

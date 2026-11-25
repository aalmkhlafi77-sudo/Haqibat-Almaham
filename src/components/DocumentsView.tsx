import React, { useMemo } from 'react';
import { FileText, Plus, RefreshCw, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  evaluateDocumentHealth,
  formatDisplayDate,
  getTodayISO,
} from '../domain/dateUtils';
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
    updateDocumentFilters,
    setDocumentWarningDays,
    openRecord,
  } = useApp();
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
        health: evaluateDocumentHealth(doc, warningDays, today),
      })),
    [db.documents, warningDays, today]
  );

  const counts = useMemo(() => {
    const map: Record<DocumentCategoryFilter, number> = {
      الكل: evaluatedDocs.filter((x) => !x.doc.archivedAt).length,
      سارية: 0,
      'قريبة الانتهاء': 0,
      منتهية: 0,
      'بلا تاريخ': 0,
      مؤرشفة: 0,
    };
    for (const item of evaluatedDocs) {
      map[item.health.filterBucket] += 1;
    }
    return map;
  }, [evaluatedDocs]);

  const filteredDocs = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return evaluatedDocs.filter(({ doc, health }) => {
      if (filters.category === 'الكل') {
        if (doc.archivedAt) return false;
      } else if (health.filterBucket !== filters.category) {
        return false;
      }
      if (filters.specialistId !== 'الكل' && doc.specialistId !== filters.specialistId) {
        return false;
      }
      if (q) {
        const hay = [doc.name, doc.docType, doc.referenceNumber, doc.issuingAuthority]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [evaluatedDocs, filters]);

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

        <button
          type="button"
          onClick={() => openRecord('document', null)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700 text-xs font-semibold whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>وثيقة جديدة</span>
        </button>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3" />
            <input
              type="search"
              value={filters.search}
              onChange={(e) => updateDocumentFilters({ search: e.target.value })}
              placeholder="بحث باسم الوثيقة أو المرجع أو الجهة..."
              className="w-full h-9 pr-8 pl-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100"
            />
          </div>

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
            لا توجد وثائق في هذا التصنيف.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {filteredDocs.map(({ doc, health }) => {
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

              return (
                <div
                  key={doc.id}
                  className="p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/35 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
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
                      <span>{doc.docType}</span>
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
                          <span>سجل التجديدات: {doc.renewals.length}</span>
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
                    />
                    <button
                      type="button"
                      onClick={() => openRecord('document', doc.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-teal-200 dark:border-teal-800 text-xs font-medium text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/60"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>تفاصيل وتجديد</span>
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

import React from 'react';
import {
  ChevronsDownUp,
  ChevronsUpDown,
  FileSignature,
  Gavel,
  Plus,
  Scale,
  Share2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  evaluatePoaHealth,
  formatDateTime,
  formatDisplayDate,
  getTodayISO,
} from '../domain/dateUtils';
import { CollapsibleSection } from './CollapsibleSection';
import { StatusBadge } from './StatusBadge';

const CASES_SECTION_KEYS = ['cases_list', 'sessions_list', 'poas_list'];

export const CasesPoasView: React.FC = () => {
  const { db, openRecord, openShareModal, setSectionsCollapsed } = useApp();
  const today = getTodayISO();
  const showHijri = db.preferences.showHijri;
  const warningDays = db.preferences.documentWarningDays;

  const getSpecialistName = (id: string | null) =>
    db.specialists.find((s) => s.id === id)?.name || 'غير مسند';

  const allCollapsed = CASES_SECTION_KEYS.every(
    (k) => db.preferences.collapsedSections[k]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Scale className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <span>القضايا والجلسات والوكالات</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            ربط الجلسات بالقضايا ومتابعة صلاحيات وتواريخ انتهاء الوكالات والتفويضات
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSectionsCollapsed(CASES_SECTION_KEYS, !allCollapsed)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
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
            onClick={() => openRecord('case', null)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 text-white hover:bg-amber-700 text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>قضية</span>
          </button>

          <button
            type="button"
            onClick={() => openRecord('session', null)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 text-white hover:bg-violet-700 text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>جلسة</span>
          </button>

          <button
            type="button"
            onClick={() => openRecord('poa', null)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>وكالة / تفويض</span>
          </button>
        </div>
      </div>

      {/* Cases */}
      <CollapsibleSection
        sectionKey="cases_list"
        title="القضايا"
        count={db.cases.length}
        tone="cases"
        icon={<Scale className="w-4 h-4" />}
      >
        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {db.cases.map((c) => {
            const sessCount = db.sessions.filter((s) => s.caseId === c.id).length;
            return (
              <div
                key={c.id}
                className="py-3 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => openRecord('case', c.id)}
                    className="text-right font-bold text-sm text-slate-900 dark:text-white hover:text-amber-600 dark:hover:text-amber-400 hover:underline"
                  >
                    {c.title}
                  </button>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap gap-x-2">
                    <span>رقم {c.caseNumber}</span>
                    <span>·</span>
                    <span>{c.court}</span>
                    <span>·</span>
                    <span>المحامي: {getSpecialistName(c.lawyerSpecialistId)}</span>
                    <span>·</span>
                    <span>الجلسات: {sessCount}</span>
                  </div>
                </div>
                <StatusBadge label={c.status} tone="gold" />
              </div>
            );
          })}
        </div>
      </CollapsibleSection>

      {/* Sessions */}
      <CollapsibleSection
        sectionKey="sessions_list"
        title="الجلسات المرتبطة بالقضايا"
        count={db.sessions.length}
        tone="sessions"
        icon={<Gavel className="w-4 h-4" />}
      >
        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {[...db.sessions]
            .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
            .map((s) => {
              const parentCase = db.cases.find((c) => c.id === s.caseId);
              return (
                <div
                  key={s.id}
                  className="py-3 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => openRecord('session', s.id)}
                      className="text-right font-bold text-sm text-slate-900 dark:text-white hover:text-violet-600 dark:hover:text-violet-400 hover:underline"
                    >
                      {s.title}
                    </button>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap gap-x-2">
                      <span>{formatDateTime(s.scheduledAt, showHijri)}</span>
                      {parentCase && (
                        <>
                          <span>·</span>
                          <span>القضية: {parentCase.title}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>المختص: {getSpecialistName(s.specialistId)}</span>
                    </div>
                    {s.outcome && (
                      <div className="text-xs text-slate-700 dark:text-slate-300 mt-1">
                        النتيجة: {s.outcome}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge
                      label={s.status}
                      tone={s.status === 'منعقدة' ? 'success' : 'purple'}
                      icon="gavel"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        openShareModal({
                          recordType: 'session',
                          recordId: s.id,
                          recordTitle: s.title,
                          specialistId: s.specialistId,
                          scheduledInfo: s.scheduledAt,
                          defaultMessage: `السلام عليكم، تذكير بالجلسة:\n«${s.title}»\nالموعد: ${formatDateTime(s.scheduledAt, showHijri)}\nالقضية: ${parentCase?.title || '—'}`,
                        })
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>مشاركة</span>
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </CollapsibleSection>

      {/* POAs */}
      <CollapsibleSection
        sectionKey="poas_list"
        title="الوكالات والتفويضات"
        count={db.poas.length}
        tone="cases"
        icon={<FileSignature className="w-4 h-4" />}
      >
        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {db.poas.map((p) => {
            const ph = evaluatePoaHealth(p, warningDays, today);
            return (
              <div
                key={p.id}
                className="py-3 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => openRecord('poa', p.id)}
                    className="text-right font-bold text-sm text-slate-900 dark:text-white hover:text-amber-600 dark:hover:text-amber-400 hover:underline"
                  >
                    {p.title}
                  </button>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap gap-x-2">
                    <span>المرجع: {p.referenceNumber}</span>
                    <span>·</span>
                    <span>الوكيل: {p.agent}</span>
                    <span>·</span>
                    <span>
                      الصلاحية:{' '}
                      {p.expiryDate ? formatDisplayDate(p.expiryDate, showHijri) : 'غير محددة'}
                    </span>
                  </div>
                </div>
                <StatusBadge
                  label={ph.label}
                  tone={ph.isExpired ? 'danger' : ph.isUrgent ? 'warning' : 'success'}
                />
              </div>
            );
          })}
        </div>
      </CollapsibleSection>
    </div>
  );
};

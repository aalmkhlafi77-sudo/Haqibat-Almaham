import React, { useMemo, useState } from 'react';
import {
  ChevronsDownUp,
  ChevronsUpDown,
  FileSignature,
  Gavel,
  Plus,
  Scale,
  Search,
  Share2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  evaluatePoaHealth,
  evaluateUrgentAlert,
  formatDateTime,
  formatDisplayDate,
  getTodayISO,
  getUrgentAlertMotionClass,
} from '../domain/dateUtils';
import { scoreArabicSearchMatch } from '../domain/searchUtils';
import { CollapsibleSection } from './CollapsibleSection';
import { StatusBadge } from './StatusBadge';

const CASES_SECTION_KEYS = ['cases_list', 'sessions_list', 'poas_list'];

export const CasesPoasView: React.FC = () => {
  const { db, openRecord, openShareModal, setSectionsCollapsed } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const today = getTodayISO();
  const showHijri = db.preferences.showHijri;
  const warningDays = db.preferences.documentWarningDays;

  const getSpecialistName = (id: string | null) =>
    db.specialists.find((s) => s.id === id)?.name || 'غير مسند';

  const allCollapsed = CASES_SECTION_KEYS.every(
    (k) => db.preferences.collapsedSections[k]
  );

  const q = searchQuery.trim();

  const filteredCases = useMemo(() => {
    if (!q) return db.cases;
    return db.cases
      .map((c) => ({
        c,
        score: scoreArabicSearchMatch(q, c.title, [
          c.caseNumber,
          c.court,
          c.parties,
          c.status,
          getSpecialistName(c.lawyerSpecialistId),
        ]),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.c);
  }, [db.cases, db.specialists, q]);

  const filteredSessions = useMemo(() => {
    const base = [...db.sessions].sort((a, b) =>
      b.scheduledAt.localeCompare(a.scheduledAt)
    );
    if (!q) return base;
    return base
      .map((s) => {
        const parentCase = db.cases.find((c) => c.id === s.caseId);
        return {
          s,
          score: scoreArabicSearchMatch(q, s.title, [
            s.location,
            s.outcome,
            parentCase?.title,
            parentCase?.caseNumber,
            getSpecialistName(s.specialistId),
          ]),
        };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.s);
  }, [db.sessions, db.cases, db.specialists, q]);

  const filteredPoas = useMemo(() => {
    if (!q) return db.poas;
    return db.poas
      .map((p) => ({
        p,
        score: scoreArabicSearchMatch(q, p.title, [
          p.referenceNumber,
          p.agent,
          p.grantor,
          p.scope,
          getSpecialistName(p.specialistId),
        ]),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.p);
  }, [db.poas, db.specialists, q]);

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
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-medium text-slate-700 dark:text-slate-200"
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

      {/* Instant Live Search across Cases, Sessions & POAs */}
      <div className="glass-panel rounded-xl p-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث فوري في القضايا والجلسات والوكالات (بالرقم أو المحكمة أو الوكيل أو العنوان)..."
            className="w-full h-9 pr-8 pl-3 rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] text-xs text-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Cases */}
      <CollapsibleSection
        sectionKey="cases_list"
        title="القضايا"
        count={filteredCases.length}
        tone="cases"
        icon={<Scale className="w-4 h-4" />}
      >
        <div className="divide-y divide-slate-100 dark:divide-white/10">
          {filteredCases.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-500 dark:text-slate-400">
              لا توجد قضايا مطابقة للبحث.
            </p>
          ) : (
            filteredCases.map((c) => {
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
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap gap-x-2 font-mono-tabular">
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
            })
          )}
        </div>
      </CollapsibleSection>

      {/* Sessions */}
      <CollapsibleSection
        sectionKey="sessions_list"
        title="الجلسات المرتبطة بالقضايا"
        count={filteredSessions.length}
        tone="sessions"
        icon={<Gavel className="w-4 h-4" />}
      >
        <div className="divide-y divide-slate-100 dark:divide-white/10">
          {filteredSessions.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-500 dark:text-slate-400">
              لا توجد جلسات مطابقة للبحث.
            </p>
          ) : (
            filteredSessions.map((s) => {
              const parentCase = db.cases.find((c) => c.id === s.caseId);
              const isTerminal = s.status === 'منعقدة' || s.status === 'ملغاة';
              const urgent = evaluateUrgentAlert(
                s.scheduledAt,
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
                  key={s.id}
                  className="py-3 px-2 first:pt-2 last:pb-2 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => openRecord('session', s.id)}
                      className="text-right font-bold text-sm text-slate-900 dark:text-white hover:text-violet-600 dark:hover:text-violet-400 hover:underline"
                    >
                      {s.title}
                    </button>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap gap-x-2 font-mono-tabular">
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
                    {urgent.isUrgentAlert && urgent.badgeText && (
                      <StatusBadge
                        label={urgent.badgeText}
                        tone={urgent.kind === 'today' ? 'today' : 'warning'}
                        icon="clock"
                        motionClass={motionClass}
                      />
                    )}
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
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/15 text-xs font-medium text-slate-700 dark:text-slate-200"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>مشاركة</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CollapsibleSection>

      {/* POAs */}
      <CollapsibleSection
        sectionKey="poas_list"
        title="الوكالات والتفويضات"
        count={filteredPoas.length}
        tone="cases"
        icon={<FileSignature className="w-4 h-4" />}
      >
        <div className="divide-y divide-slate-100 dark:divide-white/10">
          {filteredPoas.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-500 dark:text-slate-400">
              لا توجد وكالات مطابقة للبحث.
            </p>
          ) : (
            filteredPoas.map((p) => {
              const ph = evaluatePoaHealth(p, warningDays, today);
              const isTerminal = !!p.archivedAt || p.statusOverride === 'مفسوخة';
              const urgent = evaluateUrgentAlert(
                p.expiryDate,
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
                  key={p.id}
                  className="py-3 px-2 first:pt-2 last:pb-2 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => openRecord('poa', p.id)}
                      className="text-right font-bold text-sm text-slate-900 dark:text-white hover:text-amber-600 dark:hover:text-amber-400 hover:underline"
                    >
                      {p.title}
                    </button>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap gap-x-2 font-mono-tabular">
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
                    motionClass={motionClass}
                  />
                </div>
              );
            })
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ChevronDown,
  ChevronLeft,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  FlaskConical,
  FolderOpen,
  Plus,
  Receipt,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { generateId } from '../data/repository';
import { formatDisplayDate } from '../domain/dateUtils';
import {
  createEmptyVat3ALines,
  evaluateVat3ADraft,
  formatHalalas,
  VAT_3A_RULES_VERSION,
  VAT_3A_TEST_PRESETS,
  Vat3ATestPreset,
} from '../domain/vat3aEngine';
import { Vat3ADraft, Vat3ADraftStatus, Vat3ALineId } from '../types/domain';
import { StatusBadge } from './StatusBadge';

export const Vat3AView: React.FC = () => {
  const {
    db,
    saveVat3ADraft,
    deleteVat3ADraft,
    updateVatArchiveFilters,
    getDeleteImpact,
    showToast,
  } = useApp();

  const initialWorking =
    db.vat3aDrafts.find((d) => !d.isTestSample && d.status !== 'مؤرشفة') ||
    db.vat3aDrafts[0];

  const [draft, setDraft] = useState<Vat3ADraft>(() =>
    initialWorking
      ? structuredClone(initialWorking)
      : {
          id: generateId('vat'),
          orgId: 'org-01',
          entityName: db.organizations[0]?.name || 'شركة المدار للأعمال والاستشارات',
          taxRegistrationNumber: db.organizations[0]?.taxRegistrationNumber || '',
          periodStart: '2026-10-01',
          periodEnd: '2026-12-31',
          status: 'مسودة',
          calcRulesVersion: VAT_3A_RULES_VERSION,
          editorName:
            db.specialists.find((s) => s.id === db.preferences.currentSpecialistId)?.name ||
            'المستخدم',
          isTestSample: false,
          lines: createEmptyVat3ALines(),
          item14PeriodRef: '',
          item14Reason: '',
          negativeBaseExplanation: '',
          computedNetHalalas: 0,
          updatedAt: new Date().toISOString().slice(0, 19),
          archivedAt: null,
        }
  );

  const [lastWorkingDraftId, setLastWorkingDraftId] = useState<string>(
    initialWorking?.id || ''
  );
  const [archiveOpen, setArchiveOpen] = useState(true);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copyStart, setCopyStart] = useState('2027-01-01');
  const [copyEnd, setCopyEnd] = useState('2027-03-31');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [mobileExpandedLines, setMobileExpandedLines] = useState<Record<number, boolean>>({
    1: true,
    6: true,
    7: true,
    9: true,
    12: true,
    13: true,
    14: true,
    15: true,
    16: true,
  });

  const evalResult = useMemo(() => evaluateVat3ADraft(draft), [draft]);
  const isArchived = draft.status === 'مؤرشفة';
  const showHijri = db.preferences.showHijri;
  const archiveFilters = db.preferences.vatArchiveFilters;

  // Check duplicate active draft for same entity + period
  const duplicateActiveDraft = useMemo(() => {
    if (draft.isTestSample || isArchived) return null;
    return (
      db.vat3aDrafts.find(
        (d) =>
          d.id !== draft.id &&
          !d.isTestSample &&
          d.status !== 'مؤرشفة' &&
          d.entityName.trim() === draft.entityName.trim() &&
          d.periodStart === draft.periodStart &&
          d.periodEnd === draft.periodEnd
      ) || null
    );
  }, [db.vat3aDrafts, draft.id, draft.isTestSample, draft.entityName, draft.periodStart, draft.periodEnd, isArchived]);

  const handleLineChange = (
    lineId: Vat3ALineId,
    field: 'amountRaw' | 'adjustmentRaw',
    value: string
  ) => {
    if (isArchived) return;
    setDraft((prev) => ({
      ...prev,
      lines: {
        ...prev.lines,
        [lineId]: {
          ...(prev.lines[lineId] || { amountRaw: '', adjustmentRaw: '' }),
          [field]: value,
        },
      },
    }));
  };

  const handleSaveDraft = () => {
    if (!evalResult.isValid) {
      showToast('تعذّر الحفظ: صحّح الحقول غير الصالحة الظاهرة في النموذج.');
      return;
    }
    const updated: Vat3ADraft = {
      ...draft,
      calcRulesVersion: VAT_3A_RULES_VERSION,
      computedNetHalalas: evalResult.v16Halalas,
      updatedAt: new Date().toISOString().slice(0, 19),
    };
    saveVat3ADraft(updated);
    setDraft(updated);
    if (!updated.isTestSample) {
      setLastWorkingDraftId(updated.id);
    }
    showToast('تم حفظ مسودة 3A بالنتائج المحسوبة.');
  };

  const handleCreateNewDraft = () => {
    const newDraft: Vat3ADraft = {
      id: generateId('vat'),
      orgId: 'org-01',
      entityName: db.organizations[0]?.name || 'شركة المدار للأعمال والاستشارات',
      taxRegistrationNumber: db.organizations[0]?.taxRegistrationNumber || '',
      periodStart: '2026-10-01',
      periodEnd: '2026-12-31',
      status: 'مسودة',
      calcRulesVersion: VAT_3A_RULES_VERSION,
      editorName:
        db.specialists.find((s) => s.id === db.preferences.currentSpecialistId)?.name ||
        'المستخدم',
      isTestSample: false,
      lines: createEmptyVat3ALines(),
      item14PeriodRef: '',
      item14Reason: '',
      negativeBaseExplanation: '',
      computedNetHalalas: 0,
      updatedAt: new Date().toISOString().slice(0, 19),
      archivedAt: null,
    };
    setDraft(newDraft);
    setLastWorkingDraftId(newDraft.id);
  };

  const handleOpenSavedDraft = (target: Vat3ADraft) => {
    setDraft(structuredClone(target));
    if (!target.isTestSample) {
      setLastWorkingDraftId(target.id);
    }
    showToast(`تم فتح: ${target.entityName}`);
  };

  const handleArchiveToggle = () => {
    if (!evalResult.isValid && !isArchived) {
      showToast('صحّح الأخطاء قبل أرشفة المسودة.');
      return;
    }
    const nextStatus: Vat3ADraftStatus = isArchived ? 'مسودة' : 'مؤرشفة';
    const nextDraft: Vat3ADraft = {
      ...draft,
      status: nextStatus,
      archivedAt: nextStatus === 'مؤرشفة' ? new Date().toISOString().slice(0, 19) : null,
      computedNetHalalas: evalResult.v16Halalas,
      updatedAt: new Date().toISOString().slice(0, 19),
    };
    saveVat3ADraft(nextDraft);
    setDraft(nextDraft);
    showToast(nextStatus === 'مؤرشفة' ? 'تمت أرشفة المسودة.' : 'تمت إعادة فتح المسودة للتعديل.');
  };

  const handleCopyToNewPeriod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!copyStart || !copyEnd || copyEnd < copyStart) {
      showToast('تأكد من صحة بداية ونهاية الفترة الجديدة.');
      return;
    }
    const copiedLines = structuredClone(draft.lines);
    // Per 3A Doc: reset Items 14 & 15 to 0 for user review when copying
    copiedLines[14] = { amountRaw: '0', adjustmentRaw: '' };
    copiedLines[15] = { amountRaw: '0', adjustmentRaw: '' };

    const copied: Vat3ADraft = {
      ...draft,
      id: generateId('vat'),
      periodStart: copyStart,
      periodEnd: copyEnd,
      status: 'مسودة',
      isTestSample: false,
      lines: copiedLines,
      item14PeriodRef: '',
      item14Reason: '',
      archivedAt: null,
      updatedAt: new Date().toISOString().slice(0, 19),
    };
    copied.computedNetHalalas = evaluateVat3ADraft(copied).v16Halalas;
    saveVat3ADraft(copied);
    setDraft(copied);
    setLastWorkingDraftId(copied.id);
    setCopyModalOpen(false);
    showToast('تم نسخ النموذج لفترة جديدة مع تصفير البندين 14 و15 للمراجعة.');
  };

  /**
   * Opens a test preset inside a SEPARATE test draft so active working drafts are preserved.
   */
  const handleLoadTestPreset = (preset: Vat3ATestPreset) => {
    if (!draft.isTestSample && db.vat3aDrafts.some((d) => d.id === draft.id)) {
      setLastWorkingDraftId(draft.id);
    }
    const fields = preset.buildDraftFields();
    const testDraft: Vat3ADraft = {
      id: `vat-test-${preset.key}`,
      orgId: 'org-01',
      entityName: fields.entityName || preset.title,
      taxRegistrationNumber: '310000000000003',
      periodStart: '2026-10-01',
      periodEnd: '2026-12-31',
      status: 'مسودة',
      calcRulesVersion: VAT_3A_RULES_VERSION,
      editorName: 'مسودة اختبار المعاينة',
      isTestSample: true,
      lines: fields.lines || createEmptyVat3ALines(),
      item14PeriodRef: fields.item14PeriodRef || '',
      item14Reason: fields.item14Reason || '',
      negativeBaseExplanation: fields.negativeBaseExplanation || '',
      computedNetHalalas: 0,
      updatedAt: new Date().toISOString().slice(0, 19),
      archivedAt: null,
    };
    testDraft.computedNetHalalas = evaluateVat3ADraft(testDraft).v16Halalas;
    setDraft(testDraft);
    showToast(`فُتحت مسودة اختبار منفصلة: ${preset.title}`);
  };

  const returnToWorkingDraft = () => {
    const target =
      db.vat3aDrafts.find((d) => d.id === lastWorkingDraftId) ||
      db.vat3aDrafts.find((d) => !d.isTestSample) ||
      db.vat3aDrafts[0];
    if (target) {
      setDraft(structuredClone(target));
    } else {
      handleCreateNewDraft();
    }
  };

  const filteredArchive = useMemo(() => {
    const q = archiveFilters.search.trim().toLowerCase();
    return db.vat3aDrafts.filter((d) => {
      if (archiveFilters.status !== 'الكل' && d.status !== archiveFilters.status) {
        return false;
      }
      if (
        archiveFilters.entityName !== 'الكل' &&
        d.entityName !== archiveFilters.entityName
      ) {
        return false;
      }
      if (q) {
        const hay = `${d.entityName} ${d.taxRegistrationNumber} ${d.periodStart} ${d.periodEnd}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [db.vat3aDrafts, archiveFilters]);

  const entityNames = Array.from(new Set(db.vat3aDrafts.map((d) => d.entityName)));
  const allMobileExpanded = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].every(
    (id) => mobileExpandedLines[id]
  );

  const toggleAllMobileLines = () => {
    const nextState: Record<number, boolean> = {};
    for (let i = 1; i <= 16; i += 1) nextState[i] = !allMobileExpanded;
    setMobileExpandedLines(nextState);
  };

  const deleteImpact = deleteConfirmId ? getDeleteImpact('vat3a', deleteConfirmId) : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>نموذج ضريبة القيمة المضافة 3A</span>
            <StatusBadge
              label={draft.status}
              tone={
                draft.status === 'مؤرشفة'
                  ? 'neutral'
                  : draft.status === 'قيد المراجعة'
                  ? 'warning'
                  : 'success'
              }
            />
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            مسودة داخلية للمعاينة والمراجعة • إصدار القواعد: {VAT_3A_RULES_VERSION}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCreateNewDraft}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>مسودة جديدة</span>
          </button>

          {!isArchived && (
            <button
              type="button"
              onClick={handleSaveDraft}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold"
            >
              <Save className="w-3.5 h-3.5" />
              <span>حفظ المسودة</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setCopyModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>نسخ لفترة جديدة</span>
          </button>

          <button
            type="button"
            onClick={handleArchiveToggle}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>{isArchived ? 'إعادة فتح للتعديل' : 'أرشفة'}</span>
          </button>

          {db.vat3aDrafts.some((d) => d.id === draft.id) && (
            <button
              type="button"
              onClick={() => setDeleteConfirmId(draft.id)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/60"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف</span>
            </button>
          )}
        </div>
      </div>

      {/* Preview Disclaimer Banner */}
      <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/70 dark:bg-emerald-950/30 px-4 py-3 text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
        <strong>تنبيه المعاينة:</strong> هذه الشاشة مسودة للمعاينة والمراجعة الداخلية بقيم تجريبية، ولا تُغني عن مطابقة المعادلات وسياسة التقريب والخصم مع نموذج هيئة الزكاة والضريبة والجمارك ومراجعة المحاسب قبل الاستخدام التشغيلي.
      </div>

      {/* Separate Test Draft Banner & Quick Test Presets */}
      <div className="glass-panel rounded-xl p-3.5 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
            <FlaskConical className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>حالات الاختبار المرجعية (تُفتح في مسودة تجريبية منفصلة)</span>
          </div>
          {draft.isTestSample && (
            <button
              type="button"
              onClick={returnToWorkingDraft}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold"
            >
              <RotateCcw className="w-3 h-3" />
              <span>العودة لمسودة العمل</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {VAT_3A_TEST_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => handleLoadTestPreset(preset)}
              title={preset.expectedSummary}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                draft.id === `vat-test-${preset.key}`
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/50'
              }`}
            >
              {preset.title}
            </button>
          ))}
        </div>

        {draft.isTestSample && (
          <div className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 rounded-lg px-3 py-2">
            أنت تعاين الآن <strong>مسودة اختبار تجريبية منفصلة</strong> — مسودتك العاملة في الأرشيف محفوظة دون تعديل.
          </div>
        )}
      </div>

      {/* Duplicate Active Draft Warning */}
      {duplicateActiveDraft && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200">
          <span>
            توجد مسودة نشطة مطابقة لنفس المنشأة والفترة ({duplicateActiveDraft.periodStart} ← {duplicateActiveDraft.periodEnd}).
          </span>
          <button
            type="button"
            onClick={() => handleOpenSavedDraft(duplicateActiveDraft)}
            className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-semibold"
          >
            فتح المسودة الموجودة
          </button>
        </div>
      )}

      {/* Header Metadata Form */}
      <div className="glass-panel rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-2">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            المنشأة *
          </label>
          <input
            type="text"
            disabled={isArchived}
            value={draft.entityName}
            onChange={(e) => setDraft({ ...draft, entityName: e.target.value })}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm disabled:opacity-60"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            رقم التسجيل الضريبي (نصي)
          </label>
          <input
            type="text"
            disabled={isArchived}
            value={draft.taxRegistrationNumber}
            onChange={(e) =>
              setDraft({ ...draft, taxRegistrationNumber: e.target.value })
            }
            placeholder="310xxxxxxxxxxxx"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono-tabular disabled:opacity-60"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            بداية الفترة *
          </label>
          <input
            type="date"
            disabled={isArchived}
            value={draft.periodStart}
            onChange={(e) => setDraft({ ...draft, periodStart: e.target.value })}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm disabled:opacity-60"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            نهاية الفترة *
          </label>
          <input
            type="date"
            disabled={isArchived}
            value={draft.periodEnd}
            onChange={(e) => setDraft({ ...draft, periodEnd: e.target.value })}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm disabled:opacity-60"
          />
        </div>

        <div className="sm:col-span-2 lg:col-span-5 flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span>حالة السجل:</span>
            <select
              disabled={isArchived}
              value={draft.status}
              onChange={(e) =>
                setDraft({ ...draft, status: e.target.value as Vat3ADraftStatus })
              }
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs disabled:opacity-60"
            >
              <option value="مسودة">مسودة</option>
              <option value="قيد المراجعة">قيد المراجعة</option>
              <option value="مؤرشفة">مؤرشفة</option>
            </select>
            <span>المحرر: {draft.editorName}</span>
          </div>

          {evalResult.periodError && (
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              {evalResult.periodError}
            </span>
          )}
        </div>
      </div>

      {/* Errors Summary Banner if invalid */}
      {!evalResult.isValid && (
        <div className="rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 p-3.5 space-y-1 text-xs text-rose-800 dark:text-rose-200">
          <div className="font-bold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            <span>يتوقف احتساب النتيجة النهائية والحفظ حتى تُصحح الأخطاء التالية:</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5">
            {evalResult.errorsSummary.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* DESKTOP TABLE (Columns from right: رقم البند واسمه | المبلغ | التعديل | الضريبة) */}
      <div className="hidden md:block glass-panel rounded-xl overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/80 text-xs font-bold text-slate-700 dark:text-slate-200">
              <th className="text-right py-3 px-4 w-[42%]">رقم البند واسمه</th>
              <th className="text-right py-3 px-3 w-[19%]">المبلغ (ر.س)</th>
              <th className="text-right py-3 px-3 w-[19%]">التعديل (ر.س)</th>
              <th className="text-right py-3 px-4 w-[20%]">الضريبة (ر.س)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] as Vat3ALineId[]).map(
              (lineId) => {
                const comp = evalResult.lines[lineId];
                const def = comp.definition;
                const raw = draft.lines[lineId] || { amountRaw: '', adjustmentRaw: '' };
                const isTotalRow = !!def.isTotal;

                return (
                  <tr
                    key={lineId}
                    className={
                      lineId === 16
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/35 font-bold'
                        : isTotalRow
                        ? 'bg-slate-50/90 dark:bg-slate-800/50 font-semibold'
                        : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/20'
                    }
                  >
                    <td className="py-2.5 px-4 align-top">
                      <div className="flex items-start gap-2">
                        <span className="font-mono-tabular text-xs font-bold text-emerald-700 dark:text-emerald-300 mt-0.5 w-6 shrink-0">
                          {lineId}.
                        </span>
                        <div>
                          <div className="text-slate-900 dark:text-slate-100">{def.name}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {def.rateLabel}
                          </div>
                          {comp.warning && (
                            <div className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                              {comp.warning}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Amount Column */}
                    <td className="py-2 px-3 align-top">
                      {def.amountEditable ? (
                        <div>
                          <input
                            type="text"
                            dir="ltr"
                            disabled={isArchived}
                            value={raw.amountRaw}
                            onChange={(e) =>
                              handleLineChange(lineId, 'amountRaw', e.target.value)
                            }
                            placeholder="0.00"
                            className={`w-full rounded-lg border px-2.5 py-1.5 text-left font-mono-tabular text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white disabled:opacity-60 ${
                              comp.amountError
                                ? 'border-rose-500 focus:ring-rose-500'
                                : 'border-slate-300 dark:border-slate-600 focus:ring-emerald-500'
                            }`}
                          />
                          {comp.amountError && (
                            <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                              {comp.amountError}
                            </p>
                          )}
                        </div>
                      ) : def.vatDirectInput ? (
                        <div className="py-1.5 px-2 text-slate-400 text-xs">—</div>
                      ) : (
                        <div className="py-1.5 px-2.5 rounded-lg bg-slate-100/90 dark:bg-slate-900/70 text-slate-700 dark:text-slate-200 font-mono-tabular text-left" dir="ltr">
                          {formatHalalas(comp.amountHalalas)}
                        </div>
                      )}
                    </td>

                    {/* Adjustment Column */}
                    <td className="py-2 px-3 align-top">
                      {def.adjustmentEditable ? (
                        <div>
                          <input
                            type="text"
                            dir="ltr"
                            disabled={isArchived}
                            value={raw.adjustmentRaw}
                            onChange={(e) =>
                              handleLineChange(lineId, 'adjustmentRaw', e.target.value)
                            }
                            placeholder={lineId === 9 ? 'غير قابل للخصم' : '0.00'}
                            className={`w-full rounded-lg border px-2.5 py-1.5 text-left font-mono-tabular text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white disabled:opacity-60 ${
                              comp.adjustmentError
                                ? 'border-rose-500 focus:ring-rose-500'
                                : 'border-slate-300 dark:border-slate-600 focus:ring-emerald-500'
                            }`}
                          />
                          {comp.adjustmentError && (
                            <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                              {comp.adjustmentError}
                            </p>
                          )}
                        </div>
                      ) : def.vatDirectInput ? (
                        <div className="py-1.5 px-2 text-slate-400 text-xs">—</div>
                      ) : (
                        <div className="py-1.5 px-2.5 rounded-lg bg-slate-100/90 dark:bg-slate-900/70 text-slate-700 dark:text-slate-200 font-mono-tabular text-left" dir="ltr">
                          {formatHalalas(comp.adjustmentHalalas)}
                        </div>
                      )}
                    </td>

                    {/* VAT Column */}
                    <td className="py-2 px-4 align-top">
                      {def.vatDirectInput ? (
                        <div>
                          <input
                            type="text"
                            dir="ltr"
                            disabled={isArchived}
                            value={raw.amountRaw}
                            onChange={(e) =>
                              handleLineChange(lineId, 'amountRaw', e.target.value)
                            }
                            placeholder="0.00"
                            className={`w-full rounded-lg border px-2.5 py-1.5 text-left font-mono-tabular text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white disabled:opacity-60 ${
                              comp.vatInputError
                                ? 'border-rose-500 focus:ring-rose-500'
                                : 'border-slate-300 dark:border-slate-600 focus:ring-emerald-500'
                            }`}
                          />
                          {comp.vatInputError && (
                            <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                              {comp.vatInputError}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div
                          dir="ltr"
                          className={`py-1.5 px-2.5 rounded-lg font-mono-tabular text-left ${
                            lineId === 16
                              ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-100 font-bold'
                              : 'bg-slate-100/90 dark:bg-slate-900/70 text-slate-800 dark:text-slate-100'
                          }`}
                        >
                          {lineId === 16 && !evalResult.isValid
                            ? 'يتطلب التصحيح'
                            : formatHalalas(comp.vatHalalas)}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              }
            )}
          </tbody>
        </table>
      </div>

      {/* MOBILE FULL-EDIT COLLAPSIBLE CARDS (Approved by project owner) */}
      <div className="md:hidden space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            بنود الإقرار (1–16)
          </span>
          <button
            type="button"
            onClick={toggleAllMobileLines}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium"
          >
            {allMobileExpanded ? (
              <>
                <ChevronsDownUp className="w-3.5 h-3.5" />
                <span>طي الكل</span>
              </>
            ) : (
              <>
                <ChevronsUpDown className="w-3.5 h-3.5" />
                <span>فتح الكل</span>
              </>
            )}
          </button>
        </div>

        {([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] as Vat3ALineId[]).map(
          (lineId) => {
            const comp = evalResult.lines[lineId];
            const def = comp.definition;
            const raw = draft.lines[lineId] || { amountRaw: '', adjustmentRaw: '' };
            const expanded = !!mobileExpandedLines[lineId];
            const hasErr = !!(
              comp.amountError ||
              comp.adjustmentError ||
              comp.vatInputError
            );

            return (
              <div
                key={`mob-${lineId}`}
                className={`glass-panel rounded-xl overflow-hidden ${
                  hasErr ? 'border-rose-400 dark:border-rose-700' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() =>
                    setMobileExpandedLines((prev) => ({
                      ...prev,
                      [lineId]: !prev[lineId],
                    }))
                  }
                  className="w-full px-3.5 py-3 flex items-center justify-between gap-2 text-right"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {expanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronLeft className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span className="font-mono-tabular text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      {lineId}.
                    </span>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {def.name}
                    </span>
                  </div>
                  <span
                    dir="ltr"
                    className="font-mono-tabular text-xs font-bold text-slate-800 dark:text-slate-100 shrink-0"
                  >
                    {lineId === 16 && !evalResult.isValid
                      ? 'خطأ'
                      : formatHalalas(comp.vatHalalas)}
                  </span>
                </button>

                {expanded && (
                  <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                    {def.amountEditable && (
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          المبلغ (ر.س)
                        </label>
                        <input
                          type="text"
                          dir="ltr"
                          disabled={isArchived}
                          value={raw.amountRaw}
                          onChange={(e) =>
                            handleLineChange(lineId, 'amountRaw', e.target.value)
                          }
                          placeholder="0.00"
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-left font-mono-tabular text-sm"
                        />
                        {comp.amountError && (
                          <p className="text-[11px] text-rose-600 mt-1">{comp.amountError}</p>
                        )}
                      </div>
                    )}

                    {def.adjustmentEditable && (
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          التعديل (ر.س)
                        </label>
                        <input
                          type="text"
                          dir="ltr"
                          disabled={isArchived}
                          value={raw.adjustmentRaw}
                          onChange={(e) =>
                            handleLineChange(lineId, 'adjustmentRaw', e.target.value)
                          }
                          placeholder={lineId === 9 ? 'غير قابل للخصم' : '0.00'}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-left font-mono-tabular text-sm"
                        />
                        {comp.adjustmentError && (
                          <p className="text-[11px] text-rose-600 mt-1">
                            {comp.adjustmentError}
                          </p>
                        )}
                      </div>
                    )}

                    {def.vatDirectInput ? (
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          الضريبة (ر.س)
                        </label>
                        <input
                          type="text"
                          dir="ltr"
                          disabled={isArchived}
                          value={raw.amountRaw}
                          onChange={(e) =>
                            handleLineChange(lineId, 'amountRaw', e.target.value)
                          }
                          placeholder="0.00"
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-left font-mono-tabular text-sm"
                        />
                        {comp.vatInputError && (
                          <p className="text-[11px] text-rose-600 mt-1">
                            {comp.vatInputError}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-900/70 rounded-lg px-3 py-2">
                        <span className="text-slate-500 dark:text-slate-400">
                          الضريبة المحسوبة (للقراءة فقط):
                        </span>
                        <span dir="ltr" className="font-mono-tabular font-bold">
                          {formatHalalas(comp.vatHalalas)} ر.س
                        </span>
                      </div>
                    )}

                    {comp.warning && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-300">
                        {comp.warning}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          }
        )}
      </div>

      {/* Conditional Review Fields (Item 14 & Negative Base) + Net Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 glass-panel rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            ملاحظات المراجعة والضوابط
          </h2>

          {evalResult.needsItem14Details && (
            <div className="space-y-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                بيانات تصحيح الفترات السابقة (البند 14) *
              </div>
              {evalResult.item14ThresholdWarning && (
                <div className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg p-2">
                  تنبيه مراجعة: تتجاوز قيمة التصحيح 15,000 ريال بالقيمة المطلقة؛ يحدد المحاسب المسار وفق إرشادات الهيئة.
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    مرجع الفترة المصححة *
                  </label>
                  <input
                    type="text"
                    disabled={isArchived}
                    value={draft.item14PeriodRef || ''}
                    onChange={(e) =>
                      setDraft({ ...draft, item14PeriodRef: e.target.value })
                    }
                    placeholder="مثال: الربع الثاني 2026"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    سبب التصحيح *
                  </label>
                  <input
                    type="text"
                    disabled={isArchived}
                    value={draft.item14Reason || ''}
                    onChange={(e) =>
                      setDraft({ ...draft, item14Reason: e.target.value })
                    }
                    placeholder="توضيح سبب التصحيح..."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {evalResult.needsNegativeBaseExplanation && (
            <div className="space-y-1.5 p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <label className="block text-xs font-bold text-amber-900 dark:text-amber-200">
                توضيح الوعاء الصافي السالب للمراجعة البشرية *
              </label>
              <input
                type="text"
                disabled={isArchived}
                value={draft.negativeBaseExplanation || ''}
                onChange={(e) =>
                  setDraft({ ...draft, negativeBaseExplanation: e.target.value })
                }
                placeholder="سبب تجاوز التعديل السالب للمبلغ..."
                className="w-full rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
              />
            </div>
          )}

          {!evalResult.needsItem14Details && !evalResult.needsNegativeBaseExplanation && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              لا توجد حقول مراجعة إضافية مطلوبة حاليًا. جميع الإجماليات محسوبة آليًا بالهللات الصحيحة ومقفلة ضد التحرير.
            </p>
          )}
        </div>

        <div className="lg:col-span-5 glass-panel rounded-xl p-4 flex flex-col justify-between gap-3">
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">6. ضريبة المبيعات:</span>
              <span dir="ltr" className="font-mono-tabular font-semibold">
                {formatHalalas(evalResult.v6Halalas)} ر.س
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">12. ضريبة المشتريات:</span>
              <span dir="ltr" className="font-mono-tabular font-semibold">
                {formatHalalas(evalResult.v12Halalas)} ر.س
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">13. ضريبة الفترة الحالية:</span>
              <span dir="ltr" className="font-mono-tabular font-semibold">
                {formatHalalas(evalResult.v13Halalas)} ر.س
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                16. صافي الضريبة
              </div>
              <div className="mt-1">
                <StatusBadge
                  label={evalResult.isValid ? evalResult.netStatusLabel : 'يتطلب التصحيح'}
                  tone={
                    !evalResult.isValid
                      ? 'danger'
                      : evalResult.v16Halalas > 0
                      ? 'warning'
                      : evalResult.v16Halalas < 0
                      ? 'success'
                      : 'neutral'
                  }
                />
              </div>
            </div>
            <div
              dir="ltr"
              className="text-xl lg:text-2xl font-bold font-mono-tabular text-emerald-700 dark:text-emerald-300"
            >
              {evalResult.isValid ? `${formatHalalas(evalResult.v16Halalas)} ر.س` : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Saved Drafts & Archive */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setArchiveOpen(!archiveOpen)}
          className="w-full px-4 py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 text-right"
        >
          <div className="flex items-center gap-2">
            {archiveOpen ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            )}
            <FolderOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              المسودات المحفوظة والأرشيف ({filteredArchive.length})
            </span>
          </div>
        </button>

        {archiveOpen && (
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="search"
                value={archiveFilters.search}
                onChange={(e) => updateVatArchiveFilters({ search: e.target.value })}
                placeholder="بحث بالمنشأة أو الرقم الضريبي..."
                className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              />
              <select
                value={archiveFilters.entityName}
                onChange={(e) => updateVatArchiveFilters({ entityName: e.target.value })}
                className="h-9 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              >
                <option value="الكل">المنشأة: الكل</option>
                {entityNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <select
                value={archiveFilters.status}
                onChange={(e) =>
                  updateVatArchiveFilters({
                    status: e.target.value as 'الكل' | Vat3ADraftStatus,
                  })
                }
                className="h-9 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              >
                <option value="الكل">الحالة: الكل</option>
                <option value="مسودة">مسودة</option>
                <option value="قيد المراجعة">قيد المراجعة</option>
                <option value="مؤرشفة">مؤرشفة</option>
              </select>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredArchive.map((item) => (
                <div
                  key={item.id}
                  className="py-2.5 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => handleOpenSavedDraft(item)}
                      className="text-right text-sm font-bold text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline block truncate"
                    >
                      {item.entityName}
                    </button>
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-2 mt-0.5">
                      <span>
                        الفترة: {formatDisplayDate(item.periodStart, showHijri)} ←{' '}
                        {formatDisplayDate(item.periodEnd, showHijri)}
                      </span>
                      <span>·</span>
                      <span dir="ltr" className="font-mono-tabular font-semibold">
                        الصافي: {formatHalalas(item.computedNetHalalas)} ر.س
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      label={item.status}
                      tone={item.status === 'مؤرشفة' ? 'neutral' : 'success'}
                    />
                    <button
                      type="button"
                      onClick={() => handleOpenSavedDraft(item)}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      فتح
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Copy to New Period Modal */}
      {copyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form
            onSubmit={handleCopyToNewPeriod}
            className="glass-panel max-w-md w-full rounded-2xl p-5 space-y-4"
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              نسخ النموذج لفترة جديدة
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              سيُنسخ النموذج مع إعادة البندين 14 (التصحيحات) و15 (الرصيد المرحّل) إلى الصفر لمراجعتهما.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">بداية الفترة الجديدة</label>
                <input
                  type="date"
                  value={copyStart}
                  onChange={(e) => setCopyStart(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">نهاية الفترة الجديدة</label>
                <input
                  type="date"
                  value={copyEnd}
                  onChange={(e) => setCopyEnd(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCopyModalOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-medium"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
              >
                إنشاء النسخة
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirmId && deleteImpact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="glass-panel max-w-md w-full rounded-2xl p-5 space-y-4">
            <h3 className="text-base font-bold text-rose-700 dark:text-rose-300">
              تأكيد حذف المسودة الضريبية
            </h3>
            <p className="text-sm text-slate-700 dark:text-slate-200">
              هل تريد حذف «{deleteImpact.title}»؟
            </p>
            <div className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 rounded-xl p-3">
              {deleteImpact.impactLines.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-medium"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = deleteConfirmId;
                  setDeleteConfirmId(null);
                  deleteVat3ADraft(id);
                  handleCreateNewDraft();
                }}
                className="px-3.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

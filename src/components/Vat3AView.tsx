import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ChevronDown,
  ChevronLeft,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  Download,
  FileSpreadsheet,
  FlaskConical,
  FolderOpen,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  RotateCcw,
  Save,
  Share2,
  Trash2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { generateId } from '../data/repository';
import { formatDisplayDate, toEnglishDigits } from '../domain/dateUtils';
import { scoreArabicSearchMatch } from '../domain/searchUtils';
import {
  createEmptyVat3ALines,
  evaluateVat3ADraft,
  formatHalalas,
  VAT_3A_LINE_DEFINITIONS,
  VAT_3A_RULES_VERSION,
  VAT_3A_TEST_PRESETS,
  Vat3ATestPreset,
} from '../domain/vat3aEngine';
import {
  buildVat3AShareSummaryText,
  downloadVat3AArchiveExcel,
  downloadVat3AArchivePdf,
  downloadVat3AExcel,
  downloadVat3APdf,
} from '../domain/vat3aExport';
import { Vat3ADraft, Vat3ADraftStatus, Vat3ALineId } from '../types/domain';
import { StatusBadge } from './StatusBadge';

export const Vat3AView: React.FC = () => {
  const {
    db,
    saveVat3ADraft,
    deleteVat3ADraft,
    updateVatArchiveFilters,
    getDeleteImpact,
    openShareModal,
    showToast,
  } = useApp();

  const initialWorking =
    db.vat3aDrafts.find((d) => !d.isTestSample && d.status !== 'مؤرشفة') ||
    db.vat3aDrafts[0];

  const makeBlankDraft = (): Vat3ADraft => ({
    id: generateId('vat'),
    orgId: 'org-01',
    entityName: db.organizations[0]?.name || 'شركة المدار للأعمال والاستشارات',
    taxRegistrationNumber: db.organizations[0]?.taxRegistrationNumber || '',
    periodStart: '2026-10-01',
    periodEnd: '2026-12-31',
    status: 'مسودة',
    calcRulesVersion: VAT_3A_RULES_VERSION,
    rulesSnapshot: structuredClone(db.preferences.vat3aRules),
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
  });

  const [draft, setDraft] = useState<Vat3ADraft>(() =>
    initialWorking ? structuredClone(initialWorking) : makeBlankDraft()
  );
  const [printTargetDraft, setPrintTargetDraft] = useState<Vat3ADraft | null>(null);

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

  const evalResult = useMemo(
    () => evaluateVat3ADraft(draft, db.preferences.vat3aRules),
    [draft, db.preferences.vat3aRules]
  );

  const isRulesOutOfSync = useMemo(() => {
    const currentStr = JSON.stringify(db.preferences.vat3aRules);
    const snapStr = JSON.stringify(evalResult.appliedRules);
    return currentStr !== snapStr;
  }, [db.preferences.vat3aRules, evalResult.appliedRules]);

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
  }, [
    db.vat3aDrafts,
    draft.id,
    draft.isTestSample,
    draft.entityName,
    draft.periodStart,
    draft.periodEnd,
    isArchived,
  ]);

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

  const handleRecalculateWithCurrentSettings = () => {
    if (isArchived) return;
    const nextSnapshot = structuredClone(db.preferences.vat3aRules);
    const nextDraft: Vat3ADraft = {
      ...draft,
      calcRulesVersion: VAT_3A_RULES_VERSION,
      rulesSnapshot: nextSnapshot,
    };
    nextDraft.computedNetHalalas = evaluateVat3ADraft(nextDraft).v16Halalas;
    setDraft(nextDraft);
    showToast('تمت إعادة الاحتساب وفق قواعد 3A الحالية في الإعدادات (اضغط «حفظ المسودة» لاعتمادها).');
  };

  const handleSaveDraft = () => {
    if (!evalResult.isValid) {
      showToast('تعذّر الحفظ: صحّح الحقول غير الصالحة الظاهرة في النموذج.');
      return;
    }
    const updated: Vat3ADraft = {
      ...draft,
      calcRulesVersion: VAT_3A_RULES_VERSION,
      rulesSnapshot: draft.rulesSnapshot || structuredClone(evalResult.appliedRules),
      computedNetHalalas: evalResult.v16Halalas,
      updatedAt: new Date().toISOString().slice(0, 19),
    };
    saveVat3ADraft(updated);
    setDraft(updated);
    if (!updated.isTestSample) {
      setLastWorkingDraftId(updated.id);
    }
    showToast('تم حفظ مسودة 3A بالنتائج والقواعد المعتمدة.');
  };

  const handleCreateNewDraft = () => {
    const newDraft = makeBlankDraft();
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
      rulesSnapshot: draft.rulesSnapshot || structuredClone(evalResult.appliedRules),
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
    copiedLines[14] = { amountRaw: '0', adjustmentRaw: '' };
    copiedLines[15] = { amountRaw: '0', adjustmentRaw: '' };

    const copied: Vat3ADraft = {
      ...draft,
      id: generateId('vat'),
      periodStart: copyStart,
      periodEnd: copyEnd,
      status: 'مسودة',
      isTestSample: false,
      rulesSnapshot: structuredClone(db.preferences.vat3aRules),
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
    showToast('تم نسخ النموذج لفترة جديدة وفق الإعدادات الحالية وتصفير البندين 14 و15.');
  };

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
      rulesSnapshot: fields.rulesSnapshot || structuredClone(db.preferences.vat3aRules),
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

  const handlePrintDraft = (target: Vat3ADraft) => {
    setPrintTargetDraft(target);
    window.setTimeout(() => {
      window.print();
    }, 80);
  };

  const handleShareDraft = (target: Vat3ADraft) => {
    openShareModal({
      recordType: 'vat_3a',
      recordId: target.id,
      recordTitle: `نموذج 3A — ${target.entityName}`,
      specialistId: db.preferences.currentSpecialistId || null,
      scheduledInfo: `${target.periodStart} ← ${target.periodEnd}`,
      defaultMessage: buildVat3AShareSummaryText(target),
      vatDraft: target,
    });
  };

  const filteredArchive = useMemo(() => {
    const q = archiveFilters.search.trim();
    return db.vat3aDrafts
      .map((d) => {
        if (archiveFilters.status !== 'الكل' && d.status !== archiveFilters.status) {
          return null;
        }
        if (
          archiveFilters.entityName !== 'الكل' &&
          d.entityName !== archiveFilters.entityName
        ) {
          return null;
        }
        const score = q
          ? scoreArabicSearchMatch(q, d.entityName, [
              d.taxRegistrationNumber,
              d.periodStart,
              d.periodEnd,
              d.status,
              d.editorName,
            ])
          : 1;
        if (score <= 0) return null;
        return { d, score };
      })
      .filter((x): x is { d: Vat3ADraft; score: number } => x !== null)
      .sort((a, b) => (q ? b.score - a.score : b.d.updatedAt.localeCompare(a.d.updatedAt)))
      .map((x) => x.d);
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
  const activePrintDraft = printTargetDraft || draft;
  const activePrintEval = useMemo(
    () => evaluateVat3ADraft(activePrintDraft, db.preferences.vat3aRules),
    [activePrintDraft, db.preferences.vat3aRules]
  );

  return (
    <div className="space-y-4">
      {/* Header & Open Draft Toolbar */}
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
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono-tabular">
            مسودة داخلية للمراجعة · النسبة الافتراضية المعتمدة:{' '}
            {toEnglishDigits(String(evalResult.appliedRules.defaultRatePercent))}%
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleCreateNewDraft}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
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

          {/* Share / Print / Download PDF & Excel on open draft */}
          <button
            type="button"
            onClick={() => handleShareDraft(draft)}
            className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border border-slate-300 dark:border-white/15 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
            title="مشاركة النموذج"
          >
            <Share2 className="w-3.5 h-3.5 text-blue-500" />
            <span>مشاركة</span>
          </button>

          <button
            type="button"
            onClick={() => handlePrintDraft(draft)}
            className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border border-slate-300 dark:border-white/15 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
            title="طباعة النموذج"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500 dark:text-slate-300" />
            <span>طباعة</span>
          </button>

          <button
            type="button"
            onClick={() => {
              downloadVat3APdf(draft);
              showToast('تم تحميل ملف PDF للنموذج.');
            }}
            className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border border-slate-300 dark:border-white/15 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
            title="تحميل PDF"
          >
            <Download className="w-3.5 h-3.5 text-rose-500" />
            <span>PDF</span>
          </button>

          <button
            type="button"
            onClick={() => {
              downloadVat3AExcel(draft);
              showToast('تم تحميل ملف Excel للنموذج.');
            }}
            className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border border-slate-300 dark:border-white/15 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
            title="تحميل Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
            <span>Excel</span>
          </button>

          <button
            type="button"
            onClick={() => setCopyModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-white/15 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>نسخ لفترة جديدة</span>
          </button>

          <button
            type="button"
            onClick={handleArchiveToggle}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-white/15 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
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
        <strong>تنبيه المعاينة:</strong> هذه الشاشة مسودة للمعاينة والمراجعة الداخلية، ولا تُغني عن مطابقة المعادلات مع نموذج هيئة الزكاة والضريبة والجمارك ومراجعة المحاسب قبل الاعتماد الرسمي.
      </div>

      {/* Rules Snapshot Sync Banner */}
      {isRulesOutOfSync && (
        <div className="rounded-xl border border-blue-300 dark:border-blue-500/40 bg-blue-50/80 dark:bg-blue-950/35 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-blue-900 dark:text-blue-200">
          <span>
            تعتمد هذه المسودة قواعدها المحفوظة وقت إنشائها لحماية نتائجها من التغيّر التلقائي. إذا أردت تطبيق إعدادات «قواعد حساب 3A» الحالية عليها، اختر إعادة الاحتساب:
          </span>
          {!isArchived && (
            <button
              type="button"
              onClick={handleRecalculateWithCurrentSettings}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>إعادة الاحتساب وفق الإعدادات الحالية</span>
            </button>
          )}
        </div>
      )}

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
                  : 'border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#14161b] text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/50'
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
            توجد مسودة نشطة مطابقة لنفس المنشأة والفترة ({duplicateActiveDraft.periodStart} ←{' '}
            {duplicateActiveDraft.periodEnd}).
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
            className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] px-3 py-2 text-sm disabled:opacity-60"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            رقم التسجيل الضريبي (نصي)
          </label>
          <input
            type="text"
            dir="ltr"
            disabled={isArchived}
            value={draft.taxRegistrationNumber}
            onChange={(e) =>
              setDraft({ ...draft, taxRegistrationNumber: e.target.value })
            }
            placeholder="310xxxxxxxxxxxx"
            className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] px-3 py-2 text-sm font-mono-tabular disabled:opacity-60"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            بداية الفترة *
          </label>
          <input
            type="date"
            lang="en"
            dir="ltr"
            disabled={isArchived}
            value={draft.periodStart}
            onChange={(e) => setDraft({ ...draft, periodStart: e.target.value })}
            className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] px-3 py-2 text-sm font-mono-tabular disabled:opacity-60"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            نهاية الفترة *
          </label>
          <input
            type="date"
            lang="en"
            dir="ltr"
            disabled={isArchived}
            value={draft.periodEnd}
            onChange={(e) => setDraft({ ...draft, periodEnd: e.target.value })}
            className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] px-3 py-2 text-sm font-mono-tabular disabled:opacity-60"
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
              className="rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] px-2.5 py-1 text-xs disabled:opacity-60"
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

      {/* DESKTOP TABLE */}
      <div className="hidden md:block glass-panel rounded-xl overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#14161b] text-xs font-bold text-slate-700 dark:text-slate-200">
              <th className="text-right py-3 px-4 w-[40%]">رقم البند واسمه</th>
              <th className="text-right py-3 px-3 w-[20%]">المبلغ (ر.س)</th>
              <th className="text-right py-3 px-3 w-[20%]">التعديل (ر.س)</th>
              <th className="text-right py-3 px-4 w-[20%]">الضريبة (ر.س)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/10">
            {([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] as Vat3ALineId[]).map(
              (lineId) => {
                const comp = evalResult.lines[lineId];
                const def = comp.definition;
                const raw = draft.lines[lineId] || { amountRaw: '', adjustmentRaw: '' };
                const isTotalRow = !!def.isTotal;
                const ruleTag =
                  def.id === 9
                    ? `احتساب عكسي · ${toEnglishDigits(String(comp.effectiveRatePercent))}%`
                    : def.vatDirectInput || isTotalRow
                    ? def.rateLabel
                    : comp.taxMethod === 'zero'
                    ? 'أثر ضريبي صفري (0%)'
                    : `نسبة ${toEnglishDigits(String(comp.effectiveRatePercent))}%`;

                const dirHint =
                  def.id === 9
                    ? 'غير قابل للخصم'
                    : comp.adjustmentDirection === 'subtract'
                    ? '− يُطرح من المبلغ'
                    : '+ يُضاف إلى المبلغ';

                return (
                  <tr
                    key={lineId}
                    className={
                      lineId === 16
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/35 font-bold'
                        : isTotalRow
                        ? 'bg-slate-50/90 dark:bg-white/[0.04] font-semibold'
                        : 'hover:bg-slate-50/50 dark:hover:bg-white/[0.02]'
                    }
                  >
                    <td className="py-2.5 px-4 align-top">
                      <div className="flex items-start gap-2">
                        <span className="font-mono-tabular text-xs font-bold text-emerald-700 dark:text-emerald-300 mt-0.5 w-6 shrink-0">
                          {lineId}.
                        </span>
                        <div>
                          <div className="text-slate-900 dark:text-slate-100">{def.name}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-tabular">
                            {ruleTag}
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
                            className={`w-full rounded-lg border px-2.5 py-1.5 text-left font-mono-tabular text-sm bg-white dark:bg-[#0e1015] text-slate-900 dark:text-white disabled:opacity-60 ${
                              comp.amountError
                                ? 'border-rose-500 focus:ring-rose-500'
                                : 'border-slate-300 dark:border-white/15 focus:ring-emerald-500'
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
                        <div
                          className="py-1.5 px-2.5 rounded-lg bg-slate-100/90 dark:bg-[#14161b] text-slate-700 dark:text-slate-200 font-mono-tabular text-left"
                          dir="ltr"
                        >
                          {formatHalalas(comp.amountHalalas)}
                        </div>
                      )}
                    </td>

                    {/* Adjustment Column with explicit direction indicator */}
                    <td className="py-2 px-3 align-top">
                      {def.adjustmentEditable ? (
                        <div>
                          <div className="relative">
                            <input
                              type="text"
                              dir="ltr"
                              disabled={isArchived}
                              value={raw.adjustmentRaw}
                              onChange={(e) =>
                                handleLineChange(lineId, 'adjustmentRaw', e.target.value)
                              }
                              placeholder={lineId === 9 ? 'غير قابل للخصم' : '0.00'}
                              className={`w-full rounded-lg border px-2.5 py-1.5 text-left font-mono-tabular text-sm bg-white dark:bg-[#0e1015] text-slate-900 dark:text-white disabled:opacity-60 ${
                                comp.adjustmentError
                                  ? 'border-rose-500 focus:ring-rose-500'
                                  : 'border-slate-300 dark:border-white/15 focus:ring-emerald-500'
                              }`}
                            />
                          </div>
                          <div
                            className={`text-[10px] mt-1 font-semibold ${
                              comp.adjustmentDirection === 'subtract'
                                ? 'text-amber-700 dark:text-amber-300'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {dirHint}
                          </div>
                          {comp.adjustmentError && (
                            <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                              {comp.adjustmentError}
                            </p>
                          )}
                        </div>
                      ) : def.vatDirectInput ? (
                        <div className="py-1.5 px-2 text-slate-400 text-xs">—</div>
                      ) : (
                        <div
                          className="py-1.5 px-2.5 rounded-lg bg-slate-100/90 dark:bg-[#14161b] text-slate-700 dark:text-slate-200 font-mono-tabular text-left"
                          dir="ltr"
                        >
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
                            className={`w-full rounded-lg border px-2.5 py-1.5 text-left font-mono-tabular text-sm bg-white dark:bg-[#0e1015] text-slate-900 dark:text-white disabled:opacity-60 ${
                              comp.vatInputError
                                ? 'border-rose-500 focus:ring-rose-500'
                                : 'border-slate-300 dark:border-white/15 focus:ring-emerald-500'
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
                              : 'bg-slate-100/90 dark:bg-[#14161b] text-slate-800 dark:text-slate-100'
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

      {/* MOBILE FULL-EDIT COLLAPSIBLE CARDS */}
      <div className="md:hidden space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            بنود الإقرار (1–16)
          </span>
          <button
            type="button"
            onClick={toggleAllMobileLines}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/15 text-xs font-medium"
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
            const dirHint =
              def.id === 9
                ? 'غير قابل للخصم'
                : comp.adjustmentDirection === 'subtract'
                ? '− يُطرح من المبلغ'
                : '+ يُضاف إلى المبلغ';

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
                  <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-100 dark:border-white/10 space-y-2.5">
                    {def.amountEditable && (
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          المبلغ (ر.س) —{' '}
                          {comp.taxMethod === 'zero'
                            ? 'أثر صفري'
                            : `${toEnglishDigits(String(comp.effectiveRatePercent))}%`}
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
                          className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0e1015] px-3 py-2 text-left font-mono-tabular text-sm"
                        />
                        {comp.amountError && (
                          <p className="text-[11px] text-rose-600 mt-1">{comp.amountError}</p>
                        )}
                      </div>
                    )}

                    {def.adjustmentEditable && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            التعديل (ر.س)
                          </label>
                          <span
                            className={`text-[10px] font-semibold ${
                              comp.adjustmentDirection === 'subtract'
                                ? 'text-amber-700 dark:text-amber-300'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {dirHint}
                          </span>
                        </div>
                        <input
                          type="text"
                          dir="ltr"
                          disabled={isArchived}
                          value={raw.adjustmentRaw}
                          onChange={(e) =>
                            handleLineChange(lineId, 'adjustmentRaw', e.target.value)
                          }
                          placeholder={lineId === 9 ? 'غير قابل للخصم' : '0.00'}
                          className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0e1015] px-3 py-2 text-left font-mono-tabular text-sm"
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
                          className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0e1015] px-3 py-2 text-left font-mono-tabular text-sm"
                        />
                        {comp.vatInputError && (
                          <p className="text-[11px] text-rose-600 mt-1">
                            {comp.vatInputError}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-[#14161b] rounded-lg px-3 py-2">
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

      {/* Conditional Review Fields + Net Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 glass-panel rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            ملاحظات المراجعة والضوابط
          </h2>

          {evalResult.needsItem14Details && (
            <div className="space-y-2.5 p-3 rounded-xl bg-slate-50 dark:bg-[#14161b] border border-slate-200 dark:border-white/10">
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
                    className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0e1015] px-3 py-1.5 text-xs"
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
                    className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0e1015] px-3 py-1.5 text-xs"
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
                placeholder="سبب تجاوز التعديل للمبلغ..."
                className="w-full rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-[#0e1015] px-3 py-1.5 text-xs"
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

          <div className="pt-3 border-t border-slate-200 dark:border-white/10 flex items-center justify-between gap-2">
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

      {/* Saved Drafts & Archive with Share/Print/Download + Filtered Export */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-white/10">
          <button
            type="button"
            onClick={() => setArchiveOpen(!archiveOpen)}
            className="flex items-center gap-2 text-right"
          >
            {archiveOpen ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            )}
            <FolderOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              المسودات المحفوظة والأرشيف (
              <span className="font-mono-tabular">{filteredArchive.length}</span>)
            </span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={filteredArchive.length === 0}
              onClick={() => {
                downloadVat3AArchiveExcel(filteredArchive);
                showToast('تم تصدير الأرشيف المفلتر إلى Excel.');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
              <span>تصدير الأرشيف Excel</span>
            </button>
            <button
              type="button"
              disabled={filteredArchive.length === 0}
              onClick={() => {
                downloadVat3AArchivePdf(filteredArchive);
                showToast('تم تصدير الأرشيف المفلتر إلى PDF.');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-rose-500" />
              <span>تصدير الأرشيف PDF</span>
            </button>
          </div>
        </div>

        {archiveOpen && (
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="search"
                value={archiveFilters.search}
                onChange={(e) => updateVatArchiveFilters({ search: e.target.value })}
                placeholder="بحث فوري بالمنشأة أو الرقم الضريبي أو الفترة..."
                className="h-9 px-3 rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] text-xs"
              />
              <select
                value={archiveFilters.entityName}
                onChange={(e) => updateVatArchiveFilters({ entityName: e.target.value })}
                className="h-9 px-2.5 rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] text-xs"
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
                className="h-9 px-2.5 rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] text-xs"
              >
                <option value="الكل">الحالة: الكل</option>
                <option value="مسودة">مسودة</option>
                <option value="قيد المراجعة">قيد المراجعة</option>
                <option value="مؤرشفة">مؤرشفة</option>
              </select>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-white/10">
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
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-2 mt-0.5 font-mono-tabular">
                      <span>
                        الفترة: {formatDisplayDate(item.periodStart, showHijri)} ←{' '}
                        {formatDisplayDate(item.periodEnd, showHijri)}
                      </span>
                      <span>·</span>
                      <span dir="ltr" className="font-semibold">
                        الصافي: {formatHalalas(item.computedNetHalalas)} ر.س
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge
                      label={item.status}
                      tone={item.status === 'مؤرشفة' ? 'neutral' : 'success'}
                    />
                    <button
                      type="button"
                      onClick={() => handleOpenSavedDraft(item)}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/15 text-xs font-medium hover:bg-slate-100 dark:hover:bg-white/10"
                    >
                      فتح
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShareDraft(item)}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-white/15 text-xs text-blue-600 dark:text-blue-400 hover:bg-slate-100 dark:hover:bg-white/10"
                      title="مشاركة"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePrintDraft(item)}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-white/15 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"
                      title="طباعة"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        downloadVat3APdf(item);
                        showToast('تم تحميل PDF للسجل.');
                      }}
                      className="px-2 py-1 rounded-lg border border-slate-200 dark:border-white/15 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-slate-100 dark:hover:bg-white/10"
                      title="تحميل PDF"
                    >
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        downloadVat3AExcel(item);
                        showToast('تم تحميل Excel للسجل.');
                      }}
                      className="px-2 py-1 rounded-lg border border-slate-200 dark:border-white/15 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-slate-100 dark:hover:bg-white/10"
                      title="تحميل Excel"
                    >
                      Excel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Printable A4 Sheet (hidden on screen, shown in @media print) */}
      <div id="vat3a-print-sheet" className="hidden print:block text-black bg-white p-6">
        <div className="border-b-2 border-emerald-700 pb-3 mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">حقيبة المهام — نموذج ضريبة القيمة المضافة 3A</h2>
            <p className="text-xs text-slate-600">
              مسودة للمراجعة الداخلية · إصدار القواعد: {activePrintDraft.calcRulesVersion}
            </p>
          </div>
          <div className="text-xs font-mono-tabular text-left">
            <div>المنشأة: {activePrintDraft.entityName}</div>
            <div>الرقم الضريبي: {activePrintDraft.taxRegistrationNumber || '—'}</div>
            <div>
              الفترة: {activePrintDraft.periodStart} ← {activePrintDraft.periodEnd}
            </div>
          </div>
        </div>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 border border-slate-300">
              <th className="p-2 text-right border border-slate-300">البند</th>
              <th className="p-2 text-left border border-slate-300">المبلغ (ر.س)</th>
              <th className="p-2 text-left border border-slate-300">التعديل (ر.س)</th>
              <th className="p-2 text-left border border-slate-300">الضريبة (ر.س)</th>
            </tr>
          </thead>
          <tbody>
            {VAT_3A_LINE_DEFINITIONS.map((def) => {
              const line = activePrintEval.lines[def.id];
              return (
                <tr key={`pr-${def.id}`} className="border border-slate-300">
                  <td className="p-1.5 border border-slate-300">
                    {def.id}. {def.name}
                  </td>
                  <td className="p-1.5 text-left font-mono-tabular border border-slate-300" dir="ltr">
                    {def.vatDirectInput ? '—' : formatHalalas(line.amountHalalas)}
                  </td>
                  <td className="p-1.5 text-left font-mono-tabular border border-slate-300" dir="ltr">
                    {def.vatDirectInput ? '—' : formatHalalas(line.adjustmentHalalas)}
                  </td>
                  <td className="p-1.5 text-left font-mono-tabular font-bold border border-slate-300" dir="ltr">
                    {formatHalalas(line.vatHalalas)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-4 pt-3 border-t border-slate-300 flex items-center justify-between text-sm font-bold">
          <span>الحالة: {activePrintEval.netStatusLabel}</span>
          <span dir="ltr" className="font-mono-tabular">
            {formatHalalas(activePrintEval.v16Halalas)} ر.س
          </span>
        </div>
      </div>

      {/* Copy to New Period Modal */}
      {copyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <form
            onSubmit={handleCopyToNewPeriod}
            className="glass-panel max-w-md w-full rounded-2xl p-5 space-y-4"
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              نسخ النموذج لفترة جديدة
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              سيُنسخ النموذج وفق إعدادات 3A الحالية مع إعادة البندين 14 و15 إلى الصفر لمراجعتهما.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">بداية الفترة الجديدة</label>
                <input
                  type="date"
                  lang="en"
                  dir="ltr"
                  value={copyStart}
                  onChange={(e) => setCopyStart(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] px-3 py-2 text-xs font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">نهاية الفترة الجديدة</label>
                <input
                  type="date"
                  lang="en"
                  dir="ltr"
                  value={copyEnd}
                  onChange={(e) => setCopyEnd(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] px-3 py-2 text-xs font-mono-tabular"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
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
                className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/15 text-xs font-medium"
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

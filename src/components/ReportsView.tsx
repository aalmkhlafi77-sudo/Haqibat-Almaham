import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Lock,
  PieChart,
  RotateCcw,
  Share2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  evaluateDocumentHealth,
  evaluatePoaHealth,
  evaluateTaskDelay,
  formatDisplayDate,
  getTodayISO,
  toEnglishDigits,
} from '../domain/dateUtils';
import {
  buildReportShareSummaryText,
  downloadReportExcel,
  downloadReportPdf,
  type ReportExportSnapshot,
} from '../domain/reportExport';
import { RecordType } from '../types/domain';
import { ArabicDatePicker } from './ArabicDatePicker';
import { StatusBadge } from './StatusBadge';

type OperationTypeFilter = 'الكل' | 'مهام' | 'وثائق' | 'جلسات' | 'وكالات' | 'تقويم';

interface NormalizedReportRow {
  id: string;
  recordType: RecordType;
  title: string;
  operationType: Exclude<OperationTypeFilter, 'الكل'>;
  statusLabel: string;
  dateISO: string;
  specialistId: string | null;
  specialistName: string;
  departmentName: string;
  isDone: boolean;
  isUrgentOrOverdue: boolean;
}

const STATUS_PALETTE: Array<{ match: string; color: string }> = [
  { match: 'مكتملة', color: '#10b981' },
  { match: 'منعقدة', color: '#10b981' },
  { match: 'سارية', color: '#14b8a6' },
  { match: 'قيد التنفيذ', color: '#3b82f6' },
  { match: 'جديدة', color: '#0ea5e9' },
  { match: 'مجدولة', color: '#8b5cf6' },
  { match: 'قريبة الانتهاء', color: '#f59e0b' },
  { match: 'معلقة', color: '#f59e0b' },
  { match: 'متأخرة', color: '#ef4444' },
  { match: 'منتهية', color: '#ef4444' },
  { match: 'مفسوخة', color: '#f43f5e' },
  { match: 'ملغاة', color: '#64748b' },
  { match: 'مؤرشفة', color: '#64748b' },
];

function getStatusColor(status: string, idx: number): string {
  const found = STATUS_PALETTE.find((p) => status.includes(p.match));
  if (found) return found.color;
  const fallback = ['#3b82f6', '#8b5cf6', '#14b8a6', '#f59e0b', '#ec4899', '#6366f1'];
  return fallback[idx % fallback.length];
}

export const ReportsView: React.FC = () => {
  const { db, authMode, hasPerm, openRecord, openShareModal, showToast, assistantHandoff, setAssistantHandoff } = useApp();
  const today = getTodayISO();
  const showHijri = db.preferences.showHijri;
  const warningDays = db.preferences.documentWarningDays;
  const canExport = hasPerm('reports:export');

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [specialistId, setSpecialistId] = useState<string>('الكل');
  const [departmentName, setDepartmentName] = useState<string>('الكل');
  const [operationType, setOperationType] = useState<OperationTypeFilter>('الكل');
  const [statusFilter, setStatusFilter] = useState<string>('الكل');
  const [barMode, setBarMode] = useState<'specialist' | 'month'>('specialist');
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<'pdf' | 'excel' | null>(null);

  useEffect(() => {
    if (assistantHandoff?.kind !== 'report') return;
    setFromDate(assistantHandoff.fromDate || '');
    setToDate(assistantHandoff.toDate || '');
    setSpecialistId(assistantHandoff.specialistId || 'الكل');
    setDepartmentName('الكل');
    setOperationType('الكل');
    setStatusFilter('الكل');
    setAssistantHandoff(null);
  }, [assistantHandoff, setAssistantHandoff]);

  const getSpecialist = (id: string | null) =>
    db.specialists.find((s) => s.id === id) || null;

  const allRecords = useMemo<NormalizedReportRow[]>(() => {
    const rows: NormalizedReportRow[] = [];

    for (const t of db.tasks) {
      if (t.archivedAt) continue;
      const sp = getSpecialist(t.specialistId);
      const delay = evaluateTaskDelay(t, today);
      const statusLabel = delay.isOverdue ? 'متأخرة' : t.status;
      rows.push({
        id: t.id,
        recordType: 'task',
        title: t.title,
        operationType: 'مهام',
        statusLabel,
        dateISO: t.dueDate,
        specialistId: t.specialistId,
        specialistName: sp?.name || 'غير مسند',
        departmentName: t.departmentName || sp?.departmentName || 'عام',
        isDone: t.status === 'مكتملة',
        isUrgentOrOverdue: delay.isOverdue,
      });
    }

    for (const d of db.documents) {
      const sp = getSpecialist(d.specialistId);
      const h = evaluateDocumentHealth(d, warningDays, today);
      const statusLabel =
        h.category === 'تنتهي اليوم' ? 'قريبة الانتهاء' : h.filterBucket;
      rows.push({
        id: d.id,
        recordType: 'document',
        title: d.name,
        operationType: 'وثائق',
        statusLabel,
        dateISO: d.expiryDate || d.issueDate || d.createdAt.slice(0, 10),
        specialistId: d.specialistId,
        specialistName: sp?.name || 'غير مسند',
        departmentName: sp?.departmentName || 'الوثائق والتراخيص',
        isDone: h.category === 'سارية',
        isUrgentOrOverdue: h.category === 'منتهية' || h.category === 'تنتهي اليوم' || h.category === 'قريبة الانتهاء',
      });
    }

    for (const s of db.sessions) {
      const sp = getSpecialist(s.specialistId);
      rows.push({
        id: s.id,
        recordType: 'session',
        title: s.title,
        operationType: 'جلسات',
        statusLabel: s.status,
        dateISO: s.scheduledAt.slice(0, 10),
        specialistId: s.specialistId,
        specialistName: sp?.name || 'غير مسند',
        departmentName: sp?.departmentName || 'القانونية',
        isDone: s.status === 'منعقدة',
        isUrgentOrOverdue: s.status === 'مجدولة' && s.scheduledAt.slice(0, 10) < today,
      });
    }

    for (const p of db.poas) {
      if (p.archivedAt) continue;
      const sp = getSpecialist(p.specialistId);
      const ph = evaluatePoaHealth(p, warningDays, today);
      const statusLabel =
        p.statusOverride === 'مفسوخة'
          ? 'مفسوخة'
          : ph.isExpired
          ? 'منتهية'
          : ph.isUrgent
          ? 'قريبة الانتهاء'
          : 'سارية';
      rows.push({
        id: p.id,
        recordType: 'poa',
        title: p.title,
        operationType: 'وكالات',
        statusLabel,
        dateISO: p.expiryDate || p.issueDate,
        specialistId: p.specialistId,
        specialistName: sp?.name || 'غير مسند',
        departmentName: sp?.departmentName || 'القانونية',
        isDone: statusLabel === 'سارية',
        isUrgentOrOverdue: ph.isExpired || ph.isUrgent,
      });
    }

    for (const ci of db.calendarItems) {
      const sp = getSpecialist(ci.specialistId);
      rows.push({
        id: ci.id,
        recordType: 'calendar_item',
        title: ci.title,
        operationType: 'تقويم',
        statusLabel: ci.isDone ? 'مكتملة' : 'مجدولة',
        dateISO: ci.scheduledAt.slice(0, 10),
        specialistId: ci.specialistId,
        specialistName: sp?.name || 'غير مسند',
        departmentName: sp?.departmentName || 'التنسيق والمتابعة',
        isDone: ci.isDone,
        isUrgentOrOverdue: !ci.isDone && ci.scheduledAt.slice(0, 10) < today,
      });
    }

    return rows.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  }, [db.tasks, db.documents, db.sessions, db.poas, db.calendarItems, db.specialists, today, warningDays]);

  const departmentOptions = useMemo(
    () => Array.from(new Set(allRecords.map((r) => r.departmentName))),
    [allRecords]
  );

  const statusOptions = useMemo(
    () => Array.from(new Set(allRecords.map((r) => r.statusLabel))),
    [allRecords]
  );

  const filteredRecords = useMemo(() => {
    return allRecords.filter((r) => {
      if (fromDate && r.dateISO < fromDate) return false;
      if (toDate && r.dateISO > toDate) return false;
      if (specialistId !== 'الكل' && r.specialistId !== specialistId) return false;
      if (departmentName !== 'الكل' && r.departmentName !== departmentName) return false;
      if (operationType !== 'الكل' && r.operationType !== operationType) return false;
      if (statusFilter !== 'الكل' && r.statusLabel !== statusFilter) return false;
      return true;
    });
  }, [allRecords, fromDate, toDate, specialistId, departmentName, operationType, statusFilter]);

  const totalCount = filteredRecords.length;
  const doneCount = filteredRecords.filter((r) => r.isDone).length;
  const urgentCount = filteredRecords.filter((r) => r.isUrgentOrOverdue).length;
  const activeRemainingCount = totalCount - doneCount;

  // Pie / Donut breakdown by status (strictly sums to totalCount)
  const statusSlices = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of filteredRecords) {
      counts.set(r.statusLabel, (counts.get(r.statusLabel) || 0) + 1);
    }
    const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    let offset = 0;
    const radius = 56;
    const circumference = 2 * Math.PI * radius;

    return entries.map(([label, count], idx) => {
      const pct = totalCount > 0 ? (count / totalCount) * 100 : 0;
      const strokeLen = totalCount > 0 ? (count / totalCount) * circumference : 0;
      const slice = {
        label,
        count,
        pct,
        color: getStatusColor(label, idx),
        dashArray: `${strokeLen} ${circumference}`,
        dashOffset: -offset,
      };
      offset += strokeLen;
      return slice;
    });
  }, [filteredRecords, totalCount]);

  // Bar breakdown by specialist or YYYY-MM period (strictly sums to totalCount)
  const barItems = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of filteredRecords) {
      const key =
        barMode === 'specialist'
          ? r.specialistName
          : r.dateISO
          ? r.dateISO.slice(0, 7)
          : 'غير محدد';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const arr = Array.from(counts.entries()).map(([label, count]) => ({
      label,
      count,
    }));
    if (barMode === 'month') {
      arr.sort((a, b) => a.label.localeCompare(b.label));
    } else {
      arr.sort((a, b) => b.count - a.count);
    }
    const maxCount = arr.reduce((m, x) => Math.max(m, x.count), 0);
    return { arr, maxCount };
  }, [filteredRecords, barMode]);

  const resetFilters = () => {
    setFromDate('');
    setToDate('');
    setSpecialistId('الكل');
    setDepartmentName('الكل');
    setOperationType('الكل');
    setStatusFilter('الكل');
  };

  const buildReportSnapshot = (): ReportExportSnapshot => {
    const selectedSpec =
      specialistId === 'الكل'
        ? 'الكل'
        : db.specialists.find((s) => s.id === specialistId)?.name || 'غير محدد';

    return {
      generatedAt: new Date().toISOString().slice(0, 19),
      showHijri,
      filters: {
        fromDate,
        toDate,
        specialistId,
        specialistName: selectedSpec,
        departmentName,
        operationType,
        statusFilter,
      },
      summary: {
        totalCount,
        doneCount,
        urgentCount,
        activeRemainingCount,
      },
      barMode,
      statusSlices: statusSlices.map((s) => ({
        label: s.label,
        count: s.count,
        pct: s.pct,
        color: s.color,
      })),
      barItems: barItems.arr,
      rows: filteredRecords,
    };
  };

  const verifyServerExportPermission = async (format: 'pdf' | 'excel', rowCount: number) => {
    if (authMode !== 'server') return true;
    try {
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ format, rowCount }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        showToast(err.error || 'الخادم رفض تصدير التقرير لعدم توفر الصلاحية.');
        return false;
      }
      return true;
    } catch {
      showToast('تعذر التحقق من صلاحية التصدير على الخادم.');
      return false;
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadMenuOpen(false);
    if (!canExport) {
      showToast('صلاحيات حسابك الحالي لا تسمح بتنزيل التقارير.');
      return;
    }
    setExportingFormat('pdf');
    try {
      const snapshot = buildReportSnapshot();
      const allowed = await verifyServerExportPermission('pdf', snapshot.rows.length);
      if (!allowed) return;
      await downloadReportPdf(snapshot);
      showToast(`تم تنزيل التقرير بصيغة PDF (${toEnglishDigits(String(snapshot.rows.length))} سجل).`);
    } finally {
      setExportingFormat(null);
    }
  };

  const handleDownloadExcel = async () => {
    setDownloadMenuOpen(false);
    if (!canExport) {
      showToast('صلاحيات حسابك الحالي لا تسمح بتنزيل التقارير.');
      return;
    }
    setExportingFormat('excel');
    try {
      const snapshot = buildReportSnapshot();
      const allowed = await verifyServerExportPermission('excel', snapshot.rows.length);
      if (!allowed) return;
      downloadReportExcel(snapshot);
      showToast(`تم تنزيل التقرير بصيغة Excel (${toEnglishDigits(String(snapshot.rows.length))} سجل).`);
    } finally {
      setExportingFormat(null);
    }
  };

  const handleShareReport = () => {
    if (!canExport) {
      showToast('صلاحيات حسابك الحالي لا تسمح بمشاركة التقارير.');
      return;
    }
    const snapshot = buildReportSnapshot();
    const periodDesc =
      fromDate || toDate
        ? `${fromDate || '...'} ← ${toDate || '...'}`
        : 'كامل الفترات';
    openShareModal({
      recordType: 'report',
      recordId: `rep-${snapshot.generatedAt.slice(0, 10)}`,
      recordTitle: `تقرير العمليات والإحصاءات (${toEnglishDigits(String(snapshot.summary.totalCount))} سجل)`,
      specialistId: specialistId !== 'الكل' ? specialistId : null,
      scheduledInfo: `${periodDesc} · ${snapshot.filters.specialistName}`,
      defaultMessage: buildReportShareSummaryText(snapshot),
      reportSnapshot: snapshot,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            <span>التقارير والإحصاءات</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            مؤشرات ورسوم بيانية تفاعلية من السجلات الفعلية المحفوظة مع تطابق تام للأعداد عند التصفية
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleShareReport}
            disabled={!canExport}
            title={canExport ? 'مشاركة التقرير المفلتر' : 'يتطلب صلاحية تصدير التقارير'}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 text-xs font-semibold whitespace-nowrap shrink-0"
          >
            {canExport ? <Share2 className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            <span>مشاركة التقرير</span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (!canExport) {
                  showToast('صلاحيات حسابك الحالي لا تسمح بتنزيل التقارير.');
                  return;
                }
                setDownloadMenuOpen((prev) => !prev);
              }}
              disabled={!canExport || exportingFormat !== null}
              aria-expanded={downloadMenuOpen}
              aria-haspopup="menu"
              title={canExport ? 'تنزيل التقرير بصيغة PDF أو Excel' : 'يتطلب صلاحية تصدير التقارير'}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {canExport ? <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Lock className="w-3.5 h-3.5" />}
              <span>
                {exportingFormat === 'pdf'
                  ? 'جارٍ إعداد PDF...'
                  : exportingFormat === 'excel'
                  ? 'جارٍ إعداد Excel...'
                  : 'تنزيل التقرير'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            </button>

            {downloadMenuOpen && (
              <div
                role="menu"
                className="absolute left-0 top-11 z-40 w-60 glass-panel rounded-xl shadow-2xl p-1.5 space-y-1"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleDownloadPdf}
                  className="w-full text-right px-3 py-2 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>تنزيل PDF (عربي من اليمين لليسار)</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleDownloadExcel}
                  className="w-full text-right px-3 py-2 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10 flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>تنزيل Excel (.xlsx)</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>إعادة ضبط الفلاتر</span>
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      <div className="glass-panel rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
          <Filter className="w-3.5 h-3.5 text-sky-500" />
          <span>تصفية التقارير (الفترة، المختص، القسم، نوع العملية، الحالة)</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              من تاريخ
            </label>
            <ArabicDatePicker
              mode="date"
              showHijri={showHijri}
              value={fromDate}
              onChange={setFromDate}
              ariaLabel="من تاريخ"
              className="h-9 !py-1 text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              إلى تاريخ
            </label>
            <ArabicDatePicker
              mode="date"
              showHijri={showHijri}
              value={toDate}
              onChange={setToDate}
              ariaLabel="إلى تاريخ"
              className="h-9 !py-1 text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              المختص
            </label>
            <select
              value={specialistId}
              onChange={(e) => setSpecialistId(e.target.value)}
              className="w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] text-xs"
            >
              <option value="الكل">الكل</option>
              {db.specialists.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              القسم
            </label>
            <select
              value={departmentName}
              onChange={(e) => setDepartmentName(e.target.value)}
              className="w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] text-xs"
            >
              <option value="الكل">الكل</option>
              {departmentOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              نوع العملية
            </label>
            <select
              value={operationType}
              onChange={(e) => setOperationType(e.target.value as OperationTypeFilter)}
              className="w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] text-xs"
            >
              <option value="الكل">الكل</option>
              <option value="مهام">مهام</option>
              <option value="وثائق">وثائق</option>
              <option value="جلسات">جلسات</option>
              <option value="وكالات">وكالات</option>
              <option value="تقويم">أحداث وتذكيرات</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              الحالة
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] text-xs"
            >
              <option value="الكل">الكل</option>
              {statusOptions.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-panel rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">إجمالي السجلات المطابقة</div>
          <div className="text-2xl font-bold font-mono-tabular text-slate-900 dark:text-white mt-1">
            {toEnglishDigits(String(totalCount))}
          </div>
        </div>
        <div className="glass-panel rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">مكتملة / منعقدة / سارية</div>
          <div className="text-2xl font-bold font-mono-tabular text-emerald-600 dark:text-emerald-400 mt-1">
            {toEnglishDigits(String(doneCount))}
          </div>
        </div>
        <div className="glass-panel rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">متأخرة / منتهية / قريبة</div>
          <div className="text-2xl font-bold font-mono-tabular text-rose-600 dark:text-rose-400 mt-1">
            {toEnglishDigits(String(urgentCount))}
          </div>
        </div>
        <div className="glass-panel rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">سجلات مفتوحة ومجدولة</div>
          <div className="text-2xl font-bold font-mono-tabular text-blue-600 dark:text-blue-400 mt-1">
            {toEnglishDigits(String(activeRemainingCount))}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Donut / Pie Chart by Status */}
        <div className="lg:col-span-5 glass-panel rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-sky-500" />
              <span>توزيع السجلات حسب الحالة</span>
            </h2>
            <span className="text-xs font-mono-tabular text-slate-500 dark:text-slate-400">
              المجموع: {toEnglishDigits(String(totalCount))}
            </span>
          </div>

          {totalCount === 0 ? (
            <p className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
              لا توجد بيانات لعرض الرسم الدائري.
            </p>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-5">
              <div className="relative w-40 h-40 shrink-0">
                <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
                  <circle
                    cx="70"
                    cy="70"
                    r="56"
                    fill="none"
                    stroke="currentColor"
                    className="text-slate-100 dark:text-white/10"
                    strokeWidth="18"
                  />
                  {statusSlices.map((s) => (
                    <circle
                      key={s.label}
                      cx="70"
                      cy="70"
                      r="56"
                      fill="none"
                      stroke={s.color}
                      strokeWidth="18"
                      strokeDasharray={s.dashArray}
                      strokeDashoffset={s.dashOffset}
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-bold font-mono-tabular text-slate-900 dark:text-white">
                    {toEnglishDigits(String(totalCount))}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">سجل</span>
                </div>
              </div>

              <div className="flex-1 w-full space-y-2">
                {statusSlices.map((s) => (
                  <div
                    key={`leg-${s.label}`}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="truncate text-slate-700 dark:text-slate-200">
                        {s.label}
                      </span>
                    </div>
                    <span className="font-mono-tabular font-semibold text-slate-900 dark:text-white shrink-0">
                      {toEnglishDigits(String(s.count))} (
                      {toEnglishDigits(s.pct.toFixed(0))}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bar Chart by Specialist or Period */}
        <div className="lg:col-span-7 glass-panel rounded-xl p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              <span>التوزيع بالأعمدة</span>
            </h2>
            <div className="inline-flex rounded-xl p-0.5 bg-slate-100 dark:bg-[#14161b] border border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => setBarMode('specialist')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                  barMode === 'specialist'
                    ? 'bg-white dark:bg-white/15 text-blue-700 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                حسب المختص
              </button>
              <button
                type="button"
                onClick={() => setBarMode('month')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                  barMode === 'month'
                    ? 'bg-white dark:bg-white/15 text-blue-700 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                حسب الفترة
              </button>
            </div>
          </div>

          {barItems.arr.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
              لا توجد بيانات مطابقة لعرض الأعمدة.
            </p>
          ) : (
            <div className="space-y-2.5">
              {barItems.arr.map((b) => {
                const widthPct =
                  barItems.maxCount > 0 ? Math.max(4, (b.count / barItems.maxCount) * 100) : 0;
                return (
                  <div key={b.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800 dark:text-slate-200 font-mono-tabular truncate">
                        {b.label}
                      </span>
                      <span className="font-bold font-mono-tabular text-slate-900 dark:text-white">
                        {toEnglishDigits(String(b.count))}
                      </span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-l from-blue-500 to-sky-400 transition-all duration-300"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Details Table */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            جدول التفاصيل (<span className="font-mono-tabular">{toEnglishDigits(String(totalCount))}</span>)
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            انقر على أي صف لفتح تفاصيل السجل
          </span>
        </div>

        {filteredRecords.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            لا توجد سجلات مطابقة لمعايير التصفية الحالية.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#14161b] text-xs font-bold text-slate-600 dark:text-slate-300">
                  <th className="text-right py-2.5 px-4">العنوان</th>
                  <th className="text-right py-2.5 px-3">العملية</th>
                  <th className="text-right py-2.5 px-3">المختص</th>
                  <th className="text-right py-2.5 px-3">القسم</th>
                  <th className="text-right py-2.5 px-3">التاريخ</th>
                  <th className="text-right py-2.5 px-4">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                {filteredRecords.map((row) => (
                  <tr
                    key={`${row.recordType}-${row.id}`}
                    onClick={() => openRecord(row.recordType, row.id)}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                  >
                    <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">
                      {row.title}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-slate-600 dark:text-slate-300">
                      {row.operationType}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-slate-600 dark:text-slate-300">
                      {row.specialistName}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-slate-600 dark:text-slate-300">
                      {row.departmentName}
                    </td>
                    <td className="py-2.5 px-3 text-xs font-mono-tabular text-slate-600 dark:text-slate-300">
                      {formatDisplayDate(row.dateISO, showHijri)}
                    </td>
                    <td className="py-2.5 px-4">
                      <StatusBadge
                        label={row.statusLabel}
                        tone={
                          row.isUrgentOrOverdue
                            ? 'danger'
                            : row.isDone
                            ? 'success'
                            : 'info'
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

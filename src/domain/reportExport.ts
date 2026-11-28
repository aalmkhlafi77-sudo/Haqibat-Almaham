import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { formatDisplayDate, toEnglishDigits } from './dateUtils';
import type { RecordType } from '../types/domain';

export interface ReportExportRow {
  id: string;
  recordType: RecordType;
  title: string;
  operationType: string;
  statusLabel: string;
  dateISO: string;
  specialistId: string | null;
  specialistName: string;
  departmentName: string;
  isDone: boolean;
  isUrgentOrOverdue: boolean;
}

export interface ReportExportSlice {
  label: string;
  count: number;
  pct: number;
  color: string;
}

export interface ReportExportBarItem {
  label: string;
  count: number;
}

export interface ReportExportSnapshot {
  generatedAt: string;
  showHijri: boolean;
  filters: {
    fromDate: string;
    toDate: string;
    specialistId: string;
    specialistName: string;
    departmentName: string;
    operationType: string;
    statusFilter: string;
    documentCategory?: string;
  };
  summary: {
    totalCount: number;
    doneCount: number;
    urgentCount: number;
    activeRemainingCount: number;
  };
  barMode: 'specialist' | 'month';
  statusSlices: ReportExportSlice[];
  barItems: ReportExportBarItem[];
  rows: ReportExportRow[];
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function formatPeriodText(snapshot: ReportExportSnapshot): string {
  const { fromDate, toDate } = snapshot.filters;
  if (fromDate && toDate) {
    return `من ${formatDisplayDate(fromDate, snapshot.showHijri)} إلى ${formatDisplayDate(toDate, snapshot.showHijri)}`;
  }
  if (fromDate) {
    return `من ${formatDisplayDate(fromDate, snapshot.showHijri)} حتى الآن`;
  }
  if (toDate) {
    return `حتى ${formatDisplayDate(toDate, snapshot.showHijri)}`;
  }
  return 'كامل الفترات المسجلة';
}

function truncateTextToWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}…`;
}

/**
 * Generates an Excel (.xlsx) workbook with RTL sheet direction,
 * matching screen KPI summary, applied filters, chart breakdowns, and table rows.
 */
export function buildReportExcelBuffer(snapshot: ReportExportSnapshot): ArrayBuffer {
  const periodLabel = formatPeriodText(snapshot);
  const rows: Array<Array<string | number>> = [
    ['حقيبة المهام — تقرير العمليات والإحصاءات'],
    ['تاريخ التصدير', snapshot.generatedAt.slice(0, 16).replace('T', ' ')],
    ['الفترة', periodLabel],
    [
      'المختص',
      snapshot.filters.specialistName,
      'القسم',
      snapshot.filters.departmentName,
      'نوع العملية',
      snapshot.filters.operationType,
      'الحالة',
      snapshot.filters.statusFilter,
    ],
    ['تصنيف الوثائق', snapshot.filters.documentCategory || 'الكل'],
    [],
    ['ملخص النتائج (مطابق للشاشة)'],
    [
      'إجمالي السجلات المطابقة',
      snapshot.summary.totalCount,
      'مكتملة / منعقدة / سارية',
      snapshot.summary.doneCount,
      'متأخرة / منتهية / قريبة',
      snapshot.summary.urgentCount,
      'سجلات مفتوحة ومجدولة',
      snapshot.summary.activeRemainingCount,
    ],
    [],
    ['العنوان', 'العملية', 'المختص', 'القسم', 'التاريخ', 'الحالة'],
  ];

  for (const r of snapshot.rows) {
    rows.push([
      r.title,
      r.operationType,
      r.specialistName,
      r.departmentName,
      formatDisplayDate(r.dateISO, snapshot.showHijri),
      r.statusLabel,
    ]);
  }

  const wsMain = XLSX.utils.aoa_to_sheet(rows);
  wsMain['!cols'] = [
    { wch: 38 },
    { wch: 16 },
    { wch: 22 },
    { wch: 22 },
    { wch: 20 },
    { wch: 18 },
    { wch: 22 },
    { wch: 14 },
  ];

  const breakdownRows: Array<Array<string | number>> = [
    ['ملخص توزيع السجلات — مطابق للرسوم البيانية'],
    ['إجمالي السجلات', snapshot.summary.totalCount],
    [],
    ['توزيع السجلات حسب الحالة', 'العدد', 'النسبة المئوية'],
    ...snapshot.statusSlices.map((s) => [s.label, s.count, `${Math.round(s.pct)}%`]),
    [],
    [
      snapshot.barMode === 'specialist' ? 'التوزيع حسب المختص' : 'التوزيع حسب الفترة',
      'العدد',
    ],
    ...snapshot.barItems.map((b) => [b.label, b.count]),
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(breakdownRows);
  wsSummary['!cols'] = [{ wch: 34 }, { wch: 14 }, { wch: 16 }];

  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, wsMain, 'التقرير المفصل');
  XLSX.utils.book_append_sheet(wb, wsSummary, 'ملخص التوزيع');
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

export function getReportFileBaseName(snapshot: ReportExportSnapshot): string {
  const dateTag = snapshot.generatedAt.slice(0, 10);
  return `Haqibat_Report_${dateTag}`;
}

export function downloadReportExcel(snapshot: ReportExportSnapshot): string {
  const buf = buildReportExcelBuffer(snapshot);
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const filename = `${getReportFileBaseName(snapshot)}.xlsx`;
  triggerBlobDownload(blob, filename);
  return filename;
}

/**
 * Generates an A4 RTL Arabic PDF containing title, period, filters, KPI summary,
 * donut + bar charts, and paginated results table.
 */
export async function buildReportPdfBlob(snapshot: ReportExportSnapshot): Promise<Blob> {
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // proceed with system fallback font
    }
  }

  const width = 794; // A4 @ 96dpi
  const height = 1123;
  const scale = 2;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [width, height] });

  const makePageCanvas = () => {
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.direction = 'rtl';
    return { canvas, ctx };
  };

  // --- PAGE 1 ---
  let { canvas, ctx } = makePageCanvas();

  // Header band
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(32, 28, width - 64, 66);
  ctx.fillStyle = '#0ea5e9';
  ctx.fillRect(32, 28, 8, 66);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 19px Cairo, "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText('حقيبة المهام — تقرير العمليات والإحصاءات', width - 48, 56);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '11px Cairo, "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(
    `تاريخ التصدير: ${toEnglishDigits(snapshot.generatedAt.slice(0, 16).replace('T', ' '))}  ·  عدد النتائج: ${toEnglishDigits(String(snapshot.summary.totalCount))}`,
    width - 48,
    78
  );

  // Period & Filters summary box
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.fillRect(32, 106, width - 64, 58);
  ctx.strokeRect(32, 106, width - 64, 58);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 12px Cairo, "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(`الفترة: ${formatPeriodText(snapshot)}`, width - 46, 128);
  ctx.fillStyle = '#334155';
  ctx.font = '11px Cairo, "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(
    `الفلاتر: المختص (${snapshot.filters.specialistName})  ·  القسم (${snapshot.filters.departmentName})  ·  العملية (${snapshot.filters.operationType})  ·  الحالة (${snapshot.filters.statusFilter})  ·  تصنيف الوثائق (${snapshot.filters.documentCategory || 'الكل'})`,
    width - 46,
    150,
    width - 92
  );

  // 4 KPI Boxes (from right to left in RTL)
  const kpis = [
    {
      label: 'إجمالي السجلات المطابقة',
      value: snapshot.summary.totalCount,
      color: '#0f172a',
      bg: '#f1f5f9',
      border: '#cbd5e1',
    },
    {
      label: 'مكتملة / منعقدة / سارية',
      value: snapshot.summary.doneCount,
      color: '#047857',
      bg: '#ecfdf5',
      border: '#a7f3d0',
    },
    {
      label: 'متأخرة / منتهية / قريبة',
      value: snapshot.summary.urgentCount,
      color: '#be123c',
      bg: '#fff1f2',
      border: '#fecdd3',
    },
    {
      label: 'سجلات مفتوحة ومجدولة',
      value: snapshot.summary.activeRemainingCount,
      color: '#1d4ed8',
      bg: '#eff6ff',
      border: '#bfdbfe',
    },
  ];
  const boxGap = 10;
  const boxWidth = (width - 64 - boxGap * 3) / 4;
  kpis.forEach((k, idx) => {
    const x = width - 32 - boxWidth * (idx + 1) - boxGap * idx;
    const y = 176;
    ctx.fillStyle = k.bg;
    ctx.strokeStyle = k.border;
    ctx.fillRect(x, y, boxWidth, 56);
    ctx.strokeRect(x, y, boxWidth, 56);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#475569';
    ctx.font = '10px Cairo, "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText(k.label, x + boxWidth - 10, y + 19);

    ctx.fillStyle = k.color;
    ctx.font = 'bold 20px "IBM Plex Mono", monospace';
    ctx.fillText(toEnglishDigits(String(k.value)), x + boxWidth - 10, y + 45);
  });

  // Charts Section (Donut on right, Bar chart on left)
  const chartsY = 246;
  const chartsH = 196;
  const rightChartW = 310;
  const leftChartW = width - 64 - rightChartW - 12;
  const rightChartX = width - 32 - rightChartW;
  const leftChartX = 32;

  // Donut box
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#cbd5e1';
  ctx.fillRect(rightChartX, chartsY, rightChartW, chartsH);
  ctx.strokeRect(rightChartX, chartsY, rightChartW, chartsH);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 12px Cairo, "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText('توزيع السجلات حسب الحالة', rightChartX + rightChartW - 12, chartsY + 20);

  if (snapshot.summary.totalCount > 0) {
    const cx = rightChartX + rightChartW - 64;
    const cy = chartsY + 110;
    const outerR = 46;
    let startAngle = -Math.PI / 2;
    for (const slice of snapshot.statusSlices) {
      const angle = (slice.count / snapshot.summary.totalCount) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, startAngle, startAngle + angle);
      ctx.strokeStyle = slice.color;
      ctx.lineWidth = 14;
      ctx.stroke();
      startAngle += angle;
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 14px "IBM Plex Mono", monospace';
    ctx.fillText(toEnglishDigits(String(snapshot.summary.totalCount)), cx, cy + 5);

    // Legend
    let legY = chartsY + 46;
    snapshot.statusSlices.slice(0, 6).forEach((slice) => {
      ctx.fillStyle = slice.color;
      ctx.fillRect(rightChartX + 12, legY - 8, 8, 8);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#334155';
      ctx.font = '10px Cairo, "IBM Plex Sans Arabic", sans-serif';
      const label = truncateTextToWidth(ctx, slice.label, 90);
      ctx.fillText(label, rightChartX + 185, legY);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10px "IBM Plex Mono", monospace';
      ctx.fillText(
        `${toEnglishDigits(String(slice.count))} (${toEnglishDigits(slice.pct.toFixed(0))}%)`,
        rightChartX + 26,
        legY
      );
      legY += 22;
    });
  } else {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748b';
    ctx.font = '11px Cairo, "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText('لا توجد بيانات مطابقة', rightChartX + rightChartW / 2, chartsY + 106);
  }

  // Bar Chart box
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#cbd5e1';
  ctx.fillRect(leftChartX, chartsY, leftChartW, chartsH);
  ctx.strokeRect(leftChartX, chartsY, leftChartW, chartsH);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 12px Cairo, "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(
    snapshot.barMode === 'specialist' ? 'التوزيع بالأعمدة — حسب المختص' : 'التوزيع بالأعمدة — حسب الفترة',
    leftChartX + leftChartW - 12,
    chartsY + 20
  );

  if (snapshot.barItems.length > 0) {
    const maxCount = snapshot.barItems.reduce((m, x) => Math.max(m, x.count), 1);
    let by = chartsY + 44;
    snapshot.barItems.slice(0, 6).forEach((item) => {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#334155';
      ctx.font = '10px Cairo, "IBM Plex Sans Arabic", sans-serif';
      ctx.fillText(
        truncateTextToWidth(ctx, item.label, leftChartW - 70),
        leftChartX + leftChartW - 12,
        by
      );
      ctx.textAlign = 'left';
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10px "IBM Plex Mono", monospace';
      ctx.fillText(toEnglishDigits(String(item.count)), leftChartX + 12, by);

      const trackX = leftChartX + 12;
      const trackW = leftChartW - 24;
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(trackX, by + 5, trackW, 7);
      const barW = Math.max(6, (item.count / maxCount) * trackW);
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(trackX + trackW - barW, by + 5, barW, 7);
      by += 24;
    });
  } else {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748b';
    ctx.font = '11px Cairo, "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText('لا توجد بيانات مطابقة', leftChartX + leftChartW / 2, chartsY + 106);
  }

  // Table Title
  let y = 460;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 13px Cairo, "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(
    `جدول النتائج المطابقة (${toEnglishDigits(String(snapshot.rows.length))})`,
    width - 32,
    y
  );
  y += 10;

  const drawTableHeader = (targetCtx: CanvasRenderingContext2D, topY: number) => {
    targetCtx.fillStyle = '#e2e8f0';
    targetCtx.fillRect(32, topY, width - 64, 28);
    targetCtx.fillStyle = '#0f172a';
    targetCtx.font = 'bold 11px Cairo, "IBM Plex Sans Arabic", sans-serif';
    targetCtx.textAlign = 'right';
    targetCtx.fillText('العنوان', width - 42, topY + 18);
    targetCtx.fillText('العملية', 505, topY + 18);
    targetCtx.fillText('المختص', 425, topY + 18);
    targetCtx.fillText('القسم', 310, topY + 18);
    targetCtx.fillText('التاريخ', 195, topY + 18);
    targetCtx.fillText('الحالة', 100, topY + 18);
  };

  const drawFooter = (targetCtx: CanvasRenderingContext2D, pageNum: number) => {
    targetCtx.textAlign = 'right';
    targetCtx.fillStyle = '#64748b';
    targetCtx.font = '10px Cairo, "IBM Plex Sans Arabic", sans-serif';
    targetCtx.fillText(
      'تقرير مُصدّر من تطبيق حقيبة المهام — تتطابق الأعداد مع الفلاتر المحددة في شاشة التقارير.',
      width - 32,
      height - 22
    );
    targetCtx.textAlign = 'left';
    targetCtx.font = '10px "IBM Plex Mono", monospace';
    targetCtx.fillText(`Page ${pageNum}`, 32, height - 22);
  };

  drawTableHeader(ctx, y);
  y += 28;
  let pageNumber = 1;
  const rowH = 30;

  if (snapshot.rows.length === 0) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(32, y, width - 64, 42);
    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(32, y, width - 64, 42);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748b';
    ctx.font = '12px Cairo, "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText('لا توجد سجلات مطابقة للفلاتر الحالية.', width / 2, y + 25);
  } else {
    for (let i = 0; i < snapshot.rows.length; i += 1) {
      if (y + rowH > height - 48) {
        drawFooter(ctx, pageNumber);
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, width, height);
        pdf.addPage([width, height], 'portrait');
        pageNumber += 1;
        ({ canvas, ctx } = makePageCanvas());
        y = 36;
        ctx.textAlign = 'right';
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 12px Cairo, "IBM Plex Sans Arabic", sans-serif';
        ctx.fillText('تابع جدول النتائج المطابقة', width - 32, y);
        y += 10;
        drawTableHeader(ctx, y);
        y += 28;
      }

      const r = snapshot.rows[i];
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#f8fafc';
      ctx.fillRect(32, y, width - 64, rowH);
      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(32, y, width - 64, rowH);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10.5px Cairo, "IBM Plex Sans Arabic", sans-serif';
      ctx.fillText(truncateTextToWidth(ctx, r.title, 235), width - 42, y + 19);

      ctx.fillStyle = '#334155';
      ctx.font = '10px Cairo, "IBM Plex Sans Arabic", sans-serif';
      ctx.fillText(r.operationType, 505, y + 19);
      ctx.fillText(truncateTextToWidth(ctx, r.specialistName, 100), 425, y + 19);
      ctx.fillText(truncateTextToWidth(ctx, r.departmentName, 100), 310, y + 19);

      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.fillText(
        truncateTextToWidth(ctx, toEnglishDigits(formatDisplayDate(r.dateISO, snapshot.showHijri)), 85),
        195,
        y + 19
      );

      ctx.fillStyle = r.isUrgentOrOverdue
        ? '#be123c'
        : r.isDone
        ? '#047857'
        : '#1d4ed8';
      ctx.font = 'bold 10px Cairo, "IBM Plex Sans Arabic", sans-serif';
      ctx.fillText(truncateTextToWidth(ctx, r.statusLabel, 64), 100, y + 19);

      y += rowH;
    }
  }

  drawFooter(ctx, pageNumber);
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, width, height);
  return pdf.output('blob');
}

export async function downloadReportPdf(snapshot: ReportExportSnapshot): Promise<string> {
  const blob = await buildReportPdfBlob(snapshot);
  const filename = `${getReportFileBaseName(snapshot)}.pdf`;
  triggerBlobDownload(blob, filename);
  return filename;
}

export function buildReportShareSummaryText(snapshot: ReportExportSnapshot): string {
  const breakdown = snapshot.statusSlices
    .slice(0, 5)
    .map(
      (s) =>
        `• ${s.label}: ${toEnglishDigits(String(s.count))} (${toEnglishDigits(s.pct.toFixed(0))}%)`
    )
    .join('\n');

  return [
    'تقرير العمليات والإحصاءات — حقيبة المهام',
    `الفترة: ${formatPeriodText(snapshot)}`,
    `الفلاتر: المختص (${snapshot.filters.specialistName}) · القسم (${snapshot.filters.departmentName}) · العملية (${snapshot.filters.operationType}) · الحالة (${snapshot.filters.statusFilter}) · تصنيف الوثائق (${snapshot.filters.documentCategory || 'الكل'})`,
    `إجمالي السجلات المطابقة: ${toEnglishDigits(String(snapshot.summary.totalCount))}`,
    `مكتملة / منعقدة / سارية: ${toEnglishDigits(String(snapshot.summary.doneCount))}`,
    `متأخرة / منتهية / قريبة: ${toEnglishDigits(String(snapshot.summary.urgentCount))}`,
    `مفتوحة ومجدولة: ${toEnglishDigits(String(snapshot.summary.activeRemainingCount))}`,
    breakdown ? `\nتوزيع الحالات:\n${breakdown}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

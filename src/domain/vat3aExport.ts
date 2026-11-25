import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { Vat3ADraft, Vat3ALineId } from '../types/domain';
import {
  evaluateVat3ADraft,
  formatHalalas,
  VAT_3A_LINE_DEFINITIONS,
} from './vat3aEngine';

function sanitizeFileName(name: string): string {
  return name.replace(/[^\u0600-\u06FFa-zA-Z0-9_-]+/g, '_').slice(0, 48);
}

/**
 * Generates an Excel (.xlsx) workbook for a single VAT 3A draft matching its saved rules & totals.
 */
export function buildVat3AExcelBuffer(draft: Vat3ADraft): ArrayBuffer {
  const evalRes = evaluateVat3ADraft(draft);
  const rows: Array<Array<string | number>> = [
    ['حقيبة المهام — نموذج ضريبة القيمة المضافة 3A (مسودة للمراجعة)'],
    ['المنشأة', draft.entityName, 'رقم التسجيل الضريبي', draft.taxRegistrationNumber || '—'],
    ['بداية الفترة', draft.periodStart, 'نهاية الفترة', draft.periodEnd],
    ['الحالة', draft.status, 'إصدار القواعد', draft.calcRulesVersion],
    ['المحرر', draft.editorName, 'النسبة الافتراضية', `${evalRes.appliedRules.defaultRatePercent}%`],
    [],
    ['رقم البند', 'اسم البند', 'المبلغ (ر.س)', 'التعديل (ر.س)', 'تطبيق التعديل', 'النسبة', 'الضريبة (ر.س)'],
  ];

  for (const def of VAT_3A_LINE_DEFINITIONS) {
    const line = evalRes.lines[def.id as Vat3ALineId];
    const dirLabel =
      def.id === 9
        ? 'غير قابل للخصم (عكسي)'
        : def.adjustmentEditable
        ? line.adjustmentDirection === 'subtract'
          ? 'يُطرح من المبلغ'
          : 'يُضاف إلى المبلغ'
        : '—';
    const rateLabel =
      def.vatDirectInput || def.isTotal
        ? def.rateLabel
        : line.taxMethod === 'zero'
        ? 'أثر صفري (0%)'
        : `${line.effectiveRatePercent}%`;

    rows.push([
      def.id,
      def.name,
      def.vatDirectInput ? '—' : formatHalalas(line.amountHalalas),
      def.vatDirectInput ? '—' : formatHalalas(line.adjustmentHalalas),
      dirLabel,
      rateLabel,
      formatHalalas(line.vatHalalas),
    ]);
  }

  rows.push([]);
  rows.push(['النتيجة النهائية (البند 16)', evalRes.netStatusLabel, formatHalalas(evalRes.v16Halalas)]);
  if (draft.item14PeriodRef || draft.item14Reason) {
    rows.push(['مرجع فترة البند 14', draft.item14PeriodRef || '—', 'سبب التصحيح', draft.item14Reason || '—']);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 10 },
    { wch: 44 },
    { wch: 16 },
    { wch: 16 },
    { wch: 20 },
    { wch: 16 },
    { wch: 18 },
  ];
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, ws, 'نموذج 3A');
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

export function downloadVat3AExcel(draft: Vat3ADraft): void {
  const buf = buildVat3AExcelBuffer(draft);
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerBlobDownload(
    blob,
    `VAT_3A_${sanitizeFileName(draft.entityName)}_${draft.periodStart}.xlsx`
  );
}

/**
 * Exports filtered archive drafts to Excel (.xlsx).
 */
export function downloadVat3AArchiveExcel(drafts: Vat3ADraft[]): void {
  const rows: Array<Array<string | number>> = [
    ['حقيبة المهام — تصدير أرشيف نموذج ضريبة القيمة المضافة 3A'],
    ['عدد السجلات المصدرة', drafts.length],
    [],
    [
      'المنشأة',
      'الرقم الضريبي',
      'بداية الفترة',
      'نهاية الفترة',
      'الحالة',
      'إجمالي المبيعات (ر.س)',
      'ضريبة المبيعات (ر.س)',
      'ضريبة المشتريات (ر.س)',
      'ضريبة الفترة 13 (ر.س)',
      'صافي الضريبة 16 (ر.س)',
      'الحالة الضريبية',
      'النسبة الافتراضية',
    ],
  ];

  for (const d of drafts) {
    const ev = evaluateVat3ADraft(d);
    rows.push([
      d.entityName,
      d.taxRegistrationNumber || '—',
      d.periodStart,
      d.periodEnd,
      d.status,
      formatHalalas(ev.lines[6].amountHalalas),
      formatHalalas(ev.v6Halalas),
      formatHalalas(ev.v12Halalas),
      formatHalalas(ev.v13Halalas),
      formatHalalas(ev.v16Halalas),
      ev.netStatusLabel,
      `${ev.appliedRules.defaultRatePercent}%`,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 30 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, ws, 'أرشيف 3A');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerBlobDownload(blob, `VAT_3A_Archive_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Generates an A4 RTL Arabic PDF using Canvas 2D shaping (immune to Tailwind oklch / jsPDF Arabic glyph issues).
 */
export async function buildVat3APdfBlob(draft: Vat3ADraft): Promise<Blob> {
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // continue with available fonts
    }
  }

  const evalRes = evaluateVat3ADraft(draft);
  const scale = 2;
  const width = 794; // A4 @ 96dpi
  const height = 1123;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Header band
  ctx.fillStyle = '#065f46';
  ctx.fillRect(36, 32, width - 72, 68);

  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px Cairo, "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText('حقيبة المهام — نموذج ضريبة القيمة المضافة 3A', width - 54, 62);
  ctx.font = '12px Cairo, "IBM Plex Sans Arabic", sans-serif';
  ctx.fillStyle = '#d1fae5';
  ctx.fillText(
    `مسودة للمراجعة الداخلية · إصدار القواعد: ${draft.calcRulesVersion} · النسبة الافتراضية: ${evalRes.appliedRules.defaultRatePercent}%`,
    width - 54,
    84
  );

  // Metadata Box
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.fillRect(36, 114, width - 72, 76);
  ctx.strokeRect(36, 114, width - 72, 76);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 13px Cairo, "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(`المنشأة: ${draft.entityName}`, width - 52, 138);
  ctx.font = '12px Cairo, "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(
    `الرقم الضريبي: ${draft.taxRegistrationNumber || '—'}   |   الحالة: ${draft.status}`,
    width - 52,
    160
  );
  ctx.fillText(
    `الفترة: من ${draft.periodStart} إلى ${draft.periodEnd}   |   المحرر: ${draft.editorName}`,
    width - 52,
    180
  );

  // Table Headers (RTL from right: Name | Amount | Adjustment | VAT)
  let y = 208;
  const rowH = 38;
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(36, y, width - 72, 32);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 12px Cairo, "IBM Plex Sans Arabic", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('رقم البند واسمه', width - 48, y + 21);
  ctx.textAlign = 'left';
  ctx.fillText('المبلغ (ر.س)', 310, y + 21);
  ctx.fillText('التعديل (ر.س)', 195, y + 21);
  ctx.fillText('الضريبة (ر.س)', 50, y + 21);

  y += 32;

  for (const def of VAT_3A_LINE_DEFINITIONS) {
    const line = evalRes.lines[def.id as Vat3ALineId];
    const isTotal = !!def.isTotal;
    ctx.fillStyle =
      def.id === 16 ? '#ecfdf5' : isTotal ? '#f1f5f9' : '#ffffff';
    ctx.fillRect(36, y, width - 72, rowH);
    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(36, y, width - 72, rowH);

    // Item label
    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.font = isTotal
      ? 'bold 12px Cairo, "IBM Plex Sans Arabic", sans-serif'
      : '12px Cairo, "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText(`${def.id}. ${def.name}`, width - 48, y + 17);

    // Sub-note showing direction/rate
    ctx.fillStyle = '#64748b';
    ctx.font = '10px Cairo, "IBM Plex Sans Arabic", sans-serif';
    const subNote = def.vatDirectInput
      ? def.rateLabel
      : def.isTotal
      ? def.rateLabel
      : def.id === 9
      ? line.taxMethod === 'zero'
        ? 'احتساب عكسي · أثر ضريبي صفري (0%)'
        : `احتساب عكسي (${line.effectiveRatePercent}%)`
      : `${line.adjustmentDirection === 'subtract' ? 'التعديل يُطرح' : 'التعديل يُضاف'} · ${
          line.taxMethod === 'zero' ? 'أثر صفري' : `${line.effectiveRatePercent}%`
        }`;
    ctx.fillText(subNote, width - 48, y + 32);

    // Numeric columns
    ctx.textAlign = 'left';
    ctx.fillStyle = def.id === 16 ? '#065f46' : '#0f172a';
    ctx.font = isTotal
      ? 'bold 12px "IBM Plex Mono", monospace'
      : '12px "IBM Plex Mono", monospace';
    ctx.fillText(
      def.vatDirectInput ? '—' : formatHalalas(line.amountHalalas),
      310,
      y + 23
    );
    ctx.fillText(
      def.vatDirectInput ? '—' : formatHalalas(line.adjustmentHalalas),
      195,
      y + 23
    );
    ctx.fillText(formatHalalas(line.vatHalalas), 50, y + 23);

    y += rowH;
  }

  // Footer Summary
  y += 18;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#065f46';
  ctx.font = 'bold 14px Cairo, "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(
    `النتيجة النهائية: ${evalRes.netStatusLabel} (${formatHalalas(evalRes.v16Halalas)} ر.س)`,
    width - 36,
    y
  );

  ctx.fillStyle = '#64748b';
  ctx.font = '10px Cairo, "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(
    'مسودة للمراجعة الداخلية من تطبيق حقيبة المهام — يلزم المطابقة مع بوابة الهيئة ومراجعة المحاسب قبل الاعتماد الرسمي.',
    width - 36,
    height - 30
  );

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [width, height] });
  pdf.addImage(imgData, 'PNG', 0, 0, width, height);
  return pdf.output('blob');
}

export async function downloadVat3APdf(draft: Vat3ADraft): Promise<void> {
  const blob = await buildVat3APdfBlob(draft);
  triggerBlobDownload(
    blob,
    `VAT_3A_${sanitizeFileName(draft.entityName)}_${draft.periodStart}.pdf`
  );
}

/**
 * Exports filtered archive list as a formatted Arabic PDF.
 */
export async function downloadVat3AArchivePdf(drafts: Vat3ADraft[]): Promise<void> {
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // continue
    }
  }
  const scale = 2;
  const width = 794;
  const height = Math.max(600, 220 + drafts.length * 46);
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#065f46';
  ctx.fillRect(36, 32, width - 72, 60);
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px Cairo, "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText('حقيبة المهام — تصدير أرشيف نموذج 3A المفلتر', width - 52, 60);
  ctx.font = '12px Cairo, "IBM Plex Sans Arabic", sans-serif';
  ctx.fillStyle = '#d1fae5';
  ctx.fillText(`عدد السجلات: ${drafts.length}   |   تاريخ التصدير: ${new Date().toISOString().slice(0, 10)}`, width - 52, 80);

  let y = 112;
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(36, y, width - 72, 30);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 12px Cairo, "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText('المنشأة والفترة', width - 48, y + 20);
  ctx.fillText('الحالة', 360, y + 20);
  ctx.textAlign = 'left';
  ctx.fillText('ض. المبيعات', 240, y + 20);
  ctx.fillText('ض. المشتريات', 145, y + 20);
  ctx.fillText('الصافي (ر.س)', 50, y + 20);
  y += 30;

  for (const d of drafts) {
    const ev = evaluateVat3ADraft(d);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(36, y, width - 72, 42);
    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(36, y, width - 72, 42);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 12px Cairo, "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText(d.entityName, width - 48, y + 17);
    ctx.fillStyle = '#64748b';
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.fillText(`${d.periodStart} -> ${d.periodEnd}`, width - 48, y + 34);

    ctx.fillStyle = '#0f172a';
    ctx.font = '11px Cairo, "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText(d.status, 360, y + 24);

    ctx.textAlign = 'left';
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.fillText(formatHalalas(ev.v6Halalas), 240, y + 24);
    ctx.fillText(formatHalalas(ev.v12Halalas), 145, y + 24);
    ctx.font = 'bold 11px "IBM Plex Mono", monospace';
    ctx.fillText(formatHalalas(ev.v16Halalas), 50, y + 24);

    y += 42;
  }

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [width, height] });
  pdf.addImage(imgData, 'PNG', 0, 0, width, height);
  const blob = pdf.output('blob');
  triggerBlobDownload(blob, `VAT_3A_Archive_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function buildVat3AShareSummaryText(draft: Vat3ADraft): string {
  const ev = evaluateVat3ADraft(draft);
  return [
    `ملخص مسودة ضريبة القيمة المضافة 3A — حقيبة المهام`,
    `المنشأة: ${draft.entityName}`,
    `الرقم الضريبي: ${draft.taxRegistrationNumber || '—'}`,
    `الفترة: ${draft.periodStart} إلى ${draft.periodEnd}`,
    `الحالة: ${draft.status} (النسبة الافتراضية: ${ev.appliedRules.defaultRatePercent}%)`,
    `ضريبة المبيعات (البند 6): ${formatHalalas(ev.v6Halalas)} ر.س`,
    `ضريبة المشتريات (البند 12): ${formatHalalas(ev.v12Halalas)} ر.س`,
    `ضريبة الفترة (البند 13): ${formatHalalas(ev.v13Halalas)} ر.س`,
    `صافي الضريبة (البند 16): ${formatHalalas(ev.v16Halalas)} ر.س (${ev.netStatusLabel})`,
  ].join('\n');
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

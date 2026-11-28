import * as XLSX from 'xlsx';
import type { DocumentItem, DocumentCategoryItem, Specialist } from '../types/domain';
import { resolveDocumentCategoryName } from '../data/repository';
import { evaluateDocumentHealth } from './dateUtils';

/** A complete data export. References and ISO dates are text to preserve identifiers and precision. */
export function buildDocumentsExcelBuffer(documents: DocumentItem[], categories: DocumentCategoryItem[], specialists: Specialist[], today: string, warningDays: number, scope: string): ArrayBuffer {
  const rows: (string | number)[][] = [
    ['حقيبة المهام — سجل الوثائق والتراخيص'],
    ['نطاق التصدير', scope, 'عدد الوثائق', documents.length, 'تاريخ التقييم', today],
    [],
    ['معرف الوثيقة', 'معرف المنشأة', 'اسم الوثيقة', 'معرف التصنيف', 'التصنيف', 'النوع المسجل', 'الرقم المرجعي', 'الجهة المصدرة', 'معرف المختص', 'المختص', 'تاريخ الإصدار', 'تاريخ الانتهاء', 'حالة الصلاحية', 'مؤرشفة في', 'ملاحظات', 'تاريخ الإنشاء', 'آخر تحديث', 'عدد التجديدات'],
    ...documents.map(doc => [doc.id, doc.orgId, doc.name, doc.categoryId || '', resolveDocumentCategoryName(doc, categories), doc.docType || '', doc.referenceNumber || '', doc.issuingAuthority || '', doc.specialistId || '', specialists.find(s => s.id === doc.specialistId)?.name || '', doc.issueDate || '', doc.expiryDate || '', evaluateDocumentHealth(doc, warningDays, today).badgeText, doc.archivedAt || '', doc.notes || '', doc.createdAt, doc.updatedAt, doc.renewals.length]),
  ];
  const renewalRows: (string | number)[][] = [
    ['حقيبة المهام — سجل التجديدات'],
    ['نطاق التصدير', scope], [],
    ['معرف التجديد', 'معرف الوثيقة', 'اسم الوثيقة', 'الانتهاء السابق', 'الانتهاء الجديد', 'ملاحظات التجديد', 'المسؤول عن التجديد', 'تاريخ تسجيل التجديد'],
    ...documents.flatMap(doc => doc.renewals.map(r => [r.id, r.documentId, doc.name, r.previousExpiryDate || '', r.newExpiryDate, r.notes, r.actorName, r.renewedAt])),
  ];
  const book = XLSX.utils.book_new();
  book.Workbook = { Views: [{ RTL: true }] };
  const docs = XLSX.utils.aoa_to_sheet(rows);
  docs['!cols'] = [18,18,35,18,25,20,22,25,18,22,18,18,18,22,40,22,22,16].map(wch => ({wch}));
  docs['!autofilter'] = { ref: `A4:R${Math.max(4, rows.length)}` };
  const renewals = XLSX.utils.aoa_to_sheet(renewalRows);
  renewals['!cols'] = [20,20,35,20,20,40,24,25].map(wch => ({wch}));
  renewals['!autofilter'] = { ref: `A4:H${Math.max(4, renewalRows.length)}` };
  XLSX.utils.book_append_sheet(book, docs, 'الوثائق والتراخيص');
  XLSX.utils.book_append_sheet(book, renewals, 'سجل التجديدات');
  return XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

export function downloadDocumentsExcel(documents: DocumentItem[], categories: DocumentCategoryItem[], specialists: Specialist[], today: string, warningDays: number, scope: string): void {
  const bytes = buildDocumentsExcelBuffer(documents, categories, specialists, today, warningDays, scope);
  const url = URL.createObjectURL(new Blob([bytes], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  const link = document.createElement('a'); link.href = url; link.download = `haqibat-documents-${today}.xlsx`;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

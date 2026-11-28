import type { RecordType } from '../types/domain';

/** Selecting a document category scopes the report to documents of that category. */
export function matchesReportDocumentCategory(row: { recordType: RecordType; categoryId?: string | null }, category: string): boolean {
  if (category === 'الكل') return true;
  if (row.recordType !== 'document') return false;
  return category === '__uncategorized__' ? row.categoryId == null : row.categoryId === category;
}

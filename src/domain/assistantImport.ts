export const IMPORT_MAX_BYTES = 3 * 1024 * 1024;
export const IMPORT_MAX_METADATA_BYTES = 32 * 1024;
export const IMPORT_MAX_ROWS = 100;
export const IMPORT_FORMATS = ['xlsx', 'docx', 'pdf'] as const;
export type ImportFormat = (typeof IMPORT_FORMATS)[number];

export interface ImportDocumentRow {
  name: string;
  referenceNumber: string;
  issuingAuthority: string;
  expiryDate: string;
  categoryId: string | null;
  specialistId: string | null;
}

export interface ImportDraftRow extends ImportDocumentRow {
  sourceDate: string;
  categoryHint: string;
  specialistHint: string;
}

export interface ImportDraft {
  message: string;
  revision: number;
  rows: ImportDraftRow[];
  reminderDays: number | null;
}

const matchingText = (value: string) => value.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ');
const matchingReference = (value: string) => matchingText(value)
  .replace(/[٠-٩۰-۹]/g, (digit) => String(digit.charCodeAt(0) - (digit <= '٩' ? 0x660 : 0x6f0)))
  .replace(/[\s\p{Pd}]/gu, '');

export function matchesImportDocument(
  row: ImportDocumentRow,
  document: Pick<ImportDocumentRow, 'name' | 'referenceNumber' | 'categoryId'>,
) {
  return matchingReference(row.referenceNumber) === matchingReference(document.referenceNumber) &&
    ((row.categoryId !== null && row.categoryId === document.categoryId) ||
      ((!row.categoryId || !document.categoryId) && matchingText(row.name) === matchingText(document.name)));
}

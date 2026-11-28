import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as XLSX from 'xlsx';
import { createSeedDatabase } from '../src/data/seedData';
import { buildDocumentsExcelBuffer } from '../src/domain/documentExport';
import { matchesReportDocumentCategory } from '../src/domain/reportCategory';

test('report category filters only matching documents and supports uncategorized', () => {
  const doc = { recordType:'document' as const, categoryId:'insurance' };
  const task = { recordType:'task' as const };
  assert.equal(matchesReportDocumentCategory(doc,'insurance'),true);
  assert.equal(matchesReportDocumentCategory(doc,'other'),false);
  assert.equal(matchesReportDocumentCategory(task,'insurance'),false);
  assert.equal(matchesReportDocumentCategory(task,'الكل'),true);
  assert.equal(matchesReportDocumentCategory({recordType:'document',categoryId:null},'__uncategorized__'),true);
});

test('document workbook preserves full identifiers, notes, dates and renewal history as text', () => {
  const state=createSeedDatabase();
  const original=state.documents[0];
  const doc={...original,id:'doc-001',referenceNumber:'00001234567890123456789',name:'=NotAFormula',notes:'تفاصيل مهمة',issueDate:'2026-01-02',expiryDate:'2027-03-04',archivedAt:'2026-04-01',renewals:[{id:'ren-1',documentId:'doc-001',previousExpiryDate:'2026-03-04',newExpiryDate:'2027-03-04',notes:'ملاحظة تجديد',actorName:'المسؤول',renewedAt:'2026-03-01T09:00:00'}]};
  const buffer=buildDocumentsExcelBuffer([doc],state.documentCategories,state.specialists,'2026-11-28',30,'المطابقة');
  const book=XLSX.read(buffer,{type:'array'});
  assert.deepEqual(book.SheetNames,['الوثائق والتراخيص','سجل التجديدات']);
  const sheet=book.Sheets[book.SheetNames[0]];
  assert.equal(sheet.C5.v,'=NotAFormula'); assert.equal(sheet.C5.f,undefined);
  assert.equal(sheet.G5.v,'00001234567890123456789');
  assert.equal(sheet.K5.v,'2026-01-02'); assert.equal(sheet.L5.v,'2027-03-04');
  assert.equal(sheet.N5.v,'2026-04-01'); assert.equal(sheet.O5.v,'تفاصيل مهمة');
  const renewal=book.Sheets[book.SheetNames[1]];
  assert.equal(renewal.A5.v,'ren-1'); assert.equal(renewal.B5.v,'doc-001'); assert.equal(renewal.F5.v,'ملاحظة تجديد');
  assert.equal(book.Workbook?.Views?.[0]?.RTL,true);
});

import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { zipSync } from 'fflate';
import * as XLSX from 'xlsx';
import { createServerApp } from '../server';
import { applyAssistantImport, unambiguousImportDate } from '../server/assistantImport';
import { attachmentPart } from '../server/assistantImportFiles';
import { createPreviewStore } from '../server/workspaceStore';
import { createEmptyDatabase } from '../src/data/seedData';

const signal = new AbortController().signal;
const makeWorkbook = () => {
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['اللوحة', 'انتهاء رخصة السير'],
    ['0012 أ ب ج', { t: 'n', v: 47848, z: 'm/d/yy' }],
  ]);
  XLSX.utils.book_append_sheet(book, sheet, 'المركبات');
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
};

test('reads XLSX dates and identifiers, Word table text, and sends PDF inline', async () => {
  const excel = await attachmentPart(makeWorkbook(), 'xlsx', signal);
  assert.deepEqual(excel.text!.split('\n').map((line) => JSON.parse(line)), [
    { sheet: 'المركبات' },
    ['اللوحة', 'انتهاء رخصة السير'],
    ['0012 أ ب ج', '2030-12-31'],
  ]);
  const xml = '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl><w:tr><w:tc><w:p><w:r><w:t>تأمين المركبات</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>';
  const word = zipSync({ 'word/document.xml': Buffer.from(xml) });
  assert.equal((await attachmentPart(Buffer.from(word), 'docx', signal)).text, 'تأمين المركبات');
  const pdf = Buffer.from('%PDF-1.7\nfixture');
  assert.deepEqual(await attachmentPart(pdf, 'pdf', signal), {
    inlineData: { mimeType: 'application/pdf', data: pdf.toString('base64') },
  });
  await assert.rejects(attachmentPart(Buffer.from('fake PDF'), 'pdf', signal), /PDF/);
  await assert.rejects(attachmentPart(pdf, 'xlsx', signal), /تعذّرت قراءة الملف/);
});

test('ambiguous, Hijri-looking and invalid dates require review', () => {
  assert.equal(unambiguousImportDate('03/04/2030'), '');
  assert.equal(unambiguousImportDate('1448-04-03'), '');
  assert.equal(unambiguousImportDate('2030-02-30'), '');
  assert.equal(unambiguousImportDate('٣١/١٢/٢٠٣٠'), '2030-12-31');
});

test('a rejected duplicate or stale revision leaves the workspace unchanged', () => {
  const workspace = { state: createEmptyDatabase(), revision: 2 };
  const row = {
    name: 'تأمين سيارة', referenceNumber: '١٢٣ أ ب ج', issuingAuthority: '',
    expiryDate: '2099-12-30', categoryId: null, specialistId: null, updateId: null,
  };
  assert.throws(() => applyAssistantImport(workspace, { revision: 1, rows: [row], reminderDays: 30 }), /تغيّرت/);
  assert.throws(() => applyAssistantImport(workspace, {
    revision: 2, rows: [row, { ...row, referenceNumber: '123-أبج' }], reminderDays: 30,
  }), /متطابقتان/);
  assert.equal(workspace.state.documents.length, 0);
  assert.equal(workspace.state.calendarItems.length, 0);
});

test('authenticated HTTP preview of 20 vehicles requires an explicit, atomic commit', async (t) => {
  const store = createPreviewStore();
  await store.change((workspace) => { workspace.state = createEmptyDatabase(); });
  const server = createServerApp(store).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.close(); });
  const address = server.address();
  assert(address && typeof address === 'object');
  const endpoint = `http://127.0.0.1:${address.port}`;
  const request = globalThis.fetch.bind(globalThis);
  const previousKey = process.env.GEMINI_API_KEY;
  const previousAdmin = process.env.ADMIN_PASSCODE;
  process.env.GEMINI_API_KEY = 'test-provider-key';
  delete process.env.ADMIN_PASSCODE;
  t.after(() => {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
    if (previousAdmin !== undefined) process.env.ADMIN_PASSCODE = previousAdmin;
  });

  const categories = ['رخص سير المركبات', 'تأمين المركبات'];
  const vehicles = Array.from({ length: 20 }, (_, index) => `لوحة ${index + 1}`);
  const rows = vehicles.flatMap((plate) => categories.map((categoryHint) => ({
    name: `${categoryHint} - ${plate}`, referenceNumber: plate, sourceDate: '2099-12-31',
    categoryHint, issuingAuthority: '', specialistHint: '',
  })));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ['اللوحة', ...categories], ...vehicles.map((plate) => [plate, '2099-12-31', '2099-12-31']),
  ]), 'المركبات');
  const bytes = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  const metadata = Buffer.from(JSON.stringify({ question: 'استورد وثائق المركبات مع تذكير قبل 30 يومًا', format: 'xlsx' }));
  const prefix = Buffer.alloc(4);
  prefix.writeUInt32BE(metadata.length);
  const filePayload = new Uint8Array(Buffer.concat([prefix, metadata, bytes]));
  let providerCalls = 0;
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    assert.match(String(url), /generativelanguage\.googleapis\.com/);
    assert.match(String(init.body), /لوحة 20/);
    providerCalls++;
    return Response.json({
      candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify({
        message: 'المعاينة جاهزة', overflow: false, reminderDays: 30, rows,
      }) }] } }],
    });
  });

  const csrf = { 'X-Requested-With': 'XMLHttpRequest' };
  const unauth = await request(`${endpoint}/api/ai/import/preview`, {
    method: 'POST', headers: { ...csrf, 'Content-Type': 'application/octet-stream' }, body: filePayload,
  });
  assert.equal(unauth.status, 401);
  assert.equal(providerCalls, 0);

  const signIn = await request(`${endpoint}/api/auth/bootstrap-admin`, {
    method: 'POST', headers: { ...csrf, 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'import-tester', password: 'test-password' }),
  });
  assert.equal(signIn.status, 201);
  const cookie = signIn.headers.get('set-cookie')?.split(';')[0];
  assert(cookie);
  const preview = await request(`${endpoint}/api/ai/import/preview`, {
    method: 'POST', headers: { ...csrf, cookie, 'Content-Type': 'application/octet-stream' }, body: filePayload,
  });
  const draft = await preview.json();
  assert.equal(preview.status, 200, JSON.stringify(draft));
  assert.equal(draft.rows.length, 40);
  assert.equal(providerCalls, 1);
  assert.equal((await store.read()).state.documents.length, 0);

  const payload = {
    revision: draft.revision, reminderDays: draft.reminderDays,
    rows: draft.rows.map((row: object) => ({ ...row, updateId: null })),
  };
  const commit = () => request(`${endpoint}/api/ai/import/commit`, {
    method: 'POST', headers: { ...csrf, cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const approved = await commit();
  assert.equal(approved.status, 200);
  assert.deepEqual(await approved.json(), { created: 40, updated: 0, remindersCreated: 40, remindersSkipped: 0 });
  assert.equal((await commit()).status, 409);
  const { state } = await store.read();
  assert.equal(state.documents.length, 40);
  assert.equal(state.calendarItems.length, 40);
  assert(state.calendarItems.every((item) =>
    item.linkedRecordType === 'document' && item.scheduledAt === '2099-12-01T00:00' &&
    state.documents.some((doc) => doc.id === item.linkedRecordId)));
  assert.equal(providerCalls, 1);
});

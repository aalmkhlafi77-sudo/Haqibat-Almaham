import { zipSync } from 'fflate';
import readWorkbook from 'read-excel-file/node';
import { SaxesParser } from 'saxes';
import { fromBufferPromise } from 'yauzl';
import type { Part } from '@google/genai';
import type { ImportFormat } from '../src/domain/assistantImport';
import { RequestError } from './workspaceCommands';

const MAX_EXPANDED = 8 * 1024 * 1024;
const MAX_TEXT = 55_000;
const wordNamespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

async function readOfficeParts(bytes: Buffer, format: 'xlsx' | 'docx', signal: AbortSignal) {
  const archive = await fromBufferPromise(bytes, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true });
  const parts: Record<string, Uint8Array> = Object.create(null);
  let expanded = 0;
  let sheets = 0;
  try {
    if (archive.entryCount > 300) throw new Error('Too many ZIP entries');
    for await (const entry of archive.eachEntry()) {
      signal.throwIfAborted();
      const name = entry.fileName;
      if (format === 'docx' ? name !== 'word/document.xml' : !/^(?:xl\/[^\r\n]+\.xml(?:\.rels)?|_rels\/\.rels|\[Content_Types\]\.xml)$/.test(name)) continue;
      expanded += entry.uncompressedSize;
      if (expanded > MAX_EXPANDED || Object.hasOwn(parts, name)) throw new Error('Invalid Office archive');
      const stream = await archive.openReadStreamPromise(entry);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        signal.throwIfAborted();
        chunks.push(chunk as Buffer);
      }
      const contents = Buffer.concat(chunks);
      const xml = contents.toString('utf8');
      // Reject DTDs and keep worksheet coordinates bounded before the spreadsheet reader allocates rows.
      const parser = new SaxesParser({ xmlns: true });
      parser.on('doctype', () => { throw new Error('Unexpected DOCTYPE'); });
      if (format === 'xlsx') {
        let rows = 0;
        parser.on('opentag', (tag) => {
          const address = tag.attributes.r?.value;
          if (tag.local === 'sheet' && ++sheets > 32) {
            throw new RequestError(413, 'قسّم ملف Excel إلى ملفات تحتوي على 32 ورقة أو أقل.');
          }
          if ((tag.local === 'row' && (++rows > 999 || (address && !/^[1-9][0-9]{0,2}$/.test(address)))) ||
              (tag.local === 'c' && (!address || !/^(?:[A-Z]|A[A-Z])[1-9][0-9]{0,2}$/.test(address)))) {
            throw new RequestError(413, 'استخدم أول 999 صفًا والأعمدة من A إلى AZ في كل ورقة Excel.');
          }
        });
      }
      parser.write(xml).close();
      parts[name] = contents;
    }
    return parts;
  } finally {
    archive.close();
  }
}

function readWordText(xml: string) {
  const parser = new SaxesParser({ xmlns: true });
  let inText = false;
  let text = '';
  parser.on('opentag', (tag) => {
    if (tag.uri === wordNamespace && tag.local === 't') inText = true;
  });
  parser.on('text', (value) => { if (inText) text += value; });
  parser.on('closetag', (tag) => {
    if (tag.uri !== wordNamespace) return;
    if (tag.local === 't') inText = false;
    if (tag.local === 'p' || tag.local === 'tc') text += '\t';
    if (tag.local === 'tr') text += '\n';
    if (text.length > MAX_TEXT) throw new RequestError(413, 'قسّم محتوى الملف إلى ملفات أصغر.');
  });
  parser.write(xml).close();
  return text.trim();
}

export async function attachmentPart(bytes: Buffer, format: ImportFormat, signal: AbortSignal): Promise<Part> {
  if (format === 'pdf') {
    if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new RequestError(400, 'الملف المرفق ليس PDF صالحًا.');
    }
    return { inlineData: { data: bytes.toString('base64'), mimeType: 'application/pdf' } };
  }
  try {
    const parts = await readOfficeParts(bytes, format, signal);
    let text: string;
    if (format === 'docx') {
      const document = parts['word/document.xml'];
      if (!document) throw new Error('Missing Word document');
      text = readWordText(Buffer.from(document).toString('utf8'));
    } else {
      if (!parts['xl/workbook.xml']) throw new Error('Missing spreadsheet workbook');
      // Repack only the bounded and validated parts. The reader never sees the original ZIP headers.
      const workbook = await readWorkbook(zipSync(parts, { level: 0 }), { parseNumber: (value) => value });
      const lines: string[] = [];
      let length = 0;
      for (const { sheet, data } of workbook) {
        const heading = JSON.stringify({ sheet });
        length += heading.length + 1;
        lines.push(heading);
        for (const row of data) {
          if (!row.some((value) => value !== null)) continue;
          if (row.some((value) => typeof value === 'string' && value.length > 4_000)) {
            throw new RequestError(413, 'تحتوي إحدى خلايا Excel على نص طويل جدًا للاستيراد.');
          }
          const line = JSON.stringify(row.map((value) => value instanceof Date ? value.toISOString().slice(0, 10) : value));
          length += line.length + 1;
          if (length > MAX_TEXT) throw new RequestError(413, 'قسّم محتوى الملف إلى ملفات أصغر.');
          lines.push(line);
        }
      }
      if (lines.length === workbook.length) throw new RequestError(422, 'ملف Excel خالٍ من البيانات.');
      text = lines.join('\n');
    }
    if (text.length > MAX_TEXT) throw new RequestError(413, 'قسّم محتوى الملف إلى ملفات أصغر.');
    if (!text) throw new RequestError(422, 'الملف خالٍ من النص أو الجداول القابلة للقراءة.');
    return { text };
  } catch (error) {
    signal.throwIfAborted();
    if (error instanceof RequestError) throw error;
    throw new RequestError(400, 'تعذّرت قراءة الملف. تأكّد أنه Excel بصيغة XLSX أو Word بصيغة DOCX وبلا حماية.');
  }
}

import type {
  AppDatabaseState,
  AuthMode,
  BackupEnvelope,
  BackupSummaryCounts,
} from '../types/domain.ts';

export const BACKUP_SCHEMA_VERSION = 'haqibat-almaham-backup/v1';

const SENSITIVE_KEY_PATTERN =
  /(password|passcode|secret|token|apikey|api_key|privatekey|authheader|cookie|sessionsecret)/i;

/**
 * Recursively clones an object while stripping any credential/secret-looking keys
 * so passwords, password hashes, auth tokens, and connection secrets are never exported.
 */
function stripSensitiveFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripSensitiveFields(item)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) continue;
      out[key] = stripSensitiveFields(val);
    }
    return out as T;
  }
  return value;
}

/**
 * Deterministic canonical JSON stringify (sorted object keys) for stable integrity hashing.
 */
export function canonicalJsonStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJsonStringify(v)).join(',')}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonicalJsonStringify((value as Record<string, unknown>)[k])}`)
    .join(',')}}`;
}

/**
 * Deterministic 64-bit FNV-1a integrity digest (works identically in browser & Node).
 */
export function computeBackupIntegrityHash(payload: AppDatabaseState): string {
  const input = canonicalJsonStringify(payload);
  let h1 = 0xcbf29ce484222325n;
  let h2 = 0x84222325cbf29ce4n;
  const prime = 0x100000001b3n;
  const mask64 = 0xffffffffffffffffn;

  for (let i = 0; i < input.length; i += 1) {
    const code = BigInt(input.charCodeAt(i));
    h1 ^= code;
    h1 = (h1 * prime) & mask64;
    h2 ^= code + BigInt(i & 0xff);
    h2 = (h2 * prime) & mask64;
  }

  return `fnv64:${h1.toString(16).padStart(16, '0')}${h2.toString(16).padStart(16, '0')}`;
}

export function computeBackupSummaryCounts(state: AppDatabaseState): BackupSummaryCounts {
  const documentRenewals = state.documents.reduce(
    (sum, doc) => sum + (Array.isArray(doc.renewals) ? doc.renewals.length : 0),
    0
  );
  const vat3aArchivedDrafts = state.vat3aDrafts.filter(
    (d) => d.status === 'مؤرشفة' || !!d.archivedAt
  ).length;

  return {
    organizations: state.organizations.length,
    specialists: state.specialists.length,
    documentCategories: state.documentCategories.length,
    taskTypes: state.taskTypes.length,
    tasks: state.tasks.length,
    documents: state.documents.length,
    documentRenewals,
    cases: state.cases.length,
    sessions: state.sessions.length,
    poas: state.poas.length,
    calendarItems: state.calendarItems.length,
    labels: state.labels.length,
    shareLogs: state.shareLogs.length,
    vat3aDrafts: state.vat3aDrafts.length,
    vat3aArchivedDrafts,
  };
}

export function createBackupEnvelope(
  state: AppDatabaseState,
  sourceMode: AuthMode,
  createdAt = new Date().toISOString().slice(0, 19)
): BackupEnvelope {
  const sanitized = stripSensitiveFields(structuredClone(state));
  // Ensure server status messages / active transient connections don't carry host-specific secrets
  sanitized.preferences.integrations = {
    ...sanitized.preferences.integrations,
    serverStatus: 'disconnected',
    serverLastCheckedAt: undefined,
    serverStatusMessage: 'حالة افتراضية ضمن النسخة الاحتياطية.',
    aiStatus: 'disconnected',
    aiLastCheckedAt: undefined,
    aiStatusMessage: 'حالة افتراضية ضمن النسخة الاحتياطية.',
  };

  // Serialize and parse back to ensure undefined fields are stripped identically to JSON.stringify
  const finalPayload = JSON.parse(JSON.stringify(sanitized)) as AppDatabaseState;

  const counts = computeBackupSummaryCounts(finalPayload);
  const integrityHash = computeBackupIntegrityHash(finalPayload);

  return {
    appId: 'haqibat-almaham',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt,
    sourceMode,
    includesAttachments: false,
    attachmentsNote:
      sourceMode === 'server'
        ? 'النسخة الاحتياطية على الخادم تشمل قاعدة البيانات ومخزن المرفقات ضمن صلاحية المدير.'
        : 'في المعاينة المحلية تُصدّر السجلات والروابط والتصنيفات وأنواع المهام والملصقات ومسودات وأرشيف 3A وقواعدها؛ وتُدار المرفقات الثنائية ضمن خطة النسخ في الخادم المشترك.',
    integrityHash,
    counts,
    payload: finalPayload,
  };
}

export function downloadBackupJson(envelope: BackupEnvelope): string {
  const stamp = envelope.createdAt.replace(/[:T]/g, '-').slice(0, 16);
  const filename = `haqibat_almaham_backup_${stamp}.json`;
  const blob = new Blob([JSON.stringify(envelope, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return filename;
}

export interface BackupValidationResult {
  ok: boolean;
  error?: string;
  envelope?: BackupEnvelope;
  counts?: BackupSummaryCounts;
}

const REQUIRED_ARRAY_FIELDS: Array<keyof AppDatabaseState> = [
  'organizations',
  'specialists',
  'documentCategories',
  'taskTypes',
  'tasks',
  'documents',
  'cases',
  'sessions',
  'poas',
  'calendarItems',
  'labels',
  'shareLogs',
  'vat3aDrafts',
];

function hasStringIdList(arr: unknown): arr is Array<{ id: string }> {
  return (
    Array.isArray(arr) &&
    arr.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof (item as { id?: unknown }).id === 'string' &&
        ((item as { id: string }).id.trim().length > 0)
    )
  );
}

export function validateBackupFileText(rawText: string): BackupValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      ok: false,
      error: 'ملف النسخة الاحتياطية غير صالح (تعذّر تحليل JSON؛ قد يكون الملف تالفًا أو مقطوعًا).',
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'بنية الملف غير صالحة.' };
  }

  const candidate = parsed as Partial<BackupEnvelope>;
  if (candidate.appId !== 'haqibat-almaham') {
    return {
      ok: false,
      error: 'هذا الملف لا يعود إلى تطبيق «حقيبة المهام» (معرّف التطبيق غير مطابق).',
    };
  }

  if (candidate.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `إصدار بنية النسخة غير مدعوم (${String(candidate.schemaVersion || 'غير محدد')}).`,
    };
  }

  if (!candidate.payload || typeof candidate.payload !== 'object') {
    return { ok: false, error: 'النسخة الاحتياطية تفتقد كتلة البيانات الأساسية (payload).' };
  }

  const payload = candidate.payload as AppDatabaseState;

  for (const field of REQUIRED_ARRAY_FIELDS) {
    if (!hasStringIdList(payload[field])) {
      return {
        ok: false,
        error: `النسخة تالفة: الجدول «${String(field)}» مفقود أو يحتوي على سجلات دون معرّف صالح.`,
      };
    }
  }

  if (!payload.preferences || typeof payload.preferences !== 'object') {
    return {
      ok: false,
      error: 'النسخة تالفة: إعدادات التفضيلات وقواعد 3A مفقودة.',
    };
  }

  // Verify cryptographic/deterministic integrity hash
  const expectedHash = computeBackupIntegrityHash(payload);
  if (candidate.integrityHash !== expectedHash) {
    return {
      ok: false,
      error:
        'فشل التحقق من سلامة النسخة الاحتياطية: تم تعديل الملف أو تعرض للتلف بعد إنشائه. لم يطرأ أي تغيير على بياناتك الحالية.',
    };
  }

  // Referential integrity checks (sessions -> cases, tasks -> taskTypes)
  const caseIds = new Set(payload.cases.map((c) => c.id));
  for (const sess of payload.sessions) {
    if (!sess.caseId || !caseIds.has(sess.caseId)) {
      return {
        ok: false,
        error: `تعارض روابط داخل النسخة: الجلسة «${sess.title || sess.id}» تشير إلى قضية غير موجودة.`,
      };
    }
  }

  const taskTypeIds = new Set(payload.taskTypes.map((tt) => tt.id));
  for (const t of payload.tasks) {
    if (t.typeId && !taskTypeIds.has(t.typeId)) {
      return {
        ok: false,
        error: `تعارض روابط داخل النسخة: المهمة «${t.title || t.id}» تشير إلى نوع مهمة غير موجود.`,
      };
    }
  }

  if (payload.taskTypes.length === 0) {
    return {
      ok: false,
      error: 'النسخة الاحتياطية غير مكتملة: يجب أن تحتوي على نوع مهمة واحد على الأقل.',
    };
  }

  const counts = computeBackupSummaryCounts(payload);
  return {
    ok: true,
    envelope: candidate as BackupEnvelope,
    counts,
  };
}

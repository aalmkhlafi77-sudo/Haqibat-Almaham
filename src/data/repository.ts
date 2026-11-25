import { getTodayISO } from '../domain/dateUtils';
import { normalizeArabicSearchText } from '../domain/searchUtils';
import {
  buildLegacyVat3ARulesSnapshot,
  evaluateVat3ADraft,
} from '../domain/vat3aEngine';
import {
  AppDatabaseState,
  AppPreferences,
  CalendarItem,
  CaseItem,
  DocumentCategoryItem,
  DocumentItem,
  DocumentRenewal,
  LabelItem,
  PoaItem,
  SessionItem,
  ShareLog,
  Specialist,
  TaskItem,
  TaskTypeItem,
  Vat3ADraft,
} from '../types/domain';
import {
  buildDefaultPreferences,
  buildInitialDocumentCategories,
  buildInitialTaskTypes,
  createSeedDatabase,
} from './seedData';

const STORAGE_KEY = 'haqibat_almaham_db_v1';

export function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export interface DeleteOperationResult {
  ok: boolean;
  error?: string;
  state: AppDatabaseState;
}

export function resolveDocumentCategoryName(
  doc: Pick<DocumentItem, 'categoryId' | 'docType'>,
  categories: DocumentCategoryItem[]
): string {
  if (doc.categoryId) {
    const found = categories.find((c) => c.id === doc.categoryId);
    if (found) return found.name;
  }
  return 'غير مصنفة';
}

export function resolveTaskType(
  task: Pick<TaskItem, 'typeId' | 'type'>,
  taskTypes: TaskTypeItem[]
): TaskTypeItem | undefined {
  if (task.typeId) {
    const byId = taskTypes.find((t) => t.id === task.typeId);
    if (byId) return byId;
  }
  const norm = normalizeArabicSearchText(task.type || '');
  return taskTypes.find((t) => normalizeArabicSearchText(t.name) === norm);
}

export function resolveTaskTypeName(
  task: Pick<TaskItem, 'typeId' | 'type'>,
  taskTypes: TaskTypeItem[]
): string {
  return resolveTaskType(task, taskTypes)?.name || task.type || 'مهمة';
}

const LEGACY_CATEGORY_SYNONYMS: Array<{ keywords: string[]; categoryId: string }> = [
  { keywords: ['تامين صحي', 'تامين طبي'], categoryId: 'cat-health' },
  { keywords: ['تامين مركبات', 'تامين سيارات'], categoryId: 'cat-vehicles' },
  { keywords: ['رخص بلديه', 'رخصه بلديه'], categoryId: 'cat-municipal' },
  { keywords: ['سجلات', 'سجل تجاري'], categoryId: 'cat-records' },
  { keywords: ['شهادات', 'شهاده'], categoryId: 'cat-certs' },
  { keywords: ['اقامات', 'اقامه'], categoryId: 'cat-iqamas' },
  { keywords: ['عقود', 'عقد'], categoryId: 'cat-contracts' },
];

/**
 * Pure, idempotent migration helper used both by LocalStorageDataAdapter
 * and automated test verification for legacy stored records.
 */
export function migrateDatabaseState(
  parsed: Partial<AppDatabaseState>,
  nowIso = `${getTodayISO()}T09:00:00`
): AppDatabaseState {
  const fallback = createSeedDatabase();
  const defaultPrefs = buildDefaultPreferences();

  // 1. Document Categories + legacy doc.docType migration
  const categories: DocumentCategoryItem[] = Array.isArray(parsed.documentCategories)
    ? parsed.documentCategories.map((c) => ({ ...c }))
    : buildInitialDocumentCategories(nowIso);

  const rawDocs = parsed.documents ?? fallback.documents;
  const migratedDocs: DocumentItem[] = rawDocs.map((doc) => {
    // Explicit null means uncategorized; undefined means legacy record needing migration
    if (doc.categoryId !== undefined) {
      const cat = doc.categoryId ? categories.find((c) => c.id === doc.categoryId) : undefined;
      return {
        ...doc,
        categoryId: cat ? cat.id : doc.categoryId === null ? null : null,
        docType: cat ? cat.name : 'غير مصنفة',
      };
    }

    const rawType = (doc.docType || '').trim();
    if (!rawType || rawType === 'غير مصنفة') {
      return { ...doc, categoryId: null, docType: 'غير مصنفة' };
    }

    const norm = normalizeArabicSearchText(rawType);

    // First try exact match against current categories
    let matched = categories.find((c) => normalizeArabicSearchText(c.name) === norm);

    // Next check close singular/plural match for default categories ONLY if exact name matches known singular/plural pair
    if (!matched) {
      const syn = LEGACY_CATEGORY_SYNONYMS.find((entry) =>
        entry.keywords.includes(norm)
      );
      if (syn) {
        matched = categories.find((c) => c.id === syn.categoryId);
      }
    }

    // Preserve distinct legacy names (e.g. 'ترخيص سلامة', 'شهادة امتثال', 'سجل نظامي', 'وثيقة تأسيس', 'بوليصة تأمين')
    if (!matched) {
      const newId = `cat-mig-${categories.length + 1}-${Math.abs(
        Array.from(norm).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 7)
      ).toString(36)}`;
      matched = {
        id: newId,
        orgId: doc.orgId || 'org-01',
        name: rawType,
        createdAt: doc.createdAt || nowIso,
        updatedAt: nowIso,
      };
      categories.push(matched);
    }

    return {
      ...doc,
      categoryId: matched.id,
      docType: matched.name,
    };
  });

  // 2. Task Types + legacy task.type migration
  const taskTypes: TaskTypeItem[] = Array.isArray(parsed.taskTypes)
    ? parsed.taskTypes.map((tt) => ({ ...tt }))
    : buildInitialTaskTypes(nowIso);

  const rawTasks = parsed.tasks ?? fallback.tasks;
  const migratedTasks: TaskItem[] = rawTasks.map((t) => {
    if (t.typeId) {
      const matched = taskTypes.find((tt) => tt.id === t.typeId);
      if (matched) {
        return { ...t, type: matched.name };
      }
    }
    const normType = normalizeArabicSearchText(t.type || '');
    let matched = taskTypes.find((tt) => normalizeArabicSearchText(tt.name) === normType);
    if (!matched && t.documentId) {
      matched = taskTypes.find((tt) => tt.isRenewalKind) || taskTypes[0];
    }
    if (!matched) {
      matched = taskTypes[0];
    }
    return {
      ...t,
      typeId: matched.id,
      type: matched.name,
    };
  });

  // 3. VAT 3A drafts snapshot migration
  const migratedVatDrafts: Vat3ADraft[] = (
    parsed.vat3aDrafts ?? fallback.vat3aDrafts
  ).map((d) => {
    if (d.rulesSnapshot) return d;
    const legacy = buildLegacyVat3ARulesSnapshot();
    const m: Vat3ADraft = {
      ...d,
      rulesSnapshot: legacy,
    };
    m.computedNetHalalas = evaluateVat3ADraft(m).v16Halalas;
    return m;
  });

  // 4. Labels migration (position + attentionPulse)
  const migratedLabels: LabelItem[] = (parsed.labels ?? fallback.labels).map((l) => ({
    ...l,
    posX: l.posX ?? null,
    posY: l.posY ?? null,
    attentionPulse: !!l.attentionPulse,
  }));

  // 5. Preferences & filter migration
  const rawTaskTypeFilter = parsed.preferences?.taskFilters?.type ?? defaultPrefs.taskFilters.type;
  let migratedTaskTypeFilter = rawTaskTypeFilter;
  if (rawTaskTypeFilter && rawTaskTypeFilter !== 'الكل') {
    const byId = taskTypes.find((tt) => tt.id === rawTaskTypeFilter);
    if (!byId) {
      const normF = normalizeArabicSearchText(rawTaskTypeFilter);
      const byName = taskTypes.find((tt) => normalizeArabicSearchText(tt.name) === normF);
      migratedTaskTypeFilter = byName ? byName.id : 'الكل';
    }
  }

  const rawAlertDays = parsed.preferences?.urgentAlertDays;
  const urgentAlertDays: 3 | 5 = rawAlertDays === 5 ? 5 : 3;
  const rawAlertMotion = parsed.preferences?.urgentAlertMotion;
  const urgentAlertMotion: 'repeat_5s' | 'continuous' =
    rawAlertMotion === 'continuous' ? 'continuous' : 'repeat_5s';

  return {
    organizations: parsed.organizations ?? fallback.organizations,
    specialists: parsed.specialists ?? fallback.specialists,
    documentCategories: categories,
    taskTypes,
    tasks: migratedTasks,
    documents: migratedDocs,
    cases: parsed.cases ?? fallback.cases,
    sessions: parsed.sessions ?? fallback.sessions,
    poas: parsed.poas ?? fallback.poas,
    calendarItems: parsed.calendarItems ?? fallback.calendarItems,
    labels: migratedLabels,
    shareLogs: parsed.shareLogs ?? fallback.shareLogs,
    vat3aDrafts: migratedVatDrafts,
    preferences: {
      ...defaultPrefs,
      ...(parsed.preferences || {}),
      urgentAlertDays,
      urgentAlertMotion,
      vat3aRules: {
        ...defaultPrefs.vat3aRules,
        ...(parsed.preferences?.vat3aRules || {}),
        lineRules: {
          ...defaultPrefs.vat3aRules.lineRules,
          ...(parsed.preferences?.vat3aRules?.lineRules || {}),
        },
      },
      integrations: {
        ...defaultPrefs.integrations,
        ...(parsed.preferences?.integrations || {}),
      },
      taskFilters: {
        ...defaultPrefs.taskFilters,
        ...(parsed.preferences?.taskFilters || {}),
        type: migratedTaskTypeFilter,
      },
      documentFilters: {
        ...defaultPrefs.documentFilters,
        ...(parsed.preferences?.documentFilters || {}),
        categoryId: parsed.preferences?.documentFilters?.categoryId ?? 'الكل',
      },
      vatArchiveFilters: {
        ...defaultPrefs.vatArchiveFilters,
        ...(parsed.preferences?.vatArchiveFilters || {}),
      },
      collapsedSections: parsed.preferences?.collapsedSections ?? {},
      navGroupCollapsed: parsed.preferences?.navGroupCollapsed ?? {},
    },
  };
}

export interface DataRepository {
  load(): AppDatabaseState;
  save(state: AppDatabaseState): void;
  resetToDemo(): AppDatabaseState;
  updatePreferences(partial: Partial<AppPreferences>): AppDatabaseState;
  upsertDocumentCategory(cat: DocumentCategoryItem): AppDatabaseState;
  deleteDocumentCategory(
    categoryId: string,
    replacementCategoryId: string | null
  ): AppDatabaseState;
  upsertTaskType(tt: TaskTypeItem): AppDatabaseState;
  deleteTaskType(
    typeId: string,
    replacementTypeId: string
  ): DeleteOperationResult;
  upsertTask(task: TaskItem): AppDatabaseState;
  deleteTask(taskId: string): AppDatabaseState;
  upsertDocument(doc: DocumentItem): AppDatabaseState;
  recordDocumentRenewal(
    documentId: string,
    renewal: Omit<DocumentRenewal, 'id' | 'documentId'>
  ): AppDatabaseState;
  deleteDocument(documentId: string): DeleteOperationResult;
  upsertCase(c: CaseItem): AppDatabaseState;
  deleteCase(caseId: string): AppDatabaseState;
  upsertSession(s: SessionItem): AppDatabaseState;
  deleteSession(sessionId: string): AppDatabaseState;
  upsertPoa(poa: PoaItem): AppDatabaseState;
  deletePoa(poaId: string): AppDatabaseState;
  upsertCalendarItem(item: CalendarItem): AppDatabaseState;
  deleteCalendarItem(itemId: string): AppDatabaseState;
  upsertLabel(label: LabelItem): AppDatabaseState;
  deleteLabel(labelId: string): AppDatabaseState;
  upsertSpecialist(spec: Specialist): AppDatabaseState;
  deleteSpecialist(specialistId: string): AppDatabaseState;
  addShareLog(log: Omit<ShareLog, 'id'>): AppDatabaseState;
  upsertVat3ADraft(draft: Vat3ADraft): AppDatabaseState;
  deleteVat3ADraft(draftId: string): AppDatabaseState;
}

class LocalStorageDataAdapter implements DataRepository {
  private readRaw(): AppDatabaseState {
    if (typeof window === 'undefined') return createSeedDatabase();
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const seeded = createSeedDatabase();
        this.save(seeded);
        return seeded;
      }
      const parsed = JSON.parse(raw) as Partial<AppDatabaseState>;
      return migrateDatabaseState(parsed);
    } catch {
      const seeded = createSeedDatabase();
      this.save(seeded);
      return seeded;
    }
  }

  load(): AppDatabaseState {
    return this.readRaw();
  }

  save(state: AppDatabaseState): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  resetToDemo(): AppDatabaseState {
    const seeded = createSeedDatabase();
    this.save(seeded);
    return seeded;
  }

  updatePreferences(partial: Partial<AppPreferences>): AppDatabaseState {
    const state = this.readRaw();
    const next: AppDatabaseState = {
      ...state,
      preferences: {
        ...state.preferences,
        ...partial,
      },
    };
    this.save(next);
    return next;
  }

  upsertDocumentCategory(cat: DocumentCategoryItem): AppDatabaseState {
    const state = this.readRaw();
    const exists = state.documentCategories.some((c) => c.id === cat.id);
    const documentCategories = exists
      ? state.documentCategories.map((c) => (c.id === cat.id ? cat : c))
      : [...state.documentCategories, cat];
    // Sync cached docType on linked documents (renewals history stays completely untouched)
    const documents = state.documents.map((d) =>
      d.categoryId === cat.id ? { ...d, docType: cat.name } : d
    );
    const next = { ...state, documentCategories, documents };
    this.save(next);
    return next;
  }

  deleteDocumentCategory(
    categoryId: string,
    replacementCategoryId: string | null
  ): AppDatabaseState {
    const state = this.readRaw();
    const replacement = replacementCategoryId
      ? state.documentCategories.find(
          (c) => c.id === replacementCategoryId && c.id !== categoryId
        ) || null
      : null;

    const documentCategories = state.documentCategories.filter(
      (c) => c.id !== categoryId
    );

    // NEVER delete linked documents; either reassign to replacement or clear categoryId to null
    const documents = state.documents.map((doc) => {
      if (doc.categoryId !== categoryId) return doc;
      return {
        ...doc,
        categoryId: replacement ? replacement.id : null,
        docType: replacement ? replacement.name : 'غير مصنفة',
      };
    });

    const currFilterCatId = state.preferences.documentFilters.categoryId;
    const nextFilterCatId =
      currFilterCatId === categoryId
        ? replacement
          ? replacement.id
          : 'الكل'
        : currFilterCatId;

    const next: AppDatabaseState = {
      ...state,
      documentCategories,
      documents,
      preferences: {
        ...state.preferences,
        documentFilters: {
          ...state.preferences.documentFilters,
          categoryId: nextFilterCatId,
        },
      },
    };
    this.save(next);
    return next;
  }

  upsertTaskType(tt: TaskTypeItem): AppDatabaseState {
    const state = this.readRaw();
    const exists = state.taskTypes.some((x) => x.id === tt.id);
    const taskTypes = exists
      ? state.taskTypes.map((x) => (x.id === tt.id ? tt : x))
      : [...state.taskTypes, tt];
    // Sync cached type string on tasks while preserving documentId / caseId / sessionId links
    const tasks = state.tasks.map((t) =>
      t.typeId === tt.id ? { ...t, type: tt.name } : t
    );
    const next = { ...state, taskTypes, tasks };
    this.save(next);
    return next;
  }

  deleteTaskType(
    typeId: string,
    replacementTypeId: string
  ): DeleteOperationResult {
    const state = this.readRaw();
    if (state.taskTypes.length <= 1) {
      return {
        ok: false,
        error: 'يجب الإبقاء على نوع واحد على الأقل للمهام.',
        state,
      };
    }
    const replacement = state.taskTypes.find(
      (tt) => tt.id === replacementTypeId && tt.id !== typeId
    );
    if (!replacement) {
      return {
        ok: false,
        error: 'اختر نوعًا بديلًا لنقل المهام المرتبطة قبل الحذف.',
        state,
      };
    }

    const taskTypes = state.taskTypes.filter((tt) => tt.id !== typeId);
    const tasks = state.tasks.map((t) =>
      t.typeId === typeId
        ? { ...t, typeId: replacement.id, type: replacement.name }
        : t
    );

    const nextFilterType =
      state.preferences.taskFilters.type === typeId
        ? 'الكل'
        : state.preferences.taskFilters.type;

    const next: AppDatabaseState = {
      ...state,
      taskTypes,
      tasks,
      preferences: {
        ...state.preferences,
        taskFilters: {
          ...state.preferences.taskFilters,
          type: nextFilterType,
        },
      },
    };
    this.save(next);
    return { ok: true, state: next };
  }

  upsertTask(task: TaskItem): AppDatabaseState {
    const state = this.readRaw();
    const tt = state.taskTypes.find((x) => x.id === task.typeId);
    const syncedTask: TaskItem = {
      ...task,
      type: tt ? tt.name : task.type,
    };
    const exists = state.tasks.some((t) => t.id === syncedTask.id);
    const tasks = exists
      ? state.tasks.map((t) => (t.id === syncedTask.id ? syncedTask : t))
      : [syncedTask, ...state.tasks];
    const next = { ...state, tasks };
    this.save(next);
    return next;
  }

  deleteTask(taskId: string): AppDatabaseState {
    const state = this.readRaw();
    const next: AppDatabaseState = {
      ...state,
      tasks: state.tasks.filter((t) => t.id !== taskId),
      labels: state.labels.filter(
        (l) => !(l.targetType === 'task' && l.targetId === taskId)
      ),
      calendarItems: state.calendarItems.map((c) =>
        c.linkedRecordType === 'task' && c.linkedRecordId === taskId
          ? { ...c, linkedRecordType: null, linkedRecordId: null }
          : c
      ),
    };
    this.save(next);
    return next;
  }

  upsertDocument(doc: DocumentItem): AppDatabaseState {
    const state = this.readRaw();
    const cat = doc.categoryId
      ? state.documentCategories.find((c) => c.id === doc.categoryId)
      : undefined;
    const syncedDoc: DocumentItem = {
      ...doc,
      categoryId: cat ? cat.id : null,
      docType: cat ? cat.name : 'غير مصنفة',
    };
    const exists = state.documents.some((d) => d.id === syncedDoc.id);
    const documents = exists
      ? state.documents.map((d) => (d.id === syncedDoc.id ? syncedDoc : d))
      : [syncedDoc, ...state.documents];
    const next = { ...state, documents };
    this.save(next);
    return next;
  }

  recordDocumentRenewal(
    documentId: string,
    renewal: Omit<DocumentRenewal, 'id' | 'documentId'>
  ): AppDatabaseState {
    const state = this.readRaw();
    const documents = state.documents.map((doc) => {
      if (doc.id !== documentId) return doc;
      const entry: DocumentRenewal = {
        id: generateId('ren'),
        documentId,
        ...renewal,
      };
      return {
        ...doc,
        expiryDate: renewal.newExpiryDate,
        archivedAt: null,
        renewals: [entry, ...doc.renewals],
        updatedAt: renewal.renewedAt,
      };
    });
    const next = { ...state, documents };
    this.save(next);
    return next;
  }

  /**
   * Unified with MySQL `ON DELETE RESTRICT` on `document_renewals.document_id`:
   * Documents with renewal history cannot be permanently deleted; use archival instead.
   */
  deleteDocument(documentId: string): DeleteOperationResult {
    const state = this.readRaw();
    const doc = state.documents.find((d) => d.id === documentId);
    if (doc && doc.renewals.length > 0) {
      return {
        ok: false,
        error: `لا يمكن حذف الوثيقة نهائيًا لأنها تحتوي على ${doc.renewals.length} سجل تجديد تاريخي؛ استخدم الأرشفة للاحتفاظ بالتاريخ.`,
        state,
      };
    }

    const next: AppDatabaseState = {
      ...state,
      documents: state.documents.filter((d) => d.id !== documentId),
      tasks: state.tasks.map((t) =>
        t.documentId === documentId ? { ...t, documentId: null } : t
      ),
      labels: state.labels.filter(
        (l) => !(l.targetType === 'document' && l.targetId === documentId)
      ),
      calendarItems: state.calendarItems.map((c) =>
        c.linkedRecordType === 'document' && c.linkedRecordId === documentId
          ? { ...c, linkedRecordType: null, linkedRecordId: null }
          : c
      ),
    };
    this.save(next);
    return { ok: true, state: next };
  }

  /**
   * Unified with MySQL `ON DELETE CASCADE` on `case_sessions(case_id)` + `SET NULL` on tasks & calendar items
   * (cleaning both direct case links AND links to any cascaded child sessions).
   */
  deleteCase(caseId: string): AppDatabaseState {
    const state = this.readRaw();
    const removedSessionIds = new Set(
      state.sessions.filter((s) => s.caseId === caseId).map((s) => s.id)
    );
    const next: AppDatabaseState = {
      ...state,
      cases: state.cases.filter((c) => c.id !== caseId),
      sessions: state.sessions.filter((s) => s.caseId !== caseId),
      tasks: state.tasks.map((t) => ({
        ...t,
        caseId: t.caseId === caseId ? null : t.caseId,
        sessionId:
          t.sessionId && removedSessionIds.has(t.sessionId) ? null : t.sessionId,
      })),
      labels: state.labels.filter(
        (l) => !(l.targetType === 'case' && l.targetId === caseId)
      ),
      calendarItems: state.calendarItems.map((c) => {
        const linkedToCase =
          c.linkedRecordType === 'case' && c.linkedRecordId === caseId;
        const linkedToRemovedSession =
          c.linkedRecordType === 'session' &&
          !!c.linkedRecordId &&
          removedSessionIds.has(c.linkedRecordId);
        return linkedToCase || linkedToRemovedSession
          ? { ...c, linkedRecordType: null, linkedRecordId: null }
          : c;
      }),
    };
    this.save(next);
    return next;
  }

  upsertCase(c: CaseItem): AppDatabaseState {
    const state = this.readRaw();
    const exists = state.cases.some((x) => x.id === c.id);
    const cases = exists
      ? state.cases.map((x) => (x.id === c.id ? c : x))
      : [c, ...state.cases];
    const next = { ...state, cases };
    this.save(next);
    return next;
  }

  upsertSession(s: SessionItem): AppDatabaseState {
    const state = this.readRaw();
    const exists = state.sessions.some((x) => x.id === s.id);
    const sessions = exists
      ? state.sessions.map((x) => (x.id === s.id ? s : x))
      : [s, ...state.sessions];
    const next = { ...state, sessions };
    this.save(next);
    return next;
  }

  deleteSession(sessionId: string): AppDatabaseState {
    const state = this.readRaw();
    const next: AppDatabaseState = {
      ...state,
      sessions: state.sessions.filter((s) => s.id !== sessionId),
      tasks: state.tasks.map((t) =>
        t.sessionId === sessionId ? { ...t, sessionId: null } : t
      ),
      calendarItems: state.calendarItems.map((c) =>
        c.linkedRecordType === 'session' && c.linkedRecordId === sessionId
          ? { ...c, linkedRecordType: null, linkedRecordId: null }
          : c
      ),
    };
    this.save(next);
    return next;
  }

  upsertPoa(poa: PoaItem): AppDatabaseState {
    const state = this.readRaw();
    const exists = state.poas.some((x) => x.id === poa.id);
    const poas = exists
      ? state.poas.map((x) => (x.id === poa.id ? poa : x))
      : [poa, ...state.poas];
    const next = { ...state, poas };
    this.save(next);
    return next;
  }

  deletePoa(poaId: string): AppDatabaseState {
    const state = this.readRaw();
    const next: AppDatabaseState = {
      ...state,
      poas: state.poas.filter((p) => p.id !== poaId),
      calendarItems: state.calendarItems.map((c) =>
        c.linkedRecordType === 'poa' && c.linkedRecordId === poaId
          ? { ...c, linkedRecordType: null, linkedRecordId: null }
          : c
      ),
    };
    this.save(next);
    return next;
  }

  upsertCalendarItem(item: CalendarItem): AppDatabaseState {
    const state = this.readRaw();
    const exists = state.calendarItems.some((x) => x.id === item.id);
    const calendarItems = exists
      ? state.calendarItems.map((x) => (x.id === item.id ? item : x))
      : [item, ...state.calendarItems];
    const next = { ...state, calendarItems };
    this.save(next);
    return next;
  }

  deleteCalendarItem(itemId: string): AppDatabaseState {
    const state = this.readRaw();
    const next: AppDatabaseState = {
      ...state,
      calendarItems: state.calendarItems.filter((c) => c.id !== itemId),
    };
    this.save(next);
    return next;
  }

  upsertLabel(label: LabelItem): AppDatabaseState {
    const state = this.readRaw();
    const exists = state.labels.some((x) => x.id === label.id);
    const labels = exists
      ? state.labels.map((x) => (x.id === label.id ? label : x))
      : [...state.labels, label];
    const next = { ...state, labels };
    this.save(next);
    return next;
  }

  deleteLabel(labelId: string): AppDatabaseState {
    const state = this.readRaw();
    const next: AppDatabaseState = {
      ...state,
      labels: state.labels.filter((l) => l.id !== labelId),
    };
    this.save(next);
    return next;
  }

  upsertSpecialist(spec: Specialist): AppDatabaseState {
    const state = this.readRaw();
    const exists = state.specialists.some((x) => x.id === spec.id);
    const specialists = exists
      ? state.specialists.map((x) => (x.id === spec.id ? spec : x))
      : [...state.specialists, spec];
    const next = { ...state, specialists };
    this.save(next);
    return next;
  }

  deleteSpecialist(specialistId: string): AppDatabaseState {
    const state = this.readRaw();
    const next: AppDatabaseState = {
      ...state,
      specialists: state.specialists.filter((s) => s.id !== specialistId),
      tasks: state.tasks.map((t) =>
        t.specialistId === specialistId ? { ...t, specialistId: null } : t
      ),
      documents: state.documents.map((d) =>
        d.specialistId === specialistId ? { ...d, specialistId: null } : d
      ),
      cases: state.cases.map((c) =>
        c.lawyerSpecialistId === specialistId ? { ...c, lawyerSpecialistId: null } : c
      ),
      sessions: state.sessions.map((s) =>
        s.specialistId === specialistId ? { ...s, specialistId: null } : s
      ),
      poas: state.poas.map((p) =>
        p.specialistId === specialistId ? { ...p, specialistId: null } : p
      ),
      calendarItems: state.calendarItems.map((ci) =>
        ci.specialistId === specialistId ? { ...ci, specialistId: null } : ci
      ),
    };
    this.save(next);
    return next;
  }

  addShareLog(log: Omit<ShareLog, 'id'>): AppDatabaseState {
    const state = this.readRaw();
    const entry: ShareLog = {
      id: generateId('sh'),
      ...log,
    };
    const next: AppDatabaseState = {
      ...state,
      shareLogs: [entry, ...state.shareLogs],
    };
    this.save(next);
    return next;
  }

  upsertVat3ADraft(draft: Vat3ADraft): AppDatabaseState {
    const state = this.readRaw();
    const exists = state.vat3aDrafts.some((x) => x.id === draft.id);
    const vat3aDrafts = exists
      ? state.vat3aDrafts.map((x) => (x.id === draft.id ? draft : x))
      : [draft, ...state.vat3aDrafts];
    const next = { ...state, vat3aDrafts };
    this.save(next);
    return next;
  }

  deleteVat3ADraft(draftId: string): AppDatabaseState {
    const state = this.readRaw();
    const next: AppDatabaseState = {
      ...state,
      vat3aDrafts: state.vat3aDrafts.filter((d) => d.id !== draftId),
    };
    this.save(next);
    return next;
  }
}

export const dataRepository: DataRepository = new LocalStorageDataAdapter();

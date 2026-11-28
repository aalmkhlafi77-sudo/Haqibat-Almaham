import type { RecurrenceFrequency } from '../domain/recurrenceDates';
import { getTodayISO } from '../domain/dateUtils';
import { normalizeArabicSearchText } from '../domain/searchUtils';
import {
  buildLegacyVat3ARulesSnapshot,
  evaluateVat3ADraft,
} from '../domain/vat3aEngine';
import {
  computeBackupIntegrityHash,
  validateBackupFileText,
} from '../domain/backupUtils';
import {
  AppDatabaseState,
  AppPreferences,
  BackupEnvelope,
  CalendarItem,
  CaseItem,
  DocumentCategoryItem,
  DocumentItem,
  DocumentRenewal,
  LabelItem,
  ProjectItem,
  IdeaItem,
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
const PRE_RESTORE_SNAPSHOT_KEY = 'haqibat_almaham_pre_restore_snapshot_v1';
const DEMO_SESSION_PROFILE_KEY = 'haqibat_almaham_demo_profile_id_v1';
const LAST_BACKUP_META_KEY = 'haqibat_almaham_last_backup_meta_v1';

export function getDemoSessionProfileId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(DEMO_SESSION_PROFILE_KEY);
}

export function setDemoSessionProfileId(profileId: string | null): void {
  if (typeof window === 'undefined') return;
  if (!profileId) {
    window.localStorage.removeItem(DEMO_SESSION_PROFILE_KEY);
  } else {
    window.localStorage.setItem(DEMO_SESSION_PROFILE_KEY, profileId);
  }
}

export interface LastBackupMeta {
  createdAt: string;
  schemaVersion: string;
  sourceMode: 'local_demo' | 'server';
}

export function getLastBackupMeta(): LastBackupMeta | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LAST_BACKUP_META_KEY);
    return raw ? (JSON.parse(raw) as LastBackupMeta) : null;
  } catch {
    return null;
  }
}

export function saveLastBackupMeta(meta: LastBackupMeta): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LAST_BACKUP_META_KEY, JSON.stringify(meta));
}

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
  const legacyDefaults = buildLegacyVat3ARulesSnapshot();
  const migratedVatDrafts: Vat3ADraft[] = (
    parsed.vat3aDrafts ?? fallback.vat3aDrafts
  ).map((d) => {
    if (d.rulesSnapshot) {
      if (!d.rulesSnapshot.lineRules?.[9]) {
        return {
          ...d,
          rulesSnapshot: {
            ...d.rulesSnapshot,
            lineRules: {
              ...legacyDefaults.lineRules,
              ...(d.rulesSnapshot.lineRules || {}),
            },
          },
        };
      }
      return d;
    }
    const m: Vat3ADraft = {
      ...d,
      rulesSnapshot: legacyDefaults,
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
  const urgentAlertMotion: 'repeat_5s' | 'continuous' | 'strong_shake' =
    rawAlertMotion === 'continuous'
      ? 'continuous'
      : rawAlertMotion === 'strong_shake'
      ? 'strong_shake'
      : 'repeat_5s';

  return {
    organizations: parsed.organizations ?? fallback.organizations,
    specialists: parsed.specialists ?? fallback.specialists,
    documentCategories: categories,
    taskTypes,
    recurrenceSeries: Array.isArray(parsed.recurrenceSeries) ? parsed.recurrenceSeries : [],
    projects: Array.isArray(parsed.projects) ? parsed.projects : [],
    ideas: Array.isArray(parsed.ideas) ? parsed.ideas : [],
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
  upsertProject(project: ProjectItem): AppDatabaseState;
  deleteProject(id: string): AppDatabaseState;
  upsertIdea(idea: IdeaItem): AppDatabaseState;
  deleteIdea(id: string): AppDatabaseState;
  createTaskFromIdea(task: TaskItem, ideaId: string): AppDatabaseState;
  createProjectFromIdea(project: ProjectItem, ideaId: string): AppDatabaseState;
  configureRecurrence(kind: 'task' | 'calendar_item', recordId: string, seriesId: string, frequency: RecurrenceFrequency, until: string | null, reminderDays: number): AppDatabaseState;
  stopRecurrence(seriesId: string): AppDatabaseState;
  updateRecurrence(seriesId: string, until: string | null, reminderDays: number): AppDatabaseState;
  updateRecurringTaskFuture(task: TaskItem): AppDatabaseState;
  updateRecurringCalendarFuture(item: CalendarItem): AppDatabaseState;
  deleteRecurringFuture(kind: 'task' | 'calendar_item', recordId: string): AppDatabaseState;
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
  restoreBackupPayload(envelope: BackupEnvelope): DeleteOperationResult;
}

export class StateDataRepository implements DataRepository {
  constructor(
    private readonly readRaw: () => AppDatabaseState,
    private readonly write: (state: AppDatabaseState) => void
  ) {}

  load(): AppDatabaseState {
    return this.readRaw();
  }

  save(state: AppDatabaseState): void {
    this.write(state);
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
    const recurrenceSeries = state.recurrenceSeries.map(s => s.kind === 'task' && s.template.typeId === tt.id ? { ...s, template: { ...s.template, type: tt.name } } : s);
    const next = { ...state, taskTypes, tasks, recurrenceSeries };
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
      recurrenceSeries: state.recurrenceSeries.map(s => s.kind === 'task' && s.template.typeId === typeId ? { ...s, template: { ...s.template, typeId: replacement.id, type: replacement.name } } : s),
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

  upsertProject(project: ProjectItem): AppDatabaseState {
    const state = this.readRaw();
    const projects = state.projects.some(p => p.id === project.id)
      ? state.projects.map(p => p.id === project.id ? project : p) : [project, ...state.projects];
    const next = { ...state, projects };
    this.save(next);
    return next;
  }

  deleteProject(id: string): AppDatabaseState {
    const state = this.readRaw();
    const next = { ...state, projects: state.projects.filter(p => p.id !== id),
      ideas: state.ideas.map(idea => idea.projectId === id ? { ...idea, projectId: null } : idea) };
    this.save(next);
    return next;
  }

  upsertIdea(idea: IdeaItem): AppDatabaseState {
    const state = this.readRaw();
    const ideas = state.ideas.some(i => i.id === idea.id)
      ? state.ideas.map(i => i.id === idea.id ? idea : i) : [idea, ...state.ideas];
    const next = { ...state, ideas };
    this.save(next);
    return next;
  }

  deleteIdea(id: string): AppDatabaseState {
    const state = this.readRaw();
    const next = { ...state, ideas: state.ideas.filter(i => i.id !== id) };
    this.save(next);
    return next;
  }

  createTaskFromIdea(task: TaskItem, ideaId: string): AppDatabaseState {
    const state = this.readRaw();
    const idea = state.ideas.find(i => i.id === ideaId);
    if (!idea || idea.taskId || state.tasks.some(t => t.id === task.id)) throw new Error('تعذر تحويل الفكرة إلى مهمة.');
    const next = { ...state, tasks: [task, ...state.tasks], ideas: state.ideas.map(i => i.id === ideaId ? { ...i, taskId: task.id, updatedAt: task.updatedAt } : i) };
    this.save(next);
    return next;
  }

  createProjectFromIdea(project: ProjectItem, ideaId: string): AppDatabaseState {
    const state = this.readRaw();
    const idea = state.ideas.find(i => i.id === ideaId);
    if (!idea || idea.projectId || state.projects.some(p => p.id === project.id)) throw new Error('تعذر تحويل الفكرة إلى مشروع.');
    const next = { ...state, projects: [project, ...state.projects], ideas: state.ideas.map(i => i.id === ideaId ? { ...i, projectId: project.id, updatedAt: project.updatedAt } : i) };
    this.save(next);
    return next;
  }

  configureRecurrence(kind: 'task' | 'calendar_item', recordId: string, seriesId: string, frequency: RecurrenceFrequency, until: string | null, reminderDays: number): AppDatabaseState {
    const state = this.readRaw();
    const record = kind === 'task' ? state.tasks.find(t => t.id === recordId) : state.calendarItems.find(c => c.id === recordId);
    if (!record || record.recurrenceSeriesId || state.recurrenceSeries.some(s => s.id === seriesId)) throw new Error('السجل غير متاح أو مرتبط بسلسلة تكرار.');
    const anchor = kind === 'task' ? (record as TaskItem).dueDate : (record as CalendarItem).scheduledAt.slice(0,10);
    const common = { id: seriesId, frequency, anchor, until, active: true, nextIndex: 1, reminderDays };
    const series = kind === 'task' ? { ...common, kind: 'task' as const, template: record as TaskItem } : { ...common, kind: 'calendar_item' as const, template: record as CalendarItem };
    const next = { ...state, recurrenceSeries: [...state.recurrenceSeries, series],
      tasks: kind === 'task' ? state.tasks.map(t => t.id === recordId ? { ...t, recurrenceSeriesId: seriesId, recurrenceIndex: 0 } : t) : state.tasks,
      calendarItems: kind === 'calendar_item' ? state.calendarItems.map(c => c.id === recordId ? { ...c, recurrenceSeriesId: seriesId, recurrenceIndex: 0 } : c) : state.calendarItems };
    this.save(next); return next;
  }

  updateRecurrence(seriesId: string, until: string | null, reminderDays: number): AppDatabaseState {
    const state = this.readRaw();
    const next = { ...state, recurrenceSeries: state.recurrenceSeries.map(s => s.id === seriesId ? { ...s, until, reminderDays } : s) };
    this.save(next); return next;
  }

  stopRecurrence(seriesId: string): AppDatabaseState {
    const state = this.readRaw();
    const next = { ...state, recurrenceSeries: state.recurrenceSeries.map(s => s.id === seriesId ? { ...s, active: false } : s) };
    this.save(next); return next;
  }

  updateRecurringTaskFuture(task: TaskItem): AppDatabaseState {
    const state = this.readRaw(); const previous = state.tasks.find(t => t.id === task.id);
    const series = state.recurrenceSeries.find(s => s.id === previous?.recurrenceSeriesId && s.kind === 'task');
    if (!previous || !series || !series.active || previous.recurrenceIndex == null) throw new Error('سلسلة المهمة غير متاحة.');
    const { title, typeId, type, specialistId, departmentName, priority, notes, authorityName, letterNumber, documentId, caseId, sessionId } = task;
    const fields = { title, typeId, type, specialistId, departmentName, priority, notes, authorityName, letterNumber, documentId, caseId, sessionId };
    const next = { ...state,
      tasks: state.tasks.map(t => t.id === task.id ? task : t.recurrenceSeriesId === series.id && (t.recurrenceIndex ?? -1) > previous.recurrenceIndex! && t.status !== 'مكتملة' && t.status !== 'ملغاة' ? { ...t, ...fields } : t),
      recurrenceSeries: state.recurrenceSeries.map(s => s.id === series.id && s.kind === 'task' ? { ...s, template: { ...s.template, ...fields } } : s),
    }; this.save(next); return next;
  }

  updateRecurringCalendarFuture(item: CalendarItem): AppDatabaseState {
    const state = this.readRaw(); const previous = state.calendarItems.find(c => c.id === item.id);
    const series = state.recurrenceSeries.find(s => s.id === previous?.recurrenceSeriesId && s.kind === 'calendar_item');
    if (!previous || !series || !series.active || previous.recurrenceIndex == null) throw new Error('سلسلة التذكير غير متاحة.');
    const { title, kind, specialistId, isAllDay, notes, linkedRecordType, linkedRecordId } = item;
    const fields = { title, kind, specialistId, isAllDay, notes, linkedRecordType, linkedRecordId };
    const time = item.scheduledAt.slice(10);
    const next = { ...state,
      calendarItems: state.calendarItems.map(c => c.id === item.id ? item : c.recurrenceSeriesId === series.id && (c.recurrenceIndex ?? -1) > previous.recurrenceIndex! && !c.isDone ? { ...c, ...fields, scheduledAt: c.scheduledAt.slice(0,10) + time } : c),
      recurrenceSeries: state.recurrenceSeries.map(s => s.id === series.id && s.kind === 'calendar_item' ? { ...s, template: { ...s.template, ...fields, scheduledAt: s.template.scheduledAt.slice(0,10) + time } } : s),
    }; this.save(next); return next;
  }

  deleteRecurringFuture(kind: 'task' | 'calendar_item', recordId: string): AppDatabaseState {
    const state = this.readRaw();
    const current = kind === 'task' ? state.tasks.find(t => t.id === recordId) : state.calendarItems.find(c => c.id === recordId);
    if (!current?.recurrenceSeriesId || current.recurrenceIndex == null) throw new Error('السجل غير مرتبط بسلسلة تكرار.');
    const seriesId = current.recurrenceSeriesId, start = current.recurrenceIndex;
    const ids = kind === 'task' ? state.tasks.filter(t => t.recurrenceSeriesId === seriesId && (t.recurrenceIndex ?? -1) >= start && (t.id === recordId || (t.status !== 'مكتملة' && t.status !== 'ملغاة'))).map(t => t.id) : state.calendarItems.filter(c => c.recurrenceSeriesId === seriesId && (c.recurrenceIndex ?? -1) >= start && (c.id === recordId || !c.isDone)).map(c => c.id);
    for (const id of ids) kind === 'task' ? this.deleteTask(id) : this.deleteCalendarItem(id);
    return this.stopRecurrence(seriesId);
  }

  upsertTask(task: TaskItem): AppDatabaseState {
    const state = this.readRaw();
    const tt = state.taskTypes.find((x) => x.id === task.typeId);
    const existing = state.tasks.find(t => t.id === task.id);
    const syncedTask: TaskItem = {
      ...task,
      recurrenceSeriesId: existing?.recurrenceSeriesId ?? task.recurrenceSeriesId,
      recurrenceIndex: existing?.recurrenceIndex ?? task.recurrenceIndex,
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
      projects: state.projects.map(p => ({ ...p, taskIds: p.taskIds.filter(id => id !== taskId) })),
      ideas: state.ideas.map(idea => idea.taskId === taskId ? { ...idea, taskId: null } : idea),
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
      projects: state.projects.map(p => ({ ...p, documentIds: p.documentIds.filter(id => id !== documentId) })),
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
      projects: state.projects.map(p => p.specialistId === specialistId ? { ...p, specialistId: null } : p),
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

  restoreBackupPayload(envelope: BackupEnvelope): DeleteOperationResult {
    const preSnapshot = this.readRaw();
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(
          PRE_RESTORE_SNAPSHOT_KEY,
          JSON.stringify({
            capturedAt: new Date().toISOString().slice(0, 19),
            state: preSnapshot,
          })
        );
      } catch {
        // Proceed with in-memory rollback guarantee even if storage quota is tight
      }
    }

    try {
      const serialized = JSON.stringify(envelope);
      const check = validateBackupFileText(serialized);
      if (!check.ok || !check.envelope) {
        return {
          ok: false,
          error: check.error || 'ملف النسخة الاحتياطية غير صالح.',
          state: preSnapshot,
        };
      }

      if (computeBackupIntegrityHash(check.envelope.payload) !== check.envelope.integrityHash) {
        return {
          ok: false,
          error: 'فشل التحقق من سلامة النسخة الاحتياطية؛ لم تتغير البيانات الحالية.',
          state: preSnapshot,
        };
      }

      const migrated = migrateDatabaseState(check.envelope.payload);
      // Verify critical collections survived migration cleanly
      if (
        migrated.tasks.length !== check.envelope.payload.tasks.length ||
        migrated.documents.length !== check.envelope.payload.documents.length ||
        migrated.cases.length !== check.envelope.payload.cases.length ||
        migrated.sessions.length !== check.envelope.payload.sessions.length
      ) {
        throw new Error('تعذر التحقق من تطابق أعداد السجلات بعد الترحيل.');
      }

      this.save(migrated);
      return { ok: true, state: migrated };
    } catch (err) {
      // Atomic rollback to pre-restore snapshot
      this.save(preSnapshot);
      return {
        ok: false,
        error:
          err instanceof Error
            ? `تعذرت الاستعادة (${err.message}) — تم الإبقاء على البيانات الحالية سليمة.`
            : 'تعذرت الاستعادة — تم الإبقاء على البيانات الحالية سليمة.',
        state: preSnapshot,
      };
    }
  }
}

const readLocalState = (): AppDatabaseState => {
  if (typeof window === 'undefined') return createSeedDatabase();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return migrateDatabaseState(JSON.parse(raw) as Partial<AppDatabaseState>);
    } catch {
      // Replace an unreadable preview state with the demo defaults.
    }
  }
  const seeded = createSeedDatabase();
  dataRepository.save(seeded);
  return seeded;
};

export const dataRepository: DataRepository = new StateDataRepository(readLocalState, (state) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
});

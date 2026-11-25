import {
  AppDatabaseState,
  AppPreferences,
  CalendarItem,
  CaseItem,
  DocumentItem,
  DocumentRenewal,
  LabelItem,
  PoaItem,
  SessionItem,
  ShareLog,
  Specialist,
  TaskItem,
  Vat3ADraft,
} from '../types/domain';
import { buildDefaultPreferences, createSeedDatabase } from './seedData';

const STORAGE_KEY = 'haqibat_almaham_db_v1';

export function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export interface DataRepository {
  load(): AppDatabaseState;
  save(state: AppDatabaseState): void;
  resetToDemo(): AppDatabaseState;
  updatePreferences(partial: Partial<AppPreferences>): AppDatabaseState;
  upsertTask(task: TaskItem): AppDatabaseState;
  deleteTask(taskId: string): AppDatabaseState;
  upsertDocument(doc: DocumentItem): AppDatabaseState;
  recordDocumentRenewal(
    documentId: string,
    renewal: Omit<DocumentRenewal, 'id' | 'documentId'>
  ): AppDatabaseState;
  deleteDocument(documentId: string): AppDatabaseState;
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
      const fallback = createSeedDatabase();
      const defaultPrefs = buildDefaultPreferences();
      return {
        organizations: parsed.organizations ?? fallback.organizations,
        specialists: parsed.specialists ?? fallback.specialists,
        tasks: parsed.tasks ?? fallback.tasks,
        documents: parsed.documents ?? fallback.documents,
        cases: parsed.cases ?? fallback.cases,
        sessions: parsed.sessions ?? fallback.sessions,
        poas: parsed.poas ?? fallback.poas,
        calendarItems: parsed.calendarItems ?? fallback.calendarItems,
        labels: parsed.labels ?? fallback.labels,
        shareLogs: parsed.shareLogs ?? fallback.shareLogs,
        vat3aDrafts: parsed.vat3aDrafts ?? fallback.vat3aDrafts,
        preferences: {
          ...defaultPrefs,
          ...(parsed.preferences || {}),
          taskFilters: {
            ...defaultPrefs.taskFilters,
            ...(parsed.preferences?.taskFilters || {}),
          },
          documentFilters: {
            ...defaultPrefs.documentFilters,
            ...(parsed.preferences?.documentFilters || {}),
          },
          vatArchiveFilters: {
            ...defaultPrefs.vatArchiveFilters,
            ...(parsed.preferences?.vatArchiveFilters || {}),
          },
          collapsedSections: parsed.preferences?.collapsedSections ?? {},
          navGroupCollapsed: parsed.preferences?.navGroupCollapsed ?? {},
        },
      };
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

  upsertTask(task: TaskItem): AppDatabaseState {
    const state = this.readRaw();
    const exists = state.tasks.some((t) => t.id === task.id);
    const tasks = exists
      ? state.tasks.map((t) => (t.id === task.id ? task : t))
      : [task, ...state.tasks];
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
    const exists = state.documents.some((d) => d.id === doc.id);
    const documents = exists
      ? state.documents.map((d) => (d.id === doc.id ? doc : d))
      : [doc, ...state.documents];
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

  deleteDocument(documentId: string): AppDatabaseState {
    const state = this.readRaw();
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
      calendarItems: state.calendarItems.map((c) =>
        c.linkedRecordType === 'case' && c.linkedRecordId === caseId
          ? { ...c, linkedRecordType: null, linkedRecordId: null }
          : c
      ),
    };
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

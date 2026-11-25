import React, { createContext, useContext, useEffect, useState } from 'react';
import { dataRepository, generateId } from '../data/repository';
import {
  AppDatabaseState,
  AppPreferences,
  CalendarItem,
  CaseItem,
  DocumentFilters,
  DocumentItem,
  DocumentRenewal,
  LabelItem,
  NavSection,
  PoaItem,
  RecordType,
  SessionItem,
  ShareChannel,
  ShareLog,
  Specialist,
  TaskFilters,
  TaskItem,
  ThemeMode,
  Vat3AArchiveFilters,
  Vat3ADraft,
} from '../types/domain';

export interface ActiveRecordTarget {
  type: RecordType;
  id: string | null; // null means creating new
  prefill?: Record<string, unknown>;
}

export interface ShareTargetPayload {
  recordType: RecordType | 'document_renewal';
  recordId: string;
  recordTitle: string;
  specialistId: string | null;
  scheduledInfo: string;
  defaultMessage: string;
}

interface AppContextValue {
  db: AppDatabaseState;
  activeRecord: ActiveRecordTarget | null;
  shareTarget: ShareTargetPayload | null;
  toast: string | null;
  showToast: (msg: string) => void;
  openRecord: (type: RecordType, id: string | null, prefill?: Record<string, unknown>) => void;
  closeRecord: () => void;
  openShareModal: (payload: ShareTargetPayload) => void;
  closeShareModal: () => void;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setActiveNav: (nav: NavSection) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setShowHijri: (show: boolean) => void;
  setCurrentSpecialistId: (id: string) => void;
  setDocumentWarningDays: (days: number) => void;
  toggleSectionCollapsed: (key: string) => void;
  setSectionsCollapsed: (keys: string[], collapsed: boolean) => void;
  toggleNavGroupCollapsed: (key: string) => void;
  updateTaskFilters: (partial: Partial<TaskFilters>) => void;
  updateDocumentFilters: (partial: Partial<DocumentFilters>) => void;
  updateVatArchiveFilters: (partial: Partial<Vat3AArchiveFilters>) => void;
  saveTask: (task: Omit<TaskItem, 'id' | 'createdAt' | 'updatedAt' | 'orgId'> & { id?: string }) => TaskItem;
  deleteTask: (id: string) => void;
  saveDocument: (doc: Omit<DocumentItem, 'id' | 'createdAt' | 'updatedAt' | 'orgId' | 'renewals'> & { id?: string; renewals?: DocumentRenewal[] }) => DocumentItem;
  recordDocumentRenewal: (documentId: string, renewal: Omit<DocumentRenewal, 'id' | 'documentId'>) => void;
  deleteDocument: (id: string) => void;
  saveCase: (c: Omit<CaseItem, 'id' | 'createdAt' | 'updatedAt' | 'orgId'> & { id?: string }) => CaseItem;
  deleteCase: (id: string) => void;
  saveSession: (s: Omit<SessionItem, 'id' | 'createdAt' | 'updatedAt' | 'orgId'> & { id?: string }) => SessionItem;
  deleteSession: (id: string) => void;
  savePoa: (p: Omit<PoaItem, 'id' | 'createdAt' | 'updatedAt' | 'orgId'> & { id?: string }) => PoaItem;
  deletePoa: (id: string) => void;
  saveCalendarItem: (ci: Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt' | 'orgId'> & { id?: string }) => CalendarItem;
  deleteCalendarItem: (id: string) => void;
  saveLabel: (lbl: Omit<LabelItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
  deleteLabel: (id: string) => void;
  saveSpecialist: (spec: Omit<Specialist, 'id' | 'orgId'> & { id?: string }) => void;
  deleteSpecialist: (id: string) => void;
  logShareOpened: (
    payload: ShareTargetPayload,
    specialist: Specialist,
    channel: ShareChannel,
    messageText: string
  ) => void;
  saveVat3ADraft: (draft: Vat3ADraft) => void;
  deleteVat3ADraft: (id: string) => void;
  resetDemoData: () => void;
  getDeleteImpact: (type: RecordType | 'specialist' | 'vat3a', id: string) => { title: string; impactLines: string[] };
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [db, setDb] = useState<AppDatabaseState>(() => dataRepository.load());
  const [activeRecord, setActiveRecord] = useState<ActiveRecordTarget | null>(null);
  const [shareTarget, setShareTarget] = useState<ShareTargetPayload | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const isDark = db.preferences.theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
  }, [db.preferences.theme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const rType = params.get('recordType') as RecordType | null;
    const rId = params.get('recordId');
    if (rType && rId) {
      setActiveRecord({ type: rType, id: rId });
    }
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 3200);
  };

  const patchPrefs = (partial: Partial<AppPreferences>) => {
    setDb(dataRepository.updatePreferences(partial));
  };

  const openRecord = (type: RecordType, id: string | null, prefill?: Record<string, unknown>) => {
    setActiveRecord({ type, id, prefill });
  };

  const closeRecord = () => {
    setActiveRecord(null);
  };

  const openShareModal = (payload: ShareTargetPayload) => {
    setShareTarget(payload);
  };

  const closeShareModal = () => {
    setShareTarget(null);
  };

  const setTheme = (theme: ThemeMode) => patchPrefs({ theme });
  const toggleTheme = () =>
    patchPrefs({ theme: db.preferences.theme === 'light' ? 'dark' : 'light' });
  const setActiveNav = (activeNav: NavSection) => patchPrefs({ activeNav });
  const setSidebarCollapsed = (sidebarCollapsed: boolean) => patchPrefs({ sidebarCollapsed });
  const setShowHijri = (showHijri: boolean) => patchPrefs({ showHijri });
  const setCurrentSpecialistId = (currentSpecialistId: string) =>
    patchPrefs({ currentSpecialistId });
  const setDocumentWarningDays = (documentWarningDays: number) =>
    patchPrefs({ documentWarningDays });

  const toggleSectionCollapsed = (key: string) => {
    const curr = db.preferences.collapsedSections[key] ?? false;
    patchPrefs({
      collapsedSections: {
        ...db.preferences.collapsedSections,
        [key]: !curr,
      },
    });
  };

  const setSectionsCollapsed = (keys: string[], collapsed: boolean) => {
    const next = { ...db.preferences.collapsedSections };
    for (const k of keys) next[k] = collapsed;
    patchPrefs({ collapsedSections: next });
  };

  const toggleNavGroupCollapsed = (key: string) => {
    const curr = db.preferences.navGroupCollapsed[key] ?? false;
    patchPrefs({
      navGroupCollapsed: {
        ...db.preferences.navGroupCollapsed,
        [key]: !curr,
      },
    });
  };

  const updateTaskFilters = (partial: Partial<TaskFilters>) => {
    patchPrefs({
      taskFilters: { ...db.preferences.taskFilters, ...partial },
    });
  };

  const updateDocumentFilters = (partial: Partial<DocumentFilters>) => {
    patchPrefs({
      documentFilters: { ...db.preferences.documentFilters, ...partial },
    });
  };

  const updateVatArchiveFilters = (partial: Partial<Vat3AArchiveFilters>) => {
    patchPrefs({
      vatArchiveFilters: { ...db.preferences.vatArchiveFilters, ...partial },
    });
  };

  const nowIso = () => new Date().toISOString().slice(0, 19);

  const saveTask = (
    input: Omit<TaskItem, 'id' | 'createdAt' | 'updatedAt' | 'orgId'> & { id?: string }
  ): TaskItem => {
    const existing = input.id ? db.tasks.find((t) => t.id === input.id) : undefined;
    const item: TaskItem = {
      ...input,
      id: existing?.id ?? generateId('task'),
      orgId: existing?.orgId ?? 'org-01',
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };
    setDb(dataRepository.upsertTask(item));
    return item;
  };

  const deleteTask = (id: string) => {
    setDb(dataRepository.deleteTask(id));
    showToast('تم حذف المهمة وتحديث الروابط.');
  };

  const saveDocument = (
    input: Omit<DocumentItem, 'id' | 'createdAt' | 'updatedAt' | 'orgId' | 'renewals'> & {
      id?: string;
      renewals?: DocumentRenewal[];
    }
  ): DocumentItem => {
    const existing = input.id ? db.documents.find((d) => d.id === input.id) : undefined;
    const item: DocumentItem = {
      ...input,
      id: existing?.id ?? generateId('doc'),
      orgId: existing?.orgId ?? 'org-01',
      renewals: input.renewals ?? existing?.renewals ?? [],
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };
    setDb(dataRepository.upsertDocument(item));
    return item;
  };

  const recordDocumentRenewal = (
    documentId: string,
    renewal: Omit<DocumentRenewal, 'id' | 'documentId'>
  ) => {
    setDb(dataRepository.recordDocumentRenewal(documentId, renewal));
    showToast('تم تسجيل التجديد وحفظ التاريخين السابق والجديد.');
  };

  const deleteDocument = (id: string) => {
    setDb(dataRepository.deleteDocument(id));
    showToast('تم حذف الوثيقة.');
  };

  const saveCase = (
    input: Omit<CaseItem, 'id' | 'createdAt' | 'updatedAt' | 'orgId'> & { id?: string }
  ): CaseItem => {
    const existing = input.id ? db.cases.find((c) => c.id === input.id) : undefined;
    const item: CaseItem = {
      ...input,
      id: existing?.id ?? generateId('case'),
      orgId: existing?.orgId ?? 'org-01',
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };
    setDb(dataRepository.upsertCase(item));
    return item;
  };

  const deleteCase = (id: string) => {
    setDb(dataRepository.deleteCase(id));
    showToast('تم حذف القضية والجلسات المرتبطة بها.');
  };

  const saveSession = (
    input: Omit<SessionItem, 'id' | 'createdAt' | 'updatedAt' | 'orgId'> & { id?: string }
  ): SessionItem => {
    const existing = input.id ? db.sessions.find((s) => s.id === input.id) : undefined;
    const item: SessionItem = {
      ...input,
      id: existing?.id ?? generateId('sess'),
      orgId: existing?.orgId ?? 'org-01',
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };
    setDb(dataRepository.upsertSession(item));
    return item;
  };

  const deleteSession = (id: string) => {
    setDb(dataRepository.deleteSession(id));
    showToast('تم حذف الجلسة.');
  };

  const savePoa = (
    input: Omit<PoaItem, 'id' | 'createdAt' | 'updatedAt' | 'orgId'> & { id?: string }
  ): PoaItem => {
    const existing = input.id ? db.poas.find((p) => p.id === input.id) : undefined;
    const item: PoaItem = {
      ...input,
      id: existing?.id ?? generateId('poa'),
      orgId: existing?.orgId ?? 'org-01',
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };
    setDb(dataRepository.upsertPoa(item));
    return item;
  };

  const deletePoa = (id: string) => {
    setDb(dataRepository.deletePoa(id));
    showToast('تم حذف الوكالة/التفويض.');
  };

  const saveCalendarItem = (
    input: Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt' | 'orgId'> & { id?: string }
  ): CalendarItem => {
    const existing = input.id
      ? db.calendarItems.find((ci) => ci.id === input.id)
      : undefined;
    const item: CalendarItem = {
      ...input,
      id: existing?.id ?? generateId('cal'),
      orgId: existing?.orgId ?? 'org-01',
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };
    setDb(dataRepository.upsertCalendarItem(item));
    return item;
  };

  const deleteCalendarItem = (id: string) => {
    setDb(dataRepository.deleteCalendarItem(id));
    showToast('تم حذف العنصر من التقويم.');
  };

  const saveLabel = (
    input: Omit<LabelItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => {
    const existing = input.id ? db.labels.find((l) => l.id === input.id) : undefined;
    const item: LabelItem = {
      ...input,
      id: existing?.id ?? generateId('lbl'),
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };
    setDb(dataRepository.upsertLabel(item));
  };

  const deleteLabel = (id: string) => {
    setDb(dataRepository.deleteLabel(id));
    showToast('تم حذف الملصق.');
  };

  const saveSpecialist = (
    input: Omit<Specialist, 'id' | 'orgId'> & { id?: string }
  ) => {
    const existing = input.id
      ? db.specialists.find((s) => s.id === input.id)
      : undefined;
    const item: Specialist = {
      ...input,
      id: existing?.id ?? generateId('spec'),
      orgId: existing?.orgId ?? 'org-01',
    };
    setDb(dataRepository.upsertSpecialist(item));
    showToast(existing ? 'تم تحديث بيانات المختص.' : 'تمت إضافة المختص بنجاح.');
  };

  const deleteSpecialist = (id: string) => {
    setDb(dataRepository.deleteSpecialist(id));
    showToast('تم حذف المختص وتحويل السجلات المرتبطة إلى غير مسندة.');
  };

  const logShareOpened = (
    payload: ShareTargetPayload,
    specialist: Specialist,
    channel: ShareChannel,
    messageText: string
  ) => {
    const entry: Omit<ShareLog, 'id'> = {
      recordType: payload.recordType,
      recordId: payload.recordId,
      recordTitle: payload.recordTitle,
      specialistId: specialist.id,
      specialistName: specialist.name,
      channel,
      scheduledInfo: payload.scheduledInfo,
      messageText,
      status: 'فُتحت المشاركة',
      openedAt: nowIso(),
    };
    setDb(dataRepository.addShareLog(entry));
    showToast(`فُتحت المشاركة عبر ${channel === 'whatsapp' ? 'واتساب' : 'البريد الإلكتروني'}`);
  };

  const saveVat3ADraft = (draft: Vat3ADraft) => {
    setDb(dataRepository.upsertVat3ADraft(draft));
  };

  const deleteVat3ADraft = (id: string) => {
    setDb(dataRepository.deleteVat3ADraft(id));
    showToast('تم حذف المسودة الضريبية.');
  };

  const resetDemoData = () => {
    setDb(dataRepository.resetToDemo());
    setActiveRecord(null);
    showToast('تمت استعادة البيانات التجريبية الافتراضية.');
  };

  const getDeleteImpact = (
    type: RecordType | 'specialist' | 'vat3a',
    id: string
  ): { title: string; impactLines: string[] } => {
    if (type === 'task') {
      const t = db.tasks.find((x) => x.id === id);
      const lblCount = db.labels.filter((l) => l.targetType === 'task' && l.targetId === id).length;
      const calCount = db.calendarItems.filter(
        (c) => c.linkedRecordType === 'task' && c.linkedRecordId === id
      ).length;
      const impactLines: string[] = [];
      if (lblCount > 0) impactLines.push(`سيتم حذف ${lblCount} ملصق مرتبط بالمهمة.`);
      if (calCount > 0) impactLines.push(`سيُفك ارتباط ${calCount} عنصر في التقويم.`);
      return { title: t?.title || 'المهمة', impactLines };
    }

    if (type === 'document') {
      const d = db.documents.find((x) => x.id === id);
      const linkedTasks = db.tasks.filter((t) => t.documentId === id).length;
      const lblCount = db.labels.filter((l) => l.targetType === 'document' && l.targetId === id).length;
      const renCount = d?.renewals.length ?? 0;
      const impactLines: string[] = [];
      if (renCount > 0)
        impactLines.push(
          `تحتوي الوثيقة على ${renCount} سجل تجديد تاريخي؛ يُفضّل الأرشفة للاحتفاظ بالتاريخ بدل الحذف النهائي.`
        );
      if (linkedTasks > 0) impactLines.push(`سيُفك ارتباط ${linkedTasks} مهمة تجديد بهذه الوثيقة.`);
      if (lblCount > 0) impactLines.push(`سيتم حذف ${lblCount} ملصق مرتبط بالوثيقة.`);
      return { title: d?.name || 'الوثيقة', impactLines };
    }

    if (type === 'case') {
      const c = db.cases.find((x) => x.id === id);
      const sessCount = db.sessions.filter((s) => s.caseId === id).length;
      const taskCount = db.tasks.filter((t) => t.caseId === id).length;
      const lblCount = db.labels.filter((l) => l.targetType === 'case' && l.targetId === id).length;
      const impactLines: string[] = [];
      if (sessCount > 0) impactLines.push(`سيتم حذف ${sessCount} جلسة مرتبطة بهذه القضية نهائيًا.`);
      if (taskCount > 0) impactLines.push(`سيُفك ارتباط ${taskCount} مهمة عن هذه القضية.`);
      if (lblCount > 0) impactLines.push(`سيتم حذف ${lblCount} ملصق مرتبط بالقضية.`);
      return { title: c?.title || 'القضية', impactLines };
    }

    if (type === 'session') {
      const s = db.sessions.find((x) => x.id === id);
      const taskCount = db.tasks.filter((t) => t.sessionId === id).length;
      const impactLines: string[] = [];
      if (taskCount > 0) impactLines.push(`سيُفك ارتباط ${taskCount} مهمة بهذه الجلسة.`);
      return { title: s?.title || 'الجلسة', impactLines };
    }

    if (type === 'poa') {
      const p = db.poas.find((x) => x.id === id);
      return { title: p?.title || 'الوكالة', impactLines: [] };
    }

    if (type === 'calendar_item') {
      const ci = db.calendarItems.find((x) => x.id === id);
      return { title: ci?.title || 'العنصر', impactLines: [] };
    }

    if (type === 'specialist') {
      const sp = db.specialists.find((x) => x.id === id);
      const tCount = db.tasks.filter((t) => t.specialistId === id).length;
      const dCount = db.documents.filter((d) => d.specialistId === id).length;
      const cCount = db.cases.filter((c) => c.lawyerSpecialistId === id).length;
      const impactLines: string[] = [];
      if (tCount + dCount + cCount > 0) {
        impactLines.push(
          `سيتحول إسناد (${tCount} مهمة، ${dCount} وثيقة، ${cCount} قضية) إلى «غير مسند».`
        );
      }
      return { title: sp?.name || 'المختص', impactLines };
    }

    const vd = db.vat3aDrafts.find((x) => x.id === id);
    return {
      title: vd ? `${vd.entityName} (${vd.periodStart} ← ${vd.periodEnd})` : 'المسودة الضريبية',
      impactLines: ['سيتم حذف المسودة وبنودها الـ 16 نهائيًا.'],
    };
  };

  return (
    <AppContext.Provider
      value={{
        db,
        activeRecord,
        shareTarget,
        toast,
        showToast,
        openRecord,
        closeRecord,
        openShareModal,
        closeShareModal,
        setTheme,
        toggleTheme,
        setActiveNav,
        setSidebarCollapsed,
        setShowHijri,
        setCurrentSpecialistId,
        setDocumentWarningDays,
        toggleSectionCollapsed,
        setSectionsCollapsed,
        toggleNavGroupCollapsed,
        updateTaskFilters,
        updateDocumentFilters,
        updateVatArchiveFilters,
        saveTask,
        deleteTask,
        saveDocument,
        recordDocumentRenewal,
        deleteDocument,
        saveCase,
        deleteCase,
        saveSession,
        deleteSession,
        savePoa,
        deletePoa,
        saveCalendarItem,
        deleteCalendarItem,
        saveLabel,
        deleteLabel,
        saveSpecialist,
        deleteSpecialist,
        logShareOpened,
        saveVat3ADraft,
        deleteVat3ADraft,
        resetDemoData,
        getDeleteImpact,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

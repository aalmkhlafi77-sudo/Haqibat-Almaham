import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  dataRepository,
  generateId,
  getDemoSessionProfileId,
  getLastBackupMeta,
  type LastBackupMeta,
  saveLastBackupMeta,
  setDemoSessionProfileId,
} from '../data/repository';
import {
  buildAuthUserFromDemo,
  canAccessNav,
  canAccessRecordType,
  DEMO_ACCOUNTS,
  hasPermission,
} from '../domain/authPermissions';
import { createBackupEnvelope, downloadBackupJson } from '../domain/backupUtils';
import type { ReportExportSnapshot } from '../domain/reportExport';
import {
  AppDatabaseState,
  AppPreferences,
  AuthMode,
  AuthUser,
  BackupEnvelope,
  CalendarItem,
  CaseItem,
  DocumentCategoryItem,
  DocumentFilters,
  DocumentItem,
  DocumentRenewal,
  IntegrationSettings,
  LabelItem,
  NavSection,
  PendingDeepLink,
  PoaItem,
  RecordType,
  SessionItem,
  ShareChannel,
  ShareLog,
  Specialist,
  TaskFilters,
  TaskItem,
  TaskTypeItem,
  ThemeMode,
  UrgentAlertDays,
  UrgentAlertMotionMode,
  UserPermission,
  Vat3AArchiveFilters,
  Vat3ADraft,
  Vat3ARulesConfig,
} from '../types/domain';

export interface ActiveRecordTarget {
  type: RecordType;
  id: string | null;
  prefill?: Record<string, unknown>;
  openDelete?: boolean;
}

export interface ShareTargetPayload {
  recordType: RecordType | 'document_renewal' | 'vat_3a' | 'report';
  recordId: string;
  recordTitle: string;
  specialistId: string | null;
  scheduledInfo: string;
  defaultMessage: string;
  vatDraft?: Vat3ADraft;
  reportSnapshot?: ReportExportSnapshot;
}

export interface ServerAuthStatus {
  checked: boolean;
  reachable: boolean;
  envAdminConfigured: boolean;
  hasAdminAccount: boolean;
}

interface AppContextValue {
  db: AppDatabaseState;
  activeRecord: ActiveRecordTarget | null;
  shareTarget: ShareTargetPayload | null;
  toast: string | null;
  showToast: (msg: string) => void;
  openRecord: (type: RecordType, id: string | null, prefill?: Record<string, unknown>) => void;
  requestDeleteRecord: (type: RecordType, id: string) => void;
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
  setUrgentAlertDays: (days: UrgentAlertDays) => void;
  setUrgentAlertMotion: (mode: UrgentAlertMotionMode) => void;
  setVat3ARules: (rules: Vat3ARulesConfig) => void;
  updateIntegrations: (partial: Partial<IntegrationSettings>) => void;
  testServerConnection: (baseUrl: string) => Promise<void>;
  testAiConnection: (baseUrl: string, provider: IntegrationSettings['aiProvider'], modelName: string) => Promise<void>;
  toggleSectionCollapsed: (key: string) => void;
  setSectionsCollapsed: (keys: string[], collapsed: boolean) => void;
  toggleNavGroupCollapsed: (key: string) => void;
  updateTaskFilters: (partial: Partial<TaskFilters>) => void;
  updateDocumentFilters: (partial: Partial<DocumentFilters>) => void;
  updateVatArchiveFilters: (partial: Partial<Vat3AArchiveFilters>) => void;
  saveDocumentCategory: (input: { id?: string; name: string }) => DocumentCategoryItem | null;
  deleteDocumentCategory: (categoryId: string, replacementCategoryId: string | null) => void;
  getDocumentCategoryDeleteImpact: (categoryId: string) => {
    category: DocumentCategoryItem | undefined;
    linkedDocsCount: number;
  };
  saveTaskType: (input: {
    id?: string;
    name: string;
    isAdminKind?: boolean;
    isRenewalKind?: boolean;
  }) => TaskTypeItem | null;
  deleteTaskType: (typeId: string, replacementTypeId: string) => boolean;
  getTaskTypeDeleteImpact: (typeId: string) => {
    taskType: TaskTypeItem | undefined;
    linkedTasksCount: number;
    linkedRenewalTasksCount: number;
  };
  saveTask: (task: Omit<TaskItem, 'id' | 'createdAt' | 'updatedAt' | 'orgId'> & { id?: string }) => TaskItem;
  deleteTask: (id: string) => void;
  saveDocument: (doc: Omit<DocumentItem, 'id' | 'createdAt' | 'updatedAt' | 'orgId' | 'renewals'> & { id?: string; renewals?: DocumentRenewal[] }) => DocumentItem;
  recordDocumentRenewal: (documentId: string, renewal: Omit<DocumentRenewal, 'id' | 'documentId'>) => void;
  deleteDocument: (id: string) => boolean;
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
    specialist: Specialist | null,
    channel: ShareChannel,
    messageText: string,
    status?: ShareLog['status']
  ) => void;
  saveVat3ADraft: (draft: Vat3ADraft) => void;
  deleteVat3ADraft: (id: string) => void;
  resetDemoData: () => void;
  getDeleteImpact: (
    type: RecordType | 'specialist' | 'vat3a',
    id: string
  ) => { title: string; impactLines: string[]; blockedReason?: string };
  currentUser: AuthUser | null;
  authMode: AuthMode;
  authLoading: boolean;
  serverAuthStatus: ServerAuthStatus;
  pendingDeepLink: PendingDeepLink | null;
  lastBackupMeta: LastBackupMeta | null;
  hasPerm: (perm: UserPermission) => boolean;
  refreshServerAuthStatus: () => Promise<void>;
  loginDemoAccount: (profileId: string) => { ok: boolean; error?: string };
  bootstrapServerAdmin: (input: {
    username: string;
    displayName: string;
    email?: string;
    password: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  loginServerAccount: (
    username: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  exportBackup: () => Promise<{ ok: boolean; error?: string; filename?: string }>;
  restoreBackup: (
    envelope: BackupEnvelope
  ) => Promise<{ ok: boolean; error?: string }>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [db, setDb] = useState<AppDatabaseState>(() => dataRepository.load());
  const [activeRecord, setActiveRecord] = useState<ActiveRecordTarget | null>(null);
  const [shareTarget, setShareTarget] = useState<ShareTargetPayload | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [pendingDeepLink, setPendingDeepLink] = useState<PendingDeepLink | null>(null);
  const [lastBackupMeta, setLastBackupMeta] = useState<LastBackupMeta | null>(() =>
    getLastBackupMeta()
  );
  const [serverAuthStatus, setServerAuthStatus] = useState<ServerAuthStatus>({
    checked: false,
    reachable: false,
    envAdminConfigured: false,
    hasAdminAccount: false,
  });

  useEffect(() => {
    const isDark = db.preferences.theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
  }, [db.preferences.theme]);

  const applyPendingDeepLinkAfterLogin = (user: AuthUser, link: PendingDeepLink | null) => {
    if (!link) {
      if (!canAccessNav(user, db.preferences.activeNav)) {
        patchPrefs({ activeNav: 'today' });
      }
      return;
    }
    if (link.recordType && link.recordId) {
      if (canAccessRecordType(user, link.recordType)) {
        setActiveRecord({ type: link.recordType, id: link.recordId });
        showToast('تم تسجيل الدخول وتوجيهك إلى السجل المطلوب.');
      } else {
        showToast(
          `تم تسجيل الدخول، لكن دور «${user.roleLabel}» لا يملك صلاحية فتح السجل المطلوب.`
        );
      }
    } else if (link.nav) {
      if (canAccessNav(user, link.nav)) {
        patchPrefs({ activeNav: link.nav });
        showToast('تم تسجيل الدخول والانتقال إلى القسم المطلوب.');
      } else {
        patchPrefs({ activeNav: 'today' });
        showToast(
          `صلاحيات «${user.roleLabel}» لا تسمح بفتح القسم المطلوب؛ تم توجيهك إلى الرئيسية.`
        );
      }
    }
    setPendingDeepLink(null);
  };

  const refreshServerAuthStatus = async () => {
    try {
      const res = await fetch('/api/auth/status', {
        method: 'GET',
        credentials: 'include',
      });
      if (!res.ok) {
        setServerAuthStatus({
          checked: true,
          reachable: false,
          envAdminConfigured: false,
          hasAdminAccount: false,
        });
        return;
      }
      const data = (await res.json()) as {
        envAdminConfigured?: boolean;
        hasAdminAccount?: boolean;
        authenticated?: boolean;
        user?: AuthUser | null;
      };
      setServerAuthStatus({
        checked: true,
        reachable: true,
        envAdminConfigured: Boolean(data.envAdminConfigured),
        hasAdminAccount: Boolean(data.hasAdminAccount),
      });
      if (data.authenticated && data.user) {
        setCurrentUser(data.user);
      }
    } catch {
      setServerAuthStatus({
        checked: true,
        reachable: false,
        envAdminConfigured: false,
        hasAdminAccount: false,
      });
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      setAuthLoading(false);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const rType = params.get('recordType') as RecordType | null;
    const rId = params.get('recordId');
    const navParam = params.get('nav') as NavSection | null;
    const initialDeepLink: PendingDeepLink | null =
      rType && rId
        ? { recordType: rType, recordId: rId }
        : navParam
        ? { nav: navParam }
        : null;
    if (initialDeepLink) {
      setPendingDeepLink(initialDeepLink);
    }

    (async () => {
      try {
        const res = await fetch('/api/auth/status', {
          method: 'GET',
          credentials: 'include',
        });
        if (res.ok) {
          const data = (await res.json()) as {
            envAdminConfigured?: boolean;
            hasAdminAccount?: boolean;
            authenticated?: boolean;
            user?: AuthUser | null;
          };
          setServerAuthStatus({
            checked: true,
            reachable: true,
            envAdminConfigured: Boolean(data.envAdminConfigured),
            hasAdminAccount: Boolean(data.hasAdminAccount),
          });
          if (data.authenticated && data.user) {
            setCurrentUser(data.user);
            applyPendingDeepLinkAfterLogin(data.user, initialDeepLink);
            setAuthLoading(false);
            return;
          }
        }
      } catch {
        setServerAuthStatus({
          checked: true,
          reachable: false,
          envAdminConfigured: false,
          hasAdminAccount: false,
        });
      }

      // Fallback to persisted local demo session profile (non-secret ID only)
      const savedDemoId = getDemoSessionProfileId();
      if (savedDemoId) {
        const matched = DEMO_ACCOUNTS.find((a) => a.id === savedDemoId);
        if (matched) {
          const demoUser = buildAuthUserFromDemo(matched);
          setCurrentUser(demoUser);
          applyPendingDeepLinkAfterLogin(demoUser, initialDeepLink);
        }
      }
      setAuthLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 3400);
  };

  const patchPrefs = (partial: Partial<AppPreferences>) => {
    setDb(dataRepository.updatePreferences(partial));
  };

  const openRecord = (type: RecordType, id: string | null, prefill?: Record<string, unknown>) => {
    if (!currentUser || !hasPermission(currentUser, 'records:read')) {
      showToast('الحساب الحالي لا يملك صلاحية قراءة السجلات.');
      return;
    }
    if (id === null && !hasPermission(currentUser, 'records:write')) {
      showToast('الحساب الحالي لا يملك صلاحية إنشاء سجلات جديدة.');
      return;
    }
    setActiveRecord({ type, id, prefill });
  };

  const requestDeleteRecord = (type: RecordType, id: string) => {
    if (!currentUser || !hasPermission(currentUser, 'records:delete')) {
      showToast('الحساب الحالي لا يملك صلاحية حذف السجلات.');
      return;
    }
    setActiveRecord({ type, id, openDelete: true });
  };

  const closeRecord = () => setActiveRecord(null);
  const openShareModal = (payload: ShareTargetPayload) => {
    if (payload.recordType === 'report' && !hasPermission(currentUser, 'reports:export')) {
      showToast('صلاحيات حسابك لا تسمح بمشاركة أو تصدير التقارير.');
      return;
    }
    setShareTarget(payload);
  };
  const closeShareModal = () => setShareTarget(null);

  const setTheme = (theme: ThemeMode) => patchPrefs({ theme });
  const toggleTheme = () =>
    patchPrefs({ theme: db.preferences.theme === 'light' ? 'dark' : 'light' });
  const setActiveNav = (activeNav: NavSection) => {
    if (currentUser && !canAccessNav(currentUser, activeNav)) {
      showToast(`الحساب الحالي (${currentUser.roleLabel}) لا يملك صلاحية الوصول إلى هذا القسم.`);
      return;
    }
    patchPrefs({ activeNav });
  };
  const setSidebarCollapsed = (sidebarCollapsed: boolean) => patchPrefs({ sidebarCollapsed });
  const setShowHijri = (showHijri: boolean) => patchPrefs({ showHijri });
  const setCurrentSpecialistId = (currentSpecialistId: string) =>
    patchPrefs({ currentSpecialistId });
  const setDocumentWarningDays = (documentWarningDays: number) =>
    patchPrefs({ documentWarningDays });
  const setUrgentAlertDays = (urgentAlertDays: UrgentAlertDays) =>
    patchPrefs({ urgentAlertDays });
  const setUrgentAlertMotion = (urgentAlertMotion: UrgentAlertMotionMode) =>
    patchPrefs({ urgentAlertMotion });
  const setVat3ARules = (vat3aRules: Vat3ARulesConfig) => {
    if (!hasPermission(currentUser, 'vat3a:edit')) {
      showToast('الحساب الحالي لا يملك صلاحية تعديل قواعد 3A.');
      return;
    }
    patchPrefs({ vat3aRules });
  };

  const updateIntegrations = (partial: Partial<IntegrationSettings>) => {
    if (!hasPermission(currentUser, 'settings:manage')) {
      showToast('الحساب الحالي لا يملك صلاحية تعديل إعدادات التكامل.');
      return;
    }
    patchPrefs({
      integrations: {
        ...db.preferences.integrations,
        ...partial,
      },
    });
  };

  const testServerConnection = async (baseUrl: string) => {
    const clean = baseUrl.trim().replace(/\/+$/, '');
    const checkedAt = new Date().toISOString().slice(0, 19);
    if (!clean) {
      updateIntegrations({
        serverBaseUrl: '',
        serverStatus: 'disconnected',
        serverLastCheckedAt: checkedAt,
        serverStatusMessage: 'غير متصل — لم يُحدد عنوان الخادم بعد.',
      });
      return;
    }
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${clean}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      window.clearTimeout(timer);
      if (res.ok) {
        updateIntegrations({
          serverBaseUrl: clean,
          serverStatus: 'connected',
          serverLastCheckedAt: checkedAt,
          serverStatusMessage: `متصل (${res.status})`,
        });
        showToast('تم الاتصال بالخادم بنجاح.');
      } else {
        updateIntegrations({
          serverBaseUrl: clean,
          serverStatus: 'error',
          serverLastCheckedAt: checkedAt,
          serverStatusMessage: `تعذّر الاتصال (HTTP ${res.status}) — يعمل النظام محليًا.`,
        });
      }
    } catch {
      updateIntegrations({
        serverBaseUrl: clean,
        serverStatus: 'disconnected',
        serverLastCheckedAt: checkedAt,
        serverStatusMessage: 'غير متصل — تعذّر الوصول إلى مسار الخادم، وتبقى الوظائف المحلية متاحة.',
      });
    }
  };

  const testAiConnection = async (
    baseUrl: string,
    provider: IntegrationSettings['aiProvider'],
    modelName: string
  ) => {
    const clean = baseUrl.trim().replace(/\/+$/, '');
    const checkedAt = new Date().toISOString().slice(0, 19);
    if (!clean) {
      updateIntegrations({
        aiProvider: provider,
        aiModelName: modelName,
        aiStatus: 'disconnected',
        aiLastCheckedAt: checkedAt,
        aiStatusMessage: 'غير متصل — يتطلب ربط عنوان الخادم أولًا لإدارة المفاتيح على الخادم.',
      });
      return;
    }
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${clean}/ai/status?provider=${encodeURIComponent(provider)}&model=${encodeURIComponent(modelName)}`, {
        method: 'GET',
        signal: controller.signal,
      });
      window.clearTimeout(timer);
      if (res.ok) {
        updateIntegrations({
          aiProvider: provider,
          aiModelName: modelName,
          aiStatus: 'connected',
          aiLastCheckedAt: checkedAt,
          aiStatusMessage: `متصل عبر الخادم (${modelName})`,
        });
        showToast('تكامل الذكاء الاصطناعي متصل.');
      } else {
        updateIntegrations({
          aiProvider: provider,
          aiModelName: modelName,
          aiStatus: 'error',
          aiLastCheckedAt: checkedAt,
          aiStatusMessage: `غير متصل (HTTP ${res.status})`,
        });
      }
    } catch {
      updateIntegrations({
        aiProvider: provider,
        aiModelName: modelName,
        aiStatus: 'disconnected',
        aiLastCheckedAt: checkedAt,
        aiStatusMessage: 'غير متصل — تعذّر الوصول إلى مسار الذكاء الاصطناعي على الخادم.',
      });
    }
  };

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
    patchPrefs({ taskFilters: { ...db.preferences.taskFilters, ...partial } });
  };

  const updateDocumentFilters = (partial: Partial<DocumentFilters>) => {
    patchPrefs({ documentFilters: { ...db.preferences.documentFilters, ...partial } });
  };

  const updateVatArchiveFilters = (partial: Partial<Vat3AArchiveFilters>) => {
    patchPrefs({ vatArchiveFilters: { ...db.preferences.vatArchiveFilters, ...partial } });
  };

  const nowIso = () => new Date().toISOString().slice(0, 19);

  const saveDocumentCategory = (input: {
    id?: string;
    name: string;
  }): DocumentCategoryItem | null => {
    if (!hasPermission(currentUser, 'settings:manage')) {
      showToast('الحساب الحالي لا يملك صلاحية إدارة تصنيفات الوثائق.');
      return null;
    }
    const clean = input.name.trim();
    if (!clean) return null;
    const duplicate = db.documentCategories.find(
      (c) => c.name.trim() === clean && c.id !== input.id
    );
    if (duplicate) {
      showToast('يوجد تصنيف آخر بالاسم نفسه.');
      return null;
    }
    const existing = input.id
      ? db.documentCategories.find((c) => c.id === input.id)
      : undefined;
    const item: DocumentCategoryItem = {
      id: existing?.id ?? generateId('cat'),
      orgId: existing?.orgId ?? 'org-01',
      name: clean,
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };
    setDb(dataRepository.upsertDocumentCategory(item));
    showToast(existing ? 'تم تحديث اسم التصنيف في جميع الوثائق.' : 'تمت إضافة التصنيف بنجاح.');
    return item;
  };

  const deleteDocumentCategory = (
    categoryId: string,
    replacementCategoryId: string | null
  ) => {
    if (
      !hasPermission(currentUser, 'settings:manage') ||
      !hasPermission(currentUser, 'records:delete')
    ) {
      showToast('الحساب الحالي لا يملك صلاحية حذف تصنيفات الوثائق.');
      return;
    }
    setDb(dataRepository.deleteDocumentCategory(categoryId, replacementCategoryId));
    showToast(
      replacementCategoryId
        ? 'تم حذف التصنيف ونقل الوثائق المرتبطة إلى التصنيف البديل.'
        : 'تم حذف التصنيف وتحويل الوثائق المرتبطة إلى «غير مصنفة».'
    );
  };

  const getDocumentCategoryDeleteImpact = (categoryId: string) => ({
    category: db.documentCategories.find((c) => c.id === categoryId),
    linkedDocsCount: db.documents.filter((d) => d.categoryId === categoryId).length,
  });

  const saveTaskType = (input: {
    id?: string;
    name: string;
    isAdminKind?: boolean;
    isRenewalKind?: boolean;
  }): TaskTypeItem | null => {
    if (!hasPermission(currentUser, 'settings:manage')) {
      showToast('الحساب الحالي لا يملك صلاحية إدارة أنواع المهام.');
      return null;
    }
    const clean = input.name.trim();
    if (!clean) return null;
    const duplicate = db.taskTypes.find(
      (t) => t.name.trim() === clean && t.id !== input.id
    );
    if (duplicate) {
      showToast('يوجد نوع مهام آخر بالاسم نفسه.');
      return null;
    }
    const existing = input.id
      ? db.taskTypes.find((t) => t.id === input.id)
      : undefined;
    const item: TaskTypeItem = {
      id: existing?.id ?? generateId('ttype'),
      orgId: existing?.orgId ?? 'org-01',
      name: clean,
      isAdminKind: input.isAdminKind ?? existing?.isAdminKind ?? false,
      isRenewalKind: input.isRenewalKind ?? existing?.isRenewalKind ?? false,
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };
    setDb(dataRepository.upsertTaskType(item));
    showToast(existing ? 'تم تحديث اسم نوع المهمة.' : 'تمت إضافة نوع المهمة.');
    return item;
  };

  const deleteTaskType = (typeId: string, replacementTypeId: string): boolean => {
    if (
      !hasPermission(currentUser, 'settings:manage') ||
      !hasPermission(currentUser, 'records:delete')
    ) {
      showToast('الحساب الحالي لا يملك صلاحية حذف أنواع المهام.');
      return false;
    }
    const res = dataRepository.deleteTaskType(typeId, replacementTypeId);
    setDb(res.state);
    if (!res.ok) {
      showToast(res.error || 'تعذر حذف نوع المهمة.');
      return false;
    }
    showToast('تم حذف نوع المهمة ونقل المهام المرتبطة إلى النوع البديل.');
    return true;
  };

  const getTaskTypeDeleteImpact = (typeId: string) => ({
    taskType: db.taskTypes.find((t) => t.id === typeId),
    linkedTasksCount: db.tasks.filter((t) => t.typeId === typeId).length,
    linkedRenewalTasksCount: db.tasks.filter((t) => t.typeId === typeId && !!t.documentId).length,
  });

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
    if (!hasPermission(currentUser, 'records:write')) {
      showToast('الحساب الحالي لا يملك صلاحية تعديل المهام.');
      return existing ?? item;
    }
    setDb(dataRepository.upsertTask(item));
    return item;
  };

  const deleteTask = (id: string) => {
    if (!hasPermission(currentUser, 'records:delete')) {
      showToast('الحساب الحالي لا يملك صلاحية حذف المهام.');
      return;
    }
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
    if (!hasPermission(currentUser, 'records:write')) {
      showToast('الحساب الحالي لا يملك صلاحية تعديل الوثائق.');
      return existing ?? item;
    }
    setDb(dataRepository.upsertDocument(item));
    return item;
  };

  const recordDocumentRenewal = (
    documentId: string,
    renewal: Omit<DocumentRenewal, 'id' | 'documentId'>
  ) => {
    if (!hasPermission(currentUser, 'records:write')) {
      showToast('الحساب الحالي لا يملك صلاحية تسجيل التجديد.');
      return;
    }
    setDb(dataRepository.recordDocumentRenewal(documentId, renewal));
    showToast('تم تسجيل التجديد وحفظ التاريخين السابق والجديد.');
  };

  const deleteDocument = (id: string): boolean => {
    if (!hasPermission(currentUser, 'records:delete')) {
      showToast('الحساب الحالي لا يملك صلاحية حذف الوثائق.');
      return false;
    }
    const res = dataRepository.deleteDocument(id);
    setDb(res.state);
    if (!res.ok) {
      showToast(res.error || 'تعذر حذف الوثيقة.');
      return false;
    }
    showToast('تم حذف الوثيقة.');
    return true;
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
    if (!hasPermission(currentUser, 'records:write')) {
      showToast('الحساب الحالي لا يملك صلاحية تعديل القضايا.');
      return existing ?? item;
    }
    setDb(dataRepository.upsertCase(item));
    return item;
  };

  const deleteCase = (id: string) => {
    if (!hasPermission(currentUser, 'records:delete')) {
      showToast('الحساب الحالي لا يملك صلاحية حذف القضايا.');
      return;
    }
    setDb(dataRepository.deleteCase(id));
    showToast('تم حذف القضية والجلسات المرتبطة وفك الروابط المتأثرة.');
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
    if (!hasPermission(currentUser, 'records:write')) {
      showToast('الحساب الحالي لا يملك صلاحية تعديل الجلسات.');
      return existing ?? item;
    }
    setDb(dataRepository.upsertSession(item));
    return item;
  };

  const deleteSession = (id: string) => {
    if (!hasPermission(currentUser, 'records:delete')) {
      showToast('الحساب الحالي لا يملك صلاحية حذف الجلسات.');
      return;
    }
    setDb(dataRepository.deleteSession(id));
    showToast('تم حذف الجلسة وفك الروابط المتأثرة.');
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
    if (!hasPermission(currentUser, 'records:write')) {
      showToast('الحساب الحالي لا يملك صلاحية تعديل الوكالات.');
      return existing ?? item;
    }
    setDb(dataRepository.upsertPoa(item));
    return item;
  };

  const deletePoa = (id: string) => {
    if (!hasPermission(currentUser, 'records:delete')) {
      showToast('الحساب الحالي لا يملك صلاحية حذف الوكالات.');
      return;
    }
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
    if (!hasPermission(currentUser, 'records:write')) {
      showToast('الحساب الحالي لا يملك صلاحية تعديل عناصر التقويم.');
      return existing ?? item;
    }
    setDb(dataRepository.upsertCalendarItem(item));
    return item;
  };

  const deleteCalendarItem = (id: string) => {
    if (!hasPermission(currentUser, 'records:delete')) {
      showToast('الحساب الحالي لا يملك صلاحية حذف عناصر التقويم.');
      return;
    }
    setDb(dataRepository.deleteCalendarItem(id));
    showToast('تم حذف العنصر من التقويم.');
  };

  const saveLabel = (
    input: Omit<LabelItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => {
    if (!hasPermission(currentUser, 'records:write')) {
      showToast('الحساب الحالي لا يملك صلاحية تعديل الملصقات.');
      return;
    }
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
    if (!hasPermission(currentUser, 'records:delete')) {
      showToast('الحساب الحالي لا يملك صلاحية حذف الملصقات.');
      return;
    }
    setDb(dataRepository.deleteLabel(id));
    showToast('تم حذف الملصق.');
  };

  const saveSpecialist = (
    input: Omit<Specialist, 'id' | 'orgId'> & { id?: string }
  ) => {
    if (!hasPermission(currentUser, 'records:write')) {
      showToast('الحساب الحالي لا يملك صلاحية تعديل بيانات المختصين.');
      return;
    }
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
    if (!hasPermission(currentUser, 'records:delete')) {
      showToast('الحساب الحالي لا يملك صلاحية حذف المختصين.');
      return;
    }
    setDb(dataRepository.deleteSpecialist(id));
    showToast('تم حذف المختص وتحويل السجلات المرتبطة إلى غير مسندة.');
  };

  const logShareOpened = (
    payload: ShareTargetPayload,
    specialist: Specialist | null,
    channel: ShareChannel,
    messageText: string,
    status: ShareLog['status'] = 'فُتحت المشاركة'
  ) => {
    const entry: Omit<ShareLog, 'id'> = {
      recordType: payload.recordType,
      recordId: payload.recordId,
      recordTitle: payload.recordTitle,
      specialistId: specialist?.id || null,
      specialistName: specialist?.name || 'مشاركة مباشرة',
      channel,
      scheduledInfo: payload.scheduledInfo,
      messageText,
      status,
      openedAt: nowIso(),
    };
    setDb(dataRepository.addShareLog(entry));
    showToast(
      status === 'تمت المشاركة عبر الجهاز'
        ? 'تمت المشاركة عبر الجهاز بنجاح.'
        : `فُتحت المشاركة عبر ${channel === 'whatsapp' ? 'واتساب' : 'البريد الإلكتروني'}`
    );
  };

  const saveVat3ADraft = (draft: Vat3ADraft) => {
    if (!hasPermission(currentUser, 'vat3a:edit')) {
      showToast('الحساب الحالي لا يملك صلاحية حفظ أو تعديل مسودات 3A.');
      return;
    }
    setDb(dataRepository.upsertVat3ADraft(draft));
  };

  const deleteVat3ADraft = (id: string) => {
    if (!hasPermission(currentUser, 'records:delete')) {
      showToast('الحساب الحالي لا يملك صلاحية حذف المسودات الضريبية.');
      return;
    }
    setDb(dataRepository.deleteVat3ADraft(id));
    showToast('تم حذف المسودة الضريبية.');
  };

  const resetDemoData = () => {
    if (!hasPermission(currentUser, 'settings:manage')) {
      showToast('استعادة البيانات التجريبية محصورة بصلاحية المدير.');
      return;
    }
    setDb(dataRepository.resetToDemo());
    setActiveRecord(null);
    showToast('تمت استعادة البيانات التجريبية الافتراضية.');
  };

  const getDeleteImpact = (
    type: RecordType | 'specialist' | 'vat3a',
    id: string
  ): { title: string; impactLines: string[]; blockedReason?: string } => {
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
      const calCount = db.calendarItems.filter(
        (c) => c.linkedRecordType === 'document' && c.linkedRecordId === id
      ).length;
      const renCount = d?.renewals.length ?? 0;
      const impactLines: string[] = [];
      if (renCount > 0) {
        return {
          title: d?.name || 'الوثيقة',
          blockedReason: `هذه الوثيقة تحتوي على ${renCount} سجل تجديد تاريخي. وفق قواعد حماية السجل (المتطابقة مع MySQL ON DELETE RESTRICT)، يُمنع الحذف النهائي ويجب استخدام «أرشفة الوثيقة» للاحتفاظ بالتاريخ.`,
          impactLines: [
            `عدد سجلات التجديد المحفوظة: ${renCount}`,
            linkedTasks > 0 ? `المهام المرتبطة: ${linkedTasks}` : '',
          ].filter(Boolean),
        };
      }
      if (linkedTasks > 0) impactLines.push(`سيُفك ارتباط ${linkedTasks} مهمة تجديد بهذه الوثيقة.`);
      if (calCount > 0) impactLines.push(`سيُفك ارتباط ${calCount} عنصر في التقويم.`);
      if (lblCount > 0) impactLines.push(`سيتم حذف ${lblCount} ملصق مرتبط بالوثيقة.`);
      return { title: d?.name || 'الوثيقة', impactLines };
    }

    if (type === 'case') {
      const c = db.cases.find((x) => x.id === id);
      const sessIds = new Set(db.sessions.filter((s) => s.caseId === id).map((s) => s.id));
      const sessCount = sessIds.size;
      const taskCount = db.tasks.filter(
        (t) => t.caseId === id || (t.sessionId && sessIds.has(t.sessionId))
      ).length;
      const calCount = db.calendarItems.filter(
        (ci) =>
          (ci.linkedRecordType === 'case' && ci.linkedRecordId === id) ||
          (ci.linkedRecordType === 'session' &&
            !!ci.linkedRecordId &&
            sessIds.has(ci.linkedRecordId))
      ).length;
      const lblCount = db.labels.filter((l) => l.targetType === 'case' && l.targetId === id).length;
      const impactLines: string[] = [];
      if (sessCount > 0) impactLines.push(`سيتم حذف ${sessCount} جلسة مرتبطة بهذه القضية نهائيًا.`);
      if (taskCount > 0) impactLines.push(`سيُفك ارتباط ${taskCount} مهمة مرتبطة بالقضية أو جلساتها.`);
      if (calCount > 0) impactLines.push(`سيُفك ارتباط ${calCount} عنصر في التقويم مرتبط بالقضية أو جلساتها.`);
      if (lblCount > 0) impactLines.push(`سيتم حذف ${lblCount} ملصق مرتبط بالقضية.`);
      return { title: c?.title || 'القضية', impactLines };
    }

    if (type === 'session') {
      const s = db.sessions.find((x) => x.id === id);
      const taskCount = db.tasks.filter((t) => t.sessionId === id).length;
      const calCount = db.calendarItems.filter(
        (ci) => ci.linkedRecordType === 'session' && ci.linkedRecordId === id
      ).length;
      const impactLines: string[] = [];
      if (taskCount > 0) impactLines.push(`سيُفك ارتباط ${taskCount} مهمة بهذه الجلسة.`);
      if (calCount > 0) impactLines.push(`سيُفك ارتباط ${calCount} عنصر في التقويم بهذه الجلسة.`);
      return { title: s?.title || 'الجلسة', impactLines };
    }

    if (type === 'poa') {
      const p = db.poas.find((x) => x.id === id);
      const calCount = db.calendarItems.filter(
        (ci) => ci.linkedRecordType === 'poa' && ci.linkedRecordId === id
      ).length;
      return {
        title: p?.title || 'الوكالة',
        impactLines: calCount > 0 ? [`سيُفك ارتباط ${calCount} عنصر في التقويم.`] : [],
      };
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
      const calCount = db.calendarItems.filter((ci) => ci.specialistId === id).length;
      const impactLines: string[] = [];
      if (tCount + dCount + cCount + calCount > 0) {
        impactLines.push(
          `سيتحول إسناد (${tCount} مهمة، ${dCount} وثيقة، ${cCount} قضية، ${calCount} موعد) إلى «غير مسند».`
        );
      }
      return { title: sp?.name || 'المختص', impactLines };
    }

    const vd = db.vat3aDrafts.find((x) => x.id === id);
    const isArchived = vd?.status === 'مؤرشفة' || !!vd?.archivedAt;
    const impactLines: string[] = ['سيتم حذف المسودة وبنودها الـ 16 نهائيًا من السجلات.'];
    if (isArchived) {
      impactLines.push('هذه المسودة مؤرشفة؛ سيؤدي الحذف إلى إزالتها نهائيًا من أرشيف الضريبة المحفوظ.');
    }
    return {
      title: vd ? `${vd.entityName} (${vd.periodStart} ← ${vd.periodEnd})` : 'المسودة الضريبية',
      impactLines,
    };
  };

  const authMode: AuthMode = currentUser?.authMode || 'local_demo';
  const hasPerm = (perm: UserPermission) => hasPermission(currentUser, perm);

  const loginDemoAccount = (profileId: string): { ok: boolean; error?: string } => {
    const profile = DEMO_ACCOUNTS.find((a) => a.id === profileId);
    if (!profile) {
      return { ok: false, error: 'الحساب التجريبي المحدد غير موجود.' };
    }
    const user = buildAuthUserFromDemo(profile);
    setDemoSessionProfileId(profile.id);
    setCurrentUser(user);
    if (profile.specialistId) {
      patchPrefs({ currentSpecialistId: profile.specialistId });
    }
    applyPendingDeepLinkAfterLogin(user, pendingDeepLink);
    return { ok: true };
  };

  const bootstrapServerAdmin = async (input: {
    username: string;
    displayName: string;
    email?: string;
    password: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/bootstrap-admin', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as { user?: AuthUser; error?: string };
      if (!res.ok || !data.user) {
        return { ok: false, error: data.error || 'تعذر تفعيل حساب المدير الأول.' };
      }
      setDemoSessionProfileId(null);
      setCurrentUser(data.user);
      setServerAuthStatus((prev) => ({ ...prev, reachable: true, hasAdminAccount: true }));
      applyPendingDeepLinkAfterLogin(data.user, pendingDeepLink);
      return { ok: true };
    } catch {
      return { ok: false, error: 'تعذر الاتصال بالخادم لتفعيل حساب المدير.' };
    }
  };

  const loginServerAccount = async (
    username: string,
    password: string
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as { user?: AuthUser; error?: string };
      if (!res.ok || !data.user) {
        return { ok: false, error: data.error || 'فشل تسجيل الدخول على الخادم.' };
      }
      setDemoSessionProfileId(null);
      setCurrentUser(data.user);
      applyPendingDeepLinkAfterLogin(data.user, pendingDeepLink);
      return { ok: true };
    } catch {
      return { ok: false, error: 'تعذر الاتصال بخادم المصادقة.' };
    }
  };

  const logout = async () => {
    if (currentUser?.authMode === 'server') {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
        });
      } catch {
        // ignore network error on logout
      }
    }
    setDemoSessionProfileId(null);
    setCurrentUser(null);
    setActiveRecord(null);
    setShareTarget(null);
  };

  const exportBackup = async (): Promise<{
    ok: boolean;
    error?: string;
    filename?: string;
  }> => {
    if (!hasPerm('backups:export')) {
      return { ok: false, error: 'صلاحيات الحساب الحالي لا تسمح بتصدير النسخ الاحتياطية.' };
    }
    if (authMode === 'server') {
      try {
        const res = await fetch('/api/backups/export', {
          method: 'GET',
          credentials: 'include',
        });
        const data = (await res.json()) as BackupEnvelope & { error?: string };
        if (!res.ok) {
          return { ok: false, error: data.error || 'فشل تصدير النسخة الاحتياطية من الخادم.' };
        }
        const filename = downloadBackupJson(data);
        const meta: LastBackupMeta = {
          createdAt: data.createdAt,
          schemaVersion: data.schemaVersion,
          sourceMode: 'server',
        };
        saveLastBackupMeta(meta);
        setLastBackupMeta(meta);
        showToast('تم تنزيل النسخة الاحتياطية من الخادم بنجاح.');
        return { ok: true, filename };
      } catch {
        return { ok: false, error: 'تعذر الاتصال بالخادم لتنزيل النسخة الاحتياطية.' };
      }
    }

    const envelope = createBackupEnvelope(db, 'local_demo');
    const filename = downloadBackupJson(envelope);
    const meta: LastBackupMeta = {
      createdAt: envelope.createdAt,
      schemaVersion: envelope.schemaVersion,
      sourceMode: 'local_demo',
    };
    saveLastBackupMeta(meta);
    setLastBackupMeta(meta);
    showToast('تم تنزيل النسخة الاحتياطية من بيانات المتصفح بنجاح.');
    return { ok: true, filename };
  };

  const restoreBackup = async (
    envelope: BackupEnvelope
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!hasPerm('backups:restore')) {
      return { ok: false, error: 'صلاحيات الحساب الحالي لا تسمح باستعادة النسخ الاحتياطية.' };
    }

    if (authMode === 'server') {
      try {
        const res = await fetch('/api/backups/restore', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify(envelope),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          return {
            ok: false,
            error: data.error || 'فشل الخادم في التحقق من النسخة الاحتياطية أو استعادتها.',
          };
        }
        showToast('تمت استعادة النسخة الاحتياطية على الخادم بعد التحقق من سلامتها.');
        return { ok: true };
      } catch {
        return { ok: false, error: 'تعذر الاتصال بالخادم لتنفيذ الاستعادة.' };
      }
    }

    const res = dataRepository.restoreBackupPayload(envelope);
    setDb(res.state);
    if (!res.ok) {
      return { ok: false, error: res.error || 'فشلت استعادة النسخة الاحتياطية.' };
    }
    setActiveRecord(null);
    showToast('تمت استعادة النسخة الاحتياطية بنجاح مع الحفاظ على جميع الروابط والقواعد.');
    return { ok: true };
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
        requestDeleteRecord,
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
        setUrgentAlertDays,
        setUrgentAlertMotion,
        setVat3ARules,
        updateIntegrations,
        testServerConnection,
        testAiConnection,
        toggleSectionCollapsed,
        setSectionsCollapsed,
        toggleNavGroupCollapsed,
        updateTaskFilters,
        updateDocumentFilters,
        updateVatArchiveFilters,
        saveDocumentCategory,
        deleteDocumentCategory,
        getDocumentCategoryDeleteImpact,
        saveTaskType,
        deleteTaskType,
        getTaskTypeDeleteImpact,
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
        currentUser,
        authMode,
        authLoading,
        serverAuthStatus,
        pendingDeepLink,
        lastBackupMeta,
        hasPerm,
        refreshServerAuthStatus,
        loginDemoAccount,
        bootstrapServerAdmin,
        loginServerAccount,
        logout,
        exportBackup,
        restoreBackup,
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

export type ThemeMode = 'light' | 'dark';

export type NavSection =
  | 'today'
  | 'tasks'
  | 'planner'
  | 'documents'
  | 'cases'
  | 'calendar'
  | 'reports'
  | 'specialists'
  | 'vat3a'
  | 'settings';

export type RecordType =
  | 'task'
  | 'document'
  | 'case'
  | 'session'
  | 'poa'
  | 'calendar_item';

export interface Organization {
  id: string;
  name: string;
  taxRegistrationNumber?: string;
}

export interface Specialist {
  id: string;
  orgId: string;
  name: string;
  departmentName: string;
  roleTitle: string;
  mobile: string;
  email: string;
  isActive: boolean;
}

export interface DocumentCategoryItem {
  id: string;
  orgId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskTypeItem {
  id: string;
  orgId: string;
  name: string;
  isAdminKind?: boolean;
  isRenewalKind?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TaskType = string;
export type TaskPriority = 'عاجلة' | 'مرتفعة' | 'متوسطة' | 'منخفضة';
export type TaskStatus = 'جديدة' | 'قيد التنفيذ' | 'معلقة' | 'مكتملة' | 'ملغاة';

export interface TaskItem {
  id: string;
  orgId: string;
  typeId: string;
  type: TaskType;
  title: string;
  specialistId: string | null;
  departmentName: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string; // YYYY-MM-DD (DATE without time)
  plannedDate?: string | null;
  actualDeliveryDate?: string | null; // YYYY-MM-DD
  letterNumber?: string;
  authorityName?: string;
  receivedDate?: string | null; // YYYY-MM-DD
  documentId?: string | null;
  caseId?: string | null;
  sessionId?: string | null;
  notes?: string;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMilestone { id: string; title: string; done: boolean }
export interface ProjectItem {
  id: string; title: string; status: 'مخطط' | 'قيد التنفيذ' | 'معلق' | 'مكتمل';
  specialistId: string | null; dueDate: string | null; nextStep: string; notes: string;
  milestones: ProjectMilestone[]; taskIds: string[]; documentIds: string[];
  createdAt: string; updatedAt: string;
}
export interface IdeaItem {
  id: string; title: string; category: string; notes: string; pinned: boolean;
  taskId: string | null; projectId: string | null; createdAt: string; updatedAt: string;
}

export interface DocumentRenewal {
  id: string;
  documentId: string;
  previousExpiryDate: string | null;
  newExpiryDate: string;
  notes: string;
  actorName: string;
  renewedAt: string;
}

export interface DocumentItem {
  id: string;
  orgId: string;
  name: string;
  categoryId: string | null;
  docType: string;
  referenceNumber: string;
  issuingAuthority: string;
  specialistId: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  notes?: string;
  renewals: DocumentRenewal[];
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CaseStatus = 'مفتوحة' | 'قيد المرافعة' | 'موقوفة' | 'مغلقة';

export interface CaseItem {
  id: string;
  orgId: string;
  caseNumber: string;
  title: string;
  parties: string;
  court: string;
  status: CaseStatus;
  lawyerSpecialistId: string | null;
  notes?: string;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SessionStatus = 'مجدولة' | 'منعقدة' | 'مؤجلة' | 'ملغاة';

export interface SessionItem {
  id: string;
  orgId: string;
  caseId: string;
  title: string;
  scheduledAt: string; // YYYY-MM-DDTHH:mm
  status: SessionStatus;
  outcome?: string;
  specialistId: string | null;
  location?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type PoaStatus = 'سارية' | 'مفسوخة' | 'منتهية';

export interface PoaItem {
  id: string;
  orgId: string;
  title: string;
  referenceNumber: string;
  grantor: string;
  agent: string;
  scope: string;
  specialistId: string | null;
  issueDate: string;
  expiryDate?: string | null;
  statusOverride?: 'مفسوخة' | null;
  notes?: string;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CalendarItemKind = 'حدث' | 'تذكير';

export interface CalendarItem {
  id: string;
  orgId: string;
  kind: CalendarItemKind;
  title: string;
  scheduledAt: string;
  isAllDay: boolean;
  specialistId: string | null;
  linkedRecordType?: RecordType | null;
  linkedRecordId?: string | null;
  notes?: string;
  isDone: boolean;
  createdAt: string;
  updatedAt: string;
}

export type LabelTargetType = 'today' | 'task' | 'case' | 'document';

export interface LabelItem {
  id: string;
  targetType: LabelTargetType;
  targetId: string | null;
  text: string;
  bgColor: string;
  textColor: string;
  posX?: number | null;
  posY?: number | null;
  desktopPosX?: number | null;
  desktopPosY?: number | null;
  pinnedToWorkspace?: boolean;
  attentionPulse?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ShareChannel = 'whatsapp' | 'email' | 'device';

export interface ShareLog {
  id: string;
  recordType: RecordType | 'document_renewal' | 'vat_3a' | 'report';
  recordId: string;
  recordTitle: string;
  specialistId: string | null;
  specialistName: string;
  channel: ShareChannel;
  scheduledInfo: string;
  messageText: string;
  status: 'فُتحت المشاركة' | 'تمت المشاركة عبر الجهاز';
  openedAt: string;
}

export type Vat3ALineId =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16;

export type Vat3ADraftStatus = 'مسودة' | 'قيد المراجعة' | 'مؤرشفة';

export type Vat3AAdjustmentDirection = 'add' | 'subtract';
export type Vat3ATaxMethod = 'rate' | 'zero';

export interface Vat3ALineRuleConfig {
  adjustmentDirection: Vat3AAdjustmentDirection;
  taxMethod: Vat3ATaxMethod;
  /** null means use defaultRatePercent */
  customRatePercent: number | null;
}

export interface Vat3ARulesConfig {
  defaultRatePercent: number; // starts at 15
  lineRules: Record<number, Vat3ALineRuleConfig>;
}

export interface Vat3ALineInput {
  amountRaw: string;
  adjustmentRaw: string;
}

export interface Vat3ADraft {
  id: string;
  orgId: string;
  entityName: string;
  taxRegistrationNumber: string;
  periodStart: string;
  periodEnd: string;
  status: Vat3ADraftStatus;
  calcRulesVersion: string;
  rulesSnapshot?: Vat3ARulesConfig;
  editorName: string;
  isTestSample: boolean;
  lines: Record<number, Vat3ALineInput>;
  item14PeriodRef?: string;
  item14Reason?: string;
  negativeBaseExplanation?: string;
  computedNetHalalas: number;
  updatedAt: string;
  archivedAt?: string | null;
}

export interface IntegrationSettings {
  serverBaseUrl: string;
  serverStatus: 'disconnected' | 'connected' | 'error';
  serverLastCheckedAt?: string;
  serverStatusMessage?: string;
  aiProvider: 'server_gemini' | 'server_custom';
  aiModelName: string;
  aiStatus: 'disconnected' | 'connected' | 'error';
  aiLastCheckedAt?: string;
  aiStatusMessage?: string;
}

export interface TaskFilters {
  onlyMine: boolean;
  type: 'الكل' | string; // 'الكل' or taskTypeId
  status: 'الكل' | 'المفتوحة' | TaskStatus;
  dueFilter: 'الكل' | 'اليوم' | 'متأخرة' | 'قادمة';
  specialistId: 'الكل' | string;
  search: string;
}

export type DocumentCategoryFilter =
  | 'الكل'
  | 'سارية'
  | 'قريبة الانتهاء'
  | 'منتهية'
  | 'بلا تاريخ'
  | 'مؤرشفة';

export interface DocumentFilters {
  category: DocumentCategoryFilter; // Validity status bucket
  categoryId: 'الكل' | '__uncategorized__' | string; // Independent document category ID
  search: string;
  specialistId: 'الكل' | string;
}

export interface Vat3AArchiveFilters {
  entityName: string;
  status: 'الكل' | Vat3ADraftStatus;
  search: string;
}

export type UrgentAlertDays = 3 | 5;
export type UrgentAlertMotionMode = 'repeat_5s' | 'continuous' | 'strong_shake';

export interface AppPreferences {
  theme: ThemeMode;
  sidebarCollapsed: boolean;
  showHijri: boolean;
  currentSpecialistId: string;
  documentWarningDays: number;
  urgentAlertDays: UrgentAlertDays;
  urgentAlertMotion: UrgentAlertMotionMode;
  vat3aRules: Vat3ARulesConfig;
  integrations: IntegrationSettings;
  collapsedSections: Record<string, boolean>;
  navGroupCollapsed: Record<string, boolean>;
  taskFilters: TaskFilters;
  documentFilters: DocumentFilters;
  vatArchiveFilters: Vat3AArchiveFilters;
  activeNav: NavSection;
}

export interface AppDatabaseState {
  organizations: Organization[];
  specialists: Specialist[];
  documentCategories: DocumentCategoryItem[];
  taskTypes: TaskTypeItem[];
  projects: ProjectItem[];
  ideas: IdeaItem[];
  tasks: TaskItem[];
  documents: DocumentItem[];
  cases: CaseItem[];
  sessions: SessionItem[];
  poas: PoaItem[];
  calendarItems: CalendarItem[];
  labels: LabelItem[];
  shareLogs: ShareLog[];
  vat3aDrafts: Vat3ADraft[];
  preferences: AppPreferences;
}

export type UserRole = 'admin' | 'tax_accountant' | 'operations' | 'viewer';

export type UserPermission =
  | 'records:read'
  | 'records:write'
  | 'records:delete'
  | 'reports:view'
  | 'reports:export'
  | 'vat3a:view'
  | 'vat3a:edit'
  | 'backups:export'
  | 'backups:restore'
  | 'settings:manage';

export type AuthMode = 'local_demo' | 'server';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  specialistId: string | null;
  permissions: UserPermission[];
  authMode: AuthMode;
}

export interface DemoAccountProfile {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  description: string;
  specialistId: string | null;
}

export interface PendingDeepLink {
  recordType?: RecordType;
  recordId?: string;
  nav?: NavSection;
}

export interface BackupSummaryCounts {
  organizations: number;
  specialists: number;
  documentCategories: number;
  taskTypes: number;
  tasks: number;
  documents: number;
  documentRenewals: number;
  cases: number;
  sessions: number;
  poas: number;
  calendarItems: number;
  labels: number;
  shareLogs: number;
  vat3aDrafts: number;
  vat3aArchivedDrafts: number;
}

export interface BackupEnvelope {
  appId: 'haqibat-almaham';
  schemaVersion: string;
  createdAt: string;
  sourceMode: AuthMode;
  includesAttachments: boolean;
  attachmentsNote: string;
  integrityHash: string;
  counts: BackupSummaryCounts;
  payload: AppDatabaseState;
}


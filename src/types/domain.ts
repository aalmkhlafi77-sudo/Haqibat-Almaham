export type ThemeMode = 'light' | 'dark';

export type NavSection =
  | 'today'
  | 'tasks'
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

export type TaskType = 'قضائية' | 'إدارية' | 'تجديد';
export type TaskPriority = 'عاجلة' | 'مرتفعة' | 'متوسطة' | 'منخفضة';
export type TaskStatus = 'جديدة' | 'قيد التنفيذ' | 'معلقة' | 'مكتملة' | 'ملغاة';

export interface TaskItem {
  id: string;
  orgId: string;
  type: TaskType;
  title: string;
  specialistId: string | null;
  departmentName: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string; // YYYY-MM-DD (DATE without time)
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
  createdAt: string;
  updatedAt: string;
}

export type ShareChannel = 'whatsapp' | 'email' | 'device';

export interface ShareLog {
  id: string;
  recordType: RecordType | 'document_renewal' | 'vat_3a';
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
  type: 'الكل' | TaskType;
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
  category: DocumentCategoryFilter;
  search: string;
  specialistId: 'الكل' | string;
}

export interface Vat3AArchiveFilters {
  entityName: string;
  status: 'الكل' | Vat3ADraftStatus;
  search: string;
}

export interface AppPreferences {
  theme: ThemeMode;
  sidebarCollapsed: boolean;
  showHijri: boolean;
  currentSpecialistId: string;
  documentWarningDays: number;
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

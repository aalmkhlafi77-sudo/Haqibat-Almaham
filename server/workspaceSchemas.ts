import { z } from 'zod';

const text = z.string().max(20000);

export const id = z.string().min(1).max(64);

export const documentCategoryItemSchema = z.object({
  id: id,
  orgId: id,
  name: text.trim().min(1),
  createdAt: text,
  updatedAt: text,
});

export const taskTypeItemSchema = z.object({
  id: id,
  orgId: id,
  name: text.trim().min(1),
  isAdminKind: z.boolean().optional(),
  isRenewalKind: z.boolean().optional(),
  createdAt: text,
  updatedAt: text,
});

const taskTypeSchema = text;

const taskPrioritySchema = z.enum(["عاجلة", "مرتفعة", "متوسطة", "منخفضة"]);

const taskStatusSchema = z.enum(["جديدة", "قيد التنفيذ", "معلقة", "مكتملة", "ملغاة"]);

export const taskItemSchema = z.object({
  id: id,
  orgId: id,
  typeId: id,
  type: taskTypeSchema,
  title: text.trim().min(1),
  specialistId: id.nullable(),
  departmentName: text,
  priority: taskPrioritySchema,
  status: taskStatusSchema,
  dueDate: text,
  plannedDate: z.iso.date().nullable().optional(),
  recurrenceSeriesId: id.nullable().optional(),
  recurrenceIndex: z.number().int().nonnegative().nullable().optional(),
  actualDeliveryDate: text.nullable().optional(),
  letterNumber: text.optional(),
  authorityName: text.optional(),
  receivedDate: text.nullable().optional(),
  documentId: id.nullable().optional(),
  caseId: id.nullable().optional(),
  sessionId: id.nullable().optional(),
  notes: text.optional(),
  archivedAt: text.nullable().optional(),
  createdAt: text,
  updatedAt: text,
});

export const projectItemSchema = z.object({
  id, title: text.trim().min(1).max(200),
  status: z.enum(['مخطط', 'قيد التنفيذ', 'معلق', 'مكتمل']),
  specialistId: id.nullable(), dueDate: z.iso.date().nullable(), nextStep: text.max(1000), notes: text.max(5000),
  milestones: z.array(z.object({ id, title: text.trim().min(1).max(200), done: z.boolean() })).max(100),
  taskIds: z.array(id).max(500), documentIds: z.array(id).max(500), createdAt: text, updatedAt: text,
}).refine(value => new Set(value.milestones.map(m => m.id)).size === value.milestones.length &&
  new Set(value.taskIds).size === value.taskIds.length && new Set(value.documentIds).size === value.documentIds.length);
export const ideaItemSchema = z.object({
  id, title: text.trim().min(1).max(1000), category: text.max(200), notes: text.max(5000),
  pinned: z.boolean(), taskId: id.nullable(), projectId: id.nullable(), createdAt: text, updatedAt: text,
});

export const documentRenewalSchema = z.object({
  id: id,
  documentId: id,
  previousExpiryDate: text.nullable(),
  newExpiryDate: text,
  notes: text,
  actorName: text,
  renewedAt: text,
});

export const documentItemSchema = z.object({
  id: id,
  orgId: id,
  name: text.trim().min(1),
  categoryId: id.nullable(),
  docType: text,
  referenceNumber: text,
  issuingAuthority: text,
  specialistId: id.nullable(),
  issueDate: text.nullable().optional(),
  expiryDate: text.nullable().optional(),
  notes: text.optional(),
  renewals: z.array(documentRenewalSchema),
  archivedAt: text.nullable().optional(),
  createdAt: text,
  updatedAt: text,
});

const caseStatusSchema = z.enum(["مفتوحة", "قيد المرافعة", "موقوفة", "مغلقة"]);

export const caseItemSchema = z.object({
  id: id,
  orgId: id,
  caseNumber: text,
  title: text.trim().min(1),
  parties: text,
  court: text,
  status: caseStatusSchema,
  lawyerSpecialistId: id.nullable(),
  notes: text.optional(),
  archivedAt: text.nullable().optional(),
  createdAt: text,
  updatedAt: text,
});

const sessionStatusSchema = z.enum(["مجدولة", "منعقدة", "مؤجلة", "ملغاة"]);

export const sessionItemSchema = z.object({
  id: id,
  orgId: id,
  caseId: id,
  title: text.trim().min(1),
  scheduledAt: text,
  status: sessionStatusSchema,
  outcome: text.optional(),
  specialistId: id.nullable(),
  location: text.optional(),
  notes: text.optional(),
  createdAt: text,
  updatedAt: text,
});

export const poaItemSchema = z.object({
  id: id,
  orgId: id,
  title: text.trim().min(1),
  referenceNumber: text,
  grantor: text,
  agent: text,
  scope: text,
  specialistId: id.nullable(),
  issueDate: text,
  expiryDate: text.nullable().optional(),
  statusOverride: z.literal('مفسوخة').nullable().optional(),
  notes: text.optional(),
  archivedAt: text.nullable().optional(),
  createdAt: text,
  updatedAt: text,
});

const calendarItemKindSchema = z.enum(["حدث", "تذكير"]);

const recordTypeSchema = z.enum(["task", "document", "case", "session", "poa", "calendar_item"]);

export const calendarItemSchema = z.object({
  recurrenceSeriesId: id.nullable().optional(),
  recurrenceIndex: z.number().int().nonnegative().nullable().optional(),
  id: id,
  orgId: id,
  kind: calendarItemKindSchema,
  title: text.trim().min(1),
  scheduledAt: text,
  isAllDay: z.boolean(),
  specialistId: id.nullable(),
  linkedRecordType: recordTypeSchema.nullable().optional(),
  linkedRecordId: id.nullable().optional(),
  notes: text.optional(),
  isDone: z.boolean(),
  createdAt: text,
  updatedAt: text,
});

const labelTargetTypeSchema = z.enum(["today", "task", "case", "document"]);

export const labelItemSchema = z.object({
  id: id,
  targetType: labelTargetTypeSchema,
  targetId: id.nullable(),
  text: text,
  bgColor: text,
  textColor: text,
  posX: z.number().nullable().optional(),
  posY: z.number().nullable().optional(),
  desktopPosX: z.number().nullable().optional(),
  desktopPosY: z.number().nullable().optional(),
  pinnedToWorkspace: z.boolean().optional(),
  attentionPulse: z.boolean().optional(),
  createdAt: text,
  updatedAt: text,
});

export const specialistSchema = z.object({
  id: id,
  orgId: id,
  name: text.trim().min(1),
  departmentName: text,
  roleTitle: text,
  mobile: text,
  email: text,
  isActive: z.boolean(),
});

const shareChannelSchema = z.enum(["whatsapp", "email", "device"]);

export const shareLogSchema = z.object({
  id: id,
  recordType: z.union([recordTypeSchema, z.literal('document_renewal'), z.literal('vat_3a'), z.literal('report')]),
  recordId: id,
  recordTitle: text,
  specialistId: id.nullable(),
  specialistName: text,
  channel: shareChannelSchema,
  scheduledInfo: text,
  messageText: text,
  status: z.enum(["فُتحت المشاركة", "تمت المشاركة عبر الجهاز"]),
  openedAt: text,
});

const vat3ADraftStatusSchema = z.enum(["مسودة", "قيد المراجعة", "مؤرشفة"]);

const vat3AAdjustmentDirectionSchema = z.enum(["add", "subtract"]);

const vat3ATaxMethodSchema = z.enum(["rate", "zero"]);

const vat3ALineRuleConfigSchema = z.object({
  adjustmentDirection: vat3AAdjustmentDirectionSchema,
  taxMethod: vat3ATaxMethodSchema,
  customRatePercent: z.number().min(0).max(100).nullable(),
});

export const vat3ARulesConfigSchema = z.object({
  defaultRatePercent: z.number().min(0).max(100),
  lineRules: z.record(z.string().regex(/^\d+$/), vat3ALineRuleConfigSchema),
});

const vat3ALineInputSchema = z.object({
  amountRaw: text,
  adjustmentRaw: text,
});

export const vat3ADraftSchema = z.object({
  id: id,
  orgId: id,
  entityName: text.trim().min(1),
  taxRegistrationNumber: text,
  periodStart: text,
  periodEnd: text,
  status: vat3ADraftStatusSchema,
  calcRulesVersion: text,
  rulesSnapshot: vat3ARulesConfigSchema.optional(),
  editorName: text,
  isTestSample: z.boolean(),
  lines: z.record(z.string().regex(/^\d+$/), vat3ALineInputSchema),
  item14PeriodRef: text.optional(),
  item14Reason: text.optional(),
  negativeBaseExplanation: text.optional(),
  computedNetHalalas: z.number(),
  updatedAt: text,
  archivedAt: text.nullable().optional(),
});

export const integrationSettingsSchema = z.object({
  serverBaseUrl: text,
  serverStatus: z.enum(["disconnected", "connected", "error"]),
  serverLastCheckedAt: text.optional(),
  serverStatusMessage: text.optional(),
  aiProvider: z.enum(["server_gemini", "server_custom"]),
  aiModelName: text,
  aiStatus: z.enum(["disconnected", "connected", "error"]),
  aiLastCheckedAt: text.optional(),
  aiStatusMessage: text.optional(),
});

export const urgentAlertDaysSchema = z.union([z.literal(3), z.literal(5)]);

export const urgentAlertMotionModeSchema = z.enum(["repeat_5s", "continuous", "strong_shake"]);

export const recurrenceSeriesSchema = z.discriminatedUnion('kind', [
  z.object({ id: id.max(48), kind: z.literal('task'), template: taskItemSchema, frequency: z.enum(['weekly', 'fortnightly', 'monthly', 'yearly']), anchor: z.iso.date(), until: z.iso.date().nullable(), active: z.boolean(), nextIndex: z.number().int().min(0).max(1000000), reminderDays: z.number().int().min(0).max(365) }),
  z.object({ id: id.max(48), kind: z.literal('calendar_item'), template: calendarItemSchema, frequency: z.enum(['weekly', 'fortnightly', 'monthly', 'yearly']), anchor: z.iso.date(), until: z.iso.date().nullable(), active: z.boolean(), nextIndex: z.number().int().min(0).max(1000000), reminderDays: z.number().int().min(0).max(365) }),
]).refine(s => !s.until || s.until >= s.anchor);

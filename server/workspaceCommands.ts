import { z } from 'zod';
import { hasPermission } from '../src/domain/authPermissions';
import { evaluateVat3ADraft } from '../src/domain/vat3aEngine';
import { StateDataRepository, type DeleteOperationResult } from '../src/data/repository';
import type { AppDatabaseState, AuthUser, UserPermission } from '../src/types/domain';
import type { Workspace } from './workspaceStore';
import * as schema from './workspaceSchemas';

export class RequestError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

function command<Input>(
  permissions: UserPermission[],
  validator: z.ZodType<Input>,
  apply: (
    repo: StateDataRepository, input: Input, user: AuthUser
  ) => AppDatabaseState | DeleteOperationResult
) {
  return (repo: StateDataRepository, args: unknown, user: AuthUser) => {
    if (!permissions.every((permission) => hasPermission(user, permission))) {
      throw new RequestError(403, 'صلاحيات الحساب لا تسمح بتنفيذ هذا الإجراء.');
    }
    const parsed = validator.safeParse(args);
    if (!parsed.success) throw new RequestError(400, 'بيانات الإجراء غير صالحة.');
    const result = apply(repo, parsed.data, user);
    if ('ok' in result && !result.ok) throw new RequestError(409, result.error || 'تعذر تعديل السجل.');
  };
}

const write: UserPermission[] = ['records:write'];
const remove: UserPermission[] = ['records:delete'];
const settings: UserPermission[] = ['settings:manage'];
const categoryRemove: UserPermission[] = [...settings, ...remove];
const vat: UserPermission[] = ['vat3a:edit'];
const vatRemove: UserPermission[] = [...vat, ...remove];
const oneId = z.tuple([schema.id]);
const renewal = schema.documentRenewalSchema.omit({ id: true, documentId: true });

const commands = {
  upsertDocumentCategory: command(settings, z.tuple([schema.documentCategoryItemSchema]), (repo, [item]) => {
    if (repo.load().documentCategories.some((entry) => entry.id !== item.id && entry.name === item.name)) {
      throw new RequestError(409, 'يوجد تصنيف آخر بالاسم نفسه.');
    }
    return repo.upsertDocumentCategory(item);
  }),
  deleteDocumentCategory: command(categoryRemove, z.tuple([schema.id, schema.id.nullable()]), (repo, [id, replacement]) => {
    if (replacement && (replacement === id || !repo.load().documentCategories.some((entry) => entry.id === replacement))) {
      throw new RequestError(409, 'التصنيف البديل غير متاح.');
    }
    return repo.deleteDocumentCategory(id, replacement);
  }),
  upsertTaskType: command(settings, z.tuple([schema.taskTypeItemSchema]), (repo, [item]) => {
    if (repo.load().taskTypes.some((entry) => entry.id !== item.id && entry.name === item.name)) {
      throw new RequestError(409, 'يوجد نوع مهام آخر بالاسم نفسه.');
    }
    return repo.upsertTaskType(item);
  }),
  deleteTaskType: command(categoryRemove, z.tuple([schema.id, schema.id]), (repo, args) => repo.deleteTaskType(...args)),
  upsertTask: command(write, z.tuple([schema.taskItemSchema]), (repo, [item]) => {
    const state = repo.load();
    requireLink(state.taskTypes, item.typeId);
    requireLink(state.documents, item.documentId);
    requireLink(state.cases, item.caseId);
    requireLink(state.sessions, item.sessionId);
    requireLink(state.specialists, item.specialistId);
    return repo.upsertTask(item);
  }),
  deleteTask: command(remove, oneId, (repo, [id]) => repo.deleteTask(id)),
  upsertDocument: command(write, z.tuple([schema.documentItemSchema]), (repo, [item]) => {
    const state = repo.load();
    requireLink(state.specialists, item.specialistId);
    requireLink(state.documentCategories, item.categoryId);
    const previous = state.documents.find((doc) => doc.id === item.id);
    return repo.upsertDocument({ ...item, renewals: previous?.renewals ?? [] });
  }),
  recordDocumentRenewal: command(write, z.tuple([schema.id, renewal]), (repo, [id, item], user) => {
    const document = repo.load().documents.find((doc) => doc.id === id);
    if (!document) throw new RequestError(404, 'الوثيقة غير موجودة.');
    return repo.recordDocumentRenewal(id, {
      ...item, actorName: user.displayName, previousExpiryDate: document.expiryDate ?? null,
    });
  }),
  deleteDocument: command(remove, oneId, (repo, [id]) => repo.deleteDocument(id)),
  upsertCase: command(write, z.tuple([schema.caseItemSchema]), (repo, [item]) => repo.upsertCase(item)),
  deleteCase: command(remove, oneId, (repo, [id]) => repo.deleteCase(id)),
  upsertSession: command(write, z.tuple([schema.sessionItemSchema]), (repo, [item]) => {
    requireLink(repo.load().cases, item.caseId);
    requireLink(repo.load().specialists, item.specialistId);
    return repo.upsertSession(item);
  }),
  deleteSession: command(remove, oneId, (repo, [id]) => repo.deleteSession(id)),
  upsertPoa: command(write, z.tuple([schema.poaItemSchema]), (repo, [item]) => repo.upsertPoa(item)),
  deletePoa: command(remove, oneId, (repo, [id]) => repo.deletePoa(id)),
  upsertCalendarItem: command(write, z.tuple([schema.calendarItemSchema]), (repo, [item]) => repo.upsertCalendarItem(item)),
  deleteCalendarItem: command(remove, oneId, (repo, [id]) => repo.deleteCalendarItem(id)),
  upsertLabel: command(write, z.tuple([schema.labelItemSchema]), (repo, [item]) => repo.upsertLabel(item)),
  deleteLabel: command(remove, oneId, (repo, [id]) => repo.deleteLabel(id)),
  upsertSpecialist: command(write, z.tuple([schema.specialistSchema]), (repo, [item]) => repo.upsertSpecialist(item)),
  deleteSpecialist: command(remove, oneId, (repo, [id]) => repo.deleteSpecialist(id)),
  addShareLog: command(['records:read'], z.tuple([schema.shareLogSchema.omit({ id: true })]), (repo, [log], user) => {
    const permission = log.recordType === 'vat_3a' ? 'vat3a:view' : log.recordType === 'report' ? 'reports:export' : 'records:read';
    if (!hasPermission(user, permission)) throw new RequestError(403, 'الحساب لا يملك صلاحية مشاركة هذا السجل.');
    return repo.addShareLog(log);
  }),
  upsertVat3ADraft: command(vat, z.tuple([schema.vat3ADraftSchema]), (repo, [draft]) =>
    repo.upsertVat3ADraft({ ...draft, computedNetHalalas: evaluateVat3ADraft(draft).v16Halalas })),
  deleteVat3ADraft: command(vatRemove, oneId, (repo, [id]) => repo.deleteVat3ADraft(id)),
  updateSharedSettings: command(settings, z.tuple([z.strictObject({
    documentWarningDays: z.number().int().min(1).max(365).optional(),
    urgentAlertDays: schema.urgentAlertDaysSchema.optional(),
    urgentAlertMotion: schema.urgentAlertMotionModeSchema.optional(),
    integrations: schema.integrationSettingsSchema.optional(),
  })]), (repo, [preferences]) => repo.updatePreferences(preferences)),
  updateVat3ARules: command(vat, z.tuple([schema.vat3ARulesConfigSchema]), (repo, [vat3aRules]) =>
    repo.updatePreferences({ vat3aRules })),
};

export function requireLink(records: Array<{ id: string }>, id?: string | null) {
  if (id && !records.some((record) => record.id === id)) throw new RequestError(409, 'السجل المرتبط غير متاح.');
}

const workspaceCollections = {
  organizations: z.object({ id: schema.id, name: z.string(), taxRegistrationNumber: z.string().optional() }),
  specialists: schema.specialistSchema,
  documentCategories: schema.documentCategoryItemSchema,
  taskTypes: schema.taskTypeItemSchema,
  tasks: schema.taskItemSchema,
  documents: schema.documentItemSchema,
  cases: schema.caseItemSchema,
  sessions: schema.sessionItemSchema,
  poas: schema.poaItemSchema,
  calendarItems: schema.calendarItemSchema,
  labels: schema.labelItemSchema,
  shareLogs: schema.shareLogSchema,
  vat3aDrafts: schema.vat3ADraftSchema,
} as const;

export function assertRestorableWorkspace(state: AppDatabaseState) {
  for (const field of Object.keys(workspaceCollections) as Array<keyof typeof workspaceCollections>) {
    const entries = state[field];
    if (new Set(entries.map((entry) => entry.id)).size !== entries.length ||
        !z.array(workspaceCollections[field] as z.ZodType).safeParse(entries).success) {
      throw new RequestError(400, `تحتوي النسخة الاحتياطية على سجلات مكررة أو غير صالحة في ${field}.`);
    }
  }

  if (!schema.vat3ARulesConfigSchema.safeParse(state.preferences.vat3aRules).success ||
      !schema.integrationSettingsSchema.safeParse(state.preferences.integrations).success) {
    throw new RequestError(400, 'إعدادات مساحة العمل في النسخة الاحتياطية غير صالحة.');
  }
}

export function applyWorkspaceCommand(workspace: Workspace, body: unknown, user: AuthUser) {
  const parsed = z.object({
    revision: z.number().int().nonnegative(),
    name: z.string(),
    args: z.array(z.unknown()),
  }).safeParse(body);
  if (!parsed.success || !Object.hasOwn(commands, parsed.data.name)) {
    throw new RequestError(400, 'الإجراء المطلوب غير صالح.');
  }
  const { revision, name, args } = parsed.data;
  if (revision !== workspace.revision) {
    throw new RequestError(409, 'تغيرت بيانات مساحة العمل. جرى إيقاف الحفظ لحماية التعديلات الأخرى.');
  }
  const repo = new StateDataRepository(() => workspace.state, (state) => { workspace.state = state; });
  commands[name as keyof typeof commands](repo, args, user);
}

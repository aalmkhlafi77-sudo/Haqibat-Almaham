import type { LabelTargetType, RecordType, Vat3ALineInput } from '../types/domain';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

export function effectiveGeminiModel(model: string) {
  const value = model.trim();
  return !value || value === 'gemini-2.5-flash' ? DEFAULT_GEMINI_MODEL : value;
}

export const ASSISTANT_MODES = [
  'auto', 'create_task', 'create_event', 'create_reminder', 'create_document',
  'create_renewal', 'create_case', 'create_session', 'create_poa', 'create_specialist',
  'create_vat', 'create_report', 'create_label', 'share',
] as const;
export type AssistantMode = (typeof ASSISTANT_MODES)[number];
export type AssistantCreateMode = Extract<AssistantMode, `create_${string}`>;

export type AssistantRecord = {
  type: RecordType | 'specialist' | 'vat3a' | 'label' | 'share_log';
  id: string;
  title: string;
  date: string | null;
  specialistId: string | null;
  specialistName: string | null;
  status: string;
  detail?: string;
};

export type AssistantHandoff =
  | { kind: 'vat_saved'; id: string }
  | { kind: 'vat_new'; entityName: string; taxRegistrationNumber?: string; periodStart: string; periodEnd: string; lines: Record<number, Vat3ALineInput> }
  | { kind: 'specialist'; id?: string; prefill?: { name: string; mobile: string; email: string; departmentName?: string; roleTitle?: string } }
  | { kind: 'report'; fromDate?: string; toDate?: string; specialistId?: string }
  | { kind: 'today' };

export type AssistantDraft = { title: string } & (
  | { type: 'record'; recordType: RecordType; prefill: Record<string, string | boolean | null>; id?: string }
  | { type: 'view'; target: AssistantHandoff }
  | { type: 'label'; targetType: LabelTargetType; targetId: string | null }
);

export interface AssistantAnswer {
  message: string;
  records: AssistantRecord[];
  draft?: AssistantDraft;
  clarification?: AssistantMode;
  sharing?: { recipientId?: string; channel?: 'whatsapp' | 'email' };
}

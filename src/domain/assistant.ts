import type { RecordType } from '../types/domain';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

export function effectiveGeminiModel(model: string) {
  const value = model.trim();
  return !value || value === 'gemini-2.5-flash' ? DEFAULT_GEMINI_MODEL : value;
}

export type AssistantRecord = {
  type: Extract<RecordType, 'task' | 'document' | 'session' | 'calendar_item'>;
  id: string;
  title: string;
  date: string | null;
  specialistId: string | null;
  specialistName: string | null;
  status: string;
};

export type AssistantDraft = {
  type: 'task' | 'calendar_item';
  title: string;
  date?: string;
  time?: string;
  kind?: 'حدث' | 'تذكير';
  specialistId?: string;
  notes?: string;
  taskTypeId?: string;
  authority?: string;
};

export interface AssistantAnswer {
  message: string;
  records: AssistantRecord[];
  draft?: AssistantDraft;
  sharing?: { recipientId?: string; channel?: 'whatsapp' | 'email' };
}

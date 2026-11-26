import { z } from 'zod';
import { evaluatePoaHealth, toEnglishDigits } from '../src/domain/dateUtils';
import { CUSTOMIZABLE_VAT_LINE_IDS, evaluateVat3ADraft, formatHalalas } from '../src/domain/vat3aEngine';
import { normalizeArabicSearchText, scoreArabicSearchMatch } from '../src/domain/searchUtils';
import type { AssistantAnswer, AssistantCreateMode, AssistantDraft, AssistantRecord } from '../src/domain/assistant';
import type { AppDatabaseState, Specialist } from '../src/types/domain';
import { RequestError } from './workspaceCommands';

const shortText = z.string().trim().max(200);
export const extraSections = ['cases', 'sessions', 'poas', 'specialists', 'vat3a', 'reports', 'labels', 'home', 'shares', 'renewals'] as const;
export type ExtraSection = typeof extraSections[number];

export const assistantFields = {
  reference: shortText.optional(),
  caseRef: shortText.optional(),
  authority: shortText.optional(),
  category: shortText.optional(),
  parties: shortText.optional(),
  court: shortText.optional(),
  location: shortText.optional(),
  grantor: shortText.optional(),
  agent: shortText.optional(),
  scope: shortText.optional(),
  mobile: z.string().trim().max(40).optional(),
  email: z.string().trim().max(254).optional(),
  department: shortText.optional(),
  roleTitle: shortText.optional(),
  issueDate: z.iso.date().optional(),
  expiryDate: z.iso.date().optional(),
  taxNumber: z.string().trim().max(30).optional(),
  allDay: z.boolean().optional(),
  labelTarget: z.enum(['today', 'task', 'case', 'document']).optional(),
  vatLines: z.array(z.object({
    line: z.number().int().min(1).max(16),
    amount: z.string().trim().regex(/^[+-]?\d+(?:\.\d{1,2})?$/).max(24).optional(),
    adjustment: z.string().trim().regex(/^[+-]?\d+(?:\.\d{1,2})?$/).max(24).optional(),
  })).max(16).optional(),
};
const extendedFieldsSchema = z.object(assistantFields);

type DraftFields = z.infer<typeof extendedFieldsSchema> & {
  title?: string; start?: string; end?: string; time?: string; query?: string; notes?: string;
  specialist?: string; taskKind?: 'admin' | 'judicial' | 'renewal'; section?: string;
};

export interface AssistantPermissions {
  canWrite: boolean;
  canViewVat: boolean;
  canEditVat: boolean;
  canViewReports: boolean;
}

export function specialistMatches(specialists: Specialist[], name: string) {
  const active = specialists.filter((person) => person.isActive);
  return matchNamed(active, name, (person) => person.name);
}

function matchNamed<T>(entries: T[], input: string, label: (entry: T) => string, ref?: (entry: T) => string) {
  const key = normalizeArabicSearchText(input);
  if (!key) return [];
  const exact = entries.filter((entry) => normalizeArabicSearchText(label(entry)) === key ||
    (ref && normalizeArabicSearchText(ref(entry)) === key));
  return exact.length ? exact : entries.filter((entry) => scoreArabicSearchMatch(input, label(entry), [ref?.(entry)]) > 0);
}

export function checkAssistantAccess(section: string, access: AssistantPermissions, action?: string) {
  if ((section === 'vat3a' || action === 'create_vat') && !access.canViewVat) {
    throw new RequestError(403, 'صلاحيات حسابك لا تسمح بالاطلاع على ضريبة القيمة المضافة.');
  }
  if ((section === 'reports' || action === 'create_report') && !access.canViewReports) {
    throw new RequestError(403, 'صلاحيات حسابك لا تسمح بعرض التقارير.');
  }
  if (action === 'create_vat' && !access.canEditVat) {
    throw new RequestError(403, 'صلاحيات حسابك لا تسمح بإنشاء مسودة ضريبة.');
  }
  if (action?.startsWith('create_') && action !== 'create_vat' && action !== 'create_report' && !access.canWrite) {
    throw new RequestError(403, 'صلاحيات حسابك لا تسمح بإنشاء السجلات.');
  }
}

const ask = (action: AssistantCreateMode, message: string): AssistantAnswer =>
  ({ message, records: [], clarification: action });

export function prepareAssistantDraft(
  action: AssistantCreateMode, input: DraftFields, state: AppDatabaseState, access: AssistantPermissions
): AssistantAnswer {
  checkAssistantAccess(input.section || '', access, action);
  const title = input.title || '';
  const person = specialistMatches(state.specialists, input.specialist || '');
  const specialistId = person.length === 1 ? person[0].id : null;
  const reference = input.reference || '';
  const date = input.start || '';
  const expiryDate = input.expiryDate || input.end || '';
  const notes = input.notes || '';
  const personNote = input.specialist && !specialistId
    ? ' لم أتمكن من تحديد المختص بالاسم. اختره في النموذج إذا لزم.'
    : '';
  const ready = (draft: AssistantDraft, message = 'جهّزت المسودة. راجع النموذج ثم احفظه. يمكنك مشاركة السجل مع المختص بعد حفظه.'): AssistantAnswer =>
    ({ message: message + personNote, records: [], draft });
  const scheduled = input.time ? `${date}T${input.time}` : `${date}T00:00`;
  const dateOrder = input.issueDate && expiryDate && input.issueDate > expiryDate;

  if (action === 'create_report') {
    if (date && input.end && date > input.end) return ask(action, 'ما فترة التقرير الصحيحة؟ تاريخ النهاية يسبق البداية.');
    if (input.specialist && !specialistId) return ask(action, 'ما اسم المختص الكامل كما يظهر في التطبيق؟');
    return ready({
      type: 'view', title: 'تقرير العمليات', target: {
        kind: 'report', fromDate: date, toDate: input.end, specialistId: specialistId || undefined,
      },
    }, 'جهّزت فلاتر التقرير. افتح التقارير لمراجعة النتائج وتنزيلها حسب صلاحيتك.');
  }

  if (action === 'create_renewal') {
    const key = reference || input.query || title;
    if (!key || !expiryDate) return ask(action, 'ما اسم الوثيقة أو رقمها المرجعي، وما تاريخ الانتهاء الجديد؟');
    const matches = matchNamed(state.documents, key, (doc) => doc.name, (doc) => doc.referenceNumber);
    if (matches.length !== 1) return ask(action, 'لم أتمكن من تحديد وثيقة واحدة. ما الرقم المرجعي الدقيق للوثيقة؟');
    return ready({ type: 'record', recordType: 'document', id: matches[0].id,
      title: `تجديد ${matches[0].name}`,
      prefill: { renewalDate: expiryDate, renewalNotes: notes },
    });
  }

  if (!title) return ask(action, 'ما الاسم أو العنوان الذي تريد استخدامه لهذا السجل؟');

  const common = { title, specialistId, notes };

  switch (action) {
    case 'create_task': {
      const type = input.taskKind === 'renewal' ? state.taskTypes.find((item) => item.isRenewalKind)
        : input.taskKind === 'judicial' ? state.taskTypes.find((item) => item.id === 'ttype-judicial')
        : state.taskTypes.find((item) => item.isAdminKind);
      if (!date || (type?.isAdminKind && !input.authority)) {
        const missing = [!date && 'تاريخ الاستحقاق', type?.isAdminKind && !input.authority && 'اسم الجهة للمهمة الإدارية'].filter(Boolean);
        return ask(action, `لإكمال المهمة «${title}»، أحتاج ${missing.join(' و')}.`);
      }
      return ready({ type: 'record', recordType: 'task', title,
        prefill: { ...common, dueDate: date, typeId: type?.id || '', authorityName: input.authority || '' },
      });
    }
    case 'create_event':
    case 'create_reminder':
      if (!date || (!input.time && !input.allDay)) return ask(action, 'ما تاريخ الموعد ووقته؟ يمكنك تحديده كموعد طوال اليوم.');
      return ready({ type: 'record', recordType: 'calendar_item', title, prefill: {
        ...common, kind: action === 'create_event' ? 'حدث' : 'تذكير', scheduledAt: scheduled, isAllDay: !input.time,
      } });
    case 'create_document': {
      if (!input.authority) return ask(action, `ما الجهة المصدرة للوثيقة «${title}»؟`);
      if (dateOrder) return ask(action, 'ما تاريخا الإصدار والانتهاء الصحيحان؟ تاريخ الانتهاء يسبق الإصدار.');
      const categories = matchNamed(state.documentCategories, input.category || '', (item) => item.name);
      if (input.category && normalizeArabicSearchText(input.category) !== 'غير مصنفه' && categories.length !== 1) return ask(action, 'ما اسم التصنيف المسجل في التطبيق؟ يمكنك اختيار «غير مصنفة».');
      return ready({ type: 'record', recordType: 'document', title, prefill: {
        ...common, name: title, issuingAuthority: input.authority, referenceNumber: reference,
        categoryId: categories[0]?.id || '', issueDate: input.issueDate || '', expiryDate,
      } });
    }
    case 'create_case':
      if (!reference) return ask(action, `ما رقم القضية «${title}»؟`);
      return ready({ type: 'record', recordType: 'case', title,
        prefill: { ...common, caseNumber: reference, parties: input.parties || '', court: input.court || '', lawyerSpecialistId: specialistId },
      });
    case 'create_session': {
      if (!input.caseRef || !date || !input.time) return ask(action, 'ما رقم القضية المرتبطة بالجلسة، وما تاريخ الجلسة ووقتها؟');
      const cases = matchNamed(state.cases.filter((item) => !item.archivedAt), input.caseRef, (item) => item.title, (item) => item.caseNumber);
      if (cases.length !== 1) return ask(action, 'لم أتمكن من تحديد قضية واحدة. ما رقم القضية الدقيق؟');
      return ready({ type: 'record', recordType: 'session', title,
        prefill: { ...common, caseId: cases[0].id, scheduledAt: scheduled, location: input.location || '' },
      });
    }
    case 'create_poa':
      if (!reference || !input.issueDate) return ask(action, 'ما الرقم المرجعي للوكالة أو التفويض وتاريخ الإصدار؟');
      if (dateOrder) return ask(action, 'ما تاريخا الإصدار والانتهاء الصحيحان؟ تاريخ الانتهاء يسبق الإصدار.');
      return ready({ type: 'record', recordType: 'poa', title, prefill: {
        ...common, referenceNumber: reference, grantor: input.grantor || '', agent: input.agent || '',
        scope: input.scope || '', issueDate: input.issueDate, expiryDate,
      } });
    case 'create_specialist': {
      const mobile = toEnglishDigits(input.mobile || '');
      if (!/^\+?[\d\s().-]{7,30}$/.test(mobile) || !/^\d{7,15}$/.test(mobile.replace(/\D/g, '')) || !z.email().safeParse(input.email).success) {
        return ask(action, `ما رقم الجوال والبريد الإلكتروني الصحيحان للمختص «${title}»؟`);
      }
      return ready({ type: 'view', title, target: { kind: 'specialist', prefill: {
        name: title, mobile, email: input.email!, departmentName: input.department, roleTitle: input.roleTitle,
      } } });
    }
    case 'create_vat': {
      if (!date || !input.end || date > input.end) return ask(action, 'ما تاريخ بداية ونهاية الفترة الضريبية؟');
      const lines = Object.fromEntries((input.vatLines || [])
        .filter(({ line }) => CUSTOMIZABLE_VAT_LINE_IDS.includes(line as (typeof CUSTOMIZABLE_VAT_LINE_IDS)[number]) || line === 14 || line === 15)
        .map(({ line, amount, adjustment }) => [line, { amountRaw: amount || '', adjustmentRaw: adjustment || '' }]));
      return ready({ type: 'view', title, target: {
        kind: 'vat_new', entityName: title, periodStart: date, periodEnd: input.end,
        taxRegistrationNumber: input.taxNumber, lines,
      } }, 'جهّزت مسودة 3A. افتح النموذج لمراجعة البنود والنتيجة التي يحسبها التطبيق ثم احفظها.');
    }
    case 'create_label': {
      const targetType = input.labelTarget || 'today';
      if (targetType === 'today') {
        return ready({ type: 'label', title, targetType, targetId: null }, 'جهّزت ملصقًا لشاشة اليوم. راجع نصه ثم احفظه.');
      }
      const key = reference || input.query || '';
      const matches = targetType === 'task'
        ? matchNamed(state.tasks, key, (item) => item.title, (item) => item.letterNumber || '')
        : targetType === 'case'
        ? matchNamed(state.cases, key, (item) => item.title, (item) => item.caseNumber)
        : matchNamed(state.documents, key, (item) => item.name, (item) => item.referenceNumber);
      if (matches.length !== 1) return ask(action, 'ما العنوان أو الرقم المرجعي الدقيق للسجل الذي تريد تثبيت الملصق عليه؟');
      return ready({ type: 'label', title, targetType, targetId: matches[0].id }, 'جهّزت الملصق للسجل المحدد. راجع نصه ثم احفظه.');
    }
  }
}

export type AssistantCandidate = Omit<AssistantRecord, 'specialistName'> & { search: (string | undefined)[] };
export function workspaceCandidates(
  state: AppDatabaseState, section: string, today: string
): AssistantCandidate[] {
  const rows: AssistantCandidate[] = [];
  if (['cases', 'reports', 'all'].includes(section)) {
    rows.push(...state.cases.filter((item) => section === 'cases' || !item.archivedAt).map((item): AssistantCandidate => ({
      type: 'case', id: item.id, title: item.title, date: item.updatedAt,
      specialistId: item.lawyerSpecialistId, status: item.archivedAt ? 'مؤرشفة' : item.status,
      search: [item.caseNumber, item.court],
    })));
  }
  if (['poas', 'reports', 'all'].includes(section)) {
    rows.push(...state.poas.filter((item) => section === 'poas' || !item.archivedAt).map((item): AssistantCandidate => ({
      type: 'poa', id: item.id, title: item.title, date: item.expiryDate || item.issueDate,
      specialistId: item.specialistId, status: item.archivedAt ? 'مؤرشفة' : evaluatePoaHealth(item, state.preferences.documentWarningDays, today).label,
      search: [item.referenceNumber, item.grantor, item.agent],
    })));
  }
  if (section === 'renewals') {
    rows.push(...state.documents.filter((item) => item.renewals.length > 0).map((item): AssistantCandidate => {
      const latest = item.renewals.reduce((last, entry) => entry.renewedAt > last.renewedAt ? entry : last);
      return {
        type: 'document', id: item.id, title: item.name, date: latest.renewedAt,
        specialistId: item.specialistId, status: 'تجديد وثيقة',
        detail: `عدد التجديدات ${item.renewals.length} · آخر انتهاء جديد ${latest.newExpiryDate}`,
        search: [item.referenceNumber, item.docType],
      };
    }));
  }
  if (section === 'specialists') {
    rows.push(...state.specialists.map((item): AssistantCandidate => ({
      type: 'specialist', id: item.id, title: item.name, date: null, specialistId: item.id,
      status: item.isActive ? 'نشط' : 'غير نشط', detail: [item.departmentName, item.roleTitle].filter(Boolean).join(' · '),
      search: [item.departmentName, item.roleTitle],
    })));
  }
  if (section === 'vat3a') {
    rows.push(...state.vat3aDrafts.filter((item) => !item.isTestSample).map((item): AssistantCandidate => {
      const result = evaluateVat3ADraft(item, state.preferences.vat3aRules);
      return {
        type: 'vat3a', id: item.id, title: item.entityName, date: item.periodEnd,
        specialistId: null, status: item.status,
        detail: `الفترة ${item.periodStart} – ${item.periodEnd} · ${result.isValid ? `صافي الضريبة ${formatHalalas(result.v16Halalas)} ر.س` : 'المسودة تحتوي على حقول تحتاج مراجعة'}`,
        search: [item.taxRegistrationNumber, item.status, item.periodStart, item.periodEnd],
      };
    }));
  }
  if (section === 'labels' || section === 'home') {
    rows.push(...state.labels.filter((item) => section !== 'home' || item.targetType === 'today').map((item): AssistantCandidate => ({
      type: 'label', id: item.id, title: item.text, date: item.updatedAt, specialistId: null, status: 'ملصق', search: [],
    })));
  }
  if (section === 'shares') {
    rows.push(...state.shareLogs.filter((item) => item.recordType !== 'vat_3a' || state.vat3aDrafts.some((draft) => draft.id === item.recordId)).map((item): AssistantCandidate => ({
      type: 'share_log', id: item.id, title: item.recordTitle, date: item.openedAt,
      specialistId: item.specialistId, status: item.status,
      detail: item.channel === 'whatsapp' ? 'واتساب' : item.channel === 'email' ? 'البريد الإلكتروني' : 'مشاركة الجهاز',
      search: [item.specialistName],
    })));
  }
  return rows;
}

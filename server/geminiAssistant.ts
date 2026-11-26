import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { addDaysISO, evaluateDocumentHealth, evaluateTaskDelay } from '../src/domain/dateUtils';
import { normalizeArabicSearchText, scoreArabicSearchMatch } from '../src/domain/searchUtils';
import {
  ASSISTANT_MODES, effectiveGeminiModel, type AssistantAnswer, type AssistantCreateMode, type AssistantMode,
} from '../src/domain/assistant';
import type { AppDatabaseState } from '../src/types/domain';
import { RequestError } from './workspaceCommands';
import { assistantFields, checkAssistantAccess, extraSections, prepareAssistantDraft,
  specialistMatches, workspaceCandidates, type AssistantCandidate, type AssistantPermissions,
} from './assistantWorkspace';

const modelName = z.string().regex(/^gemini-[a-z0-9][a-z0-9.-]{1,76}$/);
export const assistantQuestion = z.object({
  question: z.string().trim().min(2).max(600),
  history: z.array(z.string().trim().min(1).max(600)).max(6).default([]),
  mode: z.enum(ASSISTANT_MODES).default('auto'),
});
export const assistantConnection = z.object({ model: z.string().trim().max(83) });

const intentSchema = z.object({
  action: z.enum(['search', 'unsupported', ...ASSISTANT_MODES.filter((mode) => mode !== 'auto')]),
  section: z.enum(['all', 'tasks', 'documents', 'calendar', ...extraSections]).optional(),
  filter: z.enum(['all', 'overdue', 'expiring', 'expired', 'completed', 'open', 'archived', 'active']).optional(),
  start: z.iso.date().optional(),
  end: z.iso.date().optional(),
  query: z.string().trim().max(200).optional(),
  specialist: z.string().trim().max(120).optional(),
  channel: z.enum(['whatsapp', 'email']).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  time: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  notes: z.string().trim().max(500).optional(),
  taskKind: z.enum(['admin', 'judicial', 'renewal']).optional(),
  ...assistantFields,
});
type Intent = z.infer<typeof intentSchema>;

const riyadhDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit',
});

function getGemini(model: string) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new RequestError(503, 'أضف مفتاح Gemini إلى متغيرات الخادم أولًا.');
  const selected = modelName.safeParse(effectiveGeminiModel(model));
  if (!selected.success) throw new RequestError(400, 'أدخل معرّف نموذج Gemini المتاح في مشروعك.');
  return { client: new GoogleGenAI({ apiKey }), model: selected.data };
}

function providerError(error: unknown): RequestError {
  const code = typeof error === 'object' && error ? (error as { status?: number }).status : undefined;
  if (code === 429) return new RequestError(429, 'بلغ Gemini حد الاستخدام. حاول مجددًا لاحقًا.');
  if (code === 401 || code === 403) {
    return new RequestError(502, 'رفض Gemini الطلب. تحقّق من المفتاح وصلاحياته في مشروع Google.');
  }
  if (code === 404) return new RequestError(502, 'النموذج غير متاح في مشروع Gemini الحالي.');
  if (code === 400) return new RequestError(502, 'رفض Gemini إعدادات النموذج أو المفتاح. راجع الإعدادات.');
  return new RequestError(502, 'تعذّر الاتصال بـ Gemini أو انتهت مهلة الاستجابة.');
}

async function generateIntent(model: string, question: string, instruction: string): Promise<Intent> {
  const { client, model: selected } = getGemini(model);
  let output: string | undefined;
  try {
    const response = await client.models.generateContent({
      model: selected,
      contents: question,
      config: {
        systemInstruction: instruction,
        responseMimeType: 'application/json',
        responseJsonSchema: z.toJSONSchema(intentSchema),
        maxOutputTokens: 1024,
        abortSignal: AbortSignal.timeout(20_000),
      },
    });
    output = response.text;
  } catch (error) {
    throw providerError(error);
  }
  try {
    return intentSchema.parse(JSON.parse(output || ''));
  } catch {
    throw new RequestError(502, 'تعذّر قراءة نتيجة Gemini. صغ الطلب بشكل أكثر تحديدًا.');
  }
}

export async function verifyGeminiConnection(model: string) {
  const intent = await generateIntent(model, 'اختبار الاتصال', 'أجب بكائن JSON يحتوي فقط على action بقيمة unsupported.');
  if (intent.action !== 'unsupported') throw new RequestError(502, 'استجاب Gemini بنتيجة غير متوقعة.');
  return effectiveGeminiModel(model);
}

type AssistantRequest = z.infer<typeof assistantQuestion>;

function explicitSection(text: string): Intent['section'] {
  if (/القيم[هة] المضاف[هة]|\bvat\b|\b3a\b/i.test(text)) return 'vat3a';
  return undefined;
}

export async function answerAssistant(input: AssistantRequest, state: AppDatabaseState, access: AssistantPermissions) {
  const { question, history, mode } = input;
  const normalized = normalizeArabicSearchText(question);
  if (/^(?:هل تستطيع\s+|من فضلك\s+)?(?:احذف|حذف|امسح|ازل)(?:\s|$)/.test(normalized) ||
      /^(?:غير|عدل|اضبط)\s+.{0,30}(?:الاعدادات|الصلاحيات|كلمه المرور)/.test(normalized)) {
    return { message: 'يدعم المساعد البحث وتجهيز الإنشاء والمشاركة. إدارة الإعدادات والحذف متاحة من واجهات التطبيق حسب صلاحياتك.', records: [] };
  }

  const today = riyadhDate.format(new Date());
  const requestedSection = explicitSection(normalized);
  checkAssistantAccess('', access, mode);
  const intent = await generateIntent(state.preferences.integrations.aiModelName,
    history.length ? JSON.stringify({ previousUserMessages: history, latestUserMessage: question }) : question, [
    'حوّل طلب المستخدم إلى الإجراء والحقول في مخطط JSON. استخدم الطلب الأخير لتحديث تفاصيل الرسائل السابقة، واستفد من السياق إذا كان استكمالاً أو تصحيحًا.',
    `اليوم ${today} في الرياض. الأسبوع من الأحد للسبت. استعمل التاريخ الميلادي YYYY-MM-DD والوقت 24 ساعة. لا تخترع حقلًا ناقصًا.`,
    'الأقسام: tasks المهام، documents الوثائق والتراخيص، renewals التجديدات، cases القضايا، sessions الجلسات، poas الوكالات والتفويضات، calendar الأحداث والتذكيرات، specialists المختصون، vat3a مسودات وأرشيف الضريبة، reports التقارير، labels الملصقات، home اليوم، shares سجل المشاركات.',
    'للقراءة استخدم search وحدد القسم والأيام وحالة السجلات. لقسم اليوم قيد الفترة إلى اليوم، ما لم يحدد المستخدم فترة. استخدم archived للأرشيف وactive للمسودات النشطة وexpiring للوثائق القريبة.',
    'في «خلال N يومًا» البداية اليوم والنهاية بعد N أيام. اجعل query كلمات عنوان السجل أو رقمه فقط. ضع اسم المختص في specialist.',
    'في الإنشاء استخدم الإجراء المحدد create_*، وtitle عنوان السجل أو اسم المنشأة أو المختص. start تاريخ الاستحقاق أو الموعد، time وقته، allDay فقط إذا طلب موعدًا طوال اليوم.',
    'taskKind للمهمة، authority للجهة المصدرة أو الإدارية، reference للرقم، caseRef للقضية المرتبطة، issueDate للإصدار وexpiryDate للانتهاء والتجديد. استخدم الحقول المتخصصة للوثيقة والوكالة والقضية والمختص.',
    'في 3A استخدم start وend للفترة، وtaxNumber عند ذكره. vatLines فقط لأرقام البنود والمبالغ والتعديلات التي صرح بها المستخدم بالريال، دون حساب أو تخمين.',
    'لإنشاء تقرير استخدم create_report واستخرج الفترة والمختص. في إنشاء ملصق استخدم create_label وtitle لنص الملصق. labelTarget للشاشة أو المهمة أو القضية أو الوثيقة وquery لتحديد السجل المرتبط.',
    'للمشاركة استخدم share مع عنوان السجل أو رقمه في query والقسم والمختص والقناة. إذا أراد إنشاء سجل ثم مشاركته، جهّز الإنشاء أولًا.',
    'الحذف وتغيير الإعدادات والصلاحيات إجراءات غير مدعومة. استخدم unsupported لهذه الطلبات والأسئلة خارج التطبيق.',
    mode === 'auto' ? '' : `اختار المستخدم الإجراء ${mode}. استخرج حقوله حتى إذا جاءت آخر رسالة لاستكمال معلومة ناقصة.`,
  ].join('\n'));
  const action = mode === 'auto' ? intent.action : mode;
  const section = action.startsWith('create_') ? 'all' : requestedSection || intent.section || 'all';
  checkAssistantAccess(section, access, action);
  if (action.startsWith('create_')) {
    return prepareAssistantDraft(action as AssistantCreateMode, { ...intent, section }, state, access);
  }
  if (action === 'unsupported') {
    return { message: 'أستطيع البحث في أقسام العمل وتجهيز السجلات والتقارير والمشاركة. ما السجل أو الإجراء الذي تريده؟', records: [] };
  }
  const query = mode === 'share' ? intent.query || intent.title : intent.query;
  const sectionOnlyQuery = section === 'vat3a' && query &&
    /^(?:ضريبه )?القيمه المضافه(?: 3a)?$|^(?:vat|3a)$/i.test(normalizeArabicSearchText(query));
  return resolveAssistantIntent({
    ...intent, action, section,
    query: sectionOnlyQuery && action === 'search' ? undefined : query,
  }, state, today);
}

function resolveAssistantIntent(intent: Intent, state: AppDatabaseState, today: string): AssistantAnswer {
  const share = intent.action === 'share';
  const people = specialistMatches(state.specialists, intent.specialist || '');
  const person = people.length === 1 ? people[0] : undefined;
  if (share && !intent.query) {
    return { message: 'ما عنوان السجل أو رقمه المرجعي لتجهيز المشاركة؟', records: [], clarification: 'share' };
  }
  if (intent.specialist && !share && !people.length) {
    return { message: 'لم أجد مختصًا بهذا الاسم. جرّب كتابة الاسم كما يظهر في التطبيق.', records: [] };
  }
  if (intent.start && intent.end && intent.start > intent.end) {
    return { message: 'حدّد تاريخ بداية يسبق تاريخ النهاية.', records: [] };
  }
  const peopleById = new Map(state.specialists.map((entry) => [entry.id, entry.name]));
  const specialistIds = new Set(people.map((entry) => entry.id));
  const candidates: AssistantCandidate[] = [];
  const section = intent.section || 'all';
  const filter = intent.filter || 'all';

  if (['all', 'home', 'reports', 'tasks'].includes(section)) {
    for (const task of state.tasks) {
      if ((filter === 'archived' ? !task.archivedAt : task.archivedAt) || filter === 'expired' || filter === 'expiring') continue;
      if (filter === 'overdue' && !evaluateTaskDelay(task, today).isOverdue) continue;
      if (filter === 'completed' && task.status !== 'مكتملة') continue;
      if (filter === 'open' && (task.status === 'مكتملة' || task.status === 'ملغاة')) continue;
      candidates.push({ id: task.id, type: 'task', title: task.title, date: task.dueDate,
        specialistId: task.specialistId, status: task.archivedAt ? 'مؤرشفة' : evaluateTaskDelay(task, today).isOverdue ? 'متأخرة' : task.status, search: [task.letterNumber, task.type] });
    }
  }
  if (['all', 'home', 'reports', 'documents'].includes(section) && ['all', 'expired', 'expiring', 'archived', 'active'].includes(filter)) {
    for (const doc of state.documents) {
      if (filter === 'archived' ? !doc.archivedAt : doc.archivedAt) continue;
      const health = evaluateDocumentHealth(doc, state.preferences.documentWarningDays, today);
      if (filter === 'expired' && health.category !== 'منتهية') continue;
      if (filter === 'expiring' && (!doc.expiryDate || doc.expiryDate < today ||
        doc.expiryDate > (intent.end || addDaysISO(today, state.preferences.documentWarningDays)))) continue;
      candidates.push({ id: doc.id, type: 'document', title: doc.name, date: doc.expiryDate || null,
        specialistId: doc.specialistId, status: health.category, search: [doc.referenceNumber, doc.docType] });
    }
  }
  if (['all', 'home', 'reports', 'calendar', 'sessions'].includes(section) && ['all', 'completed', 'open'].includes(filter)) {
    for (const item of section === 'sessions' ? [] : state.calendarItems) {
      if (filter === 'open' && item.isDone || filter === 'completed' && !item.isDone) continue;
      candidates.push({ id: item.id, type: 'calendar_item', title: item.title, date: item.scheduledAt,
        specialistId: item.specialistId, status: item.isDone ? 'مكتمل' : item.kind, search: [item.kind] });
    }
    for (const item of state.sessions) {
      if (filter === 'open' && item.status !== 'مجدولة' || filter === 'completed' && item.status !== 'منعقدة') continue;
      if (item.status === 'ملغاة' && !share) continue;
      candidates.push({ id: item.id, type: 'session', title: item.title, date: item.scheduledAt,
        specialistId: item.specialistId, status: item.status, search: [] });
    }
  }

  candidates.push(...workspaceCandidates(state, section, today));
  const start = intent.start || (section === 'home' && !intent.end ? today : undefined);
  const end = intent.end || (section === 'home' && !intent.start ? today : undefined);
  const matches = candidates.flatMap(({ search, ...record }) => {
    const day = record.date?.slice(0, 10);
    if (record.type === 'vat3a') {
      const periodStart = search[2];
      if (start && (!day || day < start) || end && (!periodStart || periodStart > end)) return [];
    } else if (record.type !== 'label' || section !== 'home') {
      if (start && (!day || day < start) || end && (!day || day > end)) return [];
    }
    if (filter === 'archived' && record.status !== 'مؤرشفة') return [];
    if (filter === 'active' && record.status === 'مؤرشفة') return [];
    if (share && ['vat3a', 'specialist', 'label', 'share_log'].includes(record.type)) return [];
    if (!share && specialistIds.size && !specialistIds.has(record.specialistId || '')) return [];
    const specialistName = peopleById.get(record.specialistId || '') || null;
    const score = scoreArabicSearchMatch(intent.query || '', record.title, [...search, specialistName]);
    return score ? [{ record: { ...record, specialistName }, score }] : [];
  }).sort((a, b) => b.score - a.score || (a.record.date || '9999').localeCompare(b.record.date || '9999'));

  const records = matches.slice(0, 12).map(({ record }) => record);
  const period = intent.start || intent.end
    ? ` • الفترة: ${intent.start || 'البداية'} إلى ${intent.end || 'دون نهاية محددة'}`
    : '';
  if (!matches.length) {
    return { message: share && ['vat3a', 'specialists', 'labels', 'shares'].includes(section)
      ? 'يمكنك فتح هذا القسم لمراجعة خيارات المشاركة المتاحة.'
      : `لم أجد سجلات مطابقة${period}.`, records };
  }
  const totals = new Map<string, number>();
  for (const { record } of matches) totals.set(record.status, (totals.get(record.status) || 0) + 1);
  const summary = Array.from(totals, ([status, count]) => `${status}: ${count}`).join('، ');
  return {
    message: share
      ? (intent.specialist && !person
        ? 'تعذّر تحديد المختص بالاسم. اختر السجل، ثم حدّد المستلم وراجع الرسالة.'
        : 'اختر السجل للمشاركة، ثم راجع المختص والرسالة قبل فتح واتساب أو البريد.')
      : `السجلات المطابقة: ${matches.length} (${summary})${period}.${matches.length > records.length ? ' أُظهرت أول 12 نتيجة؛ ضيّق البحث لعرض نتائج أخرى.' : ''}`,
    records,
    sharing: share ? { recipientId: intent.specialist ? person?.id ?? '' : undefined, channel: intent.channel } : undefined,
  };
}

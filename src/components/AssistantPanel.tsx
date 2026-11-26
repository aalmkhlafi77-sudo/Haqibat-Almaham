import { Bot, Mic, Send, Share2, Square, Volume2, X } from 'lucide-react';
import { useId, useRef, useState, type FormEvent } from 'react';
import { useApp } from '../context/AppContext';
import type { AssistantAnswer, AssistantDraft, AssistantHandoff, AssistantMode, AssistantRecord } from '../domain/assistant';
import { formatDateTime, formatDisplayDate } from '../domain/dateUtils';
import { getContrastTextColor, PRESET_LABEL_COLORS } from '../domain/shareUtils';
import { useAssistantVoice } from './useAssistantVoice';

const actions = [
  { mode: 'auto', label: 'اسأل المساعد', hint: 'ما المهام المتأخرة ومن المختص بها؟', submit: 'إرسال الطلب' },
  { mode: 'create_task', label: 'إضافة مهمة', hint: 'متابعة تجديد الرخصة غدًا لدى البلدية، وإسنادها إلى اسم المختص', submit: 'تجهيز المهمة' },
  { mode: 'create_event', label: 'إضافة حدث', hint: 'اجتماع مراجعة العقود يوم الأحد الساعة 11 صباحًا', submit: 'تجهيز الحدث' },
  { mode: 'create_reminder', label: 'إضافة تذكير', hint: 'مراجعة الرخصة غدًا الساعة 10 صباحًا', submit: 'تجهيز التذكير' },
  { mode: 'share', label: 'مشاركة مع مختص', hint: 'شارك مهمة تجديد الرخصة مع اسم المختص عبر البريد', submit: 'البحث عن السجل للمشاركة' },
  { mode: 'create_document', label: 'إضافة وثيقة أو ترخيص', hint: 'رخصة التشغيل، الجهة المصدرة البلدية، انتهاء 2027-12-31', submit: 'تجهيز الوثيقة' },
  { mode: 'create_renewal', label: 'تسجيل تجديد وثيقة', hint: 'تجديد الوثيقة رقم 123 حتى 2028-12-31', submit: 'تجهيز التجديد' },
  { mode: 'create_case', label: 'إضافة قضية', hint: 'قضية مطالبة مالية رقم 123', submit: 'تجهيز القضية' },
  { mode: 'create_session', label: 'إضافة جلسة', hint: 'جلسة أولى للقضية رقم 123 غدًا الساعة 10 صباحًا', submit: 'تجهيز الجلسة' },
  { mode: 'create_poa', label: 'إضافة وكالة أو تفويض', hint: 'وكالة مراجعة المعاملات رقم 123 صادرة بتاريخ 2026-11-26', submit: 'تجهيز الوكالة' },
  { mode: 'create_specialist', label: 'إضافة مختص', hint: 'اسم المختص ورقم جواله وبريده الإلكتروني', submit: 'تجهيز المختص' },
  { mode: 'create_vat', label: 'إنشاء مسودة ضريبة 3A', hint: 'مسودة لشركة الأفق من 2026-10-01 إلى 2026-12-31', submit: 'تجهيز مسودة 3A' },
  { mode: 'create_report', label: 'إعداد تقرير', hint: 'تقرير العمليات من 2026-11-01 إلى 2026-11-30', submit: 'تجهيز التقرير' },
  { mode: 'create_label', label: 'إضافة ملصق', hint: 'ملصق لشاشة اليوم بنص متابعة التجديدات', submit: 'تجهيز الملصق' },
] as const;

export function AssistantPanel() {
  const { db, hasPerm, openRecord, openShareModal, setActiveNav, setAssistantHandoff,
    saveLabel, showToast, closeRecord,
  } = useApp();
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [mode, setMode] = useState<AssistantMode>('auto');
  const action = actions.find((item) => item.mode === mode) ?? actions[0];
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<Array<{ question: string; message: string }>>([]);
  const [followUp, setFollowUp] = useState<AssistantMode | null>(null);
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const voice = useAssistantVoice((text) => {
    setQuestion((previous) => [previous.trimEnd(), text].filter(Boolean).join(' ').slice(0, 600));
  });

  async function ask(text: string) {
    if (pending || voice.listening || text.trim().length < 2) return;
    voice.resetVoice();
    setQuestion(text);
    setPending(true);
    setError('');
    setAnswer(null);
    try {
      const response = await fetch('/api/ai/ask', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ question: text, mode: followUp ?? mode, history: history.slice(-6).map((turn) => turn.question) }),
        signal: AbortSignal.timeout(25_000),
      });
      const result = await response.json() as AssistantAnswer & { error?: string };
      if (!response.ok || !Array.isArray(result.records)) {
        setError(result.error || 'تعذّرت الإجابة عن الطلب.');
        return;
      }
      setAnswer(result);
      setHistory((previous) => [...previous.slice(-6), { question: text, message: result.message }]);
      setFollowUp(result.clarification ?? null);
      setQuestion('');
    } catch {
      setError('تعذّر الاتصال بالمساعد. حاول مرة أخرى.');
    } finally {
      setPending(false);
    }
  }

  function closeAssistant() {
    voice.resetVoice();
    dialog.current?.close();
  }

  function openView(target: AssistantHandoff) {
    closeAssistant();
    closeRecord();
    setAssistantHandoff(target.kind === 'today' ? null : target);
    if (target.kind === 'today') setActiveNav('today');
    else if (target.kind === 'report') setActiveNav('reports');
    else if (target.kind === 'specialist') setActiveNav('specialists');
    else setActiveNav('vat3a');
  }

  function openDraft(draft: AssistantDraft) {
    setAnswer(null);
    if (draft.type === 'view') {
      openView(draft.target);
      return;
    }
    closeAssistant();
    if (draft.type === 'record') {
      openRecord(draft.recordType, draft.id || null, draft.prefill);
      return;
    }
    const bgColor = PRESET_LABEL_COLORS[0].bg;
    saveLabel({ targetType: draft.targetType, targetId: draft.targetId, text: draft.title,
      bgColor, textColor: getContrastTextColor(bgColor) });
    showToast('تم حفظ الملصق.');
    if (draft.targetType === 'today') openView({ kind: 'today' });
    else if (draft.targetId) openRecord(draft.targetType, draft.targetId);
  }

  function openResult(record: AssistantRecord) {
    if (record.type === 'vat3a') return openView({ kind: 'vat_saved', id: record.id });
    if (record.type === 'specialist') return openView({ kind: 'specialist', id: record.id });
    if (record.type === 'share_log') return openView({ kind: 'specialist', id: record.specialistId ?? undefined });
    if (record.type === 'label') {
      const label = db.labels.find((item) => item.id === record.id);
      if (!label || label.targetType === 'today') return openView({ kind: 'today' });
      closeAssistant();
      if (label.targetId) openRecord(label.targetType, label.targetId);
      return;
    }
    closeAssistant();
    openRecord(record.type, record.id);
  }

  const displayDate = (date: string | null) => date?.includes('T')
    ? formatDateTime(date, db.preferences.showHijri)
    : formatDisplayDate(date, db.preferences.showHijri);

  function shareRecord(record: AssistantRecord) {
    if (record.type === 'vat3a' || record.type === 'specialist' || record.type === 'share_log' || record.type === 'label') return;
    closeAssistant();
    const date = record.date ? `\nالموعد: ${displayDate(record.date)}` : '';
    openShareModal({
      recordType: record.type,
      recordId: record.id,
      recordTitle: record.title,
      specialistId: answer?.sharing?.recipientId ?? record.specialistId,
      channel: answer?.sharing?.channel,
      scheduledInfo: record.date || 'بلا تاريخ',
      defaultMessage: `السلام عليكم، نرجو متابعة السجل «${record.title}».${date}`,
    });
  }

  function chooseMode(next: AssistantMode) {
    voice.resetVoice();
    setMode(next);
    setFollowUp(null);
    setHistory([]);
    setAnswer(null);
    setError('');
    dialog.current?.querySelector('textarea')?.focus();
  }

  function readAnswer(result: AssistantAnswer) {
    const lines = [result.message];
    if (result.draft) lines.push(result.draft.title);
    for (const record of result.records) {
      lines.push([record.title, record.date && displayDate(record.date), record.specialistName, record.detail].filter(Boolean).join('، '));
    }
    voice.togglePlayback(lines.join('. '));
  }

  const visibleAction = (mode: AssistantMode) => {
    if (mode === 'create_vat') return hasPerm('vat3a:edit');
    if (mode === 'create_report') return hasPerm('reports:view');
    return !mode.startsWith('create_') || hasPerm('records:write');
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(question);
  }

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label="المساعد الذكي"
        onClick={() => dialog.current?.showModal()}
        className="h-10 shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-violet-200 px-2.5 text-violet-700 hover:bg-violet-50 focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-violet-500/40 dark:text-violet-200 dark:hover:bg-violet-500/15"
      >
        <Bot className="h-4 w-4" aria-hidden="true" />
        <span className="hidden text-xs font-semibold xl:inline">المساعد الذكي</span>
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={headingId}
        dir="rtl"
        onCancel={voice.resetVoice}
        onClose={voice.resetVoice}
        className="m-auto max-h-[85dvh] w-[min(40rem,calc(100%_-_1.5rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/60 dark:border-white/15 dark:bg-[#14161b] dark:text-slate-100"
      >
        <div className="space-y-4 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id={headingId} className="text-lg font-bold">المساعد الذكي</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                اسأل عن أقسام العمل أو اطلب تجهيز سجل أو تقرير أو مشاركة. تُرسل رسائلك في هذه المحادثة إلى Gemini لفهم الطلب.
              </p>
            </div>
            <button type="button" aria-label="إغلاق المساعد" className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-white/10" onClick={closeAssistant}><X size={18} /></button>
          </div>

          <div role="group" aria-label="إجراءات المساعد" className="flex flex-wrap gap-2">
            {actions.slice(0, 5).filter(({ mode }) => visibleAction(mode)).map(({ mode: item, label }) => (
              <button key={item} type="button" aria-pressed={mode === item} disabled={pending || voice.listening}
                onClick={() => chooseMode(item)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${mode === item
                  ? 'border-violet-600 bg-violet-100 text-violet-950 dark:border-violet-400 dark:bg-violet-500/20 dark:text-violet-100'
                  : 'border-slate-200 hover:bg-violet-50 dark:border-white/15 dark:hover:bg-violet-500/15'}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select aria-label="إجراءات إضافية" disabled={pending || voice.listening}
              value={actions.slice(5).some((item) => item.mode === mode) ? mode : ''}
              onChange={(event) => chooseMode((event.target.value || 'auto') as AssistantMode)}
              className="min-w-0 rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-xs dark:border-white/20 dark:bg-[#14161b]">
              <option value="">المزيد من الإجراءات</option>
              {actions.slice(5).filter(({ mode }) => visibleAction(mode)).map(({ mode, label }) => (
                <option key={mode} value={mode}>{label}</option>
              ))}
            </select>
            {history.length > 0 && (
              <button type="button" disabled={pending || voice.listening} onClick={() => { chooseMode('auto'); setQuestion(''); }}
                className="text-xs font-semibold text-violet-700 underline-offset-4 hover:underline dark:text-violet-200">
                بدء محادثة جديدة
              </button>
            )}
          </div>

          {history.length > 0 && (
            <ol aria-label="سياق المحادثة" className="max-h-36 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3 text-xs dark:bg-white/5">
              {history.map((turn, index) => (
                <li key={index} className="space-y-1 break-words">
                  <p className="font-semibold">{turn.question}</p>
                  {(index !== history.length - 1 || !answer) && <p>{turn.message}</p>}
                </li>
              ))}
            </ol>
          )}

          <form className="space-y-2" onSubmit={submit}>
            <label className="block text-sm font-semibold" htmlFor={`${headingId}-question`}>{followUp ? 'استكمل المعلومات المطلوبة' : 'طلبك'}</label>
            <textarea id={`${headingId}-question`} value={question} onChange={(event) => setQuestion(event.target.value)}
              rows={3} maxLength={600} disabled={pending}
              className="w-full resize-y rounded-xl border border-slate-300 bg-transparent p-3 text-sm focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-white/20"
              placeholder={`مثال: ${action.hint}`} />
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={pending || voice.listening || question.trim().length < 2}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50">
                <Send size={15} aria-hidden="true" /> {followUp ? 'إرسال التوضيح' : action.submit}
              </button>
              <button type="button" aria-pressed={voice.listening} aria-describedby={`${headingId}-dictation`}
                disabled={pending || !voice.dictationAvailable} onClick={voice.toggleDictation}
                className="inline-flex items-center gap-2 rounded-xl border border-violet-300 px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50 dark:border-violet-400/50 dark:text-violet-200 dark:hover:bg-violet-500/15">
                {voice.listening ? <Square size={15} aria-hidden="true" /> : <Mic size={15} aria-hidden="true" />}
                {voice.listening ? 'إيقاف الإملاء' : 'إملاء صوتي'}
              </button>
            </div>
            <p id={`${headingId}-dictation`} className="text-xs text-slate-600 dark:text-slate-300">
              {voice.dictationAvailable
                ? 'يحوّل المتصفح كلامك إلى نص قابل للتعديل، وقد تستخدم خدمة الإملاء اتصالًا بالإنترنت.'
                : 'الإملاء الصوتي غير متاح في هذا المتصفح. الكتابة متاحة.'}
            </p>
          </form>

          {voice.listening && <p role="status" className="text-sm">الميكروفون يعمل… تحدّث الآن.</p>}
          {voice.voiceMessage && <p role="status" className="text-sm text-slate-700 dark:text-slate-300">{voice.voiceMessage}</p>}
          {pending && <p role="status" className="text-sm">جارٍ معالجة الطلب…</p>}
          {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
          {answer && (
            <section aria-live="polite" className="space-y-3 border-t border-slate-200 pt-4 dark:border-white/15">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm leading-relaxed">{answer.message}</p>
                {voice.playbackAvailable && (
                  <button type="button" aria-pressed={voice.speaking} disabled={voice.listening} onClick={() => readAnswer(answer)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-violet-50 disabled:opacity-50 dark:border-white/15 dark:hover:bg-violet-500/15">
                    {voice.speaking ? <Square size={15} aria-hidden="true" /> : <Volume2 size={15} aria-hidden="true" />}
                    {voice.speaking ? 'إيقاف القراءة' : 'استمع إلى الرد'}
                  </button>
                )}
              </div>
              {answer.draft && (
                <div className="space-y-2 rounded-xl border border-violet-200 bg-violet-50 p-3 dark:border-violet-500/30 dark:bg-violet-500/10">
                  <p className="break-words text-sm font-semibold">{answer.draft.title}</p>
                  <button type="button" onClick={() => { if (answer.draft) openDraft(answer.draft); }}
                    className="rounded-lg bg-violet-700 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-800">
                    {answer.draft.type === 'label' ? 'حفظ الملصق' :
                      answer.draft.type === 'view' && answer.draft.target.kind === 'report' ? 'فتح التقرير للمراجعة' : 'فتح النموذج للحفظ'}
                  </button>
                </div>
              )}
              {answer.records.length > 0 && (
                <ul className="space-y-2">
                  {answer.records.map((record) => (
                    <li key={`${record.type}:${record.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                      <div className="min-w-0 break-words">
                        <button type="button" className="text-start text-sm font-semibold text-violet-700 underline-offset-4 hover:underline dark:text-violet-200"
                          onClick={() => openResult(record)}>
                          {record.title}
                        </button>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                          {[record.status, record.date && displayDate(record.date), record.specialistName].filter(Boolean).join(' · ')}
                        </p>
                        {record.detail && <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{record.detail}</p>}
                      </div>
                      {['task', 'document', 'session', 'calendar_item', 'case', 'poa'].includes(record.type) && <button type="button" onClick={() => shareRecord(record)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs hover:bg-white dark:border-white/15 dark:hover:bg-white/10">
                        <Share2 size={14} aria-hidden="true" /> مشاركة
                      </button>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </dialog>
    </>
  );
}

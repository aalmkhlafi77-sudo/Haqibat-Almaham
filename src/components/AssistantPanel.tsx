import { Bot, Send, Share2, X } from 'lucide-react';
import { useId, useRef, useState, type FormEvent } from 'react';
import { useApp } from '../context/AppContext';
import type { AssistantAnswer, AssistantDraft, AssistantRecord } from '../domain/assistant';
import { formatDateTime, formatDisplayDate } from '../domain/dateUtils';

const examples = [
  'ما الوثائق التي ستنتهي خلال 15 يومًا؟',
  'ما المهام المتأخرة ومن المختص بها؟',
  'لخّص مواعيد هذا الأسبوع',
];

export function AssistantPanel() {
  const { db, openRecord, openShareModal } = useApp();
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function ask(text: string) {
    if (pending || text.trim().length < 2) return;
    setQuestion(text);
    setPending(true);
    setError('');
    setAnswer(null);
    try {
      const response = await fetch('/api/ai/ask', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ question: text }),
        signal: AbortSignal.timeout(25_000),
      });
      const result = await response.json() as AssistantAnswer & { error?: string };
      if (!response.ok || !Array.isArray(result.records)) {
        setError(result.error || 'تعذّرت الإجابة عن الطلب.');
        return;
      }
      setAnswer(result);
    } catch {
      setError('تعذّر الاتصال بالمساعد. حاول مرة أخرى.');
    } finally {
      setPending(false);
    }
  }

  function openDraft(draft: AssistantDraft) {
    dialog.current?.close();
    const prefill = { title: draft.title, specialistId: draft.specialistId || null, notes: draft.notes };
    if (draft.type === 'task') {
      openRecord('task', null, {
        ...prefill, dueDate: draft.date || '', typeId: draft.taskTypeId, authorityName: draft.authority,
      });
    } else {
      openRecord('calendar_item', null, {
        ...prefill,
        kind: draft.kind,
        scheduledAt: draft.date ? `${draft.date}T${draft.time || '00:00'}` : '',
        isAllDay: Boolean(draft.date && !draft.time),
      });
    }
  }

  const displayDate = (date: string | null) => date?.includes('T')
    ? formatDateTime(date, db.preferences.showHijri)
    : formatDisplayDate(date, db.preferences.showHijri);

  function shareRecord(record: AssistantRecord) {
    dialog.current?.close();
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
        className="m-auto max-h-[85dvh] w-[min(40rem,calc(100%_-_1.5rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/60 dark:border-white/15 dark:bg-[#14161b] dark:text-slate-100"
      >
        <div className="space-y-4 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id={headingId} className="text-lg font-bold">المساعد الذكي</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                اسأل عن السجلات أو اطلب تجهيز مهمة أو موعد أو مشاركة. يُرسل نص طلبك إلى Gemini.
              </p>
            </div>
            <button type="button" aria-label="إغلاق المساعد" className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-white/10" onClick={() => dialog.current?.close()}><X size={18} /></button>
          </div>

          <div className="flex flex-wrap gap-2">
            {examples.map((example) => (
              <button key={example} type="button" disabled={pending} onClick={() => void ask(example)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs hover:bg-violet-50 disabled:opacity-50 dark:border-white/15 dark:hover:bg-violet-500/15">
                {example}
              </button>
            ))}
          </div>

          <form className="space-y-2" onSubmit={submit}>
            <label className="block text-sm font-semibold" htmlFor={`${headingId}-question`}>طلبك</label>
            <textarea id={`${headingId}-question`} value={question} onChange={(event) => setQuestion(event.target.value)}
              rows={3} maxLength={600} disabled={pending}
              className="w-full resize-y rounded-xl border border-slate-300 bg-transparent p-3 text-sm focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-white/20"
              placeholder="مثال: جهّز تذكيرًا لمراجعة الرخصة غدًا الساعة 10 صباحًا" />
            <button type="submit" disabled={pending || question.trim().length < 2}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50">
              <Send size={15} aria-hidden="true" /> إرسال الطلب
            </button>
          </form>

          {pending && <p role="status" className="text-sm">جارٍ معالجة الطلب…</p>}
          {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
          {answer && (
            <section aria-live="polite" className="space-y-3 border-t border-slate-200 pt-4 dark:border-white/15">
              <p className="text-sm leading-relaxed">{answer.message}</p>
              {answer.draft && (
                <button type="button" onClick={() => { if (answer.draft) openDraft(answer.draft); }}
                  className="rounded-lg border border-violet-300 px-3 py-2 text-sm font-semibold text-violet-700 dark:text-violet-200">
                  مراجعة المسودة
                </button>
              )}
              {answer.records.length > 0 && (
                <ul className="space-y-2">
                  {answer.records.map((record) => (
                    <li key={`${record.type}:${record.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                      <div className="min-w-0 break-words">
                        <button type="button" className="text-start text-sm font-semibold text-violet-700 underline-offset-4 hover:underline dark:text-violet-200"
                          onClick={() => { dialog.current?.close(); openRecord(record.type, record.id); }}>
                          {record.title}
                        </button>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                          {record.status} · {displayDate(record.date)} · {record.specialistName || 'غير مسند'}
                        </p>
                      </div>
                      <button type="button" onClick={() => shareRecord(record)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs hover:bg-white dark:border-white/15 dark:hover:bg-white/10">
                        <Share2 size={14} aria-hidden="true" /> مشاركة
                      </button>
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

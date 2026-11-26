import { useState } from 'react';
import { matchesImportDocument, type ImportDocumentRow, type ImportDraft } from '../domain/assistantImport';
import type { AppDatabaseState } from '../types/domain';

const fieldClass = 'min-w-0 w-full rounded-lg border border-slate-300 bg-transparent px-2 py-1.5 text-sm dark:border-white/20';
type Choice = 'create' | 'update' | 'skip';
type ApprovedRow = ImportDocumentRow & { updateId: string | null };
type Props = {
  draft: ImportDraft;
  db: AppDatabaseState;
  pending: boolean;
  onApprove: (rows: ApprovedRow[], reminderDays: number | null) => void;
};

export function AssistantImportReview({ draft, db, pending, onApprove }: Props) {
  const findMatches = (row: ImportDocumentRow) => db.documents.filter((document) => matchesImportDocument(row, document));
  const [rows, setRows] = useState(() => draft.rows.map((row) => ({
    ...row, choice: (findMatches(row).length ? 'skip' : 'create') as Choice,
  })));
  const [reminderDays, setReminderDays] = useState(draft.reminderDays?.toString() ?? '');

  function changeRow(index: number, patch: Partial<(typeof rows)[number]>) {
    setRows((previous) => previous.map((row, i) => {
      if (i !== index) return row;
      const next = { ...row, ...patch };
      if (findMatches(next)[0]?.id !== findMatches(row)[0]?.id) next.choice = 'skip';
      return next;
    }));
  }

  const selected = rows.flatMap(({ choice, sourceDate, categoryHint, specialistHint, ...row }) => {
    if (choice === 'skip') return [];
    const existing = findMatches(row)[0];
    return [{ ...row, updateId: choice === 'update' ? existing?.id ?? null : null }];
  });
  const duplicate = selected.some((row, i) => selected.slice(0, i).some((other) => matchesImportDocument(row, other)));
  const invalid = rows.some((row) => {
    if (row.choice === 'skip') return false;
    const matches = findMatches(row);
    return !row.name.trim() || !row.referenceNumber.trim() || !row.expiryDate ||
      row.expiryDate < '1900-01-01' || (row.choice === 'create' ? matches.length !== 0 :
        matches.length !== 1 || Boolean(matches[0].archivedAt) || (matches[0].issueDate || '') > row.expiryDate);
  });
  const days = reminderDays === '' ? null : Number(reminderDays);
  const invalidDays = days !== null && (!Number.isInteger(days) || days < 1 || days > 365);

  return (
    <section aria-label="معاينة الاستيراد" className="space-y-3 border-t border-slate-200 pt-4 dark:border-white/15">
      <p role="status" className="text-sm">{draft.message}</p>
      {rows.length > 0 && <>
        <h3 className="text-sm font-bold">معاينة الوثائق ({rows.length})</h3>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          راجع البيانات المستخرجة. يصحّح التحديث تاريخ الانتهاء ويضيف جهة الإصدار أو المختص عند توفيرهما.
        </p>
        <ol className="max-h-[45dvh] space-y-2 overflow-y-auto p-0.5">
          {rows.map((row, index) => {
            const matches = findMatches(row);
            const canUpdate = matches.length === 1 && !matches[0].archivedAt;
            return (
              <li key={index}>
                <fieldset disabled={pending} className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-white/15">
                  <legend className="px-1 text-xs font-semibold">الوثيقة {index + 1}</legend>
                  <label className="block text-xs">اسم الوثيقة
                    <input className={fieldClass} maxLength={200} value={row.name} onChange={(event) => changeRow(index, { name: event.target.value })} />
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block text-xs">الرقم المرجعي أو اللوحة
                      <input className={fieldClass} maxLength={100} value={row.referenceNumber} onChange={(event) => changeRow(index, { referenceNumber: event.target.value })} />
                    </label>
                    <label className="block text-xs">تاريخ الانتهاء
                      <input type="date" dir="ltr" lang="en" min="1900-01-01" max="9999-12-31" className={fieldClass}
                        value={row.expiryDate} onChange={(event) => changeRow(index, { expiryDate: event.target.value })} />
                    </label>
                  </div>
                  {!row.expiryDate && <p className="text-xs text-amber-800 dark:text-amber-300">
                    {row.sourceDate ? <>حدّد التاريخ المقصود في الملف <bdi>{row.sourceDate}</bdi>.</> : 'أدخل تاريخ الانتهاء الناقص.'}
                  </p>}
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="block text-xs">التصنيف
                      <select className={fieldClass} value={row.categoryId ?? ''} onChange={(event) => changeRow(index, { categoryId: event.target.value || null })}>
                        <option value="">غير مصنفة</option>
                        {db.documentCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                      </select>
                    </label>
                    <label className="block text-xs">المختص
                      <select className={fieldClass} value={row.specialistId ?? ''} onChange={(event) => changeRow(index, { specialistId: event.target.value || null })}>
                        <option value="">بدون تعيين</option>
                        {db.specialists.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                      </select>
                    </label>
                    <label className="block text-xs">جهة الإصدار
                      <input className={fieldClass} maxLength={200} value={row.issuingAuthority}
                        onChange={(event) => changeRow(index, { issuingAuthority: event.target.value })} />
                    </label>
                  </div>
                  {!row.categoryId && row.categoryHint && <p className="text-xs">التصنيف المقترح من الملف «{row.categoryHint}».</p>}
                  {!row.specialistId && row.specialistHint && <p className="text-xs">المختص المذكور في الملف «{row.specialistHint}».</p>}
                  {matches.length > 0 && <p className="text-xs text-amber-800 dark:text-amber-300">
                    {canUpdate ? <>سجل مطابق «{matches[0].name}» · <bdi>{matches[0].expiryDate || 'بلا تاريخ'}</bdi></> :
                      'توجد سجلات مطابقة متعددة أو سجل مؤرشف. استبعد هذا الصف أو صحّح بيانات المطابقة.'}
                  </p>}
                  <label className="block text-xs">الإجراء
                    <select className={fieldClass} value={row.choice} onChange={(event) => changeRow(index, { choice: event.target.value as Choice })}>
                      <option value="skip">استبعاد</option>
                      <option value="create" disabled={matches.length > 0}>إنشاء سجل جديد</option>
                      <option value="update" disabled={!canUpdate}>تحديث السجل المطابق</option>
                    </select>
                  </label>
                </fieldset>
              </li>
            );
          })}
        </ol>
        <label className="block max-w-sm text-xs">تذكير قبل الانتهاء بعدد الأيام (اختياري)
          <input className={fieldClass} type="number" min={1} max={365} step={1} dir="ltr" value={reminderDays}
            disabled={pending} onChange={(event) => setReminderDays(event.target.value)} />
        </label>
        {days !== null && <p className="text-xs">يُضاف تذكير مرتبط بكل وثيقة إذا كان موعد التذكير اليوم أو في المستقبل.</p>}
        {duplicate && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">توجد سجلات مختارة مكررة. استبعد الصف المكرر.</p>}
        {invalid && <p className="text-xs text-rose-700 dark:text-rose-300">صحّح البيانات الناقصة أو استبعد الصفوف قبل الحفظ.</p>}
        <button type="button" disabled={pending || !selected.length || invalid || duplicate || invalidDays}
          onClick={() => onApprove(selected, days)}
          className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50">
          اعتماد وحفظ ({selected.length})
        </button>
      </>}
    </section>
  );
}

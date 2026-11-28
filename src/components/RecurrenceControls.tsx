import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import type { RecurrenceFrequency } from '../domain/recurrenceDates';
import type { TaskItem, CalendarItem } from '../types/domain';

export function RecurrenceControls({ kind, record }: { kind: 'task' | 'calendar_item'; record: TaskItem | CalendarItem }) {
  const { db, hasPerm, configureRecurrence, stopRecurrence, updateRecurrence, showToast } = useApp();
  const [editing, setEditing] = useState(false);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly');
  const [until, setUntil] = useState('');
  const [days, setDays] = useState(0);
  const series = db.recurrenceSeries.find(s => s.id === record.recurrenceSeriesId);
  const date = kind === 'task' ? (record as TaskItem).dueDate : (record as CalendarItem).scheduledAt.slice(0,10);
  const writable = hasPerm('records:write');
  const control = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white';
  return <section className="mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-700" aria-label="التكرار">
    <h3 className="font-bold">التكرار والتنبيه</h3>
    {series ? <>
      <p className="mt-2 text-sm">{series.active ? 'التكرار فعال' : 'التكرار متوقف'} · {({weekly:'كل أسبوع',fortnightly:'كل 15 يومًا',monthly:'كل شهر',yearly:'كل سنة'})[series.frequency]} · تنبيه قبل {series.reminderDays} يوم</p>
      <p className="text-xs">النهاية: <bdi>{series.until || 'دون تاريخ نهاية'}</bdi></p>
      {writable && series.active && (editing ? <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="text-xs">التكرار<select className={`${control} w-full`} value={frequency} onChange={e => setFrequency(e.target.value as RecurrenceFrequency)}><option value="weekly">كل أسبوع</option><option value="fortnightly">كل 15 يومًا</option><option value="monthly">كل شهر</option><option value="yearly">كل سنة</option></select></label>
        <label className="text-xs">نهاية التكرار<input type="date" lang="en" dir="ltr" className={`${control} w-full`} min={series.anchor} value={until} onChange={e => setUntil(e.target.value)} /></label>
        <label className="text-xs">تنبيه قبل الموعد بالأيام<input type="number" min={0} max={365} className={`${control} w-full`} value={days} onChange={e => setDays(Number(e.target.value))} /></label>
        <p className="text-xs sm:col-span-2">تطبق الإعدادات على المواعيد التي لم تُنشأ بعد؛ تبقى المواعيد الموجودة محفوظة.</p>
        <button type="button" className={control} onClick={() => { if (!Number.isInteger(days) || days < 0 || days > 365 || (until && until < series.anchor)) { showToast('تحقق من تاريخ النهاية وأيام التنبيه.'); return; } updateRecurrence(series.id, until || null, days, frequency); setEditing(false); showToast('تم تعديل إعدادات التكرار.'); }}>حفظ إعدادات التكرار</button>
        <button type="button" className={control} onClick={() => setEditing(false)}>إلغاء</button>
      </div> : <button type="button" className={`${control} mt-2`} onClick={() => { setUntil(series.until || ''); setDays(series.reminderDays); setFrequency(series.frequency); setEditing(true); }}>تعديل إعدادات التكرار</button>)}
      {writable && series.active && <button type="button" className={`${control} mt-2`} onClick={() => { if (window.confirm('إيقاف إنشاء المواعيد القادمة؟ ستبقى المواعيد التي أُنشئت بالفعل.')) { stopRecurrence(series.id); showToast('تم إيقاف التكرار.'); } }}>إيقاف التكرار</button>}
    </> : writable ? <>
      <p className="mt-1 text-xs">يبدأ التكرار من موعد السجل المحفوظ. تنشأ المواعيد القادمة على الخادم.</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <label className="text-xs">التكرار<select className={`${control} w-full`} value={frequency} onChange={e => setFrequency(e.target.value as RecurrenceFrequency)}><option value="weekly">كل أسبوع</option><option value="fortnightly">كل 15 يومًا</option><option value="monthly">كل شهر</option><option value="yearly">كل سنة</option></select></label>
        <label className="text-xs">النهاية اختيارية<input type="date" lang="en" dir="ltr" className={`${control} w-full`} min={date} value={until} onChange={e => setUntil(e.target.value)} /></label>
        <label className="text-xs">تنبيه قبل الموعد بالأيام<input type="number" min={0} max={365} className={`${control} w-full`} value={days} onChange={e => setDays(Number(e.target.value))} /></label>
      </div>
      <button type="button" className={`${control} mt-2`} onClick={() => { if (!Number.isInteger(days) || days < 0 || days > 365 || (until && until < date)) { showToast('تحقق من تاريخ النهاية وأيام التنبيه.'); return; } configureRecurrence(kind, record.id, frequency, until || null, days); showToast('تم إعداد التكرار.'); }}>تفعيل التكرار</button>
    </> : <p className="text-sm">لا يوجد تكرار لهذا السجل.</p>}
  </section>;
}

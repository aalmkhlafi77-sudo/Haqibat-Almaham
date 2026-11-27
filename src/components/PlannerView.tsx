import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { generateId } from '../data/repository';
import { addDaysISO, getTodayISO } from '../domain/dateUtils';
import { downloadReportExcel, downloadReportPdf, type ReportExportSnapshot } from '../domain/reportExport';
import type { IdeaItem, ProjectItem, TaskItem } from '../types/domain';

const control = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white';
const button = 'rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800';
const panel = 'rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900';
const localToday = () => getTodayISO();
function weekStart(day: string) {
  const weekday = new Date(`${day}T12:00:00`).getDay();
  return addDaysISO(day, -weekday);
}
function newProject(title = ''): ProjectItem {
  const now = new Date().toISOString();
  return { id: generateId('project'), title, status: 'مخطط', specialistId: null, dueDate: null,
    nextStep: '', notes: '', milestones: [], taskIds: [], documentIds: [], createdAt: now, updatedAt: now };
}
function newIdea(title: string): IdeaItem {
  const now = new Date().toISOString();
  return { id: generateId('idea'), title, category: '', notes: '', pinned: false, taskId: null, projectId: null, createdAt: now, updatedAt: now };
}

export function PlannerView() {
  const { db, hasPerm, saveTask, openRecord, saveProject, deleteProject, saveIdea, deleteIdea, workspaceSync, authMode, showToast } = useApp();
  const [tab, setTab] = useState<'week' | 'projects' | 'ideas' | 'report'>('week');
  const [start, setStart] = useState(() => weekStart(localToday()));
  const [specialist, setSpecialist] = useState('');
  const [taskType, setTaskType] = useState('');
  const [priority, setPriority] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [ideaText, setIdeaText] = useState('');
  const [ideaCategory, setIdeaCategory] = useState('');
  const [sourceIdeaId, setSourceIdeaId] = useState<string | undefined>();
  const [project, setProject] = useState<ProjectItem | null>(null);
  const [milestone, setMilestone] = useState('');
  const canWrite = hasPerm('records:write');
  const canDelete = hasPerm('records:delete');
  const end = addDaysISO(start, 6);
  const tasks = useMemo(() => db.tasks.filter(task =>
    !task.archivedAt && (!specialist || task.specialistId === specialist) &&
    (!taskType || task.typeId === taskType) && (!priority || task.priority === priority) &&
    (!status || task.status === status) && (!query || task.title.toLowerCase().includes(query.toLowerCase()))
  ), [db.tasks, specialist, taskType, priority, status, query]);

  function moveTask(task: TaskItem, date: string | null) {
    if (!canWrite || workspaceSync.error) return;
    saveTask({ ...task, plannedDate: date });
  }

  function saveCurrentProject(event: React.FormEvent) {
    event.preventDefault();
    if (!project || !project.title.trim()) return;
    saveProject({ ...project, title: project.title.trim(), updatedAt: new Date().toISOString() }, sourceIdeaId);
    setSourceIdeaId(undefined);
    setProject(null);
  }

  const changeProject = (partial: Partial<ProjectItem>) => setProject(old => old ? { ...old, ...partial } : old);
  const toggleLink = (field: 'taskIds' | 'documentIds', id: string) => {
    if (!project) return;
    const selected = project[field];
    changeProject({ [field]: selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id] });
  };
  const listForWeek = (week: string) => tasks.filter(t =>
    t.plannedDate && t.plannedDate >= week && t.plannedDate <= addDaysISO(week, 6));
  const weeks = Array.from({ length: 8 }, (_, index) => {
    const week = addDaysISO(start, -7 * (7 - index));
    const rows = listForWeek(week);
    const done = rows.filter(task => task.status === 'مكتملة').length;
    return { week, done, count: rows.length, percent: rows.length ? Math.round(done / rows.length * 100) : 0 };
  });

  async function exportWeekly(format: 'pdf' | 'excel' | 'share') {
    if (!hasPerm('reports:export')) return;
    const rows = weeks.flatMap(w => listForWeek(w.week));
    if (authMode === 'server') {
      try {
        const res = await fetch('/api/reports/export', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify({ format, rowCount: rows.length }) });
        if (!res.ok) throw new Error();
      } catch { showToast('تعذر التحقق من صلاحية تصدير التقرير.'); return; }
    }
    const done = rows.filter(t => t.status === 'مكتملة').length;
    const snapshot: ReportExportSnapshot = {
      generatedAt: new Date().toISOString(), showHijri: false,
      filters: { fromDate: weeks[0].week, toDate: end, specialistId: specialist || 'الكل', specialistName: db.specialists.find(s => s.id === specialist)?.name || 'الكل', departmentName: 'الكل', operationType: taskType ? db.taskTypes.find(t => t.id === taskType)?.name || 'الكل' : 'الكل', statusFilter: status || 'الكل' },
      summary: { totalCount: rows.length, doneCount: done, urgentCount: rows.filter(t => t.priority === 'عاجلة').length, activeRemainingCount: rows.length - done },
      barMode: 'month', statusSlices: [], barItems: weeks.map(w => ({ label: w.week, count: w.done })),
      rows: rows.map(t => ({ id: t.id, recordType: 'task', title: t.title, operationType: t.type, statusLabel: t.status, dateISO: t.plannedDate || '', specialistId: t.specialistId, specialistName: db.specialists.find(s => s.id === t.specialistId)?.name || 'غير مسند', departmentName: t.departmentName, isDone: t.status === 'مكتملة', isUrgentOrOverdue: t.priority === 'عاجلة' }))
    };
    try {
      if (format === 'pdf') await downloadReportPdf(snapshot);
      else if (format === 'excel') downloadReportExcel(snapshot);
      else {
        const text = `الإنجاز الأسبوعي (${weeks[0].week} — ${end})\n` + weeks.map(w => `${w.week}: ${w.done}/${w.count} (${w.percent}%)`).join('\n');
        if (navigator.share) await navigator.share({ title: 'الإنجاز الأسبوعي', text });
        else { await navigator.clipboard.writeText(text); showToast('تم نسخ ملخص التقرير للمشاركة.'); }
      }
    } catch { showToast('تعذر تصدير التقرير أو مشاركته.'); }
  }

  return <div className="space-y-5" dir="rtl">
    <header className={panel}>
      <h1 className="text-xl font-bold">المخطط والمشاريع</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">خطط لأيام العمل وتابع المشاريع والأفكار والإنجاز.</p>
      <nav aria-label="أقسام المخطط" className="mt-4 flex flex-wrap gap-2">
        {([['week', 'الأسبوع'], ['projects', 'المشاريع'], ['ideas', 'الأفكار'], ...(hasPerm('reports:view') ? [['report', 'الإنجاز الأسبوعي']] as const : [])] as const).map(([id, label]) =>
          <button key={id} type="button" aria-pressed={tab === id} className={`${button} ${tab === id ? 'bg-blue-700 text-white hover:bg-blue-800' : ''}`} onClick={() => setTab(id)}>{label}</button>)}
      </nav>
    </header>

    {(tab === 'week' || tab === 'report') && <div className={`${panel} flex flex-wrap items-center gap-2`}>
      <button type="button" className={button} onClick={() => setStart(addDaysISO(start, -7))}>الأسبوع السابق</button>
      <bdi className="font-semibold">{start} — {end}</bdi>
      <button type="button" className={button} onClick={() => setStart(addDaysISO(start, 7))}>الأسبوع التالي</button>
      <button type="button" className={button} onClick={() => setStart(weekStart(localToday()))}>هذا الأسبوع</button>
    </div>}

    {(tab === 'week' || tab === 'report') && <div className={`${panel} grid gap-2 sm:grid-cols-2 xl:grid-cols-5`}>
        <input aria-label="بحث في المهام" className={control} placeholder="بحث في المهام" value={query} onChange={e => setQuery(e.target.value)} />
        <select aria-label="المختص" className={control} value={specialist} onChange={e => setSpecialist(e.target.value)}>
          <option value="">كل المختصين</option>{db.specialists.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
        </select>
        <select aria-label="نوع المهمة" className={control} value={taskType} onChange={e => setTaskType(e.target.value)}>
          <option value="">كل الأنواع</option>{db.taskTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
        </select>
        <select aria-label="الأولوية" className={control} value={priority} onChange={e => setPriority(e.target.value)}>
          <option value="">كل الأولويات</option>{['عاجلة', 'مرتفعة', 'متوسطة', 'منخفضة'].map(x => <option key={x}>{x}</option>)}
        </select>
        <select aria-label="الحالة" className={control} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">كل الحالات</option>{['جديدة', 'قيد التنفيذ', 'معلقة', 'مكتملة', 'ملغاة'].map(x => <option key={x}>{x}</option>)}
        </select>
      </div>}
    {tab === 'week' && <>
      <section className={panel} aria-label="صندوق المهام غير المخططة">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">صندوق المهام غير المخططة</h2>
          {canWrite && <button type="button" className={button} onClick={() => openRecord('task', null)}>إضافة مهمة</button>}</div>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">اختر يوم العمل للمهمة. يبقى موعد الاستحقاق مستقلاً.</p>
        <TaskList tasks={tasks.filter(t => !t.plannedDate)} start={start} canWrite={canWrite} openRecord={openRecord} move={moveTask} />
      </section>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 7 }, (_, index) => {
          const day = addDaysISO(start, index);
          const list = tasks.filter(t => t.plannedDate === day);
          return <section key={day} className={panel} onDragOver={e => { if (canWrite) e.preventDefault(); }}
            onDrop={e => { e.preventDefault(); const task = tasks.find(t => t.id === e.dataTransfer.getData('text/plain')); if (task) moveTask(task, day); }}>
            <h3 className="font-bold">{new Intl.DateTimeFormat('ar-SA-u-nu-latn', { weekday: 'long' }).format(new Date(`${day}T12:00:00`))} <bdi>{day}</bdi></h3>
            <TaskList tasks={list} start={start} canWrite={canWrite} openRecord={openRecord} move={moveTask} />
            {canWrite && <button type="button" className={`${button} mt-3`} onClick={() => openRecord('task', null, { plannedDate: day })}>إضافة مهمة</button>}
          </section>;
        })}
      </div>
    </>}

    {tab === 'projects' && <section className={panel}>
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">المشاريع</h2>
        {canWrite && <button type="button" className={button} onClick={() => { setSourceIdeaId(undefined); setProject(newProject()); }}>إضافة مشروع</button>}</div>
      {project && <form onSubmit={saveCurrentProject} className="mt-4 space-y-3 rounded-xl border p-4 dark:border-slate-700">
        <h3 className="font-semibold">بيانات المشروع</h3>
        <label className="block text-sm">اسم المشروع<input required maxLength={200} className={control} value={project.title} onChange={e => changeProject({ title: e.target.value })} /></label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">الحالة<select className={control} value={project.status} onChange={e => changeProject({ status: e.target.value as ProjectItem['status'] })}>
            {['مخطط', 'قيد التنفيذ', 'معلق', 'مكتمل'].map(x => <option key={x}>{x}</option>)}</select></label>
          <label className="text-sm">المختص<select className={control} value={project.specialistId || ''} onChange={e => changeProject({ specialistId: e.target.value || null })}>
            <option value="">غير مسند</option>{db.specialists.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label className="text-sm">الموعد النهائي<input type="date" lang="en" dir="ltr" className={control} value={project.dueDate || ''} onChange={e => changeProject({ dueDate: e.target.value || null })} /></label>
        </div>
        <label className="block text-sm">الخطوة التالية<input maxLength={1000} className={control} value={project.nextStep} onChange={e => changeProject({ nextStep: e.target.value })} /></label>
        <label className="block text-sm">ملاحظات<textarea maxLength={5000} className={control} value={project.notes} onChange={e => changeProject({ notes: e.target.value })} /></label>
        <div><h4 className="text-sm font-semibold">المراحل</h4>
          {project.milestones.map(m => <div key={m.id} className="mt-2 flex items-center gap-2">
            <input type="checkbox" aria-label={`إنجاز ${m.title}`} checked={m.done} onChange={e => changeProject({ milestones: project.milestones.map(x => x.id === m.id ? { ...x, done: e.target.checked } : x) })} />
            <span className="flex-1">{m.title}</span><button type="button" className={button} onClick={() => changeProject({ milestones: project.milestones.filter(x => x.id !== m.id) })}>حذف المرحلة</button>
          </div>)}
          <div className="mt-2 flex gap-2"><input aria-label="اسم المرحلة" className={control} maxLength={200} value={milestone} onChange={e => setMilestone(e.target.value)} />
            <button type="button" className={button} onClick={() => { if (!milestone.trim()) return; changeProject({ milestones: [...project.milestones, { id: generateId('milestone'), title: milestone.trim(), done: false }] }); setMilestone(''); }}>إضافة</button></div>
        </div>
        <details><summary className="cursor-pointer text-sm font-semibold">ربط المهام والوثائق</summary>
          <div className="grid gap-3 sm:grid-cols-2"><fieldset><legend>المهام</legend>{db.tasks.filter(t => !t.archivedAt).map(t => <label key={t.id} className="block text-sm"><input type="checkbox" checked={project.taskIds.includes(t.id)} onChange={() => toggleLink('taskIds', t.id)} /> {t.title}</label>)}</fieldset>
          <fieldset><legend>الوثائق</legend>{db.documents.filter(d => !d.archivedAt).map(d => <label key={d.id} className="block text-sm"><input type="checkbox" checked={project.documentIds.includes(d.id)} onChange={() => toggleLink('documentIds', d.id)} /> {d.name}</label>)}</fieldset></div>
        </details>
        <div className="flex gap-2"><button className={button} type="submit">حفظ المشروع</button><button className={button} type="button" onClick={() => setProject(null)}>إلغاء</button></div>
      </form>}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {db.projects.map(item => {
          const done = item.milestones.filter(m => m.done).length;
          const progress = item.milestones.length ? Math.round(done / item.milestones.length * 100) : 0;
          return <article key={item.id} className="rounded-lg border p-3 dark:border-slate-700">
            <h3 className="font-bold">{item.title}</h3><p className="mt-1 text-sm">{item.status} · {progress}% ({done}/{item.milestones.length})</p>
            <p className="text-sm">الموعد: <bdi>{item.dueDate || 'غير محدد'}</bdi> · المختص: {db.specialists.find(s => s.id === item.specialistId)?.name || 'غير مسند'}</p>
            {item.nextStep && <p className="mt-1 text-sm">الخطوة التالية: {item.nextStep}</p>}
            <p className="mt-1 text-xs">المهام المرتبطة: {item.taskIds.length} · الوثائق المرتبطة: {item.documentIds.length}</p>
            <div className="mt-3 flex gap-2">{canWrite && <button className={button} onClick={() => { setSourceIdeaId(undefined); setProject(item); }}>تعديل</button>}
              {canDelete && <button className={button} onClick={() => { if (window.confirm('حذف المشروع؟')) deleteProject(item.id); }}>حذف</button>}</div>
          </article>;
        })}
        {!db.projects.length && <p className="text-sm">لا توجد مشاريع بعد.</p>}
      </div>
    </section>}

    {tab === 'ideas' && <section className={panel}>
      <h2 className="font-bold">بنك الأفكار</h2>
      {canWrite && <form className="mt-3 space-y-2" onSubmit={e => { e.preventDefault(); if (!ideaText.trim()) return; saveIdea({ ...newIdea(ideaText.trim()), category: ideaCategory.trim() }); setIdeaText(''); setIdeaCategory(''); }}>
        <label className="block text-sm">الفكرة<textarea required maxLength={1000} className={control} value={ideaText} onChange={e => setIdeaText(e.target.value)} /></label>
        <label className="block text-sm">التصنيف<input maxLength={200} className={control} value={ideaCategory} onChange={e => setIdeaCategory(e.target.value)} /></label>
        <button className={button} type="submit">إضافة فكرة</button>
      </form>}
      <label className="mt-4 block text-sm">البحث في الأفكار<input className={control} value={query} onChange={e => setQuery(e.target.value)} /></label>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {db.ideas.filter(i => !query || `${i.title} ${i.category} ${i.notes}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => Number(b.pinned) - Number(a.pinned)).map(idea =>
          <article key={idea.id} className="rounded-lg border p-3 dark:border-slate-700">
            <p className="whitespace-pre-wrap font-semibold">{idea.title}</p><p className="text-xs">{idea.category || 'غير مصنفة'}</p>
            {idea.taskId && <p className="text-xs">المهمة: {db.tasks.find(t => t.id === idea.taskId)?.title || 'غير متاحة'}</p>}
            {idea.projectId && <p className="text-xs">المشروع: {db.projects.find(p => p.id === idea.projectId)?.title || 'غير متاح'}</p>}
            <div className="mt-2 flex flex-wrap gap-2">{canWrite && <>
              <button className={button} onClick={() => saveIdea({ ...idea, pinned: !idea.pinned, updatedAt: new Date().toISOString() })}>{idea.pinned ? 'إلغاء التثبيت' : 'تثبيت'}</button>
              <button className={button} onClick={() => { const title = window.prompt('تعديل الفكرة', idea.title); if (title?.trim()) saveIdea({ ...idea, title: title.trim(), updatedAt: new Date().toISOString() }); }}>تعديل</button>
              <button className={button} disabled={!!idea.taskId} onClick={() => openRecord('task', null, { title: idea.title, notes: idea.notes, ideaId: idea.id })}>تجهيز مهمة</button>
              <button className={button} disabled={!!idea.projectId} onClick={() => { setSourceIdeaId(idea.id); setProject(newProject(idea.title)); setTab('projects'); }}>تجهيز مشروع</button>
            </>}
              {canDelete && <button className={button} onClick={() => { if (window.confirm('حذف الفكرة؟')) deleteIdea(idea.id); }}>حذف</button>}
            </div>
          </article>)}
      </div>
    </section>}

    {tab === 'report' && <section className={panel}>
      <h2 className="font-bold">إنجاز الأسابيع الثمانية</h2>
      {hasPerm('reports:export') && <div className="mt-3 flex flex-wrap gap-2"><button className={button} onClick={() => void exportWeekly('pdf')}>تنزيل PDF</button><button className={button} onClick={() => void exportWeekly('excel')}>تنزيل Excel</button><button className={button} onClick={() => void exportWeekly('share')}>مشاركة الملخص</button></div>}
      <p className="mt-1 text-sm">العدد ونسبة المهام المكتملة حسب يوم العمل المخطط في كل أسبوع.</p>
      <div className="mt-4 space-y-3">{weeks.map(w => <div key={w.week} className="grid grid-cols-[7rem_1fr_5rem] items-center gap-3 text-sm">
        <bdi>{w.week}</bdi><div className="h-4 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full bg-blue-600" style={{ width: `${w.percent}%` }} /></div>
        <span><bdi>{w.done}/{w.count}</bdi> · {w.percent}%</span>
      </div>)}</div>
    </section>}
  </div>;
}

function TaskList({ tasks, start, canWrite, openRecord, move }: {
  tasks: TaskItem[]; start: string; canWrite: boolean;
  openRecord: (type: 'task', id: string | null) => void;
  move: (task: TaskItem, day: string | null) => void;
}) {
  if (!tasks.length) return <p className="mt-3 text-sm text-slate-500">لا توجد مهام.</p>;
  return <ul className="mt-3 space-y-2">{tasks.map(task => <li key={task.id} draggable={canWrite}
    onDragStart={e => e.dataTransfer.setData('text/plain', task.id)}
    className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
    <button type="button" className="text-start font-semibold underline" onClick={() => openRecord('task', task.id)}>{task.title}</button>
    <p className="text-xs">{task.status} · {task.priority} · الاستحقاق <bdi>{task.dueDate}</bdi></p>
    {canWrite && <label className="mt-2 block text-xs">يوم العمل
      <select className={control} value={task.plannedDate || ''} onChange={e => move(task, e.target.value || null)}>
        <option value="">غير مخطط</option>
        {task.plannedDate && (task.plannedDate < start || task.plannedDate > addDaysISO(start, 6)) && <option value={task.plannedDate}>{task.plannedDate}</option>}
        {Array.from({ length: 7 }, (_, i) => addDaysISO(start, i)).map(day => <option key={day} value={day}>{day}</option>)}
      </select></label>}
  </li>)}</ul>;
}

import React, { useEffect, useState } from 'react';
import {
  Archive,
  CalendarPlus,
  History,
  Plus,
  RefreshCw,
  Save,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  evaluateDocumentHealth,
  evaluatePoaHealth,
  evaluateTaskDelay,
  formatDateTime,
  formatDisplayDate,
  getTodayISO,
} from '../domain/dateUtils';
import {
  resolveDocumentCategoryName,
  resolveTaskType,
  resolveTaskTypeName,
} from '../data/repository';
import {
  CalendarItem,
  CaseItem,
  CaseStatus,
  DocumentItem,
  PoaItem,
  RecordType,
  SessionItem,
  SessionStatus,
  TaskItem,
  TaskPriority,
  TaskStatus,
} from '../types/domain';
import { ArabicDatePicker } from './ArabicDatePicker';
import { LabelsSection, WorkspacePinnedLabels } from './LabelsSection';
import { StatusBadge } from './StatusBadge';

export const RecordDrawer: React.FC = () => {
  const {
    db,
    activeRecord,
    hasPerm,
    closeRecord,
    openRecord,
    openShareModal,
    saveTask,
    deleteTask,
    saveDocument,
    recordDocumentRenewal,
    deleteDocument,
    saveCase,
    deleteCase,
    saveSession,
    deleteSession,
    savePoa,
    deletePoa,
    saveCalendarItem,
    deleteCalendarItem,
    getDeleteImpact,
    showToast,
  } = useApp();
  const canWriteRecords = hasPerm('records:write');
  const canDeleteRecords = hasPerm('records:delete');

  const [isDirty, setIsDirty] = useState(false);
  const [discardPromptOpen, setDiscardPromptOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Form states per entity
  const [taskForm, setTaskForm] = useState<Partial<TaskItem>>({});
  const [docForm, setDocForm] = useState<Partial<DocumentItem> & { noExpiry?: boolean }>({});
  const [renewalOpen, setRenewalOpen] = useState(false);
  const [renewalNewDate, setRenewalNewDate] = useState('');
  const [renewalNotes, setRenewalNotes] = useState('');
  const [renewalActor, setRenewalActor] = useState('');
  const [renewalError, setRenewalError] = useState('');

  const [caseForm, setCaseForm] = useState<Partial<CaseItem>>({});
  const [sessionForm, setSessionForm] = useState<Partial<SessionItem>>({});
  const [poaForm, setPoaForm] = useState<Partial<PoaItem> & { noExpiry?: boolean }>({});
  const [calForm, setCalForm] = useState<Partial<CalendarItem>>({});

  const today = getTodayISO();
  const showHijri = db.preferences.showHijri;

  useEffect(() => {
    if (!activeRecord) return;
    setIsDirty(false);
    setDiscardPromptOpen(false);
    setDeleteConfirmOpen(!!activeRecord?.openDelete);
    setValidationError('');
    setRenewalOpen(false);
    setRenewalError('');

    const prefill = activeRecord.prefill || {};

    if (activeRecord.type === 'task') {
      const existing = activeRecord.id
        ? db.tasks.find((t) => t.id === activeRecord.id)
        : undefined;
      if (existing) {
        setTaskForm({ ...existing });
      } else {
        const prefillType =
          (prefill.typeId
            ? db.taskTypes.find((tt) => tt.id === prefill.typeId)
            : undefined) ||
          (prefill.type
            ? db.taskTypes.find((tt) => tt.name === prefill.type)
            : undefined) ||
          db.taskTypes.find((tt) => tt.isAdminKind) ||
          db.taskTypes[0];
        setTaskForm({
          typeId: prefillType?.id || 'ttype-admin',
          type: prefillType?.name || (prefill.type as string) || 'إدارية',
          title: (prefill.title as string) || '',
          specialistId: prefill.specialistId === null ? null : (prefill.specialistId as string | undefined) ?? db.preferences.currentSpecialistId,
          departmentName: (prefill.departmentName as string) || 'الشؤون القانونية',
          priority: (prefill.priority as TaskPriority) || 'متوسطة',
          status: 'جديدة',
          dueDate: (prefill.dueDate as string | undefined) ?? today,
          plannedDate: typeof prefill.plannedDate === 'string' ? prefill.plannedDate : null,
          actualDeliveryDate: '',
          letterNumber: '',
          authorityName: typeof prefill.authorityName === 'string' ? prefill.authorityName : '',
          receivedDate: today,
          documentId: (prefill.documentId as string | null) ?? null,
          caseId: (prefill.caseId as string | null) ?? null,
          sessionId: (prefill.sessionId as string | null) ?? null,
          notes: (prefill.notes as string) || '',
        });
      }
    } else if (activeRecord.type === 'document') {
      const existing = activeRecord.id
        ? db.documents.find((d) => d.id === activeRecord.id)
        : undefined;
      if (existing) {
        if (canWriteRecords && typeof prefill.renewalDate === 'string') {
          setRenewalNewDate(prefill.renewalDate);
          setRenewalNotes(typeof prefill.renewalNotes === 'string' ? prefill.renewalNotes : '');
          setRenewalActor('');
          setRenewalOpen(true);
        }
        setDocForm({ ...existing, noExpiry: !existing.expiryDate });
      } else {
        const defaultCat = db.documentCategories[0] || null;
        setDocForm({
          name: (prefill.name as string | undefined) ?? '',
          categoryId: (prefill.categoryId as string | undefined) ?? defaultCat?.id ?? null,
          docType: defaultCat ? defaultCat.name : 'غير مصنفة',
          referenceNumber: (prefill.referenceNumber as string | undefined) ?? '',
          issuingAuthority: (prefill.issuingAuthority as string | undefined) ?? '',
          specialistId: 'specialistId' in prefill ? prefill.specialistId as string | null : db.preferences.currentSpecialistId,
          issueDate: (prefill.issueDate as string | undefined) ?? today,
          expiryDate: (prefill.expiryDate as string | undefined) ?? '',
          noExpiry: false,
          notes: (prefill.notes as string | undefined) ?? '',
        });
      }
    } else if (activeRecord.type === 'case') {
      const existing = activeRecord.id
        ? db.cases.find((c) => c.id === activeRecord.id)
        : undefined;
      setCaseForm(
        existing
          ? { ...existing }
          : {
              caseNumber: (prefill.caseNumber as string | undefined) ?? '',
              title: (prefill.title as string | undefined) ?? '',
              parties: (prefill.parties as string | undefined) ?? '',
              court: (prefill.court as string | undefined) ?? '',
              status: 'مفتوحة',
              lawyerSpecialistId: 'lawyerSpecialistId' in prefill ? prefill.lawyerSpecialistId as string | null : db.preferences.currentSpecialistId,
              notes: (prefill.notes as string | undefined) ?? '',
            }
      );
    } else if (activeRecord.type === 'session') {
      const existing = activeRecord.id
        ? db.sessions.find((s) => s.id === activeRecord.id)
        : undefined;
      setSessionForm(
        existing
          ? { ...existing }
          : {
              caseId: (prefill.caseId as string) || db.cases[0]?.id || '',
              title: (prefill.title as string | undefined) ?? '',
              scheduledAt: (prefill.scheduledAt as string | undefined) ?? `${today}T10:00`,
              status: 'مجدولة',
              outcome: '',
              specialistId: 'specialistId' in prefill ? prefill.specialistId as string | null : db.preferences.currentSpecialistId,
              location: (prefill.location as string | undefined) ?? '',
              notes: (prefill.notes as string | undefined) ?? '',
            }
      );
    } else if (activeRecord.type === 'poa') {
      const existing = activeRecord.id
        ? db.poas.find((p) => p.id === activeRecord.id)
        : undefined;
      setPoaForm(
        existing
          ? { ...existing, noExpiry: !existing.expiryDate }
          : {
              title: (prefill.title as string | undefined) ?? '',
              referenceNumber: (prefill.referenceNumber as string | undefined) ?? '',
              grantor: (prefill.grantor as string | undefined) ?? '',
              agent: (prefill.agent as string | undefined) ?? '',
              scope: (prefill.scope as string | undefined) ?? '',
              specialistId: 'specialistId' in prefill ? prefill.specialistId as string | null : db.preferences.currentSpecialistId,
              issueDate: (prefill.issueDate as string | undefined) ?? today,
              expiryDate: (prefill.expiryDate as string | undefined) ?? '',
              noExpiry: false,
              statusOverride: null,
              notes: (prefill.notes as string | undefined) ?? '',
            }
      );
    } else if (activeRecord.type === 'calendar_item') {
      const existing = activeRecord.id
        ? db.calendarItems.find((ci) => ci.id === activeRecord.id)
        : undefined;
      setCalForm(
        existing
          ? { ...existing }
          : {
              kind: prefill.kind === 'حدث' ? 'حدث' : 'تذكير',
              title: typeof prefill.title === 'string' ? prefill.title : '',
              scheduledAt: typeof prefill.scheduledAt === 'string' ? prefill.scheduledAt : `${today}T10:00`,
              isAllDay: prefill.isAllDay === true,
              specialistId: typeof prefill.specialistId === 'string' ? prefill.specialistId : null,
              linkedRecordType: null,
              linkedRecordId: null,
              notes: typeof prefill.notes === 'string' ? prefill.notes : '',
              isDone: false,
            }
      );
    }
  }, [activeRecord, db.tasks, db.documents, db.cases, db.sessions, db.poas, db.calendarItems, db.preferences.currentSpecialistId, today, canWriteRecords]);

  if (!activeRecord) return null;

  const attemptClose = () => {
    if (isDirty) {
      setDiscardPromptOpen(true);
    } else {
      closeRecord();
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (activeRecord.type === 'task') {
      if (!taskForm.title?.trim()) {
        setValidationError('عنوان المهمة مطلوب.');
        return;
      }
      if (!taskForm.dueDate) {
        setValidationError('موعد استحقاق المهمة مطلوب.');
        return;
      }
      const pickedTaskType = resolveTaskType(
        { typeId: taskForm.typeId || '', type: taskForm.type || '' },
        db.taskTypes
      );
      const isAdminTask =
        !!pickedTaskType?.isAdminKind ||
        taskForm.typeId === 'ttype-admin' ||
        taskForm.type === 'إدارية';
      if (isAdminTask && !taskForm.authorityName?.trim()) {
        setValidationError('في المهمة الإدارية يجب تحديد الجهة.');
        return;
      }
      const saved = saveTask({
        id: activeRecord.id ?? undefined,
        typeId: pickedTaskType?.id || taskForm.typeId || db.taskTypes[0]?.id || 'ttype-admin',
        type: pickedTaskType?.name || taskForm.type || 'إدارية',
        title: taskForm.title.trim(),
        specialistId: taskForm.specialistId || null,
        departmentName: taskForm.departmentName?.trim() || 'عام',
        priority: (taskForm.priority as TaskPriority) || 'متوسطة',
        status: (taskForm.status as TaskStatus) || 'جديدة',
        dueDate: taskForm.dueDate,
        plannedDate: taskForm.plannedDate,
        actualDeliveryDate: taskForm.actualDeliveryDate || null,
        letterNumber: taskForm.letterNumber?.trim() || undefined,
        authorityName: taskForm.authorityName?.trim() || undefined,
        receivedDate: taskForm.receivedDate || null,
        documentId: taskForm.documentId || null,
        caseId: taskForm.caseId || null,
        sessionId: taskForm.sessionId || null,
        notes: taskForm.notes || '',
        archivedAt: taskForm.archivedAt || null,
      }, !activeRecord.id && typeof activeRecord.prefill?.ideaId === 'string' ? activeRecord.prefill.ideaId : undefined);
      setIsDirty(false);
      showToast('تم حفظ المهمة بنجاح.');
      openRecord('task', saved.id);
      return;
    }

    if (activeRecord.type === 'document') {
      if (!docForm.name?.trim()) {
        setValidationError('اسم الوثيقة مطلوب.');
        return;
      }
      if (!docForm.issuingAuthority?.trim()) {
        setValidationError('الجهة المصدرة مطلوبة.');
        return;
      }
      const pickedCategory = docForm.categoryId
        ? db.documentCategories.find((c) => c.id === docForm.categoryId)
        : undefined;
      const saved = saveDocument({
        id: activeRecord.id ?? undefined,
        name: docForm.name.trim(),
        categoryId: pickedCategory ? pickedCategory.id : null,
        docType: pickedCategory ? pickedCategory.name : 'غير مصنفة',
        referenceNumber: docForm.referenceNumber?.trim() || '—',
        issuingAuthority: docForm.issuingAuthority.trim(),
        specialistId: docForm.specialistId || null,
        issueDate: docForm.issueDate || null,
        expiryDate: docForm.noExpiry ? null : docForm.expiryDate || null,
        notes: docForm.notes || '',
        archivedAt: docForm.archivedAt || null,
      });
      setIsDirty(false);
      showToast('تم حفظ الوثيقة بنجاح.');
      openRecord('document', saved.id);
      return;
    }

    if (activeRecord.type === 'case') {
      if (!caseForm.title?.trim() || !caseForm.caseNumber?.trim()) {
        setValidationError('عنوان القضية ورقمها مطلوبان.');
        return;
      }
      const saved = saveCase({
        id: activeRecord.id ?? undefined,
        caseNumber: caseForm.caseNumber.trim(),
        title: caseForm.title.trim(),
        parties: caseForm.parties?.trim() || '—',
        court: caseForm.court?.trim() || '—',
        status: (caseForm.status as CaseStatus) || 'مفتوحة',
        lawyerSpecialistId: caseForm.lawyerSpecialistId || null,
        notes: caseForm.notes || '',
        archivedAt: caseForm.archivedAt || null,
      });
      setIsDirty(false);
      showToast('تم حفظ القضية بنجاح.');
      openRecord('case', saved.id);
      return;
    }

    if (activeRecord.type === 'session') {
      if (!sessionForm.caseId || !sessionForm.title?.trim() || !sessionForm.scheduledAt) {
        setValidationError('القضية المرتبطة وعنوان الجلسة وموعدها مطلوبة.');
        return;
      }
      const saved = saveSession({
        id: activeRecord.id ?? undefined,
        caseId: sessionForm.caseId,
        title: sessionForm.title.trim(),
        scheduledAt: sessionForm.scheduledAt,
        status: (sessionForm.status as SessionStatus) || 'مجدولة',
        outcome: sessionForm.outcome || '',
        specialistId: sessionForm.specialistId || null,
        location: sessionForm.location || '',
        notes: sessionForm.notes || '',
      });
      setIsDirty(false);
      showToast('تم حفظ الجلسة بنجاح.');
      openRecord('session', saved.id);
      return;
    }

    if (activeRecord.type === 'poa') {
      if (!poaForm.title?.trim() || !poaForm.referenceNumber?.trim()) {
        setValidationError('عنوان الوكالة والرقم المرجعي مطلوبان.');
        return;
      }
      const saved = savePoa({
        id: activeRecord.id ?? undefined,
        title: poaForm.title.trim(),
        referenceNumber: poaForm.referenceNumber.trim(),
        grantor: poaForm.grantor?.trim() || '—',
        agent: poaForm.agent?.trim() || '—',
        scope: poaForm.scope?.trim() || '—',
        specialistId: poaForm.specialistId || null,
        issueDate: poaForm.issueDate || today,
        expiryDate: poaForm.noExpiry ? null : poaForm.expiryDate || null,
        statusOverride: poaForm.statusOverride || null,
        notes: poaForm.notes || '',
        archivedAt: poaForm.archivedAt || null,
      });
      setIsDirty(false);
      showToast('تم حفظ الوكالة/التفويض.');
      openRecord('poa', saved.id);
      return;
    }

    if (activeRecord.type === 'calendar_item') {
      if (!calForm.title?.trim() || !calForm.scheduledAt) {
        setValidationError('العنوان والموعد مطلوبان.');
        return;
      }
      const saved = saveCalendarItem({
        id: activeRecord.id ?? undefined,
        kind: calForm.kind || 'تذكير',
        title: calForm.title.trim(),
        scheduledAt: calForm.scheduledAt,
        isAllDay: !!calForm.isAllDay,
        specialistId: calForm.specialistId || null,
        linkedRecordType: calForm.linkedRecordType || null,
        linkedRecordId: calForm.linkedRecordId || null,
        notes: calForm.notes || '',
        isDone: !!calForm.isDone,
      });
      setIsDirty(false);
      showToast('تم حفظ العنصر في التقويم.');
      openRecord('calendar_item', saved.id);
    }
  };

  const confirmDelete = () => {
    if (!activeRecord.id) return;
    const id = activeRecord.id;
    if (activeRecord.type === 'document') {
      const ok = deleteDocument(id);
      if (!ok) return;
      setDeleteConfirmOpen(false);
      closeRecord();
      return;
    }
    setDeleteConfirmOpen(false);
    closeRecord();
    if (activeRecord.type === 'task') deleteTask(id);
    else if (activeRecord.type === 'case') deleteCase(id);
    else if (activeRecord.type === 'session') deleteSession(id);
    else if (activeRecord.type === 'poa') deletePoa(id);
    else if (activeRecord.type === 'calendar_item') deleteCalendarItem(id);
  };

  const handleDocumentRenewalSubmit = () => {
    if (!activeRecord.id) return;
    if (!renewalNewDate) {
      setRenewalError('حدد تاريخ الانتهاء الجديد.');
      return;
    }
    const doc = db.documents.find((d) => d.id === activeRecord.id);
    if (!doc) return;
    const currentSpec = db.specialists.find(
      (s) => s.id === db.preferences.currentSpecialistId
    );
    recordDocumentRenewal(doc.id, {
      previousExpiryDate: doc.expiryDate ?? null,
      newExpiryDate: renewalNewDate,
      notes: renewalNotes.trim() || 'تجديد وثيقة',
      actorName: renewalActor.trim() || currentSpec?.name || 'المستخدم',
      renewedAt: new Date().toISOString().slice(0, 19),
    });
    setRenewalOpen(false);
    setRenewalNewDate('');
    setRenewalNotes('');
    setRenewalError('');
  };

  const existingDoc =
    activeRecord.type === 'document' && activeRecord.id
      ? db.documents.find((d) => d.id === activeRecord.id)
      : undefined;

  const existingTask =
    activeRecord.type === 'task' && activeRecord.id
      ? db.tasks.find((t) => t.id === activeRecord.id)
      : undefined;

  const existingCase =
    activeRecord.type === 'case' && activeRecord.id
      ? db.cases.find((c) => c.id === activeRecord.id)
      : undefined;

  const existingSession =
    activeRecord.type === 'session' && activeRecord.id
      ? db.sessions.find((s) => s.id === activeRecord.id)
      : undefined;

  const existingCal =
    activeRecord.type === 'calendar_item' && activeRecord.id
      ? db.calendarItems.find((c) => c.id === activeRecord.id)
      : undefined;

  const headerTitleMap: Record<RecordType, string> = {
    task: activeRecord.id ? 'تفاصيل المهمة' : 'مهمة جديدة',
    document: activeRecord.id ? 'تفاصيل الوثيقة والتجديدات' : 'وثيقة جديدة',
    case: activeRecord.id ? 'تفاصيل القضية' : 'قضية جديدة',
    session: activeRecord.id ? 'تفاصيل الجلسة' : 'جلسة جديدة',
    poa: activeRecord.id ? 'تفاصيل الوكالة / التفويض' : 'وكالة / تفويض جديد',
    calendar_item: activeRecord.id ? 'تفاصيل الحدث / التذكير' : 'حدث / تذكير جديد',
  };

  const deleteImpact = activeRecord.id
    ? getDeleteImpact(activeRecord.type, activeRecord.id)
    : null;

  const inputClass =
    'w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] px-3 py-2 text-sm font-mono-tabular text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelClass = 'block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1';

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      {/* Full page on mobile, side slide-over on desktop */}
      <div className="w-full lg:w-[620px] xl:w-[680px] h-full bg-white dark:bg-[#0c0d11] border-r border-slate-200 dark:border-white/10 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-4 lg:px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base lg:text-lg font-bold text-slate-900 dark:text-white truncate">
                {headerTitleMap[activeRecord.type]}
              </h2>
              {!canWriteRecords && (
                <StatusBadge label="وضع القراءة فقط" tone="neutral" />
              )}
            </div>
            {existingTask && (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StatusBadge
                  label={resolveTaskTypeName(existingTask, db.taskTypes)}
                  tone="neutral"
                />
                <StatusBadge label={existingTask.status} tone="info" />
                {(() => {
                  const d = evaluateTaskDelay(existingTask, today);
                  return d.label ? (
                    <StatusBadge
                      label={d.label}
                      tone={d.isOverdue ? 'danger' : 'warning'}
                      icon="alert"
                    />
                  ) : null;
                })()}
              </div>
            )}
            {existingDoc && (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StatusBadge
                  label={`التصنيف: ${resolveDocumentCategoryName(existingDoc, db.documentCategories)}`}
                  tone="neutral"
                />
                {(() => {
                  const h = evaluateDocumentHealth(
                    existingDoc,
                    db.preferences.documentWarningDays,
                    today
                  );
                  const tone =
                    h.category === 'منتهية'
                      ? 'danger'
                      : h.category === 'تنتهي اليوم'
                      ? 'today'
                      : h.category === 'قريبة الانتهاء'
                      ? 'warning'
                      : h.category === 'سارية'
                      ? 'success'
                      : 'neutral';
                  return <StatusBadge label={h.badgeText} tone={tone} />;
                })()}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={attemptClose}
            aria-label="إغلاق النموذج"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form
          id="record-drawer-form"
          data-label-workspace={`record-${activeRecord.type}-${activeRecord.id || 'new'}`}
          onSubmit={handleSave}
          className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5 relative min-h-[400px]"
        >
          {activeRecord.id &&
            (activeRecord.type === 'task' ||
              activeRecord.type === 'document' ||
              activeRecord.type === 'case') && (
              <WorkspacePinnedLabels
                targetType={activeRecord.type}
                targetId={activeRecord.id}
              />
            )}
          {validationError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-sm font-medium">
              {validationError}
            </div>
          )}

          {/* TASK FORM */}
          {activeRecord.type === 'task' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className={labelClass}>عنوان المهمة *</label>
                  <input
                    type="text"
                    value={taskForm.title || ''}
                    onChange={(e) => {
                      setTaskForm({ ...taskForm, title: e.target.value });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                    placeholder="مثال: تجديد رخصة الدفاع المدني..."
                  />
                </div>

                <div>
                  <label className={labelClass}>نوع المهمة</label>
                  <select
                    value={
                      resolveTaskType(
                        { typeId: taskForm.typeId || '', type: taskForm.type || '' },
                        db.taskTypes
                      )?.id ||
                      taskForm.typeId ||
                      ''
                    }
                    onChange={(e) => {
                      const picked = db.taskTypes.find((tt) => tt.id === e.target.value);
                      setTaskForm({
                        ...taskForm,
                        typeId: e.target.value,
                        type: picked ? picked.name : taskForm.type || '',
                      });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  >
                    {db.taskTypes.map((tt) => (
                      <option key={tt.id} value={tt.id}>
                        {tt.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>الحالة</label>
                  <select
                    value={taskForm.status || 'جديدة'}
                    onChange={(e) => {
                      const nextStatus = e.target.value as TaskStatus;
                      setTaskForm({
                        ...taskForm,
                        status: nextStatus,
                        actualDeliveryDate:
                          nextStatus === 'مكتملة' && !taskForm.actualDeliveryDate
                            ? today
                            : taskForm.actualDeliveryDate,
                      });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  >
                    <option value="جديدة">جديدة</option>
                    <option value="قيد التنفيذ">قيد التنفيذ</option>
                    <option value="معلقة">معلقة</option>
                    <option value="مكتملة">مكتملة</option>
                    <option value="ملغاة">ملغاة</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>المختص المسؤول</label>
                  <select
                    value={taskForm.specialistId || ''}
                    onChange={(e) => {
                      const sp = db.specialists.find((s) => s.id === e.target.value);
                      setTaskForm({
                        ...taskForm,
                        specialistId: e.target.value || null,
                        departmentName: sp ? sp.departmentName : taskForm.departmentName,
                      });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  >
                    <option value="">غير مسند</option>
                    {db.specialists.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {s.departmentName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>القسم</label>
                  <input
                    type="text"
                    value={taskForm.departmentName || ''}
                    onChange={(e) => {
                      setTaskForm({ ...taskForm, departmentName: e.target.value });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>الأولوية</label>
                  <select
                    value={taskForm.priority || 'متوسطة'}
                    onChange={(e) => {
                      setTaskForm({ ...taskForm, priority: e.target.value as TaskPriority });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  >
                    <option value="عاجلة">عاجلة</option>
                    <option value="مرتفعة">مرتفعة</option>
                    <option value="متوسطة">متوسطة</option>
                    <option value="منخفضة">منخفضة</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>الموعد المستهدف *</label>
                  <ArabicDatePicker
                    mode="date"
                    clearable={false}
                    showHijri={showHijri}
                    value={taskForm.dueDate || ''}
                    onChange={(nextVal) => {
                      setTaskForm({ ...taskForm, dueDate: nextVal });
                      setIsDirty(true);
                    }}
                    ariaLabel="الموعد المستهدف"
                  />
                </div>

                <div>
                  <label className={labelClass}>تاريخ التسليم الفعلي</label>
                  <ArabicDatePicker
                    mode="date"
                    showHijri={showHijri}
                    value={taskForm.actualDeliveryDate || ''}
                    onChange={(nextVal) => {
                      setTaskForm({ ...taskForm, actualDeliveryDate: nextVal });
                      setIsDirty(true);
                    }}
                    ariaLabel="تاريخ التسليم الفعلي"
                  />
                </div>
              </div>

              {(resolveTaskType(
                { typeId: taskForm.typeId || '', type: taskForm.type || '' },
                db.taskTypes
              )?.isAdminKind ||
                taskForm.typeId === 'ttype-admin' ||
                taskForm.type === 'إدارية') && (
                <div className="glass-surface-subtle rounded-xl p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>رقم الخطاب</label>
                    <input
                      type="text"
                      value={taskForm.letterNumber || ''}
                      onChange={(e) => {
                        setTaskForm({ ...taskForm, letterNumber: e.target.value });
                        setIsDirty(true);
                      }}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>الجهة *</label>
                    <input
                      type="text"
                      value={taskForm.authorityName || ''}
                      onChange={(e) => {
                        setTaskForm({ ...taskForm, authorityName: e.target.value });
                        setIsDirty(true);
                      }}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>تاريخ الاستلام</label>
                    <ArabicDatePicker
                      mode="date"
                      showHijri={showHijri}
                      value={taskForm.receivedDate || ''}
                      onChange={(nextVal) => {
                        setTaskForm({ ...taskForm, receivedDate: nextVal });
                        setIsDirty(true);
                      }}
                      ariaLabel="تاريخ الاستلام"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>الوثيقة المرتبطة</label>
                  <select
                    value={taskForm.documentId || ''}
                    onChange={(e) => {
                      setTaskForm({ ...taskForm, documentId: e.target.value || null });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  >
                    <option value="">بدون ربط بوثيقة</option>
                    {db.documents.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>القضية المرتبطة</label>
                  <select
                    value={taskForm.caseId || ''}
                    onChange={(e) => {
                      setTaskForm({ ...taskForm, caseId: e.target.value || null });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  >
                    <option value="">بدون ربط بقضية</option>
                    {db.cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} ({c.caseNumber})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>ملاحظات</label>
                <textarea
                  rows={3}
                  value={taskForm.notes || ''}
                  onChange={(e) => {
                    setTaskForm({ ...taskForm, notes: e.target.value });
                    setIsDirty(true);
                  }}
                  className={inputClass}
                />
              </div>

              {existingTask && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                  <LabelsSection targetType="task" targetId={existingTask.id} compact />
                </div>
              )}
            </div>
          )}

          {/* DOCUMENT FORM */}
          {activeRecord.type === 'document' && (
            <div className="space-y-4">
              {existingDoc && canWriteRecords && (
                <div className="flex flex-wrap items-center gap-2 glass-surface-subtle rounded-xl p-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (isDirty) {
                        showToast('احفظ التعديلات على الوثيقة أولًا أو ألغها.');
                        return;
                      }
                      const renewalType =
                        db.taskTypes.find((tt) => tt.isRenewalKind) ||
                        db.taskTypes.find((tt) => tt.id === 'ttype-renewal') ||
                        db.taskTypes[0];
                      openRecord('task', null, {
                        typeId: renewalType?.id || 'ttype-renewal',
                        type: renewalType?.name || 'تجديد',
                        title: `تجديد: ${existingDoc.name}`,
                        documentId: existingDoc.id,
                        specialistId: existingDoc.specialistId,
                        departmentName: 'الوثائق والتراخيص',
                        priority: 'مرتفعة',
                        dueDate: existingDoc.expiryDate || today,
                        notes: `مهمة تجديد مرتبطة بالوثيقة رقم ${existingDoc.referenceNumber}`,
                      });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إنشاء مهمة تجديد مرتبطة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRenewalOpen(!renewalOpen);
                      setRenewalNewDate('');
                      setRenewalNotes('');
                      setRenewalError('');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 text-xs font-semibold whitespace-nowrap"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>تسجيل تجديد جديد</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const nextArchived = existingDoc.archivedAt ? null : new Date().toISOString().slice(0, 19);
                      saveDocument({
                        ...existingDoc,
                        archivedAt: nextArchived,
                      });
                      showToast(nextArchived ? 'تمت أرشفة الوثيقة.' : 'تمت استعادة الوثيقة من الأرشيف.');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>{existingDoc.archivedAt ? 'إلغاء الأرشفة' : 'أرشفة'}</span>
                  </button>
                </div>
              )}

              {/* Inline Renewal Recording Form */}
              {existingDoc && renewalOpen && (
                <div className="rounded-xl border border-teal-300 dark:border-teal-700 bg-teal-50/70 dark:bg-teal-950/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-teal-900 dark:text-teal-200">
                      تسجيل تجديد الوثيقة (يُحفظ التاريخ السابق والجديد)
                    </h3>
                    <button
                      type="button"
                      onClick={() => setRenewalOpen(false)}
                      className="text-xs text-slate-500 hover:text-slate-800"
                    >
                      إلغاء
                    </button>
                  </div>
                  <div className="text-xs text-teal-800 dark:text-teal-300 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      التصنيف:{' '}
                      <span className="font-semibold">
                        {resolveDocumentCategoryName(existingDoc, db.documentCategories)}
                      </span>
                    </span>
                    <span>·</span>
                    <span>
                      تاريخ الانتهاء السابق:{' '}
                      <span className="font-semibold">
                        {existingDoc.expiryDate
                          ? formatDisplayDate(existingDoc.expiryDate, showHijri)
                          : 'بلا تاريخ'}
                      </span>
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>تاريخ الانتهاء الجديد *</label>
                      <ArabicDatePicker
                        mode="date"
                        showHijri={showHijri}
                        value={renewalNewDate}
                        onChange={(nextVal) => {
                          setRenewalNewDate(nextVal);
                          setRenewalError('');
                        }}
                        ariaLabel="تاريخ الانتهاء الجديد"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>منفّذ التجديد</label>
                      <input
                        type="text"
                        value={renewalActor}
                        onChange={(e) => setRenewalActor(e.target.value)}
                        placeholder={
                          db.specialists.find((s) => s.id === db.preferences.currentSpecialistId)
                            ?.name || 'اسم المنفّذ'
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>ملاحظات التجديد</label>
                    <input
                      type="text"
                      value={renewalNotes}
                      onChange={(e) => setRenewalNotes(e.target.value)}
                      placeholder="رقم السداد أو مرجع التجديد..."
                      className={inputClass}
                    />
                  </div>
                  {renewalError && (
                    <p className="text-xs text-rose-600 dark:text-rose-400">{renewalError}</p>
                  )}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleDocumentRenewalSubmit}
                      className="px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 text-xs font-semibold"
                    >
                      اعتماد وحفظ التجديد
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className={labelClass}>اسم الوثيقة / الرخصة *</label>
                  <input
                    type="text"
                    value={docForm.name || ''}
                    onChange={(e) => {
                      setDocForm({ ...docForm, name: e.target.value });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>التصنيف</label>
                  <select
                    value={docForm.categoryId ?? ''}
                    onChange={(e) => {
                      const nextId = e.target.value || null;
                      const cat = nextId
                        ? db.documentCategories.find((c) => c.id === nextId)
                        : undefined;
                      setDocForm({
                        ...docForm,
                        categoryId: nextId,
                        docType: cat ? cat.name : 'غير مصنفة',
                      });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  >
                    <option value="">غير مصنفة</option>
                    {db.documentCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>الرقم المرجعي</label>
                  <input
                    type="text"
                    value={docForm.referenceNumber || ''}
                    onChange={(e) => {
                      setDocForm({ ...docForm, referenceNumber: e.target.value });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>الجهة المصدرة *</label>
                  <input
                    type="text"
                    value={docForm.issuingAuthority || ''}
                    onChange={(e) => {
                      setDocForm({ ...docForm, issuingAuthority: e.target.value });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>المسؤول</label>
                  <select
                    value={docForm.specialistId || ''}
                    onChange={(e) => {
                      setDocForm({ ...docForm, specialistId: e.target.value || null });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  >
                    <option value="">غير مسند</option>
                    {db.specialists.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>تاريخ الإصدار</label>
                  <ArabicDatePicker
                    mode="date"
                    showHijri={showHijri}
                    value={docForm.issueDate || ''}
                    onChange={(nextVal) => {
                      setDocForm({ ...docForm, issueDate: nextVal });
                      setIsDirty(true);
                    }}
                    ariaLabel="تاريخ الإصدار"
                  />
                </div>
                <div>
                  <label className={labelClass}>تاريخ الانتهاء</label>
                  <ArabicDatePicker
                    mode="date"
                    disabled={!!docForm.noExpiry}
                    showHijri={showHijri}
                    value={docForm.noExpiry ? '' : docForm.expiryDate || ''}
                    onChange={(nextVal) => {
                      setDocForm({ ...docForm, expiryDate: nextVal });
                      setIsDirty(true);
                    }}
                    ariaLabel="تاريخ الانتهاء"
                  />
                  <label className="inline-flex items-center gap-2 mt-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!docForm.noExpiry}
                      onChange={(e) => {
                        setDocForm({
                          ...docForm,
                          noExpiry: e.target.checked,
                          expiryDate: e.target.checked ? null : docForm.expiryDate,
                        });
                        setIsDirty(true);
                      }}
                    />
                    <span>وثيقة بلا تاريخ انتهاء</span>
                  </label>
                </div>
              </div>

              <div>
                <label className={labelClass}>ملاحظات</label>
                <textarea
                  rows={2}
                  value={docForm.notes || ''}
                  onChange={(e) => {
                    setDocForm({ ...docForm, notes: e.target.value });
                    setIsDirty(true);
                  }}
                  className={inputClass}
                />
              </div>

              {existingDoc && (
                <>
                  {/* Linked renewal tasks */}
                  {(() => {
                    const linkedTasks = db.tasks.filter((t) => t.documentId === existingDoc.id);
                    if (linkedTasks.length === 0) return null;
                    return (
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          مهام التجديد المرتبطة ({linkedTasks.length})
                        </div>
                        <div className="space-y-1.5">
                          {linkedTasks.map((lt) => (
                            <button
                              key={lt.id}
                              type="button"
                              onClick={() => openRecord('task', lt.id)}
                              className="w-full text-right glass-surface-subtle rounded-lg px-3 py-2 flex items-center justify-between gap-2 hover:border-blue-400"
                            >
                              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {lt.title}
                              </span>
                              <StatusBadge label={lt.status} tone="info" />
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Renewal History Log */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                        <span>سجل التجديدات ({existingDoc.renewals.length})</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 font-semibold">
                        التصنيف: {resolveDocumentCategoryName(existingDoc, db.documentCategories)}
                      </span>
                    </div>
                    {existingDoc.renewals.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        لم تُسجل عمليات تجديد سابقة لهذه الوثيقة.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {existingDoc.renewals.map((ren) => (
                          <div
                            key={ren.id}
                            className="glass-surface-subtle rounded-lg p-2.5 text-xs space-y-1"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 font-semibold text-slate-800 dark:text-slate-200">
                              <span>
                                السابق:{' '}
                                {ren.previousExpiryDate
                                  ? formatDisplayDate(ren.previousExpiryDate, showHijri)
                                  : 'بلا تاريخ'}{' '}
                                ← الجديد: {formatDisplayDate(ren.newExpiryDate, showHijri)}
                              </span>
                              <span className="text-slate-500 dark:text-slate-400 font-normal">
                                {formatDateTime(ren.renewedAt, showHijri)}
                              </span>
                            </div>
                            <div className="text-slate-600 dark:text-slate-300">
                              {ren.notes} · المنفّذ: {ren.actorName}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                    <LabelsSection targetType="document" targetId={existingDoc.id} compact />
                  </div>
                </>
              )}
            </div>
          )}

          {/* CASE FORM */}
          {activeRecord.type === 'case' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>رقم القضية *</label>
                  <input
                    type="text"
                    value={caseForm.caseNumber || ''}
                    onChange={(e) => {
                      setCaseForm({ ...caseForm, caseNumber: e.target.value });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>الحالة</label>
                  <select
                    value={caseForm.status || 'مفتوحة'}
                    onChange={(e) => {
                      setCaseForm({ ...caseForm, status: e.target.value as CaseStatus });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  >
                    <option value="مفتوحة">مفتوحة</option>
                    <option value="قيد المرافعة">قيد المرافعة</option>
                    <option value="موقوفة">موقوفة</option>
                    <option value="مغلقة">مغلقة</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>موضوع / عنوان القضية *</label>
                  <input
                    type="text"
                    value={caseForm.title || ''}
                    onChange={(e) => {
                      setCaseForm({ ...caseForm, title: e.target.value });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>الأطراف</label>
                  <input
                    type="text"
                    value={caseForm.parties || ''}
                    onChange={(e) => {
                      setCaseForm({ ...caseForm, parties: e.target.value });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>المحكمة / الدائرة</label>
                  <input
                    type="text"
                    value={caseForm.court || ''}
                    onChange={(e) => {
                      setCaseForm({ ...caseForm, court: e.target.value });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>المحامي / المختص</label>
                  <select
                    value={caseForm.lawyerSpecialistId || ''}
                    onChange={(e) => {
                      setCaseForm({
                        ...caseForm,
                        lawyerSpecialistId: e.target.value || null,
                      });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  >
                    <option value="">غير مسند</option>
                    {db.specialists.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>ملاحظات القضية</label>
                <textarea
                  rows={3}
                  value={caseForm.notes || ''}
                  onChange={(e) => {
                    setCaseForm({ ...caseForm, notes: e.target.value });
                    setIsDirty(true);
                  }}
                  className={inputClass}
                />
              </div>

              {existingCase && (
                <>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        الجلسات المرتبطة ({db.sessions.filter((s) => s.caseId === existingCase.id).length})
                      </span>
                      {canWriteRecords && (
                        <button
                          type="button"
                          onClick={() => openRecord('session', null, { caseId: existingCase.id })}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                        >
                          <CalendarPlus className="w-3.5 h-3.5" />
                          <span>إضافة جلسة للقضية</span>
                        </button>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {db.sessions
                        .filter((s) => s.caseId === existingCase.id)
                        .map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => openRecord('session', s.id)}
                            className="w-full text-right glass-surface-subtle rounded-lg px-3 py-2 flex items-center justify-between gap-2"
                          >
                            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {s.title}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                              {formatDateTime(s.scheduledAt, showHijri)}
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                    <LabelsSection targetType="case" targetId={existingCase.id} compact />
                  </div>
                </>
              )}
            </div>
          )}

          {/* SESSION FORM */}
          {activeRecord.type === 'session' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className={labelClass}>القضية المرتبطة *</label>
                  <select
                    value={sessionForm.caseId || ''}
                    onChange={(e) => {
                      setSessionForm({ ...sessionForm, caseId: e.target.value });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  >
                    <option value="">اختر القضية...</option>
                    {db.cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} (رقم {c.caseNumber})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass}>عنوان الجلسة *</label>
                  <input
                    type="text"
                    value={sessionForm.title || ''}
                    onChange={(e) => {
                      setSessionForm({ ...sessionForm, title: e.target.value });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>الموعد والوقت *</label>
                  <ArabicDatePicker
                    mode="datetime"
                    clearable={false}
                    showHijri={showHijri}
                    value={sessionForm.scheduledAt || ''}
                    onChange={(nextVal) => {
                      setSessionForm({ ...sessionForm, scheduledAt: nextVal });
                      setIsDirty(true);
                    }}
                    ariaLabel="موعد ووقت الجلسة"
                  />
                </div>

                <div>
                  <label className={labelClass}>الحالة</label>
                  <select
                    value={sessionForm.status || 'مجدولة'}
                    onChange={(e) => {
                      setSessionForm({ ...sessionForm, status: e.target.value as SessionStatus });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  >
                    <option value="مجدولة">مجدولة</option>
                    <option value="منعقدة">منعقدة</option>
                    <option value="مؤجلة">مؤجلة</option>
                    <option value="ملغاة">ملغاة</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>المختص الحاضر</label>
                  <select
                    value={sessionForm.specialistId || ''}
                    onChange={(e) => {
                      setSessionForm({ ...sessionForm, specialistId: e.target.value || null });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  >
                    <option value="">غير مسند</option>
                    {db.specialists.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>المكان / الرابط</label>
                  <input
                    type="text"
                    value={sessionForm.location || ''}
                    onChange={(e) => {
                      setSessionForm({ ...sessionForm, location: e.target.value });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass}>النتيجة / ما تم في الجلسة</label>
                  <textarea
                    rows={2}
                    value={sessionForm.outcome || ''}
                    onChange={(e) => {
                      setSessionForm({ ...sessionForm, outcome: e.target.value });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass}>ملاحظات</label>
                  <textarea
                    rows={2}
                    value={sessionForm.notes || ''}
                    onChange={(e) => {
                      setSessionForm({ ...sessionForm, notes: e.target.value });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          )}

          {/* POA FORM */}
          {activeRecord.type === 'poa' && (
            <div className="space-y-4">
              {activeRecord.id && (
                <div>
                  {(() => {
                    const ph = evaluatePoaHealth(
                      poaForm as PoaItem,
                      db.preferences.documentWarningDays,
                      today
                    );
                    return (
                      <StatusBadge
                        label={ph.label}
                        tone={ph.isExpired ? 'danger' : ph.isUrgent ? 'warning' : 'success'}
                      />
                    );
                  })()}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className={labelClass}>اسم الوكالة / التفويض *</label>
                  <input
                    type="text"
                    value={poaForm.title || ''}
                    onChange={(e) => {
                      setPoaForm({ ...poaForm, title: e.target.value });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>الرقم المرجعي *</label>
                  <input
                    type="text"
                    value={poaForm.referenceNumber || ''}
                    onChange={(e) => {
                      setPoaForm({ ...poaForm, referenceNumber: e.target.value });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>المختص المتابع</label>
                  <select
                    value={poaForm.specialistId || ''}
                    onChange={(e) => {
                      setPoaForm({ ...poaForm, specialistId: e.target.value || null });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  >
                    <option value="">غير مسند</option>
                    {db.specialists.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>الموكّل / المفوِّض</label>
                  <input
                    type="text"
                    value={poaForm.grantor || ''}
                    onChange={(e) => {
                      setPoaForm({ ...poaForm, grantor: e.target.value });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>الوكيل / المفوَّض</label>
                  <input
                    type="text"
                    value={poaForm.agent || ''}
                    onChange={(e) => {
                      setPoaForm({ ...poaForm, agent: e.target.value });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>تاريخ الإصدار</label>
                  <ArabicDatePicker
                    mode="date"
                    showHijri={showHijri}
                    value={poaForm.issueDate || ''}
                    onChange={(nextVal) => {
                      setPoaForm({ ...poaForm, issueDate: nextVal });
                      setIsDirty(true);
                    }}
                    ariaLabel="تاريخ إصدار الوكالة"
                  />
                </div>
                <div>
                  <label className={labelClass}>تاريخ الانتهاء</label>
                  <ArabicDatePicker
                    mode="date"
                    disabled={!!poaForm.noExpiry}
                    showHijri={showHijri}
                    value={poaForm.noExpiry ? '' : poaForm.expiryDate || ''}
                    onChange={(nextVal) => {
                      setPoaForm({ ...poaForm, expiryDate: nextVal });
                      setIsDirty(true);
                    }}
                    ariaLabel="تاريخ انتهاء الوكالة"
                  />
                  <label className="inline-flex items-center gap-2 mt-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!poaForm.noExpiry}
                      onChange={(e) => {
                        setPoaForm({
                          ...poaForm,
                          noExpiry: e.target.checked,
                          expiryDate: e.target.checked ? null : poaForm.expiryDate,
                        });
                        setIsDirty(true);
                      }}
                    />
                    <span>غير محددة المدة</span>
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>الصلاحيات والنطاق</label>
                  <textarea
                    rows={2}
                    value={poaForm.scope || ''}
                    onChange={(e) => {
                      setPoaForm({ ...poaForm, scope: e.target.value });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="inline-flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={poaForm.statusOverride === 'مفسوخة'}
                      onChange={(e) => {
                        setPoaForm({
                          ...poaForm,
                          statusOverride: e.target.checked ? 'مفسوخة' : null,
                        });
                        setIsDirty(true);
                      }}
                    />
                    <span>تم فسخ الوكالة (مفسوخة)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* CALENDAR EVENT / REMINDER FORM */}
          {activeRecord.type === 'calendar_item' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>النوع</label>
                  <select
                    value={calForm.kind || 'تذكير'}
                    onChange={(e) => {
                      setCalForm({ ...calForm, kind: e.target.value as 'حدث' | 'تذكير' });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  >
                    <option value="تذكير">تذكير</option>
                    <option value="حدث">حدث</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>المختص المرتبط (اختياري)</label>
                  <select
                    value={calForm.specialistId || ''}
                    onChange={(e) => {
                      setCalForm({ ...calForm, specialistId: e.target.value || null });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  >
                    <option value="">غير مسند (يمكن اختياره عند المشاركة)</option>
                    {db.specialists.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>العنوان *</label>
                  <input
                    type="text"
                    value={calForm.title || ''}
                    onChange={(e) => {
                      setCalForm({ ...calForm, title: e.target.value });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>التاريخ والوقت *</label>
                  <ArabicDatePicker
                    mode="datetime"
                    clearable={false}
                    showHijri={showHijri}
                    value={calForm.scheduledAt || ''}
                    onChange={(nextVal) => {
                      setCalForm({ ...calForm, scheduledAt: nextVal });
                      setIsDirty(true);
                    }}
                    ariaLabel="تاريخ ووقت الحدث"
                  />
                </div>
                <div>
                  <label className={labelClass}>ربط بسجل (اختياري)</label>
                  <select
                    value={calForm.linkedRecordType || ''}
                    onChange={(e) => {
                      setCalForm({
                        ...calForm,
                        linkedRecordType: (e.target.value as RecordType) || null,
                        linkedRecordId: null,
                      });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  >
                    <option value="">بدون ربط</option>
                    <option value="task">مهمة</option>
                    <option value="document">وثيقة</option>
                    <option value="case">قضية</option>
                    <option value="session">جلسة</option>
                    <option value="poa">وكالة</option>
                  </select>
                </div>

                {calForm.linkedRecordType && (
                  <div className="sm:col-span-2">
                    <label className={labelClass}>اختر السجل المرتبط</label>
                    <select
                      value={calForm.linkedRecordId || ''}
                      onChange={(e) => {
                        setCalForm({ ...calForm, linkedRecordId: e.target.value || null });
                        setIsDirty(true);
                      }}
                      className={inputClass}
                    >
                      <option value="">— اختر —</option>
                      {calForm.linkedRecordType === 'task' &&
                        db.tasks.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title}
                          </option>
                        ))}
                      {calForm.linkedRecordType === 'document' &&
                        db.documents.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      {calForm.linkedRecordType === 'case' &&
                        db.cases.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      {calForm.linkedRecordType === 'session' &&
                        db.sessions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.title}
                          </option>
                        ))}
                      {calForm.linkedRecordType === 'poa' &&
                        db.poas.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className={labelClass}>ملاحظات</label>
                  <textarea
                    rows={2}
                    value={calForm.notes || ''}
                    onChange={(e) => {
                      setCalForm({ ...calForm, notes: e.target.value });
                      setIsDirty(true);
                    }}
                    className={inputClass}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!calForm.isDone}
                      onChange={(e) => {
                        setCalForm({ ...calForm, isDone: e.target.checked });
                        setIsDirty(true);
                      }}
                    />
                    <span>تم الإنجاز / الاطلاع</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Footer Actions */}
        <div className="px-4 lg:px-6 py-3.5 border-t border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-2 shrink-0 bg-slate-50/70 dark:bg-[#0a0b0f]/90 relative z-30">
          <div className="flex items-center gap-2">
            {activeRecord.id && canDeleteRecords && (
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/60"
              >
                <Trash2 className="w-4 h-4" />
                <span>حذف</span>
              </button>
            )}

            {/* Share with Specialist button in Task, Document Renewal, Session, Event, Reminder */}
            {existingTask && (
              <button
                type="button"
                onClick={() =>
                  openShareModal({
                    recordType: 'task',
                    recordId: existingTask.id,
                    recordTitle: existingTask.title,
                    specialistId: existingTask.specialistId,
                    scheduledInfo: existingTask.dueDate,
                    defaultMessage: `السلام عليكم، نرجو متابعة المهمة (${resolveTaskTypeName(existingTask, db.taskTypes)}):\n«${existingTask.title}»\nالموعد المستهدف: ${formatDisplayDate(existingTask.dueDate, showHijri)}`,
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-200 dark:border-blue-800 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/60"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>مشاركة مع المختص</span>
              </button>
            )}

            {existingDoc && (
              <button
                type="button"
                onClick={() =>
                  openShareModal({
                    recordType: 'document_renewal',
                    recordId: existingDoc.id,
                    recordTitle: `تجديد وثيقة: ${existingDoc.name}`,
                    specialistId: existingDoc.specialistId,
                    scheduledInfo: existingDoc.expiryDate || 'بلا تاريخ',
                    defaultMessage: `السلام عليكم، بخصوص تجديد الوثيقة (${resolveDocumentCategoryName(existingDoc, db.documentCategories)}):\n«${existingDoc.name}» (مرجع: ${existingDoc.referenceNumber})\nالجهة: ${existingDoc.issuingAuthority}\nتاريخ الانتهاء: ${existingDoc.expiryDate ? formatDisplayDate(existingDoc.expiryDate, showHijri) : 'بلا تاريخ'}`,
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-teal-200 dark:border-teal-800 text-xs font-semibold text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/60"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>مشاركة تجديد الوثيقة</span>
              </button>
            )}

            {existingSession && (
              <button
                type="button"
                onClick={() =>
                  openShareModal({
                    recordType: 'session',
                    recordId: existingSession.id,
                    recordTitle: existingSession.title,
                    specialistId: existingSession.specialistId,
                    scheduledInfo: existingSession.scheduledAt,
                    defaultMessage: `السلام عليكم، تذكير بموعد الجلسة:\n«${existingSession.title}»\nالموعد: ${formatDateTime(existingSession.scheduledAt, showHijri)}\nالمكان: ${existingSession.location || '—'}`,
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-violet-200 dark:border-violet-800 text-xs font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/60"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>مشاركة مع المختص</span>
              </button>
            )}

            {existingCal && (
              <button
                type="button"
                onClick={() =>
                  openShareModal({
                    recordType: 'calendar_item',
                    recordId: existingCal.id,
                    recordTitle: `${existingCal.kind}: ${existingCal.title}`,
                    specialistId: existingCal.specialistId,
                    scheduledInfo: existingCal.scheduledAt,
                    defaultMessage: `السلام عليكم، تذكير بـ (${existingCal.kind}):\n«${existingCal.title}»\nالموعد: ${formatDateTime(existingCal.scheduledAt, showHijri)}`,
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-violet-200 dark:border-violet-800 text-xs font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/60"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>مشاركة مع المختص</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={attemptClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800"
            >
              {canWriteRecords ? 'إلغاء' : 'إغلاق'}
            </button>
            {canWriteRecords && (
              <button
                type="submit"
                form="record-drawer-form"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold"
              >
                <Save className="w-3.5 h-3.5" />
                <span>حفظ</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Unsaved Changes Guard Modal */}
      {discardPromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="glass-panel max-w-sm w-full rounded-2xl p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              تغييرات غير محفوظة
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              لديك تعديلات لم تُحفظ بعد. هل ترغب في الاستمرار في التحرير أم تجاهل التغييرات؟
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDiscardPromptOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold"
              >
                الاستمرار في التحرير
              </button>
              <button
                type="button"
                onClick={() => {
                  setDiscardPromptOpen(false);
                  closeRecord();
                }}
                className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                تجاهل التغييرات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation with Linked Impact & MySQL-aligned Restriction */}
      {deleteConfirmOpen && deleteImpact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="glass-panel max-w-md w-full rounded-2xl p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-rose-700 dark:text-rose-300">
              {deleteImpact.blockedReason ? 'الحذف النهائي محظور' : 'تأكيد حذف السجل'}
            </h3>

            {deleteImpact.blockedReason ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                  {deleteImpact.blockedReason}
                </p>
                {deleteImpact.impactLines.length > 0 && (
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-200 space-y-1">
                    {deleteImpact.impactLines.map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmOpen(false)}
                    className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/15 text-xs font-medium text-slate-700 dark:text-slate-200"
                  >
                    إغلاق
                  </button>
                  {existingDoc && !existingDoc.archivedAt && (
                    <button
                      type="button"
                      onClick={() => {
                        saveDocument({
                          ...existingDoc,
                          archivedAt: new Date().toISOString().slice(0, 19),
                        });
                        setDeleteConfirmOpen(false);
                        showToast('تمت أرشفة الوثيقة والاحتفاظ بسجل التجديدات.');
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700 text-xs font-semibold"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>أرشفة الوثيقة</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  هل أنت متأكد من حذف «<span className="font-bold">{deleteImpact.title}</span>»؟
                </p>
                {deleteImpact.impactLines.length > 0 && (
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 p-3 space-y-1">
                    <div className="text-xs font-bold text-amber-800 dark:text-amber-200">
                      أثر الحذف على السجلات المرتبطة:
                    </div>
                    <ul className="list-disc list-inside text-xs text-amber-800 dark:text-amber-200 space-y-0.5">
                      {deleteImpact.impactLines.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmOpen(false)}
                    className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/15 text-xs font-medium text-slate-700 dark:text-slate-200"
                  >
                    تراجع
                  </button>
                  <button
                    type="button"
                    onClick={confirmDelete}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 text-xs font-semibold"
                  >
                    تأكيد الحذف النهائي
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import {
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Share2,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatDateTime } from '../domain/dateUtils';
import { Specialist } from '../types/domain';
import { StatusBadge } from './StatusBadge';

export const SpecialistsView: React.FC = () => {
  const {
    db,
    saveSpecialist,
    deleteSpecialist,
    getDeleteImpact,
  } = useApp();

  const [editing, setEditing] = useState<Partial<Specialist> | null>(null);
  const [formError, setFormError] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const startNew = () => {
    setFormError('');
    setEditing({
      name: '',
      departmentName: '',
      roleTitle: '',
      mobile: '',
      email: '',
      isActive: true,
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editing.name?.trim() || !editing.mobile?.trim() || !editing.email?.trim()) {
      setFormError('الاسم ورقم الجوال والبريد الإلكتروني حقول مطلوبة.');
      return;
    }
    saveSpecialist({
      id: editing.id,
      name: editing.name.trim(),
      departmentName: editing.departmentName?.trim() || 'عام',
      roleTitle: editing.roleTitle?.trim() || 'مختص',
      mobile: editing.mobile.trim(),
      email: editing.email.trim(),
      isActive: editing.isActive ?? true,
    });
    setEditing(null);
    setFormError('');
  };

  const deleteImpact = deleteTargetId
    ? getDeleteImpact('specialist', deleteTargetId)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>المختصون وسجل المشاركة اليدوية</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            إدارة بيانات المختصين (بيانات تجريبية) ومتابعة سجل فتح قنوات واتساب والبريد
          </p>
        </div>

        <button
          type="button"
          onClick={startNew}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة مختص</span>
        </button>
      </div>

      {/* Add / Edit Form */}
      {editing && (
        <form
          onSubmit={handleSave}
          className="glass-panel rounded-xl p-4 space-y-3 border-blue-300 dark:border-blue-700"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {editing.id ? 'تعديل بيانات المختص' : 'إضافة مختص جديد'}
            </h2>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="p-1.5 rounded-lg text-slate-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {formError && (
            <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{formError}</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                الاسم *
              </label>
              <input
                type="text"
                value={editing.name || ''}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                القسم
              </label>
              <input
                type="text"
                value={editing.departmentName || ''}
                onChange={(e) => setEditing({ ...editing, departmentName: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                المسمى الوظيفي
              </label>
              <input
                type="text"
                value={editing.roleTitle || ''}
                onChange={(e) => setEditing({ ...editing, roleTitle: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                رقم الجوال *
              </label>
              <input
                type="text"
                value={editing.mobile || ''}
                onChange={(e) => setEditing({ ...editing, mobile: e.target.value })}
                placeholder="055xxxxxxx"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                البريد الإلكتروني *
              </label>
              <input
                type="email"
                value={editing.email || ''}
                onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono-tabular"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold"
            >
              حفظ المختص
            </button>
          </div>
        </form>
      )}

      {/* Specialists Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {db.specialists.map((sp) => (
          <div
            key={sp.id}
            className="glass-panel rounded-xl p-4 flex items-start justify-between gap-3"
          >
            <div className="space-y-1 min-w-0">
              <div className="font-bold text-sm text-slate-900 dark:text-white">
                {sp.name}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {sp.roleTitle} · {sp.departmentName}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300 pt-1">
                <span className="inline-flex items-center gap-1 font-mono-tabular">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {sp.mobile}
                </span>
                <span className="inline-flex items-center gap-1 font-mono-tabular">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {sp.email}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setFormError('');
                  setEditing({ ...sp });
                }}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                title="تعديل"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setDeleteTargetId(sp.id)}
                className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60"
                title="حذف"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Share Logs */}
      <div className="glass-panel rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
          سجل فتح المشاركة اليدوية ({db.shareLogs.length})
        </h2>
        {db.shareLogs.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            لم تُفتح أي مشاركة خارجية بعد.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {db.shareLogs.map((log) => (
              <div
                key={log.id}
                className="py-2.5 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {log.recordTitle}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
                    <span>المستلم: {log.specialistName}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      {log.channel === 'whatsapp' ? (
                        <MessageCircle className="w-3 h-3 text-emerald-500" />
                      ) : log.channel === 'device' ? (
                        <Share2 className="w-3 h-3 text-violet-500" />
                      ) : (
                        <Mail className="w-3 h-3 text-blue-500" />
                      )}
                      {log.channel === 'whatsapp'
                        ? 'واتساب'
                        : log.channel === 'device'
                        ? 'عبر الجهاز'
                        : 'البريد الإلكتروني'}
                    </span>
                    <span>·</span>
                    <span>{formatDateTime(log.openedAt, db.preferences.showHijri)}</span>
                  </div>
                </div>
                <StatusBadge label={log.status} tone="info" />
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteTargetId && deleteImpact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="glass-panel max-w-md w-full rounded-2xl p-5 space-y-4">
            <h3 className="text-base font-bold text-rose-700 dark:text-rose-300">
              تأكيد حذف المختص
            </h3>
            <p className="text-sm text-slate-700 dark:text-slate-200">
              هل تريد حذف المختص «{deleteImpact.title}»؟
            </p>
            {deleteImpact.impactLines.length > 0 && (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-200">
                {deleteImpact.impactLines.map((l, idx) => (
                  <div key={idx}>{l}</div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-medium"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteSpecialist(deleteTargetId);
                  setDeleteTargetId(null);
                }}
                className="px-3.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

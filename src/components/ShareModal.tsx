import React, { useEffect, useState } from 'react';
import { ExternalLink, Mail, MessageCircle, UserCheck, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatDateTime, formatDisplayDate } from '../domain/dateUtils';
import { buildExternalShareUrl, buildRecordDeepLink } from '../domain/shareUtils';
import { ShareChannel } from '../types/domain';

export const ShareModal: React.FC = () => {
  const { db, shareTarget, closeShareModal, logShareOpened } = useApp();
  const [selectedSpecialistId, setSelectedSpecialistId] = useState<string>('');
  const [channel, setChannel] = useState<ShareChannel>('whatsapp');
  const [messageText, setMessageText] = useState('');

  useEffect(() => {
    if (!shareTarget) return;
    const initialSpecId = shareTarget.specialistId || '';
    setSelectedSpecialistId(initialSpecId);
    setChannel('whatsapp');

    const { url } = buildRecordDeepLink(shareTarget.recordType, shareTarget.recordId);
    const baseMsg = url
      ? `${shareTarget.defaultMessage}\n\nرابط السجل في المعاينة:\n${url}`
      : shareTarget.defaultMessage;
    setMessageText(baseMsg);
  }, [shareTarget]);

  if (!shareTarget) return null;

  const specialist = db.specialists.find((s) => s.id === selectedSpecialistId) || null;
  const formattedDue = shareTarget.scheduledInfo.includes('T')
    ? formatDateTime(shareTarget.scheduledInfo, db.preferences.showHijri)
    : formatDisplayDate(shareTarget.scheduledInfo, db.preferences.showHijri);

  const externalUrl = specialist
    ? buildExternalShareUrl(
        channel,
        specialist.mobile,
        specialist.email,
        `متابعة: ${shareTarget.recordTitle}`,
        messageText
      )
    : '#';

  const handleChannelOpen = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!specialist) {
      e.preventDefault();
      return;
    }
    logShareOpened(shareTarget, specialist, channel, messageText);
    closeShareModal();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="مشاركة مع المختص"
    >
      <div className="glass-panel w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700/70">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            مشاركة مع المختص (يدويًا)
          </h3>
          <button
            type="button"
            onClick={closeShareModal}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="glass-surface-subtle rounded-xl p-3 space-y-1.5 text-sm">
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              {shareTarget.recordTitle}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300">
              الموعد / الاستحقاق: <span className="font-medium">{formattedDue}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              المختص المستلم {!shareTarget.specialistId && '(السجل غير مسند — اختر مستلمًا)'}
            </label>
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={selectedSpecialistId}
                onChange={(e) => setSelectedSpecialistId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— اختر المختص —</option>
                {db.specialists.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name} — {sp.departmentName}
                  </option>
                ))}
              </select>
            </div>
            {specialist && (
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-300">
                <span>الجوال: <span className="font-mono-tabular">{specialist.mobile}</span></span>
                <span>·</span>
                <span>البريد: <span className="font-mono-tabular">{specialist.email}</span></span>
              </div>
            )}
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              قناة المشاركة
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setChannel('whatsapp')}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                  channel === 'whatsapp'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-500'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <MessageCircle className="w-4 h-4" />
                <span>واتساب</span>
              </button>
              <button
                type="button"
                onClick={() => setChannel('email')}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                  channel === 'email'
                    ? 'bg-blue-50 border-blue-500 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-500'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <Mail className="w-4 h-4" />
                <span>البريد الإلكتروني</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              نص الرسالة قبل الفتح
            </label>
            <textarea
              rows={5}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              ملاحظة المعاينة: يفتح الرابط المرفق السجل على هذا المتصفح فقط لأن البيانات محفوظة محليًا في المرحلة الأولى، وعند فتح القناة يُسجّل الحدث بحالة «فُتحت المشاركة» بينما يتم الإرسال الفعلي من التطبيق الخارجي.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-200 dark:border-slate-700/70">
          <button
            type="button"
            onClick={closeShareModal}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            إلغاء
          </button>
          <a
            href={externalUrl}
            target={channel === 'whatsapp' ? '_blank' : undefined}
            rel={channel === 'whatsapp' ? 'noopener noreferrer' : undefined}
            onClick={handleChannelOpen}
            aria-disabled={!specialist}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              specialist
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500 pointer-events-none'
            }`}
          >
            <ExternalLink className="w-4 h-4" />
            <span>{channel === 'whatsapp' ? 'فتح واتساب وتسجيل المشاركة' : 'فتح البريد وتسجيل المشاركة'}</span>
          </a>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import {
  Download,
  ExternalLink,
  FileSpreadsheet,
  Mail,
  MessageCircle,
  Share2,
  UserCheck,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatDateTime, formatDisplayDate } from '../domain/dateUtils';
import { buildExternalShareUrl, buildRecordDeepLink } from '../domain/shareUtils';
import {
  buildReportExcelBuffer,
  buildReportPdfBlob,
  downloadReportExcel,
  downloadReportPdf,
  getReportFileBaseName,
} from '../domain/reportExport';
import {
  buildVat3APdfBlob,
  downloadVat3AExcel,
  downloadVat3APdf,
} from '../domain/vat3aExport';
import { ShareChannel } from '../types/domain';

export const ShareModal: React.FC = () => {
  const { db, shareTarget, closeShareModal, logShareOpened, showToast } = useApp();
  const [selectedSpecialistId, setSelectedSpecialistId] = useState<string>('');
  const [channel, setChannel] = useState<ShareChannel>('whatsapp');
  const [reportFormat, setReportFormat] = useState<'pdf' | 'excel'>('pdf');
  const [messageText, setMessageText] = useState('');
  const [sharingDevice, setSharingDevice] = useState(false);

  useEffect(() => {
    if (!shareTarget) return;
    const initialSpecId = shareTarget.specialistId || '';
    setSelectedSpecialistId(initialSpecId);
    setChannel('whatsapp');

    if (shareTarget.recordType === 'vat_3a' || shareTarget.recordType === 'report') {
      setReportFormat('pdf');
      setMessageText(shareTarget.defaultMessage);
      return;
    }

    const { url } = buildRecordDeepLink(shareTarget.recordType, shareTarget.recordId);
    const baseMsg = url
      ? `${shareTarget.defaultMessage}\n\nرابط السجل في المعاينة:\n${url}`
      : shareTarget.defaultMessage;
    setMessageText(baseMsg);
  }, [shareTarget]);

  if (!shareTarget) return null;

  const isVat3a = shareTarget.recordType === 'vat_3a' && !!shareTarget.vatDraft;
  const isReport = shareTarget.recordType === 'report' && !!shareTarget.reportSnapshot;
  const specialist = db.specialists.find((s) => s.id === selectedSpecialistId) || null;
  const formattedDue = shareTarget.scheduledInfo.includes('T')
    ? formatDateTime(shareTarget.scheduledInfo, db.preferences.showHijri)
    : isVat3a || isReport
    ? shareTarget.scheduledInfo
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
    logShareOpened(shareTarget, specialist, channel, messageText, 'فُتحت المشاركة');
    closeShareModal();
  };

  const handleDeviceShare = async () => {
    if (!shareTarget.vatDraft && !shareTarget.reportSnapshot) return;
    setSharingDevice(true);
    try {
      let shareFile: File;
      if (shareTarget.reportSnapshot) {
        const baseName = getReportFileBaseName(shareTarget.reportSnapshot);
        if (reportFormat === 'excel') {
          const buf = buildReportExcelBuffer(shareTarget.reportSnapshot);
          shareFile = new File([buf], `${baseName}.xlsx`, {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          });
        } else {
          const pdfBlob = await buildReportPdfBlob(shareTarget.reportSnapshot);
          shareFile = new File([pdfBlob], `${baseName}.pdf`, { type: 'application/pdf' });
        }
      } else {
        const pdfBlob = await buildVat3APdfBlob(shareTarget.vatDraft!);
        const fileName = `VAT_3A_${shareTarget.vatDraft!.periodStart}.pdf`;
        shareFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
      }

      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        const canShareFiles =
          typeof navigator.canShare === 'function' &&
          navigator.canShare({ files: [shareFile] });

        if (canShareFiles) {
          await navigator.share({
            title: shareTarget.recordTitle,
            text: messageText,
            files: [shareFile],
          });
          logShareOpened(
            shareTarget,
            specialist,
            'device',
            messageText,
            'تمت المشاركة عبر الجهاز'
          );
          closeShareModal();
          return;
        }
      }

      // Device/browser does not support file Web Share API -> download file directly for manual attachment
      if (shareTarget.reportSnapshot) {
        if (reportFormat === 'excel') {
          downloadReportExcel(shareTarget.reportSnapshot);
        } else {
          await downloadReportPdf(shareTarget.reportSnapshot);
        }
        showToast('الجهاز لا يدعم مشاركة الملفات مباشرة؛ تم تنزيل الملف لتتمكن من إرفاقه يدويًا في واتساب أو البريد.');
      } else if (shareTarget.vatDraft) {
        await downloadVat3APdf(shareTarget.vatDraft);
        showToast('المتصفح لا يدعم المشاركة المباشرة للملفات؛ تم تنزيل PDF لإرفاقه يدويًا.');
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        showToast('تعذّر إكمال المشاركة عبر الجهاز — يمكنك تنزيل الملف وإرفاقه يدويًا.');
      }
    } finally {
      setSharingDevice(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="مشاركة السجل"
    >
      <div className="glass-panel w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/10">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {isVat3a
              ? 'مشاركة نموذج ضريبة القيمة المضافة 3A'
              : isReport
              ? 'مشاركة تقرير العمليات والإحصاءات'
              : 'مشاركة مع المختص (يدويًا)'}
          </h3>
          <button
            type="button"
            onClick={closeShareModal}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
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
            <div className="text-xs text-slate-600 dark:text-slate-300 font-mono-tabular">
              {isVat3a || isReport ? 'النطاق:' : 'الموعد / الاستحقاق:'}{' '}
              <span className="font-medium">{formattedDue}</span>
            </div>
          </div>

          {isReport && shareTarget.reportSnapshot && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  ملف التقرير المرفق (حسب الفلاتر الحالية)
                </span>
                <div className="inline-flex rounded-lg p-0.5 bg-slate-100 dark:bg-[#14161b] border border-slate-200 dark:border-white/10 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setReportFormat('pdf')}
                    className={`px-2.5 py-1 rounded-md ${
                      reportFormat === 'pdf'
                        ? 'bg-white dark:bg-white/15 text-rose-600 dark:text-white shadow-sm'
                        : 'text-slate-500'
                    }`}
                  >
                    PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportFormat('excel')}
                    className={`px-2.5 py-1 rounded-md ${
                      reportFormat === 'excel'
                        ? 'bg-white dark:bg-white/15 text-emerald-600 dark:text-white shadow-sm'
                        : 'text-slate-500'
                    }`}
                  >
                    Excel
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={sharingDevice}
                  onClick={handleDeviceShare}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold disabled:opacity-60"
                >
                  <Share2 className="w-4 h-4" />
                  <span>{sharingDevice ? 'جارٍ التجهيز...' : 'مشاركة الملف عبر الجهاز'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadReportPdf(shareTarget.reportSnapshot!)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-300 dark:border-white/15 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10"
                >
                  <Download className="w-4 h-4 text-rose-500" />
                  <span>تنزيل PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadReportExcel(shareTarget.reportSnapshot!)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-300 dark:border-white/15 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                  <span>تنزيل Excel</span>
                </button>
              </div>
            </div>
          )}

          {isVat3a && shareTarget.vatDraft && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                مشاركة أو تنزيل مرفقات الإقرار
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={sharingDevice}
                  onClick={handleDeviceShare}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold disabled:opacity-60"
                >
                  <Share2 className="w-4 h-4" />
                  <span>{sharingDevice ? 'جارٍ التجهيز...' : 'مشاركة عبر الجهاز'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadVat3APdf(shareTarget.vatDraft!)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-300 dark:border-white/15 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10"
                >
                  <Download className="w-4 h-4 text-rose-500" />
                  <span>تحميل PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadVat3AExcel(shareTarget.vatDraft!)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-300 dark:border-white/15 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                  <span>تحميل Excel</span>
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              المختص المستلم {!shareTarget.specialistId && '(اختر مستلمًا لفتح واتساب أو البريد)'}
            </label>
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={selectedSpecialistId}
                onChange={(e) => setSelectedSpecialistId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <span>
                  الجوال: <span className="font-mono-tabular">{specialist.mobile}</span>
                </span>
                <span>·</span>
                <span>
                  البريد: <span className="font-mono-tabular">{specialist.email}</span>
                </span>
              </div>
            )}
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              قناة المشاركة المباشرة
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setChannel('whatsapp')}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                  channel === 'whatsapp'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-500'
                    : 'border-slate-200 dark:border-white/15 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
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
                    : 'border-slate-200 dark:border-white/15 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
                <Mail className="w-4 h-4" />
                <span>البريد الإلكتروني</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              نص الرسالة / الملخص قبل الفتح
            </label>
            <textarea
              rows={5}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              عند فتح واتساب أو البريد الإلكتروني يُسجّل الحدث بحالة «فُتحت المشاركة» ويتم الإرسال الفعلي من التطبيق الخارجي.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-200 dark:border-white/10">
          <button
            type="button"
            onClick={closeShareModal}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"
          >
            إغلاق
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
                : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-500 pointer-events-none'
            }`}
          >
            <ExternalLink className="w-4 h-4" />
            <span>
              {channel === 'whatsapp' ? 'فتح واتساب وتسجيل المشاركة' : 'فتح البريد وتسجيل المشاركة'}
            </span>
          </a>
        </div>
      </div>
    </div>
  );
};

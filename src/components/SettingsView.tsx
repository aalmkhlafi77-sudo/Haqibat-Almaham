import React, { useState } from 'react';
import { Moon, RotateCcw, Settings, Sun } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const SettingsView: React.FC = () => {
  const {
    db,
    setTheme,
    setShowHijri,
    setCurrentSpecialistId,
    setDocumentWarningDays,
    resetDemoData,
  } = useApp();

  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          <span>الإعدادات والتفضيلات</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          تُحفظ جميع الإعدادات محليًا وتبقى فعالة بعد إعادة تحميل الصفحة
        </p>
      </div>

      <div className="glass-panel rounded-xl p-5 space-y-5">
        {/* Theme */}
        <div className="space-y-2">
          <div className="text-sm font-bold text-slate-900 dark:text-white">المظهر العام</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`flex items-center gap-3 p-3.5 rounded-xl border text-right transition-colors ${
                db.preferences.theme === 'light'
                  ? 'border-blue-600 bg-blue-50/70 text-blue-900'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Sun className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <div className="text-sm font-bold">الوضع النهاري الفاتح (الافتراضي)</div>
                <div className="text-xs opacity-75">خلفية فاتحة وتلوين مباشر للعناصر</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`flex items-center gap-3 p-3.5 rounded-xl border text-right transition-colors ${
                db.preferences.theme === 'dark'
                  ? 'border-blue-400 bg-blue-950/60 text-blue-100'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Moon className="w-5 h-5 text-blue-400 shrink-0" />
              <div>
                <div className="text-sm font-bold">الوضع السينمائي الزجاجي</div>
                <div className="text-xs opacity-75">خلفية كحلية وأسطح شفافة ولمسات منضبطة</div>
              </div>
            </button>
          </div>
        </div>

        {/* Active Specialist for "مهامي" */}
        <div className="space-y-1.5 pt-3 border-t border-slate-200 dark:border-slate-800">
          <label className="block text-sm font-bold text-slate-900 dark:text-white">
            المستخدم النشط لعرض «مهامي»
          </label>
          <select
            value={db.preferences.currentSpecialistId}
            onChange={(e) => setCurrentSpecialistId(e.target.value)}
            className="w-full sm:w-80 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          >
            {db.specialists.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.departmentName}
              </option>
            ))}
          </select>
        </div>

        {/* Date Format */}
        <div className="space-y-1.5 pt-3 border-t border-slate-200 dark:border-slate-800">
          <div className="text-sm font-bold text-slate-900 dark:text-white">عرض التواريخ</div>
          <label className="inline-flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={db.preferences.showHijri}
              onChange={(e) => setShowHijri(e.target.checked)}
            />
            <span>إظهار التاريخ الهجري (أم القرى) بجانب الميلادي في التقويم والسجلات</span>
          </label>
        </div>

        {/* Document Warning Window */}
        <div className="space-y-1.5 pt-3 border-t border-slate-200 dark:border-slate-800">
          <label className="block text-sm font-bold text-slate-900 dark:text-white">
            نافذة التنبيه لقرب انتهاء الوثائق (مقترحة: 30 يومًا)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={180}
              value={db.preferences.documentWarningDays}
              onChange={(e) =>
                setDocumentWarningDays(
                  Math.max(1, Math.min(180, Number(e.target.value) || 30))
                )
              }
              className="w-24 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono-tabular"
            />
            <span className="text-xs text-slate-500 dark:text-slate-400">يوم قبل الانتهاء</span>
          </div>
        </div>

        {/* Reset Demo Data */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              إعادة ضبط البيانات التجريبية
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              استعادة السجلات الافتراضية لهذه المعاينة المحلية
            </div>
          </div>

          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-300 dark:border-rose-700 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>استعادة البيانات التجريبية</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-300"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  resetDemoData();
                  setConfirmReset(false);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold"
              >
                تأكيد الاستعادة
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Phase 1 Scope Notice */}
      <div className="glass-panel rounded-xl p-5 space-y-2">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
          نطاق المرحلة الأولى وما أُجّل للمراحل التالية
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          تعمل هذه النواة على التخزين المحلي ببيانات تجريبية. أما الربط مع خادم Node.js/Express وقاعدة بيانات MySQL على هوستنجر، واستيراد قالبَي Excel، والترحيل من «بيّنة قضيتي»، والتصدير إلى Excel وPDF، وتطبيق أندرويد، والإرسال الآلي لواتساب والبريد، والمساعد الذكي «اسأل بيّنة» فهي مؤجلة للدفعات المعتمدة التالية.
        </p>
      </div>
    </div>
  );
};

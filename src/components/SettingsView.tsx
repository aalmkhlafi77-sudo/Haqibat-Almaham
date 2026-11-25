import React, { useState } from 'react';
import {
  Bot,
  Calculator,
  Moon,
  RotateCcw,
  Server,
  Settings,
  Sun,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { toEnglishDigits } from '../domain/dateUtils';
import {
  buildDefaultVat3ARulesConfig,
  CUSTOMIZABLE_VAT_LINE_IDS,
  getEffectiveLineRule,
  VAT_3A_LINE_DEFINITIONS,
} from '../domain/vat3aEngine';
import {
  IntegrationSettings,
  Vat3AAdjustmentDirection,
  Vat3ALineId,
  Vat3ATaxMethod,
} from '../types/domain';
import { StatusBadge } from './StatusBadge';

export const SettingsView: React.FC = () => {
  const {
    db,
    setTheme,
    setShowHijri,
    setCurrentSpecialistId,
    setDocumentWarningDays,
    setVat3ARules,
    updateIntegrations,
    testServerConnection,
    testAiConnection,
    resetDemoData,
    showToast,
  } = useApp();

  const [confirmReset, setConfirmReset] = useState(false);
  const [testingServer, setTestingServer] = useState(false);
  const [testingAi, setTestingAi] = useState(false);

  const rules = db.preferences.vat3aRules;
  const integrations = db.preferences.integrations;

  const updateLineRule = (
    lineId: Vat3ALineId,
    patch: Partial<{
      adjustmentDirection: Vat3AAdjustmentDirection;
      taxMethod: Vat3ATaxMethod;
      customRatePercent: number | null;
    }>
  ) => {
    const curr = rules.lineRules[lineId] || {
      adjustmentDirection: 'add',
      taxMethod: 'rate',
      customRatePercent: null,
    };
    setVat3ARules({
      ...rules,
      lineRules: {
        ...rules.lineRules,
        [lineId]: { ...curr, ...patch },
      },
    });
  };

  const handleTestServer = async () => {
    setTestingServer(true);
    await testServerConnection(integrations.serverBaseUrl);
    setTestingServer(false);
  };

  const handleTestAi = async () => {
    setTestingAi(true);
    await testAiConnection(
      integrations.serverBaseUrl,
      integrations.aiProvider,
      integrations.aiModelName
    );
    setTestingAi(false);
  };

  const renderConnBadge = (status: IntegrationSettings['serverStatus']) => {
    if (status === 'connected') {
      return <StatusBadge label="متصل" tone="success" icon="check" />;
    }
    return <StatusBadge label="غير متصل" tone="neutral" icon="alert" />;
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          <span>الإعدادات والتفضيلات</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          تُحفظ جميع الإعدادات محليًا وتبقى فعالة بعد إعادة تحميل الصفحة
        </p>
      </div>

      {/* General Appearance, Dates, Active Specialist */}
      <div className="glass-panel rounded-xl p-5 space-y-5">
        <div className="space-y-2">
          <div className="text-sm font-bold text-slate-900 dark:text-white">المظهر العام</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`flex items-center gap-3 p-3.5 rounded-xl border text-right transition-colors ${
                db.preferences.theme === 'light'
                  ? 'border-blue-600 bg-blue-50/70 text-blue-900'
                  : 'border-slate-200 dark:border-white/15 text-slate-700 dark:text-slate-300'
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
                  ? 'border-blue-400 bg-white/10 text-white'
                  : 'border-slate-200 dark:border-white/15 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Moon className="w-5 h-5 text-blue-400 shrink-0" />
              <div>
                <div className="text-sm font-bold">الوضع السينمائي الأسود</div>
                <div className="text-xs opacity-75">خلفية سوداء وأسطح رمادية داكنة زجاجية</div>
              </div>
            </button>
          </div>
        </div>

        <div className="space-y-1.5 pt-3 border-t border-slate-200 dark:border-white/10">
          <label className="block text-sm font-bold text-slate-900 dark:text-white">
            المستخدم النشط لعرض «مهامي»
          </label>
          <select
            value={db.preferences.currentSpecialistId}
            onChange={(e) => setCurrentSpecialistId(e.target.value)}
            className="w-full sm:w-80 rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] px-3 py-2 text-sm"
          >
            {db.specialists.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.departmentName}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5 pt-3 border-t border-slate-200 dark:border-white/10">
          <div className="text-sm font-bold text-slate-900 dark:text-white">عرض التواريخ</div>
          <label className="inline-flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={db.preferences.showHijri}
              onChange={(e) => setShowHijri(e.target.checked)}
            />
            <span>إظهار التاريخ الهجري (أم القرى) بجانب الميلادي بأرقام إنجليزية 0–9</span>
          </label>
        </div>

        <div className="space-y-1.5 pt-3 border-t border-slate-200 dark:border-white/10">
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
              className="w-24 rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] px-3 py-2 text-sm font-mono-tabular"
            />
            <span className="text-xs text-slate-500 dark:text-slate-400">يوم قبل الانتهاء</span>
          </div>
        </div>
      </div>

      {/* VAT 3A Calculation Rules Section */}
      <div className="glass-panel rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-500" />
              <span>قواعد حساب 3A</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              تُطبّق هذه القواعد على المسودات الجديدة، بينما تحتفظ المسودات المحفوظة مسبقًا بنتائجها إلا عند اختيار إعادة الاحتساب داخل النموذج.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setVat3ARules(buildDefaultVat3ARulesConfig());
              showToast('تمت استعادة قواعد 3A الافتراضية (البند 1 بالطرح · 15%).');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-white/15 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>استعادة الافتراضي</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl glass-surface-subtle">
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
            النسبة الضريبية الافتراضية (%):
          </label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            dir="ltr"
            value={rules.defaultRatePercent}
            onChange={(e) => {
              const val = Math.max(0, Math.min(100, Number(e.target.value)));
              setVat3ARules({
                ...rules,
                defaultRatePercent: Number.isNaN(val) ? 15 : val,
              });
            }}
            className="w-24 rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0e1015] px-2.5 py-1.5 text-sm font-mono-tabular text-center"
          />
          <span className="text-xs text-slate-500 dark:text-slate-400">
            يُحتفظ البند 9 بمعاملته الخاصة للاحتساب العكسي كما في وثيقة 3A.
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#14161b] border-b border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200">
                <th className="text-right py-2.5 px-3">اسم البند</th>
                <th className="text-right py-2.5 px-3">طريقة تطبيق التعديل</th>
                <th className="text-right py-2.5 px-3">طريقة احتساب الضريبة</th>
                <th className="text-right py-2.5 px-3">النسبة الفعلية (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/10">
              {CUSTOMIZABLE_VAT_LINE_IDS.map((lineId) => {
                const def = VAT_3A_LINE_DEFINITIONS.find((d) => d.id === lineId)!;
                const rule = rules.lineRules[lineId] || {
                  adjustmentDirection: 'add',
                  taxMethod: 'rate',
                  customRatePercent: null,
                };
                const eff = getEffectiveLineRule(rules, lineId);

                return (
                  <tr key={lineId} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02]">
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                      <span className="font-mono-tabular text-emerald-600 dark:text-emerald-400 ml-1">
                        {lineId}.
                      </span>
                      {def.name}
                    </td>
                    <td className="py-2 px-3">
                      <select
                        value={rule.adjustmentDirection}
                        onChange={(e) =>
                          updateLineRule(lineId, {
                            adjustmentDirection: e.target.value as Vat3AAdjustmentDirection,
                          })
                        }
                        className="w-full min-w-[140px] rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0e1015] px-2 py-1.5 text-xs"
                      >
                        <option value="subtract">يُطرح من المبلغ</option>
                        <option value="add">يُضاف إلى المبلغ</option>
                      </select>
                    </td>
                    <td className="py-2 px-3">
                      <select
                        value={rule.taxMethod}
                        onChange={(e) =>
                          updateLineRule(lineId, {
                            taxMethod: e.target.value as Vat3ATaxMethod,
                          })
                        }
                        className="w-full min-w-[165px] rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0e1015] px-2 py-1.5 text-xs"
                      >
                        <option value="rate">تُحسب بالنسبة المحددة</option>
                        <option value="zero">أثر ضريبي صفري</option>
                      </select>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          dir="ltr"
                          disabled={rule.taxMethod === 'zero'}
                          value={
                            rule.taxMethod === 'zero'
                              ? 0
                              : rule.customRatePercent ?? ''
                          }
                          placeholder={toEnglishDigits(String(rules.defaultRatePercent))}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateLineRule(lineId, {
                              customRatePercent:
                                v === '' ? null : Math.max(0, Math.min(100, Number(v))),
                            });
                          }}
                          className="w-20 rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0e1015] px-2 py-1 text-center font-mono-tabular text-xs disabled:opacity-50"
                        />
                        <span className="text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400">
                          الفعلي: {toEnglishDigits(String(eff.effectiveRatePercent))}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Server & AI Integration Settings (Keys remain server-side only) */}
      <div className="glass-panel rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-blue-500" />
            <span>تكاملات الخادم والذكاء الاصطناعي</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
            تُحفظ مفاتيح الربط وكلمات مرور قاعدة البيانات على الخادم فقط (لا تُخزّن أي مفاتيح سرية داخل المتصفح). يظل النظام يعمل محليًا بالكامل عند عدم الاتصال.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Backend Server Connection */}
          <div className="glass-surface-subtle rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                {integrations.serverStatus === 'connected' ? (
                  <Wifi className="w-4 h-4 text-emerald-500" />
                ) : (
                  <WifiOff className="w-4 h-4 text-slate-400" />
                )}
                <span>خادم البيانات (Node.js / MySQL)</span>
              </div>
              {renderConnBadge(integrations.serverStatus)}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                مسار الخادم (Base URL)
              </label>
              <input
                type="url"
                dir="ltr"
                value={integrations.serverBaseUrl}
                onChange={(e) =>
                  updateIntegrations({
                    serverBaseUrl: e.target.value,
                    serverStatus: 'disconnected',
                  })
                }
                placeholder="https://api.yourdomain.com"
                className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0e1015] px-3 py-2 text-xs font-mono-tabular"
              />
            </div>

            {integrations.serverStatusMessage && (
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                {integrations.serverStatusMessage}
              </p>
            )}

            <button
              type="button"
              disabled={testingServer}
              onClick={handleTestServer}
              className="px-3.5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold disabled:opacity-60"
            >
              {testingServer ? 'جارٍ اختبار الاتصال...' : 'اختبار الاتصال بالخادم'}
            </button>
          </div>

          {/* AI Provider Connection (Keys stay on server) */}
          <div className="glass-surface-subtle rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-violet-500" />
                <span>المساعد الذكي (عبر الخادم)</span>
              </div>
              {renderConnBadge(integrations.aiStatus)}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  المزود
                </label>
                <select
                  value={integrations.aiProvider}
                  onChange={(e) =>
                    updateIntegrations({
                      aiProvider: e.target.value as IntegrationSettings['aiProvider'],
                      aiStatus: 'disconnected',
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0e1015] px-2.5 py-2 text-xs"
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI Compatible</option>
                  <option value="custom">مسار مخصص على الخادم</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  النموذج
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={integrations.aiModelName}
                  onChange={(e) =>
                    updateIntegrations({
                      aiModelName: e.target.value,
                      aiStatus: 'disconnected',
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0e1015] px-2.5 py-2 text-xs font-mono-tabular"
                />
              </div>
            </div>

            {integrations.aiStatusMessage && (
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                {integrations.aiStatusMessage}
              </p>
            )}

            <button
              type="button"
              disabled={testingAi}
              onClick={handleTestAi}
              className="px-3.5 py-2 rounded-lg border border-violet-300 dark:border-violet-500/40 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/40 text-xs font-semibold disabled:opacity-60"
            >
              {testingAi ? 'جارٍ الفحص...' : 'اختبار مسار الذكاء الاصطناعي'}
            </button>
          </div>
        </div>
      </div>

      {/* Reset Demo Data */}
      <div className="glass-panel rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
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
  );
};

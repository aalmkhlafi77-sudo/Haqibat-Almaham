import React, { useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  KeyRound,
  LogIn,
  Moon,
  RefreshCw,
  Server,
  ShieldCheck,
  Sun,
  UserCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DEMO_ACCOUNTS } from '../domain/authPermissions';

export const LoginView: React.FC = () => {
  const {
    db,
    toggleTheme,
    serverAuthStatus,
    pendingDeepLink,
    refreshServerAuthStatus,
    loginDemoAccount,
    bootstrapServerAdmin,
    loginServerAccount,
  } = useApp();

  const isDark = db.preferences.theme === 'dark';
  const [selectedTab, setTab] = useState<'local_demo' | 'server'>('local_demo');
  const tab = serverAuthStatus.shared ? 'server' : selectedTab;
  const [selectedDemoId, setSelectedDemoId] = useState<string>(DEMO_ACCOUNTS[0].id);

  // Server login / bootstrap form state
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const res = loginDemoAccount(selectedDemoId);
    if (!res.ok) {
      setErrorMsg(res.error || 'تعذر تسجيل الدخول التجريبي.');
    }
  };

  const handleServerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    try {
      if (!serverAuthStatus.shared && !serverAuthStatus.hasAdminAccount && !serverAuthStatus.envAdminConfigured) {
        const res = await bootstrapServerAdmin({
          username,
          displayName: displayName || 'مدير النظام',
          password,
        });
        if (!res.ok) setErrorMsg(res.error || 'تعذر إنشاء حساب المدير الأول.');
      } else {
        const res = await loginServerAccount(username, password);
        if (!res.ok) setErrorMsg(res.error || 'بيانات الدخول غير صحيحة.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-2xl space-y-4">
        {/* Top Bar with Theme Switch */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">حقيبة المهام</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                متابعة المهام والوثائق والجلسات وضريبة القيمة المضافة 3A
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع السينمائي'}
            aria-label={isDark ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع السينمائي'}
            className="h-10 w-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#14161b] text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Pending Deep-Link Indicator */}
        {pendingDeepLink && (
          <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/90 dark:bg-blue-950/50 px-4 py-3 text-xs text-blue-900 dark:text-blue-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>
              يوجد رابط سجل أو قسم مطلوب في العنوان؛ بعد تسجيل الدخول سيتم فتحه تلقائيًا إذا توفرت الصلاحية لحسابك.
            </span>
          </div>
        )}

        {/* Auth Card */}
        <div className="glass-panel rounded-2xl p-5 sm:p-6 space-y-5 shadow-xl">
          {/* Mode Tabs */}
          {!serverAuthStatus.shared && <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-[#14161b] border border-slate-200 dark:border-white/10">
            <button
              type="button"
              onClick={() => {
                setTab('local_demo');
                setErrorMsg('');
              }}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition-colors ${
                tab === 'local_demo'
                  ? 'bg-white dark:bg-white/15 text-blue-700 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>المعاينة المحلية (دخول تجريبي)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('server');
                setErrorMsg('');
                refreshServerAuthStatus();
              }}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition-colors ${
                tab === 'server'
                  ? 'bg-white dark:bg-white/15 text-emerald-700 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Server className="w-4 h-4" />
              <span>الخادم المشترك (حسابات فعلية)</span>
            </button>
          </div>}

          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-3.5 py-2.5 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {tab === 'local_demo' ? (
            <form onSubmit={handleDemoSubmit} className="space-y-4">
              <div className="rounded-xl border border-amber-200 dark:border-amber-800/80 bg-amber-50/80 dark:bg-amber-950/35 px-3.5 py-2.5 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                <strong>تنبيه الشفافية:</strong> المعاينة الحالية تعمل بحفظ محلي داخل المتصفح فقط، لذا فإن تسجيل الدخول هنا <strong>تجريبي</strong> لاختبار الأدوار وحجب الإجراءات غير المصرح بها، بينما التحقق الفعلي من الحسابات وكلمات المرور يتم عبر تبويب «الخادم المشترك».
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                  اختر حسابًا تجريبيًا للدخول:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {DEMO_ACCOUNTS.map((acc) => {
                    const selected = selectedDemoId === acc.id;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => setSelectedDemoId(acc.id)}
                        className={`text-right p-3 rounded-xl border transition-colors ${
                          selected
                            ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/40 dark:border-blue-400'
                            : 'border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">
                            {acc.displayName}
                          </span>
                          <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                            {acc.roleLabel}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                          {acc.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-bold"
                >
                  <LogIn className="w-4 h-4" />
                  <span>دخول إلى المعاينة المحلية</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {!serverAuthStatus.reachable ? (
                <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4 space-y-3 text-center">
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    تعذّر الاتصال بخادم حقيبة المهام. أعد المحاولة بعد قليل.
                  </p>
                  <button
                    type="button"
                    onClick={refreshServerAuthStatus}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-white/15 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/10"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>إعادة فحص الخادم</span>
                  </button>
                </div>
              ) : !serverAuthStatus.shared && !serverAuthStatus.hasAdminAccount && !serverAuthStatus.envAdminConfigured ? (
                <form onSubmit={handleServerSubmit} className="space-y-3.5">
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/35 px-3.5 py-2.5 text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      <strong>إعداد حساب المدير الأول على الخادم:</strong> لم يُضبط رمز <code className="font-mono-tabular">ADMIN_PASSCODE</code> بعد ولم يُفعّل مدير أول. أنشئ كلمة مرور قوية لحساب المدير الآن (تُحفظ مجزأة بالخوارزمية <code className="font-mono-tabular">scrypt</code> على الخادم فقط).
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        اسم المستخدم للمدير *
                      </label>
                      <input
                        type="text"
                        required
                        minLength={3}
                        dir="ltr"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="admin"
                        className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] px-3 py-2 text-sm font-mono-tabular"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        الاسم الظاهر
                      </label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="فهد الدوسري"
                        className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      كلمة المرور (6 أحرف على الأقل) *
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      dir="ltr"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] px-3 py-2 text-sm font-mono-tabular"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-sm font-bold disabled:opacity-60"
                    >
                      <KeyRound className="w-4 h-4" />
                      <span>{submitting ? 'جارٍ التفعيل...' : 'تفعيل حساب المدير والدخول'}</span>
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleServerSubmit} className="space-y-3.5">
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/35 px-3.5 py-2.5 text-xs text-emerald-900 dark:text-emerald-200">
                    متصل بالخادم الفعلي — يتم التحقق من كلمة المرور والصلاحيات على الخادم عبر جلسة محمية (<code className="font-mono-tabular">HttpOnly Cookie</code>).
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      اسم المستخدم
                    </label>
                    <input
                      type="text"
                      required
                      dir="ltr"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="admin أو اسم المستخدم المضاف"
                      className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] px-3 py-2 text-sm font-mono-tabular"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      كلمة المرور
                    </label>
                    <input
                      type="password"
                      required
                      dir="ltr"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] px-3 py-2 text-sm font-mono-tabular"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-bold disabled:opacity-60"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>{submitting ? 'جارٍ التحقق...' : 'تسجيل الدخول عبر الخادم'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

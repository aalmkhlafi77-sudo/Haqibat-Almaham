import { HaqibatMark } from './HaqibatBrand';
import React, { useId, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Activity,
  Check,
  Eye,
  EyeOff,
  Lock,
  User,
  Zap,
  Moon,
  RefreshCw,
  Server,
  ShieldCheck,
  Sun,
  UserCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DEMO_ACCOUNTS } from '../domain/authPermissions';


type LaunchState = 'idle' | 'charging' | 'complete';

function LaunchButton({ state, label }: { state: LaunchState; label: string }) {
  return (
    <button
      type="submit"
      className={`haq-launch haq-launch--${state}`}
      disabled={state !== 'idle'}
      aria-busy={state === 'charging'}
      onPointerMove={({ currentTarget, clientX, clientY }) => {
        const bounds = currentTarget.getBoundingClientRect();
        currentTarget.style.setProperty('--bx', `${100 * (clientX - bounds.left) / bounds.width}%`);
        currentTarget.style.setProperty('--by', `${100 * (clientY - bounds.top) / bounds.height}%`);
      }}
    >
      {state === 'charging' && <span className="haq-launch-progress" aria-hidden="true" />}
      <span className="haq-launch-shockwave" aria-hidden="true" />
      <span className="relative flex items-center justify-center gap-2" role="status">
        {state === 'complete' ? <Check size={18} aria-hidden="true" /> :
          state === 'charging' ? <Activity size={18} aria-hidden="true" /> :
          <Zap size={18} aria-hidden="true" />}
        {state === 'complete' ? 'تم تسجيل الدخول' : state === 'charging' ? 'جارٍ التحقق…' : label}
      </span>
    </button>
  );
}

interface LoginFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'username' | 'name' | 'current-password' | 'new-password';
  required?: boolean;
  minLength?: number;
}

function LoginField({ label, value, onChange, autoComplete, required, minLength }: LoginFieldProps) {
  const id = useId();
  const isPassword = autoComplete.endsWith('password');
  const [visible, setVisible] = useState(false);
  const Icon = isPassword ? Lock : User;

  return (
    <div className="haq-login-field" data-filled={Boolean(value)}>
      <input
        id={id}
        type={isPassword && !visible ? 'password' : 'text'}
        autoComplete={autoComplete}
        dir={autoComplete === 'name' ? 'auto' : 'ltr'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        minLength={minLength}
      />
      <label htmlFor={id}>{label}</label>
      <div className="haq-login-field-icons">
        <Icon size={18} aria-hidden="true" />
        {isPassword && (
          <button type="button" onClick={() => setVisible(!visible)}
            aria-label={visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}>
            {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        )}
      </div>
    </div>
  );
}

export function LoginView({ onLaunchChange }: { onLaunchChange: (active: boolean) => void }) {
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
  const [launchState, setLaunchState] = useState<LaunchState>('idle');
  const submitting = useRef(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function submitLogin(
    event: React.FormEvent,
    authenticate: () => { ok: boolean; error?: string } | Promise<{ ok: boolean; error?: string }>,
    fallbackError: string,
  ) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setErrorMsg('');
    onLaunchChange(true);
    setLaunchState('charging');
    const startedAt = performance.now();
    try {
      const result = await authenticate();
      if (!result.ok) {
        setErrorMsg(result.error || fallbackError);
        return;
      }
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const remainingCharge = 380 - (performance.now() - startedAt);
      if (!reducedMotion && remainingCharge > 0) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, remainingCharge));
      }
      setLaunchState('complete');
      await new Promise<void>((resolve) => window.setTimeout(resolve, reducedMotion ? 200 : 600));
    } catch {
      setErrorMsg(fallbackError);
    } finally {
      submitting.current = false;
      setLaunchState('idle');
      onLaunchChange(false);
    }
  }

  const handleDemoSubmit = (event: React.FormEvent) =>
    void submitLogin(event, () => loginDemoAccount(selectedDemoId), 'تعذر تسجيل الدخول التجريبي.');

  const handleServerSubmit = (event: React.FormEvent) => {
    const needsAdmin = !serverAuthStatus.shared && !serverAuthStatus.hasAdminAccount && !serverAuthStatus.envAdminConfigured;
    return void submitLogin(event, () => needsAdmin
      ? bootstrapServerAdmin({ username, displayName: displayName || 'مدير النظام', password })
      : loginServerAccount(username, password),
    needsAdmin ? 'تعذر إنشاء حساب المدير الأول.' : 'بيانات الدخول غير صحيحة.');
  };

  return (
    <div className="w-full min-w-0">
      <div className="w-full max-w-2xl space-y-4">
        {/* Top Bar with Theme Switch */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <HaqibatMark />
            <div>
              <h2 className="text-lg font-bold text-[#fff0d8]">حقيبة المهام</h2>
              <p className="text-xs text-[#ded0bb]">
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

        <style>{loginStyles}</style>
        {/* Auth Card */}
        <div className="haq-login-neon rounded-2xl p-5 sm:p-6 space-y-5">
          {/* Mode Tabs */}
          {!serverAuthStatus.shared && <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-[#14161b] border border-slate-200 dark:border-white/10">
            <button
              type="button"
              disabled={launchState !== 'idle'}
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
              disabled={launchState !== 'idle'}
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
                <LaunchButton state={launchState} label="دخول إلى المعاينة المحلية" />
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
                    <LoginField label="اسم المستخدم للمدير" value={username} onChange={setUsername} autoComplete="username" required minLength={3} />
                    <LoginField label="الاسم الظاهر" value={displayName} onChange={setDisplayName} autoComplete="name" />
                  </div>

                  <LoginField label="كلمة المرور (6 أحرف على الأقل)" value={password} onChange={setPassword} autoComplete="new-password" required minLength={6} />

                  <div className="flex justify-end">
                    <LaunchButton state={launchState} label="تفعيل حساب المدير والدخول" />
                  </div>
                </form>
              ) : (
                <form onSubmit={handleServerSubmit} className="space-y-3.5">
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/35 px-3.5 py-2.5 text-xs text-emerald-900 dark:text-emerald-200">
                    متصل بالخادم الفعلي — يتم التحقق من كلمة المرور والصلاحيات على الخادم عبر جلسة محمية (<code className="font-mono-tabular">HttpOnly Cookie</code>).
                  </div>

                  <LoginField label="اسم المستخدم" value={username} onChange={setUsername} autoComplete="username" required />

                  <LoginField label="كلمة المرور" value={password} onChange={setPassword} autoComplete="current-password" required />

                  <div className="flex justify-end">
                    <LaunchButton state={launchState} label="تسجيل الدخول عبر الخادم" />
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Glass Neon Login (UI Vault) and Fluid Morph Execute Button (Cinematic UI Showcase).
const loginStyles = `
.haq-login-neon {
  --neon-accent: #67e8f9;
  --neon-glass-opacity: .13;
  --neon-blur: 16px;
  --neon-hue-speed: 6s;
  --neon-pulse-speed: 4s;
  position: relative;
  isolation: isolate;
  border: 1px solid color-mix(in srgb, var(--neon-accent) 45%, transparent);
  background: rgb(160 192 216 / var(--neon-glass-opacity));
  backdrop-filter: blur(var(--neon-blur));
}
.haq-login-neon::before {
  position: absolute;
  z-index: -1;
  inset: 0;
  content: '';
  border-radius: inherit;
  pointer-events: none;
  background: linear-gradient(150deg, rgb(255 255 255 / .12), transparent 55%);
  box-shadow: 0 0 25px color-mix(in srgb, var(--neon-accent) 40%, transparent);
  animation: haq-neon-hue var(--neon-hue-speed) linear infinite, haq-neon-pulse var(--neon-pulse-speed) ease-in-out infinite;
}
@keyframes haq-neon-hue { to { filter: hue-rotate(360deg); } }
@keyframes haq-neon-pulse { 50% { opacity: .55; } }
.haq-login-field {
  position: relative;
  margin-block: .55rem;
  border-bottom: 1px solid rgb(255 255 255 / .45);
}
.haq-login-field:focus-within { border-color: var(--neon-accent); }
.haq-login-field input {
  width: 100%;
  min-height: 46px;
  padding: 8px 4px 4px 74px;
  border: 0;
  outline: 0;
  color: white;
  background: transparent;
}
.haq-login-field label {
  position: absolute;
  right: 4px;
  top: 12px;
  color: #f1f5f9;
  pointer-events: none;
  transition: top .2s, font-size .2s, color .2s;
}
.haq-login-field:focus-within label,
.haq-login-field[data-filled="true"] label,
.haq-login-field:has(input:autofill) label {
  top: -12px;
  font-size: .75rem;
  color: var(--neon-accent);
}
.haq-login-field-icons {
  display: flex;
  align-items: center;
  gap: 2px;
  position: absolute;
  left: 4px;
  top: 6px;
  color: #dbeafe;
}
.haq-login-field-icons button { padding: 6px; border-radius: 6px; }
.haq-launch {
  position: relative;
  padding: 16px 36px;
  border-radius: 999px;
  border: 1px solid rgba(103, 232, 249, 0.4);
  background: radial-gradient(circle at var(--bx, 50%) var(--by, 50%), rgba(103, 232, 249, 0.3) 0%, rgba(15, 23, 42, 0.95) 70%);
  color: #ffffff;
  cursor: pointer;
  overflow: visible;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5), inset 0 2px 4px rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease, border-color 0.25s ease;
}

.haq-launch:not(:disabled):hover {
  transform: scale(1.05);
  box-shadow: 0 16px 40px rgba(6, 182, 212, 0.4), inset 0 3px 6px rgba(255, 255, 255, 0.5);
  border-color: rgba(251, 191, 36, 0.8);
}

.haq-launch--charging {
  transform: scale(0.96);
  border-color: #fbbf24;
}

.haq-launch--complete {
  transform: scale(1.02);
  border-color: #34d399;
  background: radial-gradient(circle at 50% 50%, rgba(52, 211, 153, 0.35) 0%, rgba(15, 23, 42, 0.95) 70%);
}

.haq-launch-progress {
  position: absolute;
  inset: 0;
  border-radius: inherit;

  background: linear-gradient(90deg, rgba(251, 191, 36, 0.4) 0%, rgba(6, 182, 212, 0.4) 100%);
  animation: haq-launch-charge .38s ease-in-out both;
}

@keyframes haq-launch-charge {
  from { clip-path: inset(0 100% 0 0 round 999px); }
  to { clip-path: inset(0 round 999px); }
}

.haq-launch-shockwave {
  position: absolute;
  inset: -3px;
  border-radius: 999px;
  border: 2px solid #34d399;
  opacity: 0;
  pointer-events: none;
}

.haq-launch--complete .haq-launch-shockwave {
  animation: haq-launch-ring 0.6s ease-out forwards;
}

@keyframes haq-launch-ring {
  0% { transform: scale(0.8); opacity: 1; }
  100% { transform: scale(1.4); opacity: 0; }
}

.haq-launch { width: 100%; min-height: 48px; padding: 10px 16px; }
.haq-launch:focus-visible, .haq-login-field-icons button:focus-visible {
  outline: 2px solid var(--neon-accent);
  outline-offset: 3px;
}
.haq-launch--charging { cursor: wait; }
@media (prefers-reduced-motion: reduce) {
  .haq-login-neon::before, .haq-launch-progress,
  .haq-launch--complete .haq-launch-shockwave { animation: none; }
  .haq-launch, .haq-login-field label { transition: none; }
  .haq-launch:not(:disabled):hover, .haq-launch:disabled { transform: none; }
}
`;

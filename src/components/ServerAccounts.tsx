import { Eye, EyeOff, KeyRound, Pencil, Shield, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useApp } from '../context/AppContext';
import { PRIMARY_ADMIN_ID, ROLE_LABELS } from '../domain/authPermissions';
import type { AuthUser, UserRole } from '../types/domain';
import { StatusBadge } from './StatusBadge';

type AccountDetails = Pick<AuthUser, 'username' | 'displayName' | 'email' | 'role'>;
type AccountAction = { kind: 'create' } | { kind: 'edit' | 'reset' | 'delete'; user: AuthUser };

const blankDetails: AccountDetails = { username: '', displayName: '', email: '', role: 'operations' };
const fieldClass = 'w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-[#14161b]';
const secondaryClass = 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10';

export function ServerAccounts() {
  const { currentUser, serverAuthStatus, logout, refreshServerAuthStatus } = useApp();
  const formId = useId();
  const formHeading = useRef<HTMLHeadingElement>(null);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [action, setAction] = useState<AccountAction>({ kind: 'create' });
  const [details, setDetails] = useState<AccountDetails>(blankDetails);
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function loadUsers(signal?: AbortSignal) {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/users', { credentials: 'include', cache: 'no-store', signal });
      const result = await res.json() as { users?: AuthUser[]; error?: string };
      if (!res.ok || !result.users) throw new Error(result.error || 'تعذّر تحميل قائمة المستخدمين.');
      setUsers(result.users);
    } catch (error) {
      if (!signal?.aborted) setMessage({ error: true, text: error instanceof Error ? error.message : 'تعذّر تحميل قائمة المستخدمين.' });
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadUsers(controller.signal);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (action.kind !== 'create') formHeading.current?.focus();
  }, [action]);

  function selectAction(next: AccountAction) {
    setAction(next);
    setDetails(next.kind === 'edit' ? {
      username: next.user.username, displayName: next.user.displayName, email: next.user.email, role: next.user.role,
    } : blankDetails);
    setPassword('');
    setVisible(false);
    setMessage(null);
  }

  const target = action.kind === 'create' ? undefined : action.user;
  const ownAccount = target?.id === currentUser?.id;
  const heading = {
    create: 'إضافة حساب', edit: 'تعديل الحساب', reset: 'إعادة تعيين كلمة المرور', delete: 'حذف الحساب',
  }[action.kind];
  const needsPassword = action.kind === 'create' || action.kind === 'reset';

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || loading) return;
    setPending(true);
    setVisible(false);
    setMessage(null);
    try {
      const baseUrl = '/api/auth/users';
      const accountUrl = target ? `${baseUrl}/${encodeURIComponent(target.id)}` : baseUrl;
      const method = action.kind === 'edit' ? 'PATCH' : action.kind === 'delete' ? 'DELETE' : 'POST';
      const body = action.kind === 'create' ? { ...details, password, email: details.email.trim() || undefined }
        : action.kind === 'edit' ? details : action.kind === 'reset' ? { password } : undefined;
      const res = await fetch(action.kind === 'reset' ? `${accountUrl}/reset-password` : accountUrl, {
        method, credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: body && JSON.stringify(body),
      });
      const result = await res.json() as { user?: AuthUser; error?: string };
      if (!res.ok) throw new Error(result.error || 'تعذّر تنفيذ الإجراء.');
      if (action.kind === 'reset' && ownAccount) {
        await logout();
        return;
      }
      if (action.kind === 'edit' && ownAccount) await refreshServerAuthStatus();
      if (action.kind === 'delete') setUsers((list) => list.filter((user) => user.id !== target?.id));
      if (result.user) {
        const account = result.user;
        setUsers((list) => list.some((user) => user.id === account.id)
          ? list.map((user) => user.id === account.id ? account : user)
          : [...list, account]);
      }
      selectAction({ kind: 'create' });
      setMessage({ error: false, text: `تم تنفيذ «${heading}» بنجاح.` });
    } catch (error) {
      setMessage({ error: true, text: error instanceof Error ? error.message : 'تعذّر الاتصال بالخادم.' });
    } finally {
      setPending(false);
    }
  }

  const minimumLength = serverAuthStatus.shared ? 12 : 6;

  return (
    <section aria-label="إدارة حسابات الخادم والصلاحيات" className="glass-panel space-y-4 rounded-xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
          <Shield className="size-4 text-blue-500" aria-hidden="true" />
          إدارة حسابات الخادم والصلاحيات
        </h2>
        <button type="button" disabled={pending || loading} className={secondaryClass} onClick={() => void loadUsers()}>
          تحديث القائمة
        </button>
      </div>

      <form onSubmit={submit} aria-labelledby={`${formId}-title`} className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-white/10">
        <h3 ref={formHeading} tabIndex={-1} id={`${formId}-title`} className="break-words text-sm font-semibold">
          {heading}{target && ` · ${target.displayName}`}
        </h3>
        {action.kind === 'delete' && (
          <p className="text-sm text-rose-700 dark:text-rose-300">سيُحذف حساب الدخول وتُنهى جلساته. تبقى سجلات العمل وبيانات المختص المرتبط بالحساب.</p>
        )}
        {action.kind === 'reset' && (
          <p className="text-xs text-slate-600 dark:text-slate-300">
            ستنتهي جلسات الحساب فور تعيين كلمة المرور الجديدة.
          </p>
        )}
        <fieldset disabled={pending || loading} className="grid min-w-0 gap-3 sm:grid-cols-2">
          {(action.kind === 'create' || action.kind === 'edit') && (
            <>
              <label className="space-y-1 text-xs font-semibold">
                <span>اسم المستخدم</span>
                <input className={fieldClass} dir="ltr" required minLength={3} maxLength={100} autoComplete="off"
                  value={details.username} onChange={(event) => setDetails({ ...details, username: event.target.value })} />
              </label>
              <label className="space-y-1 text-xs font-semibold">
                <span>الاسم الظاهر</span>
                <input className={fieldClass} maxLength={200} value={details.displayName}
                  onChange={(event) => setDetails({ ...details, displayName: event.target.value })} />
              </label>
              <label className="space-y-1 text-xs font-semibold">
                <span>البريد الإلكتروني (اختياري)</span>
                <input className={fieldClass} dir="ltr" type="email" maxLength={254} value={details.email}
                  onChange={(event) => setDetails({ ...details, email: event.target.value })} />
              </label>
              <label className="space-y-1 text-xs font-semibold">
                <span>الدور</span>
                <select className={fieldClass} value={details.role} disabled={ownAccount && action.kind === 'edit'}
                  onChange={(event) => setDetails({ ...details, role: event.target.value as UserRole })}>
                  {Object.entries(ROLE_LABELS).map(([role, label]) => <option key={role} value={role}>{label}</option>)}
                </select>
              </label>
            </>
          )}
          {needsPassword && (
            <div className="space-y-1">
              <label htmlFor={`${formId}-password`} className="text-xs font-semibold">كلمة المرور الجديدة ({minimumLength}+)</label>
              <div className="flex gap-1.5">
                <input id={`${formId}-password`} className={fieldClass} type={visible ? 'text' : 'password'} dir="ltr"
                  required minLength={minimumLength} maxLength={256} autoComplete="new-password"
                  value={password} onChange={(event) => setPassword(event.target.value)} />
                <button type="button" className={secondaryClass} aria-controls={`${formId}-password`}
                  aria-label={visible ? 'إخفاء كلمة المرور الجديدة' : 'إظهار كلمة المرور الجديدة'}
                  onClick={() => setVisible(!visible)}>
                  {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                </button>
              </div>
            </div>
          )}
        </fieldset>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={pending || loading}
            className={`rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 ${action.kind === 'delete' ? 'bg-rose-700' : 'bg-blue-600'}`}>
            {pending ? 'جارٍ التنفيذ…' : action.kind === 'delete' ? 'تأكيد الحذف' : action.kind === 'edit' ? 'حفظ التعديل' : heading}
          </button>
          {action.kind !== 'create' && (
            <button type="button" disabled={pending || loading} className={secondaryClass} onClick={() => selectAction({ kind: 'create' })}>إلغاء</button>
          )}
        </div>
      </form>

      {message && (
        <p role={message.error ? 'alert' : 'status'} className={`text-xs font-medium ${message.error ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
          {message.text}
        </p>
      )}

      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-white/10 dark:border-white/10">
        {users.map((user) => {
          const owner = user.id === PRIMARY_ADMIN_ID;
          const self = user.id === currentUser?.id;
          return (
            <li key={user.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-xs">
              <div className="min-w-0">
                <span className="break-words font-bold">{user.displayName}</span>
                <span dir="ltr" className="ms-2 break-all text-slate-600 dark:text-slate-300">@{user.username}</span>
                <span className="ms-2 inline-block"><StatusBadge label={owner ? 'مالك النظام' : user.roleLabel} tone="info" /></span>
              </div>
              {(!owner || self) && (
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" disabled={pending || loading} className={secondaryClass} onClick={() => selectAction({ kind: 'edit', user })}>
                    <Pencil className="size-3.5" aria-hidden="true" /> تعديل
                  </button>
                  <button type="button" disabled={pending || loading} className={secondaryClass} onClick={() => selectAction({ kind: 'reset', user })}>
                    <KeyRound className="size-3.5" aria-hidden="true" /> إعادة تعيين كلمة المرور
                  </button>
                  {!self && (
                    <button type="button" disabled={pending || loading} className={secondaryClass + ' text-rose-700 dark:text-rose-300'}
                      onClick={() => selectAction({ kind: 'delete', user })}>
                      <Trash2 className="size-3.5" aria-hidden="true" /> حذف
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

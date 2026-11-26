import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  Bot,
  Calculator,
  Check,
  DatabaseBackup,
  Download,
  Edit3,
  FolderKanban,
  Lock,
  Moon,
  Plus,
  RotateCcw,
  Server,
  Settings,
  Shield,
  Sun,
  Tag,
  Trash2,
  Upload,
  UserPlus,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { effectiveGeminiModel } from '../domain/assistant';
import { ROLE_LABELS } from '../domain/authPermissions';
import {
  BACKUP_SCHEMA_VERSION,
  computeBackupSummaryCounts,
  validateBackupFileText,
  type BackupValidationResult,
} from '../domain/backupUtils';
import { toEnglishDigits } from '../domain/dateUtils';
import {
  buildDefaultVat3ARulesConfig,
  CUSTOMIZABLE_VAT_LINE_IDS,
  getEffectiveLineRule,
  VAT_3A_LINE_DEFINITIONS,
} from '../domain/vat3aEngine';
import {
  AuthUser,
  IntegrationSettings,
  UrgentAlertDays,
  UrgentAlertMotionMode,
  UserRole,
  Vat3AAdjustmentDirection,
  Vat3ALineId,
  Vat3ATaxMethod,
} from '../types/domain';
import { StatusBadge } from './StatusBadge';

export const SettingsView: React.FC = () => {
  const {
    db,
    currentUser,
    authMode,
    serverAuthStatus,
    lastBackupMeta,
    hasPerm,
    setTheme,
    setShowHijri,
    setCurrentSpecialistId,
    setDocumentWarningDays,
    setUrgentAlertDays,
    setUrgentAlertMotion,
    setVat3ARules,
    saveDocumentCategory,
    deleteDocumentCategory,
    getDocumentCategoryDeleteImpact,
    saveTaskType,
    deleteTaskType,
    getTaskTypeDeleteImpact,
    updateIntegrations,
    testServerConnection,
    testAiConnection,
    exportBackup,
    restoreBackup,
    resetDemoData,
    showToast,
  } = useApp();

  const [confirmReset, setConfirmReset] = useState(false);
  const [testingServer, setTestingServer] = useState(false);
  const [testingAi, setTestingAi] = useState(false);

  // Backup & Restore state
  const backupInputRef = useRef<HTMLInputElement | null>(null);
  const [backupValidation, setBackupValidation] = useState<BackupValidationResult | null>(null);
  const [backupFileName, setBackupFileName] = useState('');
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [exportingBackup, setExportingBackup] = useState(false);

  // Server User Management state (available when connected as Server Admin)
  const [serverUsersList, setServerUsersList] = useState<AuthUser[]>([]);
  const [newStaffUsername, setNewStaffUsername] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<UserRole>('operations');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [staffMessage, setStaffMessage] = useState('');

  // Document Categories management state
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);
  const [catDeleteMode, setCatDeleteMode] = useState<'transfer' | 'clear'>('transfer');
  const [catReplacementId, setCatReplacementId] = useState<string>('');

  // Task Types management state
  const [newTaskTypeName, setNewTaskTypeName] = useState('');
  const [newTaskTypeAdminKind, setNewTaskTypeAdminKind] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingTypeName, setEditingTypeName] = useState('');
  const [deletingTypeId, setDeletingTypeId] = useState<string | null>(null);
  const [typeReplacementId, setTypeReplacementId] = useState<string>('');

  const rules = db.preferences.vat3aRules;
  const integrations = db.preferences.integrations;
  const [modelDraft, setModelDraft] = useState<string | null>(null);
  const geminiModel = modelDraft ?? effectiveGeminiModel(integrations.aiModelName);

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
    await testAiConnection(geminiModel);
    setTestingAi(false);
  };

  const canManageSettings = hasPerm('settings:manage');
  const canDeleteRecords = hasPerm('records:delete');
  const canExportBackup = hasPerm('backups:export');
  const canRestoreBackup = hasPerm('backups:restore');
  const canEditVatRules = hasPerm('vat3a:edit');
  const currentCounts = computeBackupSummaryCounts(db);

  const handleBackupFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBackupFileName(file.name);
    try {
      const text = await file.text();
      const result = validateBackupFileText(text);
      setBackupValidation(result);
    } catch {
      setBackupValidation({
        ok: false,
        error: 'تعذرت قراءة ملف النسخة الاحتياطية؛ لم تتغير البيانات الحالية.',
      });
    }
  };

  const handleConfirmRestore = async () => {
    if (!backupValidation?.ok || !backupValidation.envelope) return;
    setRestoringBackup(true);
    try {
      const res = await restoreBackup(backupValidation.envelope);
      if (!res.ok) {
        setBackupValidation({
          ok: false,
          error: res.error || 'تعذرت الاستعادة — تم الإبقاء على البيانات الحالية سليمة.',
        });
      } else {
        setBackupValidation(null);
        setBackupFileName('');
      }
    } finally {
      setRestoringBackup(false);
    }
  };

  const handleLoadServerUsers = async () => {
    try {
      const res = await fetch('/api/auth/users', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { users?: AuthUser[] };
        setServerUsersList(data.users || []);
      }
    } catch {
      // ignore
    }
  };

  const handleCreateServerUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffMessage('');
    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          username: newStaffUsername,
          displayName: newStaffName || newStaffUsername,
          role: newStaffRole,
          password: newStaffPassword,
        }),
      });
      const data = (await res.json()) as { user?: AuthUser; error?: string };
      if (!res.ok) {
        setStaffMessage(data.error || 'تعذر إنشاء الحساب على الخادم.');
        return;
      }
      setNewStaffUsername('');
      setNewStaffName('');
      setNewStaffPassword('');
      setStaffMessage(`تم إنشاء حساب «${data.user?.displayName}» (${data.user?.roleLabel}) بنجاح.`);
      await handleLoadServerUsers();
    } catch {
      setStaffMessage('تعذر الاتصال بالخادم لإنشاء الحساب.');
    }
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

        {/* Urgent Upcoming Motion Alerts */}
        <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <BellRing className="w-4 h-4 text-amber-500" />
            <span>التنبيه الحركي للمهام والمواعيد القريبة</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            تظهر حركة وتوهّج لطيف على السجلات النشطة غير المكتملة عند اقتراب موعدها، وتتوقف الحركة فور إكمال السجل أو إلغائه أو أرشفته.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                بدء التنبيه قبل الموعد بـ
              </label>
              <div className="flex gap-2">
                {([3, 5] as UrgentAlertDays[]).map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setUrgentAlertDays(days)}
                    className={`flex-1 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                      db.preferences.urgentAlertDays === days
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200'
                        : 'border-slate-200 dark:border-white/15 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <span className="font-mono-tabular">{toEnglishDigits(String(days))}</span> أيام
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                نمط الحركة
              </label>
              <select
                aria-label="نمط حركة الشارات العاجلة"
                value={db.preferences.urgentAlertMotion}
                onChange={(e) =>
                  setUrgentAlertMotion(e.target.value as UrgentAlertMotionMode)
                }
                className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] px-3 py-2 text-xs font-semibold"
              >
                <option value="repeat_5s">تكرار كل 5 ثوانٍ (توهج واهتزاز لطيف)</option>
                <option value="continuous">نبض مستمر (توهج هادئ)</option>
                <option value="strong_shake">اهتزاز قوي ملفت (تأرجح سريع من الأطراف)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Document Categories CRUD */}
      <div className="glass-panel rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-teal-500" />
            <span>تصنيفات الوثائق والتراخيص والتجديدات</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            إضافة وتعديل وحذف تصنيفات الوثائق. ترتبط الوثائق بمعرّف ثابت للتصنيف ليظهر التعديل فورًا في الوثائق وسجلات تجديداتها دون حذف أي سجل.
          </p>
        </div>

        {canManageSettings ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newCategoryName.trim()) return;
              const created = saveDocumentCategory({ name: newCategoryName });
              if (created) setNewCategoryName('');
            }}
            className="flex flex-wrap items-center gap-2"
          >
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="اسم تصنيف جديد (مثال: تصاريح بيئية)..."
              className="flex-1 min-w-[200px] rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة تصنيف</span>
            </button>
          </form>
        ) : (
          <p className="text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            <span>عرض فقط — تعديل أو حذف تصنيفات الوثائق يتطلب صلاحية إدارة الإعدادات.</span>
          </p>
        )}

        <div className="divide-y divide-slate-100 dark:divide-white/10 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
          {db.documentCategories.map((cat) => {
            const count = db.documents.filter((d) => d.categoryId === cat.id).length;
            const isEditing = editingCatId === cat.id;
            return (
              <div
                key={cat.id}
                className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 bg-white/60 dark:bg-white/[0.02]"
              >
                {isEditing ? (
                  <div className="flex-1 flex items-center gap-2 min-w-[220px]">
                    <input
                      type="text"
                      value={editingCatName}
                      onChange={(e) => setEditingCatName(e.target.value)}
                      className="flex-1 rounded-lg border border-teal-400 bg-white dark:bg-[#0e1015] px-2.5 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (saveDocumentCategory({ id: cat.id, name: editingCatName })) {
                          setEditingCatId(null);
                        }
                      }}
                      className="p-1.5 rounded-lg bg-teal-600 text-white"
                      title="حفظ الاسم"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingCatId(null)}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/70 dark:hover:bg-white/10"
                      title="إلغاء"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {cat.name}
                    </span>
                    <span className="text-[11px] font-mono-tabular px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                      {toEnglishDigits(String(count))} وثيقة
                    </span>
                  </div>
                )}

                {!isEditing && canManageSettings && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCatId(cat.id);
                        setEditingCatName(cat.name);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/15 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>تعديل</span>
                    </button>
                    {canDeleteRecords && (
                      <button
                        type="button"
                        onClick={() => {
                          const others = db.documentCategories.filter((c) => c.id !== cat.id);
                          setDeletingCatId(cat.id);
                          setCatDeleteMode(others.length > 0 ? 'transfer' : 'clear');
                          setCatReplacementId(others[0]?.id || '');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-800/70 text-[11px] font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>حذف</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Task Types CRUD */}
      <div className="glass-panel rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Tag className="w-4 h-4 text-blue-500" />
            <span>أنواع المهام</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            إدارة قائمة أنواع المهام الظاهرة في نموذج المهمة وفلتر شاشة المهام، مع الحفاظ على ربط مهام التجديد بالوثيقة وحقول الخطابات الإدارية.
          </p>
        </div>

        {canManageSettings ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newTaskTypeName.trim()) return;
              const created = saveTaskType({
                name: newTaskTypeName,
                isAdminKind: newTaskTypeAdminKind,
              });
              if (created) {
                setNewTaskTypeName('');
                setNewTaskTypeAdminKind(false);
              }
            }}
            className="space-y-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={newTaskTypeName}
                onChange={(e) => setNewTaskTypeName(e.target.value)}
                placeholder="اسم نوع مهمة جديد (مثال: متابعة ميدانية)..."
                className="flex-1 min-w-[200px] rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة نوع</span>
              </button>
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={newTaskTypeAdminKind}
                onChange={(e) => setNewTaskTypeAdminKind(e.target.checked)}
              />
              <span>يتضمن حقول الخطاب والجهة وتاريخ الاستلام (مثل المهام الإدارية)</span>
            </label>
          </form>
        ) : (
          <p className="text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            <span>عرض فقط — تعديل أو حذف أنواع المهام يتطلب صلاحية إدارة الإعدادات.</span>
          </p>
        )}

        <div className="divide-y divide-slate-100 dark:divide-white/10 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
          {db.taskTypes.map((tt) => {
            const count = db.tasks.filter((t) => t.typeId === tt.id).length;
            const isEditing = editingTypeId === tt.id;
            return (
              <div
                key={tt.id}
                className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 bg-white/60 dark:bg-white/[0.02]"
              >
                {isEditing ? (
                  <div className="flex-1 flex items-center gap-2 min-w-[220px]">
                    <input
                      type="text"
                      value={editingTypeName}
                      onChange={(e) => setEditingTypeName(e.target.value)}
                      className="flex-1 rounded-lg border border-blue-400 bg-white dark:bg-[#0e1015] px-2.5 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (saveTaskType({ id: tt.id, name: editingTypeName })) {
                          setEditingTypeId(null);
                        }
                      }}
                      className="p-1.5 rounded-lg bg-blue-600 text-white"
                      title="حفظ الاسم"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingTypeId(null)}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/70 dark:hover:bg-white/10"
                      title="إلغاء"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {tt.name}
                    </span>
                    <span className="text-[11px] font-mono-tabular px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                      {toEnglishDigits(String(count))} مهمة
                    </span>
                    {tt.isRenewalKind && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                        نوع التجديد المرتبط بالوثائق
                      </span>
                    )}
                    {tt.isAdminKind && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        حقول الخطاب والجهة
                      </span>
                    )}
                  </div>
                )}

                {!isEditing && canManageSettings && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTypeId(tt.id);
                        setEditingTypeName(tt.name);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/15 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>تعديل</span>
                    </button>
                    {canDeleteRecords && (
                      <button
                        type="button"
                        disabled={db.taskTypes.length <= 1}
                        onClick={() => {
                          const others = db.taskTypes.filter((x) => x.id !== tt.id);
                          setDeletingTypeId(tt.id);
                          setTypeReplacementId(others[0]?.id || '');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-800/70 text-[11px] font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-40"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>حذف</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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
          {canEditVatRules && (
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
          )}
        </div>

        {!canEditVatRules && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/35 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              قواعد حساب 3A محمية بصلاحية المحاسب الضريبي أو مدير النظام؛ الحساب الحالي ({currentUser?.roleLabel}) يملك صلاحية العرض فقط.
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl glass-surface-subtle">
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
            النسبة الضريبية العامة (%):
          </label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            dir="ltr"
            disabled={!canEditVatRules}
            value={rules.defaultRatePercent}
            onChange={(e) => {
              const val = Math.max(0, Math.min(100, Number(e.target.value)));
              setVat3ARules({
                ...rules,
                defaultRatePercent: Number.isNaN(val) ? 15 : val,
              });
            }}
            className="w-24 rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0e1015] px-2.5 py-1.5 text-sm font-mono-tabular text-center disabled:opacity-50"
          />
          <span className="text-xs text-slate-500 dark:text-slate-400">
            تبدأ النسبة العامة من 15% وتُستخدم للبنود التي لم تُحدَّد لها نسبة خاصة أو أثر صفري.
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#14161b] border-b border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200">
                <th className="text-right py-2.5 px-3">البند</th>
                <th className="text-right py-2.5 px-3">اتجاه التعديل</th>
                <th className="text-right py-2.5 px-3">طريقة الضريبة</th>
                <th className="text-right py-2.5 px-3">النسبة (عامة أو خاصة)</th>
                <th className="text-right py-2.5 px-3">النسبة الفعلية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/10">
              {CUSTOMIZABLE_VAT_LINE_IDS.map((lineId) => {
                const def = VAT_3A_LINE_DEFINITIONS.find((d) => d.id === lineId)!;
                const isReverseCharge = lineId === 9;
                const rule = rules.lineRules[lineId] || {
                  adjustmentDirection: isReverseCharge ? 'subtract' : 'add',
                  taxMethod: 'rate',
                  customRatePercent: null,
                };
                const eff = getEffectiveLineRule(rules, lineId);
                const usesCustomRate =
                  rule.customRatePercent !== null &&
                  rule.customRatePercent !== undefined &&
                  !Number.isNaN(rule.customRatePercent);

                return (
                  <tr
                    key={lineId}
                    className={
                      isReverseCharge
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/30'
                        : 'hover:bg-slate-50/70 dark:hover:bg-white/[0.02]'
                    }
                  >
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                      <span className="font-mono-tabular text-emerald-600 dark:text-emerald-400 ml-1">
                        {lineId}.
                      </span>
                      {def.name}
                      {isReverseCharge && (
                        <span className="block text-[11px] font-normal text-emerald-700 dark:text-emerald-300 mt-0.5">
                          الاحتساب العكسي · خانة التعديل: الجزء غير القابل للخصم
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {isReverseCharge ? (
                        <div className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          الجزء غير القابل للخصم (عكسي)
                        </div>
                      ) : (
                        <select
                          aria-label={`اتجاه التعديل للبند ${lineId}`}
                          disabled={!canEditVatRules}
                          value={rule.adjustmentDirection}
                          onChange={(e) =>
                            updateLineRule(lineId, {
                              adjustmentDirection: e.target.value as Vat3AAdjustmentDirection,
                            })
                          }
                          className="w-full min-w-[140px] rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0e1015] px-2 py-1.5 text-xs disabled:opacity-50"
                        >
                          <option value="subtract">طرح (يُطرح من المبلغ)</option>
                          <option value="add">جمع (يُضاف إلى المبلغ)</option>
                        </select>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <select
                        aria-label={`طريقة الضريبة للبند ${lineId}`}
                        disabled={!canEditVatRules}
                        value={rule.taxMethod}
                        onChange={(e) =>
                          updateLineRule(lineId, {
                            taxMethod: e.target.value as Vat3ATaxMethod,
                          })
                        }
                        className="w-full min-w-[170px] rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0e1015] px-2 py-1.5 text-xs disabled:opacity-50"
                      >
                        <option value="rate">
                          {isReverseCharge
                            ? 'احتساب عكسي بالنسبة المحددة'
                            : 'احتساب بالنسبة المحددة'}
                        </option>
                        <option value="zero">أثر ضريبي صفري</option>
                      </select>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <select
                          aria-label={`نوع النسبة للبند ${lineId}`}
                          disabled={!canEditVatRules || rule.taxMethod === 'zero'}
                          value={usesCustomRate ? 'custom' : 'global'}
                          onChange={(e) => {
                            const mode = e.target.value;
                            updateLineRule(lineId, {
                              customRatePercent:
                                mode === 'custom'
                                  ? rule.customRatePercent ?? rules.defaultRatePercent
                                  : null,
                            });
                          }}
                          className="rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0e1015] px-2 py-1 text-xs disabled:opacity-50"
                        >
                          <option value="global">
                            عامة ({toEnglishDigits(String(rules.defaultRatePercent))}%)
                          </option>
                          <option value="custom">خاصة بالبند</option>
                        </select>
                        {usesCustomRate && (
                          <input
                            type="number"
                            aria-label={`النسبة الخاصة للبند ${lineId}`}
                            min={0}
                            max={100}
                            step={0.5}
                            dir="ltr"
                            disabled={!canEditVatRules || rule.taxMethod === 'zero'}
                            value={rule.customRatePercent ?? ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              updateLineRule(lineId, {
                                customRatePercent:
                                  v === '' ? null : Math.max(0, Math.min(100, Number(v))),
                              });
                            }}
                            className="w-20 rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0e1015] px-2 py-1 text-center font-mono-tabular text-xs disabled:opacity-50"
                          />
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 font-mono-tabular">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md font-bold ${
                          eff.taxMethod === 'zero'
                            ? 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                            : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        {toEnglishDigits(String(eff.effectiveRatePercent))}%
                      </span>
                      {rule.taxMethod === 'zero' && usesCustomRate && (
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          محفوظة {toEnglishDigits(String(rule.customRatePercent))}% (معطّلة بالأثر الصفري)
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          ملاحظة: تبقى بنود الإجمالي (6، 12، 13، 16) للقراءة فقط، بينما يُدخَل البندان 14 (تصحيحات فترات سابقة) و15 (رصيد ضريبي مرحّل) مباشرة في حقليهما داخل النموذج.
        </p>
      </div>

      {/* Server & AI Integration Settings (Keys remain server-side only) */}
      <div className="glass-panel rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-blue-500" />
            <span>تكاملات الخادم والذكاء الاصطناعي</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
            تُحفظ مفاتيح الربط وكلمات مرور قاعدة البيانات على الخادم فقط (لا تُخزّن أي مفاتيح سرية داخل المتصفح). {authMode === 'server' ? 'يحتاج حفظ السجلات المشتركة إلى الاتصال بالخادم.' : 'تظل المعاينة المحلية متاحة عند عدم الاتصال.'}
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
                disabled={!canManageSettings || authMode === 'server'}
                value={authMode === 'server' ? window.location.origin + '/api' : integrations.serverBaseUrl}
                onChange={(e) =>
                  updateIntegrations({
                    serverBaseUrl: e.target.value,
                    serverStatus: 'disconnected',
                  })
                }
                placeholder="https://api.yourdomain.com"
                className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0e1015] px-3 py-2 text-xs font-mono-tabular disabled:opacity-50"
              />
            </div>

            {integrations.serverStatusMessage && (
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                {integrations.serverStatusMessage}
              </p>
            )}

            <button
              type="button"
              disabled={!canManageSettings || testingServer}
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
                <input
                  readOnly
                  value="Google Gemini"
                  aria-label="مزود المساعد الذكي"
                  className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0e1015] px-2.5 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  النموذج
                </label>
                <input
                  type="text"
                  dir="ltr"
                  disabled={!canManageSettings || authMode !== 'server' || testingAi}
                  aria-label="نموذج Gemini"
                  value={geminiModel}
                  onChange={(e) => setModelDraft(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0e1015] px-2.5 py-2 text-xs font-mono-tabular disabled:opacity-50"
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
              disabled={!canManageSettings || authMode !== 'server' || testingAi || !geminiModel.trim()}
              onClick={handleTestAi}
              className="px-3.5 py-2 rounded-lg border border-violet-300 dark:border-violet-500/40 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/40 text-xs font-semibold disabled:opacity-60"
            >
              {testingAi ? 'جارٍ الفحص...' : 'اختبار اتصال Gemini وحفظ النموذج'}
            </button>
          </div>
        </div>
      </div>

      {/* Backup & Restore Section */}
      <div className="glass-panel rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <DatabaseBackup className="w-4 h-4 text-emerald-500" />
              <span>النسخ الاحتياطية والاستعادة</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              تصدير نسخة احتياطية كاملة واستعادتها بأمان. تُستبعد كلمات المرور ومفاتيح الاتصال السرية دائمًا من النسخة القابلة للتنزيل.
            </p>
          </div>
          <div className="text-left text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400">
            <div>إصدار البنية: {BACKUP_SCHEMA_VERSION}</div>
            <div>
              آخر نسخة:{' '}
              {lastBackupMeta
                ? toEnglishDigits(lastBackupMeta.createdAt.replace('T', ' '))
                : 'لم تُنشأ بعد'}
            </div>
          </div>
        </div>

        {/* Scope & Metadata Summary */}
        <div className="glass-surface-subtle rounded-xl p-3.5 space-y-2 text-xs">
          <div className="font-bold text-slate-800 dark:text-slate-200">
            محتويات النسخة الحالية ({authMode === 'server' ? 'الخادم المشترك' : 'بيانات المتصفح المحلية'}):
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
            <div>
              المهام:{' '}
              <span className="font-bold font-mono-tabular">
                {toEnglishDigits(String(currentCounts.tasks))}
              </span>
            </div>
            <div>
              الوثائق والتجديدات:{' '}
              <span className="font-bold font-mono-tabular">
                {toEnglishDigits(String(currentCounts.documents))} /{' '}
                {toEnglishDigits(String(currentCounts.documentRenewals))}
              </span>
            </div>
            <div>
              القضايا والجلسات:{' '}
              <span className="font-bold font-mono-tabular">
                {toEnglishDigits(String(currentCounts.cases))} /{' '}
                {toEnglishDigits(String(currentCounts.sessions))}
              </span>
            </div>
            <div>
              الوكالات والتقويم:{' '}
              <span className="font-bold font-mono-tabular">
                {toEnglishDigits(String(currentCounts.poas))} /{' '}
                {toEnglishDigits(String(currentCounts.calendarItems))}
              </span>
            </div>
            <div>
              التصنيفات والأنواع:{' '}
              <span className="font-bold font-mono-tabular">
                {toEnglishDigits(String(currentCounts.documentCategories))} /{' '}
                {toEnglishDigits(String(currentCounts.taskTypes))}
              </span>
            </div>
            <div>
              الملصقات وسجل المشاركة:{' '}
              <span className="font-bold font-mono-tabular">
                {toEnglishDigits(String(currentCounts.labels))} /{' '}
                {toEnglishDigits(String(currentCounts.shareLogs))}
              </span>
            </div>
            <div>
              مسودات وأرشيف 3A:{' '}
              <span className="font-bold font-mono-tabular">
                {toEnglishDigits(String(currentCounts.vat3aDrafts))} (مؤرشف:{' '}
                {toEnglishDigits(String(currentCounts.vat3aArchivedDrafts))})
              </span>
            </div>
            <div>
              قواعد 3A المحفوظة:{' '}
              <span className="font-bold font-mono-tabular">
                {toEnglishDigits(String(db.preferences.vat3aRules.defaultRatePercent))}%
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/70 dark:border-white/10">
            في المعاينة المحلية تُحفظ كل السجلات وروابطها وقواعد 3A؛ وفي النسخة المرتبطة بالخادم المشترك تُضمّن المرفقات الثنائية ضمن خطة النسخ والاستعادة الإدارية، ويُلزم اختبار الاستعادة على بيانات تجريبية قبل أي استخدام تشغيلي.
          </p>
        </div>

        {!canExportBackup && !canRestoreBackup ? (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/35 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              النسخ الاحتياطي والاستعادة محصوران بصلاحية إدارية؛ الحساب الحالي ({currentUser?.roleLabel}) لا يملك صلاحية تنفيذ هذه الإجراءات.
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                disabled={!canExportBackup || exportingBackup}
                onClick={async () => {
                  setExportingBackup(true);
                  const res = await exportBackup();
                  setExportingBackup(false);
                  if (!res.ok && res.error) showToast(res.error);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 text-xs font-semibold"
              >
                <Download className="w-4 h-4" />
                <span>
                  {exportingBackup ? 'جارٍ تجهيز النسخة...' : 'تنزيل نسخة احتياطية (JSON)'}
                </span>
              </button>

              <input
                ref={backupInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleBackupFileSelected}
                className="hidden"
                aria-label="اختيار ملف نسخة احتياطية للاستعادة"
              />
              <button
                type="button"
                disabled={!canRestoreBackup}
                onClick={() => backupInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-50 text-xs font-semibold"
              >
                <Upload className="w-4 h-4 text-blue-500" />
                <span>اختيار ملف للاستعادة</span>
              </button>
            </div>

            {/* Validation Error or Pre-Confirmation Summary */}
            {backupValidation && !backupValidation.ok && (
              <div
                role="alert"
                className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/45 p-3.5 text-xs text-rose-800 dark:text-rose-200 flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">تم رفض ملف الاستعادة ({backupFileName})</div>
                    <p className="mt-0.5 leading-relaxed">{backupValidation.error}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setBackupValidation(null)}
                  className="p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/50"
                  aria-label="إغلاق التنبيه"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {backupValidation?.ok && backupValidation.envelope && backupValidation.counts && (
              <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/35 p-4 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-blue-900 dark:text-blue-200">
                    تم التحقق من سلامة الملف ({backupFileName}) — ملخص ما سيُستبدل قبل التأكيد
                  </div>
                  <span className="font-mono-tabular text-[11px] text-blue-700 dark:text-blue-300">
                    أُنشئت: {toEnglishDigits(backupValidation.envelope.createdAt.replace('T', ' '))} ·{' '}
                    {backupValidation.envelope.schemaVersion}
                  </span>
                </div>

                <div className="overflow-x-auto rounded-lg border border-blue-200/80 dark:border-blue-800/70 bg-white/80 dark:bg-[#0e1015]">
                  <table className="w-full text-[11px] border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400">
                        <th className="text-right py-2 px-3">العنصر</th>
                        <th className="text-right py-2 px-3">الحالة الحالية (ستُستبدل)</th>
                        <th className="text-right py-2 px-3">النسخة المختارة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/10 font-mono-tabular">
                      <tr>
                        <td className="py-1.5 px-3 font-sans font-semibold">المهام</td>
                        <td className="py-1.5 px-3">{toEnglishDigits(String(currentCounts.tasks))}</td>
                        <td className="py-1.5 px-3 font-bold text-blue-700 dark:text-blue-300">
                          {toEnglishDigits(String(backupValidation.counts.tasks))}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 font-sans font-semibold">الوثائق وسجلات التجديد</td>
                        <td className="py-1.5 px-3">
                          {toEnglishDigits(String(currentCounts.documents))} ({toEnglishDigits(String(currentCounts.documentRenewals))} تجديد)
                        </td>
                        <td className="py-1.5 px-3 font-bold text-blue-700 dark:text-blue-300">
                          {toEnglishDigits(String(backupValidation.counts.documents))} ({toEnglishDigits(String(backupValidation.counts.documentRenewals))} تجديد)
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 font-sans font-semibold">القضايا والجلسات والوكالات</td>
                        <td className="py-1.5 px-3">
                          {toEnglishDigits(String(currentCounts.cases))} / {toEnglishDigits(String(currentCounts.sessions))} / {toEnglishDigits(String(currentCounts.poas))}
                        </td>
                        <td className="py-1.5 px-3 font-bold text-blue-700 dark:text-blue-300">
                          {toEnglishDigits(String(backupValidation.counts.cases))} / {toEnglishDigits(String(backupValidation.counts.sessions))} / {toEnglishDigits(String(backupValidation.counts.poas))}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 font-sans font-semibold">عناصر التقويم والملصقات</td>
                        <td className="py-1.5 px-3">
                          {toEnglishDigits(String(currentCounts.calendarItems))} / {toEnglishDigits(String(currentCounts.labels))}
                        </td>
                        <td className="py-1.5 px-3 font-bold text-blue-700 dark:text-blue-300">
                          {toEnglishDigits(String(backupValidation.counts.calendarItems))} / {toEnglishDigits(String(backupValidation.counts.labels))}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 font-sans font-semibold">التصنيفات وأنواع المهام</td>
                        <td className="py-1.5 px-3">
                          {toEnglishDigits(String(currentCounts.documentCategories))} / {toEnglishDigits(String(currentCounts.taskTypes))}
                        </td>
                        <td className="py-1.5 px-3 font-bold text-blue-700 dark:text-blue-300">
                          {toEnglishDigits(String(backupValidation.counts.documentCategories))} / {toEnglishDigits(String(backupValidation.counts.taskTypes))}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 font-sans font-semibold">مسودات وأرشيف 3A</td>
                        <td className="py-1.5 px-3">
                          {toEnglishDigits(String(currentCounts.vat3aDrafts))} (مؤرشف: {toEnglishDigits(String(currentCounts.vat3aArchivedDrafts))})
                        </td>
                        <td className="py-1.5 px-3 font-bold text-blue-700 dark:text-blue-300">
                          {toEnglishDigits(String(backupValidation.counts.vat3aDrafts))} (مؤرشف: {toEnglishDigits(String(backupValidation.counts.vat3aArchivedDrafts))})
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p className="text-[11px] text-blue-800 dark:text-blue-300">
                  تؤخذ لقطة أمان من الحالة الحالية تلقائيًا قبل التطبيق؛ وإذا فشل أي جزء من الاستعادة تبقى البيانات الحالية سليمة كما هي.
                </p>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBackupValidation(null);
                      setBackupFileName('');
                    }}
                    className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-white/15 text-xs font-medium"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    disabled={restoringBackup}
                    onClick={handleConfirmRestore}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold disabled:opacity-60"
                  >
                    {restoringBackup ? 'جارٍ الاستعادة...' : 'تأكيد الاستعادة واستبدال البيانات'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Server Accounts & RBAC Management (visible in Server Mode for Admin) */}
      {authMode === 'server' && canManageSettings && (
        <div className="glass-panel rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-500" />
                <span>إدارة حسابات الخادم والصلاحيات</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                إنشاء حسابات الموظفين على الخادم بصلاحيات محددة (قراءة/تعديل، تقارير، ضريبة 3A، نسخ احتياطي) دون كشف كلمات المرور.
              </p>
            </div>
            <button
              type="button"
              onClick={handleLoadServerUsers}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-white/15 text-xs font-semibold"
            >
              تحديث القائمة
            </button>
          </div>

          <form onSubmit={handleCreateServerUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <input
              type="text"
              required
              minLength={3}
              dir="ltr"
              value={newStaffUsername}
              onChange={(e) => setNewStaffUsername(e.target.value)}
              placeholder="اسم المستخدم (مثل sara.tax)"
              className="rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] px-3 py-2 text-xs font-mono-tabular"
            />
            <input
              type="text"
              value={newStaffName}
              onChange={(e) => setNewStaffName(e.target.value)}
              placeholder="الاسم الظاهر"
              className="rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] px-3 py-2 text-xs"
            />
            <select
              value={newStaffRole}
              onChange={(e) => setNewStaffRole(e.target.value as UserRole)}
              className="rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] px-2.5 py-2 text-xs"
            >
              <option value="tax_accountant">{ROLE_LABELS.tax_accountant}</option>
              <option value="operations">{ROLE_LABELS.operations}</option>
              <option value="viewer">{ROLE_LABELS.viewer}</option>
              <option value="admin">{ROLE_LABELS.admin}</option>
            </select>
            <div className="flex gap-2">
              <input
                type="password"
                required
                minLength={serverAuthStatus.shared ? 12 : 6}
                dir="ltr"
                value={newStaffPassword}
                onChange={(e) => setNewStaffPassword(e.target.value)}
                placeholder={serverAuthStatus.shared ? 'كلمة المرور (12+)' : 'كلمة المرور (6+)'}
                className="flex-1 min-w-0 rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] px-2.5 py-2 text-xs font-mono-tabular"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold shrink-0"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>إضافة</span>
              </button>
            </div>
          </form>

          {staffMessage && (
            <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">{staffMessage}</p>
          )}

          {serverUsersList.length > 0 && (
            <div className="divide-y divide-slate-100 dark:divide-white/10 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
              {serverUsersList.map((u) => (
                <div key={u.id} className="px-3.5 py-2 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white">{u.displayName}</span>
                    <span className="text-slate-500 dark:text-slate-400 font-mono-tabular mr-2">
                      @{u.username}
                    </span>
                  </div>
                  <StatusBadge label={u.roleLabel} tone="info" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reset Demo Data */}
      {authMode === 'local_demo' && <div className="glass-panel rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-900 dark:text-white">
            إعادة ضبط البيانات التجريبية
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            استعادة السجلات الافتراضية لهذه المعاينة المحلية {!canEditVatRules && '(للمدير فقط)'}
          </div>
        </div>

        {!canManageSettings ? (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <Lock className="w-3.5 h-3.5" />
            <span>يتطلب صلاحية إدارة الإعدادات</span>
          </span>
        ) : !confirmReset ? (
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
      </div>}

      {/* Delete Document Category Confirmation Modal (Transfer or Clear, Never Delete Documents) */}
      {deletingCatId && (() => {
        const impact = getDocumentCategoryDeleteImpact(deletingCatId);
        const otherCategories = db.documentCategories.filter((c) => c.id !== deletingCatId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
            <div className="glass-panel max-w-md w-full rounded-2xl p-5 space-y-4 shadow-2xl">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                حذف تصنيف «{impact.category?.name || ''}»
              </h3>
              {impact.linkedDocsCount > 0 ? (
                <div className="space-y-3">
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                    هذا التصنيف مستخدم حاليًا في{' '}
                    <span className="font-bold font-mono-tabular">
                      {toEnglishDigits(String(impact.linkedDocsCount))}
                    </span>{' '}
                    وثيقة. لن تُحذف الوثائق أو سجلات تجديداتها؛ اختر معالجتها قبل الحذف:
                  </div>

                  {otherCategories.length > 0 && (
                    <label className="flex items-start gap-2 text-xs text-slate-800 dark:text-slate-200 cursor-pointer">
                      <input
                        type="radio"
                        name="catDeleteMode"
                        checked={catDeleteMode === 'transfer'}
                        onChange={() => setCatDeleteMode('transfer')}
                        className="mt-0.5"
                      />
                      <div className="flex-1 space-y-1.5">
                        <span className="font-semibold">نقل السجلات المرتبطة إلى تصنيف بديل:</span>
                        {catDeleteMode === 'transfer' && (
                          <select
                            value={catReplacementId}
                            onChange={(e) => setCatReplacementId(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] px-2.5 py-1.5 text-xs"
                          >
                            {otherCategories.map((oc) => (
                              <option key={oc.id} value={oc.id}>
                                {oc.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </label>
                  )}

                  <label className="flex items-center gap-2 text-xs text-slate-800 dark:text-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      name="catDeleteMode"
                      checked={catDeleteMode === 'clear'}
                      onChange={() => setCatDeleteMode('clear')}
                    />
                    <span className="font-semibold">
                      إلغاء تصنيفها (تتحول الوثائق إلى «غير مصنفة»)
                    </span>
                  </label>
                </div>
              ) : (
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  لا توجد وثائق مرتبطة بهذا التصنيف حاليًا. هل تؤكد حذفه؟
                </p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingCatId(null)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/15 text-xs font-medium"
                >
                  تراجع
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const targetId =
                      impact.linkedDocsCount > 0 && catDeleteMode === 'transfer' && catReplacementId
                        ? catReplacementId
                        : null;
                    deleteDocumentCategory(deletingCatId, targetId);
                    setDeletingCatId(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 text-xs font-semibold"
                >
                  تأكيد حذف التصنيف
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete Task Type Confirmation Modal (Transfer Tasks, Keep documentId links) */}
      {deletingTypeId && (() => {
        const impact = getTaskTypeDeleteImpact(deletingTypeId);
        const otherTypes = db.taskTypes.filter((x) => x.id !== deletingTypeId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
            <div className="glass-panel max-w-md w-full rounded-2xl p-5 space-y-4 shadow-2xl">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                حذف نوع المهمة «{impact.taskType?.name || ''}»
              </h3>
              {impact.linkedTasksCount > 0 ? (
                <div className="space-y-3">
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-200 leading-relaxed space-y-1">
                    <div>
                      يوجد{' '}
                      <span className="font-bold font-mono-tabular">
                        {toEnglishDigits(String(impact.linkedTasksCount))}
                      </span>{' '}
                      مهمة مرتبطة بهذا النوع. ستُحفظ جميع المهام وروابط الوثائق والجلسات عند نقلها لنوع بديل.
                    </div>
                    {impact.linkedRenewalTasksCount > 0 && (
                      <div>
                        منها{' '}
                        <span className="font-bold font-mono-tabular">
                          {toEnglishDigits(String(impact.linkedRenewalTasksCount))}
                        </span>{' '}
                        مهمة مرتبطة بوثيقة تجديد (سيبقى ربطها بالوثيقة محفوظًا).
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      نقل المهام المرتبطة إلى النوع:
                    </label>
                    <select
                      value={typeReplacementId}
                      onChange={(e) => setTypeReplacementId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#14161b] px-2.5 py-2 text-xs"
                    >
                      {otherTypes.map((ot) => (
                        <option key={ot.id} value={ot.id}>
                          {ot.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  لا توجد مهام مرتبطة بهذا النوع. هل تؤكد حذفه؟
                </p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingTypeId(null)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/15 text-xs font-medium"
                >
                  تراجع
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (deleteTaskType(deletingTypeId, typeReplacementId || otherTypes[0]?.id)) {
                      setDeletingTypeId(null);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 text-xs font-semibold"
                >
                  تأكيد حذف النوع
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

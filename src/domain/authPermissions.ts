import type {
  AuthUser,
  DemoAccountProfile,
  NavSection,
  RecordType,
  UserPermission,
  UserRole,
} from '../types/domain.ts';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'مدير النظام',
  tax_accountant: 'محاسب ضريبي',
  operations: 'منسق عمليات',
  viewer: 'مطلع (قراءة فقط)',
};

export const PERMISSION_LABELS: Record<UserPermission, string> = {
  'records:read': 'قراءة السجلات',
  'records:write': 'إنشاء وتعديل السجلات',
  'records:delete': 'حذف السجلات والتصنيفات',
  'reports:view': 'عرض التقارير والإحصاءات',
  'reports:export': 'تنزيل التقارير ومشاركتها',
  'vat3a:view': 'عرض نموذج الضريبة 3A',
  'vat3a:edit': 'تعديل وحفظ مسودات وقواعد 3A',
  'backups:export': 'تنزيل النسخ الاحتياطية',
  'backups:restore': 'استعادة النسخ الاحتياطية',
  'settings:manage': 'إدارة الإعدادات والحسابات',
};

export const ROLE_PERMISSIONS: Record<UserRole, UserPermission[]> = {
  admin: [
    'records:read',
    'records:write',
    'records:delete',
    'reports:view',
    'reports:export',
    'vat3a:view',
    'vat3a:edit',
    'backups:export',
    'backups:restore',
    'settings:manage',
  ],
  tax_accountant: [
    'records:read',
    'reports:view',
    'reports:export',
    'vat3a:view',
    'vat3a:edit',
  ],
  operations: [
    'records:read',
    'records:write',
    'reports:view',
  ],
  viewer: [
    'records:read',
    'reports:view',
  ],
};

export const DEMO_ACCOUNTS: DemoAccountProfile[] = [
  {
    id: 'demo-admin',
    username: 'fahad.admin',
    displayName: 'فهد الدوسري',
    email: 'fahad.legal@example.sa',
    role: 'admin',
    roleLabel: ROLE_LABELS.admin,
    description: 'صلاحيات كاملة: السجلات، التقارير وتصديرها، ضريبة 3A، النسخ الاحتياطية والاستعادة، والإعدادات.',
    specialistId: 'spec-01',
  },
  {
    id: 'demo-tax',
    username: 'sara.tax',
    displayName: 'سارة القحطاني',
    email: 'sara.tax@example.sa',
    role: 'tax_accountant',
    roleLabel: ROLE_LABELS.tax_accountant,
    description: 'قراءة السجلات، تصدير ومشاركة التقارير، وإدارة ضريبة 3A؛ بدون صلاحية النسخ الاحتياطي أو الاستعادة أو الحذف.',
    specialistId: 'spec-04',
  },
  {
    id: 'demo-ops',
    username: 'khaled.ops',
    displayName: 'خالد الشهري',
    email: 'khaled.admin@example.sa',
    role: 'operations',
    roleLabel: ROLE_LABELS.operations,
    description: 'قراءة وتعديل المهام والوثائق والجلسات؛ محجوب عن الضريبة 3A وتنزيل التقارير والنسخ الاحتياطية والحذف.',
    specialistId: 'spec-03',
  },
  {
    id: 'demo-viewer',
    username: 'viewer.demo',
    displayName: 'مطلع تشغيلي (تجريبي)',
    email: 'viewer@example.sa',
    role: 'viewer',
    roleLabel: ROLE_LABELS.viewer,
    description: 'قراءة السجلات والتقارير فقط؛ محجوب عن التعديل والحذف والتصدير وضريبة 3A والنسخ الاحتياطية.',
    specialistId: null,
  },
];

export function buildAuthUserFromDemo(profile: DemoAccountProfile): AuthUser {
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    email: profile.email,
    role: profile.role,
    roleLabel: profile.roleLabel,
    specialistId: profile.specialistId,
    permissions: [...ROLE_PERMISSIONS[profile.role]],
    authMode: 'local_demo',
  };
}

export function hasPermission(
  user: AuthUser | null | undefined,
  perm: UserPermission
): boolean {
  if (!user) return false;
  return user.permissions.includes(perm);
}

export function canAccessNav(
  user: AuthUser | null | undefined,
  nav: NavSection
): boolean {
  if (!user) return false;
  if (nav === 'vat3a') return hasPermission(user, 'vat3a:view');
  if (nav === 'reports') return hasPermission(user, 'reports:view');
  return hasPermission(user, 'records:read');
}

export function canAccessRecordType(
  user: AuthUser | null | undefined,
  recordType: RecordType
): boolean {
  if (!user) return false;
  void recordType;
  return hasPermission(user, 'records:read');
}

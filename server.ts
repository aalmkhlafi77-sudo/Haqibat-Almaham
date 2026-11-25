import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { createSeedDatabase } from './src/data/seedData';
import { migrateDatabaseState } from './src/data/repository';
import {
  hasPermission,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
} from './src/domain/authPermissions';
import {
  createBackupEnvelope,
  validateBackupFileText,
} from './src/domain/backupUtils';
import type {
  AppDatabaseState,
  AuthUser,
  TaskItem,
  UserPermission,
  UserRole,
  Vat3ADraft,
  Vat3ARulesConfig,
} from './src/types/domain';

interface ServerUserAccount {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: UserRole;
  specialistId: string | null;
  passwordSalt: string;
  passwordHash: string;
  isActive: boolean;
  createdAt: string;
}

interface SessionPayload {
  uid: string;
  username: string;
  role: UserRole;
  exp: number;
}

const SESSION_COOKIE_NAME = 'haqibat_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const RUNTIME_SESSION_SECRET =
  (process.env.SESSION_SECRET || '').trim() || crypto.randomBytes(32).toString('hex');

function hashPasswordScrypt(password: string, salt?: string): { salt: string; hash: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return { salt: actualSalt, hash: derived };
}

function verifyPasswordScrypt(password: string, salt: string, expectedHash: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHash, 'hex');
  if (derived.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(derived, expectedBuf);
}

function safeCompareSecret(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function signSessionToken(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', RUNTIME_SESSION_SECRET)
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}

function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', RUNTIME_SESSION_SECRET)
    .update(body)
    .digest('base64url');
  if (!safeCompareSecret(sig, expectedSig)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (!decoded || typeof decoded.uid !== 'string' || typeof decoded.exp !== 'number') {
      return null;
    }
    if (Date.now() > decoded.exp) return null;
    return decoded;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    out[key] = decodeURIComponent(val);
  }
  return out;
}

function toPublicAuthUser(acc: ServerUserAccount): AuthUser {
  return {
    id: acc.id,
    username: acc.username,
    displayName: acc.displayName,
    email: acc.email,
    role: acc.role,
    roleLabel: ROLE_LABELS[acc.role],
    specialistId: acc.specialistId,
    permissions: [...ROLE_PERMISSIONS[acc.role]],
    authMode: 'server',
  };
}

function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    partitioned: true,
    path: '/',
    maxAge: SESSION_TTL_MS,
  });
}

function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    partitioned: true,
    path: '/',
  });
}

export function createServerApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '5mb' }));

  // In-memory operational state for Stage 1/Preview Server testing
  // (Stage 2 Hostinger swaps this for mysql2 queries against database/001_init_haqibat_almaham.sql)
  let serverDb: AppDatabaseState = createSeedDatabase();
  const serverUsers: ServerUserAccount[] = [];
  let adminClaimed = false;

  const getEnvAdminPasscode = () => (process.env.ADMIN_PASSCODE || '').trim();
  const isEnvAdminConfigured = () => getEnvAdminPasscode().length > 0;

  const buildEnvAdminAccount = (): ServerUserAccount => ({
    id: 'srv-admin-env',
    username: 'admin',
    displayName: 'مدير النظام',
    email: 'admin@haqibat-almaham.local',
    role: 'admin',
    specialistId: 'spec-01',
    passwordSalt: '',
    passwordHash: '',
    isActive: true,
    createdAt: new Date().toISOString().slice(0, 19),
  });

  const resolveUserFromRequest = (req: Request): AuthUser | null => {
    const authHeader = req.headers.authorization;
    let token = '';
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else {
      const cookies = parseCookies(req.headers.cookie);
      token = cookies[SESSION_COOKIE_NAME] || '';
    }
    if (!token) return null;
    const payload = verifySessionToken(token);
    if (!payload) return null;
    if (payload.uid === 'srv-admin-env' && isEnvAdminConfigured()) {
      return toPublicAuthUser(buildEnvAdminAccount());
    }
    const found = serverUsers.find((u) => u.id === payload.uid && u.isActive);
    return found ? toPublicAuthUser(found) : null;
  };

  // Origin / Custom-header CSRF protection for cookie-authenticated mutations
  const verifyCsrfForMutations = (req: Request, res: Response, next: NextFunction) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next();
    }
    if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return next();
    }
    const origin = req.headers.origin;
    const targetHost = (req.headers['x-forwarded-host'] || req.headers.host || '')
      .toString()
      .split(',')[0]
      .trim();
    if (origin && targetHost) {
      try {
        const parsedOrigin = new URL(origin);
        if (parsedOrigin.host === targetHost) {
          return next();
        }
      } catch {
        // reject invalid origin below
      }
    }
    // Bearer token without cookie doesn't rely on ambient cookies
    if (
      typeof req.headers.authorization === 'string' &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      return next();
    }
    return res.status(403).json({
      error: 'تم رفض الطلب لعدم تحقق مصدر الحماية (CSRF).',
    });
  };

  app.use('/api', verifyCsrfForMutations);

  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    const user = resolveUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: 'يلزم تسجيل الدخول أولًا للوصول إلى هذا المورد.' });
    }
    (req as Request & { authUser?: AuthUser }).authUser = user;
    return next();
  };

  const requirePermission =
    (perm: UserPermission) => (req: Request, res: Response, next: NextFunction) => {
      const user = (req as Request & { authUser?: AuthUser }).authUser;
      if (!user) {
        return res.status(401).json({ error: 'غير مصرح — يرجى تسجيل الدخول.' });
      }
      if (!hasPermission(user, perm)) {
        return res.status(403).json({
          error: `صلاحية مفقودة: الحساب الحالي (${user.roleLabel}) لا يملك صلاحية تنفيذ هذا الإجراء.`,
          requiredPermission: perm,
        });
      }
      return next();
    };

  // Health & Auth Status
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      mode: 'server',
      storageStage: 'server_memory_ready_for_mysql',
      envAdminConfigured: isEnvAdminConfigured(),
      hasAdminAccount: isEnvAdminConfigured() || adminClaimed,
      checkedAt: new Date().toISOString().slice(0, 19),
    });
  });

  app.get('/api/ai/status', (_req, res) => {
    res.json({
      ok: false,
      configured: Boolean(process.env.GEMINI_API_KEY),
      message: process.env.GEMINI_API_KEY
        ? 'مفتاح الذكاء الاصطناعي مهيأ على الخادم.'
        : 'مفتاح GEMINI_API_KEY غير مضبوط في بيئة الخادم.',
    });
  });

  app.get('/api/auth/status', (req, res) => {
    const user = resolveUserFromRequest(req);
    res.json({
      envAdminConfigured: isEnvAdminConfigured(),
      hasAdminAccount: isEnvAdminConfigured() || adminClaimed,
      authenticated: Boolean(user),
      user,
    });
  });

  // First-run Admin Claim (atomic & one-time; disabled if ADMIN_PASSCODE is set or already claimed)
  app.post('/api/auth/bootstrap-admin', (req, res) => {
    if (isEnvAdminConfigured()) {
      return res.status(409).json({
        error: 'تم ضبط رمز المدير مسبقًا في إعدادات بيئة الخادم (ADMIN_PASSCODE).',
      });
    }
    if (adminClaimed) {
      return res.status(409).json({
        error: 'تم تفعيل حساب المدير الأول مسبقًا؛ استخدم شاشة تسجيل الدخول.',
      });
    }

    const { username, displayName, email, password } = req.body as {
      username?: string;
      displayName?: string;
      email?: string;
      password?: string;
    };
    const cleanUser = (username || '').trim().toLowerCase();
    const cleanName = (displayName || 'مدير النظام').trim();
    const cleanEmail = (email || 'admin@haqibat-almaham.local').trim();
    const cleanPass = typeof password === 'string' ? password : '';

    if (cleanUser.length < 3) {
      return res.status(400).json({ error: 'اسم المستخدم يجب أن لا يقل عن 3 أحرف.' });
    }
    if (cleanPass.length < 6) {
      return res.status(400).json({ error: 'كلمة المرور يجب أن لا تقل عن 6 أحرف.' });
    }

    const { salt, hash } = hashPasswordScrypt(cleanPass);
    const adminAcc: ServerUserAccount = {
      id: 'srv-admin-01',
      username: cleanUser,
      displayName: cleanName,
      email: cleanEmail,
      role: 'admin',
      specialistId: 'spec-01',
      passwordSalt: salt,
      passwordHash: hash,
      isActive: true,
      createdAt: new Date().toISOString().slice(0, 19),
    };
    serverUsers.push(adminAcc);
    adminClaimed = true;

    const token = signSessionToken({
      uid: adminAcc.id,
      username: adminAcc.username,
      role: adminAcc.role,
      exp: Date.now() + SESSION_TTL_MS,
    });
    setSessionCookie(res, token);
    return res.status(201).json({
      user: toPublicAuthUser(adminAcc),
      token,
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body as {
      username?: string;
      password?: string;
    };
    const cleanUser = (username || '').trim().toLowerCase();
    const cleanPass = typeof password === 'string' ? password : '';

    if (!cleanUser || !cleanPass) {
      return res.status(400).json({ error: 'يرجى إدخال اسم المستخدم وكلمة المرور.' });
    }

    const envPass = getEnvAdminPasscode();
    if (envPass && (cleanUser === 'admin' || cleanUser === 'fahad.admin')) {
      if (!safeCompareSecret(cleanPass, envPass)) {
        return res.status(401).json({ error: 'بيانات الدخول غير صحيحة.' });
      }
      const envAdmin = buildEnvAdminAccount();
      const token = signSessionToken({
        uid: envAdmin.id,
        username: envAdmin.username,
        role: envAdmin.role,
        exp: Date.now() + SESSION_TTL_MS,
      });
      setSessionCookie(res, token);
      return res.json({ user: toPublicAuthUser(envAdmin), token });
    }

    const acc = serverUsers.find((u) => u.username === cleanUser && u.isActive);
    if (!acc || !verifyPasswordScrypt(cleanPass, acc.passwordSalt, acc.passwordHash)) {
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
    }

    const token = signSessionToken({
      uid: acc.id,
      username: acc.username,
      role: acc.role,
      exp: Date.now() + SESSION_TTL_MS,
    });
    setSessionCookie(res, token);
    return res.json({ user: toPublicAuthUser(acc), token });
  });

  app.get('/api/auth/me', requireAuth, (req, res) => {
    const user = (req as Request & { authUser?: AuthUser }).authUser!;
    res.json({ user });
  });

  app.post('/api/auth/logout', (_req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  // Admin-only Staff Account Management
  app.get('/api/auth/users', requireAuth, requirePermission('settings:manage'), (_req, res) => {
    res.json({
      users: serverUsers.map((u) => toPublicAuthUser(u)),
    });
  });

  app.post('/api/auth/users', requireAuth, requirePermission('settings:manage'), (req, res) => {
    const { username, displayName, email, role, specialistId, password } = req.body as {
      username?: string;
      displayName?: string;
      email?: string;
      role?: UserRole;
      specialistId?: string | null;
      password?: string;
    };
    const cleanUser = (username || '').trim().toLowerCase();
    const cleanPass = typeof password === 'string' ? password : '';
    const validRoles: UserRole[] = ['admin', 'tax_accountant', 'operations', 'viewer'];
    if (cleanUser.length < 3) {
      return res.status(400).json({ error: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل.' });
    }
    if (cleanPass.length < 6) {
      return res.status(400).json({ error: 'كلمة المرور يجب أن لا تقل عن 6 أحرف.' });
    }
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ error: 'الدور الوظيفي المحدد غير صالح.' });
    }
    if (serverUsers.some((u) => u.username === cleanUser)) {
      return res.status(409).json({ error: 'اسم المستخدم مسجل مسبقًا.' });
    }

    const { salt, hash } = hashPasswordScrypt(cleanPass);
    const created: ServerUserAccount = {
      id: `srv-usr-${crypto.randomUUID().slice(0, 8)}`,
      username: cleanUser,
      displayName: (displayName || cleanUser).trim(),
      email: (email || `${cleanUser}@example.sa`).trim(),
      role,
      specialistId: specialistId || null,
      passwordSalt: salt,
      passwordHash: hash,
      isActive: true,
      createdAt: new Date().toISOString().slice(0, 19),
    };
    serverUsers.push(created);
    return res.status(201).json({ user: toPublicAuthUser(created) });
  });

  // Protected Operational State (filters out VAT 3A if caller lacks vat3a:view)
  app.get('/api/state', requireAuth, requirePermission('records:read'), (req, res) => {
    const user = (req as Request & { authUser?: AuthUser }).authUser!;
    const canViewVat = hasPermission(user, 'vat3a:view');
    const safeState: AppDatabaseState = {
      ...serverDb,
      vat3aDrafts: canViewVat ? serverDb.vat3aDrafts : [],
    };
    res.json({ state: safeState });
  });

  // Tasks CRUD (RBAC enforced)
  app.post('/api/tasks', requireAuth, requirePermission('records:write'), (req, res) => {
    const body = req.body as Partial<TaskItem>;
    if (!body.title || !body.dueDate || !body.typeId) {
      return res.status(400).json({ error: 'حقول المهمة الأساسية مطلوبة.' });
    }
    const now = new Date().toISOString().slice(0, 19);
    const tt = serverDb.taskTypes.find((x) => x.id === body.typeId);
    const item: TaskItem = {
      id: body.id || `task-${crypto.randomUUID().slice(0, 8)}`,
      orgId: 'org-01',
      typeId: body.typeId,
      type: tt?.name || body.type || 'مهمة',
      title: body.title.trim(),
      specialistId: body.specialistId ?? null,
      departmentName: body.departmentName || 'عام',
      priority: body.priority || 'متوسطة',
      status: body.status || 'جديدة',
      dueDate: body.dueDate,
      notes: body.notes || '',
      documentId: body.documentId ?? null,
      caseId: body.caseId ?? null,
      sessionId: body.sessionId ?? null,
      archivedAt: body.archivedAt ?? null,
      createdAt: body.createdAt || now,
      updatedAt: now,
    };
    const exists = serverDb.tasks.some((t) => t.id === item.id);
    serverDb = {
      ...serverDb,
      tasks: exists
        ? serverDb.tasks.map((t) => (t.id === item.id ? item : t))
        : [item, ...serverDb.tasks],
    };
    return res.status(exists ? 200 : 201).json({ task: item });
  });

  app.delete('/api/tasks/:id', requireAuth, requirePermission('records:delete'), (req, res) => {
    const { id } = req.params;
    serverDb = {
      ...serverDb,
      tasks: serverDb.tasks.filter((t) => t.id !== id),
      labels: serverDb.labels.filter((l) => !(l.targetType === 'task' && l.targetId === id)),
      calendarItems: serverDb.calendarItems.map((c) =>
        c.linkedRecordType === 'task' && c.linkedRecordId === id
          ? { ...c, linkedRecordType: null, linkedRecordId: null }
          : c
      ),
    };
    res.json({ ok: true });
  });

  // Document Delete Restriction (ON DELETE RESTRICT) + RBAC
  app.delete('/api/documents/:id', requireAuth, requirePermission('records:delete'), (req, res) => {
    const { id } = req.params;
    const doc = serverDb.documents.find((d) => d.id === id);
    if (!doc) {
      return res.status(404).json({ error: 'الوثيقة غير موجودة.' });
    }
    if (doc.renewals.length > 0) {
      return res.status(409).json({
        error: `يُمنع الحذف النهائي لوثيقة تحتوي على ${doc.renewals.length} سجل تجديد؛ استخدم الأرشفة.`,
      });
    }
    serverDb = {
      ...serverDb,
      documents: serverDb.documents.filter((d) => d.id !== id),
    };
    return res.json({ ok: true });
  });

  // VAT 3A Endpoints (Dedicated VAT RBAC)
  app.get('/api/vat3a', requireAuth, requirePermission('vat3a:view'), (_req, res) => {
    res.json({
      drafts: serverDb.vat3aDrafts,
      rules: serverDb.preferences.vat3aRules,
    });
  });

  app.post('/api/vat3a', requireAuth, requirePermission('vat3a:edit'), (req, res) => {
    const draft = req.body as Vat3ADraft;
    if (!draft || !draft.id || !draft.entityName) {
      return res.status(400).json({ error: 'بيانات مسودة 3A غير مكتملة.' });
    }
    const exists = serverDb.vat3aDrafts.some((d) => d.id === draft.id);
    serverDb = {
      ...serverDb,
      vat3aDrafts: exists
        ? serverDb.vat3aDrafts.map((d) => (d.id === draft.id ? draft : d))
        : [draft, ...serverDb.vat3aDrafts],
    };
    return res.json({ draft });
  });

  app.put('/api/vat3a/rules', requireAuth, requirePermission('vat3a:edit'), (req, res) => {
    const rules = req.body as Vat3ARulesConfig;
    if (!rules || typeof rules.defaultRatePercent !== 'number') {
      return res.status(400).json({ error: 'قواعد حساب 3A غير صالحة.' });
    }
    serverDb = {
      ...serverDb,
      preferences: {
        ...serverDb.preferences,
        vat3aRules: rules,
      },
    };
    return res.json({ rules: serverDb.preferences.vat3aRules });
  });

  // Report Export Authorization Check
  app.post('/api/reports/export', requireAuth, requirePermission('reports:export'), (req, res) => {
    const user = (req as Request & { authUser?: AuthUser }).authUser!;
    const { format, rowCount } = req.body as { format?: string; rowCount?: number };
    res.json({
      ok: true,
      authorizedBy: user.username,
      format: format || 'pdf',
      rowCount: Number(rowCount || 0),
      exportedAt: new Date().toISOString().slice(0, 19),
    });
  });

  // Admin Backup & Atomic Restore (Server Mode)
  app.get('/api/backups/export', requireAuth, requirePermission('backups:export'), (_req, res) => {
    const envelope = createBackupEnvelope(serverDb, 'server');
    res.json({
      ...envelope,
      includesAttachments: false,
      attachmentsNote:
        'في بيئة الإنتاج المشتركة (هوستنجر)، يُضاف أرشيف المرفقات (/uploads) إلى نسخة قاعدة البيانات من الخادم ضمن صلاحية المدير.',
    });
  });

  app.post('/api/backups/restore', requireAuth, requirePermission('backups:restore'), (req, res) => {
    const snapshot = structuredClone(serverDb);
    try {
      const check = validateBackupFileText(JSON.stringify(req.body));
      if (!check.ok || !check.envelope) {
        return res.status(400).json({
          ok: false,
          error: check.error || 'فشل التحقق من سلامة ملف النسخة الاحتياطية.',
        });
      }
      const migrated = migrateDatabaseState(check.envelope.payload);
      serverDb = migrated;
      return res.json({
        ok: true,
        counts: check.counts,
        restoredAt: new Date().toISOString().slice(0, 19),
      });
    } catch (err) {
      serverDb = snapshot;
      return res.status(500).json({
        ok: false,
        error:
          err instanceof Error
            ? `تعذرت الاستعادة (${err.message}) — تم الإبقاء على البيانات الحالية.`
            : 'تعذرت الاستعادة — تم الإبقاء على البيانات الحالية.',
      });
    }
  });

  return app;
}

async function startServer() {
  const app = createServerApp();
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`Haqibat Almaham server running on port ${port}`);
  });
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

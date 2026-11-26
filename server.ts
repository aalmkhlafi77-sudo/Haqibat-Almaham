import { answerAssistant, assistantConnection, assistantQuestion, verifyGeminiConnection } from './server/geminiAssistant';
import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { rateLimit } from 'express-rate-limit';
import express, { type NextFunction, type Request, type Response } from 'express';
import { migrateDatabaseState, StateDataRepository } from './src/data/repository';
import { createPreviewStore, openMysqlStore, type ServerUserAccount, type Workspace, type WorkspaceStore } from './server/workspaceStore';
import { applyWorkspaceCommand, assertRestorableWorkspace, RequestError } from './server/workspaceCommands';
import { taskItemSchema, vat3ADraftSchema, vat3ARulesConfigSchema } from './server/workspaceSchemas';
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
  AuthUser,
  TaskItem,
  UserPermission,
  UserRole,
} from './src/types/domain';

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

function setSessionCookie(res: Response, token: string, shared: boolean): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: shared ? 'lax' : 'none',
    partitioned: !shared,
    path: '/',
    maxAge: SESSION_TTL_MS,
  });
}

function clearSessionCookie(res: Response, shared: boolean): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: shared ? 'lax' : 'none',
    partitioned: !shared,
    path: '/',
  });
}

type Route = (req: Request, res: Response, next: NextFunction) => unknown;

const asyncRoute = (route: Route) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve().then(() => route(req, res, next)).catch(next);
};

function publicWorkspace(workspace: Workspace, user: AuthUser): Workspace {
  const canViewVat = hasPermission(user, 'vat3a:view');
  return {
    revision: workspace.revision,
    state: {
      ...workspace.state,
      shareLogs: canViewVat
        ? workspace.state.shareLogs
        : workspace.state.shareLogs.filter((log) => log.recordType !== 'vat_3a'),
      vat3aDrafts: canViewVat ? workspace.state.vat3aDrafts : [],
    },
  };
}

export function createServerApp(store: WorkspaceStore = createPreviewStore()) {
  const app = express();
  const shared = store.mode === 'mysql';
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '5mb' }));
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  const changeRecords = (change: (repo: StateDataRepository) => void) =>
    store.change((workspace) => {
      change(new StateDataRepository(() => workspace.state, (state) => { workspace.state = state; }));
    });

  const getEnvAdminPasscode = () => shared ? '' : (process.env.ADMIN_PASSCODE || '').trim();
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

  const resolveUserFromRequest = async (req: Request): Promise<AuthUser | null> => {
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
    const found = (await store.users()).find((u) => u.id === payload.uid && u.isActive);
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
  if (shared) {
    app.use('/api/auth/login', rateLimit({
      windowMs: 15 * 60_000,
      limit: 12,
      skipSuccessfulRequests: true,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'تكررت محاولات الدخول. حاول مجددًا بعد قليل.' },
    }));
  }


  const requireAuth = asyncRoute(async (req, res, next) => {
    const user = await resolveUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: 'يلزم تسجيل الدخول أولًا للوصول إلى هذا المورد.' });
    }
    (req as Request & { authUser?: AuthUser }).authUser = user;
    return next();
  });

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
  app.get('/api/health', asyncRoute(async (_req, res) => {
    await store.read();
    res.json({
      ok: true,
      mode: 'server',
      storageStage: shared ? 'mysql' : 'server_memory_ready_for_mysql',
      databaseReady: shared,
    });
  }));

  app.get('/api/ai/status', (_req, res) => {
    res.json({
      ok: false,
      configured: Boolean(process.env.GEMINI_API_KEY),
      message: process.env.GEMINI_API_KEY
        ? 'مفتاح الذكاء الاصطناعي مهيأ على الخادم.'
        : 'مفتاح GEMINI_API_KEY غير مضبوط في بيئة الخادم.',
    });
  });

  const aiRateLimit = rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'تكررت طلبات المساعد. حاول مجددًا بعد دقيقة.' },
  });

  app.post('/api/ai/connection', requireAuth, requirePermission('settings:manage'), aiRateLimit, asyncRoute(async (req, res) => {
    const input = assistantConnection.safeParse(req.body);
    if (!input.success) throw new RequestError(400, 'معرّف النموذج غير صالح.');
    const model = await verifyGeminiConnection(input.data.model);
    res.json({ ok: true, model });
  }));

  app.post('/api/ai/ask', requireAuth, requirePermission('records:read'), aiRateLimit, asyncRoute(async (req, res) => {
    const input = assistantQuestion.safeParse(req.body);
    if (!input.success) throw new RequestError(400, 'اكتب سؤالًا من حرفين إلى 600 حرف.');
    const user = (req as Request & { authUser: AuthUser }).authUser;
    const workspace = publicWorkspace(await store.read(), user);
    if (workspace.state.preferences.integrations.aiProvider !== 'server_gemini') {
      throw new RequestError(409, 'اختر Google Gemini من إعدادات المساعد.');
    }
    res.json(await answerAssistant(input.data.question, workspace.state, hasPermission(user, 'records:write'), input.data.mode));
  }));

  app.get('/api/auth/status', asyncRoute(async (req, res) => {
    const user = await resolveUserFromRequest(req);
    res.json({
      shared,
      envAdminConfigured: isEnvAdminConfigured(),
      hasAdminAccount: isEnvAdminConfigured() || (await store.users()).some((u) => u.role === 'admin'),
      authenticated: Boolean(user),
      user,
    });
  }));

  // First-run Admin Claim (atomic & one-time; disabled if ADMIN_PASSCODE is set or already claimed)
  app.post('/api/auth/bootstrap-admin', asyncRoute(async (req, res) => {
    if (shared) return res.status(403).json({ error: 'يُنشأ حساب المالك من إعدادات الخادم.' });
    if (isEnvAdminConfigured()) {
      return res.status(409).json({
        error: 'تم ضبط رمز المدير مسبقًا في إعدادات بيئة الخادم (ADMIN_PASSCODE).',
      });
    }
    if ((await store.users()).some((u) => u.role === 'admin')) {
      return res.status(409).json({
        error: 'تم تفعيل حساب المدير الأول مسبقًا؛ استخدم شاشة تسجيل الدخول.',
      });
    }

    const { username, displayName, email, password } = (req.body ?? {}) as {
      username?: string;
      displayName?: string;
      email?: string;
      password?: string;
    };
    const cleanUser = typeof username === 'string' ? username.trim().toLowerCase() : '';
    const cleanName = typeof displayName === 'string' ? displayName.trim() || 'مدير النظام' : 'مدير النظام';
    const cleanEmail = typeof email === 'string' ? email.trim() : 'admin@haqibat-almaham.local';
    const cleanPass = typeof password === 'string' ? password : '';

    if (cleanUser.length < 3) {
      return res.status(400).json({ error: 'اسم المستخدم يجب أن لا يقل عن 3 أحرف.' });
    }
    if (cleanPass.length < (shared ? 12 : 6) || cleanPass.length > 256) {
      return res.status(400).json({ error: shared ? 'كلمة المرور يجب أن تكون بين 12 و256 حرفًا.' : 'كلمة المرور يجب أن تكون بين 6 و256 حرفًا.' });
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
    if (!(await store.addUser(adminAcc, true))) {
      return res.status(409).json({ error: 'تم تفعيل حساب المدير الأول مسبقًا.' });
    }

    const token = signSessionToken({
      uid: adminAcc.id,
      username: adminAcc.username,
      role: adminAcc.role,
      exp: Date.now() + SESSION_TTL_MS,
    });
    setSessionCookie(res, token, shared);
    return res.status(201).json({
      user: toPublicAuthUser(adminAcc),
      token,
    });
  }));

  app.post('/api/auth/login', asyncRoute(async (req, res) => {
    const { username, password } = (req.body ?? {}) as {
      username?: string;
      password?: string;
    };
    const cleanUser = typeof username === 'string' ? username.trim().toLowerCase() : '';
    const cleanPass = typeof password === 'string' ? password : '';

    if (!cleanUser || cleanUser.length > 100 || !cleanPass || cleanPass.length > 256) {
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
      setSessionCookie(res, token, shared);
      return res.json({ user: toPublicAuthUser(envAdmin), token });
    }

    const acc = (await store.users()).find((u) => u.username === cleanUser && u.isActive);
    if (!acc || !verifyPasswordScrypt(cleanPass, acc.passwordSalt, acc.passwordHash)) {
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
    }

    const token = signSessionToken({
      uid: acc.id,
      username: acc.username,
      role: acc.role,
      exp: Date.now() + SESSION_TTL_MS,
    });
    setSessionCookie(res, token, shared);
    return res.json({ user: toPublicAuthUser(acc), token });
  }));

  app.get('/api/auth/me', requireAuth, (req, res) => {
    const user = (req as Request & { authUser?: AuthUser }).authUser!;
    res.json({ user });
  });

  app.post('/api/auth/logout', (_req, res) => {
    clearSessionCookie(res, shared);
    res.json({ ok: true });
  });

  // Admin-only Staff Account Management
  app.get('/api/auth/users', requireAuth, requirePermission('settings:manage'), asyncRoute(async (_req, res) => {
    res.json({ users: (await store.users()).map(toPublicAuthUser) });
  }));

  app.post('/api/auth/users', requireAuth, requirePermission('settings:manage'), asyncRoute(async (req, res) => {
    const { username, displayName, email, role, specialistId, password } = (req.body ?? {}) as {
      username?: string;
      displayName?: string;
      email?: string;
      role?: UserRole;
      specialistId?: string | null;
      password?: string;
    };
    const cleanUser = typeof username === 'string' ? username.trim().toLowerCase() : '';
    const cleanPass = typeof password === 'string' ? password : '';
    const validRoles: UserRole[] = ['admin', 'tax_accountant', 'operations', 'viewer'];
    if (cleanUser.length < 3) {
      return res.status(400).json({ error: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل.' });
    }
    if (cleanPass.length < (shared ? 12 : 6) || cleanPass.length > 256) {
      return res.status(400).json({ error: shared ? 'كلمة المرور يجب أن تكون بين 12 و256 حرفًا.' : 'كلمة المرور يجب أن تكون بين 6 و256 حرفًا.' });
    }
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ error: 'الدور الوظيفي المحدد غير صالح.' });
    }
    const cleanName = typeof displayName === 'string' ? displayName.trim() || cleanUser : cleanUser;
    const cleanEmail = typeof email === 'string' ? email.trim() : `${cleanUser}@example.sa`;
    if (cleanUser.length > 100 || cleanName.length > 200 || cleanEmail.length > 254 ||
        (specialistId != null && (typeof specialistId !== 'string' || specialistId.length > 64))) {
      return res.status(400).json({ error: 'بيانات الحساب تتجاوز الحدود المسموح بها.' });
    }

    const { salt, hash } = hashPasswordScrypt(cleanPass);
    const created: ServerUserAccount = {
      id: `srv-usr-${crypto.randomUUID().slice(0, 8)}`,
      username: cleanUser,
      displayName: cleanName,
      email: cleanEmail,
      role,
      specialistId: specialistId || null,
      passwordSalt: salt,
      passwordHash: hash,
      isActive: true,
      createdAt: new Date().toISOString().slice(0, 19),
    };
    if (!(await store.addUser(created))) {
      return res.status(409).json({ error: 'اسم المستخدم مسجل مسبقًا.' });
    }
    return res.status(201).json({ user: toPublicAuthUser(created) });
  }));

  app.get('/api/state', requireAuth, requirePermission('records:read'), asyncRoute(async (req, res) => {
    res.json(publicWorkspace(await store.read(), (req as Request & { authUser: AuthUser }).authUser));
  }));

  app.post('/api/state/commands', requireAuth, requirePermission('records:read'), asyncRoute(async (req, res) => {
    const user = (req as Request & { authUser: AuthUser }).authUser;
    const updated = await store.change((workspace) => applyWorkspaceCommand(workspace, req.body, user));
    res.json(publicWorkspace(updated, user));
  }));

  app.post('/api/tasks', requireAuth, requirePermission('records:write'), asyncRoute(async (req, res) => {
    const body = req.body as Partial<TaskItem>;
    if (typeof body?.title !== 'string' || !body.dueDate || !body.typeId) {
      return res.status(400).json({ error: 'حقول المهمة الأساسية مطلوبة.' });
    }
    const now = new Date().toISOString().slice(0, 19);
    const item: TaskItem = {
      id: body.id || `task-${crypto.randomUUID().slice(0, 8)}`,
      orgId: 'org-01',
      typeId: body.typeId,
      type: body.type || 'مهمة',
      title: body.title.trim(),
      specialistId: body.specialistId ?? null,
      departmentName: body.departmentName || 'عام',
      priority: body.priority || 'متوسطة',
      status: body.status || 'جديدة',
      dueDate: body.dueDate,
      notes: body.notes || '',
      letterNumber: body.letterNumber,
      authorityName: body.authorityName,
      receivedDate: body.receivedDate,
      actualDeliveryDate: body.actualDeliveryDate,
      documentId: body.documentId ?? null,
      caseId: body.caseId ?? null,
      sessionId: body.sessionId ?? null,
      archivedAt: body.archivedAt ?? null,
      createdAt: body.createdAt || now,
      updatedAt: now,
    };
    const parsed = taskItemSchema.safeParse(item);
    if (!parsed.success) throw new RequestError(400, 'بيانات المهمة غير صالحة.');
    let created = false;
    const updated = await changeRecords((repo) => {
      created = !repo.load().tasks.some((task) => task.id === item.id);
      repo.upsertTask(parsed.data);
    });
    return res.status(created ? 201 : 200).json({ task: updated.state.tasks.find((task) => task.id === item.id) });
  }));

  app.delete('/api/tasks/:id', requireAuth, requirePermission('records:delete'), asyncRoute(async (req, res) => {
    await changeRecords((repo) => { repo.deleteTask(req.params.id); });
    res.json({ ok: true });
  }));

  app.delete('/api/documents/:id', requireAuth, requirePermission('records:delete'), asyncRoute(async (req, res) => {
    await changeRecords((repo) => {
      if (!repo.load().documents.some((doc) => doc.id === req.params.id)) throw new RequestError(404, 'الوثيقة غير موجودة.');
      const result = repo.deleteDocument(req.params.id);
      if (!result.ok) throw new RequestError(409, result.error || 'تعذر حذف الوثيقة.');
    });
    res.json({ ok: true });
  }));

  app.get('/api/vat3a', requireAuth, requirePermission('vat3a:view'), asyncRoute(async (_req, res) => {
    const { state } = await store.read();
    res.json({ drafts: state.vat3aDrafts, rules: state.preferences.vat3aRules });
  }));

  app.post('/api/vat3a', requireAuth, requirePermission('vat3a:edit'), asyncRoute(async (req, res) => {
    const parsed = vat3ADraftSchema.safeParse(req.body);
    if (!parsed.success) throw new RequestError(400, 'بيانات مسودة 3A غير مكتملة.');
    const draft = parsed.data;
    await changeRecords((repo) => { repo.upsertVat3ADraft(draft); });
    res.json({ draft });
  }));

  app.put('/api/vat3a/rules', requireAuth, requirePermission('vat3a:edit'), asyncRoute(async (req, res) => {
    const parsed = vat3ARulesConfigSchema.safeParse(req.body);
    if (!parsed.success) throw new RequestError(400, 'قواعد حساب 3A غير صالحة.');
    await changeRecords((repo) => { repo.updatePreferences({ vat3aRules: parsed.data }); });
    res.json({ rules: parsed.data });
  }));

  // Report Export Authorization Check
  app.post('/api/reports/export', requireAuth, requirePermission('reports:export'), (req, res) => {
    const user = (req as Request & { authUser?: AuthUser }).authUser!;
    const { format, rowCount } = (req.body ?? {}) as { format?: string; rowCount?: number };
    res.json({
      ok: true,
      authorizedBy: user.username,
      format: format || 'pdf',
      rowCount: Number(rowCount || 0),
      exportedAt: new Date().toISOString().slice(0, 19),
    });
  });

  app.get('/api/backups/export', requireAuth, requirePermission('backups:export'), asyncRoute(async (_req, res) => {
    const { state } = await store.read();
    res.json({
      ...createBackupEnvelope(state, 'server'),
      attachmentsNote: 'تتضمن النسخة سجلات مساحة العمل. تُدار نسخة حسابات الدخول من قاعدة البيانات.',
    });
  }));

  app.post('/api/backups/restore', requireAuth, requirePermission('backups:restore'), asyncRoute(async (req, res) => {
    const check = validateBackupFileText(JSON.stringify(req.body));
    if (!check.ok || !check.envelope) {
      throw new RequestError(400, check.error || 'فشل التحقق من سلامة ملف النسخة الاحتياطية.');
    }
    const migrated = migrateDatabaseState(check.envelope.payload);
    assertRestorableWorkspace(migrated);
    await store.change((workspace) => { workspace.state = migrated; }, true);
    res.json({ ok: true, counts: check.counts, restoredAt: new Date().toISOString() });
  }));

  app.use('/api', (_req, res) => { res.status(404).json({ error: 'المسار المطلوب غير موجود.' }); });
  app.use('/api', (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof RequestError) return res.status(error.status).json({ error: error.message });
    const status = (error as { status?: number })?.status;
    if (status === 400 || status === 413) return res.status(status).json({ error: 'حجم البيانات أو بنيتها غير صالحة.' });
    console.error('Workspace request failed:', (error as { code?: string })?.code || 'internal error');
    res.status(503).json({ error: 'تعذر الوصول إلى بيانات مساحة العمل. حاول مجددًا.' });
  });

  return app;
}

async function provisionOwner(store: WorkspaceStore) {
  if ((await store.users()).some((user) => user.role === 'admin' && user.isActive)) return;
  const username = process.env.OWNER_USERNAME?.trim().toLowerCase() || '';
  const displayName = process.env.OWNER_DISPLAY_NAME?.trim() || 'مالك مساحة العمل';
  const email = process.env.OWNER_EMAIL?.trim() || '';
  const password = process.env.OWNER_PASSWORD || '';
  if (username.length < 3 || username.length > 100 || displayName.length > 200 ||
      email.length > 254 || password.length < 12 || password.length > 256) {
    throw new Error('Set OWNER_USERNAME and OWNER_PASSWORD (12–256 characters) to provision the first owner.');
  }
  const { salt, hash } = hashPasswordScrypt(password);
  const created = await store.addUser({
    id: 'srv-admin-01', username, displayName, email, role: 'admin', specialistId: null,
    passwordSalt: salt, passwordHash: hash, isActive: true, createdAt: new Date().toISOString(),
  }, true);
  if (!created && !(await store.users()).some((user) => user.role === 'admin' && user.isActive)) {
    throw new Error('Shared workspace accounts exist without an active owner.');
  }
}

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const shared = isProd || process.env.APP_STORAGE === 'mysql';
  if (shared && (process.env.SESSION_SECRET?.trim().length ?? 0) < 32) {
    throw new Error('SESSION_SECRET of at least 32 characters is required for shared mode.');
  }
  const store = shared ? await openMysqlStore() : createPreviewStore();
  if (shared) await provisionOwner(store);
  const app = createServerApp(store);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
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

export async function runServer() {
  try {
    await startServer();
  } catch (err) {
    console.error('Failed to start server:', (err as { code?: string })?.code || (err instanceof Error ? err.message : 'unknown error'));
    process.exit(1);
  }
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  await runServer();
}

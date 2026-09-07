import { Router, type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import net from 'net';
import os from 'os';
import type { UserRole } from '@petdate/shared';
import { SITE, USER_ROLES } from '@petdate/shared';
import {
  hasElasticsearchConfig,
  hasPostgresConfig,
  hasRedisConfig,
  hasS3Config,
  infra,
} from '../config/infra';
import { dbService, getStorageDriver } from '../db';
import { adminPlatform } from '../admin-platform';
import { adminFinance } from '../admin-finance';
import { logAppEvent } from '../services/app-logger';
import {
  getSmtpPublicConfig,
  isPlausibleEmail,
  isSmtpConfigured,
  sendMail,
} from '../services/mail';
import { buildBrandedMailHtml } from '../services/otp-email-html';
import {
  buildReplySubject,
  getInboxMailboxAddress,
  getInboxMessage,
  getInboxPublicStatus,
  isInboxConfigured,
  listInboxMessages,
} from '../services/mail-inbox';
import { rateLimit } from '../middleware/rate-limit';
import { publicPdfOrigin, publicWebOrigin } from '../services/prescription-html';

export const adminRouter = Router();
const STARTED_AT = Date.now();

function usePostgresStorage(): boolean {
  return getStorageDriver() === 'postgres';
}

const adminLoginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'تلاش ورود ادمین زیاد است. کمی بعد دوباره تلاش کن.',
});

function adminPassword(): string {
  return (process.env.ADMIN_PASSWORD || 'petdate').trim() || 'petdate';
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.path === '/auth/login' && req.method === 'POST') {
    next();
    return;
  }
  // Header only — never accept password via query string (leaks into access logs / Referer).
  const header = req.header('x-admin-password') || '';
  const bodyPwd =
    req.body && typeof req.body === 'object' && typeof (req.body as { password?: string }).password === 'string'
      ? (req.body as { password: string }).password
      : '';
  if ((header || bodyPwd) !== adminPassword()) {
    res.status(401).json({ error: 'دسترسی ادمین مجاز نیست' });
    return;
  }
  next();
}

adminRouter.use(requireAdmin);

adminRouter.post('/auth/login', adminLoginLimit, (req, res) => {
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (password !== adminPassword()) {
    res.status(401).json({ error: 'رمز عبور اشتباه است' });
    return;
  }
  res.json({ ok: true });
});

adminRouter.get('/dashboard', (_req, res) => {
  res.json({
    generatedAt: new Date().toISOString(),
    stats: adminPlatform.getDashboardStats(),
    recentPets: dbService.listPets().slice(0, 8),
    recentPlaydates: dbService.listPlaydateRequests().slice(0, 8),
    recentConsults: dbService.listVetConsultations({ all: true }).slice(0, 8),
    recentShopOrders: adminPlatform.listShopOrders({ limit: 8 }),
  });
});

adminRouter.get('/users', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const role = typeof req.query.role === 'string' ? req.query.role : undefined;
  const active =
    req.query.active === '1' || req.query.active === 'true'
      ? true
      : req.query.active === '0' || req.query.active === 'false'
        ? false
        : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  res.json(adminPlatform.listUsersAdmin({
    q, role, active,
    limit: Number.isFinite(limit) ? limit : 50,
    offset: Number.isFinite(offset) ? offset : 0,
  }));
});

adminRouter.patch('/users/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: 'شناسه نامعتبر' }); return; }
  let user = dbService.getUserById(id);
  if (!user) { res.status(404).json({ error: 'کاربر پیدا نشد' }); return; }
  if (typeof req.body?.isActive === 'boolean') {
    user = adminPlatform.setUserActive(id, req.body.isActive) ?? user;
  }
  if (Array.isArray(req.body?.roles)) {
    const roles = (req.body.roles as unknown[]).filter(
      (r): r is UserRole => typeof r === 'string' && USER_ROLES.includes(r as UserRole)
    );
    if (roles.length) user = dbService.setUserRoles(id, roles) ?? user;
  } else if (typeof req.body?.role === 'string' && USER_ROLES.includes(req.body.role as UserRole)) {
    user = dbService.setUserRole(id, req.body.role as UserRole) ?? user;
  }
  res.json(user);
});

adminRouter.get('/pets', (req, res) => {
  const species = typeof req.query.species === 'string' ? req.query.species : undefined;
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  let pets = dbService.listPets({ species });
  if (q) {
    const lower = q.toLowerCase();
    pets = pets.filter((p) =>
      p.name.toLowerCase().includes(lower) ||
      (p.breed || '').toLowerCase().includes(lower) ||
      (p.city || '').toLowerCase().includes(lower) ||
      String(p.id) === q
    );
  }
  res.json({ total: pets.length, pets });
});

adminRouter.delete('/pets/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: 'شناسه نامعتبر' }); return; }
  if (!dbService.deletePet(id)) { res.status(404).json({ error: 'پت پیدا نشد' }); return; }
  res.json({ ok: true });
});

adminRouter.get('/playdates', (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const items = dbService.listPlaydateRequests(
    status ? { status: status as 'pending' | 'accepted' | 'rejected' | 'cancelled' } : undefined
  );
  res.json({ total: items.length, playdates: items });
});

adminRouter.patch('/playdates/:id/status', (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status || '');
  if (!['pending', 'accepted', 'rejected', 'cancelled'].includes(status)) {
    res.status(400).json({ error: 'وضعیت نامعتبر' }); return;
  }
  const updated = dbService.updatePlaydateStatus(id, status as 'pending' | 'accepted' | 'rejected' | 'cancelled');
  if (!updated) { res.status(404).json({ error: 'درخواست پیدا نشد' }); return; }
  res.json(updated);
});

adminRouter.get('/consultations', (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const items = dbService.listVetConsultations({
    all: true,
    ...(status ? { status: status as never } : {}),
  });
  res.json({ total: items.length, consultations: items });
});

adminRouter.patch('/consultations/:id/status', (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status || '');
  const updated = dbService.updateVetConsultationStatus(id, status as never);
  if (!updated) { res.status(404).json({ error: 'مشاوره پیدا نشد' }); return; }
  res.json(updated);
});

adminRouter.get('/payments', (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  res.json({ orders: adminPlatform.listPaymentOrdersAdmin({ status, limit: 150 }) });
});

adminRouter.post('/payments/:id/approve', (req, res) => {
  const id = Number(req.params.id);
  const note = typeof req.body?.note === 'string' ? req.body.note : undefined;
  const result = dbService.approveCardPayment(id, note);
  if (!result.ok) { res.status(400).json({ error: result.reason }); return; }
  res.json(result);
});

adminRouter.post('/payments/:id/reject', (req, res) => {
  const id = Number(req.params.id);
  const note = typeof req.body?.note === 'string' ? req.body.note : undefined;
  const result = dbService.rejectCardPayment(id, note);
  if (!result.ok) { res.status(400).json({ error: result.reason }); return; }
  res.json(result);
});

adminRouter.get('/shop/products', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const categorySlug = typeof req.query.category === 'string' ? req.query.category : undefined;
  const inStock = req.query.inStock === '1' ? true : req.query.inStock === '0' ? false : undefined;
  const products = adminPlatform.listShopProducts({ q, categorySlug, inStock });
  res.json({ total: products.length, products });
});

adminRouter.get('/shop/products/:id', (req, res) => {
  const product = adminPlatform.getShopProduct(req.params.id);
  if (!product) { res.status(404).json({ error: 'محصول پیدا نشد' }); return; }
  res.json(product);
});

adminRouter.post('/shop/products', (req, res) => {
  const body = req.body ?? {};
  if (!body.title || !body.slug || !body.brandId || !body.categorySlug) {
    res.status(400).json({ error: 'title, slug, brandId, categorySlug الزامی‌اند' }); return;
  }
  const product = adminPlatform.upsertShopProduct({
    id: body.id, slug: String(body.slug), title: String(body.title), brandId: String(body.brandId),
    categorySlug: String(body.categorySlug),
    petTypes: Array.isArray(body.petTypes) ? body.petTypes.map(String) : [],
    priceToman: Number(body.priceToman ?? 0),
    compareAtToman: body.compareAtToman != null ? Number(body.compareAtToman) : undefined,
    costToman: body.costToman != null ? Number(body.costToman) : undefined,
    image: body.image ? String(body.image) : undefined, badge: body.badge ?? null,
    inStock: body.inStock !== false, stockQty: Number(body.stockQty ?? 0),
    params: body.params && typeof body.params === 'object' ? body.params : {},
    description: body.description ? String(body.description) : '', featured: Boolean(body.featured),
  });
  res.status(201).json(product);
});

adminRouter.put('/shop/products/:id', (req, res) => {
  const existing = adminPlatform.getShopProduct(req.params.id);
  if (!existing) { res.status(404).json({ error: 'محصول پیدا نشد' }); return; }
  const body = req.body ?? {};
  const product = adminPlatform.upsertShopProduct({
    id: existing.id,
    slug: String(body.slug ?? existing.slug),
    title: String(body.title ?? existing.title),
    brandId: String(body.brandId ?? existing.brandId),
    categorySlug: String(body.categorySlug ?? existing.categorySlug),
    petTypes: Array.isArray(body.petTypes) ? body.petTypes.map(String) : existing.petTypes,
    priceToman: body.priceToman != null ? Number(body.priceToman) : existing.priceToman,
    compareAtToman: body.compareAtToman != null ? Number(body.compareAtToman) : existing.compareAtToman,
    costToman: body.costToman != null ? Number(body.costToman) : existing.costToman ?? null,
    image: body.image != null ? String(body.image) : existing.image,
    badge: body.badge !== undefined ? body.badge : existing.badge,
    inStock: body.inStock != null ? Boolean(body.inStock) : existing.inStock,
    stockQty: body.stockQty != null ? Number(body.stockQty) : existing.stockQty,
    params: body.params && typeof body.params === 'object' ? body.params : existing.params,
    description: body.description != null ? String(body.description) : existing.description,
    featured: body.featured != null ? Boolean(body.featured) : existing.featured,
  });
  res.json(product);
});

adminRouter.delete('/shop/products/:id', (req, res) => {
  if (!adminPlatform.deleteShopProduct(req.params.id)) { res.status(404).json({ error: 'محصول پیدا نشد' }); return; }
  res.json({ ok: true });
});

adminRouter.post('/shop/catalog/sync', (req, res) => {
  const products = Array.isArray(req.body?.products) ? req.body.products : [];
  const categories = Array.isArray(req.body?.categories) ? req.body.categories : undefined;
  if (!products.length) { res.status(400).json({ error: 'products خالی است' }); return; }
  const result = adminPlatform.replaceShopCatalog({
    products: products.map((p: Record<string, unknown>) => ({
      id: p.id != null ? String(p.id) : undefined,
      slug: String(p.slug), title: String(p.title),
      brandId: String(p.brandId ?? p.brand_id),
      categorySlug: String(p.categorySlug ?? p.category_slug),
      petTypes: Array.isArray(p.petTypes) ? p.petTypes.map(String) : [],
      priceToman: Number(p.priceToman ?? p.price_toman ?? 0),
      compareAtToman: p.compareAtToman != null || p.compare_at_toman != null
        ? Number(p.compareAtToman ?? p.compare_at_toman) : undefined,
      image: p.image ? String(p.image) : undefined,
      badge: (p.badge as string) ?? null,
      inStock: p.inStock !== false && p.in_stock !== 0,
      stockQty: Number(p.stockQty ?? p.stock_qty ?? (p.inStock === false ? 0 : 10)),
      params: (p.params as Record<string, string>) ?? {},
      description: String(p.description ?? ''),
      featured: Boolean(p.featured),
    })),
    categories: categories?.map((c: Record<string, unknown>, i: number) => ({
      slug: String(c.slug),
      labelFa: String(c.labelFa ?? c.label_fa),
      petType: String(c.petType ?? c.pet_type),
      description: String(c.description ?? ''),
      emoji: String(c.emoji ?? '🛒'),
      sortOrder: Number(c.sortOrder ?? c.sort_order ?? i * 10),
    })),
  });
  res.json({ ok: true, ...result });
});

adminRouter.get('/shop/categories', (_req, res) => {
  res.json({ categories: adminPlatform.listShopCategories() });
});

adminRouter.post('/shop/categories', (req, res) => {
  const body = req.body ?? {};
  if (!body.slug || !body.labelFa || !body.petType) {
    res.status(400).json({ error: 'slug, labelFa, petType الزامی‌اند' }); return;
  }
  res.status(201).json(adminPlatform.upsertShopCategory({
    slug: String(body.slug), labelFa: String(body.labelFa), petType: String(body.petType),
    description: body.description ? String(body.description) : '',
    emoji: body.emoji ? String(body.emoji) : '🛒',
    sortOrder: body.sortOrder != null ? Number(body.sortOrder) : 100,
  }));
});

adminRouter.delete('/shop/categories/:slug', (req, res) => {
  if (!adminPlatform.deleteShopCategory(req.params.slug)) { res.status(404).json({ error: 'دسته پیدا نشد' }); return; }
  res.json({ ok: true });
});

adminRouter.get('/shop/orders', (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  res.json({ orders: adminPlatform.listShopOrders({ status, limit: 150 }) });
});

adminRouter.patch('/shop/orders/:id/status', (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status || '');
  if (!status) { res.status(400).json({ error: 'status الزامی است' }); return; }
  const order = adminPlatform.updateShopOrderStatus(id, status);
  if (!order) { res.status(404).json({ error: 'سفارش پیدا نشد' }); return; }
  res.json(order);
});

adminRouter.post('/shop/orders', (req, res) => {
  const body = req.body ?? {};
  res.status(201).json(adminPlatform.createShopOrder({
    userId: body.userId != null ? Number(body.userId) : undefined,
    status: body.status ? String(body.status) : 'pending',
    totalToman: Number(body.totalToman ?? 0),
    items: Array.isArray(body.items) ? body.items : [],
    customerName: body.customerName ? String(body.customerName) : undefined,
    customerPhone: body.customerPhone ? String(body.customerPhone) : undefined,
    note: body.note ? String(body.note) : undefined,
    paymentCurrency: body.paymentCurrency ? String(body.paymentCurrency) : 'toman',
    paymentAmount: body.paymentAmount != null ? Number(body.paymentAmount) : undefined,
    cogsToman: body.cogsToman != null ? Number(body.cogsToman) : undefined,
  }));
});

adminRouter.get('/finance/dashboard', (req, res) => {
  res.json(adminFinance.getDashboard(req.query.period));
});

adminRouter.get('/finance/pnl', (req, res) => {
  res.json(adminFinance.getPnL(req.query.period));
});

adminRouter.get('/finance/sales', (req, res) => {
  res.json(adminFinance.getSalesCharts(req.query.period));
});

adminRouter.get('/finance/orders', (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  res.json(adminFinance.getOrdersRevenue(status));
});

adminRouter.get('/finance/wallet', (_req, res) => {
  res.json(adminFinance.getWalletOverview());
});

adminRouter.get('/finance/top-products', (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 15;
  res.json(adminFinance.getTopProducts(req.query.period, Number.isFinite(limit) ? limit : 15));
});

adminRouter.get('/finance/export', (req, res) => {
  const kind = req.query.kind === 'sales' ? 'sales' : 'pnl';
  const { filename, csv } = adminFinance.exportCsv(kind, req.query.period);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\uFEFF' + csv);
});

adminRouter.get('/content/announcements', (_req, res) => {
  res.json({ announcements: adminPlatform.listAnnouncements() });
});

adminRouter.post('/content/announcements', (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  if (!title) { res.status(400).json({ error: 'title الزامی است' }); return; }
  res.status(201).json(adminPlatform.upsertAnnouncement({
    title,
    body: typeof req.body?.body === 'string' ? req.body.body : '',
    active: req.body?.active !== false,
    placement: typeof req.body?.placement === 'string' ? req.body.placement : 'landing',
  }));
});

adminRouter.put('/content/announcements/:id', (req, res) => {
  const id = Number(req.params.id);
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  if (!title) { res.status(400).json({ error: 'title الزامی است' }); return; }
  res.json(adminPlatform.upsertAnnouncement({
    id, title,
    body: typeof req.body?.body === 'string' ? req.body.body : '',
    active: req.body?.active !== false,
    placement: typeof req.body?.placement === 'string' ? req.body.placement : 'landing',
  }));
});

adminRouter.delete('/content/announcements/:id', (req, res) => {
  if (!adminPlatform.deleteAnnouncement(Number(req.params.id))) {
    res.status(404).json({ error: 'اعلان پیدا نشد' }); return;
  }
  res.json({ ok: true });
});

adminRouter.get('/settings', (_req, res) => {
  const defaults: Record<string, string> = {
    shopEnabled: '1', playdatesEnabled: '1', vetConsultEnabled: '1', botForceJoin: '1',
    paymentCardEnabled: '1', paymentStarsEnabled: '1', maintenanceMode: '0',
    financeMarginPercent: '35',
    vetConsultFeeToman: '250000',
    playdateFeeToman: '0',
    financeOpExMonthlyToman: '5000000',
  };
  res.json({ settings: { ...defaults, ...adminPlatform.getSettings() } });
});

adminRouter.put('/settings', (req, res) => {
  const body = req.body?.settings && typeof req.body.settings === 'object' ? req.body.settings : req.body;
  if (!body || typeof body !== 'object') { res.status(400).json({ error: 'settings نامعتبر' }); return; }
  const patch: Record<string, string> = {};
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) patch[k] = String(v ?? '');
  res.json({ settings: adminPlatform.setSettings(patch) });
});

adminRouter.get('/logs', (req, res) => {
  const level = typeof req.query.level === 'string' ? req.query.level : undefined;
  const source = typeof req.query.source === 'string' ? req.query.source : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 100;
  const beforeId = req.query.beforeId ? Number(req.query.beforeId) : undefined;
  res.json({
    stats: dbService.getAppErrorLogStats(),
    logs: dbService.listAppErrorLogs({
      level, source,
      limit: Number.isFinite(limit) ? limit : 100,
      beforeId: Number.isFinite(beforeId) ? beforeId : undefined,
    }),
  });
});

adminRouter.delete('/logs', (req, res) => {
  const olderThanDays = req.query.olderThanDays ? Number(req.query.olderThanDays) : undefined;
  const cleared = dbService.clearAppErrorLogs(Number.isFinite(olderThanDays) ? olderThanDays : undefined);
  res.json({ ok: true, cleared });
});

adminRouter.post('/logs', (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message) { res.status(400).json({ error: 'message الزامی است' }); return; }
  const level = req.body?.level === 'warn' || req.body?.level === 'info' || req.body?.level === 'error' ? req.body.level : 'error';
  logAppEvent({
    level,
    source: typeof req.body?.source === 'string' ? req.body.source : 'external',
    message,
    stack: typeof req.body?.stack === 'string' ? req.body.stack : null,
    path: typeof req.body?.path === 'string' ? req.body.path : null,
    method: typeof req.body?.method === 'string' ? req.body.method : null,
    statusCode: typeof req.body?.statusCode === 'number' ? req.body.statusCode : null,
    meta: req.body?.meta && typeof req.body.meta === 'object' ? (req.body.meta as Record<string, unknown>) : null,
  });
  res.status(201).json({ ok: true });
});

adminRouter.get('/mail', async (_req, res) => {
  const smtp = getSmtpPublicConfig();
  let smtpReachable: { ok: boolean; detail: string } = {
    ok: false,
    detail: 'پیکربندی نشده',
  };
  if (smtp.configured && smtp.host) {
    const reachable = await checkTcpPort(smtp.host, smtp.port, 1500);
    smtpReachable = reachable
      ? { ok: true, detail: `TCP ${smtp.host}:${smtp.port} باز است` }
      : { ok: false, detail: `TCP ${smtp.host}:${smtp.port} در دسترس نیست` };
  }
  const pendingEmailOtps = dbService.listPendingWebOtps('email', 40);
  const stats = dbService.getEmailSendLogStats();
  const inbox = getInboxPublicStatus();
  let inboxUnread = 0;
  let inboxTotal = 0;
  if (inbox.configured) {
    try {
      const listed = await listInboxMessages(200);
      inboxTotal = listed.length;
      inboxUnread = listed.filter((m) => m.unread).length;
    } catch (err) {
      console.error('inbox list for status failed', err instanceof Error ? err.message : err);
    }
  }
  res.json({
    generatedAt: new Date().toISOString(),
    smtp,
    smtpReachable,
    newsletter: {
      from: SITE.newsletterEmail,
      subscribers: dbService.countNewsletterSubscribers(),
    },
    stats,
    otpMailer: {
      linked: smtp.configured,
      purpose: 'login_otp',
      pendingCount: pendingEmailOtps.length,
      ok24h: stats.otpOk24h,
      fail24h: stats.otpFail24h,
      detail: smtp.configured
        ? 'ورود وب با ایمیل از همین SMTP ارسال می‌شود (purpose=login_otp)'
        : 'SMTP خاموش است — OTP ایمیل کار نمی‌کند',
    },
    inbox: {
      ...inbox,
      total: inboxTotal,
      unread: inboxUnread,
    },
    recentSends: dbService.listEmailSendLogs({ limit: 80 }),
    pendingEmailOtps,
  });
});

const adminMailSendLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: 'تلاش ارسال ایمیل زیاد است. کمی بعد دوباره تلاش کن.',
});

function adminMailSendError(sent: { error: string; detail?: string }): string {
  if (sent.detail && sent.detail !== sent.error) {
    return `${sent.error}: ${sent.detail}`;
  }
  return sent.error || 'ارسال ناموفق بود';
}

adminRouter.get('/mail/inbox', async (req, res) => {
  if (!isInboxConfigured()) {
    res.status(503).json({ error: 'صندوق ورودی روی سرور پیکربندی نشده' });
    return;
  }
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  try {
    const messages = await listInboxMessages(limit);
    res.json({
      address: getInboxMailboxAddress(),
      count: messages.length,
      unread: messages.filter((m) => m.unread).length,
      messages,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'خواندن صندوق ورودی ناموفق بود', detail: message.slice(0, 300) });
  }
});

adminRouter.get('/mail/inbox/:id', async (req, res) => {
  if (!isInboxConfigured()) {
    res.status(503).json({ error: 'صندوق ورودی روی سرور پیکربندی نشده' });
    return;
  }
  try {
    const message = await getInboxMessage(String(req.params.id || ''), { markSeen: true });
    if (!message) {
      res.status(404).json({ error: 'پیام پیدا نشد' });
      return;
    }
    res.json({ message });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'خواندن پیام ناموفق بود', detail: message.slice(0, 300) });
  }
});

adminRouter.post('/mail/inbox/:id/reply', adminMailSendLimit, async (req, res) => {
  if (!isSmtpConfigured()) {
    res.status(503).json({ error: 'SMTP پیکربندی نشده' });
    return;
  }
  if (!isInboxConfigured()) {
    res.status(503).json({ error: 'صندوق ورودی روی سرور پیکربندی نشده' });
    return;
  }
  const original = await getInboxMessage(String(req.params.id || ''), { markSeen: true });
  if (!original) {
    res.status(404).json({ error: 'پیام پیدا نشد' });
    return;
  }
  if (!isPlausibleEmail(original.from)) {
    res.status(400).json({ error: 'فرستنده پیام برای ریپلای معتبر نیست' });
    return;
  }
  const body = typeof req.body?.body === 'string' ? req.body.body : '';
  const text = body.trim();
  if (!text || text.length > 20_000) {
    res.status(400).json({ error: 'متن پاسخ الزامی است (حداکثر ۲۰۰۰۰ کاراکتر)' });
    return;
  }
  const subject =
    typeof req.body?.subject === 'string' && req.body.subject.trim()
      ? req.body.subject.trim().slice(0, 200)
      : buildReplySubject(original.subject);
  const quote = original.text
    ? `\n\n----------\n${original.from} نوشت:\n${original.text.slice(0, 4000)}`
    : '';
  const fullText = `${text}${quote}`;
  const mailbox = getInboxMailboxAddress();
  const refs = [
    ...original.references,
    ...(original.messageId ? [original.messageId] : []),
  ];
  const sent = await sendMail({
    to: original.from,
    subject,
    text: fullText,
    html: buildBrandedMailHtml(fullText, { title: subject }),
    purpose: 'admin_reply',
    fromAddr: mailbox,
    fromName: 'پت‌دیت',
    inReplyTo: original.messageId || undefined,
    references: refs,
  });
  if (!sent.ok) {
    res.status(502).json({ error: adminMailSendError(sent) });
    return;
  }
  res.json({ ok: true, to: original.from, subject });
});

adminRouter.post('/mail/test', adminMailSendLimit, async (req, res) => {
  if (!isSmtpConfigured()) {
    res.status(503).json({ error: 'SMTP پیکربندی نشده' });
    return;
  }
  const to = typeof req.body?.to === 'string' ? req.body.to.trim().toLowerCase() : '';
  if (!isPlausibleEmail(to)) {
    res.status(400).json({ error: 'آدرس ایمیل معتبر نیست' });
    return;
  }
  const sent = await sendMail({
    to,
    subject: 'تست ارسال PetDate',
    text: `این یک ایمیل تست از پنل ادمین پت‌دیت است.\nزمان: ${new Date().toISOString()}`,
    html: buildBrandedMailHtml(
      `این یک ایمیل تست از پنل ادمین پت‌دیت است.\nزمان: ${new Date().toISOString()}`,
      { title: 'تست ارسال' }
    ),
    purpose: 'admin_test',
  });
  if (!sent.ok) {
    res.status(502).json({ error: adminMailSendError(sent) });
    return;
  }
  res.json({ ok: true, to });
});

adminRouter.post('/mail/send', adminMailSendLimit, async (req, res) => {
  if (!isSmtpConfigured()) {
    res.status(503).json({ error: 'SMTP پیکربندی نشده' });
    return;
  }
  const to = typeof req.body?.to === 'string' ? req.body.to.trim().toLowerCase() : '';
  const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : '';
  const body = typeof req.body?.body === 'string' ? req.body.body : '';
  const fromKind =
    typeof req.body?.from === 'string' ? req.body.from.trim().toLowerCase() : 'default';
  if (!isPlausibleEmail(to)) {
    res.status(400).json({ error: 'آدرس ایمیل معتبر نیست' });
    return;
  }
  if (!subject || subject.length > 200) {
    res.status(400).json({ error: 'موضوع الزامی است (حداکثر ۲۰۰ کاراکتر)' });
    return;
  }
  const text = body.trim();
  if (!text || text.length > 20_000) {
    res.status(400).json({ error: 'متن ایمیل الزامی است (حداکثر ۲۰۰۰۰ کاراکتر)' });
    return;
  }
  const newsletterFrom = SITE.newsletterEmail;
  const useNewsletter =
    fromKind === 'newsletter' ||
    fromKind === 'news' ||
    fromKind === newsletterFrom.toLowerCase();
  const sent = await sendMail({
    to,
    subject,
    text,
    html: buildBrandedMailHtml(text, { title: subject }),
    purpose: useNewsletter ? 'newsletter' : 'admin_compose',
    fromAddr: useNewsletter ? newsletterFrom : undefined,
    fromName: useNewsletter ? 'پت‌دیت' : undefined,
  });
  if (!sent.ok) {
    res.status(502).json({ error: adminMailSendError(sent) });
    return;
  }
  res.json({
    ok: true,
    to,
    subject,
    from: useNewsletter ? newsletterFrom : getSmtpPublicConfig().from,
  });
});

adminRouter.get('/newsletter/subscribers', (req, res) => {
  const limit = Number(req.query.limit) || 200;
  res.json({
    from: SITE.newsletterEmail,
    total: dbService.countNewsletterSubscribers(),
    subscribers: dbService.listNewsletterSubscribers({ limit }),
  });
});

type CheckStatus = 'up' | 'down' | 'not_configured';
type ServiceCheck = {
  ok: boolean;
  status: CheckStatus;
  detail: string;
  freeGb?: number;
  totalGb?: number;
};

function checkUp(detail: string, extra: Partial<ServiceCheck> = {}): ServiceCheck {
  return { ok: true, status: 'up', detail, ...extra };
}
function checkDown(detail: string, extra: Partial<ServiceCheck> = {}): ServiceCheck {
  return { ok: false, status: 'down', detail, ...extra };
}
function checkNotConfigured(detail = 'پیکربندی نشده'): ServiceCheck {
  // Intentional unused services must not look like outages.
  return { ok: true, status: 'not_configured', detail };
}

function checkTcpPort(host: string, port: number, timeoutMs = 1200): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok: boolean) => { try { socket.destroy(); } catch { /* */ } resolve(ok); };
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => done(true));
    socket.on('timeout', () => done(false));
    socket.on('error', () => done(false));
  });
}

function isLoopbackHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

/** Public apex host for admin UI — never show localhost/IP to operators. */
function publicApexHost(): string {
  try {
    const host = new URL(publicWebOrigin()).hostname.replace(/^www\./i, '');
    if (host && !isLoopbackHost(host) && !/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      return host;
    }
  } catch {
    /* fall through */
  }
  return 'petdate.ir';
}

/**
 * Display label for infra probes.
 * Internal docker/loopback listeners are shown as production domain + role, not localhost:port.
 */
function formatServiceEndpoint(host: string, port: number, roleFa: string): string {
  const apex = publicApexHost();
  if (isLoopbackHost(host)) {
    return `${apex} · ${roleFa} (داخلی)`;
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return `${apex} · ${roleFa} (داخلی)`;
  }
  return `${host}${port ? `:${port}` : ''} · ${roleFa}`;
}

async function probeService(
  url: string | undefined,
  defaultPort: number,
  roleFa: string,
): Promise<ServiceCheck> {
  if (!url) return checkNotConfigured();
  try {
    const u = new URL(url);
    const host = u.hostname || '127.0.0.1';
    const port = Number(u.port || defaultPort);
    const endpoint = formatServiceEndpoint(host, port, roleFa);
    const ok = await checkTcpPort(host, port);
    return ok ? checkUp(endpoint) : checkDown(`غیرقابل دسترس — ${endpoint}`);
  } catch (err) {
    return checkDown((err as Error).message);
  }
}

async function probeHttp(
  url: string | undefined,
  healthPath: string,
  defaultPort: number,
  roleFa: string,
): Promise<ServiceCheck> {
  if (!url) return checkNotConfigured();
  try {
    const base = new URL(url);
    const host = base.hostname || '127.0.0.1';
    const port = Number(base.port || defaultPort);
    const endpoint = formatServiceEndpoint(host, port, roleFa);
    const live = new URL(healthPath, `${base.protocol}//${host}:${port}`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    try {
      const res = await fetch(live, { method: 'GET', signal: controller.signal });
      if (res.ok) return checkUp(endpoint);
      return checkDown(`HTTP ${res.status} — ${endpoint}`);
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    // Fall back to TCP so a blocked health path does not hide a live listener.
    const tcp = await probeService(url, defaultPort, roleFa);
    if (tcp.status === 'up') {
      return checkUp(`${tcp.detail}`);
    }
    return checkDown((err as Error).message);
  }
}

/** Probe a public HTTPS URL as users see it on the main domain. */
async function probePublicUrl(url: string, label: string): Promise<ServiceCheck> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { Accept: 'application/json, text/html, */*' },
    });
    if (res.ok) {
      return checkUp(`${label} · HTTP ${res.status}`);
    }
    return checkDown(`${label} · HTTP ${res.status}`);
  } catch (err) {
    return checkDown(`${label} · ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

async function probeTelegramBot(): Promise<ServiceCheck> {
  const token = infra.telegram.botToken;
  if (!token) return checkNotConfigured('TELEGRAM_BOT_TOKEN نیست');
  const attempt = async (): Promise<ServiceCheck | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: controller.signal });
      const body = (await res.json()) as { ok?: boolean; result?: { username?: string; id?: number } };
      if (res.ok && body.ok && body.result) {
        const who = body.result.username ? `@${body.result.username}` : `id ${body.result.id ?? '?'}`;
        return checkUp(`live ${who}`);
      }
      return null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };
  const first = await attempt();
  if (first) return first;
  const second = await attempt();
  if (second) return second;
  return checkDown('توکن هست؛ Telegram getMe ناموفق');
}

function diskCheck(dir: string): ServiceCheck {
  try {
    const st = fs.statfsSync(dir);
    const total = Number(st.blocks) * Number(st.bsize);
    const free = Number(st.bavail) * Number(st.bsize);
    const freeGb = Math.round((free / 1024 ** 3) * 100) / 100;
    const totalGb = Math.round((total / 1024 ** 3) * 100) / 100;
    const detail = `${freeGb} / ${totalGb} GB آزاد`;
    return free > 512 * 1024 * 1024
      ? checkUp(detail, { freeGb, totalGb })
      : checkDown(detail, { freeGb, totalGb });
  } catch (err) {
    return checkDown((err as Error).message);
  }
}

adminRouter.get('/monitoring', async (_req, res) => {
  const mem = process.memoryUsage();
  const loadAvg = os.loadavg().map((n) => Math.round(n * 100) / 100);
  const postgresUrl = process.env.DATABASE_URL?.startsWith('postgres') ? process.env.DATABASE_URL : undefined;
  const webOrigin = publicWebOrigin();
  const pdfOrigin = publicPdfOrigin();
  const apex = publicApexHost();
  const siteUrl = webOrigin.replace(/\/$/, '');
  const wwwUrl = (() => {
    try {
      const u = new URL(siteUrl);
      if (!u.hostname.startsWith('www.')) u.hostname = `www.${u.hostname}`;
      return u.origin;
    } catch {
      return `https://www.${apex}`;
    }
  })();
  const apiHealthUrl = `${siteUrl}/api/health`;
  const apiHealthLocal = 'http://127.0.0.1:3001/api/health';
  const pdfUrl = pdfOrigin.replace(/\/$/, '') || `https://pdf.${apex}`;

  const [
    sitePublic,
    wwwPublic,
    apiPublic,
    pdfPublic,
    redis,
    postgres,
    s3,
    elasticsearch,
    telegramBot,
  ] = await Promise.all([
    probePublicUrl(siteUrl, apex),
    probePublicUrl(wwwUrl, `www.${apex}`),
    // Prefer loopback for API health to avoid hairpin NAT stalls on the same VPS.
    probePublicUrl(apiHealthLocal, `${apex}/api`).then(async (local) => {
      if (local.status === 'up') {
        return checkUp(`${apex}/api · HTTP 200 (local)`);
      }
      return probePublicUrl(apiHealthUrl, `${apex}/api`);
    }),
    probePublicUrl(pdfUrl, new URL(pdfUrl).hostname),
    probeService(process.env.REDIS_URL, 6379, 'Redis'),
    probeService(postgresUrl || 'postgresql://petdate@127.0.0.1:5432/petdate', 5432, 'Postgres'),
    hasS3Config()
      ? probeHttp(infra.s3.endpoint, '/minio/health/live', 9000, 'S3/MinIO')
      : Promise.resolve(checkNotConfigured()),
    hasElasticsearchConfig()
      ? probeHttp(infra.elasticsearch.url, '/_cluster/health', 9200, 'Elasticsearch')
      : Promise.resolve(checkNotConfigured()),
    probeTelegramBot(),
  ]);
  const counts = dbService.getOpsCounts();
  const logStats = dbService.getAppErrorLogStats();
  const disk = diskCheck(process.cwd());
  const dash = adminPlatform.getDashboardStats();
  const checks: Record<string, ServiceCheck> = {
    site: sitePublic,
    www: wwwPublic,
    api: apiPublic,
    pdf: pdfPublic,
    telegramBot,
    sqlite: usePostgresStorage()
      ? checkUp(`${apex} · SQLite (بکاپ محلی)`)
      : checkUp(`${apex} · SQLite (منبع حقیقت)`),
    postgres: postgresUrl
      ? (postgres.status === 'up'
          ? checkUp(
              usePostgresStorage()
                ? `${apex} · Postgres (منبع حقیقت)`
                : `${apex} · Postgres (آماده — هنوز SoT نیست)`
            )
          : postgres)
      : postgres.status === 'up'
        ? checkUp(`${apex} · Postgres روی سرور روشن است — DATABASE_URL ست نیست`)
        : checkNotConfigured('کانتینر Postgres در دسترس نیست / DATABASE_URL ست نیست'),
    redis,
    s3,
    elasticsearch,
    disk,
  };
  const unhealthy = Object.entries(checks)
    .filter(([, v]) => v.status === 'down')
    .map(([k]) => k);
  // Elasticsearch optional; Postgres is critical only when it is the active SoT.
  const nonCritical = new Set(['elasticsearch', ...(usePostgresStorage() ? [] : ['postgres'])]);
  const criticalUnhealthy = unhealthy.filter((k) => !nonCritical.has(k));
  res.json({
    ok: criticalUnhealthy.length === 0,
    generatedAt: new Date().toISOString(),
    publicDomain: apex,
    publicWebUrl: siteUrl,
    publicPdfUrl: pdfUrl,
    uptimeSec: Math.floor((Date.now() - STARTED_AT) / 1000),
    node: process.version,
    platform: `${os.type()} ${os.release()}`,
    hostname: os.hostname(),
    loadAvg,
    memory: {
      rssMb: Math.round(mem.rss / (1024 * 1024)),
      heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
      heapTotalMb: Math.round(mem.heapTotal / (1024 * 1024)),
      externalMb: Math.round(mem.external / (1024 * 1024)),
      systemFreeMb: Math.round(os.freemem() / (1024 * 1024)),
      systemTotalMb: Math.round(os.totalmem() / (1024 * 1024)),
    },
    counts: {
      users: counts.users, pets: counts.pets, playdates: counts.playdates,
      playdatesAccepted: counts.playdatesAccepted, chatMessages: counts.chatMessages,
      openGames: counts.openGames, shopOrders: dash.shopOrders, vetConsults: dash.vetConsults,
    },
    logs: { total: logStats.total, errors24h: logStats.errors24h, warns24h: logStats.warns24h, lastErrorAt: logStats.lastErrorAt },
    checks,
    unhealthy,
    redisConfigured: hasRedisConfig(),
    postgresConfigured: hasPostgresConfig(),
    s3Configured: hasS3Config(),
    elasticsearchConfigured: hasElasticsearchConfig(),
  });
});

adminRouter.post('/wallet/credit', (req, res) => {
  const userId = Number(req.body?.userId);
  const currencyRaw = String(req.body?.currency ?? '').trim().toLowerCase();
  const amount = Number(req.body?.amount);
  const currency = currencyRaw === 'ton' || currencyRaw === 'stars' || currencyRaw === 'coins' || currencyRaw === 'toman' ? currencyRaw : null;
  if (!Number.isFinite(userId) || userId <= 0) { res.status(400).json({ error: 'userId نامعتبر است' }); return; }
  if (!currency) { res.status(400).json({ error: 'currency باید ton | stars | coins | toman باشد' }); return; }
  if (!Number.isFinite(amount) || amount === 0) { res.status(400).json({ error: 'amount نامعتبر است' }); return; }
  const result = dbService.creditWallet(userId, currency, amount, {
    reason: amount > 0 ? 'واریز ادمین' : 'برداشت ادمین',
    refType: 'admin',
  });
  if (!result.ok) {
    res.status(result.reason === 'missing_user' ? 404 : 400).json({
      error: result.reason === 'missing_user' ? 'کاربر پیدا نشد' : 'مبلغ یا موجودی کافی نیست',
    });
    return;
  }
  res.json({ ok: true, user: result.user, wallet: result.user.wallet });
});

import { Router } from 'express';
import net from 'net';
import os from 'os';
import path from 'path';
import type { UserGender, UserRole, VerificationStatus, WalletCurrency } from '@petdate/shared';
import {
  FACE_VERIFY_REWARD,
  SITE,
  USER_ROLES,
  VERIFICATION_STATUSES,
} from '@petdate/shared';
import {
  hasElasticsearchConfig,
  hasPostgresConfig,
  hasRedisConfig,
  hasS3Config,
  infra,
} from '../config/infra';
import {
  checkDown,
  checkNotConfigured,
  checkUp,
  checkWarn,
  classifyElasticsearchHealth,
  classifyHttpResult,
  diskCheck,
  isNonCriticalCheck,
  sqliteFileCheck,
  type ServiceCheck,
} from '../admin-monitoring';
import { dbService, getResolvedDatabasePath, getStorageDriver } from '../db';
import { isCandooConfigured } from '../services/candoo';
import { adminPlatform } from '../admin-platform';
import { adminFinance } from '../admin-finance';
import { buildAggregateDashboard, getPlatformActivity } from '../admin-aggregate-dashboard';
import { buildSiteAnalyticsReport, buildTagManagerReport, createUtmCampaign, deleteUtmCampaign, listUtmCampaigns } from '../site-analytics';
import {
  adminCreatePet,
  adminUpdatePet,
  getAdminPetDossier,
  listAdminPets,
} from '../admin-pets';
import { logAppEvent } from '../services/app-logger';
import { completeShopCardPayment } from '../services/shop-checkout';
import {
  enqueueCard2CardFinanceOs,
  notifyCardPaymentApprovedTelegram,
  notifyCardPaymentRejectedTelegram,
  notifyCoinSellReviewedTelegram,
} from '../services/card2card-finance';
import { notifyFaceVerifyApprovedTelegram } from '../services/telegram-face-verify-notify';
import {
  mimeFromPaymentReceiptKey,
  paymentReceiptStorageKeyFromUrl,
  resolvePaymentReceiptPath,
} from '../services/payment-receipt-store';
import {
  fetchTelegramFileBytes,
  looksLikeTelegramFileId,
} from '../services/telegram-media';
import fs from 'fs';
import { telegramFetch, telegramBotApiUrl } from '../services/telegram-http';
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
import { decorateAiConsultDisplay } from '../services/ai-consult-session';
import { requireAdminAuth } from '../admin-auth';
import { actorHasPermission, resolveAdminActor } from '../hr-service';
import {
  listAdminHeaderNotifications,
  markAdminHeaderNotificationRead,
  markAllAdminHeaderNotificationsRead,
} from '../admin-notifications';
import { hrAdminRouter } from './admin-hr';
import { salesAdminRouter } from './admin-sales';
import { crmAdminRouter } from './admin-crm';
import { financeOsAdminRouter } from './admin-finance-os';
import { magazineAdminRouter } from './admin-magazine';

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

adminRouter.use(requireAdminAuth);

adminRouter.post('/auth/login', adminLoginLimit, (req, res) => {
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const username =
    typeof req.body?.username === 'string' && req.body.username.trim()
      ? req.body.username.trim()
      : undefined;
  const resolved = resolveAdminActor({ password, username });
  if (!resolved) {
    res.status(401).json({ error: 'رمز عبور اشتباه است' });
    return;
  }
  res.json({
    ok: true,
    role: resolved.role,
    permissions: resolved.permissions,
    displayName: resolved.displayName,
    username: resolved.username || null,
    avatarUrl: resolved.avatarUrl || null,
  });
});

adminRouter.get('/auth/me', (req, res) => {
  const actor = req.adminActor;
  if (!actor) {
    res.status(401).json({ error: 'دسترسی ادمین مجاز نیست' });
    return;
  }
  res.json({
    role: actor.role,
    permissions: actor.permissions,
    displayName: actor.displayName,
    username: actor.username || null,
    avatarUrl: actor.avatarUrl || null,
  });
});

/** Non-admin roles: read-only on platform routes (HR has its own write guard). */
adminRouter.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }
  if (
    req.path === '/auth/login' ||
    req.path.startsWith('/hr') ||
    req.path.startsWith('/sales') ||
    req.path.startsWith('/crm') ||
    req.path.startsWith('/finance-os') ||
    req.path.startsWith('/notifications') ||
    req.path.startsWith('/support')
  ) {
    next();
    return;
  }
  const actor = req.adminActor;
  if (!actor) {
    res.status(401).json({ error: 'دسترسی ادمین مجاز نیست' });
    return;
  }
  // Card-to-card deposit approve/reject is a finance/shop action, not only platform.write.
  if (
    /^\/payments\/\d+\/(approve|reject)$/.test(req.path) &&
    (actorHasPermission(actor, 'finance.write') ||
      actorHasPermission(actor, 'shop.write') ||
      actorHasPermission(actor, 'platform.write') ||
      actorHasPermission(actor, 'admin.full'))
  ) {
    next();
    return;
  }
  if (
    /^\/coin-sells\/\d+\/(paid|reject)$/.test(req.path) &&
    (actorHasPermission(actor, 'finance.write') ||
      actorHasPermission(actor, 'platform.write') ||
      actorHasPermission(actor, 'admin.full'))
  ) {
    next();
    return;
  }
  if (actorHasPermission(actor, 'platform.write') || actorHasPermission(actor, 'admin.full')) {
    next();
    return;
  }
  res.status(403).json({ error: 'این نقش فقط خواندن دارد — برای تغییر به مدیر کامل نیاز است' });
});

adminRouter.use('/hr', hrAdminRouter);
adminRouter.use('/sales', salesAdminRouter);
adminRouter.use('/crm', crmAdminRouter);
adminRouter.use('/finance-os', financeOsAdminRouter);
adminRouter.use('/magazine', magazineAdminRouter);

/** Platform sidebar open/pending badge counts (single aggregate query set). */
adminRouter.get('/platform/nav-counts', (req, res) => {
  const actor = req.adminActor;
  if (!actor) {
    res.status(401).json({ error: 'دسترسی ادمین مجاز نیست' });
    return;
  }
  // platform / finance / shop operators all need queue badges for their nav sections.
  if (
    !actorHasPermission(actor, 'platform.read') &&
    !actorHasPermission(actor, 'platform.write') &&
    !actorHasPermission(actor, 'finance.read') &&
    !actorHasPermission(actor, 'shop.read') &&
    !actorHasPermission(actor, 'admin.full')
  ) {
    res.status(403).json({ error: 'سطح دسترسی کافی نیست' });
    return;
  }
  try {
    res.json(adminPlatform.getPlatformNavCounts());
  } catch (err) {
    console.error('platform nav-counts:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/** Header bell — any logged-in admin; items filtered by module permission. */
adminRouter.get('/notifications', async (req, res) => {
  const actor = req.adminActor;
  if (!actor) {
    res.status(401).json({ error: 'دسترسی ادمین مجاز نیست' });
    return;
  }
  res.json(await listAdminHeaderNotifications(actor));
});

adminRouter.post('/notifications/read-all', (req, res) => {
  const actor = req.adminActor;
  if (!actor) {
    res.status(401).json({ error: 'دسترسی ادمین مجاز نیست' });
    return;
  }
  res.json(markAllAdminHeaderNotificationsRead(actor));
});

adminRouter.post('/notifications/:id/read', (req, res) => {
  const actor = req.adminActor;
  if (!actor) {
    res.status(401).json({ error: 'دسترسی ادمین مجاز نیست' });
    return;
  }
  const id = decodeURIComponent(String(req.params.id || ''));
  const result = markAdminHeaderNotificationRead(actor, id);
  if (!result.ok) {
    res.status(result.error === 'سطح دسترسی کافی نیست' ? 403 : 404).json({ error: result.error });
    return;
  }
  res.json({ ok: true });
});

adminRouter.get('/dashboard', async (req, res) => {
  const actor = req.adminActor;
  if (!actor) {
    res.status(401).json({ error: 'دسترسی ادمین مجاز نیست' });
    return;
  }
  try {
    const filters = {
      from: typeof req.query.from === 'string' ? req.query.from : undefined,
      to: typeof req.query.to === 'string' ? req.query.to : undefined,
      team: typeof req.query.team === 'string' ? req.query.team : undefined,
      personId: req.query.personId ? Number(req.query.personId) : undefined,
      module: typeof req.query.module === 'string' ? req.query.module : undefined,
      paymentType: typeof req.query.paymentType === 'string' ? req.query.paymentType : undefined,
      salesStage: typeof req.query.salesStage === 'string' ? req.query.salesStage : undefined,
    };
    res.json(await buildAggregateDashboard(actor, filters));
  } catch (err) {
    console.error('aggregate dashboard failed', err instanceof Error ? err.message : err);
    // Additive fallback — never break the executive shell
    res.json({
      generatedAt: new Date().toISOString(),
      stats: adminPlatform.getDashboardStats(),
      recentPets: dbService.listPets().slice(0, 8),
      recentPlaydates: dbService.listPlaydateRequests().slice(0, 8),
      recentConsults: dbService
        .listVetConsultations({ all: true })
        .slice(0, 8)
        .map(decorateAiConsultDisplay),
      recentShopOrders: adminPlatform.listShopOrders({ limit: 8 }),
      modules: null,
      series: null,
      links: null,
      error: 'بخشی از ماژول‌ها در دسترس نبود',
    });
  }
});

adminRouter.get('/dashboard/activity', (req, res) => {
  const actor = req.adminActor;
  if (!actor) {
    res.status(401).json({ error: 'دسترسی ادمین مجاز نیست' });
    return;
  }
  try {
    res.json(
      getPlatformActivity({
        from: typeof req.query.from === 'string' ? req.query.from : undefined,
        to: typeof req.query.to === 'string' ? req.query.to : undefined,
        team: typeof req.query.team === 'string' ? req.query.team : undefined,
        personId: req.query.personId ? Number(req.query.personId) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : 80,
      })
    );
  } catch (err) {
    console.error('dashboard activity failed', err instanceof Error ? err.message : err);
    res.json({ generatedAt: new Date().toISOString(), rows: [] });
  }
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

/** Iran choropleth: active users grouped by province (platform user scatter). */
adminRouter.get('/users/geo', (req, res) => {
  const activeOnly =
    req.query.active === '0' || req.query.active === 'false'
      ? false
      : true;
  res.json(adminPlatform.getUsersGeoDistribution({ activeOnly }));
});

adminRouter.patch('/users/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: 'شناسه نامعتبر' }); return; }
  let user = dbService.getUserById(id);
  if (!user) { res.status(404).json({ error: 'کاربر پیدا نشد' }); return; }
  const body = req.body || {};

  const profilePatch: Parameters<typeof dbService.updateUserProfile>[1] = {};
  if (typeof body.name === 'string') {
    const name = body.name.trim();
    if (name) profilePatch.name = name;
  }
  if (typeof body.username === 'string') {
    profilePatch.username = body.username.trim().replace(/^@+/, '');
  }
  if (typeof body.phone === 'string') profilePatch.phone = body.phone.trim();
  if (typeof body.email === 'string') profilePatch.email = body.email.trim();
  if (typeof body.city === 'string') profilePatch.city = body.city.trim();
  if (typeof body.province === 'string') profilePatch.province = body.province.trim();
  if (typeof body.country === 'string') profilePatch.country = body.country.trim();
  if (typeof body.bio === 'string') profilePatch.bio = body.bio.trim();
  if (body.age !== undefined && body.age !== null && body.age !== '') {
    const age = Number(body.age);
    if (Number.isFinite(age) && age >= 0) profilePatch.age = Math.floor(age);
  }
  if (body.gender === 'male' || body.gender === 'female') {
    profilePatch.gender = body.gender as UserGender;
  }
  if (Object.keys(profilePatch).length) {
    user = dbService.updateUserProfile(id, profilePatch) ?? user;
  }

  if (typeof body.isActive === 'boolean') {
    user = adminPlatform.setUserActive(id, body.isActive) ?? user;
  }

  if (Array.isArray(body.roles)) {
    let roles = (body.roles as unknown[]).filter(
      (r): r is UserRole => typeof r === 'string' && USER_ROLES.includes(r as UserRole)
    );
    if (roles.length) {
      const primary =
        typeof body.role === 'string' && USER_ROLES.includes(body.role as UserRole)
          ? (body.role as UserRole)
          : undefined;
      if (primary && !roles.includes(primary)) roles = [primary, ...roles];
      user = dbService.setUserRoles(id, roles) ?? user;
      if (primary) user = dbService.setUserPrimaryRole(id, primary) ?? user;
    }
  } else if (typeof body.role === 'string' && USER_ROLES.includes(body.role as UserRole)) {
    user = dbService.setUserRole(id, body.role as UserRole) ?? user;
  }

  if (
    typeof body.verificationStatus === 'string' &&
    VERIFICATION_STATUSES.includes(body.verificationStatus as VerificationStatus)
  ) {
    const status = body.verificationStatus as VerificationStatus;
    if (status !== user.verificationStatus) {
      const prevStatus = user.verificationStatus;
      user = dbService.setVerificationStatusAdmin(id, status) ?? user;
      if (status === 'verified' && prevStatus !== 'verified') {
        void notifyFaceVerifyApprovedTelegram({
          toTelegramId: user.telegramId,
          coins: FACE_VERIFY_REWARD,
        });
      }
    }
  }

  const walletRaw = body.wallet;
  if (walletRaw && typeof walletRaw === 'object') {
    const currencies: WalletCurrency[] = ['coins', 'toman', 'stars', 'ton'];
    const current = {
      coins: Number(user.coins) || 0,
      toman: Number(user.walletToman) || 0,
      stars: Number(user.walletStars) || 0,
      ton: Number(user.walletTon) || 0,
    };
    for (const currency of currencies) {
      if (walletRaw[currency] === undefined || walletRaw[currency] === null || walletRaw[currency] === '') {
        continue;
      }
      const target = Math.floor(Number(walletRaw[currency]));
      if (!Number.isFinite(target) || target < 0) {
        res.status(400).json({ error: `موجودی ${currency} نامعتبر است` });
        return;
      }
      const delta = target - current[currency];
      if (delta === 0) continue;
      const result = dbService.creditWallet(id, currency, delta, {
        reason: 'تنظیم ادمین',
        refType: 'admin',
      });
      if (!result.ok) {
        res.status(400).json({
          error:
            result.reason === 'missing_user'
              ? 'کاربر پیدا نشد'
              : `تنظیم کیف پول ${currency} ناموفق بود`,
        });
        return;
      }
      user = result.user;
      current[currency] = target;
    }
  }

  res.json(user);
});

/**
 * Soft-delete platform user (admin):
 * anonymize + deactivate shell, purge pets/sessions/identity,
 * keep payment/wallet ledger rows for finance integrity.
 * Requires platform.write / admin.full (router write guard).
 */
adminRouter.delete('/users/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  const existing = dbService.getUserById(id);
  if (!existing) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  // Already anonymized shell — idempotent success
  if (existing.isActive === false && String(existing.name || '').startsWith('[حذف‌شده')) {
    res.json({ ok: true, alreadyDeleted: true, user: existing });
    return;
  }
  const ok = dbService.deleteUserById(id);
  if (!ok) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  const shell = dbService.getUserById(id);
  logAppEvent({
    level: 'info',
    source: 'admin',
    message: `admin soft-delete user #${id}`,
    path: `/api/admin/users/${id}`,
    method: 'DELETE',
    meta: {
      userId: id,
      actor: req.adminActor?.username || req.adminActor?.displayName || null,
      role: req.adminActor?.role || null,
    },
  });
  res.json({ ok: true, user: shell });
});

adminRouter.get('/pets', (req, res) => {
  const species = typeof req.query.species === 'string' ? req.query.species : undefined;
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const ownerName = typeof req.query.ownerName === 'string' ? req.query.ownerName : undefined;
  const ownerPhone = typeof req.query.ownerPhone === 'string' ? req.query.ownerPhone : undefined;
  const lastEventFrom =
    typeof req.query.lastEventFrom === 'string' ? req.query.lastEventFrom : undefined;
  const lastEventTo =
    typeof req.query.lastEventTo === 'string' ? req.query.lastEventTo : undefined;
  const result = listAdminPets({
    species,
    q,
    ownerName,
    ownerPhone,
    lastEventFrom,
    lastEventTo,
  });
  res.json(result);
});

adminRouter.get('/pets/:id/dossier', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  const dossier = getAdminPetDossier(id);
  if (!dossier) {
    res.status(404).json({ error: 'پت پیدا نشد' });
    return;
  }
  res.json(dossier);
});

adminRouter.post('/pets', (req, res) => {
  const body = req.body || {};
  const ownerId = Number(body.ownerId);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const species = typeof body.species === 'string' ? body.species.trim() : '';
  if (!Number.isFinite(ownerId) || ownerId <= 0) {
    res.status(400).json({ error: 'ownerId الزامی است' });
    return;
  }
  if (!name || !species) {
    res.status(400).json({ error: 'نام و گونه الزامی است' });
    return;
  }
  if (!dbService.getUserById(ownerId)) {
    res.status(404).json({ error: 'مالک پیدا نشد' });
    return;
  }
  const ageMonths =
    body.ageMonths != null
      ? Number(body.ageMonths)
      : body.age != null
        ? Math.round(Number(body.age) * (body.ageUnit === 'month' ? 1 : 12))
        : undefined;
  const pet = adminCreatePet({
    ownerId,
    name,
    species,
    breed: typeof body.breed === 'string' ? body.breed : undefined,
    gender: body.gender,
    ageMonths: Number.isFinite(ageMonths as number) ? (ageMonths as number) : undefined,
    size: body.size,
    color: typeof body.color === 'string' ? body.color : undefined,
    bio: typeof body.bio === 'string' ? body.bio : undefined,
    vaccinated: typeof body.vaccinated === 'boolean' ? body.vaccinated : undefined,
    neutered: typeof body.neutered === 'boolean' ? body.neutered : undefined,
    lookingForPlaymate:
      typeof body.lookingForPlaymate === 'boolean' ? body.lookingForPlaymate : undefined,
    imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : undefined,
    city: typeof body.city === 'string' ? body.city : undefined,
    neighborhood: typeof body.neighborhood === 'string' ? body.neighborhood : undefined,
  });
  res.status(201).json(pet);
});

adminRouter.patch('/pets/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  const body = { ...(req.body || {}) };
  delete body.ownerId;
  delete body.id;
  if (body.age != null && body.ageMonths == null) {
    body.ageMonths = Math.round(Number(body.age) * (body.ageUnit === 'month' ? 1 : 12));
  }
  delete body.age;
  delete body.ageUnit;
  if (typeof body.type === 'string' && !body.species) {
    body.species = body.type;
  }
  delete body.type;
  const pet = adminUpdatePet(id, body);
  if (!pet) {
    res.status(404).json({ error: 'پت پیدا نشد' });
    return;
  }
  res.json(pet);
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
  ).map((reqRow) => {
    const fromPet = dbService.getPet(reqRow.fromPetId) ?? undefined;
    const toPet = dbService.getPet(reqRow.toPetId) ?? undefined;
    const fromUser = dbService.getUserById(reqRow.fromUserId);
    const toUser = reqRow.toUserId != null ? dbService.getUserById(reqRow.toUserId) : null;
    return {
      ...reqRow,
      fromPet,
      toPet,
      fromUserAvatarUrl: fromUser?.avatarUrl,
      toUserAvatarUrl: toUser?.avatarUrl,
      fromUserName: fromUser?.name,
      toUserName: toUser?.name,
    };
  });
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

adminRouter.get('/games', (req, res) => {
  const status = typeof req.query.status === 'string' && req.query.status.trim()
    ? (req.query.status as 'open' | 'full' | 'cancelled' | 'completed')
    : undefined;
  const gameType = typeof req.query.gameType === 'string' && req.query.gameType.trim()
    ? (req.query.gameType as import('@petdate/shared').GameType)
    : undefined;
  if (status && !['open', 'full', 'cancelled', 'completed'].includes(status)) {
    res.status(400).json({ error: 'وضعیت نامعتبر' });
    return;
  }
  const games = dbService.listGames({ status, gameType });
  res.json({ total: games.length, games });
});

adminRouter.get('/games/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || !Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'شناسه بازی نامعتبر است' });
    return;
  }
  const game = dbService.getGame(id);
  if (!game) {
    res.status(404).json({ error: 'بازی پیدا نشد' });
    return;
  }
  const players = dbService.getGamePlayers(game.id);
  res.json({ ...game, players });
});

adminRouter.patch('/games/:id/status', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || !Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'شناسه بازی نامعتبر است' });
    return;
  }
  const status = String(req.body?.status || '');
  if (!['open', 'full', 'cancelled', 'completed'].includes(status)) {
    res.status(400).json({ error: 'وضعیت نامعتبر' });
    return;
  }
  const updated = dbService.updateGameStatus(
    id,
    status as 'open' | 'full' | 'cancelled' | 'completed'
  );
  if (!updated) {
    res.status(404).json({ error: 'بازی پیدا نشد' });
    return;
  }
  res.json(updated);
});

adminRouter.get('/consultations', (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const items = dbService
    .listVetConsultations({
      all: true,
      ...(status ? { status: status as never } : {}),
    })
    .map(decorateAiConsultDisplay);
  res.json({ total: items.length, consultations: items });
});

adminRouter.patch('/consultations/:id/status', (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status || '');
  const updated = dbService.updateVetConsultationStatus(id, status as never);
  if (!updated) { res.status(404).json({ error: 'مشاوره پیدا نشد' }); return; }
  res.json(decorateAiConsultDisplay(updated));
});

adminRouter.get('/payments', (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  res.json({ orders: adminPlatform.listPaymentOrdersAdmin({ status, limit: 150 }) });
});

/**
 * Serve deposit receipt bytes for admin UI (web disk path or Telegram file_id).
 * Always streams bytes (no 302) so the panel can blob-fetch with x-admin-* headers.
 */
adminRouter.get('/payments/:id/receipt', async (req, res) => {
  const id = Number(req.params.id);
  const order = dbService.getPaymentOrder(id);
  if (!order) {
    res.status(404).json({ error: 'سفارش پیدا نشد' });
    return;
  }
  const raw = String(order.receiptFileId || order.receiptUrl || '').trim();
  if (!raw) {
    res.status(404).json({ error: 'رسیدی ثبت نشده' });
    return;
  }

  // Web / shop uploads — accept relative or absolute URLs containing the API path.
  const webMatch = raw.match(/\/api\/payments\/receipts\/(\d+\/[\w.~-]+)/);
  if (webMatch?.[1] || raw.startsWith('/api/payments/receipts/')) {
    const pathOnly = webMatch
      ? `/api/payments/receipts/${webMatch[1]}`
      : (raw.split('?')[0] ?? raw);
    const key = paymentReceiptStorageKeyFromUrl(pathOnly);
    const abs = key ? resolvePaymentReceiptPath(key) : null;
    if (!key || !abs || !fs.existsSync(abs)) {
      res.status(404).json({ error: 'فایل پیدا نشد' });
      return;
    }
    const ext = path.extname(key).toLowerCase();
    const contentType =
      ext === '.pdf' ? 'application/pdf' : mimeFromPaymentReceiptKey(key);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    fs.createReadStream(abs).pipe(res);
    return;
  }

  // Bot uploads: Telegram file_id (or already-mapped /api/media/telegram/… URL)
  let fileId = raw;
  const mediaMatch = raw.match(/\/api\/media\/telegram\/([^/?#]+)/);
  if (mediaMatch?.[1]) {
    try {
      fileId = decodeURIComponent(mediaMatch[1]);
    } catch {
      fileId = mediaMatch[1];
    }
  }
  if (!looksLikeTelegramFileId(fileId)) {
    res.status(404).json({ error: 'رسید نامعتبر است' });
    return;
  }
  try {
    const bytes = await fetchTelegramFileBytes(fileId);
    if (!bytes) {
      res.status(404).json({ error: 'فایل تلگرام پیدا نشد' });
      return;
    }
    let contentType = bytes.contentType || 'image/jpeg';
    if (!contentType.startsWith('image/') && contentType !== 'application/pdf') {
      if (bytes.buffer[0] === 0xff && bytes.buffer[1] === 0xd8) contentType = 'image/jpeg';
      else if (bytes.buffer[0] === 0x89 && bytes.buffer[1] === 0x50) contentType = 'image/png';
      else if (bytes.buffer[0] === 0x25 && bytes.buffer[1] === 0x50) contentType = 'application/pdf';
      else contentType = 'image/jpeg';
    }
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(bytes.buffer);
  } catch (err) {
    console.warn('admin payment receipt telegram proxy failed:', (err as Error).message);
    res.status(502).json({ error: 'دریافت رسید از تلگرام ناموفق بود' });
  }
});

adminRouter.post('/payments/:id/approve', (req, res) => {
  const id = Number(req.params.id);
  const note = typeof req.body?.note === 'string' ? req.body.note : undefined;
  const existing = dbService.getPaymentOrder(id);
  if (existing && String(existing.packageId) === 'shopcard') {
    const result = completeShopCardPayment({ orderId: id, adminNote: note });
    if (!result.ok) {
      res.status(400).json({ error: result.reason, message: result.error });
      return;
    }
    enqueueCard2CardFinanceOs({
      orderId: id,
      amountToman: result.paymentOrder.amountToman ?? 0,
      userId: result.paymentOrder.userId,
      kind: 'shopcard',
      packageId: result.paymentOrder.packageId,
    });
    void notifyCardPaymentApprovedTelegram({
      toTelegramId: result.user?.telegramId ?? existing.userTelegramId,
      shopOrderId: result.shopOrder.id,
      kind: 'shopcard',
    });
    res.json({
      ok: true,
      order: result.paymentOrder,
      user: result.user,
      shopOrder: result.shopOrder,
      kind: 'shopcard',
    });
    return;
  }
  const result = dbService.approveCardPayment(id, note);
  if (!result.ok) { res.status(400).json({ error: result.reason }); return; }
  enqueueCard2CardFinanceOs({
    orderId: id,
    amountToman: result.order.amountToman ?? 0,
    userId: result.order.userId,
    kind: 'coins',
    packageId: result.order.packageId,
  });
  void notifyCardPaymentApprovedTelegram({
    toTelegramId: result.user.telegramId ?? result.order.userTelegramId,
    coins: result.order.coins,
    kind: 'coins',
  });
  res.json(result);
});

adminRouter.post('/payments/:id/reject', (req, res) => {
  const id = Number(req.params.id);
  const note = typeof req.body?.note === 'string' ? req.body.note : undefined;
  const result = dbService.rejectCardPayment(id, note);
  if (!result.ok) { res.status(400).json({ error: result.reason }); return; }
  void notifyCardPaymentRejectedTelegram({
    toTelegramId: result.user?.telegramId ?? result.order.userTelegramId,
    note,
  });
  res.json(result);
});

adminRouter.get('/coin-sells', (req, res) => {
  const statusRaw = typeof req.query.status === 'string' ? req.query.status : 'open';
  const status =
    statusRaw === 'paid' || statusRaw === 'rejected' || statusRaw === 'cancelled' || statusRaw === 'all'
      ? statusRaw
      : 'open';
  res.json({
    requests: dbService.listCoinSellRequestsAdmin({ status, limit: 150 }),
    openCount: dbService.countOpenCoinSellRequests(),
  });
});

adminRouter.post('/coin-sells/:id/paid', (req, res) => {
  const id = Number(req.params.id);
  const note = typeof req.body?.note === 'string' ? req.body.note : undefined;
  const result = dbService.reviewCoinSellRequest(id, { action: 'paid', note });
  if (!result.ok) {
    res.status(result.reason === 'missing' ? 404 : 400).json({
      error: result.reason === 'missing' ? 'درخواست پیدا نشد' : 'این درخواست دیگر باز نیست',
    });
    return;
  }
  void notifyCoinSellReviewedTelegram({
    toTelegramId: result.request.userTelegramId,
    action: 'paid',
    coins: result.request.coins,
    amountToman: result.request.amountToman,
    note,
  });
  res.json({ ok: true, request: result.request });
});

adminRouter.post('/coin-sells/:id/reject', (req, res) => {
  const id = Number(req.params.id);
  const note = typeof req.body?.note === 'string' ? req.body.note : undefined;
  const result = dbService.reviewCoinSellRequest(id, { action: 'rejected', note });
  if (!result.ok) {
    res.status(result.reason === 'missing' ? 404 : 400).json({
      error: result.reason === 'missing' ? 'درخواست پیدا نشد' : 'این درخواست دیگر باز نیست',
    });
    return;
  }
  void notifyCoinSellReviewedTelegram({
    toTelegramId: result.request.userTelegramId,
    action: 'rejected',
    coins: result.request.coins,
    amountToman: result.request.amountToman,
    note,
  });
  res.json({ ok: true, request: result.request, refundedCoins: result.refundedCoins });
});

adminRouter.get('/support/threads', (req, res) => {
  const actor = req.adminActor;
  if (
    actor &&
    !actorHasPermission(actor, 'support.inbox') &&
    !actorHasPermission(actor, 'support.write') &&
    !actorHasPermission(actor, 'crm.read') &&
    !actorHasPermission(actor, 'platform.read') &&
    !actorHasPermission(actor, 'admin.full')
  ) {
    res.status(403).json({ error: 'دسترسی پشتیبانی مجاز نیست' });
    return;
  }
  res.json({ threads: dbService.listSupportThreadsAdmin(120) });
});

adminRouter.get('/support/threads/:userId', (req, res) => {
  const actor = req.adminActor;
  if (
    actor &&
    !actorHasPermission(actor, 'support.inbox') &&
    !actorHasPermission(actor, 'support.write') &&
    !actorHasPermission(actor, 'crm.read') &&
    !actorHasPermission(actor, 'platform.read') &&
    !actorHasPermission(actor, 'admin.full')
  ) {
    res.status(403).json({ error: 'دسترسی پشتیبانی مجاز نیست' });
    return;
  }
  const userId = Number(req.params.userId);
  if (!Number.isFinite(userId)) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  const user = dbService.getUserById(userId);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  res.json({
    user: { id: user.id, name: user.name, phone: user.phone, telegramId: user.telegramId },
    messages: dbService.listSupportMessages(userId, 200),
  });
});

adminRouter.post('/support/threads/:userId/reply', (req, res) => {
  const actor = req.adminActor;
  if (
    actor &&
    !actorHasPermission(actor, 'support.write') &&
    !actorHasPermission(actor, 'crm.write') &&
    !actorHasPermission(actor, 'platform.write') &&
    !actorHasPermission(actor, 'admin.full')
  ) {
    res.status(403).json({ error: 'ارسال پاسخ پشتیبانی مجاز نیست' });
    return;
  }
  const userId = Number(req.params.userId);
  const text = String(req.body?.text ?? '').trim();
  if (!Number.isFinite(userId) || !text) {
    res.status(400).json({ error: 'متن پاسخ الزامی است' });
    return;
  }
  const user = dbService.getUserById(userId);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  const actorName = actor?.displayName || actor?.username || 'پشتیبانی';
  const msg = dbService.addSupportMessage(userId, 'assistant', `[${actorName}]\n${text}`);
  res.status(201).json({ ok: true, message: msg, messages: dbService.listSupportMessages(userId, 200) });
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
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  res.json({ orders: adminPlatform.listShopOrders({ status, q, limit: 150 }) });
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
    vetConsultFeePercent: '20',
    playdateFeeToman: '0',
    financeOpExMonthlyToman: '5000000',
    ga4MeasurementId: '',
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

/* ── Platform Settings: modular dropdowns + per-module goals ── */
adminRouter.get('/platform-settings/modules', (_req, res) => {
  try {
    const {
      listPlatformModules,
      ensurePlatformSettingsSchema,
    } = require('../platform-settings-service') as typeof import('../platform-settings-service');
    ensurePlatformSettingsSchema();
    res.json({ modules: listPlatformModules() });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'خطا' });
  }
});

adminRouter.get('/platform-settings/modules/:moduleKey/fields', (req, res) => {
  try {
    const { listDropdownFieldsForModule, ensurePlatformSettingsSchema } =
      require('../platform-settings-service') as typeof import('../platform-settings-service');
    ensurePlatformSettingsSchema();
    res.json({ fields: listDropdownFieldsForModule(String(req.params.moduleKey)) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'خطا' });
  }
});

adminRouter.get('/platform-settings/modules/:moduleKey/fields/:fieldKey/options', (req, res) => {
  try {
    const { listDropdownOptions, ensurePlatformSettingsSchema } =
      require('../platform-settings-service') as typeof import('../platform-settings-service');
    ensurePlatformSettingsSchema();
    const includeInactive = String(req.query.includeInactive || '1') !== '0';
    res.json({
      options: listDropdownOptions(String(req.params.moduleKey), String(req.params.fieldKey), {
        includeInactive,
      }),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'خطا' });
  }
});

adminRouter.post('/platform-settings/modules/:moduleKey/fields/:fieldKey/options', (req, res) => {
  try {
    const { createDropdownOption } =
      require('../platform-settings-service') as typeof import('../platform-settings-service');
    const actor = req.adminActor;
    const option = createDropdownOption({
      moduleKey: String(req.params.moduleKey),
      fieldKey: String(req.params.fieldKey),
      value: typeof req.body?.value === 'string' ? req.body.value : undefined,
      label: String(req.body?.label || ''),
      sortOrder: req.body?.sortOrder != null ? Number(req.body.sortOrder) : undefined,
      actor: actor?.displayName || actor?.username || actor?.role || 'admin',
    });
    res.status(201).json({ option });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'خطا' });
  }
});

adminRouter.patch('/platform-settings/options/:id', (req, res) => {
  try {
    const { updateDropdownOption } =
      require('../platform-settings-service') as typeof import('../platform-settings-service');
    const actor = req.adminActor;
    const option = updateDropdownOption(Number(req.params.id), {
      label: typeof req.body?.label === 'string' ? req.body.label : undefined,
      sortOrder: req.body?.sortOrder != null ? Number(req.body.sortOrder) : undefined,
      actor: actor?.displayName || actor?.username || actor?.role || 'admin',
    });
    res.json({ option });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'خطا' });
  }
});

adminRouter.delete('/platform-settings/options/:id', (req, res) => {
  try {
    const { softDeleteDropdownOption } =
      require('../platform-settings-service') as typeof import('../platform-settings-service');
    const actor = req.adminActor;
    const option = softDeleteDropdownOption(
      Number(req.params.id),
      actor?.displayName || actor?.username || actor?.role || 'admin'
    );
    res.json({ option, softDeleted: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'خطا' });
  }
});

adminRouter.post('/platform-settings/options/:id/restore', (req, res) => {
  try {
    const { restoreDropdownOption } =
      require('../platform-settings-service') as typeof import('../platform-settings-service');
    const actor = req.adminActor;
    const option = restoreDropdownOption(
      Number(req.params.id),
      actor?.displayName || actor?.username || actor?.role || 'admin'
    );
    res.json({ option });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'خطا' });
  }
});

adminRouter.get('/platform-settings/audit', (req, res) => {
  try {
    const { listDropdownAudit, ensurePlatformSettingsSchema } =
      require('../platform-settings-service') as typeof import('../platform-settings-service');
    ensurePlatformSettingsSchema();
    const moduleKey = typeof req.query.moduleKey === 'string' ? req.query.moduleKey : undefined;
    const fieldKey = typeof req.query.fieldKey === 'string' ? req.query.fieldKey : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    res.json({
      audit: listDropdownAudit({
        moduleKey,
        fieldKey,
        limit: Number.isFinite(limit) ? limit : 100,
      }),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'خطا' });
  }
});

adminRouter.get('/platform-settings/goals', (_req, res) => {
  try {
    const { listAllModuleGoals, ensurePlatformSettingsSchema } =
      require('../platform-settings-service') as typeof import('../platform-settings-service');
    ensurePlatformSettingsSchema();
    res.json({ goals: listAllModuleGoals() });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'خطا' });
  }
});

adminRouter.get('/platform-settings/modules/:moduleKey/goals', (req, res) => {
  try {
    const { getModuleGoals, ensurePlatformSettingsSchema } =
      require('../platform-settings-service') as typeof import('../platform-settings-service');
    const { getPlatformGoalMetrics } = require('@petdate/shared') as typeof import('@petdate/shared');
    ensurePlatformSettingsSchema();
    const moduleKey = String(req.params.moduleKey);
    res.json({
      goals: getModuleGoals(moduleKey),
      metrics: getPlatformGoalMetrics(moduleKey),
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'خطا' });
  }
});

adminRouter.put('/platform-settings/modules/:moduleKey/goals', (req, res) => {
  try {
    const { upsertModuleGoals } =
      require('../platform-settings-service') as typeof import('../platform-settings-service');
    const { getPlatformGoalMetrics } = require('@petdate/shared') as typeof import('@petdate/shared');
    const actor = req.adminActor;
    const targets =
      req.body?.targets && typeof req.body.targets === 'object'
        ? (req.body.targets as Record<string, number>)
        : (req.body as Record<string, number>);
    const goals = upsertModuleGoals({
      moduleKey: String(req.params.moduleKey),
      targets: targets || {},
      actor: actor?.displayName || actor?.username || actor?.role || 'admin',
    });
    res.json({
      goals,
      metrics: getPlatformGoalMetrics(String(req.params.moduleKey)),
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'خطا' });
  }
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

async function probeElasticsearch(): Promise<ServiceCheck> {
  if (!hasElasticsearchConfig() || !infra.elasticsearch.url) {
    return checkNotConfigured();
  }
  try {
    const base = new URL(infra.elasticsearch.url);
    const host = base.hostname || '127.0.0.1';
    const port = Number(base.port || 9200);
    const endpoint = formatServiceEndpoint(host, port, 'Elasticsearch');
    const live = new URL('/_cluster/health', `${base.protocol}//${host}:${port}`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    try {
      const res = await fetch(live, { method: 'GET', signal: controller.signal });
      if (!res.ok) return checkDown(`HTTP ${res.status} — ${endpoint}`);
      const body = (await res.json()) as { status?: string };
      return classifyElasticsearchHealth(String(body.status || ''), endpoint);
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    const tcp = await probeService(infra.elasticsearch.url, 9200, 'Elasticsearch');
    if (tcp.status === 'up') {
      return checkWarn(`${tcp.detail} · health خوانده نشد`);
    }
    return checkDown((err as Error).message);
  }
}

async function probeRedis(): Promise<ServiceCheck> {
  const url = process.env.REDIS_URL;
  if (!url) return checkNotConfigured();
  try {
    const u = new URL(url);
    const host = u.hostname || '127.0.0.1';
    const port = Number(u.port || 6379);
    const endpoint = formatServiceEndpoint(host, port, 'Redis');
    const { default: Redis } = await import('ioredis');
    const client = new Redis(url, {
      connectTimeout: 1500,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    try {
      await client.connect();
      const pong = await Promise.race([
        client.ping(),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('Redis PING timeout')), 1500),
        ),
      ]);
      if (String(pong).toUpperCase() === 'PONG') {
        return checkUp(endpoint);
      }
      return checkWarn(`${endpoint} · پاسخ غیرمنتظره`);
    } finally {
      try {
        client.disconnect();
      } catch {
        /* */
      }
    }
  } catch (err) {
    const tcp = await probeService(process.env.REDIS_URL, 6379, 'Redis');
    if (tcp.status === 'up') {
      return checkWarn(`${tcp.detail} · PING ناموفق`);
    }
    return checkDown((err as Error).message);
  }
}

async function probeSmtp(): Promise<ServiceCheck> {
  if (!isSmtpConfigured()) return checkNotConfigured('SMTP_HOST نیست');
  const smtp = getSmtpPublicConfig();
  const host = smtp.host || '127.0.0.1';
  const port = smtp.port || 587;
  const endpoint = formatServiceEndpoint(host, port, 'SMTP');
  const ok = await checkTcpPort(host, port, 1500);
  return ok ? checkUp(endpoint) : checkDown(`غیرقابل دسترس — ${endpoint}`);
}

async function probeSms(): Promise<ServiceCheck> {
  if (!isCandooConfigured()) return checkNotConfigured('Candoo پیکربندی نشده');
  const base = (process.env.CANDOO_API_URL || 'https://api.candoosms.com').replace(/\/$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  const started = Date.now();
  try {
    // Any HTTP response (incl. 401/404) means the SMS edge is reachable.
    const res = await fetch(base, { method: 'GET', signal: controller.signal });
    const latencyMs = Date.now() - started;
    if (res.status > 0) {
      return checkUp(`Candoo · HTTP ${res.status}`, { latencyMs });
    }
    return checkDown('Candoo · بدون پاسخ');
  } catch (err) {
    return checkDown(`Candoo · ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Probe a public HTTPS URL as users see it on the main domain. */
async function probePublicUrl(url: string, label: string): Promise<ServiceCheck> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { Accept: 'application/json, text/html, */*' },
    });
    return classifyHttpResult(label, res.status, Date.now() - started);
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
      const res = await telegramFetch(telegramBotApiUrl(token, 'getMe'), { signal: controller.signal });
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

adminRouter.get('/site-analytics/reports', (req, res) => {
  try {
    const days = req.query.days ? Number(req.query.days) : 14;
    res.json(buildSiteAnalyticsReport(Number.isFinite(days) ? days : 14));
  } catch (err) {
    console.error('site-analytics reports:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

adminRouter.get('/site-analytics/tag-manager', (req, res) => {
  try {
    const days = req.query.days ? Number(req.query.days) : 14;
    res.json(buildTagManagerReport(Number.isFinite(days) ? days : 14));
  } catch (err) {
    console.error('site-analytics tag-manager:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

adminRouter.get('/site-analytics/utm-campaigns', (_req, res) => {
  try {
    res.json({ campaigns: listUtmCampaigns() });
  } catch (err) {
    console.error('utm-campaigns list:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

adminRouter.post('/site-analytics/utm-campaigns', (req, res) => {
  try {
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const created = createUtmCampaign({
      name: typeof body.name === 'string' ? body.name : '',
      path: typeof body.path === 'string' ? body.path : '/',
      utmSource: typeof body.utmSource === 'string' ? body.utmSource : '',
      utmMedium: typeof body.utmMedium === 'string' ? body.utmMedium : '',
      utmCampaign: typeof body.utmCampaign === 'string' ? body.utmCampaign : '',
      utmContent: typeof body.utmContent === 'string' ? body.utmContent : null,
      utmTerm: typeof body.utmTerm === 'string' ? body.utmTerm : null,
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

adminRouter.delete('/site-analytics/utm-campaigns/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: 'شناسه نامعتبر' });
      return;
    }
    const ok = deleteUtmCampaign(id);
    if (!ok) {
      res.status(404).json({ error: 'یافت نشد' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

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
  const wsHealthUrl = `https://ws.${apex}/healthz`;
  const sqlitePath =
    getResolvedDatabasePath() ||
    (process.env.DATABASE_PATH || '').trim() ||
    path.join(process.cwd(), 'packages/api/data/petdate.db');
  const sqliteRole = usePostgresStorage()
    ? `${apex} · SQLite (بکاپ محلی)`
    : `${apex} · SQLite (منبع حقیقت)`;

  const [
    sitePublic,
    wwwPublic,
    apiPublic,
    pdfPublic,
    wsPublic,
    redis,
    postgres,
    s3,
    elasticsearch,
    telegramBot,
    smtp,
    sms,
  ] = await Promise.all([
    probePublicUrl(siteUrl, apex),
    probePublicUrl(wwwUrl, `www.${apex}`),
    // Prefer loopback for API health to avoid hairpin NAT stalls on the same VPS.
    probePublicUrl(apiHealthLocal, `${apex}/api`).then(async (local) => {
      if (local.status === 'up' || local.status === 'warn') {
        return checkUp(`${apex}/api · HTTP 200 (local)`, { latencyMs: local.latencyMs });
      }
      return probePublicUrl(apiHealthUrl, `${apex}/api`);
    }),
    probePublicUrl(pdfUrl, new URL(pdfUrl).hostname),
    probePublicUrl(wsHealthUrl, `ws.${apex}`),
    probeRedis(),
    probeService(postgresUrl || 'postgresql://petdate@127.0.0.1:5432/petdate', 5432, 'Postgres'),
    hasS3Config()
      ? probeHttp(infra.s3.endpoint, '/minio/health/live', 9000, 'S3/MinIO')
      : Promise.resolve(checkNotConfigured()),
    probeElasticsearch(),
    probeTelegramBot(),
    probeSmtp(),
    probeSms(),
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
    websocket: wsPublic,
    telegramBot,
    sqlite: sqliteFileCheck(sqlitePath, sqliteRole),
    postgres: postgresUrl
      ? (postgres.status === 'up'
          ? checkUp(
              usePostgresStorage()
                ? `${apex} · Postgres (منبع حقیقت)`
                : `${apex} · Postgres (آماده — هنوز SoT نیست)`
            )
          : postgres)
      : postgres.status === 'up'
        ? checkWarn(`${apex} · Postgres روی سرور روشن است — DATABASE_URL ست نیست`)
        : checkNotConfigured('کانتینر Postgres در دسترس نیست / DATABASE_URL ست نیست'),
    redis,
    s3,
    elasticsearch,
    smtp,
    sms,
    disk,
  };
  const unhealthy = Object.entries(checks)
    .filter(([, v]) => v.status === 'down')
    .map(([k]) => k);
  const warnings = Object.entries(checks)
    .filter(([, v]) => v.status === 'warn')
    .map(([k]) => k);
  const criticalUnhealthy = unhealthy.filter((k) => !isNonCriticalCheck(k, usePostgresStorage()));
  res.json({
    ok: criticalUnhealthy.length === 0,
    degraded: warnings.length > 0,
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
    warnings,
    redisConfigured: hasRedisConfig(),
    postgresConfigured: hasPostgresConfig(),
    s3Configured: hasS3Config(),
    elasticsearchConfigured: hasElasticsearchConfig(),
    smtpConfigured: isSmtpConfigured(),
    smsConfigured: isCandooConfigured(),
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

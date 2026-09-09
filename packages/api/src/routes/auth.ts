import fs from 'fs';
import { Router } from 'express';
import multer from 'multer';
import type { OnboardingStatus, UserGender, UserRole } from '@petdate/shared';
import {
  COIN_SELL_PRICE_TOMAN,
  MIN_SELL_COINS,
  USER_ROLES,
  normalizeRoles,
  sellAmountToman,
  userHasRole,
  validateIranCard,
} from '@petdate/shared';
import { dbService } from '../db';
import {
  completeTelegramAttach,
  completeTelegramLoginPending,
  createTelegramAttachLink,
  createTelegramLoginPending,
  exchangeTelegramWebLink,
  pollTelegramLoginPending,
} from '../services/telegram-web-link';
import {
  MAX_USER_AVATAR_BYTES,
  mimeFromUserAvatarKey,
  resolveUserAvatarPath,
  saveUserAvatar,
} from '../services/user-avatar-store';
import {
  MAX_PROVIDER_CREDENTIAL_BYTES,
  mimeFromProviderCredentialKey,
  resolveProviderCredentialPath,
  saveProviderCredential,
} from '../services/provider-credential-store';
import { rateLimit } from '../middleware/rate-limit';
import {
  getUserFromBearer,
  requestWebOtp,
  verifyWebOtp,
  type WebOtpChannel,
} from '../services/web-otp';

export const authRouter = Router();

const otpRequestLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  keyFn: (req) => `${String(req.body?.channel ?? '')}:${String(req.body?.target ?? '').trim()}`,
  message: 'درخواست کد زیاد شده. ۱۵ دقیقه صبر کن و دوباره تلاش کن.',
});

const otpVerifyLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyFn: (req) => `${String(req.body?.channel ?? '')}:${String(req.body?.target ?? '').trim()}`,
  message: 'تلاش‌های ورود زیاد است. کمی بعد دوباره تلاش کن.',
});

const telegramLoginStartLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'درخواست ورود تلگرام زیاد شده. کمی بعد دوباره تلاش کن.',
});

const telegramLoginStatusLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 90,
  keyFn: (req) => String(req.params?.id ?? ''),
  message: 'درخواست وضعیت زیاد است. کمی صبر کن.',
});

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_USER_AVATAR_BYTES, files: 1 },
});

const credentialUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PROVIDER_CREDENTIAL_BYTES, files: 1 },
});

/**
 * Bot deep-link → web session (HMAC with TELEGRAM_BOT_TOKEN).
 * Keeps the same users row so pets/wallet sync between Telegram and the site.
 */
authRouter.post('/telegram/exchange', async (req, res) => {
  const result = await exchangeTelegramWebLink({
    telegramId: String(req.body?.telegramId ?? req.body?.tg ?? ''),
    exp: req.body?.exp,
    sig: String(req.body?.sig ?? ''),
  });
  if (!result.ok) {
    const status = result.reason === 'expired' ? 410 : 400;
    res.status(status).json(result);
    return;
  }
  res.json({ ok: true, token: result.token, user: result.user });
});

/**
 * Mobile same-browser Telegram login: create pending session + bot deep link.
 * Browser stays on waiting page and polls `/telegram/login-status/:id`.
 */
authRouter.post('/telegram/login-start', telegramLoginStartLimit, (req, res) => {
  const result = createTelegramLoginPending(
    req.body?.next != null ? String(req.body.next) : undefined
  );
  if (!result.ok) {
    const status = result.reason === 'not_configured' ? 503 : 400;
    res.status(status).json(result);
    return;
  }
  res.json(result);
});

/**
 * Poll pending Telegram login. When ready, returns token once (consumed).
 */
authRouter.get('/telegram/login-status/:id', telegramLoginStatusLimit, (req, res) => {
  const result = pollTelegramLoginPending(String(req.params.id ?? ''));
  if (!result.ok) {
    res.status(400).json(result);
    return;
  }
  if (result.status === 'ready') {
    res.json({
      ok: true,
      status: 'ready',
      token: result.token,
      user: result.user,
      next: result.next,
    });
    return;
  }
  if (result.status === 'pending') {
    res.json({
      ok: true,
      status: 'pending',
      expiresAt: result.expiresAt,
      next: result.next,
    });
    return;
  }
  res.json(result);
});

/**
 * Bot confirms pending login (callback button — no website URL opened).
 */
authRouter.post('/telegram/login-complete', async (req, res) => {
  const result = await completeTelegramLoginPending({
    id: String(req.body?.id ?? req.body?.token ?? ''),
    telegramId: String(req.body?.telegramId ?? req.body?.tg ?? ''),
    username: req.body?.username != null ? String(req.body.username) : undefined,
    name: req.body?.name != null ? String(req.body.name) : undefined,
  });
  if (!result.ok) {
    const status =
      result.reason === 'expired' || result.reason === 'missing' || result.reason === 'consumed'
        ? 410
        : result.reason === 'already_ready'
          ? 409
          : 400;
    res.status(status).json(result);
    return;
  }
  res.json({ ok: true, user: result.user, next: result.next });
});

/**
 * Logged-in web user: create a one-time bot deep link to attach Telegram (wallet sync).
 */
authRouter.post('/telegram/link-start', (req, res) => {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  if (!session) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }
  const result = createTelegramAttachLink(session.user.id);
  if (!result.ok) {
    const status = result.reason === 'not_configured' ? 503 : 400;
    res.status(status).json(result);
    return;
  }
  res.json(result);
});

/**
 * Bot completes web→Telegram attach after /start wlink_<token>.
 * Auth is the one-time token (same pattern as other bot→API open calls).
 */
authRouter.post('/telegram/link-complete', async (req, res) => {
  const result = await completeTelegramAttach({
    token: String(req.body?.token ?? ''),
    telegramId: String(req.body?.telegramId ?? req.body?.tg ?? ''),
    username: req.body?.username != null ? String(req.body.username) : undefined,
    name: req.body?.name != null ? String(req.body.name) : undefined,
  });
  if (!result.ok) {
    const status =
      result.reason === 'expired'
        ? 410
        : result.reason === 'already_linked_other'
          ? 409
          : 400;
    res.status(status).json(result);
    return;
  }
  res.json({
    ok: true,
    user: result.user,
    merged: result.merged,
    wallet: result.wallet,
  });
});

function parseChannel(value: unknown): WebOtpChannel | null {
  return value === 'phone' || value === 'email' ? value : null;
}

authRouter.post('/otp/request', otpRequestLimit, async (req, res) => {
  const channel = parseChannel(req.body?.channel);
  const target = String(req.body?.target ?? '').trim();
  if (!channel) {
    res.status(400).json({ error: 'channel باید phone یا email باشد' });
    return;
  }
  if (!target) {
    res.status(400).json({ error: 'شماره یا ایمیل الزامی است' });
    return;
  }

  const result = await requestWebOtp(channel, target);
  if (!result.ok) {
    res.status(result.reason === 'cooldown' ? 429 : 400).json(result);
    return;
  }
  res.json(result);
});

authRouter.post('/otp/verify', otpVerifyLimit, (req, res) => {
  const channel = parseChannel(req.body?.channel);
  const target = String(req.body?.target ?? '').trim();
  const code = String(req.body?.code ?? '').trim();
  if (!channel || !target || !code) {
    res.status(400).json({ error: 'channel، target و code الزامی‌اند' });
    return;
  }

  const result = verifyWebOtp(channel, target, code);
  if (!result.ok) {
    res.status(400).json(result);
    return;
  }
  res.json({ ok: true, token: result.token, user: result.user });
});

authRouter.get('/me', (req, res) => {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  if (!session) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }
  const fresh = dbService.getUserById(session.user.id) ?? session.user;
  res.json({ ok: true, user: dbService.enrichUserProfileCard(fresh) });
});

/** کیف پول چندارزی — TON / Stars / سکه ربات / تومان (همان منبع ربات) */
authRouter.get('/wallet', (req, res) => {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  if (!session) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }
  const user = dbService.getUserById(session.user.id) ?? session.user;
  const wallet = dbService.getWallet(user.id);
  if (!wallet) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  const linked = Boolean(user.telegramId);
  const botUsername = String(process.env.TELEGRAM_BOT_USERNAME || 'Petdatebot').replace(/^@/, '');
  res.json({
    ok: true,
    wallet,
    coins: wallet.coins,
    telegram: {
      linked,
      telegramId: user.telegramId ?? null,
      username: user.username ?? null,
    },
    /** فقط ستاره پنل پت‌دیت — موجودی Stars حساب تلگرام نمایش داده نمی‌شود */
    telegramStars: {
      linked,
      petdateBalance: wallet.stars,
      walletStars: wallet.stars,
      topUpDeepLink: linked ? `https://t.me/${botUsername}?start=wstars` : null,
    },
  });
});

/** تاریخچه تراکنش‌های کیف پول کاربر (wallet_ledger) */
authRouter.get('/wallet/transactions', (req, res) => {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  if (!session) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }
  const limit = Number(req.query?.limit ?? 50);
  const offset = Number(req.query?.offset ?? 0);
  const transactions = dbService.listUserWalletTransactions(session.user.id, {
    limit: Number.isFinite(limit) ? limit : 50,
    offset: Number.isFinite(offset) ? offset : 0,
  });
  res.json({ ok: true, transactions });
});

/**
 * کسب درآمد / درخواست برداشت (فروش سکه) — همان قوانین ربات.
 * GET: موجودی، نرخ، حداقل، درخواست باز، تاریخچه.
 */
authRouter.get('/earn', (req, res) => {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  if (!session) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }
  const user = dbService.getUserById(session.user.id) ?? session.user;
  const wallet = dbService.getWallet(user.id);
  const coins = wallet?.coins ?? user.coins ?? 0;
  const openRequest = dbService.getOpenCoinSellRequest(user.id);
  const requests = dbService.listCoinSellRequests(user.id, 20);
  const canSell = coins >= MIN_SELL_COINS && !openRequest;
  res.json({
    ok: true,
    coins,
    wallet: wallet ?? { ton: 0, stars: 0, coins, toman: 0 },
    rateToman: COIN_SELL_PRICE_TOMAN,
    minCoins: MIN_SELL_COINS,
    estimatedToman: sellAmountToman(coins, COIN_SELL_PRICE_TOMAN),
    hasOpenRequest: Boolean(openRequest),
    openRequest,
    canSell,
    method: 'card' as const,
    methodLabelFa: 'کارت به‌کارت بانکی ایران',
    requests,
  });
});

/** ثبت درخواست برداشت / فروش سکه (وب — session auth) */
authRouter.post('/earn/withdraw', (req, res) => {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  if (!session) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }

  const coins = Number(req.body?.coins);
  const cardCheck = validateIranCard(String(req.body?.cardNumber ?? ''));
  if (!cardCheck.ok) {
    res.status(400).json({
      ok: false,
      reason: 'card',
      error:
        cardCheck.reason === 'luhn'
          ? 'شماره کارت معتبر نیست (چک رقم).'
          : 'شماره کارت ۱۶ رقمی بانکی ایران را درست وارد کنید.',
    });
    return;
  }

  const result = dbService.submitCoinSell({
    userId: session.user.id,
    coins,
    rateToman: COIN_SELL_PRICE_TOMAN,
    cardNumber: cardCheck.card,
    minCoins: MIN_SELL_COINS,
  });

  if (!result.ok) {
    const status =
      result.reason === 'missing' ? 404 : result.reason === 'pending' ? 409 : 400;
    const error =
      result.reason === 'min'
        ? `حداقل ${MIN_SELL_COINS} سکه لازم است.`
        : result.reason === 'balance'
          ? 'سکه کافی نیست.'
          : result.reason === 'pending'
            ? 'یک درخواست تسویه باز داری — تا بررسی ادمین صبر کن.'
            : 'ثبت درخواست ممکن نشد.';
    res.status(status).json({ ok: false, reason: result.reason, error });
    return;
  }

  res.status(201).json({
    ok: true,
    requestId: result.requestId,
    amountToman: result.amountToman,
    rateToman: result.rateToman,
    coins: Math.floor(coins),
    user: result.user,
    wallet: result.user.wallet ?? dbService.getWallet(session.user.id),
    openRequest: dbService.getOpenCoinSellRequest(session.user.id),
  });
});

authRouter.post('/logout', (req, res) => {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  if (session) dbService.deleteWebSession(session.token);
  res.json({ ok: true });
});

authRouter.patch('/profile', (req, res) => {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  if (!session) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }

  const body = req.body ?? {};
  const patch: Parameters<typeof dbService.updateUserProfile>[1] = {};
  if (body.name != null) patch.name = String(body.name).trim();
  if (body.age != null && Number.isFinite(Number(body.age))) patch.age = Number(body.age);
  if (body.gender === 'male' || body.gender === 'female') {
    patch.gender = body.gender as UserGender;
  }
  if (body.country != null) patch.country = String(body.country);
  if (body.province != null) patch.province = String(body.province);
  if (body.city != null) patch.city = String(body.city);
  if (body.bio != null) patch.bio = String(body.bio);
  if (Array.isArray(body.interests)) patch.interests = body.interests.map(String);
  if (body.avatarUrl != null) patch.avatarUrl = String(body.avatarUrl);
  if (
    body.onboarding === 'role_selected' ||
    body.onboarding === 'profile_incomplete' ||
    body.onboarding === 'profile_complete'
  ) {
    patch.onboarding = body.onboarding as OnboardingStatus;
  }
  if (typeof body.isActive === 'boolean') patch.isActive = body.isActive;
  if (typeof body.silentChatRequests === 'boolean') {
    patch.silentChatRequests = body.silentChatRequests;
  }

  const updated = dbService.updateUserProfile(session.user.id, patch);
  if (!updated) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  res.json({ ok: true, user: dbService.enrichUserProfileCard(updated) });
});

/** Upload profile avatar (multipart field: `file`). Auth required. Sets user.avatarUrl. */
authRouter.post('/avatar', (req, res) => {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  if (!session) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }

  avatarUpload.single('file')(req, res, (uploadErr) => {
    if (uploadErr) {
      const tooLarge =
        uploadErr instanceof multer.MulterError && uploadErr.code === 'LIMIT_FILE_SIZE';
      res.status(tooLarge ? 413 : 400).json({
        error: tooLarge
          ? 'حجم عکس بیش از حد مجاز است (حداکثر ۸ مگابایت)'
          : 'آپلود عکس ناموفق بود',
      });
      return;
    }

    const file = req.file;
    if (!file?.buffer?.length) {
      res.status(400).json({ error: 'فایل عکس الزامی است' });
      return;
    }

    try {
      const saved = saveUserAvatar({
        userId: session.user.id,
        originalName: file.originalname || 'avatar.jpg',
        mimeType: file.mimetype,
        buffer: file.buffer,
      });
      const updated = dbService.updateUserProfile(session.user.id, {
        avatarUrl: saved.urlPath,
        avatarCustom: true,
      });
      if (!updated) {
        res.status(404).json({ error: 'کاربر پیدا نشد' });
        return;
      }
      res.status(201).json({
        ok: true,
        url: saved.urlPath,
        storageKey: saved.storageKey,
        mimeType: file.mimetype,
        user: updated,
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'FILE_TOO_LARGE') {
        res.status(413).json({ error: 'حجم عکس بیش از حد مجاز است (حداکثر ۸ مگابایت)' });
        return;
      }
      if (err instanceof Error && err.message === 'INVALID_MIME') {
        res.status(400).json({ error: 'فقط عکس (JPG، PNG، WebP، GIF) مجاز است' });
        return;
      }
      console.warn('user avatar upload failed:', (err as Error).message);
      res.status(500).json({ error: 'ذخیره عکس ناموفق بود' });
    }
  });
});

/** Serve an uploaded user avatar by storage key `userId/filename`. */
authRouter.get('/avatar/:userId/:filename', (req, res) => {
  const userId = String(req.params.userId || '');
  const filename = String(req.params.filename || '');
  const storageKey = `${userId}/${filename}`;
  const abs = resolveUserAvatarPath(storageKey);
  if (!abs || !fs.existsSync(abs)) {
    res.status(404).json({ error: 'عکس پیدا نشد' });
    return;
  }
  res.setHeader('Content-Type', mimeFromUserAvatarKey(storageKey));
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(fs.readFileSync(abs));
});

/**
 * آپلود مدرک مربی / پرستار از وب (multipart field: `file`, body/query: kind).
 * بعد از آپلود وضعیت pending می‌شود تا ادمین تأیید کند.
 */
authRouter.post('/provider-credential', (req, res) => {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  if (!session) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }

  credentialUpload.single('file')(req, res, (uploadErr) => {
    if (uploadErr) {
      const tooLarge =
        uploadErr instanceof multer.MulterError && uploadErr.code === 'LIMIT_FILE_SIZE';
      res.status(tooLarge ? 413 : 400).json({
        error: tooLarge
          ? 'حجم فایل بیش از حد مجاز است (حداکثر ۸ مگابایت)'
          : 'آپلود مدرک ناموفق بود',
      });
      return;
    }

    const kindRaw = String(req.body?.kind ?? req.query?.kind ?? '').trim();
    const kind = kindRaw === 'sitter' ? 'sitter' : kindRaw === 'trainer' ? 'trainer' : null;
    if (!kind) {
      res.status(400).json({ error: 'kind باید trainer یا sitter باشد' });
      return;
    }
    const role = kind === 'trainer' ? 'trainer' : 'pet_sitter';
    if (!userHasRole(session.user, role)) {
      res.status(403).json({ error: 'نقش لازم را نداری' });
      return;
    }

    const file = req.file;
    if (!file?.buffer?.length) {
      res.status(400).json({ error: 'فایل مدرک الزامی است' });
      return;
    }

    try {
      const saved = saveProviderCredential({
        userId: session.user.id,
        originalName: file.originalname || 'credential.jpg',
        mimeType: file.mimetype,
        buffer: file.buffer,
      });
      const result = dbService.submitProviderCredential(
        session.user.id,
        kind,
        saved.urlPath
      );
      if (!result.ok) {
        res.status(result.reason === 'missing' ? 404 : 400).json({
          error: result.reason === 'no_file' ? 'فایل مدرک لازم است' : 'کاربر پیدا نشد',
        });
        return;
      }
      res.status(201).json({
        ok: true,
        url: saved.urlPath,
        user: dbService.enrichUserProfileCard(result.user),
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'FILE_TOO_LARGE') {
        res.status(413).json({ error: 'حجم فایل بیش از حد مجاز است (حداکثر ۸ مگابایت)' });
        return;
      }
      if (err instanceof Error && err.message === 'INVALID_MIME') {
        res.status(400).json({ error: 'فقط عکس یا PDF مجاز است' });
        return;
      }
      console.warn('provider credential upload failed:', (err as Error).message);
      res.status(500).json({ error: 'ذخیره مدرک ناموفق بود' });
    }
  });
});

/** Serve a web-uploaded provider credential file. */
authRouter.get('/provider-credential-file/:userId/:filename', (req, res) => {
  const userId = String(req.params.userId || '');
  const filename = String(req.params.filename || '');
  const storageKey = `${userId}/${filename}`;
  const abs = resolveProviderCredentialPath(storageKey);
  if (!abs || !fs.existsSync(abs)) {
    res.status(404).json({ error: 'فایل پیدا نشد' });
    return;
  }
  res.setHeader('Content-Type', mimeFromProviderCredentialKey(storageKey));
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.send(fs.readFileSync(abs));
});

/** وضعیت آنلاین/آفلاین دامپزشک (وب — هم‌تراز ربات) */
authRouter.patch('/vet-online', (req, res) => {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  if (!session) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }
  if (!userHasRole(session.user, 'vet')) {
    res.status(403).json({ error: 'این بخش مخصوص دامپزشکان است' });
    return;
  }
  const raw = req.body?.online;
  const online =
    raw === true || raw === 1 || raw === '1' || raw === 'true';
  const existing = dbService.getUserById(session.user.id) ?? session.user;
  if (online && existing.vetEnabled === false) {
    res.status(403).json({
      error: 'حساب دامپزشکی شما توسط مدیر غیرفعال شده است',
      reason: 'vet_disabled',
    });
    return;
  }
  if (online) {
    const cred = existing.vetCredentialStatus ?? 'none';
    if (cred === 'none') {
      res.status(403).json({
        error: 'اول مدرک دامپزشکی‌ات را آپلود کن تا پنل فعال شود.',
        reason: 'credential_required',
      });
      return;
    }
    if (cred !== 'verified') {
      res.status(403).json({
        error: 'مدرک دامپزشکی هنوز تأیید نشده؛ بعد از تأیید ادمین می‌توانی آنلاین شوی.',
        reason: 'credential_pending',
      });
      return;
    }
  }
  const updated = dbService.setVetOnline(Number(session.user.id), online);
  if (!updated) {
    res.status(400).json({ error: 'تغییر وضعیت آنلاین ممکن نشد' });
    return;
  }
  res.json({ ok: true, user: dbService.enrichUserProfileCard(updated) });
});

/** آنلاین مربی / پرستار (وب) */
authRouter.patch('/provider-online', (req, res) => {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  if (!session) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }
  const kindRaw = String(req.body?.kind ?? '').trim();
  const kind = kindRaw === 'sitter' ? 'sitter' : kindRaw === 'trainer' ? 'trainer' : null;
  if (!kind) {
    res.status(400).json({ error: 'kind باید trainer یا sitter باشد' });
    return;
  }
  const role = kind === 'trainer' ? 'trainer' : 'pet_sitter';
  if (!userHasRole(session.user, role)) {
    res.status(403).json({ error: 'نقش لازم را نداری' });
    return;
  }
  const raw = req.body?.online;
  const online =
    raw === true || raw === 1 || raw === '1' || raw === 'true';
  const existing = dbService.getUserById(session.user.id) ?? session.user;
  const enabled =
    kind === 'trainer' ? existing.trainerEnabled !== false : existing.sitterEnabled !== false;
  if (online && !enabled) {
    res.status(403).json({
      error: 'حساب شما توسط مدیر غیرفعال شده است',
      reason: 'provider_disabled',
    });
    return;
  }
  const cred =
    kind === 'trainer'
      ? existing.trainerCredentialStatus ?? 'none'
      : existing.sitterCredentialStatus ?? 'none';
  if (online && cred !== 'verified') {
    res.status(403).json({
      error:
        cred === 'none'
          ? 'اول مدرک را آپلود کن تا پنل فعال شود.'
          : 'مدرک هنوز تأیید نشده؛ بعد از تأیید ادمین آنلاین شو.',
      reason: cred === 'none' ? 'credential_required' : 'credential_pending',
    });
    return;
  }
  const updated = dbService.setProviderOnline(session.user.id, kind, online);
  if (!updated) {
    res.status(400).json({ error: 'تغییر وضعیت آنلاین ممکن نشد' });
    return;
  }
  res.json({ ok: true, user: dbService.enrichUserProfileCard(updated) });
});

authRouter.patch('/accept-seeker-advice', (req, res) => {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  if (!session) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }
  if (!userHasRole(session.user, 'pet_owner')) {
    res.status(403).json({ error: 'این تنظیم مخصوص صاحب پت است' });
    return;
  }
  const accept = Boolean(req.body?.accept ?? req.body?.acceptSeekerAdvice);
  const updated = dbService.setAcceptSeekerAdvice(session.user.id, accept);
  if (!updated) {
    res.status(400).json({ error: 'ثبت تنظیم ممکن نشد' });
    return;
  }
  res.json({ ok: true, user: dbService.enrichUserProfileCard(updated) });
});

/** مبلغ ویزیت دامپزشک (وب) */
authRouter.patch('/visit-fee', (req, res) => {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  if (!session) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }
  if (!userHasRole(session.user, 'vet')) {
    res.status(403).json({ error: 'این بخش مخصوص دامپزشکان است' });
    return;
  }
  const raw = req.body?.visitFeeCoins ?? req.body?.feeCoins ?? req.body?.fee;
  const fee = Number(raw);
  if (!Number.isFinite(fee) || fee < 1 || fee > 500) {
    res.status(400).json({ error: 'مبلغ ویزیت باید بین ۱ تا ۵۰۰ سکه باشد' });
    return;
  }
  const updated = dbService.setVisitFeeCoins(session.user.id, fee);
  if (!updated) {
    res.status(400).json({ error: 'ثبت مبلغ ویزیت ممکن نشد' });
    return;
  }
  res.json({ ok: true, user: updated });
});

authRouter.patch('/roles', (req, res) => {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  if (!session) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }

  const body = req.body ?? {};
  const roleCandidate =
    typeof body.role === 'string' && USER_ROLES.includes(body.role as UserRole)
      ? (body.role as UserRole)
      : null;

  // سوییچ نقش فعال بدون تغییر لیست نقش‌ها (مثل ربات: primaryOnly)
  if (body.primaryOnly === true) {
    if (!roleCandidate) {
      res.status(400).json({ error: 'نقش نامعتبر است' });
      return;
    }
    const updated = dbService.setUserPrimaryRole(session.user.id, roleCandidate);
    if (!updated) {
      res.status(400).json({ error: 'این نقش جزو نقش‌های شما نیست' });
      return;
    }
    res.json({ ok: true, user: updated });
    return;
  }

  const rolesRaw = Array.isArray(body.roles) ? body.roles : [];
  const roles = normalizeRoles(
    rolesRaw.filter((r: unknown): r is UserRole => USER_ROLES.includes(r as UserRole))
  );
  if (!roles.length) {
    res.status(400).json({ error: 'حداقل یک نقش معتبر لازم است' });
    return;
  }

  // setUserRoles نقش فعال قبلی را اگر هنوز در لیست باشد حفظ می‌کند
  let updated = dbService.setUserRoles(session.user.id, roles);
  if (!updated) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }

  // اختیاری: نقش فعال مشخص‌شده بعد از به‌روزرسانی لیست
  if (roleCandidate && roles.includes(roleCandidate)) {
    updated = dbService.setUserPrimaryRole(session.user.id, roleCandidate) ?? updated;
  }

  res.json({ ok: true, user: updated });
});

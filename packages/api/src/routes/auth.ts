import fs from 'fs';
import { Router } from 'express';
import multer from 'multer';
import type { OnboardingStatus, UserGender, UserRole } from '@petdate/shared';
import {
  COIN_PACKAGES,
  COIN_SELL_PRICE_TOMAN,
  WITHDRAWABLE_CURRENCIES,
  WITHDRAW_CURRENCY_LABELS_FA,
  normalizeWithdrawCurrency,
  withdrawRateToman,
  minWithdrawAmount,
  withdrawAmountToman,
  findCoinPackage,
  MIN_SELL_COINS,
  USER_ROLES,
  isStoredCustomProfilePhoto,
  normalizeRoles,
  sellAmountToman,
  userHasRole,
  validateIranCard,
} from '@petdate/shared';
import { dbService, type UserProfilePatch } from '../db';
import { getRuntimeFlags, rejectIfFlagOff } from '../runtime-settings';
import {
  completeTelegramAttach,
  completeTelegramLoginPending,
  createTelegramAttachLink,
  createTelegramLoginPending,
  exchangeTelegramWebLink,
  pollTelegramLoginPending,
} from '../services/telegram-web-link';
import { insufficientProfilePhotoChangePayload } from '../services/profile-photo-change';
import {
  MAX_USER_AVATAR_BYTES,
  mimeFromUserAvatarKey,
  resolveUserAvatarPath,
  saveUserAvatar,
} from '../services/user-avatar-store';
import {
  MAX_FACE_VERIFY_BYTES,
  isFaceVerifyVideoMime,
  saveFaceVerifyMedia,
} from '../services/face-verify-media-store';
import {
  MAX_PROVIDER_CREDENTIAL_BYTES,
  mimeFromProviderCredentialKey,
  resolveProviderCredentialPath,
  saveProviderCredential,
} from '../services/provider-credential-store';
import {
  MAX_PAYMENT_RECEIPT_BYTES,
  savePaymentReceipt,
} from '../services/payment-receipt-store';
import { paymentCardPublicInfo } from '../services/payment-card';
import { rateLimit } from '../middleware/rate-limit';
import {
  getUserFromBearer,
  requestWebOtp,
  verifyWebOtp,
  type WebOtpChannel,
} from '../services/web-otp';
import {
  buildGoogleAuthorizeUrl,
  completeGoogleOAuth,
  googleLoginErrorRedirect,
  isGoogleOAuthConfigured,
  readGoogleOAuthState,
} from '../services/google-web-auth';
import {
  getReferralStats,
  parseReferredByInput,
  tryClaimReferralForRecentUser,
} from '../services/referral-grant';

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

const googleLoginStartLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'درخواست ورود گوگل زیاد شده. کمی بعد دوباره تلاش کن.',
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

/** Face-verify accepts short selfie videos — larger than still avatars. */
const faceVerifyUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FACE_VERIFY_BYTES, files: 1 },
});

const credentialUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PROVIDER_CREDENTIAL_BYTES, files: 1 },
});

const paymentReceiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PAYMENT_RECEIPT_BYTES, files: 1 },
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
    referredBy: req.body?.referredBy,
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
    referredBy: req.body?.referredBy,
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
    // Keep 400 for provider/config failures so nginx (proxy_intercept_errors +
    // error_page 502/503/504) does not replace the useful Candoo/SMTP JSON body.
    // Infra visibility comes from explicit logAppEvent below + console.error bridge.
    if (result.reason === 'send_failed' || result.reason === 'not_configured') {
      const { logAppEvent } = await import('../services/app-logger');
      logAppEvent({
        level: 'error',
        source: 'sms',
        message:
          result.reason === 'not_configured'
            ? `web OTP ${channel}: provider not configured`
            : `web OTP ${channel}: ${result.error || 'send_failed'}`,
        path: '/api/auth/otp/request',
        method: 'POST',
        statusCode: result.reason === 'not_configured' ? 503 : 502,
        meta: { reason: result.reason, channel },
      });
    }
    const status = result.reason === 'cooldown' ? 429 : 400;
    res.status(status).json(result);
    return;
  }
  res.json(result);
});

authRouter.get('/providers', (_req, res) => {
  res.json({ ok: true, google: isGoogleOAuthConfigured() });
});

authRouter.get('/google', googleLoginStartLimit, (req, res) => {
  const next = req.query?.next != null ? String(req.query.next) : undefined;
  const url = buildGoogleAuthorizeUrl(next);
  if (!url) {
    res.redirect(302, googleLoginErrorRedirect('missing', next));
    return;
  }
  res.redirect(302, url);
});

authRouter.get('/google/callback', async (req, res) => {
  if (req.query?.error) {
    const st = readGoogleOAuthState(String(req.query?.state ?? ''));
    res.redirect(302, googleLoginErrorRedirect('denied', st.ok ? st.next : undefined));
    return;
  }
  const result = await completeGoogleOAuth({
    code: String(req.query?.code ?? ''),
    state: String(req.query?.state ?? ''),
  });
  res.redirect(302, result.redirect);
});

authRouter.post('/otp/verify', otpVerifyLimit, (req, res) => {
  const channel = parseChannel(req.body?.channel);
  const target = String(req.body?.target ?? '').trim();
  const code = String(req.body?.code ?? '').trim();
  if (!channel || !target || !code) {
    res.status(400).json({ error: 'channel، target و code الزامی‌اند' });
    return;
  }

  const result = verifyWebOtp(channel, target, code, req.body?.referredBy);
  if (!result.ok) {
    res.status(400).json(result);
    return;
  }
  res.json({ ok: true, token: result.token, user: result.user });
});

/** لینک/آمار دعوت دوستان برای کاربر واردشده */
authRouter.get('/referral', (req, res) => {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  if (!session) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }
  const stats = getReferralStats(session.user.id);
  if (!stats) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  res.json({ ok: true, ...stats });
});

/**
 * Safety net after web login: attribute invite if this account is brand-new.
 * Existing users cannot attach a later ref (too_old / already).
 */
authRouter.post('/referral/claim', (req, res) => {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  if (!session) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }
  const referredBy = parseReferredByInput(req.body?.referredBy ?? req.body?.ref);
  const result = tryClaimReferralForRecentUser({
    userId: session.user.id,
    referredBy,
  });
  res.json({
    ok: true,
    awarded: result.awarded,
    reason: result.reason ?? null,
    referralAward: result.referralAward,
    user: result.user,
  });
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

/** کیف پول چندارزی — Stars / سکه ربات / تومان (همان منبع ربات) */
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


/** نرخ‌های تبدیل کیف‌پول (خرید/فروش سکه) */
authRouter.get('/wallet/rates', (req, res) => {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  if (!session) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }
  const { getEconomyRates } = require('../economy-rates') as typeof import('../economy-rates');
  const rates = getEconomyRates();
  res.json({
    ok: true,
    rates,
    pairs: [
      { from: 'toman', to: 'coins', rate: rates.coinPriceToman, note: 'خرید سکه از موجودی تومان' },
      { from: 'coins', to: 'toman', rate: rates.coinSellPriceToman, note: 'فروش سکه به تومان کیف‌پول' },
      { from: 'stars', to: 'coins', rate: 1, note: '۱ ستاره = ۱ سکه' },
      { from: 'coins', to: 'stars', rate: 1, note: '۱ سکه = ۱ ستاره' },
    ],
  });
});

/** تبدیل ارز کیف‌پول (تومان↔سکه، ستاره↔سکه) */
authRouter.post('/wallet/convert', (req, res) => {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  if (!session) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }
  const fromRaw = String(req.body?.from ?? '').trim().toLowerCase();
  const toRaw = String(req.body?.to ?? '').trim().toLowerCase();
  const amount = Math.floor(Number(req.body?.amount));
  const from = fromRaw === 'coins' || fromRaw === 'stars' || fromRaw === 'toman' ? fromRaw : null;
  const to = toRaw === 'coins' || toRaw === 'stars' || toRaw === 'toman' ? toRaw : null;
  if (!from || !to) {
    res.status(400).json({ error: 'from/to باید coins | stars | toman باشد' });
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: 'amount نامعتبر است' });
    return;
  }
  const { quoteWalletConvert } = require('../economy-rates') as typeof import('../economy-rates');
  const quote = quoteWalletConvert(from, to, amount);
  if (!quote.ok) {
    res.status(400).json({ error: quote.error });
    return;
  }
  const result = dbService.convertWallet(session.user.id, from, to, quote.fromAmount, quote.toAmount, {
    reason: `تبدیل ${from}→${to}`,
  });
  if (!result.ok) {
    const status = result.reason === 'missing_user' ? 404 : 400;
    const msg =
      result.reason === 'insufficient'
        ? 'موجودی کافی نیست'
        : result.reason === 'same_currency'
          ? 'ارز مبدأ و مقصد یکسان است'
          : 'تبدیل ناموفق بود';
    res.status(status).json({ error: msg, reason: result.reason });
    return;
  }
  res.json({
    ok: true,
    wallet: result.wallet,
    converted: { from, to, fromAmount: quote.fromAmount, toAmount: quote.toAmount, rate: quote.rate },
  });
});

/** بسته‌های خرید سکه + کارت مقصد (همان اقتصاد ربات) */
authRouter.get('/wallet/buy-coins', (req, res) => {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  if (!session) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }
  const card = paymentCardPublicInfo();
  const open = dbService
    .listUserPaymentOrders(session.user.id, { limit: 10, method: 'card' })
    .filter((o) => {
      if (o.status !== 'awaiting_receipt' && o.status !== 'pending') return false;
      const pkg = String(o.packageId || '');
      return !pkg.startsWith('shop') && !pkg.startsWith('wstars:');
    });
  res.json({
    ok: true,
    packages: (() => {
      const { getCoinPriceToman } = require('../economy-rates') as typeof import('../economy-rates');
      const { coinPackagesAtRate } = require('@petdate/shared') as typeof import('@petdate/shared');
      return coinPackagesAtRate(getCoinPriceToman()).map((p) => ({
        id: p.id,
        coins: p.coins,
        toman: p.toman,
        stars: p.stars,
        vip: Boolean(p.vip),
        label: p.label,
      }));
    })(),
    card: card.configured
      ? {
          number: card.cardNumber,
          masked: card.cardMasked,
          grouped: card.cardGrouped,
          holder: card.cardHolder,
        }
      : null,
    paymentCardConfigured: card.configured,
    error: card.configured ? undefined : card.error,
    openOrders: open,
    paymentCardEnabled: getRuntimeFlags().paymentCardEnabled,
    paymentStarsEnabled: getRuntimeFlags().paymentStarsEnabled,
    message: card.configured
      ? 'مبلغ را کارت‌به‌کارت واریز کن، عکس رسید را همین‌جا بفرست؛ بعد از تأیید ادمین سکه به کیف پول مشترک واریز می‌شود.'
      : card.error,
  });
});

authRouter.post('/wallet/buy-coins/card', (req, res) => {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  if (!session) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }
  if (rejectIfFlagOff(res, 'paymentCardEnabled')) return;
  const dest = paymentCardPublicInfo();
  if (!dest.configured) {
    res.status(503).json({
      ok: false,
      reason: 'card_not_configured',
      error: dest.error || 'شماره کارت واریز پیکربندی نشده',
    });
    return;
  }
  const packageId = String(req.body?.packageId ?? '').trim();
  const pkg = findCoinPackage(packageId);
  if (!pkg) {
    res.status(400).json({ ok: false, error: 'بسته نامعتبر', reason: 'package' });
    return;
  }
  const open = dbService.findOpenCoinCardOrder(session.user.id);
  if (open) {
    res.status(409).json({
      ok: false,
      reason: 'open_order',
      error: 'یک درخواست کارت‌به‌کارت باز داری — اول همان را تکمیل یا منتظر تأیید بمان.',
      order: open,
      card: {
        number: dest.cardNumber,
        masked: dest.cardMasked,
        grouped: dest.cardGrouped,
        holder: dest.cardHolder,
      },
    });
    return;
  }
  const order = dbService.createPaymentOrder({
    userId: session.user.id,
    packageId: pkg.id,
    coins: pkg.coins,
    amountToman: pkg.toman,
    amountStars: pkg.stars,
    method: 'card',
    status: 'awaiting_receipt',
  });
  res.status(201).json({
    ok: true,
    order,
    package: pkg,
    card: {
      number: dest.cardNumber,
      masked: dest.cardMasked,
      grouped: dest.cardGrouped,
      holder: dest.cardHolder,
    },
    message: `مبلغ ${pkg.toman.toLocaleString('fa-IR')} تومان را واریز کن و عکس رسید را آپلود کن.`,
  });
});

authRouter.get('/wallet/payments', (req, res) => {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  if (!session) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }
  const limit = Number(req.query?.limit ?? 40);
  const method = typeof req.query?.method === 'string' ? req.query.method : undefined;
  const orders = dbService.listUserPaymentOrders(session.user.id, {
    limit: Number.isFinite(limit) ? limit : 40,
    method,
  });
  res.json({ ok: true, orders });
});

authRouter.post('/wallet/payments/:id/receipt', (req, res) => {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  if (!session) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }
  paymentReceiptUpload.single('file')(req, res, (uploadErr) => {
    if (uploadErr) {
      const tooBig =
        uploadErr instanceof multer.MulterError && uploadErr.code === 'LIMIT_FILE_SIZE';
      res.status(400).json({
        ok: false,
        error: tooBig ? 'حجم فایل زیاد است (حداکثر ۸ مگابایت).' : 'آپلود ناموفق بود.',
      });
      return;
    }
    try {
      const orderId = Number(req.params.id);
      const existing = dbService.getPaymentOrder(orderId);
      if (!existing || existing.userId !== session.user.id) {
        res.status(404).json({ ok: false, reason: 'missing', error: 'سفارش پیدا نشد.' });
        return;
      }
      if (String(existing.packageId).startsWith('shop')) {
        res.status(400).json({
          ok: false,
          reason: 'wrong_kind',
          error: 'برای رسید شاپ از صفحه پرداخت شاپ استفاده کن.',
        });
        return;
      }
      const file = req.file;
      if (!file?.buffer?.length) {
        res.status(400).json({ ok: false, reason: 'no_file', error: 'فایل رسید لازم است.' });
        return;
      }
      const transferRef =
        typeof req.body?.transferRef === 'string' ? req.body.transferRef.trim().slice(0, 64) : undefined;
      const saved = savePaymentReceipt({
        orderId,
        originalName: file.originalname || 'receipt.jpg',
        mimeType: file.mimetype,
        buffer: file.buffer,
      });
      const result = dbService.attachPaymentReceipt(orderId, saved.urlPath, { transferRef });
      if (!result.ok) {
        const status =
          result.reason === 'missing' ? 404 : result.reason === 'no_file' ? 400 : 409;
        res.status(status).json({
          ok: false,
          reason: result.reason,
          error:
            result.reason === 'bad_status'
              ? 'این سفارش دیگر منتظر رسید نیست.'
              : 'ثبت رسید ناموفق بود.',
        });
        return;
      }
      void import('../services/card2card-finance')
        .then(({ notifyAdminsPendingCardReceipt }) =>
          notifyAdminsPendingCardReceipt(result.order)
        )
        .catch((err) => console.warn('wallet receipt admin notify skipped:', (err as Error).message));
      res.json({ ok: true, order: result.order });
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === 'FILE_TOO_LARGE') {
        res.status(400).json({ ok: false, error: 'حجم فایل زیاد است.' });
        return;
      }
      if (msg === 'INVALID_MIME') {
        res.status(400).json({ ok: false, error: 'فقط تصویر JPG/PNG/WebP/GIF یا PDF مجاز است.' });
        return;
      }
      console.warn('wallet payment receipt upload failed:', msg);
      res.status(500).json({ ok: false, error: 'خطا در ذخیره رسید.' });
    }
  });
});

/** لغو سفارش کارت منتظر رسید از کیف پول وب (همگام با ربات). */
authRouter.post('/wallet/payments/:id/cancel', (req, res) => {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  if (!session) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }
  const result = dbService.cancelAwaitingCardPayment(Number(req.params.id), {
    userId: session.user.id,
  });
  if (!result.ok) {
    const status =
      result.reason === 'missing' ? 404 : result.reason === 'forbidden' ? 403 : 409;
    res.status(status).json({
      ok: false,
      reason: result.reason,
      error:
        result.reason === 'bad_status'
          ? 'این سفارش دیگر قابل لغو نیست (در صف تأیید است یا قبلاً بررسی شده).'
          : 'لغو ناموفق بود.',
    });
    return;
  }
  res.json({ ok: true, order: result.order });
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
  const walletBalances = wallet ?? {
    stars: 0,
    coins: user.coins ?? 0,
    toman: 0,
  };
  const coins = walletBalances.coins ?? user.coins ?? 0;
  const openRequest = dbService.getOpenCoinSellRequest(user.id);
  const requests = dbService.listCoinSellRequests(user.id, 20);
  const hasOpenRequest = Boolean(openRequest);
  const currencies = WITHDRAWABLE_CURRENCIES.map((currency) => {
    const balance =
      currency === 'stars'
        ? Number(walletBalances.stars ?? 0)
        : currency === 'toman'
          ? Number(walletBalances.toman ?? 0)
          : Number(coins);
    const rateToman = withdrawRateToman(currency);
    const minAmount = minWithdrawAmount(currency);
    return {
      currency,
      labelFa: WITHDRAW_CURRENCY_LABELS_FA[currency],
      balance,
      rateToman,
      minAmount,
      estimatedToman: withdrawAmountToman(balance, currency),
      canWithdraw: balance >= minAmount && !hasOpenRequest,
    };
  });
  const canSell = currencies.some((c) => c.canWithdraw);
  res.json({
    ok: true,
    coins,
    wallet: walletBalances,
    rateToman: COIN_SELL_PRICE_TOMAN,
    minCoins: MIN_SELL_COINS,
    estimatedToman: sellAmountToman(coins, COIN_SELL_PRICE_TOMAN),
    hasOpenRequest,
    openRequest,
    canSell,
    method: 'card' as const,
    methodLabelFa: 'کارت به‌کارت بانکی ایران',
    currencies,
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

  const currency = normalizeWithdrawCurrency(req.body?.currency) ?? 'coins';
  const amount = Number(req.body?.amount ?? req.body?.coins);
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

  const rateToman = withdrawRateToman(currency);
  const minAmount = minWithdrawAmount(currency);
  const result = dbService.submitCoinSell({
    userId: session.user.id,
    coins: amount,
    rateToman,
    cardNumber: cardCheck.card,
    minCoins: minAmount,
    currency,
    channel: 'web',
  });

  if (!result.ok) {
    const status =
      result.reason === 'missing' ? 404 : result.reason === 'pending' ? 409 : 400;
    const unit = WITHDRAW_CURRENCY_LABELS_FA[currency];
    const error =
      result.reason === 'min'
        ? `حداقل ${minAmount.toLocaleString('fa-IR')} ${unit} لازم است.`
        : result.reason === 'balance'
          ? `موجودی ${unit} کافی نیست.`
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
    currency: result.currency,
    coins: result.coins,
    amount: result.coins,
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
  const patch: UserProfilePatch = {};
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

  const result = dbService.commitUserProfileChange(session.user.id, patch);
  if (!result.ok) {
    if (result.reason === 'insufficient_coins') {
      res.status(402).json({
        ok: false,
        ...insufficientProfilePhotoChangePayload(result.balance ?? 0),
      });
      return;
    }
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  res.json({
    ok: true,
    charged: result.charged,
    verificationReset: result.verificationReset,
    user: dbService.enrichUserProfileCard(result.user),
  });
});

/** Upload profile avatar (multipart field: `file`). Auth required. Sets user.avatarUrl. */
authRouter.post('/avatar', (req, res) => {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  if (!session) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }

  avatarUpload.single('file')(req, res, (uploadErr) => {
    void (async () => {
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
        const saved = await saveUserAvatar({
          userId: session.user.id,
          originalName: file.originalname || 'avatar.jpg',
          mimeType: file.mimetype,
          buffer: file.buffer,
        });
        const result = dbService.commitUserProfileChange(session.user.id, {
          avatarUrl: saved.urlPath,
          avatarCustom: true,
        });
        if (!result.ok) {
          if (result.reason === 'insufficient_coins') {
            res.status(402).json({
              ok: false,
              ...insufficientProfilePhotoChangePayload(result.balance ?? 0),
            });
            return;
          }
          res.status(404).json({ error: 'کاربر پیدا نشد' });
          return;
        }
        res.status(201).json({
          ok: true,
          url: saved.urlPath,
          storageKey: saved.storageKey,
          mimeType: saved.mimeType,
          charged: result.charged,
          verificationReset: result.verificationReset,
          user: result.user,
        });
      } catch (err) {
        const code = err instanceof Error ? err.message : '';
        if (code === 'FILE_TOO_LARGE') {
          res.status(413).json({ error: 'حجم عکس بیش از حد مجاز است (حداکثر ۸ مگابایت)' });
          return;
        }
        if (code === 'INVALID_MIME' || code === 'INVALID_IMAGE') {
          res.status(400).json({
            error:
              code === 'INVALID_IMAGE'
                ? 'فایل عکس قابل پردازش نیست. یک عکس دیگر انتخاب کن'
                : 'فقط عکس مجاز است (JPG، PNG، WebP، HEIC، GIF)',
          });
          return;
        }
        console.warn('user avatar upload failed:', (err as Error).message);
        res.status(500).json({ error: 'ذخیره عکس ناموفق بود' });
      }
    })();
  });
});

/**
 * Serve uploaded user avatar. UUID path is unguessable; pending URLs are withheld
 * from public profile JSON, so <img> can load without Authorization.
 */
authRouter.get('/avatar/:userId/:filename', (req, res) => {
  const userId = String(req.params.userId || '');
  const filename = String(req.params.filename || '');
  const storageKey = `${userId}/${filename}`;
  const abs = resolveUserAvatarPath(storageKey);
  if (!abs || !fs.existsSync(abs)) {
    res.status(404).end();
    return;
  }

  res.setHeader('Content-Type', mimeFromUserAvatarKey(storageKey));
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.send(fs.readFileSync(abs));
});

/**
 * Web face verification — any role.
 * Accepts multipart `file` (short selfie **video** preferred; still image also accepted).
 * Requires a custom profile photo so admin can match face ↔ video.
 * Admin approve later grants FACE_VERIFY_REWARD (100) coins once.
 */
authRouter.post('/verification', (req, res) => {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  if (!session) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }

  const contentType = String(req.header('content-type') || '').toLowerCase();
  const isMultipart = contentType.includes('multipart/form-data');

  const verificationError = (
    reason: 'missing' | 'already_verified' | 'no_photo' | 'no_profile_photo' | string
  ): string => {
    if (reason === 'already_verified') return 'قبلاً احراز شده‌ای';
    if (reason === 'no_photo') return 'ویدیو یا سلفی احراز لازم است';
    if (reason === 'no_profile_photo') {
      return 'اول یک عکس پروفایل واضح از چهره‌ات بگذار؛ ویدیو باید با همان عکس یکی باشد';
    }
    if (reason === 'missing') return 'کاربر پیدا نشد';
    return 'ارسال احراز ناموفق بود';
  };

  const finish = (photoRef: string, opts?: { requireVideo?: boolean; mime?: string; name?: string }) => {
    if (opts?.requireVideo) {
      const isVideo = isFaceVerifyVideoMime(opts.mime, opts.name);
      if (!isVideo) {
        res.status(400).json({
          ok: false,
          reason: 'video_required',
          error: 'برای احراز چهره باید ویدیوی سلفی کوتاه بفرستی (نه فقط عکس)',
        });
        return;
      }
    }
    if (!isStoredCustomProfilePhoto(session.user.avatarUrl)) {
      // Fresh read — session may be stale after avatar upload in another tab.
      const fresh = dbService.getUserById(session.user.id);
      if (!fresh || !isStoredCustomProfilePhoto(fresh.avatarUrl)) {
        res.status(400).json({
          ok: false,
          reason: 'no_profile_photo',
          error: verificationError('no_profile_photo'),
        });
        return;
      }
    }
    const result = dbService.submitVerification(session.user.id, photoRef);
    if (!result.ok) {
      const status =
        result.reason === 'missing'
          ? 404
          : result.reason === 'already_verified'
            ? 409
            : 400;
      res.status(status).json({
        ok: false,
        reason: result.reason,
        error: verificationError(result.reason),
      });
      return;
    }
    res.json({ ok: true, user: dbService.enrichUserProfileCard(result.user) });
  };

  if (!isMultipart) {
    // Web face-verify requires a recorded selfie video — no JSON photoUrl shortcut.
    res.status(400).json({
      ok: false,
      reason: 'video_required',
      error:
        'برای احراز چهره باید ویدیوی سلفی کوتاه با دوربین ضبط و ارسال کنی. اول عکس پروفایل بگذار تا ادمین بتواند چهره‌ات را با ویدیو مقایسه کند.',
    });
    return;
  }

  faceVerifyUpload.single('file')(req, res, (uploadErr) => {
    void (async () => {
      if (uploadErr) {
        const tooLarge =
          uploadErr instanceof multer.MulterError && uploadErr.code === 'LIMIT_FILE_SIZE';
        res.status(tooLarge ? 413 : 400).json({
          error: tooLarge
            ? 'حجم فایل بیش از حد مجاز است (حداکثر ۱۵ مگابایت)'
            : 'آپلود ویدیو/سلفی احراز ناموفق بود',
        });
        return;
      }
      const file = req.file;
      if (!file?.buffer?.length) {
        res.status(400).json({ error: 'فایل ویدیو سلفی الزامی است' });
        return;
      }
      try {
        const saved = await saveFaceVerifyMedia({
          userId: session.user.id,
          originalName: file.originalname || 'verify.webm',
          mimeType: file.mimetype,
          buffer: file.buffer,
        });
        finish(saved.urlPath, {
          requireVideo: true,
          mime: saved.mimeType,
          name: saved.storageKey,
        });
      } catch (err) {
        const code = err instanceof Error ? err.message : '';
        if (code === 'FILE_TOO_LARGE') {
          res.status(413).json({ error: 'حجم فایل بیش از حد مجاز است (حداکثر ۱۵ مگابایت)' });
          return;
        }
        if (code === 'INVALID_MIME' || code === 'INVALID_IMAGE') {
          res.status(400).json({
            error:
              code === 'INVALID_IMAGE'
                ? 'فایل قابل پردازش نیست. یک ویدیوی سلفی دیگر ضبط کن'
                : 'فقط ویدیو یا عکس مجاز است (MP4، WebM، MOV، JPG، PNG، WebP)',
          });
          return;
        }
        console.warn('web face verification upload failed:', (err as Error).message);
        res.status(500).json({ error: 'ذخیره فایل احراز ناموفق بود' });
      }
    })();
  });
});

/**
 * آپلود مدرک دامپزشک / مربی از وب (multipart field: `file`, body/query: kind).
 * بعد از آپلود وضعیت pending می‌شود تا ادمین تأیید کند.
 * آنلاین/آفلاین بودن مانع آپلود نیست.
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
    const kind =
      kindRaw === 'sitter'
        ? 'sitter'
        : kindRaw === 'trainer'
          ? 'trainer'
          : kindRaw === 'vet'
            ? 'vet'
            : null;
    if (!kind) {
      res.status(400).json({ error: 'kind باید trainer یا vet باشد' });
      return;
    }
    if (kind === 'sitter') {
      res.status(410).json({
        error: 'سرویس پرستار پت حذف شده است',
        reason: 'sitter_removed',
      });
      return;
    }
    const requiredRole = kind === 'vet' ? 'vet' : 'trainer';
    if (!userHasRole(session.user, requiredRole)) {
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
      const result =
        kind === 'vet'
          ? dbService.submitVetCredential(session.user.id, saved.urlPath)
          : dbService.submitProviderCredential(session.user.id, 'trainer', saved.urlPath);
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
  if (kind === 'sitter') {
    res.status(410).json({
      error: 'سرویس پرستار پت حذف شده است',
      reason: 'sitter_removed',
    });
    return;
  }
  if (!userHasRole(session.user, 'trainer')) {
    res.status(403).json({ error: 'نقش لازم را نداری' });
    return;
  }
  const raw = req.body?.online;
  const online =
    raw === true || raw === 1 || raw === '1' || raw === 'true';
  const existing = dbService.getUserById(session.user.id) ?? session.user;
  const enabled = existing.trainerEnabled !== false;
  if (online && !enabled) {
    res.status(403).json({
      error: 'حساب شما توسط مدیر غیرفعال شده است',
      reason: 'provider_disabled',
    });
    return;
  }
  const cred = existing.trainerCredentialStatus ?? 'none';
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
  const updated = dbService.setProviderOnline(session.user.id, 'trainer', online);
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

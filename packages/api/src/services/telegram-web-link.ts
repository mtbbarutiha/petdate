import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { dbService } from '../db';
import { infra } from '../config/infra';
import { syncUserProfileFromTelegram } from './telegram-profile-sync';
import { parseReferredByInput, tryGrantReferralOnSignup } from './referral-grant';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Bot→web login links expire quickly so shared URLs die. */
const LINK_TTL_SEC = 15 * 60;
const MAX_SKEW_SEC = 60;
/** Web→bot attach tokens (stored in DB; deep-link payload must stay ≤64 chars). */
const ATTACH_TTL_SEC = 15 * 60;
/** Browser pending Telegram login (mobile same-tab poll). */
const PENDING_LOGIN_TTL_SEC = 8 * 60;

const SAFE_NEXT = /^\/(?!\/)[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]*$/;

function sanitizeLoginNext(raw: string | null | undefined, fallback = '/home'): string {
  if (!raw) return fallback;
  const value = raw.trim();
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  if (value.startsWith('/auth') || value.startsWith('/welcome')) return fallback;
  if (value === '/') return '/home';
  if (!SAFE_NEXT.test(value)) return fallback;
  return value;
}

function botToken(): string | null {
  const token = infra.telegram.botToken?.trim();
  return token || null;
}

function botUsername(): string | null {
  const u = infra.telegram.botUsername?.trim().replace(/^@/, '');
  return u || null;
}

export function signTelegramWebLink(telegramId: string, expSec: number): string | null {
  const token = botToken();
  if (!token) return null;
  const tg = String(telegramId).trim();
  if (!/^\d{3,20}$/.test(tg)) return null;
  return createHmac('sha256', token).update(`${tg}.${expSec}`).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ba.length !== bb.length || ba.length === 0) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * Exchange a bot-signed deep link for a web session on the same users row
 * (so pets/chats/wallet stay shared between Telegram and the website).
 * Also hydrates name/username/avatar from Telegram Bot API when appropriate.
 */
export async function exchangeTelegramWebLink(input: {
  telegramId: string;
  exp: string | number;
  sig: string;
  referredBy?: unknown;
}): Promise<
  | { ok: true; token: string; user: NonNullable<ReturnType<typeof dbService.getUserById>> }
  | { ok: false; reason: string; error: string }
> {
  const token = botToken();
  if (!token) {
    return { ok: false, reason: 'not_configured', error: 'ربات تلگرام پیکربندی نشده است' };
  }

  const telegramId = String(input.telegramId ?? '').trim();
  if (!/^\d{3,20}$/.test(telegramId)) {
    return { ok: false, reason: 'invalid_tg', error: 'شناسه تلگرام نامعتبر است' };
  }

  const exp = Number(input.exp);
  if (!Number.isFinite(exp) || exp <= 0) {
    return { ok: false, reason: 'invalid_exp', error: 'لینک نامعتبر است' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (exp < now - MAX_SKEW_SEC) {
    return { ok: false, reason: 'expired', error: 'لینک منقضی شده — دوباره از ربات باز کن' };
  }
  if (exp > now + LINK_TTL_SEC + MAX_SKEW_SEC) {
    return { ok: false, reason: 'invalid_exp', error: 'لینک نامعتبر است' };
  }

  const expected = signTelegramWebLink(telegramId, exp);
  const sig = String(input.sig ?? '').trim().toLowerCase();
  if (!expected || !sig || !safeEqualHex(expected, sig)) {
    return { ok: false, reason: 'bad_sig', error: 'لینک نامعتبر است' };
  }

  let user = dbService.getUserByTelegramId(telegramId);
  let created = false;
  if (!user) {
    const inserted = dbService.findOrCreateUser({
      telegramId,
      name: 'کاربر تلگرام',
    });
    user = inserted.user;
    created = inserted.created;
  }

  try {
    const synced = await syncUserProfileFromTelegram(user.id, telegramId);
    if (synced) user = synced;
  } catch (err) {
    console.warn('telegram profile sync on exchange failed:', (err as Error).message);
  }

  if (created) {
    tryGrantReferralOnSignup({
      invitedUserId: user.id,
      referredBy: parseReferredByInput(input.referredBy),
      created: true,
    });
    user = dbService.getUserById(user.id) ?? user;
  }

  const sessionToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  dbService.createWebSession(user.id, sessionToken, expiresAt);

  return { ok: true, token: sessionToken, user };
}

/**
 * Mobile same-browser login: create a pending id + bot deep link.
 * Payload: `wpend_<32hex>` (fits Telegram's 64-char start limit).
 */
export function createTelegramLoginPending(next?: string | null):
  | {
      ok: true;
      id: string;
      deepLink: string;
      botUsername: string;
      expiresAt: string;
      next: string;
    }
  | { ok: false; reason: string; error: string } {
  const username = botUsername();
  if (!username || !botToken()) {
    return { ok: false, reason: 'not_configured', error: 'ربات تلگرام پیکربندی نشده است' };
  }

  const safeNext = sanitizeLoginNext(next, '/home');
  const id = randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + PENDING_LOGIN_TTL_SEC * 1000).toISOString();
  dbService.createTelegramLoginPending(id, safeNext, expiresAt);

  return {
    ok: true,
    id,
    deepLink: `https://t.me/${username}?start=${encodeURIComponent(`wpend_${id}`)}`,
    botUsername: username,
    expiresAt,
    next: safeNext,
  };
}

/**
 * Browser polls until bot confirms. When ready, returns token once (consumed).
 */
export function pollTelegramLoginPending(id: string):
  | {
      ok: true;
      status: 'pending';
      expiresAt: string;
      next: string;
    }
  | {
      ok: true;
      status: 'ready';
      token: string;
      user: NonNullable<ReturnType<typeof dbService.getUserById>>;
      next: string;
    }
  | { ok: true; status: 'expired' | 'consumed' | 'missing'; error: string }
  | { ok: false; reason: string; error: string } {
  const rawId = String(id ?? '')
    .trim()
    .toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(rawId)) {
    return { ok: false, reason: 'invalid_id', error: 'شناسه ورود نامعتبر است' };
  }

  const row = dbService.getTelegramLoginPending(rawId);
  if (!row) {
    return { ok: true, status: 'missing', error: 'درخواست ورود پیدا نشد' };
  }

  const expMs = Date.parse(row.expiresAt);
  const expired = !Number.isFinite(expMs) || expMs < Date.now();

  if (row.consumedAt || row.status === 'consumed') {
    return { ok: true, status: 'consumed', error: 'این ورود قبلاً استفاده شده است' };
  }

  if (row.status === 'expired' || (row.status === 'pending' && expired)) {
    if (row.status === 'pending') dbService.cancelTelegramLoginPending(rawId);
    return { ok: true, status: 'expired', error: 'درخواست ورود منقضی شد — دوباره تلاش کن' };
  }

  if (row.status === 'pending') {
    return {
      ok: true,
      status: 'pending',
      expiresAt: row.expiresAt,
      next: row.nextPath,
    };
  }

  if (row.status === 'ready') {
    if (expired) {
      dbService.cancelTelegramLoginPending(rawId);
      return { ok: true, status: 'expired', error: 'درخواست ورود منقضی شد — دوباره تلاش کن' };
    }
    const consumed = dbService.consumeTelegramLoginPending(rawId);
    if (!consumed) {
      return { ok: true, status: 'consumed', error: 'این ورود قبلاً استفاده شده است' };
    }
    const user = dbService.getUserById(consumed.userId);
    if (!user) {
      return { ok: false, reason: 'missing_user', error: 'کاربر پیدا نشد' };
    }
    return {
      ok: true,
      status: 'ready',
      token: consumed.sessionToken,
      user,
      next: consumed.nextPath,
    };
  }

  return { ok: true, status: 'expired', error: 'درخواست ورود نامعتبر است' };
}

/**
 * Bot confirms pending login — create web session for the Telegram user.
 * No website URL is opened; the original browser polls for the token.
 */
export async function completeTelegramLoginPending(input: {
  id: string;
  telegramId: string;
  username?: string;
  name?: string;
  referredBy?: unknown;
}): Promise<
  | {
      ok: true;
      user: NonNullable<ReturnType<typeof dbService.getUserById>>;
      next: string;
    }
  | { ok: false; reason: string; error: string }
> {
  const rawId = String(input.id ?? '')
    .trim()
    .toLowerCase()
    .replace(/^wpend_/i, '');
  if (!/^[a-f0-9]{32}$/.test(rawId)) {
    return { ok: false, reason: 'invalid_id', error: 'شناسه ورود نامعتبر است' };
  }

  const telegramId = String(input.telegramId ?? '').trim();
  if (!/^\d{3,20}$/.test(telegramId)) {
    return { ok: false, reason: 'invalid_tg', error: 'شناسه تلگرام نامعتبر است' };
  }

  const row = dbService.getTelegramLoginPending(rawId);
  if (!row) {
    return { ok: false, reason: 'missing', error: 'درخواست ورود پیدا نشد یا منقضی شده' };
  }
  if (row.consumedAt || row.status === 'consumed') {
    return { ok: false, reason: 'consumed', error: 'این ورود قبلاً استفاده شده است' };
  }
  if (row.status === 'ready') {
    // Idempotent: same telegram user re-tapping confirm.
    if (row.telegramId && row.telegramId === telegramId) {
      const user = row.userId != null ? dbService.getUserById(row.userId) : null;
      if (user) return { ok: true, user, next: row.nextPath };
    }
    return { ok: false, reason: 'already_ready', error: 'این درخواست قبلاً تأیید شده است' };
  }
  if (row.status !== 'pending') {
    return { ok: false, reason: 'expired', error: 'درخواست ورود منقضی شده — از سایت دوباره بزن' };
  }
  const expMs = Date.parse(row.expiresAt);
  if (!Number.isFinite(expMs) || expMs < Date.now()) {
    dbService.cancelTelegramLoginPending(rawId);
    return { ok: false, reason: 'expired', error: 'درخواست ورود منقضی شده — از سایت دوباره بزن' };
  }

  let user = dbService.getUserByTelegramId(telegramId);
  let createdNew = false;
  if (!user) {
    const created = dbService.findOrCreateUser({
      telegramId,
      name: input.name?.trim() || 'کاربر تلگرام',
      username: input.username,
    });
    user = created.user;
    createdNew = created.created;
  } else if (input.name || input.username) {
    dbService.linkTelegramIdentity(user.id, telegramId, {
      username: input.username,
      name: input.name,
    });
    user = dbService.getUserById(user.id) ?? user;
  }

  try {
    const synced = await syncUserProfileFromTelegram(user.id, telegramId);
    if (synced) user = synced;
  } catch (err) {
    console.warn('telegram profile sync on pending login failed:', (err as Error).message);
  }

  if (createdNew) {
    tryGrantReferralOnSignup({
      invitedUserId: user.id,
      referredBy: parseReferredByInput(input.referredBy),
      created: true,
    });
    user = dbService.getUserById(user.id) ?? user;
  }

  const sessionToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  dbService.createWebSession(user.id, sessionToken, expiresAt);

  const marked = dbService.markTelegramLoginPendingReady({
    id: rawId,
    telegramId,
    userId: user.id,
    sessionToken,
  });
  if (!marked) {
    dbService.deleteWebSession(sessionToken);
    return {
      ok: false,
      reason: 'race',
      error: 'تأیید همزمان ناموفق بود — از سایت دوباره تلاش کن',
    };
  }

  return { ok: true, user, next: row.nextPath };
}

/**
 * Logged-in web user starts linking Telegram: one-time deep-link token for the bot.
 * Payload format: `wlink_<token>` (fits Telegram's 64-char start limit).
 */
export function createTelegramAttachLink(userId: number):
  | {
      ok: true;
      token: string;
      deepLink: string;
      botUsername: string;
      expiresAt: string;
      alreadyLinked: boolean;
      telegramId?: string;
    }
  | { ok: false; reason: string; error: string } {
  const user = dbService.getUserById(userId);
  if (!user) {
    return { ok: false, reason: 'missing_user', error: 'کاربر پیدا نشد' };
  }

  const username = botUsername();
  if (!username || !botToken()) {
    return { ok: false, reason: 'not_configured', error: 'ربات تلگرام پیکربندی نشده است' };
  }

  if (user.telegramId) {
    return {
      ok: true,
      token: '',
      deepLink: `https://t.me/${username}`,
      botUsername: username,
      expiresAt: new Date().toISOString(),
      alreadyLinked: true,
      telegramId: user.telegramId,
    };
  }

  const token = randomBytes(16).toString('hex'); // 32 chars → start payload = wlink_ + 32 = 38
  const expiresAt = new Date(Date.now() + ATTACH_TTL_SEC * 1000).toISOString();
  dbService.createTelegramAttachToken(userId, token, expiresAt);

  return {
    ok: true,
    token,
    deepLink: `https://t.me/${username}?start=${encodeURIComponent(`wlink_${token}`)}`,
    botUsername: username,
    expiresAt,
    alreadyLinked: false,
  };
}

/**
 * Bot completes web→Telegram attach after /start wlink_<token>.
 */
export async function completeTelegramAttach(input: {
  token: string;
  telegramId: string;
  username?: string;
  name?: string;
}): Promise<
  | {
      ok: true;
      user: NonNullable<ReturnType<typeof dbService.getUserById>>;
      merged: boolean;
      wallet: NonNullable<ReturnType<typeof dbService.getWallet>>;
    }
  | { ok: false; reason: string; error: string }
> {
  const rawToken = String(input.token ?? '')
    .trim()
    .replace(/^wlink_/i, '');
  if (!/^[a-f0-9]{32}$/i.test(rawToken)) {
    return { ok: false, reason: 'invalid_token', error: 'کد اتصال نامعتبر است' };
  }

  const telegramId = String(input.telegramId ?? '').trim();
  if (!/^\d{3,20}$/.test(telegramId)) {
    return { ok: false, reason: 'invalid_tg', error: 'شناسه تلگرام نامعتبر است' };
  }

  const row = dbService.consumeTelegramAttachToken(rawToken);
  if (!row) {
    return {
      ok: false,
      reason: 'expired',
      error: 'لینک منقضی یا استفاده‌شده است — از کیف پول وب دوباره اتصال بزن',
    };
  }

  const linked = dbService.linkTelegramIdentity(row.userId, telegramId, {
    username: input.username,
    name: input.name,
  });
  if (!linked.ok) {
    return { ok: false, reason: linked.reason, error: linked.error };
  }

  let user = linked.user;
  try {
    const synced = await syncUserProfileFromTelegram(user.id, telegramId);
    if (synced) user = synced;
  } catch (err) {
    console.warn('telegram profile sync on attach failed:', (err as Error).message);
  }

  const wallet = dbService.getWallet(user.id);
  return {
    ok: true,
    user,
    merged: linked.merged,
    wallet: wallet ?? { ton: 0, stars: 0, coins: 0, toman: 0 },
  };
}

export function buildTelegramWebLinkTtlSec(): number {
  return LINK_TTL_SEC;
}

export function buildTelegramPendingLoginTtlSec(): number {
  return PENDING_LOGIN_TTL_SEC;
}

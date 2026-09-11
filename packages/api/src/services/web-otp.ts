import { createHash, randomBytes, randomInt } from 'crypto';
import { normalizeIranMobile } from '@petdate/shared';
import { dbService } from '../db';
import { candooSendOtp, isCandooConfigured } from './candoo';
import { isSmtpConfigured, sendMail } from './mail';
import {
  OTP_EMAIL_EXPIRES_MINUTES,
  buildLoginOtpEmailHtml,
  buildLoginOtpEmailText,
} from './otp-email-html';
import { formatLoginOtpSms } from './otp-sms-copy';

const OTP_TTL_MS = OTP_EMAIL_EXPIRES_MINUTES * 60 * 1000;
const MAX_ATTEMPTS = 5;
const OTP_DIGITS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function hashCode(code: string): string {
  return createHash('sha256').update(`petdate-web-otp:${code}`).digest('hex');
}

function generateCode(): string {
  return String(randomInt(0, 10 ** OTP_DIGITS)).padStart(OTP_DIGITS, '0');
}

function normalizeEmail(raw: string): string | null {
  const email = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\u200b-\u200d\ufeff]/g, '');
  // Reject consecutive dots / leading-trailing dots that Postfix treats as illegal syntax
  // (e.g. user@gmail..com) — previously surfaced as cryptic «ارسال ایمیل ناموفق».
  if (
    !email ||
    email.length > 254 ||
    email.includes('..') ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
      email
    )
  ) {
    return null;
  }
  return email;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** Echo OTP in API JSON only for explicit local/dev — never in production. */
function echoDevCode(): boolean {
  if (isProduction()) return false;
  return process.env.WEB_OTP_DEV_ECHO === '1' || process.env.WEB_OTP_DEV_ECHO !== '0';
}

export type WebOtpChannel = 'phone' | 'email';

export async function requestWebOtp(
  channel: WebOtpChannel,
  targetRaw: string
): Promise<
  | { ok: true; channel: WebOtpChannel; target: string; expiresAt: string; devCode?: string }
  | { ok: false; reason: string; error: string; retryAfterSec?: number }
> {
  const target =
    channel === 'phone' ? normalizeIranMobile(targetRaw) : normalizeEmail(targetRaw);
  if (!target) {
    return {
      ok: false,
      reason: 'invalid_target',
      error: channel === 'phone' ? 'شماره موبایل نامعتبر است' : 'ایمیل نامعتبر است',
    };
  }

  const existing = dbService.getWebOtp(channel, target);
  if (existing) {
    const createdMs = new Date(existing.createdAt).getTime();
    const elapsed = Date.now() - createdMs;
    if (Number.isFinite(createdMs) && elapsed < RESEND_COOLDOWN_MS) {
      return {
        ok: false,
        reason: 'cooldown',
        error: 'کمی صبر کن و دوباره کد بخواه',
        retryAfterSec: Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000),
      };
    }
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
  dbService.upsertWebOtp({
    channel,
    target,
    codeHash: hashCode(code),
    expiresAt,
  });

  if (channel === 'phone') {
    if (isCandooConfigured()) {
      const sent = await candooSendOtp({
        recipient: target,
        body: formatLoginOtpSms(code),
      });
      if (!sent.ok) {
        console.error('web phone otp send failed', sent.error, 'src=', sent.srcNum);
        dbService.deleteWebOtp(channel, target);
        if (isProduction() || !echoDevCode()) {
          return {
            ok: false,
            reason: 'send_failed',
            error: sent.error || 'ارسال پیامک ناموفق بود',
          };
        }
      }
    } else if (isProduction()) {
      dbService.deleteWebOtp(channel, target);
      return {
        ok: false,
        reason: 'not_configured',
        error: 'سرویس پیامک پیکربندی نشده',
      };
    } else {
      console.info(`[web-otp][phone] ${target} => ${code}`);
    }
  } else if (isSmtpConfigured()) {
    const sent = await sendMail({
      to: target,
      subject: 'ورود به پت‌دیت — کد یک‌بارمصرف',
      text: buildLoginOtpEmailText(code),
      html: buildLoginOtpEmailHtml(code),
      purpose: 'login_otp',
    });
    if (!sent.ok) {
      dbService.deleteWebOtp(channel, target);
      // Never return ok after a failed send — OTP row is deleted above.
      return {
        ok: false,
        reason: 'send_failed',
        error: sent.error || 'ارسال ایمیل ناموفق بود',
      };
    }
  } else if (isProduction()) {
    dbService.deleteWebOtp(channel, target);
    return {
      ok: false,
      reason: 'not_configured',
      error: 'سرویس ایمیل پیکربندی نشده',
    };
  } else {
    console.info(`[web-otp][email] ${target} => ${code}`);
  }

  return {
    ok: true,
    channel,
    target,
    expiresAt,
    ...(echoDevCode() ? { devCode: code } : {}),
  };
}

export function verifyWebOtp(
  channel: WebOtpChannel,
  targetRaw: string,
  codeRaw: string
):
  | { ok: true; token: string; user: NonNullable<ReturnType<typeof dbService.getUserById>> }
  | { ok: false; reason: string; error: string; attemptsLeft?: number } {
  const target =
    channel === 'phone' ? normalizeIranMobile(targetRaw) : normalizeEmail(targetRaw);
  if (!target) {
    return {
      ok: false,
      reason: 'invalid_target',
      error: channel === 'phone' ? 'شماره موبایل نامعتبر است' : 'ایمیل نامعتبر است',
    };
  }

  const otp = dbService.getWebOtp(channel, target);
  if (!otp) return { ok: false, reason: 'no_otp', error: 'کدی درخواست نشده است' };
  if (new Date(otp.expiresAt).getTime() < Date.now()) {
    dbService.deleteWebOtp(channel, target);
    return { ok: false, reason: 'expired', error: 'کد منقضی شده است' };
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    dbService.deleteWebOtp(channel, target);
    return { ok: false, reason: 'too_many', error: 'تعداد تلاش بیش از حد' };
  }

  const code = String(codeRaw ?? '')
    .replace(/[^\d۰-۹٠-٩]/g, '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

  if (hashCode(code) !== otp.codeHash) {
    const attempts = dbService.bumpWebOtpAttempts(channel, target);
    const left = Math.max(0, MAX_ATTEMPTS - attempts);
    if (left <= 0) dbService.deleteWebOtp(channel, target);
    return {
      ok: false,
      reason: 'mismatch',
      error: 'کد نادرست است',
      attemptsLeft: left,
    };
  }

  dbService.deleteWebOtp(channel, target);

  let user =
    channel === 'phone'
      ? dbService.findOrCreateWebUser({ phone: target })
      : dbService.findOrCreateWebUser({ email: target });

  if (channel === 'phone') {
    user = dbService.markPhoneVerified(user.id, target) ?? user;
  } else {
    user = dbService.markEmailVerified(user.id, target) ?? user;
  }

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  dbService.createWebSession(user.id, token, expiresAt);

  return { ok: true, token, user };
}

export function getUserFromBearer(authHeader?: string) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  const session = dbService.getWebSession(token);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    dbService.deleteWebSession(token);
    return null;
  }
  const user = dbService.getUserById(session.userId);
  if (!user) return null;
  // Banned / soft-deleted accounts cannot keep an active session
  if (user.isActive === false) {
    dbService.deleteWebSession(token);
    return null;
  }
  return { token, user };
}

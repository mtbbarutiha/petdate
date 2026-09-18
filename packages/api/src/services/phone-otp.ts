import { createHash, randomInt } from 'crypto';
import { normalizeIranMobile } from '@petdate/shared';
import { dbService } from '../db';
import { candooSendOtp, isCandooConfigured } from './candoo';
import { formatPhoneVerifyOtpSms } from './otp-sms-copy';

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const OTP_DIGITS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

function hashCode(code: string): string {
  return createHash('sha256').update(`petdate-otp:${code}`).digest('hex');
}

function generateCode(): string {
  const max = 10 ** OTP_DIGITS;
  const n = randomInt(0, max);
  return String(n).padStart(OTP_DIGITS, '0');
}

export type SendOtpResult =
  | { ok: true; phone: string; expiresAt: string; srcNum: string }
  | {
      ok: false;
      reason:
        | 'invalid_phone'
        | 'not_configured'
        | 'user_missing'
        | 'cooldown'
        | 'send_failed';
      error?: string;
      retryAfterSec?: number;
    };

export type VerifyOtpResult =
  | { ok: true; user: NonNullable<ReturnType<typeof dbService.getUserById>> }
  | {
      ok: false;
      reason:
        | 'invalid_phone'
        | 'user_missing'
        | 'no_otp'
        | 'expired'
        | 'too_many'
        | 'mismatch';
      attemptsLeft?: number;
    };

export async function sendPhoneOtp(userId: number, phoneRaw: string): Promise<SendOtpResult> {
  if (!isCandooConfigured()) {
    return { ok: false, reason: 'not_configured', error: 'سرویس پیامک پیکربندی نشده' };
  }
  const phone = normalizeIranMobile(phoneRaw);
  if (!phone) {
    return { ok: false, reason: 'invalid_phone', error: 'شماره موبایل ایران نامعتبر است' };
  }
  const user = dbService.getUserById(userId);
  if (!user) return { ok: false, reason: 'user_missing' };

  const existing = dbService.getActivePhoneOtp(userId);
  if (existing) {
    const createdMs = new Date(existing.createdAt).getTime();
    const elapsed = Date.now() - createdMs;
    if (Number.isFinite(createdMs) && elapsed < RESEND_COOLDOWN_MS) {
      return {
        ok: false,
        reason: 'cooldown',
        retryAfterSec: Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000),
        error: 'کمی صبر کن و دوباره درخواست کد بده',
      };
    }
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
  dbService.upsertPhoneOtp({
    userId,
    phone,
    codeHash: hashCode(code),
    expiresAt,
  });

  const body = formatPhoneVerifyOtpSms(code);
  const sent = await candooSendOtp({
    recipient: phone,
    body,
    customerId: userId,
  });

  if (!sent.ok) {
    console.error('Candoo OTP send failed:', sent.error, sent.raw, 'src=', sent.srcNum);
    // Don't leave a cooldown OTP if SMS never went out
    dbService.deletePhoneOtpsForUser(userId);
    return {
      ok: false,
      reason: 'send_failed',
      error:
        sent.error ||
        'ارسال پیامک ناموفق بود. اگر مشکل ادامه داشت، کمی بعد دوباره تلاش کن.',
    };
  }

  return { ok: true, phone, expiresAt, srcNum: sent.srcNum };
}

export function verifyPhoneOtp(
  userId: number,
  phoneRaw: string,
  codeRaw: string
): VerifyOtpResult {
  const phone = normalizeIranMobile(phoneRaw);
  if (!phone) return { ok: false, reason: 'invalid_phone' };
  const user = dbService.getUserById(userId);
  if (!user) return { ok: false, reason: 'user_missing' };

  const otp = dbService.getActivePhoneOtp(userId);
  if (!otp || otp.phone !== phone) {
    return { ok: false, reason: 'no_otp' };
  }
  if (new Date(otp.expiresAt).getTime() < Date.now()) {
    dbService.deletePhoneOtpsForUser(userId);
    return { ok: false, reason: 'expired' };
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    dbService.deletePhoneOtpsForUser(userId);
    return { ok: false, reason: 'too_many' };
  }

  const code = String(codeRaw ?? '')
    .replace(/[^\d۰-۹٠-٩]/g, '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

  if (hashCode(code) !== otp.codeHash) {
    const attempts = dbService.bumpPhoneOtpAttempts(userId);
    const left = Math.max(0, MAX_ATTEMPTS - attempts);
    if (left <= 0) {
      dbService.deletePhoneOtpsForUser(userId);
      return { ok: false, reason: 'too_many', attemptsLeft: 0 };
    }
    return { ok: false, reason: 'mismatch', attemptsLeft: left };
  }

  const updated = dbService.markPhoneVerified(userId, phone);
  dbService.deletePhoneOtpsForUser(userId);
  if (!updated) return { ok: false, reason: 'user_missing' };
  try {
    const sales = require('../sales-service') as typeof import('../sales-service');
    sales.convertLeadsByPhone(phone, 'ثبت‌نام');
  } catch {
    /* sales schema optional during early boot */
  }
  return { ok: true, user: updated };
}

export { MAX_ATTEMPTS, OTP_TTL_MS, OTP_DIGITS };

import { parseReferralRef, REFERRAL_BONUS_COINS } from '@petdate/shared';
import { dbService } from '../db';
import { notifyReferralBonusTelegram } from './telegram-referral-notify';

/** New-account claim window — existing users cannot attach a later invite. */
export const REFERRAL_CLAIM_WINDOW_MS = 30 * 60 * 1000;

export type ReferralGrantReason =
  | 'missing'
  | 'self'
  | 'already'
  | 'referrer_missing'
  | 'not_new'
  | 'too_old';

export type ReferralAward = { referrerId: number; amount: number };

export type ReferralStats = {
  userId: number;
  code: string;
  webLink: string;
  telegramLink: string;
  bonusCoins: number;
  invitedCount: number;
  coinsEarned: number;
  referredBy: number | null;
};

export function parseReferredByInput(raw: unknown): number | null {
  return parseReferralRef(raw);
}

/** SQLite `datetime('now')` is UTC without a timezone suffix. */
export function parseUserCreatedAtMs(raw: string | null | undefined): number {
  const s = String(raw || '').trim();
  if (!s) return NaN;
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return n < 1e12 ? n * 1000 : n;
  }
  const iso = s.includes('T') ? s : s.replace(' ', 'T');
  const withZ = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`;
  return Date.parse(withZ);
}

export function isRecentSignup(createdAt: string | null | undefined, now = Date.now()): boolean {
  const ms = parseUserCreatedAtMs(createdAt);
  if (!Number.isFinite(ms)) return false;
  const age = now - ms;
  return age >= 0 && age <= REFERRAL_CLAIM_WINDOW_MS;
}

function notifyReferrer(
  referrer: { telegramId?: string | null; name?: string } | null,
  amount: number,
  invitedName?: string
): void {
  if (!referrer?.telegramId) return;
  void notifyReferralBonusTelegram({
    toTelegramId: referrer.telegramId,
    amount,
    invitedName,
  }).catch((err) => {
    console.warn('referral notify failed:', (err as Error).message);
  });
}

/**
 * Credit the inviter once when a brand-new user signs up from a ref link.
 * Idempotent: referred_by + coin_ledger `referral:<invitedId>`.
 */
export function tryGrantReferralOnSignup(opts: {
  invitedUserId: number;
  referredBy: number | null | undefined;
  created: boolean;
}): {
  awarded: boolean;
  referralAward?: ReferralAward;
  reason?: ReferralGrantReason;
} {
  const referredBy = parseReferredByInput(opts.referredBy);
  if (referredBy == null) {
    return { awarded: false, reason: 'missing' };
  }
  if (!opts.created) {
    return { awarded: false, reason: 'not_new' };
  }
  const referral = dbService.applyReferralBonus(opts.invitedUserId, referredBy);
  if (referral.awarded && referral.award) {
    notifyReferrer(referral.referrer, referral.award.amount, referral.invited?.name);
    return {
      awarded: true,
      referralAward: { referrerId: referredBy, amount: referral.award.amount },
    };
  }
  return { awarded: false, reason: referral.reason };
}

/**
 * Web login safety net: apply only if this account was just created
 * and has no referred_by yet (OTP / Telegram web login after /invite).
 */
export function tryClaimReferralForRecentUser(opts: {
  userId: number;
  referredBy: number | null | undefined;
}): {
  awarded: boolean;
  referralAward?: ReferralAward;
  reason?: ReferralGrantReason;
  user: ReturnType<typeof dbService.getUserById>;
} {
  const user = dbService.getUserById(opts.userId);
  if (!user) {
    return { awarded: false, reason: 'missing', user: null };
  }
  if (user.referredBy != null) {
    return { awarded: false, reason: 'already', user };
  }
  if (!isRecentSignup(user.createdAt)) {
    return { awarded: false, reason: 'too_old', user };
  }
  const granted = tryGrantReferralOnSignup({
    invitedUserId: user.id,
    referredBy: opts.referredBy,
    created: true,
  });
  return {
    ...granted,
    user: dbService.getUserById(user.id) ?? user,
  };
}

export function getReferralStats(userId: number): ReferralStats | null {
  return dbService.getReferralStats(userId);
}

export { REFERRAL_BONUS_COINS };

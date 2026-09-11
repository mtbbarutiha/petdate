/**
 * هزینه درخواست همبازی — کسر سکه از درخواست‌کننده (وب و ربات یکسان).
 */
import {
  PLAYDATE_FEE_REASON,
  PLAYDATE_REQUEST_COST,
  type User,
} from '@petdate/shared';
import { dbService } from '../db';

export type PlaydateFeeFail = {
  ok: false;
  reason: 'insufficient_coins';
  balance: number;
  cost: number;
  error: string;
};

export type PlaydateFeeOk = {
  ok: true;
  user: User;
  cost: number;
};

export function playdateFeeCost(): number {
  return PLAYDATE_REQUEST_COST;
}

export function insufficientPlaydateFeePayload(balance: number): Omit<PlaydateFeeFail, 'ok'> {
  const cost = PLAYDATE_REQUEST_COST;
  const bal = Math.max(0, Math.floor(Number(balance) || 0));
  return {
    reason: 'insufficient_coins',
    balance: bal,
    cost,
    error: `برای درخواست همبازی حداقل ${cost} سکه لازم داری. موجودی: ${bal}`,
  };
}

/**
 * کسر اتمیک ۲ سکه از درخواست‌کننده + ثبت لجر «هزینه همبازی».
 * در صورت موجودی ناکافی null/fail برمی‌گرداند و درخواستی نباید ساخته شود.
 */
export function chargePlaydateFee(
  userId: number,
  opts?: { refType?: string; refId?: string | number | null }
): PlaydateFeeOk | PlaydateFeeFail {
  const user = dbService.getUserById(userId);
  const balance = user?.coins ?? 0;
  const cost = PLAYDATE_REQUEST_COST;
  if (balance < cost) {
    return { ok: false, ...insufficientPlaydateFeePayload(balance) };
  }
  const debited = dbService.debitCoins(userId, cost, {
    reason: PLAYDATE_FEE_REASON,
    refType: opts?.refType ?? 'playdate_request',
    refId: opts?.refId ?? null,
  });
  if (!debited) {
    return {
      ok: false,
      ...insufficientPlaydateFeePayload(dbService.getUserById(userId)?.coins ?? 0),
    };
  }
  return { ok: true, user: debited, cost };
}

/** بازگرداندن هزینه اگر بعد از کسر هیچ درخواستی ساخته نشد */
export function refundPlaydateFee(
  userId: number,
  opts?: { refType?: string; refId?: string | number | null }
): void {
  dbService.creditCoins(userId, PLAYDATE_REQUEST_COST, undefined, {
    reason: 'بازگشت هزینه همبازی',
    refType: opts?.refType ?? 'playdate_fee_refund',
    refId: opts?.refId ?? null,
  });
}

/**
 * تعویض عکس پروفایل — کسر سکه + خروج از احراز چهره (وب و ربات یکسان).
 */
import {
  PROFILE_PHOTO_CHANGE_COST,
  PROFILE_PHOTO_CHANGE_FEE_REASON,
} from '@petdate/shared';

export type ProfilePhotoChangeFail = {
  ok: false;
  reason: 'insufficient_coins';
  balance: number;
  cost: number;
  error: string;
};

export function profilePhotoChangeCost(): number {
  return PROFILE_PHOTO_CHANGE_COST;
}

export function insufficientProfilePhotoChangePayload(
  balance: number
): Omit<ProfilePhotoChangeFail, 'ok'> {
  const cost = PROFILE_PHOTO_CHANGE_COST;
  const bal = Math.max(0, Math.floor(Number(balance) || 0));
  return {
    reason: 'insufficient_coins',
    balance: bal,
    cost,
    error: `برای تعویض عکس پروفایل حداقل ${cost} سکه لازم داری. موجودی: ${bal}. با تعویض عکس از حالت احراز چهره خارج می‌شوی.`,
  };
}

export { PROFILE_PHOTO_CHANGE_COST, PROFILE_PHOTO_CHANGE_FEE_REASON };

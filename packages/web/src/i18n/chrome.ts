import { FACE_VERIFY_REWARD, toPersianDigits, type VerificationStatus, type VetCredentialStatus } from '@petdate/shared';
import type { Lang, TranslateFn } from './types';

export function localeNum(lang: Lang, n: string | number): string {
  const s = String(n);
  return lang === 'en' ? s : toPersianDigits(s);
}

export function faceVerifyChromeLabel(
  t: TranslateFn,
  lang: Lang,
  status?: VerificationStatus | null
): string {
  const s = status ?? 'none';
  const n = localeNum(lang, FACE_VERIFY_REWARD);
  if (s === 'verified') return t('verify.faceVerified');
  if (s === 'pending') return t('verify.facePending');
  return t('verify.faceCta', { n });
}

export function credentialChromeLabel(
  t: TranslateFn,
  status?: VetCredentialStatus | null
): string {
  if (status === 'verified') return t('consultDesk.credVerified');
  if (status === 'pending') return t('consultDesk.credPending');
  return t('consultDesk.credNone');
}

export function gameStatusKey(status: string): string {
  switch (status) {
    case 'open':
      return 'games.statusOpen';
    case 'full':
      return 'games.statusFull';
    case 'cancelled':
      return 'games.statusCancelled';
    case 'completed':
      return 'games.statusCompleted';
    default:
      return 'games.statusOpen';
  }
}

export function gameTypeKey(type: string): string {
  switch (type) {
    case 'football':
      return 'games.typeFootball';
    case 'volleyball':
      return 'games.typeVolleyball';
    case 'basketball':
      return 'games.typeBasketball';
    case 'futsal':
      return 'games.typeFutsal';
    case 'tennis':
      return 'games.typeTennis';
    case 'board':
      return 'games.typeBoard';
    default:
      return 'games.typeOther';
  }
}

import { formatCardGrouped, maskCardNumber, validateIranCard } from './economy';

/**
 * Patterns that must never be treated as a live destination when used as
 * *code defaults* (empty / X placeholders). An explicitly configured env PAN
 * that matches a former hardcoded default is allowed — ops set it on purpose.
 */
export const UNSAFE_PAYMENT_CARD_NUMBERS = ['6037XXXXXXXXXXXX'] as const;

/** Former in-code default PAN — verify-prod-env may warn; API accepts when set in env. */
export const HISTORICAL_PAYMENT_CARD_DEFAULT = '62198611052407631';

export const PAYMENT_CARD_MISSING_ERROR_FA =
  'شماره کارت واریز پیکربندی نشده. PAYMENT_CARD_NUMBER و PAYMENT_CARD_HOLDER را در محیط سرور تنظیم کنید.';

export type PaymentCardOk = { ok: true; number: string; holder: string };
export type PaymentCardFail = {
  ok: false;
  reason: 'missing' | 'placeholder' | 'invalid';
  error: string;
};
export type PaymentCardResolved = PaymentCardOk | PaymentCardFail;

function digitsOnly(raw: string): string {
  return String(raw || '').replace(/\D/g, '');
}

export function isUnsafePaymentCardNumber(raw: string): boolean {
  const trimmed = String(raw || '').replace(/\s+/g, '');
  const digits = digitsOnly(trimmed);
  if (!trimmed) return true;
  if (/x/i.test(trimmed)) return true;
  return (UNSAFE_PAYMENT_CARD_NUMBERS as readonly string[]).some(
    (n) => n === trimmed || digitsOnly(n) === digits
  );
}

/**
 * Destination deposit card from trusted env.
 * - Missing / X-placeholder → fail closed (no code fallback).
 * - Prefer 16-digit Luhn-valid Iran PAN.
 * - Also accept explicit 16–19 digit env values (legacy ops PANs) without Luhn.
 */
export function resolvePaymentCardFromEnv(env: {
  PAYMENT_CARD_NUMBER?: string;
  PAYMENT_CARD_HOLDER?: string;
} = process.env): PaymentCardResolved {
  const rawNumber = String(env.PAYMENT_CARD_NUMBER || '').trim();
  const holder = String(env.PAYMENT_CARD_HOLDER || '').trim();
  if (!rawNumber || !holder) {
    return { ok: false, reason: 'missing', error: PAYMENT_CARD_MISSING_ERROR_FA };
  }
  if (isUnsafePaymentCardNumber(rawNumber)) {
    return { ok: false, reason: 'placeholder', error: PAYMENT_CARD_MISSING_ERROR_FA };
  }
  const digits = digitsOnly(rawNumber);
  const valid16 = validateIranCard(rawNumber);
  if (valid16.ok) {
    return { ok: true, number: valid16.card, holder };
  }
  // Explicit env destination: allow 16–19 digits even if Luhn fails (ops-configured).
  if (digits.length >= 16 && digits.length <= 19) {
    return { ok: true, number: digits, holder };
  }
  return { ok: false, reason: 'invalid', error: PAYMENT_CARD_MISSING_ERROR_FA };
}

export function paymentCardPublicFields(card: PaymentCardOk): {
  cardNumber: string;
  cardMasked: string;
  cardGrouped: string;
  cardHolder: string;
} {
  return {
    cardNumber: card.number,
    cardMasked: maskCardNumber(card.number),
    cardGrouped: formatCardGrouped(card.number),
    cardHolder: card.holder,
  };
}

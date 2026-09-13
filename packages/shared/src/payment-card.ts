import { formatCardGrouped, maskCardNumber, validateIranCard } from './economy';

/** Historical code defaults — never treat these as a live destination card. */
export const UNSAFE_PAYMENT_CARD_NUMBERS = [
  '62198611052407631',
  '6037XXXXXXXXXXXX',
] as const;

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
 * Fail closed: no hardcoded production card. Missing / placeholder / invalid → error.
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
  const valid = validateIranCard(rawNumber);
  if (!valid.ok) {
    return { ok: false, reason: 'invalid', error: PAYMENT_CARD_MISSING_ERROR_FA };
  }
  return { ok: true, number: valid.card, holder };
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

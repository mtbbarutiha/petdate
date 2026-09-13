import {
  paymentCardPublicFields,
  resolvePaymentCardFromEnv,
  type PaymentCardOk,
} from '@petdate/shared';

export function paymentCardFromEnv(): PaymentCardOk | null {
  const resolved = resolvePaymentCardFromEnv();
  return resolved.ok ? resolved : null;
}

export function paymentCardError(): string {
  const resolved = resolvePaymentCardFromEnv();
  return resolved.ok ? '' : resolved.error;
}

export function paymentCardPublicInfo(): {
  configured: boolean;
  cardNumber: string;
  cardMasked: string;
  cardGrouped: string;
  cardHolder: string;
  error?: string;
} {
  const card = paymentCardFromEnv();
  if (!card) {
    return {
      configured: false,
      cardNumber: '',
      cardMasked: '',
      cardGrouped: '',
      cardHolder: '',
      error: paymentCardError(),
    };
  }
  return { configured: true, ...paymentCardPublicFields(card) };
}

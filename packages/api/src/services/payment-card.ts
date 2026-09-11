import { formatCardGrouped, maskCardNumber } from '@petdate/shared';

export function paymentCardFromEnv(): { number: string; holder: string } {
  const number = String(process.env.PAYMENT_CARD_NUMBER || '62198611052407631').replace(/\s+/g, '');
  const holder = String(process.env.PAYMENT_CARD_HOLDER || 'محمد تقی باروتیها');
  return { number, holder };
}

export function paymentCardPublicInfo(): {
  cardNumber: string;
  cardMasked: string;
  cardGrouped: string;
  cardHolder: string;
} {
  const card = paymentCardFromEnv();
  return {
    cardNumber: card.number,
    cardMasked: maskCardNumber(card.number),
    cardGrouped: formatCardGrouped(card.number),
    cardHolder: card.holder,
  };
}

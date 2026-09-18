/**
 * Shop-order cancel + wallet refund helpers.
 * Status stays on the existing SHOP_ORDER_STATUSES set (`cancelled` = لغو شده).
 * A second call must not credit the wallet again.
 */

export const SHOP_REFUND_REF_TYPE = 'shop_order_refund';

export type ShopRefundCredits = {
  toman: number;
  coins: number;
  stars: number;
};

const PAID_LIKE = new Set(['paid', 'shipping', 'shipped', 'completed', 'awaiting_confirm']);

export function isAlreadyRefunded(input: {
  refundedAt?: string | null;
  ledgerHits?: number;
}): boolean {
  if (String(input.refundedAt || '').trim()) return true;
  return Number(input.ledgerHits || 0) > 0;
}

function floorNonNeg(value: unknown): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Amounts to credit back. Unpaid orders return zeros (cancel only).
 * Coins and toman are separate so a coin order is not also credited as toman.
 */
export function refundCredits(order: {
  status?: string;
  paymentCurrency?: string | null;
  paymentAmount?: number | null;
  totalToman?: number | null;
  paidFinal?: boolean | number | null;
  paymentStatus?: string | null;
}): ShopRefundCredits {
  const status = String(order.status || '');
  const currency = String(order.paymentCurrency || 'toman').toLowerCase();
  const paymentAmount = floorNonNeg(order.paymentAmount);
  const totalToman = floorNonNeg(order.totalToman);
  const paidFlag = Boolean(order.paidFinal) || String(order.paymentStatus || '') === 'paid';
  const looksPaid = PAID_LIKE.has(status) || paidFlag || paymentAmount > 0;
  if (!looksPaid) return { toman: 0, coins: 0, stars: 0 };

  if (currency === 'coins') {
    return { toman: 0, coins: paymentAmount, stars: 0 };
  }
  if (currency === 'stars' || currency === 'stars_xtr') {
    return { toman: 0, coins: 0, stars: paymentAmount };
  }
  return { toman: paymentAmount || totalToman, coins: 0, stars: 0 };
}

export function refundHasValue(credits: ShopRefundCredits): boolean {
  return credits.toman > 0 || credits.coins > 0 || credits.stars > 0;
}

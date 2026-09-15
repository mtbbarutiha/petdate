/**
 * Wallet refund when a shop order paid from coins / toman / wallet-stars is cancelled.
 * Card/XTR (external) payments are not credited back here.
 */
import { getDb, dbService } from '../db';
import type { ShopOrderRow } from '../admin-platform';

const WALLET_PAID_CURRENCIES = new Set(['coins', 'toman', 'stars']);
const REFUNDABLE_PRIOR = new Set(['paid', 'shipped', 'completed']);
export const SHOP_ORDER_REFUND_REF_TYPE = 'shop_order_refund';
export const SHOP_ORDER_REFUND_REASON = 'بازگشت خرید فروشگاه';

export type ShopOrderWalletRefundResult = {
  refunded: boolean;
  amount: number;
  currency?: string;
  reason?: 'not_cancelled' | 'not_wallet' | 'already' | 'no_user' | 'zero' | 'prior_unpaid';
};

function alreadyRefunded(orderId: number): boolean {
  const row = getDb()
    .prepare(
      `SELECT id FROM wallet_ledger
       WHERE ref_type = ? AND ref_id = ? AND direction = 'credit'
       LIMIT 1`
    )
    .get(SHOP_ORDER_REFUND_REF_TYPE, String(orderId)) as { id: number } | undefined;
  return Boolean(row?.id);
}

export function refundWalletOnShopOrderCancel(
  order: ShopOrderRow,
  opts?: { previousStatus?: string }
): ShopOrderWalletRefundResult {
  if (order.status !== 'cancelled') {
    return { refunded: false, amount: 0, reason: 'not_cancelled' };
  }
  const prior = opts?.previousStatus;
  if (prior && !REFUNDABLE_PRIOR.has(prior)) {
    return { refunded: false, amount: 0, reason: 'prior_unpaid' };
  }
  const currency = String(order.paymentCurrency || '').trim();
  if (!WALLET_PAID_CURRENCIES.has(currency)) {
    return { refunded: false, amount: 0, reason: 'not_wallet' };
  }
  const userId = order.userId;
  if (userId == null || !Number.isFinite(userId)) {
    return { refunded: false, amount: 0, reason: 'no_user' };
  }
  const amount = Math.floor(Number(order.paymentAmount ?? 0));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { refunded: false, amount: 0, reason: 'zero' };
  }
  if (alreadyRefunded(order.id)) {
    return { refunded: false, amount, currency, reason: 'already' };
  }

  if (currency === 'coins') {
    dbService.creditCoins(userId, amount, undefined, {
      reason: SHOP_ORDER_REFUND_REASON,
      refType: SHOP_ORDER_REFUND_REF_TYPE,
      refId: order.id,
    });
  } else if (currency === 'toman') {
    dbService.creditWallet(userId, 'toman', amount, {
      reason: SHOP_ORDER_REFUND_REASON,
      refType: SHOP_ORDER_REFUND_REF_TYPE,
      refId: order.id,
    });
  } else {
    dbService.creditWallet(userId, 'stars', amount, {
      reason: SHOP_ORDER_REFUND_REASON,
      refType: SHOP_ORDER_REFUND_REF_TYPE,
      refId: order.id,
    });
  }

  return { refunded: true, amount, currency };
}

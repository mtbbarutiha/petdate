/**
 * Runtime economy rates from admin_settings (fallback to shared defaults).
 * Keys: coinPriceToman (buy), coinSellPriceToman (sell / withdraw).
 */
import { COIN_PRICE_TOMAN, COIN_SELL_PRICE_TOMAN, STAR_SELL_PRICE_TOMAN } from '@petdate/shared';
import { adminPlatform } from './admin-platform';

export const ECONOMY_RATE_KEYS = {
  coinPriceToman: 'coinPriceToman',
  coinSellPriceToman: 'coinSellPriceToman',
} as const;

function positiveInt(raw: unknown, fallback: number): number {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export type EconomyRates = {
  coinPriceToman: number;
  coinSellPriceToman: number;
  starSellPriceToman: number;
};

export function getEconomyRates(): EconomyRates {
  const stored = adminPlatform.getSettings();
  const coinPriceToman = positiveInt(stored[ECONOMY_RATE_KEYS.coinPriceToman], COIN_PRICE_TOMAN);
  const coinSellPriceToman = positiveInt(
    stored[ECONOMY_RATE_KEYS.coinSellPriceToman],
    COIN_SELL_PRICE_TOMAN
  );
  return {
    coinPriceToman,
    coinSellPriceToman,
    starSellPriceToman: coinSellPriceToman || STAR_SELL_PRICE_TOMAN,
  };
}

export function getCoinPriceToman(): number {
  return getEconomyRates().coinPriceToman;
}

export function getCoinSellPriceToman(): number {
  return getEconomyRates().coinSellPriceToman;
}

/** Normalize admin patch — only allow positive integers for rate keys. */
export function normalizeEconomyRatePatch(
  patch: Record<string, string>
): { ok: true; patch: Record<string, string> } | { ok: false; error: string } {
  const out: Record<string, string> = {};
  if (patch.coinPriceToman != null) {
    const n = Math.floor(Number(patch.coinPriceToman));
    if (!Number.isFinite(n) || n < 100) {
      return { ok: false, error: 'نرخ خرید سکه باید حداقل ۱۰۰ تومان باشد' };
    }
    out.coinPriceToman = String(n);
  }
  if (patch.coinSellPriceToman != null) {
    const n = Math.floor(Number(patch.coinSellPriceToman));
    if (!Number.isFinite(n) || n < 50) {
      return { ok: false, error: 'نرخ فروش سکه باید حداقل ۵۰ تومان باشد' };
    }
    out.coinSellPriceToman = String(n);
  }
  return { ok: true, patch: out };
}

export type WalletConvertCurrency = 'coins' | 'stars' | 'toman';

/**
 * Quote convert amounts for allowed pairs.
 * toman→coins uses buy rate; coins→toman uses sell rate; stars↔coins is 1:1.
 * For toman→coins, fromAmount is adjusted down to an exact multiple of the rate.
 */
export function quoteWalletConvert(
  from: WalletConvertCurrency,
  to: WalletConvertCurrency,
  fromAmount: number,
  rates = getEconomyRates()
):
  | { ok: true; fromAmount: number; toAmount: number; rate: number }
  | { ok: false; error: string } {
  const amt = Math.floor(Number(fromAmount));
  if (!Number.isFinite(amt) || amt <= 0) {
    return { ok: false, error: 'مقدار نامعتبر است' };
  }
  if (from === to) return { ok: false, error: 'ارز مبدأ و مقصد یکسان است' };

  if (from === 'toman' && to === 'coins') {
    const rate = rates.coinPriceToman;
    const coins = Math.floor(amt / rate);
    if (coins <= 0) {
      return { ok: false, error: `حداقل ${rate.toLocaleString('fa-IR')} تومان برای ۱ سکه لازم است` };
    }
    return { ok: true, fromAmount: coins * rate, toAmount: coins, rate };
  }
  if (from === 'coins' && to === 'toman') {
    const rate = rates.coinSellPriceToman;
    return { ok: true, fromAmount: amt, toAmount: amt * rate, rate };
  }
  if ((from === 'stars' && to === 'coins') || (from === 'coins' && to === 'stars')) {
    return { ok: true, fromAmount: amt, toAmount: amt, rate: 1 };
  }
  return { ok: false, error: 'این جفت تبدیل پشتیبانی نمی‌شود' };
}

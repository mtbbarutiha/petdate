/**
 * Runtime economy rates from admin_settings (fallback to shared defaults).
 * Keys: coinPriceToman (buy), coinSellPriceToman (sell / withdraw).
 */
import {
  COIN_PRICE_TOMAN,
  COIN_SELL_PRICE_TOMAN,
  STAR_SELL_PRICE_TOMAN,
  quoteWalletConvert as quoteWalletConvertShared,
  type WalletCurrency,
} from '@petdate/shared';
import { adminPlatform } from './admin-platform';

/** Re-export shared quote helper; injects live admin rates by default. */
export type WalletConvertCurrency = WalletCurrency;

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

export function quoteWalletConvert(
  from: WalletConvertCurrency,
  to: WalletConvertCurrency,
  fromAmount: number,
  rates = getEconomyRates()
) {
  return quoteWalletConvertShared(from, to, fromAmount, rates);
}

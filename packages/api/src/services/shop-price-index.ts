/**
 * Server-side shop price index — mirrors web shopCatalog for coin checkout pricing.
 * Prefer live shop_products rows when present; fall back to this index.
 */
import priceIndexJson from '../data/shop-price-index.json';

export type ShopPriceEntry = {
  id: string;
  slug: string;
  title: string;
  brandId: string;
  categorySlug: string;
  priceToman: number;
};

/** Keep in sync with packages/api/src/data/shop-pilot-products.ts */
const PILOT_PRICE_INDEX: ShopPriceEntry[] = [
  {
    id: 'p221',
    slug: 'dog-food-royal-canin-mini-adult-2kg',
    title: 'رویال کنین مینی ادالت ۲ کیلو — سگ بالغ نژاد کوچک',
    brandId: 'royal-canin',
    categorySlug: 'dog-food',
    priceToman: 8_881_000,
  },
  {
    id: 'p222',
    slug: 'dog-food-royal-canin-xsmall-puppy-1-5kg',
    title: 'رویال کنین ایکس‌اسمال پاپی ۱٫۵ کیلو — توله نژاد خیلی کوچک',
    brandId: 'royal-canin',
    categorySlug: 'dog-food',
    priceToman: 8_894_000,
  },
  {
    id: 'p223',
    slug: 'cat-food-royal-canin-persian-adult-400g',
    title: 'رویال کنین پرشین ادالت ۴۰۰ گرم — گربه پرشین بالغ',
    brandId: 'royal-canin',
    categorySlug: 'cat-food',
    priceToman: 2_741_600,
  },
];

const entries = [...(priceIndexJson as ShopPriceEntry[])];
const seen = new Set(entries.flatMap((e) => [e.id, e.slug]));
for (const extra of PILOT_PRICE_INDEX) {
  if (seen.has(extra.id) || seen.has(extra.slug)) continue;
  entries.push(extra);
  seen.add(extra.id);
  seen.add(extra.slug);
}

const byId = new Map<string, ShopPriceEntry>();
const bySlug = new Map<string, ShopPriceEntry>();
for (const e of entries) {
  byId.set(e.id, e);
  bySlug.set(e.slug, e);
}

export function lookupShopPrice(idOrSlug: string): ShopPriceEntry | null {
  return byId.get(idOrSlug) ?? bySlug.get(idOrSlug) ?? null;
}

export function shopPriceIndexSize(): number {
  return entries.length;
}

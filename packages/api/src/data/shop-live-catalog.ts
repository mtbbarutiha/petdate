/**
 * Live shop catalog guard — keep ONLY p221–p279 (3 pilots + 12 Batch 2 + 14 Batch 3 + 10 multi wave 1 + 10 multi wave 2 + 10 multi wave 3).
 * Purges leftover demo/seed rows (p1–p220, finance placeholders, etc.)
 * without touching live prices, images, or stock.
 */
import { getDb } from '../db';
import {
  LIVE_SHOP_PRODUCT_IDS,
  ZERO_MARGIN_SHOP_SLUGS,
  isLiveShopProductIdOrSlug,
} from './shop-zero-margin-slugs';

export { LIVE_SHOP_PRODUCT_IDS, ZERO_MARGIN_SHOP_SLUGS, isLiveShopProductIdOrSlug };

export const LIVE_SHOP_CATEGORY_SLUGS = [
  'dog-food',
  'cat-food',
  'cat-litter',
  'dog-treats',
  'cat-treats',
  'dog-toys',
  'cat-toys',
  'dog-accessories',
] as const;

export function purgeDemoShopProducts(): { products: number; categories: number } {
  const d = getDb();
  const idHolders = LIVE_SHOP_PRODUCT_IDS.map(() => '?').join(',');
  const slugHolders = ZERO_MARGIN_SHOP_SLUGS.map(() => '?').join(',');
  const products = d
    .prepare(
      `DELETE FROM shop_products
       WHERE id NOT IN (${idHolders})
         AND slug NOT IN (${slugHolders})`
    )
    .run(...LIVE_SHOP_PRODUCT_IDS, ...ZERO_MARGIN_SHOP_SLUGS).changes;

  const catHolders = LIVE_SHOP_CATEGORY_SLUGS.map(() => '?').join(',');
  const categories = d
    .prepare(
      `DELETE FROM shop_categories
       WHERE slug NOT IN (${catHolders})
         AND slug NOT IN (SELECT DISTINCT category_slug FROM shop_products)`
    )
    .run(...LIVE_SHOP_CATEGORY_SLUGS).changes;

  if (products || categories) {
    console.info(`shop catalog purge: removed ${products} demo products, ${categories} empty categories`);
  }
  return { products, categories };
}

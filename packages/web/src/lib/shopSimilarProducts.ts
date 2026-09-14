/**
 * DigiKala-style «کالاهای مشابه» ranking for shop PDP.
 * Same category and/or same brand, exclude current, prefer in-stock.
 */
import { filterProducts, type ShopProduct } from '../data/shopCatalog';

/** Target rail length (DigiKala shows ~8–12). */
export const SIMILAR_PRODUCTS_LIMIT = 10;

/** Show «تنها N عدد…» when live stockQty is at or below this. */
export const SIMILAR_LOW_STOCK_THRESHOLD = 5;

export function similarProductScore(current: ShopProduct, candidate: ShopProduct): number {
  if (candidate.id === current.id) return -1;
  const sameCategory = candidate.categorySlug === current.categorySlug;
  const sameBrand = Boolean(current.brandId) && candidate.brandId === current.brandId;
  if (!sameCategory && !sameBrand) return -1;

  let score = 0;
  if (sameCategory && sameBrand) score += 3;
  else if (sameCategory) score += 2;
  else score += 1;
  if (candidate.inStock) score += 0.5;
  return score;
}

/** Live catalog via filterProducts (hydrated DB when ready, else static seed). */
export function getSimilarProducts(
  current: ShopProduct,
  limit: number = SIMILAR_PRODUCTS_LIMIT,
): ShopProduct[] {
  const capped = Math.max(1, Math.min(12, Math.round(limit)));
  return filterProducts()
    .map((p) => ({ p, score: similarProductScore(current, p) }))
    .filter((row) => row.score >= 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.p.title.localeCompare(b.p.title, 'fa');
    })
    .slice(0, capped)
    .map((row) => row.p);
}

export function similarLowStockQty(p: ShopProduct): number | null {
  if (p.stockQty == null || !Number.isFinite(p.stockQty)) return null;
  const qty = Math.round(p.stockQty);
  if (qty <= 0 || qty > SIMILAR_LOW_STOCK_THRESHOLD) return null;
  return qty;
}

/** DigiKala «فروش ویژه» for sale-ish badges. */
export function isSpecialSaleBadge(badge: ShopProduct['badge']): boolean {
  return badge === 'sale' || badge === 'hot' || badge === 'limited';
}

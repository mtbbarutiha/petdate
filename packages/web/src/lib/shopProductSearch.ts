/**
 * Shop product search helpers — URL + shortcut contracts for ShopProductSearch.
 */

/** Listing route that already honors `?q=` (ShopCategoryPage + filterProducts). */
export function shopSearchResultsPath(q: string): string {
  const trimmed = q.trim();
  if (!trimmed) return '/shop/c/all';
  return `/shop/c/all?q=${encodeURIComponent(trimmed)}`;
}

export function shopProductPath(slug: string): string {
  return `/shop/product/${encodeURIComponent(slug)}`;
}

/** True when Ctrl/Cmd+K should focus the shop search field. */
export function isShopSearchHotkey(
  e: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey'>
): boolean {
  if (e.altKey) return false;
  if (e.key !== 'k' && e.key !== 'K') return false;
  return e.metaKey || e.ctrlKey;
}

/** Cap live dropdown suggestions so the popover stays scannable. */
export const SHOP_SEARCH_DROPDOWN_LIMIT = 8;

/**
 * Local shop product likes / favorites (guest-safe, mirrors cart draft pattern).
 * Storage: petdate.shop.favorites.v1 → string[] of product ids.
 */

export const SHOP_FAVORITES_STORAGE_KEY = 'petdate.shop.favorites.v1';

export function readShopFavoriteIds(): string[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(SHOP_FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
  } catch {
    return [];
  }
}

export function writeShopFavoriteIds(ids: string[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const unique = Array.from(new Set(ids.filter((id) => typeof id === 'string' && id.length > 0)));
    localStorage.setItem(SHOP_FAVORITES_STORAGE_KEY, JSON.stringify(unique));
  } catch {
    /* quota / private mode */
  }
}

export function isShopFavorite(productId: string, ids: string[] = readShopFavoriteIds()): boolean {
  return ids.includes(productId);
}

/** Returns next id list after toggle. Does not write storage. */
export function toggleShopFavoriteId(productId: string, ids: string[]): string[] {
  const id = productId.trim();
  if (!id) return ids.slice();
  if (ids.includes(id)) return ids.filter((x) => x !== id);
  return [...ids, id];
}

import { useCallback, useEffect, useState } from 'react';
import {
  isShopFavorite,
  readShopFavoriteIds,
  toggleShopFavoriteId,
  writeShopFavoriteIds,
} from '../lib/shopFavorites';

/**
 * Persist product likes in localStorage (same guest-draft idea as the shop cart).
 */
export function useShopFavorites() {
  const [ids, setIds] = useState<string[]>(() =>
    typeof window === 'undefined' ? [] : readShopFavoriteIds()
  );

  useEffect(() => {
    setIds(readShopFavoriteIds());
  }, []);

  const liked = useCallback((productId: string) => isShopFavorite(productId, ids), [ids]);

  const toggle = useCallback((productId: string) => {
    setIds((prev) => {
      const next = toggleShopFavoriteId(productId, prev);
      writeShopFavoriteIds(next);
      return next;
    });
  }, []);

  return { ids, liked, toggle };
}
